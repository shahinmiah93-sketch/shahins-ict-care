// Cloudflare Git deployment enabled
// Shahin's ICT Care — লোকাল সার্ভার
// চালাতে: node server.mjs   (অথবা "Start Website.bat" এ ডাবল-ক্লিক)
// সব তথ্য data/database.json ফাইলে থাকে; পাসওয়ার্ড থাকে data/auth.json-এ।
//
// কাঠামো: সেশন (HSC-27) → ক্লাস ব্যাচ (27-B)। মডিউল (০১–০৫) আলাদা।
// শিক্ষার্থী একটি সেশন ও ব্যাচে থাকে, আর এক বা একাধিক মডিউলে ভর্তি (enrollment) হতে পারে।

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { seedDatabase, makeBatches, DB_VERSION } from "./seed.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, "public");
// পরীক্ষার হিসাব (গড়, পাস-ফেল, মেধাক্রম) — ব্রাউজারের সাথে একই ফাইল
await import(pathToFileURL(path.join(PUBLIC, "js", "examcalc.js")).href);
const EC = globalThis.ExamCalc;
const DATA = path.join(ROOT, "data");
const DB_FILE = path.join(DATA, "database.json");
const AUTH_FILE = path.join(DATA, "auth.json");
const BACKUPS = path.join(DATA, "backups");
const PHOTOS = path.join(DATA, "photos"); // শিক্ষার্থী ও আবেদনের ছবি (s-<id>.jpg, a-<id>.jpg)
const PORT = Number(process.env.PORT) || 8090;
const HOST = "127.0.0.1"; // শুধু এই কম্পিউটার থেকে খোলা যায়
// অ্যাডমিন লগইন চালু: প্রথমে ৬ সংখ্যার PIN, তারপর ইমেইল + পাসওয়ার্ড।
// (শুধু লোকালে পরীক্ষার জন্য বন্ধ করতে: "Start Website.bat"-এ  set ADMIN_LOCK=0)
const ADMIN_LOCK = process.env.ADMIN_LOCK !== "0";
// লগইন একবার করলে অনেকদিন থাকে; প্রতিবার ব্যবহারে মেয়াদ আবার বাড়ে।
// লগইন data/logins.json-এ রাখা হয়, তাই সার্ভার নতুন করে চালু হলেও লগআউট হয় না।
const SESSION_DAYS = 90;
const LOGINS_FILE = path.join(DATA, "logins.json");

const DOCS = path.join(DATA, "docs"); // পরীক্ষার প্রশ্ন, উত্তরপত্র, দেখা খাতা (PDF / ছবি / ভিডিও …)
fs.mkdirSync(BACKUPS, { recursive: true });
fs.mkdirSync(PHOTOS, { recursive: true });
fs.mkdirSync(DOCS, { recursive: true });
const BANNERS = path.join(DATA, "banners"); // মূল পাতার ব্যানার স্লাইডারের ছবি (<id>.jpg / .png / .webp / .gif)
fs.mkdirSync(BANNERS, { recursive: true });
const GALLERY = path.join(DATA, "gallery"); // পাবলিক সাইটের ফটো গ্যালারি
fs.mkdirSync(GALLERY, { recursive: true });
const ACHIEVERS = path.join(DATA, "achievers"); // মূল পাতার "সফল শিক্ষার্থী" ছবি
fs.mkdirSync(ACHIEVERS, { recursive: true });
const LEARN_IMG = path.join(DATA, "learn-images"); // ফ্রি ক্লাসের থাম্বনেইল আর অনলাইন কোর্সের কভার ছবি
const VIDEOS = path.join(DATA, "videos"); // আপলোড করা ভিডিও (ফ্রি ক্লাস: fc-<id>, কোর্সের ক্লাস: oc-<কোর্স>-<ক্লাস>)
fs.mkdirSync(LEARN_IMG, { recursive: true });
fs.mkdirSync(VIDEOS, { recursive: true });
const NOTICE_PDFS = path.join(DATA, "notice-pdfs"); // নোটিশের সাথে জুড়ে দেওয়া PDF (<নোটিশ id>.pdf) — যেমন পরীক্ষার রুটিন
fs.mkdirSync(NOTICE_PDFS, { recursive: true });
const EXAM_ROUTINES = path.join(DATA, "exam-routines"); // পরীক্ষার রুটিন PDF (<id>.pdf) — শিক্ষার্থীর প্যানেলে যায়
fs.mkdirSync(EXAM_ROUTINES, { recursive: true });
const TEACHER_IMG = path.join(DATA, "teacher-photos"); // শিক্ষকের আপলোড করা ছবি (<id>.jpg …)
fs.mkdirSync(TEACHER_IMG, { recursive: true });
const COURSE_IMG = path.join(DATA, "course-images"); // কোর্স মডিউলের কভার ছবি (<id>.jpg …)
fs.mkdirSync(COURSE_IMG, { recursive: true });
const COURSE_PDFS = path.join(DATA, "course-routines"); // কোর্স মডিউলের ক্লাস রুটিন PDF (<id>.pdf)
fs.mkdirSync(COURSE_PDFS, { recursive: true });
const DAILY_IMG = path.join(DATA, "daily-images"); // "প্রতিদিন শিখি" পোস্টের ছবি (<id>.jpg …)
fs.mkdirSync(DAILY_IMG, { recursive: true });
const EBOOK_IMG = path.join(DATA, "ebook-covers"); // ই-বুকের কভার ছবি (<id>.jpg …)
const EBOOK_PDFS = path.join(DATA, "ebook-pdfs"); // ই-বুকের PDF (<id>.pdf) — ফ্রি: লগইন করলে, প্রিমিয়াম: কেনা থাকলে
fs.mkdirSync(EBOOK_IMG, { recursive: true }); fs.mkdirSync(EBOOK_PDFS, { recursive: true });
const BOOK_IMG = path.join(DATA, "book-covers"); // ছাপা বই ও শিটের কভার ছবি (<id>.jpg …)
fs.mkdirSync(BOOK_IMG, { recursive: true });
const ebookPdf = (e) => path.join(EBOOK_PDFS, `${String(e.id).replace(/[^\w-]/g, "")}.pdf`);
const QNA = path.join(DATA, "qna"); // প্রশ্নোত্তর বক্সের ফাইল: <id>-q-image / q-audio (প্রশ্নকারীর), a-image / a-audio / a-video (শিক্ষকের উত্তর)
fs.mkdirSync(QNA, { recursive: true });
const routinePdf = (c) => path.join(COURSE_PDFS, `${String(c.id).replace(/[^\w-]/g, "")}.pdf`);
const examRoutineFile = (r) => path.join(EXAM_ROUTINES, `${String(r.id).replace(/[^\w-]/g, "")}.pdf`);
const noticePdf = (n) => path.join(NOTICE_PDFS, `${String(n.id).replace(/[^\w-]/g, "")}.pdf`);

// ---------- ডেটাবেজ ----------
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
function writeJsonAtomic(file, data) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

let db = readJson(DB_FILE, null);
if (!db) {
  db = seedDatabase();
  writeJsonAtomic(DB_FILE, db);
  console.log("নতুন ডেটাবেজ তৈরি হয়েছে (নমুনা তথ্যসহ)।");
} else if ((db.meta?.version || 1) < DB_VERSION) {
  // পুরনো কাঠামো (শুধু নমুনা তথ্য ছিল) → নতুন কাঠামো; যোগাযোগের তথ্য রাখা হয়, আগের ফাইলের কপি থাকে
  fs.copyFileSync(DB_FILE, path.join(BACKUPS, `before-v${DB_VERSION}-${Date.now()}.json`));
  const s = db.settings || {};
  const keep = Object.fromEntries(["phone", "phone2", "whatsapp", "email", "facebook", "mapUrl"].filter((k) => s[k] && !/X{3}/.test(s[k])).map((k) => [k, s[k]]));
  db = seedDatabase(keep);
  writeJsonAtomic(DB_FILE, db);
  console.log(`ডেটাবেজ নতুন কাঠামোয় (v${DB_VERSION}) আপডেট হয়েছে।`);
}
const COLLECTIONS = ["sessions", "courses", "batches", "students", "enrollments", "payments", "exams", "enquiries", "notices", "teachers", "applications", "closures", "docs", "homework", "quizzes", "banners", "achievers", "leads", "smsLog", "talentHunts", "thRegs", "freeClasses", "onlineCourses", "learners", "ocEnrolls", "gallery", "ratings", "onlineApps", "faqs", "qna", "ebooks", "daily", "examRoutines", "books", "bookMoves", "bookSales", "bookOrders"];
for (const c of COLLECTIONS) db[c] ||= [];
db.attendance ||= {};
db.absentSent ||= {}; // আজ কার অভিভাবককে অনুপস্থিতির SMS গেছে: { তারিখ: [আইডি] }
db.monthlySent ||= {}; // এই মাসে কার অভিভাবককে অগ্রগতির SMS গেছে: { মাস: [আইডি] }
db.feeSent ||= {}; // এই মাসে কার বকেয়ার SMS গেছে: { মাস: [আইডি] }
db.quizGuests ||= []; // অনলাইন কুইজ দেওয়া ব্যাচের বাইরের শিক্ষার্থী
db.settings ||= {};
db.lists ||= { OCCUPATIONS: [], RELATIONS: [] }; // অফিস নিজে লিখে যা ব্যবহার করেছে — পরের বার তালিকায় আসে

// পুরনো আইডি (SIC-27-0001) → নতুন আইডি (270001); পুরনো/খালি সিরিয়াল → 1001 থেকে। সব জায়গার রেফারেন্স ও ছবি সাথে বদলায়।
(function migrateIds() {
  const map = {};
  for (const s of db.students) {
    const m = /^SIC-(\d{2})-(\d+)$/.exec(s.id);
    if (m) map[s.id] = m[1] + m[2].padStart(4, "0");
  }
  const badSerial = db.students.some((s) => !s.serial || s.serial > 100000);
  if (!Object.keys(map).length && !badSerial) return;
  fs.copyFileSync(DB_FILE, path.join(BACKUPS, `before-new-ids-${Date.now()}.json`));
  const to = (id) => map[id] || id;
  for (const s of db.students) {
    if (map[s.id]) {
      const oldPhoto = path.join(PHOTOS, `s-${s.id.replace(/[^\w-]/g, "")}.jpg`);
      if (fs.existsSync(oldPhoto)) fs.renameSync(oldPhoto, path.join(PHOTOS, `s-${map[s.id]}.jpg`));
      s.id = map[s.id];
    }
  }
  for (const c of ["enrollments", "payments", "applications"]) for (const x of db[c]) if (x.studentId) x.studentId = to(x.studentId);
  const rekey = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [to(k), v]));
  for (const e of db.exams) e.marks = rekey(e.marks);
  for (const k of Object.keys(db.attendance)) db.attendance[k] = rekey(db.attendance[k]);
  if (badSerial) {
    let n = 1000;
    [...db.students].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).forEach((s) => (s.serial = ++n));
  }
  writeJsonAtomic(DB_FILE, db);
  console.log(`শিক্ষার্থী আইডি নতুন নিয়মে বদলানো হয়েছে (${Object.keys(map).length}টি)।`);
})();

// পুরনো পরীক্ষা (এক ঘরে মোট নম্বর) → নতুন কাঠামো (ধরন, বিষয়ের CQ/MCQ, প্রতিবারের নম্বর)। নম্বর হারায় না।
(function migrateExams() {
  const old = db.exams.filter((e) => !Array.isArray(e.subjects));
  if (!old.length) return;
  fs.copyFileSync(DB_FILE, path.join(BACKUPS, `before-new-exams-${Date.now()}.json`));
  for (const e of old) {
    const full = Number(e.fullMarks) || 100, b = db.batches.find((x) => x.id === e.batchId);
    const marks = {};
    for (const [sid, v] of Object.entries(e.marks || {})) if (v !== "" && v !== null && v !== undefined) marks[sid] = [{ "ICT|cq": Number(v) }];
    Object.assign(e, {
      type: "weekly", mode: "cq", subjects: [{ name: "ICT", cq: full, mcq: 0 }], session: b ? b.session : "", batchIds: e.batchId ? [e.batchId] : [],
      studentIds: [...new Set([...Object.keys(marks), ...db.students.filter((s) => s.batchId === e.batchId && s.status !== "inactive").map((s) => s.id)])],
      attemptDates: [], chapter: "", syllabus: "", time: "", marks,
    });
    delete e.fullMarks; delete e.batchId;
  }
  writeJsonAtomic(DB_FILE, db);
  console.log(`পুরনো ${old.length}টি পরীক্ষা নতুন কাঠামোয় নেওয়া হয়েছে।`);
})();

// ফলাফল প্রকাশ (ফলাফল ব্যবস্থাপনা): exam.published = { [batchId]: { at } } — শিক্ষার্থী শুধু নিজের ব্যাচের প্রকাশিত ফলাফল দেখে।
// এই ব্যবস্থা চালুর আগের পরীক্ষাগুলো (নম্বর থাকলে) প্রকাশিত ধরা হয়, যাতে শিক্ষার্থীরা যা দেখছিল তা হঠাৎ লুকিয়ে না যায়।
db.resultLog ||= [];
db.settings.meritWeights ||= { weekly: 1, monthly: 1, chapter: 1, model: 1, class: 1 };
if (db.settings.meritWeights.class === undefined) db.settings.meritWeights.class = 1; // Class Assessment (পরে যোগ হওয়া ধরন)
db.settings.perfWeights ||= { exam: 40, att: 20, hw: 20, lesson: 20, minDays: 5 }; // Class Performance: ভাগ আর ন্যূনতম হাজিরার দিন
(function migratePublish() {
  const old = db.exams.filter((e) => !e.published);
  if (!old.length) return;
  for (const e of old) {
    e.published = {};
    if (!Object.keys(e.marks || {}).length) continue;
    for (const b of examBatchIds(e)) e.published[b] = { at: e.updatedAt || e.createdAt || new Date().toISOString() };
    db.resultLog.push({ id: "log_" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex"), at: new Date().toISOString(), action: "publish", examId: e.id, batchIds: Object.keys(e.published), note: "আগের ফলাফল — নতুন ব্যবস্থা চালুর সময় প্রকাশিত ধরা হয়েছে" });
  }
  writeJsonAtomic(DB_FILE, db);
})();
function examBatchIds(e) { return [...new Set((e.studentIds || []).map((id) => (db.students.find((s) => s.id === id) || {}).batchId).filter(Boolean))]; }
const isPublishedFor = (e, s) => !!(e.published && s && e.published[s.batchId]);

// নতুন পেশা/সম্পর্ক মনে রাখা (শুধু অফিসের সেভ থেকে, অনলাইন আবেদন থেকে না)
function rememberLists(st) {
  const add = (key, v) => {
    v = str(v, 60);
    if (!v || v === "অন্যান্য") return;
    const l = (db.lists[key] ||= []);
    if (!l.includes(v)) { l.push(v); if (l.length > 300) l.shift(); }
  };
  add("OCCUPATIONS", st.fatherOccupation);
  add("OCCUPATIONS", st.motherOccupation);
  add("RELATIONS", st.guardianRelation);
  add("OCCUPATIONS", st.refOccupation);
  add("OCCUPATIONS", st.guardianOccupation);
  add("SOURCES", st.source);
  add("FOURTH_SUBJECTS", st.fourthSubject);
  add("EXAMS", st.sscExam);
}

function saveDb() {
  db.meta = { ...(db.meta || {}), version: DB_VERSION, updated: new Date().toISOString() };
  writeJsonAtomic(DB_FILE, db);
  dailyBackup();
}
function dailyBackup() {
  const day = new Date().toISOString().slice(0, 10);
  const file = path.join(BACKUPS, `database-${day}.json`);
  if (fs.existsSync(file)) return;
  fs.copyFileSync(DB_FILE, file);
  const old = fs.readdirSync(BACKUPS).filter((f) => f.startsWith("database-")).sort();
  while (old.length > 30) fs.unlinkSync(path.join(BACKUPS, old.shift()));
}
dailyBackup();

// ---------- পাসওয়ার্ড ও সেশন ----------
let auth = readJson(AUTH_FILE, null); // { salt, hash, pinSalt, pinHash, email } — PIN আর পাসওয়ার্ড শুধু হ্যাশ হিসেবে
// আগের শুধু-পাসওয়ার্ডের auth.json থাকলে PIN / ইমেইল নেই → নতুন করে সেটআপ করতে হবে
const authReady = () => !!(auth && auth.hash && auth.pinHash && auth.email);
// ফাইলে টোকেনের হ্যাশ রাখা হয়, আসল টোকেন না
const tokenKey = (t) => crypto.createHash("sha256").update(t).digest("hex");
const logins = new Map(Object.entries(readJson(LOGINS_FILE, {})).filter(([, v]) => v && v.exp > Date.now())); // hash -> { role, sid, exp }
let loginsDirty = false;
function saveLogins() {
  loginsDirty = false;
  try { writeJsonAtomic(LOGINS_FILE, Object.fromEntries([...logins].filter(([, v]) => v.exp > Date.now()))); } catch (e) { console.error(e); }
}
setInterval(() => { if (loginsDirty) saveLogins(); }, 60e3).unref();
// পাসওয়ার্ড রিসেট করা হলে (auth.json নেই) পুরনো অ্যাডমিন লগইন আর কাজ করবে না
if (!authReady()) { for (const [k, v] of logins) if (v.role === "admin") logins.delete(k); saveLogins(); }
const loginFails = new Map(); // ip -> { count, until }
// PIN ঠিক হলে ৫ মিনিটের একটা টিকিট — শুধু এটা দিয়েই দ্বিতীয় ধাপ (ইমেইল + পাসওয়ার্ড) খোলে, একবারই চলে
const pinTickets = new Map(); // ticket -> { ip, exp }
const SESSION_MS = SESSION_DAYS * 24 * 3600e3;
// HTTPS-এ (Cloudflare Tunnel দিয়ে ডোমেইনে) কুকি শুধু নিরাপদ সংযোগে যায় — res.secureCookie ঠিক হয় api()-এর শুরুতে
const setLoginCookie = (res, role, token) => res.setHeader("Set-Cookie", `sic_${role}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_DAYS * 24 * 3600}${res.secureCookie ? "; Secure" : ""}`);

const hashPassword = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString("hex");
function checkPassword(pw) {
  if (!auth || !auth.hash) return false;
  const a = Buffer.from(hashPassword(pw, auth.salt), "hex");
  const b = Buffer.from(auth.hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const sameHash = (x, y) => { const a = Buffer.from(String(x), "hex"), b = Buffer.from(String(y || ""), "hex"); return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b); };
function checkPin(pin) {
  if (!authReady()) return false;
  const a = Buffer.from(hashPassword(pin, auth.pinSalt), "hex");
  const b = Buffer.from(auth.pinHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const normEmail = (e) => str(e, 120).toLowerCase();
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const validPin = (p) => /^\d{6}$/.test(p);
// যেটা দেওয়া হয় শুধু সেটাই বদলায় (pin / email / password)
function setCreds({ pin, email, password }) {
  const next = { ...(auth || {}) };
  if (password) { next.salt = crypto.randomBytes(16).toString("hex"); next.hash = hashPassword(password, next.salt); }
  if (pin) { next.pinSalt = crypto.randomBytes(16).toString("hex"); next.pinHash = hashPassword(pin, next.pinSalt); }
  if (email) next.email = email;
  auth = next;
  writeJsonAtomic(AUTH_FILE, auth);
  // পাসওয়ার্ড বদলালে আগের সব অ্যাডমিন লগইন বাতিল
  for (const [k, v] of logins) if (v.role === "admin") logins.delete(k);
  saveLogins();
}
function newLogin(res, role, sid) {
  const token = crypto.randomBytes(32).toString("hex");
  logins.set(tokenKey(token), { role, sid, exp: Date.now() + SESSION_MS });
  saveLogins();
  setLoginCookie(res, role, token);
}
function getLogin(req, role, res) {
  const m = (req.headers.cookie || "").match(new RegExp(`(?:^|;\\s*)sic_${role}=([a-f0-9]+)`));
  if (!m) return null;
  const key = tokenKey(m[1]);
  const s = logins.get(key);
  if (!s || s.exp < Date.now() || s.role !== role) return null;
  // ব্যবহার হলে মেয়াদ আবার পুরো হয় (দিনে একবারের বেশি না)
  if (s.exp - Date.now() < SESSION_MS - 24 * 3600e3) { s.exp = Date.now() + SESSION_MS; loginsDirty = true; if (res && !res.headersSent) setLoginCookie(res, role, m[1]); }
  return { ...s, key };
}
function clearLogin(req, res, role) {
  const s = getLogin(req, role);
  if (s) { logins.delete(s.key); saveLogins(); }
  res.setHeader("Set-Cookie", `sic_${role}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${res.secureCookie ? "; Secure" : ""}`);
}
function tooManyFails(ip) {
  const f = loginFails.get(ip);
  return f && f.until > Date.now();
}
function noteFail(ip) {
  const f = loginFails.get(ip) || { count: 0, until: 0 };
  f.count++;
  if (f.count >= 5) { f.until = Date.now() + 5 * 60e3; f.count = 0; }
  loginFails.set(ip, f);
}

// ---------- সাহায্যকারী ----------
const uid = (p) => p + "_" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");
const str = (v, max = 500) => String(v ?? "").trim().slice(0, max);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
// পরীক্ষার নম্বর পরিষ্কার: { sid: [ {"বিষয়|cq": n} | null ×(১ বা ৩) ] } — শুধু এই পরীক্ষার ঘর, ০ থেকে পূর্ণমান, খালি ঘর বাদ
function cleanMarks(ex, raw) {
  const ps = EC.parts(ex), n = EC.attemptsOf(ex), out = {};
  for (const [sid, arr] of Object.entries(raw && typeof raw === "object" ? raw : {})) {
    if (!db.students.some((s) => s.id === sid)) continue;
    const list = [];
    for (let a = 0; a < n; a++) {
      const src = Array.isArray(arr) ? arr[a] : null, cell = {};
      // অনুপস্থিত হিসেবে চিহ্নিত — নম্বর থাকে না ("এখনো দেওয়া হয়নি" থেকে আলাদা)
      if (src && typeof src === "object" && src._absent) { list.push({ _absent: true }); continue; }
      if (src && typeof src === "object") for (const p of ps) { const v = EC.num(src[p.key]); if (v !== null) cell[p.key] = Math.max(EC.allowsNegative(ex) ? -1000 : 0, Math.min(p.full, Math.round(v * 100) / 100)); }
      list.push(Object.keys(cell).length ? cell : null);
    }
    if (list.some(Boolean)) out[sid] = list;
  }
  return out;
}
const youtubeId = (u) => (String(u).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/) || [])[1] || "";
// ডকুমেন্ট ফাইল: শুধু নিরাপদ ধরনের ফাইল রাখা হয়
const DOC_TYPES = {
  ".pdf": ["application/pdf", "pdf"], ".jpg": ["image/jpeg", "image"], ".jpeg": ["image/jpeg", "image"], ".png": ["image/png", "image"], ".webp": ["image/webp", "image"], ".gif": ["image/gif", "image"],
  ".mp4": ["video/mp4", "video"], ".webm": ["video/webm", "video"], ".mp3": ["audio/mpeg", "audio"], ".m4a": ["audio/mp4", "audio"],
  ".doc": ["application/msword", "file"], ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "file"],
  ".ppt": ["application/vnd.ms-powerpoint", "file"], ".pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "file"],
  ".xls": ["application/vnd.ms-excel", "file"], ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "file"],
};
const docPath = (d) => path.join(DOCS, `${String(d.id).replace(/[^\w-]/g, "")}${path.extname(d.file.name).toLowerCase()}`);
function readRaw(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(new Error("too large")); req.destroy(); return; } chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
function sendDoc(req, res, d, url) {
  const f = d && d.file ? docPath(d) : "";
  if (!f || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  const [type, kind] = DOC_TYPES[path.extname(d.file.name).toLowerCase()] || ["application/octet-stream", "file"];
  const inline = ["pdf", "image", "video", "audio"].includes(kind) && url.searchParams.get("download") !== "1";
  res.writeHead(200, {
    "Content-Type": type, "Content-Length": fs.statSync(f).size, "Cache-Control": "private, max-age=3600",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(d.file.name)}`,
  });
  fs.createReadStream(f).pipe(res);
}
const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD (local)
// Cloudflare Tunnel (বা অন্য প্রক্সি) দিয়ে এলে আসল ভিজিটরের IP আর https কিনা হেডারে আসে।
// সার্ভার শুধু 127.0.0.1-এ শোনে, তাই এই হেডার বাইরের কেউ সরাসরি পাঠাতে পারে না — শুধু টানেল / প্রক্সি।
const clientIp = (req) => str(req.headers["cf-connecting-ip"], 60) || str(String(req.headers["x-forwarded-for"] || "").split(",")[0], 60) || req.socket.remoteAddress;
const isHttps = (req) => String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https" || /"scheme":\s*"https"/.test(String(req.headers["cf-visitor"] || ""));
const phoneOf = (v) => str(v, 20).replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d)).replace(/\D/g, "").replace(/^88/, "");

function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}
function readBody(req, limit = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(new Error("too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); }
      catch { reject(new Error("bad json")); }
    });
    req.on("error", reject);
  });
}

// আইডি সেশন অনুযায়ী: HSC-27 → 270001, 270002 … ; HSC-28 → 280001 …
const sessionYY = (session) => (String(session || "").match(/(\d{2})\s*$/) || [, String(new Date().getFullYear()).slice(2)])[1];
function nextStudentId(session) {
  const yy = sessionYY(session);
  const max = db.students
    .filter((s) => new RegExp(`^${yy}\\d{4,}$`).test(s.id))
    .reduce((m, s) => Math.max(m, parseInt(s.id.slice(2), 10) || 0), 0);
  return yy + String(max + 1).padStart(4, "0");
}
const newPin = () => String(crypto.randomInt(1000, 10000));
function nextAppNo() {
  const prefix = "AP" + String(new Date().getFullYear()).slice(2);
  const max = db.applications
    .filter((a) => (a.appNo || "").startsWith(prefix))
    .reduce((m, a) => Math.max(m, parseInt(a.appNo.slice(prefix.length), 10) || 0), 0);
  return prefix + String(max + 1).padStart(4, "0");
}
// ---------- অনলাইন পেমেন্ট ----------
// গেটওয়ে (SSLCommerz — বিকাশ, নগদ, রকেট, কার্ড, ইন্টারনেট ব্যাংকিং এক জায়গায়): Store ID/পাসওয়ার্ড data/payment.json-এ, ওয়েবসাইটে কখনো যায় না
// হাতে পাঠানো (সেন্ড মানি / ব্যাংকে জমা): নম্বর ও অ্যাকাউন্ট সেটিংসে (payBkash …), শিক্ষার্থী TrxID দেয়, অ্যাডমিন মিলিয়ে নিশ্চিত করে
const PAY_FILE = path.join(DATA, "payment.json");
let payCfg = readJson(PAY_FILE, null) || { sslStoreId: "", sslStorePass: "", sslSandbox: true, sslEnabled: false };
const PAY_METHODS = { bkash: "বিকাশ", nagad: "নগদ", rocket: "রকেট", bank: "ব্যাংক", gateway: "অনলাইন গেটওয়ে" };
const gatewayOn = () => !!(payCfg.sslEnabled && payCfg.sslStoreId && payCfg.sslStorePass);
const sslBase = () => (payCfg.sslSandbox ? "https://sandbox.sslcommerz.com" : "https://securepay.sslcommerz.com");
const siteBase = (req) => `${String(req.headers["x-forwarded-proto"] || "http").split(",")[0]}://${req.headers.host}`;
// গেটওয়ে থেকে ফেরা পেমেন্ট যাচাই: SSLCommerz-এর validation API-তে val_id মিলিয়ে, টাকা ও tran_id ঠিক থাকলে "পরিশোধিত"
async function sslConfirm(f) {
  const a = db.onlineApps.find((x) => x.pay && x.pay.tranId && x.pay.tranId === str(f.tran_id, 80));
  if (!a || !f.val_id) return a;
  if (a.pay.status === "paid") return a;
  try {
    const q = new URLSearchParams({ val_id: str(f.val_id, 100), store_id: payCfg.sslStoreId, store_passwd: payCfg.sslStorePass, format: "json" });
    const v = await (await fetch(`${sslBase()}/validator/api/validationserverAPI.php?${q}`)).json();
    const ok = ["VALID", "VALIDATED"].includes(v.status) && v.tran_id === a.pay.tranId && v.currency_type === "BDT" && Number(v.currency_amount) >= Number(a.pay.amount);
    if (ok) {
      a.pay = { ...a.pay, status: "paid", channel: str(v.card_type, 60), bankTranId: str(v.bank_tran_id, 80), valId: str(v.val_id, 100), paidAt: new Date().toISOString() };
      const had = a.studentId, st = admitOnline(a);
      if (st && !had) await smsStudentLogin(st);
      saveDb();
    }
  } catch (e) { console.error("SSLCommerz যাচাই হয়নি:", e.message); }
  return a;
}
// অনলাইন মডিউলে ভর্তি নিশ্চিত হলে (অফিস "ভর্তি সম্পন্ন" করলে বা গেটওয়েতে টাকা দিলে): শিক্ষার্থী আইডি + PIN, মডিউলে ভর্তি, টাকা পেলে তার হিসাব
// শিক্ষার্থী প্যানেলে নোটিশ, পরীক্ষা, ফলাফল আর মডিউলের রেকর্ড ক্লাস দেখে; ক্লাস ব্যাচ নেই (batchId ফাঁকা), সেশন = এইচএসসি ব্যাচ
function admitOnline(a) {
  if (a.studentId && db.students.some((s) => s.id === a.studentId)) return db.students.find((s) => s.id === a.studentId);
  const v = validateEnrollment({ courseId: a.courseId, chapters: a.chapters }); // অধ্যায়ভিত্তিক হলে আবেদনের অধ্যায়গুলোই
  if (v.error) return null;
  const s = { id: nextStudentId(a.hscBatch), serial: nextSerial(), status: "active", note: "", mode: "online", name: a.nameEn, nameEn: a.nameEn, gender: "",
    phone: a.phone, guardianPhone: a.guardianPhone, college: a.college, group: a.group, session: a.hscBatch, batchId: "", admissionDate: today(),
    appNo: a.appNo, pin: newPin(), photo: false, createdAt: new Date().toISOString() };
  db.students.push(s);
  const enr = createEnrollment(s.id, v, today(), "");
  if (a.pay && a.pay.status === "paid") createPayment(s.id, enr.id, { amount: a.pay.amount, method: { bkash: "বিকাশ", nagad: "নগদ", rocket: "রকেট", bank: "ব্যাংক", gateway: "অনলাইন গেটওয়ে" }[a.pay.method] || "অনলাইন" }, `অনলাইন ভর্তি — ${a.appNo}${a.pay.trxId ? " · TrxID " + a.pay.trxId : a.pay.bankTranId ? " · " + a.pay.bankTranId : ""}`);
  Object.assign(a, { studentId: s.id, status: "approved", updatedAt: new Date().toISOString() });
  return s;
}
const payView = (a) => (a.pay ? { status: a.pay.status, method: a.pay.method, amount: a.pay.amount } : { status: "unpaid" });
// ⭐ ওয়েবসাইটের "শিক্ষার্থীদের মতামত": মন্তব্য আছে আর অ্যাডমিন লুকায়নি এমন রেটিং
function publicReviews() {
  return db.ratings.filter((r) => !r.hidden && str(r.comment, 300)).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 60).map((r) => {
    const s = db.students.find((x) => x.id === r.studentId) || {};
    const course = db.enrollments.filter((e) => e.studentId === s.id).map((e) => (db.courses.find((c) => c.id === e.courseId) || {}).name).filter(Boolean)[0] || "";
    return { id: r.id, name: s.nameEn || s.name || "শিক্ষার্থী", course: [course, s.session].filter(Boolean).join(" · "), stars: r.stars, text: r.comment, at: r.at };
  });
}
// অনলাইন মডিউলে ভর্তির আবেদন নম্বর: OA + সাল + ক্রমিক (যেমন OA260001)
// এইচএসসি ব্যাচ: চলতি সাল থেকে ৫টা (২০২৬ → HSC-26 … HSC-30)
const hscBatches = () => { const y = new Date().getFullYear() % 100; return [0, 1, 2, 3, 4].map((i) => `HSC-${String(y + i).padStart(2, "0")}`); };
const ONLINE_GROUPS = ["বিজ্ঞান", "ব্যবসায় শিক্ষা", "মানবিক"];
function nextOnlineAppNo() {
  const prefix = "OA" + String(new Date().getFullYear()).slice(2);
  const max = db.onlineApps.filter((a) => (a.appNo || "").startsWith(prefix)).reduce((m, a) => Math.max(m, parseInt(a.appNo.slice(prefix.length), 10) || 0), 0);
  return prefix + String(max + 1).padStart(4, "0");
}
// ভর্তি ফর্মের ক্রমিক নম্বর (SL NO.) — ১০০০০১ থেকে
// ফর্মের সিরিয়াল: 1001, 1002 …
const nextSerial = () => db.students.reduce((m, s) => Math.max(m, s.serial || 0), 1000) + 1;
function nextReceiptNo() {
  return db.payments.reduce((m, p) => Math.max(m, p.receiptNo || 0), 1000) + 1;
}
const activeSessions = () => db.sessions.filter((s) => s.active !== false).map((s) => s.name);

// ---------- ছবি ----------
const photoFile = (kind, id) => path.join(PHOTOS, `${kind}-${String(id).replace(/[^\w-]/g, "")}.jpg`);
function savePhoto(dataUrl, kind, id) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!m) return false;
  const buf = Buffer.from(m[2], "base64");
  if (buf.length < 100 || buf.length > 400 * 1024) return false;
  fs.writeFileSync(photoFile(kind, id), buf);
  return true;
}
function sendPhoto(res, kind, id) {
  const f = photoFile(kind, id);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "no-store" });
  fs.createReadStream(f).pipe(res);
}
const removePhoto = (kind, id) => { try { fs.unlinkSync(photoFile(kind, id)); } catch {} };
// হিরোর মেন্টরের ছবি — data/photos/mentor.<ext>; না থাকলে ওয়েবসাইট public/images/teachers/shahin-hero.webp দেখায়
const mentorFile = () => { const m = db.settings.mentorPhoto; return m ? path.join(PHOTOS, `mentor${m.ext}`) : ""; };
const mentorUrl = () => (db.settings.mentorPhoto ? `/api/mentor-photo?v=${db.settings.mentorPhoto.v}` : "");

// ---------- ফি ----------
// মডিউলের ফি: মাসিক → মাসের ফি; এককালীন → পুরো ফি; অধ্যায়ভিত্তিক → বাছাই করা অধ্যায়গুলোর যোগফল
function moduleFee(course, chapters) {
  if (!course) return 0;
  if (course.feeType === "chapter") return (course.chapters || []).filter((c) => chapters.includes(c.id)).reduce((t, c) => t + num(c.fee), 0);
  return num(course.fee);
}
const monthsBetween = (from, to) => {
  const a = new Date((from || today()) + "T00:00:00"), b = new Date((to || today()) + "T00:00:00");
  return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + 1);
};
// ---------- প্রথম মাসের আংশিক ফি (রেগুলার/মাসিক ব্যাচ) ----------
// ব্যাচের দিন ("শনি, সোম, বুধ") → সপ্তাহের দিন নম্বর (রবি=0 … শনি=6)
const WEEKDAYS = [[0, /রবি|sun/i], [1, /সোম|mon/i], [2, /মঙ্গল|tue/i], [3, /বুধ|wed/i], [4, /বৃহস্পতি|thu/i], [5, /শুক্র|fri/i], [6, /শনি|sat/i]];
const classWeekdays = (days) => WEEKDAYS.filter(([, re]) => re.test(String(days || ""))).map(([d]) => d);
// ভর্তির মাসে ব্যাচের মোট ক্লাস কয়টা, আর শুরুর তারিখ থেকে মাস শেষ পর্যন্ত কয়টা পাবে
function firstMonthClasses(days, startDate) {
  const wd = classWeekdays(days);
  const start = new Date((startDate || today()) + "T00:00:00");
  if (!wd.length || isNaN(start)) return null;
  const y = start.getFullYear(), m = start.getMonth(), last = new Date(y, m + 1, 0).getDate();
  let total = 0, left = 0;
  for (let d = 1; d <= last; d++) {
    if (!wd.includes(new Date(y, m, d).getDay())) continue;
    total++;
    if (d >= start.getDate()) left++;
  }
  // ১–৬ তারিখের মধ্যে শুরু হলে পুরো মাসের ফি (firstGrace)
  return total ? { firstClasses: left, firstTotal: total, firstGrace: start.getDate() <= FULL_FEE_UNTIL_DAY } : null;
}
const FULL_FEE_UNTIL_DAY = 6;
// ---------- মাসের ফি (common.js-এর U.monthFee-এর সাথে একই নিয়ম) ----------
// পুরো মাস ক্লাস পেলে পুরো ফি। কম পেলে (৬ তারিখের পরে ভর্তি, বা "টাকা কমবে" এমন ব্যাচ বন্ধ):
// পাওয়া ক্লাস × ক্লাস প্রতি টাকা (৮৩ = ১০০০ ÷ ১২; মাসে ১২-র বেশি ক্লাস হলে ১০০০ ÷ মোট ক্লাস),
// ৫০ টাকার রাউন্ড ফিগারে (৪৯৩ → ৫০০), তবে মাসিক ফি-র বেশি না।
const STD_CLASSES = 12;
const pad2 = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
function monthFee(net, wd, y, m, fromDay, closed) {
  const last = new Date(y, m + 1, 0).getDate();
  let total = 0, got = 0, shut = 0;
  for (let d = 1; d <= last; d++) {
    if (!wd.includes(new Date(y, m, d).getDay())) continue;
    total++;
    if (d < fromDay) continue;
    if (closed.has(`${y}-${pad2(m + 1)}-${pad2(d)}`)) shut++; else got++;
  }
  if (!total || got >= total) return { fee: net, total, got, shut };
  const perClass = Math.min(Math.floor(net / STD_CLASSES), net / total);
  return { fee: Math.min(net, Math.round((perClass * got) / 50) * 50), total, got, shut };
}
// এই ব্যাচের যে বন্ধগুলোতে "টাকা কমবে" — তার সব তারিখ ও কারণ।
// অল্প দিনের বন্ধে (MIN_CLOSURE_DAYS-এর কম) টাকা কমে না।
const MIN_CLOSURE_DAYS = 7;
const closureDays = (c) => Math.round((new Date(c.to + "T00:00:00") - new Date(c.from + "T00:00:00")) / 864e5) + 1;
function feeClosures(batchId) {
  const dates = new Set(), list = [];
  for (const c of db.closures) {
    if (!c.reduceFee || !(c.batchIds || []).includes(batchId) || !c.from || !c.to || closureDays(c) < MIN_CLOSURE_DAYS) continue;
    list.push(c);
    const end = new Date(c.to + "T00:00:00");
    for (let d = new Date(c.from + "T00:00:00"), n = 0; d <= end && n < 400; d.setDate(d.getDate() + 1), n++) dates.add(ymd(d));
  }
  return { dates, list };
}

// পড়া বন্ধ (pause): বন্ধ শুরুর মাসের ফি ধরা হয়, পরের মাস থেকে আবার চালুর আগের মাস পর্যন্ত মাসিক ফি নেই
// সামনের তারিখে বন্ধ / চালু: তারিখ এলে তবেই অবস্থা বদলায় (startPending / endPending — পুরনো রেকর্ডে নেই, মানে আগেই কার্যকর)
function syncPauses() {
  const t = today(); let changed = false;
  for (const s of db.students) for (const p of s.pauses || []) {
    if (p.startPending && p.from <= t) { delete p.startPending; if (!p.to || p.to > t) s.status = "inactive"; changed = true; }
    if (p.endPending && p.to && p.to <= t) { delete p.endPending; s.status = "active"; changed = true; }
  }
  if (changed) saveDb();
}
function pausedMonths(s) {
  const out = new Set(), mk = (d) => d.slice(0, 7), next = (k) => { const [y, m] = k.split("-").map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${pad2(m + 1)}`; };
  for (const p of (s && s.pauses) || []) {
    const stop = p.to ? mk(p.to) : next(mk(today())); // খোলা থাকলে চলতি মাসসহ
    for (let k = next(mk(p.from)), n = 0; k < stop && n < 240; k = next(k), n++) out.add(k);
  }
  return out;
}
// একটি ভর্তির (enrollment) মোট দেনা — মাসিক কোর্সে মাস ধরে ধরে
function cleanMonthlyFees(rows) {
  if (rows == null) return [];
  if (!Array.isArray(rows) || rows.length > 60) throw new Error("মাসভিত্তিক ফি সর্বোচ্চ ৬০টি সারি দিন");
  const valid = v => /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
  const out = rows.map(r => {
    if (!r || !valid(r.from) || (r.to && (!valid(r.to) || r.from > r.to)) || !Number.isFinite(Number(r.fee)) || r.fee === "" || Number(r.fee) < 0) throw new Error("মাসভিত্তিক ফির শুরুর মাস, শেষের মাস ও টাকা সঠিকভাবে দিন");
    return { from: r.from, to: r.to || "", fee: Number(r.fee) };
  }).sort((a,b) => a.from.localeCompare(b.from));
  for (let i=1;i<out.length;i++) if (out[i].from <= (out[i-1].to || "9999-12")) throw new Error("একই মাস একাধিক ফি তালিকায় রাখা যাবে না");
  return out;
}
function monthlyFeeFor(course, enrollment, month) {
  const rule = (course.monthlyFees || []).find(r => r.from <= month && (!r.to || r.to >= month));
  return Math.max(0, num(rule ? rule.fee : enrollment.fee) - num(enrollment.discount));
}
function enrollmentDue(e, context = {}) {
  const c = context.course || db.courses.find((x) => x.id === e.courseId) || {};
  const net = Math.max(0, num(e.fee) - num(e.discount));
  if (c.feeType !== "monthly") return { due: net, months: 0, monthly: false, net };
  const end = e.status === "ended" && e.endDate ? e.endDate : today();
  const months = monthsBetween(e.startDate, end);
  const s = context.student || db.students.find((x) => x.id === e.studentId);
  const b = context.batch || (s && db.batches.find((x) => x.id === s.batchId));
  const wd = classWeekdays(b && b.days);
  const fc = b ? feeClosures(b.id) : { dates: new Set(), list: [] };
  const start = new Date((e.startDate || today()) + "T00:00:00");
  let due = 0, firstNet = net, firstClasses, firstTotal;
  const adjust = [], breakdown = []; // প্রতিটি মাসের স্পষ্ট হিসাব, এবং কমানো ফি
  const pz = pausedMonths(s);
  for (let i = 0; i < months; i++) {
    const md = new Date(start.getFullYear(), start.getMonth() + i, 1), Y = md.getFullYear(), M = md.getMonth();
    if (pz.has(`${Y}-${pad2(M + 1)}`)) { const row = { month: `${Y}-${pad2(M + 1)}`, fee: 0, got: 0, total: 0, shut: 0, late: false, paused: true, reasons: ["পড়া বন্ধ"] }; adjust.push(row); breakdown.push(row); if (i === 0) firstNet = 0; continue; }
    // ভর্তির মাস: ১–৬ তারিখে শুরু হলে পুরো মাস ধরা হয়, পরে হলে শুরুর দিন থেকে (পুরনো ভর্তিতে পুরো মাস)
    const fromDay = i === 0 && e.firstTotal && !e.firstGrace ? start.getDate() : 1;
    const monthNet = monthlyFeeFor(c, e, `${Y}-${pad2(M + 1)}`);
    const r = wd.length ? monthFee(monthNet, wd, Y, M, fromDay, fc.dates) : { fee: monthNet };
    due += r.fee;
    breakdown.push({ month: `${Y}-${pad2(M + 1)}`, monthlyRate: monthNet, fee: r.fee, got: r.got, total: r.total, shut: r.shut, late: fromDay > 1, fromDay, paused: false });
    if (i === 0) { firstNet = r.fee; firstClasses = r.got; firstTotal = r.total; }
    if (r.fee < net || monthNet !== net) {
      const mk = `${Y}-${pad2(M + 1)}`;
      const reasons = fc.list.filter((x) => x.from.slice(0, 7) <= mk && x.to.slice(0, 7) >= mk).map((x) => x.reason || "ব্যাচ বন্ধ");
      adjust.push({ month: mk, fee: r.fee, got: r.got, total: r.total, shut: r.shut, late: fromDay > 1, monthlyRate: monthNet, scheduled: monthNet !== net, reasons: [...new Set(reasons)] });
    }
  }
  return { due, months, monthly: true, net, firstNet, firstClasses, firstTotal, adjust, breakdown };
}
function feeSummary(s) {
  const items = db.enrollments.filter((e) => e.studentId === s.id).map((e) => {
    const c = db.courses.find((x) => x.id === e.courseId) || {};
    return { enrollmentId: e.id, courseId: e.courseId, course: c.name || "", status: e.status, chapters: e.chapters || [], fee: e.fee, discount: e.discount, startDate: e.startDate, ...enrollmentDue(e) };
  });
  const totalDue = items.reduce((t, i) => t + i.due, 0);
  const paid = db.payments.filter((p) => p.studentId === s.id).reduce((t, p) => t + num(p.amount), 0);
  return { items, totalDue, paid, balance: totalDue - paid };
}

// ব্যাচ বদলালেও আগের হাজিরা ও পরীক্ষা থাকে — শিক্ষার্থীর আইডি ধরে খোঁজা হয়
function attendanceFor(sid) {
  const list = [];
  for (const [key, marks] of Object.entries(db.attendance)) if (marks[sid]) list.push({ date: key.split("|")[0], status: marks[sid] });
  return list.sort((a, b) => a.date.localeCompare(b.date));
}
// শিক্ষার্থীর নিজের পরীক্ষা: সময়সূচি, নিজের প্রতিবারের নম্বর, গড়, পাস-ফেল, মেধাক্রম, প্রশ্ন/উত্তরপত্র/নিজের খাতা
// (অন্যদের নম্বর পাঠানো হয় না — শুধু সর্বোচ্চ, গড় আর কতজন অংশ নিয়েছে)
// ---------- অনলাইন কুইজ ----------
// সময়: "YYYY-MM-DDTHH:MM" (এই কম্পিউটারের সময়)। সঠিক উত্তর জমা দেওয়ার আগে কখনো শিক্ষার্থীর কাছে যায় না; নম্বর সার্ভারে গোনা হয়।
const QUIZ_GRACE_MS = 2 * 60 * 1000; // সময় শেষে জমা দেওয়ার জন্য ২ মিনিট বাড়তি
const nowLocal = () => { const d = new Date(); return `${ymd(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const quizFor = (q, s) => !!s && q.live && (!q.session || q.session === s.session) && (!(q.batchIds || []).length || q.batchIds.includes(s.batchId));
const quizState = (q) => { const n = nowLocal(); return q.opensAt && n < q.opensAt ? "upcoming" : q.closesAt && n >= q.closesAt ? "closed" : "open"; };
function scoreQuiz(q, answers) {
  let correct = 0, wrong = 0, skipped = 0;
  for (const qq of q.questions) {
    const a = answers ? answers[qq.id] : undefined;
    if (a === undefined || a === null || a === "") skipped++; else if (Number(a) === qq.correct) correct++; else wrong++;
  }
  const raw = correct * q.mark - (q.negative ? wrong * q.negValue : 0);
  return { correct, wrong, skipped, score: Math.max(0, Math.round(raw * 100) / 100), full: q.questions.length * q.mark };
}
const openAttempt = (q, sid) => [...((q.attempts || {})[sid] || [])].reverse().find((a) => !a.submittedAt && Date.now() < a.startedMs + q.duration * 60000 + QUIZ_GRACE_MS);
// তালিকায় দেখানোর তথ্য (প্রশ্ন ছাড়া) — sid = ব্যাচের শিক্ষার্থী বা অনলাইন শিক্ষার্থীর আইডি (না থাকলে "")
function quizCard(q, sid) {
  const mine = sid ? ((q.attempts || {})[sid] || []) : [], done = mine.filter((a) => a.submittedAt), st = q.live ? quizState(q) : "upcoming", going = sid ? openAttempt(q, sid) : null;
  // অবস্থান: প্রত্যেকের সেরা নম্বর ধরে (সমান নম্বরে একই অবস্থান); সাথে গড় আর সর্বোচ্চ
  const bests = Object.values(q.attempts || {}).map((l) => l.filter((a) => a.submittedAt)).filter((l) => l.length).map((l) => Math.max(...l.map((a) => a.score))).sort((a, b) => b - a);
  const myBest = done.length ? Math.max(...done.map((a) => a.score)) : null;
  return {
    rank: myBest === null ? null : bests.indexOf(myBest) + 1, of: bests.length, avg: bests.length ? bests.reduce((a, x) => a + x, 0) / bests.length : null, high: bests.length ? bests[0] : null,
    id: q.id, title: q.title, subject: q.subject, chapter: q.chapter, session: q.session, duration: q.duration, opensAt: q.opensAt, closesAt: q.closesAt, mark: q.mark, negative: q.negative, negValue: q.negValue,
    attemptsAllowed: q.attemptsAllowed, count: q.live ? q.questions.length : 0, full: q.questions.length * q.mark, state: st, showAnswers: q.showAnswers,
    myAttempts: done.map(({ no, score, full, correct, wrong, skipped, submittedAt, late }) => ({ no, score, full, correct, wrong, skipped, submittedAt, late })),
    inProgress: !!going, canStart: st === "open" && (mine.length < q.attemptsAllowed || !!going),
  };
}
const byOpens = (a, b) => (b.opensAt || "").localeCompare(a.opensAt || "");
function quizzesFor(s) {
  return db.quizzes.filter((q) => quizFor(q, s) || quizAnnouncedFor(q, s)).map((q) => quizCard(q, s.id)).sort(byOpens);
}
// ঘোষণা: খোলার সময় দেওয়া থাকলে, সেশন / ব্যাচের সব শিক্ষার্থী আগেই জানে কবে কোন বিষয়ের কুইজ
const quizAnnouncedFor = (q, s) => !!s && !q.live && q.announce && !!q.opensAt && (!q.session || q.session === s.session) && (!(q.batchIds || []).length || q.batchIds.includes(s.batchId)) && nowLocal() < (q.closesAt || q.opensAt.slice(0, 10) + "T23:59");
// ফলাফল প্রকাশ → শিক্ষার্থী প্যানেলের নোটিশ বোর্ডে নোটিশ (শুধু প্রকাশিত ব্যাচ দেখে, ১৪ দিন থাকে); সব ব্যাচ প্রত্যাহার করলে / পরীক্ষা মুছলে নোটিশও যায়
function syncResultNotice(ex, gone) {
  const i = db.notices.findIndex((n) => n.resultExamId === ex.id), batchIds = gone ? [] : Object.keys(ex.published || {});
  if (!batchIds.length) { if (i >= 0) db.notices.splice(i, 1); return; }
  const names = batchIds.map((id) => (db.batches.find((b) => b.id === id) || {}).name || id).join(", ");
  const until = new Date(Date.parse(today() + "T00:00:00Z") + 14 * 864e5).toISOString().slice(0, 10);
  const n = { title: `${ex.title}-এর ফলাফল প্রকাশিত হয়েছে`, body: `ব্যাচ ${names}: "${ex.title}"-এর ফলাফল প্রকাশিত হয়েছে। "ফলাফল" ট্যাবে নিজের নম্বর, পাস-ফেল আর মেধাক্রম দেখো।`, date: today(), until, public: false, important: true, tag: "ফলাফল", resultExamId: ex.id, batchIds };
  if (i >= 0) Object.assign(db.notices[i], n, { updatedAt: new Date().toISOString() });
  else db.notices.push({ id: uid("not"), ...n, createdAt: new Date().toISOString() });
}
// কুইজের ঘোষণা → নোটিশ বোর্ডে একটা নোটিশ (কুইজ বদলালে নোটিশও বদলায়, ঘোষণা তুলে নিলে / কুইজ মুছলে নোটিশও মুছে যায়)
function syncQuizNotice(q, gone) {
  const i = db.notices.findIndex((n) => n.quizId === (q && q.id));
  if (gone || !q.announce || !q.opensAt) { if (i >= 0) db.notices.splice(i, 1); return; }
  const bnD = (x) => String(x).replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
  // যেমন: ৩০ অক্টোবর ২০২৬ (শুক্রবার) সন্ধ্যা ৬:০০টা
  const when = (v) => { const d = new Date(v), h = d.getHours(), part = h < 4 ? "রাত" : h < 12 ? "সকাল" : h < 15 ? "দুপুর" : h < 18 ? "বিকাল" : h < 20 ? "সন্ধ্যা" : "রাত";
    return `${d.toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" })} (${d.toLocaleDateString("bn-BD", { weekday: "long" })}) ${part} ${bnD(h % 12 || 12)}:${bnD(String(d.getMinutes()).padStart(2, "0"))}টা`; };
  const who = (q.batchIds || []).length ? "ব্যাচ " + q.batchIds.map((id) => (db.batches.find((b) => b.id === id) || {}).name || id).join(", ") : `${q.session || "উভয় সেশন"}-এর সব শিক্ষার্থী`;
  const subj = [q.subject, q.chapter].filter(Boolean).join(" — ");
  const n = {
    title: `অনলাইন কুইজ: ${subj || q.title} — ${new Date(q.opensAt).toLocaleDateString("bn-BD", { day: "numeric", month: "long" })}`,
    body: `${when(q.opensAt)} থেকে "${q.title}" অনলাইন কুইজ।${subj ? ` বিষয়: ${subj}।` : ""} সময় ${bnD(q.duration)} মিনিট${q.closesAt ? `, ${when(q.closesAt)}-এর মধ্যে দিতে হবে` : ""}।${q.negative ? ` প্রতি ভুলে −${bnD(q.negValue)} নম্বর কাটা যাবে।` : ""} কারা দেবে: ${who}${q.open ? " ও অনলাইন শিক্ষার্থীরা (ওয়েবসাইটের অনলাইন কুইজ পেজ)" : ""}। শিক্ষার্থী প্যানেলের "অনলাইন কুইজ" ট্যাব থেকে দিতে হবে।`,
    until: (q.closesAt || q.opensAt).slice(0, 10), public: !!q.open, important: true, tag: "কুইজ", quizId: q.id,
  };
  if (i >= 0) Object.assign(db.notices[i], n, { updatedAt: new Date().toISOString() });
  else db.notices.push({ id: uid("not"), date: today(), ...n, createdAt: new Date().toISOString() });
}
// ---- অনলাইন (ব্যাচের বাইরের) শিক্ষার্থী ----
// ছোট ফর্ম (নাম, মোবাইল, এইচএসসি ব্যাচ, গ্রুপ, কলেজ) পূরণ করে "সবার জন্য খোলা" কুইজ দেয়। মোবাইল দিয়ে চেনা হয়, আইডি G0001…
const QUIZ_GROUPS = ["বিজ্ঞান", "মানবিক", "ব্যবসায় শিক্ষা"];
const hscOptions = () => { const y = new Date().getFullYear() % 100; return [...new Set([y, y + 1, y + 2].map((n) => `HSC-${n}`).concat(db.sessions.map((s) => s.name).filter((n) => /^HSC-\d{2}$/.test(n))))].sort(); };
const quizForGuest = (q) => !!(q.live && q.open);
const guestOf = (req) => { const g = getLogin(req, "guest"); return g && db.quizGuests.find((x) => x.id === g.sid); };
const nextGuestId = () => "G" + String(db.quizGuests.reduce((n, g) => Math.max(n, Number(g.id.slice(1)) || 0), 0) + 1).padStart(4, "0");

// ---------- সম্ভাব্য শিক্ষার্থী (Leads) — শুধু অ্যাডমিন ----------
// সব উৎস (অনলাইন কুইজ, ভর্তির আগ্রহ ফর্ম, Talent Hunt, অফলাইন মার্কেটিং, হাতে যোগ) এক তালিকায়।
// একই মোবাইল একবারই থাকে — আবার এলে আগের রেকর্ডে নতুন উৎস যোগ হয়, খালি ঘরগুলো পূরণ হয়।
const LEAD_STATUS = ["new", "contacted", "interested", "followup", "admitted", "notinterested", "wrong", "dnc"];
const LEAD_SOURCES = ["quiz", "enquiry", "talent", "course", "offline", "manual"];
const LEAD_FIELDS = ["name", "guardianPhone", "batch", "institution", "location", "course"];
const nextLeadNo = () => "L" + String(db.leads.reduce((n, l) => Math.max(n, Number(String(l.leadNo).slice(1)) || 0), 0) + 1).padStart(4, "0");
const cleanSource = (s = {}) => ({
  type: LEAD_SOURCES.includes(s.type) ? s.type : "manual", ref: str(s.ref, 60), campaign: str(s.campaign, 120), place: str(s.place, 120),
  collectedBy: str(s.collectedBy, 80), note: str(s.note, 500), at: str(s.at, 30) || new Date().toISOString(),
});
// info: নাম, মোবাইল ইত্যাদি; source: কোথা থেকে এল। ফেরত দেয় { lead, created } — মোবাইল ঠিক না হলে null
function upsertLead(info, source, extra = {}) {
  const phone = phoneOf(info.phone);
  if (!/^01\d{9}$/.test(phone)) return null;
  const src = cleanSource(source);
  let lead = db.leads.find((l) => l.phone === phone), created = false;
  if (!lead) {
    lead = { id: uid("lea"), leadNo: nextLeadNo(), phone, name: "", guardianPhone: "", batch: "", institution: "", location: "", course: "", status: "new", followUp: "", remarks: "", smsConsent: true, sources: [], createdAt: new Date().toISOString() };
    db.leads.push(lead); created = true;
  }
  for (const k of LEAD_FIELDS) { const v = k === "guardianPhone" ? phoneOf(info[k]) : str(info[k], 150); if (v && !lead[k]) lead[k] = v; }
  if (created) Object.assign(lead, extra);
  // একই উৎস (একই ধরন + একই রেফারেন্স) দুবার জমা হয় না
  if (!lead.sources.some((x) => x.type === src.type && (src.ref ? x.ref === src.ref : !x.ref && x.campaign === src.campaign))) lead.sources.push(src);
  lead.updatedAt = new Date().toISOString();
  return { lead, created };
}
// আগে থেকে জমা থাকা কুইজের অনলাইন শিক্ষার্থী আর ভর্তির খোঁজ — প্রতিবার চালুর সময় মিলিয়ে নেওয়া (একই জিনিস দুবার যোগ হয় না)
(function syncLeads() {
  const ENQ = { called: "contacted", admitted: "admitted", closed: "notinterested" };
  const before = JSON.stringify(db.leads);
  for (const g of db.quizGuests) upsertLead({ name: g.name, phone: g.phone, batch: g.hsc, institution: g.college }, { type: "quiz", ref: g.id, note: g.group, at: g.createdAt });
  for (const e of db.enquiries) upsertLead({ name: e.name, phone: e.phone, course: e.course, institution: e.college, batch: e.klass }, { type: "enquiry", ref: e.id, note: e.message, at: e.createdAt }, { status: ENQ[e.status] || "new", remarks: e.note || "" });
  for (const s of db.students) { const l = db.leads.find((x) => x.phone === s.phone); if (l && l.status !== "admitted") { l.status = "admitted"; l.studentId = s.id; } }
  if (JSON.stringify(db.leads) !== before) saveDb();
})();

// ---------- 🏆 ট্যালেন্ট হান্ট ----------
// প্রতিবার আলাদা ট্যালেন্ট হান্ট (নাম, কোড, তারিখ, বিষয় ও পূর্ণমান)। অফলাইনে কাগজে MCQ — পরে অ্যাডমিন রোল ধরে নম্বর তোলে।
// live = রেজিস্ট্রেশন চালু (অ্যাডমিন যখন খুশি চালু / বন্ধ); resultPublished = ফলাফল ওয়েবসাইটে। ফলাফল অন্য কোনো পরীক্ষার সাথে মেশে না।
const huntById = (id) => db.talentHunts.find((h) => h.id === id);
const regsOf = (huntId) => db.thRegs.filter((r) => r.huntId === huntId);
const nextRoll = (h) => `${h.code}-${String(regsOf(h.id).reduce((n, r) => Math.max(n, Number(String(r.roll).split("-").pop()) || 0), 0) + 1).padStart(4, "0")}`;
const huntFull = (h) => (h.subjects || []).reduce((t, s) => t + (Number(s.full) || 0), 0);
// নম্বরের ঘর: বিষয়ে CQ আর MCQ দুটোই থাকলে আলাদা দুই ঘর ("ICT CQ", "ICT MCQ"); একটা থাকলে বিষয়ের নামেই (পুরনো {name, full} = শুধু MCQ)
const huntCols = (h) => (h.subjects || []).flatMap((s) => {
  const legacy = s.cq === undefined && s.mcq === undefined, cq = legacy ? 0 : Number(s.cq) || 0, mcq = legacy ? Number(s.full) || 0 : Number(s.mcq) || 0;
  return cq && mcq ? [{ key: `${s.name} CQ`, label: `${s.name} CQ`, full: cq, part: "cq" }, { key: `${s.name} MCQ`, label: `${s.name} MCQ`, full: mcq, part: "mcq" }] : [{ key: s.name, label: `${s.name} (${cq ? "CQ" : "MCQ"})`, full: cq || mcq, part: cq ? "cq" : "mcq" }];
});
// পাসের নম্বর: CQ আর MCQ-তে আলাদা (সেটিংসে দেওয়া %, না থাকলে ৪০%)
const huntPassOf = (h, c) => Math.ceil((c.full * (Number(c.part === "cq" ? h.passCq : h.passMcq) || 40)) / 100 - 1e-9);
// মেধাক্রম: উপস্থিতদের মোট নম্বর বেশি থেকে কম; সমান হলে একই মেধা
function huntMerit(h) {
  const rows = regsOf(h.id).filter((r) => !r.absent && r.marks && Object.keys(r.marks).length)
    .map((r) => ({ r, total: huntCols(h).reduce((t, c) => t + (Number(r.marks[c.key]) || 0), 0), pass: huntCols(h).every((c) => (Number(r.marks[c.key]) || 0) >= huntPassOf(h, c)) }))
    .sort((a, b) => Number(b.pass) - Number(a.pass) || b.total - a.total || String(a.r.roll).localeCompare(String(b.r.roll)));
  // পাস করা আগে (মেধাক্রমসহ), ফেল করলে মেধাক্রম নেই
  let rank = 0, prev = null;
  rows.forEach((x, i) => { if (!x.pass) { x.rank = null; return; } if (x.total !== prev) { rank = i + 1; prev = x.total; } x.rank = rank; });
  return rows;
}
// ওয়েবসাইটে কোনটা দেখাবে: রেজিস্ট্রেশন চালু বা ফলাফল প্রকাশিত — সবচেয়ে নতুনটা
const publicHunt = () => db.talentHunts.filter((h) => h.live || h.resultPublished).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
const huntInfo = (h) => ({ id: h.id, title: h.title, code: h.code, examDate: h.examDate, examTime: h.examTime, venue: h.venue, details: h.details, subjects: (h.subjects || []).map((s) => ({ name: s.name, full: s.full, cq: Number(s.cq) || 0, mcq: s.cq === undefined && s.mcq === undefined ? Number(s.full) || 0 : Number(s.mcq) || 0 })), full: huntFull(h), live: !!h.live, resultPublished: !!h.resultPublished });
const regPublic = (r) => ({ roll: r.roll, name: r.name, klass: r.klass, college: r.college, course: r.course });
// ---------- SMS (BulkSMSBD) — অতিথি অ্যাকাউন্টের OTP ----------
// API key আলাদা ফাইলে (data/sms.json) — ওয়েবসাইটে কখনো যায় না, জিপ / ব্যাকআপেও বাদ রাখতে হবে
const SMS_FILE = path.join(DATA, "sms.json");
let smsCfg = readJson(SMS_FILE, null) || { apiKey: "", senderId: "", enabled: false };
const smsOn = () => !!(smsCfg.enabled && smsCfg.apiKey && smsCfg.senderId);
const SMS_BASE = process.env.SMS_BASE || "https://bulksmsbd.net/api"; // পরীক্ষার সময় নকল সার্ভারে পাঠাতে
const SMS_CODES = { 1001: "নম্বর ঠিক নেই", 1002: "Sender ID ঠিক নেই বা চালু হয়নি", 1003: "সব তথ্য দেওয়া হয়নি", 1005: "BulkSMSBD-এর ভেতরের সমস্যা", 1006: "ব্যালেন্সের মেয়াদ শেষ", 1007: "ব্যালেন্স নেই — রিচার্জ করুন", 1011: "API key ঠিক নেই", 1031: "অ্যাকাউন্ট এখনো যাচাই হয়নি", 1032: "এই কম্পিউটারের IP BulkSMSBD-তে whitelist করা নেই" };
async function sendSms(phone, message, logText, filter = "OTP") {
  if (!smsOn()) throw new Error("SMS সার্ভিস চালু নেই");
  const q = new URLSearchParams({ api_key: smsCfg.apiKey, type: "text", number: "88" + phone, senderid: smsCfg.senderId, message });
  // POST avoids cached GET acknowledgements; never put API keys or login PINs in URLs.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const log = { id: uid("sms"), date: today(), at: new Date().toISOString(), text: logText || message.replace(/\d{6}/, "••••••"), filter, leadIds: [], count: 1, phone, attempt, ok: false, status: "unknown", code: null };
    let r, j;
    try {
      r = await fetch(`${SMS_BASE}/smsapi`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-store" }, body: q.toString(), cache: "no-store", signal: AbortSignal.timeout(15000) });
      j = await r.json();
    } catch {
      db.smsLog.push(log);
      const error = new Error("SMS গেটওয়ের উত্তর নিশ্চিত পাওয়া যায়নি। ফোনে না এলে আবার পাঠান");
      error.smsStatus = "unknown"; throw error;
    }
    const code = j?.response_code != null && String(j.response_code).trim() !== "" ? Number(j.response_code) : NaN;
    log.code = Number.isFinite(code) ? code : null;
    log.ok = r.ok && code === 202;
    log.status = log.ok ? "submitted" : Number.isFinite(code) && code !== 202 ? "rejected" : "unknown";
    const reference = j?.message_id ?? j?.sms_id ?? j?.request_id;
    if ((typeof reference === "string" || typeof reference === "number") && String(reference).length <= 160) log.messageId = String(reference);
    db.smsLog.push(log);
    if (log.ok) return { status: "submitted", attempts: attempt, ...(log.messageId ? { messageId: log.messageId } : {}) };
    // Retry only an explicit Internal Error rejection, never an accepted SMS or an
    // ambiguous timeout: those could otherwise create duplicate, chargeable messages.
    if (code === 1005 && attempt === 1) { await new Promise(resolve => setTimeout(resolve, 1000)); continue; }
    const error = new Error("SMS গেটওয়ে গ্রহণ করেনি: " + (SMS_CODES[code] || (log.status === "unknown" ? "পাঠানোর ফল নিশ্চিত নয়" : `ত্রুটি কোড ${code}`)));
    error.smsStatus = log.status; throw error;
  }
}
// OTP: ৬ সংখ্যা, ৫ মিনিট, ৫ বার ভুল পর্যন্ত; একই নম্বরে ১ মিনিটে একবার, ঘণ্টায় ৫ বার; একই জায়গা থেকে ঘণ্টায় ১০ বার
const otps = new Map(), otpSent = new Map();
// SMS ইংরেজিতে (বাংলা অক্ষর থাকলে এক SMS-এ কম অক্ষর ধরে, খরচ বাড়ে) — প্রতিষ্ঠানের নাম ইংরেজি না হলে ডিফল্ট নাম
const smsBrand = () => [db.settings.name, db.settings.shortName].map((x) => str(x, 40)).find((x) => x && /^[ -~]+$/.test(x)) || "Shahin's ICT Care";
// ভর্তি হলেই লগইনের তথ্য SMS-এ (লগে PIN থাকে না); না গেলে কারণ রেখে দেওয়া হয়, অ্যাডমিন থেকে আবার পাঠানো যায়
const loginSmsInFlight = new WeakMap();
async function smsLogin(x, message, log, phones) {
  if (loginSmsInFlight.has(x)) return loginSmsInFlight.get(x);
  const phone = phones.map(phoneOf).find((n) => /^01\d{9}$/.test(n)), at = new Date().toISOString();
  if (!phone) return (x.loginSms = { ok: false, at, error: "সঠিক মোবাইল নম্বর নেই" });
  const task = (async () => {
    try { const result = await sendSms(phone, message, log, "ID/PIN"); return (x.loginSms = { ok: true, at: new Date().toISOString(), phone, ...result }); }
    catch (e) { return (x.loginSms = { ok: false, at, phone, status: e.smsStatus || "failed", error: e.message }); }
  })();
  loginSmsInFlight.set(x, task);
  try { return await task; } finally { loginSmsInFlight.delete(x); }
}
const smsStudentLogin = (s) => smsLogin(s, `${smsBrand()}: Admission complete. Student ID: ${s.id}, PIN: ${s.pin}. Use these to log in to the Student Panel. Do not share.`, `ভর্তি — আইডি ${s.id}, PIN ••••`, [s.phone, s.guardianPhone]);
const smsLearnerLogin = (l) => smsLogin(l, `${smsBrand()}: Online course login - Mobile: ${l.phone}, PIN: ${l.pin}. Do not share.`, `অনলাইন কোর্স — ${l.phone}, PIN ••••`, [l.phone]);
// ফলাফলের SMS: নম্বর, পাস / ফেল, মেধাক্রম। key বদলালে (নম্বর সংশোধন) আবার পাঠানো যায়; নম্বর বাকি থাকলে null
function resultSmsOf(ex, s) {
  const row = EC.results(ex).rows.find((r) => r.sid === s.id), arr = (ex.marks || {})[s.id] || [];
  const absent = (!row || row.absent) && arr.some((a) => EC.isAbsent(a));
  if (absent) return { key: "absent", text: `সম্মানিত অভিভাবক, ${s.name} ${ex.title} পরীক্ষায় অনুপস্থিত ছিল। — Shahin Sir` };
  if (!row || row.absent) return null;
  const n = (x) => (Math.round(x * 100) / 100).toLocaleString("bn-BD", { useGrouping: false });
  const res = row.pass ? `উত্তীর্ণ হয়েছে${row.rank ? `, মেধাক্রম ${n(row.rank)}` : ""}` : "অকৃতকার্য হয়েছে";
  return { key: `${row.total}|${row.pass}`, text: `সম্মানিত অভিভাবক, ${s.name} ${ex.title} পরীক্ষায় ${n(EC.fullOf(ex))}-এর মধ্যে ${n(row.total)} নম্বর পেয়ে ${res}। — Shahin Sir` };
}
const resultPhones = (s) => [...new Set([s.phone, s.guardianPhone].map(phoneOf).filter((n) => /^01\d{9}$/.test(n)))];
// SMS প্যানেল: ব্যাচ বা আইডি ধরে বাছা শিক্ষার্থীদের নিজের লেখা বার্তা, নয়তো কোনো পরীক্ষার ফলাফল।
// কোন নম্বরে: শিক্ষার্থী / অভিভাবক / দুটোতেই। লেখায় {নাম} {আইডি} {ব্যাচ} {সেশন} {প্রতিষ্ঠান} প্রত্যেকের নিজেরটা দিয়ে বদলায়।
// ফেরত: { text, phones, skip } — skip থাকলে এই শিক্ষার্থীকে পাঠানো হবে না (কারণসহ)
function smsPanelItem(b, s) {
  const to = ["student", "guardian"].includes(b.to) ? b.to : "both";
  const phones = [...new Set((to === "student" ? [s.phone] : to === "guardian" ? [s.guardianPhone] : [s.phone, s.guardianPhone]).map(phoneOf).filter((n) => /^01\d{9}$/.test(n)))];
  let text = "", got = false;
  if (b.mode === "result") {
    const ex = db.exams.find((e) => e.id === str(b.examId, 60));
    if (!ex) return { phones, skip: "পরীক্ষা বাছা হয়নি" };
    if (!(ex.studentIds || []).includes(s.id) && !(ex.marks || {})[s.id]) return { phones, skip: "এই পরীক্ষায় নেই" };
    if (!isPublishedFor(ex, s)) return { phones, skip: "ফলাফল প্রকাশ হয়নি" };
    const r = resultSmsOf(ex, s);
    if (!r) return { phones, skip: "নম্বর দেওয়া হয়নি" };
    text = r.text; got = ((ex.resultSms || {})[s.id] || {}).key === r.key;
    if (got && b.skipGot !== false) return { phones, text, got, skip: "আগেই পেয়েছে" };
  } else {
    const batch = db.batches.find((x) => x.id === s.batchId) || {};
    text = str(b.text, 1000).trim().replace(/\{নাম\}/g, s.name).replace(/\{আইডি\}/g, s.id).replace(/\{ব্যাচ\}/g, batch.name || "").replace(/\{সেশন\}/g, s.session || batch.session || "").replace(/\{প্রতিষ্ঠান\}/g, db.settings.name || smsBrand());
    if (!text) return { phones, skip: "বার্তা লেখা হয়নি" };
  }
  if (!phones.length) return { phones, text, got, skip: to === "guardian" ? "অভিভাবকের মোবাইল নেই" : to === "student" ? "শিক্ষার্থীর মোবাইল নেই" : "মোবাইল নেই" };
  return { phones, text, got, skip: "" };
}
// ---------- বই ও শিট: স্টক, বিক্রি (ছাড়, ফ্রি, বাকি), ওয়েবসাইট থেকে অনলাইন অর্ডার ----------
// স্টক বাড়ে "স্টক যোগ" থেকে (bookMoves-এ হিসাব), কমে বিক্রি থেকে; বিক্রি বাতিল হলে ফেরত আসে।
// বিক্রি: শিক্ষার্থী (আইডি) বা বাইরের ক্রেতা; ছাড় টাকায়, "ফ্রি" দিলে মোট ০; যা দেয়নি তা বাকি — পরে "টাকা জমা" দিয়ে শোধ।
const BD_GEO = {
  "ঢাকা": ["ঢাকা", "গাজীপুর", "নারায়ণগঞ্জ", "নরসিংদী", "মানিকগঞ্জ", "মুন্সিগঞ্জ", "ফরিদপুর", "গোপালগঞ্জ", "মাদারীপুর", "রাজবাড়ী", "শরীয়তপুর", "কিশোরগঞ্জ", "টাঙ্গাইল"],
  "চট্টগ্রাম": ["চট্টগ্রাম", "কক্সবাজার", "কুমিল্লা", "ব্রাহ্মণবাড়িয়া", "চাঁদপুর", "ফেনী", "লক্ষ্মীপুর", "নোয়াখালী", "খাগড়াছড়ি", "রাঙ্গামাটি", "বান্দরবান"],
  "রাজশাহী": ["রাজশাহী", "বগুড়া", "জয়পুরহাট", "নওগাঁ", "নাটোর", "চাঁপাইনবাবগঞ্জ", "পাবনা", "সিরাজগঞ্জ"],
  "খুলনা": ["খুলনা", "বাগেরহাট", "সাতক্ষীরা", "যশোর", "ঝিনাইদহ", "মাগুরা", "নড়াইল", "কুষ্টিয়া", "চুয়াডাঙ্গা", "মেহেরপুর"],
  "বরিশাল": ["বরিশাল", "বরগুনা", "ভোলা", "ঝালকাঠি", "পটুয়াখালী", "পিরোজপুর"],
  "সিলেট": ["সিলেট", "মৌলভীবাজার", "হবিগঞ্জ", "সুনামগঞ্জ"],
  "রংপুর": ["রংপুর", "দিনাজপুর", "গাইবান্ধা", "কুড়িগ্রাম", "লালমনিরহাট", "নীলফামারী", "পঞ্চগড়", "ঠাকুরগাঁও"],
  "ময়মনসিংহ": ["ময়মনসিংহ", "জামালপুর", "নেত্রকোণা", "শেরপুর"],
};
const BOOK_METHODS = ["নগদ (Cash)", "বিকাশ", "নগদ (Nagad)", "রকেট", "ব্যাংক", "ক্যাশ অন ডেলিভারি"];
const bookById = (id) => db.books.find((b) => b.id === id);
const salePaid = (s) => (s.payments || []).reduce((a, p) => a + num(p.amount), 0);
const saleDue = (s) => Math.max(0, num(s.total) - salePaid(s));
const nextNo = (list, key, start) => list.reduce((m, x) => Math.max(m, x[key] || 0), start) + 1;
// ডেলিভারি চার্জ: নিজের জেলায় একটা, বাইরে আরেকটা; অফিস থেকে নিজে নিলে ০
const bookShip = () => { const s = db.settings.bookShip || {}; return { home: BD_GEO[s.homeDiv] && BD_GEO[s.homeDiv].includes(s.home) ? s.home : "ঢাকা", homeDiv: BD_GEO[s.homeDiv] ? s.homeDiv : "ঢাকা", inside: s.inside ?? 70, outside: s.outside ?? 130, pickup: s.pickup !== false, note: s.note || "" }; };
const shipCharge = (district, pickup) => { const s = bookShip(); return pickup && s.pickup ? 0 : district === s.home ? s.inside : s.outside; };
// জিনিসের তালিকা যাচাই: একই বই একবারই (পরিমাণ যোগ হয়), স্টকের বেশি নয়; দাম না দিলে বইয়ের দাম
function bookLines(items, { listPrice = false, onlineOnly = false } = {}) {
  const map = new Map();
  for (const it of Array.isArray(items) ? items.slice(0, 50) : []) {
    const b = bookById(str(it.bookId || it.id, 60)), qty = Math.floor(num(it.qty));
    if (!b || qty < 1) continue;
    if (onlineOnly && !(b.online && b.active !== false)) return { error: `"${b.title}" এখন অনলাইনে অর্ডার করা যায় না` };
    const price = listPrice || it.price === undefined || it.price === "" ? b.price : Math.max(0, Math.round(num(it.price)));
    const old = map.get(b.id);
    map.set(b.id, { bookId: b.id, title: b.title, kind: b.kind, qty: (old ? old.qty : 0) + qty, price: old ? old.price : price });
  }
  const lines = [...map.values()];
  if (!lines.length) return { error: "অন্তত একটা বই / শিট আর পরিমাণ দিন" };
  for (const l of lines) { const b = bookById(l.bookId); if (num(b.stock) < l.qty) return { error: `"${b.title}" স্টকে আছে ${num(b.stock)}টি — ${l.qty}টি দেওয়া যাবে না` }; }
  return { lines };
}
const moveStock = (lines, sign) => lines.forEach((l) => { const b = bookById(l.bookId); if (b) b.stock = num(b.stock) + sign * l.qty; });
// নতুন বিক্রি (অফিস থেকে, বা অনলাইন অর্ডার নিশ্চিত করলে) — স্টক কমে, রসিদ নম্বর S1001…
function makeSale(b, extra = {}) {
  const buyerType = b.buyerType === "student" ? "student" : "outside";
  const st = buyerType === "student" ? db.students.find((s) => s.id === str(b.studentId, 40)) : null;
  if (buyerType === "student" && !st) return { error: "শিক্ষার্থীর আইডি ঠিক নেই" };
  const name = st ? st.name : str(b.name, 120), phone = st ? phoneOf(st.phone || st.guardianPhone) : phoneOf(b.phone);
  if (!name) return { error: "ক্রেতার নাম লিখুন" };
  if (phone && !/^01\d{9}$/.test(phone)) return { error: "মোবাইল নম্বর ঠিক নেই" };
  const L = bookLines(b.items, { listPrice: !!extra.listPrice });
  if (L.error) return L;
  const free = !!b.free, subtotal = L.lines.reduce((a, l) => a + l.qty * l.price, 0), delivery = Math.max(0, Math.round(num(b.delivery)));
  const discount = free ? subtotal : Math.min(subtotal, Math.max(0, Math.round(num(b.discount))));
  const total = free ? 0 : subtotal - discount + delivery, paid = free ? 0 : Math.min(total, Math.max(0, Math.round(num(b.paid))));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str(b.date, 10)) ? str(b.date, 10) : today(), method = BOOK_METHODS.includes(b.method) ? b.method : BOOK_METHODS[0];
  const sale = { id: uid("bsl"), saleNo: nextNo(db.bookSales, "saleNo", 1000), date, buyerType, studentId: st ? st.id : "", name, phone, address: str(b.address, 300),
    lines: L.lines, subtotal, discount, delivery, total, free, method, note: str(b.note, 300), payments: paid ? [{ id: uid("bpy"), date, amount: paid, method }] : [], createdAt: new Date().toISOString(), ...extra.fields };
  moveStock(L.lines, -1);
  db.bookSales.push(sale);
  return { sale };
}
function dropSale(sale) {
  moveStock(sale.lines, +1);
  db.bookSales = db.bookSales.filter((x) => x.id !== sale.id);
}
const BOOK_STATUS = { new: "নতুন", confirmed: "নিশ্চিত", shipped: "পাঠানো হয়েছে", delivered: "পৌঁছেছে", cancelled: "বাতিল" };
const bookHits = new Map();
const otpKey = (phone, purpose) => purpose + ":" + phone;
function otpCheck(phone, purpose, code) {
  const k = otpKey(phone, purpose), o = otps.get(k);
  if (!o || o.exp < Date.now()) return "কোডের মেয়াদ শেষ — নতুন কোড নিন";
  if (o.tries >= 5) { otps.delete(k); return "অনেকবার ভুল হয়েছে — নতুন কোড নিন"; }
  if (!sameHash(hashPassword(str(code, 10), o.salt), o.hash)) { o.tries++; return "কোড মেলেনি"; }
  otps.delete(k); return "";
}
// ---------- প্রতিদিন শিখি (Daily Learning) — সবার জন্য ফ্রি, লগইন লাগে না ----------
// প্রকাশিত আর প্রকাশের তারিখ আজ বা আগের পোস্টই শুধু দেখা যায় (সামনের তারিখ দিলে সেদিন নিজে থেকে দেখা দেয়); খসড়া কখনো না
const DAILY_CATS = ["bangla", "ict", "gk", "english", "fact", "brain"];
const dailyLive = () => db.daily.filter((d) => d.status !== "draft" && d.title && (d.date || "") <= today()).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)));
const dailyCard = (d) => ({ id: d.id, category: d.category, title: d.title, date: d.date, excerpt: String(d.body || "").replace(/\s+/g, " ").slice(0, 180), img: d.image ? `/api/dimage/${d.id}/image?v=${d.image.v}` : "", quiz: (d.quiz || []).length });
// ---------- প্রশ্নোত্তর বক্স (মূল পাতার "প্রশ্ন ও উত্তর") ----------
// যে কেউ লেখা + ছবি + ভয়েস দিয়ে প্রশ্ন করে; শিক্ষক অ্যাডমিন থেকে লেখা / ছবি / অডিও / ভিডিও (বা YouTube) মিলিয়ে উত্তর দেন।
// প্রশ্ন আর উত্তর শুধু প্রশ্নকারী নিজের অ্যাকাউন্টে ("আমার প্রশ্ন") দেখে; সবার জন্য খোলা নয়।
const QNA_KINDS = { "q-image": "image", "q-audio": "audio", "a-image": "image", "a-audio": "audio", "a-video": "video" };
const QNA_TYPES = {
  image: { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" },
  audio: { "audio/webm": ".weba", "audio/ogg": ".ogg", "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/x-m4a": ".m4a", "audio/aac": ".aac", "audio/wav": ".wav", "audio/x-wav": ".wav" },
  video: { "video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov" },
};
const QNA_MIME = Object.fromEntries(Object.values(QNA_TYPES).flatMap((t) => Object.entries(t).map(([mime, ext]) => [ext, mime])));
const QNA_LIMIT = { image: 8 * 1024 * 1024, audio: 15 * 1024 * 1024, video: 300 * 1024 * 1024 };
const qnaFile = (q, kind) => (q.files && q.files[kind] ? path.join(QNA, `${String(q.id).replace(/[^\w-]/g, "")}-${kind}${q.files[kind].ext}`) : "");
const qnaUrl = (base, q, kind) => (q.files && q.files[kind] ? `${base}/${q.id}/${kind}?v=${q.files[kind].v}` : "");
const qnaPublic = (q) => ({
  id: q.id, name: q.name || "", text: q.text, date: q.date, img: qnaUrl("/api/qna", q, "q-image"), audio: qnaUrl("/api/qna", q, "q-audio"),
  answer: { text: q.answer || "", img: qnaUrl("/api/qna", q, "a-image"), audio: qnaUrl("/api/qna", q, "a-audio"), video: qnaUrl("/api/qna", q, "a-video"), yt: q.yt || "", by: q.answeredBy || "", at: q.answeredAt || "" },
});
// প্রশ্ন আর উত্তর শুধু প্রশ্নকারী নিজে দেখে (অতিথি অ্যাকাউন্ট বা শিক্ষার্থী লগইন মিলিয়ে) — ওয়েবসাইটে সবার জন্য দেখানো হয় না
const qnaAsker = (req) => { const g = guestOf(req); if (g) return { guestId: g.id }; const s = getLogin(req, "student"); return s ? { studentId: s.sid } : null; };
const qnaOwns = (who, q) => !!(who && q && ((who.guestId && q.guestId === who.guestId) || (who.studentId && q.studentId === who.studentId)));
const ytId = (v) => { const s = str(v, 300); const m = s.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/); return m ? m[1] : /^[\w-]{11}$/.test(s) ? s : ""; };
// ফাইল জমা: Content-Type দেখে ধরন ঠিক করা, আগের ফাইল থাকলে বদলে দেওয়া
async function qnaSaveFile(req, q, kind) {
  const group = QNA_KINDS[kind], mime = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase(), ext = QNA_TYPES[group][mime];
  if (!ext) throw Object.assign(new Error(group === "image" ? "শুধু JPG, PNG, WEBP বা GIF ছবি দিন" : group === "audio" ? "এই ধরনের অডিও চলবে না — MP3, M4A, WEBM বা OGG দিন" : "শুধু MP4, WEBM বা MOV ভিডিও দিন"), { code: 400 });
  const old = qnaFile(q, kind), file = path.join(QNA, `${String(q.id).replace(/[^\w-]/g, "")}-${kind}${ext}`);
  const size = await saveUpload(req, file, QNA_LIMIT[group]).catch((e) => { throw Object.assign(new Error(e.message === "too large" ? `ফাইল অনেক বড় — ${QNA_LIMIT[group] / 1024 / 1024} MB-এর মধ্যে দিন` : "ফাইল জমা হয়নি, আবার চেষ্টা করুন"), { code: 400 }); });
  if (old && old !== file) dropFile(old);
  q.files = { ...(q.files || {}), [kind]: { ext, size, v: Date.now() } };
}
function qnaSendFile(req, res, q, kind) {
  const f = q && qnaFile(q, kind);
  if (!f || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  const type = QNA_MIME[q.files[kind].ext] || "application/octet-stream";
  if (QNA_KINDS[kind] !== "image") return sendVideo(req, res, f, type); // অডিও / ভিডিও — সামনে-পিছনে টানা যায়
  res.writeHead(200, { "Content-Type": type, "Content-Length": fs.statSync(f).size, "Cache-Control": "private, max-age=3600" });
  fs.createReadStream(f).pipe(res);
}
const qnaHits = new Map(); // একই জায়গা থেকে ঘণ্টায় ৬টার বেশি প্রশ্ন নয়
// ---------- 🎬 ফ্রি ক্লাস ও অনলাইন কোর্স ----------
// প্রতিটা ভিডিও: YouTube লিংক (source "youtube", yt = ভিডিও আইডি) অথবা আপলোড করা ফাইল (source "file", file = { ext, size, v })।
// কোর্স: access "free" = ভর্তির ফর্ম দিলেই ক্লাস খোলে; "approval" = অ্যাডমিন অনুমোদন দিলে খোলে (টাকার কোর্স)।
// শিক্ষার্থী (learner) মোবাইল + ৪ সংখ্যার PIN দিয়ে ঢোকে; এক অ্যাকাউন্টে যত কোর্স।
const VIDEO_TYPES = { ".mp4": "video/mp4", ".webm": "video/webm", ".m4v": "video/mp4", ".mov": "video/quicktime" };
const videoPath = (key, f) => (f ? path.join(VIDEOS, `${String(key).replace(/[^\w-]/g, "")}${f.ext}`) : "");
const fcVideoKey = (c) => `fc-${c.id}`, lessonKey = (c, l) => `oc-${c.id}-${l.id}`, modLessonKey = (c, l) => `cm-${c.id}-${l.id}`; // cm = কোর্স মডিউলের রেকর্ড ক্লাস
const dropFile = (f) => { if (f) try { fs.unlinkSync(f); } catch {} };
// বড় ভিডিও মেমোরিতে না রেখে সরাসরি ফাইলে লেখা; limit পার হলে থামিয়ে মুছে দেয়
function saveUpload(req, file, limit) {
  return new Promise((resolve, reject) => {
    const tmp = file + ".part", out = fs.createWriteStream(tmp); let size = 0, bad = false;
    req.on("data", (c) => { size += c.length; if (size > limit && !bad) { bad = true; req.unpipe(out); out.destroy(); dropFile(tmp); reject(new Error("too large")); } });
    req.pipe(out);
    out.on("finish", () => { if (bad) return; try { fs.renameSync(tmp, file); resolve(size); } catch (e) { reject(e); } });
    out.on("error", (e) => { dropFile(tmp); reject(e); });
    req.on("error", (e) => { dropFile(tmp); reject(e); });
  });
}
// ভিডিও পাঠানো (Range সহ — সামনে-পিছনে টানা যায়)
function sendVideo(req, res, file, type) {
  if (!file || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  const size = fs.statSync(file).size, rg = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (rg) {
    const start = rg[1] ? Number(rg[1]) : Math.max(0, size - Number(rg[2])), end = rg[1] && rg[2] ? Math.min(Number(rg[2]), size - 1) : size - 1;
    if (start > end || start >= size) { res.writeHead(416, { "Content-Range": `bytes */${size}` }); return res.end(); }
    res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1, "Cache-Control": "private, max-age=3600" });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": size, "Cache-Control": "private, max-age=3600" });
  fs.createReadStream(file).pipe(res);
}
const videoOf = (x, src) => (x.source === "file" ? (x.file ? { type: "file", src } : null) : x.yt ? { type: "youtube", yt: x.yt } : null);
const thumbOf = (col, x) => (x.image ? `/api/${IMG_COLS[col].url}/${x.id}/image?v=${x.image.v}` : x.source !== "file" && x.yt ? `https://i.ytimg.com/vi/${x.yt}/hqdefault.jpg` : "");
const liveFree = () => db.freeClasses.filter((c) => c.active && (c.yt || c.file)).sort(byOrder)
  .map((c) => ({ id: c.id, title: c.title, subject: c.subject, thumb: thumbOf("freeClasses", c), video: videoOf(c, `/api/freeclass/${c.id}/video?v=${c.file && c.file.v}`) }));
const courseCard = (c) => ({
  id: c.id, title: c.title, subtitle: c.subtitle, duration: c.duration, price: c.price, salePrice: c.salePrice, access: c.access, features: c.features || [],
  cover: c.image ? `/api/ocourse/${c.id}/image?v=${c.image.v}` : "", lessons: (c.lessons || []).length, enrolled: db.ocEnrolls.filter((e) => e.courseId === c.id).length,
});
const liveCourses = () => db.onlineCourses.filter((c) => c.active).sort(byOrder).map(courseCard);
const learnerOf = (req, res) => { const s = getLogin(req, "learner", res); return s && db.learners.find((x) => x.id === s.sid); };
const enrollOf = (learner, courseId) => learner && db.ocEnrolls.find((e) => e.learnerId === learner.id && e.courseId === courseId);
function addReg(h, info, source, studentId) {
  const r = { id: uid("thr"), huntId: h.id, roll: nextRoll(h), name: str(info.name, 120), phone: phoneOf(info.phone), klass: str(info.klass, 60), college: str(info.college, 150), course: str(info.course, 120), source, studentId: studentId || "", marks: {}, absent: false, createdAt: new Date().toISOString() };
  db.thRegs.push(r);
  return r;
}
// কুইজ শুরু / জমা / উত্তর দেখা — ব্যাচের শিক্ষার্থী আর অনলাইন শিক্ষার্থী দুজনের জন্য একই নিয়ম
async function quizAction(req, res, act, m, url, sid, allowed) {
  const b = m === "POST" ? await readBody(req) : { id: url.searchParams.get("id") };
  const q = db.quizzes.find((x) => x.id === str(b.id, 60));
  if (!q || !allowed(q)) return send(res, 404, { error: "কুইজ পাওয়া যায়নি" });
  q.attempts ||= {};
  const mine = (q.attempts[sid] ||= []);
  if (act === "start" && m === "POST") {
    let at = openAttempt(q, sid);
    if (!at) {
      const st = quizState(q);
      if (st === "upcoming") return send(res, 400, { error: `কুইজ এখনো শুরু হয়নি — খুলবে ${q.opensAt.replace("T", " ")}` });
      if (st === "closed") return send(res, 400, { error: "কুইজের সময় শেষ" });
      if (mine.length >= q.attemptsAllowed) return send(res, 400, { error: "এই কুইজ যতবার দেওয়া যায়, দেওয়া হয়ে গেছে" });
      const order = q.questions.map((x) => x.id);
      if (q.shuffle) for (let i = order.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
      at = { no: mine.length + 1, startedMs: Date.now(), startedAt: new Date().toISOString(), order };
      mine.push(at);
      saveDb();
    }
    const byId = new Map(q.questions.map((x) => [x.id, x]));
    return send(res, 200, {
      title: q.title, duration: q.duration, mark: q.mark, negative: q.negative, negValue: q.negValue, attemptNo: at.no, endsAt: at.startedMs + q.duration * 60000, now: Date.now(),
      questions: at.order.map((id) => byId.get(id)).filter(Boolean).map(({ id, text, options }) => ({ id, text, options })),
    });
  }
  const review = (ans) => q.questions.map(({ id, text, options, correct, explain }) => ({ id, text, options, correct, explain, your: ans && ans[id] !== undefined ? Number(ans[id]) : null }));
  if (act === "submit" && m === "POST") {
    const at = mine.find((a) => a.no === b.attemptNo);
    if (!at || at.submittedAt) return send(res, 409, { error: "এই চেষ্টা চলমান নেই — কুইজের তালিকা আবার খুলুন" });
    if (Date.now() >= at.startedMs + q.duration * 60000 + QUIZ_GRACE_MS) return send(res, 410, { error: "উত্তর জমা দেওয়ার সময় শেষ — এই চেষ্টা গণনা করা হয়েছে" });
    const answers = {};
    for (const [k, v] of Object.entries(b.answers && typeof b.answers === "object" ? b.answers : {})) if (q.questions.some((x) => x.id === k) && v !== null && v !== "") answers[k] = Math.floor(num(v));
    const late = false; // সময়সীমার বাইরের জমা উপরে প্রত্যাখ্যান করা হয়েছে
    Object.assign(at, { answers, submittedAt: new Date().toISOString(), late, ...scoreQuiz(q, answers) });
    saveDb();
    const { no, score, full, correct, wrong, skipped } = at;
    return send(res, 200, { ok: true, result: { no, score, full, correct, wrong, skipped, late }, review: q.showAnswers ? review(answers) : null });
  }
  if (act === "review" && m === "GET") {
    const last = [...mine].reverse().find((a) => a.submittedAt);
    if (!last) return send(res, 400, { error: "আগে কুইজটা দাও" });
    if (!q.showAnswers) return send(res, 403, { error: "এই কুইজের উত্তর দেখানো বন্ধ রাখা হয়েছে" });
    return send(res, 200, { title: q.title, result: (({ no, score, full, correct, wrong, skipped }) => ({ no, score, full, correct, wrong, skipped }))(last), review: review(last.answers) });
  }
  return send(res, 404, { error: "পাওয়া যায়নি" });
}

// পরীক্ষার রুটিন: তারিখ দেওয়া সব পরীক্ষা, ব্যাচ ধরে (পরে ভর্তি হলেও দেখে); নম্বর থাকে না। Chapter Final-এর প্রতিবারের তারিখ আলাদা সারি
function scheduleFor(s) {
  const mine = (e) => (e.studentIds || []).includes(s.id) || (e.marks && e.marks[s.id]) || ((!e.session || e.session === s.session) && ((e.batchIds || []).length ? e.batchIds.includes(s.batchId) : !(e.studentIds || []).length));
  return db.exams.filter(mine).flatMap((e) => {
    const dates = e.type === "chapter" && (e.attemptDates || []).some(Boolean) ? e.attemptDates : [e.date];
    return dates.map((date, i) => ({ date, attempt: dates.length > 1 ? i : -1 })).filter((x) => x.date)
      .map((x) => ({ id: e.id, type: e.type, title: e.title, date: x.date, attempt: x.attempt, time: e.time, chapter: e.chapter, syllabus: e.syllabus, full: EC.fullOf(e) }));
  }).sort((a, b) => a.date.localeCompare(b.date));
}
const routineForStudent = (r, s) => !!r.pdf && (!r.session || r.session === s.session) && (!(r.batchIds || []).length || r.batchIds.includes(s.batchId));
function sendExamRoutine(res, r, url) {
  const f = r && r.pdf ? examRoutineFile(r) : "";
  if (!f || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": "application/pdf", "Content-Length": fs.statSync(f).size, "Cache-Control": "private, max-age=3600", "Content-Disposition": `${url.searchParams.get("download") === "1" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(r.pdf.name)}` });
  fs.createReadStream(f).pipe(res);
}
// ফলাফল প্রকাশ না হওয়া পর্যন্ত নম্বর, মেধাক্রম আর খাতা পাঠানো হয় না — শুধু সময়সূচি আর প্রশ্ন / উত্তরপত্র
function resultsFor(s) {
  return db.exams
    .filter((e) => (e.studentIds || []).includes(s.id) || (e.marks && e.marks[s.id]))
    .map((e) => {
      if (!isPublishedFor(e, s)) {
        const docs = db.docs.filter((d) => d.examId === e.id && d.category !== "script")
          .map(({ id, category, title, note, kind, url, file, attempt, createdAt }) => ({ id, category, title, note, kind, url: kind === "link" || kind === "youtube" ? url : "", fileName: file ? file.name : "", size: file ? file.size : 0, attempt, createdAt }));
        return { id: e.id, type: e.type, title: e.title, date: e.date, attemptDates: e.attemptDates || [], time: e.time, chapter: e.chapter, syllabus: e.syllabus, mode: e.mode, subjects: e.subjects, full: EC.fullOf(e), attempts: EC.attemptsOf(e), published: false, myMarks: [], me: { absent: true, pending: true }, docs };
      }
      const R = EC.results(e), me = R.rows.find((r) => r.sid === s.id) || EC.studentResult(e, s.id);
      // ব্যাচের ভেতরে অবস্থান: একই ব্যাচের পাস করা শিক্ষার্থীদের মধ্যে মোট নম্বর ধরে (সমান হলে একই)
      const bRows = R.rows.filter((r) => !r.absent && r.pass && (db.students.find((x) => x.id === r.sid) || {}).batchId === s.batchId).sort((a, b) => b.total - a.total);
      const bi = bRows.findIndex((r) => r.sid === s.id), batchRank = bi < 0 ? null : bRows.findIndex((r) => r.total === bRows[bi].total) + 1;
      const docs = db.docs.filter((d) => d.examId === e.id && (d.category !== "script" || d.studentId === s.id))
        .map(({ id, category, title, note, kind, url, file, attempt, createdAt }) => ({ id, category, title, note, kind, url: kind === "link" || kind === "youtube" ? url : "", fileName: file ? file.name : "", size: file ? file.size : 0, attempt, createdAt }));
      return {
        id: e.id, type: e.type, title: e.title, date: e.date, attemptDates: e.attemptDates || [], time: e.time, chapter: e.chapter, syllabus: e.syllabus,
        mode: e.mode, subjects: e.subjects, full: EC.fullOf(e), attempts: EC.attemptsOf(e), published: true, myMarks: (e.marks || {})[s.id] || [],
        me, batchRank, batchOf: bRows.length, of: R.stats.ranked, sat: R.stats.sat, high: R.stats.high, avg: R.stats.avg, docs, // of = মেধাক্রমে কতজন (শুধু পাস)
      };
    })
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}
const activeNotices = (onlyPublic) =>
  db.notices
    .filter((n) => (!n.until || n.until >= today()) && (!onlyPublic || n.public))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
function parseBatchTime(value) {
  const text = String(value || "").replace(/[০-৯]/g, d => "০১২৩৪৫৬৭৮৯".indexOf(d));
  const match = text.match(/(\d{1,2})(?:[:ঃ.](\d{2}))?/);
  if (!match) return null;
  let hour = Number(match[1]), minute = Number(match[2] || 0);
  if (hour > 23 || minute > 59) return null;
  let period = /সকাল/.test(text) ? "সকাল" : /দুপুর/.test(text) ? "দুপুর" : /বিক[াে]ল/.test(text) ? "বিকাল" : /সন্ধ্যা/.test(text) ? "সন্ধ্যা" : /রাত/.test(text) ? "রাত" : /ভোর/.test(text) ? "ভোর" : "";
  if (period && (hour < 1 || hour > 12)) return null;
  if (!period) period = hour < 6 ? "রাত" : hour < 12 ? "সকাল" : hour < 16 ? "দুপুর" : hour < 18 ? "বিকাল" : "রাত";
  let h24 = hour;
  if (hour <= 12) {
    if (["দুপুর", "বিকাল", "সন্ধ্যা"].includes(period)) h24 = hour % 12 + 12;
    else if (period === "রাত") h24 = hour >= 6 && hour < 12 ? hour + 12 : hour % 12;
  }
  return { period, hour: String(hour % 12 || 12), minute: String(minute).padStart(2, "0"), minutes: h24 * 60 + minute };
}
function batchDayGroup(value) {
  const text = String(value || "").trim();
  const days = [/শনি|sat/i, /রবি|sun/i, /সোম|mon/i, /মঙ্গল|tue/i, /বুধ|wed/i, /বৃহস্পতি|thu/i, /শুক্র|fri/i];
  const key = days.map((pattern, i) => pattern.test(text) ? String(i) : "").join("");
  return key || "9" + text;
}
function compareBatchSchedule(a, b) {
  return String(a.session || "").localeCompare(String(b.session || ""), "en", { numeric: true }) ||
    batchDayGroup(a.days).localeCompare(batchDayGroup(b.days), "en") ||
    ((parseBatchTime(a.time)?.minutes ?? 9999) - (parseBatchTime(b.time)?.minutes ?? 9999)) ||
    String(a.name || "").localeCompare(String(b.name || ""), "en", { numeric: true }) || String(a.id || "").localeCompare(String(b.id || ""));
}

const batchLabel = (b) => (b ? `${b.name}${[b.days, b.time].filter(Boolean).length ? " (" + [b.days, b.time].filter(Boolean).join(" · ") + ")" : ""}` : "");
// ---------- মূল পাতার ব্যানার স্লাইডার ----------
const IMG_TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
// ছবিওয়ালা কালেকশন: কোন ফোল্ডারে ছবি থাকে, আর ওয়েবসাইটের ঠিকানা কী
const IMG_COLS = {
  banners: { dir: BANNERS, url: "banner", name: "ব্যানার" }, achievers: { dir: ACHIEVERS, url: "achiever", name: "শিক্ষার্থী" },
  freeClasses: { dir: LEARN_IMG, url: "freeclass", name: "ফ্রি ক্লাস" }, onlineCourses: { dir: LEARN_IMG, url: "ocourse", name: "কোর্স" },
  gallery: { dir: GALLERY, url: "gphoto", name: "ছবি" },
  courses: { dir: COURSE_IMG, url: "cimage", name: "মডিউল" },
  teachers: { dir: TEACHER_IMG, url: "tphoto", name: "শিক্ষক" },
  ebooks: { dir: EBOOK_IMG, url: "ebook", name: "ই-বুক" },
  books: { dir: BOOK_IMG, url: "bookimg", name: "বই" },
  daily: { dir: DAILY_IMG, url: "dimage", name: "পোস্ট" },
};
const IMG_URL2COL = Object.fromEntries(Object.entries(IMG_COLS).map(([col, v]) => [v.url, col]));
const imgFile = (col, x) => (x && x.image ? path.join(IMG_COLS[col].dir, `${x.id.replace(/[^\w-]/g, "")}${x.image.ext}`) : "");
const dropImg = (col, x) => { const f = imgFile(col, x); if (f) try { fs.unlinkSync(f); } catch {} };
const byOrder = (a, b) => (a.order || 0) - (b.order || 0) || String(a.createdAt).localeCompare(String(b.createdAt));
const liveBanners = () => db.banners.filter((b) => b.active && b.image).sort(byOrder)
  .map((b) => ({ id: b.id, title: b.title, link: b.link, img: `/api/banner/${b.id}/image?v=${b.image.v}` }));
// ---------- সফল শিক্ষার্থী (বিশ্ববিদ্যালয় / পেশা) — মূল পাতায় দুই কলামে পালা করে ----------
// ---------- ফটো গ্যালারি — পাবলিক সাইটে অ্যালবাম অনুযায়ী ----------
const liveGallery = () => db.gallery.filter((g) => g.active && g.image).sort(byOrder)
  .map((g) => ({ id: g.id, title: g.title, description: g.description || "", album: g.album, date: g.date, img: `/api/gphoto/${g.id}/image?v=${g.image.v}` }));
const liveAchievers = () => db.achievers.filter((a) => a.active && a.image).sort(byOrder)
  .map((a) => ({ id: a.id, group: a.group, name: a.name, detail: a.detail, subject: a.subject || "", batch: a.batch, img: `/api/achiever/${a.id}/image?v=${a.image.v}` }));

// ---------- যাচাই (কালেকশন অনুযায়ী) ----------
const lines = (v) => (Array.isArray(v) ? v : String(v || "").split("\n"));
const enDigits = (s) => String(s || "").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d));
const STUDENT_KEYS = (b) => ({
  name: str(b.name, 120), nameEn: str(b.nameEn, 120), gender: ["F", "O"].includes(b.gender) ? b.gender : "M", dob: str(b.dob, 10),
  bloodGroup: str(b.bloodGroup, 12), religion: str(b.religion, 30), nationality: str(b.nationality, 40),
  phone2: phoneOf(b.phone2), whatsapp: phoneOf(b.whatsapp),
  // শিক্ষাগত যোগ্যতা (SSC) ও একাডেমিক
  sscExam: str(b.sscExam, 30), sscSchool: str(b.sscSchool, 150), sscGroup: str(b.sscGroup, 40), collegeRoll: str(b.collegeRoll, 20),
  groupSubjects: str(b.groupSubjects, 300), fourthSubject: str(b.fourthSubject, 80),
  // HSC: বিভাগ অনুযায়ী ৩টি গ্রুপ সাবজেক্ট (subject1–3) ও ৪র্থ বিষয় (subject4)
  subject1: str(b.subject1, 60), subject2: str(b.subject2, 60), subject3: str(b.subject3, 60), subject4: str(b.subject4, 60),
  // ভর্তির উৎস ও রেফারেন্স
  source: str(b.source, 60), refName: str(b.refName, 120), refPhone: phoneOf(b.refPhone), refOccupation: str(b.refOccupation, 60),
  phone: phoneOf(b.phone), email: str(b.email, 120), college: str(b.college, 150), klass: str(b.klass, 60), group: str(b.group, 40),
  sscRoll: str(b.sscRoll, 20), sscBoard: str(b.sscBoard, 40), sscGpa: str(b.sscGpa, 10), sscYear: str(b.sscYear, 4),
  fatherName: str(b.fatherName, 120), fatherOccupation: str(b.fatherOccupation, 60), fatherPhone: phoneOf(b.fatherPhone),
  motherName: str(b.motherName, 120), motherOccupation: str(b.motherOccupation, 60), motherPhone: phoneOf(b.motherPhone),
  guardianName: str(b.guardianName, 120),
  guardianRelation: str(b.guardianRelation, 40), guardianOccupation: str(b.guardianOccupation, 60), guardianPhone: phoneOf(b.guardianPhone), address: str(b.address, 300),
  // "বর্তমান ঠিকানাই স্থায়ী ঠিকানা" টিক দিলে দুটো একই থাকে
  sameAddress: b.sameAddress === true || b.sameAddress === "true" || b.sameAddress === "on",
  permanentAddress: b.sameAddress === true || b.sameAddress === "true" || b.sameAddress === "on" ? str(b.address, 300) : str(b.permanentAddress, 300),
});
const CLEAN = {
  sessions: (b) => ({ name: str(b.name, 20).toUpperCase().replace(/\s+/g, ""), note: str(b.note, 60), active: b.active !== false }),
  courses: (b) => ({
    code: str(b.code, 4), name: str(b.name, 120), short: str(b.short, 300), desc: str(b.desc, 3000), icon: str(b.icon, 8),
    features: lines(b.features).map((f) => str(f, 200)).filter(Boolean).slice(0, 20),
    feeType: ["monthly", "once", "chapter"].includes(b.feeType) ? b.feeType : "once", fee: num(b.fee), monthlyFees: cleanMonthlyFees(b.monthlyFees),
    // অধ্যায়: [{id,name,fee}] অথবা লেখা "৩.১ | সংখ্যা পদ্ধতি | 800" প্রতি লাইনে
    chapters: (Array.isArray(b.chapters) ? b.chapters : lines(b.chapters).map((l) => { const [id, name, fee] = l.split("|").map((x) => x.trim()); return { id, name, fee }; }))
      .map((c) => ({ id: str(c.id, 10).replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d)), name: str(c.name, 150), fee: num(String(c.fee ?? "").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d)).replace(/[^\d.]/g, "")) }))
      .filter((c) => c.id && c.name).slice(0, 30),
    duration: str(b.duration, 60), popular: !!b.popular, active: b.active !== false,
    validityDays: Math.max(0, Math.min(3650, Math.floor(num(b.validityDays)) || 0)), // রেকর্ড ক্লাসের মেয়াদ (দিন), ভর্তির দিন থেকে; ০ = আজীবন
    mode: b.mode === "online" ? "online" : "offline", // অফলাইন (কোচিংয়ে ক্লাস) নাকি অনলাইন মডিউল
    teacherId: str(b.teacherId, 40), // বিস্তারিত পাতার "কোর্স ইন্সট্রাক্টর"
  }),
  batches: (b) => ({ session: str(b.session, 20), name: str(b.name, 40), days: str(b.days, 120), time: str(b.time, 80), capacity: num(b.capacity) || 15, tag: str(b.tag, 40), active: b.active !== false }), // tag: ওয়েবসাইটে কার্ডের নিচের লাল ট্যাগ (যেমন "নতুন ব্যাচে ভর্তি চলছে")
  students: (b) => ({
    ...STUDENT_KEYS(b), session: str(b.session, 20), batchId: str(b.batchId, 60), admissionDate: str(b.admissionDate, 10) || today(),
    ...("status" in b ? { status: b.status === "inactive" ? "inactive" : "active" } : {}), // না পাঠালে আগের অবস্থা থাকে
    ...("note" in b ? { note: str(b.note, 1000) } : {}), // ফর্মে নোট ঘর নেই — পুরনো নোট মুছবে না
  }),
  enrollments: (b) => ({ status: b.status === "ended" ? "ended" : "active", endDate: str(b.endDate, 10), discount: num(b.discount), startDate: str(b.startDate, 10), planEnd: str(b.planEnd, 10) }),
  // আবেদন অ্যাডমিন থেকে শুধু অবস্থা ও নোট বদলানো যায়; তৈরি হয় /api/apply দিয়ে
  applications: (b) => ({ status: ["pending", "contacted", "approved", "rejected"].includes(b.status) ? b.status : "pending", note: str(b.note, 500) }),
  ratings: (b) => ({ hidden: !!b.hidden }), // শিক্ষার্থীদের মতামত — ওয়েবসাইটে দেখাবে কিনা
  onlineApps: (b) => ({ status: ["pending", "contacted", "approved", "rejected"].includes(b.status) ? b.status : "pending", note: str(b.note, 500) }),
  payments: (b) => ({ studentId: str(b.studentId, 40), enrollmentId: str(b.enrollmentId, 60), amount: num(b.amount), month: str(b.month, 7), method: str(b.method, 30) || "নগদ", note: str(b.note, 300), date: str(b.date, 10) || today() }),
  // পরীক্ষা: ধরন (Weekly / Monthly / Chapter Final / Model), প্রশ্নের ধরন (CQ / MCQ / দুটোই), বিষয় ও পূর্ণমান, পরীক্ষার্থী, নম্বর
  examRoutines: (b) => ({ title: str(b.title, 150), type: EC.TYPES.some(([k]) => k === b.type) ? b.type : "", session: str(b.session, 20), batchIds: (Array.isArray(b.batchIds) ? b.batchIds : []).map((x) => str(x, 60)).filter((x) => db.batches.some((bt) => bt.id === x)) }),
  exams: (b) => {
    const type = EC.TYPES.some(([k]) => k === b.type) ? b.type : "weekly";
    const mode = EC.MODES.some(([k]) => k === b.mode) ? b.mode : "both";
    const subjects = (Array.isArray(b.subjects) ? b.subjects : []).slice(0, 20).map((s) => ({
      name: str(s.name, 80).replace(/\|/g, "/"), cq: mode === "mcq" ? 0 : Math.max(0, num(s.cq)), mcq: mode === "cq" ? 0 : Math.max(0, num(s.mcq)),
    })).filter((s) => s.name && s.cq + s.mcq > 0);
    const ex = {
      type, mode, subjects, title: str(b.title, 150), session: str(b.session, 20), date: str(b.date, 10), time: str(b.time, 20),
      batchIds: (Array.isArray(b.batchIds) ? b.batchIds : []).map((x) => str(x, 60)).filter((x) => db.batches.some((bt) => bt.id === x)),
      studentIds: [...new Set((Array.isArray(b.studentIds) ? b.studentIds : []).map((x) => str(x, 40)))].filter((x) => db.students.some((s) => s.id === x)),
      chapter: str(b.chapter, 120), syllabus: str(b.syllabus, 600), passCq: Math.max(0, Math.min(100, num(b.passCq))), passMcq: Math.max(0, Math.min(100, num(b.passMcq))),
    };
    // Chapter Final: ৩ বারের তারিখ (১ম বার = পরীক্ষার তারিখ)
    ex.attemptDates = type === "chapter" ? [ex.date, str((b.attemptDates || [])[1], 10), str((b.attemptDates || [])[2], 10)] : [];
    ex.marks = cleanMarks(ex, b.marks);
    return ex;
  },
  // বাড়ির কাজ / পড়া: পুরো সেশনের সব ব্যাচ (batchIds খালি) বা নির্দিষ্ট ব্যাচ; checks আলাদা এন্ডপয়েন্টে
  homework: (b) => {
    const session = str(b.session, 20);
    return {
      kind: b.kind === "lesson" ? "lesson" : "homework", title: str(b.title, 200), details: str(b.details, 2000), subject: str(b.subject, 80), chapter: str(b.chapter, 120),
      session, batchIds: (Array.isArray(b.batchIds) ? b.batchIds : []).map((x) => str(x, 60)).filter((x) => db.batches.some((bt) => bt.id === x && bt.session === session)),
      givenDate: str(b.givenDate, 10) || today(), dueDate: str(b.dueDate, 10),
    };
  },
  // অনলাইন কুইজ: প্রশ্ন (৪টা অপশন, একটা সঠিক), সময়, খোলা-বন্ধের সময়, নেগেটিভ মার্কিং রাখা / না রাখা
  // ট্যালেন্ট হান্ট: কোড দিয়ে রোল বানানো হয় (যেমন TH26 → TH26-0001); বিষয় আর প্রতিটার পূর্ণমান
  talentHunts: (b) => ({
    title: str(b.title, 150), code: str(b.code, 12).toUpperCase().replace(/[^A-Z0-9]/g, "") || "TH", examDate: /^\d{4}-\d{2}-\d{2}$/.test(str(b.examDate, 10)) ? str(b.examDate, 10) : "",
    examTime: str(b.examTime, 60), venue: str(b.venue, 200), details: str(b.details, 2000), live: !!b.live, resultPublished: !!b.resultPublished,
    meritShow: Math.max(0, Math.min(5000, Math.floor(num(b.meritShow)))), passCq: Math.max(0, Math.min(100, num(b.passCq))), passMcq: Math.max(0, Math.min(100, num(b.passMcq))),
    // বিষয়: CQ আর MCQ-এর পূর্ণমান আলাদা (একটা ০ হলে শুধু অন্যটা); পুরনো {name, full} এলে সেটা MCQ
    subjects: (Array.isArray(b.subjects) ? b.subjects : []).slice(0, 20).map((s) => {
      const m = (v) => Math.max(0, Math.min(1000, Math.floor(num(v)) || 0)), legacy = s && s.cq === undefined && s.mcq === undefined;
      const cq = legacy ? 0 : m(s && s.cq), mcq = legacy ? m(s && s.full) : m(s && s.mcq);
      return { name: str(s && s.name, 80), cq, mcq, full: cq + mcq };
    }).filter((s) => s.name && s.full > 0),
  }),
  // ফ্রি ক্লাস: YouTube লিংক বা আপলোড করা ভিডিও (ফাইল আসে আলাদা আপলোডে)
  freeClasses: (b) => ({ title: str(b.title, 200), subject: str(b.subject, 40), source: b.source === "file" ? "file" : "youtube", yt: youtubeId(b.ytUrl || "") || str(b.yt, 11), active: b.active !== false, order: Math.floor(num(b.order)) || 0 }),
  // অনলাইন কোর্স: ভেতরের ক্লাসগুলো (lessons) ক্রম অনুযায়ী; আপলোড করা ফাইলের তথ্য সার্ভার আগের থেকে ধরে রাখে
  onlineCourses: (b) => ({
    title: str(b.title, 150), subtitle: str(b.subtitle, 200), duration: str(b.duration, 60), price: Math.max(0, Math.floor(num(b.price))), salePrice: Math.max(0, Math.floor(num(b.salePrice))),
    access: b.access === "approval" ? "approval" : "free", description: str(b.description, 5000), features: lines(b.features).map((x) => str(x, 200)).filter(Boolean).slice(0, 20),
    active: b.active !== false, order: Math.floor(num(b.order)) || 0,
    lessons: (Array.isArray(b.lessons) ? b.lessons : []).slice(0, 500).map((l) => ({ id: str(l && l.id, 40) || uid("les"), title: str(l && l.title, 200), source: l && l.source === "file" ? "file" : "youtube", yt: youtubeId((l && l.ytUrl) || "") || str(l && l.yt, 11), preview: !!(l && l.preview) })).filter((l) => l.title),
  }),
  // অনলাইন কোর্সের শিক্ষার্থী — অ্যাডমিন নাম / PIN ঠিক করতে পারে
  learners: (b) => ({ name: str(b.name, 120), phone: phoneOf(b.phone), klass: str(b.klass, 60), college: str(b.college, 150), pin: /^\d{4}$/.test(enDigits(str(b.pin, 4))) ? enDigits(str(b.pin, 4)) : undefined }),
  ocEnrolls: (b) => ({ status: b.status === "active" ? "active" : "pending" }),
  // ট্যালেন্ট হান্টের রেজিস্ট্রেশন (রোল আর নম্বর আলাদা নিয়মে বসে)
  thRegs: (b) => ({ name: str(b.name, 120), phone: phoneOf(b.phone), klass: str(b.klass, 60), college: str(b.college, 150), course: str(b.course, 120) }),
  // সম্ভাব্য শিক্ষার্থী — উৎসগুলো (sources) আলাদা নিয়মে যোগ হয়, এখানে নয়
  leads: (b) => ({
    name: str(b.name, 120), phone: phoneOf(b.phone), guardianPhone: phoneOf(b.guardianPhone), batch: str(b.batch, 40), institution: str(b.institution, 150),
    location: str(b.location, 120), course: str(b.course, 120), status: LEAD_STATUS.includes(b.status) ? b.status : "new",
    followUp: /^\d{4}-\d{2}-\d{2}$/.test(str(b.followUp, 10)) ? str(b.followUp, 10) : "", remarks: str(b.remarks, 1000), smsConsent: b.smsConsent !== false,
  }),
  // SMS খাতা: কবে, কী লেখা, কতজনকে (সত্যি SMS পাঠানো হয় বাইরের SMS সার্ভিস দিয়ে — এখানে শুধু হিসাব)
  smsLog: (b) => ({ date: /^\d{4}-\d{2}-\d{2}$/.test(str(b.date, 10)) ? str(b.date, 10) : today(), text: str(b.text, 1000), filter: str(b.filter, 300), leadIds: (Array.isArray(b.leadIds) ? b.leadIds : []).slice(0, 5000).map((x) => str(x, 40)), count: Math.max(0, Math.floor(num(b.count))), via: str(b.via, 80) }),
  quizzes: (b) => {
    const session = str(b.session, 20);
    const questions = (Array.isArray(b.questions) ? b.questions : []).slice(0, 300).map((q) => {
      const options = (Array.isArray(q.options) ? q.options : []).slice(0, 6).map((o) => str(o, 500));
      return { id: str(q.id, 40) || "q_" + crypto.randomBytes(4).toString("hex"), text: str(q.text, 2000), options, correct: Math.floor(num(q.correct)), explain: str(q.explain, 1000) };
    }).filter((q) => q.text && q.options.filter(Boolean).length >= 2 && q.correct >= 0 && q.correct < q.options.length && q.options[q.correct]);
    return {
      title: str(b.title, 150), subject: str(b.subject, 80), chapter: str(b.chapter, 120), session,
      batchIds: (Array.isArray(b.batchIds) ? b.batchIds : []).map((x) => str(x, 60)).filter((x) => db.batches.some((bt) => bt.id === x && (!session || bt.session === session))),
      duration: Math.max(1, Math.min(300, Math.floor(num(b.duration)) || 20)), opensAt: str(b.opensAt, 16), closesAt: str(b.closesAt, 16),
      mark: Math.max(0.25, Math.min(10, num(b.mark) || 1)), negative: !!b.negative, negValue: Math.max(0, Math.min(10, num(b.negValue) || 0.25)),
      shuffle: !!b.shuffle, attemptsAllowed: Math.max(1, Math.min(10, Math.floor(num(b.attemptsAllowed)) || 1)), showAnswers: b.showAnswers !== false, live: !!b.live,
      open: !!b.open, // ব্যাচের বাইরের (অনলাইন) শিক্ষার্থীরাও /quiz পেজ থেকে দিতে পারবে
      announce: !!b.announce, // শিক্ষার্থীর প্যানেল আর নোটিশ বোর্ডে আগাম ঘোষণা (প্রশ্ন তৈরির আগেও)
      questions,
    };
  },
  // ডকুমেন্টের লিংক (YouTube / Google Drive); ফাইল আসে আলাদা আপলোডে
  docs: (b) => {
    const url = str(b.url, 500), yt = youtubeId(url);
    return {
      examId: str(b.examId, 60), category: ["question", "answer", "script"].includes(b.category) ? b.category : "question", studentId: str(b.studentId, 40),
      attempt: Math.max(0, Math.min(2, Math.floor(num(b.attempt)))), title: str(b.title, 150), note: str(b.note, 300),
      ...(url ? { url: /^https?:\/\//i.test(url) ? url : "", kind: yt ? "youtube" : "link", youtube: yt } : {}),
    };
  },
  enquiries: (b) => ({ name: str(b.name, 120), phone: phoneOf(b.phone), course: str(b.course, 120), klass: str(b.klass, 60), college: str(b.college, 150), message: str(b.message, 1000), status: ["new", "called", "admitted", "closed"].includes(b.status) ? b.status : "new", note: str(b.note, 500) }),
  daily: (b) => ({
    category: DAILY_CATS.includes(b.category) ? b.category : "ict", title: str(b.title, 200), body: str(b.body, 20000),
    date: /^\d{4}-\d{2}-\d{2}$/.test(str(b.date, 10)) ? str(b.date, 10) : today(), status: b.status === "draft" ? "draft" : "published",
    quiz: (Array.isArray(b.quiz) ? b.quiz : []).slice(0, 50).map((q) => {
      const options = (Array.isArray(q && q.options) ? q.options : []).map((o) => str(o, 300)).filter(Boolean).slice(0, 6);
      return { q: str(q && q.q, 600), options, correct: Math.min(Math.max(0, Math.floor(num(q && q.correct))), Math.max(0, options.length - 1)), explain: str(q && q.explain, 1500) };
    }).filter((q) => q.q && q.options.length >= 2),
  }),
  // ছাপা বই / শিট — স্টক এখানে বদলায় না (শুধু "স্টক যোগ" আর বিক্রি থেকে)
  books: (b) => ({ kind: b.kind === "sheet" ? "sheet" : "book", title: str(b.title, 200), author: str(b.author, 120), short: str(b.short, 600),
    price: Math.max(0, Math.round(num(b.price))), oldPrice: Math.max(0, Math.round(num(b.oldPrice))), cost: Math.max(0, Math.round(num(b.cost))),
    lowStock: Math.max(0, Math.floor(num(b.lowStock))), online: !!b.online, active: b.active !== false, order: Math.floor(num(b.order)) || 0 }),
  ebooks: (b) => ({ validityDays: Math.max(0, Math.min(3650, Math.floor(num(b.validityDays)) || 0)), title: str(b.title, 200), short: str(b.short, 600), category: str(b.category, 40), pinned: !!b.pinned, kind: ["premium", "students"].includes(b.kind) ? b.kind : "free", price: Math.max(0, Math.round(num(b.price))), oldPrice: Math.max(0, Math.round(num(b.oldPrice))), active: b.active !== false, order: Math.floor(num(b.order)) || 0,
    buyers: [...new Set((Array.isArray(b.buyers) ? b.buyers : String(b.buyers || "").split(/[\s,]+/)).map((x) => phoneOf(x)).filter((x) => /^01\d{9}$/.test(x)))].slice(0, 5000) }),
  faqs: (b) => ({ q: str(b.q, 300), a: str(b.a, 3000), active: b.active !== false, order: Math.floor(num(b.order)) || 0 }),
  notices: (b) => ({ title: str(b.title, 200), body: str(b.body, 3000), date: str(b.date, 10) || today(), until: str(b.until, 10), public: !!b.public, important: !!b.important, tag: str(b.tag, 20) }),
  teachers: (b) => ({ name: str(b.name, 120), subject: str(b.subject, 120), bio: str(b.bio, 600), photo: str(b.photo, 300) }),
  // ব্যানার: ছবি আসে আলাদা আপলোডে; লিংক — /apply, #batches বা http(s)://… (খালি = চাপ দিলে কিছু হয় না)
  // সফল শিক্ষার্থী: group — university (বিশ্ববিদ্যালয়ে পড়ছে) বা career (পেশায় প্রতিষ্ঠিত)
  gallery: (b) => ({ title: str(b.title, 150), description: str(b.description, 3000), album: str(b.album, 60) || "অন্যান্য", date: /^\d{4}-\d{2}-\d{2}$/.test(b.date || "") ? b.date : "", active: b.active !== false, order: Math.floor(num(b.order)) || 0 }),
  achievers: (b) => ({ group: b.group === "career" ? "career" : "university", name: str(b.name, 120), detail: str(b.detail, 200), subject: str(b.subject, 120), batch: str(b.batch, 40), active: b.active !== false, order: Math.floor(num(b.order)) || 0 }),
  banners: (b) => { const link = str(b.link, 300); return { title: str(b.title, 120), link: /^(https?:\/\/|\/|#)/i.test(link) ? link : "", active: b.active !== false, order: Math.floor(num(b.order)) || 0 }; },
  // ব্যাচ বন্ধ / ছুটি: কোন ব্যাচ, কবে থেকে কবে, কারণ; reduceFee = বন্ধের ক্লাসের টাকা কমবে কি না (ঈদের ছুটিতে সাধারণত না)
  closures: (b) => ({
    batchIds: (Array.isArray(b.batchIds) ? b.batchIds : []).map((x) => str(x, 60)).filter((x) => db.batches.some((bt) => bt.id === x)),
    from: str(b.from, 10), to: str(b.to, 10), reason: str(b.reason, 120), reduceFee: !!b.reduceFee,
  }),
};
const SETTINGS_KEYS = ["name", "shortName", "tagline", "taglineAccent", "intro", "location", "phone", "phone2", "whatsapp", "email", "address", "facebook", "mapUrl", "hours", "motto", "bannerSeconds", "achieverSeconds", "aplus", "experience", "studentsTotal", "mentorName", "mentorRole", "payBkash", "payNagad", "payRocket", "payBank", "payNote", "cardNote"];

// ভর্তি: শিক্ষার্থী + মডিউলে ভর্তি + (থাকলে) প্রথম জমা — অ্যাডমিন ফর্ম ও অনলাইন আবেদন দুটোই এটা ব্যবহার করে
function validateEnrollment(e) {
  const course = db.courses.find((c) => c.id === str(e.courseId, 60));
  if (!course) return { error: "একটি মডিউল বেছে নিন" };
  const valid = (course.chapters || []).map((c) => c.id);
  const chapters = course.feeType === "chapter" ? [...new Set((Array.isArray(e.chapters) ? e.chapters : []).map((x) => str(x, 10)))].filter((x) => valid.includes(x)) : [];
  if (course.feeType === "chapter" && !chapters.length) return { error: "অন্তত একটি অধ্যায় বেছে নিন" };
  const fee = moduleFee(course, chapters);
  const discount = Math.min(Math.max(0, num(e.discount)), fee);
  return { course, chapters, fee, discount };
}
// ---------- মেয়াদ (রেকর্ড ক্লাস / প্রিমিয়াম ই-বুক) ----------
// মডিউলের validityDays (০ = আজীবন) ভর্তির দিন (startDate) থেকে গোনা হয়; অ্যাডমিন বাড়ালে enrollment-এ accessUntil (তারিখ) বা accessLifetime বসে।
// মেয়াদ শেষ হলে রেকর্ড ক্লাস তালা — ফলাফল, হাজিরা, ফি আগের মতো দেখা যায়।
const addDays = (d, n) => { const t = new Date((d || today()) + "T00:00:00"); t.setDate(t.getDate() + n); return t.toLocaleDateString("en-CA"); };
function accessEnd(e) {
  if (e.accessLifetime) return "";
  if (e.accessUntil) return e.accessUntil;
  const c = db.courses.find((x) => x.id === e.courseId);
  return c && c.validityDays > 0 ? addDays(e.startDate, c.validityDays) : "";
}
const lessonAllowed = (c, e, l) => c.feeType !== "chapter" || !l.chapter || (e.chapters || []).includes(l.chapter);
const accessOpen = (e) => { const end = accessEnd(e); return !end || end >= today(); };
const accessInfo = (e) => { const end = accessEnd(e); return { until: end, lifetime: !end, expired: !!end && end < today(), daysLeft: end ? Math.round((new Date(end + "T00:00:00") - new Date(today() + "T00:00:00")) / 864e5) : null }; };
// প্রিমিয়াম ই-বুক: ক্রেতা যোগের দিন (buyerSince) থেকে ebook.validityDays; বাড়ালে buyerUntil[phone]
function ebookBuyerEnd(e, phone) {
  const until = (e.buyerUntil || {})[phone];
  if (until === "life") return "";
  if (until) return until;
  return e.validityDays > 0 ? addDays((e.buyerSince || {})[phone] || today(), e.validityDays) : "";
}
function ebookSyncBuyers(e) { // নতুন ক্রেতার যোগের দিন রাখা, বাদ পড়াদের তথ্য মোছা
  const since = { ...(e.buyerSince || {}) }, until = { ...(e.buyerUntil || {}) };
  for (const ph of e.buyers || []) if (!since[ph]) since[ph] = today();
  for (const ph of Object.keys(since)) if (!(e.buyers || []).includes(ph)) { delete since[ph]; delete until[ph]; }
  e.buyerSince = since; e.buyerUntil = until;
}
function createEnrollment(studentId, v, startDate, planEnd) {
  // planEnd = কোর্স শেষ হওয়ার (পরিকল্পিত) তারিখ; endDate = মাসিক কোর্স আসলে বন্ধ করার তারিখ
  const enr = { id: uid("enr"), studentId, courseId: v.course.id, chapters: v.chapters, fee: v.fee, discount: v.discount, startDate: startDate || today(), planEnd: str(planEnd, 10), endDate: "", status: "active", createdAt: new Date().toISOString() };
  setFirstMonth(enr);
  db.enrollments.push(enr);
  return enr;
}
// The first module starts on the student's joining date. Later modules retain
// their separately selected start dates through createEnrollment.
function createAdmissionEnrollment(student, v, planEnd) {
  const enrollment = createEnrollment(student.id, v, student.admissionDate, planEnd);
  enrollment.admissionLinked = true;
  return enrollment;
}
// মাসিক কোর্সে ভর্তির মাসের ক্লাস গুনে রাখে (পরে ব্যাচ বদলালেও আগের হিসাব একই থাকে)
function setFirstMonth(enr) {
  delete enr.firstClasses; delete enr.firstTotal; delete enr.firstGrace;
  const c = db.courses.find((x) => x.id === enr.courseId);
  if (!c || c.feeType !== "monthly") return;
  const s = db.students.find((x) => x.id === enr.studentId);
  const b = s && db.batches.find((x) => x.id === s.batchId);
  Object.assign(enr, firstMonthClasses(b && b.days, enr.startDate) || {});
}
function createPayment(studentId, enrollmentId, pay, note) {
  const amount = num(pay && pay.amount);
  if (amount <= 0) return null;
  const p = { id: uid("pay"), studentId, enrollmentId, amount, month: today().slice(0, 7), method: str(pay.method, 30) || "নগদ", note: note || "ভর্তির সময় জমা", date: today(), receiptNo: nextReceiptNo(), createdAt: new Date().toISOString() };
  db.payments.push(p);
  return p;
}

// ---------- ভর্তি ফর্মের Excel আমদানি ----------
function importValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const [y, m, d] = value.split("-").map(Number), dt = new Date(value + "T00:00:00Z");
  return y >= 1900 && y <= 2100 && dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
function admissionImportPlan(input) {
  const defaults = input.defaults || {}, rows = [], errors = [], seen = [];
  if (!Array.isArray(input.rows) || !input.rows.length || input.rows.length > 500) throw new Error("একবারে ১ থেকে ৫০০ শিক্ষার্থী দিন");
  const normal = v => String(v ?? "").normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  const mobile = value => {
    let v = enDigits(String(value ?? "")).trim().replace(/[\s()+-]/g, "");
    if (/^8801\d{9}$/.test(v)) v = v.slice(2);
    if (/^1\d{9}$/.test(v)) v = "0" + v;
    if (v && !/^01\d{9}$/.test(v)) throw new Error("মোবাইল নম্বর সঠিক নয়; অজানা হলে ঘর খালি রাখুন");
    return v;
  };
  const amount = (value, label) => {
    const v = enDigits(String(value ?? "")).trim().replace(/,/g, "");
    if (!v) return 0;
    if (!/^\d+(?:\.\d{1,2})?$/.test(v) || Number(v) > 1000000) throw new Error(`${label}: শূন্য বা ধনাত্মক টাকার পরিমাণ দিন`);
    return Number(v);
  };
  const phoneKeys = ["phone", "phone2", "whatsapp", "fatherPhone", "motherPhone", "guardianPhone", "refPhone"];
  for (let i = 0; i < input.rows.length; i++) {
    const raw = input.rows[i] || {}, rowNo = Number.isInteger(raw.row) ? raw.row : i + 2;
    try {
      if (Object.keys(raw).length > 80 || Object.values(raw).some(v => typeof v === "object" || String(v ?? "").length > 1000)) throw new Error("সারির তথ্যের আকার সঠিক নয়");
      const personal = { ...raw, name: String(raw.name || raw.nameEn || "").trim() };
      if (!personal.name || personal.name.length > 120) throw new Error("Name বা English Name দিন (সর্বোচ্চ ১২০ অক্ষর)");
      for (const key of phoneKeys) personal[key] = mobile(raw[key]);
      const admissionDate = str(raw.admissionDate || defaults.admissionDate, 10);
      if (!importValidDate(admissionDate) || admissionDate > today()) throw new Error("সঠিক Joining Date দিন; খালি হলে উপরে বিকল্প তারিখ বাছুন");
      let batch;
      if (raw.batch) {
        const session = raw.session || defaults.session;
        const matches = db.batches.filter(b => (normal(b.id) === normal(raw.batch) || normal(b.name) === normal(raw.batch)) && (!session || normal(b.session) === normal(session)));
        if (matches.length !== 1) throw new Error("Batch পাওয়া যায়নি বা একাধিক মিলেছে; সেশন ও ব্যাচের সঠিক নাম দিন");
        batch = matches[0];
      } else batch = db.batches.find(b => b.id === defaults.batchId);
      if (!batch || batch.active === false || !db.sessions.some(s => s.name === batch.session && s.active !== false)) throw new Error("একটি সক্রিয় ব্যাচ দিন বা উপরে বেছে নিন");
      if (raw.session && normal(raw.session) !== normal(batch.session)) throw new Error("সেশন ও ব্যাচ মেলেনি");
      let course;
      if (raw.course) {
        const matches = db.courses.filter(c => [c.id, c.code, c.name].some(v => v && (normal(v) === normal(raw.course) || (/^\d+$/.test(String(v)) && /^\d+$/.test(String(raw.course)) && Number(v) === Number(raw.course)))));
        if (matches.length !== 1) throw new Error("Module পাওয়া যায়নি বা একাধিক মিলেছে; মডিউলের নাম বা কোড দিন");
        course = matches[0];
      } else course = db.courses.find(c => c.id === defaults.courseId);
      if (!course || course.active === false) throw new Error("একটি সক্রিয় মডিউল দিন বা উপরে বেছে নিন");
      const chapters = String(raw.chapters || defaults.chapters || "").split(/[,;|]/).map(v => enDigits(v.trim())).filter(Boolean);
      const discount = amount(String(raw.discount ?? "").trim() ? raw.discount : defaults.discount, "Discount");
      const v = validateEnrollment({ courseId: course.id, chapters, discount });
      if (v.error) throw new Error(v.error);
      if (chapters.some(id => !(course.chapters || []).some(ch => ch.id === id))) throw new Error("Chapters-এ অধ্যায়ের আইডি মেলেনি");
      if (discount > v.fee) throw new Error("Discount মডিউলের ফি-এর বেশি হতে পারে না");
      let gender = String(raw.gender || "").trim();
      if (gender) {
        const genders = { m: "M", male: "M", ছেলে: "M", f: "F", female: "F", মেয়ে: "F", মেয়ে: "F", o: "O", other: "O", অন্যান্য: "O" };
        gender = genders[normal(gender)]; if (!gender) throw new Error("Gender-এ M, F বা O লিখুন; না জানা থাকলে খালি রাখুন");
      }
      for (const key of ["dob", "planEnd", "paymentDate"]) if (raw[key] && (!importValidDate(raw[key]) || ((key === "dob" || key === "paymentDate") && raw[key] > today()))) throw new Error(`${key}: তারিখ সঠিক নয়`);
      if (raw.planEnd && raw.planEnd < admissionDate) throw new Error("কোর্স শেষ হওয়ার তারিখ ভর্তির তারিখের আগে হতে পারে না");
      if (raw.sameAddress && !/^(true|false|yes|no|1|0|হ্যাঁ|না)$/i.test(String(raw.sameAddress))) throw new Error("Same Address-এ Yes বা No লিখুন");
      personal.sameAddress = /^(true|yes|1|হ্যাঁ)$/i.test(String(raw.sameAddress || ""));
      const student = { ...CLEAN.students({ ...personal, batchId: batch.id, session: batch.session, admissionDate }), gender: gender || "" };
      const paid = amount(raw.paid, "Paid Amount"), paymentDate = raw.paymentDate || admissionDate;
      const enrollment = { courseId: course.id, startDate: admissionDate, fee: v.fee, discount, chapters: v.chapters, status: "active", planEnd: raw.planEnd || "", ...firstMonthClasses(batch.days, admissionDate) };
      const fees = enrollmentDue(enrollment, { student, batch, course });
      const names = [student.name, student.nameEn].filter(Boolean).map(normal), phones = [student.phone, student.guardianPhone].filter(Boolean);
      const same = other => other.session === student.session && [other.name, other.nameEn].filter(Boolean).some(n => names.includes(normal(n))) && ((phones.length && [other.phone, other.guardianPhone].some(ph => ph && phones.includes(phoneOf(ph)))) || (other.batchId === student.batchId && other.admissionDate === student.admissionDate));
      if (seen.some(same)) throw new Error("ফাইলে একই শিক্ষার্থী একাধিকবার আছে");
      seen.push(student);
      const old = db.students.find(same);
      rows.push({ row: rowNo, student, batchLabel: batchLabel(batch), courseId: course.id, courseName: course.name, enrollment, paid, paymentDate, method: str(raw.method, 30) || "নগদ", fees: { totalDue: fees.due, firstMonth: fees.monthly ? fees.firstNet : fees.net, months: fees.months, monthly: fees.monthly, balance: fees.due - paid }, existingId: old?.id || "" });
    } catch (e) { errors.push({ row: rowNo, error: e.message }); }
  }
  const fresh = rows.filter(r => !r.existingId);
  const summary = { create: fresh.length, skip: rows.length - fresh.length, paid: fresh.reduce((n, r) => n + r.paid, 0), due: fresh.reduce((n, r) => n + r.fees.totalDue, 0) };
  const token = crypto.createHash("sha256").update(JSON.stringify({ rows, errors })).digest("hex");
  return { rows, errors, summary, token };
}
async function admissionImportAction(req, res) {
  const input = await readBody(req, 3 * 1024 * 1024);
  if (!input || typeof input !== "object" || Array.isArray(input)) return send(res, 400, { error: "সঠিক আমদানির তথ্য দিন" });
  // Source identity is separate from the changing duplicate/fee preview.
  const sourceHash = crypto.createHash("sha256").update(JSON.stringify({ defaults: input.defaults, rows: input.rows })).digest("hex");
  const receipt = (db.meta?.admissionImports || []).find(r => r.token === input.previewToken && r.sourceHash === sourceHash);
  if (input.commit && receipt) return send(res, 200, { ok: true, alreadyImported: true, ...receipt });
  let plan;
  try { plan = admissionImportPlan(input); } catch (e) { return send(res, 400, { error: e.message }); }
  if (!input.commit) return send(res, 200, plan);
  if (plan.errors.length) return send(res, 400, { error: "সব ভুল ঠিক করে আবার প্রিভিউ দেখুন", errors: plan.errors });
  if (plan.token !== input.previewToken) return send(res, 409, { error: "তথ্য বা বেতন হিসাব বদলেছে। আবার প্রিভিউ দেখে আমদানি করুন" });
  if (!plan.summary.create) return send(res, 400, { error: "নতুন শিক্ষার্থী নেই; আগের তথ্য অপরিবর্তিত আছে" });
  const original = JSON.stringify(db);
  fs.copyFileSync(DB_FILE, path.join(BACKUPS, `before-admission-import-${Date.now()}.json`));
  try {
    const ids = [];
    for (const row of plan.rows.filter(r => !r.existingId)) {
      const student = { ...row.student, id: nextStudentId(row.student.session), serial: nextSerial(), pin: newPin(), status: "active", photo: false, createdAt: new Date().toISOString() };
      db.students.push(student); ids.push(student.id); rememberLists(student);
      const course = db.courses.find(c => c.id === row.courseId);
      const enrollment = createAdmissionEnrollment(student, { course, chapters: row.enrollment.chapters, fee: row.enrollment.fee, discount: row.enrollment.discount }, row.enrollment.planEnd);
      if (row.paid > 0) db.payments.push({ id: uid("pay"), studentId: student.id, enrollmentId: enrollment.id, amount: row.paid, month: row.paymentDate.slice(0, 7), date: row.paymentDate, method: row.method, note: "Excel থেকে ভর্তি: আগের জমা; Payment Date খালি হলে ভর্তির তারিখ ব্যবহৃত", receiptNo: nextReceiptNo(), createdAt: new Date().toISOString() });
    }
    const result = { token: plan.token, sourceHash, at: new Date().toISOString(), ids, ...plan.summary };
    db.meta ||= {}; db.meta.admissionImports = [...(db.meta.admissionImports || []), result].slice(-100);
    saveDb();
    return send(res, 200, { ok: true, ...result });
  } catch (e) { db = JSON.parse(original); writeJsonAtomic(DB_FILE, db); throw e; }
}

// Review a correction to a saved module's fee start date before committing it.
async function enrollmentStartAction(req, res) {
  const input = await readBody(req);
  const e = db.enrollments.find(x => x.id === str(input?.id, 60));
  const s = e && db.students.find(x => x.id === e.studentId);
  const start = str(input?.startDate, 10);
  if (!s) return send(res, 404, { error: "মডিউলে ভর্তির রেকর্ড পাওয়া যায়নি" });
  if (!importValidDate(start) || start > today() || (s.admissionDate && start < s.admissionDate)) return send(res, 400, { error: "শুরুর তারিখ ভর্তির তারিখ থেকে আজকের মধ্যে দিন" });
  if (e.status === "ended" && e.endDate && start > e.endDate) return send(res, 400, { error: "শুরুর তারিখ কোর্স শেষ হওয়ার পরে হতে পারে না" });
  const proposed = { ...e, startDate: start };
  delete proposed.firstClasses; delete proposed.firstTotal; delete proposed.firstGrace;
  const batch = db.batches.find(b => b.id === s.batchId), course = db.courses.find(c => c.id === e.courseId);
  if (course?.feeType === "monthly") Object.assign(proposed, firstMonthClasses(batch?.days, start) || {});
  const before = enrollmentDue(e), after = enrollmentDue(proposed), fees = feeSummary(s);
  const result = { current: { startDate: e.startDate, due: before.due }, proposed: { startDate: start, due: after.due, firstMonth: after.monthly ? after.firstNet : after.net, months: after.months, balance: fees.balance - before.due + after.due } };
  const token = crypto.createHash("sha256").update(JSON.stringify({ enrollment: e, student: { admissionDate: s.admissionDate, batchId: s.batchId }, result })).digest("hex");
  if (input.commit !== true) return send(res, 200, { ...result, token });
  if (input.token !== token) return send(res, 409, { error: "হিসাব বদলেছে। আবার প্রিভিউ দেখে সংরক্ষণ করুন" });
  const original = JSON.stringify(db);
  fs.copyFileSync(DB_FILE, path.join(BACKUPS, `before-fee-date-${Date.now()}.json`));
  try {
    const first = db.enrollments.find(x => x.studentId === s.id);
    e.startDateHistory = [...(e.startDateHistory || []), { from: e.startDate, to: start, at: new Date().toISOString() }].slice(-50);
    e.startDate = start; e.admissionLinked = first?.id === e.id && start === s.admissionDate;
    e.updatedAt = new Date().toISOString(); setFirstMonth(e); saveDb();
    return send(res, 200, { ok: true, ...result, fees: feeSummary(s) });
  } catch (error) { db = JSON.parse(original); writeJsonAtomic(DB_FILE, db); throw error; }
}

// Gallery bulk deletion keeps private copies before removing the public records.
async function galleryDeleteAction(req, res) {
  const body = await readBody(req, 1024 * 1024);
  if (!body || !Array.isArray(body.ids) || !body.ids.length || body.ids.length > 5000 || body.ids.some(id => typeof id !== "string" || !/^[\w-]{1,100}$/.test(id))) return send(res, 400, { error: "মোছার জন্য ছবি নির্বাচন করুন (সর্বোচ্চ ৫০০০টি)" });
  const ids = new Set(body.ids), targets = db.gallery.filter(g => ids.has(g.id));
  if (!targets.length) return send(res, 200, { ok: true, deleted: 0, skipped: ids.size });
  const tag = uid("gallery-deleted"), archived = [];
  for (const g of targets) {
    const file = imgFile("gallery", g);
    let copy = "";
    if (file && fs.existsSync(file)) { copy = `${tag}-${g.id}${g.image.ext}`; fs.copyFileSync(file, path.join(BACKUPS, copy)); }
    archived.push({ item: g, imageBackup: copy });
  }
  writeJsonAtomic(path.join(BACKUPS, `${tag}.json`), { deletedAt: new Date().toISOString(), items: archived });
  const original = JSON.stringify(db);
  try { db.gallery = db.gallery.filter(g => !ids.has(g.id)); saveDb(); }
  catch (e) { db = JSON.parse(original); writeJsonAtomic(DB_FILE, db); throw e; }
  targets.forEach(g => dropImg("gallery", g));
  return send(res, 200, { ok: true, deleted: targets.length, skipped: ids.size - targets.length });
}

// One-time repair of the initial enrollment confirmed by the owner on 2026-11-04.
// Exact guards keep later modules and all other student records untouched.
function repairConfirmedAdmissionStart() {
  const key = "admission-start-280001-20261104";
  if (db.meta?.repairs?.[key]) {
    const repaired = db.enrollments.find(x => x.id === db.meta.repairs[key].enrollmentId);
    console.info("Confirmed admission date repair verified", JSON.stringify({ startDate: repaired?.startDate, due: repaired && enrollmentDue(repaired).due }));
    return false;
  }
  const s = db.students.find(x => x.id === "280001" && x.admissionDate === "2026-10-12");
  const e = s && db.enrollments.find(x => x.studentId === s.id);
  const c = e && db.courses.find(x => x.id === e.courseId);
  if (!e || e.startDate !== "2026-11-04" || c?.feeType !== "monthly" || Number(c.fee) !== 1000) return false;
  const original = JSON.stringify(db);
  fs.copyFileSync(DB_FILE, path.join(BACKUPS, `before-confirmed-admission-start-${Date.now()}.json`));
  try {
    const at = new Date().toISOString();
    e.startDateHistory = [...(e.startDateHistory || []), { from: e.startDate, to: s.admissionDate, at }].slice(-50);
    e.startDate = s.admissionDate; e.admissionLinked = true; e.updatedAt = at;
    setFirstMonth(e);
    db.meta ||= {}; db.meta.repairs ||= {};
    db.meta.repairs[key] = { at, enrollmentId: e.id, startDate: e.startDate };
    saveDb(); console.info("Confirmed admission date repair applied"); return true;
  } catch (error) { db = JSON.parse(original); writeJsonAtomic(DB_FILE, db); throw error; }
}

// ---------- রাউটার ----------
const PROFILE_REQUIRED = { name: "নাম (বাংলা)", nameEn: "নাম (ইংরেজি)", dob: "জন্ম তারিখ", gender: "লিঙ্গ", phone: "শিক্ষার্থীর মোবাইল", guardianName: "অভিভাবকের নাম", guardianPhone: "অভিভাবকের মোবাইল", address: "বর্তমান ঠিকানা", permanentAddress: "স্থায়ী ঠিকানা", college: "কলেজ", klass: "শ্রেণি", group: "বিভাগ" };
function studentProfileCompletion(student) {
  const missing = Object.entries(PROFILE_REQUIRED).filter(([key]) => !String(key === "permanentAddress" && student.sameAddress ? student.address || "" : student[key] || "").trim()).map(([key, label]) => ({ key, label }));
  return { complete: !missing.length, missing, total: Object.keys(PROFILE_REQUIRED).length };
}
async function updateStudentProfile(req, res, student) {
  const body = await readBody(req, 64 * 1024);
  const clean = STUDENT_KEYS({ ...student, ...body });
  const completion = studentProfileCompletion(clean);
  if (!completion.complete) return send(res, 400, { error: "এই তথ্যগুলো পূরণ করুন: " + completion.missing.map(x => x.label).join(", ") });
  if (!importValidDate(clean.dob) || clean.dob >= today()) return send(res, 400, { error: "সঠিক জন্ম তারিখ দিন" });
  for (const key of ["phone", "phone2", "whatsapp", "fatherPhone", "motherPhone", "guardianPhone", "refPhone"]) if (clean[key] && !/^01\d{9}$/.test(clean[key])) return send(res, 400, { error: "মোবাইল নম্বর ০১ দিয়ে শুরু ১১ সংখ্যার হতে হবে" });
  if (clean.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) return send(res, 400, { error: "সঠিক ইমেইল দিন" });
  if (clean.sscGpa && (!Number.isFinite(Number(clean.sscGpa)) || Number(clean.sscGpa) < 0 || Number(clean.sscGpa) > 5)) return send(res, 400, { error: "SSC GPA ০ থেকে ৫-এর মধ্যে দিন" });
  const original = JSON.stringify(student);
  fs.copyFileSync(DB_FILE, path.join(BACKUPS, `before-profile-${student.id}-${Date.now()}.json`));
  try { Object.assign(student, clean, { profileCompletedAt: new Date().toISOString(), profileUpdatedBy: "student" }); saveDb(); }
  catch (error) { Object.keys(student).forEach(k => delete student[k]); Object.assign(student, JSON.parse(original)); throw error; }
  return send(res, 200, { ok: true, profileCompletion: studentProfileCompletion(student) });
}
async function studentPhotoRequest(req, res, student) {
  const b = await readBody(req, 600 * 1024);
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.photo || ""));
  const bytes = match && Buffer.from(match[1], "base64");
  if (!bytes || bytes.length < 100 || bytes.length > 400 * 1024 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) return send(res, 400, { error: "সঠিক JPG ছবি দিন (৪০০ KB-এর মধ্যে)" });
  const file = photoFile("p", student.id), old = fs.existsSync(file) ? fs.readFileSync(file) : null;
  const original = JSON.stringify(student);
  try {
    fs.writeFileSync(file, bytes);
    student.pendingPhoto = { version: uid("photo"), submittedAt: new Date().toISOString() };
    delete student.photoReview; saveDb();
    return send(res, 200, { ok: true, pendingPhoto: student.pendingPhoto });
  } catch (error) { Object.keys(student).forEach(k => delete student[k]); Object.assign(student, JSON.parse(original)); if (old) fs.writeFileSync(file, old); else removePhoto("p", student.id); throw error; }
}
async function reviewStudentPhoto(req, res) {
  const b = await readBody(req), student = db.students.find(s => s.id === str(b.id, 40));
  if (!student?.pendingPhoto || !["approve", "reject"].includes(b.action)) return send(res, 400, { error: "অনুমোদনের অপেক্ষায় থাকা ছবি পাওয়া যায়নি" });
  if (b.version !== student.pendingPhoto.version) return send(res, 409, { error: "শিক্ষার্থী নতুন ছবি পাঠিয়েছে। আবার খুলে দেখুন" });
  const pending = photoFile("p", student.id), current = photoFile("s", student.id);
  if (!fs.existsSync(pending)) return send(res, 400, { error: "ছবিটি পাওয়া যায়নি। আবার পাঠাতে বলুন" });
  const tag = `photo-review-${Date.now()}-${student.id}`, original = JSON.stringify(student), old = fs.existsSync(current) ? fs.readFileSync(current) : null;
  fs.copyFileSync(DB_FILE, path.join(BACKUPS, tag + ".json"));
  fs.copyFileSync(pending, path.join(BACKUPS, tag + "-submitted.jpg"));
  if (old) fs.writeFileSync(path.join(BACKUPS, tag + "-previous.jpg"), old);
  try {
    if (b.action === "approve") { fs.copyFileSync(pending, current); student.photo = true; }
    student.photoReview = { status: b.action === "approve" ? "approved" : "rejected", at: new Date().toISOString() };
    delete student.pendingPhoto; saveDb();
  } catch (error) { Object.keys(student).forEach(k => delete student[k]); Object.assign(student, JSON.parse(original)); if (old) fs.writeFileSync(current, old); else removePhoto("s", student.id); throw error; }
  removePhoto("p", student.id);
  return send(res, 200, { ok: true });
}
async function api(req, res, url) {
  const p = url.pathname;
  const m = req.method;
  const ip = clientIp(req);
  res.secureCookie = isHttps(req);

  // অন্য ওয়েবসাইট থেকে তথ্য বদলানো বন্ধ (নিজের ঠিকানা — http লোকালে, https ডোমেইনে)
  if (m !== "GET" && !p.startsWith("/api/pay/ssl/")) {
    const origin = req.headers.origin;
    if (origin && origin !== `http://${req.headers.host}` && origin !== `https://${req.headers.host}`) return send(res, 403, { error: "অনুমতি নেই" });
  }

  if (p === "/api/health") return send(res, 200, { ok: true, app: "shahins-ict-care" });
  // মডিউলের ক্লাস রুটিন PDF (চালু মডিউল — সবাই দেখতে পারে)
  const crm = p.match(/^\/api\/module\/([\w-]+)\/routine$/);
  if (crm && m === "GET") {
    const c = db.courses.find((x) => x.id === crm[1]), f = c && c.active !== false && c.routine ? routinePdf(c) : "";
    if (!f || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": "application/pdf", "Content-Length": fs.statSync(f).size, "Cache-Control": "public, max-age=3600",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(c.routine.name)}` });
    return fs.createReadStream(f).pipe(res);
  }
  // নোটিশের PDF: ওয়েবসাইটের নোটিশ হলে সবাই, শুধু-শিক্ষার্থীর নোটিশ হলে লগইন করা শিক্ষার্থী / অ্যাডমিন; ?download=1 দিলে সরাসরি নামে
  const npm = p.match(/^\/api\/notice\/([\w-]+)\/pdf$/);
  if (npm && m === "GET") {
    const n = db.notices.find((x) => x.id === npm[1]), f = n && n.pdf ? noticePdf(n) : "";
    if (!f || !fs.existsSync(f) || (!n.public && !getLogin(req, "student") && !getLogin(req, "admin"))) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {
      "Content-Type": "application/pdf", "Content-Length": fs.statSync(f).size, "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `${url.searchParams.get("download") === "1" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(n.pdf.name)}`,
    });
    return fs.createReadStream(f).pipe(res);
  }
  // ব্যানার / সফল শিক্ষার্থীর ছবি (ওয়েবসাইট আর অ্যাডমিন দুটোতেই)
  const bim = p.match(/^\/api\/(banner|achiever|freeclass|ocourse|gphoto|cimage|tphoto|ebook|bookimg|dimage)\/([\w-]+)\/image$/);
  if (bim && m === "GET") {
    const col = IMG_URL2COL[bim[1]], b = db[col].find((x) => x.id === bim[2]), f = imgFile(col, b);
    if (!f || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": IMG_TYPES[b.image.ext] || "application/octet-stream", "Cache-Control": "public, max-age=86400" });
    return fs.createReadStream(f).pipe(res);
  }

  if (p === "/api/mentor-photo" && m === "GET") {
    const f = mentorFile();
    if (!f || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": IMG_TYPES[db.settings.mentorPhoto.ext] || "application/octet-stream", "Cache-Control": "public, max-age=86400" });
    return fs.createReadStream(f).pipe(res);
  }

  // ---- পাবলিক ----
  if (p === "/api/public" && m === "GET") {
    const settings = Object.fromEntries(SETTINGS_KEYS.map((k) => [k, db.settings[k] || ""]));
    const live = activeSessions();
    const batches = [...db.batches].sort(compareBatchSchedule).filter((b) => live.includes(b.session) && b.active !== false).map((b) => ({
      ...b, seatsLeft: Math.max(0, b.capacity - db.students.filter((s) => s.batchId === b.id && s.status !== "inactive").length),
    }));
    return send(res, 200, {
      settings, courses: db.courses.filter((c) => c.active !== false).map(({ lessons, ...c }) => ({ ...c, lessonCount: (lessons || []).length, lessonList: (lessons || []).map((l) => ({ title: l.title, chapter: l.chapter || "" })) })), batches, teachers: db.teachers, lists: db.lists,
      sessions: db.sessions.filter((s) => s.active !== false).map(({ name, note }) => ({ name, note })),
      notices: activeNotices(true),
      // মেয়াদ শেষ হওয়া পাবলিক নোটিশ (শেষ ২০টা) — শুধু মেনুর নোটিশ বোর্ডের "পুরোনো নোটিশ" ভাগে দেখায়, চলন্ত পট্টিতে নয়
      oldNotices: db.notices.filter((n) => n.public && n.until && n.until < today()).sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 20),
      banners: liveBanners(), achievers: liveAchievers(), gallery: liveGallery(), freeClasses: liveFree(), onlineCourses: liveCourses(),
      ebooks: db.ebooks.filter((e) => e.active !== false && e.title).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || String(b.createdAt).localeCompare(String(a.createdAt))).map((e) => ({ id: e.id, title: e.title, short: e.short, category: e.category, kind: e.kind, price: e.price, oldPrice: e.oldPrice, cover: e.image ? `/api/ebook/${e.id}/image?v=${e.image.v}` : "", hasPdf: !!e.pdf })),
      faqs: db.faqs.filter((f) => f.active !== false && f.q && f.a).sort(byOrder).map(({ id, q, a }) => ({ id, q, a })),
      stats: { students: db.students.filter((s) => s.status !== "inactive").length, courses: db.courses.filter((c) => c.active !== false).length, batches: batches.length },
      mentorPhoto: mentorUrl(), payGateway: gatewayOn(), hasBooks: db.books.some((b) => b.online && b.active !== false),
      rating: { count: db.ratings.length, avg: db.ratings.length ? db.ratings.reduce((a, r) => a + r.stars, 0) / db.ratings.length : 0 },
      reviews: publicReviews(),
    });
  }
  // ---- বই ও শিট: অনলাইনে অর্ডার (/books) — "অনলাইনে অর্ডার" চালু থাকা বইগুলো; টাকা পণ্য হাতে পেয়ে (ক্যাশ অন ডেলিভারি) ----
  if (p === "/api/books" && m === "GET") {
    const items = db.books.filter((b) => b.online && b.active !== false && b.title).sort(byOrder).map((b) => ({
      id: b.id, kind: b.kind, title: b.title, author: b.author, short: b.short, price: b.price, oldPrice: b.oldPrice,
      inStock: num(b.stock) > 0, left: num(b.stock) > 0 && num(b.stock) <= 5 ? num(b.stock) : 0, cover: b.image ? `/api/bookimg/${b.id}/image?v=${b.image.v}` : "" }));
    return send(res, 200, { items, ship: bookShip(), geo: BD_GEO, phone: db.settings.phone || "" });
  }
  if (p === "/api/books/order" && m === "POST") {
    const b = await readBody(req, 20000);
    if (b.website) return send(res, 200, { ok: true }); // বট ফাঁদ
    const ip = clientIp(req), now = Date.now(), hits = (bookHits.get(ip) || []).filter((t) => now - t < 3600e3);
    if (hits.length >= 8) return send(res, 429, { error: "অনেকগুলো অর্ডার হয়ে গেছে — একটু পরে আবার চেষ্টা করুন, বা ফোন করুন" });
    const v = { name: str(b.name, 120), phone: phoneOf(b.phone), division: str(b.division, 30), district: str(b.district, 40), area: str(b.area, 80), address: str(b.address, 300), note: str(b.note, 300), studentId: str(b.studentId, 40) };
    const pickup = !!b.pickup && bookShip().pickup;
    if (v.name.length < 2) return send(res, 400, { error: "আপনার নাম লিখুন" });
    if (!/^01\d{9}$/.test(v.phone)) return send(res, 400, { error: "সঠিক মোবাইল নম্বর দিন (০১ দিয়ে শুরু, ১১ সংখ্যা)" });
    if (!pickup) {
      if (!BD_GEO[v.division]) return send(res, 400, { error: "বিভাগ বেছে নিন" });
      if (!BD_GEO[v.division].includes(v.district)) return send(res, 400, { error: "জেলা বেছে নিন" });
      if (v.address.length < 5) return send(res, 400, { error: "পূর্ণ ঠিকানা লিখুন (গ্রাম / রাস্তা, বাড়ি)" });
    }
    if (v.studentId && !db.students.some((s) => s.id === v.studentId)) v.studentId = ""; // ভুল আইডি হলে বাইরের ক্রেতা ধরা হয়
    const L = bookLines((Array.isArray(b.items) ? b.items : []).map((x) => ({ bookId: x.id, qty: Math.min(20, Math.floor(num(x.qty))) })), { listPrice: true, onlineOnly: true });
    if (L.error) return send(res, 400, { error: L.error.replace(/স্টকে আছে.*/, "এখন স্টকে নেই বা যথেষ্ট নেই — পরিমাণ কমিয়ে দিন") });
    const subtotal = L.lines.reduce((a, l) => a + l.qty * l.price, 0), delivery = shipCharge(v.district, pickup);
    const o = { id: uid("bor"), orderNo: nextNo(db.bookOrders, "orderNo", 1000), ...v, pickup, lines: L.lines, subtotal, delivery, total: subtotal + delivery, status: "new", saleId: "", createdAt: new Date().toISOString() };
    db.bookOrders.push(o); bookHits.set(ip, [...hits, now]);
    saveDb();
    if (smsOn()) sendSms(o.phone, `${smsBrand()}: Order #${o.orderNo} received. Total Tk ${o.total}. We will call you to confirm.`, `বইয়ের অর্ডার — #${o.orderNo}`, "Book").then(saveDb, (e) => console.error("অর্ডারের SMS:", e.message));
    return send(res, 200, { ok: true, orderNo: o.orderNo, total: o.total, delivery: o.delivery });
  }
  if (p === "/api/books/track" && m === "GET") {
    const no = Math.floor(num(enDigits(url.searchParams.get("no")))), phone = phoneOf(url.searchParams.get("phone"));
    const o = db.bookOrders.find((x) => x.orderNo === no && x.phone === phone);
    if (!o) return send(res, 404, { error: "এই অর্ডার নম্বর আর মোবাইলে কোনো অর্ডার পাওয়া যায়নি" });
    return send(res, 200, { orderNo: o.orderNo, status: o.status, statusName: BOOK_STATUS[o.status], lines: o.lines.map(({ title, qty, price }) => ({ title, qty, price })), subtotal: o.subtotal, delivery: o.delivery, total: o.total, createdAt: o.createdAt });
  }
  // ---- অতিথি অ্যাকাউন্ট (মোবাইল নম্বর = আইডি, ৪ সংখ্যার PIN) — প্রশ্নোত্তর বক্স আর অনলাইন কুইজ একই অ্যাকাউন্টে ----
  // অনলাইন কুইজের আগের অতিথি (PIN ছাড়া) একবার PIN বেছে নিয়ে অ্যাকাউন্টটা নিজের করে নিতে পারে।
  // (মোবাইলে OTP দিয়ে যাচাই SMS সার্ভিস যুক্ত হলে যোগ হবে)
  if (p === "/api/guest/me" && m === "GET") {
    const g = guestOf(req);
    return send(res, 200, { me: g ? { id: g.id, name: g.name, phone: g.phone } : null, hsc: hscOptions(), groups: QUIZ_GROUPS, otp: smsOn() });
  }
  if (p === "/api/guest/register" && m === "POST") {
    const b = await readBody(req, 5000);
    if (b.website) return send(res, 200, { ok: true }); // বট ফাঁদ
    const v = { name: str(b.name, 80), phone: phoneOf(b.phone), hsc: str(b.hsc, 20), group: str(b.group, 30), college: str(b.college, 150) }, pin = str(b.pin, 10);
    if (v.name.length < 2) return send(res, 400, { error: "আপনার নাম লিখুন" });
    if (!/^01\d{9}$/.test(v.phone)) return send(res, 400, { error: "সঠিক মোবাইল নম্বর দিন (০১ দিয়ে শুরু, ১১ সংখ্যা)" });
    if (v.hsc && !hscOptions().includes(v.hsc)) return send(res, 400, { error: "এইচএসসি ব্যাচ বেছে নিন" });
    if (v.group && !QUIZ_GROUPS.includes(v.group)) return send(res, 400, { error: "গ্রুপ বেছে নিন" });
    if (!/^\d{4}$/.test(pin)) return send(res, 400, { error: "৪ সংখ্যার একটা PIN বেছে নিন" });
    let g = db.quizGuests.find((x) => x.phone === v.phone);
    if (g && g.pinHash) return send(res, 409, { error: "এই নম্বরে আগেই অ্যাকাউন্ট খোলা আছে — লগইন করুন" });
    if (smsOn()) { const bad = otpCheck(v.phone, "register", b.otp); if (bad) return send(res, 400, { error: bad, needOtp: true }); } // SMS চালু থাকলে মোবাইলের কোড মিলতে হবে
    if (!g) {
      if (db.quizGuests.filter((x) => (x.createdAt || "").startsWith(today())).length >= 500) return send(res, 429, { error: "আজ অনেকে যুক্ত হয়েছে, পরে চেষ্টা করুন" });
      g = { id: nextGuestId(), createdAt: new Date().toISOString() }; db.quizGuests.push(g);
    }
    Object.assign(g, v, { pinSalt: crypto.randomBytes(16).toString("hex"), updatedAt: new Date().toISOString() });
    g.pinHash = hashPassword(pin, g.pinSalt);
    upsertLead({ name: g.name, phone: g.phone, batch: g.hsc, institution: g.college }, { type: "guest", ref: g.id, note: "অতিথি অ্যাকাউন্ট" }); // সম্ভাব্য শিক্ষার্থীর তালিকায়
    saveDb(); newLogin(res, "guest", g.id);
    return send(res, 200, { ok: true, me: { id: g.id, name: g.name, phone: g.phone } });
  }
  // মোবাইলে যাচাই কোড পাঠানো — purpose: register (নতুন অ্যাকাউন্ট) / reset (PIN ভুলে গেলে)
  if (p === "/api/guest/otp" && m === "POST") {
    const b = await readBody(req, 2000), phone = phoneOf(b.phone), purpose = b.purpose === "reset" ? "reset" : "register";
    if (!smsOn()) return send(res, 400, { error: "এখন মোবাইলে কোড পাঠানো যাচ্ছে না" });
    if (!/^01\d{9}$/.test(phone)) return send(res, 400, { error: "সঠিক মোবাইল নম্বর দিন (০১ দিয়ে শুরু, ১১ সংখ্যা)" });
    const g = db.quizGuests.find((x) => x.phone === phone);
    if (purpose === "register" && g && g.pinHash) return send(res, 409, { error: "এই নম্বরে আগেই অ্যাকাউন্ট খোলা আছে — লগইন করুন" });
    if (purpose === "reset" && !(g && g.pinHash)) return send(res, 404, { error: "এই নম্বরে কোনো অ্যাকাউন্ট নেই — নতুন অ্যাকাউন্ট খুলুন" });
    const now = Date.now(), ip = clientIp(req);
    const byPhone = (otpSent.get(phone) || []).filter((t) => now - t < 3600e3), byIp = (otpSent.get("ip:" + ip) || []).filter((t) => now - t < 3600e3);
    if (byPhone.length && now - byPhone[byPhone.length - 1] < 60e3) return send(res, 429, { error: "১ মিনিট পরে আবার কোড চাইতে পারবেন" });
    if (byPhone.length >= 5 || byIp.length >= 10) return send(res, 429, { error: "অনেকবার কোড চাওয়া হয়েছে — এক ঘণ্টা পরে চেষ্টা করুন" });
    const code = String(crypto.randomInt(100000, 1000000)), salt = crypto.randomBytes(8).toString("hex");
    try { await sendSms(phone, `Your ${smsBrand()} code is ${code}. Valid for 5 minutes. Do not share it with anyone.`); }
    catch (e) { saveDb(); console.error("OTP SMS:", e.message); return send(res, 502, { error: "কোড পাঠানো যায়নি, একটু পরে আবার চেষ্টা করুন" }); }
    otps.set(otpKey(phone, purpose), { hash: hashPassword(code, salt), salt, exp: now + 5 * 60e3, tries: 0 });
    otpSent.set(phone, [...byPhone, now]); otpSent.set("ip:" + ip, [...byIp, now]);
    saveDb();
    return send(res, 200, { ok: true });
  }
  // PIN ভুলে গেলে: মোবাইলে আসা কোড দিয়ে নতুন PIN
  if (p === "/api/guest/reset" && m === "POST") {
    const b = await readBody(req, 2000), phone = phoneOf(b.phone), pin = str(b.pin, 10);
    const g = db.quizGuests.find((x) => x.phone === phone && x.pinHash);
    if (!g) return send(res, 404, { error: "এই নম্বরে কোনো অ্যাকাউন্ট নেই" });
    if (!/^\d{4}$/.test(pin)) return send(res, 400, { error: "৪ সংখ্যার নতুন PIN দিন" });
    const bad = otpCheck(phone, "reset", b.otp); if (bad) return send(res, 400, { error: bad });
    g.pinSalt = crypto.randomBytes(16).toString("hex"); g.pinHash = hashPassword(pin, g.pinSalt); g.updatedAt = new Date().toISOString();
    for (const [k, v] of logins) if (v.role === "guest" && v.sid === g.id) logins.delete(k); // আগের সব লগইন বাতিল
    saveLogins(); saveDb(); newLogin(res, "guest", g.id);
    return send(res, 200, { ok: true, me: { id: g.id, name: g.name, phone: g.phone } });
  }
  if (p === "/api/guest/login" && m === "POST") {
    const ip = clientIp(req);
    if (tooManyFails(ip)) return send(res, 429, { error: "অনেকবার ভুল হয়েছে। ৫ মিনিট পরে চেষ্টা করুন।" });
    const b = await readBody(req, 2000), phone = phoneOf(b.phone), pin = str(b.pin, 10);
    const g = db.quizGuests.find((x) => x.phone === phone);
    if (g && !g.pinHash) return send(res, 400, { error: "এই নম্বরে এখনো PIN নেই — \"নতুন অ্যাকাউন্ট\" থেকে একবার PIN বেছে নিন", needPin: true });
    if (!g || !sameHash(hashPassword(pin, g.pinSalt), g.pinHash)) { noteFail(ip); return send(res, 401, { error: "মোবাইল নম্বর বা PIN ভুল" }); }
    newLogin(res, "guest", g.id);
    return send(res, 200, { ok: true, me: { id: g.id, name: g.name, phone: g.phone } });
  }
  if (p === "/api/guest/logout" && m === "POST") { clearLogin(req, res, "guest"); return send(res, 200, { ok: true }); }

  // ---- ই-বুক: ফ্রি = অতিথি / শিক্ষার্থী লগইন করলেই; প্রিমিয়াম = অ্যাডমিন যার মোবাইল নম্বর "ক্রেতা" তালিকায় যোগ করেছেন ----
  const ebookWho = (req) => { const g = guestOf(req); if (g) return g.phone; const ss = getLogin(req, "student"), st = ss && db.students.find((x) => x.id === ss.sid); return st ? st.phone || "-" : null; };
  const ebookStudent = (req) => { const ss = getLogin(req, "student"), st = ss && db.students.find((x) => x.id === ss.sid); return !!st && st.status !== "inactive"; }; // ভর্তি হওয়া (পড়া চালু) শিক্ষার্থী
  const ebookOpen = (phone, e, stu) => { if (e.kind === "students") return !!stu; if (!phone) return false; if (e.kind !== "premium") return true; if (!(e.buyers || []).includes(phone)) return false; const end = ebookBuyerEnd(e, phone); return !end || end >= today(); };
  if (p === "/api/ebooks/mine" && m === "GET") {
    const phone = ebookWho(req), stu = ebookStudent(req);
    return send(res, 200, { loggedIn: !!phone, student: stu, open: db.ebooks.filter((e) => e.active !== false && ebookOpen(phone, e, stu)).map((e) => e.id), owned: phone ? db.ebooks.filter((e) => e.kind === "premium" && (e.buyers || []).includes(phone)).map((e) => e.id) : [],
      expiry: phone ? Object.fromEntries(db.ebooks.filter((e) => e.kind === "premium" && (e.buyers || []).includes(phone)).map((e) => [e.id, ebookBuyerEnd(e, phone)])) : {} });
  }
  const ebm = p.match(/^\/api\/ebook\/([\w-]+)\/pdf$/);
  if (ebm && m === "GET") {
    const e = db.ebooks.find((x) => x.id === ebm[1] && x.active !== false), phone = ebookWho(req);
    if (!e || !e.pdf || !fs.existsSync(ebookPdf(e))) return send(res, 404, { error: "এই ই-বুকের PDF এখনো দেওয়া হয়নি" });
    if (e.kind === "students" && !ebookStudent(req)) return send(res, phone ? 403 : 401, { error: "এই বইটি শুধু ভর্তি হওয়া শিক্ষার্থীদের জন্য — শিক্ষার্থী আইডি দিয়ে লগইন করুন" });
    if (!phone && e.kind !== "students") return send(res, 401, { error: "ই-বুক নামাতে আগে লগইন করুন" });
    if (!ebookOpen(phone, e, true)) return send(res, 403, { error: "এই ই-বুকটি কেনা নেই" });
    res.writeHead(200, { "Content-Type": "application/pdf", "Content-Length": fs.statSync(ebookPdf(e)).size, "Cache-Control": "private, no-store",
      "Content-Disposition": `${url.searchParams.get("download") === "1" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent((e.title || "ebook").replace(/[\\/:*?"<>|]/g, " ") + ".pdf")}` });
    return fs.createReadStream(ebookPdf(e)).pipe(res);
  }
  // ---- প্রতিদিন শিখি: তালিকা আর একটা পোস্ট (কুইজসহ) — লগইন লাগে না ----
  if (p === "/api/daily" && m === "GET") {
    const cat = str(url.searchParams.get("cat"), 20), q = str(url.searchParams.get("q"), 100).toLowerCase(), date = str(url.searchParams.get("date"), 10);
    const page = Math.max(1, Math.floor(num(url.searchParams.get("page"))) || 1), per = 12;
    const live = dailyLive();
    let list = live.filter((d) => (!DAILY_CATS.includes(cat) || d.category === cat) && (!date || d.date === date) && (!q || (d.title + " " + d.body).toLowerCase().includes(q)));
    const counts = Object.fromEntries(DAILY_CATS.map((c) => [c, { total: live.filter((d) => d.category === c).length, today: live.filter((d) => d.category === c && d.date === today()).length }]));
    return send(res, 200, { today: today(), counts, total: list.length, page, pages: Math.max(1, Math.ceil(list.length / per)), items: list.slice((page - 1) * per, page * per).map(dailyCard) });
  }
  const dpm = p.match(/^\/api\/daily\/([\w-]+)$/);
  if (dpm && m === "GET") {
    const live = dailyLive(), i = live.findIndex((x) => x.id === dpm[1]), d = live[i];
    if (!d) return send(res, 404, { error: "পোস্টটি পাওয়া যায়নি" });
    const same = live.filter((x) => x.category === d.category), j = same.indexOf(d);
    return send(res, 200, { item: { ...dailyCard(d), body: d.body, quiz: d.quiz || [] }, newer: j > 0 ? dailyCard(same[j - 1]) : null, older: j < same.length - 1 ? dailyCard(same[j + 1]) : null, more: same.filter((x) => x !== d).slice(0, 4).map(dailyCard) });
  }
  // ---- প্রশ্নোত্তর বক্স (ওয়েবসাইট) ----
  if (p === "/api/qna/mine" && m === "GET") {
    const who = qnaAsker(req);
    if (!who) return send(res, 200, { items: [] });
    return send(res, 200, { items: db.qna.filter((q) => qnaOwns(who, q)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 50).map((q) => ({ ...qnaPublic(q), status: q.status })) });
  }
  if (p === "/api/qna" && m === "POST") {
    const b = await readBody(req, 20000);
    if (b.website) return send(res, 200, { ok: true }); // বট ফাঁদ
    // প্রশ্ন করতে লগইন লাগে — অতিথি অ্যাকাউন্ট বা ভর্তি হওয়া শিক্ষার্থী; নাম-মোবাইল অ্যাকাউন্ট থেকে আসে
    const gst = guestOf(req), ss = !gst && getLogin(req, "student"), stu = ss && db.students.find((x) => x.id === ss.sid);
    if (!gst && !stu) return send(res, 401, { error: "প্রশ্ন করতে আগে লগইন করুন" });
    const text = str(b.text, 3000), name = (gst || stu).name || "", phone = (gst || stu).phone || "";
    if (!text && !b.hasMedia) return send(res, 400, { error: "প্রশ্নটা লিখুন, অথবা ছবি / ভয়েস দিন" });
    const ip = clientIp(req), now = Date.now(), hits = (qnaHits.get(ip) || []).filter((t) => now - t < 3600e3);
    if (hits.length >= 6) return send(res, 429, { error: "এক ঘণ্টায় অনেকগুলো প্রশ্ন হয়ে গেছে — একটু পরে আবার চেষ্টা করুন" });
    if (db.qna.filter((q) => q.date === today()).length >= 300) return send(res, 429, { error: "আজ অনেক প্রশ্ন এসেছে, কাল আবার চেষ্টা করুন" });
    qnaHits.set(ip, [...hits, now]);
    const q = { id: uid("qna"), name, phone, guestId: gst ? gst.id : "", studentId: stu ? stu.id : "", text, status: "new", public: true, date: today(), createdAt: new Date().toISOString(), token: crypto.randomBytes(12).toString("hex"), files: {} };
    db.qna.push(q); saveDb();
    return send(res, 200, { ok: true, id: q.id, token: q.token });
  }
  const qfm = p.match(/^\/api\/qna\/([\w-]+)\/(q-image|q-audio|a-image|a-audio|a-video)$/);
  if (qfm) {
    const q = db.qna.find((x) => x.id === qfm[1]);
    if (m === "POST") { // প্রশ্নকারীর ছবি / ভয়েস — প্রশ্ন জমার ৩০ মিনিটের মধ্যে, সেই টোকেন দিয়েই
      if (!q || !qfm[2].startsWith("q-") || q.token !== url.searchParams.get("t") || Date.now() - Date.parse(q.createdAt) > 30 * 60e3) return send(res, 403, { error: "ফাইল জমার সময় পার হয়ে গেছে — প্রশ্নটা আবার করুন" });
      try { await qnaSaveFile(req, q, qfm[2]); } catch (e) { return send(res, e.code || 500, { error: e.message }); }
      saveDb(); return send(res, 200, { ok: true });
    }
    if (!qnaOwns(qnaAsker(req), q)) { res.writeHead(404); return res.end(); } // ফাইল শুধু প্রশ্নকারী নিজে দেখে
    return qnaSendFile(req, res, q, qfm[2]);
  }

  if (p === "/api/contact" && m === "GET") return send(res, 200, { phone: db.settings.phone || "", whatsapp: String(db.settings.whatsapp || "").replace(/\D/g, "") }); // মেনুর ফোন / WhatsApp
  if (p === "/api/enquiry" && m === "POST") {
    const b = await readBody(req, 20000);
    if (b.website) return send(res, 200, { ok: true }); // বট ফাঁদ
    const e = CLEAN.enquiries(b);
    if (!e.name || !/^01\d{9}$/.test(e.phone)) return send(res, 400, { error: "নাম ও সঠিক মোবাইল নম্বর দিন" });
    if (db.enquiries.filter((x) => x.date === today()).length > 300) return send(res, 429, { error: "আজ অনেক আবেদন এসেছে, পরে চেষ্টা করুন" });
    const enq = { id: uid("enq"), ...e, status: "new", date: today(), createdAt: new Date().toISOString() };
    db.enquiries.push(enq);
    upsertLead({ name: e.name, phone: e.phone, course: e.course, institution: e.college, batch: e.klass }, { type: "enquiry", ref: enq.id, note: e.message }); // সম্ভাব্য শিক্ষার্থীর তালিকায়
    saveDb();
    return send(res, 200, { ok: true });
  }

  // ---- 🏆 ট্যালেন্ট হান্ট (ওয়েবসাইট) ----
  if (p === "/api/talent" && m === "GET") {
    const h = publicHunt();
    if (!h) return send(res, 200, { hunt: null });
    const out = { hunt: huntInfo(h), courses: db.courses.filter((c) => c.active !== false).map((c) => c.name) };
    // প্রকাশিত হলে মেধাতালিকা (meritShow = ০ মানে সবাই) — মোবাইল নম্বর কখনো দেখায় না
    if (h.resultPublished) out.merit = huntMerit(h).filter((x) => x.pass).slice(0, h.meritShow || undefined).map((x) => ({ rank: x.rank, ...regPublic(x.r), total: x.total }));
    return send(res, 200, out);
  }
  if (p === "/api/talent/register" && m === "POST") {
    const b = await readBody(req, 20000);
    if (b.website) return send(res, 200, { ok: true }); // বট ফাঁদ
    const h = publicHunt();
    if (!h || !h.live) return send(res, 400, { error: "এখন ট্যালেন্ট হান্টের রেজিস্ট্রেশন বন্ধ" });
    const v = { name: str(b.name, 120), phone: phoneOf(b.phone), klass: str(b.klass, 60), college: str(b.college, 150), course: str(b.course, 120) };
    if (v.name.length < 2 || !/^01\d{9}$/.test(v.phone)) return send(res, 400, { error: "নাম আর সঠিক মোবাইল নম্বর (01XXXXXXXXX) দিন" });
    // একই মোবাইলে আগে রেজিস্ট্রেশন থাকলে নতুন রোল না দিয়ে আগেরটাই
    const old = regsOf(h.id).find((r) => r.phone === v.phone);
    if (old) return send(res, 200, { ok: true, again: true, reg: regPublic(old), hunt: huntInfo(h) });
    if (regsOf(h.id).filter((r) => (r.createdAt || "").startsWith(today())).length > 1000) return send(res, 429, { error: "আজ অনেক রেজিস্ট্রেশন হয়েছে, পরে চেষ্টা করুন" });
    const r = addReg(h, v, "online");
    upsertLead({ name: v.name, phone: v.phone, batch: v.klass, institution: v.college, course: v.course }, { type: "talent", ref: r.id, campaign: h.title }); // সম্ভাব্য শিক্ষার্থীর তালিকায়
    saveDb();
    return send(res, 200, { ok: true, reg: regPublic(r), hunt: huntInfo(h) });
  }
  // প্রবেশপত্র (মোবাইল দিয়ে) আর ফলাফল (রোল + মোবাইল, প্রকাশের পরে)
  if (p === "/api/talent/lookup" && m === "POST") {
    if (tooManyFails(ip)) return send(res, 429, { error: "অনেকবার ভুল হয়েছে। ৫ মিনিট পরে চেষ্টা করুন।" });
    const b = await readBody(req, 5000);
    const h = publicHunt();
    if (!h) return send(res, 400, { error: "এখন কোনো ট্যালেন্ট হান্ট নেই" });
    const phone = phoneOf(b.phone), roll = str(b.roll, 30).toUpperCase();
    const r = regsOf(h.id).find((x) => x.phone === phone && (!roll || String(x.roll).toUpperCase() === roll));
    if (!r) { noteFail(ip); return send(res, 404, { error: roll ? "এই রোল আর মোবাইলে কোনো রেজিস্ট্রেশন পাওয়া যায়নি" : "এই মোবাইলে কোনো রেজিস্ট্রেশন পাওয়া যায়নি" }); }
    const out = { reg: regPublic(r), hunt: huntInfo(h) };
    if (h.resultPublished) {
      const me = huntMerit(h).find((x) => x.r.id === r.id), list = huntMerit(h).filter((x) => x.pass);
      out.result = r.absent ? { absent: true } : me ? { rank: me.rank, of: list.length, total: me.total, full: huntFull(h), pass: huntCols(h).every((c) => (Number(r.marks[c.key]) || 0) >= huntPassOf(h, c)), marks: huntCols(h).map((c) => ({ name: c.label, full: c.full, got: Number(r.marks[c.key]) || 0, passMark: huntPassOf(h, c) })) } : { pending: true };
    }
    return send(res, 200, out);
  }

  // ---- 🎬 ফ্রি ক্লাস ও অনলাইন কোর্স (ওয়েবসাইট) ----
  const fcv = p.match(/^\/api\/freeclass\/([\w-]+)\/video$/);
  if (fcv && m === "GET") {
    const c = db.freeClasses.find((x) => x.id === fcv[1] && x.active && x.source === "file");
    return sendVideo(req, res, c && videoPath(fcVideoKey(c), c.file), c && c.file ? VIDEO_TYPES[c.file.ext] || "video/mp4" : "");
  }
  // কোর্সের বিস্তারিত (ক্লাসের নাম দেখায়, ভিডিও নয়) + ঢোকা শিক্ষার্থীর ভর্তির অবস্থা
  if (p === "/api/learn/course" && m === "GET") {
    const c = db.onlineCourses.find((x) => x.id === str(url.searchParams.get("id"), 60) && x.active);
    if (!c) return send(res, 404, { error: "কোর্সটি পাওয়া যায়নি" });
    const me = learnerOf(req, res), en = enrollOf(me, c.id);
    return send(res, 200, { course: { ...courseCard(c), description: c.description, lessonList: (c.lessons || []).map((l) => ({ id: l.id, title: l.title, preview: !!l.preview })) }, me: me ? { name: me.name, phone: me.phone } : null, status: en ? en.status : "" });
  }
  if (p === "/api/learn/me" && m === "GET") {
    const me = learnerOf(req, res);
    if (!me) return send(res, 200, { me: null });
    return send(res, 200, { me: { name: me.name, phone: me.phone }, courses: db.ocEnrolls.filter((e) => e.learnerId === me.id).map((e) => { const c = db.onlineCourses.find((x) => x.id === e.courseId); return c && c.active ? { ...courseCard(c), status: e.status } : null; }).filter(Boolean) });
  }
  if (p === "/api/learn/login" && m === "POST") {
    if (tooManyFails(ip)) return send(res, 429, { error: "অনেকবার ভুল হয়েছে। ৫ মিনিট পরে চেষ্টা করুন।" });
    const b = await readBody(req, 5000);
    const L = db.learners.find((x) => x.phone === phoneOf(b.phone));
    if (!L || L.pin !== enDigits(str(b.pin, 10))) { noteFail(ip); return send(res, 401, { error: "মোবাইল বা PIN ভুল" }); }
    loginFails.delete(ip);
    newLogin(res, "learner", L.id);
    return send(res, 200, { ok: true, name: L.name });
  }
  if (p === "/api/learn/logout" && m === "POST") { clearLogin(req, res, "learner"); return send(res, 200, { ok: true }); }
  // কোর্সে ভর্তি — ভর্তির আগ্রহ ফর্মের মতো তথ্য; নতুন হলে অ্যাকাউন্ট আর ৪ সংখ্যার PIN
  if (p === "/api/learn/enroll" && m === "POST") {
    const b = await readBody(req, 20000);
    if (b.website) return send(res, 200, { ok: true });
    const c = db.onlineCourses.find((x) => x.id === str(b.courseId, 60) && x.active);
    if (!c) return send(res, 404, { error: "কোর্সটি পাওয়া যায়নি" });
    let me = learnerOf(req, res);
    if (!me) {
      const v = { name: str(b.name, 120), phone: phoneOf(b.phone), klass: str(b.klass, 60), college: str(b.college, 150) };
      if (v.name.length < 2 || !/^01\d{9}$/.test(v.phone)) return send(res, 400, { error: "নাম আর সঠিক মোবাইল নম্বর (01XXXXXXXXX) দিন" });
      if (db.learners.some((x) => x.phone === v.phone)) return send(res, 409, { error: "এই মোবাইলে আগেই অ্যাকাউন্ট আছে — নিচে মোবাইল আর PIN দিয়ে ঢুকে তারপর ভর্তি হোন", needLogin: true });
      if (db.learners.filter((x) => (x.createdAt || "").startsWith(today())).length > 500) return send(res, 429, { error: "আজ অনেকে ভর্তি হয়েছে, পরে চেষ্টা করুন" });
      me = { id: uid("lrn"), ...v, pin: newPin(), createdAt: new Date().toISOString() };
      db.learners.push(me);
      newLogin(res, "learner", me.id);
      var freshPin = me.pin;
    }
    let en = enrollOf(me, c.id);
    if (!en) {
      en = { id: uid("oce"), learnerId: me.id, courseId: c.id, status: c.access === "free" ? "active" : "pending", createdAt: new Date().toISOString() };
      db.ocEnrolls.push(en);
      upsertLead({ name: me.name, phone: me.phone, batch: me.klass, institution: me.college, course: c.title }, { type: "course", ref: en.id, campaign: c.title }, { status: en.status === "active" ? "admitted" : "interested" });
    }
    saveDb();
    let smsSent = false;
    if (freshPin && smsOn()) {
      const key = "ip:" + clientIp(req), now = Date.now(), byIp = (otpSent.get(key) || []).filter((t) => now - t < 3600e3);
      if (byIp.length < 10) { otpSent.set(key, [...byIp, now]); smsSent = (await smsLearnerLogin(me)).ok; saveDb(); }
    }
    return send(res, 200, { ok: true, status: en.status, pin: freshPin || "", smsSent, name: me.name });
  }
  // ভর্তি হওয়া (অনুমোদিত) শিক্ষার্থীর জন্য কোর্সের ক্লাসগুলো ক্রম অনুযায়ী; ঢোকেনি বা অনুমোদন বাকি — শুধু প্রিভিউ ক্লাস
  if (p === "/api/learn/lessons" && m === "GET") {
    const c = db.onlineCourses.find((x) => x.id === str(url.searchParams.get("id"), 60) && x.active);
    if (!c) return send(res, 404, { error: "কোর্সটি পাওয়া যায়নি" });
    const me = learnerOf(req, res), en = enrollOf(me, c.id), open = (en && en.status === "active") || !!getLogin(req, "admin");
    return send(res, 200, { open, lessons: (c.lessons || []).map((l) => ({ id: l.id, title: l.title, preview: !!l.preview, video: open || l.preview ? videoOf(l, `/api/learn/video/${c.id}/${l.id}?v=${l.file && l.file.v}`) : null })) });
  }
  const lvm = p.match(/^\/api\/learn\/video\/([\w-]+)\/([\w-]+)$/);
  if (lvm && m === "GET") {
    const c = db.onlineCourses.find((x) => x.id === lvm[1]), l = c && (c.lessons || []).find((x) => x.id === lvm[2]);
    if (!l || l.source !== "file" || !l.file) { res.writeHead(404); return res.end(); }
    const me = learnerOf(req), en = enrollOf(me, c.id);
    // দেখতে পারে: প্রিভিউ ক্লাস হলে সবাই; নইলে অনুমোদিত শিক্ষার্থী আর অ্যাডমিন (লক বন্ধ থাকলে অ্যাডমিন প্যানেল থেকে খোলা)
    const adminView = ADMIN_LOCK ? !!getLogin(req, "admin") : String(req.headers.referer || "").includes("/admin");
    if (!l.preview && !(en && en.status === "active") && !adminView) { res.writeHead(403); return res.end(); }
    return sendVideo(req, res, videoPath(lessonKey(c, l), l.file), VIDEO_TYPES[l.file.ext] || "video/mp4");
  }

  // ---- অনলাইন ভর্তির আবেদন ----
  if (p === "/api/apply" && m === "POST") {
    const b = await readBody(req, 1024 * 1024);
    if (b.website) return send(res, 200, { ok: true, appNo: "AP000000" }); // বট ফাঁদ
    const v = validateEnrollment(b);
    if (v.error) return send(res, 400, { error: v.error });
    const session = activeSessions().includes(str(b.session, 20)) ? str(b.session, 20) : "";
    const batch = db.batches.find((x) => x.id === str(b.batchId, 60) && x.session === session && x.active !== false);
    const a = { courseId: v.course.id, chapters: v.chapters, session, batchId: batch ? batch.id : "", ...STUDENT_KEYS(b), message: str(b.message, 1000) };
    if (!["M", "F", "O"].includes(b.gender)) a.gender = "";
    if (!session) return send(res, 400, { error: "আপনার সেশন বেছে নিন" });
    if (a.name.length < 2 || !/^01\d{9}$/.test(a.phone)) return send(res, 400, { error: "শিক্ষার্থীর নাম ও সঠিক মোবাইল নম্বর দিন" });
    for (const [k, label] of [["guardianPhone", "অভিভাবকের"], ["fatherPhone", "বাবার"], ["motherPhone", "মায়ের"], ["phone2", "শিক্ষার্থীর ২য়"], ["whatsapp", "হোয়াটসঅ্যাপ"], ["refPhone", "রেফারেন্সকারীর"]])
      if (a[k] && !/^01\d{9}$/.test(a[k])) return send(res, 400, { error: `${label} মোবাইল নম্বর ঠিক নেই` });
    // একই মোবাইলে একই মডিউলে খোলা আবেদন থাকলে নতুন করে না বানিয়ে সেটাই ফেরত
    const old = db.applications.find((x) => x.phone === a.phone && x.courseId === a.courseId && ["pending", "contacted"].includes(x.status));
    if (old) return send(res, 200, { ok: true, again: true, appNo: old.appNo, status: old.status, createdAt: old.createdAt });
    if (db.applications.filter((x) => (x.createdAt || "").startsWith(today())).length > 200) return send(res, 429, { error: "আজ অনেক আবেদন এসেছে, পরে চেষ্টা করুন" });
    const item = { id: uid("app"), appNo: nextAppNo(), ...a, fee: v.fee, status: "pending", note: "", studentId: "", photo: false, createdAt: new Date().toISOString() };
    if (b.photo) item.photo = savePhoto(b.photo, "a", item.id);
    db.applications.push(item);
    saveDb();
    return send(res, 200, { ok: true, appNo: item.appNo, status: item.status, createdAt: item.createdAt, fee: v.fee });
  }
  if (p === "/api/online-apply" && m === "POST") {
    const b = await readBody(req, 20000);
    if (b.website) return send(res, 200, { ok: true, appNo: "OA000000" }); // বট ফাঁদ
    const course = db.courses.find((c) => c.id === str(b.courseId, 60) && c.active !== false && c.mode === "online");
    if (!course) return send(res, 400, { error: "একটি অনলাইন মডিউল বেছে নিন" });
    const a = {
      courseId: course.id, nameEn: str(b.nameEn, 120).replace(/\s+/g, " "), college: str(b.college, 150),
      group: str(b.group, 40), hscBatch: str(b.hscBatch, 10), phone: phoneOf(b.phone), guardianPhone: phoneOf(b.guardianPhone),
    };
    if (!/^[A-Za-z][A-Za-z .'-]{1,119}$/.test(a.nameEn)) return send(res, 400, { error: "নাম ইংরেজিতে লিখুন (যেমন: Md Rahim Uddin)" });
    if (a.college.length < 2) return send(res, 400, { error: "কলেজের নাম লিখুন" });
    if (!ONLINE_GROUPS.includes(a.group)) return send(res, 400, { error: "বিভাগ বেছে নিন" });
    if (!hscBatches().includes(a.hscBatch)) return send(res, 400, { error: "এইচএসসি ব্যাচ বেছে নিন" });
    if (!/^01\d{9}$/.test(a.phone)) return send(res, 400, { error: "শিক্ষার্থীর সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)" });
    if (!/^01\d{9}$/.test(a.guardianPhone)) return send(res, 400, { error: "অভিভাবকের সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)" });
    // একই মোবাইলে একই মডিউলে খোলা আবেদন থাকলে নতুন না বানিয়ে সেটাই
    const want = course.feeType === "chapter" ? [...new Set((Array.isArray(b.chapters) ? b.chapters : []).map((x) => str(x, 10)))].sort().join(",") : "";
    const old = db.onlineApps.find((x) => x.phone === a.phone && x.courseId === a.courseId && ["pending", "contacted"].includes(x.status) && [...(x.chapters || [])].sort().join(",") === want);
    if (old) return send(res, 200, { ok: true, again: true, appNo: old.appNo, createdAt: old.createdAt, fee: old.fee, pay: payView(old) });
    if (db.onlineApps.filter((x) => (x.createdAt || "").startsWith(today())).length > 200) return send(res, 429, { error: "আজ অনেক আবেদন এসেছে, পরে চেষ্টা করুন" });
    let chapters = [], fee = course.fee;
    if (course.feeType === "chapter") { const v = validateEnrollment({ courseId: course.id, chapters: b.chapters }); if (v.error) return send(res, 400, { error: v.error }); chapters = v.chapters; fee = v.fee; }
    const item = { id: uid("oap"), appNo: nextOnlineAppNo(), ...a, chapters, fee, feeType: course.feeType, status: "pending", note: "", createdAt: new Date().toISOString() };
    db.onlineApps.push(item);
    saveDb();
    return send(res, 200, { ok: true, appNo: item.appNo, createdAt: item.createdAt, fee: item.fee, pay: payView(item) });
  }
  // পেমেন্ট শুরু / TrxID জমা — আবেদন নম্বর আর মোবাইল মিললে
  const ppm = p.match(/^\/api\/online-apply\/pay\/(init|manual)$/);
  if (ppm && m === "POST") {
    if (tooManyFails(ip)) return send(res, 429, { error: "অনেকবার ভুল হয়েছে। ৫ মিনিট পরে চেষ্টা করুন।" });
    const b = await readBody(req, 5000);
    const a = db.onlineApps.find((x) => x.appNo === str(b.appNo, 20).toUpperCase() && x.phone === phoneOf(b.phone));
    if (!a) { noteFail(ip); return send(res, 404, { error: "আবেদন পাওয়া যায়নি" }); }
    if (!(a.fee > 0)) return send(res, 400, { error: "এই মডিউলে কোনো ফি নেই" });
    if (a.pay && a.pay.status === "paid") return send(res, 400, { error: "এই আবেদনের পেমেন্ট আগেই হয়ে গেছে" });
    if (ppm[1] === "manual") {
      const method = str(b.method, 10);
      if (!["bkash", "nagad", "rocket", "bank"].includes(method)) return send(res, 400, { error: "পেমেন্টের মাধ্যম বেছে নিন" });
      const trxId = str(b.trxId, 40).toUpperCase().replace(/\s+/g, ""), sender = method === "bank" ? str(b.sender, 120) : phoneOf(b.sender);
      if (method !== "bank" && !/^01\d{9}$/.test(sender)) return send(res, 400, { error: "যে নম্বর থেকে টাকা পাঠিয়েছেন সেটা সঠিকভাবে দিন" });
      if (method === "bank" && sender.length < 2) return send(res, 400, { error: "যে অ্যাকাউন্ট / নাম থেকে টাকা পাঠিয়েছেন সেটা লিখুন" });
      if (!/^[A-Z0-9-]{4,40}$/.test(trxId)) return send(res, 400, { error: method === "bank" ? "ব্যাংকের রেফারেন্স / ট্রানজেকশন নম্বর দিন" : "সঠিক TrxID দিন (যেমন 9F7A2B3C4D)" });
      if (db.onlineApps.some((x) => x !== a && x.pay && x.pay.trxId === trxId)) return send(res, 400, { error: "এই TrxID আগে একটি আবেদনে ব্যবহার হয়েছে" });
      a.pay = { status: "verifying", method, sender, trxId, amount: a.fee, at: new Date().toISOString() };
      saveDb();
      return send(res, 200, { ok: true, pay: payView(a) });
    }
    if (!gatewayOn()) return send(res, 400, { error: "অনলাইন গেটওয়ে এখনো চালু হয়নি — নিচের বিকাশ / নগদ / রকেট / ব্যাংক দিয়ে পাঠান" });
    const tranId = `${a.appNo}-${Date.now().toString(36).toUpperCase()}`, base = siteBase(req), course = db.courses.find((c) => c.id === a.courseId) || {};
    const form = new URLSearchParams({
      store_id: payCfg.sslStoreId, store_passwd: payCfg.sslStorePass, total_amount: String(a.fee), currency: "BDT", tran_id: tranId,
      success_url: `${base}/api/pay/ssl/success`, fail_url: `${base}/api/pay/ssl/fail`, cancel_url: `${base}/api/pay/ssl/cancel`, ipn_url: `${base}/api/pay/ssl/ipn`,
      cus_name: a.nameEn, cus_email: db.settings.email || "info@example.com", cus_add1: db.settings.address || "Bangladesh", cus_city: "Dhaka", cus_postcode: "1000", cus_country: "Bangladesh", cus_phone: a.phone,
      shipping_method: "NO", num_of_item: "1", product_name: str(course.name || "Online Course", 100), product_category: "Education", product_profile: "non-physical-goods", value_a: a.appNo,
    });
    try {
      const r = await (await fetch(`${sslBase()}/gwprocess/v4/api.php`, { method: "POST", body: form })).json();
      if (r.status !== "SUCCESS" || !r.GatewayPageURL) return send(res, 502, { error: "গেটওয়ে চালু হয়নি: " + str(r.failedreason || "পরে চেষ্টা করুন", 200) });
      a.pay = { status: "initiated", method: "gateway", tranId, amount: a.fee, at: new Date().toISOString() };
      saveDb();
      return send(res, 200, { ok: true, url: r.GatewayPageURL });
    } catch { return send(res, 502, { error: "গেটওয়েতে যোগাযোগ করা যায়নি — ইন্টারনেট দেখুন বা পরে চেষ্টা করুন" }); }
  }
  if (p === "/api/online-apply/account" && m === "POST") {
    if (tooManyFails(ip)) return send(res, 429, { error: "অনেকবার ভুল হয়েছে। ৫ মিনিট পরে চেষ্টা করুন।" });
    const b = await readBody(req, 5000);
    const a = db.onlineApps.find((x) => x.appNo === str(b.appNo, 20).toUpperCase() && x.phone === phoneOf(b.phone));
    if (!a) { noteFail(ip); return send(res, 404, { error: "আবেদন পাওয়া যায়নি" }); }
    const s = a.studentId && a.pay && a.pay.method === "gateway" && a.pay.status === "paid" ? db.students.find((x) => x.id === a.studentId) : null;
    return send(res, 200, s ? { studentId: s.id, pin: s.pin } : { studentId: "" });
  }
  // গেটওয়ে থেকে ফেরা: success / fail / cancel — শিক্ষার্থীর ব্রাউজার আসে (পরে ভর্তির পাতায় পাঠানো); ipn — SSLCommerz সার্ভার নিজে জানায়
  const psm = p.match(/^\/api\/pay\/ssl\/(success|fail|cancel|ipn)$/);
  if (psm && m === "POST") {
    let f = {};
    try { f = Object.fromEntries(new URLSearchParams((await readRaw(req, 64 * 1024)).toString("utf8"))); } catch {}
    let a = db.onlineApps.find((x) => x.pay && x.pay.tranId && x.pay.tranId === str(f.tran_id, 80));
    if (["success", "ipn"].includes(psm[1])) a = await sslConfirm(f);
    else if (a && a.pay.status !== "paid") { a.pay.status = psm[1] === "fail" ? "failed" : "cancelled"; saveDb(); }
    if (psm[1] === "ipn") return send(res, 200, { ok: true });
    const result = a && a.pay.status === "paid" ? "success" : psm[1] === "cancel" ? "cancel" : "fail";
    res.writeHead(302, { Location: `/online-apply?pay=${result}${a ? "&app=" + encodeURIComponent(a.appNo) : ""}` });
    return res.end();
  }
  if (p === "/api/apply/status" && m === "POST") {
    if (tooManyFails(ip)) return send(res, 429, { error: "অনেকবার ভুল হয়েছে। ৫ মিনিট পরে চেষ্টা করুন।" });
    const b = await readBody(req, 5000);
    const phone = phoneOf(b.phone);
    if (!/^01\d{9}$/.test(phone)) return send(res, 400, { error: "সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)" });
    const courseName = (id) => (db.courses.find((c) => c.id === id) || {}).name || "";
    const offline = db.applications.filter((x) => x.phone === phone).map((a) => {
      const course = db.courses.find((c) => c.id === a.courseId), batch = db.batches.find((x) => x.id === a.batchId);
      const chapterNames = course ? (course.chapters || []).filter((c) => (a.chapters || []).includes(c.id)).map((c) => c.name) : [];
      return { appNo: a.appNo, name: a.name, phone: a.phone, session: a.session, status: a.status, note: a.note, createdAt: a.createdAt,
        course: course ? course.name : "", chapters: chapterNames, batch: batchLabel(batch), studentId: a.status === "approved" ? a.studentId : "" };
    });
    const online = db.onlineApps.filter((x) => x.phone === phone).map((a) => ({ appNo: a.appNo, name: a.nameEn, phone: a.phone, status: a.status, note: a.note,
      createdAt: a.createdAt, course: courseName(a.courseId) + " (অনলাইন)", fee: a.fee, pay: payView(a), studentId: a.status === "approved" ? a.studentId || "" : "" }));
    const list = [...offline, ...online].sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));
    if (!list.length) { noteFail(ip); return send(res, 404, { error: "এই মোবাইল নম্বরে কোনো আবেদন পাওয়া যায়নি" }); }
    return send(res, 200, { list });
  }

  // ---- অ্যাডমিন লগইন ----
  if (p === "/api/admin/status") return send(res, 200, ADMIN_LOCK ? { setup: authReady(), loggedIn: !!getLogin(req, "admin"), lock: true } : { setup: true, loggedIn: true, lock: false });
  // প্রথমবার (বা পুরনো শুধু-পাসওয়ার্ডের auth.json থাকলে): PIN + ইমেইল + পাসওয়ার্ড একসাথে ঠিক করা
  if (p === "/api/admin/setup" && m === "POST") {
    if (authReady()) return send(res, 400, { error: "Login is already set up" });
    const b = await readBody(req);
    const pin = enDigits(str(b.pin, 10)), email = normEmail(b.email), password = str(b.password, 200);
    if (!validPin(pin)) return send(res, 400, { error: "PIN must be exactly 6 digits" });
    if (!validEmail(email)) return send(res, 400, { error: "Enter a valid email" });
    if (password.length < 8) return send(res, 400, { error: "Password must be at least 8 characters" });
    setCreds({ pin, email, password });
    newLogin(res, "admin");
    return send(res, 200, { ok: true });
  }
  // ধাপ ১: PIN
  if (p === "/api/admin/pin" && m === "POST") {
    if (tooManyFails(ip)) return send(res, 429, { error: "Too many wrong attempts. Try again in 5 minutes." });
    const b = await readBody(req);
    if (!checkPin(enDigits(str(b.pin, 10)))) { noteFail(ip); return send(res, 401, { error: "Wrong PIN" }); }
    for (const [k, v] of pinTickets) if (v.exp < Date.now()) pinTickets.delete(k);
    const ticket = crypto.randomBytes(24).toString("hex");
    pinTickets.set(ticket, { ip, exp: Date.now() + 5 * 60e3 });
    return send(res, 200, { ok: true, ticket });
  }
  // ধাপ ২: ইমেইল + পাসওয়ার্ড (PIN-এর টিকিট লাগবে)
  if (p === "/api/admin/login" && m === "POST") {
    if (tooManyFails(ip)) return send(res, 429, { error: "Too many wrong attempts. Try again in 5 minutes." });
    const b = await readBody(req);
    const t = pinTickets.get(str(b.ticket, 100));
    if (!t || t.ip !== ip || t.exp < Date.now()) { pinTickets.delete(str(b.ticket, 100)); return send(res, 401, { error: "Time is up — please re-enter PIN", restart: true }); }
    const okEmail = authReady() && normEmail(b.email) === auth.email;
    if (!okEmail || !checkPassword(str(b.password, 200))) { noteFail(ip); return send(res, 401, { error: "Wrong email or password" }); }
    pinTickets.delete(str(b.ticket, 100));
    loginFails.delete(ip);
    newLogin(res, "admin");
    return send(res, 200, { ok: true });
  }
  if (p === "/api/admin/logout" && m === "POST") { clearLogin(req, res, "admin"); return send(res, 200, { ok: true }); }

  // শিক্ষার্থী প্যানেলের ডেটা কার: নিজের লগইন, অথবা অ্যাডমিন "?as=আইডি" দিয়ে কোনো শিক্ষার্থীর প্যানেল দেখছে (শুধু দেখা)
  const panelStudent = (r2) => {
    const as = url.searchParams.get("as");
    if (as) return ADMIN_LOCK && !getLogin(req, "admin") ? null : db.students.find((x) => x.id === as) || null;
    const sess = getLogin(req, "student", r2);
    return (sess && db.students.find((x) => x.id === sess.sid)) || null;
  };
  // ---- শিক্ষার্থী লগইন ----
  if (p === "/api/student/login" && m === "POST") {
    if (tooManyFails(ip)) return send(res, 429, { error: "Too many wrong attempts. Try again in 5 minutes." });
    const b = await readBody(req);
    const s = db.students.find((x) => x.id.toUpperCase() === str(b.id, 40).toUpperCase());
    if (!s || s.pin !== str(b.pin, 10) || s.status === "inactive") { noteFail(ip); return send(res, 401, { error: "Wrong ID or PIN" }); }
    loginFails.delete(ip);
    newLogin(res, "student", s.id);
    return send(res, 200, { ok: true });
  }
  if (p === "/api/student/logout" && m === "POST") { clearLogin(req, res, "student"); return send(res, 200, { ok: true }); }
  // ⭐ রেটিং — প্রত্যেক শিক্ষার্থী একটাই রেটিং দেয় (আবার দিলে আগেরটা বদলায়); অ্যাডমিন ভিউ থেকে দেওয়া যায় না
  if (p === "/api/student/rating" && m === "POST") {
    const sess = getLogin(req, "student");
    const s = sess && db.students.find((x) => x.id === sess.sid && x.status !== "inactive");
    if (!s) return send(res, 401, { error: "লগইন করুন" });
    const b = await readBody(req);
    const stars = Math.round(Number(b.stars));
    if (!(stars >= 1 && stars <= 5)) return send(res, 400, { error: "১ থেকে ৫ তারার মধ্যে বেছে নাও" });
    const comment = str(b.comment, 300);
    const old = db.ratings.find((r) => r.studentId === s.id);
    if (old) Object.assign(old, { stars, comment, at: new Date().toISOString() });
    else db.ratings.push({ id: uid("rt"), studentId: s.id, stars, comment, at: new Date().toISOString() });
    saveDb();
    return send(res, 200, { ok: true, rating: { stars, comment } });
  }
  // অনলাইন কুইজ — শুরু / জমা / উত্তর দেখা (ব্যাচের শিক্ষার্থী)
  const sqm = p.match(/^\/api\/student\/quiz\/(start|submit|review)$/);
  if (sqm) {
    const sess = getLogin(req, "student");
    const s = sess && db.students.find((x) => x.id === sess.sid);
    if (!s) return send(res, 401, { error: "লগইন করুন" });
    return quizAction(req, res, sqm[1], m, url, s.id, (q) => quizFor(q, s));
  }
  // ---- অনলাইন কুইজ পেজ (/quiz): ব্যাচের বাইরের শিক্ষার্থী ছোট ফর্ম পূরণ করে "সবার জন্য খোলা" কুইজ দেয় ----
  if (p === "/api/quiz/public" && m === "GET") {
    const g = guestOf(req);
    return send(res, 200, {
      hsc: hscOptions(), groups: QUIZ_GROUPS,
      me: g ? { id: g.id, name: g.name, phone: g.phone, hsc: g.hsc, group: g.group, college: g.college } : null,
      quizzes: db.quizzes.filter(quizForGuest).map((q) => quizCard(q, g ? g.id : "")).sort(byOpens),
    });
  }
  // কুইজের অতিথি: লগইন / নতুন অ্যাকাউন্ট "অতিথি লগইন" দিয়ে (মোবাইল + PIN, SMS চালু থাকলে কোড দিয়ে যাচাই);
  // এখানে শুধু লগইন করা অতিথি নিজের তথ্য (নাম, ব্যাচ, গ্রুপ, কলেজ) বদলায় — মোবাইল নম্বর (আইডি) বদলায় না
  if (p === "/api/quiz/join" && m === "POST") {
    const g = guestOf(req);
    if (!g) return send(res, 401, { error: "কুইজ দিতে আগে অতিথি অ্যাকাউন্টে লগইন করো" });
    const b = await readBody(req, 5000);
    const v = { name: str(b.name, 80), hsc: str(b.hsc, 20), group: str(b.group, 30), college: str(b.college, 150) };
    if (v.name.length < 2) return send(res, 400, { error: "তোমার নাম লেখো" });
    if (!hscOptions().includes(v.hsc)) return send(res, 400, { error: "এইচএসসি ব্যাচ বেছে নাও" });
    if (!QUIZ_GROUPS.includes(v.group)) return send(res, 400, { error: "গ্রুপ বেছে নাও" });
    if (v.college.length < 2) return send(res, 400, { error: "কলেজের নাম লেখো" });
    Object.assign(g, v, { updatedAt: new Date().toISOString() });
    upsertLead({ name: g.name, phone: g.phone, batch: g.hsc, institution: g.college }, { type: "quiz", ref: g.id, note: g.group }); // সম্ভাব্য শিক্ষার্থীর তালিকায়
    saveDb();
    return send(res, 200, { ok: true, id: g.id });
  }
  if (p === "/api/quiz/logout" && m === "POST") { clearLogin(req, res, "guest"); return send(res, 200, { ok: true }); }
  const gqm = p.match(/^\/api\/quiz\/(start|submit|review)$/);
  if (gqm) {
    const g = guestOf(req);
    if (!g) return send(res, 401, { error: "আগে ফর্মটা পূরণ করো" });
    return quizAction(req, res, gqm[1], m, url, g.id, quizForGuest);
  }
  // শিক্ষার্থী শুধু নিজের পরীক্ষার প্রশ্ন / উত্তরপত্র আর নিজের খাতা দেখতে পারে
  const srm = p.match(/^\/api\/student\/routine\/([\w-]+)\/pdf$/);
  if (srm && m === "GET") {
    const ps = panelStudent(), r = db.examRoutines.find((x) => x.id === srm[1]);
    if (!ps) return send(res, 401, { error: "লগইন করুন" });
    if (!r || !routineForStudent(r, ps)) return send(res, 404, { error: "পাওয়া যায়নি" });
    return sendExamRoutine(res, r, url);
  }
  const sdm = p.match(/^\/api\/student\/docs\/([\w-]+)\/file$/);
  if (sdm && m === "GET") {
    const ps = panelStudent(), sess = ps && { sid: ps.id };
    if (!sess) return send(res, 401, { error: "লগইন করুন" });
    const d = db.docs.find((x) => x.id === sdm[1]), ex = d && db.exams.find((e) => e.id === d.examId);
    const me = ps;
    const mine = ex && ((ex.studentIds || []).includes(sess.sid) || (ex.marks || {})[sess.sid]) && (d.category !== "script" || (d.studentId === sess.sid && isPublishedFor(ex, me)));
    if (!mine) return send(res, 404, { error: "পাওয়া যায়নি" });
    return sendDoc(req, res, d, url);
  }
  if (p === "/api/student/profile" && m === "POST") {
    const session = getLogin(req, "student");
    const student = session && db.students.find(s => s.id === session.sid && s.status !== "inactive");
    if (!student) return send(res, 401, { error: "শিক্ষার্থী হিসেবে লগইন করুন" });
    return updateStudentProfile(req, res, student);
  }
  if (p === "/api/student/photo-request") {
    const session = getLogin(req, "student");
    const student = session && db.students.find(s => s.id === session.sid && s.status !== "inactive");
    if (!student) return send(res, 401, { error: "শিক্ষার্থী হিসেবে লগইন করুন" });
    if (m === "POST") return studentPhotoRequest(req, res, student);
    if (m === "GET" && student.pendingPhoto) return sendPhoto(res, "p", student.id);
    return send(res, 404, { error: "ছবি পাওয়া যায়নি" });
  }
  if (p === "/api/student/photo" && m === "GET") {
    const ps = panelStudent();
    if (!ps) return send(res, 401, { error: "লগইন করুন" });
    return sendPhoto(res, "s", ps.id);
  }
  const svm = p.match(/^\/api\/student\/video\/([\w-]+)\/([\w-]+)$/);
  if (svm && m === "GET") {
    const c = db.courses.find((x) => x.id === svm[1]), l = c && (c.lessons || []).find((x) => x.id === svm[2]);
    if (!l || l.source !== "file" || !l.file) { res.writeHead(404); return res.end(); }
    const sess = getLogin(req, "student");
    const adminView = ADMIN_LOCK ? !!getLogin(req, "admin") : String(req.headers.referer || "").includes("/admin");
    const mine = sess && db.enrollments.some((e) => e.studentId === sess.sid && e.courseId === c.id && e.status === "active" && accessOpen(e) && lessonAllowed(c, e, l)); // মেয়াদ শেষ হলে বা অধ্যায় কেনা না থাকলে বন্ধ
    if (!mine && !adminView) { res.writeHead(403); return res.end(); }
    return sendVideo(req, res, videoPath(modLessonKey(c, l), l.file), VIDEO_TYPES[l.file.ext] || "video/mp4");
  }
  if (p === "/api/student/me" && m === "GET") {
    const s = panelStudent(res);
    if (!s) return send(res, 401, { error: "লগইন করুন" });
    const batch = db.batches.find((b) => b.id === s.batchId) || null;
    const { pin, note, ...profile } = s;
    const fees = feeSummary(s);
    return send(res, 200, {
      profile, profileCompletion: studentProfileCompletion(s), batch, courses: fees.items.filter((i) => i.status === "active").map((i) => i.course),
      attendance: attendanceFor(s.id), results: resultsFor(s), schedule: scheduleFor(s),
      examRoutines: db.examRoutines.filter((r) => routineForStudent(r, s)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map(({ id, title, type, pdf, createdAt }) => ({ id, title, type, pdf, createdAt })),
      payments: db.payments.filter((x) => x.studentId === s.id).sort((a, b) => b.date.localeCompare(a.date)),
      fees, notices: activeNotices(false).filter((n) => (n.studentIds ? n.studentIds.includes(s.id) : !(n.batchIds || []).length || n.batchIds.includes(s.batchId))),
      quizzes: quizzesFor(s),
      // নিজের ব্যাচের বাড়ির কাজ / পড়া (পুরো সেশনের জন্য দেওয়া হলেও) আর নিজের অবস্থা
      homework: db.homework.filter((h) => h.session === s.session && (!(h.batchIds || []).length || h.batchIds.includes(s.batchId)))
        .map(({ id, kind, title, details, subject, chapter, givenDate, dueDate, checks }) => ({ id, kind, title, details, subject, chapter, givenDate, dueDate, status: (checks || {})[s.id] || "" }))
        .sort((a, b) => (b.dueDate || b.givenDate).localeCompare(a.dueDate || a.givenDate)).slice(0, 60),
      // নিজের ব্যাচের চলমান / সামনের বন্ধ (ছুটি)
      closures: db.closures.filter((c) => (c.batchIds || []).includes(s.batchId) && c.to >= today()).map(({ from, to, reason }) => ({ from, to, reason })).sort((a, b) => a.from.localeCompare(b.from)),
      myRating: (({ stars, comment } = {}) => (stars ? { stars, comment } : null))(db.ratings.find((r) => r.studentId === s.id)),
      // ভর্তি থাকা মডিউলের রেকর্ড ক্লাস (ক্রম অনুযায়ী) — YouTube আইডি বা নিজের সার্ভারের ভিডিও
      // মেয়াদ শেষ হলে সেই মডিউলের ক্লাসের তালিকা পাঠানো হয় না (locked) — শুধু মেয়াদের তথ্য
      videos: db.enrollments.filter((e) => e.studentId === s.id && e.status === "active").map((e) => ({ e, c: db.courses.find((c) => c.id === e.courseId) }))
        .filter(({ c }) => c && (c.lessons || []).length).map(({ e, c }) => { const acc = accessInfo(e); return { id: c.id, code: c.code, name: c.name, access: acc, locked: acc.expired,
          chapters: c.feeType === "chapter" ? (c.chapters || []).filter((x) => (e.chapters || []).includes(x.id)).map((x) => ({ id: x.id, name: x.name })) : [],
          lessons: acc.expired ? [] : c.lessons.filter((l) => lessonAllowed(c, e, l)).map((l) => ({ chapter: l.chapter || "", id: l.id, title: l.title, video: videoOf(l, `/api/student/video/${c.id}/${l.id}?v=${l.file && l.file.v}`) })).filter((l) => l.video) }; }),
      site: { name: db.settings.name, phone: db.settings.phone, address: db.settings.address },
    });
  }

  // ---- এখান থেকে নিচে শুধু অ্যাডমিন ----
  if (!p.startsWith("/api/admin/")) return send(res, 404, { error: "পাওয়া যায়নি" });
  if (ADMIN_LOCK && !getLogin(req, "admin", res)) return send(res, 401, { error: "লগইন করুন" });

  // অফলাইন মডিউলের শিক্ষার্থীদের অনলাইন মডিউলের অ্যাক্সেস: যাদের আগে থেকে ঐ অনলাইন মডিউল নেই তাদের ফি ০ দিয়ে ভর্তি (মেয়াদ আজ থেকে);
  // GET = কতজন পাবে তার হিসাব, POST = দেওয়া, DELETE = এই অফলাইন মডিউল থেকে দেওয়া অ্যাক্সেস তুলে নেওয়া
  if (p === "/api/admin/grant-online") {
    const from = db.courses.find((c) => c.id === str(url.searchParams.get("from"), 60)), to = db.courses.find((c) => c.id === str(url.searchParams.get("to"), 60));
    if (!from || from.mode === "online") return send(res, 400, { error: "একটা অফলাইন মডিউল বাছুন" });
    if (!to || to.mode !== "online") return send(res, 400, { error: "একটা অনলাইন মডিউল বাছুন" });
    const studs = [...new Set(db.enrollments.filter((e) => e.courseId === from.id && e.status === "active").map((e) => e.studentId))]
      .map((id) => db.students.find((x) => x.id === id)).filter((x) => x && x.status !== "inactive");
    const has = (st) => db.enrollments.find((e) => e.studentId === st.id && e.courseId === to.id && e.status === "active");
    const granted = () => db.enrollments.filter((e) => e.courseId === to.id && e.status === "active" && e.grantedFrom === from.id);
    if (m === "GET") return send(res, 200, { total: studs.length, already: studs.filter(has).length, granted: granted().length });
    if (m === "DELETE") { const g = granted(); g.forEach((e) => { e.status = "ended"; e.endDate = today(); e.updatedAt = new Date().toISOString(); }); saveDb(); return send(res, 200, { ok: true, removed: g.length }); }
    if (m === "POST") {
      const b = await readBody(req, 5000);
      const v = validateEnrollment({ courseId: to.id, chapters: to.feeType === "chapter" ? (b.allChapters ? (to.chapters || []).map((x) => x.id) : b.chapters) : [] });
      if (v.error) return send(res, 400, { error: v.error });
      let added = 0;
      for (const st of studs) {
        if (has(st)) continue;
        const enr = createEnrollment(st.id, { ...v, fee: 0, discount: 0 }, today(), "");
        enr.grantedFrom = from.id; added++;
      }
      saveDb();
      return send(res, 200, { ok: true, added, skipped: studs.length - added });
    }
  }
  // মেয়াদ: সব ভর্তির (মেয়াদওয়ালা মডিউল) আর প্রিমিয়াম ই-বুক ক্রেতার তালিকা
  if (p === "/api/admin/access" && m === "GET") {
    const enr = db.enrollments.filter((e) => e.status === "active").map((e) => { const c = db.courses.find((x) => x.id === e.courseId), st = db.students.find((x) => x.id === e.studentId);
      return c && st && (c.validityDays > 0 || e.accessUntil || e.accessLifetime) ? { kind: "course", id: e.id, studentId: st.id, name: st.name || st.nameEn, phone: st.phone, item: c.name, mode: c.mode, since: e.startDate, days: c.validityDays, ...accessInfo(e) } : null; }).filter(Boolean);
    const eb = db.ebooks.filter((e) => e.kind === "premium").flatMap((e) => (e.buyers || []).map((ph) => { const end = ebookBuyerEnd(e, ph), g = db.quizGuests.find((x) => x.phone === ph);
      return { kind: "ebook", id: e.id, phone: ph, name: g ? g.name : "", item: e.title, since: (e.buyerSince || {})[ph] || "", days: e.validityDays || 0, until: end, lifetime: !end, expired: !!end && end < today(), daysLeft: end ? Math.round((new Date(end + "T00:00:00") - new Date(today() + "T00:00:00")) / 864e5) : null }; }));
    return send(res, 200, { today: today(), items: [...enr, ...eb] });
  }
  // মেয়াদ বাড়ানো: addDays (বর্তমান শেষ তারিখ বা আজ — যেটা পরে — থেকে), until (নির্দিষ্ট তারিখ), lifetime (আজীবন), reset (মডিউলের নিয়মে ফেরা)
  if (p === "/api/admin/access" && m === "POST") {
    const b = await readBody(req, 2000), until = /^\d{4}-\d{2}-\d{2}$/.test(str(b.until, 10)) ? str(b.until, 10) : "", plus = Math.max(0, Math.min(3650, Math.floor(num(b.addDays)) || 0));
    const pick = (cur) => b.lifetime ? null : until || (plus ? addDays(cur && cur > today() ? cur : today(), plus) : undefined);
    if (b.kind === "ebook") {
      const e = db.ebooks.find((x) => x.id === b.id), ph = phoneOf(b.phone);
      if (!e || !(e.buyers || []).includes(ph)) return send(res, 404, { error: "ক্রেতা পাওয়া যায়নি" });
      e.buyerUntil = { ...(e.buyerUntil || {}) };
      if (b.reset) delete e.buyerUntil[ph]; else { const v = pick(ebookBuyerEnd(e, ph)); if (v === undefined) return send(res, 400, { error: "কত দিন বা কোন তারিখ পর্যন্ত — বলে দিন" }); e.buyerUntil[ph] = v === null ? "life" : v; }
      saveDb(); return send(res, 200, { ok: true });
    }
    const e = db.enrollments.find((x) => x.id === b.id);
    if (!e) return send(res, 404, { error: "ভর্তি পাওয়া যায়নি" });
    if (b.reset) { delete e.accessUntil; delete e.accessLifetime; }
    else { const v = pick(accessEnd(e)); if (v === undefined) return send(res, 400, { error: "কত দিন বা কোন তারিখ পর্যন্ত — বলে দিন" }); if (v === null) { e.accessLifetime = true; delete e.accessUntil; } else { e.accessUntil = v; delete e.accessLifetime; } }
    e.updatedAt = new Date().toISOString(); saveDb();
    return send(res, 200, { ok: true, access: accessInfo(e) });
  }
  // ই-বুকের PDF তোলা / মোছা / দেখা
  const aem = p.match(/^\/api\/admin\/ebooks\/([\w-]+)\/pdf$/);
  if (aem) {
    const e = db.ebooks.find((x) => x.id === aem[1]);
    if (!e) return send(res, 404, { error: "ই-বুক পাওয়া যায়নি" });
    if (m === "GET") { if (!e.pdf || !fs.existsSync(ebookPdf(e))) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": "application/pdf", "Cache-Control": "private, no-store" }); return fs.createReadStream(ebookPdf(e)).pipe(res); }
    if (m === "DELETE") { dropFile(ebookPdf(e)); delete e.pdf; saveDb(); return send(res, 200, { ok: true, item: e }); }
    if (m === "POST") {
      if (!/pdf/i.test(String(req.headers["content-type"] || ""))) return send(res, 400, { error: "শুধু PDF ফাইল দিন" });
      let size; try { size = await saveUpload(req, ebookPdf(e), 80 * 1024 * 1024); } catch (er) { return send(res, 413, { error: er.message === "too large" ? "PDF অনেক বড় — ৮০ MB-এর মধ্যে দিন" : "PDF জমা হয়নি" }); }
      e.pdf = { name: str(url.searchParams.get("name"), 200) || "ebook.pdf", size, v: Date.now() }; saveDb();
      return send(res, 200, { ok: true, item: e });
    }
  }
  // প্রশ্নোত্তর বক্স: উত্তর লেখা / ফাইল জোড়া / মোছা
  const aqm = p.match(/^\/api\/admin\/qna\/([\w-]+)(?:\/(q-image|q-audio|a-image|a-audio|a-video))?$/);
  if (aqm) {
    const q = db.qna.find((x) => x.id === aqm[1]), kind = aqm[2];
    if (!q) return send(res, 404, { error: "প্রশ্নটা পাওয়া যায়নি" });
    const hasAns = () => !!(q.answer || q.yt || ["a-image", "a-audio", "a-video"].some((k) => q.files && q.files[k]));
    const mark = () => { if (hasAns()) { if (q.status !== "answered") q.answeredAt = new Date().toISOString(); q.status = "answered"; } else { q.status = "new"; delete q.answeredAt; } };
    if (kind && m === "GET") return qnaSendFile(req, res, q, kind);
    if (kind && m === "POST") {
      if (!kind.startsWith("a-")) return send(res, 400, { error: "শুধু উত্তরের ফাইল জোড়া যায়" });
      try { await qnaSaveFile(req, q, kind); } catch (e) { return send(res, e.code || 500, { error: e.message }); }
      mark(); saveDb(); return send(res, 200, { ok: true, item: q });
    }
    if (kind && m === "DELETE") { dropFile(qnaFile(q, kind)); if (q.files) delete q.files[kind]; mark(); saveDb(); return send(res, 200, { ok: true, item: q }); }
    if (!kind && m === "POST") {
      const b = await readBody(req, 50000);
      q.answer = str(b.answer, 6000); q.yt = ytId(b.yt); q.public = b.public !== false; q.answeredBy = str(b.answeredBy, 80);
      if (typeof b.text === "string") q.text = str(b.text, 3000); // বানান ঠিক করে প্রশ্ন সাজিয়ে দেওয়া যায়
      mark(); saveDb(); return send(res, 200, { ok: true, item: q });
    }
    if (!kind && m === "DELETE") { Object.keys(q.files || {}).forEach((k) => dropFile(qnaFile(q, k))); db.qna = db.qna.filter((x) => x !== q); saveDb(); return send(res, 200, { ok: true }); }
  }

  if (p === "/api/admin/db" && m === "GET") {
    const students = db.students.map((s) => ({ ...s, fees: feeSummary(s) }));
    return send(res, 200, { ...db, batches: [...db.batches].sort(compareBatchSchedule), students, bookMeta: { geo: BD_GEO, ship: bookShip(), methods: BOOK_METHODS, status: BOOK_STATUS } });
  }
  // সেটআপ পাতা থেকে PIN / ইমেইল / পাসওয়ার্ড বদলানো — বর্তমান পাসওয়ার্ড লাগবে; ফাঁকা ঘর আগের মতো থাকে
  if (p === "/api/admin/creds" && m === "GET") return send(res, 200, { email: auth ? auth.email || "" : "" });
  if (p === "/api/admin/password" && m === "POST") {
    const b = await readBody(req);
    if (!checkPassword(str(b.current, 200))) return send(res, 400, { error: "বর্তমান পাসওয়ার্ড ভুল" });
    const pin = enDigits(str(b.pin, 10)), email = normEmail(b.email), password = str(b.next, 200);
    if (pin && !validPin(pin)) return send(res, 400, { error: "নতুন PIN ঠিক ৬ সংখ্যার হতে হবে" });
    if (email && !validEmail(email)) return send(res, 400, { error: "সঠিক ইমেইল দিন" });
    if (password && password.length < 8) return send(res, 400, { error: "নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষর" });
    if (!pin && !password && (!email || email === auth.email)) return send(res, 400, { error: "কিছুই বদলানো হয়নি" });
    setCreds({ pin, email, password });
    newLogin(res, "admin"); // যিনি বদলালেন তিনি লগইন থাকবেন
    return send(res, 200, { ok: true });
  }
  // পেমেন্ট গেটওয়ে (SSLCommerz) — পাসওয়ার্ড কখনো ফেরত পাঠানো হয় না, শুধু "দেওয়া আছে কিনা"
  // SMS সার্ভিস (BulkSMSBD) — API key, Sender ID, চালু / বন্ধ; পরীক্ষার SMS; ব্যালেন্স
  if (p === "/api/admin/sms-config") {
    if (m === "POST") {
      const b = await readBody(req, 5000);
      smsCfg = { apiKey: b.apiKey ? str(b.apiKey, 200) : smsCfg.apiKey, senderId: str(b.senderId, 40), enabled: !!b.enabled };
      writeJsonAtomic(SMS_FILE, smsCfg);
    }
    return send(res, 200, { senderId: smsCfg.senderId, hasKey: !!smsCfg.apiKey, enabled: smsCfg.enabled, live: smsOn() });
  }
  if (p === "/api/admin/sms-test" && m === "POST") {
    const b = await readBody(req, 2000), phone = phoneOf(b.phone);
    if (!/^01\d{9}$/.test(phone)) return send(res, 400, { error: "সঠিক মোবাইল নম্বর দিন" });
    try { await sendSms(phone, `Test SMS from ${smsBrand()} - SMS service is working.`); saveDb(); return send(res, 200, { ok: true }); }
    catch (e) { saveDb(); return send(res, 400, { error: e.message }); }
  }
  if (p === "/api/admin/sms-balance" && m === "GET") {
    if (!smsCfg.apiKey) return send(res, 400, { error: "আগে API key দিন" });
    try {
      const r = await fetch(`${SMS_BASE}/getBalanceApi?api_key=${encodeURIComponent(smsCfg.apiKey)}`, { signal: AbortSignal.timeout(15000) });
      const j = await r.json().catch(() => ({}));
      if (j.balance === undefined) return send(res, 400, { error: SMS_CODES[Number(j.response_code)] || j.error_message || "ব্যালেন্স জানা যায়নি" });
      return send(res, 200, { balance: j.balance });
    } catch { return send(res, 502, { error: "BulkSMSBD-তে পৌঁছানো যায়নি" }); }
  }
  if (p === "/api/admin/payment-config") {
    if (m === "POST") {
      const b = await readBody(req, 5000);
      payCfg = { sslStoreId: str(b.sslStoreId, 80), sslStorePass: b.sslStorePass ? str(b.sslStorePass, 120) : payCfg.sslStorePass, sslSandbox: b.sslSandbox !== false, sslEnabled: !!b.sslEnabled };
      writeJsonAtomic(PAY_FILE, payCfg);
    }
    return send(res, 200, { sslStoreId: payCfg.sslStoreId, hasPass: !!payCfg.sslStorePass, sslSandbox: payCfg.sslSandbox, sslEnabled: payCfg.sslEnabled, live: gatewayOn() });
  }
  const mlm = p.match(/^\/api\/admin\/courses\/([\w-]+)\/lessons$/);
  if (mlm && m === "POST") {
    const c = db.courses.find((x) => x.id === mlm[1]);
    if (!c) return send(res, 404, { error: "মডিউল পাওয়া যায়নি" });
    const b = await readBody(req, 500000);
    const prev = new Map((c.lessons || []).map((l) => [l.id, l]));
    const lessons = (Array.isArray(b.lessons) ? b.lessons : []).slice(0, 500).map((l) => ({
      id: str(l && l.id, 40) || uid("les"), title: str(l && l.title, 200), source: l && l.source === "file" ? "file" : "youtube", yt: youtubeId((l && l.ytUrl) || "") || str(l && l.yt, 11),
      chapter: str(l && l.chapter, 10), // অধ্যায়ভিত্তিক মডিউলে কোন অধ্যায়ের ক্লাস (ফাঁকা = সবাই দেখে)
    })).filter((l) => l.title);
    lessons.forEach((l) => { const o = prev.get(l.id); if (o && o.file) l.file = o.file; });
    for (const o of c.lessons || []) if (!lessons.some((l) => l.id === o.id)) dropFile(videoPath(modLessonKey(c, o), o.file));
    c.lessons = lessons;
    saveDb();
    return send(res, 200, { ok: true, lessons });
  }
  // অনলাইন আবেদনের পেমেন্টের অবস্থা হাতে বদলানো (TrxID মিলিয়ে নিশ্চিত / বাতিল)
  const opm = p.match(/^\/api\/admin\/online-apps\/([\w-]+)\/pay$/);
  if (opm && m === "POST") {
    const a = db.onlineApps.find((x) => x.id === opm[1]);
    if (!a) return send(res, 404, { error: "আবেদন পাওয়া যায়নি" });
    const b = await readBody(req, 5000), st = str(b.status, 20);
    if (!["unpaid", "verifying", "paid", "rejected"].includes(st)) return send(res, 400, { error: "পেমেন্টের অবস্থা ঠিক নেই" });
    if (st === "unpaid") delete a.pay;
    else a.pay = { method: "bank", amount: a.fee, ...(a.pay || {}), status: st, ...(st === "paid" ? { paidAt: (a.pay && a.pay.paidAt) || new Date().toISOString() } : {}) };
    saveDb();
    return send(res, 200, { ok: true, item: a });
  }
  if (p === "/api/admin/settings" && m === "POST") {
    const b = await readBody(req);
    for (const k of SETTINGS_KEYS) if (k in b) db.settings[k] = str(b[k], 1000);
    saveDb();
    return send(res, 200, { ok: true, settings: db.settings });
  }
  // ব্যাচ ভিত্তিক পেমেন্ট: একসাথে অনেকজনের পেমেন্ট — সব ঠিক থাকলে তবেই সেভ (একটাও ভুল থাকলে কিছুই না)
  if (p === "/api/admin/payments/batch" && m === "POST") {
    const b = await readBody(req);
    const rows = (Array.isArray(b.items) ? b.items : []).slice(0, 300).map(CLEAN.payments);
    if (!rows.length) return send(res, 400, { error: "কাউকে বেছে নেওয়া হয়নি" });
    for (const r of rows) {
      const s = db.students.find((x) => x.id === r.studentId);
      if (!s) return send(res, 400, { error: `শিক্ষার্থী পাওয়া যায়নি: ${r.studentId}` });
      if (r.amount <= 0) return send(res, 400, { error: `${s.name} — টাকার পরিমাণ দিন` });
      if (r.enrollmentId && !db.enrollments.some((e) => e.id === r.enrollmentId && e.studentId === s.id)) return send(res, 400, { error: `${s.name} — মডিউল মেলেনি` });
    }
    const now = new Date().toISOString();
    const items = rows.map((r) => {
      const item = { id: uid("pay"), ...r, createdAt: now, receiptNo: nextReceiptNo() };
      db.payments.push(item);
      return item;
    });
    saveDb();
    return send(res, 200, { ok: true, items });
  }
  if (p === "/api/admin/attendance" && m === "POST") {
    const b = await readBody(req);
    const date = str(b.date, 10), batchId = str(b.batchId, 60);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !db.batches.some((x) => x.id === batchId)) return send(res, 400, { error: "তারিখ ও ব্যাচ দিন" });
    const marks = {};
    for (const [sid, st] of Object.entries(b.marks || {})) if (["P", "A", "L"].includes(st)) marks[str(sid, 40)] = st;
    const key = `${date}|${batchId}`;
    if (Object.keys(marks).length) db.attendance[key] = marks; else delete db.attendance[key];
    // হাজিরার সাথে দৈনিক বাড়ির কাজ / পড়ার টিক — "বাড়ির কাজ / পড়া" প্যানেলের রেকর্ডেই জমা হয়:
    // ওই দিনে (dueDate) ওই ব্যাচের কাজ থাকলে সেটাতে, না থাকলে টিক দিলে নিজে থেকে "দৈনিক …" তৈরি হয়।
    // উপস্থিত → করেছে / করেনি · অনুপস্থিত বা ছুটি → absent (হিসাবে ধরা হয় না)
    if (b.ticks && typeof b.ticks === "object") {
      const bt = db.batches.find((x) => x.id === batchId), studs = db.students.filter((s) => s.batchId === batchId);
      const tick = (sid, k) => !!(b.ticks[sid] && b.ticks[sid][k]);
      for (const [kind, k, title] of [["homework", "hw", "দৈনিক বাড়ির কাজ"], ["lesson", "lesson", "দৈনিক পড়া"]]) {
        const any = studs.some((s) => marks[s.id] === "P" && tick(s.id, k));
        let rec = db.homework.find((h) => h.kind === kind && h.session === bt.session && h.dueDate === date && (!(h.batchIds || []).length || h.batchIds.includes(batchId)));
        if (!rec && !any) continue;
        if (rec && rec.auto && !any) { db.homework = db.homework.filter((h) => h !== rec); continue; } // সব টিক তুলে দিলে নিজে তৈরি রেকর্ডটা মুছে যায়
        if (!rec) {
          rec = { id: uid("hom"), kind, title, details: "", subject: "", chapter: "", session: bt.session, batchIds: [batchId], givenDate: date, dueDate: date, auto: true, checks: {}, createdAt: new Date().toISOString() };
          db.homework.push(rec);
        }
        rec.checks ||= {};
        for (const s of studs) {
          const st = marks[s.id];
          if (st === "P") rec.checks[s.id] = tick(s.id, k) ? "done" : "not";
          else if (st) rec.checks[s.id] = "absent";
          else delete rec.checks[s.id];
        }
        rec.checkedAt = new Date().toISOString();
      }
    }
    saveDb();
    return send(res, 200, { ok: true });
  }
  // আইডি / মোবাইল আর PIN আবার SMS-এ
  if (p === "/api/admin/login-sms" && m === "POST") {
    const b = await readBody(req), learner = b.kind === "learner";
    const x = (learner ? db.learners : db.students).find((y) => y.id === str(b.id, 60));
    if (!x) return send(res, 404, { error: "শিক্ষার্থী পাওয়া যায়নি" });
    const r = await (learner ? smsLearnerLogin(x) : smsStudentLogin(x));
    saveDb();
    return r.ok ? send(res, 200, { ok: true, loginSms: r }) : send(res, 502, { error: r.error, loginSms: r });
  }
  if (p === "/api/admin/student-pin" && m === "POST") {
    const b = await readBody(req);
    const s = db.students.find((x) => x.id === str(b.id, 40));
    if (!s) return send(res, 404, { error: "শিক্ষার্থী পাওয়া যায়নি" });
    s.pin = newPin();
    delete s.loginSms; // আগের SMS-এর PIN আর চলে না
    saveDb();
    return send(res, 200, { ok: true, pin: s.pin });
  }
  // নতুন সেশন খোলা: HSC-29 + ৭টা ব্যাচ (29-A … 29-G)
  if (p === "/api/admin/session-open" && m === "POST") {
    const b = await readBody(req);
    const name = CLEAN.sessions(b).name;
    if (!/^[A-Z]+-\d{2}$/.test(name)) return send(res, 400, { error: "সেশনের নাম এভাবে লিখুন: HSC-29" });
    if (db.sessions.some((s) => s.name === name)) return send(res, 400, { error: "এই সেশন আগেই আছে" });
    db.sessions.push({ id: name, name, note: str(b.note, 60), active: true });
    const count = Math.min(Math.max(0, num(b.batches) || 7), 15);
    const made = makeBatches(name).slice(0, Math.min(count, 7));
    for (let i = 7; i < count; i++) made.push({ id: uid("bat"), session: name, name: `${name.slice(-2)}-${String.fromCharCode(65 + i)}`, days: "", time: "", capacity: 15 });
    for (const bt of made) if (!db.batches.some((x) => x.id === bt.id)) db.batches.push(bt); else db.batches.push({ ...bt, id: uid("bat") });
    saveDb();
    return send(res, 200, { ok: true });
  }
  if (p === "/api/admin/backup" && m === "GET") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="shahins-ict-care-backup-${today()}.json"`,
    });
    return res.end(JSON.stringify(db, null, 2));
  }
  if (p === "/api/admin/restore" && m === "POST") {
    const b = await readBody(req);
    if (!b || !Array.isArray(b.students) || !b.settings) return send(res, 400, { error: "সঠিক ব্যাকআপ ফাইল নয়" });
    if ((b.meta?.version || 1) < DB_VERSION) return send(res, 400, { error: "এটা পুরনো কাঠামোর ব্যাকআপ, এই সংস্করণে ফেরানো যাবে না" });
    fs.copyFileSync(DB_FILE, path.join(BACKUPS, `before-restore-${Date.now()}.json`));
    db = b;
    for (const c of COLLECTIONS) db[c] ||= [];
    db.attendance ||= {};
    db.quizGuests ||= [];
    saveDb();
    return send(res, 200, { ok: true });
  }
  if (p === "/api/admin/clear-sample" && m === "POST") {
    fs.copyFileSync(DB_FILE, path.join(BACKUPS, `before-clear-${Date.now()}.json`));
    db.students.forEach((s) => removePhoto("s", s.id));
    db.applications.forEach((a) => removePhoto("a", a.id));
    db.docs.forEach((d) => { if (d.file) try { fs.unlinkSync(docPath(d)); } catch {} });
    db.examRoutines.forEach((r) => { try { fs.unlinkSync(examRoutineFile(r)); } catch {} }); db.examRoutines = [];
    db.students = []; db.enrollments = []; db.payments = []; db.exams = []; db.docs = []; db.homework = []; db.quizzes = []; db.quizGuests = []; db.leads = []; db.smsLog = []; db.thRegs = []; db.learners = []; db.ocEnrolls = []; db.enquiries = []; db.applications = []; db.attendance = {}; db.absentSent = {}; db.monthlySent = {}; db.feeSent = {};
    saveDb();
    return send(res, 200, { ok: true });
  }

  // ছবি দেখা: /api/admin/photo/s/<studentId> বা /api/admin/photo/a/<applicationId>
  if (p === "/api/admin/student-photo-review" && m === "POST") return reviewStudentPhoto(req, res);
  const pm = p.match(/^\/api\/admin\/photo\/([sap])\/([\w-]+)$/);
  if (pm && m === "GET") return sendPhoto(res, pm[1], pm[2]);
  if (p === "/api/admin/student-photo" && m === "POST") {
    const b = await readBody(req, 1024 * 1024);
    const s = db.students.find((x) => x.id === str(b.id, 40));
    if (!s) return send(res, 404, { error: "শিক্ষার্থী পাওয়া যায়নি" });
    if (b.remove) { removePhoto("s", s.id); s.photo = false; }
    else if (!savePhoto(b.photo, "s", s.id)) return send(res, 400, { error: "ছবিটি ঠিক নেই (JPG/PNG, ৪০০KB-এর কম)" });
    else s.photo = true;
    saveDb();
    return send(res, 200, { ok: true });
  }

  if (p === "/api/admin/admission-import" && m === "POST") return admissionImportAction(req, res);
  if (p === "/api/admin/gallery-delete" && m === "POST") return galleryDeleteAction(req, res);
  if (p === "/api/admin/enrollment-start" && m === "POST") return enrollmentStartAction(req, res);

  // ভর্তি (নতুন শিক্ষার্থী বা অনলাইন আবেদন থেকে): শিক্ষার্থী + মডিউলে ভর্তি + জমা
  if (p === "/api/admin/admit" && m === "POST") {
    const b = await readBody(req);
    const a = b.applicationId ? db.applications.find((x) => x.id === str(b.applicationId, 60)) : null;
    if (b.applicationId && !a) return send(res, 404, { error: "আবেদন পাওয়া যায়নি" });
    if (a && a.status === "approved" && db.students.some((s) => s.id === a.studentId)) return send(res, 400, { error: "এই আবেদন থেকে আগেই ভর্তি করা হয়েছে" });
    const st = CLEAN.students(b.student || {});
    if (!st.name) return send(res, 400, { error: "শিক্ষার্থীর নাম দিন" });
    if (!importValidDate(st.admissionDate) || st.admissionDate > today()) return send(res, 400, { error: "সঠিক ভর্তির তারিখ দিন" });
    const batch = db.batches.find((x) => x.id === st.batchId);
    if (!batch) return send(res, 400, { error: "ক্লাস ব্যাচ বেছে নিন" });
    if (batch.active === false) return send(res, 400, { error: `${batch.name} ব্যাচ নিষ্ক্রিয় — অন্য ব্যাচ বেছে নিন` });
    st.session = batch.session;
    const v = validateEnrollment(b.enrollment || {});
    if (v.error) return send(res, 400, { error: v.error });
    const s = { id: nextStudentId(st.session), serial: nextSerial(), status: "active", note: "", ...st, pin: newPin(), photo: false, createdAt: new Date().toISOString() };
    if (a) {
      s.appNo = a.appNo;
      if (a.photo && fs.existsSync(photoFile("a", a.id))) { fs.copyFileSync(photoFile("a", a.id), photoFile("s", s.id)); s.photo = true; }
    }
    db.students.push(s);
    rememberLists(s);
    const enr = createAdmissionEnrollment(s, v, b.enrollment.planEnd);
    const pay = createPayment(s.id, enr.id, b.payment);
    if (a) Object.assign(a, { status: "approved", studentId: s.id, batchId: s.batchId, updatedAt: new Date().toISOString() });
    if (b.enquiryId) { const en = db.enquiries.find((x) => x.id === str(b.enquiryId, 60)); if (en) en.status = "admitted"; }
    // সম্ভাব্য শিক্ষার্থী: যে লিড থেকে ভর্তি (বা একই মোবাইলের লিড) — অবস্থা "ভর্তি হয়েছে"
    const ld = db.leads.find((x) => x.id === str(b.leadId, 60)) || db.leads.find((x) => x.phone === s.phone);
    if (ld) Object.assign(ld, { status: "admitted", studentId: s.id, followUp: "", updatedAt: new Date().toISOString() });
    saveDb();
    await smsStudentLogin(s);
    saveDb();
    return send(res, 200, { ok: true, student: s, enrollment: enr, payment: pay });
  }
  // আগের শিক্ষার্থীকে আরেকটি মডিউলে ভর্তি
  if (p === "/api/admin/enroll" && m === "POST") {
    const b = await readBody(req);
    const s = db.students.find((x) => x.id === str(b.studentId, 40));
    if (!s) return send(res, 404, { error: "শিক্ষার্থী পাওয়া যায়নি" });
    const v = validateEnrollment(b.enrollment || {});
    if (v.error) return send(res, 400, { error: v.error });
    if (v.course.feeType !== "chapter" && db.enrollments.some((e) => e.studentId === s.id && e.courseId === v.course.id && e.status === "active")) return send(res, 400, { error: "এই মডিউলে আগেই ভর্তি আছে" });
    const enr = createEnrollment(s.id, v, str(b.enrollment.startDate, 10) || today(), b.enrollment.planEnd);
    const pay = createPayment(s.id, enr.id, b.payment, `${v.course.name} — ভর্তির সময় জমা`);
    saveDb();
    return send(res, 200, { ok: true, enrollment: enr, payment: pay });
  }

  // পরীক্ষার নম্বর সেভ — একটা বারের (attempt) কয়েকজনের নম্বর একসাথে; বাকিদের নম্বর যেমন ছিল তেমন থাকে
  if (p === "/api/admin/exam-marks" && m === "POST") {
    const b = await readBody(req);
    const ex = db.exams.find((e) => e.id === str(b.examId, 60));
    if (!ex) return send(res, 404, { error: "পরীক্ষা পাওয়া যায়নি" });
    const a = Math.floor(num(b.attempt));
    if (a < 0 || a >= EC.attemptsOf(ex)) return send(res, 400, { error: "কোন বারের নম্বর — ঠিক নেই" });
    const ps = EC.parts(ex), marks = JSON.parse(JSON.stringify(ex.marks || {}));
    // প্রকাশিত ব্যাচের নম্বর লক — বদলাতে "সংশোধন" (কারণসহ) লাগে, ইতিহাসে থাকে
    const reason = str(b.reason, 200), corrected = new Set();
    for (const [sid, cell] of Object.entries(b.marks && typeof b.marks === "object" ? b.marks : {})) {
      if (!(ex.studentIds || []).includes(sid)) continue;
      const st = db.students.find((x) => x.id === sid);
      // একই নিয়মে পরিষ্কার করে তুলনা — নম্বর আসলেই বদলেছে কি না
      const norm = (c) => { const arr = []; arr[a] = c; return JSON.stringify((cleanMarks(ex, { [sid]: arr })[sid] || [])[a] || null); };
      if (isPublishedFor(ex, st) && norm(((ex.marks || {})[sid] || [])[a] || null) !== norm(cell)) {
        if (!b.correction) return send(res, 400, { error: `${sid}-এর ফলাফল প্রকাশিত — নম্বর বদলাতে "সংশোধন" চালু করুন` });
        if (reason.length < 3) return send(res, 400, { error: "সংশোধনের কারণ লিখুন" });
        corrected.add(sid);
      }
      if (!(cell && cell._absent)) for (const p of ps) { const v = EC.num(cell && cell[p.key]); if (v !== null && ((v < 0 && !EC.allowsNegative(ex)) || v > p.full)) return send(res, 400, { error: `${sid}: ${p.subject} ${p.part.toUpperCase()}-এ ${EC.allowsNegative(ex) ? "সর্বোচ্চ " + p.full : "০ থেকে " + p.full + " এর মধ্যে"} নম্বর দিন` }); }
      const arr = marks[sid] || [];
      arr[a] = cell;
      marks[sid] = arr;
    }
    ex.marks = cleanMarks(ex, marks);
    ex.updatedAt = new Date().toISOString();
    if (corrected.size) db.resultLog.push({ id: uid("log"), at: ex.updatedAt, action: "correct", examId: ex.id, attempt: a, studentIds: [...corrected], batchIds: [...new Set([...corrected].map((id) => (db.students.find((x) => x.id === id) || {}).batchId))], note: reason });
    saveDb();
    return send(res, 200, { ok: true, item: ex });
  }
  // বাড়ির কাজ / পড়া যাচাই: প্রত্যেকের অবস্থা — done (করেছে / পেরেছে) · not (করেনি / পারেনি) · absent (অনুপস্থিত, হিসাবে ধরা হয় না) · "" (মুছে ফেলা)
  if (p === "/api/admin/homework-check" && m === "POST") {
    const b = await readBody(req);
    const hw = db.homework.find((h) => h.id === str(b.id, 60));
    if (!hw) return send(res, 404, { error: "কাজটি পাওয়া যায়নি" });
    hw.checks ||= {};
    for (const [sid, v] of Object.entries(b.checks && typeof b.checks === "object" ? b.checks : {})) {
      if (!db.students.some((s) => s.id === sid)) continue;
      if (["done", "not", "absent"].includes(v)) hw.checks[sid] = v; else delete hw.checks[sid];
    }
    hw.checkedAt = new Date().toISOString();
    saveDb();
    return send(res, 200, { ok: true, item: hw });
  }
  // ফলাফল প্রকাশ / প্রত্যাহার — পুরো পরীক্ষা (সব ব্যাচ) বা নির্দিষ্ট ব্যাচ; প্রত্যাহার করলেও নম্বর মুছে না, ইতিহাস থাকে
  if (p === "/api/admin/results/publish" && m === "POST") {
    const b = await readBody(req);
    const ex = db.exams.find((e) => e.id === str(b.examId, 60));
    if (!ex) return send(res, 404, { error: "পরীক্ষা পাওয়া যায়নি" });
    // Weekly / Monthly / Model Test সব ব্যাচ একসাথে প্রকাশ / প্রত্যাহার
    const all = examBatchIds(ex), want = !EC.ALL_BATCH_TYPES.includes(ex.type) && Array.isArray(b.batchIds) && b.batchIds.length ? b.batchIds.map((x) => str(x, 60)).filter((x) => all.includes(x)) : all;
    if (!want.length) return send(res, 400, { error: "এই পরীক্ষায় কোনো ব্যাচ নেই" });
    const publish = b.action !== "unpublish";
    ex.published ||= {};
    const was = want.some((id) => db.resultLog.some((l) => l.examId === ex.id && l.action === "unpublish" && (l.batchIds || []).includes(id)));
    const at = new Date().toISOString();
    for (const id of want) { if (publish) ex.published[id] = { at }; else delete ex.published[id]; }
    db.resultLog.push({ id: uid("log"), at, action: publish ? (was ? "republish" : "publish") : "unpublish", examId: ex.id, batchIds: want, note: str(b.note, 200) });
    syncResultNotice(ex);
    saveDb();
    return send(res, 200, { ok: true, item: ex });
  }
  // ব্যাচের ফলাফল SMS: আগে তালিকা (plan), তারপর একজন একজন করে; শুধু প্রকাশিত ব্যাচের, শিক্ষার্থী ও অভিভাবক দুই নম্বরে
  if (p === "/api/admin/results/sms-plan" && m === "POST") {
    const b = await readBody(req), ex = db.exams.find((e) => e.id === str(b.examId, 60)), batchId = str(b.batchId, 60);
    if (!ex) return send(res, 404, { error: "পরীক্ষা পাওয়া যায়নি" });
    if (!(ex.published || {})[batchId]) return send(res, 400, { error: "আগে এই ব্যাচের ফলাফল Publish করুন" });
    if (!smsOn()) return send(res, 400, { error: "SMS সার্ভিস চালু নেই" });
    const out = { todo: [], numbers: 0, got: 0, pending: 0, noPhone: 0, off: 0 };
    for (const s of db.students.filter((x) => x.batchId === batchId && ((ex.studentIds || []).includes(x.id) || (ex.marks || {})[x.id]))) {
      if (s.status === "inactive") { out.off++; continue; }
      const r = resultSmsOf(ex, s);
      if (!r) { out.pending++; continue; }
      if (((ex.resultSms || {})[s.id] || {}).key === r.key) { out.got++; continue; }
      const ph = resultPhones(s);
      if (!ph.length) { out.noPhone++; continue; }
      out.todo.push({ id: s.id, name: s.name }); out.numbers += ph.length;
    }
    return send(res, 200, { ok: true, ...out });
  }
  if (p === "/api/admin/results/sms" && m === "POST") {
    const b = await readBody(req), ex = db.exams.find((e) => e.id === str(b.examId, 60)), s = db.students.find((x) => x.id === str(b.studentId, 40));
    if (!ex || !s) return send(res, 404, { error: "পাওয়া যায়নি" });
    if (!isPublishedFor(ex, s)) return send(res, 400, { error: "আগে এই ব্যাচের ফলাফল Publish করুন" });
    const r = resultSmsOf(ex, s);
    if (!r) return send(res, 400, { error: "নম্বর এখনো দেওয়া হয়নি" });
    let sent = 0, err = "";
    for (const phone of resultPhones(s)) {
      try { await sendSms(phone, r.text, `ফলাফল — ${s.id}, ${ex.title}`, "Result"); sent++; }
      catch (e) { err = e.message; }
    }
    if (sent) { ex.resultSms ||= {}; ex.resultSms[s.id] = { key: r.key, at: new Date().toISOString() }; }
    saveDb();
    return sent ? send(res, 200, { ok: true, sent, error: err }) : send(res, 502, { error: err || "মোবাইল নম্বর নেই" });
  }
  // SMS প্যানেল: আগে তালিকা (কে পাবে, কোন নম্বরে, ঠিক কী লেখা — নয়তো কেন বাদ), তারপর একজন একজন করে পাঠানো
  if (p === "/api/admin/sms/plan" && m === "POST") {
    const b = await readBody(req), ids = (Array.isArray(b.ids) ? b.ids : []).slice(0, 3000).map((x) => str(x, 40));
    const rows = [], notFound = [];
    for (const id of [...new Set(ids)]) {
      const s = db.students.find((x) => x.id === id);
      if (!s) { notFound.push(id); continue; }
      rows.push({ id: s.id, name: s.name, batchId: s.batchId, off: s.status === "inactive", ...smsPanelItem(b, s) });
    }
    return send(res, 200, { ok: true, live: smsOn(), rows, notFound });
  }
  if (p === "/api/admin/sms/send" && m === "POST") {
    const b = await readBody(req), s = db.students.find((x) => x.id === str(b.id, 40));
    if (!s) return send(res, 404, { error: "শিক্ষার্থী পাওয়া যায়নি" });
    if (!smsOn()) return send(res, 400, { error: "SMS সার্ভিস চালু নেই — সেটআপ → সেটিংস থেকে চালু করুন" });
    const it = smsPanelItem({ ...b, skipGot: false }, s);
    if (it.skip) return send(res, 400, { error: it.skip });
    const ex = b.mode === "result" && db.exams.find((e) => e.id === str(b.examId, 60));
    let sent = 0, err = "";
    for (const phone of it.phones) {
      try { await sendSms(phone, it.text, ex ? `ফলাফল — ${s.id} (${phone}), ${ex.title}` : `বার্তা — ${s.id} (${phone}): ${it.text.slice(0, 120)}`, ex ? "Result" : "Panel"); sent++; }
      catch (e) { err = e.message; }
    }
    if (sent && ex) { ex.resultSms ||= {}; ex.resultSms[s.id] = { key: resultSmsOf(ex, s).key, at: new Date().toISOString() }; }
    saveDb();
    return sent ? send(res, 200, { ok: true, sent, of: it.phones.length, error: err }) : send(res, 502, { error: err });
  }
  // ---- বই ও শিট ----
  // স্টক যোগ (ছাপা / কেনা এল) বা ঠিক করা (হারানো, নষ্ট: বিয়োগ)
  if (p === "/api/admin/books/stock" && m === "POST") {
    const b = await readBody(req), bk = bookById(str(b.bookId, 60)), qty = Math.trunc(num(b.qty));
    if (!bk) return send(res, 404, { error: "বই / শিট পাওয়া যায়নি" });
    if (!qty) return send(res, 400, { error: "কয়টা — পরিমাণ দিন" });
    if (num(bk.stock) + qty < 0) return send(res, 400, { error: `স্টকে আছে ${num(bk.stock)}টি — এর বেশি কমানো যাবে না` });
    bk.stock = num(bk.stock) + qty;
    const mv = { id: uid("bmv"), bookId: bk.id, qty, cost: Math.max(0, Math.round(num(b.cost))), note: str(b.note, 200), date: /^\d{4}-\d{2}-\d{2}$/.test(str(b.date, 10)) ? str(b.date, 10) : today(), createdAt: new Date().toISOString() };
    db.bookMoves.push(mv); saveDb();
    return send(res, 200, { ok: true, item: bk, move: mv });
  }
  if (p === "/api/admin/books/sale" && m === "POST") {
    const r = makeSale(await readBody(req));
    if (r.error) return send(res, 400, { error: r.error });
    saveDb();
    return send(res, 200, { ok: true, item: r.sale });
  }
  const bsm = p.match(/^\/api\/admin\/books\/sales\/([\w-]+)(\/pay)?$/);
  if (bsm) {
    const sale = db.bookSales.find((x) => x.id === bsm[1]);
    if (!sale) return send(res, 404, { error: "বিক্রি পাওয়া যায়নি" });
    if (bsm[2] && m === "POST") { // বাকি টাকা জমা
      const b = await readBody(req), amount = Math.round(num(b.amount)), due = saleDue(sale);
      if (amount <= 0) return send(res, 400, { error: "টাকার পরিমাণ দিন" });
      if (amount > due) return send(res, 400, { error: `বাকি আছে ৳${due} — এর বেশি জমা নেওয়া যাবে না` });
      sale.payments.push({ id: uid("bpy"), date: /^\d{4}-\d{2}-\d{2}$/.test(str(b.date, 10)) ? str(b.date, 10) : today(), amount, method: BOOK_METHODS.includes(b.method) ? b.method : BOOK_METHODS[0] });
      saveDb();
      return send(res, 200, { ok: true, item: sale });
    }
    if (!bsm[2] && m === "DELETE") { // বিক্রি বাতিল: স্টক ফেরত; অনলাইন অর্ডারের হলে অর্ডার আবার "নতুন"
      dropSale(sale);
      const o = sale.orderId && db.bookOrders.find((x) => x.id === sale.orderId);
      if (o) { o.saleId = ""; if (o.status !== "cancelled") o.status = "new"; }
      saveDb();
      return send(res, 200, { ok: true });
    }
  }
  // অনলাইন অর্ডার: নিশ্চিত (বিক্রির খাতায় ওঠে, স্টক কমে, টাকা বাকি) → পাঠানো → পৌঁছেছে (টাকা পেয়ে গেছে) / বাতিল
  const bom = p.match(/^\/api\/admin\/books\/orders\/([\w-]+)$/);
  if (bom && m === "POST") {
    const o = db.bookOrders.find((x) => x.id === bom[1]), b = await readBody(req), act = str(b.action, 20);
    if (!o) return send(res, 404, { error: "অর্ডার পাওয়া যায়নি" });
    let sale = o.saleId && db.bookSales.find((x) => x.id === o.saleId);
    const ensureSale = () => {
      if (sale) return "";
      const r = makeSale({ buyerType: o.studentId ? "student" : "outside", studentId: o.studentId, name: o.name, phone: o.phone, address: o.pickup ? "অফিস থেকে নেবে" : [o.address, o.area, o.district, o.division].filter(Boolean).join(", "),
        items: o.lines.map((l) => ({ bookId: l.bookId, qty: l.qty, price: l.price })), delivery: o.delivery, discount: Math.round(num(b.discount)), method: "ক্যাশ অন ডেলিভারি", note: `অনলাইন অর্ডার #${o.orderNo}` }, { fields: { orderId: o.id } });
      if (r.error) return r.error;
      sale = r.sale; o.saleId = sale.id; return "";
    };
    if (act === "confirm" || act === "ship") { const e = ensureSale(); if (e) return send(res, 400, { error: e }); o.status = act === "ship" ? "shipped" : "confirmed"; }
    else if (act === "deliver") {
      const e = ensureSale(); if (e) return send(res, 400, { error: e });
      const due = saleDue(sale);
      if (due && b.paid !== false) sale.payments.push({ id: uid("bpy"), date: today(), amount: due, method: BOOK_METHODS.includes(b.method) ? b.method : "ক্যাশ অন ডেলিভারি" });
      o.status = "delivered";
    } else if (act === "cancel") {
      if (sale && salePaid(sale)) return send(res, 400, { error: "এই অর্ডারের টাকা জমা হয়ে গেছে — আগে বিক্রির খাতা থেকে হিসাব ঠিক করুন" });
      if (sale) { dropSale(sale); o.saleId = ""; }
      o.status = "cancelled";
    } else if (act === "reopen") o.status = o.saleId ? "confirmed" : "new";
    else return send(res, 400, { error: "কী করবেন বোঝা যায়নি" });
    if (str(b.adminNote, 300)) o.adminNote = str(b.adminNote, 300);
    o.updatedAt = new Date().toISOString();
    saveDb();
    return send(res, 200, { ok: true, item: o });
  }
  if (p === "/api/admin/books/settings" && m === "POST") {
    const b = await readBody(req), div = BD_GEO[str(b.homeDiv, 30)] ? str(b.homeDiv, 30) : "ঢাকা";
    db.settings.bookShip = { homeDiv: div, home: BD_GEO[div].includes(str(b.home, 40)) ? str(b.home, 40) : BD_GEO[div][0], inside: Math.max(0, Math.round(num(b.inside))), outside: Math.max(0, Math.round(num(b.outside))), pickup: b.pickup !== false, note: str(b.note, 300) };
    saveDb();
    return send(res, 200, { ok: true, ship: bookShip() });
  }
  // Class Performance (Overall)-এর ভাগ: পরীক্ষা : হাজিরা : বাড়ির কাজ : পড়া (শুরুতে ৪০:২০:২০:২০)
  if (p === "/api/admin/results/perf-weights" && m === "POST") {
    const b = await readBody(req), w = {};
    for (const k of ["exam", "att", "hw", "lesson"]) w[k] = Math.max(0, Math.min(100, num(b[k])));
    if (!Object.values(w).some((x) => x > 0)) return send(res, 400, { error: "অন্তত একটা অংশের ভাগ ০-এর বেশি দিন" });
    w.minDays = Math.max(0, Math.min(60, Math.floor(num(b.minDays))));
    db.settings.perfWeights = w;
    saveDb();
    return send(res, 200, { ok: true, weights: w });
  }
  // Combined Merit-এ চার ধরনের পরীক্ষার ভার (গুরুত্ব)
  if (p === "/api/admin/results/weights" && m === "POST") {
    const b = await readBody(req), w = {};
    for (const [k] of EC.TYPES) w[k] = Math.max(0, Math.min(100, num(b[k])));
    if (!Object.values(w).some((x) => x > 0)) return send(res, 400, { error: "অন্তত একটা ধরনের ভার ০-এর বেশি দিন" });
    db.settings.meritWeights = w;
    saveDb();
    return send(res, 200, { ok: true, weights: w });
  }
  // ডকুমেন্ট ফাইল আপলোড (প্রশ্ন / উত্তরপত্র / দেখা খাতা) — ?meta={examId, category, studentId, attempt, title, note, fileName}
  if (p === "/api/admin/docs/upload" && m === "POST") {
    let meta = {};
    try { meta = JSON.parse(url.searchParams.get("meta") || "{}"); } catch {}
    const fileName = str(meta.fileName, 150).replace(/[\\/:*?"<>|]/g, "_"), ext = path.extname(fileName).toLowerCase();
    if (!DOC_TYPES[ext]) return send(res, 400, { error: "এই ধরনের ফাইল রাখা যায় না — PDF, ছবি, Word, PowerPoint, Excel, MP4 বা MP3 দিন" });
    const base = CLEAN.docs({ ...meta, url: "" });
    if (!db.exams.some((e) => e.id === base.examId)) return send(res, 400, { error: "কোন পরীক্ষার ডকুমেন্ট — বেছে নিন" });
    if (base.category === "script" && !base.studentId) return send(res, 400, { error: "কোন শিক্ষার্থীর খাতা — বেছে নিন" });
    let buf;
    try { buf = await readRaw(req, 60 * 1024 * 1024); } catch { return send(res, 413, { error: "ফাইল অনেক বড় — ৬০ MB-এর মধ্যে দিন" }); }
    if (!buf.length) return send(res, 400, { error: "ফাইল খালি" });
    const d = { id: uid("doc"), ...base, title: base.title || fileName.replace(/\.[^.]+$/, ""), kind: DOC_TYPES[ext][1], file: { name: fileName, size: buf.length }, createdAt: new Date().toISOString() };
    fs.writeFileSync(docPath(d), buf);
    db.docs.push(d);
    saveDb();
    return send(res, 200, { ok: true, item: d });
  }
  // ট্যালেন্ট হান্ট: অফলাইন ব্যাচের শিক্ষার্থীদের এক ক্লিকে রেজিস্ট্রেশন (আগে থেকে থাকলে বাদ)
  // শিক্ষার্থীর পড়া বন্ধ রাখা / আবার চালু — কবে থেকে, কেন (ইতিহাস থাকে), বন্ধের মাসগুলোতে মাসিক ফি ধরা হয় না
  const spm = p.match(/^\/api\/admin\/students\/([\w-]+)\/(pause|resume)$/);
  if (spm && m === "POST") {
    const s = db.students.find((x) => x.id === spm[1]);
    if (!s) return send(res, 404, { error: "শিক্ষার্থী পাওয়া যায়নি" });
    const b = await readBody(req), d = /^\d{4}-\d{2}-\d{2}$/.test(str(b.date, 10)) ? str(b.date, 10) : today();
    s.pauses ||= [];
    const open = s.pauses.find((x) => !x.to) || s.pauses.find((x) => x.endPending); // খোলা বন্ধ, বা সামনের তারিখে চালু হওয়ার অপেক্ষায়
    if (spm[2] === "pause") {
      if (open || s.status === "inactive") return send(res, 400, { error: "এই শিক্ষার্থীর পড়া আগে থেকেই বন্ধ" });
      const later = d > today(); // সামনের তারিখ: ততদিন সক্রিয়, তারিখ এলে syncPauses বন্ধ করে
      s.pauses.push({ from: d, to: "", reason: str(b.reason, 300), ...(later ? { startPending: true } : {}) });
      if (!later) s.status = "inactive";
    } else {
      if (open && open.startPending && d <= open.from) s.pauses.splice(s.pauses.indexOf(open), 1); // বন্ধ শুরুর আগেই চালু = বন্ধ বাতিল
      else if (open) {
        if (d < open.from) return send(res, 400, { error: "চালুর তারিখ বন্ধের তারিখের আগে হতে পারে না" });
        open.to = d;
        if (d > today()) open.endPending = true; // সামনের তারিখে চালু: ততদিন বন্ধ থাকে
        else { delete open.endPending; s.status = "active"; }
        if (open.startPending && open.from <= today()) delete open.startPending;
      } else s.status = "active";
    }
    syncPauses();
    s.updatedAt = new Date().toISOString();
    saveDb();
    return send(res, 200, { ok: true, item: s });
  }
  const tem = p.match(/^\/api\/admin\/talent\/([\w-]+)\/(enroll|marks)$/);
  if (tem && m === "POST") {
    const h = huntById(tem[1]);
    if (!h) return send(res, 404, { error: "ট্যালেন্ট হান্টটি পাওয়া যায়নি" });
    const b = await readBody(req, 5 * 1024 * 1024);
    if (tem[2] === "enroll") {
      const ids = (Array.isArray(b.batchIds) ? b.batchIds : []).map((x) => str(x, 60));
      // মডিউল ধরে: courseIds-এর যেকোনোটায় চালু ভর্তি আছে এমন সবাই; allModules = যেকোনো মডিউলে ভর্তি সব শিক্ষার্থী
      const cids = (Array.isArray(b.courseIds) ? b.courseIds : []).map((x) => str(x, 60)), allMods = !!b.allModules;
      const modsOf = (sid) => db.enrollments.filter((e) => e.studentId === sid && e.status === "active" && (allMods || cids.includes(e.courseId)));
      const have = regsOf(h.id);
      let added = 0, skipped = 0;
      for (const s of db.students.filter((x) => x.status !== "inactive" && (ids.includes(x.batchId) || modsOf(x.id).length))) {
        if (have.some((r) => r.studentId === s.id || (s.phone && r.phone === s.phone))) { skipped++; continue; }
        const bt = db.batches.find((x) => x.id === s.batchId);
        const course = db.enrollments.filter((e) => e.studentId === s.id && e.status === "active").map((e) => (db.courses.find((c) => c.id === e.courseId) || {}).name).filter(Boolean).join(", ");
        have.push(addReg(h, { name: s.name, phone: s.phone || s.guardianPhone, klass: bt ? `${bt.session} · ${bt.name}` : s.session, college: s.college, course }, "batch", s.id)); // ব্যাচ বা মডিউল — দুটোই আমাদের শিক্ষার্থী
        added++;
      }
      saveDb();
      return send(res, 200, { ok: true, added, skipped });
    }
    // নম্বর: { regId: { বিষয়: নম্বর, … } } অথবা { regId: { _absent: true } } — পূর্ণমানের বেশি হয় না
    let saved = 0;
    for (const [rid, mk] of Object.entries(b.marks && typeof b.marks === "object" ? b.marks : {})) {
      const r = db.thRegs.find((x) => x.id === rid && x.huntId === h.id);
      if (!r || !mk || typeof mk !== "object") continue;
      if (mk._absent) { r.absent = true; r.marks = {}; saved++; continue; }
      const clean = {};
      for (const c of huntCols(h)) { const v = mk[c.key]; if (v === "" || v === null || v === undefined) continue; const n = Number(v); if (Number.isFinite(n)) clean[c.key] = Math.max(-1000, Math.min(c.full, Math.round(n * 100) / 100)); }
      r.absent = false; r.marks = clean; saved++;
    }
    h.marksAt = new Date().toISOString();
    saveDb();
    return send(res, 200, { ok: true, saved });
  }
  // সম্ভাব্য শিক্ষার্থী একসাথে আমদানি (Excel থেকে CSV) — একই মোবাইল আগে থাকলে নতুন রেকর্ড না করে আগেরটায় উৎস যোগ হয়
  if (p === "/api/admin/leads/import" && m === "POST") {
    const b = await readBody(req, 5 * 1024 * 1024);
    const rows = Array.isArray(b.rows) ? b.rows.slice(0, 5000) : [];
    const source = { ...(b.source || {}), at: new Date().toISOString() };
    let added = 0, merged = 0; const bad = [];
    rows.forEach((r, i) => {
      const res1 = r && str(r.name, 120) ? upsertLead(r, source, { remarks: str(r.remarks, 1000), smsConsent: b.smsConsent !== false }) : null;
      if (!res1) bad.push(i + 1); else if (res1.created) added++; else merged++;
    });
    saveDb();
    return send(res, 200, { ok: true, added, merged, bad });
  }
  // ভিডিও আপলোড: ফ্রি ক্লাস (?col=freeClasses&id=) বা কোর্সের ক্লাস (?col=onlineCourses&id=কোর্স&lesson=ক্লাস), ?ext=.mp4 — ২ GB পর্যন্ত
  if (p === "/api/admin/video" && m === "POST") {
    const col = url.searchParams.get("col"), ext = str(url.searchParams.get("ext"), 6).toLowerCase();
    if (!VIDEO_TYPES[ext]) return send(res, 400, { error: "ভিডিও দিন — MP4, WEBM, M4V বা MOV" });
    let target, key;
    if (col === "freeClasses") { target = db.freeClasses.find((x) => x.id === url.searchParams.get("id")); key = target && fcVideoKey(target); }
    else if (col === "onlineCourses") { const c = db.onlineCourses.find((x) => x.id === url.searchParams.get("id")); target = c && (c.lessons || []).find((l) => l.id === url.searchParams.get("lesson")); key = target && lessonKey(c, target); }
    else if (col === "courses") { const c = db.courses.find((x) => x.id === url.searchParams.get("id")); target = c && (c.lessons || []).find((l) => l.id === url.searchParams.get("lesson")); key = target && modLessonKey(c, target); }
    if (!target) return send(res, 404, { error: "আগে ক্লাসটা সংরক্ষণ করুন, তারপর ভিডিও দিন" });
    const file = videoPath(key, { ext });
    let size;
    try { size = await saveUpload(req, file, 2 * 1024 * 1024 * 1024); } catch { return send(res, 413, { error: "ভিডিও আপলোড হয়নি — ২ GB-এর মধ্যে দিন" }); }
    if (target.file && target.file.ext !== ext) dropFile(videoPath(key, target.file));
    target.file = { ext, size, v: Date.now() }; target.source = "file";
    saveDb();
    return send(res, 200, { ok: true, file: target.file });
  }
  // ব্যানার / সফল শিক্ষার্থীর ছবি আপলোড বা বদল: শরীরে সরাসরি ফাইল, ?ext=.jpg — ৮ MB পর্যন্ত
  const bum = p.match(/^\/api\/admin\/(banners|achievers|freeClasses|onlineCourses|gallery|courses|teachers|ebooks|books|daily)\/([\w-]+)\/image$/);
  if (bum && m === "POST") {
    const col = bum[1], b = db[col].find((x) => x.id === bum[2]);
    if (!b) return send(res, 404, { error: `${IMG_COLS[col].name} পাওয়া যায়নি` });
    const ext = str(url.searchParams.get("ext"), 6).toLowerCase();
    if (!IMG_TYPES[ext]) return send(res, 400, { error: "ছবি দিন — JPG, PNG, WEBP বা GIF" });
    let buf;
    try { buf = await readRaw(req, 8 * 1024 * 1024); } catch { return send(res, 413, { error: "ছবি অনেক বড় — ৮ MB-এর মধ্যে দিন" }); }
    if (buf.length < 100) return send(res, 400, { error: "ছবিটি ঠিক নেই" });
    dropImg(col, b);
    b.image = { ext, size: buf.length, v: Date.now() };
    fs.writeFileSync(imgFile(col, b), buf);
    if (col === "teachers") b.photo = `/api/tphoto/${b.id}/image?v=${b.image.v}`;
    saveDb();
    return send(res, 200, { ok: true, item: b });
  }
  // মেন্টরের ছবি আপলোড (শরীরে সরাসরি ফাইল, ?ext=.jpg — ৮ MB পর্যন্ত) / মুছে আগের ছবিতে ফেরা
  if (p === "/api/admin/mentor-photo" && (m === "POST" || m === "DELETE")) {
    const old = mentorFile();
    if (m === "DELETE") { if (old) try { fs.unlinkSync(old); } catch {} delete db.settings.mentorPhoto; saveDb(); return send(res, 200, { ok: true, url: "" }); }
    const ext = str(url.searchParams.get("ext"), 6).toLowerCase();
    if (!IMG_TYPES[ext]) return send(res, 400, { error: "ছবি দিন — JPG, PNG, WEBP বা GIF" });
    let buf;
    try { buf = await readRaw(req, 8 * 1024 * 1024); } catch { return send(res, 413, { error: "ছবি অনেক বড় — ৮ MB-এর মধ্যে দিন" }); }
    if (buf.length < 100) return send(res, 400, { error: "ছবিটি ঠিক নেই" });
    if (old) try { fs.unlinkSync(old); } catch {}
    db.settings.mentorPhoto = { ext, size: buf.length, v: Date.now() };
    fs.writeFileSync(mentorFile(), buf);
    saveDb();
    return send(res, 200, { ok: true, url: mentorUrl() });
  }
  // পরীক্ষার রুটিন PDF: আপলোড (?meta=…, ১৫ MB পর্যন্ত); মোছা /api/admin/c/examRoutines দিয়ে
  if (p === "/api/admin/exam-routines/upload" && m === "POST") {
    let meta = {};
    try { meta = JSON.parse(url.searchParams.get("meta") || "{}"); } catch {}
    let buf;
    try { buf = await readRaw(req, 15 * 1024 * 1024); } catch { return send(res, 413, { error: "PDF অনেক বড় — ১৫ MB-এর মধ্যে দিন" }); }
    if (buf.subarray(0, 5).toString() !== "%PDF-") return send(res, 400, { error: "শুধু PDF ফাইল দিন" });
    let name = path.basename(str(meta.fileName, 120)).replace(/[\\/:*?"<>|]/g, "") || "routine.pdf";
    if (!/\.pdf$/i.test(name)) name += ".pdf";
    const base = CLEAN.examRoutines(meta);
    const r = { id: uid("rtn"), ...base, title: base.title || name.replace(/\.pdf$/i, ""), pdf: { name, size: buf.length, v: Date.now() }, createdAt: new Date().toISOString() };
    fs.writeFileSync(examRoutineFile(r), buf);
    db.examRoutines.push(r);
    saveDb();
    return send(res, 200, { ok: true, item: r });
  }
  const erm = p.match(/^\/api\/admin\/exam-routines\/([\w-]+)\/pdf$/);
  if (erm && m === "GET") return sendExamRoutine(res, db.examRoutines.find((x) => x.id === erm[1]), url);
  // মডিউলের রুটিন PDF আপলোড (শরীরে সরাসরি ফাইল, ?name=routine.pdf — ১৫ MB পর্যন্ত) / DELETE-এ সরানো
  const cup = p.match(/^\/api\/admin\/courses\/([\w-]+)\/routine$/);
  if (cup && (m === "POST" || m === "DELETE")) {
    const c = db.courses.find((x) => x.id === cup[1]);
    if (!c) return send(res, 404, { error: "মডিউল পাওয়া যায়নি" });
    if (m === "DELETE") { try { fs.unlinkSync(routinePdf(c)); } catch {} delete c.routine; saveDb(); return send(res, 200, { ok: true, item: c }); }
    let buf;
    try { buf = await readRaw(req, 15 * 1024 * 1024); } catch { return send(res, 413, { error: "PDF অনেক বড় — ১৫ MB-এর মধ্যে দিন" }); }
    if (buf.subarray(0, 5).toString() !== "%PDF-") return send(res, 400, { error: "রুটিন হিসেবে শুধু PDF ফাইল দিন" });
    let name = path.basename(str(url.searchParams.get("name"), 120)).replace(/[\\/:*?"<>|]/g, "") || "routine.pdf";
    if (!/\.pdf$/i.test(name)) name += ".pdf";
    fs.writeFileSync(routinePdf(c), buf);
    c.routine = { name, size: buf.length, v: Date.now() };
    saveDb();
    return send(res, 200, { ok: true, item: c });
  }
  // নোটিশের সাথে PDF জোড়া (শরীরে সরাসরি ফাইল, ?name=routine.pdf — ১৫ MB পর্যন্ত) / DELETE-এ সরানো
  const nup = p.match(/^\/api\/admin\/notices\/([\w-]+)\/pdf$/);
  if (nup && (m === "POST" || m === "DELETE")) {
    const n = db.notices.find((x) => x.id === nup[1]);
    if (!n) return send(res, 404, { error: "নোটিশ পাওয়া যায়নি" });
    if (m === "DELETE") { try { fs.unlinkSync(noticePdf(n)); } catch {} delete n.pdf; saveDb(); return send(res, 200, { ok: true, item: n }); }
    let buf;
    try { buf = await readRaw(req, 15 * 1024 * 1024); } catch { return send(res, 413, { error: "PDF অনেক বড় — ১৫ MB-এর মধ্যে দিন" }); }
    if (buf.subarray(0, 5).toString() !== "%PDF-") return send(res, 400, { error: "শুধু PDF ফাইল দিন" });
    let name = path.basename(str(url.searchParams.get("name"), 120)).replace(/[\\/:*?"<>|]/g, "") || "notice.pdf";
    if (!/\.pdf$/i.test(name)) name += ".pdf";
    fs.writeFileSync(noticePdf(n), buf);
    n.pdf = { name, size: buf.length, v: Date.now() };
    saveDb();
    return send(res, 200, { ok: true, item: n });
  }
  const dm = p.match(/^\/api\/admin\/docs\/([\w-]+)\/file$/);
  if (dm && m === "GET") return sendDoc(req, res, db.docs.find((d) => d.id === dm[1]), url);

  // সাধারণ যোগ/বদল/মুছা: /api/admin/c/:collection[/:id]
  const cm = p.match(/^\/api\/admin\/c\/([a-zA-Z]+)(?:\/([\w-]+))?$/);
  if (cm && COLLECTIONS.includes(cm[1])) {
    const [, col, id] = cm;
    const list = db[col];
    if (m === "DELETE" && id) {
      const i = list.findIndex((x) => x.id === id);
      if (i < 0) return send(res, 404, { error: "পাওয়া যায়নি" });
      if (col === "batches" && db.students.some((s) => s.batchId === id)) return send(res, 400, { error: "এই ব্যাচে শিক্ষার্থী আছে, আগে তাদের অন্য ব্যাচে নিন" });
      if (col === "sessions" && db.batches.some((b) => b.session === list[i].name)) return send(res, 400, { error: "এই সেশনে ব্যাচ আছে, আগে ব্যাচগুলো মুছুন (অথবা সেশনটি বন্ধ করে দিন)" });
      if (col === "courses" && db.enrollments.some((e) => e.courseId === id)) return send(res, 400, { error: "এই মডিউলে শিক্ষার্থী ভর্তি আছে, মুছা যাবে না — চাইলে ওয়েবসাইট থেকে লুকিয়ে রাখুন" });
      if (col === "enrollments" && db.payments.some((x) => x.enrollmentId === id)) return send(res, 400, { error: "এই ভর্তিতে পেমেন্ট আছে — মুছে না দিয়ে \"শেষ\" করে দিন" });
      if (col === "books" && (db.bookSales.some((s) => s.lines.some((l) => l.bookId === id)) || db.bookOrders.some((o) => o.lines.some((l) => l.bookId === id)))) return send(res, 400, { error: "এই বই / শিট বিক্রি বা অর্ডার হয়েছে — মুছে না দিয়ে \"বন্ধ\" করে রাখুন (হিসাব থাকবে)" });
      if (col === "books") db.bookMoves = db.bookMoves.filter((x) => x.bookId !== id);
      const gone = list[i];
      list.splice(i, 1);
      if (col === "students") {
        removePhoto("s", id);
        db.enrollments = db.enrollments.filter((e) => e.studentId !== id);
        db.payments = db.payments.filter((x) => x.studentId !== id);
      }
      if (col === "applications") removePhoto("a", id);
      // ডকুমেন্ট মুছলে তার ফাইলও; পরীক্ষা মুছলে তার সব ডকুমেন্ট ও ফাইল
      const dropDoc = (d) => { if (d && d.file) try { fs.unlinkSync(docPath(d)); } catch {} };
      if (col === "docs") dropDoc(gone);
      if (col === "notices" && gone.pdf) try { fs.unlinkSync(noticePdf(gone)); } catch {}
      if (col === "examRoutines" && gone.pdf) try { fs.unlinkSync(examRoutineFile(gone)); } catch {}
      if (col === "ebooks" && gone.pdf) dropFile(ebookPdf(gone));
      if (col === "courses" && gone.routine) try { fs.unlinkSync(routinePdf(gone)); } catch {}
      if (col === "courses") (gone.lessons || []).forEach((l) => dropFile(videoPath(modLessonKey(gone, l), l.file)));
      if (IMG_COLS[col]) dropImg(col, gone);
      if (col === "talentHunts") db.thRegs = db.thRegs.filter((r) => r.huntId !== id); // ট্যালেন্ট হান্ট মুছলে তার রেজিস্ট্রেশনও
      if (col === "quizzes") syncQuizNotice(gone, true);
      if (col === "exams") syncResultNotice(gone, true);
      if (col === "freeClasses") dropFile(videoPath(fcVideoKey(gone), gone.file));
      if (col === "onlineCourses") { (gone.lessons || []).forEach((l) => dropFile(videoPath(lessonKey(gone, l), l.file))); db.ocEnrolls = db.ocEnrolls.filter((e) => e.courseId !== id); }
      if (col === "learners") db.ocEnrolls = db.ocEnrolls.filter((e) => e.learnerId !== id);
      if (col === "exams") { db.docs.filter((d) => d.examId === id).forEach(dropDoc); db.docs = db.docs.filter((d) => d.examId !== id); }
      saveDb();
      return send(res, 200, { ok: true });
    }
    if (m === "POST") {
      if (["applications", "enrollments", "onlineApps", "ratings"].includes(col) && !id) return send(res, 400, { error: "এটা ভর্তি ফর্ম থেকে তৈরি হয়" });
      if (col === "students" && !id) return send(res, 400, { error: "নতুন শিক্ষার্থী ভর্তি ফর্ম থেকে যোগ করুন" });
      const b = await readBody(req);
      let clean;
      try { clean = CLEAN[col](b); } catch (error) { return send(res, 400, { error: error.message }); }
      if (col === "students") {
        if (!clean.name) return send(res, 400, { error: "শিক্ষার্থীর নাম দিন" });
        if (!importValidDate(clean.admissionDate) || clean.admissionDate > today()) return send(res, 400, { error: "সঠিক ভর্তির তারিখ দিন" });
        const bt = db.batches.find((x) => x.id === clean.batchId);
        if (!bt) return send(res, 400, { error: "ক্লাস ব্যাচ বেছে নিন" });
        clean.session = bt.session; // ব্যাচ বদলালে সেশনও সেই অনুযায়ী
        rememberLists(clean);
      }
      if (col === "batches" && !activeSessions().concat(db.sessions.map((s) => s.name)).includes(clean.session)) return send(res, 400, { error: "সেশন বেছে নিন" });
      if (col === "sessions") {
        if (!/^[A-Z]+-\d{2}$/.test(clean.name)) return send(res, 400, { error: "সেশনের নাম এভাবে লিখুন: HSC-29" });
        if (db.sessions.some((s) => s.name === clean.name && s.id !== id)) return send(res, 400, { error: "এই সেশন আগেই আছে" });
        if (id) { const old = list.find((x) => x.id === id); if (old && old.name !== clean.name && db.batches.some((b) => b.session === old.name)) return send(res, 400, { error: "ব্যাচ থাকা অবস্থায় সেশনের নাম বদলানো যাবে না" }); }
      }
      if (col === "closures") {
        if (!clean.batchIds.length) return send(res, 400, { error: "অন্তত একটি ব্যাচ বেছে নিন" });
        if (!/^\d{4}-\d{2}-\d{2}$/.test(clean.from) || !/^\d{4}-\d{2}-\d{2}$/.test(clean.to)) return send(res, 400, { error: "কবে থেকে আর কবে পর্যন্ত — দুটো তারিখই দিন" });
        if (clean.to < clean.from) return send(res, 400, { error: "শেষ তারিখ শুরুর তারিখের আগে হতে পারে না" });
      }
      if (col === "exams") {
        if (!clean.title) return send(res, 400, { error: "পরীক্ষার নাম লিখুন" });
        if (EC.sameNameExam(db.exams, clean, id)) return send(res, 400, { error: `"${clean.title}" নামে এই সেশনে আগেই একটা পরীক্ষা আছে — অন্য নাম দিন` });
        if (!clean.subjects.length) return send(res, 400, { error: "কমপক্ষে একটি বিষয় আর তার পূর্ণমান দিন" });
        if (!clean.studentIds.length) return send(res, 400, { error: "কমপক্ষে একজন পরীক্ষার্থী নির্বাচন করুন" });
      }
      if (col === "quizzes") {
        if (!clean.title) return send(res, 400, { error: "কুইজের নাম লিখুন" });
        if (clean.session && !db.sessions.some((s) => s.name === clean.session)) return send(res, 400, { error: "সেশন বেছে নিন" });
        if (clean.live && !clean.questions.length) return send(res, 400, { error: "প্রশ্ন ছাড়া কুইজ চালু করা যাবে না" });
        if (clean.announce && !clean.opensAt) return send(res, 400, { error: "ঘোষণা দিতে হলে কুইজ কবে খুলবে — তারিখ ও সময় দিন" });
        if (clean.opensAt && clean.closesAt && clean.closesAt <= clean.opensAt) return send(res, 400, { error: "বন্ধের সময় খোলার সময়ের পরে হতে হবে" });
      }
      if (col === "homework") {
        if (!clean.title) return send(res, 400, { error: "কী কাজ / কোন পড়া — শিরোনাম লিখুন" });
        if (clean.session && !db.sessions.some((s) => s.name === clean.session)) return send(res, 400, { error: "সেশন বেছে নিন" });
        if (clean.dueDate && clean.dueDate < clean.givenDate) return send(res, 400, { error: "জমার তারিখ দেওয়ার তারিখের আগে হতে পারে না" });
      }
      if (col === "docs") {
        if (!db.exams.some((e) => e.id === clean.examId)) return send(res, 400, { error: "কোন পরীক্ষার ডকুমেন্ট — বেছে নিন" });
        if (!id && !clean.url) return send(res, 400, { error: "লিংক দিন (http… দিয়ে শুরু)" });
        if (clean.category === "script" && !clean.studentId) return send(res, 400, { error: "কোন শিক্ষার্থীর খাতা — বেছে নিন" });
        if (!clean.title) clean.title = clean.kind === "youtube" ? "YouTube ভিডিও" : "লিংক";
      }
      if (col === "payments") {
        if (!db.students.some((s) => s.id === clean.studentId)) return send(res, 400, { error: "শিক্ষার্থী বেছে নিন" });
        if (clean.amount <= 0) return send(res, 400, { error: "টাকার পরিমাণ দিন" });
      }
      if (col === "achievers" && !clean.name) return send(res, 400, { error: "শিক্ষার্থীর নাম লিখুন" });
      if (col === "books" && !clean.title) return send(res, 400, { error: "বই / শিটের নাম লিখুন" });
      if (col === "faqs" && (!clean.q || !clean.a)) return send(res, 400, { error: "প্রশ্ন আর উত্তর দুটোই লিখুন" });
      if (col === "freeClasses" && !clean.title) return send(res, 400, { error: "ক্লাসের নাম লিখুন" });
      if (col === "onlineCourses") {
        if (!clean.title) return send(res, 400, { error: "কোর্সের নাম লিখুন" });
        // আগে আপলোড করা ভিডিও ধরে রাখা; যে ক্লাস বাদ গেল তার ভিডিও ফাইল মুছে ফেলা
        const old = id && db.onlineCourses.find((x) => x.id === id);
        if (old) {
          const prev = new Map((old.lessons || []).map((l) => [l.id, l]));
          clean.lessons.forEach((l) => { const o = prev.get(l.id); if (o && o.file) l.file = o.file; });
          for (const o of old.lessons || []) if (!clean.lessons.some((l) => l.id === o.id)) dropFile(videoPath(lessonKey(old, o), o.file));
        }
      }
      if (col === "learners") {
        if (clean.pin === undefined) delete clean.pin;
        if (!/^01\d{9}$/.test(clean.phone)) return send(res, 400, { error: "সঠিক মোবাইল নম্বর দিন" });
        if (db.learners.some((x) => x.phone === clean.phone && x.id !== id)) return send(res, 400, { error: "এই মোবাইলে আরেকটা অ্যাকাউন্ট আছে" });
        if (!id) return send(res, 400, { error: "শিক্ষার্থী ওয়েবসাইটের ভর্তির ফর্ম থেকে যোগ হয়" });
      }
      if (col === "talentHunts") {
        if (!clean.title) return send(res, 400, { error: "ট্যালেন্ট হান্টের নাম লিখুন" });
        if (!clean.subjects.length) return send(res, 400, { error: "কমপক্ষে একটি বিষয় আর তার পূর্ণমান দিন" });
        if (db.talentHunts.some((h) => h.code === clean.code && h.id !== id)) return send(res, 400, { error: `"${clean.code}" কোড আগের একটা ট্যালেন্ট হান্টে আছে — অন্য কোড দিন (যেমন TH27)` });
        const old = id && huntById(id);
        if (old && old.code !== clean.code && regsOf(id).length) return send(res, 400, { error: "রেজিস্ট্রেশন হয়ে যাওয়ার পর কোড বদলানো যায় না (রোল বদলে যাবে)" });
      }
      if (col === "thRegs") {
        if (!clean.name) return send(res, 400, { error: "নাম লিখুন" });
        if (clean.phone && !/^01\d{9}$/.test(clean.phone)) return send(res, 400, { error: "মোবাইল নম্বর ঠিক নেই" });
        if (!id) {
          const h = huntById(str(b.huntId, 60));
          if (!h) return send(res, 400, { error: "কোন ট্যালেন্ট হান্ট — বেছে নিন" });
          if (clean.phone && regsOf(h.id).some((r) => r.phone === clean.phone)) return send(res, 400, { error: "এই মোবাইলে আগেই রেজিস্ট্রেশন আছে" });
          const item = addReg(h, clean, "manual");
          if (clean.phone) upsertLead({ name: clean.name, phone: clean.phone, batch: clean.klass, institution: clean.college, course: clean.course }, { type: "talent", ref: item.id, campaign: h.title });
          saveDb();
          return send(res, 200, { ok: true, item });
        }
      }
      if (col === "leads") {
        if (!clean.name) return send(res, 400, { error: "শিক্ষার্থীর নাম লিখুন" });
        if (!/^01\d{9}$/.test(clean.phone)) return send(res, 400, { error: "সঠিক মোবাইল নম্বর দিন (০১ দিয়ে শুরু, ১১ সংখ্যা)" });
        if (clean.guardianPhone && !/^01\d{9}$/.test(clean.guardianPhone)) return send(res, 400, { error: "অভিভাবকের মোবাইল নম্বর ঠিক নেই" });
        const dup = db.leads.find((l) => l.phone === clean.phone && l.id !== id);
        if (dup) return send(res, 400, { error: `এই মোবাইলে আগেই আছে — ${dup.leadNo} ${dup.name}` });
        if (!id) {
          const item = { id: uid("lea"), leadNo: nextLeadNo(), ...clean, sources: [cleanSource(b.source)], createdAt: new Date().toISOString() };
          db.leads.push(item); saveDb();
          return send(res, 200, { ok: true, item });
        }
      }
      if (["courses", "batches", "exams", "notices", "teachers"].includes(col)) {
        const key = { courses: "name", batches: "name", exams: "title", notices: "title", teachers: "name" }[col];
        if (!clean[key]) return send(res, 400, { error: "নাম/শিরোনাম দিন" });
      }
      if (id) {
        const item = list.find((x) => x.id === id);
        if (!item) return send(res, 404, { error: "পাওয়া যায়নি" });
        if (col === "enrollments") { clean.discount = Math.min(Math.max(0, clean.discount), num(item.fee)); if (!clean.startDate) delete clean.startDate; }
        const startChanged = col === "enrollments" && clean.startDate && clean.startDate !== item.startDate;
        const admissionChanged = col === "students" && clean.admissionDate !== item.admissionDate;
        Object.assign(item, clean, { updatedAt: new Date().toISOString() });
        if (startChanged) setFirstMonth(item); // শুরুর তারিখ বদলালে প্রথম মাসের ক্লাস আবার গোনা
        if (admissionChanged) for (const enrollment of db.enrollments.filter(e => e.studentId === item.id && e.admissionLinked)) { enrollment.startDate = item.admissionDate; setFirstMonth(enrollment); }
        if (col === "onlineApps" && item.status === "approved") { const had = item.studentId, st = admitOnline(item); if (st && !had) await smsStudentLogin(st); } // অনলাইন মডিউলে ভর্তি নিশ্চিত → আইডি + PIN, SMS-এ
        if (col === "quizzes") syncQuizNotice(item);
        if (col === "exams" && Object.keys(item.published || {}).length) syncResultNotice(item);
        if (col === "ebooks") ebookSyncBuyers(item);
        saveDb();
        return send(res, 200, { ok: true, item });
      }
      const item = { id: col === "sessions" ? clean.name : uid(col.slice(0, 3)), ...(col === "students" ? { status: "active", note: "" } : {}), ...(col === "homework" ? { checks: {} } : {}), ...(col === "quizzes" ? { attempts: {} } : {}), ...(col === "books" ? { stock: 0 } : {}), ...clean, createdAt: new Date().toISOString() };
      if (col === "payments") item.receiptNo = nextReceiptNo();
      list.push(item);
      if (col === "quizzes") syncQuizNotice(item);
      if (col === "ebooks") ebookSyncBuyers(item);
      saveDb();
      return send(res, 200, { ok: true, item });
    }
  }
  return send(res, 404, { error: "পাওয়া যায়নি" });
}

function installRegularMonthlyFees() {
  const key = "regular-monthly-fees-202608-202611";
  if (db.meta?.repairs?.[key]) return false;
  const course = db.courses.find(c => c.id === "mod01" && c.feeType === "monthly");
  if (!course || course.monthlyFees?.length) return false;
  const original = JSON.stringify(db);
  fs.copyFileSync(DB_FILE, path.join(BACKUPS, `before-monthly-fees-${Date.now()}.json`));
  try {
    course.monthlyFees = [{ from: "2026-08", to: "2026-11", fee: 800 }];
    db.meta ||= {}; db.meta.repairs ||= {};
    db.meta.repairs[key] = { at: new Date().toISOString() };
    saveDb(); console.info("Regular monthly fee schedule installed"); return true;
  } catch (error) { db = JSON.parse(original); writeJsonAtomic(DB_FILE, db); throw error; }
}
repairConfirmedAdmissionStart();
installRegularMonthlyFees();

// ---------- ফাইল পরিবেশন ----------
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2", ".ttf": "font/ttf", ".mp4": "video/mp4", ".webm": "video/webm",
};
const ROUTES = { "/": "/index.html", "/admin": "/admin.html", "/student": "/student.html", "/login": "/student.html", "/apply": "/apply.html", "/quiz": "/quiz.html", "/talent-hunt": "/talent.html", "/courses": "/learn.html", "/course": "/learn.html", "/free-classes": "/learn.html", "/module": "/module.html", "/online-apply": "/online-apply.html", "/admission": "/admission.html", "/daily": "/daily.html", "/books": "/books.html" };

function serveStatic(req, res, url) {
  const rel = ROUTES[url.pathname] || decodeURIComponent(url.pathname);
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("পাওয়া যায়নি"); }
    const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
    // ভিডিওর জন্য অংশবিশেষ পাঠানো (Range) — ব্রাউজার লুপ / সামনে-পিছনে করতে পারে
    const rg = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
    if (rg && type.startsWith("video/")) {
      const start = rg[1] ? Number(rg[1]) : Math.max(0, st.size - Number(rg[2])), end = rg[1] && rg[2] ? Math.min(Number(rg[2]), st.size - 1) : st.size - 1;
      if (start > end || start >= st.size) { res.writeHead(416, { "Content-Range": `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${st.size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1, "Cache-Control": "no-cache" });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache", ...(type.startsWith("video/") ? { "Accept-Ranges": "bytes", "Content-Length": st.size } : {}) });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin"); // অন্য সাইট শুধু ডোমেইন পায় — YouTube এমবেডের জন্য দরকার (না পেলে Error 153)
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: "সার্ভারে সমস্যা হয়েছে" });
  }
});

syncPauses(); setInterval(syncPauses, 60e3).unref(); // সামনের তারিখের বন্ধ / চালু সময়মতো কার্যকর

// ---------- জন্মদিনের শুভেচ্ছা ----------
// প্রতিদিন রাত ১২:০১-এ, জন্মদিন আজ এমন সক্রিয় শিক্ষার্থীকে: নিজের নোটিশে আর SMS-এ — বছরে একবারই (সার্ভার দেরিতে চালু হলেও সেদিনই যায়)
const BIRTHDAY_BODY = "Wishing you happiness, success, and a wonderful year ahead. Keep learning, keep smiling, and keep moving toward your dreams.\n\nBest wishes,\nMd Shahin Miah (Mentor-ICT)";
const firstName = (s) => { const en = str(s.nameEn, 120).split(/[\s.]+/).filter((w) => w && !/^(md|mohammad|mohammed|muhammad|mohammod|mst|mosammat|mosammad|most|mrs?|miss|ms)$/i.test(w)); return en[0] || s.nameEn || s.name || ""; };
const birthdayToday = (dob, day) => { const md = String(dob || "").slice(5), now = day.slice(5), y = Number(day.slice(0, 4)); return /^\d{4}-\d{2}-\d{2}$/.test(dob || "") && (md === now || (md === "02-29" && now === "02-28" && !(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)))); };
async function sendBirthdays() {
  const clock = new Date(); if (clock.getHours() === 0 && clock.getMinutes() < 1) return; // ১২:০১ থেকে
  const day = today(), year = day.slice(0, 4), list = db.students.filter((s) => s.status !== "inactive" && s.lastBirthday !== year && birthdayToday(s.dob, day));
  const stale = db.notices.filter((n) => n.birthday && n.until < day);
  if (!list.length && !stale.length) return;
  db.notices = db.notices.filter((n) => !stale.includes(n)); // আগের দিনের শুভেচ্ছা নোটিশ রাখার দরকার নেই
  for (const s of list) {
    const title = `Happy Birthday, ${firstName(s)}!`;
    s.lastBirthday = year; // আগে চিহ্ন, যাতে পরের মিনিটের চেকে আবার না যায়
    db.notices.push({ id: uid("not"), birthday: true, studentIds: [s.id], title, body: BIRTHDAY_BODY, date: day, until: day, public: false, important: true, createdAt: new Date().toISOString() });
  }
  saveDb();
  for (const s of list) {
    const phone = [s.phone, s.guardianPhone].map(phoneOf).find((n) => /^01\d{9}$/.test(n));
    if (!phone) continue;
    try { await sendSms(phone, `Happy Birthday, ${firstName(s)}!\n\n${BIRTHDAY_BODY}`, `জন্মদিনের শুভেচ্ছা — ${s.id}`, "Birthday"); }
    catch (e) { console.error("জন্মদিনের SMS:", s.id, e.message); }
  }
  saveDb();
}
const birthdayTick = () => sendBirthdays().catch((e) => console.error("জন্মদিন:", e.message));
birthdayTick(); setInterval(birthdayTick, 60e3).unref();

// ---------- অনুপস্থিতির SMS ----------
// প্রতিদিন সন্ধ্যা ৭টা থেকে রাত ১০টার মধ্যে: আজকের হাজিরায় অনুপস্থিত সক্রিয় শিক্ষার্থীর অভিভাবককে, দিনে একবার (হাজিরা দেরিতে দিলে বা সার্ভার দেরিতে চালু হলে তখনই যায়)
const ABSENT_FROM = 19, ABSENT_UNTIL = 22;
let absentBusy = false;
async function sendAbsentSms() {
  const hour = new Date().getHours();
  if (absentBusy || hour < ABSENT_FROM || hour >= ABSENT_UNTIL || !smsOn()) return;
  const day = today(), sent = (db.absentSent || {})[day] || [], ids = new Set();
  for (const [key, marks] of Object.entries(db.attendance)) if (key.startsWith(day + "|")) for (const [sid, st] of Object.entries(marks)) if (st === "A" && !sent.includes(sid)) ids.add(sid);
  const list = [...ids].map((id) => db.students.find((s) => s.id === id)).filter((s) => s && s.status !== "inactive");
  if (!list.length) return;
  absentBusy = true;
  try {
    const date = new Date(day + "T00:00").toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" });
    db.absentSent = { [day]: sent }; // আগের দিনগুলোর হিসাব রাখার দরকার নেই
    for (const s of list) {
      sent.push(s.id); // আগে চিহ্ন, যাতে পরের মিনিটে আবার না যায়
      const phone = [s.guardianPhone, s.fatherPhone, s.motherPhone].map(phoneOf).find((n) => /^01\d{9}$/.test(n));
      if (!phone) { console.error("অনুপস্থিতির SMS: অভিভাবকের নম্বর নেই", s.id); continue; }
      try { await sendSms(phone, `সম্মানিত অভিভাবক, ${s.name} আজ ${date} ক্লাসে অনুপস্থিত ছিল। — Shahin Sir`, `অনুপস্থিত — ${s.id}, ${day}`, "Absent"); }
      catch (e) { console.error("অনুপস্থিতির SMS:", s.id, e.message); }
    }
    saveDb();
  } finally { absentBusy = false; }
}
const absentTick = () => sendAbsentSms().catch((e) => console.error("অনুপস্থিতি:", e.message));
absentTick(); setInterval(absentTick, 60e3).unref();

// ---------- মাস শেষের অগ্রগতির SMS ----------
// মাসের শেষ দিন রাত ৮টা থেকে ১০টার মধ্যে, সক্রিয় শিক্ষার্থীর অভিভাবককে, মাসে একবার
// মোট ক্লাস = উপস্থিত + অনুপস্থিত দিন (ছুটি বাদ); পড়া আর বাড়ির কাজ যাচাইয়ের হিসাবে: করেছে ÷ (করেছে + করেনি), অনুপস্থিত গোনা হয় না
const MONTHLY_FROM = 20, MONTHLY_UNTIL = 22;
const bnNum = (n) => Number(n).toLocaleString("bn-BD", { useGrouping: false });
function monthProgress(s, month) {
  let classes = 0;
  for (const [key, marks] of Object.entries(db.attendance)) if (key.startsWith(month) && (marks[s.id] === "P" || marks[s.id] === "A")) classes++;
  const tally = (kind) => { let done = 0, total = 0; for (const h of db.homework) if (h.kind === kind && String(h.dueDate || h.givenDate).startsWith(month)) { const c = (h.checks || {})[s.id]; if (c === "done") { done++; total++; } else if (c === "not") total++; } return { done, total }; };
  return { classes, lesson: tally("lesson"), homework: tally("homework") };
}
let monthlyBusy = false;
async function sendMonthlyProgress() {
  const now = new Date(), hour = now.getHours(), tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (monthlyBusy || tomorrow.getDate() !== 1 || hour < MONTHLY_FROM || hour >= MONTHLY_UNTIL || !smsOn()) return;
  const month = today().slice(0, 7), sent = (db.monthlySent || {})[month] || [];
  const list = db.students.filter((s) => s.status !== "inactive" && !sent.includes(s.id));
  if (!list.length) return;
  monthlyBusy = true;
  try {
    db.monthlySent = { [month]: sent };
    for (const s of list) {
      sent.push(s.id); // আগে চিহ্ন, যাতে পরের মিনিটে আবার না যায়
      const p = monthProgress(s, month);
      if (!p.classes) continue; // এই মাসে ক্লাসের হিসাব নেই
      const phone = [s.guardianPhone, s.fatherPhone, s.motherPhone].map(phoneOf).find((n) => /^01\d{9}$/.test(n));
      if (!phone) { console.error("অগ্রগতির SMS: অভিভাবকের নম্বর নেই", s.id); continue; }
      const work = p.homework.total ? ` এবং ${bnNum(p.homework.total)}টি বাড়ির কাজের মধ্যে ${bnNum(p.homework.done)}টি সম্পন্ন করেছে` : "";
      try { await sendSms(phone, `সম্মানিত অভিভাবক, ${s.name} এই মাসে মোট ${bnNum(p.classes)}টি ক্লাসের মধ্যে ${bnNum(p.lesson.done)} দিন পড়া পেরেছে${work}। — Shahin Sir`, `মাসের অগ্রগতি — ${s.id}, ${month}`, "Monthly"); }
      catch (e) { console.error("অগ্রগতির SMS:", s.id, e.message); }
    }
    saveDb();
  } finally { monthlyBusy = false; }
}
const monthlyTick = () => sendMonthlyProgress().catch((e) => console.error("মাসের অগ্রগতি:", e.message));
monthlyTick(); setInterval(monthlyTick, 60e3).unref();

// ---------- মাসের ১ তারিখের বকেয়ার SMS ----------
// ১ তারিখ সকাল ১০টা থেকে রাত ১০টার মধ্যে (সার্ভার দেরিতে চালু হলে তখনই), মাসে একবার: মাসিক বেতনের মডিউলে পড়ছে আর বকেয়া আছে এমন সক্রিয় শিক্ষার্থী ও অভিভাবকের নম্বরে
const FEE_FROM = 10, FEE_UNTIL = 22;
let feeBusy = false;
async function sendFeeDue() {
  const now = new Date(), hour = now.getHours();
  if (feeBusy || now.getDate() !== 1 || hour < FEE_FROM || hour >= FEE_UNTIL || !smsOn()) return;
  const month = today().slice(0, 7), sent = (db.feeSent || {})[month] || [];
  const monthly = (s) => db.enrollments.some((e) => e.studentId === s.id && e.status === "active" && (db.courses.find((c) => c.id === e.courseId) || {}).feeType === "monthly");
  const list = db.students.filter((s) => s.status !== "inactive" && !sent.includes(s.id) && monthly(s));
  if (!list.length) return;
  feeBusy = true;
  try {
    db.feeSent = { [month]: sent };
    for (const s of list) {
      sent.push(s.id); // আগে চিহ্ন, যাতে পরের মিনিটে আবার না যায়
      const due = feeSummary(s).balance;
      if (due <= 0) continue;
      const phones = [...new Set([s.phone, s.guardianPhone].map(phoneOf).filter((n) => /^01\d{9}$/.test(n)))];
      if (!phones.length) { console.error("বকেয়ার SMS: মোবাইল নম্বর নেই", s.id); continue; }
      const text = `সম্মানিত অভিভাবক, ${s.name}-এর বেতন বাবদ মোট ${Number(due).toLocaleString("bn-BD")} টাকা বকেয়া রয়েছে। অনুগ্রহ করে ৩টি ক্লাসের মধ্যে পরিশোধ করবেন। — Shahin Sir`;
      for (const phone of phones) {
        try { await sendSms(phone, text, `বকেয়া — ${s.id}, ${month}`, "Fee"); }
        catch (e) { console.error("বকেয়ার SMS:", s.id, e.message); }
      }
    }
    saveDb();
  } finally { feeBusy = false; }
}
const feeTick = () => sendFeeDue().catch((e) => console.error("বকেয়া:", e.message));
feeTick(); setInterval(feeTick, 60e3).unref();
server.listen(PORT, HOST, () => {
  console.log(`Shahin's ICT Care চালু হয়েছে: http://${HOST}:${PORT}`);
  console.log(`অ্যাডমিন প্যানেল: http://${HOST}:${PORT}/admin`);
  console.log(`শিক্ষার্থী প্যানেল: http://${HOST}:${PORT}/student`);
});
