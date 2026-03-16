import { useState, useRef } from 'react';
import { Checklist } from '../models';
import { getChecklistService, getImageService } from '../services';
import { BtcExportService } from '../services/BtcExportService';

export interface LoadingProgress {
    open: boolean;
    title: string;
    status: string;
    percent: number;
    cancelled: boolean;
}

export const useBtcExport = () => {
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

    const exportBtc = async (activeChecklist: Checklist) => {
        if (!activeChecklist) return;

        isCancelledRef.current = false;
        setLoadingProgress({ open: true, title: 'Exporting BTC Items', status: 'Preparing...', percent: 0, cancelled: false });

        try {
            const service = new BtcExportService();

            // 1. Hydrate the checklist to ensure all images are downloaded as Base64 for the PDF
            const hydratedChecklist = await getChecklistService().getHydratedChecklist(activeChecklist.id, (status, percent) => {
                if (isCancelledRef.current) return false;
                // Map hydration percent (0-100) to our loading scale (5-15)
                const mappedPercent = 5 + (percent * 0.1);
                setLoadingProgress(prev => ({ ...prev, status, percent: mappedPercent }));
                return true;
            });

            if (isCancelledRef.current) throw new Error("Cancelled");

            // 2. Check if there are any items before doing anything heavy
            const btcChecklist = service.filterBtcChecklist(hydratedChecklist);
            const hasItems = btcChecklist.workgroups.some(wg => wg.rows.length > 0);

            if (!hasItems) {
                throw new Error("No Builder to Confirm items found.");
            }

            setLoadingProgress(prev => ({ ...prev, status: 'Fetching branding...', percent: 15 }));

            // 3. Fetch Logo
            let logoBlob: Blob | null = null;
            try {
                logoBlob = await getImageService().downloadClientLogoContent(hydratedChecklist.id);
            } catch { /* ignore missing logo */ }

            if (isCancelledRef.current) throw new Error("Cancelled");

            // 4. Generate PDF
            const pdfBlob = await service.generateBtcPdf(hydratedChecklist, logoBlob, (status, percent) => {
                if (isCancelledRef.current) return false;
                setLoadingProgress(prev => ({ ...prev, status, percent: 15 + (percent * 0.8) }));
                return true;
            });

            if (isCancelledRef.current) throw new Error("Cancelled");
            setLoadingProgress(prev => ({ ...prev, status: 'Sending email...', percent: 95 }));

            // 4. Send Email via Graph API
            await service.sendBtcEmail(hydratedChecklist, pdfBlob);

            if (isCancelledRef.current) throw new Error("Cancelled");
            setLoadingProgress(prev => ({ ...prev, status: 'Email sent successfully!', percent: 100 }));

            setTimeout(() => setLoadingProgress({ open: false, title: '', status: '', percent: 0, cancelled: false }), 2000);

        } catch (error: any) {
            console.error("BTC Export Error", error);
            const msg = error.message === "Cancelled" ? "Export cancelled" : (error.message || "Unknown error occurred");
            setLoadingProgress(prev => ({ ...prev, status: 'Error: ' + msg, percent: 100 }));
            setTimeout(() => setLoadingProgress({ open: false, title: '', status: '', percent: 0, cancelled: false }), 4000);
        }
    };

    return {
        exportBtc,
        loadingProgress,
        cancelExport
    };
};
