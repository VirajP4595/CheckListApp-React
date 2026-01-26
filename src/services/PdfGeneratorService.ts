
import jsPDF from 'jspdf';
import autoTable, { UserOptions } from 'jspdf-autotable';
import { Checklist, ANSWER_CONFIG } from '../models'; // Relative path check needed
import { PdfRichTextRenderer, BRAND_COLORS } from '../utils/pdfRichTextRenderer';
import { SharePointImageService } from './sharePointService';

export class PdfGeneratorService {

    private checklist: Checklist;
    private renderer: PdfRichTextRenderer;
    private progressCallback?: (status: string, progress: number) => boolean; // return false to cancel

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
        onProgress: (status: string, percent: number) => boolean
    ): Promise<Blob> {
        this.progressCallback = onProgress;

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

        // --- Layout Helpers ---
        let cursorY = margin.top;

        const drawHeader = () => {
            // Background
            doc.setFillColor(BRAND_COLORS.WHITE);
            doc.rect(0, 0, pageWidth, 30, 'F'); // White background for header

            // 1. Job Name (Top Left) - Replaces GUID
            doc.setFontSize(10);
            doc.setTextColor(BRAND_COLORS.GRAY);
            doc.setFont('helvetica', 'bold');
            const jobName = this.checklist.jobDetails?.jobName || '';
            doc.text(jobName.toUpperCase(), margin.left, 10);

            // 2. Checklist Title
            doc.setFontSize(18);
            doc.setTextColor(BRAND_COLORS.BLACK);
            doc.setFont('helvetica', 'bold');
            doc.text(this.checklist.title, margin.left, 18);

            // 3. Metadata Line (Client | Status | Rev | Date)
            doc.setFontSize(9);
            doc.setTextColor(BRAND_COLORS.GRAY);
            doc.setFont('helvetica', 'normal');

            const clientName = this.checklist.jobDetails?.clientName ? `${this.checklist.jobDetails.clientName} | ` : '';
            const statusLabel = (this.checklist.status || 'Draft').toUpperCase();
            const revLabel = `Rev ${this.checklist.currentRevisionNumber}`;
            const dateLabel = new Date().toLocaleDateString();

            doc.text(`${clientName}${statusLabel} | ${revLabel} | ${dateLabel}`, margin.left, 24);

            // Blue Separator Line
            const lineY = 28;
            doc.setDrawColor(BRAND_COLORS.BLUE);
            doc.setLineWidth(0.5);
            doc.line(margin.left, lineY, pageWidth - margin.right, lineY);

            // Logo (Right Aligned, Maximize Height)
            if (logoDataUrl) {
                // Available height from Top(5) to Line(28) -> 23mm
                // Leave 2mm padding -> 21mm max height
                const maxH = 21;
                const logoH = maxH;
                const logoW = logoH * logoRatio;

                // Position: Right aligned, Bottom aligned to line (minus padding)
                const logoX = pageWidth - margin.right - logoW;
                const logoY = lineY - logoH - 1; // 1mm above line

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

        // 2. Loop & Draw (Manual Engine)
        let totalItems = 0;
        this.checklist.workgroups.forEach(wg => totalItems += wg.rows.length);
        let processedItems = 0;

        for (const wg of this.checklist.workgroups) {
            // -- Workgroup Header --
            checkPageBreak(15);

            cursorY += 2;
            doc.setFillColor('#f3f2f1'); // Light gray background
            doc.rect(margin.left, cursorY, contentWidth, 10, 'F');

            doc.setFontSize(11);
            doc.setTextColor(BRAND_COLORS.BLUE);
            doc.setFont('helvetica', 'bold');
            doc.text(`${wg.number}  ${wg.name}`, margin.left + 2, cursorY + 7);

            cursorY += 12;

            for (const row of wg.rows) {
                processedItems++;
                // Calc Progress
                if (!onProgress(`Section ${wg.number}...`, 10 + (processedItems / totalItems) * 80)) {
                    throw new Error("Cancelled");
                }

                // ... (Content Calc) ...
                // Calculate Content Heights (Lookahead)
                const answerBoxW = 12;
                const col2X = margin.left + answerBoxW + 4;
                const col2W = contentWidth - answerBoxW - 12;

                let contentH = 0;

                // Title
                const title = row.name || this.stripHtml(row.description).substring(0, 50);
                if (title) contentH += 6;

                // Description
                const descH = this.renderer.measureHeight(row.description || '', col2W);
                if (descH > 0) contentH += descH + 2;

                // Notes
                const notesH = row.notes ? this.renderer.measureHeight(row.notes, col2W) + 4 : 0;
                contentH += notesH;

                // Images
                let imagesH = 0;
                if (row.images && row.images.length > 0) {
                    imagesH = (35 * row.images.length) + 4;
                }
                contentH += imagesH;

                // Min height for Status Box header + Title
                // We keep a small atomic check for the START of the row (Status box + Title)
                // But we let the description flow.
                checkPageBreak(30);

                // -- Draw Row --
                const startRowY = cursorY;

                // 1. Status Box
                const answerConf = ANSWER_CONFIG[row.answer];
                doc.setFillColor(answerConf.color);
                doc.setDrawColor(answerConf.color);
                // Rounded rect
                doc.roundedRect(margin.left, startRowY + 4, answerBoxW, 16, 1, 1, 'F');

                doc.setTextColor(BRAND_COLORS.WHITE);
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                doc.text(answerConf.label, margin.left + (answerBoxW / 2), startRowY + 12, { align: 'center' });

                // 2. Content
                let drawY = startRowY + 5;

                // Title
                if (title) {
                    doc.setTextColor(BRAND_COLORS.BLACK);
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.text(title, col2X, drawY);
                    drawY += 5;
                }

                // Define Page Break Handler for Rich Text
                const performPageBreak = () => {
                    doc.addPage();
                    cursorY = margin.top;
                    // Header is only page 1, so just margin top.
                    return margin.top;
                };

                const maxY = pageHeight - margin.bottom;

                // Description (Paginated)
                if (row.description) {
                    doc.setFontSize(10);
                    doc.setTextColor('#323130');
                    // Render with pagination
                    drawY = this.renderer.render(
                        row.description,
                        col2X,
                        drawY,
                        col2W,
                        maxY,
                        performPageBreak
                    );
                    drawY += 3;
                }

                // Notes (Paginated)
                if (row.notes) {
                    drawY += 2;
                    doc.setFontSize(9);
                    doc.setTextColor('#605e5c');
                    drawY = this.renderer.render(
                        row.notes,
                        col2X,
                        drawY,
                        col2W,
                        maxY,
                        performPageBreak
                    );
                    drawY += 3;
                }

                // Images
                if (row.images && row.images.length > 0) {
                    drawY += 2;
                    for (const img of row.images) {
                        try {
                            let imgData = img.source;

                            // Handle HTTP or BLOB (Local Uploads)
                            if (img.source.startsWith('http') || img.source.startsWith('blob:')) {
                                try {
                                    // FETCH WITH TIMEOUT
                                    const fetchWithTimeout = (url: string, ms: number) => {
                                        const controller = new AbortController();
                                        const id = setTimeout(() => controller.abort(), ms);
                                        return fetch(url, { mode: 'cors', signal: controller.signal }).finally(() => clearTimeout(id));
                                    };

                                    const resp = await fetchWithTimeout(img.source, 5000).catch(err => {
                                        console.warn("Image fetch timeout/error:", err);
                                        return null;
                                    });

                                    if (resp && resp.ok) {
                                        const blob = await resp.blob();
                                        imgData = await this.readBlobAsDataURL(blob);
                                    } else {
                                        console.warn("Skipping image (blocked/timeout):", img.source);
                                        continue;
                                    }
                                } catch (e) {
                                    continue;
                                }
                            }

                            // Get Dimensions with Fallback
                            // Get Dimensions with Fallback
                            let ratio = 1.77; // Default 16:9
                            let natWidthPx = 0;

                            try {
                                const props = await this.getImageProperties(imgData);
                                ratio = props.ratio;
                                natWidthPx = props.width;
                            } catch (err) {
                                console.warn("Could not determine image dimensions, using default.", err);
                            }

                            // Calc Render Size
                            const maxW = Math.min(col2W, 120);
                            let renderW = maxW;

                            // If we have original dimensions, use them if smaller than maxW
                            if (natWidthPx > 0) {
                                const pxToMm = 0.264583; // 1px = 0.26mm (96 DPI)
                                const natWidthMm = natWidthPx * pxToMm;
                                renderW = Math.min(natWidthMm, maxW);
                            }

                            let renderH = renderW / ratio;

                            // Check Page Break
                            if (drawY + renderH > maxY) {
                                cursorY = performPageBreak();
                                drawY = cursorY + 5;
                            }

                            doc.addImage(imgData, 'JPEG', col2X, drawY, renderW, renderH);
                            drawY += renderH + 2;

                        } catch (e) {
                            console.error("Error drawing image:", e);
                        }
                    }
                }

                // Divider Line (Check bounds)
                cursorY = Math.max(drawY, startRowY + 20) + 4;

                if (cursorY > maxY) {
                    cursorY = performPageBreak();
                }

                doc.setDrawColor('#e1dfdd');
                doc.setLineWidth(0.1);
                doc.line(margin.left, cursorY - 2, pageWidth - margin.right, cursorY - 2);
            }
        }

        // Apply Footers (Moved BEFORE putTotalPages)
        const totalPages = doc.getNumberOfPages();
        const totalPagesExp = '{total_pages_count_string}';

        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            drawFooter(i, totalPagesExp);
        }

        // Put Total Pages (Final Step)
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

}
