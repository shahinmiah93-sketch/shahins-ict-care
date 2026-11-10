import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const a = source.indexOf('const HSC_FROM = '), b = source.indexOf('\n', source.indexOf('const hscOptions = ', a));
assert.ok(a > 0 && b > a, 'hscOptions must be present');

const run = (sessions = []) => {
  const c = { db: { sessions: sessions.map((name) => ({ name })) }, Array, String, Set };
  vm.createContext(c); vm.runInContext(source.slice(a, b), c);
  return JSON.parse(JSON.stringify(vm.runInContext('hscOptions()', c)));
};

test('Guest / quiz "HSC batch" runs from HSC-05 (2005) to HSC-30', () => {
  const l = run();
  assert.equal(l.length, 26);
  assert.equal(l[0], 'HSC-05'); assert.equal(l[l.length - 1], 'HSC-30');
  assert.ok(l.includes('HSC-09') && l.includes('HSC-27') && l.includes('HSC-28'));
  assert.ok(!l.includes('HSC-04') && !l.includes('HSC-31'));
});
test('A real HSC session outside the range is still offered, without duplicates', () => {
  const l = run(['HSC-27', 'HSC-31', 'Other']);
  assert.equal(l.filter((x) => x === 'HSC-27').length, 1);
  assert.ok(l.includes('HSC-31')); assert.ok(!l.includes('Other'));
});
