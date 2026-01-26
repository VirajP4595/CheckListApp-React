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

    console.log('[SharePointService] Available Drives/Libraries:', drives.value.map((d: any) => ({ name: d.name, id: d.id, url: d.webUrl })));

    const library = drives.value.find((d: { name: string, webUrl: string }) =>
        d.name === libraryName ||
        decodeURIComponent(d.webUrl).endsWith(`/${libraryName}`)
    );

    if (!library) {
        throw new Error(`Library "${libraryName}" not found. Available libraries: ${drives.value.map((d: any) => d.name).join(', ')}`);
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

        // Update ListItem fields with metadata
        try {
            await fetch(
                `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${file.id}/listItem/fields`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        pap_checklistid: checklistId,
                        pap_rowid: rowId,
                        Title: caption || filename
                    })
                }
            );
        } catch (error) {
            console.warn('[SharePoint] Failed to update image metadata', error);
        }

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
                body: JSON.stringify({ Caption: caption, Title: caption })
            }
        );
    }

    /**
     * Get all images for a checklist
     */
    async getImages(checklistId: string): Promise<ChecklistImage[]> {
        const token = await getGraphToken();
        const { driveId } = await getCachedDriveInfo();

        // Search for items in the checklist folder
        // We use the search API to find items under the checklist path
        // Query: path:"<checklistId>/images" AND filetype:image (implicit or check mimetype)

        // Note: Graph Search syntax is tricky for specific paths. 
        // Safer approach: List children of checklist folder, then iterate? No, too slow.
        // Better: Search for items where pap_checklistid = checklistId (if indexed).
        // Fallback: Since we structure by folder, we can try to list items in the images root.

        try {
            // First, try to list the 'images' folder for this checklist
            const folderPath = `${checklistId}/images`;
            // Get all children of the images folder (which are row folders)
            const rowFoldersUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${folderPath}:/children`;

            const rowFoldersResponse = await fetch(rowFoldersUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (rowFoldersResponse.status === 404) return []; // No images yet
            const rowFolders = await rowFoldersResponse.json();

            if (!rowFolders.value) return [];

            // Now get images from each row folder. 
            // Optimally, we would use a search query, but let's do this for now to rely on structure.
            // Or use search from the 'images' folder?
            // Let's try a search query scoped to the checklistId

            const searchUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${folderPath}:/search(q='')?select=id,name,webUrl,parentReference,listItem`;
            const searchResponse = await fetch(searchUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const searchResults = await searchResponse.json();

            // To get metadata (pap_rowid), we might need to expand listitem
            // But search results might not contain custom columns deep linked immediately.
            // We can fall back to parsing parent folder name as rowId if metadata is missing.

            const images: ChecklistImage[] = [];

            for (const file of searchResults.value || []) {
                if (file.folder) continue; // Skip folders

                // Get rowId from Parent Path or Metadata
                // Parent path format: .../images/<rowId>
                let rowId = '';

                // Try to extract from parent path name logic?
                // The search result 'parentReference.path' looks like: "/drives/<id>/root:/checklistId/images/<rowId>"
                if (file.parentReference && file.parentReference.path) {
                    const parts = file.parentReference.path.split('/');
                    rowId = parts[parts.length - 1]; // Last part should be rowId
                }

                if (rowId) {
                    images.push({
                        id: file.id,
                        rowId: rowId,
                        source: file['@microsoft.graph.downloadUrl'] || file.webUrl,
                        caption: file.name, // or fetch title
                        order: 0
                    });
                }
            }
            return images;

        } catch (error) {
            console.warn('[SharePoint] Failed to load images', error);
            return [];
        }
    }
}
