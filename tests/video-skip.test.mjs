import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL('../public/' + p, import.meta.url), 'utf8');

test('Every YouTube player on the site enables the JS API so the skip buttons can control it', () => {
  for (const f of ['js/common.js', 'js/student.js', 'js/qna.js']) assert.match(read(f), /youtube-nocookie\.com\/embed\/[^"]*enablejsapi=1&origin=/, f);
});
test('Skip script moves exactly 10 seconds and only touches controllable videos', () => {
  const s = read('js/video-skip.js');
  assert.match(s, /const STEP = 10/);
  assert.match(s, /data-d="-1"[^>]*>⏪ ১০ সেকেন্ড পিছনে/);
  assert.match(s, /data-d="1"[^>]*>১০ সেকেন্ড সামনে ⏩/);
  assert.match(s, /!v\.controls/);            // হিরো / ব্যাকগ্রাউন্ড ভিডিও (controls নেই) বাদ
  assert.match(s, /enablejsapi=1/);
  assert.match(s, /bar\.remove\(\)/);         // YouTube না পেলে বোতাম সরে যায়
  assert.match(s, /gone\)/);                  // ভিডিও সরলে বোতামও সরে
});
test('Pages that show lesson / popup videos load the skip script', () => {
  for (const p of ['index', 'student', 'learn', 'module', 'admin']) assert.match(read(p + '.html'), /<script src="\/js\/video-skip\.js"><\/script>/, p);
});
