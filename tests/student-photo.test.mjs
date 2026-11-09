import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
function fixture() {
  const files = new Map([['db', Buffer.from('{}')]]), student = { id: 'fixture', photo: true }, original = Buffer.from('previous approved photo'); files.set('s-fixture', original);
  let sequence = 0, fail = false;
  const c = { Buffer, Date, JSON, Object, db: { students: [student] }, readBody: async (req) => req.body, send: (_, status, data) => ({ status, data }), str: (v) => String(v || ''), uid: () => String(++sequence),
    photoFile: (kind, id) => kind + '-' + id, DB_FILE: 'db', BACKUPS: 'backups', path: { join: (...s) => s.join('/') }, saveDb: () => { if (fail) throw Error('save failed'); }, removePhoto: (kind, id) => files.delete(kind + '-' + id),
    fs: { existsSync: (p) => files.has(p), readFileSync: (p) => files.get(p), writeFileSync: (p, b) => files.set(p, Buffer.from(b)), copyFileSync: (a, b) => { if (!files.has(a)) throw Error('missing'); files.set(b, Buffer.from(files.get(a))); } } };
  vm.createContext(c); vm.runInContext(source.slice(source.indexOf('function originalBytes('), source.indexOf('const removePhoto = ')), c); vm.runInContext(source.slice(source.indexOf('async function studentPhotoRequest('), source.indexOf('async function api(')), c);
  const image = Buffer.alloc(150, 7); image[0] = 255; image[1] = 216; image[2] = 255;
  return { c, files, student, original, photo: 'data:image/jpeg;base64,' + image.toString('base64'), fail: () => (fail = true) };
}

test('A student photo goes live at once — no approval; the previous photo is backed up; any pending request is cleared', async () => {
  const f = fixture(); f.student.pendingPhoto = { version: 'old' }; f.files.set('p-fixture', Buffer.from('stale pending'));
  const r = await f.c.studentPhotoRequest({ body: { photo: f.photo } }, {}, f.student);
  assert.equal(r.status, 200);
  assert.notDeepEqual(f.files.get('s-fixture'), f.original);                                     // সাথে সাথে বদলেছে
  assert.equal(f.student.pendingPhoto, undefined); assert.equal(f.files.has('p-fixture'), false);
  assert.equal(f.student.photo, true); assert.equal(f.student.photoReview.status, 'approved'); assert.equal(f.student.photoReview.auto, true);
  assert.ok([...f.files.keys()].some((k) => k.startsWith('backups/photo-self-') && k.endsWith('-previous.jpg')));
  assert.equal(f.student.photoUploads.length, 1);
});
test('First photo of a student without one is accepted too; invalid payloads change nothing', async () => {
  const f = fixture(); f.files.delete('s-fixture'); f.student.photo = false;
  assert.equal((await f.c.studentPhotoRequest({ body: { photo: f.photo } }, {}, f.student)).status, 200); assert.equal(f.student.photo, true); assert.ok(f.files.has('s-fixture'));
  for (const photo of ['data:image/svg+xml;base64,PHN2Zz4=', 'data:image/jpeg;base64,' + Buffer.alloc(150).toString('base64'), '']) {
    const g = fixture(); assert.equal((await g.c.studentPhotoRequest({ body: { photo } }, {}, g.student)).status, 400); assert.deepEqual(g.files.get('s-fixture'), g.original); assert.equal(g.student.photoUploads, undefined);
  }
});
test('At most 10 uploads a day, and a failed save restores the old photo and record', async () => {
  const f = fixture(); for (let i = 0; i < 10; i++) assert.equal((await f.c.studentPhotoRequest({ body: { photo: f.photo } }, {}, f.student)).status, 200);
  assert.equal((await f.c.studentPhotoRequest({ body: { photo: f.photo } }, {}, f.student)).status, 429);
  const g = fixture(); const before = JSON.stringify(g.student); g.fail();
  await assert.rejects(g.c.studentPhotoRequest({ body: { photo: g.photo } }, {}, g.student), /save failed/);
  assert.equal(JSON.stringify(g.student), before); assert.deepEqual(g.files.get('s-fixture'), g.original);
});
test('Old pending requests (made before this change) can still be approved or rejected by admin', async () => {
  const f = fixture(); f.student.pendingPhoto = { version: 'v1' }; f.files.set('p-fixture', Buffer.from('pending face'));
  assert.equal((await f.c.reviewStudentPhoto({ body: { id: 'fixture', action: 'approve', version: 'wrong' } }, {})).status, 409);
  assert.equal((await f.c.reviewStudentPhoto({ body: { id: 'fixture', action: 'approve', version: 'v1' } }, {})).status, 200);
  assert.equal(f.files.get('s-fixture').toString(), 'pending face'); assert.equal(f.student.pendingPhoto, undefined);
  const g = fixture(); g.student.pendingPhoto = { version: 'v2' }; g.files.set('p-fixture', Buffer.from('pending face'));
  await g.c.reviewStudentPhoto({ body: { id: 'fixture', action: 'reject', version: 'v2' } }, {}); assert.deepEqual(g.files.get('s-fixture'), g.original); assert.equal(g.student.photoReview.status, 'rejected');
});
test('Student dialog no longer talks about approval for new photos', () => {
  const ui = fs.readFileSync(new URL('../public/js/student.js', import.meta.url), 'utf8');
  assert.doesNotMatch(ui, /অনুমোদনের জন্য পাঠান/);
  assert.doesNotMatch(ui, /অ্যাডমিনের অনুমোদন লাগবে/);
  assert.match(ui, /ছবি বদলেছে।/);
});
