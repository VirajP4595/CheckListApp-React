import { dataverseClient, entities, col, navprops } from './dataverseService';
import type { IChecklistService } from './interfaces';
import type { Checklist, Workgroup, ChecklistRow, AnswerState, ChecklistStatus } from '../models';

// ─── DATAVERSE RESPONSE TYPES ──────────────────────────────

interface DataverseChecklist {
    [key: string]: unknown;
    pap_checklistid: string;
    pap_name: string;
    pap_currentrevisionnumber: number;
    pap_status: number;  // Choice field (optionset)
    pap_clientcorrespondence?: string;
    pap_estimatetype?: string;
    pap_commonnotes?: string;
    _pap_jobid_value?: string;
    // Navigation property for Job lookup
    pap_jobid?: {
        pap_name: string;
        pap_clientname?: string;
        pap_number?: string;
    };
    createdon: string;
    modifiedon: string;
    // Navigation property - full relationship schema name
    // pap_workgroup_pap_checklist_pap_checklistid
    [key: `pap_workgroup_${string}`]: DataverseWorkgroup[] | undefined;
}

interface DataverseWorkgroup {
    [key: string]: unknown;
    pap_workgroupid: string;
    pap_name: string;
    pap_number: string;
    pap_order: number;
    pap_summarynotes?: string;
    _pap_checklistid_value: string;
    // Navigation property - full relationship schema name
    // pap_checklistrow_pap_workgroup_pap_workgroupid
    [key: `pap_checklistrow_${string}`]: DataverseRow[] | undefined;
}

interface DataverseRow {
    [key: string]: unknown;
    pap_checklistrowid: string;
    pap_description_primary?: string;       // Item Name
    pap_description?: string;
    pap_answer: number;  // Choice field
    pap_notes?: string;
    pap_markedforreview: boolean;
    pap_order: number;
    _pap_workgroupid_value: string;
}

// ─── MAPPERS: DATAVERSE → FRONTEND ─────────────────────────

const STATUS_MAP: Record<number, ChecklistStatus> = {
    1: 'draft',
    2: 'in-review',
    3: 'final'
};

const STATUS_VALUE_MAP: Record<ChecklistStatus, number> = {
    'draft': 1,
    'in-review': 2,
    'final': 3
};

const ANSWER_MAP: Record<number, AnswerState> = {
    1: 'YES',
    2: 'NO',
    3: 'BLANK',
    4: 'PS',
    5: 'PC',
    6: 'SUB',
    7: 'OTS'
};

const ANSWER_VALUE_MAP: Record<AnswerState, number> = {
    'YES': 1,
    'NO': 2,
    'BLANK': 3,
    'PS': 4,
    'PC': 5,
    'SUB': 6,
    'OTS': 7
};

function mapRow(dv: DataverseRow): ChecklistRow {
    return {
        id: dv.pap_checklistrowid,
        workgroupId: dv._pap_workgroupid_value,
        name: dv.pap_description_primary || '', // Map name
        description: dv.pap_description || '',
        answer: ANSWER_MAP[dv.pap_answer] || 'BLANK',
        notes: dv.pap_notes || '',
        markedForReview: dv.pap_markedforreview || false,
        images: [],  // Loaded separately from SharePoint
        order: dv.pap_order
    };
}

function mapWorkgroup(dv: DataverseWorkgroup): Workgroup {
    // Access child rows using the navigation property name from navprops
    const rows = (dv[navprops.workgroup_rows] as DataverseRow[] | undefined) || [];
    return {
        id: dv.pap_workgroupid,
        checklistId: dv._pap_checklistid_value,
        number: parseFloat(dv.pap_number) || 0,
        name: dv.pap_name,
        rows: rows.map(mapRow).sort((a, b) => a.order - b.order),
        summaryNotes: dv.pap_summarynotes,
        order: dv.pap_order
    };
}

function mapChecklist(dv: DataverseChecklist): Checklist {
    // Access child workgroups using the navigation property name from navprops
    const workgroups = (dv[navprops.checklist_workgroups] as DataverseWorkgroup[] | undefined) || [];

    // Map job details if expanded
    const jobDetails = dv.pap_jobid ? {
        jobName: dv.pap_jobid.pap_name,
        jobNumber: dv.pap_jobid.pap_number || '',
        clientName: dv.pap_jobid.pap_clientname || ''
    } : undefined;
    return {
        id: dv.pap_checklistid,
        // Prefer expanded job name as reference if available, otherwise just ID (or empty)
        jobReference: dv.pap_jobid?.pap_name || dv._pap_jobid_value || '',
        title: dv.pap_name,
        currentRevisionNumber: dv.pap_currentrevisionnumber || 0,
        status: STATUS_MAP[dv.pap_status] || 'draft',
        workgroups: workgroups.map(mapWorkgroup).sort((a, b) => a.order - b.order),
        revisions: [],  // Loaded separately
        clientCorrespondence: dv.pap_clientcorrespondence ? JSON.parse(dv.pap_clientcorrespondence) : [],
        estimateType: dv.pap_estimatetype ? JSON.parse(dv.pap_estimatetype) : [],
        commonNotes: dv.pap_commonnotes || '',
        comments: [],  // Loaded separately
        files: [],     // Loaded from SharePoint
        jobDetails: jobDetails,
        createdBy: '',
        createdAt: new Date(dv.createdon),
        updatedAt: new Date(dv.modifiedon)
    };
}

export class DataverseChecklistService implements IChecklistService {

    async getChecklist(id: string): Promise<Checklist> {
        // Load checklist first with Job expansion
        const select = [
            'pap_checklistid',
            'pap_name',
            'pap_currentrevisionnumber',
            'pap_status',
            'pap_clientcorrespondence',
            'pap_estimatetype',
            'pap_commonnotes',
            '_pap_jobid_value',
            'createdon',
            'modifiedon'
        ].join(',');

        // Expand Job to get details
        const expand = `pap_jobid($select=pap_name,pap_clientname,pap_number)`;

        const dv = await dataverseClient.getById<DataverseChecklist>(
            entities.checklists,
            id,
            select,
            expand
        );

        // Load workgroups separately using $filter
        const workgroupsResponse = await dataverseClient.get<{ value: DataverseWorkgroup[] }>(
            entities.workgroups,
            `$filter=_pap_checklistid_value eq ${id}&$orderby=${col('order')} asc`
        );

        // Load all rows for all workgroups in one query
        const workgroupIds = workgroupsResponse.value.map(wg => wg.pap_workgroupid);
        let allRows: DataverseRow[] = [];

        if (workgroupIds.length > 0) {
            // Build filter for all workgroup IDs
            const rowFilter = workgroupIds.map(wgId => `_pap_workgroupid_value eq ${wgId}`).join(' or ');

            // Explicitly select pap_description_primary to ensure it is returned
            const selectRows = [
                col('checklistrowid'),
                col('description_primary'),
                col('description'),
                col('answer'),
                col('notes'),
                col('markedforreview'),
                col('order'),
                `_${col('workgroupid')}_value`
            ].join(',');

            const rowsResponse = await dataverseClient.get<{ value: DataverseRow[] }>(
                entities.checklistrows,
                `$select=${selectRows}&$filter=${rowFilter}&$orderby=${col('order')} asc`
            );
            allRows = rowsResponse.value;
        }

        // Map workgroups with their rows
        const workgroups = workgroupsResponse.value.map(wg => {
            const wgRows = allRows.filter(r => r._pap_workgroupid_value === wg.pap_workgroupid);
            return {
                id: wg.pap_workgroupid,
                checklistId: wg._pap_checklistid_value,
                number: parseFloat(wg.pap_number) || 0,
                name: wg.pap_name,
                rows: wgRows.map(mapRow).sort((a, b) => a.order - b.order),
                summaryNotes: wg.pap_summarynotes,
                order: wg.pap_order
            };
        }).sort((a, b) => a.order - b.order);

        return {
            id: dv.pap_checklistid,
            jobReference: dv._pap_jobid_value || '',
            title: dv.pap_name,
            currentRevisionNumber: dv.pap_currentrevisionnumber || 0,
            status: STATUS_MAP[dv.pap_status] || 'draft',
            workgroups,
            revisions: [],
            clientCorrespondence: dv.pap_clientcorrespondence ? JSON.parse(dv.pap_clientcorrespondence) : [],
            estimateType: dv.pap_estimatetype ? JSON.parse(dv.pap_estimatetype) : [],
            commonNotes: dv.pap_commonnotes || '',
            comments: [],
            files: [],
            createdBy: '',
            createdAt: new Date(dv.createdon),
            updatedAt: new Date(dv.modifiedon)
        };
    }

    async getAllChecklists(): Promise<Checklist[]> {
        const select = [
            col('checklistid'),
            col('name'),
            col('status'),
            col('currentrevisionnumber'),
            col('clientcorrespondence'),
            col('estimatetype'), // Added as likely needed for card details
            'createdon',
            'modifiedon',
            `_${col('jobid')}_value`
        ].join(',');

        // Expand Job to get details
        const expand = `pap_jobid($select=pap_name,pap_clientname,pap_number)`;

        const response = await dataverseClient.get<{ value: DataverseChecklist[] }>(
            entities.checklists,
            `$select=${select}&$expand=${expand}&$orderby=modifiedon desc&$top=50`
        );
        return response.value.map(dv => mapChecklist(dv));
    }

    async saveChecklist(checklist: Checklist): Promise<void> {
        // Update checklist metadata
        await dataverseClient.update(entities.checklists, checklist.id, {
            [col('name')]: checklist.title,
            [col('status')]: STATUS_VALUE_MAP[checklist.status],
            [col('clientcorrespondence')]: JSON.stringify(checklist.clientCorrespondence),
            [col('estimatetype')]: JSON.stringify(checklist.estimateType),
            [col('commonnotes')]: checklist.commonNotes
        });

        // Update workgroups
        for (const wg of checklist.workgroups) {
            await dataverseClient.update(entities.workgroups, wg.id, {
                [col('name')]: wg.name,
                [col('number')]: String(wg.number),
                [col('order')]: wg.order,
                [col('summarynotes')]: wg.summaryNotes || ''
            });

            // Update rows
            for (const row of wg.rows) {
                await dataverseClient.update(entities.checklistrows, row.id, {
                    [col('description_primary')]: row.name, // Save name to description_primary
                    [col('description')]: row.description,
                    [col('answer')]: ANSWER_VALUE_MAP[row.answer],
                    [col('notes')]: row.notes,
                    [col('markedforreview')]: row.markedForReview,
                    [col('order')]: row.order
                });
            }
        }
    }

    async createChecklist(title: string, jobReferenceOrId: string): Promise<Checklist> {
        // Determine if arg is ID (GUID) or Reference
        const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobReferenceOrId);

        const data: any = {
            [col('name')]: title,
            [col('status')]: STATUS_VALUE_MAP['draft'],
            [col('currentrevisionnumber')]: 0,
            [col('clientcorrespondence')]: '[]',
            [col('estimatetype')]: '[]',
            [col('commonnotes')]: ''
        };

        if (isGuid) {
            // Bind to existing Job
            // Use entities.jobs (pap_jobs) to bind
            data[`${col('jobid')}@odata.bind`] = `/${entities.jobs}(${jobReferenceOrId})`;
        }

        // Create checklist record
        const created = await dataverseClient.create<DataverseChecklist>(entities.checklists, data);

        // Fetch default workgroups
        const defaults = await dataverseClient.get<{ value: any[] }>(
            entities.defaultworkgroups,
            `$filter=${col('isactive')} eq true&$orderby=${col('order')}`
        );

        // Fetch all default rows
        const defaultRowsRes = await dataverseClient.get<{ value: any[] }>(
            entities.defaultrows,
            `$filter=${col('isactive')} eq true&$orderby=${col('order')}`
        );
        const allDefaultRows = defaultRowsRes.value;

        for (const dwg of defaults.value) {
            // Create Workgroup
            const createdWg = await dataverseClient.create<{ pap_workgroupid: string }>(entities.workgroups, {
                [col('name')]: dwg[col('name')],
                [col('number')]: dwg[col('number')],
                [col('order')]: dwg[col('order')],
                [`${col('checklistid')}@odata.bind`]: `/${entities.checklists}(${created.pap_checklistid})`
            });

            // Find matching rows for this default workgroup
            // Assuming default row has lookup to default workgroup: pap_defaultworkgroupid
            const wgRows = allDefaultRows.filter(r => r[`_${col('defaultworkgroupid')}_value`] === dwg.pap_defaultworkgroupid);

            // Create Rows
            for (const row of wgRows) {
                await dataverseClient.create(entities.checklistrows, {
                    [col('description_primary')]: row[col('name')] || row[col('title')] || '', // Initialize name
                    [col('description')]: row[col('description')] || '', // Initialize description mapping
                    [col('answer')]: 3, // BLANK
                    [col('answer')]: 3, // BLANK
                    [col('order')]: row[col('order')],
                    [`${col('workgroupid')}@odata.bind`]: `/${entities.workgroups}(${createdWg.pap_workgroupid})`
                });
            }
        }

        // Return full checklist
        return this.getChecklist(created.pap_checklistid);
    }

    async deleteChecklist(id: string): Promise<void> {
        // Note: Cascade delete should be configured in Dataverse
        await dataverseClient.delete(entities.checklists, id);
    }
}
