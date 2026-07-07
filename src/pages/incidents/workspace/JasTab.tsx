import { useMemo, useState } from 'react';
import { useIncident } from './IncidentContext';
import { useRecords } from '../../../hooks/useRecords';
import { saveRecord } from '../../../lib/repo';
import { Card, EmptyState, Field, Select, Tabs } from '../../../components/ui';
import { titleCase } from '../../../lib/utils';
import type { HimtAssignment, IrgTemplate, JasProgress, JasTemplate } from '../../../types/domain';

// Interactive Job Action Sheets and Incident Response Guides (spec §11):
// per-position checklists whose progress persists per incident.

export function JasTab() {
  const [tab, setTab] = useState('jas');
  return (
    <div>
      <Tabs
        tabs={[
          { key: 'jas', label: 'Job Action Sheets' },
          { key: 'irg', label: 'Incident Response Guides' }
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'jas' ? <JasPanel /> : <IrgPanel />}
    </div>
  );
}

function useProgress(kind: string) {
  const { incident } = useIncident();
  const { rows: progress, reload } = useRecords<JasProgress>('jas_progress', {
    match: { incident_id: incident.id }
  });

  const getChecked = (code: string): Record<string, boolean> => {
    const row = progress.find((p) => p.position_code === `${kind}:${code}`);
    return (row?.checked_items as Record<string, boolean>) ?? {};
  };

  const toggle = async (code: string, itemKey: string) => {
    const row = progress.find((p) => p.position_code === `${kind}:${code}`);
    const checked = { ...((row?.checked_items as Record<string, boolean>) ?? {}) };
    checked[itemKey] = !checked[itemKey];
    await saveRecord('jas_progress', {
      ...(row ?? { incident_id: incident.id, position_code: `${kind}:${code}` }),
      checked_items: checked
    } as Record<string, unknown>);
    await reload();
  };

  return { getChecked, toggle };
}

function ChecklistItem({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  return (
    <label className="flex min-h-touch cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-slate-800">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-500 bg-slate-800 text-brand-600"
      />
      <span className={`text-sm ${checked ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{label}</span>
    </label>
  );
}

function JasPanel() {
  const { incident } = useIncident();
  const { rows: templates } = useRecords<JasTemplate>('jas_templates', { orderBy: 'position_code' });
  const { rows: assignments } = useRecords<HimtAssignment>('himt_assignments', { match: { incident_id: incident.id } });
  const { getChecked, toggle } = useProgress('jas');
  const [positionCode, setPositionCode] = useState('');

  const template = templates.find((t) => t.position_code === positionCode);
  const checked = getChecked(positionCode);
  const items = (template?.items ?? []) as Array<{ phase: string; text: string }>;
  const phases = useMemo(() => [...new Set(items.map((i) => i.phase))], [items]);
  const doneCount = items.filter((_, i) => checked[String(i)]).length;

  return (
    <div className="space-y-4">
      <Card title="Select Position">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="HICS Position">
            <Select value={positionCode} onChange={(e) => setPositionCode(e.target.value)}>
              <option value="">— Select a position —</option>
              {templates.map((t) => {
                const holder = assignments.find((a) => a.position_code === t.position_code && !a.released_at);
                return (
                  <option key={t.id} value={t.position_code}>
                    {t.title}{holder ? ` — ${holder.assignee_name}` : ''}
                  </option>
                );
              })}
            </Select>
          </Field>
          {template && (
            <div className="flex items-end pb-1 text-sm text-slate-300">
              Progress: <span className="ml-2 font-semibold">{doneCount} / {items.length} complete</span>
            </div>
          )}
        </div>
      </Card>

      {!template ? (
        <EmptyState title="Select a position to open its Job Action Sheet" hint="Checklist progress is saved per incident, so a relieving officer can pick up where the last one left off." />
      ) : (
        phases.map((phase) => (
          <Card key={phase} title={`${titleCase(phase)} Actions`}>
            <div className="space-y-1">
              {items.map((item, index) =>
                item.phase === phase ? (
                  <ChecklistItem
                    key={index}
                    checked={Boolean(checked[String(index)])}
                    label={item.text}
                    onToggle={() => void toggle(positionCode, String(index))}
                  />
                ) : null
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

function IrgPanel() {
  const { rows: irgs } = useRecords<IrgTemplate>('irg_templates', { orderBy: 'title' });
  const { getChecked, toggle } = useProgress('irg');
  const [irgCode, setIrgCode] = useState('');

  const irg = irgs.find((g) => g.code === irgCode);
  const checked = getChecked(irgCode);
  const phases = (irg?.phases ?? []) as Array<{ phase: string; actions: string[] }>;

  return (
    <div className="space-y-4">
      <Card title="Select Scenario Guide">
        <Field label="Incident Response Guide">
          <Select value={irgCode} onChange={(e) => setIrgCode(e.target.value)}>
            <option value="">— Select a scenario —</option>
            {irgs.map((g) => (
              <option key={g.id} value={g.code}>{g.title}</option>
            ))}
          </Select>
        </Field>
      </Card>

      {!irg ? (
        <EmptyState title="Select a scenario to open its response guide" hint="IRGs provide phased response actions for common scenarios — mass casualty, evacuation, active threat, decon, utility failure, and more." />
      ) : (
        phases.map((phase, phaseIndex) => (
          <Card key={phase.phase} title={phase.phase}>
            <div className="space-y-1">
              {phase.actions.map((action, actionIndex) => {
                const key = `${phaseIndex}-${actionIndex}`;
                return (
                  <ChecklistItem
                    key={key}
                    checked={Boolean(checked[key])}
                    label={action}
                    onToggle={() => void toggle(irgCode, key)}
                  />
                );
              })}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
