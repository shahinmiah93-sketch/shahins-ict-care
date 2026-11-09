import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const a = source.indexOf('const idFails = new Map()'), b = source.indexOf('async function api(req, res, url) {');
assert.ok(a > 0 && b > a, 'login lock block must be present');

function lock(now = { t: 1_000_000 }) {
  class FakeDate extends Date { static now() { return now.t; } }
  const c = { Map, Date: FakeDate, Date_now: now };
  vm.createContext(c); vm.runInContext(source.slice(a, b), c);
  return { c, now, locked: vm.runInContext('loginLocked', c), fail: vm.runInContext('noteLoginFail', c), clear: vm.runInContext('clearLoginFails', c) };
}

test('5 wrong tries on one ID lock only that ID — other students on the same network are not blocked', () => {
  const L = lock();
  for (let i = 0; i < 4; i++) { L.fail('1.1.1.1', '280087'); assert.equal(L.locked('1.1.1.1', '280087'), false); }
  L.fail('1.1.1.1', '280087');
  assert.equal(L.locked('1.1.1.1', '280087'), true);
  assert.equal(L.locked('1.1.1.1', '280001'), false);   // একই নেটওয়ার্কের অন্য শিক্ষার্থী
  assert.equal(L.locked('2.2.2.2', '280087'), false);   // অন্য নেটওয়ার্ক থেকে একই আইডি
});
test('The lock ends after 5 minutes; a correct login clears the count', () => {
  const L = lock(); for (let i = 0; i < 5; i++) L.fail('1.1.1.1', 'A');
  assert.equal(L.locked('1.1.1.1', 'A'), true);
  L.now.t += 5 * 60e3 + 1; assert.equal(L.locked('1.1.1.1', 'A'), false);
  const M = lock(); for (let i = 0; i < 4; i++) M.fail('1.1.1.1', 'B'); M.clear('1.1.1.1', 'B'); M.fail('1.1.1.1', 'B');
  assert.equal(M.locked('1.1.1.1', 'B'), false);        // গণনা শূন্য থেকে শুরু
});
test('Guessing across many IDs from one network is still stopped: 40 wrong tries in 10 minutes block the whole network', () => {
  const L = lock();
  for (let i = 0; i < 39; i++) L.fail('9.9.9.9', 'ID' + i);
  assert.equal(L.locked('9.9.9.9', 'ID100'), false);
  L.fail('9.9.9.9', 'ID39');
  assert.equal(L.locked('9.9.9.9', 'ID100'), true);
  assert.equal(L.locked('8.8.8.8', 'ID100'), false);
  L.now.t += 5 * 60e3 + 1; assert.equal(L.locked('9.9.9.9', 'ID100'), false);
});
test('Student login uses the per-ID lock', () => {
  const login = source.slice(source.indexOf('p === "/api/student/login"'), source.indexOf('p === "/api/student/logout"'));
  assert.match(login, /loginLocked\(ip, idKey\)/); assert.match(login, /noteLoginFail\(ip, idKey\)/); assert.match(login, /clearLoginFails\(ip, idKey\)/);
  assert.doesNotMatch(login, /tooManyFails|noteFail\(ip\)/);
});
