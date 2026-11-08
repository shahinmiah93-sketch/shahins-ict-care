import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const a = source.indexOf('const RICH_TAGS'), b = source.indexOf('const dailyBody', a);
assert.ok(a > 0 && b > a, 'rich text block must be present');
const end = source.indexOf('\n', b);
const ctx = { str: (v, n = 500) => String(v ?? '').trim().slice(0, n) };
vm.createContext(ctx);
vm.runInContext(source.slice(a, end), ctx);
const clean = (h) => vm.runInContext('cleanRichHtml', ctx)(h);

test('Word-style formatting survives: bold, colour, highlight, size, alignment, lists, headings', () => {
  const h = '<h2>শিরোনাম</h2><p style="text-align: center;"><b>মোটা</b> <span style="color: rgb(243, 197, 93); font-size: 21px;">রঙিন</span> <span style="background-color: #fff3a3">হাইলাইট</span></p><ul><li>এক</li><li>দুই</li></ul>';
  const out = clean(h);
  assert.match(out, /<h2>শিরোনাম<\/h2>/);
  assert.match(out, /<p style="text-align:center">/);
  assert.match(out, /<b>মোটা<\/b>/);
  assert.match(out, /color:rgb\(243, 197, 93\);font-size:21px/);
  assert.match(out, /background-color:#fff3a3/);
  assert.match(out, /<ul><li>এক<\/li><li>দুই<\/li><\/ul>/);
});
test('Scripts, event handlers, links, images, dangerous styles are all removed', () => {
  const out = clean('<p onclick="x()" style="color:red;background:url(javascript:1);position:fixed">hi</p><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">l</a><iframe src="//evil"></iframe><style>*{display:none}</style><svg onload=alert(1)></svg>');
  assert.equal(out, '<p style="color:red">hi</p>l');
  assert.ok(!/script|onerror|onclick|javascript|iframe|svg|<img|<a /i.test(out));
});
test('Broken markup is balanced and stray angle brackets are escaped', () => {
  assert.equal(clean('<b>a<i>b</b>c'), '<b>a<i>b</i></b>c');
  assert.equal(clean('1 < 2 & 3 > 2'), '1 &lt; 2 &amp; 3 &gt; 2');
  assert.equal(clean('<p>x</p></div></div>'), '<p>x</p>');
});
test('Empty editor content becomes empty; plain text is derived for excerpts', () => {
  assert.equal(clean('<p><br></p>'), '');
  assert.equal(clean(''), '');
  const body = vm.runInContext('dailyBody', ctx)({ bodyHtml: '<h2>এক</h2><p>দুই <b>তিন</b></p><ul><li>চার</li></ul>' });
  assert.equal(body.body, 'এক\nদুই তিন\nচার');
  assert.ok(body.bodyHtml.includes('<b>তিন</b>'));
  assert.deepEqual({ ...vm.runInContext('dailyBody', ctx)({ body: 'শুধু লেখা' }) }, { bodyHtml: '', body: 'শুধু লেখা' });
});
test('Daily post API exposes the sanitised html and the page prefers it', () => {
  assert.match(source, /html: d\.bodyHtml \|\| ""/);
  assert.match(fs.readFileSync(new URL('../public/js/daily.js', import.meta.url), 'utf8'), /const paras = p\.html \|\| plainHtml\(p\.body\)/);
});
