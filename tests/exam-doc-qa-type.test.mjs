import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const server = read('server.mjs'), admin = read('public/js/admin-exams.js'), student = read('public/js/student.js');
const QA = 'প্রশ্ন ও উত্তরপত্র';

test('Server accepts the combined question-and-answer document type and still defaults unknown values to question', () => {
  assert.match(server, /\["question", "answer", "qa", "script"\]\.includes\(b\.category\) \? b\.category : "question"/);
});
test('Admin offers the new type in the add form, the edit dialog, the tabs and the label map', () => {
  assert.match(admin, new RegExp('qa: "' + QA + '"'));
  assert.match(admin, new RegExp('\\["qa", "' + QA + '"\\]\\], S\\.docCat\\)'));
  assert.match(admin, new RegExp('\\["qa", "' + QA + '"\\]\\], d\\.category\\)'));
  assert.match(admin, new RegExp('const SUBS = \\[.*\\["qa", "' + QA + '"\\]'));
});
test('Students see the new type with its own label (not the generic "ডকুমেন্ট")', () => {
  assert.match(student, new RegExp('qa: "' + QA + '", script:'));
});
test('Only the student-specific answer book (script) stays hidden from other students', () => {
  assert.match(server, /d\.category !== "script" \|\| \(d\.studentId === sess\.sid/);
});
