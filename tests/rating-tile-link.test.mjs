import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const site = read('public/js/site.js'), css = read('public/css/site.css'), html = read('public/index.html');

test('The rating tile on the home page jumps to the students\' reviews section', () => {
  assert.match(site, /"star", "#reviews"\]/);                      // only the rating tile carries a target
  assert.match(site, /class="stat-go" role="link" tabindex="0" data-go="\$\{go\}"/);
  assert.match(site, /\$\$\("#stats \.stat-go"\)/);
  assert.match(site, /!t\.hidden\) t\.scrollIntoView/);             // hidden section: do nothing
  assert.match(site, /e\.key === "Enter" \|\| e\.key === " "/);     // keyboard works too
  assert.match(css, /\.stats \.stat-go\{cursor:pointer\}/);
  assert.match(site, /"সফল শিক্ষার্থী", "trophy", "#achievers"\]/); // the successful-students tile too
  assert.match(css, /#achievers\{scroll-margin-top/);
  assert.match(html, /site\.css\?v=20261110-fonts/);
  assert.ok(html.includes('id="reviews"') && html.includes('id="achievers"'));
});
