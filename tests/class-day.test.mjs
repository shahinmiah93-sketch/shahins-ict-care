import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../public/js/common.js', import.meta.url), 'utf8');
const a = source.indexOf('  isClassDay(days, date) {'), b = source.indexOf('  // রেগুলার ব্যাচের প্রথম মাস', a);
assert.ok(a > 0 && b > a, 'isClassDay must be present');
const U = vm.runInNewContext('({' + source.slice(a, b) + '})');

test('Class day check follows the batch days (Bengali weekday names)', () => {
  assert.equal(U.isClassDay('রবি, মঙ্গল, বৃহস্পতি', '2026-11-08'), true);   // রবিবার
  assert.equal(U.isClassDay('রবি, মঙ্গল, বৃহস্পতি', '2026-11-10'), true);   // মঙ্গলবার
  assert.equal(U.isClassDay('রবি, মঙ্গল, বৃহস্পতি', '2026-11-07'), false);  // শনিবার — ক্লাস নেই
  assert.equal(U.isClassDay('শনি, সোম, বুধ', '2026-11-07'), true);          // শনিবার
  assert.equal(U.isClassDay('শুক্রবার', '2026-11-13'), true);
  assert.equal(U.isClassDay('শুক্রবার', '2026-11-12'), false);
});
test('Unknown or empty days never trigger a warning (null)', () => {
  assert.equal(U.isClassDay('', '2026-11-07'), null);
  assert.equal(U.isClassDay('শীঘ্রই জানানো হবে', '2026-11-07'), null);
  assert.equal(U.isClassDay('রবি', 'not-a-date'), null);
});