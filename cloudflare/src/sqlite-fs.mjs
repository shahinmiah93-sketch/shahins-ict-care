import path from "node:path";
import { Buffer } from "node:buffer";
import { Readable, Writable } from "node:stream";

export const MAX_UPLOAD = 20 * 1024 * 1024;
const CHUNK = 128 * 1024;
// Reserve space below the Free plan's per-object limit for DB growth and indexes.
const MAX_STORAGE = 700 * 1024 * 1024;
const missing = () => Object.assign(new Error("File not found"), { code: "ENOENT" });

export class SQLiteFS {
  constructor(storage) {
    this.storage = storage;
    this.sql = storage.sql;
    this.sql.exec("CREATE TABLE IF NOT EXISTS files (path TEXT PRIMARY KEY, size INTEGER NOT NULL)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS chunks (path TEXT NOT NULL, part INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY(path, part))");
  }
  key(file) {
    const p = path.posix.normalize(String(file).replaceAll("\\", "/"));
    if (!p.startsWith("/data/") && !p.startsWith("/staging/")) throw new Error("Invalid storage path");
    return p;
  }
  rows(query, ...args) { return [...this.sql.exec(query, ...args)]; }
  mkdirSync() {}
  existsSync(file) { return this.rows("SELECT size FROM files WHERE path = ?", this.key(file)).length > 0; }
  statSync(file) {
    const [r] = this.rows("SELECT size FROM files WHERE path = ?", this.key(file));
    if (!r) throw missing();
    return { size: r.size, isFile: () => true };
  }
  readdirSync(dir) {
    const prefix = this.key(dir + "/") + (String(dir).endsWith("/") ? "" : "");
    const root = prefix.endsWith("/") ? prefix : prefix + "/";
    return this.rows("SELECT path FROM files WHERE substr(path, 1, ?) = ?", root.length, root)
      .map(r => r.path.slice(root.length)).filter(p => !p.includes("/"));
  }
  readFileSync(file, encoding) {
    const key = this.key(file);
    if (!this.existsSync(key)) throw missing();
    const data = Buffer.concat(this.rows("SELECT data FROM chunks WHERE path = ? ORDER BY part", key).map(r => Buffer.from(r.data)));
    return encoding ? data.toString(encoding) : data;
  }
  writeFileSync(file, value, encoding) {
    const key = this.key(file), data = Buffer.isBuffer(value) ? value : Buffer.from(value, encoding);
    const total = this.rows("SELECT coalesce(sum(size), 0) AS total FROM files")[0].total;
    const old = this.rows("SELECT size FROM files WHERE path = ?", key)[0]?.size || 0;
    if (total - old + data.length > MAX_STORAGE) throw new Error("Storage limit reached; download a backup and remove unused uploads");
    this.storage.transactionSync(() => {
      this.sql.exec("DELETE FROM chunks WHERE path = ?", key);
      this.sql.exec("INSERT OR REPLACE INTO files(path,size) VALUES (?,?)", key, data.length);
      for (let offset = 0, part = 0; offset < data.length; offset += CHUNK, part++) {
        this.sql.exec("INSERT INTO chunks(path,part,data) VALUES (?,?,?)", key, part, data.subarray(offset, offset + CHUNK));
      }
    });
  }
  unlinkSync(file) {
    const key = this.key(file);
    if (!this.existsSync(key)) throw missing();
    this.storage.transactionSync(() => {
      this.sql.exec("DELETE FROM chunks WHERE path = ?", key);
      this.sql.exec("DELETE FROM files WHERE path = ?", key);
    });
  }
  copyFileSync(from, to) {
    from = this.key(from); to = this.key(to);
    const { size } = this.statSync(from);
    const total = this.rows("SELECT coalesce(sum(size), 0) AS total FROM files")[0].total;
    const old = this.rows("SELECT size FROM files WHERE path = ?", to)[0]?.size || 0;
    if (total - old + size > MAX_STORAGE) throw new Error("Storage limit reached");
    if (from === to) return;
    this.storage.transactionSync(() => {
      this.sql.exec("DELETE FROM chunks WHERE path = ?", to);
      this.sql.exec("INSERT OR REPLACE INTO files(path,size) VALUES (?,?)", to, size);
      this.sql.exec("INSERT INTO chunks(path,part,data) SELECT ?,part,data FROM chunks WHERE path = ?", to, from);
    });
  }
  renameSync(from, to) {
    from = this.key(from); to = this.key(to);
    this.statSync(from);
    if (from === to) return;
    this.storage.transactionSync(() => {
      this.sql.exec("DELETE FROM chunks WHERE path = ?", to);
      this.sql.exec("DELETE FROM files WHERE path = ?", to);
      this.sql.exec("UPDATE chunks SET path = ? WHERE path = ?", to, from);
      this.sql.exec("UPDATE files SET path = ? WHERE path = ?", to, from);
    });
  }
  createWriteStream(file) {
    const chunks = []; let size = 0; const self = this;
    return new Writable({
      write(chunk, encoding, cb) {
        size += chunk.length;
        if (size > MAX_UPLOAD) return cb(new Error("too large"));
        chunks.push(Buffer.from(chunk)); cb();
      },
      final(cb) { try { self.writeFileSync(file, Buffer.concat(chunks)); cb(); } catch (e) { cb(e); } }
    });
  }
  createReadStream(file, range = {}) {
    const key = this.key(file), { size } = this.statSync(key);
    const start = range.start ?? 0, end = Math.min(range.end ?? size - 1, size - 1);
    const self = this;
    return Readable.from((async function* () {
      for (let part = Math.floor(start / CHUNK); part <= Math.floor(end / CHUNK); part++) {
        const [row] = self.rows("SELECT data FROM chunks WHERE path = ? AND part = ?", key, part);
        if (!row) throw missing();
        const buf = Buffer.from(row.data);
        yield buf.subarray(Math.max(0, start - part * CHUNK), Math.min(buf.length, end - part * CHUNK + 1));
      }
    })());
  }
  promoteImport() {
    this.storage.transactionSync(() => {
      for (const { path: from } of this.rows("SELECT path FROM files WHERE substr(path,1,9) = '/staging/'")) this.renameSync(from, "/data/" + from.slice(9));
    });
  }
}
