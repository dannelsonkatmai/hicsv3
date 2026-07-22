import { useMemo, useState } from 'react';
import { ClipboardList, Save } from 'lucide-react';
import { useIncident } from './IncidentContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useRecords } from '../../../hooks/useRecords';
import { saveRecord } from '../../../lib/repo';
import { logAudit } from '../../../lib/audit';
import { Badge, Button, Card, EmptyState, Field, Modal, Select, StatCard } from '../../../components/ui';
import { titleCase } from '../../../lib/utils';
import type { HimtAssignment, Objective, ResourceRequest, CostRecord, JasTemplate, JasProgress } from '../../../types/domain';

export function OverviewTab() {
  const { incident } = useIncident();
  const { profile, refreshProfile } = useAuth();

  const match = { incident_id: incident.id };
  const { rows: assignments } = useRecords<HimtAssignment>('himt_assignments', { match });
  const { rows: objectives } = useRecords<Objective>('objectives', { match });
  const { rows: requests } = useRecords<ResourceRequest>('resource_requests', { match });
  const { rows: costs } = useRecords<CostRecord>('cost_records', { match });

  const { rows: templates } = useRecords<JasTemplate>('jas_templates', { orderBy: 'position_code' });
  const { rows: progressRows, reload: reloadProgress } = useRecords<JasProgress>('jas_progress', { match });

  const defaultPosition = (profile?.preferences as Record<string, unknown>)?.default_ics_position as string | undefined;
  const [selectedPosition, setSelectedPosition] = useState(defaultPosition ?? '');
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [modalPosition, setModalPosition] = useState('');
  const [saveDefault, setSaveDefault] = useState(false);

  const activePosition = defaultPosition || selectedPosition;

  const activeAssignments = assignments.filter((a) => !a.released_at);
  const openObjectives = objectives.filter((o) => o.status !== 'completed');
  const openRequests = requests.filter((r) => ['submitted', 'in_review', 'approved', 'ordered'].includes(r.status));
  const costToDate = costs.reduce((sum, c) => sum + c.amount, 0);

  const template = templates.find((t) => t.position_code === activePosition);
  const progressRow = progressRows.find((p) => p.position_code === `jas:${activePosition}`);
  const checked = (progressRow?.checked_items as Record<string, boolean>) ?? {};
  const items = (template?.items ?? []) as Array<{ phase: string; text: string }>;
  const phases = useMemo(() => [...new Set(items.map((i) => i.phase))], [items]);
  const doneCount = items.filter((_, i) => checked[String(i)]).length;

  const toggleItem = async (itemKey: string) => {
    const newChecked = { ...checked, [itemKey]: !checked[itemKey] };
    await saveRecord('jas_progress', {
      ...(progressRow ?? { incident_id: incident.id, position_code: `jas:${activePosition}` }),
      checked_items: newChecked
    } as Record<string, unknown>);
    await reloadProgress();
  };

  const saveDefaultPosition = async (positionCode: string) => {
    if (!profile) return;
    const newPrefs = { ...(profile.preferences as Record<string, unknown>), default_ics_position: positionCode };
    await saveRecord('profiles', { ...profile, preferences: newPrefs } as Record<string, unknown>);
    logAudit('profile.default_position_set', 'profile', profile.id, { position: positionCode });
    await refreshProfile();
  };

  const confirmPosition = async () => {
    setSelectedPosition(modalPosition);
    if (saveDefault && modalPosition) {
      await saveDefaultPosition(modalPosition);
    }
    setShowPositionModal(false);
    setSaveDefault(false);
  };

  const positionHolder = activePosition
    ? assignments.find((a) => a.position_code === activePosition && !a.released_at)
    : undefined;

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="HIMT Positions Filled" value={activeAssignments.length} tone="blue" />
        <StatCard label="Open Objectives" value={openObjectives.length} tone={openObjectives.length ? 'yellow' : 'green'} />
        <StatCard label="Open Resource Requests" value={openRequests.length} tone={openRequests.length ? 'yellow' : 'slate'} />
        <StatCard label="Cost to Date" value={costToDate.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} />
      </div>

      {!activePosition ? (
        <EmptyState
          title="Select your HICS position to view your Job Action Sheet"
          hint="Your default ICS position drives the dashboard. Choose one to see the checklist for your role."
          action={
            <Button onClick={() => { setModalPosition(''); setSaveDefault(false); setShowPositionModal(true); }}>
              <ClipboardList size={16} /> Select Position
            </Button>
          }
        />
      ) : !template ? (
        <EmptyState
          title={`No Job Action Sheet template for ${activePosition}`}
          hint="No JAS template has been loaded for this position. Contact an administrator to seed the template library."
          action={
            <Button variant="secondary" onClick={() => { setModalPosition(activePosition); setShowPositionModal(true); }}>
              Change Position
            </Button>
          }
        />
      ) : (
        <Card
          title={
            <span className="flex items-center gap-2">
              <ClipboardList size={16} />
              {template.title}
            </span>
          }
          subtitle={
            <span className="flex items-center gap-2">
              {positionHolder && <Badge tone="green">Assigned: {positionHolder.assignee_name}</Badge>}
              <span>Progress: {doneCount} / {items.length} complete</span>
              <button
                onClick={() => { setModalPosition(activePosition); setShowPositionModal(true); }}
                className="text-xs text-brand-400 hover:text-brand-300"
              >
                Change position
              </button>
            </span>
          }
        >
          <div className="space-y-4">
            {phases.map((phase) => (
              <div key={phase}>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{titleCase(phase)} Actions</h4>
                <div className="space-y-1">
                  {items.map((item, index) =>
                    item.phase === phase ? (
                      <label key={index} className="flex min-h-touch cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-slate-800">
                        <input
                          type="checkbox"
                          checked={Boolean(checked[String(index)])}
                          onChange={() => void toggleItem(String(index))}
                          className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-500 bg-slate-800 text-brand-600"
                        />
                        <span className={`text-sm ${checked[String(index)] ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                          {item.text}
                        </span>
                      </label>
                    ) : null
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={showPositionModal} onClose={() => setShowPositionModal(false)} title="Select HICS Position">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Choose the position whose Job Action Sheet you want displayed on this dashboard.
          </p>
          <Field label="HICS Position">
            <Select value={modalPosition} onChange={(e) => setModalPosition(e.target.value)}>
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
          {!defaultPosition && (
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={saveDefault}
                onChange={(e) => setSaveDefault(e.target.checked)}
                className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-brand-600"
              />
              Save as my default position
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowPositionModal(false)}>Cancel</Button>
            <Button onClick={() => void confirmPosition()} disabled={!modalPosition}>
              <Save size={14} /> Confirm
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
