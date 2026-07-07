import type { FormTemplateDef, TemplateField, TemplateSection } from '../types/forms';

// ---------------------------------------------------------------------------
// Standard HICS 2014 form catalog, expressed as data-driven templates.
//
// These bundled definitions are the offline-first source for the standard set;
// tenant-customized templates saved to the `form_templates` table override a
// bundled template with the same code. Field definitions are a working
// starter representation of the HICS 2014 forms — verify against the current
// ASPR TRACIE / California EMSA releases before survey-critical use.
//
// NO-PHI RULE: forms 254, 255, 259, 260 are implemented in aggregate
// count/status mode only. They contain no patient-identifier fields and the
// renderer enforces a no-PHI banner + save-time validation.
// ---------------------------------------------------------------------------

const header = (...extra: TemplateField[]): TemplateSection => ({
  title: 'Incident Information',
  fields: [
    { key: 'incident_name', label: 'Incident Name', type: 'text', required: true, prefill: 'incident.name' },
    { key: 'date_prepared', label: 'Date Prepared', type: 'date', prefill: 'now.date' },
    { key: 'time_prepared', label: 'Time Prepared', type: 'time', prefill: 'now.time' },
    { key: 'operational_period', label: 'Operational Period (#, date/time)', type: 'text', prefill: 'period.label', span: 3 },
    ...extra
  ]
});

const preparedBy = (roleLabel: string): TemplateSection => ({
  title: 'Prepared By',
  fields: [
    { key: 'prepared_by', label: `Prepared By (${roleLabel})`, type: 'text', prefill: 'user.full_name' },
    { key: 'prepared_signature', label: 'Signature', type: 'signature' },
    { key: 'prepared_datetime', label: 'Date/Time', type: 'datetime', prefill: 'now.datetime' }
  ]
});

const TRIAGE_CATEGORIES = ['Immediate (Red)', 'Delayed (Yellow)', 'Minimal (Green)', 'Expectant', 'Deceased'];

export const HICS_FORM_TEMPLATES: FormTemplateDef[] = [
  {
    code: 'HICS 200',
    title: 'Incident Action Plan (IAP) Cover Sheet',
    category: 'command',
    description: 'Cover sheet / quick start for the IAP packet for one operational period.',
    version: 1,
    schema: {
      sections: [
        header(),
        {
          title: 'Forms Included in this IAP',
          fields: [
            {
              key: 'forms_included',
              label: 'Included Forms',
              type: 'table',
              span: 3,
              columns: [
                { key: 'form', label: 'Form', type: 'text', width: 'wide' },
                { key: 'included', label: 'Included', type: 'checkbox', width: 'narrow' }
              ],
              defaultRows: [
                { form: 'HICS 201 — Incident Briefing', included: false },
                { form: 'HICS 202 — Incident Objectives', included: true },
                { form: 'HICS 203 — Organization Assignment List', included: true },
                { form: 'HICS 204 — Branch/Division Assignment List', included: false },
                { form: 'HICS 205A — Communications List', included: false },
                { form: 'HICS 206 — Staff Medical Plan', included: false },
                { form: 'HICS 215A — IAP Safety Analysis', included: true },
                { form: 'Other (list below)', included: false }
              ]
            },
            { key: 'other_forms', label: 'Other Attachments', type: 'textarea', span: 3 }
          ]
        },
        {
          title: 'Approval',
          fields: [
            { key: 'prepared_by', label: 'Prepared By (Planning Section Chief)', type: 'text', prefill: 'user.full_name' },
            { key: 'approved_by', label: 'Approved By (Incident Commander)', type: 'text' },
            { key: 'approval_datetime', label: 'Approval Date/Time', type: 'datetime' }
          ]
        }
      ]
    }
  },
  {
    code: 'HICS 201',
    title: 'Incident Briefing',
    category: 'command',
    description: 'Initial situation, actions, and command structure at incident onset.',
    version: 1,
    schema: {
      sections: [
        header(),
        {
          title: 'Situation',
          fields: [
            { key: 'situation_summary', label: 'Current Situation (nature and scope of incident)', type: 'textarea', span: 3, required: true },
            { key: 'initial_objectives', label: 'Initial Incident Objectives', type: 'textarea', span: 3 },
            { key: 'current_organization', label: 'Current Organization (positions activated)', type: 'textarea', span: 3 }
          ]
        },
        {
          title: 'Actions',
          fields: [
            {
              key: 'actions',
              label: 'Summary of Actions (current and planned)',
              type: 'table',
              span: 3,
              columns: [
                { key: 'time', label: 'Time', type: 'time', width: 'narrow' },
                { key: 'action', label: 'Action', type: 'text', width: 'wide' }
              ]
            }
          ]
        },
        preparedBy('Incident Commander')
      ]
    }
  },
  {
    code: 'HICS 202',
    title: 'Incident Objectives',
    category: 'command',
    description: 'Objectives, situational concerns, and safety messaging for the operational period.',
    version: 1,
    schema: {
      sections: [
        header(),
        {
          title: 'Objectives',
          fields: [
            {
              key: 'objectives',
              label: 'Objectives for this Operational Period',
              type: 'table',
              span: 3,
              columns: [
                { key: 'priority', label: '#', type: 'number', width: 'narrow' },
                { key: 'objective', label: 'Objective', type: 'text', width: 'wide' }
              ]
            }
          ]
        },
        {
          title: 'Period Considerations',
          fields: [
            { key: 'weather', label: 'Weather / Environmental Concerns', type: 'textarea', span: 3 },
            { key: 'safety_message', label: 'General Safety Message', type: 'textarea', span: 3 },
            { key: 'attachments', label: 'Attachments (list)', type: 'textarea', span: 3 }
          ]
        },
        {
          title: 'Approval',
          fields: [
            { key: 'prepared_by', label: 'Prepared By (Planning Section Chief)', type: 'text', prefill: 'user.full_name' },
            { key: 'approved_by', label: 'Approved By (Incident Commander)', type: 'text' },
            { key: 'approval_datetime', label: 'Date/Time Approved', type: 'datetime' }
          ]
        }
      ]
    }
  },
  {
    code: 'HICS 203',
    title: 'Organization Assignment List',
    category: 'command',
    description: 'Who holds each HIMT position for the operational period.',
    version: 1,
    schema: {
      sections: [
        header(),
        {
          title: 'Position Assignments',
          description: 'Pre-filled from the incident HIMT chart; edit as needed.',
          fields: [
            {
              key: 'assignments',
              label: 'HIMT Assignments',
              type: 'table',
              span: 3,
              prefill: 'himt.table',
              columns: [
                { key: 'section', label: 'Section', type: 'select', options: ['Command', 'Operations', 'Planning', 'Logistics', 'Finance/Admin'], width: 'normal' },
                { key: 'position', label: 'Position', type: 'text', width: 'wide' },
                { key: 'name', label: 'Name', type: 'text', width: 'normal' },
                { key: 'contact', label: 'Contact (phone/radio)', type: 'text', width: 'normal' }
              ]
            }
          ]
        },
        preparedBy('Resources Unit Leader / Planning')
      ]
    }
  },
  {
    code: 'HICS 204',
    title: 'Branch/Division Assignment List',
    category: 'command',
    description: 'Work assignments for a branch or division during the operational period.',
    version: 1,
    schema: {
      sections: [
        header(
          { key: 'branch', label: 'Branch', type: 'text' },
          { key: 'division_group', label: 'Division / Group', type: 'text' }
        ),
        {
          title: 'Personnel',
          fields: [
            {
              key: 'personnel',
              label: 'Assigned Personnel',
              type: 'table',
              span: 3,
              columns: [
                { key: 'position', label: 'Position', type: 'text', width: 'normal' },
                { key: 'name', label: 'Name', type: 'text', width: 'normal' },
                { key: 'contact', label: 'Contact', type: 'text', width: 'normal' }
              ]
            }
          ]
        },
        {
          title: 'Assignments',
          fields: [
            {
              key: 'work_assignments',
              label: 'Work Assignments',
              type: 'table',
              span: 3,
              columns: [
                { key: 'task', label: 'Task', type: 'text', width: 'wide' },
                { key: 'location', label: 'Location', type: 'text', width: 'normal' },
                { key: 'due', label: 'Complete By', type: 'time', width: 'narrow' }
              ]
            },
            { key: 'special_instructions', label: 'Special Instructions', type: 'textarea', span: 3 }
          ]
        },
        preparedBy('Branch Director / Section Chief')
      ]
    }
  },
  {
    code: 'HICS 205A',
    title: 'Communications List',
    category: 'command',
    description: 'How to reach assigned personnel and key contacts this operational period.',
    version: 1,
    schema: {
      sections: [
        header(),
        {
          title: 'Basic Communications Plan',
          fields: [
            {
              key: 'contacts',
              label: 'Communications List',
              type: 'table',
              span: 3,
              columns: [
                { key: 'assignment', label: 'Assignment / Position', type: 'text', width: 'normal' },
                { key: 'name', label: 'Name', type: 'text', width: 'normal' },
                { key: 'method', label: 'Contact Method(s) (phone, radio channel, pager)', type: 'text', width: 'wide' }
              ]
            }
          ]
        },
        preparedBy('Communications Unit Leader')
      ]
    }
  },
  {
    code: 'HICS 206',
    title: 'Staff Medical Plan',
    category: 'command',
    description: 'Medical care available to incident staff, aid stations, and transport.',
    version: 1,
    schema: {
      sections: [
        header(),
        {
          title: 'Staff Medical Aid',
          fields: [
            {
              key: 'aid_stations',
              label: 'Medical Aid Stations',
              type: 'table',
              span: 3,
              columns: [
                { key: 'location', label: 'Location', type: 'text', width: 'wide' },
                { key: 'hours', label: 'Hours', type: 'text', width: 'narrow' },
                { key: 'staffed', label: 'Staffed', type: 'checkbox', width: 'narrow' }
              ]
            },
            {
              key: 'transport',
              label: 'Transportation / Ambulance Services',
              type: 'table',
              span: 3,
              columns: [
                { key: 'service', label: 'Service', type: 'text', width: 'wide' },
                { key: 'phone', label: 'Phone', type: 'text', width: 'normal' },
                { key: 'als', label: 'ALS', type: 'checkbox', width: 'narrow' }
              ]
            },
            { key: 'procedures', label: 'Special Medical Emergency Procedures for Staff', type: 'textarea', span: 3 }
          ]
        },
        {
          title: 'Review',
          fields: [
            { key: 'prepared_by', label: 'Prepared By (Support Branch Director)', type: 'text', prefill: 'user.full_name' },
            { key: 'reviewed_by', label: 'Reviewed By (Safety Officer)', type: 'text' },
            { key: 'review_datetime', label: 'Date/Time', type: 'datetime' }
          ]
        }
      ]
    }
  },
  {
    code: 'HICS 207',
    title: 'Incident Management Team Chart',
    category: 'command',
    description: 'The HIMT organization chart for the incident.',
    version: 1,
    schema: {
      sections: [
        header(),
        {
          title: 'Team Chart',
          description: 'Pre-filled from the incident HIMT assignments.',
          fields: [
            {
              key: 'team',
              label: 'Positions and Assignees',
              type: 'table',
              span: 3,
              prefill: 'himt.table',
              columns: [
                { key: 'section', label: 'Section', type: 'select', options: ['Command', 'Operations', 'Planning', 'Logistics', 'Finance/Admin'], width: 'normal' },
                { key: 'position', label: 'Position', type: 'text', width: 'wide' },
                { key: 'name', label: 'Assigned To', type: 'text', width: 'normal' }
              ]
            }
          ]
        },
        preparedBy('Planning Section Chief')
      ]
    }
  },
  {
    code: 'HICS 213',
    title: 'Incident Message Form',
    category: 'command',
    description: 'Formal message between incident positions, with reply.',
    version: 1,
    schema: {
      sections: [
        header(),
        {
          title: 'Message',
          fields: [
            { key: 'to_name', label: 'To (Name)', type: 'text', required: true },
            { key: 'to_position', label: 'To (Position)', type: 'text' },
            { key: 'priority', label: 'Priority', type: 'select', options: ['Routine', 'Urgent', 'Immediate'] },
            { key: 'from_name', label: 'From (Name)', type: 'text', prefill: 'user.full_name' },
            { key: 'from_position', label: 'From (Position)', type: 'text' },
            { key: 'subject', label: 'Subject', type: 'text', span: 3 },
            { key: 'message', label: 'Message', type: 'textarea', span: 3, required: true }
          ]
        },
        {
          title: 'Reply',
          fields: [
            { key: 'reply', label: 'Reply', type: 'textarea', span: 3 },
            { key: 'reply_by', label: 'Replied By', type: 'text' },
            { key: 'reply_datetime', label: 'Reply Date/Time', type: 'datetime' }
          ]
        }
      ]
    }
  },
  {
    code: 'HICS 214',
    title: 'Operational/Activity Log',
    category: 'command',
    description: 'Chronological log of notable activities for a section or position.',
    version: 1,
    schema: {
      sections: [
        header(
          { key: 'section', label: 'Section', type: 'select', options: ['Command', 'Operations', 'Planning', 'Logistics', 'Finance/Admin'] },
          { key: 'position', label: 'Position', type: 'text' }
        ),
        {
          title: 'Activity Log',
          fields: [
            {
              key: 'entries',
              label: 'Entries',
              type: 'table',
              span: 3,
              columns: [
                { key: 'time', label: 'Time', type: 'time', width: 'narrow' },
                { key: 'activity', label: 'Notable Activity', type: 'text', width: 'wide' }
              ]
            }
          ]
        },
        preparedBy('Position holder')
      ]
    }
  },
  {
    code: 'HICS 215A',
    title: 'Incident Action Plan Safety Analysis',
    category: 'command',
    description: 'Hazards affecting the operational period and their mitigations.',
    version: 1,
    schema: {
      sections: [
        header(),
        {
          title: 'Safety Analysis',
          fields: [
            {
              key: 'hazards',
              label: 'Hazards and Mitigations',
              type: 'table',
              span: 3,
              columns: [
                { key: 'location', label: 'Incident Area / Location', type: 'text', width: 'normal' },
                { key: 'hazard', label: 'Hazard / Risk', type: 'text', width: 'wide' },
                { key: 'mitigation', label: 'Mitigation (PPE, controls, procedures)', type: 'text', width: 'wide' }
              ]
            }
          ]
        },
        preparedBy('Safety Officer')
      ]
    }
  },
  {
    code: 'HICS 251',
    title: 'Facility System Status Report',
    category: 'situation',
    description: 'Red/yellow/green status of utilities and infrastructure systems.',
    version: 1,
    schema: {
      sections: [
        header(),
        {
          title: 'System Status',
          fields: [
            {
              key: 'systems',
              label: 'Facility Systems',
              type: 'table',
              span: 3,
              columns: [
                { key: 'system', label: 'System', type: 'text', width: 'wide' },
                { key: 'status', label: 'Status', type: 'select', options: ['Green — Operational', 'Yellow — Impaired', 'Red — Non-functional', 'Unknown'], width: 'normal' },
                { key: 'comments', label: 'Comments / Estimated Restoration', type: 'text', width: 'wide' }
              ],
              defaultRows: [
                { system: 'Electrical Power — Normal', status: 'Green — Operational', comments: '' },
                { system: 'Electrical Power — Emergency Generator', status: 'Green — Operational', comments: '' },
                { system: 'Water — Domestic', status: 'Green — Operational', comments: '' },
                { system: 'Water — Potable', status: 'Green — Operational', comments: '' },
                { system: 'Medical Gases (O2, air, vacuum)', status: 'Green — Operational', comments: '' },
                { system: 'HVAC', status: 'Green — Operational', comments: '' },
                { system: 'Steam / Boiler', status: 'Green — Operational', comments: '' },
                { system: 'Sewage / Sanitation', status: 'Green — Operational', comments: '' },
                { system: 'Information Technology / EHR', status: 'Green — Operational', comments: '' },
                { system: 'Telephone / Communications', status: 'Green — Operational', comments: '' },
                { system: 'Fire Alarm / Suppression', status: 'Green — Operational', comments: '' },
                { system: 'Elevators / Vertical Transport', status: 'Green — Operational', comments: '' },
                { system: 'Security Systems / Access Control', status: 'Green — Operational', comments: '' },
                { system: 'Food Services', status: 'Green — Operational', comments: '' },
                { system: 'Structural Integrity', status: 'Green — Operational', comments: '' }
              ]
            }
          ]
        },
        preparedBy('Infrastructure Branch Director')
      ]
    }
  },
  {
    code: 'HICS 252',
    title: 'Section Personnel Time Sheet',
    category: 'personnel',
    description: 'Time in/out for personnel in a section; feeds labor cost analysis.',
    version: 1,
    schema: {
      sections: [
        header(
          { key: 'section', label: 'Section', type: 'select', options: ['Command', 'Operations', 'Planning', 'Logistics', 'Finance/Admin'] }
        ),
        {
          title: 'Time Records',
          fields: [
            {
              key: 'time_records',
              label: 'Personnel Time',
              type: 'table',
              span: 3,
              columns: [
                { key: 'name', label: 'Name', type: 'text', width: 'normal' },
                { key: 'position', label: 'Position', type: 'text', width: 'normal' },
                { key: 'date', label: 'Date', type: 'date', width: 'narrow' },
                { key: 'time_in', label: 'Time In', type: 'time', width: 'narrow' },
                { key: 'time_out', label: 'Time Out', type: 'time', width: 'narrow' },
                { key: 'hours', label: 'Hours', type: 'number', width: 'narrow' }
              ]
            }
          ]
        },
        preparedBy('Time Unit Leader')
      ]
    }
  },
  {
    code: 'HICS 253',
    title: 'Volunteer Staff Registration',
    category: 'personnel',
    description: 'Registration and credential verification for volunteer staff (staff PII — protected, not PHI).',
    version: 1,
    schema: {
      sections: [
        header(),
        {
          title: 'Volunteer Registration',
          fields: [
            {
              key: 'volunteers',
              label: 'Volunteers',
              type: 'table',
              span: 3,
              columns: [
                { key: 'name', label: 'Name', type: 'text', width: 'normal' },
                { key: 'license', label: 'License / Certification', type: 'text', width: 'normal' },
                { key: 'id_verified', label: 'ID Verified', type: 'checkbox', width: 'narrow' },
                { key: 'license_verified', label: 'License Verified', type: 'checkbox', width: 'narrow' },
                { key: 'assignment', label: 'Assignment', type: 'text', width: 'normal' },
                { key: 'time_in', label: 'Time In', type: 'time', width: 'narrow' },
                { key: 'time_out', label: 'Time Out', type: 'time', width: 'narrow' }
              ]
            }
          ]
        },
        preparedBy('Labor Pool & Credentialing Unit Leader')
      ]
    }
  },
  {
    code: 'HICS 254',
    title: 'Disaster Victim/Patient Tracking (Aggregate)',
    category: 'situation',
    description: 'AGGREGATE MODE: counts by triage category, area, and status. No patient identifiers.',
    noPhi: true,
    version: 1,
    schema: {
      sections: [
        header(),
        {
          title: 'Patient Counts by Category',
          description: 'Counts and status only. Never enter names, MRNs, dates of birth, or any patient identifier.',
          fields: [
            {
              key: 'tracking',
              label: 'Tracking Counts',
              type: 'table',
              span: 3,
              columns: [
                { key: 'category', label: 'Triage Category', type: 'select', options: TRIAGE_CATEGORIES, width: 'normal' },
                { key: 'area', label: 'Unit / Area', type: 'text', width: 'normal' },
                { key: 'count', label: 'Count', type: 'number', width: 'narrow' },
                { key: 'status', label: 'Status', type: 'select', options: ['In treatment', 'Awaiting disposition', 'Admitted', 'Transferred', 'Discharged'], width: 'normal' }
              ]
            },
            { key: 'total_patients', label: 'Total Patients (all categories)', type: 'number' },
            { key: 'notes', label: 'Notes (no identifiers)', type: 'textarea', span: 2 }
          ]
        },
        preparedBy('Medical Care Branch Director')
      ]
    }
  },
  {
    code: 'HICS 255',
    title: 'Master Patient Evacuation Tracking (Aggregate)',
    category: 'situation',
    description: 'AGGREGATE MODE: evacuation counts by unit and destination. No patient identifiers.',
    noPhi: true,
    version: 1,
    schema: {
      sections: [
        header(),
        {
          title: 'Evacuation Counts by Unit',
          description: 'Counts and status only. Never enter names, MRNs, dates of birth, or any patient identifier.',
          fields: [
            {
              key: 'evacuation',
              label: 'Evacuation Progress',
              type: 'table',
              span: 3,
              columns: [
                { key: 'unit', label: 'Unit / Area', type: 'text', width: 'normal' },
                { key: 'to_evacuate', label: 'To Evacuate', type: 'number', width: 'narrow' },
                { key: 'evacuated', label: 'Evacuated', type: 'number', width: 'narrow' },
                { key: 'remaining', label: 'Remaining', type: 'number', width: 'narrow' },
                { key: 'destination', label: 'Primary Destination(s)', type: 'text', width: 'normal' }
              ]
            },
            { key: 'notes', label: 'Notes (no identifiers)', type: 'textarea', span: 3 }
          ]
        },
        preparedBy('Planning Section Chief')
      ]
    }
  },
  {
    code: 'HICS 256',
    title: 'Procurement Summary Report',
    category: 'resource',
    description: 'Summary of purchases made for the incident.',
    version: 1,
    schema: {
      sections: [
        header(),
        {
          title: 'Procurement Summary',
          fields: [
            {
              key: 'purchases',
              label: 'Purchases',
              type: 'table',
              span: 3,
              columns: [
                { key: 'date', label: 'Date', type: 'date', width: 'narrow' },
                { key: 'item', label: 'Item / Service', type: 'text', width: 'wide' },
                { key: 'vendor', label: 'Vendor', type: 'text', width: 'normal' },
                { key: 'po', label: 'PO #', type: 'text', width: 'narrow' },
                { key: 'qty', label: 'Qty', type: 'number', width: 'narrow' },
                { key: 'total', label: 'Total Cost', type: 'number', width: 'narrow' }
              ]
            },
            { key: 'grand_total', label: 'Grand Total ($)', type: 'number' }
          ]
        },
        preparedBy('Procurement Unit Leader')
      ]
    }
  },
  {
    code: 'HICS 257',
    title: 'Resource Accounting Record',
    category: 'resource',
    description: 'Tracking of equipment and resources used during the incident.',
    version: 1,
    schema: {
      sections: [
        header(),
        {
          title: 'Resource Accounting',
          fields: [
            {
              key: 'resources',
              label: 'Resources',
              type: 'table',
              span: 3,
              columns: [
                { key: 'item', label: 'Resource / Equipment', type: 'text', width: 'wide' },
                { key: 'quantity', label: 'Qty', type: 'number', width: 'narrow' },
                { key: 'assigned_to', label: 'Assigned To / Location', type: 'text', width: 'normal' },
                { key: 'time_out', label: 'Time Out', type: 'time', width: 'narrow' },
                { key: 'time_in', label: 'Time Returned', type: 'time', width: 'narrow' },
                { key: 'condition', label: 'Condition / Notes', type: 'text', width: 'normal' }
              ]
            }
          ]
        },
        preparedBy('Resources Unit Leader')
      ]
    }
  },
  {
    code: 'HICS 258',
    title: 'Hospital Resource Directory',
    category: 'resource',
    description: 'Key resources, vendors, and agencies with contact information.',
    version: 1,
    schema: {
      sections: [
        header(),
        {
          title: 'Resource Directory',
          fields: [
            {
              key: 'directory',
              label: 'Resources and Contacts',
              type: 'table',
              span: 3,
              columns: [
                { key: 'resource', label: 'Resource / Service', type: 'text', width: 'wide' },
                { key: 'agency', label: 'Vendor / Agency', type: 'text', width: 'normal' },
                { key: 'contact', label: 'Contact Name', type: 'text', width: 'normal' },
                { key: 'phone', label: 'Phone', type: 'text', width: 'normal' },
                { key: 'notes', label: 'Notes', type: 'text', width: 'normal' }
              ]
            }
          ]
        },
        preparedBy('Logistics Section Chief')
      ]
    }
  },
  {
    code: 'HICS 259',
    title: 'Hospital Casualty/Fatality Report (Aggregate)',
    category: 'situation',
    description: 'AGGREGATE MODE: casualty and fatality counts by category. No patient identifiers.',
    noPhi: true,
    version: 1,
    schema: {
      sections: [
        header(),
        {
          title: 'Casualty / Fatality Counts',
          description: 'Counts only. Never enter names, MRNs, dates of birth, or any patient identifier.',
          fields: [
            { key: 'treated_released', label: 'Treated & Released', type: 'number' },
            { key: 'admitted', label: 'Admitted', type: 'number' },
            { key: 'transferred', label: 'Transferred Out', type: 'number' },
            { key: 'expired', label: 'Expired', type: 'number' },
            { key: 'morgue', label: 'In Morgue / Awaiting Release', type: 'number' },
            { key: 'total', label: 'Total Casualties', type: 'number' },
            { key: 'notes', label: 'Notes (no identifiers)', type: 'textarea', span: 3 }
          ]
        },
        preparedBy('Medical Care Branch Director')
      ]
    }
  },
  {
    code: 'HICS 260',
    title: 'Patient Evacuation Tracking (Aggregate)',
    category: 'situation',
    description: 'AGGREGATE MODE: evacuation movement counts by category and destination. No patient identifiers.',
    noPhi: true,
    version: 1,
    schema: {
      sections: [
        header(),
        {
          title: 'Evacuation Movement Counts',
          description: 'Counts and status only. Never enter names, MRNs, dates of birth, or any patient identifier.',
          fields: [
            {
              key: 'movements',
              label: 'Movements',
              type: 'table',
              span: 3,
              columns: [
                { key: 'unit', label: 'From Unit / Area', type: 'text', width: 'normal' },
                { key: 'category', label: 'Acuity Category', type: 'select', options: TRIAGE_CATEGORIES, width: 'normal' },
                { key: 'count', label: 'Count', type: 'number', width: 'narrow' },
                { key: 'destination', label: 'Destination', type: 'text', width: 'normal' },
                { key: 'transport', label: 'Transport Mode', type: 'select', options: ['Ambulance', 'Bus', 'Wheelchair van', 'Internal move', 'Other'], width: 'normal' },
                { key: 'status', label: 'Status', type: 'select', options: ['Awaiting transport', 'In transit', 'Arrived'], width: 'normal' }
              ]
            },
            { key: 'notes', label: 'Notes (no identifiers)', type: 'textarea', span: 3 }
          ]
        },
        preparedBy('Transportation Unit Leader')
      ]
    }
  },
  {
    code: 'HICS 261',
    title: 'Incident Response Guide (Reference)',
    category: 'command',
    description: 'Scenario response guide reference; interactive IRG checklists live in the IRG library.',
    version: 1,
    schema: {
      sections: [
        header(
          { key: 'scenario', label: 'Scenario', type: 'text', span: 2 }
        ),
        {
          title: 'Response Actions',
          fields: [
            { key: 'immediate_actions', label: 'Immediate Actions (0–2 hours)', type: 'textarea', span: 3 },
            { key: 'intermediate_actions', label: 'Intermediate Actions (2–12 hours)', type: 'textarea', span: 3 },
            { key: 'extended_actions', label: 'Extended Actions (12+ hours)', type: 'textarea', span: 3 },
            { key: 'demobilization', label: 'Demobilization / Recovery Considerations', type: 'textarea', span: 3 }
          ]
        },
        preparedBy('Planning Section Chief')
      ]
    }
  }
];

export function getTemplateByCode(code: string): FormTemplateDef | undefined {
  return HICS_FORM_TEMPLATES.find((t) => t.code === code);
}

/** IAP priority forms offered by the one-click IAP builder, in packet order. */
export const IAP_FORM_CODES = ['HICS 200', 'HICS 202', 'HICS 203', 'HICS 204', 'HICS 205A', 'HICS 206', 'HICS 215A'];
