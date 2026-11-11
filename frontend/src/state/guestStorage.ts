import { demoColleges } from '../api/index.ts';
import legacyOptions from '../data/legacy-options.json' with { type: 'json' };
import { optionKey } from '../domain/college.ts';
import { STAGES, type GuestState, type Option, type Preferences, type WorkspaceEntry } from '../types/index.ts';

export const GUEST_KEY = 'college-finder-guest-v1';
export const EMPTY_PREFERENCES: Preferences = {
  degree: '', states: [], budget: null, strictBudget: false, strictLocation: false,
};
export const emptyGuest = (): GuestState => ({
  version: 1, entries: [], compare: [], preferences: { ...EMPTY_PREFERENCES, states: [] },
});
export const NOTES_LIMIT = 4000;
export const NEXT_ACTION_LIMIT = 300;
// Matches the account API so a stored browser entry can always be imported later.
export function validDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 1 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function canonicalOption(value: Option): Option | null {
  const college = demoColleges.find(item => item.id === value.collegeId || item.slug === value.collegeId);
  const collegeId = college?.id ?? value.collegeId;
  if (typeof collegeId !== 'string' || !uuid.test(collegeId)) return null;
  if (value.courseId === null) return { collegeId, courseId: null };
  const course = college?.courses.find(item => item.id === value.courseId || item.legacyId === value.courseId);
  const alias = legacyOptions.find(item => item.collegeId === collegeId && item.legacyId === value.courseId);
  const courseId = course?.id ?? alias?.courseId ?? value.courseId;
  return typeof courseId === 'string' && uuid.test(courseId) ? { collegeId, courseId } : null;
}

export function validateGuest(value: unknown): GuestState | null {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) return null;
  const candidate = value as GuestState;
  const entries: WorkspaceEntry[] = [];
  const seen = new Set<string>();
  for (const entry of Array.isArray(candidate.entries) ? candidate.entries : []) {
    if (!entry || typeof entry !== 'object') continue;
    const option = canonicalOption(entry);
    if (!option || !STAGES.includes(entry.stage) || typeof entry.id !== 'string'
      || !uuid.test(entry.id) || typeof entry.notes !== 'string' || typeof entry.nextAction !== 'string'
      || typeof entry.targetDate !== 'string' || typeof entry.createdAt !== 'string') continue;
    if (seen.has(optionKey(option))) continue;
    seen.add(optionKey(option));
    const cleaned = { ...entry, ...option, notes: entry.notes.slice(0, NOTES_LIMIT),
      nextAction: entry.nextAction.slice(0, NEXT_ACTION_LIMIT),
      targetDate: validDate(entry.targetDate) ? entry.targetDate : '' };
    const scenario = cleaned.scenario;
    if (scenario && !['tuition', 'living', 'other', 'oneTime'].every(key => {
      const amount = scenario[key as keyof typeof scenario];
      return amount === null || (Number.isSafeInteger(amount) && amount >= 0 && amount <= 1000000000);
    })) delete cleaned.scenario;
    entries.push(cleaned);
  }
  const compareSeen = new Set<string>();
  const compare = (Array.isArray(candidate.compare) ? candidate.compare : []).flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const option = canonicalOption(value);
    if (!option || compareSeen.has(optionKey(option))) return [];
    compareSeen.add(optionKey(option)); return [option];
  }).slice(0, 3);
  const p = candidate.preferences;
  const validPreferences = p && typeof p.degree === 'string' && Array.isArray(p.states)
    && p.states.length <= 30 && p.states.every(state => typeof state === 'string' && state.length <= 100)
    && p.degree.length <= 100
    && (p.budget === null || (Number.isSafeInteger(p.budget) && p.budget >= 0 && p.budget <= 1000000000))
    && typeof p.strictBudget === 'boolean' && typeof p.strictLocation === 'boolean';
  return { version: 1, entries, compare, preferences: validPreferences ? p : EMPTY_PREFERENCES };
}

export function readGuest(): GuestState {
  try { return validateGuest(JSON.parse(localStorage.getItem(GUEST_KEY) ?? 'null')) ?? emptyGuest(); }
  catch { return emptyGuest(); }
}
