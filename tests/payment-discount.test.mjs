import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const a = source.indexOf('function feeSummary('), b = source.indexOf('\n}', a) + 2;
assert.ok(a > 0 && b > a, 'feeSummary must be present');

function summary(payments, due = 5000) {
  const c = { db: { enrollments: [{ id: 'e1', studentId: 's1', courseId: 'c1', status: 'active' }], courses: [{ id: 'c1', name: 'ICT' }], payments }, num: (v) => Number(v) || 0, enrollmentDue: () => ({ due }) };
  vm.createContext(c); vm.runInContext(source.slice(a, b), c);
  return c.feeSummary({ id: 's1' });
}

test('Discount lowers the dues but is not counted as cash received', () => {
  const f = summary([{ studentId: 's1', amount: 3000, discount: 500 }, { studentId: 's1', amount: 1000 }]);
  assert.equal(f.paid, 4000);        // নগদ জমা শুধু টাকার পরিমাণ
  assert.equal(f.discounts, 500);
  assert.equal(f.balance, 500);      // বকেয়া = ফি − জমা − ছাড়
});
test('Old payments without a discount field behave as before', () => {
  const f = summary([{ studentId: 's1', amount: 2000 }]);
  assert.deepEqual({ paid: f.paid, discounts: f.discounts, balance: f.balance }, { paid: 2000, discounts: 0, balance: 3000 });
  assert.equal(summary([{ studentId: 'someone-else', amount: 9999, discount: 9999 }]).balance, 5000);
});
test('A payment may be discount-only, but never empty; the field is cleaned on save', () => {
  assert.match(source, /discount: Math\.max\(0, num\(b\.discount\)\)/);
  assert.match(source, /clean\.amount > 0 \|\| \(clean\.amount === 0 && clean\.discount > 0\)/);
});
test('Screens, receipt, month coverage and Excel all know about the discount', () => {
  const admin = fs.readFileSync(new URL('../public/js/admin.js', import.meta.url), 'utf8');
  assert.match(admin, /name: "discount", label: "ছাড় \(টাকা\)/);
  assert.match(admin, /এছাড়া ছাড়: \$\{money\(p\.discount\)\}/);
  assert.match(admin, /let amt = \(x\.amount \|\| 0\) \+ \(x\.discount \|\| 0\)/);
  assert.match(admin, /discounts=mine\.reduce/);
  assert.match(admin, /"টাকা", "ছাড়", "নোট"/);
  assert.match(admin, /ছাড় বকেয়ার চেয়ে বেশি হতে পারে না/);
  const student = fs.readFileSync(new URL('../public/js/student.js', import.meta.url), 'utf8');
  assert.match(student, /f\.discounts > 0/);
});
