import { getGraphToken } from './authService';
import { AppConfig } from '../config/environment';
import type { IImageService } from './interfaces';
import type { ChecklistImage } from '../models';

// ─── SHAREPOINT GRAPH API CLIENT ───────────────────────────

const siteUrl = AppConfig.sharepoint.siteUrl;
const libraryName = AppConfig.sharepoint.documentLibrary;

/**
 * Extract site ID and drive ID from SharePoint site
 */
async function getDriveInfo(): Promise<{ siteId: string; driveId: string }> {
    const token = await getGraphToken();

    // Parse site URL to get host and path
    const url = new URL(siteUrl);
    const hostName = url.hostname;
    const sitePath = url.pathname;

    // Get site ID
    const siteResponse = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${hostName}:${sitePath}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const site = await siteResponse.json();

    // Get drive (library) ID
    const drivesResponse = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${site.id}/drives`,
        { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const drives = await drivesResponse.json();

    const library = drives.value.find((d: { name: string }) => d.name === libraryName);
    if (!library) {
        throw new Error(`Library "${libraryName}" not found`);
    }

    return { siteId: site.id, driveId: library.id };
}

// Cache drive info
let driveInfoCache: { siteId: string; driveId: string } | null = null;

async function getCachedDriveInfo() {
    if (!driveInfoCache) {
        driveInfoCache = await getDriveInfo();
    }
    return driveInfoCache;
}

// ─── SHAREPOINT IMAGE SERVICE ──────────────────────────────

export class SharePointImageService implements IImageService {

    /**
     * Upload image to SharePoint
     * Path: /{checklistId}/images/{rowId}/{filename}
     */
    async addImage(rowId: string, source: string, caption?: string): Promise<ChecklistImage> {
        const token = await getGraphToken();
        const { driveId } = await getCachedDriveInfo();

        // For now, we need checklistId passed differently
        // This is a simplified version - in production, we'd track checklistId
        const checklistId = 'default';  // TODO: Get from context

        // Convert base64 to blob if needed
        let blob: Blob;
        let filename: string;

        if (source.startsWith('data:')) {
            const [meta, data] = source.split(',');
            const mimeType = meta.match(/data:(.*);/)?.[1] || 'image/jpeg';
            const extension = mimeType.split('/')[1];
            filename = `image-${Date.now()}.${extension}`;

            const byteCharacters = atob(data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
        } else {
            // URL source - fetch and upload
            const response = await fetch(source);
            blob = await response.blob();
            filename = `image-${Date.now()}.jpg`;
        }

        // Upload to SharePoint
        const folderPath = `${checklistId}/images/${rowId}`;
        const uploadUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${folderPath}/${filename}:/content`;

        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': blob.type
            },
            body: blob
        });

        if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.status}`);
        }

        const file = await uploadResponse.json();

        return {
            id: file.id,
            rowId,
            caption: caption || '',
            source: file.webUrl || file['@microsoft.graph.downloadUrl'],
            order: Date.now()  // Use timestamp as order for now
        };
    }

    /**
     * Delete image from SharePoint
     */
    async removeImage(imageId: string): Promise<void> {
        const token = await getGraphToken();
        const { driveId } = await getCachedDriveInfo();

        const response = await fetch(
            `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${imageId}`,
            {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            }
        );

        if (!response.ok && response.status !== 404) {
            throw new Error(`Delete failed: ${response.status}`);
        }
    }

    /**
     * Update image caption (stored as list item metadata)
     */
    async updateCaption(imageId: string, caption: string): Promise<void> {
        const token = await getGraphToken();
        const { driveId } = await getCachedDriveInfo();

        // Update list item fields
        await fetch(
            `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${imageId}/listItem/fields`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ Caption: caption })
            }
        );
    }
}
