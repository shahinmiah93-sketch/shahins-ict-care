import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const js = fs.readFileSync(new URL('../public/js/admin-exams.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// "সব ডকুমেন্ট" তালিকা: নতুন পরীক্ষার ডকুমেন্ট আগে (GK Test-04, 03, 02, 01) — আপলোডের সময় ধরে নয়
function sortDocs(docs, exams) {
  const def = js.split('\n').find((l) => l.includes('const examDateOf ='));
  const line = js.split('\n').find((l) => l.includes('examDateOf(b)'));
  assert.ok(def && line);
  const cmp = line.slice(line.indexOf('.sort(') + 6, line.lastIndexOf(');'));
  const c = { String, exById: (id) => exams.find((e) => e.id === id) };
  vm.createContext(c);
  vm.runInContext(def, c);
  return Array.from(vm.runInContext('(' + JSON.stringify(docs) + ').sort(' + cmp + ')', c), (d) => d.title); // vm-এর অ্যারে সাধারণ অ্যারেতে
}
const exams = [
  { id: 'e1', date: '2026-10-30' }, { id: 'e2', date: '2026-11-06' }, { id: 'e3', date: '2026-11-13' }, { id: 'e4', date: '2026-11-20' },
];

test('Documents are listed by exam date, newest exam first, even if an old exam\'s file was uploaded last', () => {
  const docs = [
    { title: 'GK-01', examId: 'e1', createdAt: '2026-11-24T10:00' }, // সবচেয়ে পরে আপলোড হয়েছে
    { title: 'GK-04', examId: 'e4', createdAt: '2026-11-24T09:00' },
    { title: 'GK-03', examId: 'e3', createdAt: '2026-11-24T08:00' },
    { title: 'GK-02', examId: 'e2', createdAt: '2026-11-10T08:00' },
  ];
  assert.deepEqual(sortDocs(docs, exams), ['GK-04', 'GK-03', 'GK-02', 'GK-01']);
});
test('Documents of the same exam keep newest-upload-first, and an exam without a date goes last', () => {
  const docs = [
    { title: 'a-old', examId: 'e4', createdAt: '2026-11-01T00:00' },
    { title: 'a-new', examId: 'e4', createdAt: '2026-11-02T00:00' },
    { title: 'nodate', examId: 'x', createdAt: '2026-11-30T00:00' },
  ];
  assert.deepEqual(sortDocs(docs, exams), ['a-new', 'a-old', 'nodate']);
});
