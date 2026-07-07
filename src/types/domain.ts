// Domain types mirroring the Supabase schema. Every tenant-scoped row carries
// tenant_id; the offline repo layer relies on `id` + `updated_at` for sync.

export interface BaseRow {
  id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export type PlatformRole =
  | 'super_admin'
  | 'org_admin'
  | 'facility_admin'
  | 'program_manager'
  | 'responder'
  | 'viewer'
  | 'auditor';

export type HicsSection = 'command' | 'operations' | 'planning' | 'logistics' | 'finance';

export interface Organization {
  id: string;
  name: string;
  slug: string | null;
  plan: 'trial' | 'standard' | 'professional' | 'enterprise';
  subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
  seats: number;
  stripe_customer_id: string | null;
  invite_code: string;
  branding: Record<string, unknown>;
  settings: Record<string, unknown>;
  data_retention_days: number;
  created_at: string;
  updated_at: string;
}

export interface Facility extends BaseRow {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  licensed_beds: number;
  facility_type: string;
  is_primary: boolean;
  settings: Record<string, unknown>;
}

export interface Unit extends BaseRow {
  facility_id: string;
  name: string;
  unit_type: 'ed' | 'icu' | 'med_surg' | 'peds' | 'ob' | 'periop' | 'behavioral' | 'stepdown' | 'other';
  licensed_beds: number;
  surge_beds: number;
  sort_order: number;
}

export interface Profile {
  id: string;
  tenant_id: string | null;
  email: string;
  full_name: string;
  phone: string;
  platform_role: PlatformRole;
  facility_ids: string[];
  department: string;
  job_title: string;
  is_active: boolean;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Personnel extends BaseRow {
  profile_id: string | null;
  full_name: string;
  personnel_type: 'staff' | 'external_contact' | 'agency' | 'volunteer' | 'vendor_contact' | 'mutual_aid';
  email: string;
  phone: string;
  pager: string;
  department: string;
  job_title: string;
  credentials: Array<Record<string, unknown>>;
  skills: string[];
  callback_notes: string;
  is_active: boolean;
}

export type IncidentType = 'real' | 'exercise' | 'drill' | 'planned_event';
export type IncidentStatus = 'pending' | 'active' | 'demobilizing' | 'closed';

export interface Incident extends BaseRow {
  facility_id: string | null;
  name: string;
  incident_number: string;
  incident_type: IncidentType;
  scenario: string;
  status: IncidentStatus;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  activation_level: 'monitoring' | 'partial' | 'full';
  is_training: boolean;
  started_at: string;
  ended_at: string | null;
  description: string;
  command_location: string;
  created_by: string | null;
}

export interface OperationalPeriod extends BaseRow {
  incident_id: string;
  period_number: number;
  starts_at: string;
  ends_at: string;
  is_current: boolean;
  notes: string;
}

export interface HimtPosition {
  id: string;
  tenant_id: string | null;
  code: string;
  title: string;
  section: HicsSection;
  parent_code: string | null;
  sort_order: number;
}

export interface HimtAssignment extends BaseRow {
  incident_id: string;
  position_code: string;
  position_title: string;
  section: HicsSection;
  personnel_id: string | null;
  assignee_name: string;
  contact_info: string;
  assigned_at: string;
  released_at: string | null;
}

export interface Objective extends BaseRow {
  incident_id: string;
  operational_period_id: string | null;
  description: string;
  priority: number;
  status: 'open' | 'in_progress' | 'completed' | 'carried_over';
  owner_section: string;
}

export interface IncidentTask extends BaseRow {
  incident_id: string;
  objective_id: string | null;
  title: string;
  detail: string;
  assigned_section: string;
  assigned_position: string;
  status: 'open' | 'in_progress' | 'blocked' | 'done';
  due_at: string | null;
}

export interface JasTemplate {
  id: string;
  tenant_id: string | null;
  position_code: string;
  title: string;
  items: Array<{ phase: string; text: string }>;
  version: number;
}

export interface JasProgress extends BaseRow {
  incident_id: string;
  assignment_id: string | null;
  position_code: string;
  checked_items: Record<string, boolean>;
}

export interface IrgTemplate {
  id: string;
  tenant_id: string | null;
  code: string;
  title: string;
  scenario_type: string;
  phases: Array<{ phase: string; actions: string[] }>;
  version: number;
}

export type FormStatus = 'draft' | 'in_review' | 'approved' | 'final';

export interface FormInstance extends BaseRow {
  incident_id: string;
  operational_period_id: string | null;
  template_code: string;
  template_title: string;
  status: FormStatus;
  data: Record<string, unknown>;
  version: number;
  prepared_by: string | null;
  prepared_by_name: string;
  approved_by: string | null;
  approved_at: string | null;
}

export type IapStatus = 'draft' | 'in_review' | 'approved' | 'published' | 'archived';

export interface Iap extends BaseRow {
  incident_id: string;
  operational_period_id: string | null;
  title: string;
  status: IapStatus;
  approved_by: string | null;
  approved_by_name: string;
  approved_at: string | null;
  published_at: string | null;
  notes: string;
}

export interface IapForm extends BaseRow {
  iap_id: string;
  form_instance_id: string;
  sort_order: number;
}

export interface Vendor extends BaseRow {
  name: string;
  contact_name: string;
  phone: string;
  email: string;
  account_number: string;
  categories: string[];
  notes: string;
  is_active: boolean;
}

export interface ResourceItem extends BaseRow {
  name: string;
  category: string;
  unit_of_measure: string;
  unit_cost: number;
  vendor_id: string | null;
  notes: string;
  is_active: boolean;
}

export interface InventoryItem extends BaseRow {
  facility_id: string | null;
  name: string;
  category: string;
  location: string;
  par_level: number;
  on_hand: number;
  unit_of_measure: string;
  is_critical: boolean;
}

export type RequestStatus =
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'denied'
  | 'ordered'
  | 'delivered'
  | 'demobilized'
  | 'cancelled';

export interface ResourceRequest extends BaseRow {
  incident_id: string;
  operational_period_id: string | null;
  request_number: number | null;
  item_description: string;
  resource_id: string | null;
  category: string;
  quantity: number;
  unit_of_measure: string;
  priority: 'routine' | 'urgent' | 'immediate';
  needed_by: string | null;
  deliver_to: string;
  justification: string;
  requesting_section: string;
  requested_by_name: string;
  status: RequestStatus;
  estimated_cost: number;
  review_notes: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_by: string | null;
}

export interface ProcurementOrder extends BaseRow {
  incident_id: string;
  resource_request_id: string | null;
  vendor_id: string | null;
  vendor_name: string;
  po_number: string;
  description: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  status: 'draft' | 'placed' | 'shipped' | 'delivered' | 'cancelled';
  ordered_at: string | null;
  delivered_at: string | null;
  notes: string;
}

export interface CostRecord extends BaseRow {
  incident_id: string;
  operational_period_id: string | null;
  cost_type: 'labor' | 'equipment' | 'supplies' | 'medications' | 'contract' | 'facility' | 'other';
  description: string;
  amount: number;
  incurred_on: string | null;
  procurement_order_id: string | null;
  resource_request_id: string | null;
  fema_category: string;
  reimbursable: boolean;
  mutual_aid: boolean;
  notes: string;
}

export interface ResourceCheckout extends BaseRow {
  incident_id: string;
  resource_name: string;
  quantity: number;
  checked_out_to: string;
  location: string;
  checked_out_at: string | null;
  checked_in_at: string | null;
  condition_notes: string;
  demobilized: boolean;
}

export interface MutualAidRecord extends BaseRow {
  incident_id: string | null;
  partner_name: string;
  direction: 'received' | 'provided';
  description: string;
  quantity: number;
  estimated_value: number;
  agreement_reference: string;
  status: 'open' | 'returned' | 'reimbursed' | 'closed';
  notes: string;
}

export interface LaborPoolEntry extends BaseRow {
  incident_id: string;
  personnel_id: string | null;
  person_name: string;
  role_or_skill: string;
  department: string;
  skills: string[];
  status: 'available' | 'assigned' | 'on_break' | 'released';
  current_assignment: string;
  assigned_unit: string;
  checked_in_at: string;
  released_at: string | null;
  notes: string;
}

export interface TemporaryPersonnel extends BaseRow {
  incident_id: string | null;
  full_name: string;
  personnel_category: 'volunteer' | 'agency' | 'temp_hire' | 'internal_reassignment' | 'mutual_aid';
  phone: string;
  email: string;
  organization_name: string;
  license_type: string;
  license_number: string;
  license_state: string;
  license_expires: string | null;
  credential_status: 'pending' | 'verified' | 'rejected' | 'expired';
  verified_by: string | null;
  verified_at: string | null;
  privileges_granted: string;
  assignment: string;
  badge_issued: boolean;
  notes: string;
}

export interface TimeEntry extends BaseRow {
  incident_id: string;
  operational_period_id: string | null;
  person_name: string;
  personnel_id: string | null;
  section: string;
  position_title: string;
  work_date: string;
  time_in: string | null;
  time_out: string | null;
  hours: number;
  hourly_rate: number;
  labor_cost: number;
  overtime: boolean;
  notes: string;
}

export interface StaffingRequirement extends BaseRow {
  incident_id: string;
  operational_period_id: string | null;
  unit_or_area: string;
  role_needed: string;
  needed_count: number;
  on_hand_count: number;
  notes: string;
}

// --- Status boards (aggregate counts only — no patient identifiers, ever) ---

export interface BedStatusEntry extends BaseRow {
  facility_id: string | null;
  incident_id: string | null;
  operational_period_id: string | null;
  unit_id: string | null;
  unit_name: string;
  bed_type: string;
  staffed_beds: number;
  occupied_beds: number;
  available_beds: number;
  blocked_beds: number;
  surge_beds_available: number;
  divert_status: 'open' | 'partial' | 'divert';
  is_snapshot: boolean;
  recorded_at: string;
}

export interface AcuityEntry extends BaseRow {
  incident_id: string | null;
  operational_period_id: string | null;
  area: string;
  category: string;
  patient_count: number;
  is_snapshot: boolean;
  recorded_at: string;
}

export interface SupplyStatusEntry extends BaseRow {
  incident_id: string | null;
  operational_period_id: string | null;
  item_name: string;
  category: string;
  on_hand: number;
  unit_of_measure: string;
  burn_rate_per_day: number;
  days_on_hand: number;
  status: 'green' | 'yellow' | 'red';
  is_snapshot: boolean;
  recorded_at: string;
}

export interface StaffingStatusEntry extends BaseRow {
  incident_id: string | null;
  operational_period_id: string | null;
  unit_or_area: string;
  role: string;
  on_hand: number;
  needed: number;
  is_snapshot: boolean;
  recorded_at: string;
}

export interface FacilitySystemStatus extends BaseRow {
  facility_id: string | null;
  incident_id: string | null;
  operational_period_id: string | null;
  system_name: string;
  status: 'green' | 'yellow' | 'red' | 'unknown';
  comments: string;
  estimated_restoration: string;
  is_snapshot: boolean;
  recorded_at: string;
}

export interface SitRep extends BaseRow {
  incident_id: string;
  operational_period_id: string | null;
  sitrep_number: number;
  reported_at: string;
  summary: string;
  current_situation: string;
  actions_taken: string;
  resource_needs: string;
  next_steps: string;
  metrics: Record<string, unknown>;
  prepared_by_name: string;
  status: 'draft' | 'published';
}

export interface PatientTrackingSummary extends BaseRow {
  incident_id: string;
  operational_period_id: string | null;
  tracking_type: 'tracking' | 'evacuation';
  category: string;
  unit_or_area: string;
  destination: string;
  status: string;
  patient_count: number;
  notes: string;
  recorded_at: string;
}

export interface CasualtySummary extends BaseRow {
  incident_id: string;
  operational_period_id: string | null;
  category: string;
  patient_count: number;
  notes: string;
  recorded_at: string;
}

export interface ReunificationLog extends BaseRow {
  incident_id: string;
  inquiries_received: number;
  inquiries_resolved: number;
  reunifications_completed: number;
  pending_cases: number;
  notes: string;
  recorded_at: string;
}

// --- Preparedness program ---

export interface HvaEntry extends BaseRow {
  facility_id: string | null;
  hazard_name: string;
  hazard_category: 'natural' | 'technological' | 'human' | 'hazmat' | 'public_health';
  probability: number;
  human_impact: number;
  property_impact: number;
  business_impact: number;
  preparedness: number;
  internal_response: number;
  external_response: number;
  notes: string;
  assessment_year: number;
}

export interface PlanDocument extends BaseRow {
  title: string;
  doc_type: 'eop' | 'annex' | 'policy' | 'irg' | 'other';
  version: string;
  status: 'draft' | 'active' | 'under_review' | 'archived';
  storage_path: string;
  content: string;
  effective_date: string | null;
  next_review_date: string | null;
  owner_name: string;
}

export interface Exercise extends BaseRow {
  facility_id: string | null;
  title: string;
  exercise_type: 'tabletop' | 'functional' | 'full_scale' | 'drill' | 'real_event';
  drill_category: string;
  scenario: string;
  objectives: string;
  scheduled_at: string | null;
  completed_at: string | null;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  is_community_based: boolean;
  counts_toward_cms: boolean;
  cms_exemption_claimed: boolean;
  participants: string;
  incident_id: string | null;
  notes: string;
}

export interface AarReport extends BaseRow {
  exercise_id: string | null;
  incident_id: string | null;
  title: string;
  summary: string;
  strengths: string;
  areas_for_improvement: string;
  status: 'draft' | 'in_review' | 'final';
  completed_at: string | null;
}

export interface CorrectiveAction extends BaseRow {
  aar_report_id: string | null;
  title: string;
  description: string;
  owner_name: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'completed' | 'deferred';
  due_date: string | null;
  completed_at: string | null;
}

export interface ComplianceRequirement {
  id: string;
  tenant_id: string | null;
  framework: 'cms' | 'tjc' | 'custom';
  reference_code: string;
  element_code: string;
  title: string;
  description: string;
  category: string;
  library_version: string;
  sort_order: number;
}

export interface ComplianceStatus extends BaseRow {
  requirement_id: string;
  status: 'not_assessed' | 'met' | 'partially_met' | 'not_met' | 'not_applicable';
  last_reviewed: string | null;
  next_due: string | null;
  notes: string;
}

export interface ComplianceEvidence extends BaseRow {
  requirement_id: string;
  evidence_type: 'document' | 'exercise' | 'attestation' | 'training' | 'other';
  title: string;
  description: string;
  storage_path: string;
  exercise_id: string | null;
  evidence_date: string | null;
}

export interface TrainingRecord extends BaseRow {
  personnel_id: string | null;
  person_name: string;
  training_name: string;
  completed_on: string | null;
  expires_on: string | null;
  notes: string;
}

// --- Communications ---

export interface NotificationTemplate extends BaseRow {
  name: string;
  subject: string;
  body: string;
  channel: 'email' | 'sms' | 'paging' | 'all';
}

export interface AppNotification extends BaseRow {
  incident_id: string | null;
  subject: string;
  body: string;
  channel: 'email' | 'sms' | 'paging' | 'all';
  audience: 'all_staff' | 'himt' | 'section' | 'custom';
  audience_filter: Record<string, unknown>;
  status: 'draft' | 'queued' | 'sending' | 'sent' | 'failed';
  sent_at: string | null;
  sent_by: string | null;
}

export interface NotificationDelivery extends BaseRow {
  notification_id: string;
  recipient_name: string;
  recipient_address: string;
  channel: string;
  provider: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read' | 'acknowledged';
  error: string;
  delivered_at: string | null;
  acknowledged_at: string | null;
}

export interface IncidentMessage extends BaseRow {
  incident_id: string;
  message_number: number | null;
  from_name: string;
  from_position: string;
  to_name: string;
  to_position: string;
  subject: string;
  body: string;
  priority: 'routine' | 'urgent' | 'immediate';
  reply: string;
  replied_at: string | null;
  created_by: string | null;
}

export interface ActivityLogEntry extends BaseRow {
  incident_id: string;
  operational_period_id: string | null;
  logged_at: string;
  section: string;
  position_title: string;
  entry: string;
  logged_by_name: string;
  created_by: string | null;
}

export interface AuditLogEntry {
  id: string;
  tenant_id: string | null;
  actor_id: string | null;
  actor_email: string;
  action: string;
  entity_type: string;
  entity_id: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface AppDocument extends BaseRow {
  incident_id: string | null;
  title: string;
  doc_category: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  version: number;
  uploaded_by: string | null;
}
