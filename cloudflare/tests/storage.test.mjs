import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { SQLiteFS } from "../src/sqlite-fs.mjs";
import { DhakaDate } from "../src/dhaka-date.mjs";

function storage() {
  const db = new DatabaseSync(":memory:");
  let nesting = 0;
  return {
    sql: { exec(query, ...args) { return db.prepare(query).all(...args); } },
    transactionSync(fn) {
      const name = "t" + nesting++; db.exec("SAVEPOINT " + name);
      try { const result = fn(); db.exec("RELEASE " + name); return result; }
      catch (e) { db.exec("ROLLBACK TO " + name); db.exec("RELEASE " + name); throw e; }
      finally { nesting--; }
    }
  };
}
test("SQLite file chunks preserve full files, ranges, copies, atomic rename and deletion", async () => {
  const fs = new SQLiteFS(storage()), data = Buffer.alloc(400000);
  for (let i=0; i<data.length; i++) data[i] = i%251;
  fs.writeFileSync("/data/docs/file.pdf", data);
  assert.deepEqual(fs.readFileSync("/data/docs/file.pdf"), data);
  const chunks = [];
  for await (const part of fs.createReadStream("/data/docs/file.pdf", { start: 100000, end: 290000 })) chunks.push(part);
  assert.deepEqual(Buffer.concat(chunks), data.subarray(100000, 290001));
  fs.copyFileSync("/data/docs/file.pdf", "/data/docs/copy.pdf");
  fs.renameSync("/data/docs/copy.pdf", "/data/docs/moved.pdf");
  assert.equal(fs.existsSync("/data/docs/copy.pdf"), false);
  assert.deepEqual(fs.readFileSync("/data/docs/moved.pdf"), data);
  assert.deepEqual(fs.readdirSync("/data/docs").sort(), ["file.pdf", "moved.pdf"]);
  fs.unlinkSync("/data/docs/file.pdf");
  assert.equal(fs.existsSync("/data/docs/file.pdf"), false);
  assert.throws(() => fs.writeFileSync("/data/../../auth.json", "x"));
});
test("Staged import is promoted atomically", () => {
  const fs = new SQLiteFS(storage());
  fs.writeFileSync("/staging/database.json", '{"ok":true}');
  fs.writeFileSync("/staging/photos/x.jpg", "picture");
  fs.promoteImport();
  assert.equal(fs.readFileSync("/data/database.json", "utf8"), '{"ok":true}');
  assert.equal(fs.readFileSync("/data/photos/x.jpg", "utf8"), "picture");
  assert.equal(fs.existsSync("/staging/database.json"), false);
});
test("Cloud calendar uses Bangladesh midnight and local constructors across month/year boundaries", () => {
  const date = new DhakaDate("2026-11-03T19:30:00Z");
  assert.equal(date.getDate(), 4); assert.equal(date.getHours(), 1);
  assert.equal(date.toLocaleDateString("en-CA"), "2026-11-04");
  assert.equal(new DhakaDate(2026,10,3).toISOString(), "2026-11-02T18:00:00.000Z");
  assert.equal(new DhakaDate("2026-11-03T00:00").getTime(), new DhakaDate(2026,10,3).getTime());
  const year = new DhakaDate(2026,11,31); year.setDate(32);
  assert.equal(year.getFullYear(), 2027); assert.equal(year.getMonth(), 0); assert.equal(year.getDate(), 1);
});
