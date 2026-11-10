import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const a = source.indexOf('function validateEnrollment('), b = source.indexOf('// ---------- মেয়াদ', a);
assert.ok(a > 0 && b > a, 'validateEnrollment must be present');

const ctx = () => {
  const c = {
    Math, Number, Array, Set, String,
    db: { courses: [{ id: 'c1', feeType: 'monthly', fee: 1000, chapters: [] }] },
    str: (v, n = 500) => String(v ?? '').slice(0, n), num: (v) => Number(v) || 0,
    moduleFee: (course) => course.fee,
  };
  vm.createContext(c); vm.runInContext(source.slice(a, b), c);
  return c;
};

test('Admission with a percent discount stores the percent (of each real monthly fee), not a fixed taka cut', () => {
  const v = ctx().validateEnrollment({ courseId: 'c1', discount: 77, discountPct: 50 });
  assert.equal(v.pct, 50); assert.equal(v.discount, 500);
});
test('Admission with a taka discount has no percent and is capped at the fee', () => {
  const c = ctx();
  const v = c.validateEnrollment({ courseId: 'c1', discount: 300 });
  assert.equal(v.pct, undefined); assert.equal(v.discount, 300);
  assert.equal(c.validateEnrollment({ courseId: 'c1', discount: 99999 }).discount, 1000);
  assert.equal(c.validateEnrollment({ courseId: 'c1', discountPct: 250 }).pct, 100);
});
test('createEnrollment keeps discountPct and the admin form sends it', () => {
  assert.match(source, /\.\.\.\(v\.pct > 0 \? \{ discountPct: v\.pct \} : \{\}\)/);
  const admin = fs.readFileSync(new URL('../public/js/admin.js', import.meta.url), 'utf8');
  assert.match(admin, /discountPct: k\.pct \|\| 0/);
  assert.match(admin, /U\.monthlyFeeFor\(m, \{ fee, discount, discountPct: pct \}/);
});
test('Marking one student present/absent is refused on a closed day and keeps others untouched', () => {
  const i = source.indexOf('/api/admin/attendance-one');
  const block = source.slice(i, source.indexOf('/api/admin/login-sms', i));
  assert.match(block, /closures/);
  assert.match(block, /\.\.\.\(db\.attendance\[key\] \|\| \{\}\)/);
});
