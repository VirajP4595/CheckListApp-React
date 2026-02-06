import { jsPDF } from 'jspdf';

// Brand Colors
export const BRAND_COLORS = {
    BLUE: '#03518b', // Headers
    GREEN: '#60923f', // Success / Yes
    LIME: '#c8da2d',  // Accents
    WHITE: '#ffffff',
    BLACK: '#000000',
    GRAY: '#808080'
};

interface TextNode {
    text: string;
    isBold: boolean;
    isItalic: boolean;
    isList: boolean;
    listType?: 'bullet' | 'ordered' | 'checkbox';
    isChecked?: boolean; // For checkboxes
    indent: number;
    isHighlighted?: boolean;
    highlightColor?: string;
}

/**
 * PDF Rich Text Renderer
 * Parses HTML string (from TipTap) and maps it to PDF drawing commands.
 */
export class PdfRichTextRenderer {
    private doc: jsPDF;
    private lineHeight: number;
    private fontSize: number;

    constructor(doc: jsPDF, fontSize = 10, lineHeight = 5) {
        this.doc = doc;
        this.fontSize = fontSize;
        this.lineHeight = lineHeight;
    }

    /**
     * Parse HTML string into structured nodes (Simplified parser)
     */
    private parseHtml(html: string): TextNode[] {
        const nodes: TextNode[] = [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Recursive walker
        const walk = (element: Element | Node, indent: number = 0, context: Partial<TextNode> = {}) => {
            Array.from(element.childNodes).forEach(child => {
                if (child.nodeType === Node.TEXT_NODE) {
                    const text = child.textContent?.trim();
                    if (text) {
                        // 1. Decode generic entities
                        let decodedText = new DOMParser().parseFromString(text, 'text/html').body.textContent || text;

                        // 2. Sanitize Radioactive Unicode & Future Proofing
                        // Replaces non-ASCII symbols that often cause jsPDF artifacts or buffer corruption.
                        const REPLACEMENTS: { [key: string]: string } = {
                            // Checkboxes & Status
                            '☑': '[x]', '☐': '[ ]', '✅': '[x]', '✔': '[x]', '❌': '[ ]',
                            // Quotes & Punctuation
                            '“': '"', '”': '"', '‘': "'", '’': "'",
                            '–': '-', '—': '-', '…': '...',
                            // Bullets
                            '•': '-', '●': '-', '○': '-', '▪': '-', '◆': '-',
                            // Math
                            '½': '1/2', '¼': '1/4', '¾': '3/4',
                            '×': 'x', '÷': '/', '±': '+/-',
                            // Misc Symbols
                            '©': '(c)', '®': '(r)', '™': '(tm)',
                            'ðØ': '-',
                            '→': '->', '←': '<-', '↑': '^', '↓': 'v', '↔': '<->',
                            '⇒': '=>', '⇐': '<=', '⇑': '^', '⇓': 'v', '⇔': '<=>',
                            '➤': '>', '➢': '>', '➣': '>', '➔': '->',
                            '▶': '>', '◀': '<', '»': '>>', '«': '<<'
                        };

                        const pattern = new RegExp(
                            Object.keys(REPLACEMENTS)
                                .map(key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                                .join('|'),
                            'g'
                        );

                        decodedText = decodedText.replace(pattern, (match) => REPLACEMENTS[match]);
                        decodedText = decodedText.replace(/ð/g, '');

                        nodes.push({
                            text: decodedText,
                            isBold: context.isBold || false,
                            isItalic: context.isItalic || false,
                            isList: context.isList || false,
                            listType: context.listType,
                            isChecked: context.isChecked,
                            indent
                        });
                    }
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                    const el = child as Element;
                    const tagName = el.tagName.toLowerCase();
                    const newContext = { ...context };

                    // Manual Line Break
                    if (tagName === 'br') {
                        // Push a newline node (empty text, forces line advance)
                        nodes.push({ text: '\n', isBold: false, isItalic: false, isList: false, indent });
                        return;
                    }

                    // Font Styles
                    if (tagName === 'strong' || tagName === 'b') newContext.isBold = true;
                    if (tagName === 'em' || tagName === 'i') newContext.isItalic = true;
                    if (tagName === 'mark') {
                        newContext.isHighlighted = true;
                        // Extract color from style (or use default)
                        const style = el.getAttribute('style') || '';
                        const colorMatch = style.match(/background-color:\s*([^;]+)/i);
                        if (colorMatch && colorMatch[1]) {
                            newContext.highlightColor = colorMatch[1].trim();
                        }
                    }

                    // Block Elements (Paragraphs)
                    if (tagName === 'p' || tagName === 'div') {
                        walk(el, indent, newContext);
                        // Add Paragraph Break after content
                        nodes.push({ text: '\n', isBold: false, isItalic: false, isList: false, indent });
                        return;
                    }

                    // Lists
                    if (tagName === 'ul' || tagName === 'ol') {
                        if (el.getAttribute('data-type') === 'taskList') {
                            newContext.listType = 'checkbox';
                        } else {
                            newContext.listType = tagName === 'ul' ? 'bullet' : 'ordered';
                        }
                        walk(el, indent + 1, newContext);
                        return;
                    }

                    // List Items
                    if (tagName === 'li') {
                        const localContext = { ...newContext, isList: true };
                        if (newContext.listType === 'checkbox') {
                            localContext.isChecked = el.getAttribute('data-checked') === 'true';
                        }
                        // Add newline before list item if not first?
                        // Actually, list items usually act as blocks.
                        // We push a newline node implicitly via render logic or explicit node.
                        // Let's be explicit: List Item = New Line + Content + New Line?
                        // Render logic handles the "Start of item" placement.

                        walk(el, indent, localContext);

                        // Ensure list item ends with newline
                        nodes.push({ text: '\n', isBold: false, isItalic: false, isList: false, indent });
                        return;
                    }

                    walk(el, indent, newContext);
                }
            });
        };

        walk(doc.body);
        return nodes;
    }

    /**
     * Measure text height before drawing (for auto-table cell height calculation)
     */
    public measureHeight(html: string, width: number): number {
        // Reuse render logic but with a "Dry Run" flag?
        // Or just copy the core calc. Copying core calc is safer for now to avoid side effects.
        // For measureHeight, maxY can be a very large number, and onPageBreak is not needed.
        return this.render(html, 0, 0, width, Number.MAX_SAFE_INTEGER, undefined, true);
    }

    /**
     * Draw Rich Text with smart pagination
     * @param onPageBreak Callback to add a new page. Should return the new start Y position.
     */
    public render(
        html: string,
        x: number,
        y: number,
        width: number,
        maxY: number,
        onPageBreak?: () => number,
        dryRun: boolean = false
    ): number {
        const nodes = this.parseHtml(html);
        let cursorX = x;
        let cursorY = y + this.fontSize / 2.5; // Baseline approx

        const startX = x;

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];

            // Handle Newlines (Paragraphs / BR / List Item ends)
            if (node.text === '\n') {
                cursorY += this.lineHeight;
                cursorX = startX;

                // Check Bounds on Newline
                if (cursorY > maxY && onPageBreak && !dryRun) {
                    cursorY = onPageBreak() + this.fontSize / 2.5;
                    cursorX = startX; // Reset X for new page
                }
                continue;
            }

            // Indent
            const indentX = node.indent * 5;

            // Set Font
            if (!dryRun) {
                this.doc.setFontSize(this.fontSize);
                let fontStyle = 'normal';
                if (node.isBold && node.isItalic) fontStyle = 'bolditalic';
                else if (node.isBold) fontStyle = 'bold';
                else if (node.isItalic) fontStyle = 'italic';
                this.doc.setFont('helvetica', fontStyle);
                this.doc.setTextColor(BRAND_COLORS.BLACK);
            }

            // Marker Logic
            let contentX = cursorX;
            const isStartOfLine = i === 0 || nodes[i - 1].text === '\n';

            if (node.isList && isStartOfLine) {
                contentX = startX + indentX; // Reset to indent position

                // Draw Marker
                if (!dryRun) {
                    if (node.listType === 'checkbox') {
                        this.doc.setDrawColor(BRAND_COLORS.GRAY);
                        this.doc.setLineWidth(0.1);
                        this.doc.rect(contentX, cursorY - 2.5, 3, 3);
                        if (node.isChecked) {
                            this.doc.setFillColor(BRAND_COLORS.GREEN);
                            this.doc.rect(contentX + 0.5, cursorY - 2, 2, 2, 'F');
                        }
                        contentX += 5;
                    } else if (node.listType === 'bullet') {
                        this.doc.text('•', contentX, cursorY);
                        contentX += 4;
                    } else if (node.listType === 'ordered') {
                        this.doc.text('1.', contentX, cursorY);
                        contentX += 5;
                    }
                } else {
                    if (node.listType === 'checkbox') contentX += 5;
                    else if (node.listType === 'bullet') contentX += 4;
                    else if (node.listType === 'ordered') contentX += 5;
                }
                cursorX = contentX;
            }

            // Draw Text
            const availableWidth = width - (cursorX - startX);

            // Split text to fit width
            if (dryRun) {
                this.doc.setFontSize(this.fontSize);
                let fs = 'normal';
                if (node.isBold) fs = 'bold';
                this.doc.setFont('helvetica', fs);
            }

            const lines = this.doc.splitTextToSize(node.text, availableWidth);

            // Render line by line to handle pagination
            for (let j = 0; j < lines.length; j++) {
                const line = lines[j];

                // Check Page Break BEFORE drawing line
                if (cursorY + this.lineHeight > maxY && onPageBreak && !dryRun) {
                    cursorY = onPageBreak() + this.fontSize / 2.5;
                    cursorX = startX + indentX; // Reset X for new page, respecting indent
                }

                if (!dryRun) {
                    // Highlight Background
                    if (node.isHighlighted) {
                        const _lineWidth = this.doc.getTextWidth(line);
                        // Use parsed color or default yellow
                        const hlColor = node.highlightColor || '#FFEB3B';
                        this.doc.setFillColor(hlColor);
                        // Approx offset for 10pt font. fontSize is in pt. 
                        // 1pt = 0.35mm. 10pt = 3.5mm. 
                        // Baseline is cursorY. Top is approx cursorY - 3.5.
                        // We use lineHeight (5mm) to cover the full line area.
                        // Offset Y: cursorY - 3.5 + adjustment
                        this.doc.rect(cursorX, cursorY - 3.5, _lineWidth, 5, 'F');

                        // Reset Text Color (rect changes fill color, text uses text color)
                        this.doc.setTextColor(BRAND_COLORS.BLACK);
                    }

                    this.doc.text(line, cursorX, cursorY);
                }

                // Advance X/Y
                if (j < lines.length - 1) {
                    cursorY += this.lineHeight;
                    cursorX = startX + indentX; // Next line starts at indent
                } else {
                    // Last line - advance X
                    cursorX += this.doc.getTextWidth(line);
                }
            }
        }

        // Return the absolute next Y position
        return cursorY + this.lineHeight;
    }
}
