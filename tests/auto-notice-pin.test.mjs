import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n'); // CRLF / LF দুটোতেই চলে
const between = (a, b) => { const i = source.indexOf(a), j = source.indexOf(b, i + a.length); assert.ok(i > 0 && j > i, a); return source.slice(i, j); };
const resultFn = between('function syncResultNotice(', 'function syncQuizNotice(');
const quizFn = between('function syncQuizNotice(', '\n}\n') + '\n}\n';
const unpinFn = between('function unpinAutoNotices()', 'repairConfirmedAdmissionStart();');

function ctx(notices) {
  const copies = [], saved = [];
  const c = {
    Date, Object, Array, JSON, Number, String, Math, console: { info() {} },
    db: { notices, batches: [{ id: 'b1', name: '28-A' }], meta: {} },
    today: () => '2026-11-20', uid: (p) => p + '_new',
    DB_FILE: 'db', BACKUPS: 'b', path: { join: (...x) => x.join('/') }, fs: { copyFileSync: (...x) => copies.push(x) },
    saveDb: () => saved.push(1), writeJsonAtomic() {},
  };
  vm.createContext(c); vm.runInContext(resultFn + quizFn + unpinFn, c);
  return { c, copies, saved };
}

test('A new result notice is created NOT pinned (important=false)', () => {
  const { c } = ctx([]);
  vm.runInContext('syncResultNotice({ id: "ex1", title: "Weekly GK Test-05", published: { b1: true } })', c);
  const n = c.db.notices[0];
  assert.equal(n.important, false); assert.equal(n.tag, 'ফলাফল'); assert.equal(n.resultExamId, 'ex1');
});
test('Re-publishing keeps what the admin chose (a manual pin is not reset)', () => {
  const { c } = ctx([{ id: 'n1', resultExamId: 'ex1', important: true, title: 'old' }]);
  vm.runInContext('syncResultNotice({ id: "ex1", title: "Weekly GK Test-05", published: { b1: true } })', c);
  assert.equal(c.db.notices[0].important, true); assert.match(c.db.notices[0].title, /Test-05/);
});
test('A new quiz announcement is created NOT pinned', () => {
  const { c } = ctx([]);
  vm.runInContext('syncQuizNotice({ id: "q1", title: "Quiz 1", announce: true, opensAt: "2026-11-25T18:00", duration: 20, session: "HSC-28" })', c);
  assert.equal(c.db.notices[0].important, false); assert.equal(c.db.notices[0].tag, 'কুইজ');
});
test('One-time repair unpins old auto notices only, keeps admin-made pins, backs up, runs once', () => {
  const { c, copies } = ctx([
    { id: 'r1', resultExamId: 'ex1', important: true },
    { id: 'q1', quizId: 'q1', important: true },
    { id: 'm1', title: 'manual', important: true },          // অ্যাডমিনের নিজের জরুরি নোটিশ — থাকবে
    { id: 'b1', birthday: true, important: true },           // জন্মদিন — আলাদা কার্ড, ছোঁয়া হয় না
  ]);
  assert.equal(vm.runInContext('unpinAutoNotices()', c), true);
  const by = (id) => c.db.notices.find((n) => n.id === id);
  assert.equal(by('r1').important, false); assert.equal(by('q1').important, false);
  assert.equal(by('m1').important, true); assert.equal(by('b1').important, true);
  assert.equal(copies.length, 1);
  assert.equal(vm.runInContext('unpinAutoNotices()', c), false);   // দ্বিতীয়বার কিছু করে না
  by('r1').important = true;                                       // অ্যাডমিন পরে নিজে পিন করলে আর বদলায় না
  vm.runInContext('unpinAutoNotices()', c); assert.equal(by('r1').important, true);
});
