import { Checklist, Workgroup } from '../models';
import { PdfGeneratorService } from './PdfGeneratorService';

export class RfqExportService {

    /**
     * Filters a checklist to only contain rows marked as RFQ.
     */
    public filterRfqChecklist(original: Checklist): Checklist {
        const allFilteredWorkgroups: Workgroup[] = original.workgroups.map(wg => {
            const rfqRows = (wg.rows || []).filter(row => row.answer === 'RFQ');
            
            if (rfqRows.length > 0) {
                return { ...wg, rows: rfqRows };
            }
            return null;
        }).filter((wg): wg is Workgroup => wg !== null);

        const filteredRevisions = (original.revisions || []).filter(rev => {
            return allFilteredWorkgroups.some(wg => wg.revisionId === rev.id);
        });

        return {
            ...original,
            title: `[RFQ SUMMARY] ${original.title}`,
            workgroups: allFilteredWorkgroups,
            revisions: filteredRevisions
        };
    }

    /**
     * Generates a PDF containing only RFQ items.
     */
    public async generateRfqPdf(
        checklist: Checklist,
        brandingLogoBlob: Blob | null,
        onProgress: (status: string, percent: number) => boolean
    ): Promise<Blob> {
        const rfqChecklist = this.filterRfqChecklist(checklist);
        const pdfService = new PdfGeneratorService(rfqChecklist);
        return pdfService.generate(brandingLogoBlob, onProgress);
    }

    /**
     * Sends the RFQ summary via direct Graph API email with PDF attachment.
     */
    public async sendRfqEmail(checklist: Checklist, pdfBlob: Blob): Promise<void> {
        const { getGraphEmailService } = await import('./serviceFactory');
        const { AppConfig } = await import('../config/environment');

        const rfqChecklist = this.filterRfqChecklist(checklist);
        const hasItems = rfqChecklist.workgroups.some(wg => wg.rows.length > 0);

        if (!hasItems) {
            throw new Error("No RFQ items found.");
        }

        const jobAddress = rfqChecklist.jobDetails?.siteAddress || rfqChecklist.jobDetails?.jobName || 'Job';
        const rfqItems: string[] = [];

        const mainWg = rfqChecklist.workgroups.filter(wg => !wg.revisionId).sort((a, b) => a.number - b.number);
        const revWg = rfqChecklist.workgroups.filter(wg => !!wg.revisionId).sort((a, b) => a.number - b.number);

        mainWg.forEach(wg => {
            wg.rows.forEach(row => {
                const rowName = row.name || (row.description ? row.description.replace(/<[^>]*>?/gm, '').substring(0, 50) + '...' : 'Untitled Item');
                const supplierInfo = [row.supplierName, row.supplierEmail].filter(Boolean).join(' | ');
                const supplierTag = supplierInfo ? ` (${supplierInfo})` : '';
                rfqItems.push(`<li><strong>${wg.number}</strong>: ${rowName}${supplierTag}</li>`);
            });
        });

        const sortedRevisions = (rfqChecklist.revisions || []).slice().sort((a, b) => b.number - a.number);
        sortedRevisions.forEach(rev => {
            const thisRevWorkgroups = revWg.filter(wg => wg.revisionId === rev.id);
            thisRevWorkgroups.forEach(wg => {
                wg.rows.forEach(row => {
                    const rowName = row.name || (row.description ? row.description.replace(/<[^>]*>?/gm, '').substring(0, 50) + '...' : 'Untitled Item');
                    const supplierInfo = [row.supplierName, row.supplierEmail].filter(Boolean).join(' | ');
                    const supplierTag = supplierInfo ? ` (${supplierInfo})` : '';
                    rfqItems.push(`<li><strong>[REV ${rev.number}] ${wg.number}</strong>: ${rowName}${supplierTag}</li>`);
                });
            });
        });

        const subject = `RFQ Items Summary - ${jobAddress}`;
        const bodyHtml = `
            <div style="font-family: sans-serif; color: #333;">
                <p>Hi Team,</p>
                <p>Please find the summary of Request for Quote (RFQ) items for <strong>${jobAddress}</strong>:</p>
                <ul>
                    ${rfqItems.join('')}
                </ul>
                <p>The full RFQ Summary PDF is attached. Please action these requests.</p>
                <p>Regards,<br/><strong>Price A Plan Team</strong></p>
            </div>
        `;

        const base64Content = await this.blobToBase64(pdfBlob);
        const fileName = `[RFQ SUMMARY] ${checklist.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        const emailService = getGraphEmailService();
        
        // Use the same admin email or a specific RFQ one if available in config
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
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
}
