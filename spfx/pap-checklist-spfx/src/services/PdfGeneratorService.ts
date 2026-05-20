
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
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        this.renderer = new PdfRichTextRenderer(doc);

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = { top: 35, bottom: 20, left: 14, right: 14 };
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
                const rawPapLogoDataUrl = await this.readBlobAsDataURL(papLogoBlob);
                // Upscale to 2× JPEG for crisp PDF rendering
                papLogoDataUrl = await this.upscaleToPng(rawPapLogoDataUrl);
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
                cursorY = margin.top;
                // Header is only page 1
                return true;
            }
            return false;
        };

        // Initialize Page 1
        drawHeader();

        // ─── Common Notes Section (before workgroups) ───
        if (this.checklist.commonNotes && this.checklist.commonNotes.length > 0) {
            checkPageBreak(15);
            cursorY += 2;
            doc.setFillColor(BRAND_COLORS.HEADER_BG);
            doc.rect(margin.left, cursorY, contentWidth, 8, 'F');
            doc.setFontSize(10);
            doc.setTextColor(BRAND_COLORS.WHITE);
            doc.setFont('helvetica', 'bold');
            doc.text('GENERAL NOTES', margin.left + 2, cursorY + 5.5);
            cursorY += 10;

            for (const section of this.checklist.commonNotes) {
                if (!section.content || section.content === '<p></p>') continue;
                checkPageBreak(12);
                doc.setFontSize(9);
                doc.setTextColor('#333333');
                doc.setFont('helvetica', 'bold');
                doc.text(section.title, margin.left + 2, cursorY + 4);
                cursorY += 6;

                doc.setFont('helvetica', 'normal');
                const rendered = this.renderer.render(
                    section.content, margin.left + 2, cursorY,
                    contentWidth - 4, pageHeight - margin.bottom,
                    () => { doc.addPage(); return margin.top; }
                );
                cursorY = rendered + 4;
            }
            cursorY += 2;
        }

        // 2. Loop & Draw (Manual Engine)
        let totalItems = 0;
        this.checklist.workgroups.forEach(wg => { totalItems += wg.rows.length; });
        let processedItems = 0;

        const renderWorkgroup = async (wg: Workgroup, totalItemsCount: number) => {
            // Pre-calculate visible rows for this workgroup
            const visibleRows = wg.rows.filter((row: ChecklistRow) => {
                const isBtcExport = this.checklist.title.startsWith('[BTC');
                if (isBtcExport) return row.builderToConfirm;
                if (row.internalOnly) return false;
                if (row.answer === 'BLANK' && !row.builderToConfirm) return false;
                return true;
            });

            if (visibleRows.length === 0) return;

            // -- Workgroup Header --
            checkPageBreak(15);
            cursorY += 2;
            doc.setFillColor(BRAND_COLORS.HEADER_BG);
            doc.rect(margin.left, cursorY, contentWidth, 10, 'F');
            doc.setFontSize(11);
            doc.setTextColor(BRAND_COLORS.WHITE);
            doc.setFont('helvetica', 'bold');
            doc.text(`${wg.number}  ${wg.name}`, margin.left + 2, cursorY + 7);
            cursorY += 12;

            // Group rows by section for accent color — but no section header labels
            const sections = [
                { id: 'client', accentColor: '#3b82f6', notesColor: '#555555', rows: visibleRows.filter(r => r.section === 'client' || !r.section) },
                { id: 'estimator', accentColor: '#f97316', notesColor: '#b35c00', rows: visibleRows.filter(r => r.section === 'estimator') }
            ];

            for (const section of sections) {
                if (section.rows.length === 0) continue;

                for (const row of section.rows) {
                    processedItems++;
                    if (totalItemsCount > 0) {
                        if (!onProgress(`Drawing Row ${processedItems}...`, 10 + (processedItems / totalItemsCount) * 85)) {
                            throw new Error("Cancelled");
                        }
                    }

                    const fullW = contentWidth - 4; // leave room for left accent strip
                    const textX = margin.left + 4;   // indent text past the accent strip
                    const title = row.name || this.stripHtml(row.description).substring(0, 50);
                    const answerConf = ANSWER_CONFIG[row.answer as AnswerState] || ANSWER_CONFIG.BLANK;

                    checkPageBreak(10);
                    const rowStartY = cursorY;
                    let drawY = cursorY + 2;

                    // Title + Answer pill on same line
                    if (title) {
                        doc.setTextColor(BRAND_COLORS.BLACK);
                        doc.setFontSize(10);
                        doc.setFont('helvetica', 'bold');
                        // Draw answer pill first (left of title)
                        const pillW = doc.getTextWidth(answerConf.label) + 6;
                        doc.setFillColor(answerConf.color);
                        doc.roundedRect(textX, drawY - 0.5, pillW, 4.5, 1.5, 1.5, 'F');
                        doc.setTextColor(BRAND_COLORS.WHITE);
                        doc.setFontSize(6.5);
                        doc.setFont('helvetica', 'bold');
                        doc.text(answerConf.label, textX + pillW / 2, drawY + 2.5, { align: 'center' });
                        // Title text after pill
                        doc.setTextColor(BRAND_COLORS.BLACK);
                        doc.setFontSize(10);
                        doc.setFont('helvetica', 'bold');
                        doc.text(title, textX + pillW + 3, drawY + 3);
                        drawY += 6;
                    }

                    // Description
                    if (row.description) {
                        doc.setFontSize(9);
                        doc.setTextColor('#323130');
                        doc.setFont('helvetica', 'normal');
                        drawY = this.renderer.render(row.description, textX, drawY, fullW, pageHeight - margin.bottom, () => { doc.addPage(); return margin.top; }) + 1;
                    }

                    // RFQ Supplier Block
                    if (row.answer === 'RFQ' && (row.supplierName || row.supplierEmail)) {
                        drawY += 1;
                        const sH = 8;
                        if (drawY + sH > pageHeight - margin.bottom) { doc.addPage(); drawY = margin.top + 2; }
                        doc.setFillColor('#ebf3fc'); doc.rect(textX, drawY, fullW, sH, 'F');
                        doc.setFillColor('#0078d4'); doc.rect(textX, drawY, 1.5, sH, 'F');
                        doc.setFontSize(8); doc.setTextColor('#0078d4'); doc.setFont('helvetica', 'bold');
                        doc.text("SUPPLIER:", textX + 3, drawY + 3.5);
                        doc.setFontSize(9); doc.setTextColor('#004578'); doc.setFont('helvetica', 'normal');
                        const supplierText = [row.supplierName, row.supplierEmail].filter(Boolean).join(' | ');
                        doc.text(supplierText, textX + 3, drawY + 6.5);
                        drawY += sH + 2;
                    }

                    // Notes — inline, no background box, section-colored text
                    if (row.notes) {
                        drawY += 1;
                        if (drawY > pageHeight - margin.bottom) { doc.addPage(); drawY = margin.top + 2; }
                        doc.setFontSize(8);
                        doc.setTextColor(section.notesColor);
                        doc.setFont('helvetica', 'normal');
                        drawY = this.renderer.render(row.notes, textX, drawY, fullW, pageHeight - margin.bottom, () => { doc.addPage(); return margin.top; }) + 1;
                    }

                    // Inline images — max 40mm height, full content width, vertical flow
                    if (row.images && row.images.length > 0) {
                        const maxImgH = 40; // mm
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
                                let format = 'JPEG';
                                if (d.startsWith('data:image/png')) format = 'PNG';
                                else if (d.startsWith('data:image/webp')) format = 'WEBP';
                                const props = await this.getImageProperties(d).catch(() => ({ ratio: 1.77, width: 0, height: 0 }));
                                const imgH = Math.min(maxImgH, fullW / props.ratio);
                                const imgW = imgH * props.ratio;
                                drawY += 2;
                                if (drawY + imgH > pageHeight - margin.bottom) { doc.addPage(); drawY = margin.top + 2; }
                                doc.addImage(d, format, textX, drawY, imgW, imgH);
                                drawY += imgH + 2;
                            } catch (e) {
                                console.warn('[PDF] Inline image render failed', e);
                            }
                        }
                    }

                    cursorY = drawY;

                    // Draw left-border accent strip for the whole row
                    const rowH = cursorY - rowStartY;
                    if (rowH > 0) {
                        doc.setFillColor(section.accentColor);
                        doc.rect(margin.left, rowStartY, 2, rowH, 'F');
                    }

                    // Thin divider between rows (tighter spacing)
                    doc.setDrawColor('#e1dfdd'); doc.setLineWidth(0.1);
                    doc.line(margin.left, cursorY, pageWidth - margin.right, cursorY);
                    cursorY += 3;
                }
            }
        };

        // --- SECTION: REVISION HISTORY ---
        const revisions = (this.checklist.revisions || []).sort((a, b) => b.number - a.number);
        if (revisions.length > 0) {
            checkPageBreak(20);
            doc.setFontSize(14);
            doc.setTextColor(BRAND_COLORS.BLACK);
            doc.setFont('helvetica', 'bold');
            doc.text("Revision History", margin.left, cursorY + 6);
            cursorY += 12;

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
                    cursorY = this.renderer.render(rev.notes, margin.left + 2, cursorY, contentWidth - 4, pageHeight - margin.bottom, () => { doc.addPage(); return margin.top; }) + 6;
                }

                // Revision Items
                for (const wg of revWorkgroups) {
                    await renderWorkgroup(wg, totalItems);
                }
                
                cursorY += 5; // Spacing between revisions
            }

            // Divider + "Original Checklist" header before main checklist
            checkPageBreak(25);

            // Draw full-width blue separator line
            doc.setDrawColor(BRAND_COLORS.BLUE);
            doc.setLineWidth(0.8);
            doc.line(margin.left, cursorY, pageWidth - margin.right, cursorY);
            cursorY += 4;

            // "Original Checklist" section title — reset all state explicitly
            doc.setFillColor('#ffffff');          // White bg to prevent bleed-through
            doc.rect(margin.left, cursorY, contentWidth, 10, 'F');
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor('#000000');          // Explicit hex, avoids constant resolution issues
            doc.text('Original Checklist', margin.left, cursorY + 7);
            cursorY += 14;
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
                cursorY = margin.top;
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
                    const dataUrl = await this.readBlobAsDataURL(carpentryBlob);
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

                    // Render image
                    // jsPDF handles PNG/JPEG automatically if type is passed, or we can look closely at format
                    doc.addImage(dataUrl, 'WEBP', margin.left, cursorY, imgW, imgH, undefined, 'FAST');
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
                    () => { doc.addPage(); cursorY = margin.top; return margin.top; }
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
