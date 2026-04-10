import React, { useRef } from 'react';
import { Button, Tooltip, Input, Spinner, Dialog, DialogTrigger, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions } from '@fluentui/react-components';
import {
    Delete20Regular,
    Flag20Regular,
    Flag20Filled,
    LockClosed20Regular,
    LockClosed20Filled,
    ChevronRight24Filled,
    ChevronDown24Filled,
    Alert20Regular,
    Alert20Filled,
    PersonArrowRight20Regular,
    PersonArrowRight20Filled
} from '@fluentui/react-icons';
import type { ChecklistRow } from '../../models';
import { useChecklistStore } from '../../stores';
import { AnswerSelector } from './AnswerSelector';
import { RichTextEditor } from './RichTextEditor';
import { VoiceInputButton } from './VoiceInputButton';
import { InlineImageArea } from './InlineImageArea';
import { NotifyAdminDialog } from './NotifyAdminDialog';
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
    const notesEditorRef = useRef<any>(null);

    const [expanded, setExpanded] = React.useState(!isCompact);
    const [showNotifyDialog, setShowNotifyDialog] = React.useState(false);
    const activeChecklist = useChecklistStore(state => state.activeChecklist);

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

    const handleToggleNotify = () => {
        if (!row.notifyAdmin) {
            updateRow(row.id, { notifyAdmin: true });
            void saveRow(row.id);
        } else {
            updateRow(row.id, { notifyAdmin: false });
            void saveRow(row.id);
        }
    };

    const handleToggleBtc = () => {
        updateRow(row.id, { builderToConfirm: !row.builderToConfirm });
        void saveRow(row.id);
    };

    const handleToggleInternalOnly = () => {
        updateRow(row.id, { internalOnly: !row.internalOnly });
        void saveRow(row.id);
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

    const setActiveRowId = useChecklistStore(state => state.setActiveRowId);

    return (
        <div
            className={`${styles['row-item']} ${!expanded ? styles['row-item--compact'] : ''}`}
            onMouseEnter={() => setActiveRowId(row.id)}
        >
            <div className={styles['row-main-flex']}>
                {/* Column 1: Expand Button */}
                <div className={styles['row-left-col']}>
                    <Button
                        className={styles['row-expand-btn']}
                        appearance="subtle"
                        icon={expanded ? <ChevronDown24Filled /> : <ChevronRight24Filled />}
                        onClick={handleToggleExpand}
                        aria-label={expanded ? "Collapse item" : "Expand item"}
                    />
                </div>

                {/* Column 2: Content Stack */}
                <div className={styles['row-center-col']}>
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
                            onChange={(_, data) => updateRow(row.id, { name: data.value })}
                            onFocus={() => { originalNameRef.current = row.name; }}
                            onBlur={() => { if (row.name !== originalNameRef.current) void saveRow(row.id); }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    void addRow(workgroupId, row.id, row.section);
                                    if (row.name !== originalNameRef.current) void saveRow(row.id);
                                }
                            }}
                            placeholder="Item name"
                        />
                    </div>

                    {/* RFQ Supplier Fields */}
                    {row.answer === 'RFQ' && (
                        <div className={styles['row-rfq-fields']}>
                            <div className={styles['rfq-field']}>
                                <span className={styles['rfq-field-label']}>Supplier Name</span>
                                <Input
                                    className={styles['rfq-input']}
                                    value={row.supplierName || ''}
                                    onChange={(_, data) => updateRow(row.id, { supplierName: data.value })}
                                    onBlur={() => void saveRow(row.id)}
                                    placeholder="Enter supplier name..."
                                />
                            </div>
                            <div className={styles['rfq-field']}>
                                <span className={styles['rfq-field-label']}>Supplier Email</span>
                                <Input
                                    className={styles['rfq-input']}
                                    value={row.supplierEmail || ''}
                                    onChange={(_, data) => updateRow(row.id, { supplierEmail: data.value })}
                                    onBlur={() => void saveRow(row.id)}
                                    placeholder="Enter supplier email..."
                                    type="email"
                                />
                            </div>
                        </div>
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
                    <Tooltip content={row.notifyAdmin ? 'Remove admin notification' : 'Notify admin'} relationship="label">
                        <Button
                            className={row.notifyAdmin ? styles['row-action-btn--notify'] : styles['row-action-btn']}
                            appearance="subtle"
                            size="small"
                            icon={row.notifyAdmin ? <Alert20Filled /> : <Alert20Regular />}
                            onClick={handleToggleNotify}
                        />
                    </Tooltip>
                    <Tooltip content={row.builderToConfirm ? 'Remove BTC flag' : 'Builder to Confirm'} relationship="label">
                        <Button
                            className={row.builderToConfirm ? styles['row-action-btn--btc'] : styles['row-action-btn']}
                            appearance="subtle"
                            size="small"
                            icon={row.builderToConfirm ? <PersonArrowRight20Filled /> : <PersonArrowRight20Regular />}
                            onClick={handleToggleBtc}
                        />
                    </Tooltip>
                    <Tooltip content={row.internalOnly ? 'Remove internal flag' : 'Mark as internal only'} relationship="label">
                        <Button
                            className={row.internalOnly ? styles['row-action-btn--internal'] : styles['row-action-btn']}
                            appearance="subtle"
                            size="small"
                            icon={row.internalOnly ? <LockClosed20Filled /> : <LockClosed20Regular />}
                            onClick={handleToggleInternalOnly}
                        />
                    </Tooltip>
                    <Dialog>
                        <DialogTrigger disableButtonEnhancement>
                            <Tooltip content="Delete item" relationship="label">
                                {isDeleting ? (
                                    <Spinner size="extra-tiny" />
                                ) : (
                                    <Button
                                        className={styles['row-action-btn--delete']}
                                        appearance="subtle"
                                        size="small"
                                        icon={<Delete20Regular />}
                                    />
                                )}
                            </Tooltip>
                        </DialogTrigger>
                        <DialogSurface aria-describedby={undefined}>
                            <DialogBody>
                                <DialogTitle>Delete Item</DialogTitle>
                                <DialogContent>
                                    Are you sure you want to delete this item{row.name ? ': "' + row.name + '"' : ''}? This action cannot be undone.
                                </DialogContent>
                                <DialogActions>
                                    <DialogTrigger disableButtonEnhancement>
                                        <Button appearance="secondary">Cancel</Button>
                                    </DialogTrigger>
                                    <Button
                                        appearance="primary"
                                        style={{ backgroundColor: '#d13438' }}
                                        onClick={() => { void deleteRow(row.id); }}
                                    >
                                        Delete
                                    </Button>
                                </DialogActions>
                            </DialogBody>
                        </DialogSurface>
                    </Dialog>
                    {showNotifyDialog && (
                        <NotifyAdminDialog
                            row={row}
                            checklist={activeChecklist}
                            onClose={() => setShowNotifyDialog(false)}
                        />
                    )}
                </div>
            </div>

            {/* Full-width notes and images below the flex row */}
            {expanded && (
                <div className={styles['row-expanded-area']}>
                    <div className={styles['row-notes']}>
                        <RichTextEditor
                            content={row.notes}
                            onChange={(html: string) => updateRow(row.id, { notes: html })}
                            onFocus={() => { originalNotesRef.current = row.notes; }}
                            onBlur={() => { if (row.notes !== originalNotesRef.current) void saveRow(row.id); }}
                            onEditorReady={(e) => { notesEditorRef.current = e; }}
                            placeholder="Add notes with formatting and checklists..."
                            toolbarExtra={
                                <VoiceInputButton
                                    onTranscript={(text) => {
                                        if (notesEditorRef.current) {
                                            notesEditorRef.current.chain().focus().insertContent(text + ' ').run();
                                        }
                                    }}
                                />
                            }
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
                </div>
            )}
        </div>
    );
});
