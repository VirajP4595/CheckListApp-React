import React, { useEffect, useCallback, useRef, useState } from 'react';
import { Button, Spinner, Dialog, DialogTrigger, DialogSurface, DialogTitle, DialogBody, DialogActions, DialogContent } from '@fluentui/react-components';
import { ArrowLeft24Regular, Save24Regular, Add24Regular, History24Regular, Eye24Regular, ClipboardPulse24Regular, Delete24Regular, ArrowDownload24Regular } from '@fluentui/react-icons';
import { Panel, PanelType } from '@fluentui/react/lib/Panel';
import { useChecklistStore, useUserStore } from '../../stores';
import { STATUS_CONFIG, type Revision } from '../../models';
import { WorkgroupSection } from './WorkgroupSection';
import { AutoSaveIndicator } from './AutoSaveIndicator';
import { RevisionPanel } from '../Revision/RevisionPanel';
import { RevisionViewer } from '../Revision/RevisionViewer';

import { FilterBar, type FilterState } from './FilterBar';
import { usePdfExport } from '../../hooks/usePdfExport';
import { useBtcExport } from '../../hooks/useBtcExport';
import { HelpGuide } from './HelpGuide';
import { CommonNotes } from './Sidebar/CommonNotes';
import { JobMetadataHeader } from './Sidebar/JobMetadataHeader';
import { ChecklistInfoDialog } from './Sidebar/ChecklistInfoDialog';
import ActivityLogPanel from './Sidebar/ActivityLogPanel';
import { PdfGenerationProgressModal } from '../Checklist/PdfGenerationProgressModal';
import { DeleteProgressModal } from '../Checklist/DeleteProgressModal';
import { getChecklistService, getRevisionService } from '../../services';
import styles from './ChecklistEditor.module.scss';

interface ChecklistEditorProps {
    checklistId: string;
    onBack: () => void;
}

export const ChecklistEditor: React.FC<ChecklistEditorProps> = ({ checklistId, onBack }) => {
    const lastPasteTime = useRef<number>(0);
    const {
        activeChecklist,
        isLoading,
        isSaving,
        lastSaved,
        loadChecklist,
        saveChecklist,
        updateChecklist,
        addWorkgroup,
        processingItems,
        deleteChecklist
    } = useChecklistStore();

    const { isSuperAdmin } = useUserStore();

    // PDF Export Hook
    const { exportPdf, loadingProgress: pdfLoadingProgress, cancelExport: cancelPdfExport } = usePdfExport();

    // BTC Export Hook
    const { exportBtc, loadingProgress: btcLoadingProgress, cancelExport: cancelBtcExport } = useBtcExport();

    // Local state for full load overlay (initial load/preview)
    const [showRevisionPanel, setShowRevisionPanel] = useState(false);
    const [showActivityPanel, setShowActivityPanel] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [viewingRevision, setViewingRevision] = useState<Revision | null>(null);

    const [loadingProgress, setLoadingProgress] = useState<{ open: boolean; title: string; status: string; percent: number; cancelled: boolean }>({ open: false, title: 'Loading...', status: '', percent: 0, cancelled: false });
    const [deleteProgress, setDeleteProgress] = useState<{ open: boolean; status: string; percent: number }>({ open: false, status: '', percent: 0 });
    const [filters, setFilters] = useState<FilterState>({ answerStates: [], markedForReview: null, internalOnly: null, notifyAdmin: null, builderToConfirm: null, workgroupIds: [] });
    const [expandWorkgroups, setExpandWorkgroups] = useState(false);  // Collapsed by default
    const [expandTasks, setExpandTasks] = useState(false);  // Collapsed by default

    const isCancelledRef = useRef(false);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        void loadChecklist(checklistId);
    }, [checklistId, loadChecklist]);

    const triggerAutoSave = useCallback(() => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
            void saveChecklist();
        }, 2000);
    }, [saveChecklist]);

    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    const handleViewRevision = async (revision: Revision) => {
        setLoadingProgress({ open: true, title: 'Loading Revision', status: 'Fetching data...', percent: 10, cancelled: false });
        try {
            // Simulated progress for better UX
            setLoadingProgress(prev => ({ ...prev, percent: 40 }));

            // Fetch full revision with snapshot
            const fullRevision = await getRevisionService().getRevision(revision.id);
            setLoadingProgress(prev => ({ ...prev, percent: 90, status: 'Preparing view...' }));

            setViewingRevision(fullRevision || revision);
        } catch (error) {
            console.error("Failed to load revision", error);
        } finally {
            // Close progress modal
            setLoadingProgress(prev => ({ ...prev, open: false }));
        }
    };

    const handleViewPreview = async () => {
        if (!activeChecklist) return;

        // Fetch full checklist to get all server images (uncovering collapsed rows)
        setLoadingProgress({ open: true, title: 'Generating Preview', status: 'Synchronizing data...', percent: 10, cancelled: false });

        try {
            // 1. Get Local Snapshot (has unsaved text/metadata changes)
            const snapshot = JSON.parse(JSON.stringify(activeChecklist));

            // 2. Fetch Server Data (has all images, including those not loaded locally)
            const fullChecklist = await getChecklistService().getChecklist(activeChecklist.id, { includeImages: true });

            if (isCancelledRef.current) return;

            // 3. Merge Strategies
            // reliable way to know if images are loaded: check store.loadedRowImages
            const loadedRowImages = useChecklistStore.getState().loadedRowImages;

            snapshot.workgroups.forEach((wg: any) => {
                wg.rows.forEach((row: any) => {
                    // Find corresponding server row
                    const serverWg = fullChecklist.workgroups.find((swg: any) => swg.id === wg.id);
                    const serverRow = serverWg?.rows.find((sr: any) => sr.id === row.id);

                    if (serverRow) {
                        // If we haven't explicitely loaded images for this row locally, trust the server
                        // This handles collapsed rows or rows never expanded
                        if (!loadedRowImages[row.id]) {
                            row.images = serverRow.images;
                        } else {
                            // If loaded locally, trust local (might have unsaved additions/deletions)
                            // row.images is already set from activeChecklist
                        }
                    }
                });
            });

            const previewRevision: Revision = {
                id: 'preview',
                checklistId: activeChecklist.id,
                number: 0,
                title: 'Current Preview',
                notes: '',
                createdAt: new Date(),
                createdBy: activeChecklist.createdBy || '',
                snapshot: snapshot
            };

            setLoadingProgress(prev => ({ ...prev, percent: 100, status: 'Ready!' }));

            setTimeout(() => {
                setViewingRevision(previewRevision);
                setLoadingProgress(prev => ({ ...prev, open: false }));
            }, 300);

        } catch (error: any) {
            console.error("Failed to load preview", error);
            setLoadingProgress(prev => ({ ...prev, open: false }));
        }
    };

    const handleCloseRevision = () => {
        setViewingRevision(null);
    };

    const getStatusClass = () => {
        switch (activeChecklist?.status) {
            case 'final':
                return styles['editor-status--final'];
            case 'in-review':
                return styles['editor-status--in-review'];
            default:
                return styles['editor-status--draft'];
        }
    };

    const handleGlobalPaste = React.useCallback((e: React.ClipboardEvent) => {
        const now = Date.now();
        if (now - lastPasteTime.current < 500) return; // Debounce global pasting to prevent duplicates

        const { activeRowId, addImageToRow, processingItems } = useChecklistStore.getState();

        // Don't paste if we dont have an active row
        if (!activeRowId) return;

        // Don't paste if already processing an image addition for that row
        if (processingItems.includes(`img-add-${activeRowId}`)) return;

        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith('image/')) {
                // Prevent browser from trying to handle the file paste natively
                e.preventDefault();

                lastPasteTime.current = now;

                const file = item.getAsFile();
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (readerEvent) => {
                        const result = readerEvent.target?.result as string;
                        if (result) {
                            const newImage = {
                                id: `img-${Date.now()}`,
                                rowId: activeRowId,
                                source: result,
                                // Assuming we want it at the end; accurate order calculation needs a store lookup,
                                // but the store's addImageToRow handles appending.
                                order: 999
                            };
                            addImageToRow(activeRowId, newImage);
                        }
                    };
                    reader.readAsDataURL(file);
                }
                break; // Stop after first image
            }
        }
    }, []);

    if (isLoading || !activeChecklist) {
        return (
            <div className={styles['editor-loading']}>
                <Spinner label="Loading checklist..." />
            </div>
        );
    }

    const statusConfig = STATUS_CONFIG[activeChecklist.status];

    return (
        <div className={styles.editor} onPaste={handleGlobalPaste}>
            {/* Brand Header */}
            <header className={styles['editor-header']}>
                <div className={styles['editor-header-content']}>
                    <Button
                        className={styles['editor-back-btn']}
                        appearance="subtle"
                        icon={<ArrowLeft24Regular />}
                        onClick={onBack}
                    >
                        Back
                    </Button>

                    <div className={styles['editor-title-area']}>
                        <span className={styles['editor-title']}>{activeChecklist.title}</span>
                        <span className={`${styles['editor-status-badge']} ${getStatusClass()}`}>
                            {statusConfig.label}
                        </span>
                    </div>

                    <div className={styles['editor-actions']}>
                        <AutoSaveIndicator isSaving={isSaving} lastSaved={lastSaved} />
                        <ChecklistInfoDialog
                            checklist={activeChecklist}
                            onViewRevision={handleViewRevision}
                            triggerClassName={styles['editor-action-btn']}
                        />

                        {isSuperAdmin && (
                            <>
                                <Button
                                    className={styles['editor-action-btn']}
                                    appearance="subtle"
                                    icon={<Delete24Regular style={{ color: '#d13438' }} />}
                                    onClick={() => setIsDeleteDialogOpen(true)}
                                    disabled={isSaving}
                                    title="Delete Checklist (Permanent)"
                                >
                                    <span style={{ color: '#d13438' }}>Delete</span>
                                </Button>
                            </>
                        )}

                        <Button
                            className={styles['editor-action-btn']}
                            appearance="subtle"
                            icon={<Eye24Regular />}
                            onClick={handleViewPreview}
                            disabled={isSaving}
                            title="Preview Checklist"
                        >
                            Preview
                        </Button>

                        <Button
                            className={styles['editor-action-btn']}
                            appearance="subtle"
                            icon={<ClipboardPulse24Regular />}
                            onClick={() => setShowActivityPanel(true)}
                            title="Activity Log"
                        >
                            Activity
                        </Button>

                        <HelpGuide triggerClassName={styles['editor-action-btn']} />
                        <Button
                            className={styles['editor-save-btn']}
                            appearance="primary"
                            icon={<Save24Regular />}
                            onClick={saveChecklist}
                            disabled={isSaving}
                        >
                            Save
                        </Button>
                    </div>
                </div>
            </header >

            {/* Main Layout */}
            < div className={styles['editor-layout']} >
                <main className={styles['editor-main']}>
                    <JobMetadataHeader checklist={activeChecklist} />
                    <CommonNotes
                        checklist={activeChecklist}
                        onUpdate={(updates) => updateChecklist(activeChecklist.id, updates)}
                        onSave={saveChecklist}
                    />

                    <FilterBar
                        filters={filters}
                        onFiltersChange={setFilters}
                        workgroups={activeChecklist.workgroups}
                        expandWorkgroups={expandWorkgroups}
                        onExpandWorkgroupsChange={setExpandWorkgroups}
                        expandTasks={expandTasks}
                        onExpandTasksChange={setExpandTasks}
                    />

                    <div className={styles['editor-workgroups']} id="checklist-print-content">
                        {activeChecklist.workgroups
                            .filter(wg => filters.workgroupIds.length === 0 || filters.workgroupIds.includes(wg.id))
                            .sort((a, b) => a.order - b.order)
                            .map(workgroup => (
                                <WorkgroupSection
                                    key={workgroup.id}
                                    workgroup={workgroup}
                                    onRowChange={triggerAutoSave}
                                    filters={filters}
                                    isCollapsed={!expandWorkgroups}
                                    expandTasks={expandTasks}
                                />
                            ))}
                    </div>

                    <Button
                        className={styles['editor-add-workgroup']}
                        appearance="outline"
                        icon={processingItems.includes(`add-wg-${activeChecklist.id}`) ? <Spinner size="extra-tiny" /> : <Add24Regular />}
                        onClick={() => {
                            const nextNumber = Math.max(...activeChecklist.workgroups.map(w => w.number), 0) + 10;
                            void addWorkgroup(nextNumber, 'New Workgroup');
                        }}
                        disabled={processingItems.includes(`add-wg-${activeChecklist.id}`)}
                    >
                        {processingItems.includes(`add-wg-${activeChecklist.id}`) ? 'Adding...' : 'Add Workgroup'}
                    </Button>

                    {/* Mobile Actions */}
                    <div className={styles['editor-mobile-actions']}>
                        <Button
                            className={styles['btn-ghost']}
                            appearance="outline"
                            icon={<History24Regular />}
                            onClick={() => setShowRevisionPanel(!showRevisionPanel)}
                        >
                            Revisions
                        </Button>
                    </div>

                    {/* Mobile Revision Panel */}
                    {showRevisionPanel && (
                        <div className={styles['editor-mobile-revision']}>
                            <RevisionPanel
                                checklistId={checklistId}
                                onViewRevision={handleViewRevision}
                            />
                        </div>
                    )}
                </main>
            </div >

            {/* Revision Viewer Overlay */}
            {
                viewingRevision && (
                    <RevisionViewer
                        revision={viewingRevision}
                        onClose={handleCloseRevision}
                    />
                )
            }

            <Panel
                isOpen={showActivityPanel}
                onDismiss={() => setShowActivityPanel(false)}
                type={PanelType.medium}
                headerText="Activity Log"
                closeButtonAriaLabel="Close"
            >
                <ActivityLogPanel checklistId={checklistId} />
            </Panel>

            {/* PDF / Preview Progress Modal */}
            <PdfGenerationProgressModal
                open={pdfLoadingProgress.open}
                onCancel={cancelPdfExport}
                title={pdfLoadingProgress.title}
                iconType={pdfLoadingProgress.title.toLowerCase().includes('preview') ? 'preview' : 'pdf'}
                status={pdfLoadingProgress.status}
                percent={pdfLoadingProgress.percent}
            />

            {/* BTC Export Progress Modal */}
            <PdfGenerationProgressModal
                open={btcLoadingProgress.open}
                onCancel={cancelBtcExport}
                title={btcLoadingProgress.title}
                iconType="pdf"
                status={btcLoadingProgress.status}
                percent={btcLoadingProgress.percent}
            />

            {/* Delete Progress Modal */}
            <DeleteProgressModal
                open={deleteProgress.open}
                onCancel={() => setDeleteProgress({ open: false, status: '', percent: 0 })}
                status={deleteProgress.status}
                percent={deleteProgress.percent}
            />

            {/* Permanent Deletion Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={(e, data) => setIsDeleteDialogOpen(data.open)}>
                <DialogSurface>
                    <DialogBody>
                        <DialogTitle>Delete Checklist Permanently?</DialogTitle>
                        <DialogContent>
                            <p style={{ color: '#d13438', fontWeight: 'bold' }}>This action cannot be undone.</p>
                            <p>Deleting this checklist will permanently remove the following items across the entire system:</p>
                            <ul>
                                <li>The Checklist record itself.</li>
                                <li>All associated Workgroups ({activeChecklist.workgroups?.length || 0}).</li>
                                <li>All Checklist Rows.</li>
                                <li>All Images and files attached to those rows.</li>
                                <li>All Review and Revision History.</li>
                            </ul>
                            <p>Are you absolutely sure you want to proceed?</p>
                        </DialogContent>
                        <DialogActions className={styles['dialog-footer']}>
                            <Button className={styles['btn-secondary']} appearance="secondary" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                            <Button
                                className={styles['btn-delete']}
                                onClick={() => {
                                    setIsDeleteDialogOpen(false);
                                    setDeleteProgress({ open: true, status: 'Starting...', percent: 0 });
                                    void deleteChecklist(activeChecklist.id, (status, percent) => {
                                        setDeleteProgress(prev => ({ ...prev, status, percent }));
                                    }).then(() => {
                                        setDeleteProgress(prev => ({ ...prev, percent: 100, status: 'Deleted!' }));
                                        setTimeout(() => onBack(), 500);
                                    }).catch(err => {
                                        console.error('Delete failed', err);
                                        setDeleteProgress({ open: false, status: '', percent: 0 });
                                    });
                                }}
                            >
                                Yes, Permanently Delete
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </div >
    );
};
