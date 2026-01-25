import React, { useEffect, useState } from 'react';
import {
    Button,
    Spinner,
    Dialog,
    DialogTrigger,
    DialogSurface,
    DialogTitle,
    DialogBody,
    DialogActions,
    DialogContent,
    Input,
    Label,
    Dropdown,
    Option,
    OptionOnSelectData,
    SelectionEvents,
} from '@fluentui/react-components';
import { Add24Regular, DocumentBulletList24Regular, Person24Regular } from '@fluentui/react-icons';
import { useChecklistStore } from '../../stores';
import { useAuth } from '../../providers/AuthProvider';
import { ChecklistCard } from './ChecklistCard';
import styles from './Dashboard.module.scss';

interface DashboardProps {
    onOpenChecklist: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenChecklist }) => {
    const { checklists, isLoading, loadChecklists, createChecklist } = useChecklistStore();
    const { user } = useAuth();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newJobRef, setNewJobRef] = useState(''); // Display value (Reference)
    const [newJobId, setNewJobId] = useState('');   // Selected Job ID
    const [jobs, setJobs] = useState<any[]>([]);    // Should use Job interface
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        loadChecklists();
        // Load jobs
        import('../../services/dataverseJobService').then(({ jobService }) => {
            jobService.getAllJobs().then(setJobs).catch(console.error);
        });
    }, [loadChecklists]);

    const handleCreate = async () => {
        if (!newTitle.trim() || !newJobRef.trim()) return;

        setIsCreating(true);
        try {
            // Pass both Title and JobId (first arg was title, second was jobRef - we'll update service to take ID)
            const newChecklist = await createChecklist(newTitle, newJobId || newJobRef); // Fallback if no ID (legacy)
            setDialogOpen(false);
            setNewTitle('');
            setNewJobRef('');
            onOpenChecklist(newChecklist.id);
        } finally {
            setIsCreating(false);
        }
    };

    if (isLoading && checklists.length === 0) {
        return (
            <div className={styles.dashboard}>
                <div className={styles['dashboard-loading']}>
                    <Spinner label="Loading checklists..." />
                </div>
            </div>
        );
    }

    return (
        <div className={styles.dashboard}>
            {/* Brand Header */}
            <header className={styles['dashboard-header']}>
                <div className={styles['dashboard-header-content']}>
                    <div className={styles['dashboard-title']}>
                        <h1 className={styles['dashboard-title-main']}>PAP Checklists</h1>
                        <span className={styles['dashboard-title-sub']}>
                            Estimator Checklist Management System
                        </span>
                    </div>

                    {/* User Profile */}
                    {user && (
                        <div className={styles['user-profile']}>
                            <div className={styles['user-avatar']}>
                                <Person24Regular />
                            </div>
                            <div className={styles['user-info']}>
                                <span className={styles['user-name']}>{user.name}</span>
                                <span className={styles['user-email']}>{user.username}</span>
                            </div>
                        </div>
                    )}

                    {/* Create Checklist removed - handled by Power Automate Flow on Job creation */}
                </div>
            </header>

            {/* Content Area */}
            <main className={styles['dashboard-content']}>
                <div className={styles['dashboard-container']}>
                    {checklists.length === 0 ? (
                        <div className={styles['dashboard-empty']}>
                            <DocumentBulletList24Regular className={styles['dashboard-empty-icon']} />
                            <h2 className={styles['dashboard-empty-title']}>No Checklists Yet</h2>
                            <p className={styles['dashboard-empty-text']}>
                                Create your first checklist to get started with your estimates.
                            </p>
                            <Button
                                className={styles['dashboard-create-btn']}
                                appearance="primary"
                                icon={<Add24Regular />}
                                onClick={() => setDialogOpen(true)}
                            >
                                Create First Checklist
                            </Button>
                        </div>
                    ) : (
                        <div className={styles['checklist-grid']}>
                            {checklists.map(checklist => (
                                <ChecklistCard
                                    key={checklist.id}
                                    checklist={checklist}
                                    onClick={() => onOpenChecklist(checklist.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};
