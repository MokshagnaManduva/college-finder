import test from 'node:test';
import assert from 'node:assert/strict';
import { demoColleges, fromWire, patchToWire, toWire } from '../src/api/index.ts';
import { validateGuest, canonicalOption } from '../src/state/guestStorage.ts';
import { safeReturnPath } from '../src/domain/session.ts';
import { APIError, currentToken, request, SESSION_EVENT, storeToken } from '../src/api/client.ts';

test('legacy college/course IDs migrate without losing guest notes', () => {
  const college = demoColleges.find(item => item.slug === 'iit-bombay')!;
  const old = { version: 1, entries: [{
    id: 'bc3c69c9-8b90-4717-8c0e-d052d7919a48', collegeId: 'iit-bombay', courseId: 'iit-bombay-1',
    notes: 'Keep these notes', nextAction: 'Check eligibility', stage: 'Shortlisted',
    targetDate: '', createdAt: new Date().toISOString(),
  }], compare: [{ collegeId: 'iit-bombay', courseId: 'iit-bombay-1' }] };
  const migrated = validateGuest(old)!;
  assert.equal(migrated.entries[0].collegeId, college.id);
  assert.equal(migrated.entries[0].courseId, college.courses[0].id);
  assert.equal(migrated.entries[0].notes, 'Keep these notes');
  assert.equal(migrated.entries[0].stage, 'Shortlisted');
  assert.deepEqual(migrated.compare[0], canonicalOption(old.compare[0]));
});

test('invalid stored scenarios are removed while notes are preserved', () => {
  const college = demoColleges[0];
  const parsed = validateGuest({ version: 1, entries: [{
    id: 'bc3c69c9-8b90-4717-8c0e-d052d7919a48', collegeId: college.id, courseId: null,
    notes: 'Recover me', nextAction: '', stage: 'Researching', targetDate: '',
    createdAt: new Date().toISOString(), scenario: {tuition: -1, living: 0, other: 0, oneTime: 0},
  }] })!;
  assert.equal(parsed.entries[0].notes, 'Recover me');
  assert.equal(parsed.entries[0].scenario, undefined);
});

test('auth return paths stay inside the application', () => {
  for (const unsafe of ['https://evil.example', '//evil.example', '/\\evil.example', '/login',
    '/register', '/admin', '/explore\nbad']) assert.equal(safeReturnPath(unsafe), '/workspace');
  assert.equal(safeReturnPath('/explore?degree=B.Tech'), '/explore?degree=B.Tech');
  assert.equal(safeReturnPath('/colleges/iit-bombay'), '/colleges/iit-bombay');
});

test('workspace wire conversion keeps null dates and zero amounts distinct', () => {
  const body = toWire({collegeId: demoColleges[0].id, courseId: null, targetDate: '',
    scenario: {tuition: 0, living: null, other: 0, oneTime: 0}});
  assert.equal(body.targetDate, null);
  assert.deepEqual(body.scenario, {tuition: 0, living: null, other: 0, oneTime: 0});
  const restored = fromWire({id: 'test', collegeId: demoColleges[0].id, courseId: null,
    stage: 'Researching', notes: '', nextAction: '', targetDate: null,
    scenario: null, createdAt: ''});
  assert.equal(restored.targetDate, '');
  assert.equal(restored.scenario, undefined);
});

test('resolving a guest conflict cannot send immutable option identities in a patch', () => {
  const patch = patchToWire({collegeId: demoColleges[0].id, courseId: null,
    notes: 'My browser version', targetDate: ''}, 3);
  assert.deepEqual(patch, {notes: 'My browser version', targetDate: null, revision: 3});
});

test('validation arrays and revision conflicts produce readable API errors', () => {
  assert.equal(new APIError(422, [{msg: 'Invalid email'}, {msg: 'Password too short'}]).message,
    'Invalid email. Password too short');
  const error = new APIError(409, {message: 'Review the latest version', current: {revision: 2}});
  assert.equal(error.message, 'Review the latest version');
  assert.equal(error.current?.revision, 2);
});

test('an authenticated 401 clears the token and announces the session change', async t => {
  const browser = new EventTarget();
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {value: browser, configurable: true});
  Object.defineProperty(globalThis, 'localStorage', {value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }, configurable: true});
  let events = 0;
  browser.addEventListener(SESSION_EVENT, () => events++);
  t.mock.method(globalThis, 'fetch', async () => new Response(
    JSON.stringify({detail: 'Expired token'}), {status: 401, headers: {'Content-Type': 'application/json'}},
  ));
  try {
    storeToken('test-token');
    await assert.rejects(request('/workspace'), /Expired token/);
    assert.equal(currentToken(), null);
    assert.equal(events, 1);
    assert.equal(values.size, 0);
    storeToken('still-signed-in');
    await assert.rejects(request('/auth/login', {method: 'POST', token: null}), /Expired token/);
    assert.equal(currentToken(), 'still-signed-in');
    assert.equal(events, 1);
  } finally {
    storeToken(null);
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('import replay preserves notes edited after the saved snapshot', async () => {
  const {importSnapshot, reconcileImport} = await import('../src/domain/sync.ts');
  const original = {
    id: 'bc3c69c9-8b90-4717-8c0e-d052d7919a48', collegeId: demoColleges[0].id, courseId: null,
    stage: 'Researching' as const, notes: 'Original notes', nextAction: '', targetDate: '', createdAt: '',
  };
  const pending = importSnapshot([original], 'key');
  const edited = {...original, notes: 'New notes while offline'};
  const result = {imported: [{clientId: original.id, entryId: 'server-id'}], conflicts: []};
  assert.deepEqual(reconcileImport([edited], pending, result).remaining, [edited]);
  assert.deepEqual(reconcileImport([original], pending, result).remaining, []);
});

test('import replay retains newly added options and ignores superseded conflicts', async () => {
  const {importSnapshot, reconcileImport} = await import('../src/domain/sync.ts');
  const original = {
    id: 'bc3c69c9-8b90-4717-8c0e-d052d7919a48', collegeId: demoColleges[0].id, courseId: null,
    stage: 'Researching' as const, notes: 'Original', nextAction: '', targetDate: '', createdAt: '',
  };
  const added = {...original, id: '0d71d1a8-9a65-42dd-981b-4be970d74de0', collegeId: demoColleges[1].id};
  const pending = importSnapshot([original], 'key');
  const updated = {...original, notes: 'Latest guest version'};
  const result = {imported: [], conflicts: [{clientId: original.id, guest: original, account: original}]};
  const reconciled = reconcileImport([updated, added], pending, result);
  assert.deepEqual(reconciled.remaining, [updated, added]);
  assert.deepEqual(reconciled.conflicts, []);
});

test('preference comparison ignores state selection order and snapshot requests are bounded', async () => {
  const {samePreferences, importSnapshot} = await import('../src/domain/sync.ts');
  const p = {degree: 'B.Tech', states: ['Delhi', 'Maharashtra'], budget: 0, strictBudget: true, strictLocation: false};
  assert.equal(samePreferences(p, {...p, states: [...p.states].reverse()}), true);
  assert.equal(samePreferences(p, {...p, budget: null}), false);
  const entries = Array.from({length: 205}, (_, index) => ({
    id: String(index), collegeId: demoColleges[0].id, courseId: null, stage: 'Researching' as const,
    notes: '', nextAction: '', targetDate: '', createdAt: '',
  }));
  assert.equal(importSnapshot(entries, 'key').entries.length, 200);
});
