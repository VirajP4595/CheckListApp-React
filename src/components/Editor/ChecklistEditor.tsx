import React, { useEffect, useCallback, useRef, useState } from 'react';
import { Button, Spinner } from '@fluentui/react-components';
import { ArrowLeft24Regular, Save24Regular, Add24Regular, History24Regular } from '@fluentui/react-icons';
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
import { getChecklistService, getImageService } from '../../services';
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
        updateChecklist,
        processingItems
    } = useChecklistStore();

    const [showRevisionPanel, setShowRevisionPanel] = useState(false);
    const [viewingRevision, setViewingRevision] = useState<Revision | null>(null);
    const [filters, setFilters] = useState<FilterState>({ answerStates: [], markedForReview: null, workgroupIds: [] });
    const [expandWorkgroups, setExpandWorkgroups] = useState(false);  // Collapsed by default
    const [expandTasks, setExpandTasks] = useState(false);  // Collapsed by default
    const [exportProgress, setExportProgress] = useState<{ open: boolean; status: string; percent: number; cancelled: boolean }>({ open: false, status: '', percent: 0, cancelled: false });
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

    const handleViewRevision = (revision: Revision) => {
        setViewingRevision(revision);
    };

    const handleCloseRevision = () => {
        setViewingRevision(null);
    };

    const handleCancelExport = () => {
        isCancelledRef.current = true;
        setExportProgress(prev => ({ ...prev, cancelled: true }));
    };

    const handleExportPdf = async () => {
        if (!activeChecklist) return;

        isCancelledRef.current = false;
        setExportProgress({ open: true, status: 'Initializing...', percent: 0, cancelled: false });

        try {
            // STEP 1: Retrieve all images (Pre-fetch for collapsed rows)
            setExportProgress(prev => ({ ...prev, status: 'Retrieving all images...', percent: 5 }));
            const fullChecklist = await getChecklistService().getChecklist(activeChecklist.id, { includeImages: true });

            if (isCancelledRef.current) throw new Error("Cancelled");

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
                setExportProgress(prev => ({ ...prev, status: `Downloading ${allImages.length} images...`, percent: 10 }));
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

            // STEP 3: Fetch Branding Logo (Securely via Graph)
            let logoBlob: Blob | null = null;
            if (fullChecklist.clientLogoUrl) {
                try {
                    setExportProgress(prev => ({ ...prev, status: 'Fetching branding...', percent: 15 }));
                    // Use secure download instead of fetch(url) to avoid CORS
                    logoBlob = await getImageService().downloadClientLogoContent(activeChecklist.id);
                } catch (e) {
                    console.warn("Could not fetch logo for PDF", e);
                }
            }

            const pdfBlob = await generator.generate(logoBlob, (status, percent) => {
                if (isCancelledRef.current) return false; // Abort

                // Remap percent (20-95%)
                const adjustedPercent = 20 + (percent * 0.75);
                setExportProgress(prev => ({ ...prev, status, percent: adjustedPercent }));
                return true;
            });

            // Upload
            setExportProgress(prev => ({ ...prev, status: 'Uploading...', percent: 95 }));
            const sharePointService = new SharePointImageService();
            const fileName = `${activeChecklist.title.replace(/[^a-z0-9]/gi, '_')}-REV${activeChecklist.currentRevisionNumber}.pdf`;
            await sharePointService.uploadFile(activeChecklist.id, new File([pdfBlob], fileName, { type: 'application/pdf' }));

            setExportProgress(prev => ({ ...prev, status: 'Done!', percent: 100 }));

            // Auto download for user convenience
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);

            setTimeout(() => setExportProgress({ open: false, status: '', percent: 0, cancelled: false }), 2000);

        } catch (error: any) {
            if (error.message === 'Cancelled' || error.message?.includes('Cancelled')) {
                setExportProgress({ open: false, status: '', percent: 0, cancelled: false });
            } else {
                console.error("PDF Generation Error", error);
                setExportProgress(prev => ({ ...prev, status: 'Error: ' + error.message, percent: 0 }));
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
                            // triggerAutoSave(); // REMOVED: Granular action handles save
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
                open={exportProgress.open}
                status={exportProgress.status}
                percent={exportProgress.percent}
                onCancel={() => setExportProgress(prev => ({ ...prev, cancelled: true }))}
            />
        </div>
    );
};
