import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const admin = fs.readFileSync(new URL('../public/js/admin.js', import.meta.url), 'utf8');

test('Payment form finds a student by ID, name or any of the four mobile numbers', () => {
  assert.match(admin, /label: "আইডি, নাম বা মোবাইল লিখুন"/);
  assert.match(admin, /\[x\.phone, x\.guardianPhone, x\.fatherPhone, x\.motherPhone\]\.some/);
  assert.match(admin, /dg\.length >= 3/);                                   // মোবাইলের অন্তত ৩ অঙ্ক
  assert.match(admin, /normQ\(t\)\.includes\(q\)/);                          // বাংলা / ইংরেজি অঙ্ক দুভাবেই নামে মেলে
  assert.match(admin, /exact\.length\) return exact/);                       // আইডি হুবহু মিললে একজনই
});
test('One match selects the student; several show a pick list; Enter takes the first', () => {
  assert.match(admin, /sel\.value = matches\.length === 1 \? matches\[0\]\.id : ""/);
  assert.match(admin, /data-pick=/);
  assert.match(admin, /matches\.length > 1 && !studentById\(sel\.value\)\) pick\(matches\[0\]\.id\)/);
});
