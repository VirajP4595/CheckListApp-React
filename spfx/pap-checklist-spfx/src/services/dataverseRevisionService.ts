import { dataverseClient, entities, col } from './dataverseService';
import type { IRevisionService } from './interfaces';
import type { Revision, Checklist } from '../models';
import { DataverseChecklistService } from './dataverseChecklistService';

// ─── DATAVERSE RESPONSE TYPE ───────────────────────────────

interface DataverseRevision {
    pap_revisionid: string;
    pap_name: string;           // Title
    pap_number: number;
    pap_summary: string;        // Notes (rich text)
    pap_snapshotjson: string;
    _pap_checklistid_value: string;
    _createdby_value?: string;
    createdby?: { // Navigation Property
        fullname: string;
    };
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
        title: dv.pap_name || '',
        notes: dv.pap_summary || '',
        snapshot,
        createdBy: dv.createdby?.fullname || '',
        createdAt: new Date(dv.createdon)
    };
}

// ─── DATAVERSE REVISION SERVICE ────────────────────────────

export class DataverseRevisionService implements IRevisionService {
    private checklistService = new DataverseChecklistService();

    async createRevision(checklistId: string, title: string, notes: string): Promise<Revision> {
        // 1. Get current checklist state (WITH IMAGES)
        const checklist = await this.checklistService.getChecklist(checklistId, { includeImages: true });

        // 2. Get next revision number
        const revisions = await this.getRevisions(checklistId);
        const nextNumber = revisions.length > 0
            ? Math.max(...revisions.map(r => r.number)) + 1
            : 1;

        // 3. Prepare Snapshot JSON
        const snapshotData = JSON.stringify(checklist);
        const snapshotBlob = new Blob([snapshotData], { type: 'application/json' });

        // 4. Create Revision Record first
        const created = await dataverseClient.create<DataverseRevision>(entities.revisions, {
            [col('name')]: title,
            [col('number')]: nextNumber,
            [col('summary')]: notes,
            [`${col('checklistid')}@odata.bind`]: `/${entities.checklists}(${checklistId})`
        });

        console.log('[RevisionService] Created revision record:', created.pap_revisionid);

        // 5. Upload Snapshot File
        // Note: If this fails with 404, the pap_snapshotfile column may need to be provisioned in Dataverse OR there's a propagation delay
        let uploadSuccess = false;
        let attempts = 0;
        const maxAttempts = 3;

        while (!uploadSuccess && attempts < maxAttempts) {
            attempts++;
            try {
                if (attempts > 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between retries
                    console.log(`[RevisionService] Retrying upload (attempt ${attempts})...`);
                }

                console.log(`[RevisionService] Attempting upload: ID=${created.pap_revisionid}, Size=${snapshotBlob.size}`);

                await dataverseClient.uploadFile(
                    entities.revisions,
                    created.pap_revisionid,
                    col('snapshotfile'),
                    snapshotBlob
                );
                console.log('[RevisionService] Snapshot file uploaded successfully');
                uploadSuccess = true;
            } catch (uploadError: any) {
                console.warn(`[RevisionService] Upload attempt ${attempts} failed:`, uploadError);

                // Check if it was a false failure (file actually exists)
                try {
                    console.log('[RevisionService] Verifying if file was uploaded despite error...');
                    await dataverseClient.downloadFile(
                        entities.revisions,
                        created.pap_revisionid,
                        col('snapshotfile')
                    );

                    console.log('[RevisionService] Verification successful - file exists. Treating upload as success.');
                    uploadSuccess = true;
                    break;
                } catch (verifyError) {
                    // Verification failed, so file is genuinely not there (or not accessible)
                    console.log('[RevisionService] Verification confirmed file is missing/inaccessible.');
                }

                // If last attempt, log error but continue
                if (attempts === maxAttempts && !uploadSuccess) {
                    console.error('[RevisionService] Failed to upload snapshot file after multiple attempts:', uploadError);
                }
            }
        }

        // 6. Update checklist revision number
        await dataverseClient.update(entities.checklists, checklistId, {
            [col('currentrevisionnumber')]: nextNumber
        });

        // Return combined object
        return mapRevision({ ...created, pap_snapshotjson: snapshotData });
    }

    async getRevisions(checklistId: string): Promise<Revision[]> {
        // List revisions (Metadata only, minimal payload)
        const response = await dataverseClient.get<{ value: DataverseRevision[] }>(
            entities.revisions,
            `$filter=_${col('checklistid')}_value eq ${checklistId}&$orderby=${col('number')} desc&$select=${col('revisionid')},${col('name')},${col('number')},${col('summary')},createdon&$expand=createdby($select=fullname)`
        );

        return response.value.map(dv => ({
            id: dv.pap_revisionid,
            checklistId: checklistId,
            number: dv.pap_number,
            title: dv.pap_name || '',
            notes: dv.pap_summary || '',
            snapshot: {} as Checklist, // Empty snapshot for list view
            createdBy: dv.createdby?.fullname || '',
            createdAt: new Date(dv.createdon)
        }));
    }

    async getRevision(revisionId: string): Promise<Revision | null> {
        try {
            // 1. Get Metadata
            const dv = await dataverseClient.getById<DataverseRevision>(
                entities.revisions,
                revisionId,
                undefined,
                'createdby($select=fullname)'
            );

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
                title: dv.pap_name || '',
                notes: dv.pap_summary || '',
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
