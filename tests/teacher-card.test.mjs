import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const site = fs.readFileSync(new URL('../public/js/site.js', import.meta.url), 'utf8');

test('Teacher cards show only photo, name and role; the bio opens on click', () => {
  const start = site.indexOf('$("#teachers").innerHTML'), end = site.indexOf('const openPerson');
  const card = site.slice(start, end);
  assert.ok(start > 0 && end > start);
  assert.doesNotMatch(card, /esc\(t\.bio\)/, 'bio must not be printed inside the card');
  assert.match(card, /বিস্তারিত দেখুন/);
  assert.match(site, /className = "person-dialog"/);
  assert.match(site, /\$\("#teachers"\)\.addEventListener\("click"/);
});
test('Cards are keyboard accessible only when there is a bio', () => {
  assert.match(site, /t\.bio \? ` data-person=/);
  assert.match(site, /role="button" tabindex="0"/);
  assert.match(site, /e\.key === "Enter" \|\| e\.key === " "/);
});
