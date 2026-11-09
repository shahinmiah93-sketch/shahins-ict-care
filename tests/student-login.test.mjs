import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const enLine = source.slice(source.indexOf('const enDigits = '), source.indexOf('\n', source.indexOf('const enDigits = ')));
const a = source.indexOf('const loginText = '), b = source.indexOf('async function api(req, res, url) {');
assert.ok(a > 0 && b > a, 'student login helper must be present');
const ctx = { String, db: { students: [{ id: '280087', pin: '4821', status: 'active' }, { id: 'S1', pin: '0007' }] } };
vm.createContext(ctx); vm.runInContext(enLine + '\n' + source.slice(a, b), ctx);
const find = (id, pin) => vm.runInContext('studentByLogin', ctx)(id, pin);

test('Student login accepts English digits, Bengali digits, extra spaces and invisible characters', () => {
  for (const [id, pin] of [['280087', '4821'], ['২৮০০৮৭', '৪৮২১'], [' 280 087 ', '48 21'], ['280087​', '​4821'], ['২৮০০৮৭', '4821']]) assert.equal(find(id, pin)?.id, '280087', id + '/' + pin);
});
test('ID is case-insensitive, leading-zero PINs still work, wrong or empty input is refused', () => {
  assert.equal(find('s1', '0007')?.id, 'S1'); assert.equal(find('S1', '৭'), null);
  assert.equal(find('280087', '1111'), null); assert.equal(find('999999', '4821'), null);
  assert.equal(find('', ''), null); assert.equal(find('280087', ''), null);
});
test('Login errors are in Bengali, including the lockout message', () => {
  const login = source.slice(source.indexOf('p === "/api/student/login"'), source.indexOf('p === "/api/student/logout"'));
  assert.match(login, /আইডি বা PIN মেলেনি। ভর্তির সময় পাওয়া আইডি ও PIN দিন — সংখ্যা ইংরেজিতে \(0-9\) লিখুন।/);
  assert.match(login, /অনেকবার ভুল হয়েছে। ৫ মিনিট পরে চেষ্টা করুন।/);
  assert.doesNotMatch(login, /Wrong ID or PIN|Too many wrong attempts/);
  assert.match(source, /const s = studentByLogin\(str\(b\.id, 40\), str\(b\.pin, 10\)\);/);
});
