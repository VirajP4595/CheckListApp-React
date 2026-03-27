import { Checklist, Workgroup } from '../models';
import { PdfGeneratorService } from './PdfGeneratorService';

export class BtcExportService {

    /**
     * Filters a checklist to only contain rows marked as builderToConfirm.
     */
    public filterBtcChecklist(original: Checklist): Checklist {
        console.log(`[BTC Filter] Starting filter for "${original.title}". Original workgroups: ${original.workgroups.length}`);

        // 1. Filter ALL workgroups that have at least one row with builderToConfirm = true
        const allFilteredWorkgroups: Workgroup[] = original.workgroups.map(wg => {
            const btcRows = (wg.rows || []).filter(row => row.builderToConfirm);
            
            if (btcRows.length > 0) {
                return { ...wg, rows: btcRows };
            }
            return null;
        }).filter((wg): wg is Workgroup => wg !== null);

        console.log(`[BTC Filter] Found ${allFilteredWorkgroups.length} workgroups with BTC items.`);

        // 2. Filter revisions: Keep a revision ONLY if it has items in our filtered list
        const filteredRevisions = (original.revisions || []).filter(rev => {
            const hasBtcWorkgroups = allFilteredWorkgroups.some(wg => wg.revisionId === rev.id);
            return hasBtcWorkgroups; // Strictly only BTC items
        });

        console.log(`[BTC Filter] Kept ${filteredRevisions.length} revisions after BTC filtering.`);

        return {
            ...original,
            title: `[BTC SUMMARY] ${original.title}`,
            workgroups: allFilteredWorkgroups,
            revisions: filteredRevisions
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
     * Sends the BTC summary via direct Graph API email with PDF attachment.
     */
    public async sendBtcEmail(checklist: Checklist, pdfBlob: Blob): Promise<void> {
        const { getGraphEmailService } = await import('./serviceFactory');
        const { AppConfig } = await import('../config/environment');

        const btcChecklist = this.filterBtcChecklist(checklist);

        // Check if there are any items (including in revisions)
        const hasItems = btcChecklist.workgroups.some(wg => wg.rows.length > 0);

        if (!hasItems) {
            throw new Error("No Builder to Confirm items found.");
        }

        // 1. Prepare Email Content
        const jobAddress = btcChecklist.jobDetails?.siteAddress || btcChecklist.jobDetails?.jobName || 'Job';
        const builderName = btcChecklist.jobDetails?.builderName || 'Builder';

        const btcItems: string[] = [];

        // Loop through all filtered workgroups once
        // We separate them into "Original" and "Revision" categories for the email list
        const mainWg = btcChecklist.workgroups.filter(wg => !wg.revisionId).sort((a, b) => a.number - b.number);
        const revWg = btcChecklist.workgroups.filter(wg => !!wg.revisionId).sort((a, b) => a.number - b.number);

        // Add main items
        mainWg.forEach(wg => {
            wg.rows.forEach(row => {
                const rowName = row.name || (row.description ? row.description.replace(/<[^>]*>?/gm, '').substring(0, 50) + '...' : 'Untitled Item');
                const sectionTag = row.section === 'estimator' ? ' [Estimator]' : (row.section === 'client' ? ' [Client]' : '');
                btcItems.push(`<li><strong>${wg.number}${sectionTag}</strong>: ${rowName}</li>`);
            });
        });

        // Add revision items (newest first)
        const sortedRevisions = (btcChecklist.revisions || []).slice().sort((a, b) => b.number - a.number);
        
        sortedRevisions.forEach(rev => {
            const thisRevWorkgroups = revWg.filter(wg => wg.revisionId === rev.id);
            thisRevWorkgroups.forEach(wg => {
                wg.rows.forEach(row => {
                    const rowName = row.name || (row.description ? row.description.replace(/<[^>]*>?/gm, '').substring(0, 50) + '...' : 'Untitled Item');
                    const sectionTag = row.section === 'estimator' ? ' [Estimator]' : (row.section === 'client' ? ' [Client]' : '');
                    btcItems.push(`<li><strong>[REV ${rev.number}] ${wg.number}${sectionTag}</strong>: ${rowName}</li>`);
                });
            });
        });

        const subject = `BTC Items Summary - ${jobAddress}`;
        const bodyHtml = `
            <div style="font-family: sans-serif; color: #333;">
                <p>Hi ${builderName},</p>
                <p>Please review the following Builder to Confirm (BTC) items for <strong>${jobAddress}</strong>:</p>
                <ul>
                    ${btcItems.join('')}
                </ul>
                <p>Please find the full BTC Summary PDF attached for your records. Please confirm these details at your earliest convenience.</p>
                <p>Regards,<br/><strong>Price A Plan Team</strong></p>
            </div>
        `;

        // 2. Convert PDF Blob to Base64 for Graph API
        const base64Content = await this.blobToBase64(pdfBlob);
        const fileName = `[BTC SUMMARY] ${checklist.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;

        // 3. Send via Graph API
        const emailService = getGraphEmailService();
        
        // Split and trim recipients in case multiple are provided via semicolon or comma
        const recipients = AppConfig.admin.btcAdminEmail
            .split(/[;,]/)
            .map(e => e.trim())
            .filter(e => e.length > 0);

        await emailService.sendEmail({
            toRecipients: recipients,
            subject: subject,
            bodyHtml: bodyHtml,
            attachments: [{
                name: fileName,
                contentType: "application/pdf",
                contentBytes: base64Content
            }]
        });
    }

    private blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                // Remove the data aspect e.g "data:application/pdf;base64,"
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
}
