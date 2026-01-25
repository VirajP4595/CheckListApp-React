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
        // Get current checklist state for snapshot
        const checklist = await this.checklistService.getChecklist(checklistId);

        // Get next revision number
        const revisions = await this.getRevisions(checklistId);
        const nextNumber = revisions.length > 0
            ? Math.max(...revisions.map(r => r.number)) + 1
            : 1;

        // Create revision with JSON snapshot
        const created = await dataverseClient.create<DataverseRevision>(entities.revisions, {
            [col('number')]: nextNumber,
            [col('summary')]: summary,
            [col('snapshotjson')]: JSON.stringify(checklist),
            [`${col('checklistid')}@odata.bind`]: `/${entities.checklists}(${checklistId})`
        });

        // Update checklist revision number
        await dataverseClient.update(entities.checklists, checklistId, {
            [col('currentrevisionnumber')]: nextNumber
        });

        return mapRevision(created);
    }

    async getRevisions(checklistId: string): Promise<Revision[]> {
        const response = await dataverseClient.get<{ value: DataverseRevision[] }>(
            entities.revisions,
            `$filter=_${col('checklistid')}_value eq ${checklistId}&$orderby=${col('number')} desc`
        );
        return response.value.map(mapRevision);
    }

    async getRevision(revisionId: string): Promise<Revision | null> {
        try {
            const dv = await dataverseClient.getById<DataverseRevision>(entities.revisions, revisionId);
            return mapRevision(dv);
        } catch {
            return null;
        }
    }
}
