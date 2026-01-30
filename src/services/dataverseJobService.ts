import { dataverseClient, col } from './dataverseService';

// ─── TYPES ─────────────────────────────────────────────────

export interface DataverseJob {
    [key: string]: unknown;
    pap_jobid: string;
    pap_name: string;        // Primary name column (used as reference)
    pap_name: string;        // Primary name column (used as reference)
}

export interface Job {
    id: string;
    reference: string;
    name: string;
}

// ─── SERVICE ───────────────────────────────────────────────

export class DataverseJobService {

    /**
     * Get all active jobs
     */
    async getAllJobs(): Promise<Job[]> {
        // Only select columns that exist - pap_name is the primary column
        const select = `$select=${col('jobid')},${col('name')}`;
        const filter = `$filter=statecode eq 0`; // Active jobs only
        const order = `$orderby=${col('name')} desc`;

        try {
            const response = await dataverseClient.get<{ value: DataverseJob[] }>(
                'pap_jobs',
                `${select}&${filter}&${order}&$top=100`
            );

            return response.value.map(dv => ({
                id: dv.pap_jobid,
                reference: dv.pap_name || '',
                name: dv.pap_name || ''
            }));
        } catch (error) {
            console.error('Failed to fetch jobs:', error);
            throw error;
        }
    }
}

export const jobService = new DataverseJobService();

