import { dataverseClient, entities, col } from './dataverseService';
import type { IRevisionService } from './interfaces';
import type { Revision } from '../models';

// ─── DATAVERSE RESPONSE TYPE ───────────────────────────────

interface DataverseRevision {
    pap_revisionid: string;
    pap_name: string;           // Title
    pap_number: number;
    pap_summary: string;        // Notes (rich text)
    _pap_checklistid_value: string;
    _createdby_value?: string;
    createdby?: { // Navigation Property
        fullname: string;
    };
    createdon: string;
}

// ─── MAPPER ────────────────────────────────────────────────

function mapRevision(dv: DataverseRevision): Revision {
    return {
        id: dv.pap_revisionid,
        checklistId: dv._pap_checklistid_value,
        number: dv.pap_number,
        title: dv.pap_name || '',
        notes: dv.pap_summary || '',
        createdBy: dv.createdby?.fullname || '',
        createdAt: new Date(dv.createdon)
    };
}

// ─── DATAVERSE REVISION SERVICE ────────────────────────────

export class DataverseRevisionService implements IRevisionService {
    async createRevision(checklistId: string, title: string, notes: string): Promise<Revision> {
        // 1. Get next revision number
        const revisions = await this.getRevisions(checklistId);
        const nextNumber = revisions.length > 0
            ? Math.max(...revisions.map(r => r.number)) + 1
            : 1;

        // 2. Create Revision Record (Metadata only)
        const created = await dataverseClient.create<DataverseRevision>(entities.revisions, {
            [col('name')]: title,
            [col('number')]: nextNumber,
            [col('summary')]: notes,
            [`${col('checklistid')}@odata.bind`]: `/${entities.checklists}(${checklistId})`
        });

        console.log('[RevisionService] Created revision metadata record:', created.pap_revisionid);

        // 3. Update checklist revision number
        await dataverseClient.update(entities.checklists, checklistId, {
            [col('currentrevisionnumber')]: nextNumber
        });

        // Return combined object
        return mapRevision(created);
    }

    async updateRevision(revision: Revision): Promise<Revision> {
        const updated = await dataverseClient.update(entities.revisions, revision.id, {
            [col('name')]: revision.title,
            [col('summary')]: revision.notes
        });

        console.log('[RevisionService] Updated revision metadata:', revision.id);
        
        // Dataverse update returns 204 typically, so we just return the input or map if representation was requested.
        // DataverseClient.update is currently set to return null (204).
        // Let's assume the state passed in is what we want to reflect.
        return revision;
    }

    async getRevisions(checklistId: string): Promise<Revision[]> {
        // List revisions (Metadata only)
        const response = await dataverseClient.get<{ value: DataverseRevision[] }>(
            entities.revisions,
            `$filter=_${col('checklistid')}_value eq '${checklistId}'&$orderby=${col('number')} desc&$select=${col('revisionid')},${col('name')},${col('number')},${col('summary')},createdon&$expand=createdby($select=fullname)`
        );

        return response.value.map(mapRevision);
    }
}
