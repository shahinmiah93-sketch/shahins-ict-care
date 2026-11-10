import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// সব বাংলা লেখা এক ফন্টে — Hind Siliguri (সর্বোচ্চ ওজন ৭০০)। আলাদা সেরিফ / Noto Sans Bengali ফন্ট বা ৮০০/৯০০ ওজন চাইলে ব্রাউজার
// অন্যরকম লেখা দেখায়। ইচ্ছাকৃতভাবে আলাদা: ইংরেজি লোগো/রসিদের ফন্ট (Cinzel, Oswald, Montserrat) আর আইডি-র মনোস্পেস।
const KEEP = /Cinzel|Oswald|Montserrat|Consolas|monospace|Tiro Bangla|BnNum|Kalpurush/i;
const root = new URL('../public/', import.meta.url);
const files = [];
const walk = (u) => { for (const e of fs.readdirSync(u, { withFileTypes: true })) { const c = new URL(e.name + (e.isDirectory() ? '/' : ''), u); if (e.isDirectory()) { if (e.name !== 'fonts') walk(c); } else if (/\.(css|js|html)$/.test(e.name) && !/\.min\.js$|^sw\.js$/.test(e.name)) files.push([e.name, fs.readFileSync(c, 'utf8')]); } };
walk(root);
test('No Bengali text uses the serif / Noto Sans Bengali font any more', () => {
  const bad = files.filter(([, s]) => /(['"])Noto (Serif|Sans) Bengali\1/.test(s)).map(([n]) => n);
  assert.equal(bad.join(', '), '');
});
test('IDs / PINs use the same font too (no monospace)', () => {
  assert.equal(files.filter(([, s]) => /Consolas/.test(s)).map(([n]) => n).join(', '), '');
});
test('No Bengali text asks for weight 800/900 (Hind Siliguri stops at 700)', () => {
  const bad = [];
  for (const [name, s] of files) for (const m of s.matchAll(/\{[^{}]*\}/g)) { const b = m[0]; if (KEEP.test(b)) continue; if (/font-weight\s*:\s*(800|900)\b|(^|[;\s{])font\s*:\s*(800|900)\s/.test(b)) bad.push(name + ' :: ' + b.slice(0, 90).replace(/\s+/g, ' ')); }
  assert.equal(bad.join('\n'), '');
});
test('No text stack starts with Arial before Hind Siliguri', () => {
  assert.equal(files.filter(([, s]) => /Arial\s*,\s*'Hind Siliguri'/.test(s)).map(([n]) => n).join(', '), '');
});
test('Every page loads CSS with a version so the fix reaches everyone', () => {
  for (const [name, s] of files.filter(([n]) => n.endsWith('.html'))) for (const m of s.matchAll(/href="(\/css\/[\w-]+\.css[^"]*)"/g)) assert.match(m[1], /\?v=/, name + ' ' + m[1]);
});
