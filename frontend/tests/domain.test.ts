import test from 'node:test';
import assert from 'node:assert/strict';
import { collegesApi, demoColleges, matchingCourses } from '../src/api/index.ts';
import { courseMatch, csvCell, dateStatus, estimateCost, minimumTuition, optionKey, resolveComparison } from '../src/domain/college.ts';
import type { ExploreQuery, Preferences } from '../src/types/index.ts';

const preferences: Preferences = { degree: '', states: [], budget: null, strictBudget: false, strictLocation: false };
const query: ExploreQuery = { search: '', state: '', degree: '', budget: null, sort: 'name', page: 1 };
const college = demoColleges.find(item => item.slug === 'iit-bombay')!;
const course = college.courses[0];

test('comparison survives missing colleges and courses without losing valid selection order', () => {
  const first = {collegeId: college.id, courseId: course.id};
  const research = {collegeId: college.id, courseId: null};
  const stale = {collegeId: 'missing-college', courseId: null};
  const foreignCourse = {collegeId: college.id, courseId: demoColleges.find(item => item.id !== college.id)!.courses[0].id};
  const requested = [first, stale, foreignCourse, research];
  const result = resolveComparison(requested, demoColleges);
  assert.deepEqual(result.map(item => item.option), [first, research]);
  assert.equal(result[0].course?.id, course.id);
  assert.equal(result[1].course, undefined);
  assert.equal(requested.length, 4);
  assert.deepEqual(resolveComparison(requested, []), []);
});

test('discovery searches courses and cities case-insensitively', async () => {
  const courses = await collegesApi.list({ ...query, search: 'COMPUTER SCIENCE' }, null);
  assert.ok(courses.total > 0);
  assert.ok(courses.data.every(item => item.courses.some(option => option.name.toLowerCase().includes('computer science'))));
  const city = await collegesApi.list({ ...query, search: 'mUmBaI' }, null);
  assert.ok(city.data.some(item => item.id === college.id));
});

test('degree and budget must match the same course', async () => {
  const result = await collegesApi.list({ ...query, degree: 'B.Tech', budget: 100000 }, null);
  assert.ok(result.data.every(item => item.courses.some(option => option.degree === 'B.Tech' && option.annualTuition !== null && option.annualTuition <= 100000)));
  assert.equal(result.data.some(item => item.id === college.id), false);
});

test('course search tuition is based on the searched course, not an unrelated cheaper course', async () => {
  const search = { ...query, search: 'computer science' };
  const matches = matchingCourses(college, search, null);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].name, 'B.Tech Computer Science');
  assert.equal(minimumTuition(matches), 220000);
  const result = await collegesApi.list({ ...search, budget: 100000 }, null);
  assert.equal(result.data.some(item => item.id === college.id), false);
});

test('pagination clamps out-of-range pages and preserves deterministic sorting', async () => {
  const last = await collegesApi.list({ ...query, page: 999 }, null);
  assert.equal(last.page, last.totalPages);
  const a = await collegesApi.list(query, null);
  const b = await collegesApi.list(query, null);
  assert.deepEqual(a.data.map(item => item.id), b.data.map(item => item.id));
  const empty = await collegesApi.list({ ...query, search: 'not-a-real-college' }, null);
  assert.equal(empty.total, 0);
});

test('strict requirements exclude mismatches and unknown tuition', () => {
  assert.equal(courseMatch(college, course, { ...preferences, states: ['Delhi'], strictLocation: true }), null);
  assert.equal(courseMatch(college, course, { ...preferences, budget: 0, strictBudget: true }), null);
  assert.equal(courseMatch(college, { ...course, annualTuition: null }, { ...preferences, budget: 500000, strictBudget: true }), null);
  const flexible = courseMatch(college, { ...course, annualTuition: null }, { ...preferences, budget: 500000 });
  assert.deepEqual(flexible?.reasons, []);
  assert.deepEqual(flexible?.mismatches, ['Tuition not available']);
});

test('matching gives concrete preference reasons', () => {
  const match = courseMatch(college, course, { ...preferences, degree: course.degree, states: [college.state], budget: course.annualTuition });
  assert.deepEqual(match?.reasons, [`Offers ${course.degree}`, 'In a preferred state', 'Within tuition budget']);
  assert.equal(match?.score, 3);
});

test('cost estimate includes full duration, one-time costs and partial years', () => {
  assert.deepEqual(estimateCost({ tuition: 100000, living: 60000, other: 10000, oneTime: 20000 }, 48), { total: 700000, complete: true });
  assert.deepEqual(estimateCost({ tuition: 100000, living: 0, other: 0, oneTime: 0 }, 66), { total: 550000, complete: true });
});

test('unknown inputs are partial while explicit zero is complete', () => {
  assert.deepEqual(estimateCost({ tuition: 0, living: 0, other: 0, oneTime: 0 }, 48), { total: 0, complete: true });
  assert.deepEqual(estimateCost({ tuition: 100000, living: null, other: null, oneTime: null }, 48), { total: 400000, complete: false });
  assert.equal(minimumTuition([{ ...course, annualTuition: null }, { ...course, annualTuition: 0 }]), 0);
  assert.equal(minimumTuition([{ ...course, annualTuition: null }]), null);
});

test('workspace identity distinguishes course options and college-only research', () => {
  const base = { collegeId: college.id, courseId: null };
  assert.notEqual(optionKey(base), optionKey({ ...base, courseId: course.id }));
  assert.notEqual(optionKey({ ...base, courseId: 'course-one' }), optionKey({ ...base, courseId: 'course-two' }));
});

test('CSV escapes quotes, commas and spreadsheet formulas', () => {
  assert.equal(csvCell('A "quote", and comma'), '"A ""quote"", and comma"');
  for (const input of ['=SUM(A1)', ' +123', '-1', '@cmd', '\t=1', '\r=1']) {
    assert.ok(csvCell(input).startsWith('"\''));
  }
  assert.equal(csvCell('Ordinary notes'), '"Ordinary notes"');
});

test('personal target dates compare calendar days, including month boundaries', () => {
  const now = new Date(2026, 9, 7, 23, 30);
  assert.equal(dateStatus('2026-10-06', now), 'overdue');
  assert.equal(dateStatus('2026-10-07', now), 'soon');
  assert.equal(dateStatus('2026-10-14', now), 'soon');
  assert.equal(dateStatus('2026-10-15', now), null);
  assert.equal(dateStatus('', now), null);
});
