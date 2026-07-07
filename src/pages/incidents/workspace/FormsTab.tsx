import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePlus2, FileText } from 'lucide-react';
import { useIncident } from './IncidentContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useRecords } from '../../../hooks/useRecords';
import { saveRecord, listRecords } from '../../../lib/repo';
import { HICS_FORM_TEMPLATES } from '../../../data/hicsForms';
import { buildPrefillData } from '../../../lib/formPrefill';
import { Badge, Button, Card, DataTable, EmptyState, Tabs, statusTone } from '../../../components/ui';
import { fmtDateTime, titleCase } from '../../../lib/utils';
import type { FormInstance, HimtAssignment } from '../../../types/domain';
import type { FormTemplateDef } from '../../../types/forms';

// Resolve the working template set: bundled HICS 2014 standard forms merged
// with tenant-owned overrides/custom templates from the form_templates table.
export function useResolvedTemplates(): FormTemplateDef[] {
  const { rows: dbTemplates } = useRecords<{ code: string; title: string; category: string; description: string; schema: { sections: [] }; version: number; no_phi: boolean; tenant_id: string | null; is_active: boolean }>('form_templates');
  return useMemo(() => {
    const merged = new Map<string, FormTemplateDef>();
    for (const t of HICS_FORM_TEMPLATES) merged.set(t.code, t);
    for (const t of dbTemplates) {
      if (t.tenant_id && t.is_active !== false && t.schema?.sections) {
        merged.set(t.code, {
          code: t.code,
          title: t.title,
          category: (t.category as FormTemplateDef['category']) ?? 'custom',
          description: t.description ?? '',
          noPhi: t.no_phi,
          version: t.version ?? 1,
          schema: t.schema
        });
      }
    }
    return [...merged.values()];
  }, [dbTemplates]);
}

export function FormsTab() {
  const { incident, currentPeriod } = useIncident();
  const { profile, organization } = useAuth();
  const navigate = useNavigate();
  const templates = useResolvedTemplates();
  const { rows: instances, reload } = useRecords<FormInstance>('form_instances', {
    match: { incident_id: incident.id },
    orderBy: 'updated_at',
    ascending: false
  });
  const [category, setCategory] = useState('all');
  const [busyCode, setBusyCode] = useState('');

  const filteredTemplates = templates.filter((t) => category === 'all' || t.category === category);

  const startForm = async (template: FormTemplateDef) => {
    setBusyCode(template.code);
    try {
      const himtAssignments = await listRecords<HimtAssignment>('himt_assignments', {
        match: { incident_id: incident.id }
      });
      const data = buildPrefillData(template, {
        incident,
        period: currentPeriod,
        profile,
        organization,
        himtAssignments
      });
      const instance = await saveRecord('form_instances', {
        incident_id: incident.id,
        operational_period_id: currentPeriod?.id ?? null,
        template_code: template.code,
        template_title: template.title,
        status: 'draft',
        data,
        version: 1,
        prepared_by: profile?.id ?? null,
        prepared_by_name: profile?.full_name ?? ''
      });
      await reload();
      navigate(`/incidents/${incident.id}/forms/${instance.id}`);
    } finally {
      setBusyCode('');
    }
  };

  return (
    <div className="space-y-5">
      <Card title="Forms for this Incident" subtitle="Filled HICS form instances, versioned and auditable">
        {instances.length === 0 ? (
          <EmptyState title="No forms started yet" hint="Start a form from the catalog below — incident context is pre-filled." />
        ) : (
          <DataTable head={['Form', 'Status', 'Version', 'Prepared By', 'Updated', '']}>
            {instances.map((instance) => (
              <tr key={instance.id} className="hover:bg-slate-800/70">
                <td className="px-4 py-3">
                  <p className="font-medium">{instance.template_code}</p>
                  <p className="text-xs text-slate-400">{instance.template_title}</p>
                </td>
                <td className="px-4 py-3"><Badge tone={statusTone(instance.status)}>{titleCase(instance.status)}</Badge></td>
                <td className="px-4 py-3 text-sm">v{instance.version}</td>
                <td className="px-4 py-3 text-sm">{instance.prepared_by_name || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{fmtDateTime(instance.updated_at)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => navigate(`/incidents/${incident.id}/forms/${instance.id}`)}
                    className="text-sm font-medium text-brand-400 hover:text-brand-300"
                  >
                    Open →
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <Card title="Start a New Form" subtitle="Standard HICS 2014 set plus any organization templates">
        <Tabs
          tabs={[
            { key: 'all', label: 'All' },
            { key: 'command', label: 'IAP / Command' },
            { key: 'situation', label: 'Situation' },
            { key: 'resource', label: 'Resources' },
            { key: 'personnel', label: 'Personnel' },
            { key: 'custom', label: 'Custom' }
          ]}
          active={category}
          onChange={setCategory}
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredTemplates.map((template) => (
            <div key={template.code} className="flex flex-col justify-between rounded-lg border border-slate-700 bg-slate-800 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-brand-400" />
                  <p className="font-semibold text-slate-100">{template.code}</p>
                  {template.noPhi && <Badge tone="red">Aggregate only</Badge>}
                </div>
                <p className="mt-1 text-sm text-slate-300">{template.title}</p>
                <p className="mt-1 text-xs text-slate-500">{template.description}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="mt-3 self-start"
                disabled={busyCode === template.code}
                onClick={() => void startForm(template)}
              >
                <FilePlus2 size={14} /> {busyCode === template.code ? 'Creating…' : 'Start Form'}
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
