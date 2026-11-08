import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const a = source.indexOf('const BIRTHDAY_BODY = '), b = source.indexOf('const birthdayToday', a); // ইংরেজি SMS-এর লেখা থেকে শুরু, কারণ আগের লেখার তালিকা ওটা ব্যবহার করে
assert.ok(a > 0 && b > a, 'birthday greeting block must be present');
const ctx = { str: (v, n = 500) => String(v ?? '').trim().slice(0, n), firstName: (s) => s.nameEn || s.name || '' };
vm.createContext(ctx);
vm.runInContext(source.slice(a, b), ctx);
const get = (name) => vm.runInContext(name, ctx);

test('Panel greeting title uses the full Bengali name and the emoji', () => {
  assert.equal(get('birthdayTitle')({ name: 'সাদিকা সাঈদ' }), 'শুভ জন্মদিন, সাদিকা সাঈদ! 🎉💖');
  assert.equal(get('birthdayTitle')({ name: 'মো. রহিম উদ্দিন' }), 'শুভ জন্মদিন, মো. রহিম উদ্দিন! 🎉💖');
});
test('Falls back to the English name when the Bengali name is empty', () => {
  assert.equal(get('birthdayTitle')({ name: '', nameEn: 'Rahim' }), 'শুভ জন্মদিন, Rahim! 🎉💖');
});
test('Greeting body is the teacher\'s Bengali wish with the signature block', () => {
  const body = get('BIRTHDAY_BODY_BN');
  assert.match(body, /^তোমার জীবনের প্রতিটি দিন আনন্দ/);
  assert.match(body, /লক্ষ্যের দিকে।\n\nএকজন শিক্ষক হিসেবে/);
  assert.match(body, /হও এটাই আমার প্রত্যাশা।\n\nঅনেক অনেক দোয়া, ভালোবাসা ও শুভকামনা রইল। ❤️\n\nশুভেচ্ছান্তে,/);
  assert.match(body, /শুভেচ্ছান্তে,\nমো\. শাহিন মিয়া\nতোমার আইসিটি শিক্ষক ও মেন্টর\nShahin’s ICT Care$/);
  assert.equal(body.split('\n\n').length, 4); // ৩টি অনুচ্ছেদ + স্বাক্ষর
});
test('Birthday notice is flagged for the banner and uses the title helper', () => {
  assert.match(source, /const title = birthdayTitle\(s\);/);
  assert.match(source, /birthday: true, studentIds: \[s\.id\], title, body: BIRTHDAY_BODY_BN/);
});
test('SMS stays English and old notices are upgraded to the new wish', () => {
  assert.match(source, /Happy Birthday, \$\{firstName\(s\)\}!\\n\\n\$\{BIRTHDAY_BODY\}/);
  assert.match(source, /n\.birthday && BIRTHDAY_BODIES_OLD\.includes\(n\.body\) && \(n\.studentIds \|\| \[\]\)\.length === 1/);
  assert.match(source, /n\.title = birthdayTitle\(st\); n\.body = BIRTHDAY_BODY_BN; upgraded = true;/);
});