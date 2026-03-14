import React, { useState } from 'react';
import { 
    Text, 
    Button, 
    Input, 
    Label,
    mergeClasses,
    Accordion,
    AccordionItem,
    AccordionHeader,
    AccordionPanel,
    AccordionToggleData,
    Dialog,
    DialogTrigger,
    DialogSurface,
    DialogTitle,
    DialogBody,
    DialogActions,
    DialogContent,
    Spinner
} from '@fluentui/react-components';
import { 
    History24Regular, 
    Save20Regular,
    Add24Regular,
    Edit20Regular,
    Dismiss20Regular,
    Dismiss24Regular
} from '@fluentui/react-icons';
import { Checklist, Revision } from '../../../models';
import { useChecklistStore } from '../../../stores';
import { RichTextEditor } from '../../Editor/RichTextEditor';
import styles from './RevisionListTab.module.scss';
import commonStyles from './ChecklistInfoPanel.module.scss';

interface RevisionListTabProps {
    checklist: Checklist;
}

export const RevisionListTab: React.FC<RevisionListTabProps> = ({ checklist }) => {
    const { updateRevision, createRevision, saveChecklist, isSaving } = useChecklistStore();
    const revisions = [...(checklist.revisions || [])].sort((a, b) => b.number - a.number);

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [openItems, setOpenItems] = useState<string[]>([]);
    const [editTitle, setEditTitle] = useState('');
    const [editNotes, setEditNotes] = useState('');

    // Creation State
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newNotes, setNewNotes] = useState('');
    const [isCreatingInternal, setIsCreatingInternal] = useState(false);

    const handleStartEdit = (revision: Revision) => {
        setEditingId(revision.id);
        setEditTitle(revision.title);
        setEditNotes(revision.notes);
    };

    const handleSave = async (revisionId: string) => {
        await updateRevision(revisionId, {
            title: editTitle,
            notes: editNotes
        });
        setEditingId(null);
    };

    const handleCancel = () => {
        setEditingId(null);
    };

    const handleCreateRevision = async () => {
        if (!newTitle.trim()) return;

        setIsCreatingInternal(true);
        try {
            await saveChecklist();
            await createRevision(newTitle, newNotes);
            setIsCreateDialogOpen(false);
            setNewTitle('');
            setNewNotes('');
        } catch (error) {
            console.error("Failed to create revision", error);
        } finally {
            setIsCreatingInternal(false);
        }
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const nextRevisionNumber = (checklist.revisions?.length || 0) + 1;

    return (
        <div className={commonStyles['info-panel']}>
            <div className={mergeClasses(commonStyles['info-section'], styles['header-with-action'])}>
                <div className={commonStyles['info-section-title']}>
                    <History24Regular className={commonStyles['section-icon']} />
                    Revision Management
                </div>
                
                <Dialog open={isCreateDialogOpen} onOpenChange={(_, data) => setIsCreateDialogOpen(data.open)}>
                    <DialogTrigger disableButtonEnhancement>
                        <Button 
                            appearance="primary" 
                            size="small" 
                            icon={<Add24Regular />}
                            className={styles['create-btn']}
                        >
                            New Revision
                        </Button>
                    </DialogTrigger>
                    <DialogSurface className={styles['large-dialog-surface']}>
                        <DialogBody>
                            <DialogTitle>Create Revision Marker</DialogTitle>
                            <DialogTrigger action="close">
                                <Button
                                    className={styles['dialog-close-btn']}
                                    appearance="subtle"
                                    icon={<Dismiss24Regular />}
                                    aria-label="Close dialog"
                                />
                            </DialogTrigger>
                            <DialogContent>
                                <div className={styles['create-form']}>
                                    <Text size={200} block style={{ marginBottom: '16px', color: '#666' }}>
                                        This will create a new Revision Section (REV {nextRevisionNumber}).
                                        Current changes will be saved first before locking.
                                    </Text>
                                    <div className={styles.field}>
                                        <div className={styles['field-label']}>Revision Title</div>
                                        <Input
                                            id="new-rev-title"
                                            placeholder="e.g., Post-Tender Adjustments..."
                                            value={newTitle}
                                            onChange={(_, data) => setNewTitle(data.value)}
                                            className={styles['full-width']}
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <div className={styles['field-label']}>Initial Revision Notes</div>
                                        <RichTextEditor
                                            content={newNotes}
                                            onChange={setNewNotes}
                                            placeholder="Describe the purpose of this revision..."
                                            className={styles['medium-editor']}
                                        />
                                    </div>
                                </div>
                            </DialogContent>
                            <DialogActions>
                                <DialogTrigger disableButtonEnhancement>
                                    <Button appearance="secondary" className={styles['cancel-btn']}>Cancel</Button>
                                </DialogTrigger>
                                <Button
                                    appearance="primary"
                                    className={styles['save-btn']}
                                    onClick={handleCreateRevision}
                                    disabled={!newTitle.trim() || isCreatingInternal || isSaving}
                                    icon={!isCreatingInternal ? <Save20Regular /> : undefined}
                                >
                                    {isCreatingInternal ? <Spinner size="tiny" label="Creating..." labelPosition="after" /> : 'Create Revision'}
                                </Button>
                            </DialogActions>
                        </DialogBody>
                    </DialogSurface>
                </Dialog>
            </div>

            <Text size={200} className={styles.description}>
                Manage historical revisions and their metadata.
            </Text>

            {revisions.length === 0 ? (
                <div className={styles['empty-state']}>
                    <Text italic>No revisions created yet.</Text>
                </div>
            ) : (
                <Accordion 
                    collapsible 
                    multiple 
                    openItems={openItems}
                    onToggle={(_, data: AccordionToggleData) => setOpenItems(data.openItems as string[])}
                >
                    {revisions.map(rev => (
                        <AccordionItem value={rev.id} key={rev.id} className={styles['revision-item']}>
                            <AccordionHeader expandIconPosition="end">
                                <div className={styles['item-header']}>
                                    <div className={styles['header-title']}>
                                        <div className={styles['header-title-row']}>
                                            <div className={styles.badge}>REV {rev.number}</div>
                                            <div className={styles['revision-title']}>{rev.title || 'Untitled Revision'}</div>
                                            {editingId !== rev.id && (
                                                <Button 
                                                    size="small" 
                                                    appearance="subtle" 
                                                    icon={<Edit20Regular />}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleStartEdit(rev);
                                                    }}
                                                    className={`${styles['inline-edit-btn']} ${openItems.includes(rev.id) ? styles['is-visible'] : ''}`}
                                                    title="Edit Metadata"
                                                />
                                            )}
                                        </div>
                                        <Text size={100} className={styles.meta}>
                                            {formatDate(rev.createdAt)} • {rev.createdBy}
                                        </Text>
                                    </div>
                                </div>
                            </AccordionHeader>
                            <AccordionPanel>
                                <div className={styles['item-content']}>
                                    {editingId === rev.id ? (
                                        <div className={styles['edit-form']}>
                                            <div className={styles.field}>
                                                <div className={styles['field-label']}>Revision Title</div>
                                                <Input 
                                                    id={`title-${rev.id}`}
                                                    value={editTitle}
                                                    onChange={(_, data) => setEditTitle(data.value)}
                                                    className={styles['full-width']}
                                                />
                                            </div>
                                            <div className={styles.field}>
                                                <div className={styles['field-label']}>Revision Notes</div>
                                                <RichTextEditor 
                                                    content={editNotes}
                                                    onChange={setEditNotes}
                                                    className={styles['small-editor']}
                                                />
                                            </div>
                                            <div className={styles['form-actions']}>
                                                <Button 
                                                    className={styles['cancel-btn']}
                                                    onClick={handleCancel}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button 
                                                    className={styles['save-btn']}
                                                    icon={<Save20Regular />}
                                                    onClick={() => handleSave(rev.id)}
                                                    disabled={!editTitle.trim() || isSaving}
                                                >
                                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={styles['view-content']}>
                                            {rev.notes ? (
                                                <div 
                                                    className={styles['notes-preview']} 
                                                    dangerouslySetInnerHTML={{ __html: rev.notes }} 
                                                />
                                            ) : (
                                                <Text italic size={100} block style={{ marginBottom: '8px', color: '#888' }}>No notes provided.</Text>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </AccordionPanel>
                        </AccordionItem>
                    ))}
                </Accordion>
            )}
        </div>
    );
};
