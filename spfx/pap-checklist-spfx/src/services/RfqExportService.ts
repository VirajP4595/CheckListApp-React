import jsPDF from 'jspdf';
import autoTable, { CellHookData } from 'jspdf-autotable';
import { Checklist, ChecklistRow, Workgroup, RfqLineItem } from '../models';
import { PdfGeneratorService } from './PdfGeneratorService';

// ─── Types ───────────────────────────────────────────────

export interface SupplierGroup {
    /** Normalized email used as the grouping key (lowercased, trimmed). */
    email: string;
    /** Best-effort display name: first non-empty supplierName seen. */
    name: string;
    /** Rows belonging to this supplier (answer === 'RFQ'). */
    rows: ChecklistRow[];
    /** First non-empty specifiedBy seen among the rows. */
    specifiedBy: string;
}

export interface SendRfqSummary {
    sent: string[];                     // supplier emails successfully sent
    failed: { email: string; error: string }[];
    skippedRowsNoEmail: number;         // RFQ rows without a supplier email
    totalRfqRows: number;
    /** True when the shared mailbox was refused and we fell back to the signed-in user's mailbox. */
    sentFromUserMailbox?: boolean;
    /** True when the shared mailbox was refused and the user chose not to fall back. */
    fallbackDeclined?: boolean;
}

// ─── Service ─────────────────────────────────────────────

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
     * Legacy: generate the full RFQ summary PDF via the shared PdfGeneratorService.
     * Still used by the CSV / full-summary email path.
     */
    public async generateRfqPdf(
        checklist: Checklist,
        brandingLogoBlob: Blob | null,
        onProgress: (status: string, percent: number) => boolean,
        papLogoBlob?: Blob | null
    ): Promise<Blob> {
        const rfqChecklist = this.filterRfqChecklist(checklist);
        const pdfService = new PdfGeneratorService(rfqChecklist);
        return pdfService.generate(brandingLogoBlob, onProgress, papLogoBlob);
    }

    // ─── Per-supplier email flow ────────────────────────────

    /**
     * Groups RFQ rows by supplier email. Rows without a valid email are flagged separately.
     */
    public groupBySupplier(checklist: Checklist): { groups: SupplierGroup[]; skippedRowsNoEmail: number; totalRfqRows: number } {
        const rfqChecklist = this.filterRfqChecklist(checklist);
        const byEmail = new Map<string, SupplierGroup>();
        let skippedRowsNoEmail = 0;
        let totalRfqRows = 0;

        for (const wg of rfqChecklist.workgroups) {
            for (const row of wg.rows) {
                totalRfqRows++;
                const rawEmail = (row.supplierEmail || '').trim().toLowerCase();
                if (!rawEmail || !this.isValidEmail(rawEmail)) {
                    skippedRowsNoEmail++;
                    continue;
                }
                const existing = byEmail.get(rawEmail);
                if (existing) {
                    existing.rows.push(row);
                    if (!existing.name && row.supplierName) existing.name = row.supplierName.trim();
                    if (!existing.specifiedBy && row.specifiedBy) existing.specifiedBy = row.specifiedBy.trim();
                } else {
                    byEmail.set(rawEmail, {
                        email: rawEmail,
                        name: (row.supplierName || '').trim(),
                        rows: [row],
                        specifiedBy: (row.specifiedBy || '').trim(),
                    });
                }
            }
        }

        return {
            groups: Array.from(byEmail.values()),
            skippedRowsNoEmail,
            totalRfqRows,
        };
    }

    /**
     * Main entry: send one email per unique supplier with a supplier-scoped PDF attached.
     * Uses the shared mailbox configured in AppConfig.admin.rfqSenderMailbox.
     */
    public async sendRfqEmailsPerSupplier(
        checklist: Checklist,
        onProgress?: (status: string, percent: number) => void,
        /**
         * Called when the shared mailbox refuses the send (no Send-As).
         * Resolve `true` to continue the batch from the signed-in user's own mailbox,
         * `false` to abort the remaining sends.
         */
        onPermissionFallback?: (sharedMailbox: string) => Promise<boolean>
    ): Promise<SendRfqSummary> {
        const { getGraphEmailService } = await import(/* webpackChunkName: 'rfq-email' */ './serviceFactory');
        const { AppConfig } = await import(/* webpackChunkName: 'rfq-email' */ '../config/environment');

        const { groups, skippedRowsNoEmail, totalRfqRows } = this.groupBySupplier(checklist);

        if (totalRfqRows === 0) {
            throw new Error('No RFQ items found.');
        }
        if (groups.length === 0) {
            throw new Error('No RFQ rows have a valid supplier email.');
        }

        const emailService = getGraphEmailService();
        const sharedMailbox = AppConfig.admin.rfqSenderMailbox;
        // Once a shared-mailbox send is rejected with a permission error, fall back to /me
        // for the rest of the batch so we don't keep retrying the same forbidden endpoint.
        let useSharedMailbox = !!sharedMailbox;
        let fellBackToUserMailbox = false;

        const summary: SendRfqSummary = {
            sent: [],
            failed: [],
            skippedRowsNoEmail,
            totalRfqRows,
        };

        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            const progressBase = Math.round((i / groups.length) * 100);
            onProgress?.(`Sending to ${group.email}...`, progressBase);

            try {
                const pdfBlob = this.buildSupplierRfqPdf(checklist, group);
                const contentBytes = await this.blobToBase64(pdfBlob);

                const jobName = checklist.jobDetails?.siteAddress
                    || checklist.jobDetails?.jobName
                    || checklist.title
                    || 'Job';
                const safeJob = jobName.replace(/[^a-z0-9]+/gi, '_').slice(0, 60);
                const fileName = `RFQ - ${safeJob}.pdf`;

                const bodyHtml = this.buildEmailBody({
                    supplierName: group.name,
                    buildersName: checklist.jobDetails?.builderName || '',
                    accountName: checklist.jobDetails?.clientName || '',
                    specifiedBy: group.specifiedBy,
                    jobName,
                });

                const basePayload = {
                    toRecipients: [group.email],
                    subject: 'Request for Quote',
                    bodyHtml,
                    attachments: [{
                        name: fileName,
                        contentType: 'application/pdf',
                        contentBytes,
                    }],
                };

                if (useSharedMailbox) {
                    try {
                        await emailService.sendEmail({ ...basePayload, senderMailbox: sharedMailbox });
                    } catch (sharedErr: any) {
                        if (this.isPermissionError(sharedErr)) {
                            console.warn(`[RFQ] Shared mailbox '${sharedMailbox}' send refused (no Send-As permission).`, sharedErr);

                            // Ask the caller (UI) whether to retry from the user's own mailbox.
                            const consent = onPermissionFallback
                                ? await onPermissionFallback(sharedMailbox)
                                : false;

                            if (!consent) {
                                summary.fallbackDeclined = true;
                                // Mark this supplier as failed and stop trying further sends.
                                summary.failed.push({
                                    email: group.email,
                                    error: `Shared mailbox '${sharedMailbox}' refused the send and the user declined to send from their own mailbox.`,
                                });
                                // Mark every remaining supplier as skipped/failed too.
                                for (let j = i + 1; j < groups.length; j++) {
                                    summary.failed.push({
                                        email: groups[j].email,
                                        error: 'Skipped — send aborted after shared mailbox was refused.',
                                    });
                                }
                                onProgress?.('Cancelled', 100);
                                return summary;
                            }

                            useSharedMailbox = false;
                            fellBackToUserMailbox = true;
                            // Retry this supplier from the user's own mailbox.
                            await emailService.sendEmail(basePayload);
                        } else {
                            throw sharedErr;
                        }
                    }
                } else {
                    await emailService.sendEmail(basePayload);
                }

                summary.sent.push(group.email);
            } catch (err: any) {
                console.error(`[RFQ] Failed to send to ${group.email}`, err);
                summary.failed.push({
                    email: group.email,
                    error: err?.message || 'Unknown error',
                });
            }
        }

        if (fellBackToUserMailbox) {
            summary.sentFromUserMailbox = true;
        }

        onProgress?.('Done', 100);
        return summary;
    }

    /**
     * True if the Graph error indicates the signed-in user can't send from the
     * requested mailbox (no Send-As / Send-On-Behalf rights).
     */
    private isPermissionError(err: any): boolean {
        const status = err?.statusCode || err?.status || err?.response?.status;
        if (status === 403) return true;
        const code: string = (err?.code || err?.body?.error?.code || '').toString();
        const message: string = (err?.message || err?.body?.error?.message || '').toString().toLowerCase();
        if (/forbidden|accessdenied|erroraccessdenied|unauthorized/i.test(code)) return true;
        if (/access\s*denied|forbidden|not allowed|do(es)?n'?t have permission|insufficient privileges|send.?as/.test(message)) return true;
        return false;
    }

    // ─── Email body ─────────────────────────────────────────

    private buildEmailBody(tokens: {
        supplierName: string;
        buildersName: string;
        accountName: string;
        specifiedBy: string;
        jobName: string;
    }): string {
        const esc = (s: string) => (s || '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c] as string));

        const supplierName = esc(tokens.supplierName) || 'there';
        const buildersName = esc(tokens.buildersName);
        const accountName = esc(tokens.accountName);
        const specifiedBy = esc(tokens.specifiedBy);
        const jobName = esc(tokens.jobName);

        return `
<div style="font-family: Calibri, Arial, sans-serif; font-size: 14px; color: #222; line-height: 1.5;">
  <p>Hi ${supplierName},</p>
  <p>Price A Plan is a residential estimating company and we are completing a tender on behalf of <strong>${buildersName}</strong>${accountName ? ` of <strong>${accountName}</strong>` : ''} with the following details:</p>
  <p>
    <strong>Product Specified by:</strong> ${specifiedBy}<br/>
    <strong>Job Address:</strong> ${jobName}
  </p>
  <p>Please find attached a pdf with all the specified items we require quotes, and please include any shipping costs should this apply.</p>
  <p>Please reply to this email with your quote, or for any further product follow up questions.</p>
  <p>To confirm if the job proceeds, please reach out to the builder.</p>
  <p>If you require anything further please reply to us to ask.</p>
  <p>Regards,<br/>Price A Plan Estimating Team</p>
</div>`.trim();
    }

    // ─── Supplier-scoped PDF builder (self-contained; does not touch PdfGeneratorService) ─

    /**
     * Builds a compact PDF containing only the given supplier's RFQ rows.
     * Renders one 5-column table per row: Item No. / Description / Image / Qty / Unit.
     * Preferentially reads row.rfqLineItems. Falls back to a single summary line if empty.
     */
    public buildSupplierRfqPdf(checklist: Checklist, group: SupplierGroup): Blob {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const marginX = 14;

        // Header
        doc.setFillColor(10, 109, 188); // PAP blue
        doc.rect(0, 0, pageWidth, 22, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('Request for Quote', marginX, 14);

        doc.setTextColor(33, 33, 33);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        let cursorY = 30;

        const metaLines: string[] = [];
        if (group.name) metaLines.push(`Supplier: ${group.name}`);
        metaLines.push(`Email: ${group.email}`);
        if (checklist.jobDetails?.jobName) metaLines.push(`Job: ${checklist.jobDetails.jobName}`);
        if (checklist.jobDetails?.builderName) metaLines.push(`Builder: ${checklist.jobDetails.builderName}`);
        if (group.specifiedBy) metaLines.push(`Specified by: ${group.specifiedBy}`);
        metaLines.push(`Generated: ${new Date().toLocaleDateString()}`);

        for (const line of metaLines) {
            doc.text(line, marginX, cursorY);
            cursorY += 5;
        }
        cursorY += 2;

        // Per-row tables
        for (let idx = 0; idx < group.rows.length; idx++) {
            const row = group.rows[idx];
            const rowTitle = (row.name || 'RFQ Item').trim();

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text(`${idx + 1}. ${rowTitle}`, marginX, cursorY);
            cursorY += 5;

            const lineItems = row.rfqLineItems && row.rfqLineItems.length > 0
                ? row.rfqLineItems
                : this.synthesizeLineItemsFallback(row);

            const imageByLine = new Map<number, string>();
            lineItems.forEach((li, i) => {
                if (li.imageId) {
                    const img = row.images.find(m => m.id === li.imageId);
                    if (img) imageByLine.set(i, img.source);
                }
            });

            const body = lineItems.map((li) => [
                li.itemNo || '',
                this.stripHtml(li.description || ''),
                '', // image cell — painted in didDrawCell
                li.qty || '',
                li.unit || '',
            ]);

            autoTable(doc, {
                startY: cursorY,
                head: [['Item No.', 'Description', 'Image', 'Qty', 'Unit']],
                body,
                theme: 'grid',
                styles: {
                    fontSize: 9,
                    cellPadding: 2,
                    valign: 'middle',
                    minCellHeight: 35,
                    overflow: 'linebreak',
                },
                headStyles: {
                    fillColor: [10, 109, 188],
                    textColor: [255, 255, 255],
                    halign: 'center',
                    fontStyle: 'bold',
                },
                columnStyles: {
                    0: { cellWidth: 18, halign: 'center' },
                    1: { cellWidth: 'auto' },
                    2: { cellWidth: 50, halign: 'center' },
                    3: { cellWidth: 20, halign: 'center' },
                    4: { cellWidth: 18, halign: 'center' },
                },
                margin: { left: marginX, right: marginX },
                didDrawCell: (data: CellHookData) => {
                    if (data.section !== 'body' || data.column.index !== 2) return;
                    const dataUrl = imageByLine.get(data.row.index);
                    if (!dataUrl) return;
                    try {
                        const fmt = this.detectImageFormat(dataUrl);
                        const pad = 2;
                        const maxW = data.cell.width - pad * 2;
                        const maxH = data.cell.height - pad * 2;
                        doc.addImage(
                            dataUrl,
                            fmt,
                            data.cell.x + pad,
                            data.cell.y + pad,
                            maxW,
                            maxH,
                            undefined,
                            'FAST'
                        );
                    } catch (e) {
                        console.warn('[RFQ] Failed to embed line-item image', e);
                    }
                },
            });

            const finalY = (doc as any).lastAutoTable?.finalY || cursorY;
            cursorY = finalY + 6;

            if (cursorY > 270 && idx < group.rows.length - 1) {
                doc.addPage();
                cursorY = 20;
            }
        }

        return doc.output('blob');
    }

    /**
     * If a row has no rfqLineItems authored yet, emit a single fallback row
     * so the supplier still receives a quote-ready PDF.
     */
    private synthesizeLineItemsFallback(row: ChecklistRow): RfqLineItem[] {
        const description = this.stripHtml(row.description || row.notes || row.name || '');
        const imageId = row.images.length > 0 ? row.images[0].id : undefined;
        return [{
            id: `fallback-${row.id}`,
            itemNo: '1',
            description,
            qty: '',
            unit: '',
            imageId,
        }];
    }

    private stripHtml(html: string): string {
        if (!html) return '';
        return html
            .replace(/<br\s*\/?\s*>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();
    }

    private detectImageFormat(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
        const head = dataUrl.slice(0, 40).toLowerCase();
        if (head.includes('image/jpeg') || head.includes('image/jpg')) return 'JPEG';
        if (head.includes('image/webp')) return 'WEBP';
        return 'PNG';
    }

    private isValidEmail(email: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
