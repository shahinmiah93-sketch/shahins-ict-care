import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const admin = fs.readFileSync(new URL('../public/js/admin.js', import.meta.url), 'utf8');

test('Notice form: "show on website" and session/batch targets switch each other off instead of showing an error first', () => {
  assert.match(admin, /id="ntNote"/);
  // website ticked -> targets cleared
  assert.match(admin, /t\.name === "public"[\s\S]{0,400}\$\$\("#ntTarget input:checked"\)\.forEach\(\(x\) => \{ x\.checked = false; \}\)/);
  // a session/batch ticked -> website unticked
  assert.match(admin, /pub\.checked = false;/);
});
test('The save-time safety check stays in place', () => {
  assert.match(admin, /if \(d\.public && \(d\.batchIds\.length \|\| d\.sessions\.length\)\) throw new Error/);
});
