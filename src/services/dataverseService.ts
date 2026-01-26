import { getDataverseToken } from './authService';
import { AppConfig } from '../config/environment';

// ─── DATAVERSE HTTP CLIENT ─────────────────────────────────

const baseUrl = `${AppConfig.dataverse.url}${AppConfig.dataverse.apiPath}`;
const prefix = AppConfig.dataverse.publisherPrefix;

/**
 * Generic Dataverse Web API client with automatic token injection
 */
export class DataverseClient {

    private async getHeaders(): Promise<HeadersInit> {
        const token = await getDataverseToken();
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Prefer': 'return=representation'
        };
    }

    /**
     * GET request with OData support
     */
    async get<T>(entitySet: string, query?: string): Promise<T> {
        const url = query ? `${baseUrl}/${entitySet}?${query}` : `${baseUrl}/${entitySet}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: await this.getHeaders()
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Dataverse API Error (${entitySet}):`, errorBody);
            throw new Error(`GET ${entitySet} failed: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * GET single record by ID
     */
    async getById<T>(entitySet: string, id: string, select?: string, expand?: string): Promise<T> {
        let query = '';
        if (select) query += `$select=${select}`;
        if (expand) query += `${query ? '&' : ''}$expand=${expand}`;

        const url = query
            ? `${baseUrl}/${entitySet}(${id})?${query}`
            : `${baseUrl}/${entitySet}(${id})`;

        const response = await fetch(url, {
            method: 'GET',
            headers: await this.getHeaders()
        });

        if (!response.ok) {
            throw new Error(`GET ${entitySet}(${id}) failed: ${response.status}`);
        }

        return response.json();
    }

    /**
     * POST - Create new record
     */
    async create<T>(entitySet: string, data: object): Promise<T> {
        const response = await fetch(`${baseUrl}/${entitySet}`, {
            method: 'POST',
            headers: await this.getHeaders(),
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`POST ${entitySet} failed: ${response.status} - ${error}`);
        }

        return response.json();
    }

    /**
     * PATCH - Update existing record
     */
    async update(entitySet: string, id: string, data: object): Promise<void> {
        const response = await fetch(`${baseUrl}/${entitySet}(${id})`, {
            method: 'PATCH',
            headers: await this.getHeaders(),
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`PATCH ${entitySet}(${id}) failed: ${response.status} - ${error}`);
        }
    }

    /**
     * DELETE - Remove record
     */
    async delete(entitySet: string, id: string): Promise<void> {
        const response = await fetch(`${baseUrl}/${entitySet}(${id})`, {
            method: 'DELETE',
            headers: await this.getHeaders()
        });

        if (!response.ok) {
            throw new Error(`DELETE ${entitySet}(${id}) failed: ${response.status}`);
        }
    }

    /**
     * UPLOAD File to Dataverse File Column
     * PUT [Organization URI]/api/data/v9.0/[EntityPath]([RecordGuid])/[AttributeName]
     */
    async uploadFile(entitySet: string, id: string, attributeName: string, file: Blob): Promise<void> {
        // 1. Initialize Chunk Upload (Simplified to single shot for now if < 10MB)
        // For larger files, we need chunked upload. Let's start with direct PUT which supports up to 10MB usually? 
        // Docs say PUT is for single API call max 128MB.
        const url = `${baseUrl}/${entitySet}(${id})/${attributeName}`;

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${await getDataverseToken()}`,
                'Content-Type': 'application/octet-stream', // Generic binary
                'x-ms-file-name': `snapshot-${id}.json` // Optional hint
            },
            body: file
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`FILE UPLOAD failed: ${response.status} - ${error}`);
        }
    }

    /**
     * DOWNLOAD File from Dataverse File Column
     * GET [Organization URI]/api/data/v9.0/[EntityPath]([RecordGuid])/[AttributeName]/$value
     */
    async downloadFile(entitySet: string, id: string, attributeName: string): Promise<string> {
        const url = `${baseUrl}/${entitySet}(${id})/${attributeName}/$value`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${await getDataverseToken()}`
            }
        });

        if (!response.ok) {
            // 404 means no file content yet
            if (response.status === 404) return '';
            throw new Error(`FILE DOWNLOAD failed: ${response.status}`);
        }

        return response.text();
    }
}

// ─── SINGLETON INSTANCE ────────────────────────────────────

export const dataverseClient = new DataverseClient();

// ─── HELPER: Entity Name Builder ───────────────────────────

export const entities = {
    checklists: `${prefix}checklists`,
    workgroups: `${prefix}workgroups`,
    checklistrows: `${prefix}checklistrows`,
    revisions: `${prefix}revisions`,
    comments: `${prefix}comments`,
    jobs: `${prefix}jobs`,
    defaultworkgroups: `${prefix}defaultworkgroups`,
    defaultrows: `${prefix}defaultrows`
};

// Navigation property names for $expand queries
// Based on provision script line 303: $relSchema = "${tableSchema}_${targetSchema}_${colSchema}"
// Pattern: {referencing_table}_{referenced_table}_{lookup_column}
export const navprops = {
    // From Checklist: expand to child Workgroups
    // Relationship: pap_workgroup_pap_checklist_pap_checklistid
    checklist_workgroups: `${prefix}workgroup_${prefix}checklist_${prefix}checklistid`,
    // From Workgroup: expand to child Rows  
    // Relationship: pap_checklistrow_pap_workgroup_pap_workgroupid
    workgroup_rows: `${prefix}checklistrow_${prefix}workgroup_${prefix}workgroupid`,
    // From Checklist: expand to Revisions
    checklist_revisions: `${prefix}revision_${prefix}checklist_${prefix}checklistid`,
    // From Default Workgroup: expand to Default Rows
    defaultworkgroup_rows: `${prefix}defaultrow_${prefix}defaultworkgroup_${prefix}defaultworkgroupid`
};

// Column name helper
export function col(name: string): string {
    return `${prefix}${name}`;
}
