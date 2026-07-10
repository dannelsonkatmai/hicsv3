import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { FormTemplateDef } from '../types/forms';
import { fmtDateTime } from './utils';

// PDF generation runs fully client-side (jsPDF) so exports work offline at
// the command post — no server round-trip required.

interface DocWithTable extends jsPDF {
  lastAutoTable?: { finalY: number };
}

const MARGIN = 40;

function sectionY(doc: DocWithTable, fallback: number): number {
  return (doc.lastAutoTable?.finalY ?? fallback) + 14;
}

function drawFormHeader(doc: jsPDF, template: FormTemplateDef, subtitle: string) {
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 64, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`${template.code} — ${template.title}`, MARGIN, 28);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, MARGIN, 46);
  doc.setTextColor(0, 0, 0);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export function renderFormIntoDoc(
  doc: DocWithTable,
  template: FormTemplateDef,
  data: Record<string, unknown>,
  subtitle: string
) {
  drawFormHeader(doc, template, subtitle);
  let cursor = 80;

  if (template.noPhi) {
    doc.setFontSize(9);
    doc.setTextColor(180, 30, 30);
    doc.text('AGGREGATE COUNTS ONLY — this form contains no patient identifiers by design.', MARGIN, cursor);
    doc.setTextColor(0, 0, 0);
    cursor += 16;
  }

  for (const section of template.schema.sections) {
    const scalarRows: Array<[string, string]> = [];
    const tables: Array<{ label: string; head: string[]; body: string[][] }> = [];

    for (const field of section.fields) {
      if (field.type === 'note') continue;
      if (field.type === 'table') {
        const rows = Array.isArray(data[field.key]) ? (data[field.key] as Array<Record<string, unknown>>) : [];
        tables.push({
          label: field.label,
          head: (field.columns ?? []).map((c) => c.label),
          body: rows.map((row) => (field.columns ?? []).map((c) => formatValue(row[c.key])))
        });
      } else {
        scalarRows.push([field.label, formatValue(data[field.key])]);
      }
    }

    autoTable(doc, {
      startY: cursor,
      head: [[{ content: section.title, colSpan: 2, styles: { fillColor: [37, 99, 235], fontStyle: 'bold' } }]],
      body: scalarRows.length ? scalarRows : [['', '']],
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: { 0: { cellWidth: 190, fontStyle: 'bold', textColor: [70, 70, 70] } },
      margin: { left: MARGIN, right: MARGIN }
    });
    cursor = sectionY(doc, cursor);

    for (const table of tables) {
      autoTable(doc, {
        startY: cursor,
        head: [table.head],
        body: table.body.length ? table.body : [table.head.map(() => '—')],
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [51, 65, 85] },
        margin: { left: MARGIN, right: MARGIN }
      });
      cursor = sectionY(doc, cursor);
    }
  }
}

export function exportFormPdf(
  template: FormTemplateDef,
  data: Record<string, unknown>,
  meta: { incidentName: string; periodLabel?: string }
) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' }) as DocWithTable;
  const subtitle = `${meta.incidentName}${meta.periodLabel ? ` · ${meta.periodLabel}` : ''} · Generated ${fmtDateTime(new Date().toISOString())}`;
  renderFormIntoDoc(doc, template, data, subtitle);
  doc.save(`${template.code.replace(/\s+/g, '-')}.pdf`);
}

export function exportIapPacketPdf(
  packet: {
    incidentName: string;
    periodLabel: string;
    status: string;
    approvedByName?: string;
    approvedAt?: string | null;
    forms: Array<{ template: FormTemplateDef; data: Record<string, unknown> }>;
  }
) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' }) as DocWithTable;
  const width = doc.internal.pageSize.getWidth();

  // Cover page
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, width, doc.internal.pageSize.getHeight(), 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('Incident Action Plan', width / 2, 220, { align: 'center' });
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text(packet.incidentName, width / 2, 260, { align: 'center' });
  doc.setFontSize(11);
  doc.text(packet.periodLabel, width / 2, 290, { align: 'center' });
  doc.text(`Status: ${packet.status.toUpperCase()}`, width / 2, 320, { align: 'center' });
  if (packet.approvedByName) {
    doc.text(
      `Approved by ${packet.approvedByName}${packet.approvedAt ? ` — ${fmtDateTime(packet.approvedAt)}` : ''}`,
      width / 2,
      344,
      { align: 'center' }
    );
  }
  doc.setFontSize(9);
  doc.text(`Generated ${fmtDateTime(new Date().toISOString())}`, width / 2, 700, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  for (const form of packet.forms) {
    doc.addPage();
    renderFormIntoDoc(doc, form.template, form.data, `${packet.incidentName} · ${packet.periodLabel}`);
  }

  doc.save(`IAP-${packet.incidentName.replace(/\s+/g, '-')}.pdf`);
}

/** Long-form document export (EOP builder): cover page + flowing text sections. */
export function exportDocumentPdf(
  meta: { title: string; subtitle: string; footnote?: string },
  sections: Array<{ heading: string; body: string }>,
  filename: string
) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const maxWidth = width - MARGIN * 2;
  const bottom = height - MARGIN;

  // Cover page
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, width, height, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(meta.title, maxWidth) as string[];
  doc.text(titleLines, width / 2, 230, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(meta.subtitle, width / 2, 230 + titleLines.length * 30 + 14, { align: 'center' });
  doc.setFontSize(9);
  if (meta.footnote) {
    doc.text(doc.splitTextToSize(meta.footnote, maxWidth - 80) as string[], width / 2, 640, { align: 'center' });
  }
  doc.text(`Generated ${fmtDateTime(new Date().toISOString())}`, width / 2, 720, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  let cursor = MARGIN;
  const ensureRoom = (needed: number) => {
    if (cursor + needed > bottom) {
      doc.addPage();
      cursor = MARGIN;
    }
  };

  for (const section of sections) {
    doc.addPage();
    cursor = MARGIN;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    const headingLines = doc.splitTextToSize(section.heading, maxWidth) as string[];
    doc.text(headingLines, MARGIN, cursor);
    cursor += headingLines.length * 18 + 10;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    for (const paragraph of section.body.split('\n')) {
      if (!paragraph.trim()) {
        cursor += 7;
        continue;
      }
      const lines = doc.splitTextToSize(paragraph, maxWidth) as string[];
      for (const line of lines) {
        ensureRoom(14);
        doc.text(line, MARGIN, cursor);
        cursor += 14;
      }
    }
  }

  doc.save(filename);
}

export function exportTablePdf(
  title: string,
  subtitle: string,
  columns: Array<{ key: string; label: string }>,
  rows: Array<Record<string, unknown>>,
  filename: string
) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: columns.length > 6 ? 'landscape' : 'portrait' }) as DocWithTable;
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 60, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(title, MARGIN, 26);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${subtitle} · Generated ${fmtDateTime(new Date().toISOString())}`, MARGIN, 44);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: 76,
    head: [columns.map((c) => c.label)],
    body: rows.map((row) => columns.map((c) => formatValue(row[c.key]))),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235] },
    margin: { left: MARGIN, right: MARGIN }
  });

  doc.save(filename);
}
