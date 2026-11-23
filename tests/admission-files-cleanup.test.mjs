import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const between = (a, b) => { const i = source.indexOf(a), j = source.indexOf(b, i + a.length); assert.ok(i > 0 && j > i, a); return source.slice(i, j); };
const dropFn = between('function dropAdmissionFiles(', 'function readRaw(');
const orphanFn = between('function dropOrphanAdmissionFiles()', '\ndropOrphanAdmissionFiles();');

function ctx(db) {
  const unlinked = [], copied = [];
  const c = {
    Date, Object, Array, JSON, Set, console: { info() {} }, db,
    DB_FILE: 'db', BACKUPS: 'bk', ADMISSION_FILES: 'af', path: { join: (...x) => x.join('/') },
    fs: { unlinkSync: (f) => unlinked.push(f), copyFileSync: (...x) => copied.push(x), existsSync: () => true },
    saveDb() {}, writeJsonAtomic() {},
  };
  vm.createContext(c); vm.runInContext(dropFn + orphanFn, c);
  return { c, unlinked, copied };
}
const att = (id, studentId) => ({ id, studentId, ext: '.pdf' });

test('Deleting a student removes only that student\'s attachment records and files', () => {
  const { c, unlinked } = ctx({ admissionAttachments: [att('a1', 's1'), att('a2', 's1'), att('a3', 's2')] });
  assert.equal(vm.runInContext('dropAdmissionFiles("s1")', c), 2);
  assert.deepEqual(c.db.admissionAttachments.map((x) => x.id), ['a3']);
  assert.deepEqual(unlinked, ['af/a1.pdf', 'af/a2.pdf']);
});
test('Student without attachments (or no list at all) is a no-op', () => {
  const { c } = ctx({});
  assert.equal(vm.runInContext('dropAdmissionFiles("s1")', c), 0);
});
test('The student delete route calls the cleanup', () => {
  assert.match(source, /db\.payments = db\.payments\.filter\(\(x\) => x\.studentId !== id\);\n\s+dropAdmissionFiles\(id\);/);
});
test('One-time orphan cleanup: backs up, removes orphans only, runs once', () => {
  const { c, copied, unlinked } = ctx({ meta: {}, students: [{ id: 's2' }], admissionAttachments: [att('a1', 'gone'), att('a3', 's2')] });
  assert.equal(vm.runInContext('dropOrphanAdmissionFiles()', c), true);
  assert.deepEqual(c.db.admissionAttachments.map((x) => x.id), ['a3']);
  assert.deepEqual(unlinked, ['af/a1.pdf']);
  assert.ok(copied.length >= 2); // ডেটার ব্যাকআপ + ফাইলের কপি
  assert.equal(vm.runInContext('dropOrphanAdmissionFiles()', c), false);
});
