import { dataverseClient, entities, col } from './dataverseService';
import type { IRevisionService } from './interfaces';
import type { Revision, Checklist } from '../models';
import { DataverseChecklistService } from './dataverseChecklistService';

// ─── DATAVERSE RESPONSE TYPE ───────────────────────────────

interface DataverseRevision {
    pap_revisionid: string;
    pap_number: number;
    pap_summary: string;
    pap_snapshotjson: string;
    _pap_checklistid_value: string;
    _createdby_value?: string;
    createdon: string;
}

// ─── MAPPER ────────────────────────────────────────────────

function mapRevision(dv: DataverseRevision): Revision {
    let snapshot: Checklist;
    try {
        snapshot = JSON.parse(dv.pap_snapshotjson);
    } catch {
        snapshot = {} as Checklist;
    }

    return {
        id: dv.pap_revisionid,
        checklistId: dv._pap_checklistid_value,
        number: dv.pap_number,
        summary: dv.pap_summary,
        snapshot,
        createdBy: dv._createdby_value || '',
        createdAt: new Date(dv.createdon)
    };
}

// ─── DATAVERSE REVISION SERVICE ────────────────────────────

export class DataverseRevisionService implements IRevisionService {
    private checklistService = new DataverseChecklistService();

    async createRevision(checklistId: string, summary: string): Promise<Revision> {
        // 1. Get current checklist state (WITH IMAGES)
        const checklist = await this.checklistService.getChecklist(checklistId, { includeImages: true });

        // 2. Get next revision number
        const revisions = await this.getRevisions(checklistId);
        const nextNumber = revisions.length > 0
            ? Math.max(...revisions.map(r => r.number)) + 1
            : 1;

        // 3. Prepare Snapshot Blob
        // Create deep copy to detach from current state reference
        const snapshotData = JSON.stringify(checklist);
        const snapshotBlob = new Blob([snapshotData], { type: 'application/json' });

        // 4. Create Revision Record (Empty File initially)
        // We must create the record first to get an ID for the file upload
        const created = await dataverseClient.create<DataverseRevision>(entities.revisions, {
            [col('number')]: nextNumber,
            [col('summary')]: summary,
            // [col('snapshotjson')]: null, // No longer string field
            [`${col('checklistid')}@odata.bind`]: `/${entities.checklists}(${checklistId})`
        });

        // 5. Upload Snapshot File
        await dataverseClient.uploadFile(
            entities.revisions,
            created.pap_revisionid,
            col('snapshotfile'),
            snapshotBlob
        );

        // 6. Update checklist revision number
        await dataverseClient.update(entities.checklists, checklistId, {
            [col('currentrevisionnumber')]: nextNumber
        });

        // Return combined object (we know the snapshot we just saved)
        return mapRevision({ ...created, pap_snapshotjson: snapshotData });
    }

    async getRevisions(checklistId: string): Promise<Revision[]> {
        // List revisions (Metadata only, minimal payload)
        // Note: We do NOT download the file content here for list view to save bandwidth
        const response = await dataverseClient.get<{ value: DataverseRevision[] }>(
            entities.revisions,
            `$filter=_${col('checklistid')}_value eq ${checklistId}&$orderby=${col('number')} desc&$select=${col('revisionid')},${col('number')},${col('summary')},createdon`
        );

        return response.value.map(dv => ({
            id: dv.pap_revisionid,
            checklistId: checklistId,
            number: dv.pap_number,
            summary: dv.pap_summary,
            snapshot: {} as Checklist, // Empty snapshot for list view
            createdBy: '', // Expand if needed
            createdAt: new Date(dv.createdon)
        }));
    }

    async getRevision(revisionId: string): Promise<Revision | null> {
        try {
            // 1. Get Metadata
            const dv = await dataverseClient.getById<DataverseRevision>(entities.revisions, revisionId);

            // 2. Download Snapshot File
            const jsonContent = await dataverseClient.downloadFile(
                entities.revisions,
                revisionId,
                col('snapshotfile')
            );

            // 3. Merge
            // Fake the old string property for the mapper, or update mapper
            // Let's reuse mapper logic if possible or just parse here
            let snapshot: Checklist = {} as Checklist;
            if (jsonContent) {
                snapshot = JSON.parse(jsonContent);
            }

            return {
                id: dv.pap_revisionid,
                checklistId: dv._pap_checklistid_value,
                number: dv.pap_number,
                summary: dv.pap_summary,
                snapshot: snapshot,
                createdBy: dv._createdby_value || '',
                createdAt: new Date(dv.createdon)
            };

        } catch (err) {
            console.error('Failed to load revision', err);
            return null;
        }
    }
}
