
import jsPDF from 'jspdf';
import { Checklist, Workgroup, ChecklistRow, AnswerState, ANSWER_CONFIG } from '../models';
import { PdfRichTextRenderer, BRAND_COLORS } from '../utils/pdfRichTextRenderer';
import { getImageService } from './serviceFactory';

export class PdfGeneratorService {

    private checklist: Checklist;
    private renderer: PdfRichTextRenderer;

    constructor(checklist: Checklist) {
        this.checklist = checklist;
        // Temporary placeholder, renderer is initialized inside generate()
        this.renderer = new PdfRichTextRenderer(new jsPDF());
    }

    /**
     * Main Generation Function (Manual Layout Engine)
     */
    public async generate(
        brandingLogoBlob: Blob | null,
        onProgress: (status: string, percent: number) => boolean,
        papLogoBlob?: Blob | null
    ): Promise<Blob> {


        // 1. Setup Document
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        this.renderer = new PdfRichTextRenderer(doc);

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = { top: 35, topContinuation: 12, bottom: 14, left: 14, right: 14 };
        const contentWidth = pageWidth - margin.left - margin.right;

        let logoDataUrl: string | undefined = undefined;
        if (brandingLogoBlob) {
            if (!onProgress("Processing Branding...", 5)) throw new Error("Cancelled");
            logoDataUrl = await this.readBlobAsDataURL(brandingLogoBlob);
        }

        let logoRatio = 1;
        if (logoDataUrl) {
            try {
                const props = await this.getImageProperties(logoDataUrl);
                logoRatio = props.ratio;
            } catch (e) { console.warn("Logo dimensions unknown", e); }
        }

        // PAP Company Logo (Top Left)
        let papLogoDataUrl: string | undefined = undefined;
        let papLogoRatio = 1;
        if (papLogoBlob) {
            try {
                papLogoDataUrl = await this.readBlobAsDataURL(papLogoBlob);
                const props = await this.getImageProperties(papLogoDataUrl);
                papLogoRatio = props.ratio;
            } catch (e) { console.warn("PAP Logo dimensions unknown", e); }
        }

        // --- Layout Helpers ---
        let cursorY = margin.top;

        const drawHeader = () => {
            // Background
            doc.setFillColor(BRAND_COLORS.WHITE);
            doc.rect(0, 0, pageWidth, 30, 'F'); // White background for header

            // PAP Logo (Top Left)
            let textStartX = margin.left;
            if (papLogoDataUrl) {
                const papMaxH = 21;
                const papLogoH = papMaxH;
                const papLogoW = papLogoH * papLogoRatio;
                const papLogoX = margin.left;
                const papLogoY = 5; // 5mm from top
                doc.addImage(papLogoDataUrl, 'PNG', papLogoX, papLogoY, papLogoW, papLogoH);
                textStartX = margin.left + papLogoW + 3; // Shift text right of PAP logo
            }

            // 1. Job Name
            doc.setFontSize(10);
            doc.setTextColor(BRAND_COLORS.GRAY);
            doc.setFont('helvetica', 'bold');
            const jobName = this.checklist.jobDetails?.jobName || '';
            doc.text(jobName.toUpperCase(), textStartX, 10);

            // 2. Checklist Title
            doc.setFontSize(18);
            doc.setTextColor(BRAND_COLORS.BLACK);
            doc.setFont('helvetica', 'bold');
            doc.text(this.checklist.title, textStartX, 18);

            // 3. Metadata Line (Client | Status | Rev | Date)
            doc.setFontSize(9);
            doc.setTextColor(BRAND_COLORS.GRAY);
            doc.setFont('helvetica', 'normal');

            const clientName = this.checklist.jobDetails?.clientName ? `${this.checklist.jobDetails.clientName} | ` : '';
            const jobType = this.checklist.jobDetails?.jobType ? `${this.checklist.jobDetails.jobType} | ` : '';
            const statusLabel = (this.checklist.status || 'Draft').toUpperCase();
            const revLabel = `Rev ${this.checklist.currentRevisionNumber}`;
            const dateLabel = new Date().toLocaleDateString();

            doc.text(`${clientName}${jobType}${statusLabel} | ${revLabel} | ${dateLabel}`, textStartX, 24);

            // Blue Separator Line
            const lineY = 28;
            doc.setDrawColor(BRAND_COLORS.BLUE);
            doc.setLineWidth(0.5);
            doc.line(margin.left, lineY, pageWidth - margin.right, lineY);

            // Client/Branding Logo (Right Aligned, Maximize Height)
            if (logoDataUrl) {
                const maxH = 21;
                const logoH = maxH;
                const logoW = logoH * logoRatio;
                const logoX = pageWidth - margin.right - logoW;
                const logoY = lineY - logoH - 1;
                doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoW, logoH);
            }
        };

        const drawFooter = (page: number, totalPages: string) => {
            const footerY = pageHeight - 10;
            doc.setFontSize(8);
            doc.setTextColor(BRAND_COLORS.GRAY);
            doc.text(`Page ${page} of ${totalPages}`, pageWidth / 2, footerY, { align: 'center' });
            if (this.checklist.jobDetails?.jobName) {
                doc.text(this.checklist.jobDetails.jobName, margin.left, footerY);
            }
            // Builder business name (right-aligned)
            if (this.checklist.jobDetails?.builderName) {
                doc.text(this.checklist.jobDetails.builderName, pageWidth - margin.right, footerY, { align: 'right' });
            }
        };

        const checkPageBreak = (heightNeeded: number) => {
            if (cursorY + heightNeeded > pageHeight - margin.bottom) {
                doc.addPage();
                cursorY = margin.topContinuation;
                return true;
            }
            return false;
        };

        // Reusable section divider — consistent line between major sections
        const drawSectionDivider = () => {
            cursorY += 2;
            doc.setDrawColor('#b0b8c4');
            doc.setLineWidth(0.5);
            doc.line(margin.left, cursorY, pageWidth - margin.right, cursorY);
            cursorY += 3;
        };

        // Initialize Page 1
        drawHeader();

        // ─── Common Notes Section (before workgroups) ───
        if (this.checklist.commonNotes && this.checklist.commonNotes.length > 0) {
            checkPageBreak(12);
            doc.setFillColor(BRAND_COLORS.HEADER_BG);
            doc.rect(margin.left, cursorY, contentWidth, 7, 'F');
            doc.setFontSize(9);
            doc.setTextColor(BRAND_COLORS.WHITE);
            doc.setFont('helvetica', 'bold');
            doc.text('GENERAL NOTES', margin.left + 2, cursorY + 4.8);
            cursorY += 7;

            for (const section of this.checklist.commonNotes) {
                // Skip sections with no meaningful content (empty paragraphs, whitespace-only, etc.)
                const stripped = (section.content || '').replace(/<[^>]*>/g, '').trim();
                if (!stripped) continue;
                checkPageBreak(10);
                doc.setFontSize(8);
                doc.setTextColor('#333333');
                doc.setFont('helvetica', 'bold');
                doc.text(section.title, margin.left + 2, cursorY + 3.5);
                cursorY += 5;

                doc.setFont('helvetica', 'normal');
                const rendered = this.renderer.render(
                    section.content, margin.left + 2, cursorY,
                    contentWidth - 4, pageHeight - margin.bottom,
                    () => { doc.addPage(); return margin.topContinuation; }
                );
                cursorY = rendered + 1;
            }
            drawSectionDivider();
        }

        // 2. Loop & Draw (Manual Engine)
        let totalItems = 0;
        this.checklist.workgroups.forEach(wg => { totalItems += wg.rows.length; });
        let processedItems = 0;

        // ─── TABLE-BASED LANDSCAPE LAYOUT ───
        // Column widths for the 4-column table (Key | Item | Description | Image)
        const col = {
            keyW: 30,
            itemW: 40,
            descW: contentWidth - 30 - 40 - 84,  // flexible middle (~115mm)
            imgW: 84,
        };
        const colX = {
            key: margin.left,
            item: margin.left + col.keyW,
            desc: margin.left + col.keyW + col.itemW,
            img: margin.left + col.keyW + col.itemW + (contentWidth - 30 - 40 - 84),
        };
        const minRowH = 7; // minimum row height

        /**
         * Draw a combined section + table header in ONE row (saves one row per section).
         * Section label appears in italic in the Key column area.
         * Item / Description / Image column labels appear in their respective columns.
         */
        const drawSectionAndTableHeader = (label: string) => {
            checkPageBreak(7);
            doc.setFillColor('#d6dce4');
            doc.rect(margin.left, cursorY, contentWidth, 6.5, 'F');

            // Key column: show section label in italic (replaces generic "Key" label)
            doc.setFontSize(6.5);
            doc.setTextColor('#1a3a5c');
            doc.setFont('helvetica', 'bolditalic');
            doc.text(label, colX.key + 2, cursorY + 4.2);

            // Item, Description, Image column labels
            doc.setFont('helvetica', 'bold');
            doc.setTextColor('#333333');
            doc.text('Item', colX.item + 2, cursorY + 4.2);
            doc.text('Description', colX.desc + 2, cursorY + 4.2);
            doc.text('Image', colX.img + 2, cursorY + 4.2);

            // Column dividers
            doc.setDrawColor('#b0b8c4'); doc.setLineWidth(0.2);
            doc.line(colX.item, cursorY, colX.item, cursorY + 6.5);
            doc.line(colX.desc, cursorY, colX.desc, cursorY + 6.5);
            doc.line(colX.img, cursorY, colX.img, cursorY + 6.5);
            cursorY += 6.5;
        };

        const renderWorkgroup = async (wg: Workgroup, totalItemsCount: number, showAllRows = false) => {
            // Pre-calculate visible rows for this workgroup
            // showAllRows = true for revision workgroups (show all rows regardless of answer)
            const visibleRows = wg.rows.filter((row: ChecklistRow) => {
                const isBtcExport = this.checklist.title.startsWith('[BTC');
                if (isBtcExport) return row.builderToConfirm;
                if (row.internalOnly) return false;
                const hasDescription = !!(row.description?.trim() || row.notes?.trim());
                const hasImages = !!(row.images && row.images.length > 0 && row.images.some((img: any) => !!img.source));
                const hasAnswer = !!(row.answer && row.answer !== 'BLANK');
                // Hide rows with no meaningful content — name alone is not enough
                if (!hasAnswer && !hasDescription && !hasImages && !row.builderToConfirm) return false;
                // In main checklist (not showAllRows): also hide BLANK answer rows
                if (!showAllRows && !hasAnswer && !row.builderToConfirm) return false;
                return true;
            });

            if (visibleRows.length === 0) return;

            // -- Workgroup Header (dark blue, name + number on one line) --
            checkPageBreak(10);
            doc.setFillColor(BRAND_COLORS.HEADER_BG);
            doc.rect(margin.left, cursorY, contentWidth, 7, 'F');
            doc.setFontSize(9);
            doc.setTextColor(BRAND_COLORS.WHITE);
            doc.setFont('helvetica', 'bold');
            // Number badge on left, name after it — all on one line
            doc.text(`${wg.number}  ${wg.name}`, margin.left + 2, cursorY + 4.8);
            cursorY += 7;

            // Group rows by section
            const sections = [
                { id: 'client', label: 'Client/Checklist Notes:', bgColor: '#ffffff', rows: visibleRows.filter(r => r.section === 'client' || !r.section) },
                { id: 'estimator', label: 'Estimator Notes:', bgColor: '#e8f5e9', rows: visibleRows.filter(r => r.section === 'estimator') },
                { id: 'reviewer', label: 'Reviewer Notes:', bgColor: '#f3e8fd', rows: visibleRows.filter(r => r.section === 'reviewer') }
            ];

            for (const section of sections) {
                if (section.rows.length === 0) continue;

                drawSectionAndTableHeader(section.label);

                for (const row of section.rows) {
                    processedItems++;
                    if (totalItemsCount > 0) {
                        if (!onProgress(`Drawing Row ${processedItems}...`, 10 + (processedItems / totalItemsCount) * 85)) {
                            throw new Error("Cancelled");
                        }
                    }

                    const answerConf = ANSWER_CONFIG[row.answer as AnswerState] || ANSWER_CONFIG.BLANK;
                    const rowStartY = cursorY;

                    // ── Pre-calculate content heights for each column ──
                    // Col 3 (Description): rich text + supplier + RFQ table + notes
                    let descContentH = 1; // top padding
                    const descColW = col.descW - 4; // inner padding

                    // Description text height — use rich text renderer for accurate measurement
                    if (row.description) {
                        const descMeasured = this.renderer.measureHeight(row.description, descColW);
                        descContentH += descMeasured + 1;
                    }

                    // Notes text height
                    if (row.notes) {
                        const notesMeasured = this.renderer.measureHeight(row.notes, descColW);
                        descContentH += notesMeasured + 1;
                    }

                    // RFQ extras
                    if (row.answer === 'RFQ') {
                        if (row.supplierName || row.supplierEmail) descContentH += 7;
                        if (row.rfqLineItems && row.rfqLineItems.length > 0) {
                            descContentH += 5 + row.rfqLineItems.length * 4.5 + 1;
                        }
                    }
                    descContentH = Math.max(descContentH, minRowH);

                    // Col 4 (Image): prepare all images, but only first goes in this row
                    const imgColInnerW = col.imgW - 4;
                    const imageDataUrls: { dataUrl: string; format: string; w: number; h: number; caption?: string }[] = [];
                    if (row.images && row.images.length > 0) {
                        for (const img of row.images) {
                            if (!img.source) continue;
                            try {
                                let d = img.source;
                                if (d.startsWith('http') || d.startsWith('blob:')) {
                                    const r = await fetch(d).catch(() => null);
                                    if (!r || !r.ok) continue;
                                    const b = await r.blob();
                                    d = await this.readBlobAsDataURL(b);
                                }
                                d = await this.compressImageForPdf(d);
                                const props = await this.getImageProperties(d).catch(() => ({ ratio: 1.77, width: 0, height: 0 }));
                                const maxImgH = 30;
                                const imgH = Math.min(maxImgH, imgColInnerW / props.ratio);
                                const imgW = imgH * props.ratio;
                                imageDataUrls.push({ dataUrl: d, format: 'JPEG', w: Math.min(imgW, imgColInnerW), h: imgH, caption: img.caption });
                            } catch (e) {
                                console.warn('[PDF] Image prep failed', e);
                            }
                        }
                    }
                    // Only first image height counts toward the main row
                    const firstImgH = imageDataUrls.length > 0
                        ? 1 + imageDataUrls[0].h + (imageDataUrls[0].caption ? 4.5 : 1)
                        : minRowH;
                    const imgContentH = Math.max(firstImgH, minRowH);

                    // Final row height = max of all columns (only 1 image factored in)
                    const finalRowH = Math.max(descContentH, imgContentH, minRowH);

                    // Page break check
                    if (cursorY + finalRowH > pageHeight - margin.bottom) {
                        doc.addPage();
                        cursorY = margin.topContinuation;
                    }

                    // ── Draw row background ──
                    // TBC / Confirmation Required → red overrides section color
                    const rowBg = row.answer === 'TBC'
                        ? '#fce4ec' // Red/pink for Confirmation Required
                        : section.id === 'estimator' ? '#e8f5e9'
                        : section.id === 'reviewer' ? '#f3e8fd'
                        : '#ffffff';
                    doc.setFillColor(rowBg);
                    doc.rect(margin.left, cursorY, contentWidth, finalRowH, 'F');

                    // ── Col 1: Key (answer pill) ──
                    const pillW = Math.min(doc.getTextWidth(answerConf.label) * 1.2 + 6, col.keyW - 4);
                    const pillX = colX.key + 2;
                    const pillY = cursorY + 2;
                    doc.setFillColor(answerConf.color);
                    doc.roundedRect(pillX, pillY, pillW, 5, 1.5, 1.5, 'F');
                    doc.setTextColor(BRAND_COLORS.WHITE);
                    doc.setFontSize(7);
                    doc.setFont('helvetica', 'bold');
                    doc.text(answerConf.label, pillX + pillW / 2, pillY + 3.5, { align: 'center' });

                    // ── Col 2: Item name ──
                    doc.setTextColor(BRAND_COLORS.BLACK);
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'bold');
                    const itemName = row.name || '';
                    const itemLines = doc.splitTextToSize(itemName, col.itemW - 4);
                    doc.text(itemLines, colX.item + 2, cursorY + 5);

                    // ── Col 3: Description + Notes + RFQ ──
                    let dY = cursorY + 2;
                    const dX = colX.desc + 2;

                    if (row.description) {
                        doc.setFontSize(8);
                        doc.setTextColor('#323130');
                        doc.setFont('helvetica', 'normal');
                        dY = this.renderer.render(
                            row.description, dX, dY, descColW,
                            cursorY + finalRowH, // constrain to row bounds
                            () => { /* no page break inside cell */ return dY; }
                        ) + 1;
                    }

                    // RFQ Supplier
                    if (row.answer === 'RFQ' && (row.supplierName || row.supplierEmail)) {
                        dY += 1;
                        doc.setFontSize(7); doc.setTextColor('#0078d4'); doc.setFont('helvetica', 'bold');
                        doc.text('Supplier:', dX, dY + 3);
                        doc.setFont('helvetica', 'normal'); doc.setTextColor('#004578');
                        const supplierText = [row.supplierName, row.supplierEmail].filter(Boolean).join(' | ');
                        doc.text(supplierText, dX + 16, dY + 3);
                        dY += 5;
                    }

                    // RFQ Line Items Table (compact inside desc column)
                    if (row.answer === 'RFQ' && row.rfqLineItems && row.rfqLineItems.length > 0) {
                        const tblW = descColW;
                        const liColW = { itemNo: 14, desc: tblW - 42, qty: 14, unit: 14 };
                        const liRowH = 4.5;
                        // Header
                        doc.setFillColor('#e3f2fd');
                        doc.rect(dX, dY, tblW, liRowH, 'F');
                        doc.setFontSize(6.5); doc.setTextColor('#333'); doc.setFont('helvetica', 'bold');
                        let lX = dX + 1;
                        doc.text('No.', lX, dY + 3); lX += liColW.itemNo;
                        doc.text('Description', lX, dY + 3); lX += liColW.desc;
                        doc.text('Qty', lX, dY + 3); lX += liColW.qty;
                        doc.text('Unit', lX, dY + 3);
                        dY += liRowH;
                        // Data rows
                        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
                        for (let li = 0; li < row.rfqLineItems.length; li++) {
                            const item = row.rfqLineItems[li];
                            if (li % 2 === 1) { doc.setFillColor('#f8f8f8'); doc.rect(dX, dY, tblW, liRowH, 'F'); }
                            doc.setTextColor('#333');
                            lX = dX + 1;
                            doc.text(item.itemNo || '', lX, dY + 3); lX += liColW.itemNo;
                            doc.text((item.description || '').substring(0, 60), lX, dY + 3); lX += liColW.desc;
                            doc.text(item.qty || '', lX, dY + 3); lX += liColW.qty;
                            doc.text(item.unit || '', lX, dY + 3);
                            dY += liRowH;
                        }
                        dY += 1;
                    }

                    // Notes
                    if (row.notes) {
                        dY += 1;
                        doc.setFontSize(7.5);
                        doc.setTextColor('#555555');
                        doc.setFont('helvetica', 'normal');
                        dY = this.renderer.render(
                            row.notes, dX, dY, descColW,
                            cursorY + finalRowH,
                            () => { return dY; }
                        ) + 1;
                    }

                    // ── Col 4: First image only in this row ──
                    const iX = colX.img + 2;
                    if (imageDataUrls.length > 0) {
                        let iY = cursorY + 2;
                        const firstImg = imageDataUrls[0];
                        if (firstImg.caption) {
                            doc.setFontSize(6.5);
                            doc.setTextColor('#333333');
                            doc.setFont('helvetica', 'bold');
                            doc.text(firstImg.caption, iX, iY + 2.5);
                            iY += 4;
                        }
                        doc.addImage(firstImg.dataUrl, firstImg.format, iX, iY, firstImg.w, firstImg.h);
                    }

                    // ── Draw cell borders ──
                    doc.setDrawColor('#b0b8c4'); doc.setLineWidth(0.15);
                    doc.rect(margin.left, cursorY, contentWidth, finalRowH, 'S');
                    doc.line(colX.item, cursorY, colX.item, cursorY + finalRowH);
                    doc.line(colX.desc, cursorY, colX.desc, cursorY + finalRowH);
                    doc.line(colX.img, cursorY, colX.img, cursorY + finalRowH);

                    cursorY += finalRowH;

                    // ── Continuation rows for additional images (1 image per row) ──
                    for (let imgIdx = 1; imgIdx < imageDataUrls.length; imgIdx++) {
                        const extraImg = imageDataUrls[imgIdx];
                        const contRowH = extraImg.h + (extraImg.caption ? 5.5 : 1.5) + 2;

                        // Page break if needed
                        if (cursorY + contRowH > pageHeight - margin.bottom) {
                            doc.addPage();
                            cursorY = margin.topContinuation;
                        }

                        // Light background for continuation row
                        doc.setFillColor(rowBg);
                        doc.rect(margin.left, cursorY, contentWidth, contRowH, 'F');

                        // Render image in col 4
                        let cY = cursorY + 1;
                        if (extraImg.caption) {
                            doc.setFontSize(6.5);
                            doc.setTextColor('#333333');
                            doc.setFont('helvetica', 'bold');
                            doc.text(extraImg.caption, iX, cY + 2.5);
                            cY += 4;
                        }
                        doc.addImage(extraImg.dataUrl, extraImg.format, iX, cY, extraImg.w, extraImg.h);

                        // Draw borders for continuation row
                        doc.setDrawColor('#b0b8c4'); doc.setLineWidth(0.15);
                        doc.rect(margin.left, cursorY, contentWidth, contRowH, 'S');
                        doc.line(colX.item, cursorY, colX.item, cursorY + contRowH);
                        doc.line(colX.desc, cursorY, colX.desc, cursorY + contRowH);
                        doc.line(colX.img, cursorY, colX.img, cursorY + contRowH);

                        cursorY += contRowH;
                    }
                }
            }
        };

        // --- SECTION: REVISION HISTORY ---
        const revisions = (this.checklist.revisions || []).sort((a, b) => b.number - a.number);
        if (revisions.length > 0) {
            checkPageBreak(20);
            doc.setFontSize(13);
            doc.setTextColor(BRAND_COLORS.BLACK);
            doc.setFont('helvetica', 'bold');
            doc.text("Revision History", margin.left, cursorY + 5);
            cursorY += 8;

            for (const rev of revisions) {
                const revWorkgroups = this.checklist.workgroups
                    .filter(wg => wg.revisionId === rev.id)
                    .sort((a, b) => a.number - b.number);
                if (revWorkgroups.length === 0 && !rev.notes) continue;

                checkPageBreak(25);
                // Revision Block Header
                doc.setFillColor('#f8f9fa');
                doc.rect(margin.left, cursorY, contentWidth, 8, 'F');
                doc.setDrawColor('#dee2e6');
                doc.rect(margin.left, cursorY, contentWidth, 8, 'S');

                doc.setFontSize(10);
                doc.setTextColor(BRAND_COLORS.BLACK);
                doc.setFont('helvetica', 'bold');
                doc.text(`REV ${rev.number}: ${rev.title}`, margin.left + 2, cursorY + 5.5);
                
                const dateStr = rev.createdAt instanceof Date ? rev.createdAt.toLocaleDateString() : new Date(rev.createdAt).toLocaleDateString();
                const dateW = doc.getTextWidth(dateStr);
                doc.setFont('helvetica', 'normal');
                doc.text(dateStr, pageWidth - margin.right - dateW - 2, cursorY + 5.5);
                cursorY += 10;

                // Revision Notes
                if (rev.notes) {
                    cursorY = this.renderer.render(rev.notes, margin.left + 2, cursorY, contentWidth - 4, pageHeight - margin.bottom, () => { doc.addPage(); return margin.topContinuation; });
                }

                // Revision Items — show all rows (including BLANK) for revision context
                for (const wg of revWorkgroups) {
                    await renderWorkgroup(wg, totalItems, true);
                }

                cursorY += 2; // Spacing between revisions
            }

            // Divider + "Original Checklist" header before main checklist
            checkPageBreak(25);
            drawSectionDivider();

            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor('#000000');
            doc.text('Original Checklist', margin.left, cursorY + 5);
            cursorY += 8;
        }

        // --- SECTION: MAIN CHECKLIST ---
        const mainWorkgroups = this.checklist.workgroups
            .filter(wg => !wg.revisionId)
            .sort((a, b) => a.number - b.number);
        for (const wg of mainWorkgroups) {
            await renderWorkgroup(wg, totalItems);
        }

        // --- Feature 1: Carpentry Labour Section ---
        if (this.checklist.carpentryLabourImageUrl) {
            checkPageBreak(40);
            // Optionally force new page if preferred
            if (cursorY > margin.top + 20) {
                doc.addPage();
                cursorY = margin.topContinuation;
            }

            doc.setFontSize(14);
            doc.setTextColor(BRAND_COLORS.BLACK);
            doc.setFont('helvetica', 'bold');
            doc.text("Carpentry Labour Cost Calculator", margin.left, cursorY + 5);
            cursorY += 12;

            if (!onProgress("Fetching Carpentry Image...", 90)) throw new Error("Cancelled");

            try {
                const carpentryBlob = await getImageService().downloadCarpentryImage(this.checklist.id);
                if (carpentryBlob) {
                    const rawDataUrl = await this.readBlobAsDataURL(carpentryBlob);
                    const dataUrl = await this.compressImageForPdf(rawDataUrl, 1200, 0.8); // wider for full-width image
                    const props = await this.getImageProperties(dataUrl);

                    const maxW = contentWidth;
                    let imgW = maxW;
                    let imgH = imgW / props.ratio;

                    if (cursorY + imgH > pageHeight - margin.bottom) {
                        const maxH = pageHeight - margin.bottom - cursorY;
                        if (imgH > maxH) {
                            imgH = maxH;
                            imgW = imgH * props.ratio;
                        }
                    }

                    // Render image (compressed to JPEG)
                    doc.addImage(dataUrl, 'JPEG', margin.left, cursorY, imgW, imgH, undefined, 'MEDIUM');
                    cursorY += imgH + 8;
                }
            } catch (err) {
                console.warn("Failed to load carpentry image for PDF", err);
            }

            if (this.checklist.carpentryLabourDescription) {
                doc.setFontSize(10);
                doc.setTextColor('#323130');
                doc.setFont('helvetica', 'normal');
                const descY = this.renderer.render(
                    this.checklist.carpentryLabourDescription,
                    margin.left,
                    cursorY,
                    contentWidth,
                    pageHeight - margin.bottom,
                    () => { doc.addPage(); cursorY = margin.topContinuation; return margin.topContinuation; }
                );
                cursorY = descY + 5;
            }
        } // End Carpentry

        // Apply Footers
        const totalPages = doc.getNumberOfPages();
        const totalPagesExp = '{total_pages_count_string}';

        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            drawFooter(i, totalPagesExp);
        }

        // Put Total Pages
        if (typeof doc.putTotalPages === 'function') {
            doc.putTotalPages(totalPagesExp);
        }

        if (!onProgress("Finalizing...", 100)) throw new Error("Cancelled");

        return doc.output('blob');
    }

    private normalizeText(text: string): string {
        if (!text) return '';
        // 1. Decode generic entities
        let clean = new DOMParser().parseFromString(text, 'text/html').body.textContent || text;

        // 2. Fix specific mojibake/encoding issues reported
        // "ðØ" appears to be some bullet or icon garbage. Replace with bullet.
        clean = clean.replace(/ðØ/g, '•');
        clean = clean.replace(/ð/g, ''); // Remove stray eth if any

        // 3. Normalize spaced text "b a s e d" -> "based"
        // This is a heuristic and might not be perfect for all cases.
        // It looks for patterns like "a b c" and collapses them to "abc".
        // It tries to avoid collapsing legitimate spaces between words.
        // Example: "b a s e d o n L o o m" -> "based on Loom"
        clean = clean.replace(/(\b\w)\s(\w\b)/g, '$1$2'); // Collapses "a b" to "ab"
        clean = clean.replace(/(\b\w)\s(\w)\s(\w\b)/g, '$1$2$3'); // Collapses "a b c" to "abc"
        clean = clean.replace(/(\b\w)\s(\w)\s(\w)\s(\w\b)/g, '$1$2$3$4'); // Collapses "a b c d" to "abcd"
        // More aggressive:
        clean = clean.replace(/([a-zA-Z])\s([a-zA-Z])\s([a-zA-Z])\s([a-zA-Z])/g, '$1$2$3$4');
        clean = clean.replace(/([a-zA-Z])\s([a-zA-Z])\s([a-zA-Z])/g, '$1$2$3');
        clean = clean.replace(/([a-zA-Z])\s([a-zA-Z])/g, '$1$2');

        // Ensure multiple spaces are collapsed to a single space after all other replacements
        clean = clean.replace(/\s+/g, ' ').trim();

        return clean;
    }

    private stripHtml(html: string) {
        return this.normalizeText(html || '').replace(/<[^>]*>?/gm, '');
    }

    private readBlobAsDataURL(blob: Blob): Promise<string> {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    }

    private getImageProperties(dataUrl: string): Promise<{ width: number; height: number; ratio: number }> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                resolve({
                    width: img.width,
                    height: img.height,
                    ratio: img.width / img.height
                });
            };
            img.onerror = reject;
            img.src = dataUrl;
        });
    }

    /**
     * Compress and resize an image to JPEG for PDF embedding.
     * Caps at 800px wide — enough for crisp 35mm PDF display at 300 DPI.
     * Converts PNG/WebP/JPEG → JPEG at 0.72 quality, typically 5–15× smaller than raw PNG.
     */
    private compressImageForPdf(dataUrl: string, maxPx: number = 800, quality: number = 0.72): Promise<string> {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const scale = Math.min(1, maxPx / img.naturalWidth);
                    canvas.width = Math.round(img.naturalWidth * scale);
                    canvas.height = Math.round(img.naturalHeight * scale);
                    const ctx = canvas.getContext('2d');
                    if (!ctx) { resolve(dataUrl); return; }
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                } catch (e) {
                    console.warn('[PDF] compressImageForPdf failed, using original', e);
                    resolve(dataUrl);
                }
            };
            img.onerror = () => resolve(dataUrl);
            img.src = dataUrl;
        });
    }

    /**
     * Re-renders an image onto a canvas at 2× native resolution and exports as PNG.
     * Preserves transparency and improves sharpness in PDF output.
     */
    private upscaleToPng(dataUrl: string, scale: number = 2): Promise<string> {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth * scale;
                    canvas.height = img.naturalHeight * scale;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) { resolve(dataUrl); return; }
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    // Do NOT fill background — preserve transparency for PNG logos
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/png'));
                } catch (e) {
                    console.warn('[PdfGeneratorService] upscaleToPng failed, using original', e);
                    resolve(dataUrl);
                }
            };
            img.onerror = () => resolve(dataUrl); // fallback to original on error
            img.src = dataUrl;
        });
    }

}
