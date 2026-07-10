// EOP Plan Builder content catalog. Each section carries starter plan language
// mapped element-by-element to the seeded compliance library (CMS EP Rule
// 42 CFR 482.15 and Joint Commission EM chapter, version 2024.1-starter), so
// the review step can show exactly which requirements the drafted plan
// addresses. Sample text is starter content: facilities must tailor bracketed
// items and verify against currently published regulatory language.

export const EOP_BUILDER_VERSION = '2024.1-starter';

export const EOP_BUILDER_DISCLAIMER =
  'Starter language aligned to the CMS Emergency Preparedness Rule (42 CFR 482.15) and the Joint Commission EM chapter. ' +
  'Replace every [bracketed] item with facility-specific detail and verify against currently published regulatory text before survey use.';

export interface EopVariableDef {
  key: string;
  label: string;
  /** Shown as [placeholder] wherever the variable is unset in merged text. */
  placeholder: string;
  help?: string;
  defaultValue?: string;
  /** Auto-populated from the primary facility record when available. */
  prefill?: 'facility_name' | 'facility_type' | 'city_state' | 'licensed_beds';
}

export const EOP_VARIABLES: EopVariableDef[] = [
  { key: 'facility_name', label: 'Facility Name', placeholder: 'Facility Name', prefill: 'facility_name' },
  { key: 'facility_type', label: 'Facility Type', placeholder: 'facility type', defaultValue: 'acute care hospital', prefill: 'facility_type', help: 'e.g., acute care hospital, critical access hospital' },
  { key: 'city_state', label: 'City / State', placeholder: 'City, State', prefill: 'city_state' },
  { key: 'licensed_beds', label: 'Licensed Beds', placeholder: 'number', prefill: 'licensed_beds' },
  { key: 'ceo_title', label: 'Chief Executive Title', placeholder: 'Chief Executive Officer', defaultValue: 'Chief Executive Officer' },
  { key: 'governing_body', label: 'Governing Body', placeholder: 'Governing Board', defaultValue: 'Governing Board' },
  { key: 'em_leader_title', label: 'EM Program Leader Title', placeholder: 'Emergency Management Coordinator', defaultValue: 'Emergency Management Coordinator', help: 'The designated individual accountable for the EM program' },
  { key: 'em_committee', label: 'EM Committee Name', placeholder: 'Emergency Management Committee', defaultValue: 'Emergency Management Committee' },
  { key: 'command_center', label: 'Command Center Location', placeholder: 'primary Hospital Command Center location', help: 'Room / building of the primary HCC' },
  { key: 'alt_command_center', label: 'Alternate Command Center', placeholder: 'alternate Hospital Command Center location' },
  { key: 'notification_system', label: 'Mass Notification System', placeholder: 'mass-notification system', help: 'e.g., Everbridge, phone tree, paging system' },
  { key: 'local_ema', label: 'Local Emergency Mgmt Agency', placeholder: 'local Office of Emergency Management' },
  { key: 'coalition', label: 'Healthcare Coalition', placeholder: 'regional healthcare coalition' },
  { key: 'generator_hours', label: 'Generator Fuel (hours on site)', placeholder: '96', defaultValue: '96', help: 'Hours of generator fuel maintained on site' }
];

/** Replace {{tokens}} with variable values; unset variables render as [placeholder]. */
export function mergeSampleText(sample: string, variables: Record<string, string>): string {
  return sample.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = (variables[key] ?? '').trim();
    if (value) return value;
    const def = EOP_VARIABLES.find((v) => v.key === key);
    return `[${def?.placeholder ?? key}]`;
  });
}

export interface EopSectionDef {
  key: string;
  title: string;
  /** Why this section exists — shown as planner guidance. */
  purpose: string;
  /** element_code values from the seeded CMS compliance library. */
  cmsRefs: string[];
  /** element_code values from the seeded Joint Commission library. */
  tjcRefs: string[];
  /** Customization checklist shown alongside the editor. */
  considerations: string[];
  sampleText: string;
}

export const EOP_SECTIONS: EopSectionDef[] = [
  {
    key: 'intro',
    title: 'Purpose, Scope & Plan Administration',
    purpose:
      'Establishes the all-hazards foundation of the plan, who owns the emergency management program, how leadership provides oversight, and the review cycle that keeps the plan current.',
    cmsRefs: ['EP-a-5', 'EP-f-1'],
    tjcRefs: ['TJC-09-1', 'TJC-10-1', 'TJC-12-2'],
    considerations: [
      'Name the actual titles that hold program authority — surveyors will interview them.',
      'Keep a revision-history table on the plan cover page; each review must be documented even when nothing changes.',
      'CMS requires review at least every 2 years; many states and facilities keep an annual cycle — state the cycle you will actually follow.',
      'Delete the integrated-system paragraph unless the facility genuinely participates in a unified program.'
    ],
    sampleText: `1. PURPOSE
This Emergency Operations Plan (EOP) establishes the framework by which {{facility_name}} mitigates, prepares for, responds to, and recovers from emergencies and disasters that could affect the health and safety of patients, staff, and visitors or disrupt care, treatment, and services. The plan uses an all-hazards approach designed around the natural, technological, human-caused, hazardous-material, and public-health emergencies identified in the facility Hazard Vulnerability Analysis (HVA).

2. SCOPE
This plan applies to all departments, employees, medical staff, contracted service providers, students, and volunteers of {{facility_name}}, a {{facility_type}} located in {{city_state}} with {{licensed_beds}} licensed beds. It governs all phases of emergency management — mitigation, preparedness, response, and recovery — and is supplemented by hazard-specific annexes and incident response guides.

3. PROGRAM ADMINISTRATION AND AUTHORITY
a. The {{ceo_title}} holds ultimate authority and responsibility for the emergency management program and commits the resources necessary to sustain it.
b. The {{em_leader_title}} is the designated emergency management program leader, accountable for developing, implementing, evaluating, and maintaining this plan and its supporting policies and procedures.
c. The {{em_committee}} — a multidisciplinary body with representation from clinical services, nursing, medical staff, facilities/engineering, safety and security, infection prevention, supply chain, information technology, and administration — provides program oversight, reviews exercise and event performance, and recommends improvements.
d. The {{em_committee}} reports at least annually to senior leadership and the {{governing_body}}, including a review of program objectives, HVA priorities, exercise and event findings, corrective actions, and the resources and budget needed for the coming cycle.

4. PLAN REVIEW AND MAINTENANCE
This plan, together with its risk assessment, policies and procedures, communication plan, and training and testing program, is reviewed and updated at least every two (2) years, and sooner when warranted by: (a) activation for an actual emergency; (b) exercise or drill findings; (c) significant changes to the facility, its services, or its patient population; or (d) changes in applicable law, regulation, or accreditation standards. Each review is documented in the revision history maintained on the plan cover page. [Insert or attach the facility revision-history table.]

5. UNIFIED / INTEGRATED HEALTHCARE SYSTEM PROGRAM  [Delete this section if not applicable]
{{facility_name}} participates in the unified and integrated emergency preparedness program of [System Name]. This facility actively participates in developing the unified program; the program documents how it accounts for this facility's unique circumstances, patient population, and services; and it includes a unified risk assessment, coordinated policies and procedures, a coordinated communication plan, and a unified training and testing program that satisfy the requirements applicable to each participating facility. Documentation of this facility's participation is maintained by the {{em_leader_title}}.`
  },
  {
    key: 'hva',
    title: 'Hazard Vulnerability Analysis & Risk Assessment',
    purpose:
      'Documents the facility-based and community-based all-hazards risk assessment that drives every other part of the plan, and ties response strategies to the highest-priority hazards.',
    cmsRefs: ['EP-a-1', 'EP-a-2'],
    tjcRefs: ['TJC-11-1', 'TJC-11-2'],
    considerations: [
      'Use “Insert HVA hazard summary” to pull your current top-scored hazards from the HVA module.',
      'Document when and how the HVA was shared with community partners — a dated meeting or email satisfies the coordination element.',
      'Every priority hazard should trace to a strategy, annex, or incident response guide; surveyors ask to see the link.',
      'Reassess after every real event and at least annually.'
    ],
    sampleText: `1. RISK ASSESSMENT METHODOLOGY
{{facility_name}} conducts and documents a facility-based and community-based risk assessment using an all-hazards approach. The Hazard Vulnerability Analysis (HVA) scores each potential hazard for probability, human impact, property impact, business impact, and the current state of preparedness and internal and external response capability. The HVA is prepared by the {{em_committee}} with input from department leaders and community partners, approved by facility leadership, and reviewed at least annually and after every actual emergency or exercise that reveals new information.

2. COMMUNITY COORDINATION
The HVA is developed and shared in coordination with {{local_ema}}, {{coalition}}, public health, and other community response partners so that facility priorities are informed by, and align with, community-wide risk priorities and response plans. [Record the date and method of the most recent coordination — e.g., coalition HVA workshop, shared document review.]

3. PRIORITY HAZARDS AND RESPONSE STRATEGIES
The current HVA identifies the following priority hazards for {{facility_name}}. For each, this plan and the referenced hazard-specific annexes and incident response guides establish mitigation, preparedness, response, and recovery strategies:

[Insert the prioritized hazard list from the current HVA — use the “Insert HVA hazard summary” button to pull your top-scored hazards, then note the annex or incident response guide that addresses each.]

4. PATIENT POPULATION AND AT-RISK CONSIDERATIONS
The risk assessment addresses the facility's patient population, including at-risk and vulnerable patients — patients dependent on life support, dialysis, or supplemental oxygen; pediatric, geriatric, bariatric, and behavioral-health patients; and persons with disabilities or limited English proficiency — together with the services the facility must sustain, may curtail, or would need to relocate during each identified emergency.`
  },
  {
    key: 'command',
    title: 'Activation, Incident Command & Succession',
    purpose:
      'Defines who may activate the plan, how the facility organizes under the Hospital Incident Command System, and the documented delegations of authority and succession that keep decisions moving when leaders are unavailable.',
    cmsRefs: ['EP-a-3'],
    tjcRefs: ['TJC-12-1'],
    considerations: [
      'List real titles (not names) authorized to activate the plan, including nights and weekends.',
      'Succession should go at least three deep for Incident Commander and for administrative authority.',
      'Keep signed delegation-of-authority documents with the plan — verbal understandings do not survey well.',
      'State where Job Action Sheets are kept and how positions are briefed at shift change.'
    ],
    sampleText: `1. PLAN ACTIVATION
This plan may be activated in whole or in part by the [Administrator on Call, Chief Executive Officer, Chief Nursing Officer, or House Supervisor] whenever an actual or threatened event may exceed normal operating capability. Activation levels:
a. MONITORING / ALERT — event is possible or developing; leadership is notified and situational awareness is increased.
b. PARTIAL ACTIVATION — selected Hospital Incident Management Team (HIMT) positions are staffed and targeted response actions begin.
c. FULL ACTIVATION — the Hospital Command Center opens and the full HIMT structure needed for the incident is staffed.

2. INCIDENT COMMAND STRUCTURE
{{facility_name}} organizes its response using the Hospital Incident Command System (HICS), consistent with the National Incident Management System (NIMS). Only the positions required by the incident are activated. Each activated position operates from a position-specific Job Action Sheet and documents actions, decisions, and hand-offs. The Hospital Command Center (HCC) is located at {{command_center}}; the alternate HCC is {{alt_command_center}}. The HCC maintains the equipment, forms, communications, and vests needed to support command operations. [List HCC go-kit contents or reference the HCC setup checklist.]

3. DELEGATION OF AUTHORITY AND SUCCESSION
a. The order of succession for Incident Commander is: (1) [Title]; (2) [Title]; (3) [Title]; (4) [Title].
b. The order of succession for overall administrative authority is: (1) {{ceo_title}}; (2) [Title]; (3) [Title].
c. Written delegations of authority — including authority to activate this plan, commit emergency expenditures up to [dollar threshold], suspend or curtail normal services, and order shelter-in-place or evacuation — are approved by the {{governing_body}} and maintained [location, e.g., with this plan and in the administrative policy system].

4. DEMOBILIZATION AND TRANSITION TO RECOVERY
The Incident Commander authorizes stepwise demobilization when objectives are met, ensures borrowed resources are returned and documentation is collected, transitions remaining issues to the recovery organization described in the Continuity of Operations & Recovery section, and initiates the after-action review.`
  },
  {
    key: 'communications',
    title: 'Emergency Communications Plan',
    purpose:
      'Covers every CMS communication-plan element: current contact directories, primary and alternate communication methods, information sharing that preserves continuity of care, occupancy reporting to authorities, and communication with staff, families, and the media.',
    cmsRefs: ['EP-c-1', 'EP-c-2', 'EP-c-3', 'EP-c-4', 'EP-c-5'],
    tjcRefs: ['TJC-12-3'],
    considerations: [
      'State how often each contact directory is verified and where the offline copy lives.',
      'Alternate communication methods must actually work when power and telephony fail — name the specific radios, satellite phones, or coalition nets.',
      'Describe how patient information is released during an evacuation consistent with HIPAA emergency disclosure provisions.',
      'Name the title that serves as Public Information Officer and where media staging occurs.'
    ],
    sampleText: `1. LEGAL BASIS
This communication plan complies with applicable Federal and State law, including the HIPAA Privacy Rule provisions permitting disclosure of protected health information for treatment, for notification of family and others involved in a patient's care, and to authorities during emergencies (45 CFR 164.510 and 164.512).

2. CONTACT DIRECTORIES
{{facility_name}} maintains current names and contact information for:
a. All staff, including employed and contracted practitioners;
b. Entities providing services under arrangement (e.g., dialysis, laboratory, transcription, food service, transport);
c. Patients' attending physicians;
d. Other area hospitals and critical access hospitals, including designated receiving facilities;
e. Volunteers and volunteer organizations.
The facility also maintains contact information for Federal, State, tribal, regional, and local emergency preparedness staff and other sources of assistance, including {{local_ema}}, the State survey agency, State and local public health departments, {{coalition}}, and the State licensing authority. Directories are verified [quarterly] by [title/department], stored in [system], and duplicated in a printed/offline copy kept in the Hospital Command Center.

3. PRIMARY AND ALTERNATE MEANS OF COMMUNICATION
a. PRIMARY (staff): {{notification_system}}, overhead paging, facility telephones, e-mail, and unit huddles.
b. ALTERNATE (staff): [two-way radios, runners, cellular text trees, satellite phone].
c. PRIMARY (emergency management agencies): [telephone, e-mail, WebEOC/EMResource or state equivalent].
d. ALTERNATE (agencies): [800 MHz interoperable radio, amateur radio (ARES/RACES), satellite phone, coalition radio net].
Communication equipment is tested [monthly] and results are documented.

4. INFORMATION SHARING AND CONTINUITY OF CARE
The facility maintains a method for sharing information and medical documentation for patients under its care, as necessary, with other health care providers to maintain continuity of care — including [transfer packets, health information exchange, secure fax/portal, and printed downtime summaries accompanying each transferred patient]. In the event of evacuation, patient information — including the general condition and location of patients — is released to family members and others involved in the patient's care consistent with 45 CFR 164.510(b)(1)(ii).

5. OCCUPANCY AND NEEDS REPORTING
The facility provides timely information about its occupancy, needs, and ability to provide assistance to the authority having jurisdiction, the Incident Command Center, or the designated medical coordination point, using [EMResource/WebEOC/coalition reporting tool] as the primary method and [telephone/radio report to {{local_ema}}] as the alternate.

6. STAFF, PATIENTS, FAMILIES, AND MEDIA
Staff are notified and recalled through the cascade in [reference notification procedure]. Patients and families receive updates through [unit leadership, family information center]. The [title] serves as Public Information Officer (PIO), coordinates all external statements through the Joint Information System where activated, and manages media staging at [location].`
  },
  {
    key: 'resources',
    title: 'Resources, Assets & Subsistence Needs',
    purpose:
      'Shows how the facility will feed, hydrate, supply, and support patients and staff during an extended event, and how it obtains, manages, and shares resources when normal supply chains fail.',
    cmsRefs: ['EP-b-1'],
    tjcRefs: ['TJC-12-6'],
    considerations: [
      'State actual quantities and durations (meals, gallons, par levels) — “sufficient supplies” is not surveyable.',
      'CMS expects provision for both patients AND staff who remain in the facility.',
      'Alternate energy must address temperature control, emergency lighting, fire systems, and sewage/waste — mirror that enumeration.',
      'Reference actual vendor agreements and memoranda of understanding; keep copies with the plan.'
    ],
    sampleText: `1. RESOURCE AND ASSET MANAGEMENT
The Logistics Section monitors, obtains, allocates, and tracks the resources and assets needed for response — supplies, equipment, medications, food, water, and fuel. Inventories of critical supplies are maintained at defined par levels, monitored [daily during activation], and reported to the Hospital Command Center. Vendor and supplier agreements, including emergency delivery terms, are maintained in the facility resource directory. [Reference the Resources & Vendors catalog and MOU file location.]

2. SUBSISTENCE — FOOD AND WATER
The facility maintains provisions to meet the subsistence needs of patients and staff who remain in the facility, targeting a minimum of [96] hours of self-sufficiency:
a. FOOD: [X days] of regular and therapeutic diet provisions for the average patient census plus anticipated staff; emergency menus are maintained by [Food & Nutrition Services].
b. POTABLE WATER: [X gallons per person per day] for drinking, food preparation, hygiene, and essential clinical services, through [stored water, bulk water agreement with vendor, municipal tanker MOU].

3. MEDICAL, PHARMACEUTICAL, AND SUPPLY CACHES
Par-level stock and emergency caches cover [X days] of pharmaceuticals (including controlled substances under pharmacy security procedures), medical/surgical supplies, PPE, and oxygen. Restocking agreements exist with [distributor names]; the facility participates in [coalition/regional cache programs] where available.

4. ALTERNATE SOURCES OF ENERGY
Alternate energy sources are maintained (see the Utilities & Emergency Power section) to:
a. Maintain temperatures to protect patient health and safety and for the safe and sanitary storage of provisions;
b. Provide emergency lighting;
c. Sustain fire detection, extinguishing, and alarm systems; and
d. Sustain sewage and waste disposal, including [arrangements for portable sanitation, red-bag waste holding, and contracted waste hauling] if primary systems fail.

5. RESOURCE SHARING AND MUTUAL AID
When needs exceed on-hand and vendor capability, the Logistics Section requests resources through {{coalition}}, {{local_ema}}, and mutual aid agreements with [partner facilities]. Borrowed and shared assets are documented on resource-tracking logs, tracked through demobilization, and returned or reimbursed per the applicable agreement.`
  },
  {
    key: 'safety',
    title: 'Safety, Security & Access Control',
    purpose:
      'Protects patients, staff, and responders during an incident: incident safety oversight, facility lockdown and access control, crowd and traffic management, hazardous-materials protection, and coordination with law enforcement.',
    cmsRefs: [],
    tjcRefs: ['TJC-12-5'],
    considerations: [
      'Define lockdown levels and exactly which doors close at each level.',
      'Describe how responders are protected during hazardous-material events, including decontamination team activation.',
      'Address family reunification and crowd management for high-visibility events.',
      'Document the coordination arrangement with local law enforcement.'
    ],
    sampleText: `1. INCIDENT SAFETY
A Safety Officer is appointed for every plan activation with authority to halt any operation that poses an immediate danger to life or health. The Safety Officer monitors response operations, ensures appropriate personal protective equipment is available and used, and documents safety concerns and mitigation on [HICS 215A or facility equivalent].

2. SECURITY AND ACCESS CONTROL
Security operations during an emergency include:
a. GRADED LOCKDOWN — [Level 1: monitor entrances; Level 2: restrict to X controlled entry points with ID check; Level 3: full lockdown with entry by authorization only]. Doors, elevators, and stairwells affected at each level are listed in [security procedure reference].
b. IDENTIFICATION — staff, temporary personnel, and volunteers display facility-issued identification; disaster personnel receive distinctive badging per the Staff Management section.
c. TRAFFIC AND CROWD CONTROL — Security manages vehicle access routes, preserves emergency apparatus lanes, designates media and family staging areas away from care areas, and supports a family reunification area at [location].
d. LAW ENFORCEMENT COORDINATION — Security coordinates with [local police/sheriff] for perimeter control, force protection, and investigation support; the coordination arrangement is documented in [MOU/contact reference].

3. HAZARDOUS MATERIALS AND DECONTAMINATION
For events involving chemical, biological, radiological, or nuclear contamination, the facility activates its decontamination team, establishes hot/warm/cold zones at [decon location], controls contaminated patient entry to protect the facility, and uses [reference decontamination procedure] for technical response. Radiation detection and monitoring equipment is maintained at [location].

4. PROTECTING OCCUPANTS DURING SPECIFIC THREATS
Hazard-specific protective actions — active threat response, bomb threat procedures, infant/child security events, civil disturbance, and utility failure protective measures — are maintained as incident response guides referenced in the Hazard Vulnerability Analysis section.`
  },
  {
    key: 'staffing',
    title: 'Staff Management, Volunteers & Disaster Privileging',
    purpose:
      'Covers staff roles and tracking during an event, staff support needs, use of volunteers and emergency staffing strategies, and the medical-staff process for granting disaster privileges to volunteer licensed practitioners.',
    cmsRefs: ['EP-b-2', 'EP-b-6'],
    tjcRefs: ['TJC-12-4', 'TJC-16-1', 'TJC-17-1'],
    considerations: [
      'The staff-tracking element requires knowing where on-duty staff ARE during the event — labor pool check-in and assignment logs are the usual evidence.',
      'If staff are relocated, CMS expects the name and location of the receiving site to be documented.',
      'Disaster privileging must follow your medical staff bylaws — align the verification timeline here with what the bylaws actually say.',
      'Address staff support: lodging, meals, dependent care, and behavioral health — surveyors increasingly probe this.'
    ],
    sampleText: `1. STAFF ROLES AND NOTIFICATION
Upon activation, staff report or remain as directed by department emergency procedures. Department leaders account for on-duty staff, report status to the Hospital Command Center, and release staff to the Labor Pool when unit needs are met. Staff recall uses the cascade defined in the Emergency Communications Plan.

2. STAFF TRACKING
{{facility_name}} maintains a system to document and track the location of on-duty staff during and after an emergency, using [labor pool check-in/check-out logs, assignment boards, HICS 253 or the facility staffing module]. If staff are relocated to another site during the emergency, the name and location of the receiving facility or site is documented.

3. STAFF SUPPORT NEEDS
The plan provides for staff who remain through extended operations: [rest and sleeping areas, meals and hydration, medication access, communication with family, dependent and pet care options, and behavioral health/psychological first aid support through [EAP/spiritual care]].

4. VOLUNTEERS AND EMERGENCY STAFFING STRATEGIES
When staffing needs exceed internal capability, the facility may use: recall of off-duty staff; internal reassignment of clinically qualified personnel; contracted agency staff; personnel through mutual aid and {{coalition}}; and State or Federally designated health care professionals — e.g., Medical Reserve Corps (MRC), ESAR-VHP registered volunteers, and Federal response teams such as DMAT — integrated under the facility's incident command structure and supervised per this section.

5. DISASTER PRIVILEGES — VOLUNTEER LICENSED PRACTITIONERS
When this plan is activated and the facility cannot meet immediate patient needs, the [Chief Medical Officer / Medical Staff President / designee] may grant disaster privileges to volunteer licensed practitioners per the medical staff bylaws:
a. Identity is verified by [government-issued photo ID] plus [one of: current hospital ID from another facility, verification from a recognized authority or professional entity];
b. Licensure is verified with the primary source as soon as the disaster circumstances allow, and primary source verification of licensure occurs within 72 hours of the practitioner's arrival [or as the bylaws require] unless extraordinary circumstances prevent it (which are documented);
c. Volunteer practitioners are identified by [distinctive badge/vest], assigned under the supervision of [credentialed medical staff], and their performance is observed;
d. Disaster privileges terminate when the emergency ends or when the practitioner is no longer needed, at the discretion of the granting authority.

6. OTHER VOLUNTEER PRACTITIONERS AND STAFF
Volunteers who are not licensed independent practitioners are accepted only through [labor pool/volunteer coordination], undergo identity verification and qualification review before assignment, work under the supervision of facility staff, and are tracked on volunteer rosters through demobilization.`
  },
  {
    key: 'utilities',
    title: 'Utilities & Emergency Power',
    purpose:
      'Ensures essential utilities — power, water, fuel, medical gases, HVAC, and IT — continue or are restored during an emergency, with generator provisions meeting NFPA requirements.',
    cmsRefs: ['EP-e-1'],
    tjcRefs: ['TJC-12-7'],
    considerations: [
      'State generator locations, what they power, and the NFPA 110 testing regimen actually followed.',
      'Fuel duration on site plus the resupply agreement is a standard survey question — fill in real numbers.',
      'Cover water for consumption AND essential care activities, plus medical gas backup.',
      'Department-level utility failure response cards make this section operational.'
    ],
    sampleText: `1. ESSENTIAL UTILITY SYSTEMS
This section addresses continuity and restoration of: electrical power; potable and non-potable water; fuel required for building operations and generators; medical gases and vacuum systems; heating, ventilation, and air conditioning; steam; elevators; and information technology and communications infrastructure. Utility system inventories, shutoff locations, and single points of failure are documented in [utilities management plan / facilities documentation].

2. EMERGENCY AND STANDBY POWER
a. {{facility_name}} maintains emergency and standby power systems appropriate to its emergency plan, including [number/type] generator(s) located at [location(s)], installed in accordance with NFPA 99 (Health Care Facilities Code), NFPA 101 (Life Safety Code), and NFPA 110 (Standard for Emergency and Standby Power Systems).
b. Generators supply [life safety branch, critical branch, equipment branch — list major connected loads such as emergency lighting, fire alarm and suppression, medical gas systems, critical care areas, selected HVAC, and food/medication refrigeration].
c. Generators are inspected weekly and exercised under load monthly in accordance with NFPA 110 and manufacturer requirements; results are documented and deficiencies corrected.
d. The facility maintains fuel on site sufficient for approximately {{generator_hours}} hours of generator operation and has [contract/MOU with fuel vendor] for priority resupply. The facility maintains sufficient fuel to sustain emergency power during an emergency, or plans for relocation or evacuation consistent with its emergency plan if power cannot be sustained.

3. ALTERNATE SOURCES AND CONTINGENCIES
a. WATER: [stored emergency water, bulk delivery agreement, well, municipal interconnect] to continue drinking water, sanitation, and essential clinical services.
b. MEDICAL GASES: reserve oxygen supply of [X hours/days], portable cylinders staged at [location], and emergency supplier [name].
c. IT/COMMUNICATIONS: uninterruptible power for critical systems, documented downtime procedures, and data backup/restoration per [IT disaster recovery plan].
d. UTILITY PROVIDERS: 24-hour emergency contacts for electric, water/sewer, gas, and telecommunications providers are maintained in the emergency contact directory.

4. UTILITY FAILURE RESPONSE
Department-level utility failure response guides (immediate actions, notification, clinical contingencies) are maintained for each essential utility system and exercised as part of the training and testing program.`
  },
  {
    key: 'patient_care',
    title: 'Patient Care, Clinical Support & Medical Surge',
    purpose:
      'Manages clinical activities during emergencies: triage and surge capacity, care for at-risk populations, patient tracking, downtime medical documentation that preserves and protects records, and clinical support services.',
    cmsRefs: ['EP-a-3', 'EP-b-2', 'EP-b-5'],
    tjcRefs: ['TJC-12-8'],
    considerations: [
      'Quantify surge: how many beds can be added, where, and what triggers each expansion tier.',
      'The tracking element covers sheltered patients during AND after the event — name the tool (e.g., HICS 254, patient tracking module).',
      'Medical documentation must preserve information, protect confidentiality, and keep records available — address all three.',
      'Include behavioral health, hygiene/sanitation, and mortuary surge — Joint Commission looks for all of these clinical support activities.'
    ],
    sampleText: `1. CLINICAL OPERATIONS DURING EMERGENCIES
The Medical Care Branch manages clinical activities during plan activation, including: triage of arriving patients using [START/SALT/facility triage protocol]; prioritization and possible curtailment of elective procedures and non-essential services by order of the Incident Commander with medical staff leadership; and coordination with the authority having jurisdiction regarding any state crisis standards of care declaration.

2. PATIENT POPULATION AND AT-RISK PATIENTS
Clinical response procedures address the needs of the facility's patient population identified in the risk assessment, including patients dependent on ventilators, dialysis, or supplemental oxygen; pediatric, geriatric, bariatric, and behavioral-health patients; and patients with disabilities, limited mobility, or limited English proficiency. Services the facility will sustain, curtail, or transfer during each hazard type are identified in the hazard-specific annexes.

3. MEDICAL SURGE
Surge capacity is expanded in tiers: [Tier 1 — internal bed optimization and accelerated discharge with case management; Tier 2 — opening surge beds in [PACU, observation, halls per unit surge plans] adding approximately [X] beds; Tier 3 — non-traditional care spaces at [location] and coordination with {{coalition}} for load balancing and transfer]. Surge staffing follows the Staff Management section; surge supplies and equipment follow the Resources & Assets section.

4. PATIENT TRACKING
{{facility_name}} maintains a system to document and track the location of patients sheltered in the facility during and after the emergency, using [patient tracking board/module, HICS 254, evacuation tracking forms]. When a patient is relocated or evacuated, the name and location of the receiving facility is documented and communicated per the Emergency Communications Plan.

5. MEDICAL DOCUMENTATION
During emergencies, the facility maintains a system of medical documentation that: (a) preserves patient information — [downtime paper record sets, periodic EHR downtime report printing, backup/restore procedures]; (b) protects the confidentiality of patient records consistent with HIPAA; and (c) secures records and maintains their availability, including records that accompany evacuated patients [transfer packet contents: face sheet, medication administration record, current orders, allergies, code status].

6. CLINICAL SUPPORT ACTIVITIES
The plan addresses: behavioral health needs of patients (and staff, per the Staff Management section); personal hygiene and sanitation when water or sewer service is limited; isolation and infection prevention during communicable disease events; and expanded mortuary capacity through [temporary morgue location, refrigerated capacity, ME/coroner coordination].`
  },
  {
    key: 'evacuation',
    title: 'Evacuation & Shelter-in-Place',
    purpose:
      'Establishes the decision framework and procedures for protecting occupants in place or moving them out safely — including transportation, receiving facilities, evacuee care needs, and communication with external assistance.',
    cmsRefs: ['EP-b-3', 'EP-b-4'],
    tjcRefs: [],
    considerations: [
      'Name the pre-identified receiving facilities and the transfer agreements behind them.',
      'Transportation must cover specialty needs: bariatric, neonatal/pediatric, ventilated, and behavioral-health patients.',
      'Shelter-in-place must address patients, staff, AND volunteers who remain.',
      'Define evacuation priority order (ambulatory/wheelchair/bed-bound; horizontal before vertical) and what accompanies each patient.'
    ],
    sampleText: `1. PROTECTIVE ACTION DECISION
The Incident Commander, with the [Administrator on Call and facilities/clinical leadership], decides between shelter-in-place and evacuation based on: the nature and duration of the hazard; structural and utility integrity; the ability to sustain safe care in place; transportation and receiving capacity; and direction from the authority having jurisdiction. The decision and its basis are documented in the command log.

2. SHELTER-IN-PLACE
When conditions outside or in part of the facility are more dangerous than remaining, {{facility_name}} shelters patients, staff, and volunteers who remain in the facility:
a. Interior safe areas and relocation zones by hazard type: [list — e.g., severe weather refuge areas by unit, HVAC isolation for external hazmat];
b. Sealing/isolation procedures, HVAC shutdown authority [title], and environmental monitoring;
c. Subsistence support per the Resources & Assets section for the expected duration;
d. Accountability for all occupants, including visitors, using [census reconciliation procedure].

3. EVACUATION
When evacuation is required, in whole or in part:
a. SEQUENCE — horizontal evacuation to adjacent smoke/hazard compartments first, then vertical, then full-building; patients are prioritized [by acuity and mobility per triage procedure] with [ambulatory first / critical care staffing ratios] as the situation dictates;
b. CARE AND TREATMENT NEEDS OF EVACUEES — each patient evacuates with [medications, active orders, transfer packet per the Medical Documentation section]; clinical staff assignments maintain continuity of care en route;
c. STAFF RESPONSIBILITIES — unit-level evacuation duties, movement equipment (evacuation sleds/chairs) locations, and sweep/marking procedures are defined in [unit evacuation procedures];
d. TRANSPORTATION — primary: [ambulance provider/contract]; alternates: [mutual aid EMS, coalition transport resources, contracted buses for ambulatory patients, specialty transport for neonatal/bariatric/ventilated patients];
e. EVACUATION LOCATIONS — pre-identified receiving facilities and alternate care locations: [list facilities and staging locations, with transfer agreements referenced]; and
f. COMMUNICATIONS — primary and alternate means of communicating with receiving facilities, EMS, and other external sources of assistance are defined in the Emergency Communications Plan; patient movement is tracked per the Patient Care section.

4. RE-ENTRY AND REPATRIATION
Re-occupancy occurs only after [facilities/safety inspection, utility verification, AHJ clearance]. Patient repatriation is coordinated with receiving facilities, families, and payers, and documented in the patient tracking system.`
  },
  {
    key: 'continuity',
    title: 'Continuity of Operations & Recovery',
    purpose:
      'Keeps essential functions running when the facility itself is degraded, and organizes the return to normal operations — succession, essential systems, business continuity, and recovery management.',
    cmsRefs: ['EP-a-3'],
    tjcRefs: ['TJC-15-1'],
    considerations: [
      'Identify the truly essential functions (clinical and business) and their maximum tolerable downtime.',
      'Point to the IT disaster-recovery arrangements for the EHR and payroll rather than restating them.',
      'Recovery cost documentation habits (photos, labor logs, procurement records) determine FEMA/insurance recovery — bake them in.',
      'Succession here should match the Command section — one list, cross-referenced.'
    ],
    sampleText: `1. ESSENTIAL FUNCTIONS
{{facility_name}} has identified the essential functions that must continue during any emergency: [emergency and inpatient care for current census, pharmacy, laboratory and blood availability, dietary, security, payroll and timekeeping, supply procurement, medical records access, and communications]. For each essential function, the plan identifies the responsible department, minimum staffing, dependencies, and maximum tolerable downtime. [Attach or reference the essential functions matrix.]

2. SUCCESSION AND DELEGATIONS
Continuity of leadership follows the orders of succession and written delegations of authority in the Activation, Incident Command & Succession section. Department-level succession (at least two deep) is maintained in department emergency procedures.

3. CONTINUITY STRATEGIES
a. INFORMATION SYSTEMS — EHR and critical application downtime procedures, data backup, and restoration priorities per [IT disaster recovery plan]; vital records (licenses, contracts, insurance policies, personnel and medical staff files) are protected and recoverable per [records management procedure];
b. ALTERNATE WORK SITES — business functions that can relocate ([billing, scheduling, administration]) shift to [alternate site/remote work] when facility space is lost;
c. FINANCE — emergency procurement authority, cost capture using [incident cost codes], and documentation standards that support insurance claims and FEMA Public Assistance reimbursement;
d. SUPPLY CHAIN — alternate suppliers and priority agreements per the Resources & Assets section.

4. RECOVERY OPERATIONS
Recovery begins while response is still under way. The [Recovery Officer / Planning Section Chief] leads: damage and impact assessment; restoration priorities for utilities, systems, and services; safe re-occupancy inspection and AHJ clearance; staged restoration of curtailed services with public and staff communication; staff support and behavioral health follow-up; financial recovery (insurance, FEMA, mutual aid reconciliation); and capture of lessons learned into the after-action process described in the Training, Exercise & Plan Maintenance section.`
  },
  {
    key: 'community',
    title: 'Community Coordination, Alternate Care Sites & 1135 Waivers',
    purpose:
      'Documents the required cooperation with emergency officials at every level, transfer agreements with other providers, and the facility’s role under an 1135 waiver, including care at alternate care sites.',
    cmsRefs: ['EP-a-4', 'EP-b-7'],
    tjcRefs: [],
    considerations: [
      'Keep evidence of collaboration: coalition meeting minutes, exercise sign-ins, shared planning documents.',
      'List actual transfer/mutual-aid agreement counterparties and where the signed agreements live.',
      'The 1135 element is about the facility’s ROLE under a waiver — who decides, who tracks the waiver terms, how alternate-site care is staffed and documented.'
    ],
    sampleText: `1. COOPERATION AND COLLABORATION WITH EMERGENCY OFFICIALS
{{facility_name}} maintains a documented process for cooperation and collaboration with local, tribal, regional, State, and Federal emergency preparedness officials, including: active participation in {{coalition}}; planning and exercise coordination with {{local_ema}} and [state hospital association/public health]; participation in community-wide risk assessment and planning efforts; and information sharing during response per the Emergency Communications Plan. Documentation of participation — meeting minutes, exercise rosters, shared plans — is maintained by the {{em_leader_title}}.

2. MUTUAL AID AND TRANSFER AGREEMENTS
The facility maintains agreements with other hospitals and providers for the receipt and transfer of patients when the facility cannot provide needed care, including [list partner facilities and agreement types]. Signed agreements are kept [location] and reviewed [annually].

3. 1135 WAIVERS
When the Secretary of Health and Human Services declares a public health emergency and waives or modifies Medicare, Medicaid, or CHIP requirements under Section 1135 of the Social Security Act:
a. The [CEO/CFO/Compliance Officer] determines whether to operate under available waiver flexibilities and documents that decision;
b. The facility's role in providing care and treatment at an alternate care site identified by emergency management officials is defined here: [describe the facility's expected role — e.g., staffing support, medical direction, supplies — and the coordination process with {{local_ema}} and {{coalition}}];
c. [Title] tracks the scope and duration of any waiver relied upon, ensures services and documentation conform to the waiver terms, and coordinates required notifications to CMS and the State survey agency;
d. Normal requirements resume when the waiver ends, with a documented transition.`
  },
  {
    key: 'training',
    title: 'Training, Exercise & Plan Maintenance',
    purpose:
      'Defines the training program for all staff and volunteers, the annual exercise cycle, real-event exercise credit, and how findings feed corrective actions and plan revision.',
    cmsRefs: ['EP-d-1', 'EP-d-2', 'EP-d-3', 'EP-d-4', 'EP-d-5'],
    tjcRefs: ['TJC-13-1', 'TJC-13-2', 'TJC-14-1'],
    considerations: [
      'Training documentation must show WHO was trained, on WHAT content, and WHEN — plus how staff demonstrated knowledge.',
      'Track both required annual exercises in the Exercises & Drills module and mark which count toward CMS.',
      'If claiming real-event credit, keep the activation documentation with the exercise records.',
      'Corrective actions need owners and due dates tracked to closure — link to the Corrective Actions module.'
    ],
    sampleText: `1. TRAINING PROGRAM
a. INITIAL TRAINING — All new and existing staff, individuals providing services under arrangement, and volunteers receive initial training in this plan and the emergency preparedness policies and procedures consistent with their expected roles.
b. ONGOING TRAINING — Emergency preparedness training is provided at least every two (2) years, and additionally whenever this plan is significantly updated, when roles change, or when exercise or event findings identify gaps.
c. DEMONSTRATION OF KNOWLEDGE — Staff demonstrate knowledge of emergency procedures through [post-training assessment, drill participation, competency validation].
d. DOCUMENTATION — Training content, dates, rosters, and demonstration-of-knowledge records are maintained in [learning management system / training records module].

2. EXERCISE AND TESTING PROGRAM
{{facility_name}} tests this plan through two exercises during each 12-month cycle:
a. EXERCISE 1 — A full-scale exercise that is community-based; when a community-based exercise is not accessible, an individual facility-based functional exercise is conducted and the attempt to participate in a community-based exercise is documented.
b. EXERCISE 2 — An additional exercise of choice: a second full-scale or functional exercise (community- or facility-based), a mock disaster drill, or a facilitated tabletop exercise or workshop that includes a group discussion led by a facilitator.
Exercise scenarios are drawn from the highest-priority hazards in the HVA, escalate in complexity over successive cycles, involve leadership and clinical staff, and include community partners such as {{local_ema}} and {{coalition}} where applicable.

3. REAL-EVENT CREDIT
If the facility activates this plan in response to an actual emergency, it is exempt from the next required community-based full-scale exercise (or its facility-based equivalent). Documentation of the activation, the response, and the after-action review is maintained with the exercise records.

4. EVALUATION, CORRECTIVE ACTION, AND PLAN REVISION
All exercises and actual emergency events are analyzed against documented objectives. An After-Action Report identifies strengths and areas for improvement; each improvement item becomes a corrective action with an assigned owner and due date, tracked to completion through the {{em_committee}}. This plan and its supporting policies and procedures are revised as needed based on those findings, and revisions are trained per this section.`
  }
];

/** Union of element codes addressed by the given completed section keys. */
export function coveredElementCodes(sectionKeys: string[]): { cms: Set<string>; tjc: Set<string> } {
  const cms = new Set<string>();
  const tjc = new Set<string>();
  for (const section of EOP_SECTIONS) {
    if (!sectionKeys.includes(section.key)) continue;
    section.cmsRefs.forEach((c) => cms.add(c));
    section.tjcRefs.forEach((c) => tjc.add(c));
  }
  return { cms, tjc };
}
