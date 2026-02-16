import React, { useEffect } from 'react';
import {
    Spinner,
    MessageBar,
    MessageBarBody,
    MessageBarTitle,
    MessageBarActions,
    Button,
    Link
} from '@fluentui/react-components';
import { DocumentBulletList24Regular, Person24Regular, Home24Regular } from '@fluentui/react-icons';
import { useChecklistStore, useUserStore } from '../../stores';
import { ChecklistCard } from './ChecklistCard';
import styles from './Dashboard.module.scss';

interface DashboardProps {
    onOpenChecklist: (id: string) => void;
}

// ... imports
import { DashboardFilterBar, DashboardFilterState } from './DashboardFilterBar';

interface DashboardProps {
    onOpenChecklist: (id: string) => void;
    siteUrl: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenChecklist, siteUrl }) => {
    const { checklists, isLoading, loadChecklists, error, isInitialized } = useChecklistStore();
    const { user } = useUserStore();

    // Filter State
    const [filters, setFilters] = React.useState<DashboardFilterState>({
        search: '',
        selectedJobIds: [],
        selectedStatuses: [],
        sort: { field: 'updatedAt', direction: 'desc' }
    });

    // Removed manual creation state/logic as checklists are auto-created via Jobs

    // Retry Logic
    const retryCount = React.useRef(0);
    const MAX_RETRIES = 2;

    useEffect(() => {
        // Initial Load
        if (!error && !isInitialized && !isLoading) {
            void loadChecklists();
        }

        // Auto-Retry on Error
        if (error && retryCount.current < MAX_RETRIES) {
            const timer = setTimeout(() => {
                retryCount.current++;
                console.log(`Dashboard: Auto-retry attempt ${retryCount.current}/${MAX_RETRIES}`);
                void loadChecklists();
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [error, isInitialized, isLoading, loadChecklists]);

    if (error && retryCount.current >= MAX_RETRIES) {
        return (
            <div className={styles.dashboard}>
                <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
                    <MessageBar intent="error">
                        <MessageBarBody>
                            <MessageBarTitle>Unable to Load Checklists</MessageBarTitle>
                            <div style={{ margin: '8px 0' }}>
                                {error}
                            </div>
                            <div>
                                We are having trouble connecting to the server. This is often caused by a session timeout.
                            </div>
                        </MessageBarBody>
                        <MessageBarActions containerAction={<button aria-label="Dismiss" />}>
                            <Button onClick={() => {
                                retryCount.current = 0;
                                void loadChecklists();
                            }}>
                                Try Again
                            </Button>
                            <Button appearance="primary" onClick={() => window.location.reload()}>
                                Refresh Page
                            </Button>
                        </MessageBarActions>
                    </MessageBar>
                </div>
            </div>
        );
    }

    // Computed Checklists
    const filteredChecklists = React.useMemo(() => {
        console.log('Dashboard Debug:', {
            totalChecklists: checklists.length,
            filters,
            firstChecklist: checklists[0]
        });

        let result = [...checklists];

        // 1. Filter by Job Selection (if any)
        const selectedJobIds = filters.selectedJobIds;
        if (selectedJobIds && selectedJobIds.length > 0) {
            console.log('Filtering by Jobs:', selectedJobIds);
            result = result.filter(c => selectedJobIds.includes(c.id));
        }

        // 2. Filter by Status
        const selectedStatuses = filters.selectedStatuses;
        if (selectedStatuses && selectedStatuses.length > 0) {
            console.log('Filtering by Status:', selectedStatuses);
            result = result.filter(c => selectedStatuses.includes(c.status));
        }

        // 3. Sort
        try {
            result.sort((a, b) => {
                const fieldA = filters.sort.field === 'updatedAt' ? new Date(a.updatedAt || 0).getTime() : (a.title || '').toLowerCase();
                const fieldB = filters.sort.field === 'updatedAt' ? new Date(b.updatedAt || 0).getTime() : (b.title || '').toLowerCase();

                if (filters.sort.direction === 'asc') {
                    return fieldA > fieldB ? 1 : -1;
                } else {
                    return fieldA < fieldB ? 1 : -1;
                }
            });
        } catch (e) {
            console.error("Sort Error", e);
        }

        console.log('Filtered Count:', result.length);
        return result;
    }, [checklists, filters]);

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
                    {/* Home Button */}
                    <div className={styles['dashboard-home-btn']}>
                        <Button
                            appearance="subtle"
                            icon={<Home24Regular />}
                            title="Go to SharePoint Home"
                            onClick={() => { window.location.href = siteUrl; }}
                            style={{ color: 'white', minWidth: 'auto', padding: '8px' }}
                        />
                    </div>

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
                                <span className={styles['user-email']}>{user.email}</span>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Content Area */}
            <main className={styles['dashboard-content']}>
                <div className={styles['dashboard-container']}>

                    {/* Filter Bar */}
                    <DashboardFilterBar
                        checklists={checklists}
                        filters={filters}
                        onFiltersChange={setFilters}
                    />

                    {filteredChecklists.length === 0 ? (
                        <div className={styles['dashboard-empty']}>
                            <DocumentBulletList24Regular className={styles['dashboard-empty-icon']} />
                            <h2 className={styles['dashboard-empty-title']}>No Checklists Found</h2>
                            <p className={styles['dashboard-empty-text']}>
                                {checklists.length === 0
                                    ? "Checklists are automatically created when a Job is assigned."
                                    : "No checklists match your current filters."}
                                <br />
                                {checklists.length === 0 && "Please check back later or contact support if you expect to see a checklist."}
                            </p>
                        </div>
                    ) : (
                        <div className={styles['checklist-grid']}>
                            {filteredChecklists.map(checklist => (
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
