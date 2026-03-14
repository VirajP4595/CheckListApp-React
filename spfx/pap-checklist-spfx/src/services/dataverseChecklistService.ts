import { dataverseClient, entities, col, navprops } from './dataverseService';
import type { IChecklistService } from './interfaces';
import { getImageService } from './serviceFactory';
import { DataverseRevisionService } from './dataverseRevisionService';
import type { Checklist, Workgroup, ChecklistRow, AnswerState, ChecklistStatus, Revision } from '../models';

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
    pap_clientlogourl?: string;
    pap_chatdata?: string;
    pap_ChatData?: string;
    pap_filedata?: string;
    pap_carpentrylabourimageurl?: string;
    pap_carpentrylabourdescription?: string;
    _pap_jobid_value?: string;
    // Navigation property for Job lookup
    pap_jobid?: {
        vin_name: string;
        _vin_account_value?: string;
        "_vin_account_value@OData.Community.Display.V1.FormattedValue"?: string;
        vin_jobnumber?: string;
        _vin_estimator_value?: string;
        "_vin_estimator_value@OData.Community.Display.V1.FormattedValue"?: string;
        _ownerid_value?: string;
        "_ownerid_value@OData.Community.Display.V1.FormattedValue"?: string;
        vin_duedate?: string;
        vin_jobtype?: number;
        "vin_jobtype@OData.Community.Display.V1.FormattedValue"?: string;
        vin_jobstartmtg?: boolean;
        vin_checklistchoice?: number | null;
        "vin_checklistchoice@OData.Community.Display.V1.FormattedValue"?: string;
        vin_checklistappointment?: string | null;
        // Job Metadata Header fields (TEMP column names — pending client confirmation)
        vin_buildarea?: string;          // TEMP: site address
        vin_qbeflagged?: boolean;        // QBE flagged yes/no
        vin_qbelow?: number | null;      // QBE low estimate
        vin_qbehigh?: number | null;     // QBE high estimate
        vin_dmodelsuited?: boolean | null; // TEMP: 3D model
    };
    createdby?: {
        fullname: string;
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
    _pap_revisionid_value?: string;     // Lookup to pap_revision
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
    pap_notifyadmin: boolean;
    pap_buildertoconfirm: boolean;
    pap_internalonly: boolean;
    pap_order: number;
    _pap_workgroupid_value: string;
}

// ─── MAPPERS: DATAVERSE → FRONTEND ─────────────────────────

function parseJsonField(val: string | undefined | null): any {
    if (!val) return [];
    try {
        const parsed = JSON.parse(val);
        // Handle double-encoding which can happen with Power Automate or manual edits
        if (typeof parsed === 'string') {
            try { return JSON.parse(parsed); } catch { return []; }
        }
        return parsed;
    } catch (e) {
        console.warn('[DataverseService] JSON Parse Error:', val);
        return [];
    }
}

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
    7: 'OTS',
    8: 'TBC',
    9: 'OPT_EXTRA',
    10: 'BUILDER_SPEC'
};

const ANSWER_VALUE_MAP: Record<AnswerState, number> = {
    'YES': 1,
    'NO': 2,
    'BLANK': 3,
    'PS': 4,
    'PC': 5,
    'SUB': 6,
    'OTS': 7,
    'TBC': 8,
    'OPT_EXTRA': 9,
    'BUILDER_SPEC': 10
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
        notifyAdmin: dv.pap_notifyadmin || false,
        builderToConfirm: dv.pap_buildertoconfirm || false,
        internalOnly: dv.pap_internalonly || false,
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
        revisionId: dv._pap_revisionid_value || undefined,
        number: parseFloat(dv.pap_number) || 0,
        name: dv.pap_name,
        rows: rows.map(mapRow).sort((a, b) => a.order - b.order),
        summaryNotes: dv.pap_summarynotes,
        order: dv.pap_order
    };
}

function mapChecklist(dv: DataverseChecklist): Checklist {
    // DEBUG: Inspect raw data for chat issues
    // console.log('[DataverseService] Mapping Checklist:', dv.pap_checklistid);
    // console.log('[DataverseService] Raw Chat Data:', dv.pap_chatdata);
    // console.log('[DataverseService] All Keys:', Object.keys(dv));

    // Access child workgroups using the navigation property name from navprops
    const workgroups = (dv[navprops.checklist_workgroups] as DataverseWorkgroup[] | undefined) || [];

    // Map job details if expanded
    const jobDetails = dv.pap_jobid ? {
        jobName: dv.pap_jobid.vin_name,
        jobNumber: dv.pap_jobid.vin_jobnumber || '',
        clientName: dv.pap_jobid["_vin_account_value@OData.Community.Display.V1.FormattedValue"] || '',
        leadEstimator: dv.pap_jobid["_vin_estimator_value@OData.Community.Display.V1.FormattedValue"] || '',
        reviewer: dv.pap_jobid["_ownerid_value@OData.Community.Display.V1.FormattedValue"] || '',
        dueDate: dv.pap_jobid.vin_duedate ? new Date(dv.pap_jobid.vin_duedate) : undefined,
        jobType: dv.pap_jobid["vin_jobtype@OData.Community.Display.V1.FormattedValue"] || '',
        meetingOccurred: dv.pap_jobid.vin_jobstartmtg ?? true, // Default to true if null/omitted
        checklistChoice: dv.pap_jobid["vin_checklistchoice@OData.Community.Display.V1.FormattedValue"] || dv.pap_jobid.vin_checklistchoice,
        appointmentDate: dv.pap_jobid.vin_checklistappointment ? new Date(dv.pap_jobid.vin_checklistappointment) : null,
        // Job Metadata Header fields (TEMP column names — pending client confirmation)
        builderName: dv.pap_jobid["_vin_account_value@OData.Community.Display.V1.FormattedValue"] || '', // TEMP: using client name
        siteAddress: dv.pap_jobid.vin_buildarea || '',  // TEMP: TBC
        qbeFlagged: dv.pap_jobid.vin_qbeflagged ?? false,
        qbeLow: dv.pap_jobid.vin_qbelow ?? null,
        qbeHigh: dv.pap_jobid.vin_qbehigh ?? null,
        engineering: null,   // TEMP: column unknown — TBC with client
        threeDModel: dv.pap_jobid.vin_dmodelsuited ?? null,  // TEMP: TBC
    } : undefined;
    return {
        id: dv.pap_checklistid,
        // Prefer expanded job name as reference if available, otherwise just ID (or empty)
        jobReference: dv.pap_jobid?.vin_name || dv._pap_jobid_value || '',
        title: dv.pap_name,
        currentRevisionNumber: dv.pap_currentrevisionnumber || 0,
        status: STATUS_MAP[dv.pap_status] || 'draft',
        workgroups: workgroups.map(mapWorkgroup).sort((a, b) => a.number - b.number),
        revisions: [],  // Loaded separately
        clientCorrespondence: parseJsonField(dv.pap_clientcorrespondence),
        estimateType: parseJsonField(dv.pap_estimatetype),
        commonNotes: dv.pap_commonnotes || '',
        // Try standard property, then fallback for case sensitivity
        comments: (() => {
            const raw = dv.pap_chatdata || (dv.pap_ChatData as unknown as string);
            const parsed = parseJsonField(raw);
            //console.log('[DataverseService] Parsed Comments:', parsed, 'From Raw:', raw);
            return parsed;
        })(),
        files: parseJsonField(dv.pap_filedata),
        carpentryLabourImageUrl: dv.pap_carpentrylabourimageurl,
        carpentryLabourDescription: dv.pap_carpentrylabourdescription,
        jobDetails: jobDetails,
        createdBy: dv.createdby?.fullname || '',
        createdAt: new Date(dv.createdon),
        updatedAt: new Date(dv.modifiedon)
    };
}

export class DataverseChecklistService implements IChecklistService {

    async getChecklist(id: string, options?: { includeImages?: boolean }): Promise<Checklist> {
        // Load checklist first with Job expansion
        const select = [
            col('checklistid'),
            col('name'),
            col('currentrevisionnumber'),
            col('status'),
            col('clientcorrespondence'),
            col('estimatetype'),
            col('commonnotes'),
            col('clientlogourl'),
            col('chatdata'),
            col('filedata'),
            col('carpentrylabourimageurl'),
            col('carpentrylabourdescription'),
            `_${col('jobid')}_value`,
            'createdon',
            'modifiedon'
        ].join(',');

        // Expand Job to get details
        const expand = `pap_jobid($select=vin_name,_vin_account_value,vin_jobnumber,_vin_estimator_value,_ownerid_value,vin_duedate,vin_jobtype,vin_jobstartmtg,vin_checklistchoice,vin_checklistappointment,vin_buildarea,vin_qbeflagged,vin_qbelow,vin_qbehigh,vin_dmodelsuited),createdby($select=fullname)`;

        const dv = await dataverseClient.getById<DataverseChecklist>(
            entities.checklists,
            id,
            select,
            expand
        );

        // Load workgroups separately using $filter
        const workgroupsResponse = await dataverseClient.get<{ value: DataverseWorkgroup[] }>(
            entities.workgroups,
            `$filter=_pap_checklistid_value eq '${id}'&$orderby=${col('order')} asc`
        );

        // Load all rows for all workgroups in one query
        const workgroupIds = workgroupsResponse.value.map(wg => wg.pap_workgroupid);
        let allRows: DataverseRow[] = [];

        if (workgroupIds.length > 0) {
            // Build filter for all workgroup IDs
            const rowFilter = workgroupIds.map(wgId => `_pap_workgroupid_value eq '${wgId}'`).join(' or ');

            // Explicitly select pap_description_primary to ensure it is returned
            const selectRows = [
                col('checklistrowid'),
                col('description_primary'),
                col('description'),
                col('answer'),
                col('notes'),
                col('markedforreview'),
                col('notifyadmin'),
                col('buildertoconfirm'),
                col('internalonly'),
                col('order'),
                `_${col('workgroupid')}_value`
            ].join(',');

            const rowsResponse = await dataverseClient.get<{ value: DataverseRow[] }>(
                entities.checklistrows,
                `$select=${selectRows}&$filter=${rowFilter}&$orderby=${col('order')} asc`
            );
            allRows = rowsResponse.value;
        }

        // Load images from SharePoint (CONDITIONAL)
        let checklistImages: any[] = [];
        if (options?.includeImages) {
            try {
                checklistImages = await getImageService().getAllImageMetadata(id);
            } catch (err) {
                console.warn('[DataverseService] Failed to load images from SharePoint', err);
            }
        }
        
        // Load Revisions from Dataverse (New Metadata Approach)
        let revisions: Revision[] = [];
        try {
            const revisionService = new DataverseRevisionService();
            revisions = await revisionService.getRevisions(id);
        } catch (err) {
            console.warn('[DataverseService] Failed to load revisions', err);
        }

        // Map workgroups with their rows and attach images
        const workgroups = workgroupsResponse.value.map(wg => {
            const wgRows = allRows.filter(r => r._pap_workgroupid_value === wg.pap_workgroupid);
            return {
                id: wg.pap_workgroupid,
                checklistId: wg._pap_checklistid_value,
                revisionId: wg._pap_revisionid_value || undefined,
                number: parseFloat(wg.pap_number) || 0,
                name: wg.pap_name,
                rows: wgRows.map(r => {
                    const row = mapRow(r);
                    // Attach images for this row
                    if (options?.includeImages) {
                        row.images = checklistImages.filter(img => img.rowId === row.id);
                    }
                    return row;
                }).sort((a, b) => a.order - b.order),
                summaryNotes: wg.pap_summarynotes,
                order: wg.pap_order
            };
        }).sort((a, b) => a.number - b.number);

        return {
            id: dv.pap_checklistid,
            jobReference: dv._pap_jobid_value || '',
            title: dv.pap_name,
            currentRevisionNumber: dv.pap_currentrevisionnumber || 0,
            status: STATUS_MAP[dv.pap_status] || 'draft',
            workgroups,
            revisions,
            clientCorrespondence: dv.pap_clientcorrespondence ? JSON.parse(dv.pap_clientcorrespondence) : [],
            estimateType: dv.pap_estimatetype ? JSON.parse(dv.pap_estimatetype) : [],
            commonNotes: dv.pap_commonnotes || '',
            clientLogoUrl: dv.pap_clientlogourl,
            jobDetails: dv.pap_jobid ? {
                jobName: dv.pap_jobid.vin_name,
                jobNumber: dv.pap_jobid.vin_jobnumber || '',
                clientName: dv.pap_jobid["_vin_account_value@OData.Community.Display.V1.FormattedValue"] || '',
                leadEstimator: dv.pap_jobid["_vin_estimator_value@OData.Community.Display.V1.FormattedValue"] || '',
                reviewer: dv.pap_jobid["_ownerid_value@OData.Community.Display.V1.FormattedValue"] || '',
                dueDate: dv.pap_jobid.vin_duedate ? new Date(dv.pap_jobid.vin_duedate) : undefined,
                jobType: dv.pap_jobid["vin_jobtype@OData.Community.Display.V1.FormattedValue"] || '',
                meetingOccurred: dv.pap_jobid.vin_jobstartmtg ?? true,
                checklistChoice: dv.pap_jobid["vin_checklistchoice@OData.Community.Display.V1.FormattedValue"] || dv.pap_jobid.vin_checklistchoice,
                appointmentDate: dv.pap_jobid.vin_checklistappointment ? new Date(dv.pap_jobid.vin_checklistappointment) : null
            } : undefined,
            comments: (() => {
                const raw = dv.pap_chatdata || (dv.pap_ChatData as unknown as string);
                return parseJsonField(raw);
            })(),
            files: parseJsonField(dv.pap_filedata),
            createdBy: '',
            createdAt: new Date(dv.createdon),
            updatedAt: new Date(dv.modifiedon)
        };
    }

    async getHydratedChecklist(id: string, onProgress?: (status: string, percent: number) => void): Promise<Checklist> {
        if (onProgress) onProgress('Retrieving all images...', 5);
        const fullChecklist = await this.getChecklist(id, { includeImages: true });

        // Identify all images that need downloading (those without a Data URL source)
        const allImages: { img: any, id: string }[] = [];
        fullChecklist.workgroups.forEach(wg => {
            wg.rows.forEach(r => {
                if (r.images) {
                    r.images.forEach(img => {
                        // We check for id because we need it to download from SharePoint.
                        // If source already starts with data: it's likely already hydrated.
                        if (img.id && (!img.source || !img.source.startsWith('data:'))) {
                            allImages.push({ img, id: img.id });
                        }
                    });
                }
            });
        });

        if (allImages.length > 0) {
            const batchSize = allImages.length;
            if (onProgress) onProgress(`Hydrating ${batchSize} images...`, 10);
            
            const imageService = getImageService();
            const CONCURRENCY_LIMIT = 5;
            let completed = 0;

            // Process in chunks to avoid overwhelming the browser/network
            for (let i = 0; i < allImages.length; i += CONCURRENCY_LIMIT) {
                const chunk = allImages.slice(i, i + CONCURRENCY_LIMIT);
                await Promise.all(chunk.map(async (item) => {
                    try {
                        const base64 = await imageService.downloadImageContent(item.id);
                        if (base64) {
                            // eslint-disable-next-line require-atomic-updates
                            item.img.source = base64;
                        }
                    } catch (e) {
                        console.warn(`[Hydration] Failed to download image ${item.id}`, e);
                    } finally {
                        completed++;
                        if (onProgress) {
                            const percent = 10 + Math.floor((completed / batchSize) * 85);
                            onProgress(`Hydrated ${completed}/${batchSize} images...`, percent);
                        }
                    }
                }));
            }
        }

        if (onProgress) onProgress('Finalizing Report Data...', 100);
        return fullChecklist;
    }

    async getAllChecklists(): Promise<Checklist[]> {
        const select = [
            col('checklistid'),
            col('name'),
            col('status'),
            col('currentrevisionnumber'),
            col('clientcorrespondence'),
            col('estimatetype'), // Added as likely needed for card details
            col('chatdata'),
            col('filedata'),
            'createdon',
            'modifiedon',
            `_${col('jobid')}_value`
        ].join(',');

        // Expand Job to get details
        const expand = `pap_jobid($select=vin_name,_vin_account_value,vin_jobnumber,_vin_estimator_value,_ownerid_value,vin_duedate,vin_jobtype,vin_jobstartmtg,vin_checklistchoice,vin_checklistappointment),createdby($select=fullname)`;

        const response = await dataverseClient.get<{ value: DataverseChecklist[] }>(
            entities.checklists,
            `$select=${select}&$expand=${expand}&$filter=statecode eq 0&$orderby=modifiedon desc&$top=50`
        );
        return response.value.map(dv => mapChecklist(dv));
    }

    async saveChecklist(checklist: Checklist): Promise<Checklist> {
        console.log(`[Dataverse] Saving Checklist Metadata: ${checklist.id}`);
        // Only update metadata, do not iterate children
        await dataverseClient.update(entities.checklists, checklist.id, {
            [col('name')]: checklist.title,
            [col('status')]: STATUS_VALUE_MAP[checklist.status],
            [col('clientcorrespondence')]: JSON.stringify(checklist.clientCorrespondence),
            [col('estimatetype')]: JSON.stringify(checklist.estimateType),
            [col('commonnotes')]: checklist.commonNotes,
            [col('clientlogourl')]: checklist.clientLogoUrl,
            [col('chatdata')]: JSON.stringify(checklist.comments || []),
            [col('filedata')]: JSON.stringify(checklist.files || []),
            [col('carpentrylabourimageurl')]: checklist.carpentryLabourImageUrl || null,
            [col('carpentrylabourdescription')]: checklist.carpentryLabourDescription || null
        });
        return checklist;
    }

    async deleteChecklist(id: string, onProgress?: (status: string, percent: number) => void): Promise<void> {
        console.log(`[Dataverse] Permanently Deleting Checklist: ${id}`);

        if (onProgress) onProgress('Locating workgroups...', 10);

        // 1. Get all workgroups for this checklist
        const workgroupsResponse = await dataverseClient.get<{ value: { pap_workgroupid: string }[] }>(
            entities.workgroups,
            `$filter=_pap_checklistid_value eq ${id}&$select=pap_workgroupid`
        );
        const workgroupIds = workgroupsResponse.value.map(wg => wg.pap_workgroupid);

        if (onProgress) onProgress(`Found ${workgroupIds.length} workgroups. Processing rows...`, 20);

        // 2. For each workgroup, get rows and delete
        let deletedWgs = 0;

        for (const wgId of workgroupIds) {
            if (onProgress) onProgress(`Deleting workgroup ${deletedWgs + 1} of ${workgroupIds.length}...`, 20 + Math.floor((deletedWgs / Math.max(workgroupIds.length, 1)) * 70));

            const rowsResponse = await dataverseClient.get<{ value: DataverseRow[] }>(
                entities.checklistrows,
                `$filter=_pap_workgroupid_value eq ${wgId}&$select=pap_checklistrowid`
            );
            const rowIds = rowsResponse.value.map(r => r.pap_checklistrowid);

            // Execute row deletions concurrently
            await Promise.all(rowIds.map(rId => dataverseClient.delete(entities.checklistrows, rId)));

            await dataverseClient.delete(entities.workgroups, wgId);
            deletedWgs++;
        }

        if (onProgress) onProgress('Deleting main checklist record...', 90);
        // 3. Delete checklist
        await dataverseClient.delete(entities.checklists, id);
        if (onProgress) onProgress('Deletion complete', 100);
    }

    // ─── WORKGROUP ACTIONS ──────────────────────────────────────────────

    async createWorkgroup(checklistId: string, number: number, name: string, revisionId?: string): Promise<Workgroup> {
        console.log(`[Dataverse] Creating Workgroup: "${name}" for Checklist: ${checklistId}`);
        
        const payload: Record<string, unknown> = {
            [col('name')]: name,
            [col('number')]: String(number),
            [col('order')]: number,
            [`${col('checklistid')}@odata.bind`]: `/${entities.checklists}(${checklistId})`
        };

        if (revisionId) {
            payload[`${col('revisionid')}@odata.bind`] = `/${entities.revisions}(${revisionId})`;
        }

        const result = await dataverseClient.create<{ pap_workgroupid: string }>(entities.workgroups, payload);

        console.log(`[Dataverse] Workgroup Created: ${result.pap_workgroupid}`);

        return {
            id: result.pap_workgroupid,
            checklistId: checklistId,
            revisionId: revisionId,
            number: number,
            name: name,
            rows: [],
            order: number,
            summaryNotes: ''
        };
    }

    async updateWorkgroup(workgroup: Workgroup): Promise<Workgroup> {
        console.log(`[Dataverse] Updating Workgroup: ${workgroup.id}`);
        await dataverseClient.update(entities.workgroups, workgroup.id, {
            [col('name')]: workgroup.name,
            [col('number')]: String(workgroup.number),
            [col('order')]: workgroup.order,
            [col('summarynotes')]: workgroup.summaryNotes || ''
        });
        return workgroup;
    }

    async deleteWorkgroup(workgroupId: string): Promise<void> {
        console.log(`[Dataverse] Deleting Workgroup: ${workgroupId}`);
        await dataverseClient.delete(entities.workgroups, workgroupId);
    }

    // ─── ROW ACTIONS ───────────────────────────────────────────────────

    async createRow(workgroupId: string, rowData: Partial<ChecklistRow>): Promise<ChecklistRow> {
        console.log(`[Dataverse] Creating Row in Workgroup: ${workgroupId}`);

        // Defaults
        const newRow: any = {
            [col('description_primary')]: rowData.name || 'New Item',
            [col('description')]: rowData.description || '',
            [col('answer')]: ANSWER_VALUE_MAP[rowData.answer || 'BLANK'],
            [col('notes')]: rowData.notes || '',
            [col('markedforreview')]: rowData.markedForReview || false,
            [col('notifyadmin')]: rowData.notifyAdmin || false,
            [col('buildertoconfirm')]: rowData.builderToConfirm || false,
            [col('internalonly')]: rowData.internalOnly || false,
            [col('order')]: rowData.order || 0,
            [`${col('workgroupid')}@odata.bind`]: `/${entities.workgroups}(${workgroupId})`
        };

        const result = await dataverseClient.create<DataverseRow>(entities.checklistrows, newRow);
        console.log(`[Dataverse] Row Created: ${result.pap_checklistrowid}`);

        // Return full Row object
        return {
            id: result.pap_checklistrowid,
            workgroupId: workgroupId,
            name: rowData.name || 'New Item',
            description: rowData.description || '',
            answer: rowData.answer || 'BLANK',
            notes: rowData.notes || '',
            markedForReview: rowData.markedForReview || false,
            notifyAdmin: rowData.notifyAdmin || false,
            builderToConfirm: rowData.builderToConfirm || false,
            internalOnly: rowData.internalOnly || false,
            images: [],
            order: rowData.order || 0
        };
    }

    async updateRow(row: ChecklistRow): Promise<ChecklistRow> {
        console.log(`[Dataverse] Updating Row: ${row.id}`);
        await dataverseClient.update(entities.checklistrows, row.id, {
            [col('description_primary')]: row.name,
            [col('description')]: row.description,
            [col('answer')]: ANSWER_VALUE_MAP[row.answer],
            [col('notes')]: row.notes,
            [col('markedforreview')]: row.markedForReview,
            [col('notifyadmin')]: row.notifyAdmin,
            [col('buildertoconfirm')]: row.builderToConfirm,
            [col('internalonly')]: row.internalOnly,
            [col('order')]: row.order
        });
        return row;
    }

    async deleteRow(rowId: string): Promise<void> {
        console.log(`[Dataverse] Deleting Row: ${rowId}`);
        await dataverseClient.delete(entities.checklistrows, rowId);
    }





}
