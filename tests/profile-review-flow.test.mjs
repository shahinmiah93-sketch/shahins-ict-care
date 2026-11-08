import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const admin = fs.readFileSync(new URL('../public/js/admin.js', import.meta.url), 'utf8');

test('Profile-change review from the request list returns to that list after approve or reject', () => {
  assert.match(admin, /function reviewProfileChanges\(id, back\)/);
  assert.match(admin, /await load\(\); route\(\); if \(back\) back\(\); else viewStudent\(id\);/);
  assert.match(admin, /reviewProfileChanges\(b\.dataset\.reviewProfile, openProfileRequests\)/);
  assert.match(admin, /\$\("#reviewStudentProfiles"\)\.onclick = openProfileRequests;/);
});
test('Opening the review from a student profile still goes back to that profile', () => {
  assert.match(admin, /\$\("#viewProfileChanges"\)\.onclick=\(\)=>reviewProfileChanges\(s\.id\);/);
});
