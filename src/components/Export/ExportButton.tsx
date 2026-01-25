import React from 'react';
import { Button } from '@fluentui/react-components';
import { DocumentPdf24Regular } from '@fluentui/react-icons';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { Checklist } from '../../models';
import styles from './ExportButton.module.scss';

interface ExportButtonProps {
  checklist: Checklist;
  contentRef?: React.RefObject<HTMLElement>;
}

export const ExportButton: React.FC<ExportButtonProps> = ({ checklist }) => {
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const container = document.createElement('div');
      container.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        width: 800px;
        background: white;
        padding: 40px;
        font-family: system-ui, -apple-system, sans-serif;
      `;

      container.innerHTML = generatePdfHtml(checklist);
      document.body.appendChild(container);

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 10;

      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const filename = `${checklist.jobReference}-checklist.pdf`;
      pdf.save(filename);

      document.body.removeChild(container);
    } catch (error) {
      console.error('PDF export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      className={`${styles['export-btn']} ${isExporting ? styles['export-btn--loading'] : ''}`}
      appearance="secondary"
      icon={<DocumentPdf24Regular />}
      onClick={handleExport}
      disabled={isExporting}
    >
      {isExporting ? 'Exporting...' : 'Export PDF'}
    </Button>
  );
};

function generatePdfHtml(checklist: Checklist): string {
  const answerColors: Record<string, string> = {
    YES: '#107c10',
    NO: '#d13438',
    BLANK: '#8a8886',
    PS: '#ff8c00',
    PC: '#0078d4',
    SUB: '#8764b8',
    OTS: '#038387',
  };

  const workgroupsHtml = checklist.workgroups
    .sort((a, b) => a.order - b.order)
    .map(wg => {
      const rowsHtml = wg.rows
        .sort((a, b) => a.order - b.order)
        .map(row => `
          <div style="display: flex; gap: 12px; padding: 8px 0; border-bottom: 1px solid #eee;">
            <span style="
              display: inline-block;
              min-width: 40px;
              padding: 4px 8px;
              background: ${answerColors[row.answer]};
              color: white;
              border-radius: 4px;
              font-size: 12px;
              font-weight: bold;
              text-align: center;
            ">${row.answer}</span>
            <div style="flex: 1;">
              <div style="font-weight: 600;">${escapeHtml(row.description)}</div>
              ${row.notes ? `<div style="margin-top: 4px; color: #666; white-space: pre-wrap;">${escapeHtml(row.notes)}</div>` : ''}
            </div>
          </div>
        `).join('');

      return `
        <div style="margin-bottom: 24px;">
          <div style="
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px;
            background: #f5f5f5;
            border-radius: 4px;
            margin-bottom: 8px;
          ">
            <span style="font-family: monospace; font-weight: bold; font-size: 18px; color: #0078d4;">${wg.number}</span>
            <span style="font-weight: 600; font-size: 16px;">${escapeHtml(wg.name)}</span>
          </div>
          ${rowsHtml}
          ${wg.summaryNotes ? `
            <div style="margin-top: 12px; padding: 12px; background: #f9f9f9; border-radius: 4px; font-style: italic;">
              ${escapeHtml(wg.summaryNotes)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

  return `
    <div style="margin-bottom: 32px; border-bottom: 2px solid #0078d4; padding-bottom: 16px;">
      <div style="font-family: monospace; color: #666; font-size: 14px;">${escapeHtml(checklist.jobReference)}</div>
      <h1 style="margin: 8px 0; font-size: 24px;">${escapeHtml(checklist.title)}</h1>
      <div style="color: #666; font-size: 12px;">
        Status: ${checklist.status.toUpperCase()} | 
        Rev ${checklist.currentRevisionNumber} |
        Generated: ${new Date().toLocaleDateString('en-AU')}
      </div>
    </div>
    ${workgroupsHtml}
  `;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
