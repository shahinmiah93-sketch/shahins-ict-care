import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../public/js/admin-books.js', import.meta.url), 'utf8');

test('New book sale: student ID + name panel comes first, then session / batch / student pick', () => {
  const id = src.indexOf('শিক্ষার্থীর আইডি<input data-s="studentId"'), who = src.indexOf('id="bkWho"'), session = src.indexOf('data-student-session'), batch = src.indexOf('data-student-batch'), pick = src.indexOf('data-student-pick');
  assert.ok(id > 0 && who > id, 'name panel follows the ID input');
  assert.ok(session > who && batch > session && pick > batch, 'session, batch, pick come after the ID panel');
  assert.match(src, /<datalist id="bkStuList">/);   // আইডির সাজেশন আগের মতো আছে
});
