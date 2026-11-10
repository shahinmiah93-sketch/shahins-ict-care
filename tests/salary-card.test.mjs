import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const admin = fs.readFileSync(new URL('../public/js/admin.js', import.meta.url), 'utf8');
const i = admin.indexOf('$("#bpCard").onclick'), card = admin.slice(i, admin.indexOf('w.document.close();', i));
assert.ok(i > 0 && card.length > 1000, 'salary card block must be present');

test('Salary card says পাওনা, not দেনা', () => {
  assert.match(card, /পূর্বের পাওনা/); assert.match(card, /মোট পাওনা/);
  assert.doesNotMatch(card, /দেনা/);
});
test('Logo is lifted so its "শাহিন\'স" wordmark sits on the same line as the institute name', () => {
  assert.match(card, /\.hd\{display:flex;align-items:flex-start/);
  assert.match(card, /\.hd img\{[^}]*height:10\.5mm[^}]*margin-top:-2\.4mm/);
});
test('Institute name is Hind Siliguri; address, fee-rule box are black; info labels are bold', () => {
  assert.match(card, /\.org b\{[^}]*'Hind Siliguri'/);
  assert.doesNotMatch(card, /Noto Serif/);
  assert.match(card, /\.org small\{[^}]*color:#000/);
  assert.match(card, /\.nt-p,\.nt-p \*\{color:#000!important\}/);
  assert.match(card, /\.info i\{[^}]*color:#000;font-weight:700/);
});
