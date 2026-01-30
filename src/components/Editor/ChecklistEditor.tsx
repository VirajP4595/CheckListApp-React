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
import { PdfGeneratorService } from '../../services/PdfGeneratorService';
import { SharePointImageService } from '../../services/sharePointService';
import { getChecklistService, getImageService, getRevisionService } from '../../services';
import { ArrowDownload24Regular } from '@fluentui/react-icons';
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

    const handleExportPdf = async () => {
        if (!activeChecklist) return;

        isCancelledRef.current = false;
        setLoadingProgress({ open: true, title: 'Generating PDF Report', status: 'Initializing...', percent: 0, cancelled: false });

        try {
            // STEP 1: Retrieve all images (Pre-fetch for collapsed rows)
            setLoadingProgress(prev => ({ ...prev, status: 'Retrieving all images...', percent: 5 }));
            const fullChecklist = await getChecklistService().getChecklist(activeChecklist.id, { includeImages: true });

            if (isCancelledRef.current) throw new Error("Cancelled");

            // ... (rest of logic is similar but keeping existing flow)

            // STEP 2: Download Image Content (Bypass CORS)
            const allImages: { img: any, id: string }[] = [];
            fullChecklist.workgroups.forEach(wg => {
                wg.rows.forEach(r => {
                    if (r.images) {
                        r.images.forEach(img => {
                            if (img.id && !img.source.startsWith('data:')) {
                                allImages.push({ img, id: img.id });
                            }
                        });
                    }
                });
            });

            if (allImages.length > 0) {
                setLoadingProgress(prev => ({ ...prev, status: `Downloading ${allImages.length} images...`, percent: 10 }));
                const imageService = getImageService();
                const getImageContent = async (item: { img: any, id: string }) => {
                    try {
                        if (isCancelledRef.current) return;
                        const base64 = await imageService.downloadImageContent(item.id);
                        item.img.source = base64; // Replace URL with Data URL
                    } catch (err) {
                        console.warn(`Failed to download image ${item.id}`, err);
                    }
                };

                await Promise.all(allImages.map(getImageContent));
            }

            const generator = new PdfGeneratorService(fullChecklist);

            // ... (rest of export logic)

            // STEP 3: Fetch Branding Logo (Securely via Graph)
            let logoBlob: Blob | null = null;
            if (fullChecklist.clientLogoUrl) {
                try {
                    setLoadingProgress(prev => ({ ...prev, status: 'Fetching branding...', percent: 15 }));
                    // Use secure download instead of fetch(url) to avoid CORS
                    logoBlob = await getImageService().downloadClientLogoContent(activeChecklist.id);
                } catch (e) {
                    // console.warn("Could not fetch logo for PDF", e);
                }
            }

            const pdfBlob = await generator.generate(logoBlob, (status, percent) => {
                if (isCancelledRef.current) return false; // Abort

                // Remap percent (20-95%)
                const adjustedPercent = 20 + (percent * 0.75);
                setLoadingProgress(prev => ({ ...prev, status, percent: adjustedPercent }));
                return true;
            });

            // Upload
            setLoadingProgress(prev => ({ ...prev, status: 'Uploading...', percent: 95 }));
            const sharePointService = new SharePointImageService();
            const fileName = `${activeChecklist.title.replace(/[^a-z0-9]/gi, '_')}-REV${activeChecklist.currentRevisionNumber}.pdf`;
            await sharePointService.uploadFile(activeChecklist.id, new File([pdfBlob], fileName, { type: 'application/pdf' }));

            setLoadingProgress(prev => ({ ...prev, status: 'Done!', percent: 100 }));

            // Auto download for user convenience
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);

            setTimeout(() => setLoadingProgress({ open: false, title: '', status: '', percent: 0, cancelled: false }), 2000);

        } catch (error: any) {
            if (error.message === 'Cancelled' || error.message?.includes('Cancelled')) {
                setLoadingProgress({ open: false, title: '', status: '', percent: 0, cancelled: false });
            } else {
                console.error("PDF Generation Error", error);
                setLoadingProgress(prev => ({ ...prev, status: 'Error: ' + error.message, percent: 0 }));
            }
        }
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
                        <Button
                            className={styles['editor-action-btn']}
                            appearance="subtle"
                            icon={<ArrowDownload24Regular />}
                            onClick={handleExportPdf}
                            disabled={isSaving}
                            title="Export to PDF"
                        >
                            Export
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
            </header>

            {/* Main Layout */}
            <div className={styles['editor-layout']}>
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
            </div>

            {/* Revision Viewer Overlay */}
            {viewingRevision && (
                <RevisionViewer
                    revision={viewingRevision}
                    onClose={handleCloseRevision}
                />
            )}

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
        </div>
    );
};
