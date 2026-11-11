import type { College, Course } from '../types';

export function reviewedEvidence(course: Course, kind: 'tuition' | 'duration' | 'academicFee' | 'seats') {
  const evidence = {tuition: course.tuitionEvidence, duration: course.durationEvidence,
    academicFee: course.academicFeeEvidence, seats: course.seatsEvidence}[kind];
  const value = {tuition: course.annualTuition, duration: course.durationMonths,
    academicFee: evidence ? evidence.rawValue * evidence.factor : null, seats: course.seats}[kind];
  return evidence?.source.status === 'verified' && evidence.normalizedValue === value
    && (kind !== 'tuition' || course.feeBasis === 'reported') ? evidence : null;
}

export function annualAcademicFee(course: Course): number | null {
  const evidence = reviewedEvidence(course, 'academicFee');
  return evidence && ['INR/year', 'INR/semester', 'INR/installment'].includes(evidence.rawUnit)
    ? evidence.normalizedValue : null;
}

export function displayedFee(course: Course) {
  if (course.annualTuition !== null) return {value: course.annualTuition, label: tuitionLabel(course),
    year: course.tuitionEvidence?.source.reportingYear, annual: true};
  const evidence = reviewedEvidence(course, 'academicFee');
  if (evidence) return {value: evidence.normalizedValue,
    label: evidence.rawUnit === 'INR/admission' ? 'Admission payment · source checked'
      : `${evidence.factor > 1 ? 'Annualized' : 'Annual'} academic fee · source checked`,
    year: evidence.source.reportingYear, annual: evidence.rawUnit !== 'INR/admission'};
  return {value: null, label: 'Tuition unavailable', year: null, annual: false};
}

export function intakeLabel(course: Course) {
  const evidence = reviewedEvidence(course, 'seats');
  return evidence ? `Reported intake: ${course.seats}${evidence.source.reportingYear ? ` · ${evidence.source.reportingYear}` : ''}` : 'Intake unavailable';
}

export function sourceCoverage(colleges: College[]) {
  const rows = colleges.flatMap(college => college.courses.map(course => ({
    college, course, tuition: reviewedEvidence(course, 'tuition'), duration: reviewedEvidence(course, 'duration'),
    academicFee: reviewedEvidence(course, 'academicFee'), seats: reviewedEvidence(course, 'seats'),
  })));
  const reviewed = rows.filter(row => row.tuition || row.duration || row.academicFee || row.seats);
  const hashes = new Set([
    ...reviewed.flatMap(row => [row.tuition, row.duration, row.academicFee, row.seats]
      .flatMap(evidence => evidence?.documentSha256 ? [evidence.documentSha256] : [])),
    ...colleges.flatMap(college => [college.source, college.placements.source,
      ...college.courses.map(course => course.source),
      ...(college.facilityEvidence ?? []).map(facility => facility.source)].flatMap(source =>
      source?.documentSha256 ? [source.documentSha256] : [])),
  ]);
  return {courseCount: rows.length, tuitionCount: rows.filter(row => row.tuition).length,
    durationCount: rows.filter(row => row.duration).length, reviewed, documentCount: hashes.size,
    academicFeeCount: rows.filter(row => row.academicFee).length,
    intakeCount: rows.filter(row => row.seats).length,
    facilityCount: colleges.reduce((count, college) => count + (college.facilityEvidence ?? [])
      .filter(facility => facility.source.status === 'verified').length, 0),
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
    reviewedEvidence(course, 'tuition') || reviewedEvidence(course, 'duration')
    || reviewedEvidence(course, 'academicFee') || reviewedEvidence(course, 'seats')));
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
