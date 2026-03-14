import React, { useState } from 'react';
import {
    Button,
    Input,
    Label,
    Dialog,
    DialogTrigger,
    DialogSurface,
    DialogTitle,
    DialogBody,
    DialogActions,
    DialogContent,
} from '@fluentui/react-components';
import { History24Regular } from '@fluentui/react-icons';
import { useChecklistStore } from '../../stores';
import { RichTextEditor } from '../Editor/RichTextEditor';
import styles from '../Editor/ChecklistEditor.module.scss'; // Reuse common button styles
import localStyles from './RevisionPanel.module.scss';

interface RevisionPanelProps {
    checklistId: string;
}

/**
 * Now acts as a Header Action Button that triggers the "Create Revision" Dialog
 */
export const RevisionPanel: React.FC<RevisionPanelProps> = ({
    checklistId
}) => {
    const { activeChecklist, createRevision, isSaving, saveChecklist } = useChecklistStore();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [isCreatingInternal, setIsCreatingInternal] = useState(false);

    const handleCreate = async () => {
        if (!title.trim() || !activeChecklist) return;

        setIsCreatingInternal(true);
        try {
            // Ensure data is saved before creating revision marker
            await saveChecklist();
            
            await createRevision(title, notes);
            
            setDialogOpen(false);
            setTitle('');
            setNotes('');
        } catch (error) {
            console.error("Failed to create revision", error);
        } finally {
            setIsCreatingInternal(false);
        }
    };

    const nextRevisionNumber = (activeChecklist?.revisions?.length || 0) + 1;

    return (
        <Dialog open={dialogOpen} onOpenChange={(_, data) => setDialogOpen(data.open)}>
            <DialogTrigger disableButtonEnhancement>
                <Button 
                    className={styles['editor-action-btn']} 
                    appearance="subtle" 
                    icon={<History24Regular />}
                    title="Create New Revision"
                >
                    Revision
                </Button>
            </DialogTrigger>
            <DialogSurface className={localStyles['create-revision-dialog']}>
                <DialogBody className={localStyles['dialog-body']}>
                    <DialogTitle>Create Revision Marker</DialogTitle>
                    <DialogContent className={localStyles['dialog-content']}>
                        <div className={localStyles['revision-form']}>
                            <p style={{ marginBottom: '16px', color: '#666' }}>
                                This will create a new Revision Section (REV {nextRevisionNumber}) where you can add specific workgroups.
                                The current checklist state will be saved before creating the revision.
                            </p>
                            <div>
                                <Label htmlFor="revision-title" required>Revision Title</Label>
                                <Input
                                    id="revision-title"
                                    placeholder="e.g., Post-Tender Adjustments, Site Visit Changes..."
                                    value={title}
                                    onChange={(_, data) => setTitle(data.value)}
                                    className={localStyles['revision-title-input']}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div className={localStyles['notes-container']} style={{ marginTop: '16px' }}>
                                <Label htmlFor="revision-notes">Initial Revision Notes</Label>
                                <RichTextEditor
                                    content={notes}
                                    onChange={(html: string) => setNotes(html)}
                                    placeholder="Briefly describe the purpose of this revision..."
                                    className={localStyles['full-height-editor']}
                                />
                            </div>
                        </div>
                    </DialogContent>
                    <DialogActions style={{ marginTop: '20px' }}>
                        <DialogTrigger disableButtonEnhancement>
                            <Button appearance="secondary">Cancel</Button>
                        </DialogTrigger>
                        <Button
                            appearance="primary"
                            onClick={handleCreate}
                            disabled={!title.trim() || isCreatingInternal || isSaving}
                        >
                            {isCreatingInternal ? 'Creating...' : 'Create Revision'}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
