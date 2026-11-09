import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const css = fs.readFileSync(new URL('../public/css/app.css', import.meta.url), 'utf8');

test('Student photo ring is a rotating multi-colour gradient, hollow so it never covers the photo', () => {
  assert.match(css, /\.stu-hero #av\.avatar::before\{content:"";position:absolute;inset:-9px;border-radius:50%;padding:5px/);
  assert.match(css, /conic-gradient\(#f3c55d,#ff9f43,#ff6b9d,#b794f6,#63b3ff,#4fd1c5,#9be564,#f3c55d\)/);
  assert.match(css, /mask-composite:xor/);                       // ফাঁপা রিং
  assert.match(css, /animation:av-ring-spin 5s linear infinite/);
  assert.match(css, /@keyframes av-ring-spin\{to\{transform:rotate\(360deg\)\}\}/);
});
test('Ring animation respects reduced-motion; the old flat gold ring is gone; mobile ring is thinner', () => {
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.stu-hero #av\.avatar::before\{animation:none\}/);
  assert.doesNotMatch(css, /0 0 0 4px rgba\(243,197,93,\.95\)/);
  assert.match(css, /\.stu-hero #av\.avatar::before\{inset:-5px;padding:4px\}/);
});
