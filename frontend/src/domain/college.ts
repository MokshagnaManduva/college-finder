import type { College, Course, CostScenario, Option, Preferences } from '../types';

export function money(amount: number | null): string {
  if (amount === null) return 'Not available';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(amount);
}

export function compactMoney(amount: number | null): string {
  if (amount === null) return '—';
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}L`;
  return money(amount);
}

export function duration(months: number): string {
  return `${months / 12} ${months === 12 ? 'year' : 'years'}`;
}

export function minimumTuition(courses: Course[]): number | null {
  const values = courses.flatMap(course => course.annualTuition === null ? [] : [course.annualTuition]);
  return values.length ? Math.min(...values) : null;
}

export function optionKey(option: Option): string {
  return `${option.collegeId}:${option.courseId ?? ''}`;
}

export function resolveComparison(options: Option[], colleges: College[]) {
  return options.flatMap(option => {
    const college = colleges.find(item => item.id === option.collegeId);
    if (!college) return [];
    const course = college.courses.find(item => item.id === option.courseId);
    if (option.courseId !== null && !course) return [];
    return [{option, college, course}];
  });
}

export function courseMatch(college: College, course: Course, preferences: Preferences) {
  const reasons: string[] = [];
  const mismatches: string[] = [];
  if (preferences.degree && course.degree !== preferences.degree) return null;
  if (preferences.degree) reasons.push(`Offers ${preferences.degree}`);
  if (preferences.states.length) {
    if (preferences.states.includes(college.state)) reasons.push('In a preferred state');
    else if (preferences.strictLocation) return null;
    else mismatches.push('Outside preferred states');
  }
  if (preferences.budget !== null) {
    if (course.annualTuition === null) {
      if (preferences.strictBudget) return null;
      mismatches.push('Tuition not available');
    } else if (course.annualTuition <= preferences.budget) reasons.push('Within tuition budget');
    else if (preferences.strictBudget) return null;
    else mismatches.push('Above tuition budget');
  }
  return { reasons, mismatches, score: reasons.length };
}

export function estimateCost(scenario: CostScenario, durationMonths: number) {
  const { tuition, living, other, oneTime } = scenario;
  const complete = [tuition, living, other, oneTime].every(value => value !== null);
  // Calculate in integer paise so partial-year durations retain monetary precision.
  const annual = (tuition ?? 0) + (living ?? 0) + (other ?? 0);
  const total = Math.round((Math.round(annual * 100 * durationMonths / 12)
    + (oneTime ?? 0) * 100) / 100);
  return { total, complete };
}

export function csvCell(value: string): string {
  const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function dateStatus(date: string, now = new Date()): 'overdue' | 'soon' | null {
  if (!date) return null;
  const [year, month, day] = date.split('-').map(Number);
  const days = Math.round((Date.UTC(year, month - 1, day)
    - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  return days < 0 ? 'overdue' : days <= 7 ? 'soon' : null;
}
