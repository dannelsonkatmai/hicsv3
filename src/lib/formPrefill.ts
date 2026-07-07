import type { FormTemplateDef } from '../types/forms';
import type { HimtAssignment, Incident, OperationalPeriod, Organization, Profile } from '../types/domain';
import { SECTION_LABELS } from '../data/himtPositions';
import { fmtDateTime } from './utils';

export interface PrefillContext {
  incident?: Incident | null;
  period?: OperationalPeriod | null;
  profile?: Profile | null;
  organization?: Organization | null;
  facilityName?: string;
  himtAssignments?: HimtAssignment[];
}

export function periodLabel(period: OperationalPeriod | null | undefined): string {
  if (!period) return '';
  return `Operational Period ${period.period_number}: ${fmtDateTime(period.starts_at)} – ${fmtDateTime(period.ends_at)}`;
}

function resolvePath(path: string, ctx: PrefillContext): unknown {
  const now = new Date();
  switch (path) {
    case 'incident.name': return ctx.incident?.name ?? '';
    case 'incident.number': return ctx.incident?.incident_number ?? '';
    case 'period.label': return periodLabel(ctx.period);
    case 'user.full_name': return ctx.profile?.full_name ?? '';
    case 'org.name': return ctx.organization?.name ?? '';
    case 'facility.name': return ctx.facilityName ?? '';
    case 'now.date': return now.toISOString().slice(0, 10);
    case 'now.time': return now.toTimeString().slice(0, 5);
    case 'now.datetime': return now.toISOString().slice(0, 16);
    default: return undefined;
  }
}

/**
 * Build initial data for a new form instance: incident/org/user context is
 * pre-populated so responders never retype it, and the HIMT chart flows into
 * the 203/207 assignment tables.
 */
export function buildPrefillData(template: FormTemplateDef, ctx: PrefillContext): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const section of template.schema.sections) {
    for (const field of section.fields) {
      if (field.type === 'table') {
        if (field.prefill === 'himt.table' && ctx.himtAssignments?.length) {
          data[field.key] = ctx.himtAssignments
            .filter((a) => !a.released_at)
            .map((a) => ({
              section: SECTION_LABELS[a.section] ?? a.section,
              position: a.position_title || a.position_code,
              name: a.assignee_name,
              contact: a.contact_info
            }));
        } else if (field.defaultRows) {
          data[field.key] = field.defaultRows.map((row) => ({ ...row }));
        } else {
          data[field.key] = [];
        }
      } else if (field.prefill) {
        const value = resolvePath(field.prefill, ctx);
        if (value !== undefined) data[field.key] = value;
      }
    }
  }
  return data;
}
