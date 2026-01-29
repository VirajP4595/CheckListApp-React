
import jsPDF from 'jspdf';
import { Checklist, ANSWER_CONFIG } from '../models'; // Relative path check needed
import { PdfRichTextRenderer, BRAND_COLORS } from '../utils/pdfRichTextRenderer';

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
        onProgress: (status: string, percent: number) => boolean
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
            // Pre-calculate visible rows for this workgroup
            const visibleRows = wg.rows.filter(row => {
                const rawDesc = this.stripHtml(row.description || '').trim();
                const isUnanswered = row.answer === 'BLANK';
                const isExcluded = row.answer === 'NO';
                // Keep if description exists OR status is meaningful (not BLANK/NO)
                return rawDesc || (!isUnanswered && !isExcluded);
            });

            // If no rows are visible, skip the entire workgroup (header included)
            if (visibleRows.length === 0) {
                continue;
            }

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

            // Accumulate images for the workgroup
            const workgroupImages: { data: string; ratio: number; caption?: string }[] = [];

            for (const row of visibleRows) {

                processedItems++;
                // Calc Progress
                if (!onProgress(`Section ${wg.number}...`, 10 + (processedItems / totalItems) * 80)) {
                    throw new Error("Cancelled");
                }

                // ... (Content Calc) ...
                // Calculate Content Heights (Lookahead)
                const answerBoxW = 12;
                // const col2X = margin.left + answerBoxW + 4; // Unused
                const col2W = contentWidth - answerBoxW - 12;

                let contentH = 0;

                // Title
                const title = row.name || this.stripHtml(row.description).substring(0, 50);
                if (title) contentH += 6;

                // Description
                const descH = this.renderer.measureHeight(row.description || '', col2W);
                if (descH > 0) contentH += descH + 2;

                // Notes - MOVED UP
                const notesH = row.notes ? this.renderer.measureHeight(row.notes, col2W) + 4 : 0;
                contentH += notesH;

                // Images
                let imagesH = 0;
                if (row.images && row.images.length > 0) {
                    // Grid math
                    const gap = 4;
                    const gridW = (col2W - gap) / 2;
                    const avgRatio = 1.77;
                    const avgRowH = gridW / avgRatio;
                    const rows = Math.ceil(row.images.length / 2);
                    imagesH = (rows * avgRowH) + (rows * 2) + 4;
                }
                contentH += imagesH;

                // Min height for Status Box header + Title
                checkPageBreak(30);

                // -- Draw Row --
                const startRowY = cursorY;

                // 1. Status Pill (Inline) - UPDATED
                // Replaces the left-column status box. Now we draw a pill next to title (or at start if no title)
                // Actually, let's keep the row structure, but make the status pill inline with title.
                // Status Box (Left Column) is REMOVED. Everything shifts LEFT? 
                // Wait, "Inline Pill" usually means right of title.
                // Re-defined layout: 
                // Col 1: Content (Full Width)
                // Row Header: Title + [Status Pill]

                let drawY = startRowY + 4;
                const fullW = contentWidth; // No more left column for status

                const answerConf = ANSWER_CONFIG[row.answer];

                // Title Line (Title + Pill)
                if (title) {
                    doc.setTextColor(BRAND_COLORS.BLACK);
                    doc.setFontSize(11);
                    doc.setFont('helvetica', 'bold');
                    doc.text(title, margin.left, drawY + 3); // +3 baseline adjust

                    const titleW = doc.getTextWidth(title);

                    // Draw Pill
                    const pillX = margin.left + titleW + 4;
                    const pillW = doc.getTextWidth(answerConf.label) + 6;

                    // Pill bg
                    doc.setFillColor(answerConf.color);
                    doc.roundedRect(pillX, drawY - 1, pillW, 5, 2, 2, 'F');

                    // Pill text
                    doc.setTextColor(BRAND_COLORS.WHITE);
                    doc.setFontSize(7);
                    doc.setFont('helvetica', 'bold');
                    doc.text(answerConf.label, pillX + (pillW / 2), drawY + 2.5, { align: 'center' });

                    drawY += 7;
                } else {
                    // No title, just draw pill at start?
                    // Or fallback title was generated?
                    // Let's assume fallback title exists if row.name missing
                }


                // Description (Paginated)
                if (row.description) {
                    doc.setFontSize(10);
                    doc.setFontSize(9); // Compact
                    doc.setTextColor('#323130');
                    const descY = this.renderer.render(
                        row.description,
                        margin.left, // Full Width
                        drawY,
                        fullW,
                        pageHeight - margin.bottom,
                        () => { doc.addPage(); cursorY = margin.top; return margin.top; }
                    );
                    drawY = descY + 2;
                }

                // Notes (Compact & Full Width)
                if (row.notes) {
                    drawY += 1;
                    const notesH = this.renderer.measureHeight(row.notes, fullW);
                    const boxH = notesH + 5; // Compact padding

                    if (drawY + boxH > pageHeight - margin.bottom) {
                        doc.addPage();
                        cursorY = margin.top;
                        drawY = cursorY + 2;
                    }

                    // Background & Border
                    doc.setFillColor('#fff9e6');
                    doc.rect(margin.left, drawY, fullW, boxH, 'F');
                    doc.setFillColor('#fce100');
                    doc.rect(margin.left, drawY, 1.5, boxH, 'F');

                    // Label
                    doc.setFontSize(8);
                    doc.setTextColor('#8a6d3b');
                    doc.setFont('helvetica', 'bold');
                    doc.text("NOTES:", margin.left + 3, drawY + 3.5);

                    // Content - Full Width (minor padding)
                    doc.setFontSize(9);
                    doc.setTextColor('#484644');
                    doc.setFont('helvetica', 'normal');

                    this.renderer.render(
                        row.notes,
                        margin.left + 3,
                        drawY + 5,
                        fullW - 4,
                        pageHeight - margin.bottom,
                        () => { doc.addPage(); return margin.top; }
                    );
                    drawY += boxH + 2;
                }

                // Collect Images (Don't draw yet)
                if (row.images && row.images.length > 0) {
                    for (const img of row.images) {
                        workgroupImages.push({
                            data: img.source,
                            ratio: 1.77,
                            caption: row.name
                        });
                    }
                }

                cursorY = drawY;

                // Divider
                doc.setDrawColor('#e1dfdd');
                doc.setLineWidth(0.1);
                doc.line(margin.left, cursorY, pageWidth - margin.right, cursorY);
                cursorY += 1;
            } // End Row Loop

            // --- Render Workgroup Images ---
            if (workgroupImages.length > 0) {
                checkPageBreak(30);
                doc.setFontSize(9);
                doc.setTextColor(BRAND_COLORS.BLUE);
                doc.setFont('helvetica', 'bold');
                doc.text("Workgroup Images", margin.left, cursorY + 5);
                cursorY += 8;

                const gap = 4;
                const gridW = (contentWidth - gap) / 2;

                // Fetch Loop for Collected Images
                const loadedImages = [];
                for (const item of workgroupImages) {
                    try {
                        let d = item.data;
                        if (d.startsWith('http') || d.startsWith('blob:')) {
                            // Use simple fetch for now, assuming CORS/Auth handled or public
                            // For blob urls from preview, directly readable?
                            // Actually blob urls work if same origin context.
                            const r = await fetch(d).catch(() => null);
                            if (r && r.ok) {
                                const b = await r.blob();
                                d = await this.readBlobAsDataURL(b);
                            } else continue;
                        }
                        const props = await this.getImageProperties(d).catch(() => ({ ratio: 1.77 }));
                        loadedImages.push({ data: d, ratio: props.ratio });
                    } catch (e) { }
                }

                for (let i = 0; i < loadedImages.length; i += 2) {
                    const img1 = loadedImages[i];
                    const img2 = loadedImages[i + 1];

                    const h1 = gridW / img1.ratio;
                    const h2 = img2 ? (gridW / img2.ratio) : 0;
                    const rowH = Math.max(h1, h2);

                    if (cursorY + rowH > pageHeight - margin.bottom) {
                        doc.addPage();
                        cursorY = margin.top;
                    }

                    doc.addImage(img1.data, 'JPEG', margin.left, cursorY, gridW, h1);
                    if (img2) {
                        doc.addImage(img2.data, 'JPEG', margin.left + gridW + gap, cursorY, gridW, h2);
                    }
                    cursorY += rowH + 4;
                }
                cursorY += 5;
            } // End Workgroup Images
        } // End Workgroup Loop

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

}
