import { Link } from 'react-router-dom';
import { TriangleAlert as AlertTriangle, ArrowRight, CalendarClock, ClipboardList, ShieldCheck } from 'lucide-react';
import { useRecords } from '../hooks/useRecords';
import { useAuth } from '../contexts/AuthContext';
import { Badge, Button, Card, EmptyState, PageHeader, StatCard, statusTone } from '../components/ui';
import { fmtDate, fmtDateTime, titleCase } from '../lib/utils';
import type { CorrectiveAction, Exercise, Incident, ResourceRequest } from '../types/domain';

const ACTIVE_INCIDENT_OPTS = { orderBy: 'started_at', ascending: false, limit: 20 } as const;
const PLANNED_EXERCISE_OPTS = { match: { status: 'planned' }, orderBy: 'scheduled_at', ascending: true, limit: 5 } as const;
const COMPLETED_EXERCISE_OPTS = { match: { status: 'completed' }, orderBy: 'completed_at', ascending: false, limit: 50 } as const;
const OPEN_REQUESTS_OPTS = { orderBy: 'created_at', ascending: false, limit: 50 } as const;
const OPEN_CAPA_OPTS = { orderBy: 'due_date', ascending: true, limit: 50 } as const;

export function DashboardPage() {
  const { organization, profile, can } = useAuth();
  const { rows: incidents } = useRecords<Incident>('incidents', ACTIVE_INCIDENT_OPTS);
  const { rows: requests } = useRecords<ResourceRequest>('resource_requests', OPEN_REQUESTS_OPTS);
  const { rows: upcomingExercises } = useRecords<Exercise>('exercises', PLANNED_EXERCISE_OPTS);
  const { rows: completedExercises } = useRecords<Exercise>('exercises', COMPLETED_EXERCISE_OPTS);
  const { rows: capas } = useRecords<CorrectiveAction>('corrective_actions', OPEN_CAPA_OPTS);

  const activeIncidents = incidents.filter((i) => i.status === 'active' || i.status === 'demobilizing');
  const openRequests = requests.filter((r) => ['submitted', 'in_review', 'approved', 'ordered'].includes(r.status));
  const openCapas = capas.filter((c) => c.status === 'open' || c.status === 'in_progress');
  const overdueCapas = openCapas.filter((c) => c.due_date && c.due_date < new Date().toISOString().slice(0, 10));

  const thisYear = new Date().getFullYear();
  const cmsExercisesThisYear = completedExercises.filter(
    (e) => e.counts_toward_cms && e.completed_at?.startsWith(String(thisYear))
  ).length;

  return (
    <div>
      <PageHeader
        title={`Welcome back${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}`}
        subtitle={organization?.name}
        actions={
          can('declare_incident') && (
            <Link to="/incidents/new">
              <Button variant="danger">
                <AlertTriangle size={16} /> Activate Incident
              </Button>
            </Link>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active Incidents" value={activeIncidents.length} tone={activeIncidents.length ? 'red' : 'green'} />
        <StatCard label="Open Resource Requests" value={openRequests.length} tone={openRequests.length ? 'yellow' : 'slate'} />
        <StatCard
          label={`CMS Exercises · ${thisYear}`}
          value={`${cmsExercisesThisYear} / 2`}
          tone={cmsExercisesThisYear >= 2 ? 'green' : 'yellow'}
          hint="Two required per year for inpatient providers"
        />
        <StatCard label="Open Corrective Actions" value={openCapas.length} tone={overdueCapas.length ? 'red' : 'slate'} hint={overdueCapas.length ? `${overdueCapas.length} overdue` : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Active Incidents"
          actions={<Link to="/incidents" className="text-xs text-brand-400 hover:text-brand-300">View all</Link>}
        >
          {activeIncidents.length === 0 ? (
            <EmptyState
              title="No active incidents"
              hint="When an incident, drill, or exercise is activated it appears here with quick access to the command workspace."
            />
          ) : (
            <div className="space-y-2">
              {activeIncidents.map((incident) => (
                <Link
                  key={incident.id}
                  to={`/incidents/${incident.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 p-3 hover:border-brand-600"
                >
                  <div>
                    <p className="font-medium text-slate-100">{incident.name}</p>
                    <p className="text-xs text-slate-400">
                      {titleCase(incident.incident_type)} · {titleCase(incident.activation_level)} activation · Started {fmtDateTime(incident.started_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone(incident.status)}>{titleCase(incident.status)}</Badge>
                    <ArrowRight size={16} className="text-slate-500" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card
          title={<span className="flex items-center gap-2"><CalendarClock size={15} /> Upcoming Exercises & Drills</span>}
          actions={<Link to="/preparedness/exercises" className="text-xs text-brand-400 hover:text-brand-300">Scheduler</Link>}
        >
          {upcomingExercises.length === 0 ? (
            <EmptyState title="Nothing scheduled" hint="Plan tabletop, functional, and full-scale exercises from the scheduler." />
          ) : (
            <div className="space-y-2">
              {upcomingExercises.map((exercise) => (
                <div key={exercise.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-100">{exercise.title}</p>
                    <p className="text-xs text-slate-400">{titleCase(exercise.exercise_type)} · {fmtDate(exercise.scheduled_at)}</p>
                  </div>
                  {exercise.counts_toward_cms && <Badge tone="blue">CMS</Badge>}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title={<span className="flex items-center gap-2"><ClipboardList size={15} /> Corrective Actions Due</span>}
          actions={<Link to="/preparedness/capa" className="text-xs text-brand-400 hover:text-brand-300">Tracker</Link>}
        >
          {openCapas.length === 0 ? (
            <EmptyState title="No open corrective actions" />
          ) : (
            <div className="space-y-2">
              {openCapas.slice(0, 5).map((capa) => (
                <div key={capa.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-100">{capa.title}</p>
                    <p className="text-xs text-slate-400">{capa.owner_name || 'Unassigned'} · Due {fmtDate(capa.due_date)}</p>
                  </div>
                  <Badge tone={capa.due_date && capa.due_date < new Date().toISOString().slice(0, 10) ? 'red' : statusTone(capa.status)}>
                    {titleCase(capa.status)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title={<span className="flex items-center gap-2"><ShieldCheck size={15} /> Program Snapshot</span>}
          actions={<Link to="/preparedness/compliance" className="text-xs text-brand-400 hover:text-brand-300">Compliance</Link>}
        >
          <ul className="space-y-2 text-sm text-slate-300">
            <li className="flex justify-between border-b border-slate-700/60 pb-2">
              <span>Total incidents loaded</span>
              <span className="font-semibold">{incidents.length}</span>
            </li>
            <li className="flex justify-between border-b border-slate-700/60 pb-2">
              <span>Open resource requests</span>
              <span className="font-semibold">{openRequests.length}</span>
            </li>
            <li className="flex justify-between border-b border-slate-700/60 pb-2">
              <span>Exercises completed</span>
              <span className="font-semibold">{completedExercises.length}</span>
            </li>
            <li className="flex justify-between">
              <span>Open corrective actions</span>
              <span className="font-semibold">{openCapas.length}</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
