import { dataverseClient, entities, col } from './dataverseService';

// ─── TYPES ──────────────────────────────────────────────────

export interface ActivityEntry {
    user: string;       // Display name
    action: string;     // Action key (e.g. 'row_updated')
    detail?: string;    // Context (e.g. workgroup name)
}

export interface DailyActivityLog {
    id: string;
    checklistId: string;
    date: string;       // YYYY-MM-DD
    entries: ActivityEntry[];
}

// ─── ACTION LABELS (for display) ────────────────────────────

export const ACTION_LABELS: Record<string, string> = {
    'row_updated': 'Updated rows in',
    'row_added': 'Added rows to',
    'row_deleted': 'Deleted rows from',
    'workgroup_added': 'Added workgroup',
    'workgroup_deleted': 'Deleted workgroup',
    'common_notes_updated': 'Modified common notes',
    'checklist_metadata_updated': 'Updated checklist details',
    'revision_created': 'Created revision',
    'file_uploaded': 'Uploaded file',
    'file_deleted': 'Deleted file',
    'comment_added': 'Added a comment',
};

// ─── DATAVERSE RESPONSE ─────────────────────────────────────

interface DataverseActivityLog {
    [key: string]: unknown;
    pap_activitylogid: string;
    pap_date: string;
    pap_entries?: string;
}

// ─── SERVICE ────────────────────────────────────────────────

export class ActivityLogService {

    /**
     * Log an action. Fire-and-forget — errors are silently logged.
     * Fetches today's row, appends entry, and upserts.
     */
    async logAction(checklistId: string, action: string, userName: string, detail?: string): Promise<void> {
        try {
            const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

            const entry: ActivityEntry = { user: userName, action };
            if (detail) entry.detail = detail;

            // Try to find today's row for this checklist
            const filter = `${col('date')} eq ${today} and _${col('checklistid')}_value eq '${checklistId}'`;
            const response = await dataverseClient.get<{ value: DataverseActivityLog[] }>(
                entities.activitylogs,
                `$filter=${filter}&$top=1`
            );

            if (response.value.length > 0) {
                // Update existing row — append entry
                const existing = response.value[0];
                const existingEntries: ActivityEntry[] = existing.pap_entries
                    ? JSON.parse(existing.pap_entries)
                    : [];

                // Deduplicate logic
                const isUpdateAction = ['common_notes_updated', 'checklist_metadata_updated'].includes(action);

                if (isUpdateAction) {
                    // For updates, only allow ONE entry per user per day
                    const hasExisting = existingEntries.some(e => e.action === action && e.user === userName);
                    if (hasExisting) return;
                } else {
                    // For others (comments, rows), just dedupe consecutive identical actions
                    const last = existingEntries[existingEntries.length - 1];
                    if (last.action === action && last.user === userName && last.detail === detail) {
                        return; // Skip duplicate
                    }
                }

                existingEntries.push(entry);

                await dataverseClient.update(
                    entities.activitylogs,
                    existing.pap_activitylogid,
                    { [col('entries')]: JSON.stringify(existingEntries) }
                );
            } else {
                // Create new row for today
                await dataverseClient.create(entities.activitylogs, {
                    [col('name')]: `Activity ${today}`,
                    [col('date')]: today,
                    [col('entries')]: JSON.stringify([entry]),
                    [`${col('checklistid')}@odata.bind`]: `/${entities.checklists}(${checklistId})`
                });
            }
        } catch (err) {
            // Fire-and-forget: never block the main operation
            console.error('[ActivityLog] Failed to log action:', err);
        }
    }

    /**
     * Fetch activity log entries for a checklist, most recent first.
     * Returns last 30 days of activity.
     */
    async getLog(checklistId: string, days: number = 30): Promise<DailyActivityLog[]> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = cutoff.toISOString().slice(0, 10);

        const filter = `_${col('checklistid')}_value eq '${checklistId}' and ${col('date')} ge ${cutoffStr}`;
        const select = [col('activitylogid'), col('date'), col('entries')].join(',');

        const response = await dataverseClient.get<{ value: DataverseActivityLog[] }>(
            entities.activitylogs,
            `$filter=${filter}&$select=${select}&$orderby=${col('date')} desc`
        );

        return response.value.map(dv => ({
            id: dv.pap_activitylogid,
            checklistId,
            date: dv.pap_date,
            entries: dv.pap_entries ? JSON.parse(dv.pap_entries) : []
        }));
    }
}
