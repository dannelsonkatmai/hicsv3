import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Download, ListPlus, Save } from 'lucide-react';
import { useIncident } from './IncidentContext';
import { useAuth } from '../../../contexts/AuthContext';
import { getRecord, saveRecord, insertRecord } from '../../../lib/repo';
import { logAudit } from '../../../lib/audit';
import { findPhiIssues } from '../../../lib/noPhi';
import { exportFormPdf } from '../../../lib/pdf';
import { periodLabel } from '../../../lib/formPrefill';
import { categoriesForField } from '../../../data/formDefaultsCatalog';
import { FormRenderer } from '../../../components/FormRenderer';
import { LoadDefaultsModal } from '../../../components/LoadDefaultsModal';
import { Badge, Button, Spinner, statusTone } from '../../../components/ui';
import { titleCase } from '../../../lib/utils';
import { useResolvedTemplates } from './FormsTab';
import type { FormInstance } from '../../../types/domain';
import type { TemplateField } from '../../../types/forms';

export function FormFillPage() {
  const { instanceId = '' } = useParams();
  const navigate = useNavigate();
  const { incident, currentPeriod } = useIncident();
  const { profile, can } = useAuth();
  const templates = useResolvedTemplates();

  const [instance, setInstance] = useState<FormInstance | null>(null);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState('');
  const [defaultsField, setDefaultsField] = useState<TemplateField | null>(null);

  useEffect(() => {
    void getRecord<FormInstance>('form_instances', instanceId).then((row) => {
      setInstance(row);
      setData(row?.data ?? {});
      setLoading(false);
    });
  }, [instanceId]);

  if (loading) return <Spinner label="Loading form…" />;
  if (!instance) return <p className="text-slate-400">Form not found.</p>;

  const template = templates.find((t) => t.code === instance.template_code);
  if (!template) return <p className="text-slate-400">Template {instance.template_code} not found.</p>;

  const readOnly = instance.status === 'final';

  const save = async (statusOverride?: FormInstance['status']) => {
    setError('');
    if (template.noPhi) {
      const issues = findPhiIssues(data);
      if (issues.length) {
        setError(
          `Blocked by the no-PHI rule — remove patient-identifying content before saving: ${issues
            .map((i) => i.message)
            .join('; ')}`
        );
        return;
      }
    }
    setSaving(true);
    try {
      const nextVersion = instance.version + (dirty ? 1 : 0);
      const updated = await saveRecord('form_instances', {
        ...instance,
        data,
        version: nextVersion,
        status: statusOverride ?? instance.status,
        approved_by: statusOverride === 'approved' ? profile?.id ?? null : instance.approved_by,
        approved_at: statusOverride === 'approved' ? new Date().toISOString() : instance.approved_at
      } as unknown as Record<string, unknown>);
      // Append-only version history for the audit trail.
      await insertRecord('form_instance_versions', {
        form_instance_id: instance.id,
        version: nextVersion,
        data,
        saved_by: profile?.id ?? null,
        saved_at: new Date().toISOString()
      });
      logAudit(statusOverride === 'approved' ? 'form.approved' : 'form.saved', 'form_instance', instance.id, {
        template: instance.template_code,
        version: nextVersion
      });
      setInstance(updated as unknown as FormInstance);
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/incidents/${incident.id}/forms`)}>
            <ArrowLeft size={16} /> Forms
          </Button>
          <div>
            <h2 className="text-lg font-bold text-slate-100">{template.code} — {template.title}</h2>
            <p className="text-xs text-slate-400">Version {instance.version} · {periodLabel(currentPeriod) || 'No operational period'}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(instance.status)}>{titleCase(instance.status)}</Badge>
          {savedAt && <span className="text-xs text-slate-500">Saved {savedAt}</span>}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => exportFormPdf(template, data, { incidentName: incident.name, periodLabel: periodLabel(currentPeriod) })}
          >
            <Download size={15} /> PDF
          </Button>
          {!readOnly && (
            <Button size="sm" onClick={() => void save()} disabled={saving}>
              <Save size={15} /> {saving ? 'Saving…' : 'Save'}
            </Button>
          )}
          {!readOnly && instance.status !== 'approved' && can('approve_iap') && (
            <Button size="sm" variant="success" onClick={() => void save('approved')} disabled={saving}>
              <CheckCircle2 size={15} /> Approve
            </Button>
          )}
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">{error}</p>}

      <FormRenderer
        template={template}
        data={data}
        readOnly={readOnly}
        onChange={(next) => {
          setData(next);
          setDirty(true);
        }}
        tableAction={(field) =>
          categoriesForField(template.code, field.key).length > 0 ? (
            <Button variant="ghost" size="sm" type="button" onClick={() => setDefaultsField(field)}>
              <ListPlus size={15} /> Load Defaults
            </Button>
          ) : null
        }
      />

      <LoadDefaultsModal
        open={defaultsField !== null}
        onClose={() => setDefaultsField(null)}
        templateCode={template.code}
        field={defaultsField}
        onAppend={(rows) => {
          if (!defaultsField) return;
          const existing = Array.isArray(data[defaultsField.key])
            ? (data[defaultsField.key] as Array<Record<string, unknown>>)
            : [];
          setData({ ...data, [defaultsField.key]: [...existing, ...rows] });
          setDirty(true);
        }}
      />
    </div>
  );
}
