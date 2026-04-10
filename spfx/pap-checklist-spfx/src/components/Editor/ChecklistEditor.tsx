import React, { useEffect, useCallback, useRef, useState } from 'react';
import { Button, Spinner, Dialog, DialogTrigger, DialogSurface, DialogTitle, DialogBody, DialogActions, DialogContent, Text } from '@fluentui/react-components';
import { ArrowLeft24Regular, Save24Regular, Add24Regular, History24Regular, Eye24Regular, ClipboardPulse24Regular, Delete24Regular, ArrowDownload24Regular } from '@fluentui/react-icons';
import { Panel, PanelType } from '@fluentui/react/lib/Panel';
import { useChecklistStore, useUserStore } from '../../stores';
import { STATUS_CONFIG, type Revision } from '../../models';
import { WorkgroupSection } from './WorkgroupSection';
import { AutoSaveIndicator } from './AutoSaveIndicator';
import { RevisionSection, RevisionViewer } from '../Revision';

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
    const [showActivityPanel, setShowActivityPanel] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const [loadingProgress, setLoadingProgress] = useState<{ open: boolean; title: string; status: string; percent: number; cancelled: boolean }>({ open: false, title: 'Loading...', status: '', percent: 0, cancelled: false });
    const [viewingRevision, setViewingRevision] = useState<Revision | null>(null);
    const [deleteProgress, setDeleteProgress] = useState<{ open: boolean; status: string; percent: number }>({ open: false, status: '', percent: 0 });
    const [filters, setFilters] = useState<FilterState>({ answerStates: [], markedForReview: null, internalOnly: null, notifyAdmin: null, builderToConfirm: null, workgroupIds: [], showRowsWithData: false });
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

    const handleViewPreview = async () => {
        if (!activeChecklist) return;

        // Only skip hydration if every row that has images in SharePoint has already been
        // fetched into the store. We use availableImageFolders (rows known to have images)
        // and loadedRowImages (rows whose images have been fetched) as the source of truth.
        // Checking storeImages directly would give a false positive on empty arrays —
        // rows that haven't been expanded yet have r.images = [] even if images exist.
        const { availableImageFolders, loadedRowImages } = useChecklistStore.getState();
        const alreadyLoaded = availableImageFolders.length === 0
            || availableImageFolders.every(rowId => !!loadedRowImages[rowId]);

        if (alreadyLoaded) {
            const previewRev: Revision = {
                id: 'preview',
                checklistId: activeChecklist.id,
                number: 0,
                title: 'Current Preview',
                notes: '',
                createdAt: new Date(),
                createdBy: activeChecklist.createdBy,
                snapshot: activeChecklist
            };
            setViewingRevision(previewRev);
            return;
        }

        // Some rows haven't been expanded yet — run full hydration for those images
        setLoadingProgress({ open: true, title: 'Preparing Preview', status: 'Fetching images...', percent: 0, cancelled: false });
        isCancelledRef.current = false;

        try {
            const hydratedChecklist = await getChecklistService().getHydratedChecklist(activeChecklist.id, (status, percent) => {
                if (isCancelledRef.current) return;
                setLoadingProgress(prev => ({ ...prev, status, percent }));
            });

            if (isCancelledRef.current) return;

            // Create a pseudo-revision for preview with hydrated data
            const previewRev: Revision = {
                id: 'preview',
                checklistId: hydratedChecklist.id,
                number: 0,
                title: 'Current Preview',
                notes: '',
                createdAt: new Date(),
                createdBy: hydratedChecklist.createdBy,
                snapshot: hydratedChecklist
            };

            setLoadingProgress(prev => ({ ...prev, open: false }));
            setViewingRevision(previewRev);
        } catch (error) {
            console.error('[Editor] Preview Prep Failed', error);
            setLoadingProgress(prev => ({ ...prev, status: 'Error: ' + (error as Error).message, percent: 0 }));
            setTimeout(() => setLoadingProgress(prev => ({ ...prev, open: false })), 3000);
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
            case 'in-revision':
                return styles['editor-status--in-revision'];
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



                    <FilterBar
                        filters={filters}
                        onFiltersChange={setFilters}
                        workgroups={activeChecklist.workgroups.filter(wg => !wg.revisionId)}
                        expandWorkgroups={expandWorkgroups}
                        onExpandWorkgroupsChange={setExpandWorkgroups}
                        expandTasks={expandTasks}
                        onExpandTasksChange={setExpandTasks}
                    />

                    <CommonNotes
                        checklist={activeChecklist}
                        onUpdate={(updates) => updateChecklist(activeChecklist.id, updates)}
                        onSave={saveChecklist}
                    />

                    {/* ─── Revision Sections (descending order, filtered) ─── */}
                    {activeChecklist.revisions.length > 0 && (
                        <div className={styles['editor-revisions']} style={{ marginTop: '20px' }}>
                            <div className={styles['revisions-header']}>
                                <Text size={400} weight="semibold">Revision History</Text>
                            </div>
                            {activeChecklist.revisions
                                .sort((a, b) => b.number - a.number)
                                .map(revision => {
                                    // Get the numbers of the original workgroups that match the current filters
                                    const filteredNumbers = activeChecklist.workgroups
                                        .filter(wg => !wg.revisionId && (filters.workgroupIds.length === 0 || filters.workgroupIds.includes(wg.id)))
                                        .map(wg => wg.number);

                                    const revisionWorkgroups = activeChecklist.workgroups.filter(
                                        wg => wg.revisionId === revision.id && filteredNumbers.includes(wg.number)
                                    );

                                    // If we are filtering and no workgroups in this revision match, hide it (optional - could also just show it empty)
                                    if (filters.workgroupIds.length > 0 && revisionWorkgroups.length === 0) return null;

                                    return (
                                        <RevisionSection
                                            key={revision.id}
                                            revision={revision}
                                            revisionWorkgroups={revisionWorkgroups}
                                            originalWorkgroups={activeChecklist.workgroups.filter(
                                                wg => !wg.revisionId
                                            )}
                                            onRowChange={triggerAutoSave}
                                            filters={filters}
                                            expandTasks={expandTasks}
                                        />
                                    );
                                })}
                        </div>
                    )}

                    <div className={styles['editor-workgroups']} id="checklist-print-content">
                        {activeChecklist.workgroups
                            .filter(wg => !wg.revisionId)
                            .filter(wg => filters.workgroupIds.length === 0 || filters.workgroupIds.includes(wg.id))
                            .sort((a, b) => a.number - b.number)
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
                            const originalWgs = activeChecklist.workgroups.filter(wg => !wg.revisionId);
                            const nextNumber = Math.max(...originalWgs.map(w => w.number), 0) + 10;
                            void addWorkgroup(nextNumber, 'New Workgroup');
                        }}
                        disabled={processingItems.includes(`add-wg-${activeChecklist.id}`)}
                    >
                        {processingItems.includes(`add-wg-${activeChecklist.id}`) ? 'Adding...' : 'Add Workgroup'}
                    </Button>

                </main>
            </div >


            <Panel
                isOpen={showActivityPanel}
                onDismiss={() => setShowActivityPanel(false)}
                type={PanelType.medium}
                headerText="Activity Log"
                closeButtonAriaLabel="Close"
            >
                <ActivityLogPanel checklistId={checklistId} checklistTitle={activeChecklist.title} />
            </Panel>

            {/* PDF / Preview Progress Modal */}
            <PdfGenerationProgressModal
                open={pdfLoadingProgress.open || loadingProgress.open}
                onCancel={() => {
                    cancelPdfExport();
                    isCancelledRef.current = true;
                    setLoadingProgress(prev => ({ ...prev, open: false, cancelled: true }));
                }}
                title={pdfLoadingProgress.open ? pdfLoadingProgress.title : loadingProgress.title}
                iconType={(pdfLoadingProgress.title || loadingProgress.title).toLowerCase().includes('preview') ? 'preview' : 'pdf'}
                status={pdfLoadingProgress.open ? pdfLoadingProgress.status : loadingProgress.status}
                percent={pdfLoadingProgress.open ? pdfLoadingProgress.percent : loadingProgress.percent}
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

            {viewingRevision && (
                <RevisionViewer revision={viewingRevision} onClose={handleCloseRevision} />
            )}

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
