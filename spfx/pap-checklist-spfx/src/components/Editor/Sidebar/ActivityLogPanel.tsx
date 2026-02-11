import * as React from 'react';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import {
    Edit20Regular,
    AddCircle20Regular,
    Delete20Regular,
    Comment20Regular,
    Document20Regular,
    History20Regular,
    CircleSmall20Regular,
    Clock20Regular
} from '@fluentui/react-icons';
import { getActivityLogService } from '../../../services';
import type { DailyActivityLog, ActivityEntry } from '../../../services/activityLogService';
import { ACTION_LABELS } from '../../../services/activityLogService';
import stylesImport from './ActivityLogPanel.module.scss';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const styles: any = stylesImport;

interface ActivityLogPanelProps {
    checklistId: string;
}

interface GroupedEntry extends ActivityEntry {
    count: number;
    details: string[];
}

// ─── Icon Mapping ───────────────────────────────────────────

const getActionIcon = (action: string) => {
    switch (action) {
        case 'row_updated':
        case 'checklist_metadata_updated':
        case 'common_notes_updated':
            return <Edit20Regular />;
        case 'row_added':
        case 'workgroup_added':
            return <AddCircle20Regular />;
        case 'row_deleted':
        case 'workgroup_deleted':
        case 'file_deleted':
            return <Delete20Regular />;
        case 'comment_added':
            return <Comment20Regular />;
        case 'file_uploaded':
            return <Document20Regular />;
        case 'revision_created':
            return <History20Regular />;
        default:
            return <CircleSmall20Regular />;
    }
};

// ─── Helper: Group Entries ──────────────────────────────────

function groupEntries(entries: ActivityEntry[]): GroupedEntry[] {
    // 1. Reverse to start with newest
    const reversed = [...entries].reverse();
    const groups = new Map<string, GroupedEntry>();

    for (const entry of reversed) {
        const key = `${entry.action}|${entry.user}`;

        if (groups.has(key)) {
            const group = groups.get(key)!;
            group.count++;
            if (entry.detail) {
                // Add detail if not already present (dedupe exact duplicates, but keep distinct ones)
                // Note: We are appending older details to the list.
                // If we want the list to be Newest -> Oldest, this works (C, then B, then A).
                if (!group.details.includes(entry.detail)) {
                    group.details.push(entry.detail);
                }
            }
        } else {
            // Create new group
            groups.set(key, {
                ...entry,
                count: 1,
                details: entry.detail ? [entry.detail] : []
            });
        }
    }

    return Array.from(groups.values());
}

// ─── Entry Row ──────────────────────────────────────────────

const EntryRow: React.FC<{ entry: GroupedEntry; isLast: boolean }> = ({ entry, isLast }) => {
    // eslint-disable-next-line dot-notation
    const label = ACTION_LABELS[entry.action] || entry.action;
    const icon = getActionIcon(entry.action);

    // Process details for display
    let detailsContent: React.ReactNode = null;

    if (entry.details.length > 0) {
        // Unique details
        const uniqueDetails = Array.from(new Set(entry.details));

        if (uniqueDetails.length === 1) {
            // Only one unique detail, but maybe happened multiple times
            detailsContent = (
                <div className={styles['entry-detail']}>
                    {uniqueDetails[0]}
                    {entry.count > 1 && <span style={{ opacity: 0.7, marginLeft: 4 }}> (x{entry.count})</span>}
                </div>
            );
        } else {
            // Multiple different details (e.g. Workgroup A, Workgroup B)
            // Join them or list them?
            // User said: "show all the workgroup that are deleted"
            // Comma separated is clean.
            detailsContent = (
                <div className={styles['entry-detail']}>
                    {uniqueDetails.join(', ')}
                </div>
            );
        }
    } else if (entry.count > 1) {
        // No details, just count
        detailsContent = (
            <div className={styles['entry-detail-meta']}>
                {entry.count} events
            </div>
        );
    }

    return (
        <div className={styles['entry']}>
            <div className={styles['timeline-sidebar']}>
                <div className={styles['timeline-icon']}>
                    {icon}
                </div>
                {!isLast && <div className={styles['timeline-line']} />}
            </div>

            <div className={styles['entry-content']}>
                <div className={styles['entry-header']}>
                    <span className={styles['entry-user']}>{entry.user}</span>
                    {/* Added space */}
                    {' '}
                    <span className={styles['entry-action-label']}>{label}</span>
                </div>
                {detailsContent}
            </div>
        </div>
    );
};

// ─── Day Group ──────────────────────────────────────────────

const DayGroup: React.FC<{ log: DailyActivityLog }> = ({ log }) => {
    if (log.entries.length === 0) return null;

    const dateLabel = formatDate(log.date);
    const grouped = groupEntries(log.entries);

    return (
        <div className={styles['day-group']}>
            <div className={styles['day-header']}>{dateLabel}</div>
            <div className={styles['day-entries']}>
                {grouped.map((entry, i) => (
                    <EntryRow
                        key={i}
                        entry={entry}
                        isLast={i === grouped.length - 1}
                    />
                ))}
            </div>
        </div>
    );
};

// ─── Main Component ─────────────────────────────────────────

const ActivityLogPanel: React.FC<ActivityLogPanelProps> = ({ checklistId }) => {
    const [logs, setLogs] = React.useState<DailyActivityLog[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        let cancelled = false;
        setIsLoading(true);

        getActivityLogService()
            .getLog(checklistId, 30)
            .then(data => {
                if (!cancelled) setLogs(data);
            })
            .catch(err => console.error('[ActivityLog] Load failed:', err))
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => { cancelled = true; };
    }, [checklistId]);

    if (isLoading) {
        return (
            <div className={styles['activity-loading']}>
                <Spinner size={SpinnerSize.medium} label="Loading activity..." />
            </div>
        );
    }

    if (logs.length === 0 || logs.every(d => d.entries.length === 0)) {
        return (
            <div className={styles['activity-empty']}>
                <Clock20Regular className={styles['empty-icon']} />
                <p>No activity recorded yet</p>
            </div>
        );
    }

    return (
        <div className={styles['activity-container']}>
            <div className={styles['activity-list']}>
                {logs.map(day => (
                    <DayGroup key={day.id} log={day} />
                ))}
            </div>
        </div>
    );
};

// ─── Helpers ────────────────────────────────────────────────

function formatDate(dateStr: string): string {
    if (!dateStr) return '';

    // Attempt parse
    let d = new Date(dateStr);

    // Manual YYYY-MM-DD parsing to force local date
    if (dateStr.length === 10 && dateStr.charAt(4) === '-') {
        const [y, m, day] = dateStr.split('-').map(Number);
        d = new Date(y, m - 1, day);
    }

    if (isNaN(d.getTime())) return dateStr;

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Normalize to midnight
    const checkDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    const dateFormatted = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });

    // Helper for explicit date display
    const fullDate = d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    if (checkDate.getTime() === todayDate.getTime()) return `Today - ${dateFormatted}`;
    if (checkDate.getTime() === yesterdayDate.getTime()) return `Yesterday - ${dateFormatted}`;

    return fullDate;
}

export default ActivityLogPanel;
