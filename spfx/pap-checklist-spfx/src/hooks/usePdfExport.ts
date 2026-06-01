import { useState, useRef } from 'react';
import { Checklist } from '../models';
import { getImageService } from '../services';
import { PdfGeneratorService } from '../services/PdfGeneratorService';
import { SharePointImageService } from '../services/sharePointService';

export interface LoadingProgress {
    open: boolean;
    title: string;
    status: string;
    percent: number;
    cancelled: boolean;
}

export const usePdfExport = () => {
    const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({
        open: false,
        title: '',
        status: '',
        percent: 0,
        cancelled: false
    });

    const isCancelledRef = useRef(false);

    const cancelExport = () => {
        isCancelledRef.current = true;
        setLoadingProgress(prev => ({ ...prev, cancelled: true, status: 'Cancelling...' }));
    };

    const exportPdf = async (activeChecklist: Checklist) => {
        if (!activeChecklist) return;

        isCancelledRef.current = false;
        setLoadingProgress({ open: true, title: 'Generating PDF Report', status: 'Initializing...', percent: 0, cancelled: false });

        try {
            // STEP 1: Fetch image metadata from SharePoint (lightweight — just metadata, not content)
            // We use activeChecklist from the store directly to avoid re-fetching row/workgroup data,
            // which previously caused revision workgroup rows to be missing (URL length / OData issues).
            setLoadingProgress(prev => ({ ...prev, status: 'Retrieving image list...', percent: 5 }));

            let checklistImages: any[] = [];
            try {
                checklistImages = await getImageService().getAllImageMetadata(activeChecklist.id);
            } catch (err) {
                console.warn('[PDF] Failed to load image metadata from SharePoint', err);
            }

            if (isCancelledRef.current) throw new Error("Cancelled");

            // STEP 2: Build exportable checklist from store data (includes ALL workgroups + revision workgroups)
            // Filter internalOnly rows, and attach image metadata to each row.
            const exportableChecklist: Checklist = {
                ...activeChecklist,
                workgroups: activeChecklist.workgroups.map(wg => ({
                    ...wg,
                    rows: wg.rows
                        .filter(row => !row.internalOnly)
                        .map(row => ({
                            ...row,
                            images: checklistImages.filter((img: any) => img.rowId === row.id)
                        }))
                }))
            };

            // STEP 3: Download actual image content (base64) for all images across all workgroups
            const allImages: { img: any; id: string }[] = [];
            exportableChecklist.workgroups.forEach(wg => {
                wg.rows.forEach(r => {
                    if (r.images) {
                        r.images.forEach((img: any) => {
                            if (img.id && (!img.source || !img.source.startsWith('data:'))) {
                                allImages.push({ img, id: img.id });
                            }
                        });
                    }
                });
            });

            if (allImages.length > 0) {
                const batchSize = allImages.length;
                console.log(`[PDF Hydration] Downloading content for ${batchSize} images...`);
                setLoadingProgress(prev => ({ ...prev, status: `Downloading ${batchSize} images...`, percent: 8 }));

                const imageService = getImageService();
                let completed = 0;

                const blobToBase64 = (blob: Blob): Promise<string> =>
                    new Promise(resolve => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });

                const downloadOne = async (item: { img: any; id: string }): Promise<void> => {
                    const src: string = item.img.source || '';
                    // Try pre-signed Azure Blob URL first (fast, no SharePoint throttling)
                    if (src && src.startsWith('https://') && !src.includes('/_layouts/') && !src.includes('sharepoint.com')) {
                        try {
                            const r = await fetch(src);
                            if (r.ok) {
                                // eslint-disable-next-line require-atomic-updates
                                item.img.source = await blobToBase64(await r.blob());
                                return;
                            }
                        } catch {
                            // Fall through to Graph API
                        }
                    }
                    // Authenticated Graph API fallback
                    const base64 = await imageService.downloadImageContent(item.id);
                    // eslint-disable-next-line require-atomic-updates
                    if (base64) item.img.source = base64;
                };

                // Controlled concurrency: 15 simultaneous workers
                const CONCURRENCY = 15;
                const queue = [...allImages];

                const runWorker = async (): Promise<void> => {
                    while (queue.length > 0) {
                        const item = queue.shift()!;
                        try {
                            await downloadOne(item);
                        } catch (e) {
                            console.warn(`[PDF Hydration] Failed to download image ${item.id}`, e);
                        } finally {
                            completed++;
                            const percent = 8 + Math.floor((completed / batchSize) * 9); // 8–17%
                            setLoadingProgress(prev => ({ ...prev, status: `Downloaded ${completed}/${batchSize} images`, percent }));
                        }
                    }
                };

                await Promise.all(
                    Array.from({ length: Math.min(CONCURRENCY, allImages.length) }, runWorker)
                );
            }

            if (isCancelledRef.current) throw new Error("Cancelled");

            const generator = new PdfGeneratorService(exportableChecklist);

            // STEP 4: Fetch Branding Logo (Securely via Graph)
            let logoBlob: Blob | null = null;
            if (activeChecklist.clientLogoUrl) {
                try {
                    setLoadingProgress(prev => ({ ...prev, status: 'Fetching branding...', percent: 17 }));
                    logoBlob = await getImageService().downloadClientLogoContent(activeChecklist.id);
                } catch (e) {
                    // Logo is optional — continue without it
                }
            }

            // STEP 4b: Fetch PAP Company Logo from SiteAssets
            let papLogoBlob: Blob | null = null;
            try {
                const { AppConfig } = await import(/* webpackChunkName: 'app-config' */ '../config/environment');
                const papLogoUrl = `${AppConfig.sharepoint.absoluteUrl}/SiteAssets/PAPLogo/2024_PAP%20logo%20vert_transparent%20bkgrd_HR.png`;
                const response = await fetch(papLogoUrl);
                if (response.ok) {
                    papLogoBlob = await response.blob();
                }
            } catch (e) {
                console.warn('Could not fetch PAP logo for PDF', e);
            }

            const pdfBlob = await generator.generate(logoBlob, (status, percent) => {
                if (isCancelledRef.current) return false; // Abort

                // Remap percent (20-95%)
                const adjustedPercent = 20 + (percent * 0.75);
                setLoadingProgress(prev => ({ ...prev, status, percent: adjustedPercent }));
                return true;
            }, papLogoBlob);

            // Upload
            setLoadingProgress(prev => ({ ...prev, status: 'Uploading...', percent: 95 }));
            const sharePointService = getImageService() as SharePointImageService;
            const fileName = `${activeChecklist.title.replace(/[^a-z0-9]/gi, '_')}-REV${activeChecklist.currentRevisionNumber}.pdf`;
            await sharePointService.uploadFile(activeChecklist.id, new File([pdfBlob], fileName, { type: 'application/pdf' }));

            setLoadingProgress(prev => ({ ...prev, status: 'Done!', percent: 100 }));

            // Auto download for user convenience
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);

            setTimeout(() => setLoadingProgress({ open: false, title: '', status: '', percent: 0, cancelled: false }), 2000);

        } catch (error: any) {
            if (error.message === 'Cancelled' || error.message?.includes('Cancelled')) {
                setLoadingProgress({ open: false, title: '', status: '', percent: 0, cancelled: false });
            } else {
                console.error("PDF Generation Error", error);
                setLoadingProgress(prev => ({ ...prev, status: 'Error: ' + error.message, percent: 0 }));
            }
        }
    };

    return {
        exportPdf,
        loadingProgress,
        cancelExport
    };
};
