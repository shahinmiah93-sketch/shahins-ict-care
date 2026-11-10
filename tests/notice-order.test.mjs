import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const a = source.indexOf('const activeNotices = '), b = source.indexOf('function parseBatchTime', a);
assert.ok(a > 0 && b > a, 'activeNotices must be present');

function run(notices) {
  const c = { db: { notices }, today: () => '2026-11-10' };
  vm.createContext(c); vm.runInContext(source.slice(a, b), c);
  return vm.runInContext('activeNotices', c)(false).map((n) => n.id);
}

test('Newest notice comes first, even when two notices have the same date', () => {
  const ids = run([
    { id: 'old', date: '2026-11-10', createdAt: '2026-11-10T06:00:00Z' },
    { id: 'new', date: '2026-11-10', createdAt: '2026-11-10T09:00:00Z' },
    { id: 'older', date: '2026-11-05', createdAt: '2026-11-05T09:00:00Z' },
  ]);
  assert.equal(JSON.stringify(ids), JSON.stringify(['new', 'old', 'older']));
});
test('"জরুরি — উপরে দেখান" notices stay on top, and old notices without createdAt still work', () => {
  const ids = run([
    { id: 'plain', date: '2026-11-10', createdAt: '2026-11-10T09:00:00Z' },
    { id: 'urgent', date: '2026-11-01', important: true, createdAt: '2026-11-01T09:00:00Z' },
    { id: 'legacy', date: '2026-11-10' },
  ]);
  assert.equal(JSON.stringify(ids), JSON.stringify(['urgent', 'plain', 'legacy']));
});
test('Expired notices are still hidden', () => {
  assert.equal(JSON.stringify(run([{ id: 'x', date: '2026-11-01', until: '2026-11-09' }])), '[]');
});
