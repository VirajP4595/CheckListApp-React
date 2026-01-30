import React, { useRef } from 'react';
import { Button, Tooltip, Input, Spinner } from '@fluentui/react-components';
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
    isCompact?: boolean;
}

export const ChecklistRowItem: React.FC<ChecklistRowItemProps> = React.memo(({
    row,
    workgroupId,
    isCompact = false,
}) => {
    const updateRow = useChecklistStore(state => state.updateRow);
    const deleteRow = useChecklistStore(state => state.deleteRow);
    const addRow = useChecklistStore(state => state.addRow);
    const addImageToRow = useChecklistStore(state => state.addImageToRow);
    const removeImageFromRow = useChecklistStore(state => state.removeImageFromRow);
    const saveRow = useChecklistStore(state => state.saveRow);

    const isDeleting = useChecklistStore(state => state.processingItems.includes(row.id));

    const originalNameRef = useRef(row.name);
    const originalNotesRef = useRef(row.notes);

    const [expanded, setExpanded] = React.useState(!isCompact);

    React.useEffect(() => {
        setExpanded(!isCompact);
    }, [isCompact]);

    const handleToggleExpand = () => {
        setExpanded(!expanded);
    };

    React.useEffect(() => {
        if (expanded) {
            void useChecklistStore.getState().fetchRowImages(row.id);
        }
    }, [expanded, row.id]);



    const handleToggleReview = () => {
        updateRow(row.id, { markedForReview: !row.markedForReview });
        void saveRow(row.id);
    };

    const handleDelete = () => {
        void deleteRow(row.id);
    };

    const handleImageAdd = (source: string) => {
        const newImage = {
            id: `img-${Date.now()}`,
            rowId: row.id,
            source,
            order: row.images.length,
        };
        addImageToRow(row.id, newImage);

    };

    const handleImageRemove = (imageId: string) => {
        removeImageFromRow(row.id, imageId);

    };

    return (
        <div className={`${styles['row-item']} ${row.markedForReview ? styles['row-item--review'] : ''} ${!expanded ? styles['row-item--compact'] : ''}`}>

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
                                    void saveRow(row.id);
                                }}
                            />
                        </div>





                        <Input
                            className={styles['row-name']}
                            value={row.name || ''}
                            onChange={(_, data) => {
                                updateRow(row.id, { name: data.value });
                            }}
                            onFocus={() => {
                                originalNameRef.current = row.name;
                            }}
                            onBlur={() => {
                                if (row.name !== originalNameRef.current) {
                                    void saveRow(row.id);
                                }
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    void addRow(workgroupId, row.id);
                                    if (row.name !== originalNameRef.current) {
                                        void saveRow(row.id);
                                    }
                                }
                            }}
                            placeholder="Item name"
                        />
                    </div>



                    {/* Notes & Images (Visible if expanded) */}
                    {expanded && (
                        <>
                            <div className={styles['row-notes']}>
                                <RichTextEditor
                                    content={row.notes}
                                    onChange={(html) => updateRow(row.id, { notes: html })}
                                    onFocus={() => {
                                        originalNotesRef.current = row.notes;
                                    }}
                                    onBlur={() => {
                                        if (row.notes !== originalNotesRef.current) {
                                            void saveRow(row.id);
                                        }
                                    }}
                                    placeholder="Add notes with formatting and checklists..."
                                />
                            </div>
                            <div className={styles['row-images']}>
                                <InlineImageArea
                                    rowId={row.id}
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
                        {isDeleting ? (
                            <Spinner size="extra-tiny" />
                        ) : (
                            <Button
                                className={styles['row-action-btn--delete']}
                                appearance="subtle"
                                size="small"
                                icon={<Delete20Regular />}
                                onClick={handleDelete}
                            />
                        )}
                    </Tooltip>
                </div>

            </div>
        </div>
    );
});
