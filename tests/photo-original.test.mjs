import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const a = source.indexOf('function originalBytes('), b = source.indexOf('\n}', a) + 2;
assert.ok(a > 0 && b > a, 'originalBytes must be present');
const ctx = { Buffer, String }; vm.createContext(ctx); vm.runInContext(source.slice(a, b), ctx);
const check = (v) => vm.runInContext('originalBytes', ctx)(v);
const jpeg = (n) => 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([255, 216, 255]), Buffer.alloc(n)]).toString('base64');

test('Original photo must be a real JPEG within 1.5 MB', () => {
  assert.ok(check(jpeg(5000)));
  assert.equal(check(jpeg(1536 * 1024)), null);       // একটু বেশি বড়
  assert.equal(check('data:image/png;base64,AAAA'), null);
  assert.equal(check('data:image/jpeg;base64,' + Buffer.alloc(500).toString('base64')), null); // JPEG-র শুরুর চিহ্ন নেই
  assert.equal(check(''), null);
});
test('Original is stored with the pending photo and promoted on approval; fallback and download work', () => {
  assert.match(source, /ofile = photoFile\("o", student\.id\)/);                                   // এখন সরাসরি মূল ছবি হিসেবে জমা (অনুমোদন ছাড়া)
  assert.match(source, /if \(orig\) fs\.writeFileSync\(ofile, orig\); else removePhoto\("o", student\.id\);/);
  assert.match(source, /fs\.copyFileSync\(po, photoFile\("o", student\.id\)\); else removePhoto\("o", student\.id\);/);
  assert.match(source, /function sendPhoto\(res, kind, id, opts = \{\}\)/);
  assert.match(source, /opts\.fallback/);
  assert.match(source, /Content-Disposition/);
  assert.match(source, /\/api\/student\/photo-original/);
  assert.match(source, /\\\/photo\\\/\(s\|a\|p\|o\|po\)\\\//);
});
test('Original files follow the student: renumber, delete and sample-clear all include them', () => {
  assert.match(source, /for \(const kind of \["s","p","o","po"\]\) for \(const id of/);
  assert.match(source, /removePhoto\("s", id\); removePhoto\("o", id\); removePhoto\("p", id\); removePhoto\("po", id\);/);
  assert.match(source, /\["s", "p", "o", "po"\]\.forEach\(\(k\) => removePhoto\(k, s\.id\)\)/);
});
test('Student and admin screens use the crop editor and send the original too', () => {
  const student = fs.readFileSync(new URL('../public/js/student.js', import.meta.url), 'utf8'), admin = fs.readFileSync(new URL('../public/js/admin.js', import.meta.url), 'utf8');
  assert.match(student, /SICPhotoCrop\.create/);
  assert.match(student, /body: \{ photo: r\.photo, original: r\.original \}/);
  assert.match(admin, /SICPhotoCrop\.dialog/);
  assert.match(admin, /original: photoOriginal/);
  assert.ok(fs.existsSync(new URL('../public/js/photo-crop.js', import.meta.url)));
  for (const page of ['student.html', 'admin.html']) assert.match(fs.readFileSync(new URL('../public/' + page, import.meta.url), 'utf8'), /\/js\/photo-crop\.js/);
});
