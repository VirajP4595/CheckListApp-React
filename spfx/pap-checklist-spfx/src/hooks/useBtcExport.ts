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

            // 1. Check if there are any items before doing anything heavy
            const btcChecklist = service.filterBtcChecklist(activeChecklist);
            const hasItems = btcChecklist.workgroups.some(wg => wg.rows.length > 0);
            if (!hasItems) {
                throw new Error("No Builder to Confirm items found.");
            }

            setLoadingProgress(prev => ({ ...prev, status: 'Fetching branding...', percent: 10 }));

            // 2. Fetch Logo
            let logoBlob: Blob | null = null;
            try {
                logoBlob = await getImageService().downloadClientLogoContent(activeChecklist.id);
            } catch { /* ignore missing logo */ }

            if (isCancelledRef.current) throw new Error("Cancelled");

            // 3. Generate PDF
            const pdfBlob = await service.generateBtcPdf(activeChecklist, logoBlob, (status, percent) => {
                if (isCancelledRef.current) return false;
                setLoadingProgress(prev => ({ ...prev, status, percent: 10 + (percent * 0.8) }));
                return true;
            });

            if (isCancelledRef.current) throw new Error("Cancelled");
            setLoadingProgress(prev => ({ ...prev, status: 'Downloading PDF...', percent: 95 }));

            // 4. Download PDF locally
            const cleanTitle = activeChecklist.title.replace(/[^a-z0-9]/gi, '_');
            const url = window.URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `[BTC SUMMARY] ${cleanTitle}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            setLoadingProgress(prev => ({ ...prev, status: 'Opening email draft...', percent: 100 }));

            // 5. Open Outlook Draft
            service.draftBtcEmail(activeChecklist);

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
