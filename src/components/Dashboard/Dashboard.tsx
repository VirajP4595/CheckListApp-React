import React, { useEffect } from 'react';
import { Spinner } from '@fluentui/react-components';
import { DocumentBulletList24Regular, Person24Regular } from '@fluentui/react-icons';
import { useChecklistStore } from '../../stores';
import { useAuth } from '../../providers/AuthProvider';
import { ChecklistCard } from './ChecklistCard';
import styles from './Dashboard.module.scss';

interface DashboardProps {
    onOpenChecklist: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenChecklist }) => {
    const { checklists, isLoading, loadChecklists } = useChecklistStore();
    const { user } = useAuth();

    // Removed manual creation state/logic as checklists are auto-created via Jobs

    useEffect(() => {
        loadChecklists();
    }, [loadChecklists]);

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
                </div>
            </header>

            {/* Content Area */}
            <main className={styles['dashboard-content']}>
                <div className={styles['dashboard-container']}>
                    {checklists.length === 0 ? (
                        <div className={styles['dashboard-empty']}>
                            <DocumentBulletList24Regular className={styles['dashboard-empty-icon']} />
                            <h2 className={styles['dashboard-empty-title']}>No Checklists Found</h2>
                            <p className={styles['dashboard-empty-text']}>
                                Checklists are automatically created when a Job is assigned.
                                <br />Please check back later or contact support if you expect to see a checklist.
                            </p>
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
