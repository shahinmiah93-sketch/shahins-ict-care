import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// সাধারণ লেখার ফন্ট Hind Siliguri (সর্বোচ্চ ওজন ৭০০)। ৮০০/৯০০ চাইলে ব্রাউজার আলাদা, অন্যরকম মোটা লেখা দেখায় —
// তাই সান্স লেখায় ৮০০/৯০০ চলবে না। (সেরিফ শিরোনাম, Noto Sans Bengali হিরো, Cinzel লোগো, মনোস্পেস আইডি ইচ্ছাকৃত ডিজাইন।)
const DISPLAY = /Noto Serif|Noto Sans Bengali|var\(--serif\)|Cinzel|Oswald|Montserrat|Tiro|Consolas|monospace/i;
const dir = new URL('../public/css/', import.meta.url);
const bad = [], arial = [];
for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.css'))) {
  const css = fs.readFileSync(new URL(name, dir), 'utf8');
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim(), body = m[2];
    if (/Arial\s*,\s*'Hind Siliguri'/.test(body)) arial.push(name + ' :: ' + sel);
    const heavy = /font-weight\s*:\s*(800|900)\b|(^|[;\s])font\s*:\s*(800|900)\s/.test(body);
    if (!heavy || DISPLAY.test(body)) continue;
    if (/(^|[\s,>+~])h[1-4]\b/i.test(sel) && !/var\(--sans\)/.test(body)) continue; // হেডিং ডিফল্টে সেরিফ
    bad.push(name + ' :: ' + sel.replace(/\s+/g, ' ').slice(0, 80));
  }
}
test('No sans-serif text asks for weight 800/900 (Hind Siliguri stops at 700)', () => { assert.equal(bad.join('\n'), ''); });
test('No text stack starts with Arial before Hind Siliguri', () => { assert.equal(arial.join('\n'), ''); });
test('Every page loads CSS with the same fresh version so the fix reaches everyone', () => {
  const pub = new URL('../public/', import.meta.url);
  for (const f of fs.readdirSync(pub).filter((x) => x.endsWith('.html'))) {
    const html = fs.readFileSync(new URL(f, pub), 'utf8');
    for (const m of html.matchAll(/href="(\/css\/[\w-]+\.css[^"]*)"/g)) assert.match(m[1], /\?v=/, f + ' ' + m[1]);
  }
});
