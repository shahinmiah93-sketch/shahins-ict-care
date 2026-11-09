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

test('A student gets his own fixed monthly fee (700) from joining date; locked, with the old fee kept for going back', async () => {
  const f = fixture(); const body = { id: 'e1', fee: 700, value: null };
  const r = await f.c.enrollmentDiscountAction({ body }, {});
  assert.equal(r.status, 200); assert.equal(r.data.proposed.fee, 700); assert.equal(r.data.proposed.feeChanged, true); assert.equal(r.data.proposed.locked, true);
  assert.equal(r.data.proposed.due, 2100); assert.equal(r.data.proposed.net, 700);                     // ৩ মাস × ৭০০
  assert.equal(f.e.fee, 1000);                                                                         // প্রিভিউতে কিছু বদলায় না
  const ok = await f.c.enrollmentDiscountAction({ body: { ...body, commit: true, token: r.data.token } }, {});
  assert.equal(ok.status, 200); assert.equal(f.e.fee, 700); assert.equal(f.e.feeLocked, true); assert.equal(f.e.feeBefore, 1000);
});
test('Going back restores the previous fee and unlocks; unchanged fee is not a change', async () => {
  const f = fixture(); f.e.fee = 700; f.e.feeLocked = true; f.e.feeBefore = 1000;
  const r = await f.c.enrollmentDiscountAction({ body: { id: 'e1', fee: 700, feeReset: true, value: null } }, {});
  assert.equal(r.data.proposed.fee, 1000); assert.equal(r.data.proposed.locked, false);
  await f.c.enrollmentDiscountAction({ body: { id: 'e1', fee: 700, feeReset: true, value: null, commit: true, token: r.data.token } }, {});
  assert.equal(f.e.fee, 1000); assert.equal(f.e.feeLocked, undefined); assert.equal(f.e.feeBefore, undefined);
  const g = fixture(); assert.equal((await g.c.enrollmentDiscountAction({ body: { id: 'e1', fee: 1000, value: null } }, {})).data.proposed.feeChanged, false);
});
test('Fee and discount together; discount never exceeds the new fee; bad fee refused', async () => {
  const f = fixture();
  const r = await f.c.enrollmentDiscountAction({ body: { id: 'e1', fee: 800, mode: 'percent', value: 50 } }, {});
  assert.equal(r.data.proposed.discount, 400); assert.equal(r.data.proposed.net, 400);                // ছাড় নতুন ফি-র ওপর
  f.e.discount = 900; assert.equal((await f.c.enrollmentDiscountAction({ body: { id: 'e1', fee: 500, value: null } }, {})).data.proposed.discount, 500);
  assert.equal((await f.c.enrollmentDiscountAction({ body: { id: 'e1', fee: -1, value: null } }, {})).status, 400);
  assert.equal((await f.c.enrollmentDiscountAction({ body: { id: 'e1', fee: 'abc', value: null } }, {})).status, 400);
});
test('Own fee bypasses the module month-wise fee list; shown on screens', () => {
  assert.match(source, /const rule = enrollment\.feeLocked \? null : \(course\.monthlyFees/);
  assert.match(source, /feeLocked: !!e\.feeLocked, discount: e\.discount/);
  const admin = fs.readFileSync(new URL('../public/js/admin.js', import.meta.url), 'utf8'), student = fs.readFileSync(new URL('../public/js/student.js', import.meta.url), 'utf8');
  assert.match(admin, /id="feeVal"/); assert.match(admin, /id="feeReset"/); assert.match(admin, /এই শিক্ষার্থীর নির্ধারিত<\/small>/);
  assert.match(student, /i\.feeLocked \? "আপনার নির্ধারিত ফি" : "মূল ফি"/);
});

test('50% means half of each month\'s real fee (incl. the module month-wise fee list): 800/month → 400, not 800-500=300', () => {
  const a2 = source.indexOf('function monthlyFeeFor('), b2 = source.indexOf('\n}', a2) + 2;
  const c2 = { Math, Number }; c2.num = (v) => Number(v) || 0; vm.createContext(c2); vm.runInContext(source.slice(a2, b2), c2);
  const fee = vm.runInContext('monthlyFeeFor', c2), course = { monthlyFees: [{ from: '2026-09', to: '', fee: 800 }] };
  assert.equal(fee(course, { fee: 1000, discount: 500, discountPct: 50 }, '2026-10'), 400);       // শতাংশ: প্রতি মাসের আসল ফি-র অর্ধেক
  assert.equal(fee(course, { fee: 1000, discount: 500 }, '2026-10'), 300);                          // টাকার ছাড়: আগের মতো ঠিক ৫০০ বাদ
  assert.equal(fee({}, { fee: 1000, discount: 500, discountPct: 50 }, '2026-10'), 500);            // তালিকা না থাকলে ফি-র অর্ধেক
  assert.equal(fee(course, { fee: 700, feeLocked: true, discount: 0 }, '2026-10'), 700);           // নিজস্ব ফি হলে তালিকা এড়ায়
  assert.equal(fee(course, { fee: 700, feeLocked: true, discount: 350, discountPct: 50 }, '2026-10'), 350);
});
test('Percent is stored as a percent on the enrollment (and cleared when a taka discount is set); empty box keeps it', async () => {
  const f = fixture(); const body = { id: 'e1', mode: 'percent', value: 50 };
  const r = await f.c.enrollmentDiscountAction({ body }, {}); assert.equal(r.data.proposed.pct, 50);
  await f.c.enrollmentDiscountAction({ body: { ...body, commit: true, token: r.data.token } }, {});
  assert.equal(f.e.discountPct, 50); assert.equal(f.e.discount, 500);
  const keep = await f.c.enrollmentDiscountAction({ body: { id: 'e1', fee: 800, value: null } }, {});          // ফি বদলালে শতাংশ নতুন ফি-র ওপর
  assert.equal(keep.data.proposed.pct, 50); assert.equal(keep.data.proposed.discount, 400);
  const t = await f.c.enrollmentDiscountAction({ body: { id: 'e1', mode: 'taka', value: 300 } }, {});
  await f.c.enrollmentDiscountAction({ body: { id: 'e1', mode: 'taka', value: 300, commit: true, token: t.data.token } }, {});
  assert.equal(f.e.discountPct, undefined); assert.equal(f.e.discount, 300);
});
test('Screens show a percent discount as a percent', () => {
  const admin = fs.readFileSync(new URL('../public/js/admin.js', import.meta.url), 'utf8'), student = fs.readFileSync(new URL('../public/js/student.js', import.meta.url), 'utf8'), common = fs.readFileSync(new URL('../public/js/common.js', import.meta.url), 'utf8');
  assert.match(admin, /প্রতি মাসের ফি-র <b>\$\{bn\(p\.pct\)\}%<\/b>/);
  assert.match(admin, /it\.discountPct \? `\$\{bn\(it\.discountPct\)\}%<small>/);
  assert.match(student, /i\.discountPct \? `<span>/);
  assert.match(common, /enrollment\.feeLocked \? null/); assert.match(common, /enrollment\.discountPct/);
});
