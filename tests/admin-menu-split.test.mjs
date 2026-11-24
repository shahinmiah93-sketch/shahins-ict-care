import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL('../public/js/' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const admin = read('admin.js'), results = read('admin-results.js');

test('The exams menu has three separate buttons: exams, exam results, student evaluation', () => {
  assert.match(admin, /\["exams", \[\["exams", "পরীক্ষা"\], \["results", "পরীক্ষার ফলাফল"\], \["evaluation", "শিক্ষার্থীর মূল্যায়ন"\]\]\]/);
});
test('Both pages exist and share one module, told apart by an area argument', () => {
  assert.match(admin, /results: \["পরীক্ষার ফলাফল", \(c, arg\) => resultsPage\(c, arg, "results"\)\]/);
  assert.match(admin, /evaluation: \["শিক্ষার্থীর মূল্যায়ন", \(c, arg\) => resultsPage\(c, arg, "eval"\)\]/);
  assert.match(admin, /const resultsPage = \(c, arg, area\) => ensureResults\(\)\(c, arg, area\);/);
});
test('The exam-results page no longer carries the evaluation or the duplicate Performance tab', () => {
  const line = results.split('\n').find((l) => l.includes('const tabs = [["review"'));
  assert.ok(line, 'tabs line');
  assert.ok(!line.includes('"eval"') && !line.includes('"perf"'));
  for (const k of ['review', 'sheets', 'profile', 'merit', 'quiz', 'talent', 'reports']) assert.ok(line.includes('"' + k + '"'), k);
});
test('The evaluation area renders only the evaluation (overall, single student, monthly card)', () => {
  assert.match(results, /if \(AREA === "eval"\) \{ S\.tab = "eval"; C\.innerHTML = `<div class="ex-page rs-page">\$\{evalTab\(\)\}<\/div>`/);
  assert.match(results, /\["all", "সামগ্রিক"\], \["one", "একক"\], \["card", "মাসিক রিপোর্ট কার্ড"\]/);
});
test('Old #results/eval links still land on the evaluation; a student id opens the right view in each area', () => {
  assert.match(results, /AREA = arg === "eval" \|\| area === "eval" \? "eval" : "results"/);
  assert.match(results, /S\.emode = "one"; S\.eid = s\.id;/);
  assert.match(results, /if \(arg && X\.studentById\(arg\)\) openProfile\(arg\);/);
});
