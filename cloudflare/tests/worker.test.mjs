import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { seedDatabase } from "../../seed.mjs";
import { migrate } from "../scripts/migrate.mjs";

const base = process.env.CF_TEST_URL;
const token = "local-test-only";
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString("hex");
const fixture = seedDatabase();
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
  const admin = await call("/api/admin/db");
  assert.equal(admin.status, 200);
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
