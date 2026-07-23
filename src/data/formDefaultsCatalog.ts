import type { TemplateColumn } from '../types/forms';

// ---------------------------------------------------------------------------
// Defaults library catalog. Each category is an org-level pool of preloaded
// rows (stored in the `form_defaults` table) that responders can pull into a
// HICS form table while filling it, so routine data — contacts, standing
// objectives, aid stations — is typed once and reused every incident.
//
// A category declares which template table fields it can feed via `targets`;
// `map` converts a defaults row into the target table's row shape when the
// columns don't line up 1:1. Categories are configuration, matching the
// data-driven forms engine.
// ---------------------------------------------------------------------------

export interface DefaultsTarget {
  /** Template code the category can feed, e.g. 'HICS 203'. */
  template: string;
  /** Table field key within that template's schema. */
  field: string;
  /** Convert a defaults row into the target table's row shape. Identity when omitted. */
  map?: (row: Record<string, unknown>) => Record<string, unknown>;
}

export interface DefaultsCategory {
  key: string;
  label: string;
  description: string;
  columns: TemplateColumn[];
  targets: DefaultsTarget[];
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const contactMethod = (row: Record<string, unknown>) =>
  [str(row.phone), str(row.email)].filter(Boolean).join(' · ');

export const DEFAULTS_CATEGORIES: DefaultsCategory[] = [
  {
    key: 'personnel',
    label: 'Personnel Contacts',
    description: 'People with contact details — feeds the HICS 203/204/207 assignment tables and the 205A communications list.',
    columns: [
      { key: 'name', label: 'Name', type: 'text', width: 'normal' },
      { key: 'position', label: 'Position / Title', type: 'text', width: 'normal' },
      { key: 'agency', label: 'Agency / Department', type: 'text', width: 'normal' },
      { key: 'phone', label: 'Phone', type: 'text', width: 'normal' },
      { key: 'email', label: 'Email', type: 'text', width: 'normal' }
    ],
    targets: [
      {
        template: 'HICS 203',
        field: 'assignments',
        map: (r) => ({ section: '', position: str(r.position), name: str(r.name), contact: contactMethod(r) })
      },
      {
        template: 'HICS 204',
        field: 'personnel',
        map: (r) => ({ position: str(r.position), name: str(r.name), contact: contactMethod(r) })
      },
      {
        template: 'HICS 205A',
        field: 'contacts',
        map: (r) => ({ assignment: str(r.position), name: str(r.name), method: contactMethod(r) })
      },
      {
        template: 'HICS 207',
        field: 'team',
        map: (r) => ({ section: '', position: str(r.position), name: str(r.name) })
      }
    ]
  },
  {
    key: 'objectives',
    label: 'Incident Objectives',
    description: 'Standing objectives to seed HICS 202 for a new operational period.',
    columns: [
      { key: 'priority', label: '#', type: 'number', width: 'narrow' },
      { key: 'objective', label: 'Objective', type: 'text', width: 'wide' }
    ],
    targets: [{ template: 'HICS 202', field: 'objectives' }]
  },
  {
    key: 'treatment_areas',
    label: 'Staff Treatment Areas',
    description: 'Treatment area names, locations, and unit/team leader contacts for the HICS 206 Staff Medical Plan.',
    columns: [
      { key: 'area_name', label: 'Area Name', type: 'text', width: 'normal' },
      { key: 'location', label: 'Location', type: 'text', width: 'wide' },
      { key: 'unit_team_leader_contact', label: 'Unit / Team Leader Contact Number / Channel', type: 'text', width: 'normal' }
    ],
    targets: [{ template: 'HICS 206', field: 'treatment_areas' }]
  },
  {
    key: 'transport',
    label: 'Ambulance / Transport Services',
    description: 'Transportation services for the HICS 206 Staff Medical Plan.',
    columns: [
      { key: 'vehicle_type', label: 'Ambulance, Bus, Van, Private Vehicle, Air', type: 'text', width: 'normal' },
      { key: 'location', label: 'Location', type: 'text', width: 'normal' },
      { key: 'contact_freq', label: 'Contact Number / Frequency', type: 'text', width: 'normal' },
      { key: 'level_of_service', label: 'Level of Service (ALS/BLS)', type: 'text', width: 'narrow' }
    ],
    targets: [{ template: 'HICS 206', field: 'transportation' }]
  },
  {
    key: 'alternate_care_sites',
    label: 'Alternate Care Sites',
    description: 'Alternate care facility information for the HICS 206 Staff Medical Plan.',
    columns: [
      { key: 'facility_name', label: 'Facility Name', type: 'text', width: 'normal' },
      { key: 'address', label: 'Address', type: 'text', width: 'wide' },
      { key: 'contact_freq', label: 'Contact Number / Frequency', type: 'text', width: 'normal' },
      { key: 'specialty_care', label: 'Specialty Care (Specify)', type: 'text', width: 'normal' }
    ],
    targets: [{ template: 'HICS 206', field: 'alternate_care_sites' }]
  },
  {
    key: 'hazards',
    label: 'Safety Hazards & Mitigations',
    description: 'Recurring hazards and their mitigations for the HICS 215A IAP Safety Analysis.',
    columns: [
      { key: 'location', label: 'Incident Area / Location', type: 'text', width: 'normal' },
      { key: 'hazard', label: 'Hazard / Risk', type: 'text', width: 'wide' },
      { key: 'mitigation', label: 'Mitigation (PPE, controls, procedures)', type: 'text', width: 'wide' }
    ],
    targets: [{ template: 'HICS 215A', field: 'hazards' }]
  },
  {
    key: 'resources',
    label: 'Resource Directory',
    description: 'Key resources, vendors, and agencies for the HICS 258 Hospital Resource Directory.',
    columns: [
      { key: 'resource', label: 'Resource / Service', type: 'text', width: 'wide' },
      { key: 'agency', label: 'Vendor / Agency', type: 'text', width: 'normal' },
      { key: 'contact', label: 'Contact Name', type: 'text', width: 'normal' },
      { key: 'phone', label: 'Phone', type: 'text', width: 'normal' },
      { key: 'notes', label: 'Notes', type: 'text', width: 'normal' }
    ],
    targets: [{ template: 'HICS 258', field: 'directory' }]
  }
];

export function getDefaultsCategory(key: string): DefaultsCategory | undefined {
  return DEFAULTS_CATEGORIES.find((c) => c.key === key);
}

/** Categories that can feed the given template table field. */
export function categoriesForField(templateCode: string, fieldKey: string): DefaultsCategory[] {
  return DEFAULTS_CATEGORIES.filter((c) =>
    c.targets.some((t) => t.template === templateCode && t.field === fieldKey)
  );
}

/** Convert a defaults row into the target field's row shape. */
export function mapDefaultsRow(
  category: DefaultsCategory,
  templateCode: string,
  fieldKey: string,
  row: Record<string, unknown>
): Record<string, unknown> {
  const target = category.targets.find((t) => t.template === templateCode && t.field === fieldKey);
  return target?.map ? target.map(row) : { ...row };
}
