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
test('Review screen has a back-to-list button when opened from the list', () => {
  assert.match(admin, /id="backProfileList">‹ অনুরোধের তালিকা<\/button>/);
  assert.match(admin, /if \(back\) \{ \$\("#backProfileList"\)\.onclick = /);
});
test('Closing the review (X, Cancel, Esc) returns to the request list; the list itself closes for good', () => {
  assert.match(admin, /onClose = \(\) => \{ onClose = null; setTimeout\(back, 0\); \}; modal\.addEventListener\("close", onClose, \{ once: true \}\);/);
  assert.match(admin, /\$\("#backProfileList"\)\.onclick = \(\) => \{ leave\(\); back\(\); \}/);
  assert.match(admin, /await api\("\/api\/admin\/student-profile-review",\{body:\{id,version:pending\.version,action\}\}\); leave\(\);/);
});
test('Opening the review from a student profile still goes back to that profile', () => {
  assert.match(admin, /\$\("#viewProfileChanges"\)\.onclick=\(\)=>reviewProfileChanges\(s\.id\);/);
});
