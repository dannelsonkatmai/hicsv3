import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useRecords } from '../../hooks/useRecords';
import { saveRecord } from '../../lib/repo';
import { logAudit } from '../../lib/audit';
import { Button, Card, Field, Input, PageHeader, Select, Textarea } from '../../components/ui';
import type { Facility, Incident, IrgTemplate, OperationalPeriod } from '../../types/domain';

// Quick activation: minimal required input, sensible defaults, first
// operational period created automatically. Designed for use under stress.

export function NewIncidentPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { rows: facilities } = useRecords<Facility>('facilities', { orderBy: 'name' });
  const { rows: irgs } = useRecords<IrgTemplate>('irg_templates', { orderBy: 'title' });

  const [name, setName] = useState('');
  const [incidentType, setIncidentType] = useState<Incident['incident_type']>('real');
  const [activationLevel, setActivationLevel] = useState<Incident['activation_level']>('full');
  const [severity, setSeverity] = useState<Incident['severity']>('moderate');
  const [facilityId, setFacilityId] = useState('');
  const [scenario, setScenario] = useState('');
  const [commandLocation, setCommandLocation] = useState('');
  const [description, setDescription] = useState('');
  const [periodHours, setPeriodHours] = useState(12);
  const [busy, setBusy] = useState(false);

  const isTraining = incidentType === 'exercise' || incidentType === 'drill';

  const activate = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const incident = await saveRecord<Partial<Incident> & Record<string, unknown>>('incidents', {
        name,
        incident_type: incidentType,
        activation_level: activationLevel,
        severity,
        facility_id: facilityId || null,
        scenario,
        command_location: commandLocation,
        description,
        status: 'active',
        is_training: isTraining,
        started_at: new Date().toISOString(),
        incident_number: `${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
        created_by: profile?.id ?? null
      });

      const now = new Date();
      await saveRecord<Partial<OperationalPeriod> & Record<string, unknown>>('operational_periods', {
        incident_id: incident.id,
        period_number: 1,
        starts_at: now.toISOString(),
        ends_at: new Date(now.getTime() + periodHours * 3_600_000).toISOString(),
        is_current: true
      });

      logAudit('incident.activated', 'incident', String(incident.id), {
        name,
        incident_type: incidentType,
        activation_level: activationLevel
      });

      navigate(`/incidents/${incident.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Activate Incident" subtitle="Declare a real event, exercise, drill, or planned event" />
      <form onSubmit={activate}>
        <Card>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Incident Name" required span={2}>
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g., Mass Casualty — Highway Incident" autoFocus />
            </Field>
            <Field label="Type" required>
              <Select value={incidentType} onChange={(e) => setIncidentType(e.target.value as Incident['incident_type'])}>
                <option value="real">Real Event</option>
                <option value="exercise">Exercise</option>
                <option value="drill">Drill</option>
                <option value="planned_event">Planned Event</option>
              </Select>
            </Field>
            <Field label="Activation Level" required>
              <Select value={activationLevel} onChange={(e) => setActivationLevel(e.target.value as Incident['activation_level'])}>
                <option value="monitoring">Monitoring</option>
                <option value="partial">Partial Activation</option>
                <option value="full">Full Activation</option>
              </Select>
            </Field>
            <Field label="Severity">
              <Select value={severity} onChange={(e) => setSeverity(e.target.value as Incident['severity'])}>
                <option value="low">Low</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </Select>
            </Field>
            <Field label="Facility">
              <Select value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
                <option value="">— Select facility —</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Scenario / Incident Response Guide">
              <Select value={scenario} onChange={(e) => setScenario(e.target.value)}>
                <option value="">— None / other —</option>
                {irgs.map((irg) => (
                  <option key={irg.id} value={irg.title}>{irg.title}</option>
                ))}
              </Select>
            </Field>
            <Field label="Command Center Location">
              <Input value={commandLocation} onChange={(e) => setCommandLocation(e.target.value)} placeholder="e.g., Admin Conference Room B" />
            </Field>
            <Field label="First Operational Period (hours)">
              <Select value={String(periodHours)} onChange={(e) => setPeriodHours(Number(e.target.value))}>
                <option value="4">4 hours</option>
                <option value="8">8 hours</option>
                <option value="12">12 hours</option>
                <option value="24">24 hours</option>
              </Select>
            </Field>
            <Field label="Situation Description" span={2}>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of the situation…" />
            </Field>
          </div>
          {isTraining && (
            <p className="mt-4 rounded-lg border border-purple-800 bg-purple-950/40 p-3 text-xs text-purple-200">
              Training mode: this {incidentType} is flagged as training so its data stays clearly separated from real
              operations in dashboards and reports.
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate('/incidents')}>Cancel</Button>
            <Button type="submit" variant="danger" size="lg" disabled={busy || !name}>
              {busy ? 'Activating…' : 'Activate Incident'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
