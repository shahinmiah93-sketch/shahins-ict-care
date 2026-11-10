import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const a = source.indexOf('const PAY_EDIT_FIELDS'), b = source.indexOf('// Gallery bulk deletion', a);
assert.ok(a > 0 && b > a, 'paymentEditAction must be present');

function fixture() {
  const p = { id: 'p1', studentId: 's1', enrollmentId: 'e1', receiptNo: 1100, amount: 1600, discount: 0, month: '2026-11', method: 'নগদ', date: '2026-11-10', note: '' };
  const backups = [], saved = [];
  const c = {
    crypto, JSON, Math, Date, Number, Promise, Object, Array, String, Boolean,
    db: { payments: [p], students: [{ id: 's1', name: 'শশী' }] },
    str: (v, n = 500) => String(v ?? '').trim().slice(0, n), num: (v) => Number(v) || 0,
    readBody: async (r) => r.body, send: (_, status, data) => ({ status, data }),
    feeSummary: () => ({ balance: 0 }),             // ১৬০০ দেওয়ায় বকেয়া ০ ছিল
    DB_FILE: 'db', BACKUPS: 'b', path: { join: (...x) => x.join('/') }, fs: { copyFileSync: (...x) => backups.push(x) },
    saveDb: () => saved.push(JSON.stringify(p)), writeJsonAtomic() {},
  };
  vm.createContext(c); vm.runInContext(source.slice(a, b), c);
  return { c, p, backups, saved };
}
const run = (f, body) => f.c.paymentEditAction({ body }, {});

test('Preview of 1600 -> 1300 shows the change and the new dues, and changes nothing', async () => {
  const f = fixture(); const r = await run(f, { id: 'p1', amount: 1300 });
  assert.equal(r.status, 200);
  assert.equal(JSON.stringify(r.data.changed), JSON.stringify(['amount']));
  assert.equal(r.data.balance.before, 0); assert.equal(r.data.balance.after, 300); // ৩০০ বকেয়া ফিরে আসে
  assert.equal(f.p.amount, 1600); assert.equal(f.saved.length, 0);
});
test('Saving needs the matching token and a reason, keeps the receipt number, backs up and records history', async () => {
  const f = fixture(); const body = { id: 'p1', amount: 1300 };
  const prev = (await run(f, body)).data;
  assert.equal((await run(f, { ...body, commit: true, token: 'bad', reason: 'x' })).status, 409);
  assert.equal((await run(f, { ...body, commit: true, token: prev.token, reason: '' })).status, 400);
  assert.equal(f.p.amount, 1600);
  const r = await run(f, { ...body, commit: true, token: prev.token, reason: 'ভুল অঙ্ক লেখা হয়েছিল' });
  assert.equal(r.status, 200);
  assert.equal(f.p.amount, 1300); assert.equal(f.p.receiptNo, 1100); assert.equal(f.p.edited, true);
  assert.equal(f.p.editHistory.length, 1);
  assert.equal(f.p.editHistory[0].from.amount, 1600); assert.equal(f.p.editHistory[0].to.amount, 1300);
  assert.equal(f.p.editHistory[0].reason, 'ভুল অঙ্ক লেখা হয়েছিল');
  assert.equal(f.backups.length, 1);
});
test('Unchanged edits, bad amounts and unknown payments are refused', async () => {
  const f = fixture();
  const same = (await run(f, { id: 'p1', amount: 1600 })).data;
  assert.equal(same.changed.length, 0);
  assert.equal((await run(f, { id: 'p1', amount: 1600, commit: true, token: same.token, reason: 'কিছু' })).status, 400);
  assert.equal((await run(f, { id: 'p1', amount: 'abc' })).status, 400);
  assert.equal((await run(f, { id: 'p1', amount: -5 })).status, 400);
  assert.equal((await run(f, { id: 'p1', amount: 0, discount: 0 })).status, 400);
  assert.equal((await run(f, { id: 'nope', amount: 10 })).status, 404);
});
test('The generic update route no longer silently overwrites a payment, and the UI wires the edit button', () => {
  assert.match(source, /if \(col === "payments"\) \{\s*if \(id\) return send\(res, 400/);
  assert.match(source, /\/api\/admin\/payment-edit/);
  const admin = fs.readFileSync(new URL('../public/js/admin.js', import.meta.url), 'utf8');
  assert.match(admin, /data-pedit="\$\{p\.id\}"/);
  assert.match(admin, /editPayment\(DB\.payments\.find/);
  assert.match(admin, /সংশোধিত রসিদ/);
});
