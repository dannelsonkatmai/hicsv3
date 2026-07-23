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
  if (template.code === 'HICS 206') {
    exportHics206Pdf(data, meta);
    return;
  }
  const doc = new jsPDF({ unit: 'pt', format: 'letter' }) as DocWithTable;
  const subtitle = `${meta.incidentName}${meta.periodLabel ? ` · ${meta.periodLabel}` : ''} · Generated ${fmtDateTime(new Date().toISOString())}`;
  renderFormIntoDoc(doc, template, data, subtitle);
  doc.save(`${template.code.replace(/\s+/g, '-')}.pdf`);
}

/** HICS 206 — Staff Medical Plan: single-page PDF matching the official form layout (page 1 only). */
export function exportHics206Pdf(
  data: Record<string, unknown>,
  meta: { incidentName: string; periodLabel?: string }
) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' }) as DocWithTable;
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 28;

  // Title banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 56, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('HICS 206 — Staff Medical Plan', M, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const sub = `${meta.incidentName}${meta.periodLabel ? ` · ${meta.periodLabel}` : ''} · Generated ${fmtDateTime(new Date().toISOString())}`;
  doc.text(sub, M, 42);

  let y = 70;
  doc.setTextColor(0, 0, 0);

  // Section 1-2: Incident name + operational period
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('1. Incident Name:', M, y);
  doc.setFont('helvetica', 'normal');
  doc.text(String(data.incident_name ?? '—'), M + 110, y);
  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.text('2. Operational Period:', M, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`#${String(data.operational_period ?? '—')}`, M + 130, y);
  const opRange = `${String(data.op_date_from ?? '')} ${String(data.op_time_from ?? '')} — ${String(data.op_date_to ?? '')} ${String(data.op_time_to ?? '')}`.trim();
  if (opRange) doc.text(opRange, M + 200, y);
  y += 20;

  // Section 3: Treatment Areas
  y = drawTableSection(doc, {
    title: '3. Treatment Areas',
    startY: y,
    head: ['Area Name', 'Location', 'Unit / Team Leader Contact Number / Channel'],
    rows: arrayRows(data.treatment_areas, ['area_name', 'location', 'unit_team_leader_contact']),
    colWidths: [120, 200, 240],
    margin: M,
    minRows: 5
  });

  // Section 4: Resources On Hand (two-column grid)
  y = drawResourcesGrid(doc, data, y, M);
  if (y > H - 200) { doc.addPage(); y = M; }

  // Section 5: Transportation
  y = drawTableSection(doc, {
    title: '5. Transportation (indicate air or ground)',
    startY: y,
    head: ['Ambulance, Bus, Van, Private Vehicle, Air', 'Location', 'Contact Number / Frequency', 'Level of Service'],
    rows: (Array.isArray(data.transportation) ? (data.transportation as Array<Record<string, unknown>>) : []).map((row) => [
      formatValue(row.vehicle_type),
      formatValue(row.location),
      formatValue(row.contact_freq),
      `${row.als ? '☑' : '☐'} ALS   ${row.bls ? '☑' : '☐'} BLS`
    ]),
    colWidths: [150, 130, 150, 110],
    margin: M,
    minRows: 5
  });
  if (y > H - 200) { doc.addPage(); y = M; }

  // Section 6: Alternate Care Sites
  y = drawTableSection(doc, {
    title: '6. Alternate Care Site(s)',
    startY: y,
    head: ['Facility Name', 'Address', 'Contact Number / Frequency', 'Specialty Care (Specify)'],
    rows: arrayRows(data.alternate_care_sites, ['facility_name', 'address', 'contact_freq', 'specialty_care']),
    colWidths: [120, 200, 150, 110],
    margin: M,
    minRows: 5
  });
  if (y > H - 160) { doc.addPage(); y = M; }

  // Section 7: Special Instructions
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('7. Special Instructions', M, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  const siLines = doc.splitTextToSize(String(data.special_instructions ?? '—'), W - M * 2) as string[];
  autoTable(doc, {
    startY: y,
    body: [[siLines.join('\n')]],
    styles: { fontSize: 8, cellPadding: 4, minCellHeight: 50, valign: 'top' },
    margin: { left: M, right: M }
  });
  y = sectionY(doc, y);
  if (y > H - 160) { doc.addPage(); y = M; }

  // Section 8 & 9: Prepared by / Approved by
  y = drawSignatureBlock(doc, '8. Prepared by', {
    printName: String(data.prepared_print_name ?? '—'),
    signature: String(data.prepared_signature ?? ''),
    datetime: String(data.prepared_datetime ?? '—'),
    facility: String(data.prepared_facility ?? '—')
  }, y, M, W);
  if (y > H - 100) { doc.addPage(); y = M; }
  y = drawSignatureBlock(doc, '9. Approved by', {
    printName: String(data.approved_print_name ?? '—'),
    signature: String(data.approved_signature ?? ''),
    datetime: String(data.approved_datetime ?? '—'),
    facility: String(data.approved_facility ?? '—')
  }, y, M, W);

  doc.save('HICS-206-Staff-Medical-Plan.pdf');
}

function arrayRows(arr: unknown, keys: string[]): string[][] {
  if (!Array.isArray(arr)) return [];
  return (arr as Array<Record<string, unknown>>).map((row) => keys.map((k) => formatValue(row[k])));
}

function drawTableSection(doc: DocWithTable, opts: {
  title: string; startY: number; head: string[]; rows: string[][]; colWidths: number[]; margin: number; minRows?: number;
}): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(opts.title, opts.margin, opts.startY);
  const body = opts.rows.length ? opts.rows : [];
  const minRows = opts.minRows ?? 0;
  while (body.length < minRows) body.push(opts.head.map(() => ''));
  autoTable(doc, {
    startY: opts.startY + 8,
    head: [opts.head],
    body,
    styles: { fontSize: 8, cellPadding: 3, valign: 'middle' },
    headStyles: { fillColor: [51, 65, 85], fontSize: 8 },
    columnStyles: opts.colWidths.reduce<Record<number, { cellWidth: number }>>((acc, w, i) => { acc[i] = { cellWidth: w }; return acc; }, {}),
    margin: { left: opts.margin, right: opts.margin }
  });
  return sectionY(doc, opts.startY);
}

function drawResourcesGrid(doc: DocWithTable, data: Record<string, unknown>, y: number, M: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('4. Resources On Hand (numbers)', M, y);
  y += 8;
  const rows: Array<[string, string, string, string]> = [
    ['Staff — MD/DO', String(data.staff_md_do ?? ''), 'Transportation Devices — Litters', String(data.transport_litters ?? '')],
    ['Staff — PA/NP', String(data.staff_pa_np ?? ''), 'Transportation Devices — Portable Beds', String(data.transport_portable_beds ?? '')],
    ['Staff — RN/LPN', String(data.staff_rn_lpn ?? ''), 'Transportation Devices — Gurneys', String(data.transport_gurneys ?? '')],
    ['Staff — Technicians/CNA', String(data.staff_tech_cna ?? ''), 'Transportation Devices — Wheelchairs', String(data.transport_wheelchairs ?? '')],
    ['Staff — Ancillary/Other', String(data.staff_ancillary_other ?? ''), 'Transportation Devices — Evac. Assist Devices', String(data.transport_evac_assist ?? '')],
    ['Medication', String(data.medication ?? ''), 'Supplies', String(data.supplies ?? '')]
  ];
  autoTable(doc, {
    startY: y,
    body: rows.map((r) => [{ content: r[0], styles: { fontStyle: 'bold' } }, r[1], { content: r[2], styles: { fontStyle: 'bold' } }, r[3]]),
    styles: { fontSize: 8, cellPadding: 3, valign: 'middle' },
    columnStyles: { 0: { cellWidth: 180 }, 1: { cellWidth: 130 }, 2: { cellWidth: 180 }, 3: { cellWidth: 130 } },
    margin: { left: M, right: M },
    theme: 'grid'
  });
  return sectionY(doc, y);
}

function drawSignatureBlock(doc: DocWithTable, title: string, fields: { printName: string; signature: string; datetime: string; facility: string }, y: number, M: number, W: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(title, M, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [['Print Name', 'Signature', 'Date/Time', 'Facility']],
    body: [[fields.printName, fields.signature || '[signed on form]', fields.datetime, fields.facility]],
    styles: { fontSize: 8, cellPadding: 4, valign: 'middle', minCellHeight: 32 },
    headStyles: { fillColor: [51, 65, 85], fontSize: 8 },
    columnStyles: { 0: { cellWidth: (W - M * 2) * 0.26 }, 1: { cellWidth: (W - M * 2) * 0.26 }, 2: { cellWidth: (W - M * 2) * 0.22 }, 3: { cellWidth: (W - M * 2) * 0.26 } },
    margin: { left: M, right: M }
  });
  return sectionY(doc, y);
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
