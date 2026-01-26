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

// ─── HELPER: RESIZE IMAGE ──────────────────────────────────
async function resizeImage(source: string, maxWidth: number, maxHeight: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            // Calculate new dimensions
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = width * ratio;
                height = height * ratio;
            } else {
                // No resize needed, return original blob if possible, or draw to canvas
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
            }, 'image/jpeg', 0.8); // 80% quality
        };
        img.onerror = (err) => reject(err);
        img.src = source;
    });
}

// ─── SHAREPOINT IMAGE SERVICE ──────────────────────────────

export class SharePointImageService implements IImageService {

    /**
     * Upload image to SharePoint with Resize
     * Path: /{checklistId}/images/{rowId}/{filename}
     */
    async addImage(checklistId: string, workgroupId: string, rowId: string, source: string, caption?: string): Promise<ChecklistImage> {
        const token = await getGraphToken();
        const { driveId } = await getCachedDriveInfo();

        // 1. Resize Image (Client Side)
        let blob: Blob;
        try {
            console.log('[SharePoint] Resizing image...');
            blob = await resizeImage(source, 1920, 1080);
        } catch (error) {
            console.warn('[SharePoint] Resize failed, falling back to original', error);
            // Fallback: Convert original source to blob
            const response = await fetch(source);
            blob = await response.blob();
        }

        const filename = `image-${Date.now()}.jpg`;

        // 2. Upload to SharePoint
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

        // 3. Update Metadata
        try {
            const fieldUpdateUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${file.id}/listItem/fields`;
            const metaResponse = await fetch(fieldUpdateUrl, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    // Correct Internal Names provided by User
                    ChecklistId: checklistId,
                    RowId: rowId,
                    Caption: caption || filename,
                    Title: caption || filename
                })
            });

            if (!metaResponse.ok) {
                const errText = await metaResponse.text();
                console.error('[SharePoint] Metadata Update Failed:', metaResponse.status, errText);
            } else {
                console.log('[SharePoint] Metadata Updated Successfully');
            }

        } catch (error) {
            console.warn('[SharePoint] Failed to update image metadata', error);
        }

        return {
            id: file.id,
            rowId,
            caption: caption || '',
            source: file['@microsoft.graph.downloadUrl'] || file.webUrl, // Use download URL for full res
            // Graph doesn't return thumbnails on PUT response usually, might need separate call or optimistic guess.
            // For now, leave undefined.
            order: Date.now()
        };
    }

    /**
     * Get images for a specific row (Lazy Load)
     */
    async getRowImages(checklistId: string, rowId: string): Promise<ChecklistImage[]> {
        const token = await getGraphToken();
        const { driveId } = await getCachedDriveInfo();

        try {
            // List children of: {checklistId}/images/{rowId}
            // Expand thumbnails
            const folderPath = `${checklistId}/images/${rowId}`;
            const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${folderPath}:/children?select=id,name,webUrl,thumbnails,@microsoft.graph.downloadUrl&expand=thumbnails`;

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 404) return []; // No folder = no images

            const data = await response.json();

            return (data.value || []).map((item: any) => ({
                id: item.id,
                rowId: rowId,
                caption: item.name,
                source: item['@microsoft.graph.downloadUrl'] || item.webUrl,
                // Critical for PDF: Use 'large' thumbnail if available, else medium, else original
                thumbnailUrl: item.thumbnails?.[0]?.large?.url || item.thumbnails?.[0]?.medium?.url || item['@microsoft.graph.downloadUrl'],
                order: 0
            }));

        } catch (error) {
            console.warn(`[SharePoint] Failed to load images for row ${rowId}`, error);
            return [];
        }
    }

    /**
     * Upload generic file (e.g. PDF report)
     */
    async uploadFile(checklistId: string, file: File): Promise<string> {
        // Wrapper for specialized uploads if needed, or generic Logic
        if (file.type === 'application/pdf') {
            return this.uploadPDFReport(checklistId, file.name, file);
        }
        // Fallback for other files... (To be implemented if needed)
        throw new Error("File type not supported for generic upload yet");
    }

    /**
     * Get ALL image metadata for Revision Snapshot (Completeness)
     */
    async getAllImageMetadata(checklistId: string): Promise<ChecklistImage[]> {
        const token = await getGraphToken();
        const { driveId } = await getCachedDriveInfo();
        const images: ChecklistImage[] = [];

        try {
            // 1. List 'images' folder (Contains Row Folders)
            const rootPath = `${checklistId}/images`;
            const rootUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${rootPath}:/children?select=id,name,folder`;

            const rootResponse = await fetch(rootUrl, { headers: { 'Authorization': `Bearer ${token}` } });

            if (rootResponse.status === 404) {
                console.warn('[SharePoint] Images root folder not found');
                return [];
            }
            if (!rootResponse.ok) throw new Error(`Failed to list images root: ${rootResponse.status}`);

            const rootData = await rootResponse.json();
            const rowFolders = (rootData.value || []).filter((i: any) => i.folder);

            if (rowFolders.length === 0) return [];

            console.log(`[SharePoint] Found ${rowFolders.length} row folders. Fetching images...`);

            // 2. Fetch Images for each Row Folder in parallel
            // Limit concurrency if needed, but for now Promise.all is fine for <50 folders
            const imagePromises = rowFolders.map(async (folder: any) => {
                const rowId = folder.name; // Folder name is the RowID
                const folderUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folder.id}/children?select=id,name,webUrl,thumbnails,@microsoft.graph.downloadUrl&expand=thumbnails`;

                try {
                    const resp = await fetch(folderUrl, { headers: { 'Authorization': `Bearer ${token}` } });
                    if (!resp.ok) return [];
                    const data = await resp.json();

                    return (data.value || []).map((img: any) => ({
                        id: img.id,
                        rowId: rowId,
                        caption: img.name,
                        source: img['@microsoft.graph.downloadUrl'] || img.webUrl,
                        thumbnailUrl: img.thumbnails?.[0]?.medium?.url,
                        order: 0
                    }));
                } catch (e) {
                    console.warn(`[SharePoint] Failed to list images for row ${rowId}`, e);
                    return [];
                }
            });

            const results = await Promise.all(imagePromises);
            return results.flat();

        } catch (error) {
            console.warn('[SharePoint] Failed to load all image metadata', error);
            return [];
        }
    }

    async removeImage(imageId: string): Promise<void> {
        const token = await getGraphToken();
        const { driveId } = await getCachedDriveInfo();
        const response = await fetch(
            `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${imageId}`,
            { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }
        );
        if (!response.ok && response.status !== 404) throw new Error(`Delete failed: ${response.status}`);
    }

    async updateCaption(imageId: string, caption: string): Promise<void> {
        const token = await getGraphToken();
        const { driveId } = await getCachedDriveInfo();
        await fetch(
            `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${imageId}/listItem/fields`,
            {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ Caption: caption, Title: caption })
            }
        );
    }

    /**
     * Upload Client Logo
     * Path: /{checklistId}/branding/logo.png
     */
    async uploadClientLogo(checklistId: string, file: File): Promise<string> {
        const token = await getGraphToken();
        const { driveId } = await getCachedDriveInfo();

        const cleanId = checklistId.trim();
        // Ensure path components are safe
        const folderPath = `${encodeURIComponent(cleanId)}/branding`;
        const filename = 'logo.png';

        const uploadUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${folderPath}/${filename}:/content`;

        console.log('[SharePoint] Uploading Logo to:', uploadUrl);

        const response = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': file.type
            },
            body: file
        });

        if (!response.ok) {
            throw new Error(`Logo Upload failed: ${response.status}`);
        }

        const data = await response.json();
        return data['@microsoft.graph.downloadUrl'] || data.webUrl;
    }

    /**
     * Upload Generated PDF Report
     * Path: /{checklistId}/reports/{filename}.pdf
     */
    async uploadPDFReport(checklistId: string, filename: string, blob: Blob): Promise<string> {
        const token = await getGraphToken();
        const { driveId } = await getCachedDriveInfo();

        const folderPath = `${checklistId}/reports`;

        const uploadUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${folderPath}/${filename}:/content`;

        const response = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/pdf'
            },
            body: blob
        });

        if (!response.ok) {
            throw new Error(`PDF Upload failed: ${response.status}`);
        }

        const data = await response.json();
        return data.webUrl;
    }
    async downloadImageContent(itemId: string): Promise<string> {
        const token = await getGraphToken();
        const { driveId } = await getCachedDriveInfo();

        // Use Graph API content endpoint which supports CORS + Auth
        const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`Failed to download image content: ${response.status}`);
        }

        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    }

    async downloadClientLogoContent(checklistId: string): Promise<Blob | null> {
        try {
            const token = await getGraphToken();
            const { driveId } = await getCachedDriveInfo();
            const path = `${checklistId}/branding/logo.png`;

            // Get content by path
            const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${path}:/content`;

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) return null; // No logo found

            return await response.blob();
        } catch (error) {
            console.warn("Failed to download client logo content", error);
            return null;
        }
    }

}
