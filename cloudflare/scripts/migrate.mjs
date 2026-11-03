import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const MAX_UPLOAD = 20 * 1024 * 1024;
export async function collectImport(directory) {
  const files = [];
  async function visit(dir, prefix = "") {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      if (e.isSymbolicLink()) throw new Error("Import does not follow symbolic links");
      if (!prefix && ["backups", "logins.json", "runtime.json"].includes(e.name)) continue;
      const key = prefix + e.name;
      if (e.isDirectory()) await visit(path.join(dir, e.name), key + "/");
      else if (e.isFile()) {
        if (e.name.endsWith(".tmp") || e.name.endsWith(".part")) continue;
        if (!/^[\w.-]+(?:\/[\w.-]+)*$/.test(key)) throw new Error("Unsupported filename in import: " + key);
        const body = await fs.readFile(path.join(dir, e.name));
        if (body.length > MAX_UPLOAD) throw new Error("File exceeds Cloudflare upload limit (20 MB): " + key);
        files.push({ path: key, size: body.length, sha256: crypto.createHash("sha256").update(body).digest("hex"), body });
      }
    }
  }
  await visit(directory);
  if (!files.some(f => f.path === "database.json") || !files.some(f => f.path === "auth.json")) throw new Error("Database and admin credentials are required");
  const db = JSON.parse(files.find(f => f.path === "database.json").body.toString());
  const auth = JSON.parse(files.find(f => f.path === "auth.json").body.toString());
  if (!Array.isArray(db.students) || !Array.isArray(db.courses) || !auth.email || !auth.hash || !auth.pinHash) throw new Error("Database or admin login is invalid");
  return files;
}
export async function migrate(base, token, files, report = console.log) {
  const url = new URL(base);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("HTTPS is required for importing private school data");
  const call = async (route, opts = {}) => {
    const r = await fetch(new URL(route, url), { ...opts, headers: { authorization: "Bearer " + token, ...opts.headers }, redirect: "error" });
    const result = await r.json();
    if (!r.ok) throw Object.assign(new Error(result.error || "Import failed: " + r.status), { status: r.status });
    return result;
  };
  // Secret updates deploy a new Worker version and can take a little time to reach the edge.
  let status;
  for (let attempt = 0; attempt < 16; attempt++) {
    try { status = await call("/__migration/status"); break; }
    catch (e) {
      if (e.status !== 404 || attempt === 15) throw e;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  if (status.ready) { report("Live data already imported; nothing overwritten."); return; }
  // Discard only an incomplete staged import; the server forbids this after cutover.
  await call("/__migration/reset", { method: "POST" });
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    await call("/__migration/file?path=" + encodeURIComponent(file.path), { method: "PUT", body: file.body });
    report(`Uploaded ${i + 1}/${files.length} files`);
  }
  const manifest = { files: files.map(({ body, ...meta }) => meta) };
  const result = await call("/__migration/commit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(manifest) });
  report(`Verified import complete (${result.students} students).`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = process.argv[2];
  if (!base) throw new Error("Usage: npm run migrate -- https://your-worker.workers.dev (token is read from stdin)");
  let token = "";
  for await (const part of process.stdin) token += part;
  token = token.trim();
  if (!token) throw new Error("Migration token is required on stdin");
  const files = await collectImport(fileURLToPath(new URL("../../data", import.meta.url)));
  await migrate(base, token, files);
}
