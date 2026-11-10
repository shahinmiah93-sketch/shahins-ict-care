import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const student = read('public/js/student.js'), css = read('public/css/app.css');

test('Homework and lessons are grouped by date, newest date first, side by side in two columns', () => {
  assert.match(student, /const dayKey = \(h\) => h\.dueDate \|\| h\.givenDate \|\| ""/);
  assert.match(student, /sort\(\(x, y\) => y\.localeCompare\(x\)\)/);             // newest date on top
  assert.match(student, /class="ex-card hw-day/);                                // same date block as the exam card
  assert.match(student, /class="hw-cols/);
  assert.match(student, /class="hw-col stu-hw-\$\{k\}"/);                        // one column per kind
  assert.match(student, /এই তারিখে \$\{kinds\[k\]\.title\} নেই/);                // empty column message
});
test('The kind filter still works: one kind shows a single full-width column', () => {
  assert.match(student, /shown\.length === 1 \? " one" : ""/);
  assert.match(css, /\.hw-cols\.one\{grid-template-columns:minmax\(0,1fr\)\}/);
});
test('Columns stack on phones and the old stacked sections are gone', () => {
  assert.match(css, /@media\(max-width:700px\)\{\.hw-cols\{grid-template-columns:minmax\(0,1fr\)\}\}/);
  assert.doesNotMatch(student, /const section = \(\[key, kind\]\)/);
});
