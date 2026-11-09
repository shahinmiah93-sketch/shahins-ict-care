import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const css = fs.readFileSync(new URL('../public/css/app.css', import.meta.url), 'utf8');

test('Student photo ring: rotating rainbow ring with a bright comet, hollow so it never covers the photo', () => {
  assert.match(css, /\.stu-hero #av\.avatar::before\{content:"";position:absolute;inset:-9px;border-radius:50%;padding:5px/);
  assert.match(css, /conic-gradient\(#f3c55d,#ff9f43,#ff6b9d,#b794f6,#63b3ff,#4fd1c5,#9be564,#f3c55d\)/);
  assert.match(css, /rgba\(255,255,255,\.95\) 94%/);                   // ধূমকেতুর উজ্জ্বল টান
  assert.match(css, /mask-composite:xor/);                                 // ফাঁপা রিং
  assert.match(css, /animation:av-spin 14s linear infinite/);
  assert.match(css, /@keyframes av-spin\{to\{transform:rotate\(360deg\)\}\}/);
});
test('Aurora glow is outside only (hollow mask), badge is glass with a ping wave, caption sits inside the circle on hover, avatar floats', () => {
  assert.match(css, /\.stu-hero #av\.avatar::after\{content:"";position:absolute;inset:-26px;[^}]*filter:blur\(14px\)/);
  assert.match(css, /mask:radial-gradient\(closest-side,transparent 72%/);
  assert.match(css, /#av \.av-cam::after\{[^}]*animation:av-ping 2\.6s ease-out infinite/);
  assert.match(css, /#av:hover \.av-tip,#av:focus-visible \.av-tip\{opacity:1;transform:translate\(-50%,0\)\}/);
  assert.match(css, /@keyframes av-float\{50%\{translate:0 -4px\}\}/);
  assert.match(css, /animation:av-float 6s ease-in-out infinite/);
});
test('Reduced-motion stops every animation; the old flat gold ring is gone; mobile gets a smaller avatar and ring', () => {
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.stu-hero #av\.avatar,\.stu-hero #av\.avatar::before,\.stu-hero #av\.avatar::after,#av \.av-cam::after\{animation:none\}\}/);
  assert.doesNotMatch(css, /0 0 0 4px rgba\(243,197,93,\.95\)/);
  assert.doesNotMatch(css, /av-ring-spin/);
  assert.match(css, /\.stu-hero #av\.avatar\{--av:80px;border-width:3px!important\}/);
  assert.match(css, /\.stu-hero #av\.avatar::before\{inset:-5px;padding:4px\}/);
});
