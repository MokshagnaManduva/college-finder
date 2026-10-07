import test from 'node:test';
import assert from 'node:assert/strict';
import { tuitionLabel, hasReviewedFacts, lowestComparableTuition, sourceCoverage } from '../src/domain/provenance.ts';
import { demoColleges } from '../src/api/index.ts';
import type { Course, CourseEvidence } from '../src/types/index.ts';

const demo = demoColleges[0].courses[0];
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
  assert.equal(hasReviewedFacts(demoColleges), false);
  const college = {...demoColleges[0], courses: [reviewed]};
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
  const college = {...demoColleges[0], courses: [checked, {...checked, id: 'second'}]};
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
