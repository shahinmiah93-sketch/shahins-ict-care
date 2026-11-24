import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const js = fs.readFileSync(new URL('../public/js/admin-exams.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('Exam builder offers one date for all batches when more than one batch is selected', () => {
  assert.match(js, /ids\.length > 1 \? '<label class="all-batch-date">/);
  assert.match(js, /<input type="date" data-all-date value=/);
});
test('Choosing the shared date writes it into every batch date; editing one batch clears the shared field', () => {
  const i = js.indexOf('if (t.matches("[data-all-date]"))'), block = js.slice(i, i + 700);
  assert.ok(i > 0);
  assert.match(block, /\$\$\("\[data-batch-date\]", dlg\)\.forEach\(\(i\) => \{ i\.value = t\.value; B\.batchDates\[i\.dataset\.batchDate\] = t\.value; \}\)/);
  assert.match(block, /all\.value = vs\.length && vs\.every\(\(v\) => v === vs\[0\]\) \? vs\[0\] : ""/);
});
test('Saving still reads every per-batch date input (the shared field is only a shortcut)', () => {
  assert.match(js, /const dateInputs = \$\$\("\[data-batch-date\]", dlg\)/);
});
