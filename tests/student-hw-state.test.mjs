import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const student = read('public/js/student.js'), css = read('public/css/app.css');

test('Each homework / lesson card opens with a big coloured status bar', () => {
  assert.match(student, /class="hw-state \$\{S\[0\]\}" role="status"/);
  assert.match(student, /\["done", "✓", kind\.yes,/);                 // করেছ / পেরেছ
  assert.match(student, /\["not", "✗", kind\.no,/);                   // করোনি / পারোনি
  assert.match(student, /\["absent", "—", "অনুপস্থিত ছিলে"/);
  assert.match(student, /\["pending", "…", "যাচাই হয়নি"/);
  assert.match(student, /class="stu-hw-item st-\$\{/);                // card edge takes the same colour
});
test('Lessons and homework use their own words', () => {
  assert.match(student, /lesson \? "পড়াটা ঠিকমতো পেরেছ/);
  assert.match(student, /বাড়ির কাজটা করে এনেছ/);
});
test('Green / red / grey / amber styles exist', () => {
  for (const k of ['done', 'not', 'absent', 'pending']) {
    assert.match(css, new RegExp('\\.hw-state\\.' + k + '\\{'));
    assert.match(css, new RegExp('\\.stu-hw-item\\.st-' + k + '\\{'));
  }
});
