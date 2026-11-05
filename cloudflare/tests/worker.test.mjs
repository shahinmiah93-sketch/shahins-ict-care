import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { seedDatabase } from "../../seed.mjs";
import { migrate } from "../scripts/migrate.mjs";

const base = process.env.CF_TEST_URL;
const token = "local-test-only";
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString("hex");
const fixture = seedDatabase();
fixture.ebooks = [{ id: "test-large-ebook", title: "Large PDF fixture", kind: "free", active: true }];
const student = fixture.students.find(s => s.status !== "inactive");
fixture.quizzes = [{ id: "test_quiz", title: "Cloud quiz test", live: true, open: true, questions: [{ id: "q1", text: "Q", options: ["A", "B"], correct: 0 }], session: "", batchIds: [], duration: 1, mark: 1, negative: false, attemptsAllowed: 2, showAnswers: true, attempts: { [student.id]: [{ no: 1, startedMs: 1, order: ["q1"] }] } }];
const auth = { email: "test@example.invalid", salt: "fixture-password-salt", pinSalt: "fixture-pin-salt", hash: hash("fixture-password", "fixture-password-salt"), pinHash: hash("123456", "fixture-pin-salt") };

test("Real Cloudflare runtime: import, static assets, auth, file upload, records and quiz", { skip: !base }, async () => {
  const local = new URL(base);
  assert.ok(["127.0.0.1", "localhost"].includes(local.hostname), "Tests are restricted to a local emulator");
  let cookie = "";
  async function call(route, body, opts = {}) {
    const r = await fetch(base + route, { method: body === undefined ? "GET" : "POST", ...opts,
      headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(cookie ? { cookie } : {}), ...opts.headers },
      body: body === undefined ? opts.body : JSON.stringify(body) });
    const set = r.headers.getSetCookie();
    if (set.length) cookie = [...cookie.split("; ").filter(Boolean).filter(c => !set.some(s => c.split("=")[0] === s.split("=")[0])), ...set.map(s => s.split(";")[0])].join("; ");
    const data = await r.json();
    return { status: r.status, data };
  }
  const before = await call("/api/health");
  if (!before.data.migrated) {
    assert.equal((await call("/api/public")).status, 503);
    assert.equal((await call("/__migration/status")).status, 404);
    const files = Object.entries({ "database.json": fixture, "auth.json": auth }).map(([path, value]) => {
      const body = Buffer.from(JSON.stringify(value));
      return { path, size: body.length, sha256: crypto.createHash("sha256").update(body).digest("hex"), body };
    });
    await migrate(base, token, files, () => {});
  }
  assert.equal((await call("/api/health")).data.migrated, true);
  assert.equal((await call("/api/public")).status, 200);
  assert.equal((await call("/api/admin/db")).status, 401);
  assert.equal((await call("/api/admin/admission-import", { rows: [] })).status, 401);
  assert.equal((await call("/api/admin/gallery-delete", { ids: ["not-a-real-photo"] })).status, 401);
  assert.equal((await call("/api/admin/setup", {})).status, 400);
  assert.equal((await fetch(base + "/__migration/commit", { method: "POST", headers: { authorization: "Bearer " + token }, body: "{}" })).status, 409);
  for (const route of ["/", "/admin", "/student", "/books", "/quiz", "/courses", "/daily", "/online-apply", "/js/admin-books.js", "/css/site.css"]) {
    const r = await fetch(base + route); assert.equal(r.status, 200, route); await r.arrayBuffer();
  }
  for (const route of ["/data/database.json", "/data/auth.json", "/server.mjs", "/cloudflare/wrangler.jsonc"]) {
    const r = await fetch(base + route); assert.equal(r.status, 404, route); await r.arrayBuffer();
  }
  const pin = await call("/api/admin/pin", { pin: "123456" });
  assert.equal(pin.status, 200);
  assert.equal((await call("/api/admin/login", { ticket: pin.data.ticket, email: auth.email, password: "fixture-password" })).status, 200);
  const ebookRoute = "/api/admin/ebooks/test-large-ebook/pdf";
  const pdf = Buffer.alloc(80 * 1024 * 1024, 65);
  pdf.write("%PDF-1.7");
  const ebookUploaded = await call(ebookRoute, undefined, { method: "POST", body: pdf, headers: { "content-type": "application/pdf" } });
  assert.equal(ebookUploaded.status, 200);
  assert.equal(ebookUploaded.data.item.pdf.size, pdf.length);
  const ebookDownload = await fetch(base + ebookRoute, { headers: { cookie } });
  assert.equal(ebookDownload.status, 200);
  const digest = crypto.createHash("sha256");
  for await (const chunk of ebookDownload.body) digest.update(chunk);
  assert.equal(digest.digest("hex"), crypto.createHash("sha256").update(pdf).digest("hex"));
  assert.equal((await call(ebookRoute, undefined, { method: "DELETE" })).status, 200);
  const admin = await call("/api/admin/db");
  assert.equal(admin.status, 200);
  // Sparse Excel admission uses the original fee engine and is all-or-nothing.
  const importBatch = admin.data.batches.find(b => b.active !== false);
  const importCourse = admin.data.courses.find(c => c.active !== false && c.feeType === "monthly");
  const importPayload = { defaults: { batchId: importBatch.id, courseId: importCourse.id, admissionDate: "2026-08-15" }, rows: [{ name: "Synthetic Excel admission", paid: "500" }, { nameEn: "Sparse synthetic admission" }] };
  const preview = await call("/api/admin/admission-import", importPayload);
  assert.equal(preview.status, 200); assert.equal(preview.data.errors.length, 0);
  if (preview.data.summary.create) {
    assert.equal(preview.data.summary.create, 2);
    const imported = await call("/api/admin/admission-import", { ...importPayload, commit: true, previewToken: preview.data.token });
    assert.equal(imported.status, 200); assert.equal(imported.data.ids.length, 2);
    const replay = await call("/api/admin/admission-import", { ...importPayload, commit: true, previewToken: preview.data.token });
    assert.equal(replay.data.alreadyImported, true);
    const saved = await call("/api/admin/db");
    const record = saved.data.students.find(s => s.id === imported.data.ids[0]);
    assert.equal(record.phone, ""); assert.equal(record.gender, ""); assert.equal(record.admissionDate, "2026-08-15");
    assert.equal(saved.data.enrollments.find(e => e.studentId === record.id).startDate, "2026-08-15");
    assert.equal(record.fees.totalDue, preview.data.rows[0].fees.totalDue);
    assert.equal(saved.data.payments.find(p => p.studentId === record.id).date, "2026-08-15");
  } else assert.equal(preview.data.summary.skip, 2);
  const demo = await fetch(base + "/templates/Admission-Import-Demo.xlsx");
  assert.equal(demo.status, 200); assert.ok((await demo.arrayBuffer()).byteLength > 1000);
  if (before.data.migrated) {
    assert.ok(admin.data.notices.some(n => n.title === "Cloudflare test notice"), "Saved record survives a runtime restart");
    assert.ok(admin.data.quizzes.find(q => q.id === "test_quiz").attempts[student.id].some(a => a.no === 2 && a.submittedAt), "Quiz submission survives a runtime restart");
  }
  // New record writes and private backups must work through SQLite.
  const notice = await call("/api/admin/c/notices", { title: "Cloudflare test notice", body: "Persist this notice", public: true, date: "2026-11-03" });
  assert.equal(notice.status, 200);
  const backup = await call("/api/admin/backup");
  assert.equal(backup.status, 200);
  const updated = await call("/api/admin/db");
  assert.ok(updated.data.notices.some(n => n.title === "Cloudflare test notice"));
  // A file larger than one SQLite chunk must round-trip without truncation.
  const image = Buffer.alloc(300000, 87);
  const teacher = updated.data.teachers[0];
  const uploaded = await call(`/api/admin/teachers/${teacher.id}/image?ext=.png`, undefined, { method: "POST", headers: { "content-type": "image/png" }, body: image });
  assert.equal(uploaded.status, 200);
  const download = await fetch(`${base}/api/tphoto/${teacher.id}/image`);
  assert.equal(download.status, 200);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), image);
  const galleryIds = [];
  for (let i = 0; i < 2; i++) {
    const photo = await call("/api/admin/c/gallery", { title: "Bulk deletion fixture " + i, album: "Test only", active: true });
    assert.equal(photo.status, 200); galleryIds.push(photo.data.item.id);
    assert.equal((await call(`/api/admin/gallery/${photo.data.item.id}/image?ext=.png`, undefined, { method: "POST", headers: { "content-type": "image/png" }, body: image })).status, 200);
  }
  const removed = await call("/api/admin/gallery-delete", { ids: galleryIds });
  assert.equal(removed.status, 200); assert.equal(removed.data.deleted, 2);
  assert.equal((await call("/api/admin/gallery-delete", { ids: galleryIds })).data.deleted, 0);
  const afterGallery = await call("/api/admin/db");
  assert.equal(afterGallery.data.gallery.length, updated.data.gallery.length);
  assert.equal((await fetch(`${base}/api/gphoto/${galleryIds[0]}/image`)).status, 404);
  assert.equal((await call("/api/student/login", { id: student.id, pin: student.pin })).status, 200);
  assert.equal((await call("/api/student/me")).status, 200);
  const quizStart = await call("/api/student/quiz/start", { id: "test_quiz" });
  if (quizStart.status === 200) {
    assert.equal(quizStart.data.attemptNo, 2);
    assert.equal((await call("/api/student/quiz/submit", { id: "test_quiz", attemptNo: 1, answers: { q1: 0 } })).status, 410);
    const submitted = await call("/api/student/quiz/submit", { id: "test_quiz", attemptNo: 2, answers: { q1: 0 } });
    assert.equal(submitted.status, 200); assert.equal(submitted.data.result.score, 1);
    assert.equal((await call("/api/student/quiz/start", { id: "test_quiz" })).status, 400);
  } else assert.equal(quizStart.status, 400); // Re-running against the same persisted fixture.
  const blockedOrigin = await call("/api/admin/pin", { pin: "123456" }, { headers: { origin: "https://untrusted.example" } });
  assert.equal(blockedOrigin.status, 403);
});
