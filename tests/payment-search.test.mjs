import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const admin = fs.readFileSync(new URL('../public/js/admin.js', import.meta.url), 'utf8');
const searchSrc = fs.readFileSync(new URL('../public/js/student-search.js', import.meta.url), 'utf8');

// সাধারণ খোঁজার মডিউল (পেমেন্ট ফর্ম, হাজিরা, শিক্ষার্থী তালিকা — সবাই এটাই ব্যবহার করে) আসলে চালিয়ে দেখা
const win = {}; vm.runInNewContext(searchSrc, { window: win, String, RegExp });
const S = win.SICStudentSearch;
const stu = { id: '280060', name: 'আদিবা', nameEn: 'Adiba Rahman', phone: '01711111111', phone2: '01722222222', whatsapp: '01733333333', guardianPhone: '01744444444', fatherPhone: '01755555555', motherPhone: '01766666666', refPhone: '01799999999' };

test('Payment form finds a student by ID, name (Bangla or English) or any contact number', () => {
  assert.match(admin, /label: "আইডি, নাম বা মোবাইল লিখুন"/);
  assert.match(admin, /pool\.filter\(x => window\.SICStudentSearch\.match\(x, q\)\)/);   // ফর্ম সাধারণ মডিউলই ব্যবহার করে
  assert.match(admin, /exact\.length\) return exact/);                                     // আইডি হুবহু মিললে একজনই
  for (const q of ['280060', 'আদিবা', 'adiba', 'ADIBA rahman']) assert.ok(S.match(stu, q), q);
  for (const q of ['01711111111', '01722222222', '01733333333', '01744444444', '01755555555', '01766666666']) assert.ok(S.match(stu, q), q); // নিজের / ২য় / WhatsApp / অভিভাবক / বাবা / মা
  assert.ok(S.match(stu, '০১৭৪৪৪৪৪৪৪৪'), 'বাংলা অঙ্কে মোবাইল');
  assert.ok(S.match(stu, '+8801755555555'), '+৮৮ সহ মোবাইল');
});
test('Reference contacts and unrelated text never match', () => {
  assert.equal(S.match(stu, '01799999999'), false);   // রেফারেন্সের নম্বর খোঁজায় ধরা হয় না
  assert.equal(S.match(stu, 'রহিম'), false);
  assert.equal(S.match(stu, '280061'), false);
});
test('Once a student is found, the name is shown big in a highlighted card (tick, name, ID · batch, dues)', () => {
  assert.match(admin, /<div class="pay-who"><span class="pay-tick" aria-hidden="true">✓<\/span><b>\$\{esc\(s\.name\)\}\$\{s\.status === "inactive" \? " · নিষ্ক্রিয়" : ""\}<\/b>/);
  assert.match(admin, /id="payInfo" class="wide"/);
  assert.match(admin, /<span class="pay-due bad">বকেয়া <b>\$\{money\(bal\)\}<\/b><\/span>/);        // বকেয়া বড় লাল ব্যাজে
  assert.match(admin, /<span class="pay-due ok">অগ্রিম/); assert.match(admin, /<span class="pay-due ok">বকেয়া নেই<\/span>/);
});
test('One match selects the student; several show a pick list; Enter takes the first', () => {
  assert.match(admin, /sel\.value = matches\.length === 1 \? matches\[0\]\.id : ""/);
  assert.match(admin, /data-pick=/);
  assert.match(admin, /matches\.length > 1 && !studentById\(sel\.value\)\) pick\(matches\[0\]\.id\)/);
});
