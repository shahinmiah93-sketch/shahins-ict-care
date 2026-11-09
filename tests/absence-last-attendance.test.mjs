import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src = fs.readFileSync(new URL('../public/js/admin-absence.js', import.meta.url), 'utf8');
const a = src.indexOf('  const lastSaved = '), b = src.indexOf('  const pendingCount');
assert.ok(a > 0 && b > a, 'lastSaved / lastRows block must be present');

// lastSaved ও lastRows কে নকল ডেটায় চালানো
function app(attendance, absentByDate = {}) {
  const c = { Object, DB: () => ({ attendance }), unsavedBatches: () => [{ id: 'B1' }], absentRows: (d) => (absentByDate[d] || []).map((s) => ({ s, key: `${d}|${s.id}`, date: d })) };
  vm.createContext(c); vm.runInContext(src.slice(a, b), c);
  return { lastSaved: vm.runInContext('lastSaved', c), lastRows: vm.runInContext('lastRows', c) }; // const সরাসরি context-এর property নয়
}

test('Last saved attendance of a batch is the newest saved date before the selected day', () => {
  const c = app({ '2026-11-02|B1': { s1: 'P' }, '2026-11-07|B1': { s1: 'A' }, '2026-11-09|B1': { s1: 'P' }, '2026-11-08|B2': { s9: 'A' }, '2026-11-05|B1': {} });
  assert.equal(c.lastSaved('B1', '2026-11-09'), '2026-11-07');   // ৯ তারিখের আগের সর্বশেষ; অন্য ব্যাচ ও ফাঁকা হাজিরা ধরা হয় না
  assert.equal(c.lastSaved('B1', '2026-11-02'), '');
  assert.equal(c.lastSaved('B3', '2026-11-09'), '');
});
test('Unsaved batch shows the absentees of its last saved attendance, marked as such', () => {
  const c = app({ '2026-11-07|B1': { s1: 'A' } }, { '2026-11-07': [{ id: 's1', batchId: 'B1' }, { id: 's2', batchId: 'B9' }] });
  const rows = c.lastRows('2026-11-09');
  assert.equal(rows.length, 1);                                   // অন্য ব্যাচের জন বাদ
  assert.equal(rows[0].s.id, 's1'); assert.equal(rows[0].date, '2026-11-07'); assert.equal(rows[0].last, true);
});
test('Screen text: info note, batch heading date, row chip, de-duplicated with follow-ups, badge counts them', () => {
  assert.match(src, /সর্বশেষ সেভ করা হাজিরার<\/b> অনুপস্থিতি দেখানো হচ্ছে/);
  assert.match(src, /ab-lastd">· সর্বশেষ হাজিরা:/);
  assert.match(src, /সর্বশেষ হাজিরা \(\$\{esc\(U\.date\(date\)\)\}\)-এর অনুপস্থিতি/);
  assert.match(src, /lastRows\(S\.date\)\.filter\(\(r\) => !folKeys\.has\(r\.key\)\)/);
  assert.match(src, /pendingCount = \(date\) => \[\.\.\.absentRows\(date\), \.\.\.lastRows\(date\)\]/);
  assert.match(src, /আগের কোনো হাজিরাও নেই/);               // একদম আগের হাজিরা না থাকলে পুরোনো সতর্কতা
});
