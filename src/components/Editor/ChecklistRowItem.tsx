import React, { useRef } from 'react';
import { Button, Tooltip, Input, Textarea } from '@fluentui/react-components';
import {
    Delete20Regular,
    Flag20Regular,
    Flag20Filled,
    ChevronRight20Regular,
    ChevronDown20Regular
} from '@fluentui/react-icons';
import type { ChecklistRow } from '../../models';
import { useChecklistStore } from '../../stores';
import { AnswerSelector } from './AnswerSelector';
import { RichTextEditor } from './RichTextEditor';
import { InlineImageArea } from './InlineImageArea';
import styles from './ChecklistRowItem.module.scss';

interface ChecklistRowItemProps {
    row: ChecklistRow;
    workgroupId: string;
    onRowChange: () => void;
    isCompact?: boolean;
}

export const ChecklistRowItem: React.FC<ChecklistRowItemProps> = ({
    row,
    workgroupId,
    onRowChange,
    isCompact = false,
}) => {
    const { updateRow, deleteRow, addRow, addImageToRow, removeImageFromRow } = useChecklistStore();
    const nameRef = useRef<HTMLInputElement>(null);

    const [expanded, setExpanded] = React.useState(!isCompact);

    React.useEffect(() => {
        setExpanded(!isCompact);
    }, [isCompact]);

    const handleToggleExpand = () => {
        setExpanded(!expanded);
    };

    const handleNotesChange = (html: string) => {
        updateRow(row.id, { notes: html });
        onRowChange();
    };

    const handleToggleReview = () => {
        updateRow(row.id, { markedForReview: !row.markedForReview });
        onRowChange();
    };

    const handleDelete = () => {
        deleteRow(row.id);
        onRowChange();
    };

    const handleImageAdd = (source: string) => {
        const newImage = {
            id: `img-${Date.now()}`,
            rowId: row.id,
            source,
            order: row.images.length,
        };
        addImageToRow(row.id, newImage);
        onRowChange();
    };

    const handleImageRemove = (imageId: string) => {
        removeImageFromRow(row.id, imageId);
        onRowChange();
    };

    return (
        <div className={`${styles['row-item']} ${row.markedForReview ? styles['row-item--review'] : ''} ${isCompact ? styles['row-item--compact'] : ''}`}>

            {/* Main Flex Container (3 Columns) */}
            <div className={styles['row-main-flex']}>

                {/* Column 1: Expand Button */}
                <div className={styles['row-left-col']}>
                    <Button
                        className={styles['row-expand-btn']}
                        appearance="subtle"
                        icon={expanded ? <ChevronDown20Regular /> : <ChevronRight20Regular />}
                        onClick={handleToggleExpand}
                        aria-label={expanded ? "Collapse item" : "Expand item"}
                    />
                </div>

                {/* Column 2: Content Stack (Inputs + Desc + Notes) */}
                <div className={styles['row-center-col']}>

                    {/* Top Row: Answer + Name */}
                    <div className={styles['row-inputs-row']}>
                        <div className={styles['row-answer']}>
                            <AnswerSelector
                                value={row.answer}
                                onChange={(answer) => {
                                    updateRow(row.id, { answer });
                                    onRowChange();
                                }}
                            />
                        </div>

                        <Input
                            className={styles['row-name']}
                            value={row.name || ''}
                            onChange={(e, data) => {
                                updateRow(row.id, { name: data.value });
                                onRowChange();
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    addRow(workgroupId, row.id);
                                    onRowChange();
                                }
                            }}
                            placeholder="Item name"
                        />
                    </div>

                    {/* Description (Simple Textarea) Removed - User prefers Rich Text Editor */}

                    {/* Notes & Images (Visible if expanded) */}
                    {expanded && (
                        <>
                            <div className={styles['row-notes']}>
                                <RichTextEditor
                                    content={row.notes}
                                    onChange={handleNotesChange}
                                    placeholder="Add notes with formatting and checklists..."
                                />
                            </div>
                            <div className={styles['row-images']}>
                                <InlineImageArea
                                    images={row.images}
                                    onAddImage={handleImageAdd}
                                    onRemoveImage={handleImageRemove}
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Column 3: Actions */}
                <div className={styles['row-right-col']}>
                    <Tooltip content={row.markedForReview ? 'Remove review flag' : 'Mark for review'} relationship="label">
                        <Button
                            className={row.markedForReview ? styles['row-action-btn--review'] : styles['row-action-btn']}
                            appearance="subtle"
                            size="small"
                            icon={row.markedForReview ? <Flag20Filled /> : <Flag20Regular />}
                            onClick={handleToggleReview}
                        />
                    </Tooltip>
                    <Tooltip content="Delete item" relationship="label">
                        <Button
                            className={styles['row-action-btn--delete']}
                            appearance="subtle"
                            size="small"
                            icon={<Delete20Regular />}
                            onClick={handleDelete}
                        />
                    </Tooltip>
                </div>

            </div>
        </div>
    );
};
