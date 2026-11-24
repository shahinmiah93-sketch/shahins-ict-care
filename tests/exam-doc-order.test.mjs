import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const js = fs.readFileSync(new URL('../public/js/admin-exams.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const lineOf = (needle) => { const l = js.split('\n').find((x) => x.includes(needle)); assert.ok(l, needle); return l; };

// "সব ডকুমেন্ট" তালিকা: একই সিরিজের পরীক্ষা নামের নম্বর অনুযায়ী নতুন আগে (GK Test-04, 03, 02, 01)
function sortDocs(docs, exams, batch = '') {
  const start = js.indexOf('const examDateOf'), end = js.indexOf('\n  }\n', js.indexOf('function sortDocs')) + 5;
  assert.ok(start > 0 && end > start);
  const c = { String, Number, S: { f: { batch } }, exById: (id) => exams.find((e) => e.id === id) };
  vm.createContext(c);
  vm.runInContext(lineOf('const enNum =') + '\n' + lineOf('const dateOf =') + '\n' + js.slice(start, end), c);
  return Array.from(vm.runInContext('sortDocs(' + JSON.stringify(docs) + ')', c), (d) => d.title);
}
const gk = (n, date) => ({ id: 'e' + n, title: 'Weekly GK Test-' + n, date });
const exams = [gk('01', '2026-10-30'), gk('02', '2026-11-06'), gk('03', '2026-11-13'), gk('04', '2026-11-20')];

test('Weekly GK Test-04, 03, 02, 01 — by the number in the name, even if Test-01\'s file was uploaded last', () => {
  const docs = [
    { title: 'D01', examId: 'e01', createdAt: '2026-11-24T10:00' },
    { title: 'D04', examId: 'e04', createdAt: '2026-11-24T09:00' },
    { title: 'D03', examId: 'e03', createdAt: '2026-11-24T08:00' },
    { title: 'D02', examId: 'e02', createdAt: '2026-11-10T08:00' },
  ];
  assert.deepEqual(sortDocs(docs, exams), ['D04', 'D03', 'D02', 'D01']);
});
test('The number decides, not the date: a later-numbered test held earlier still comes first, and Bengali digits work', () => {
  const ex = [{ id: 'a', title: 'Weekly GK Test-03', date: '2026-11-20' }, { id: 'b', title: 'Weekly GK Test-04', date: '2026-11-13' }, { id: 'c', title: 'Weekly GK Test-০৫', date: '2026-11-27' }];
  const docs = ['a', 'b', 'c'].map((id) => ({ title: id, examId: id, createdAt: '2026-11-01' }));
  assert.deepEqual(sortDocs(docs, ex), ['c', 'b', 'a']);
});
test('Different series stay together: the series with the newest exam first, numbers descending inside each', () => {
  const ex = [
    { id: 'w5', title: 'Weekly Test-05', date: '2026-11-22' }, { id: 'w4', title: 'Weekly Test-04', date: '2026-11-15' },
    ...exams,
  ];
  const docs = ['w4', 'e02', 'w5', 'e04', 'e01', 'e03'].map((id) => ({ title: id, examId: id, createdAt: '2026-11-01' }));
  assert.deepEqual(sortDocs(docs, ex), ['w5', 'w4', 'e04', 'e03', 'e02', 'e01']);
});
test('The same exam keeps newest upload first, and a title with no number falls back to its date', () => {
  const ex = [{ id: 'x', title: 'Special Exam', date: '2026-11-01' }, { id: 'y', title: 'Model Test', date: '2026-11-09' }];
  const docs = [
    { title: 'x-old', examId: 'x', createdAt: '2026-11-01' }, { title: 'x-new', examId: 'x', createdAt: '2026-11-02' },
    { title: 'y', examId: 'y', createdAt: '2026-10-01' },
  ];
  assert.deepEqual(sortDocs(docs, ex), ['y', 'x-new', 'x-old']);
});
test('An exam that no longer exists does not crash the sort', () => {
  assert.deepEqual(sortDocs([{ title: 'orphan', examId: 'gone', createdAt: '2026-11-01' }, { title: 'D', examId: 'e01', createdAt: '2026-11-01' }], exams), ['D', 'orphan']);
});
