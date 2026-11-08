import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const a = source.indexOf('async function studentPhotoAdjust('), b = source.indexOf('async function reviewStudentPhoto(');
assert.ok(a > 0 && b > a, 'studentPhotoAdjust must be present');

function fixture({ approved = true } = {}) {
  const files = new Map(); if (approved) files.set('s-x', Buffer.from('approved face'));
  const student = { id: 'x', photo: approved }; let fail = false;
  const c = { Buffer, Date, JSON, Object, db: { students: [student] }, photoFile: (k, id) => k + '-' + id, str: (v) => String(v || ''),
    readBody: async (r) => r.body, send: (_, status, data) => ({ status, data }), saveDb: () => { if (fail) throw Error('save failed'); },
    fs: { existsSync: (p) => files.has(p), readFileSync: (p) => files.get(p), writeFileSync: (p, d) => files.set(p, Buffer.from(d)) } };
  vm.createContext(c); vm.runInContext(source.slice(a, b), c);
  const img = Buffer.alloc(200, 7); img[0] = 255; img[1] = 216; img[2] = 255;
  return { c, files, student, photo: 'data:image/jpeg;base64,' + img.toString('base64'), fail: () => (fail = true) };
}

test('Adjusting an approved photo replaces it immediately — no pending record, no approval', async () => {
  const f = fixture(); const r = await f.c.studentPhotoAdjust({ body: { photo: f.photo } }, {}, f.student);
  assert.equal(r.status, 200); assert.equal(f.student.pendingPhoto, undefined); assert.notEqual(f.files.get('s-x').toString(), 'approved face');
  assert.equal(f.student.photoAdjusts.length, 1);
});
test('Without an approved photo, or with a bad image, nothing changes', async () => {
  const none = fixture({ approved: false }); assert.equal((await none.c.studentPhotoAdjust({ body: { photo: none.photo } }, {}, none.student)).status, 400); assert.equal(none.files.has('s-x'), false);
  const f = fixture();
  for (const photo of ['data:image/png;base64,AAAA', 'data:image/jpeg;base64,' + Buffer.alloc(200).toString('base64'), '']) assert.equal((await f.c.studentPhotoAdjust({ body: { photo } }, {}, f.student)).status, 400);
  assert.equal(f.files.get('s-x').toString(), 'approved face');
});
test('At most 5 adjustments per day; a failed save restores the old photo', async () => {
  const f = fixture(); for (let i = 0; i < 5; i++) assert.equal((await f.c.studentPhotoAdjust({ body: { photo: f.photo } }, {}, f.student)).status, 200);
  assert.equal((await f.c.studentPhotoAdjust({ body: { photo: f.photo } }, {}, f.student)).status, 429);
  const g = fixture(); g.fail(); await assert.rejects(g.c.studentPhotoAdjust({ body: { photo: g.photo } }, {}, g.student), /save failed/);
  assert.equal(g.files.get('s-x').toString(), 'approved face'); assert.equal(g.student.photoAdjusts, undefined);
});
test('Route and dialog are wired: adjust needs a student login; new photos still go through approval', () => {
  assert.match(source, /p === "\/api\/student\/photo-adjust" && m === "POST"/);
  assert.match(source, /return studentPhotoAdjust\(req, res, student\);/);
  const ui = fs.readFileSync(new URL('../public/js/student.js', import.meta.url), 'utf8');
  assert.match(ui, /api\("\/api\/student\/photo-adjust", \{ body: \{ photo: r\.photo \} \}\)/);
  assert.match(ui, /api\("\/api\/student\/photo-request", \{ body: \{ photo: r\.photo, original: r\.original \} \}\)/);
});
