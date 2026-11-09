import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const js = fs.readFileSync(new URL('../public/js/books.js', import.meta.url), 'utf8'), css = fs.readFileSync(new URL('../public/css/books.css', import.meta.url), 'utf8');

test('Book cards no longer print the description; a "বিবরণ দেখুন" link opens it', () => {
  const card = js.slice(js.indexOf('function card(b)'), js.indexOf('function openBook'));
  assert.doesNotMatch(card, /esc\(b\.short\)/);
  assert.match(card, /data-open="\$\{b\.id\}">বিবরণ দেখুন →/);
  assert.match(card, /<div class="bk-cv" data-open=/);              // ছবিতে চাপলেও খোলে
  assert.match(js, /className = "bk-dlg"/);
  assert.match(js, /esc\(x\)\}<\/p>/);                              // পপআপে বিবরণ অনুচ্ছেদ ধরে
  assert.match(js, /if \(\(el = t\("\[data-open\]"\)\)\) return openBook\(el\.dataset\.open\);/);
});
test('Cover boxes have a fixed size whatever the image: image is absolutely positioned inside a clipped 3:4 box', () => {
  assert.match(css, /\.bk-cv\{position:relative;aspect-ratio:3\/4;[^}]*overflow:hidden/);
  assert.match(css, /\.bk-cv img\{position:absolute;inset:0;width:100%;height:100%;object-fit:cover/);
  assert.match(css, /\.bk-cv-ph\{position:absolute;inset:0;/);
});
test('Admin book form tells the best cover size (3:4, 900×1200) and warns about cropping', () => {
  const admin = fs.readFileSync(new URL('../public/js/admin-books.js', import.meta.url), 'utf8');
  assert.match(admin, /খাড়া, ৩:৪ — সবচেয়ে ভালো ৯০০ × ১২০০ পিক্সেল/);
  assert.match(admin, /অন্য মাপ দিলে কিনারা কেটে যায়/);
});
test('Popup can add to cart and fits the screen', () => {
  assert.match(js, /bk-dadd/);
  assert.match(css, /\.bk-dlg\{[^}]*max-height:calc\(100vh - 24px\)/);
});
