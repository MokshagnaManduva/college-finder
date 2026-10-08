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
  assert.ok(demoColleges.every(college => college.image === '' && college.facilities.length === 0
    && college.source?.url?.startsWith('https://') && college.dataStatus !== 'demo'));
  assert.ok(courses.every(course => course.feeBasis !== 'demo-assumption' && course.seats === null));
  assert.ok(demoColleges.every(college => college.placements.avgPackage === null
    && college.placements.highestPackage === null && college.placements.placementRate === null));
  const coverage = sourceCoverage(demoColleges);
  assert.equal(coverage.tuitionCount, 13);
  assert.equal(coverage.durationCount, 26);
  assert.equal(coverage.profileCount, 18);
  assert.equal(coverage.outcomeCount, 4);
  assert.ok(coverage.documentCount > 30);
  assert.equal(requireOfficialCatalog(demoColleges), demoColleges);
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
