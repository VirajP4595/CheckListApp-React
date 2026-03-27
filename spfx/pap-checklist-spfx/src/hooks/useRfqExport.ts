import { useState, useRef } from 'react';
import { Checklist } from '../models';
import { getChecklistService, getImageService } from '../services';
import { RfqExportService } from '../services/RfqExportService';

export interface LoadingProgress {
    open: boolean;
    title: string;
    status: string;
    percent: number;
    cancelled: boolean;
}

export const useRfqExport = () => {
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

    /**
     * Original CSV Export
     */
    const exportRfqCsv = async (checklist: Checklist) => {
        if (!checklist) return;
        setLoadingProgress({ open: true, title: 'Exporting RFQ CSV', status: 'Generating...', percent: 50, cancelled: false });

        try {
            const rfqItems: any[] = [];

            checklist.workgroups.forEach(wg => {
                wg.rows.forEach(row => {
                    if (row.answer === 'RFQ') {
                        rfqItems.push({
                            'Workgroup #': wg.number,
                            'Workgroup Name': wg.name,
                            'Section': row.section === 'client' ? 'Client' : 'Estimator',
                            'Item Name': row.name,
                            'Supplier Name': row.supplierName || '',
                            'Supplier Email': row.supplierEmail || '',
                            'Notes': row.notes?.replace(/<[^>]*>?/gm, '') || '' // Strip HTML
                        });
                    }
                });
            });

            if (rfqItems.length === 0) {
                alert("No RFQ items found to export.");
                setLoadingProgress({ open: false, title: '', status: '', percent: 0, cancelled: false });
                return;
            }

            // Generate CSV
            const headers = Object.keys(rfqItems[0]);
            const csvRows = [
                headers.join(','),
                ...rfqItems.map(item => 
                    headers.map(header => {
                        const val = item[header];
                        const escaped = ('' + val).replace(/"/g, '""');
                        return `"${escaped}"`;
                    }).join(',')
                )
            ];

            const csvContent = csvRows.join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.setAttribute('href', url);
            const fileName = `RFQ_Export_${checklist.jobReference || 'Checklist'}_${new Date().toISOString().split('T')[0]}.csv`;
            link.setAttribute('download', fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setLoadingProgress({ open: false, title: '', status: '', percent: 0, cancelled: false });
        } catch (error) {
            console.error("RFQ Export Error", error);
            setLoadingProgress({ open: false, title: '', status: '', percent: 0, cancelled: false });
            alert("Failed to export RFQ items.");
        }
    };

    /**
     * New Email Summary (PDF) Export
     */
    const emailRfq = async (activeChecklist: Checklist) => {
        if (!activeChecklist) return;

        isCancelledRef.current = false;
        setLoadingProgress({ open: true, title: 'Emailing RFQ Summary', status: 'Preparing...', percent: 0, cancelled: false });

        try {
            const service = new RfqExportService();

            // 1. Hydrate
            const hydratedChecklist = await getChecklistService().getHydratedChecklist(activeChecklist.id, (status, percent) => {
                if (isCancelledRef.current) return false;
                const mappedPercent = 5 + (percent * 0.1);
                setLoadingProgress(prev => ({ ...prev, status, percent: mappedPercent }));
                return true;
            });

            if (isCancelledRef.current) throw new Error("Cancelled");

            // 2. Check items
            const rfqChecklist = service.filterRfqChecklist(hydratedChecklist);
            const hasItems = rfqChecklist.workgroups.some(wg => wg.rows.length > 0);

            if (!hasItems) {
                throw new Error("No RFQ items found.");
            }

            setLoadingProgress(prev => ({ ...prev, status: 'Fetching branding...', percent: 15 }));

            // 3. Fetch Logo
            let logoBlob: Blob | null = null;
            try {
                logoBlob = await getImageService().downloadClientLogoContent(hydratedChecklist.id);
            } catch { /* ignore */ }

            if (isCancelledRef.current) throw new Error("Cancelled");

            // 4. Generate PDF
            const pdfBlob = await service.generateRfqPdf(hydratedChecklist, logoBlob, (status, percent) => {
                if (isCancelledRef.current) return false;
                setLoadingProgress(prev => ({ ...prev, status, percent: 15 + (percent * 0.8) }));
                return true;
            });

            if (isCancelledRef.current) throw new Error("Cancelled");
            setLoadingProgress(prev => ({ ...prev, status: 'Sending email...', percent: 95 }));

            // 5. Send Email
            await service.sendRfqEmail(hydratedChecklist, pdfBlob);

            if (isCancelledRef.current) throw new Error("Cancelled");
            setLoadingProgress(prev => ({ ...prev, status: 'Email sent successfully!', percent: 100 }));

            setTimeout(() => setLoadingProgress({ open: false, title: '', status: '', percent: 0, cancelled: false }), 2000);

        } catch (error: any) {
            console.error("RFQ Email Error", error);
            const msg = error.message === "Cancelled" ? "Email cancelled" : (error.message || "Unknown error occurred");
            setLoadingProgress(prev => ({ ...prev, status: 'Error: ' + msg, percent: 100 }));
            setTimeout(() => setLoadingProgress({ open: false, title: '', status: '', percent: 0, cancelled: false }), 4000);
        }
    };

    return {
        exportRfqCsv,
        emailRfq,
        loadingProgress,
        cancelExport
    };
};
