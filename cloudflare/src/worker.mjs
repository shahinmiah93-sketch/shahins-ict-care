import { DurableObject } from "cloudflare:workers";
import crypto from "node:crypto";
import { SQLiteFS, MAX_UPLOAD, MAX_EBOOK_UPLOAD } from "./sqlite-fs.mjs";
import { createApplication } from "./application.mjs";
import { nodeRequest, nodeResponse } from "./node-bridge.mjs";

const ROUTES = { "/": "/index.html", "/admin": "/admin.html", "/student": "/student.html", "/login": "/student.html", "/apply": "/apply.html", "/quiz": "/quiz.html", "/talent-hunt": "/talent.html", "/courses": "/learn.html", "/course": "/learn.html", "/free-classes": "/learn.html", "/module": "/module.html", "/online-apply": "/online-apply.html", "/admission": "/admission.html", "/daily": "/daily.html", "/books": "/books.html" };
const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
function secure(response) {
  const r = new Response(response.body, response);
  r.headers.set("X-Content-Type-Options", "nosniff");
  r.headers.set("X-Frame-Options", "SAMEORIGIN");
  r.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return r;
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/__migration/")) {
      const headers = new Headers(request.headers);
      // Authenticate against the current Worker deployment's secret, rather than an
      // already-running object's constructor environment. Never trust a client marker.
      headers.delete("x-sic-migration-authorized");
      if (url.pathname.startsWith("/__migration/")) {
        const expected = env.MIGRATION_TOKEN || "";
        const received = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
        const digest = value => crypto.createHash("sha256").update(value).digest();
        if (!expected || !crypto.timingSafeEqual(digest(expected), digest(received))) return secure(json({ error: "Not found" }, 404));
        headers.set("x-sic-migration-authorized", "1");
      }
      return secure(await env.SCHOOL.get(env.SCHOOL.idFromName("school-v1")).fetch(new Request(request, { headers })));
    }
    if (request.method !== "GET" && request.method !== "HEAD") return secure(json({ error: "Method not allowed" }, 405));
    url.pathname = ROUTES[url.pathname] || url.pathname;
    return secure(await env.ASSETS.fetch(new Request(url, request)));
  }
};

export class School extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env;
    this.fs = new SQLiteFS(ctx.storage);
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS migration (id INTEGER PRIMARY KEY CHECK(id=1), status TEXT NOT NULL)");
    this.queue = Promise.resolve();
    this.app = null;
  }
  serial(fn) {
    const task = this.queue.then(fn);
    this.queue = task.catch(() => {});
    return task;
  }
  ready() { return [...this.ctx.storage.sql.exec("SELECT status FROM migration WHERE id=1")][0]?.status === "ready"; }
  async fetch(request) {
    return this.serial(async () => {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/__migration/")) return this.migrate(request, url);
      if (url.pathname === "/api/health") return json({ ok: true, app: "shahins-ict-care", storage: "cloudflare-sqlite", migrated: this.ready() });
      if (!this.ready()) return json({ error: "ডেটা স্থানান্তর চলছে — কিছুক্ষণ পরে চেষ্টা করুন" }, 503);
      const length = Number(request.headers.get("content-length") || 0);
      const ebookUpload = request.method === "POST" && /^\/api\/admin\/ebooks\/[\w-]+\/pdf$/.test(url.pathname);
      const uploadLimit = ebookUpload ? MAX_EBOOK_UPLOAD : MAX_UPLOAD;
      if (length > uploadLimit) return json({ error: ebookUpload ? "PDF ৮০ MB-এর মধ্যে দিন" : "Cloudflare-এ সর্বোচ্চ ২০ MB; বড় ভিডিওর জন্য YouTube লিংক দিন" }, 413);
      const { res, completed } = nodeResponse();
      try {
        this.app ||= createApplication(this.fs, this.env);
        await this.app.api(nodeRequest(request), res, url);
        const response = await completed;
        await this.app.settle();
        if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + 60000);
        return response;
      } catch (e) {
        console.error("School request failed:", e.message);
        // Reload the canonical persisted state after any failed mutation.
        this.app = null;
        const status = e.message === "too large" ? 413 : e.message === "bad json" ? 400 : 500;
        return json({ error: status === 413 ? "ফাইল অনেক বড় — সর্বোচ্চ ২০ MB" : status === 400 ? "সঠিক তথ্য পাঠান" : "সার্ভারে সমস্যা হয়েছে" }, status);
      }
    });
  }
  async alarm() {
    return this.serial(async () => {
      if (!this.ready()) return;
      try {
        this.app ||= createApplication(this.fs, this.env);
        await this.app.scheduled();
      } catch (e) { this.app = null; console.error("School schedule failed:", e.message); }
      finally { await this.ctx.storage.setAlarm(Date.now() + 60000); }
    });
  }
  async migrate(request, url) {
    // Only the bound Worker can address this object. Its gateway removes the
    // caller's marker and adds this one after checking the current secret.
    if (request.headers.get("x-sic-migration-authorized") !== "1") return json({ error: "Not found" }, 404);
    if (url.pathname === "/__migration/status" && request.method === "GET") {
      const files = this.fs.rows("SELECT path,size FROM files WHERE substr(path,1,9)='/staging/'");
      return json({ ready: this.ready(), files: files.map(f => ({ path: f.path.slice(9), size: f.size })) });
    }
    if (this.ready()) return json({ error: "Already imported; live data will not be overwritten" }, 409);
    if (url.pathname === "/__migration/reset" && request.method === "POST") {
      this.ctx.storage.transactionSync(() => {
        this.ctx.storage.sql.exec("DELETE FROM chunks WHERE substr(path,1,9)='/staging/'");
        this.ctx.storage.sql.exec("DELETE FROM files WHERE substr(path,1,9)='/staging/'");
      });
      return json({ ok: true });
    }
    if (url.pathname === "/__migration/file" && request.method === "PUT") {
      const key = url.searchParams.get("path") || "";
      if (!/^[\w.-]+(?:\/[\w.-]+)*$/.test(key) || key.split("/").some(p => p === "." || p === "..") || /^(?:backups|logins\.json|runtime\.json)(?:\/|$)/.test(key)) return json({ error: "Invalid import path" }, 400);
      const chunks = []; let size = 0;
      for await (const chunk of request.body || []) {
        size += chunk.length;
        if (size > MAX_UPLOAD) return json({ error: "Import file exceeds 20 MB" }, 413);
        chunks.push(chunk);
      }
      const { Buffer } = await import("node:buffer");
      this.fs.writeFileSync("/staging/" + key, Buffer.concat(chunks));
      return json({ ok: true, path: key, size });
    }
    if (url.pathname === "/__migration/commit" && request.method === "POST") {
      let manifest;
      try { manifest = await request.json(); } catch { return json({ error: "Import manifest is required" }, 400); }
      const staged = this.fs.rows("SELECT path,size FROM files WHERE substr(path,1,9)='/staging/'");
      if (!Array.isArray(manifest.files) || manifest.files.length !== staged.length) return json({ error: "Incomplete import" }, 400);
      const names = new Set();
      for (const item of manifest.files) {
        if (typeof item.path !== "string" || names.has(item.path)) return json({ error: "Invalid import manifest" }, 400);
        names.add(item.path);
        const match = staged.find(f => f.path === "/staging/" + item.path && f.size === item.size);
        if (!match || crypto.createHash("sha256").update(this.fs.readFileSync(match.path)).digest("hex") !== item.sha256) return json({ error: "Import verification failed" }, 400);
      }
      if (!this.fs.existsSync("/staging/database.json") || !this.fs.existsSync("/staging/auth.json")) return json({ error: "Database and existing admin credentials are required" }, 400);
      let db, auth;
      try { db = JSON.parse(this.fs.readFileSync("/staging/database.json", "utf8")); auth = JSON.parse(this.fs.readFileSync("/staging/auth.json", "utf8")); } catch { return json({ error: "Invalid import JSON" }, 400); }
      if (!Array.isArray(db.students) || !Array.isArray(db.courses) || !auth.email || !auth.hash || !auth.pinHash) return json({ error: "Invalid database or unconfigured admin login" }, 400);
      // A single transaction makes the imported dataset visible only when complete.
      this.ctx.storage.transactionSync(() => {
        this.fs.promoteImport();
        this.ctx.storage.sql.exec("INSERT OR REPLACE INTO migration(id,status) VALUES (1,'ready')");
      });
      this.app = null;
      await this.ctx.storage.setAlarm(Date.now() + 60000);
      return json({ ok: true, students: db.students.length });
    }
    return json({ error: "Not found" }, 404);
  }
}
