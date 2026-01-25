import React, { useState, useEffect } from 'react';
import { Button, Input, Tooltip } from '@fluentui/react-components';
import {
    Add20Regular,
    ChevronDown20Regular,
    ChevronRight20Regular,
    Edit20Regular,
    Delete20Regular,
    MoreVertical20Regular,
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

export const WorkgroupSection: React.FC<WorkgroupSectionProps> = ({
    workgroup,
    onRowChange,
    filters,
    isCollapsed = false,
    expandTasks = true,
}) => {
    const { addRow, updateWorkgroup, deleteWorkgroup } = useChecklistStore();
    const [localCollapsed, setLocalCollapsed] = useState(isCollapsed);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        setLocalCollapsed(isCollapsed || false);
    }, [isCollapsed]);

    const collapsed = localCollapsed;

    const handleToggleExpand = () => {
        setLocalCollapsed(!localCollapsed);
    };

    const handleAddRow = () => {
        addRow(workgroup.id);
        onRowChange();
    };

    const handleDelete = () => {
        if (window.confirm(`Delete workgroup "${workgroup.name}"? This will also delete all ${workgroup.rows.length} items.`)) {
            deleteWorkgroup(workgroup.id);
            onRowChange();
        }
    };

    // Filter rows based on filters
    const filteredRows = workgroup.rows.filter(row => {
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
        return true;
    });

    // Calculate answer summary for collapsed state
    const answerCounts = workgroup.rows.reduce((acc, row) => {
        acc[row.answer] = (acc[row.answer] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

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
                            value={String(workgroup.number)}
                            onChange={(_, data) => {
                                const num = parseFloat(data.value) || 0;
                                updateWorkgroup(workgroup.id, { number: num });
                            }}
                            onClick={(e) => e.stopPropagation()}
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
                            value={workgroup.name}
                            onChange={(_, data) => {
                                updateWorkgroup(workgroup.id, { name: data.value });
                            }}
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
                                // Fix case sensitivity (data might be YES or yes)
                                const normalize = (s?: string) => s?.toLowerCase() || 'blank';
                                const yes = filteredRows.filter(r => normalize(r.answer) === 'yes').length;
                                const no = filteredRows.filter(r => normalize(r.answer) === 'no').length;
                                const blank = filteredRows.filter(r => ['blank', '', undefined, null].includes(normalize(r.answer))).length;

                                // Show as simple text with dots
                                const parts = [];
                                if (yes) parts.push(
                                    <span key="y" className={styles['status-item']}>
                                        <span className={styles['status-dot-yes']}>●</span> {yes} Yes
                                    </span>
                                );
                                if (no) parts.push(
                                    <span key="n" className={styles['status-item']}>
                                        <span className={styles['status-dot-no']}>●</span> {no} No
                                    </span>
                                );
                                if (blank) parts.push(
                                    <span key="b" className={styles['status-item']}>
                                        <span className={styles['status-dot-blank']}>●</span> {blank} Blank
                                    </span>
                                );

                                return parts.length > 0 ? (
                                    <div className={styles['status-summary-container']}>
                                        {parts}
                                    </div>
                                ) : null;
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
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditing(false);
                                }}
                            />
                        ) : (
                            <Button
                                className={styles['workgroup-action-btn']}
                                appearance="subtle"
                                size="small"
                                icon={<Edit20Regular />}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditing(true);
                                }}
                            />
                        )}

                        <Tooltip content="Delete workgroup" relationship="label">
                            <Button
                                className={styles['workgroup-action-btn--delete']}
                                appearance="subtle"
                                size="small"
                                icon={<Delete20Regular />}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete();
                                }}
                            />
                        </Tooltip>
                    </div>
                </div>
            </header>

            {/* Legacy Collapsed Summary Removed - Status is now in header */}

            {!collapsed && (
                <div className={styles['workgroup-content']}>
                    {filteredRows.length === 0 ? (
                        <div className={styles['workgroup-empty']}>
                            <span>{workgroup.rows.length === 0 ? 'No items in this workgroup yet.' : 'No items match the current filters.'}</span>
                        </div>
                    ) : (
                        <div className={styles['workgroup-rows']}>
                            {filteredRows
                                .sort((a, b) => a.order - b.order)
                                .map(row => (
                                    <ChecklistRowItem
                                        key={row.id}
                                        row={row}
                                        workgroupId={workgroup.id}
                                        onRowChange={onRowChange}
                                        isCompact={!expandTasks}
                                    />
                                ))}
                        </div>
                    )}

                    <Button
                        className={styles['workgroup-add-row']}
                        appearance="subtle"
                        icon={<Add20Regular />}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleAddRow();
                        }}
                    >
                        Add checklist item
                    </Button>
                </div>
            )}
        </section>
    );
};

