import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const admin = read('public/js/admin.js'), server = read('server.mjs');

// রসিদ দুই জায়গায় বানানো হয়: অ্যাডমিনের ব্রাউজারে (প্রিন্ট / PDF) আর সার্ভারে (SMS-এর রসিদ-লিঙ্ক)। দুটোতেই একই তথ্য থাকতে হবে।
const cell = (src, money) => {
  const i = src.indexOf('<div class="c amt">'); assert.ok(i > 0, 'amount cell');
  return src.slice(i, src.indexOf('</div>', i) + 6).replace(money, 'MONEY');
};

test('Printed receipt (browser): a corrected payment says "সংশোধিত রসিদ" and a discount shows "এছাড়া ছাড়"', () => {
  const c = cell(admin, /money\(/g);
  assert.match(c, /এই রসিদে মোট জমা\$\{p\.edited \? " \(সংশোধিত রসিদ\)" : ""\}/);
  assert.match(c, /\$\{p\.discount > 0 \? `<i>এছাড়া ছাড়: \$\{MONEY\(?p\.discount\)\}<\/i>` : ""\}/);
});
test('SMS receipt page (server): same label and same discount line', () => {
  const c = cell(server, /receiptMoney\(/g);
  assert.match(c, /এই রসিদে মোট জমা\$\{p\.edited \? " \(সংশোধিত রসিদ\)" : ""\}/);
  assert.match(c, /\$\{p\.discount > 0 \? `<i>এছাড়া ছাড়: \$\{MONEY\(?p\.discount\)\}<\/i>` : ""\}/);
});
test('The receipt stylesheets style the sub-line under the amount', () => {
  for (const css of ['public/css/payment-receipt.css']) assert.match(read(css), /\.c i\{display:block;font-style:normal/);
  assert.match(admin, /\.c i\{display:block;font-style:normal/);
});
