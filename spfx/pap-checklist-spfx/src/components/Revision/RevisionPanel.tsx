import React, { useState, useEffect } from 'react';
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
    Spinner,
} from '@fluentui/react-components';
import { Add20Regular } from '@fluentui/react-icons';
import type { Revision } from '../../models';
import { getRevisionService } from '../../services';
import { useChecklistStore } from '../../stores';
import { RevisionCard } from './RevisionCard';
import { RichTextEditor } from '../Editor/RichTextEditor';
import styles from './RevisionPanel.module.scss';

interface RevisionPanelProps {
    checklistId: string;
    onViewRevision: (revision: Revision) => void;
}

export const RevisionPanel: React.FC<RevisionPanelProps> = ({
    checklistId,
    onViewRevision,
}) => {
    const { saveChecklist } = useChecklistStore();
    const [revisions, setRevisions] = useState<Revision[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const loadRevisions = async () => {
        setIsLoading(true);
        try {
            const data = await getRevisionService().getRevisions(checklistId);
            setRevisions(data);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadRevisions();
    }, [checklistId]);

    const handleCreate = async () => {
        if (!title.trim()) return;

        setIsCreating(true);
        try {
            await saveChecklist();
            const revision = await getRevisionService().createRevision(checklistId, title, notes);
            setRevisions(prev => [...prev, revision]);
            setDialogOpen(false);
            setTitle('');
            setNotes('');
        } finally {
            setIsCreating(false);
        }
    };

    if (isLoading) {
        return (
            <div className={styles['revision-panel']}>
                <Spinner label="Loading revisions..." />
            </div>
        );
    }

    return (
        <div className={styles['revision-panel']}>
            <div className={styles['revision-list']}>
                {revisions.length === 0 ? (
                    <div className={styles['revision-empty']}>
                        <span>No revisions yet</span>
                    </div>
                ) : (
                    revisions
                        .sort((a, b) => b.number - a.number)
                        .map(revision => (
                            <RevisionCard
                                key={revision.id}
                                revision={revision}
                                onClick={() => onViewRevision(revision)}
                            />
                        ))
                )}
            </div>

            <div className={styles['create-revision']}>
                <Dialog open={dialogOpen} onOpenChange={(_, data) => setDialogOpen(data.open)}>
                    <DialogTrigger disableButtonEnhancement>
                        <Button appearance="primary" icon={<Add20Regular />} style={{ width: '100%' }}>
                            Create Revision
                        </Button>
                    </DialogTrigger>
                    <DialogSurface className={styles['create-revision-dialog']}>
                        <DialogBody className={styles['dialog-body']}>
                            <DialogTitle>Create Revision</DialogTitle>
                            <DialogContent className={styles['dialog-content']}>
                                <div className={styles['revision-form']}>
                                    <span>
                                        This will save the current state as REV {revisions.length + 1}.
                                    </span>
                                    <div>
                                        <Label htmlFor="revision-title" required>Title</Label>
                                        <Input
                                            id="revision-title"
                                            placeholder="e.g., Initial Release, Client Feedback Update..."
                                            value={title}
                                            onChange={(_, data) => setTitle(data.value)}
                                            className={styles['revision-title-input']}
                                        />
                                    </div>
                                    <div className={styles['notes-container']}>
                                        <Label htmlFor="revision-notes">Notes</Label>
                                        <RichTextEditor
                                            content={notes}
                                            onChange={(html: string) => setNotes(html)}
                                            placeholder="Describe what changed in this revision..."
                                            className={styles['full-height-editor']}
                                        />
                                    </div>
                                </div>
                            </DialogContent>
                            <DialogActions>
                                <DialogTrigger disableButtonEnhancement>
                                    <Button appearance="secondary">Cancel</Button>
                                </DialogTrigger>
                                <Button
                                    appearance="primary"
                                    onClick={handleCreate}
                                    disabled={!title.trim() || isCreating}
                                >
                                    {isCreating ? 'Creating...' : 'Create Revision'}
                                </Button>
                            </DialogActions>
                        </DialogBody>
                    </DialogSurface>
                </Dialog>
            </div>
        </div>
    );
};
