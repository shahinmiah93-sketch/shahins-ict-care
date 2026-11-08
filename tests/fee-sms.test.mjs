import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const a = source.indexOf('const FEE_FROM'), b = source.indexOf('const feeTick', a);
assert.ok(a > 0 && b > a, 'monthly dues SMS block must be present');

// ১ তারিখের বকেয়ার SMS: যেকোনো মডিউলে বকেয়া থাকলেই যায় (শুধু মাসিক মডিউলে নয়)
function app({ day = 1, hour = 11, students, balances }) {
  const sent = [];
  class FixedDate extends Date { constructor(...args) { if (args.length) super(...args); else super(2026, 11, day, hour, 0, 0); } }
  const ctx = {
    Date: FixedDate, console, Number, Set,
    db: { students, feeSent: {} }, // enrollments / courses ইচ্ছে করেই নেই — মডিউলের ধরন আর দেখা হয় না
    today: () => `2026-12-${String(day).padStart(2, '0')}`, smsOn: () => true,
    feeSummary: (s) => ({ balance: balances[s.id] || 0 }),
    phoneOf: (v) => String(v || '').replace(/\D/g, ''),
    sendSms: async (phone, text, log, tag) => { sent.push({ phone, text, log, tag }); },
    saveDb: () => {},
  };
  vm.createContext(ctx);
  vm.runInContext(source.slice(a, b), ctx);
  return { run: () => ctx.sendFeeDue(), sent };
}
const students = [
  { id: 'one-time', name: 'এককালীন কোর্সের শিক্ষার্থী', phone: '01700000001', guardianPhone: '01800000001', status: 'active' },
  { id: 'monthly', name: 'মাসিক ব্যাচের শিক্ষার্থী', phone: '01700000002', guardianPhone: '01800000002', status: 'active' },
  { id: 'clear', name: 'বকেয়া নেই', phone: '01700000003', guardianPhone: '01800000003', status: 'active' },
  { id: 'off', name: 'পড়া বন্ধ', phone: '01700000004', guardianPhone: '01800000004', status: 'inactive' },
  { id: 'nophone', name: 'নম্বর নেই', phone: '', guardianPhone: '', status: 'active' },
];
const balances = { 'one-time': 5000, monthly: 1500, clear: 0, off: 900, nophone: 700 };

test('Any student with dues gets the SMS on the 1st — student and guardian numbers — whatever the module type', async () => {
  const t = app({ students, balances }); await t.run();
  assert.deepEqual(t.sent.map((x) => x.phone).sort(), ['01700000001', '01700000002', '01800000001', '01800000002']);
  assert.ok(t.sent.every((x) => x.tag === 'Fee'));
  const one = t.sent.find((x) => x.phone === '01800000001');
  assert.match(one.text, /এককালীন কোর্সের শিক্ষার্থী-এর বেতন বাবদ মোট ৫,০০০ টাকা বকেয়া রয়েছে/);
});
test('No dues, inactive students and students without numbers get nothing', async () => {
  const t = app({ students, balances }); await t.run();
  for (const p of ['01700000003', '01800000003', '01700000004', '01800000004']) assert.ok(!t.sent.some((x) => x.phone === p), p);
  assert.equal(t.sent.length, 4);
});
test('Only once a month and only on the 1st between 10:00 and 22:00', async () => {
  const t = app({ students, balances }); await t.run(); await t.run();
  assert.equal(t.sent.length, 4); // দ্বিতীয়বার চালালে আর যায় না
  const other = app({ day: 2, students, balances }); await other.run(); assert.equal(other.sent.length, 0);
  const early = app({ hour: 9, students, balances }); await early.run(); assert.equal(early.sent.length, 0);
  const late = app({ hour: 22, students, balances }); await late.run(); assert.equal(late.sent.length, 0);
});
