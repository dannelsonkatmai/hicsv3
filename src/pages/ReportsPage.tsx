import { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useRecords } from '../hooks/useRecords';
import { listRecords } from '../lib/repo';
import { exportTablePdf } from '../lib/pdf';
import { downloadCsv, fmtMoney, sumBy, titleCase } from '../lib/utils';
import { Button, Card, Field, PageHeader, Select } from '../components/ui';
import type { CostRecord, Incident, TimeEntry } from '../types/domain';

// Report center (spec §3.8): cross-cutting exports to PDF and CSV. The IAP
// packet and per-form PDFs are generated inside the incident workspace;
// SitReps from the SitRep tab; the compliance binder from Compliance.

interface ReportDef {
  key: string;
  title: string;
  description: string;
  needsIncident?: boolean;
}

const REPORTS: ReportDef[] = [
  { key: 'incident_summary', title: 'Incident Summary', description: 'All incidents, exercises, and drills with status and dates.' },
  { key: 'cost', title: 'Incident Cost Report', description: 'Cost lines with FEMA PA categories and reimbursable flags.', needsIncident: true },
  { key: 'personnel_time', title: 'Personnel Time Report', description: 'HICS 252-style time entries with labor cost.', needsIncident: true },
  { key: 'resource_requests', title: 'Resource Request Log', description: '213RR requests with status and fulfillment.', needsIncident: true },
  { key: 'exercise_log', title: 'Exercise & Drill Log', description: 'Preparedness exercise history with CMS tracking flags.' },
  { key: 'capa', title: 'Corrective Action Report', description: 'Improvement-plan items with owners and status.' }
];

export function ReportsPage() {
  const { rows: incidents } = useRecords<Incident>('incidents', { orderBy: 'started_at', ascending: false });
  const [incidentId, setIncidentId] = useState('');
  const [busy, setBusy] = useState('');

  const run = async (report: ReportDef, format: 'pdf' | 'csv') => {
    setBusy(`${report.key}-${format}`);
    try {
      const incident = incidents.find((i) => i.id === incidentId);
      let columns: Array<{ key: string; label: string }> = [];
      let rows: Array<Record<string, unknown>> = [];
      let subtitle = '';

      switch (report.key) {
        case 'incident_summary': {
          columns = [
            { key: 'name', label: 'Incident' },
            { key: 'incident_type', label: 'Type' },
            { key: 'status', label: 'Status' },
            { key: 'severity', label: 'Severity' },
            { key: 'started_at', label: 'Started' },
            { key: 'ended_at', label: 'Ended' }
          ];
          rows = incidents as unknown as Record<string, unknown>[];
          subtitle = `${incidents.length} incidents`;
          break;
        }
        case 'cost': {
          const costs = await listRecords<CostRecord>('cost_records', { match: incidentId ? { incident_id: incidentId } : undefined });
          columns = [
            { key: 'incurred_on', label: 'Date' },
            { key: 'cost_type', label: 'Type' },
            { key: 'description', label: 'Description' },
            { key: 'amount', label: 'Amount' },
            { key: 'fema_category', label: 'FEMA' },
            { key: 'reimbursable', label: 'Reimbursable' }
          ];
          rows = costs as unknown as Record<string, unknown>[];
          subtitle = `${incident?.name ?? 'All incidents'} · Total ${fmtMoney(sumBy(costs, (c) => c.amount))}`;
          break;
        }
        case 'personnel_time': {
          const time = await listRecords<TimeEntry>('time_entries', { match: incidentId ? { incident_id: incidentId } : undefined });
          columns = [
            { key: 'person_name', label: 'Name' },
            { key: 'section', label: 'Section' },
            { key: 'work_date', label: 'Date' },
            { key: 'hours', label: 'Hours' },
            { key: 'hourly_rate', label: 'Rate' },
            { key: 'labor_cost', label: 'Cost' }
          ];
          rows = time as unknown as Record<string, unknown>[];
          subtitle = `${incident?.name ?? 'All incidents'} · ${sumBy(time, (t) => t.hours).toFixed(1)} hours · ${fmtMoney(sumBy(time, (t) => t.labor_cost))}`;
          break;
        }
        case 'resource_requests': {
          const requests = await listRecords<Record<string, unknown>>('resource_requests', { match: incidentId ? { incident_id: incidentId } : undefined });
          columns = [
            { key: 'request_number', label: '#' },
            { key: 'item_description', label: 'Item' },
            { key: 'quantity', label: 'Qty' },
            { key: 'priority', label: 'Priority' },
            { key: 'requesting_section', label: 'Section' },
            { key: 'status', label: 'Status' },
            { key: 'estimated_cost', label: 'Est. Cost' }
          ];
          rows = requests;
          subtitle = incident?.name ?? 'All incidents';
          break;
        }
        case 'exercise_log': {
          const exercises = await listRecords<Record<string, unknown>>('exercises', { orderBy: 'scheduled_at', ascending: false });
          columns = [
            { key: 'title', label: 'Exercise' },
            { key: 'exercise_type', label: 'Type' },
            { key: 'status', label: 'Status' },
            { key: 'scheduled_at', label: 'Scheduled' },
            { key: 'completed_at', label: 'Completed' },
            { key: 'counts_toward_cms', label: 'CMS' }
          ];
          rows = exercises;
          subtitle = `${rows.length} exercises`;
          break;
        }
        case 'capa': {
          const capas = await listRecords<Record<string, unknown>>('corrective_actions', { orderBy: 'due_date', ascending: true });
          columns = [
            { key: 'title', label: 'Action' },
            { key: 'owner_name', label: 'Owner' },
            { key: 'priority', label: 'Priority' },
            { key: 'due_date', label: 'Due' },
            { key: 'status', label: 'Status' }
          ];
          rows = capas;
          subtitle = `${rows.length} corrective actions`;
          break;
        }
      }

      if (format === 'csv') {
        downloadCsv(rows, columns, `${report.key}.csv`);
      } else {
        exportTablePdf(report.title, subtitle, columns, rows, `${report.key}.pdf`);
      }
    } finally {
      setBusy('');
    }
  };

  return (
    <div>
      <PageHeader title="Report Center" subtitle="Exportable reports — PDF for the record, CSV for analysis" />

      <Card className="mb-4">
        <Field label="Incident Scope (for incident-specific reports)">
          <Select value={incidentId} onChange={(e) => setIncidentId(e.target.value)}>
            <option value="">All incidents</option>
            {incidents.map((incident) => (
              <option key={incident.id} value={incident.id}>{incident.name} ({titleCase(incident.status)})</option>
            ))}
          </Select>
        </Field>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((report) => (
          <Card key={report.key} title={<span className="flex items-center gap-2"><FileText size={15} /> {report.title}</span>}>
            <p className="mb-4 text-sm text-slate-400">{report.description}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={busy === `${report.key}-pdf`} onClick={() => void run(report, 'pdf')}>
                <Download size={14} /> PDF
              </Button>
              <Button size="sm" variant="ghost" disabled={busy === `${report.key}-csv`} onClick={() => void run(report, 'csv')}>
                <FileSpreadsheet size={14} /> CSV
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-xs text-slate-500">
        The IAP packet and individual HICS form PDFs are generated inside each incident workspace (IAP Builder / Forms).
        SitRep PDFs export from the SitRep tab, and the compliance evidence binder from Preparedness → Compliance.
      </p>
    </div>
  );
}
