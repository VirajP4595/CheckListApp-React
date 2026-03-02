import { dataverseClient, col } from './dataverseService';

// ─── TYPES ─────────────────────────────────────────────────

export interface DataverseJob {
    [key: string]: unknown;
    pap_jobid: string;
    pap_name: string;        // Primary name column (used as reference)

}

export interface Job {
    id: string;
    reference: string;
    name: string;
    jobType: string;
}

// ─── SERVICE ───────────────────────────────────────────────

export class DataverseJobService {

    /**
     * Get all active jobs
     */
    async getAllJobs(): Promise<Job[]> {
        const select = `$select=vin_jobid,vin_name,vin_jobnumber,vin_jobtype`;
        const filter = `$filter=statecode eq 0`; // Active jobs only
        const order = `$orderby=vin_name desc`;

        try {
            const response = await dataverseClient.get<{ value: any[] }>(
                'vin_jobs',
                `${select}&${filter}&${order}&$top=500`
            );

            return response.value.map(dv => ({
                id: dv.vin_jobid,
                reference: dv.vin_jobnumber || '',
                name: dv.vin_name || '',
                jobType: dv['vin_jobtype@OData.Community.Display.V1.FormattedValue'] || ''
            }));
        } catch (error) {
            console.error('Failed to fetch jobs:', error);
            throw error;
        }
    }

    /**
     * TEMPORARY: Discover all fields on a Job record to find logical names for UAT Feedback items.
     */
    /*
    async discoverJobFields(): Promise<Record<string, unknown>> {
        try {
            const response = await dataverseClient.get<{ value: DataverseJob[] }>(
                'vin_jobs',
                '$top=1' // No $select to fetch all columns
            );
            if (response.value && response.value.length > 0) {
                const job = response.value[0];
                console.log('--- [UAT Debug] JOB FIELDS DISCOVERY ---');
                console.log('ALL KEYS:', JSON.stringify(Object.keys(job), null, 2));
                console.log('FULL JOB DATA:', job);
                return job;
            }
            return {};
        } catch (error) {
            console.error('Failed to discover job fields:', error);
            return {};
        }
    }
    */
}

export const jobService = new DataverseJobService();

