// ফাইল বদলালে পাতার লিঙ্কের ?v=… নিজে বদলে দেয়, তাই কারও ব্রাউজার বা অ্যাপ পুরোনো JS / CSS ধরে রাখে না।
// চালান:  node scripts/stamp-assets.mjs   (JS বা CSS বদলানোর পর, push-এর আগে)
// টেস্ট (tests/asset-versions.test.mjs) চেক করে সব লিঙ্কের সংস্করণ ফাইলের সাথে মিলছে কি না — না মিললে টেস্ট ফেল করে।
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');
// লাইন-শেষ (CRLF / LF) আলাদা হলেও একই সংস্করণ
export const hashOf = (file) => crypto.createHash('sha1').update(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).digest('hex').slice(0, 8);
export const LINK = /((?:src|href)=")(\/(?:js|css)\/[\w.-]+\.(?:js|css))(?:\?v=[^"]*)?(")/g;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let links = 0, pages = 0;
  for (const name of fs.readdirSync(pub).filter((f) => f.endsWith('.html'))) {
    const p = path.join(pub, name), s = fs.readFileSync(p, 'utf8');
    const out = s.replace(LINK, (m, a, url, c) => {
      const file = path.join(pub, url);
      if (!fs.existsSync(file)) return m;
      links++;
      return `${a}${url}?v=${hashOf(file)}${c}`;
    });
    if (out !== s) { fs.writeFileSync(p, out); pages++; }
  }
  console.log(`সংস্করণ বসানো হয়েছে: ${links}টি লিঙ্ক, ${pages}টি পাতা বদলেছে`);
}
