import React, { useState, useEffect, useMemo } from 'react';
import { Button, Input, Tooltip, Spinner, Dialog, DialogTrigger, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions } from '@fluentui/react-components';
import {
    Add20Regular,
    ChevronDown20Regular,
    ChevronRight20Regular,
    Edit20Regular,
    Delete20Regular,
    Checkmark20Regular
} from '@fluentui/react-icons';
import type { Workgroup } from '../../models';
import { useChecklistStore } from '../../stores';
import { ChecklistRowItem } from './ChecklistRowItem';
import type { FilterState } from './FilterBar';
import styles from './WorkgroupSection.module.scss';

interface WorkgroupSectionProps {
    workgroup: Workgroup;
    onRowChange: () => void;
    filters?: FilterState;
    isCollapsed?: boolean;
    expandTasks?: boolean;
}

export const WorkgroupSection: React.FC<WorkgroupSectionProps> = React.memo(({
    workgroup,

    filters,
    isCollapsed = false,
    expandTasks = true,
}) => {
    const addRow = useChecklistStore(state => state.addRow);
    const updateWorkgroup = useChecklistStore(state => state.updateWorkgroup);
    const deleteWorkgroup = useChecklistStore(state => state.deleteWorkgroup);
    const activeChecklist = useChecklistStore(state => state.activeChecklist);

    const isAdding = useChecklistStore(state => state.processingItems.includes(workgroup.id));

    const [localCollapsed, setLocalCollapsed] = useState(isCollapsed);
    const [isEditing, setIsEditing] = useState(false);
    const [tempName, setTempName] = useState(workgroup.name);
    const [tempNumber, setTempNumber] = useState(workgroup.number);

    useEffect(() => {
        setLocalCollapsed(isCollapsed || false);
    }, [isCollapsed]);

    // Update local state when prop changes (if not editing to avoid overwrite)
    useEffect(() => {
        if (!isEditing) {
            setTempName(workgroup.name);
            setTempNumber(workgroup.number);
        }
    }, [workgroup.name, workgroup.number, isEditing]);

    const collapsed = localCollapsed;

    const handleToggleExpand = () => {
        setLocalCollapsed(!localCollapsed);
    };

    const handleStartEditing = (e: React.MouseEvent) => {
        e.stopPropagation();
        setTempName(workgroup.name);
        setTempNumber(workgroup.number);
        setIsEditing(true);
    };

    const handleSaveEditing = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (tempName !== workgroup.name || tempNumber !== workgroup.number) {
            void updateWorkgroup(workgroup.id, { name: tempName, number: tempNumber });
        }
        setIsEditing(false);
    };




    const handleAddRow = () => {
        void addRow(workgroup.id);
    };

    const handleDelete = () => {
        if (window.confirm(`Delete workgroup "${workgroup.name}"? This will also delete all ${workgroup.rows.length} items.`)) {
            void deleteWorkgroup(workgroup.id);
        }
    };

    // Filter rows based on filters
    const filteredRows = useMemo(() => {
        return workgroup.rows.filter(row => {
            // UAT Feedback: Hide 'From Meeting Transcript' when no checklist meeting occurred
            const job = activeChecklist?.jobDetails;
            const choice = job?.checklistChoice?.toString().toLowerCase() || '';
            const isNotAppointment = !choice.includes('appointment meeting');
            const isDateEmpty = !job?.appointmentDate;

            if (isNotAppointment && isDateEmpty) {
                if (row.name?.toLowerCase().trim() === 'from meeting transcript') {
                    return false;
                }
            }

            if (filters?.answerStates && filters.answerStates.length > 0) {
                if (!filters.answerStates.includes(row.answer)) {
                    return false;
                }
            }
            if (filters?.markedForReview !== null && filters?.markedForReview !== undefined) {
                if (row.markedForReview !== filters.markedForReview) {
                    return false;
                }
            }
            if (filters?.internalOnly !== null && filters?.internalOnly !== undefined) {
                if (row.internalOnly !== filters.internalOnly) {
                    return false;
                }
            }
            if (filters?.notifyAdmin !== null && filters?.notifyAdmin !== undefined) {
                if (row.notifyAdmin !== filters.notifyAdmin) {
                    return false;
                }
            }
            if (filters?.builderToConfirm !== null && filters?.builderToConfirm !== undefined) {
                if (row.builderToConfirm !== filters.builderToConfirm) {
                    return false;
                }
            }
            return true;
        });
    }, [workgroup.rows, filters, activeChecklist?.jobDetails?.meetingOccurred]);

    // Check if any row-level filters are active
    const hasActiveRowFilters = filters && (
        (filters.answerStates && filters.answerStates.length > 0) ||
        (filters.markedForReview !== null && filters.markedForReview !== undefined) ||
        (filters.internalOnly !== null && filters.internalOnly !== undefined) ||
        (filters.notifyAdmin !== null && filters.notifyAdmin !== undefined) ||
        (filters.builderToConfirm !== null && filters.builderToConfirm !== undefined)
    );

    // Hide workgroup if filters are applied but no items match
    if (hasActiveRowFilters && filteredRows.length === 0) {
        return null;
    }

    return (
        <section className={styles.workgroup}>
            <header className={styles['workgroup-header']}>
                <div className={styles['workgroup-header-left']}>
                    {/* Expand/Collapse Button */}
                    <Button
                        className={styles['workgroup-expand-btn']}
                        appearance="subtle"
                        size="small"
                        icon={collapsed ? <ChevronRight20Regular /> : <ChevronDown20Regular />}
                        onClick={handleToggleExpand}
                    />

                    {/* Number Badge/Input */}
                    {isEditing ? (
                        <Input
                            className={styles['workgroup-number-input']}
                            value={String(tempNumber)}
                            onChange={(_, data) => {
                                const num = parseFloat(data.value); // Allow NaN while typing empty
                                setTempNumber(isNaN(num) ? 0 : num);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            type="number"
                        />
                    ) : (
                        <div className={styles['workgroup-number-badge']}>
                            {workgroup.number}
                        </div>
                    )}

                    {/* Item Count (Always Visible, next to number per screenshot) */}
                    <span className={styles['workgroup-item-count']}>
                        {filteredRows.length} item{filteredRows.length !== 1 ? 's' : ''}
                    </span>

                    {/* Title Text/Input */}
                    {isEditing ? (
                        <Input
                            className={styles['workgroup-title-input']}
                            value={tempName}
                            onChange={(_, data) => setTempName(data.value)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Workgroup name"
                            autoFocus
                        />
                    ) : (
                        <span className={styles['workgroup-title-text']}>
                            {workgroup.name}
                        </span>
                    )}
                </div>

                {/* Right Side: Status + Actions */}
                <div className={styles['workgroup-header-right']}>

                    {/* Status Summary (View Mode Only) - Refined Style */}
                    {!isEditing && (
                        <div className={styles['workgroup-status-summary']}>
                            {(() => {
                                const normalize = (s?: string) => s?.toLowerCase() || 'blank';
                                const unansweredRows = filteredRows.filter(r => ['blank', '', undefined, null].includes(normalize(r.answer)));
                                const answeredRows = filteredRows.filter(r => !['blank', '', undefined, null].includes(normalize(r.answer)));

                                const answered = answeredRows.length;
                                const unanswered = unansweredRows.length;

                                return (
                                    <div className={styles['status-summary-container']}>
                                        <span className={styles['status-item']}>
                                            <span className={styles['status-dot-yes']}>●</span> {answered} Answered
                                        </span>
                                        <span className={styles['status-item']}>
                                            <span className={styles['status-dot-blank']}>●</span> {unanswered} Unanswered
                                        </span>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    <div className={styles['workgroup-actions']}>
                        {isEditing ? (
                            <Button
                                className={styles['workgroup-action-btn']}
                                appearance="subtle"
                                size="small"
                                icon={<Checkmark20Regular />} // Should be Check icon
                                onClick={handleSaveEditing}
                            />
                        ) : (
                            <Button
                                className={styles['workgroup-action-btn']}
                                appearance="subtle"
                                size="small"
                                icon={<Edit20Regular />}
                                onClick={handleStartEditing}
                            />
                        )}

                        <Dialog>
                            <DialogTrigger disableButtonEnhancement>
                                <Tooltip content="Delete workgroup" relationship="label">
                                    <Button
                                        className={styles['workgroup-action-btn--delete']}
                                        appearance="subtle"
                                        size="small"
                                        icon={<Delete20Regular />}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </Tooltip>
                            </DialogTrigger>
                            <DialogSurface aria-describedby={undefined}>
                                <DialogBody>
                                    <DialogTitle>Delete Workgroup</DialogTitle>
                                    <DialogContent>
                                        Are you sure you want to delete workgroup "{workgroup.name}"? This will also delete all {workgroup.rows.length} items. This action cannot be undone.
                                    </DialogContent>
                                    <DialogActions>
                                        <DialogTrigger disableButtonEnhancement>
                                            <Button appearance="secondary">Cancel</Button>
                                        </DialogTrigger>
                                        <Button
                                            appearance="primary"
                                            style={{ backgroundColor: '#d13438' }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                void deleteWorkgroup(workgroup.id);
                                            }}
                                        >
                                            Delete
                                        </Button>
                                    </DialogActions>
                                </DialogBody>
                            </DialogSurface>
                        </Dialog>
                    </div>
                </div>
            </header>



            {
                !collapsed && (
                    <div className={styles['workgroup-content']}>
                        {filteredRows.length === 0 ? (
                            <div className={styles['workgroup-empty']}>
                                <span>{workgroup.rows.length === 0 ? 'No items in this workgroup yet.' : 'No items match the current filters.'}</span>
                            </div>
                        ) : (
                            <div className={styles['workgroup-rows']}>
                                {filteredRows
                                    .sort((a, b) => a.order - b.order)
                                    .flatMap((row, index, arr) => {
                                        const items: React.ReactNode[] = [
                                            <ChecklistRowItem
                                                key={row.id}
                                                row={row}
                                                workgroupId={workgroup.id}
                                                isCompact={!expandTasks}
                                            />
                                        ];

                                        // Add insert divider after every row (including the last one)
                                        items.push(
                                            <div
                                                key={`insert-${row.id}`}
                                                className={styles['insert-row-divider']}
                                            >
                                                <button
                                                    className={styles['insert-row-btn']}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!isAdding) void addRow(workgroup.id, row.id);
                                                    }}
                                                    title="Insert row here"
                                                >
                                                    <span className={styles['insert-row-icon']}>+</span>
                                                    <span className={styles['insert-row-label']}>Add new row here</span>
                                                </button>
                                            </div>
                                        );

                                        return items;
                                    })}
                            </div>
                        )}
                    </div>
                )
            }
        </section >
    );
});

