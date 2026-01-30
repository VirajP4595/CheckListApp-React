import React, { useState, useEffect } from 'react';
import {
    Button,
    Textarea,
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
    const [summary, setSummary] = useState('');
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
        if (!summary.trim()) return;

        setIsCreating(true);
        try {
            await saveChecklist();
            const revision = await getRevisionService().createRevision(checklistId, summary);
            setRevisions(prev => [...prev, revision]);
            setDialogOpen(false);
            setSummary('');
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
                    <DialogSurface>
                        <DialogBody>
                            <DialogTitle>Create Revision</DialogTitle>
                            <DialogContent>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <span>
                                        This will save the current state as REV {revisions.length + 1}.
                                    </span>
                                    <Textarea
                                        placeholder="Describe what changed in this revision..."
                                        value={summary}
                                        onChange={(_, data) => setSummary(data.value)}
                                        resize="vertical"
                                    />
                                </div>
                            </DialogContent>
                            <DialogActions>
                                <DialogTrigger disableButtonEnhancement>
                                    <Button appearance="secondary">Cancel</Button>
                                </DialogTrigger>
                                <Button
                                    appearance="primary"
                                    onClick={handleCreate}
                                    disabled={!summary.trim() || isCreating}
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
