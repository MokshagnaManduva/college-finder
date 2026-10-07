export interface Course {
  id: string;
  name: string;
  degree: string;
  durationMonths: number;
  annualTuition: number | null;
  feeBasis: 'demo-assumption' | 'reported' | 'unknown';
  legacyId?: string;
  source?: SourceInfo;
  tuitionEvidence?: CourseEvidence | null;
  durationEvidence?: CourseEvidence | null;
  seats: number | null;
}

export interface College {
  id: string;
  slug: string;
  name: string;
  location: string;
  city: string;
  state: string;
  type: string;
  established: number;
  description: string;
  image: string;
  accreditation: string;
  facilities: string[];
  dataStatus: 'demo' | 'unverified' | 'verified';
  legacyId?: string;
  source?: SourceInfo;
  courses: Course[];
  placements: {
    avgPackage: number | null;
    highestPackage: number | null;
    placementRate: number | null;
    topRecruiters: string[];
    reportingYear: number | null;
    scope: string | null;
  };
}

export interface ExploreQuery {
  search: string;
  state: string;
  degree: string;
  budget: number | null;
  sort: 'name' | 'tuition' | 'established';
  page: number;
}

export interface Preferences {
  degree: string;
  states: string[];
  budget: number | null;
  strictBudget: boolean;
  strictLocation: boolean;
}

export interface Option {
  collegeId: string;
  courseId: string | null;
}

export const STAGES = [
  'Researching', 'Shortlisted', 'Applying', 'Applied',
  'Offer received', 'Waitlisted', 'Rejected', 'Withdrawn',
] as const;
export type Stage = typeof STAGES[number];

export interface CostScenario {
  tuition: number | null;
  living: number | null;
  other: number | null;
  oneTime: number | null;
}

export interface WorkspaceEntry extends Option {
  id: string;
  stage: Stage;
  notes: string;
  nextAction: string;
  targetDate: string;
  scenario?: CostScenario;
  createdAt: string;
  revision?: number;
  updatedAt?: string;
}

export interface GuestState {
  version: 1;
  entries: WorkspaceEntry[];
  compare: Option[];
  preferences: Preferences;
}


export interface SourceInfo {
  id: string; title: string; status: 'demo' | 'unverified' | 'verified'; url: string | null;
  reportingYear: number | null; verifiedAt: string | null;
}
export interface CourseEvidence {
  documentSha256?: string | null;
  rawValue: number; rawUnit: 'INR/semester' | 'INR/year' | 'months' | 'years' | 'semesters'; factor: number;
  normalizedValue: number; notes: string; reviewer: string; reviewedAt: string; source: SourceInfo;
}
export interface User { id: string; name: string; email: string }
export type EntryPayload = Omit<WorkspaceEntry, 'id' | 'revision' | 'createdAt' | 'updatedAt'>;
export interface ImportRequest {
  key: string;
  entries: Array<Record<string, unknown> & {clientId: string}>;
}
export interface ImportConflict {
  clientId: string; guest: EntryPayload; account: WorkspaceEntry;
}
export interface ImportResult {
  imported: Array<{clientId: string; entryId: string}>;
  conflicts: ImportConflict[];
}
