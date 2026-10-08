import fixtures from '../data/colleges.json' with { type: 'json' };
import type { College, ExploreQuery, Preferences, User, WorkspaceEntry, EntryPayload, ImportRequest, ImportResult } from '../types';
import { DEMO_MODE, request } from './client.ts';
import { courseMatch, minimumTuition } from '../domain/college.ts';

export const demoColleges = fixtures as College[];
export const PAGE_SIZE = 8;
export const states = [...new Set(demoColleges.map(college => college.state))].sort();
export const degrees = [...new Set(demoColleges.flatMap(college => college.courses.map(course => course.degree)))].sort();

export function matchingCourses(college: College, query: ExploreQuery, preferences: Preferences | null) {
  const search = query.search.trim().toLowerCase();
  const context = [college.name, college.city, college.state, college.location, college.type].join(' ').toLowerCase();
  if (query.state && college.state !== query.state) return [];
  return college.courses.filter(course =>
    (!search || context.includes(search) || `${course.name} ${course.degree}`.toLowerCase().includes(search))
    && (!query.degree || course.degree === query.degree)
    && (query.budget === null || (course.annualTuition !== null && course.annualTuition <= query.budget))
    && (!preferences || courseMatch(college, course, preferences) !== null));
}

// The standalone snapshot and connected API implement the same discovery contract.
export interface CollegeAdapter {
  list(query: ExploreQuery, preferences: Preferences | null): Promise<{
    data: College[]; total: number; totalPages: number; page: number;
  }>;
  detail(slug: string): Promise<College | null>;
}

export const demoApi: CollegeAdapter = {
  async list(query, preferences) {
    let data = demoColleges.filter(college => matchingCourses(college, query, preferences).length > 0);
    const eligibleCourses = (college: College) => matchingCourses(college, query, preferences);
    const score = (college: College) => preferences
      ? Math.max(...eligibleCourses(college).map(course => courseMatch(college, course, preferences)?.score ?? 0)) : 0;
    data = data.sort((a, b) => {
      if (preferences && score(a) !== score(b)) return score(b) - score(a);
      if (query.sort === 'tuition') {
        const diff = (minimumTuition(eligibleCourses(a)) ?? Infinity) - (minimumTuition(eligibleCourses(b)) ?? Infinity);
        if (diff) return diff;
      }
      if (query.sort === 'established' && a.established !== b.established) return (a.established ?? Infinity) - (b.established ?? Infinity);
      return a.name.localeCompare(b.name);
    });
    const total = data.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(query.page, totalPages);
    return { data: data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total, totalPages, page };
  },
  async detail(slug) {
    return demoColleges.find(college => college.slug === slug) ?? null;
  },
};

export const collegesApi: CollegeAdapter = DEMO_MODE ? demoApi : {
  async list(query, preferences) {
    if (preferences) return request('/matches', { method: 'POST', body: { query, preferences }, token: null });
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => { if (value !== null && value !== '') params.set(key, String(value)); });
    return request('/colleges?' + params.toString(), { token: null });
  },
  async detail(slug) {
    try { return await request<College>('/colleges/' + encodeURIComponent(slug), { token: null }); }
    catch (error) {
      if (error instanceof Error && 'status' in error && error.status === 404) return null;
      throw error;
    }
  },
};

export function requireOfficialCatalog(catalog: College[]): College[] {
  if (catalog.some(college => college.dataStatus === 'demo'
    || college.courses.some(course => course.feeBasis === 'demo-assumption'))) {
    throw new Error('College information is being updated. Please try again shortly.');
  }
  return catalog;
}

export async function getCatalog(): Promise<College[]> {
  const catalog = DEMO_MODE ? demoColleges : await request<College[]>('/colleges/catalog', { token: null });
  return requireOfficialCatalog(catalog);
}
export const authApi = {
  register: (data: {name: string; email: string; password: string}) =>
    request<{access_token: string; user: User}>('/auth/register', { method: 'POST', body: data, token: null }),
  login: (data: {email: string; password: string}) =>
    request<{access_token: string; user: User}>('/auth/login', { method: 'POST', body: data, token: null }),
  me: () => request<User>('/auth/me'),
};

type WireEntry = Omit<WorkspaceEntry, 'targetDate' | 'scenario'> & {
  targetDate: string | null; scenario?: WorkspaceEntry['scenario'] | null;
};
export function fromWire(entry: WireEntry): WorkspaceEntry {
  return { ...entry, targetDate: entry.targetDate ?? '', scenario: entry.scenario ?? undefined };
}
export function toWire(entry: Partial<WorkspaceEntry>) {
  const keys = ['collegeId', 'courseId', 'stage', 'notes', 'nextAction', 'targetDate', 'scenario'] as const;
  return Object.fromEntries(keys.filter(key => key in entry).map(key => [
    key, key === 'targetDate' ? entry[key] || null : key === 'scenario' ? entry[key] ?? null : entry[key],
  ]));
}
export function patchToWire(patch: Partial<WorkspaceEntry>, revision: number) {
  const fields = toWire(patch);
  delete fields.collegeId;
  delete fields.courseId;
  return { ...fields, revision };
}
export const workspaceApi = {
  list: async () => (await request<WireEntry[]>('/workspace')).map(fromWire),
  create: async (payload: EntryPayload) => fromWire(await request<WireEntry>('/workspace', { method: 'POST', body: toWire(payload) })),
  update: async (id: string, patch: Partial<WorkspaceEntry>, revision: number) =>
    fromWire(await request<WireEntry>('/workspace/' + id, { method: 'PATCH', body: patchToWire(patch, revision) })),
  remove: (id: string, revision: number) => request<void>('/workspace/' + id + '?revision=' + revision, { method: 'DELETE' }),
  import: async (payload: ImportRequest): Promise<ImportResult> => {
    const result = await request<ImportResult>('/workspace/import', { method: 'POST', body: payload });
    return { ...result, conflicts: result.conflicts.map(conflict => ({
      ...conflict, account: fromWire(conflict.account as WireEntry),
    })) };
  },
};
export const profileApi = {
  get: () => request<Preferences | null>('/profile'),
  save: (preferences: Preferences) => request<Preferences>('/profile', { method: 'PUT', body: preferences }),
};
