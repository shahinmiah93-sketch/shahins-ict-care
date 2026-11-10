import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const hw = read('public/js/admin-homework.js'), css = read('public/css/exams.css'), html = read('public/admin.html');

test('Admin "দেওয়া কাজ ও পড়া" groups by date like the student panel: date block, homework and lesson side by side, newest first', () => {
  assert.match(hw, /const dayKey = \(h\) => h\.dueDate \|\| h\.givenDate \|\| ""/);
  assert.match(hw, /sort\(\(x, y\) => y\.localeCompare\(x\)\)/);
  assert.match(hw, /class="ex-card hw-day/);
  assert.match(hw, /class="hw-col stu-hw-\$\{k\}"/);
  assert.match(hw, /class="hw-cols\$\{kinds\.length === 1 \? " one" : ""\}"/);
});
test('Every action button keeps its data attribute so the page handlers still work', () => {
  for (const a of ['data-check', 'data-edit', 'data-del', 'data-copy-hw', 'data-add-kind', 'data-show']) assert.ok(hw.includes(a), a);
});
test('Heading sits in a white panel, topic text is dark, and the stylesheet version changed', () => {
  assert.match(hw, /<section class="card hw-panel">/);
  assert.match(css, /\.hw-panel \.hw-list-heading h3\{color:#173b4a/);
  assert.match(css, /\.hw-day \.hw-topic-title>b\{color:#173b4a\}/);
  assert.match(html, /exams\.css\?v=[0-9a-f]{8}/);
});
