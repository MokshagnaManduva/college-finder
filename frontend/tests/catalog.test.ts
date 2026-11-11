import test from 'node:test';
import assert from 'node:assert/strict';
import { demoColleges, requireOfficialCatalog } from '../src/api/index.ts';
import { canonicalOption } from '../src/state/guestStorage.ts';
import legacy from '../src/data/legacy-options.json' with {type: 'json'};
import { sourceCoverage } from '../src/domain/provenance.ts';

test('published snapshot contains official references and clears sample amounts', () => {
  assert.equal(demoColleges.length, 19);
  const courses = demoColleges.flatMap(college => college.courses);
  assert.equal(courses.length, 28);
  assert.equal(courses.find(course => course.name === "PGPEM (Weekend MBA)")?.durationMonths, 24);
  assert.ok(demoColleges.every(college => college.image === '' && college.facilities.length === (college.facilityEvidence ?? []).length
    && college.source?.url?.startsWith('https://') && college.dataStatus !== 'demo'));
  assert.ok(courses.every(course => course.feeBasis !== 'demo-assumption' && (course.seats === null || course.seatsEvidence?.source.status === 'verified')));
  assert.ok(demoColleges.every(college => college.placements.avgPackage === null
    && college.placements.highestPackage === null && college.placements.placementRate === null));
  const coverage = sourceCoverage(demoColleges);
  assert.equal(coverage.tuitionCount, 13);
  assert.equal(coverage.durationCount, 27);
  assert.equal(coverage.profileCount, 19);
  assert.equal(coverage.outcomeCount, 12);
  assert.ok(coverage.documentCount > 30);
  assert.equal(requireOfficialCatalog(demoColleges), demoColleges);
  const manipal = demoColleges.find(college => college.slug === 'manipal-university')!.courses[0];
  assert.equal(manipal.annualTuition, 376000);
  assert.equal(manipal.tuitionEvidence?.rawUnit, 'INR/year');
  assert.match(manipal.tuitionEvidence!.notes, /other fees/);
  const amity = demoColleges.find(college => college.slug === 'amity-university-noida')!.courses[0];
  assert.equal(amity.durationEvidence?.source.reportingYear, 2026);
  assert.equal(amity.annualTuition, null);
  const sibm = demoColleges.find(college => college.slug === 'symbiosis-pune')!.courses[0];
  assert.equal(sibm.annualTuition, null);
  assert.equal(sibm.tuitionEvidence, null);
  assert.match(sibm.source!.notes!, /academic fees total ₹13,10,000/);
  assert.throws(() => requireOfficialCatalog([{...demoColleges[0], dataStatus: 'demo'}]), /being updated/);
});

test('legacy aliases keep notes attached to archived programmes', () => {
  const archived = legacy.find(item => !demoColleges.flatMap(college => college.courses)
    .some(course => course.id === item.courseId))!;
  assert.ok(archived);
  assert.deepEqual(canonicalOption({collegeId: archived.collegeId, courseId: archived.legacyId}), {
    collegeId: archived.collegeId, courseId: archived.courseId,
  });
});
