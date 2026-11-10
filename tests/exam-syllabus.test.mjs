import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const exams = read('public/js/admin-exams.js'), student = read('public/js/student.js'), server = read('server.mjs'), css = read('public/css/app.css'), html = read('public/student.html');

test('Exam form has a multi-line syllabus box that is loaded and saved', () => {
  assert.match(exams, /<textarea name="syllabus"/);
  assert.match(exams, /f\.syllabus\.value = ex \? ex\.syllabus \|\| ""/);
  assert.match(exams, /syllabus: f\.syllabus\.value\.trim\(\)/);
  assert.doesNotMatch(exams, /syllabus: ex \? ex\.syllabus/); // old value must not be kept silently
});
test('Server keeps a long syllabus (up to 5000 chars)', () => {
  assert.match(server, /syllabus: str\(b\.syllabus, 5000\)/);
});
test('Students see each exam as a card: date, time, full marks, chapter and the detailed syllabus with line breaks', () => {
  assert.match(student, /class="ex-card/);
  assert.match(student, /class="ex-meta"/);
  assert.match(student, /class="ex-chap"/);
  assert.match(student, /class="ex-syl"/);
  assert.match(student, /filter\(Boolean\)\.join\("\\n"\)/); // routine table keeps chapter + syllabus lines
  assert.match(css, /\.pre,\.sy\{white-space:pre-line/);
  assert.match(css, /\.ex-card\{/);
  assert.match(html, /app\.css\?v=20261110-hw-days/);  // student page always loads the latest app.css
});
