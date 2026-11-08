import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const a = source.indexOf('const smsParts = '), b = source.indexOf('\n', a);
assert.ok(a > 0 && b > a, 'smsParts must be present');
const ctx = {}; vm.createContext(ctx); vm.runInContext(source.slice(a, b), ctx);
const parts = (t) => vm.runInContext('smsParts', ctx)(t);

test('SMS parts follow the gateway rule: Bangla 70/67, English 160/153', () => {
  assert.equal(parts('a'.repeat(160)), 1);
  assert.equal(parts('a'.repeat(161)), 2);
  assert.equal(parts('a'.repeat(307)), 3);
  assert.equal(parts('ক'.repeat(70)), 1);
  assert.equal(parts('ক'.repeat(71)), 2);
  assert.equal(parts('ক'.repeat(135)), 3);
});
test('Every gateway log records its real segment count', () => {
  assert.match(source, /count: 1, segments: smsParts\(message\), phone/);
});
test('Saving only the SMS rate keeps Sender ID and the on/off switch', () => {
  assert.match(source, /senderId: b\.senderId !== undefined \? str\(b\.senderId, 40\) : smsCfg\.senderId/);
  assert.match(source, /enabled: b\.enabled !== undefined \? !!b\.enabled : smsCfg\.enabled/);
  assert.match(source, /rate: b\.rate !== undefined \?/);
  assert.match(source, /rate: Number\(smsCfg\.rate\) \|\| 0/);
});
