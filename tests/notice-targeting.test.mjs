import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const start = source.indexOf('  notices: (b) => {'), end = source.indexOf('  teachers: (b) =>');
assert.ok(start > 0 && end > start, 'notices schema must be present');
const c = { db: { batches: [{ id: 'b1' }, { id: 'b2' }], sessions: [{ name: 'HSC-28' }, { name: 'HSC-27' }] }, today: () => '2026-11-07', str: (v, n = 500) => String(v ?? '').trim().slice(0, n) };
vm.createContext(c);
const rawSchema = vm.runInContext('({' + source.slice(start, end) + '})', c).notices;
const schema = (b) => JSON.parse(JSON.stringify(rawSchema(b))); // vm-এর আলাদা Array থেকে সাধারণ অবজেক্ট

test('Notice without targets goes to everyone and keeps the public flag', () => {
  const n = schema({ title: 'T', public: true });
  assert.deepEqual([n.batchIds, n.sessions, n.public], [[], [], true]);
});
test('Targeted notices keep only real batches / sessions and never go public', () => {
  const n = schema({ title: 'T', public: true, batchIds: ['b1', 'b1', 'ghost'], sessions: ['HSC-28', 'nope'] });
  assert.deepEqual(n.batchIds, ['b1']);
  assert.deepEqual(n.sessions, ['HSC-28']);
  assert.equal(n.public, false);
});
test('Bad target values are ignored', () => {
  const n = schema({ title: 'T', batchIds: 'b1', sessions: null });
  assert.deepEqual([n.batchIds, n.sessions], [[], []]);
});
test('Student route filters notices by batch, session or student', () => {
  const m = source.match(/notices: activeNotices\(false\)\.filter\(\(n\) => (.+?)\),\r?\n/);
  assert.ok(m, 'student notice filter must be present');
  const keep = vm.runInContext('(n, s) => ' + m[1], vm.createContext({}));
  const s = { id: '280001', batchId: 'b1', session: 'HSC-28' };
  assert.equal(keep({}, s), true);
  assert.equal(keep({ batchIds: ['b1'] }, s), true);
  assert.equal(keep({ batchIds: ['b2'] }, s), false);
  assert.equal(keep({ sessions: ['HSC-28'] }, s), true);
  assert.equal(keep({ sessions: ['HSC-27'] }, s), false);
  assert.equal(keep({ sessions: ['HSC-27'], batchIds: ['b1'] }, s), true);
  assert.equal(keep({ studentIds: ['280001'] }, s), true);
  assert.equal(keep({ studentIds: ['280002'] }, s), false);
});
