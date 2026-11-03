// পরীক্ষার হিসাব — অ্যাডমিন, শিক্ষার্থী প্যানেল আর সার্ভার তিন জায়গাতেই এই একই ফাইল (যাতে হিসাব কখনো আলাদা না হয়)
//
// পরীক্ষা (exam):
//   type: weekly | monthly | chapter | model      mode: both | cq | mcq
//   subjects: [{ name, cq, mcq }]  (পূর্ণমান; ০ মানে ঐ অংশ বাদ)
//   marks: { [studentId]: [ { "বিষয়|cq": নম্বর, "বিষয়|mcq": নম্বর } | null , … ] }  — প্রতিবারের (attempt) জন্য আলাদা
// নিয়ম:
//   • Chapter Final Test-এ ৩ বার পরীক্ষা; যতবার দিয়েছে শুধু সেগুলোর গড় (সবচেয়ে ভালোটা নয়)।
//     গড় CQ = সব বারের CQ-র যোগফল ÷ কতবার দিয়েছে; গড় MCQ একইভাবে; মোট = গড় CQ + গড় MCQ
//   • পাস: প্রতিটা বিষয়ের CQ আর MCQ — দুটোতেই আলাদাভাবে এক-তৃতীয়াংশ (২০ → ৭, ১৫ → ৫)
//   • মেধাক্রম শুধু পাস করা শিক্ষার্থীদের: মোট নম্বর বেশি → আগে; সমান হলে CQ বেশি → আগে; দশমিকসহ হিসাব (রাউন্ড করে নয়)
//     ফেল করলে মেধাক্রম নেই (rank = null)
(function (root) {
  "use strict";
  const TYPES = [["weekly", "Weekly Test"], ["monthly", "Monthly Test"], ["chapter", "Chapter Final Test"], ["model", "Model Test"], ["class", "Class Assessment"], ["gk", "Weekly GK Test"], ["special", "Special Exam"]];
  // মোট গড় / মেধায় ধরা হয় না — আলাদা ফলাফল আর আলাদা মেধা (জিকে টেস্ট, চিত্র অংকনের মতো বিশেষ পরীক্ষা)
  const EXTRA_TYPES = ["gk", "special"];
  // এখানে কোনো ধরন রাখলে সেই পরীক্ষার ফলাফল প্রকাশ / শিটে ব্যাচ আলাদা বাছা যায় না (শুধু "সব ব্যাচ")।
  // এখন খালি — সব ধরনেই যেকোনো একটা ব্যাচ অথবা সব ব্যাচ বাছা যায়।
  const ALL_BATCH_TYPES = [];
  const MODES = [["both", "Both (CQ + MCQ)"], ["cq", "Only CQ"], ["mcq", "Only MCQ"]];
  const ATTEMPT_NAMES = ["১ম বার", "২য় বার", "৩য় বার"];
  const typeName = (t) => (TYPES.find((x) => x[0] === t) || TYPES[0])[1];
  // সেশন ফাঁকা = Both: সব সেশনের পরীক্ষা
  const sessionName = (ex) => ex.session || "উভয়";
  // জিকে আর বিশেষ পরীক্ষায় নেগেটিভ মার্কিং: নম্বর ০-এর নিচেও লেখা যায়
  const allowsNegative = (ex) => !!ex && EXTRA_TYPES.includes(ex.type);
  // পরীক্ষার নাম: তুলনা আর ক্রম (Weekly Test-01, 02, 03) — বাংলা অঙ্ক ও বড়-ছোট হাতের অক্ষর এক ধরা হয়
  const titleKey = (t) => String(t || "").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d)).trim().replace(/\s+/g, " ").toLowerCase();
  const byTitle = (a, b) => titleKey(a.title).localeCompare(titleKey(b.title), "en", { numeric: true }) || String(a.date || "").localeCompare(String(b.date || ""));
  // একই সেশনে (উভয় হলে সব সেশনে) একই নামের অন্য পরীক্ষা
  const sameNameExam = (list, ex, id) => (list || []).find((e) => e.id !== id && titleKey(e.title) === titleKey(ex.title) && (!e.session || !ex.session || e.session === ex.session));
  const attemptsOf = (ex) => (ex && ex.type === "chapter" ? 3 : 1);
  const num = (v) => (v === "" || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v));
  const round2 = (x) => Math.round(x * 100) / 100;

  // কোন কোন ঘরে নম্বর বসবে: প্রতি বিষয়ের CQ / MCQ (পূর্ণমান > ০ হলে)
  function parts(ex) {
    const mode = ex.mode || "both", out = [];
    for (const s of ex.subjects || []) {
      if (mode !== "mcq" && Number(s.cq) > 0) out.push({ subject: s.name, part: "cq", full: Number(s.cq), key: `${s.name}|cq` });
      if (mode !== "cq" && Number(s.mcq) > 0) out.push({ subject: s.name, part: "mcq", full: Number(s.mcq), key: `${s.name}|mcq` });
    }
    return out;
  }
  const fullOf = (ex) => parts(ex).reduce((t, p) => t + p.full, 0);
  // পাসের নম্বর: CQ আর MCQ-তে আলাদা। পরীক্ষায় দেওয়া % থাকলে সেটা; না থাকলে সাধারণত ৩৩%, জিকে টেস্টে ৪০%
  const passPctDefault = (type) => (type === "gk" ? 40 : 33);
  const passMark = (full, ex, part) => Math.ceil((full * (Number(ex && (part === "cq" ? ex.passCq : ex.passMcq)) || passPctDefault(ex && ex.type))) / 100 - 1e-9);
  // এই বার পরীক্ষা দিয়েছে কি না — অন্তত একটা ঘরে নম্বর থাকলে
  const attemptDone = (a, ps) => !!a && ps.some((p) => num(a[p.key]) !== null);

  function studentResult(ex, sid) {
    const ps = parts(ex), full = fullOf(ex);
    const att = ((ex.marks || {})[sid] || []).slice(0, attemptsOf(ex));
    const done = att.filter((a) => attemptDone(a, ps));
    const given = att.map((a) => attemptDone(a, ps));
    if (!done.length) return { sid, absent: true, attempts: 0, given, full };
    const scores = {};
    for (const p of ps) scores[p.key] = done.reduce((t, a) => t + (num(a[p.key]) || 0), 0) / done.length;
    const sum = (part) => ps.filter((p) => !part || p.part === part).reduce((t, p) => t + scores[p.key], 0);
    const fails = ps.filter((p) => scores[p.key] < passMark(p.full, ex, p.part)).map((p) => p.key);
    const total = sum();
    return { sid, absent: false, attempts: done.length, given, scores, total, cq: sum("cq"), mcq: sum("mcq"), full, percent: full ? (total / full) * 100 : 0, pass: !fails.length, fails };
  }

  // পুরো পরীক্ষার ফলাফল: মেধাক্রমসহ সারি আর সারসংক্ষেপ
  function results(ex) {
    const ids = [...new Set([...(ex.studentIds || []), ...Object.keys(ex.marks || {})])];
    const rows = ids.map((id) => studentResult(ex, id));
    // পাস করা আগে (মেধাক্রমসহ), তারপর ফেল করা (মেধাক্রম ছাড়া)
    const present = rows.filter((r) => !r.absent).sort((a, b) => Number(b.pass) - Number(a.pass) || b.total - a.total || b.cq - a.cq);
    let rank = 0, prev = null;
    present.forEach((r, i) => {
      if (!r.pass) { r.rank = null; return; }
      const k = `${round2(r.total)}|${round2(r.cq)}`; if (k !== prev) { rank = i + 1; prev = k; } r.rank = rank;
    });
    const totals = present.map((r) => r.total);
    const stats = {
      students: ids.length, sat: present.length, absent: ids.length - present.length, full: fullOf(ex),
      pass: present.filter((r) => r.pass).length, fail: present.filter((r) => !r.pass).length, ranked: present.filter((r) => r.pass).length,
      avg: totals.length ? totals.reduce((t, x) => t + x, 0) / totals.length : null,
      high: totals.length ? Math.max(...totals) : null, low: totals.length ? Math.min(...totals) : null,
    };
    return { rows: [...present, ...rows.filter((r) => r.absent)], present, stats };
  }

  // কোনো একটা বারে কতজনের নম্বর দেওয়া হয়েছে, কতজন অনুপস্থিত ({ _absent: true }), কতজনের এখনো বাকি
  const isAbsent = (a) => !!(a && a._absent);
  function attemptStats(ex, a) {
    const ps = parts(ex), ids = ex.studentIds || [], cells = ids.map((id) => ((ex.marks || {})[id] || [])[a]);
    const list = cells.filter((x) => attemptDone(x, ps)), absent = cells.filter(isAbsent).length;
    const tot = list.map((x) => ps.reduce((t, p) => t + (num(x[p.key]) || 0), 0));
    return { students: ids.length, entered: list.length, absent, pending: ids.length - list.length - absent, avg: tot.length ? tot.reduce((t, x) => t + x, 0) / tot.length : null, high: tot.length ? Math.max(...tot) : null };
  }

  root.ExamCalc = { TYPES, EXTRA_TYPES, ALL_BATCH_TYPES, MODES, ATTEMPT_NAMES, typeName, sessionName, titleKey, byTitle, sameNameExam, allowsNegative, attemptsOf, parts, fullOf, passMark, passPctDefault, attemptDone, studentResult, results, attemptStats, isAbsent, round2, num };
})(typeof globalThis !== "undefined" ? globalThis : window);
