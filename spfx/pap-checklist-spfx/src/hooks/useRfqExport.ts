import { useState, useRef } from 'react';
import { Checklist } from '../models';
import { getChecklistService } from '../services';
import { RfqExportService, SendRfqSummary } from '../services/RfqExportService';

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
     * Preview the supplier grouping before sending. Used by the UI to show a
     * summary modal ("N emails to M suppliers, P rows skipped").
     */
    const previewRfqSend = async (activeChecklist: Checklist) => {
        const service = new RfqExportService();
        const hydratedChecklist = await getChecklistService().getHydratedChecklist(activeChecklist.id, () => true);
        const { groups, skippedRowsNoEmail, totalRfqRows } = service.groupBySupplier(hydratedChecklist);
        return { hydratedChecklist, groups, skippedRowsNoEmail, totalRfqRows };
    };

    /**
     * Sends one email per unique supplier from the shared mailbox,
     * each with a supplier-scoped PDF attached. Returns a summary.
     */
    const sendRfqToSuppliers = async (
        hydratedChecklist: Checklist,
        onPermissionFallback?: (sharedMailbox: string) => Promise<boolean>
    ): Promise<SendRfqSummary> => {
        if (!hydratedChecklist) throw new Error('No checklist');
        isCancelledRef.current = false;
        setLoadingProgress({ open: true, title: 'Sending RFQ to Suppliers', status: 'Preparing...', percent: 0, cancelled: false });

        try {
            const service = new RfqExportService();

            const summary = await service.sendRfqEmailsPerSupplier(
                hydratedChecklist,
                (status, percent) => {
                    setLoadingProgress(prev => ({ ...prev, status, percent }));
                },
                onPermissionFallback
            );

            const sentCount = summary.sent.length;
            const failedCount = summary.failed.length;
            const done = failedCount === 0
                ? `Sent ${sentCount} supplier email${sentCount === 1 ? '' : 's'}.`
                : `Sent ${sentCount}, ${failedCount} failed.`;

            setLoadingProgress(prev => ({ ...prev, status: done, percent: 100 }));
            setTimeout(() => setLoadingProgress({ open: false, title: '', status: '', percent: 0, cancelled: false }), 2500);

            return summary;
        } catch (error: any) {
            console.error('RFQ Email Error', error);
            const msg = error?.message || 'Unknown error occurred';
            setLoadingProgress(prev => ({ ...prev, status: 'Error: ' + msg, percent: 100 }));
            setTimeout(() => setLoadingProgress({ open: false, title: '', status: '', percent: 0, cancelled: false }), 4000);
            throw error;
        }
    };

    return {
        exportRfqCsv,
        previewRfqSend,
        sendRfqToSuppliers,
        loadingProgress,
        cancelExport
    };
};
