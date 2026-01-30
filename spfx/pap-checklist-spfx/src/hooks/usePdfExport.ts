import { useState, useRef } from 'react';
import { Checklist } from '../models';
import { getChecklistService, getImageService } from '../services';
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
            // STEP 1: Retrieve all images (Pre-fetch for collapsed rows)
            setLoadingProgress(prev => ({ ...prev, status: 'Retrieving all images...', percent: 5 }));
            const fullChecklist = await getChecklistService().getChecklist(activeChecklist.id, { includeImages: true });

            if (isCancelledRef.current) throw new Error("Cancelled");

            // STEP 2: Download Image Content (Bypass CORS)
            const allImages: { img: any, id: string }[] = [];
            fullChecklist.workgroups.forEach(wg => {
                wg.rows.forEach(r => {
                    if (r.images) {
                        r.images.forEach(img => {
                            if (img.id && !img.source.startsWith('data:')) {
                                allImages.push({ img, id: img.id });
                            }
                        });
                    }
                });
            });

            if (allImages.length > 0) {
                setLoadingProgress(prev => ({ ...prev, status: `Downloading ${allImages.length} images...`, percent: 10 }));
                const imageService = getImageService();
                const getImageContent = async (item: { img: any, id: string }) => {
                    try {
                        if (isCancelledRef.current) return;
                        const base64 = await imageService.downloadImageContent(item.id);
                        // eslint-disable-next-line require-atomic-updates
                        item.img.source = base64; // Replace URL with Data URL
                    } catch (err) {
                        console.warn(`Failed to download image ${item.id}`, err);
                    }
                };

                await Promise.all(allImages.map(getImageContent));
            }

            const generator = new PdfGeneratorService(fullChecklist);

            // STEP 3: Fetch Branding Logo (Securely via Graph)
            let logoBlob: Blob | null = null;
            if (fullChecklist.clientLogoUrl) {
                try {
                    setLoadingProgress(prev => ({ ...prev, status: 'Fetching branding...', percent: 15 }));
                    // Use secure download instead of fetch(url) to avoid CORS
                    logoBlob = await getImageService().downloadClientLogoContent(activeChecklist.id);
                } catch (e) {
                    // console.warn("Could not fetch logo for PDF", e);
                }
            }

            const pdfBlob = await generator.generate(logoBlob, (status, percent) => {
                if (isCancelledRef.current) return false; // Abort

                // Remap percent (20-95%)
                const adjustedPercent = 20 + (percent * 0.75);
                setLoadingProgress(prev => ({ ...prev, status, percent: adjustedPercent }));
                return true;
            });

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
