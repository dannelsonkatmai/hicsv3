import type { HicsSection } from '../types/domain';

// Bundled copy of the standard HICS 2014 HIMT chart (also seeded in the
// himt_positions table) so the org-chart builder works offline before the
// first sync completes.

export interface PositionDef {
  code: string;
  title: string;
  section: HicsSection;
  parentCode: string | null;
  sortOrder: number;
}

export const STANDARD_HIMT_POSITIONS: PositionDef[] = [
  { code: 'IC', title: 'Incident Commander', section: 'command', parentCode: null, sortOrder: 1 },
  { code: 'PIO', title: 'Public Information Officer', section: 'command', parentCode: 'IC', sortOrder: 2 },
  { code: 'SO', title: 'Safety Officer', section: 'command', parentCode: 'IC', sortOrder: 3 },
  { code: 'LNO', title: 'Liaison Officer', section: 'command', parentCode: 'IC', sortOrder: 4 },
  { code: 'MTS', title: 'Medical/Technical Specialist', section: 'command', parentCode: 'IC', sortOrder: 5 },
  { code: 'OSC', title: 'Operations Section Chief', section: 'operations', parentCode: 'IC', sortOrder: 10 },
  { code: 'OPS-STG', title: 'Staging Manager', section: 'operations', parentCode: 'OSC', sortOrder: 11 },
  { code: 'OPS-MED', title: 'Medical Care Branch Director', section: 'operations', parentCode: 'OSC', sortOrder: 12 },
  { code: 'OPS-INF', title: 'Infrastructure Branch Director', section: 'operations', parentCode: 'OSC', sortOrder: 13 },
  { code: 'OPS-SEC', title: 'Security Branch Director', section: 'operations', parentCode: 'OSC', sortOrder: 14 },
  { code: 'OPS-HAZ', title: 'HazMat Branch Director', section: 'operations', parentCode: 'OSC', sortOrder: 15 },
  { code: 'OPS-BUS', title: 'Business Continuity Branch Director', section: 'operations', parentCode: 'OSC', sortOrder: 16 },
  { code: 'OPS-PFA', title: 'Patient Family Assistance Branch Director', section: 'operations', parentCode: 'OSC', sortOrder: 17 },
  { code: 'PSC', title: 'Planning Section Chief', section: 'planning', parentCode: 'IC', sortOrder: 20 },
  { code: 'PLN-RES', title: 'Resources Unit Leader', section: 'planning', parentCode: 'PSC', sortOrder: 21 },
  { code: 'PLN-SIT', title: 'Situation Unit Leader', section: 'planning', parentCode: 'PSC', sortOrder: 22 },
  { code: 'PLN-DOC', title: 'Documentation Unit Leader', section: 'planning', parentCode: 'PSC', sortOrder: 23 },
  { code: 'PLN-DEM', title: 'Demobilization Unit Leader', section: 'planning', parentCode: 'PSC', sortOrder: 24 },
  { code: 'LSC', title: 'Logistics Section Chief', section: 'logistics', parentCode: 'IC', sortOrder: 30 },
  { code: 'LOG-SVC', title: 'Service Branch Director', section: 'logistics', parentCode: 'LSC', sortOrder: 31 },
  { code: 'LOG-COM', title: 'Communications Unit Leader', section: 'logistics', parentCode: 'LOG-SVC', sortOrder: 32 },
  { code: 'LOG-IT', title: 'IT/IS Unit Leader', section: 'logistics', parentCode: 'LOG-SVC', sortOrder: 33 },
  { code: 'LOG-FOOD', title: 'Food Services Unit Leader', section: 'logistics', parentCode: 'LOG-SVC', sortOrder: 34 },
  { code: 'LOG-SUP', title: 'Support Branch Director', section: 'logistics', parentCode: 'LSC', sortOrder: 35 },
  { code: 'LOG-EMP', title: 'Employee Health & Well-Being Unit Leader', section: 'logistics', parentCode: 'LOG-SUP', sortOrder: 36 },
  { code: 'LOG-FAC', title: 'Facilities Unit Leader', section: 'logistics', parentCode: 'LOG-SUP', sortOrder: 37 },
  { code: 'LOG-TRN', title: 'Transportation Unit Leader', section: 'logistics', parentCode: 'LOG-SUP', sortOrder: 38 },
  { code: 'LOG-SPL', title: 'Supply Unit Leader', section: 'logistics', parentCode: 'LOG-SUP', sortOrder: 39 },
  { code: 'LOG-LAB', title: 'Labor Pool & Credentialing Unit Leader', section: 'logistics', parentCode: 'LOG-SUP', sortOrder: 40 },
  { code: 'FSC', title: 'Finance/Administration Section Chief', section: 'finance', parentCode: 'IC', sortOrder: 50 },
  { code: 'FIN-TIME', title: 'Time Unit Leader', section: 'finance', parentCode: 'FSC', sortOrder: 51 },
  { code: 'FIN-PROC', title: 'Procurement Unit Leader', section: 'finance', parentCode: 'FSC', sortOrder: 52 },
  { code: 'FIN-COMP', title: 'Compensation/Claims Unit Leader', section: 'finance', parentCode: 'FSC', sortOrder: 53 },
  { code: 'FIN-COST', title: 'Cost Unit Leader', section: 'finance', parentCode: 'FSC', sortOrder: 54 }
];

export const SECTION_LABELS: Record<HicsSection, string> = {
  command: 'Command',
  operations: 'Operations',
  planning: 'Planning',
  logistics: 'Logistics',
  finance: 'Finance/Admin'
};

export const SECTION_ORDER: HicsSection[] = ['command', 'operations', 'planning', 'logistics', 'finance'];
