import test from 'node:test';
import assert from 'node:assert/strict';
import { tuitionLabel, hasReviewedFacts, lowestComparableTuition, sourceCoverage } from '../src/domain/provenance.ts';
import { demoColleges } from '../src/api/index.ts';
import type { Course, CourseEvidence } from '../src/types/index.ts';

const demo: Course = {...demoColleges[0].courses[0], feeBasis: "demo-assumption", annualTuition: 220000, durationMonths: 48, source: undefined,
  tuitionEvidence: null, durationEvidence: null};
const evidence: CourseEvidence = {
  rawValue: 100000, rawUnit: 'INR/semester', factor: 2, normalizedValue: 200000,
  notes: 'Indian new entrants, standard tuition before exemptions; two semesters per year.',
  reviewer: 'Test review', reviewedAt: '2026-10-07T00:00:00Z',
  source: {id: 'source', title: 'Official fee circular', status: 'verified',
    url: 'https://example.edu/fees.pdf', reportingYear: 2026, verifiedAt: '2026-10-07T00:00:00Z'},
};
const reviewed: Course = {...demo, annualTuition: 200000, feeBasis: 'reported', tuitionEvidence: evidence};

test('tuition labels distinguish demo, reviewed annualization, unverified and unknown', () => {
  assert.equal(tuitionLabel(demo), 'Demo annual assumption');
  assert.equal(tuitionLabel(reviewed), 'Annualized tuition · source checked');
  assert.equal(tuitionLabel({...reviewed, tuitionEvidence: null}), 'Reported tuition · unverified');
  assert.equal(tuitionLabel({...reviewed, annualTuition: null}), 'Tuition unavailable');
});

test('one reviewed course claim does not relabel an entire catalog as verified', () => {
  assert.equal(hasReviewedFacts([{...demoColleges[0], courses: [demo]}]), false);
  const college = {...demoColleges[0], dataStatus: "demo" as const, source: undefined, placements: {...demoColleges[0].placements, source: undefined}, courses: [reviewed]};
  assert.equal(hasReviewedFacts([college]), true);
  assert.equal(college.dataStatus, 'demo');
});

test('tuition highlights refuse mixed provenance, missing values and different scopes', () => {
  assert.equal(lowestComparableTuition([demo, reviewed]), null);
  assert.equal(lowestComparableTuition([reviewed, undefined]), null);
  assert.equal(lowestComparableTuition([reviewed, {...reviewed, annualTuition: null}]), null);
  assert.equal(lowestComparableTuition([reviewed, {...reviewed, tuitionEvidence: {...evidence, notes: 'Foreign nationals'}}]), null);
  assert.equal(lowestComparableTuition([reviewed, {...reviewed, tuitionEvidence: {...evidence, source: {...evidence.source, reportingYear: 2025}}}]), null);
  assert.equal(lowestComparableTuition([reviewed, {...reviewed, annualTuition: 0,
    tuitionEvidence: {...evidence, rawValue: 0, normalizedValue: 0}}]), 0);
  assert.equal(lowestComparableTuition([demo, {...demo, annualTuition: 0}]), 0);
});

test('source coverage counts claims and deduplicates retained documents without verifying a college', () => {
  const checked = {...reviewed, tuitionEvidence: {...evidence, documentSha256: 'hash'},
    durationEvidence: {...evidence, rawValue: 4, rawUnit: 'years' as const, factor: 12,
      normalizedValue: 48, documentSha256: 'hash'}};
  const college = {...demoColleges[0], dataStatus: "demo" as const, source: undefined, placements: {...demoColleges[0].placements, source: undefined}, courses: [checked, {...checked, id: 'second'}]};
  const coverage = sourceCoverage([college]);
  assert.equal(coverage.courseCount, 2);
  assert.equal(coverage.tuitionCount, 2);
  assert.equal(coverage.durationCount, 2);
  assert.equal(coverage.documentCount, 1);
  assert.equal(college.dataStatus, 'demo');
  const inconsistent = {...checked, annualTuition: 1, durationMonths: 1};
  assert.equal(sourceCoverage([{...college, courses: [inconsistent]}]).reviewed.length, 0);
  assert.equal(tuitionLabel(inconsistent), 'Reported tuition · unverified');
  assert.equal(lowestComparableTuition([checked, inconsistent]), null);
});

test('academic fees and admission payments retain their period without becoming tuition', async () => {
  const { annualAcademicFee, displayedFee, reviewedEvidence, intakeLabel } = await import('../src/domain/provenance.ts');
  const { matchingCourses } = await import('../src/api/index.ts');
  const sibm = demoColleges.find(college => college.slug === 'symbiosis-pune')!;
  const course = sibm.courses[0];
  assert.equal(annualAcademicFee(course), 1310000);
  assert.equal(course.annualTuition, null);
  assert.match(displayedFee(course).label, /academic fee/);
  assert.equal(lowestComparableTuition([course, reviewed]), null);
  assert.equal(matchingCourses(sibm, {search: '', state: '', degree: '', budget: 2000000,
    sort: 'name', page: 1}, null).length, 0);
  const pumba = demoColleges.find(college => college.slug === 'pune-university')!.courses[0];
  assert.equal(annualAcademicFee(pumba), null);
  assert.equal(displayedFee(pumba).value, 163983);
  assert.equal(displayedFee(pumba).annual, false);
  assert.match(displayedFee(pumba).label, /Admission payment/);
  assert.equal(reviewedEvidence({...pumba, academicFeeEvidence: {...pumba.academicFeeEvidence!,
    normalizedValue: 327966}}, 'academicFee'), null);
  const bombay = demoColleges.find(college => college.slug === 'iit-bombay')!.courses[0];
  assert.equal(intakeLabel(bombay), 'Reported intake: 199 · 2026');
  assert.equal(reviewedEvidence({...bombay, seats: 170}, 'seats'), null);
  const coverage = sourceCoverage(demoColleges);
  assert.equal(coverage.academicFeeCount, 4);
  assert.equal(coverage.intakeCount, 8);
  assert.equal(coverage.facilityCount, 11);
});
