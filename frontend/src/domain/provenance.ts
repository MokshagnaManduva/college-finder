import type { College, Course } from '../types';

export function reviewedEvidence(course: Course, kind: 'tuition' | 'duration') {
  const evidence = kind === 'tuition' ? course.tuitionEvidence : course.durationEvidence;
  const value = kind === 'tuition' ? course.annualTuition : course.durationMonths;
  return evidence?.source.status === 'verified' && evidence.normalizedValue === value
    && (kind !== 'tuition' || course.feeBasis === 'reported') ? evidence : null;
}

export function sourceCoverage(colleges: College[]) {
  const rows = colleges.flatMap(college => college.courses.map(course => ({
    college, course, tuition: reviewedEvidence(course, 'tuition'), duration: reviewedEvidence(course, 'duration'),
  })));
  const reviewed = rows.filter(row => row.tuition || row.duration);
  const hashes = new Set([
    ...reviewed.flatMap(row => [row.tuition, row.duration]
      .flatMap(evidence => evidence?.documentSha256 ? [evidence.documentSha256] : [])),
    ...colleges.flatMap(college => [college.source, college.placements.source,
      ...college.courses.map(course => course.source)].flatMap(source =>
      source?.documentSha256 ? [source.documentSha256] : [])),
  ]);
  return {courseCount: rows.length, tuitionCount: rows.filter(row => row.tuition).length,
    durationCount: rows.filter(row => row.duration).length, reviewed, documentCount: hashes.size,
    outcomeCount: colleges.filter(college => college.placements.medianPackage != null).length,
    profileCount: colleges.filter(college => college.source?.status === "verified").length};
}

export function tuitionLabel(course: Course): string {
  if (course.annualTuition === null) return 'Tuition unavailable';
  if (course.feeBasis === 'demo-assumption') return 'Demo annual assumption';
  const evidence = reviewedEvidence(course, 'tuition');
  if (evidence) {
    return evidence.factor > 1 ? 'Annualized tuition · source checked' : 'Annual tuition · source checked';
  }
  return 'Reported tuition · unverified';
}

export function hasReviewedFacts(colleges: College[]): boolean {
  return colleges.some(college => college.courses.some(course =>
    reviewedEvidence(course, 'tuition') || reviewedEvidence(course, 'duration')));
}

export function lowestComparableTuition(courses: Array<Course | undefined>): number | null {
  if (courses.length < 2 || courses.some(course => !course || course.annualTuition === null)) return null;
  const known = courses as Course[];
  if (known.every(course => course.feeBasis === 'demo-assumption')) {
    return Math.min(...known.map(course => course.annualTuition!));
  }
  const first = known[0].tuitionEvidence;
  if (!first || known.some(course => {
    const evidence = reviewedEvidence(course, 'tuition');
    return !evidence || evidence.rawUnit !== first.rawUnit || evidence.factor !== first.factor
      || evidence.source.reportingYear !== first.source.reportingYear || evidence.notes !== first.notes;
  })) return null;
  return Math.min(...known.map(course => course.annualTuition!));
}
