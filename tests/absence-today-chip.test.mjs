import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../public/js/admin-absence.js', import.meta.url), 'utf8');

test('Absence call list marks "আজ অনুপস্থিত" before the monthly count, only when the absence date is today', () => {
  const at = src.indexOf('আজ অনুপস্থিত</span>'), month = src.indexOf('এই মাসে ${bn(mon)} দিন অনুপস্থিত');
  assert.ok(at > 0 && month > at, 'today chip must come before the month chip');
  assert.match(src, /\$\{date === today\(\) && !\(streak > 1\) \? '<span class="chip bad">আজ অনুপস্থিত<\/span> ' : ""\}/);
});
