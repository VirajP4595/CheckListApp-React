import { MSGraphClientV3 } from '@microsoft/sp-http';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { AppConfig } from '../config/environment';
import type { IImageService, ChecklistFileResult } from './interfaces';
import type { ChecklistImage } from '../models';

// ─── HELPER: RESIZE IMAGE ──────────────────────────────────
async function resizeImage(source: string, maxWidth: number, maxHeight: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = width * ratio;
                height = height * ratio;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas context not available'));
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Canvas toBlob failed'));
            }, 'image/jpeg', 0.8);
        };
        img.onerror = (err) => reject(err);
        img.src = source;
    });
}

// ─── SHAREPOINT SERVICE ────────────────────────────────────

export class SharePointImageService implements IImageService {
    private client: MSGraphClientV3 | undefined;
    private driveInfoCache: { siteId: string; driveId: string; listId: string } | undefined;
    private context: WebPartContext | undefined;

    public async initialize(context: WebPartContext): Promise<void> {
        this.context = context;
        this.client = await context.msGraphClientFactory.getClient('3');
        console.log('[SharePointService] Initialized with SPFx Context');
    }

    private getClient(): MSGraphClientV3 {
        if (!this.client) throw new Error("SharePointService not initialized. Call initialize(context) first.");
        return this.client;
    }

    private async getDriveInfo(): Promise<{ siteId: string; driveId: string; listId: string }> {
        if (this.driveInfoCache) return this.driveInfoCache;

        const client = this.getClient();

        // Parse site URL to get host and path
        const url = new URL(AppConfig.sharepoint.absoluteUrl);
        const hostName = url.hostname;
        const sitePath = url.pathname;

        // Get site ID
        const site = await client.api(`/sites/${hostName}:${sitePath}`).get();

        // Get drive (library) ID
        const drives = await client.api(`/sites/${site.id}/drives`).get();

        const libraryName = AppConfig.sharepoint.documentLibrary;
        const library = drives.value.find((d: { name: string, webUrl: string, id: string }) =>
            d.name === libraryName ||
            decodeURIComponent(d.webUrl).endsWith(`/${libraryName}`)
        );

        if (!library) {
            throw new Error(`Library "${libraryName}" not found.`);
        }

        // Get list ID associated with this drive for filtered queries
        const list = await client.api(`/sites/${site.id}/drives/${library.id}/list`).select('id').get();

        this.driveInfoCache = { siteId: site.id, driveId: library.id, listId: list.id };
        return this.driveInfoCache;
    }

    async addImage(checklistId: string, _workgroupId: string, rowId: string, source: string, caption?: string): Promise<ChecklistImage> {
        const { driveId } = await this.getDriveInfo();
        const client = this.getClient();

        // 1. Resize
        let blob: Blob;
        try {
            blob = await resizeImage(source, 1920, 1080);
        } catch (error) {
            console.warn('[SharePoint] Resize failed, using original', error);
            const response = await fetch(source);
            blob = await response.blob();
        }

        const filename = `image-${Date.now()}.jpg`;
        const folderPath = `${checklistId}/images/${rowId}`;
        const uploadUrl = `/drives/${driveId}/root:/${folderPath}/${filename}:/content`;

        // 2. Upload
        const file = await client.api(uploadUrl).put(blob);

        // 3. Update Metadata
        try {
            // NOTE: The property names here MUST match the exact Internal Column Names in SharePoint.
            // If they were created with spaces (e.g. "Checklist ID"), the internal name might be "Checklist_x0020_ID" or similar.
            await client.api(`/drives/${driveId}/items/${file.id}/listItem/fields`).patch({
                Checklist_x0020_ID: checklistId,
                Row_x0020_ID: rowId,
                Caption: caption || filename,
                Title: caption || filename
            });
        } catch (e) {
            console.warn('[SharePoint] Metadata update failed', e);
        }

        return {
            id: file.id,
            rowId,
            caption: caption || '',
            source: file['@microsoft.graph.downloadUrl'] || file.webUrl,
            order: Date.now()
        };
    }

    async getRowImages(checklistId: string, rowId: string): Promise<ChecklistImage[]> {
        const { driveId } = await this.getDriveInfo();
        const client = this.getClient();

        try {
            const folderPath = `${checklistId}/images/${rowId}`;
            const response = await client.api(`/drives/${driveId}/root:/${folderPath}:/children`)
                .select('id,name,webUrl,thumbnails,@microsoft.graph.downloadUrl')
                .expand('thumbnails')
                .get();

            interface GraphDriveItem {
                id: string;
                name: string;
                webUrl: string;
                activeChecklist: string;
                thumbnails?: { large?: { url: string }, medium?: { url: string } }[];
                '@microsoft.graph.downloadUrl'?: string;
            }

            return (response.value || []).map((item: GraphDriveItem) => ({
                id: item.id,
                rowId: rowId,
                caption: item.name,
                source: item['@microsoft.graph.downloadUrl'] || item.webUrl,
                thumbnailUrl: item.thumbnails?.[0]?.large?.url || item.thumbnails?.[0]?.medium?.url || item['@microsoft.graph.downloadUrl'],
                order: 0
            }));
        } catch {
            // 404 is expected if no folder
            return [];
        }
    }

    async listImageFolders(checklistId: string): Promise<string[]> {
        const { driveId } = await this.getDriveInfo();
        const client = this.getClient();

        try {
            const folderPath = `${checklistId}/images`;
            const response = await client.api(`/drives/${driveId}/root:/${folderPath}:/children`)
                .select('name,folder')
                .get();

            return (response.value || [])
                .filter((item: { folder?: any; name: string }) => item.folder)
                .map((item: { name: string }) => item.name);
        } catch {
            return [];
        }
    }

    async uploadFile(checklistId: string, file: File): Promise<ChecklistFileResult> {
        const { driveId } = await this.getDriveInfo();
        const client = this.getClient();

        // 1. Determine path
        const folderPath = `${checklistId}/attachments`;
        const uploadUrl = `/drives/${driveId}/root:/${folderPath}/${file.name}:/content`;

        // 2. Upload
        const data = await client.api(uploadUrl).put(file);

        // 3. Return metadata needed for ChecklistFile
        return {
            id: data.id, // Use SharePoint Item ID
            name: file.name,
            url: data['@microsoft.graph.downloadUrl'] || data.webUrl,
            serverRelativeUrl: data.webUrl // Store webUrl as fallback
        };
    }

    async getAllImageMetadata(checklistId: string): Promise<ChecklistImage[]> {
        const { siteId, listId } = await this.getDriveInfo();
        const client = this.getClient();

        try {
            // Fetch all items in the list where Checklist ID matches.
            // We MUST expand driveItem to get the real Graph drive item ID (a GUID).
            // item.id is the SharePoint list item ID (numeric string like "61") and CANNOT
            // be used with /drives/{driveId}/items/{id}/content — that requires the GUID.
            // We omit $select on driveItem so that @microsoft.graph.downloadUrl annotation
            // is included in the response — this is a pre-signed Azure Blob URL that can be
            // fetched directly without hitting Graph/SharePoint throttling quotas.
            const response = await client.api(`/sites/${siteId}/lists/${listId}/items`)
                .expand('fields($select=Checklist_x0020_ID,Row_x0020_ID,Caption),driveItem')
                .filter(`fields/Checklist_x0020_ID eq '${checklistId}'`)
                .get();

            if (!response.value || response.value.length === 0) return [];

            return response.value
                .filter((item: any) => item.driveItem?.id) // Only include items with a valid drive ID
                .map((item: any) => {
                    const fields = item.fields;
                    const driveItemId = item.driveItem.id; // This is the real GUID for Graph API calls
                    // Prefer the pre-signed Azure Blob URL (@microsoft.graph.downloadUrl) —
                    // fetching it bypasses Graph throttling entirely (goes direct to storage).
                    // Fall back to the SharePoint download URL if the annotation is absent.
                    const presignedUrl: string | undefined = item.driveItem?.['@microsoft.graph.downloadUrl'];
                    return {
                        id: driveItemId,
                        rowId: fields?.Row_x0020_ID || '',
                        caption: fields?.Caption || fields?.Title || '',
                        source: presignedUrl
                            || `${AppConfig.sharepoint.absoluteUrl}/_layouts/15/download.aspx?UniqueId=${driveItemId}`,
                        order: 0
                    };
                });
        } catch (error) {
            console.warn('[SharePoint] getAllImageMetadata failed', error);
            return [];
        }
    }

    async downloadImagesBatch(itemIds: string[]): Promise<Map<string, string>> {
        const { driveId } = await this.getDriveInfo();
        const client = this.getClient();
        const resultMap = new Map<string, string>();

        if (itemIds.length === 0) return resultMap;

        // Microsoft Graph $batch supports up to 20 requests per batch
        const CHUNK_SIZE = 20;
        for (let i = 0; i < itemIds.length; i += CHUNK_SIZE) {
            const chunk = itemIds.slice(i, i + CHUNK_SIZE);
            
            const batchRequest = {
                requests: chunk.map((id, index) => ({
                    id: String(index),
                    method: 'GET',
                    url: `/drives/${driveId}/items/${id}/content`
                }))
            };

            try {
                const batchResponse = await client.api('/$batch').post(batchRequest);
                
                for (const response of batchResponse.responses) {
                    const originalId = chunk[parseInt(response.id)];
                    if (response.status === 200 || response.status === 302) {
                        // For images, the batch response usually contains the body as base64 if it's small,
                        // or a redirect. But wait, Graph $batch with /content usually returns the content
                        // directly if requested correctly.
                        
                        // However, SPFx MSGraphClient handles responses. 
                        // If it's a binary response in a batch, it might be complex.
                        
                        // ALTERNATIVE: Batch the retrieval of @microsoft.graph.downloadUrl 
                        // as that's faster than 20 individual metadata calls.
                        // Then fetch the URLs.
                        
                        // Let's stick to the current plan but handle the response.
                        if (response.body) {
                            // Convert response body to data URL
                            // Note: In MS Graph $batch, binary content is base64 encoded in the 'body' property if it's not too large.
                            resultMap.set(originalId, `data:image/jpeg;base64,${response.body}`);
                        }
                    }
                }
            } catch (err) {
                console.warn('[SharePoint] Batch download chunk failed', err);
            }
        }

        return resultMap;
    }

    async removeImage(imageId: string): Promise<void> {
        const { driveId } = await this.getDriveInfo();
        await this.getClient().api(`/drives/${driveId}/items/${imageId}`).delete();
    }

    async updateCaption(imageId: string, caption: string): Promise<void> {
        const { driveId } = await this.getDriveInfo();
        await this.getClient().api(`/drives/${driveId}/items/${imageId}/listItem/fields`).patch({
            Caption: caption,
            Title: caption
        });
    }

    async uploadClientLogo(checklistId: string, file: File): Promise<string> {
        const { driveId } = await this.getDriveInfo();
        const folderPath = `${encodeURIComponent(checklistId.trim())}/branding`;
        const filename = 'logo.png';
        const uploadUrl = `/drives/${driveId}/root:/${folderPath}/${filename}:/content`;

        const data = await this.getClient().api(uploadUrl).put(file);
        return data['@microsoft.graph.downloadUrl'] || data.webUrl;
    }

    async uploadCarpentryImage(checklistId: string, file: File): Promise<string> {
        const { driveId } = await this.getDriveInfo();
        const folderPath = `${encodeURIComponent(checklistId.trim())}/carpentry`;
        const extMatch = file.name.match(/\.[0-9a-z]+$/i);
        const ext = extMatch ? extMatch[0] : '.png';
        const filename = `carpentry-labour-${Date.now()}${ext}`; // Timestamp prevents cache issues
        const uploadUrl = `/drives/${driveId}/root:/${folderPath}/${filename}:/content`;

        const data = await this.getClient().api(uploadUrl).put(file);
        return data['@microsoft.graph.downloadUrl'] || data.webUrl;
    }

    async downloadCarpentryImage(checklistId: string): Promise<Blob | null> {
        try {
            const { driveId } = await this.getDriveInfo();
            const folderPath = `${encodeURIComponent(checklistId.trim())}/carpentry`;
            const response = await this.getClient().api(`/drives/${driveId}/root:/${folderPath}:/children`)
                .select('name')
                .top(10) // Just get recent
                .get();

            if (response.value && response.value.length > 0) {
                // Sort by name (timestamp based) descending
                const files = response.value.sort((a: any, b: any) => b.name.localeCompare(a.name));
                const latestFile = files[0];
                return await this.getClient().api(`/drives/${driveId}/root:/${folderPath}/${latestFile.name}:/content`)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .responseType('blob' as any)
                    .get();
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async uploadPDFReport(checklistId: string, filename: string, blob: Blob): Promise<string> {
        const { driveId } = await this.getDriveInfo();
        const folderPath = `${checklistId}/reports`;
        const uploadUrl = `/drives/${driveId}/root:/${folderPath}/${filename}:/content`;

        const data = await this.getClient().api(uploadUrl).put(blob);

        try {
            await this.getClient().api(`/drives/${driveId}/items/${data.id}/listItem/fields`).patch({
                Checklist_x0020_ID: checklistId,
                File_x0020_Type: 'Report',
                Title: filename
            });
        } catch (e) {
            console.warn("Failed to set PDF metadata", e);
        }

        return data.webUrl;
    }

    async downloadImageContent(itemId: string): Promise<string> {
        const { driveId } = await this.getDriveInfo();
        // Get the download URL first (or use raw content if possible, but Graph SDK 'content' retrieval handles blobs tricky)
        // Best practice: Get the @microsoft.graph.downloadUrl then fetch it. 
        // BUT wait, MSGraphClient automatically adds auth, which might fail on the specific downloadUrl if it's a redirect to storage without auth.
        // Actually, /content endpoint redirects.
        // Let's use getStream() or responseType blob if supported. 
        // MSGraphClient wrapper is thin. 
        // Let's use the pattern: api(...).responseType('blob').get()

        const blob = await this.getClient().api(`/drives/${driveId}/items/${itemId}/content`)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .responseType('blob' as any)
            .get();

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    }

    async downloadClientLogoContent(checklistId: string): Promise<Blob | null> {
        try {
            const { driveId } = await this.getDriveInfo();
            const path = `${checklistId}/branding/logo.png`;
            return await this.getClient().api(`/drives/${driveId}/root:/${path}:/content`)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .responseType('blob' as any)
                .get();
        } catch (error) {
            return null;
        }
    }
}
