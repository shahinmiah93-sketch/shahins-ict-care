import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const server = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const client = fs.readFileSync(new URL('../public/js/student.js', import.meta.url), 'utf8');

test('Student fee table has a receipt print link for every payment, opening the student-only receipt route', () => {
  assert.match(client, /href="\/api\/student\/receipt\/\$\{encodeURIComponent\(p\.id\)\}"/);
  assert.match(client, /target="_blank" rel="noopener"/);
  assert.match(client, /<td colspan="6" class="empty">কোনো পেমেন্ট নেই/);
});
test('The student receipt route requires login and only serves the student\'s own payment', () => {
  const i = server.indexOf('const myReceipt = '), block = server.slice(i, i + 700);
  assert.ok(i > 0);
  assert.match(block, /panelStudent\(res\)/);
  assert.match(block, /401/);
  assert.match(block, /x\.id === myReceipt\[1\] && x\.studentId === s\.id/);
  assert.match(block, /sendPaymentReceipt\(res, payment/);
});
