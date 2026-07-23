/*
  # Seed default Incident Objectives into Form Defaults

  1. Seeded Data
    - Inserts 10 standing HICS incident objectives into `form_defaults`
      (category = 'objectives') for every organization that does not already
      have objectives preloaded. These feed the HICS 202 Incident Objectives
      table via the "Load Defaults" workflow on the Objectives tab and the
      HICS 202 form.
    - Objectives cover: life safety, continuity of care, HICS organization,
      situational awareness, communications, resource management, facility/
      asset protection, patient movement, staff well-being, and
      demobilization / recovery.

  2. Idempotency
    - Only organizations with zero existing 'objectives' rows receive the
      seed, so re-running is safe and orgs that already customized their
      objectives are not duplicated.

  3. Security
    - No schema or policy changes. Rows are tenant-scoped via tenant_id.
*/

INSERT INTO form_defaults (tenant_id, category, data, sort_order, is_active)
SELECT o.id, 'objectives',
       jsonb_build_object('priority', v.prio, 'objective', v.text),
       v.prio, true
FROM organizations o
CROSS JOIN (VALUES
  (1,  'Ensure the life safety of all patients, visitors, staff, and responders through implementation of appropriate protective actions throughout the operational period.'),
  (2,  'Maintain the continuity of essential patient care services while prioritizing critical clinical operations and allocating available resources based on patient acuity.'),
  (3,  'Establish and maintain an effective Hospital Incident Command System organization with appropriate staffing, incident action planning, and operational coordination.'),
  (4,  'Maintain situational awareness through continuous assessment of incident conditions, operational impacts, resource status, and anticipated needs, providing regular updates to incident leadership.'),
  (5,  'Coordinate timely and accurate internal and external communications with staff, patients, families, partner agencies, and the public to support incident response and operational decision-making.'),
  (6,  'Identify, obtain, and manage personnel, equipment, supplies, pharmaceuticals, and other critical resources necessary to sustain hospital operations throughout the incident.'),
  (7,  'Protect hospital facilities, infrastructure, information systems, medical equipment, and other critical assets while minimizing environmental impacts resulting from the incident.'),
  (8,  'Coordinate patient movement activities, including patient tracking, transfers, admissions, discharges, and evacuation or shelter-in-place operations, as required by incident conditions.'),
  (9,  'Maintain the safety, health, and well-being of staff and responders through appropriate work practices, personal protective measures, behavioral health support, and management of staff needs.'),
  (10, 'Develop and implement a transition strategy for demobilization and recovery that supports restoration of normal operations while documenting incident actions and identifying improvement opportunities.')
) AS v(prio, text)
WHERE NOT EXISTS (
  SELECT 1 FROM form_defaults fd
  WHERE fd.tenant_id = o.id AND fd.category = 'objectives'
);