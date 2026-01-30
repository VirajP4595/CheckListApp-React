import React, { useEffect, useCallback, useRef, useState } from 'react';
import { Button, Spinner } from '@fluentui/react-components';
import { ArrowLeft24Regular, Save24Regular, Add24Regular, History24Regular, Eye24Regular } from '@fluentui/react-icons';
import { useChecklistStore } from '../../stores';
import { STATUS_CONFIG, type Revision } from '../../models';
import { WorkgroupSection } from './WorkgroupSection';
import { AutoSaveIndicator } from './AutoSaveIndicator';
import { RevisionPanel } from '../Revision/RevisionPanel';
import { RevisionViewer } from '../Revision/RevisionViewer';

import { FilterBar, type FilterState } from './FilterBar';
import { HelpGuide } from './HelpGuide';
import { ChecklistInfoDialog } from './Sidebar/ChecklistInfoDialog';
import { PdfGenerationProgressModal } from '../Checklist/PdfGenerationProgressModal';
import { getChecklistService, getRevisionService } from '../../services';
import styles from './ChecklistEditor.module.scss';

interface ChecklistEditorProps {
    checklistId: string;
    onBack: () => void;
}

export const ChecklistEditor: React.FC<ChecklistEditorProps> = ({ checklistId, onBack }) => {
    const {
        activeChecklist,
        isLoading,
        isSaving,
        lastSaved,
        loadChecklist,
        saveChecklist,
        addWorkgroup,
        processingItems
    } = useChecklistStore();

    const [showRevisionPanel, setShowRevisionPanel] = useState(false);
    const [viewingRevision, setViewingRevision] = useState<Revision | null>(null);

    const [loadingProgress, setLoadingProgress] = useState<{ open: boolean; title: string; status: string; percent: number; cancelled: boolean }>({ open: false, title: 'Loading...', status: '', percent: 0, cancelled: false });
    const [filters, setFilters] = useState<FilterState>({ answerStates: [], markedForReview: null, workgroupIds: [] });
    const [expandWorkgroups, setExpandWorkgroups] = useState(false);  // Collapsed by default
    const [expandTasks, setExpandTasks] = useState(false);  // Collapsed by default

    const isCancelledRef = useRef(false);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        loadChecklist(checklistId);
    }, [checklistId, loadChecklist]);

    const triggerAutoSave = useCallback(() => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
            saveChecklist();
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
                summary: 'Current Preview',
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

    if (isLoading || !activeChecklist) {
        return (
            <div className={styles['editor-loading']}>
                <Spinner label="Loading checklist..." />
            </div>
        );
    }

    const statusConfig = STATUS_CONFIG[activeChecklist.status];

    return (
        <div className={styles.editor}>
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
                            addWorkgroup(nextNumber, 'New Workgroup');
                        }}
                        disabled={processingItems.includes(`add-wg-${activeChecklist.id}`)}
                    >
                        {processingItems.includes(`add-wg-${activeChecklist.id}`) ? 'Adding...' : 'Add Workgroup'}
                    </Button>

                    {/* Mobile Actions */}
                    <div className={styles['editor-mobile-actions']}>
                        <Button
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

            <PdfGenerationProgressModal
                open={loadingProgress.open}
                title={loadingProgress.title}
                iconType={loadingProgress.title.includes('Preview') ? 'preview' : 'pdf'}
                status={loadingProgress.status}
                percent={loadingProgress.percent}
                onCancel={() => {
                    // Only cancel if it's the PDF export that's running
                    if (loadingProgress.title.includes('PDF')) {
                        isCancelledRef.current = true;
                        setLoadingProgress(prev => ({ ...prev, cancelled: true }));
                    } else {
                        // For load operations, just close (though requests might continue in background)
                        setLoadingProgress(prev => ({ ...prev, open: false }));
                    }
                }}
            />
        </div >
    );
};
