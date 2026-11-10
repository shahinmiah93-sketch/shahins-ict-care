import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashOf, LINK } from '../scripts/stamp-assets.mjs';

const pub = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

test('Every JS / CSS link in every page carries the current version of that file (run: node scripts/stamp-assets.mjs)', () => {
  const stale = [];
  for (const name of fs.readdirSync(pub).filter((f) => f.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(pub, name), 'utf8');
    for (const m of html.matchAll(new RegExp(LINK.source, 'g'))) {
      const file = path.join(pub, m[2]);
      if (!fs.existsSync(file)) continue;
      const want = '?v=' + hashOf(file), tag = m[0].match(/\?v=[^"]*/);
      if (!tag || tag[0] !== want) stale.push(`${name} → ${m[2]} (${tag ? tag[0] : 'no version'} ≠ ${want})`);
    }
  }
  assert.equal(stale.join('\n'), '', 'বদলানো ফাইলের সংস্করণ বসেনি — চালান: node scripts/stamp-assets.mjs');
});

test('The admin and student pages are covered, so an open tab / app cannot keep running old code after a reload', () => {
  for (const page of ['admin.html', 'student.html', 'index.html']) {
    const html = fs.readFileSync(path.join(pub, page), 'utf8');
    const scripts = [...html.matchAll(/<script[^>]*src="(\/js\/[^"]+)"/g)].map((m) => m[1]);
    assert.ok(scripts.length > 0, page);
    for (const s of scripts) assert.match(s, /\?v=[0-9a-f]{8}$/, page + ' ' + s);
  }
});
