import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const a = source.indexOf('async function enrollmentDiscountAction('), b = source.indexOf('// Gallery bulk deletion', a);
assert.ok(a > 0 && b > a, 'enrollmentDiscountAction must be present');

function fixture() {
  const e = { id: 'e1', studentId: 's1', courseId: 'c1', fee: 1000, discount: 0 }, saved = [];
  const c = {
    crypto, JSON, Math, Date, Number, Promise, Object,
    db: { enrollments: [e], students: [{ id: 's1' }] },
    str: (v, n = 500) => String(v ?? '').slice(0, n), num: (v) => Number(v) || 0,
    readBody: async (r) => r.body, send: (_, status, data) => ({ status, data }),
    enrollmentDue: (x) => { const net = Math.max(0, x.fee - x.discount); return { due: net * 3, net, monthly: true }; }, // ৩ মাসের দেনা
    feeSummary: () => ({ balance: 2400, paid: 600 }),
    DB_FILE: 'db', BACKUPS: 'b', path: { join: (...p) => p.join('/') }, fs: { copyFileSync() {} }, saveDb: () => saved.push(JSON.stringify(e)), writeJsonAtomic() {},
  };
  vm.createContext(c); vm.runInContext(source.slice(a, b), c);
  return { c, e, saved };
}

test('50% of a 1000 monthly fee previews as 500 off, new dues and balance', async () => {
  const f = fixture(); const r = await f.c.enrollmentDiscountAction({ body: { id: 'e1', mode: 'percent', value: 50 } }, {});
  assert.equal(r.status, 200);
  assert.equal(r.data.proposed.discount, 500); assert.equal(r.data.proposed.percent, 50);
  assert.equal(r.data.proposed.net, 500); assert.equal(r.data.proposed.due, 1500);
  assert.equal(r.data.proposed.balance, 2400 - 3000 + 1500); // বকেয়া = আগের − আগের দেনা + নতুন দেনা
  assert.equal(f.e.discount, 0);                             // প্রিভিউতে কিছু বদলায় না
});
test('Taka amount works, is capped at the fee, and bad input is refused', async () => {
  const f = fixture();
  assert.equal((await f.c.enrollmentDiscountAction({ body: { id: 'e1', mode: 'taka', value: 300 } }, {})).data.proposed.discount, 300);
  assert.equal((await f.c.enrollmentDiscountAction({ body: { id: 'e1', mode: 'taka', value: 99999 } }, {})).data.proposed.discount, 1000);
  assert.equal((await f.c.enrollmentDiscountAction({ body: { id: 'e1', mode: 'percent', value: 150 } }, {})).status, 400);
  assert.equal((await f.c.enrollmentDiscountAction({ body: { id: 'e1', mode: 'taka', value: -5 } }, {})).status, 400);
  assert.equal((await f.c.enrollmentDiscountAction({ body: { id: 'nope', mode: 'taka', value: 1 } }, {})).status, 404);
});
test('Saving needs the matching preview token and records the change', async () => {
  const f = fixture(); const body = { id: 'e1', mode: 'percent', value: 50 };
  const prev = (await f.c.enrollmentDiscountAction({ body }, {})).data;
  assert.equal((await f.c.enrollmentDiscountAction({ body: { ...body, commit: true, token: 'wrong' } }, {})).status, 409);
  assert.equal(f.e.discount, 0);
  const ok = await f.c.enrollmentDiscountAction({ body: { ...body, commit: true, token: prev.token } }, {});
  assert.equal(ok.status, 200); assert.equal(f.e.discount, 500);
  assert.equal(JSON.stringify(f.e.discountHistory.map((h) => [h.from, h.to])), '[[0,500]]');
  assert.equal(f.saved.length, 1);
});
test('Screens: change button in the fee table, preview form, percent box in admission form', () => {
  const admin = fs.readFileSync(new URL('../public/js/admin.js', import.meta.url), 'utf8');
  assert.match(admin, /data-disc="\$\{it\.enrollmentId\}">ছাড় বদলান/);
  assert.match(admin, /function editEnrollmentDiscount\(student, enrollmentId, after\)/);
  assert.match(admin, /\/api\/admin\/enrollment-discount/);
  assert.match(admin, /name="discountPct"/);
  assert.match(admin, /data-disc-edit="\$\{esc\(e\.id\)\}">ছাড় বদলান/);                    // তথ্য সম্পাদনার পাতার মডিউলের পাশে
  assert.match(admin, /editEnrollmentDiscount\(s, b\.dataset\.discEdit, \(\) => route\(\)\)/);   // সেভের পর ওই পাতাতেই থাকে
  assert.match(source, /p === "\/api\/admin\/enrollment-discount" && m === "POST"/);
});
