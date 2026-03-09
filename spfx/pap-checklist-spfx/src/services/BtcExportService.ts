import { Checklist, Workgroup } from '../models';
import { PdfGeneratorService } from './PdfGeneratorService';

export class BtcExportService {

    /**
     * Filters a checklist to only contain rows marked as builderToConfirm.
     */
    public filterBtcChecklist(original: Checklist): Checklist {
        const filteredWorkgroups: Workgroup[] = [];

        for (const wg of original.workgroups) {
            const btcRows = wg.rows.filter(row => row.builderToConfirm);
            if (btcRows.length > 0) {
                // Return a copy of the workgroup with only the BTC rows
                filteredWorkgroups.push({
                    ...wg,
                    rows: btcRows
                });
            }
        }

        return {
            ...original,
            title: `[BTC SUMMARY] ${original.title}`,
            workgroups: filteredWorkgroups
        };
    }

    /**
     * Generates a PDF containing only BTC items.
     */
    public async generateBtcPdf(
        checklist: Checklist,
        brandingLogoBlob: Blob | null,
        onProgress: (status: string, percent: number) => boolean
    ): Promise<Blob> {
        const btcChecklist = this.filterBtcChecklist(checklist);
        const pdfService = new PdfGeneratorService(btcChecklist);
        return pdfService.generate(brandingLogoBlob, onProgress);
    }

    /**
     * Filters the checklist for BTC items and opens the email client.
     */
    public draftBtcEmail(checklist: Checklist): void {
        const btcChecklist = this.filterBtcChecklist(checklist);

        // Check if there are any items
        const hasItems = btcChecklist.workgroups.some(wg => wg.rows.length > 0);
        if (!hasItems) {
            throw new Error("No Builder to Confirm items found.");
        }

        // Extract basic job metadata for the email subject and body
        const jobAddress = btcChecklist.jobDetails?.siteAddress || btcChecklist.jobDetails?.jobName || 'Job';
        const builderName = btcChecklist.jobDetails?.builderName || 'Builder';

        // Collect all BTC items for the email body
        const btcItems: string[] = [];
        btcChecklist.workgroups.forEach(wg => {
            wg.rows.forEach(row => {
                const rowName = row.name || (row.description ? row.description.replace(/<[^>]*>?/gm, '').substring(0, 50) + '...' : 'Untitled Item');
                const rowDesc = row.description ? row.description.replace(/<[^>]*>?/gm, '').trim() : '';

                let itemEntry = `• ${wg.number}: ${rowName}`;
                if (rowDesc && rowDesc !== rowName) {
                    itemEntry += `\n  Description: ${rowDesc}`;
                }
                btcItems.push(itemEntry);
            });
        });

        const subject = encodeURIComponent(`BTC Items - ${jobAddress}`);
        const bodyText = `Hi ${builderName},\n\nPlease review the following Builder to Confirm (BTC) items for ${jobAddress}:\n\n${btcItems.join('\n')}\n\nPlease confirm these details at your earliest convenience.\n\nRegards,\n`;
        const body = encodeURIComponent(bodyText);

        // Use Outlook Web App deep link instead of mailto for better browser compatibility
        const outlookUrl = `https://outlook.office.com/mail/deeplink/compose?subject=${subject}&body=${body}`;

        // Open in a new tab
        window.open(outlookUrl, '_blank');
    }
}
