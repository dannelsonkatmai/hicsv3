/*
  # Seed global catalogs

  1. Seeded Data (all rows have tenant_id = NULL → shared, read-only standard library)
    - `himt_positions` — the standard HICS 2014 Hospital Incident Management
      Team chart (command staff + four sections).
    - `jas_templates` — starter Job Action Sheet checklists for key positions.
    - `irg_templates` — starter Incident Response Guides for common scenarios
      (mass casualty, evacuation, active threat, decon, utility failure, fire).
    - `compliance_requirements` — element-level starter library for the CMS
      Emergency Preparedness Rule (42 CFR 482.15) and Joint Commission EM
      chapter. Versioned '2024.1-starter'; organizations map evidence against
      it and should verify against current published standards.

  2. Storage
    - Private `documents` bucket with tenant-scoped path policies
      (first path segment must equal the caller's tenant id).
*/

-- ---------------------------------------------------------------------------
-- HIMT position catalog (HICS 2014)
-- ---------------------------------------------------------------------------
INSERT INTO himt_positions (tenant_id, code, title, section, parent_code, sort_order) VALUES
  (NULL, 'IC',        'Incident Commander',                          'command',    NULL,   1),
  (NULL, 'PIO',       'Public Information Officer',                  'command',    'IC',   2),
  (NULL, 'SO',        'Safety Officer',                              'command',    'IC',   3),
  (NULL, 'LNO',       'Liaison Officer',                             'command',    'IC',   4),
  (NULL, 'MTS',       'Medical/Technical Specialist',                'command',    'IC',   5),
  (NULL, 'OSC',       'Operations Section Chief',                    'operations', 'IC',   10),
  (NULL, 'OPS-STG',   'Staging Manager',                             'operations', 'OSC',  11),
  (NULL, 'OPS-MED',   'Medical Care Branch Director',                'operations', 'OSC',  12),
  (NULL, 'OPS-INF',   'Infrastructure Branch Director',              'operations', 'OSC',  13),
  (NULL, 'OPS-SEC',   'Security Branch Director',                    'operations', 'OSC',  14),
  (NULL, 'OPS-HAZ',   'HazMat Branch Director',                      'operations', 'OSC',  15),
  (NULL, 'OPS-BUS',   'Business Continuity Branch Director',         'operations', 'OSC',  16),
  (NULL, 'OPS-PFA',   'Patient Family Assistance Branch Director',   'operations', 'OSC',  17),
  (NULL, 'PSC',       'Planning Section Chief',                      'planning',   'IC',   20),
  (NULL, 'PLN-RES',   'Resources Unit Leader',                       'planning',   'PSC',  21),
  (NULL, 'PLN-SIT',   'Situation Unit Leader',                       'planning',   'PSC',  22),
  (NULL, 'PLN-DOC',   'Documentation Unit Leader',                   'planning',   'PSC',  23),
  (NULL, 'PLN-DEM',   'Demobilization Unit Leader',                  'planning',   'PSC',  24),
  (NULL, 'LSC',       'Logistics Section Chief',                     'logistics',  'IC',   30),
  (NULL, 'LOG-SVC',   'Service Branch Director',                     'logistics',  'LSC',  31),
  (NULL, 'LOG-COM',   'Communications Unit Leader',                  'logistics',  'LOG-SVC', 32),
  (NULL, 'LOG-IT',    'IT/IS Unit Leader',                           'logistics',  'LOG-SVC', 33),
  (NULL, 'LOG-FOOD',  'Food Services Unit Leader',                   'logistics',  'LOG-SVC', 34),
  (NULL, 'LOG-SUP',   'Support Branch Director',                     'logistics',  'LSC',  35),
  (NULL, 'LOG-EMP',   'Employee Health & Well-Being Unit Leader',    'logistics',  'LOG-SUP', 36),
  (NULL, 'LOG-FAC',   'Facilities Unit Leader',                      'logistics',  'LOG-SUP', 37),
  (NULL, 'LOG-TRN',   'Transportation Unit Leader',                  'logistics',  'LOG-SUP', 38),
  (NULL, 'LOG-SPL',   'Supply Unit Leader',                          'logistics',  'LOG-SUP', 39),
  (NULL, 'LOG-LAB',   'Labor Pool & Credentialing Unit Leader',      'logistics',  'LOG-SUP', 40),
  (NULL, 'FSC',       'Finance/Administration Section Chief',        'finance',    'IC',   50),
  (NULL, 'FIN-TIME',  'Time Unit Leader',                            'finance',    'FSC',  51),
  (NULL, 'FIN-PROC',  'Procurement Unit Leader',                     'finance',    'FSC',  52),
  (NULL, 'FIN-COMP',  'Compensation/Claims Unit Leader',             'finance',    'FSC',  53),
  (NULL, 'FIN-COST',  'Cost Unit Leader',                            'finance',    'FSC',  54)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Job Action Sheet starter templates
-- ---------------------------------------------------------------------------
INSERT INTO jas_templates (tenant_id, position_code, title, items) VALUES
(NULL, 'IC', 'Incident Commander — Job Action Sheet', '[
  {"phase": "immediate", "text": "Assume role of Incident Commander and activate the Hospital Incident Management Team as needed"},
  {"phase": "immediate", "text": "Read this entire Job Action Sheet and put on position identification"},
  {"phase": "immediate", "text": "Notify hospital leadership and establish the Hospital Command Center location"},
  {"phase": "immediate", "text": "Determine activation level and appoint Command Staff and Section Chiefs as needed"},
  {"phase": "immediate", "text": "Receive initial situation briefing and document key facts"},
  {"phase": "immediate", "text": "Establish initial incident objectives and operational period"},
  {"phase": "intermediate", "text": "Approve the Incident Action Plan for the operational period"},
  {"phase": "intermediate", "text": "Hold regular briefings with Command Staff and Section Chiefs"},
  {"phase": "intermediate", "text": "Authorize resource requests above delegated thresholds"},
  {"phase": "extended", "text": "Evaluate need to continue, escalate, or begin demobilization"},
  {"phase": "extended", "text": "Approve demobilization plan and incident termination"},
  {"phase": "extended", "text": "Ensure After-Action Report and Improvement Plan are initiated"}
]'::jsonb),
(NULL, 'PIO', 'Public Information Officer — Job Action Sheet', '[
  {"phase": "immediate", "text": "Report to Incident Commander and receive briefing"},
  {"phase": "immediate", "text": "Establish media staging area away from patient care areas"},
  {"phase": "immediate", "text": "Draft initial holding statement and obtain IC approval"},
  {"phase": "intermediate", "text": "Coordinate messaging with jurisdictional Joint Information Center"},
  {"phase": "intermediate", "text": "Monitor media and social channels; correct misinformation"},
  {"phase": "extended", "text": "Prepare updated statements each operational period"},
  {"phase": "extended", "text": "Document all releases in the activity log (HICS 214)"}
]'::jsonb),
(NULL, 'SO', 'Safety Officer — Job Action Sheet', '[
  {"phase": "immediate", "text": "Report to Incident Commander and receive briefing"},
  {"phase": "immediate", "text": "Assess incident scene and facility for hazards to responders and patients"},
  {"phase": "immediate", "text": "Establish authority to halt unsafe operations"},
  {"phase": "intermediate", "text": "Complete the IAP Safety Analysis (HICS 215A) for each operational period"},
  {"phase": "intermediate", "text": "Verify PPE availability and correct use in affected areas"},
  {"phase": "extended", "text": "Monitor responder fatigue and enforce work/rest cycles"},
  {"phase": "extended", "text": "Document all safety actions and injuries"}
]'::jsonb),
(NULL, 'LNO', 'Liaison Officer — Job Action Sheet', '[
  {"phase": "immediate", "text": "Report to Incident Commander and receive briefing"},
  {"phase": "immediate", "text": "Establish contact with local emergency management and healthcare coalition"},
  {"phase": "intermediate", "text": "Maintain agency representative contact list (HICS 205A input)"},
  {"phase": "intermediate", "text": "Coordinate mutual-aid requests with external partners"},
  {"phase": "extended", "text": "Relay official situation updates to partner agencies each period"}
]'::jsonb),
(NULL, 'OSC', 'Operations Section Chief — Job Action Sheet', '[
  {"phase": "immediate", "text": "Report to Incident Commander; receive briefing and appoint Branch Directors"},
  {"phase": "immediate", "text": "Assess immediate patient-care impacts and surge requirements"},
  {"phase": "immediate", "text": "Establish patient care priorities for the operational period"},
  {"phase": "intermediate", "text": "Provide branch assignments (HICS 204) and monitor task completion"},
  {"phase": "intermediate", "text": "Submit resource requests for operational needs"},
  {"phase": "extended", "text": "Report status changes to Planning for the SitRep"},
  {"phase": "extended", "text": "Plan for staff rotation across operational periods"}
]'::jsonb),
(NULL, 'PSC', 'Planning Section Chief — Job Action Sheet', '[
  {"phase": "immediate", "text": "Report to Incident Commander and receive briefing"},
  {"phase": "immediate", "text": "Establish operational period cadence and documentation flow"},
  {"phase": "immediate", "text": "Begin situation status collection (beds, acuity, staffing, systems)"},
  {"phase": "intermediate", "text": "Assemble the Incident Action Plan and route for IC approval"},
  {"phase": "intermediate", "text": "Produce Situation Reports on schedule"},
  {"phase": "extended", "text": "Prepare demobilization plan with Demobilization Unit Leader"},
  {"phase": "extended", "text": "Collect all forms and logs for the incident record"}
]'::jsonb),
(NULL, 'LSC', 'Logistics Section Chief — Job Action Sheet', '[
  {"phase": "immediate", "text": "Report to Incident Commander; receive briefing and appoint unit leaders"},
  {"phase": "immediate", "text": "Assess supply, equipment, and facility support needs"},
  {"phase": "immediate", "text": "Activate the labor pool if staffing surge is required"},
  {"phase": "intermediate", "text": "Process resource requests; coordinate procurement with Finance"},
  {"phase": "intermediate", "text": "Track critical supply burn rates and days on hand"},
  {"phase": "extended", "text": "Coordinate resource demobilization and returns"}
]'::jsonb),
(NULL, 'FSC', 'Finance/Administration Section Chief — Job Action Sheet', '[
  {"phase": "immediate", "text": "Report to Incident Commander and receive briefing"},
  {"phase": "immediate", "text": "Activate cost tracking for the incident (HICS 257 / 252)"},
  {"phase": "immediate", "text": "Communicate procurement and approval thresholds"},
  {"phase": "intermediate", "text": "Track personnel time and labor costs each operational period"},
  {"phase": "intermediate", "text": "Review and approve resource requests above cost thresholds"},
  {"phase": "extended", "text": "Compile cost summary and flag FEMA-reimbursable expenses"},
  {"phase": "extended", "text": "Prepare final incident cost report for demobilization"}
]'::jsonb),
(NULL, 'LOG-LAB', 'Labor Pool & Credentialing Unit Leader — Job Action Sheet', '[
  {"phase": "immediate", "text": "Establish labor pool check-in location and process"},
  {"phase": "immediate", "text": "Begin volunteer registration and credential verification (HICS 253)"},
  {"phase": "intermediate", "text": "Match available staff skills to open staffing requests"},
  {"phase": "intermediate", "text": "Track assignments and hours for all pooled personnel"},
  {"phase": "extended", "text": "Release personnel through demobilization process"}
]'::jsonb),
(NULL, 'PLN-DEM', 'Demobilization Unit Leader — Job Action Sheet', '[
  {"phase": "immediate", "text": "Report to Planning Section Chief and receive briefing"},
  {"phase": "intermediate", "text": "Draft demobilization priorities with section chiefs"},
  {"phase": "extended", "text": "Track release of staff, equipment, and external resources"},
  {"phase": "extended", "text": "Confirm all forms, logs, and costs are captured before closure"}
]'::jsonb)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Incident Response Guide starter templates
-- ---------------------------------------------------------------------------
INSERT INTO irg_templates (tenant_id, code, title, scenario_type, phases) VALUES
(NULL, 'IRG-MCI', 'Mass Casualty Incident', 'mass_casualty', '[
  {"phase": "Immediate (0-2 hours)", "actions": ["Activate the Emergency Operations Plan and HICS structure", "Establish triage areas and patient flow (aggregate counts by category)", "Assess and expand ED / surge capacity", "Initiate labor pool and staff callback", "Notify regional coordination center of capacity"]},
  {"phase": "Intermediate (2-12 hours)", "actions": ["Roll operational periods and publish the IAP", "Track bed availability and acuity distribution on status boards", "Monitor critical supply burn rates", "Coordinate transfers with regional partners", "Brief staff and provide PIO updates"]},
  {"phase": "Extended (12+ hours)", "actions": ["Plan staffing rotation for continued operations", "Track costs and reimbursable expenses", "Begin demobilization planning as census stabilizes", "Schedule After-Action Review"]}
]'::jsonb),
(NULL, 'IRG-EVAC', 'Facility Evacuation', 'evacuation', '[
  {"phase": "Immediate (0-2 hours)", "actions": ["Determine evacuation scope (unit, floor, full facility)", "Activate evacuation annex and assign unit leaders", "Prioritize patients by acuity for movement (counts by category)", "Confirm receiving facility capacity and transport resources", "Establish patient tracking counts by destination"]},
  {"phase": "Intermediate (2-12 hours)", "actions": ["Execute phased evacuation by priority", "Track evacuation counts by unit and destination (HICS 255/260 aggregate mode)", "Coordinate with EMS and regional transport", "Secure evacuated areas and utilities"]},
  {"phase": "Extended (12+ hours)", "actions": ["Account for all patients by aggregate reconciliation", "Assess re-entry and repopulation criteria", "Document costs for reimbursement", "Complete After-Action Report"]}
]'::jsonb),
(NULL, 'IRG-ACTIVE', 'Active Threat / Security Emergency', 'active_threat', '[
  {"phase": "Immediate (0-2 hours)", "actions": ["Initiate Run-Hide-Fight notification and facility lockdown", "Notify law enforcement and establish unified command", "Account for staff and visitors in affected areas", "Prepare ED for potential casualties", "Control facility access points"]},
  {"phase": "Intermediate (2-12 hours)", "actions": ["Coordinate scene release with law enforcement", "Provide staff support and behavioral health resources", "Manage family notification center (aggregate coordination)", "Brief media through PIO"]},
  {"phase": "Extended (12+ hours)", "actions": ["Restore normal operations progressively", "Continue staff support programs", "Complete After-Action Report and security review"]}
]'::jsonb),
(NULL, 'IRG-DECON', 'Hazmat / Decontamination', 'decon', '[
  {"phase": "Immediate (0-2 hours)", "actions": ["Identify substance and obtain safety data", "Establish hot/warm/cold zones and set up decon corridor", "Don appropriate PPE per protocol", "Lock down ED entrances to prevent contamination", "Track decontaminated patient counts by category"]},
  {"phase": "Intermediate (2-12 hours)", "actions": ["Monitor responder exposure and rotate decon teams", "Coordinate with hazmat authorities and poison control", "Manage contaminated waste and runoff"]},
  {"phase": "Extended (12+ hours)", "actions": ["Terminate decon operations and doff PPE safely", "Complete exposure documentation for staff", "Restock decon supplies and complete AAR"]}
]'::jsonb),
(NULL, 'IRG-UTIL', 'Utility Failure', 'utility_failure', '[
  {"phase": "Immediate (0-2 hours)", "actions": ["Identify failed system(s) and update HICS 251 status board", "Verify emergency generator power and fuel status", "Implement downtime procedures for affected systems", "Assess patient-care impact by unit"]},
  {"phase": "Intermediate (2-12 hours)", "actions": ["Coordinate with utility providers on restoration timeline", "Deploy contingency resources (water, portable equipment)", "Evaluate need for partial evacuation if prolonged"]},
  {"phase": "Extended (12+ hours)", "actions": ["Rotate staff supporting manual workarounds", "Verify systems on restoration before resuming normal operations", "Document costs and complete AAR"]}
]'::jsonb),
(NULL, 'IRG-FIRE', 'Fire / Smoke Event', 'fire', '[
  {"phase": "Immediate (0-2 hours)", "actions": ["Initiate RACE (Rescue, Alarm, Contain, Extinguish/Evacuate)", "Notify fire department and activate fire response team", "Evacuate the affected smoke compartment horizontally", "Update facility system status for affected zones"]},
  {"phase": "Intermediate (2-12 hours)", "actions": ["Coordinate with fire officials on damage assessment", "Relocate displaced patients (aggregate counts by unit)", "Assess air handling and life-safety systems"]},
  {"phase": "Extended (12+ hours)", "actions": ["Plan restoration or continued relocation", "Document losses and costs", "Complete AAR and fire-safety corrective actions"]}
]'::jsonb),
(NULL, 'IRG-FATAL', 'Fatality Management Surge', 'fatality_management', '[
  {"phase": "Immediate (0-2 hours)", "actions": ["Assess morgue capacity and activate surge plan", "Coordinate with medical examiner / coroner", "Track decedent counts by status (aggregate only)"]},
  {"phase": "Intermediate (2-12 hours)", "actions": ["Arrange supplemental cold storage if needed", "Coordinate with funeral homes and county resources", "Support family assistance center (aggregate coordination)"]},
  {"phase": "Extended (12+ hours)", "actions": ["Maintain dignified care and documentation processes", "Demobilize surge capacity when counts normalize", "Complete AAR"]}
]'::jsonb)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Compliance starter library (element level)
-- NOTE: starter content, versioned '2024.1-starter'. Verify against currently
-- published CMS / Joint Commission language before survey use.
-- ---------------------------------------------------------------------------
INSERT INTO compliance_requirements (tenant_id, framework, reference_code, element_code, title, description, category, library_version, sort_order) VALUES
-- CMS Emergency Preparedness Rule — 42 CFR 482.15
(NULL, 'cms', '482.15(a)', 'EP-a-1', 'All-hazards risk assessment', 'Emergency plan is based on and includes a documented, facility-based and community-based risk assessment utilizing an all-hazards approach.', 'Emergency Plan', '2024.1-starter', 1),
(NULL, 'cms', '482.15(a)', 'EP-a-2', 'Strategies for identified hazards', 'Plan includes strategies for addressing emergency events identified by the risk assessment.', 'Emergency Plan', '2024.1-starter', 2),
(NULL, 'cms', '482.15(a)', 'EP-a-3', 'Patient population and continuity', 'Plan addresses the patient population, including at-risk patients, services the hospital can provide, continuity of operations, and delegations of authority/succession plans.', 'Emergency Plan', '2024.1-starter', 3),
(NULL, 'cms', '482.15(a)', 'EP-a-4', 'Cooperation with officials', 'Plan includes a process for cooperation and collaboration with local, tribal, regional, state, and federal emergency preparedness officials.', 'Emergency Plan', '2024.1-starter', 4),
(NULL, 'cms', '482.15(a)', 'EP-a-5', 'Biennial plan review', 'Emergency plan is reviewed and updated at least every 2 years.', 'Emergency Plan', '2024.1-starter', 5),
(NULL, 'cms', '482.15(b)', 'EP-b-1', 'Subsistence needs', 'Policies and procedures address provision of subsistence needs for staff and patients: food, water, medical and pharmaceutical supplies, alternate energy sources, and sewage/waste disposal.', 'Policies & Procedures', '2024.1-starter', 6),
(NULL, 'cms', '482.15(b)', 'EP-b-2', 'Tracking system', 'System to track the location of on-duty staff and sheltered patients during and after an emergency.', 'Policies & Procedures', '2024.1-starter', 7),
(NULL, 'cms', '482.15(b)', 'EP-b-3', 'Safe evacuation', 'Policies for safe evacuation, including care needs of evacuees, staff responsibilities, transportation, identification of evacuation locations, and primary/alternate means of communication.', 'Policies & Procedures', '2024.1-starter', 8),
(NULL, 'cms', '482.15(b)', 'EP-b-4', 'Shelter in place', 'Means to shelter in place patients, staff, and volunteers who remain in the facility.', 'Policies & Procedures', '2024.1-starter', 9),
(NULL, 'cms', '482.15(b)', 'EP-b-5', 'Medical documentation', 'System of medical documentation that preserves patient information, protects confidentiality, and secures/maintains availability of records.', 'Policies & Procedures', '2024.1-starter', 10),
(NULL, 'cms', '482.15(b)', 'EP-b-6', 'Volunteers and emergency staffing', 'Use of volunteers and other emergency staffing strategies, including integration of state and federally designated health professionals.', 'Policies & Procedures', '2024.1-starter', 11),
(NULL, 'cms', '482.15(b)', 'EP-b-7', '1135 waiver arrangements', 'Role of the hospital under a waiver declared by the Secretary (1135 waiver) in provision of care at an alternate care site.', 'Policies & Procedures', '2024.1-starter', 12),
(NULL, 'cms', '482.15(c)', 'EP-c-1', 'Contact information', 'Communication plan includes names and contact information for staff, entities providing services under arrangement, patients'' physicians, other hospitals/CAHs, and volunteers.', 'Communication Plan', '2024.1-starter', 13),
(NULL, 'cms', '482.15(c)', 'EP-c-2', 'Emergency agency contacts', 'Contact information for federal, state, tribal, regional, and local emergency preparedness staff and other sources of assistance.', 'Communication Plan', '2024.1-starter', 14),
(NULL, 'cms', '482.15(c)', 'EP-c-3', 'Primary and alternate communication', 'Primary and alternate means for communicating with staff and with emergency management agencies.', 'Communication Plan', '2024.1-starter', 15),
(NULL, 'cms', '482.15(c)', 'EP-c-4', 'Information sharing method', 'Method for sharing information and medical documentation for patients under the hospital''s care with other providers to maintain continuity of care.', 'Communication Plan', '2024.1-starter', 16),
(NULL, 'cms', '482.15(c)', 'EP-c-5', 'Occupancy and needs reporting', 'Means of providing information about the hospital''s occupancy, needs, and ability to provide assistance to the authority having jurisdiction.', 'Communication Plan', '2024.1-starter', 17),
(NULL, 'cms', '482.15(d)', 'EP-d-1', 'Training program', 'Initial training in emergency preparedness policies for all staff, individuals providing services under arrangement, and volunteers; training at least every 2 years with documentation.', 'Training & Testing', '2024.1-starter', 18),
(NULL, 'cms', '482.15(d)', 'EP-d-2', 'Full-scale exercise', 'Participate annually in a full-scale community-based exercise, or a facility-based functional exercise when a community exercise is not accessible.', 'Training & Testing', '2024.1-starter', 19),
(NULL, 'cms', '482.15(d)', 'EP-d-3', 'Second annual exercise', 'Conduct an additional annual exercise of choice: community/facility-based full-scale or functional exercise, mock disaster drill, or tabletop/workshop with a facilitator.', 'Training & Testing', '2024.1-starter', 20),
(NULL, 'cms', '482.15(d)', 'EP-d-4', 'Real-event exemption', 'A hospital that activates its emergency plan for an actual emergency is exempt from the next required community-based full-scale exercise; documentation is maintained.', 'Training & Testing', '2024.1-starter', 21),
(NULL, 'cms', '482.15(d)', 'EP-d-5', 'Exercise evaluation', 'Analyze response to and maintain documentation of all drills, tabletops, and emergency events; revise the emergency plan as needed.', 'Training & Testing', '2024.1-starter', 22),
(NULL, 'cms', '482.15(e)', 'EP-e-1', 'Emergency and standby power', 'Emergency and standby power systems based on the emergency plan; generator location, inspection, testing, and fuel per NFPA requirements.', 'Emergency Power', '2024.1-starter', 23),
(NULL, 'cms', '482.15(f)', 'EP-f-1', 'Integrated health system plan', 'If part of an integrated healthcare system with a unified emergency preparedness program, the unified program meets all integration requirements.', 'Integrated Systems', '2024.1-starter', 24),
-- Joint Commission Emergency Management chapter (starter elements)
(NULL, 'tjc', 'EM.09.01.01', 'TJC-09-1', 'EM program structure', 'The hospital has an emergency management program with a designated leader and defined structure supported by hospital leadership.', 'Program Foundation', '2024.1-starter', 101),
(NULL, 'tjc', 'EM.10.01.01', 'TJC-10-1', 'Leadership oversight', 'Hospital leadership provides oversight, an annual budget review, and accountability for the emergency management program.', 'Program Foundation', '2024.1-starter', 102),
(NULL, 'tjc', 'EM.11.01.01', 'TJC-11-1', 'Hazard vulnerability analysis', 'The hospital conducts and annually reviews an HVA to identify and prioritize potential emergencies and their impact on care, services, and operations.', 'Assessment', '2024.1-starter', 103),
(NULL, 'tjc', 'EM.11.01.01', 'TJC-11-2', 'Community HVA coordination', 'The HVA is coordinated with community partners and informs the emergency operations plan and exercise objectives.', 'Assessment', '2024.1-starter', 104),
(NULL, 'tjc', 'EM.12.01.01', 'TJC-12-1', 'All-hazards EOP', 'The hospital maintains an all-hazards emergency operations plan describing response procedures, activation, and recovery.', 'Emergency Operations Plan', '2024.1-starter', 105),
(NULL, 'tjc', 'EM.12.01.01', 'TJC-12-2', 'EOP review cycle', 'The EOP is reviewed and approved by leadership at defined intervals and after exercises or real events that identify needed changes.', 'Emergency Operations Plan', '2024.1-starter', 106),
(NULL, 'tjc', 'EM.12.02.01', 'TJC-12-3', 'Communications plan', 'The hospital maintains an emergency communications plan addressing staff notification, external agencies, patients and families, and the media.', 'EOP Critical Areas', '2024.1-starter', 107),
(NULL, 'tjc', 'EM.12.02.03', 'TJC-12-4', 'Staffing plan', 'The EOP addresses staffing strategies during emergencies, including roles, responsibilities, and staff support needs.', 'EOP Critical Areas', '2024.1-starter', 108),
(NULL, 'tjc', 'EM.12.02.05', 'TJC-12-5', 'Safety and security plan', 'The EOP addresses safety and security during emergencies, including access control and hazardous material concerns.', 'EOP Critical Areas', '2024.1-starter', 109),
(NULL, 'tjc', 'EM.12.02.07', 'TJC-12-6', 'Resources and assets plan', 'The EOP addresses obtaining, managing, and monitoring resources and assets — supplies, equipment, and external resource sharing.', 'EOP Critical Areas', '2024.1-starter', 110),
(NULL, 'tjc', 'EM.12.02.09', 'TJC-12-7', 'Utilities plan', 'The EOP addresses provision and backup of essential utilities: power, water, fuel, medical gases, and ventilation.', 'EOP Critical Areas', '2024.1-starter', 111),
(NULL, 'tjc', 'EM.12.02.11', 'TJC-12-8', 'Patient care activities plan', 'The EOP addresses management of clinical activities during emergencies, including surge, vulnerable populations, and alternate care sites.', 'EOP Critical Areas', '2024.1-starter', 112),
(NULL, 'tjc', 'EM.13.01.01', 'TJC-13-1', 'Exercise program', 'The hospital tests its EOP through exercises based on identified hazards, evaluates performance against objectives, and documents results.', 'Exercises & Evaluation', '2024.1-starter', 113),
(NULL, 'tjc', 'EM.13.01.01', 'TJC-13-2', 'Exercise variety and scope', 'Exercises include escalating scenarios, community participation where applicable, and involvement of leadership and clinical staff.', 'Exercises & Evaluation', '2024.1-starter', 114),
(NULL, 'tjc', 'EM.14.01.01', 'TJC-14-1', 'After-action review', 'The hospital completes an after-action review of exercises and real events, identifies improvement actions, and tracks them to completion.', 'Exercises & Evaluation', '2024.1-starter', 115),
(NULL, 'tjc', 'EM.15.01.01', 'TJC-15-1', 'Continuity and recovery', 'The hospital has continuity of operations and recovery strategies addressing succession, essential functions, and restoration of services.', 'Continuity & Recovery', '2024.1-starter', 116),
(NULL, 'tjc', 'EM.16.01.01', 'TJC-16-1', 'Volunteer licensed practitioners', 'The hospital has a process for granting disaster privileges to volunteer licensed practitioners, including verification and oversight.', 'Disaster Credentialing', '2024.1-starter', 117),
(NULL, 'tjc', 'EM.17.01.01', 'TJC-17-1', 'Other volunteer practitioners', 'The hospital has a process for managing other volunteer practitioners and staff during disasters, including identity verification and assignment.', 'Disaster Credentialing', '2024.1-starter', 118)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Storage: private, tenant-scoped documents bucket
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "documents_select_tenant" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = public.current_tenant_id()::text);
CREATE POLICY "documents_insert_tenant" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = public.current_tenant_id()::text);
CREATE POLICY "documents_update_tenant" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = public.current_tenant_id()::text);
CREATE POLICY "documents_delete_tenant" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = public.current_tenant_id()::text);
