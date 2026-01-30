import { AadHttpClient, HttpClientResponse, IHttpClientOptions } from '@microsoft/sp-http';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { AppConfig } from '../config/environment';

export class DataverseClient {
    private client: AadHttpClient | null = null;
    private context: WebPartContext | null = null;

    public async initialize(context: WebPartContext): Promise<void> {
        this.context = context;
        // The resource URL (Dynamics Org URL) is the scope for the token
        this.client = await context.aadHttpClientFactory.getClient(AppConfig.dataverse.url);
        console.log('[DataverseClient] Initialized with SPFx Context');
    }

    private get baseUrl(): string {
        return `${AppConfig.dataverse.url}${AppConfig.dataverse.apiPath}`;
    }

    private async getHeaders(): Promise<Headers> {
        const headers = new Headers();
        headers.append('Content-Type', 'application/json');
        headers.append('OData-MaxVersion', '4.0');
        headers.append('OData-Version', '4.0');
        headers.append('Prefer', 'return=representation');
        return headers;
    }

    private async request(method: string, relativeUrl: string, body?: any, isBinary: boolean = false): Promise<any> {
        if (!this.client) {
            throw new Error('DataverseClient not initialized. Call initialize(context) first.');
        }

        const url = `${this.baseUrl}/${relativeUrl}`;
        const headers = await this.getHeaders();

        const options: IHttpClientOptions = {
            method: method,
            headers: headers,
            body: body ? (isBinary ? body : JSON.stringify(body)) : undefined
        };

        if (isBinary) {
            headers.delete('Content-Type'); // Let browser set boundary if needed, or specific type
            headers.append('Content-Type', 'application/octet-stream');
        }

        const response: HttpClientResponse = await this.client.fetch(url, AadHttpClient.configurations.v1, options);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Dataverse Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        // Handle 204 No Content
        if (response.status === 204) {
            return null;
        }

        // Handle binary download
        if (relativeUrl.endsWith('/$value')) {
            return await response.text(); // Or Blob if needed, existing service expects text/base64? Existing service expected text from response.text()
        }

        return await response.json();
    }

    // ─── PUBLIC API (Matching previous interface) ──────────────────────────

    async get<T>(entitySet: string, query?: string): Promise<T> {
        const q = query ? `?${query}` : '';
        return this.request('GET', `${entitySet}${q}`);
    }

    async getById<T>(entitySet: string, id: string, select?: string, expand?: string): Promise<T> {
        const params: string[] = [];
        if (select) params.push(`$select=${select}`);
        if (expand) params.push(`$expand=${expand}`);
        const q = params.length > 0 ? `?${params.join('&')}` : '';
        return this.request('GET', `${entitySet}(${id})${q}`);
    }

    async create<T>(entitySet: string, data: object): Promise<T> {
        return this.request('POST', entitySet, data);
    }

    async update(entitySet: string, id: string, data: object): Promise<void> {
        return this.request('PATCH', `${entitySet}(${id})`, data);
    }

    async delete(entitySet: string, id: string): Promise<void> {
        return this.request('DELETE', `${entitySet}(${id})`);
    }

    async uploadFile(entitySet: string, id: string, attributeName: string, file: Blob): Promise<void> {
        // Existing service used PUT for uploading
        return this.request('PUT', `${entitySet}(${id})/${attributeName}`, file, true);
    }

    async downloadFile(entitySet: string, id: string, attributeName: string): Promise<string> {
        return this.request('GET', `${entitySet}(${id})/${attributeName}/$value`);
    }
}

export const dataverseClient = new DataverseClient();

// ─── HELPERS ──────────────────────────────────────────────────────────────
const prefix = AppConfig.dataverse.publisherPrefix;

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

export const navprops = {
    checklist_workgroups: `${prefix}workgroup_${prefix}checklist_${prefix}checklistid`,
    workgroup_rows: `${prefix}checklistrow_${prefix}workgroup_${prefix}workgroupid`,
    checklist_revisions: `${prefix}revision_${prefix}checklist_${prefix}checklistid`,
    defaultworkgroup_rows: `${prefix}defaultrow_${prefix}defaultworkgroup_${prefix}defaultworkgroupid`
};

export function col(name: string): string {
    return `${prefix}${name}`;
}
