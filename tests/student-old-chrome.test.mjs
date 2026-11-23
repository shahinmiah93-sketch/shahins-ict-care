import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL('../public/' + p, import.meta.url), 'utf8');

// ছাত্র-প্যানেলের স্ক্রিপ্টে একটা লাইনও ব্রাউজার না বুঝলে পুরো পাতা (লগইনসহ) অচল হয়ে যায়।
// ন্যূনতম: Chrome ৮০ (?. ও ?? আগে থেকেই আছে)। তার ওপরের লেখা — ||=  &&=  ??= (Chrome ৮৫+) — এখানে চলবে না।
const html = read('student.html');
const scripts = [...html.matchAll(/<script[^>]*src="\/(js\/[^"?]+)/g)].map((m) => m[1]);

test('The student page loads its scripts (sanity)', () => { assert.ok(scripts.includes('js/student.js') && scripts.includes('js/common.js')); });
test('No student-page script uses logical assignment (||=, &&=, ??=) that Chrome older than 85 cannot parse', () => {
  const bad = [];
  for (const s of scripts) read(s).split('\n').forEach((line, i) => { if (/(\|\||&&|\?\?)=(?!=)/.test(line.replace(/(["'`]).*?\1/g, ''))) bad.push(`${s}:${i + 1}`); });
  assert.equal(bad.join(', '), '');
});
