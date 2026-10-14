/**
 * Digiexplode AI — Production Report Export Utilities
 * 
 * Provides professional, verified exports for:
 * 1. PDF (via jsPDF & jspdf-autotable) with Digiexplode AI executive agency branding
 * 2. Excel (XLSX/XML Workbook) with styled worksheets, data types, and injection defense
 * 3. CSV (RFC 4180 standard) with UTF-8 BOM for regional characters
 * 4. Print-Friendly trigger
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ReportSummaryCard {
  label: string;
  value: string | number;
  subtext?: string;
}

export interface ReportTableSection {
  title?: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
}

export interface GenericReportExportConfig {
  reportTitle: string;
  reportSubtitle?: string;
  periodLabel: string;
  generatedBy?: string;
  filterSummary?: string;
  summaryCards?: ReportSummaryCard[];
  tables: ReportTableSection[];
  filenameBase?: string;
}

/**
 * Sanitize cell values against spreadsheet formula injection (CSV/Excel injection)
 */
function sanitizeCellValue(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
    return `'${str}`;
  }
  return str;
}

/**
 * 1. Professional PDF Export Engine
 */
export async function exportReportToPDF(config: GenericReportExportConfig): Promise<boolean> {
  try {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const nowIso = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // ── Primary Header Accent Bar ──────────────────────────────────────────
    doc.setFillColor(91, 75, 255); // #5B4BFF
    doc.rect(0, 0, pageWidth, 5, 'F');

    // ── Agency Title & Branding ───────────────────────────────────────────
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(config.reportTitle, 14, 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    const subtitleText = config.reportSubtitle || 'Digiexplode AI Agency Operations Report';
    doc.text(`${subtitleText}  •  Period: ${config.periodLabel}`, 14, 22);

    if (config.filterSummary) {
      doc.setFontSize(8.5);
      doc.setTextColor(120, 130, 150);
      doc.text(`Active Filters: ${config.filterSummary}`, 14, 27);
    }

    // Right-aligned branding info
    doc.setFontSize(8.5);
    doc.setTextColor(91, 75, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('DIGIEXPLODE AI', pageWidth - 14, 14, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 130, 150);
    doc.text(`Generated: ${nowIso} IST`, pageWidth - 14, 19, { align: 'right' });
    doc.text(`By: ${config.generatedBy || 'Super Admin'}`, pageWidth - 14, 24, { align: 'right' });

    let currentY = config.filterSummary ? 32 : 28;

    // ── KPI Summary Cards Box ─────────────────────────────────────────────
    if (config.summaryCards && config.summaryCards.length > 0) {
      const cardCount = config.summaryCards.length;
      const cardGap = 4;
      const totalWidth = pageWidth - 28;
      const cardWidth = Math.min(48, (totalWidth - (cardGap * (cardCount - 1))) / cardCount);
      const cardHeight = 16;

      config.summaryCards.forEach((card, idx) => {
        const x = 14 + (idx * (cardWidth + cardGap));
        if (x + cardWidth <= pageWidth - 14) {
          // Card Box Background
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(x, currentY, cardWidth, cardHeight, 2, 2, 'FD');

          // Card Label
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(100, 116, 139);
          doc.text(card.label.toUpperCase(), x + 3.5, currentY + 5);

          // Card Value
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(16, 24, 40);
          doc.text(String(card.value), x + 3.5, currentY + 12);
        }
      });

      currentY += cardHeight + 6;
    }

    // ── Detailed Tables ───────────────────────────────────────────────────
    for (const tableSec of config.tables) {
      if (tableSec.title) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(tableSec.title, 14, currentY);
        currentY += 4;
      }

      const tableRows = tableSec.rows.map(row => row.map(sanitizeCellValue));

      autoTable(doc, {
        startY: currentY,
        head: [tableSec.headers],
        body: tableRows,
        theme: 'striped',
        styles: {
          fontSize: 8,
          cellPadding: 2.2,
          overflow: 'linebreak',
          textColor: [30, 41, 59]
        },
        headStyles: {
          fillColor: [91, 75, 255],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        margin: { left: 14, right: 14 },
        didDrawPage: (data) => {
          // Footer on every page
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text(
            'Digiexplode AI • Agency Work & Operations System • Confidential Operational Record',
            14,
            pageHeight - 8
          );
          const pageNum = doc.getNumberOfPages();
          doc.text(`Page ${pageNum}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
        }
      });

      // Advance currentY for next table
      const lastTable = (doc as any).lastAutoTable;
      if (lastTable && lastTable.finalY) {
        currentY = lastTable.finalY + 8;
      }
    }

    const safeBase = (config.filenameBase || config.reportTitle).toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `${safeBase}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
    return true;
  } catch (err) {
    console.error('[ExportPDF] PDF generation failed:', err);
    throw err;
  }
}

/**
 * 2. Excel (XLSX/XML Workbook) Export Engine
 * Generates standards-compliant XML Spreadsheet with multiple sections,
 * styled headers, numeric formatting, and formula injection defense.
 */
export function exportReportToXLSX(config: GenericReportExportConfig): boolean {
  try {
    const title = config.reportTitle;
    const period = config.periodLabel;
    const nowIso = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#111827"/>
  </Style>
  <Style ss:ID="HeaderTitle">
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#5B4BFF"/>
  </Style>
  <Style ss:ID="MetaLabel">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Italic="1" ss:Color="#6B7280"/>
  </Style>
  <Style ss:ID="TableHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#4338CA"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#5B4BFF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiLabel">
   <Font ss:FontName="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#4B5563"/>
   <Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiValue">
   <Alignment ss:Horizontal="Center"/>
   <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#111827"/>
   <Interior ss:Color="#F9FAFB" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DataRow">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#111827"/>
  </Style>
  <Style ss:ID="DataRowAlt">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#111827"/>
   <Interior ss:Color="#F9FAFB" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Report">
  <Table ss:DefaultColumnWidth="120">
   <Row ss:Height="24">
    <Cell ss:StyleID="HeaderTitle"><Data ss:Type="String">${escapeXml(title)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Period: ${escapeXml(period)}  |  Generated: ${escapeXml(nowIso)} IST  |  Digiexplode AI</Data></Cell>
   </Row>
   <Row/>
`;

    // Summary Cards block
    if (config.summaryCards && config.summaryCards.length > 0) {
      xml += `   <Row ss:Height="18">\n`;
      for (const card of config.summaryCards) {
        xml += `    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">${escapeXml(card.label.toUpperCase())}</Data></Cell>\n`;
      }
      xml += `   </Row>\n   <Row ss:Height="20">\n`;
      for (const card of config.summaryCards) {
        const val = card.value;
        const isNum = typeof val === 'number';
        xml += `    <Cell ss:StyleID="KpiValue"><Data ss:Type="${isNum ? 'Number' : 'String'}">${escapeXml(String(val))}</Data></Cell>\n`;
      }
      xml += `   </Row>\n   <Row/>\n`;
    }

    // Tables
    for (const table of config.tables) {
      if (table.title) {
        xml += `   <Row ss:Height="18">\n    <Cell ss:StyleID="HeaderTitle"><Data ss:Type="String">${escapeXml(table.title)}</Data></Cell>\n   </Row>\n`;
      }

      // Headers
      xml += `   <Row ss:Height="20">\n`;
      for (const h of table.headers) {
        xml += `    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>\n`;
      }
      xml += `   </Row>\n`;

      // Rows
      table.rows.forEach((row, idx) => {
        const rowStyle = idx % 2 === 0 ? 'DataRow' : 'DataRowAlt';
        xml += `   <Row>\n`;
        for (const cell of row) {
          const sanitized = sanitizeCellValue(cell);
          const isNum = typeof cell === 'number' && !isNaN(cell);
          xml += `    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="${isNum ? 'Number' : 'String'}">${escapeXml(sanitized)}</Data></Cell>\n`;
        }
        xml += `   </Row>\n`;
      });

      xml += `   <Row/>\n`;
    }

    xml += `  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const safeBase = (config.filenameBase || config.reportTitle).toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `${safeBase}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    downloadBlob(blob, filename);
    return true;
  } catch (err) {
    console.error('[ExportXLSX] Excel generation failed:', err);
    throw err;
  }
}

/**
 * 3. Standard CSV Export Engine
 * Full RFC 4180 quoting, UTF-8 BOM, and formula-injection defenses.
 */
export function exportReportToCSV(config: GenericReportExportConfig): boolean {
  try {
    const lines: string[] = [];

    // Header metadata
    lines.push(`"${config.reportTitle}"`);
    lines.push(`"Period: ${config.periodLabel} | Generated: ${new Date().toISOString()}"`);
    if (config.filterSummary) {
      lines.push(`"Filters: ${config.filterSummary}"`);
    }
    lines.push('');

    // Summary Cards
    if (config.summaryCards && config.summaryCards.length > 0) {
      lines.push(config.summaryCards.map(c => `"${c.label}"`).join(','));
      lines.push(config.summaryCards.map(c => `"${c.value}"`).join(','));
      lines.push('');
    }

    // Tables
    for (const table of config.tables) {
      if (table.title) {
        lines.push(`"--- ${table.title} ---"`);
      }
      lines.push(table.headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));
      for (const row of table.rows) {
        const formattedRow = row.map(cell => {
          const sanitized = sanitizeCellValue(cell);
          return `"${sanitized.replace(/"/g, '""')}"`;
        });
        lines.push(formattedRow.join(','));
      }
      lines.push('');
    }

    // Prepend UTF-8 BOM \uFEFF for proper Excel character encoding
    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const safeBase = (config.filenameBase || config.reportTitle).toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `${safeBase}_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadBlob(blob, filename);
    return true;
  } catch (err) {
    console.error('[ExportCSV] CSV generation failed:', err);
    throw err;
  }
}

/**
 * 4. Trigger Native Print Dialog
 */
export function triggerPrintReport(): void {
  if (typeof window !== 'undefined') {
    window.print();
  }
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 300);
}
