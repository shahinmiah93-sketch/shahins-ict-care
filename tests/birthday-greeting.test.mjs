import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const pick = (start, endMarker) => { const a = source.indexOf(start), b = source.indexOf(endMarker, a); assert.ok(a > 0 && b > a, start + ' must be present'); return source.slice(a, b); };
const code = pick('const BN_NAME_TITLES', 'const birthdayToday') + '\n;firstNameBn';
const ctx = { str: (v, n = 500) => String(v ?? '').trim().slice(0, n), firstName: (s) => s.nameEn || s.name || '' };
vm.createContext(ctx);
const firstNameBn = vm.runInContext(code, ctx);

test('Bengali first name skips Mo./Mosammat style prefixes', () => {
  assert.equal(firstNameBn({ name: 'মো. রহিম উদ্দিন' }), 'রহিম');
  assert.equal(firstNameBn({ name: 'মোঃ করিম হোসেন' }), 'করিম');
  assert.equal(firstNameBn({ name: 'মোছাঃ ফাতেমা খাতুন' }), 'ফাতেমা');
  assert.equal(firstNameBn({ name: 'মোহাম্মদ আলী' }), 'আলী');
  assert.equal(firstNameBn({ name: 'জারা ভূঁইয়া' }), 'জারা');
  assert.equal(firstNameBn({ name: 'সিয়াম' }), 'সিয়াম');
});
test('Bengali first name falls back to the English name when the Bengali name is empty', () => {
  assert.equal(firstNameBn({ name: '', nameEn: 'Rahim' }), 'Rahim');
  assert.equal(firstNameBn({ name: 'মো.', nameEn: 'Md Rahim' }), 'মো');
});
test('Birthday notice for the panel is in Bengali and flagged for the banner', () => {
  assert.match(source, /const title = `শুভ জন্মদিন, \$\{firstNameBn\(s\)\}!`;/);
  assert.match(source, /birthday: true, studentIds: \[s\.id\], title, body: BIRTHDAY_BODY_BN/);
  // SMS stays English (cheaper than Unicode SMS)
  assert.match(source, /Happy Birthday, \$\{firstName\(s\)\}!\\n\\n\$\{BIRTHDAY_BODY\}/);
});
