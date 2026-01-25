import React, { useEffect, useCallback, useRef, useState } from 'react';
import { Button, Spinner } from '@fluentui/react-components';
import { ArrowLeft24Regular, Save24Regular, Add24Regular, History24Regular } from '@fluentui/react-icons';
import { useChecklistStore } from '../../stores';
import { STATUS_CONFIG, type Revision } from '../../models';
import { WorkgroupSection } from './WorkgroupSection';
import { AutoSaveIndicator } from './AutoSaveIndicator';
import { RevisionPanel } from '../Revision/RevisionPanel';
import { RevisionViewer } from '../Revision/RevisionViewer';
import { ExportButton } from '../Export/ExportButton';
import { FilterBar, type FilterState } from './FilterBar';
import { HelpGuide } from './HelpGuide';
import { ChecklistInfoDialog } from './Sidebar/ChecklistInfoDialog';
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
    } = useChecklistStore();

    const [showRevisionPanel, setShowRevisionPanel] = useState(false);
    const [viewingRevision, setViewingRevision] = useState<Revision | null>(null);
    const [filters, setFilters] = useState<FilterState>({ answerStates: [], markedForReview: null, workgroupIds: [] });
    const [expandWorkgroups, setExpandWorkgroups] = useState(false);  // Collapsed by default
    const [expandTasks, setExpandTasks] = useState(false);  // Collapsed by default
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
                        <ExportButton checklist={activeChecklist} />
                        <ChecklistInfoDialog
                            checklist={activeChecklist}
                            onViewRevision={handleViewRevision}
                            triggerClassName={styles['editor-action-btn']}
                        />
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

                    <div className={styles['editor-workgroups']}>
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
                        icon={<Add24Regular />}
                        onClick={() => {
                            const nextNumber = Math.max(...activeChecklist.workgroups.map(w => w.number), 0) + 10;
                            addWorkgroup(nextNumber, 'New Workgroup');
                            triggerAutoSave();
                        }}
                    >
                        Add Workgroup
                    </Button>

                    {/* Mobile Actions */}
                    <div className={styles['editor-mobile-actions']}>
                        <ExportButton checklist={activeChecklist} />
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
        </div>
    );
};
