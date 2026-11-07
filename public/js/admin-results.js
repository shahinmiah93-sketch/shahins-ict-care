// অ্যাডমিন → ফলাফল ব্যবস্থাপনা (পরীক্ষা পেজের মতো গাঢ় প্যানেল, ৭টা ট্যাব)
//   ✓ Review & Publish · Result Sheets · Merit Lists · Performance · Individual Result · Online Quiz · Reports & PDF
// পরীক্ষা তৈরি আর নম্বর এন্ট্রি "পরীক্ষা" পেজে; এখানে সেই নম্বর দিয়ে যাচাই, প্রকাশ, শিট, মেধাতালিকা আর রিপোর্ট।
// নিয়ম:
//   • শিক্ষার্থী শুধু নিজের ব্যাচের "প্রকাশিত" ফলাফল দেখে। প্রত্যাহার (Unpublish) করলেও নম্বর বা ইতিহাস মুছে না।
//   • একটা পরীক্ষার মেধাক্রম = শুধু পাস করা (examcalc.js)। কয়েকটা পরীক্ষা মিলিয়ে মেধাক্রম = গড় শতাংশ ধরে;
//     অনুপস্থিত = ০%, নম্বর এখনো না দেওয়া হলে সেই পরীক্ষা গোনা হয় না।
//   • Combined Merit = সব ধরনের পরীক্ষার গড় শতাংশ × ভার (সেটিংস) — হাজিরা / বাড়ির কাজ এতে মেশে না।
window.SICResults = function (X) {
  "use strict";
  const { $, $$, esc, bn, api, toast } = U;
  const EC = window.ExamCalc;
  const DB = () => X.DB;
  const today = () => U.today();
  const TYPE_C = { weekly: "#286fa3", monthly: "#6c5bb5", chapter: "#9a6a12", model: "#c0394f", class: "#187460", gk: "#b4531f", special: "#0e7490" };
  const pct = (x) => (x === null || x === undefined ? "—" : bn(String(Math.round(x * 10) / 10)) + "%");
  const num2 = (x) => (x === null || x === undefined ? "—" : bn(String(EC.round2(x))));
  const enNum = (v) => String(v ?? "").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d)).trim();
  const typeChip = (t) => `<span class="ex-type" style="--k:${TYPE_C[t] || TYPE_C.weekly}">${esc(EC.typeName(t))}</span>`;
  const empty = (t) => `<div class="ln-empty">${t}</div>`;
  const ACTIONS = { publish: ["প্রকাশ", "ok"], republish: ["আবার প্রকাশ", "ok"], unpublish: ["প্রত্যাহার", "bad"], correct: ["সংশোধন", "warn"] };

  // ---------- অবস্থা ----------
  const S = { mcat: "weekly", mexam: "", verified: {}, tab: "review", examId: "", scope: "all", scopeBatch: "", sheet: "session", sheetExam: "", q: "", sort: "merit", merit: "session", mod: "combined", meritExam: "", pid: "", month: today().slice(0, 7), land: false, emode: "one", eid: "", cardSel: null, f: { session: "", batch: "", type: "" } };
  try { Object.assign(S.f, JSON.parse(localStorage.getItem("sicResultFilter") || "{}")); } catch {}
  const keepFilter = () => { try { localStorage.setItem("sicResultFilter", JSON.stringify(S.f)); } catch {} };
  let C = null, cache = new Map();

  // ---------- তথ্য ----------
  const exById = (id) => DB().exams.find((e) => e.id === id);
  const stu = (id) => X.studentById(id) || { id, name: id };
  const batchOf = (sid) => (X.studentById(sid) || {}).batchId || "";
  const exBatches = (ex) => [...new Set((ex.studentIds || []).map(batchOf).filter(Boolean))];
  const session = () => S.f.session || (X.liveSessions()[0] || {}).name || "";
  const resOf = (ex) => { let r = cache.get(ex.id); if (!r) { r = EC.results(ex); cache.set(ex.id, r); } return r; };
  // পরীক্ষাগুলো: সেশন, ব্যাচ, ধরন অনুযায়ী (সবচেয়ে নতুন আগে)
  const exams = (opt = {}) => DB().exams.filter((e) => {
    if (e.session && e.session !== session()) return false; // Both দুই সেশনেই দেখায়
    if (!opt.anyType && S.f.type && e.type !== S.f.type) return false;
    if (opt.type && e.type !== opt.type) return false;
    const b = opt.batch !== undefined ? opt.batch : batchLocked() ? "" : S.f.batch;
    if (b && !exBatches(e).includes(b)) return false;
    return true;
  }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const students = (batch) => DB().students.filter((s) => s.status !== "inactive" && s.session === session() && (!batch || s.batchId === batch)).sort((a, b) => a.id.localeCompare(b.id));
  // প্রকাশের অবস্থা
  function pubState(ex) {
    const all = exBatches(ex), pub = all.filter((b) => ex.published && ex.published[b]);
    return { all, pub, state: !pub.length ? "draft" : pub.length < all.length ? "partial" : "full" };
  }
  const stateChip = (ex) => { const p = pubState(ex); return p.state === "full" ? '<span class="chip ok">প্রকাশিত</span>' : p.state === "partial" ? `<span class="chip warn">আংশিক (${bn(p.pub.length)}/${bn(p.all.length)})</span>` : '<span class="chip">Draft</span>'; };
  // একটা পরীক্ষায় শিক্ষার্থীর শতাংশ: অনুপস্থিত = ০; নম্বর এখনো না দেওয়া = null (গোনা হয় না)
  function pctIn(ex, sid) {
    if (!(ex.studentIds || []).includes(sid)) return null;
    const r = resOf(ex).rows.find((x) => x.sid === sid);
    if (r && !r.absent) return r.percent;
    const arr = (ex.marks || {})[sid] || [];
    return arr.some((a) => EC.isAbsent(a)) ? 0 : null;
  }
  const isAbs = (ex, sid) => ((ex.marks || {})[sid] || []).some((a) => EC.isAbsent(a)) && !((resOf(ex).rows.find((x) => x.sid === sid) || {}).absent === false);
  const CORE = ["weekly", "monthly", "chapter", "model"];
  // কয়েকটা পরীক্ষা মিলিয়ে: ধরন অনুযায়ী গড়, Combined (ভার ধরে)
  function scoreOf(sid, list) {
    const w = DB().settings.meritWeights || { weekly: 1, monthly: 1, chapter: 1, model: 1, class: 1 };
    const by = {}; let given = 0, total = 0, missed = 0;
    for (const ex of list) {
      if (!(ex.studentIds || []).includes(sid)) continue;
      total++;
      const p = pctIn(ex, sid);
      if (p === null) continue;
      if (isAbs(ex, sid)) missed++; else given++;
      (by[ex.type] ||= []).push(p);
    }
    const avg = {}; for (const [k, v] of Object.entries(by)) avg[k] = v.reduce((a, b) => a + b, 0) / v.length;
    // Combined Academic Merit: শুধু মূল চার ধরন (Weekly, Monthly, Chapter Final, Model) — Class Assessment ও কুইজ নয়
    const ks = Object.keys(avg).filter((k) => CORE.includes(k) && Number(w[k] ?? 1) > 0), ws = ks.reduce((t, k) => t + Number(w[k] ?? 1), 0);
    const combined = ws ? ks.reduce((t, k) => t + avg[k] * Number(w[k] ?? 1), 0) / ws : null;
    // জিকে টেস্ট মোট গড় / মেধায় ধরা হয় না — শুধু নিজের আলাদা মেধাতালিকা (তালিকায় শুধু জিকে থাকলে তখন সেটাই)
    const all = (Object.keys(by).some((k) => !EC.EXTRA_TYPES.includes(k)) ? Object.entries(by).filter(([k]) => !EC.EXTRA_TYPES.includes(k)) : Object.entries(by)).flatMap(([, v]) => v);
    return { avg, combined, mean: all.length ? all.reduce((a, b) => a + b, 0) / all.length : null, given, missed, total };
  }
  // মেধাক্রম বসানো (সমান হলে একই অবস্থান)
  function rankBy(rows, key) {
    const list = rows.filter((r) => r[key] !== null && r[key] !== undefined).sort((a, b) => b[key] - a[key]);
    let rank = 0, prev = null;
    list.forEach((r, i) => { const k = Math.round(r[key] * 100); if (k !== prev) { rank = i + 1; prev = k; } r[key + "Rank"] = rank; });
    return list;
  }
  // হাজিরা: P = উপস্থিত, A = অনুপস্থিত, L = ছুটি। উপস্থিতি = উপস্থিত ÷ (উপস্থিত + অনুপস্থিত) — ছুটির দিন বাদ
  // total = হিসাবে ধরা দিন (উপস্থিত + অনুপস্থিত); ন্যূনতম দিনের শর্তও এটা ধরে
  function attOf(sid, month) {
    let p = 0, a = 0, l = 0;
    for (const [k, m] of Object.entries(DB().attendance || {})) {
      if (month && !k.startsWith(month)) continue;
      const v = m[sid]; if (!v) continue;
      v === "P" ? p++ : v === "A" ? a++ : l++;
    }
    const t = p + a;
    return { p, a, l, total: t, pct: t ? (p / t) * 100 : null };
  }
  const finalNote = (list) => { const nf = list.filter((e) => pubState(e).state !== "full" && resOf(e).stats.sat); return nf.length ? `<span class="chip warn" title="${esc(nf.map((e) => e.title).join(", "))}">চূড়ান্ত নয় — ${bn(nf.length)}টি পরীক্ষার ফলাফল পুরো প্রকাশ হয়নি</span>` : list.length ? '<span class="chip ok">✓ চূড়ান্ত — সব ফলাফল প্রকাশিত</span>' : ""; };
  const withMarks = (list) => list.filter((e) => resOf(e).stats.sat || Object.values(e.marks || {}).length);

  // ================= পেজ =================
  function render() {
    if (!C) return;
    cache = new Map();
    const tabs = [["eval", "মূল্যায়ন"], ["review", "Review & Publish"], ["sheets", "Overall Result Sheet"], ["profile", "Individual Result"], ["merit", "Merit Lists"], ["perf", "Performance"], ["quiz", "Online Quiz"], ["talent", "Talent Hunt"], ["reports", "Reports & PDF"]];
    const all = exams({ anyType: true, batch: "" }), st = all.map(pubState);
    C.innerHTML = `<div class="ex-page rs-page">
      <section class="ln-banner"><div><span class="eyebrow">Shahin's ICT Care • Academic Control Center</span><h2>ফলাফল ব্যবস্থাপনা</h2>
        <p>নম্বর যাচাই করে ব্যাচ ধরে ফলাফল প্রকাশ বা প্রত্যাহার, রেজাল্ট শিট, মেধাতালিকা, শিক্ষার্থীর অগ্রগতি আর প্রিন্টযোগ্য রিপোর্ট — এক জায়গায়। পরীক্ষা তৈরি আর নম্বর এন্ট্রি <a href="#exams" style="color:#ffe6a8">পরীক্ষা</a> পেজে।</p>
        <div class="ln-nums"><span><b>${bn(all.length)}</b>মোট পরীক্ষা (${esc(session())})</span><span><b>${bn(st.filter((x) => x.state === "full").length)}</b>প্রকাশিত</span><span><b>${bn(st.filter((x) => x.state === "partial").length)}</b>আংশিক</span><span><b>${bn(st.filter((x) => x.state === "draft").length)}</b>Draft</span></div></div></section>
      <div class="ln-tabs">${tabs.map(([k, t]) => `<button type="button" data-tab="${k}" class="${S.tab === k ? "on" : ""}">${t}</button>`).join("")}</div>
      ${({ review, sheets, merit, perf, profile, quiz, talent, reports, eval: evalTab })[S.tab]()}</div>`;
    if (S.tab === "eval" && S.emode === "one") fillEval();
  }

  // প্রতিটা ট্যাবের নিজের ফিল্টার: সেশন → পরীক্ষার ধরন → ব্যাচ
  // Weekly / Monthly / Model Test সব ব্যাচ একসাথে দেয় → ব্যাচ "সব ব্যাচ"-এ আটকানো; Chapter Final / Class Assessment → যেকোনো ব্যাচ বা সব
  const batchLocked = () => EC.ALL_BATCH_TYPES.includes(S.f.type);
  function filtersHtml(keys = ["session", "type", "batch"]) {
    const bs = DB().batches.filter((b) => b.session === session());
    return keys.map((k) => k === "session" ? `<label>সেশন<select data-f="session">${X.opt(DB().sessions.map((s) => [s.name, s.name]), session())}</select></label>`
      : k === "batch" ? (keys.includes("type") && batchLocked()
        ? `<label>ব্যাচ<select data-f="batch" disabled title="${esc(EC.typeName(S.f.type))} সব ব্যাচ একসাথে — ব্যাচ আলাদা বাছা যায় না"><option>সব ব্যাচ</option></select></label>`
        : `<label>ব্যাচ<select data-f="batch">${X.opt([["", "সব ব্যাচ"], ...bs.map((b) => [b.id, U.batchLabel(b)])], S.f.batch)}</select></label>`)
      : `<label>পরীক্ষার ধরন<select data-f="type">${X.opt([["", "সব ধরন"], ...EC.TYPES], S.f.type)}</select></label>`).join("");
  }
  const filterBar = (keys) => `<div class="rs-bar">${filtersHtml(keys)}</div>`;

  // ================= ✓ Review & Publish =================
  function review() {
    const list = exams();
    if (!list.length) return `<section class="card">${filterBar()}${empty('এই সেশন / ব্যাচ / ধরনে কোনো পরীক্ষা নেই। পরীক্ষা তৈরি করুন <a href="#exams">পরীক্ষা</a> পেজে।')}</section>`;
    if (!list.some((e) => e.id === S.examId)) S.examId = list[0].id;
    const ex = exById(S.examId), R = resOf(ex), ps = pubState(ex), n = EC.attemptsOf(ex);
    if (S.scopeBatch && !ps.all.includes(S.scopeBatch)) S.scopeBatch = "";
    // Weekly / Monthly / Model Test: সব ব্যাচ একসাথে প্রকাশ — নির্দিষ্ট ব্যাচ বাছাই নেই
    const allOnly = EC.ALL_BATCH_TYPES.includes(ex.type);
    if (allOnly) { S.scope = "all"; S.scopeBatch = ""; }
    // ব্যাচ অনুযায়ী যাচাই
    const rows = ps.all.map((b) => {
      const ids = (ex.studentIds || []).filter((id) => batchOf(id) === b);
      let entered = 0, absent = 0, pending = 0;
      for (const id of ids) {
        const arr = (ex.marks || {})[id] || [], r = R.rows.find((x) => x.sid === id);
        if (r && !r.absent) entered++; else if (arr.some((a) => EC.isAbsent(a))) absent++; else pending++;
      }
      const pr = R.rows.filter((r) => !r.absent && batchOf(r.sid) === b);
      return { b, ids, entered, absent, pending, pass: pr.filter((r) => r.pass).length, fail: pr.filter((r) => !r.pass).length, pub: ex.published && ex.published[b] };
    });
    const pend = rows.reduce((t, r) => t + r.pending, 0), abs = rows.reduce((t, r) => t + r.absent, 0), fail = rows.reduce((t, r) => t + r.fail, 0);
    const checks = [
      pend ? ["bad", `${bn(pend)} জনের নম্বর এখনো দেওয়া হয়নি (অনুপস্থিত হলে "অনুপস্থিত" টিক দিন)`] : ["ok", "সবার নম্বর বা অনুপস্থিতি দেওয়া হয়েছে"],
      abs ? ["warn", `${bn(abs)} জন অনুপস্থিত`] : null,
      R.stats.sat ? ["ok", `${bn(R.stats.pass)} জন পাস, ${bn(fail)} জন ফেল${fail ? " — ফেল করলে মেধাক্রমে আসে না" : ""}`] : ["bad", "এখনো কারো নম্বর নেই"],
      n > 1 && (ex.attemptDates || []).slice(1).some((d) => !d) ? ["warn", "Chapter Final-এর ২য় / ৩য় বারের তারিখ দেওয়া নেই"] : null,
      n > 1 ? ["ok", "Chapter Final: যতবার দিয়েছে তার গড় (CQ ও MCQ আলাদা) — নিয়ম অনুযায়ী"] : null,
    ].filter(Boolean);
    const sel = S.scope === "batch" && S.scopeBatch ? [S.scopeBatch] : ps.all;
    const scopeName = S.scope === "batch" && S.scopeBatch ? `ব্যাচ ${X.batchName(S.scopeBatch)}` : `${EC.sessionName(ex)} — সকল ব্যাচ`;
    const log = (DB().resultLog || []).filter((l) => { const e = exById(l.examId); return e && (!e.session || e.session === session()); }).slice(-40).reverse();
    return `<section class="card rs-review">${filterBar()}
      <div class="ex-etop"><label class="grow">পরীক্ষা নির্বাচন<select data-pick-exam>${[...list].sort(EC.byTitle).map((e) => `<option value="${e.id}"${e.id === ex.id ? " selected" : ""}>${esc(U.examLabel(e))}</option>`).join("")}</select></label>
        <div class="rs-scope"><b>প্রকাশের পরিধি</b>${allOnly ? `<span class="chip">সেশনের সব ক্লাস ব্যাচ একসাথে (${esc(EC.typeName(ex.type))})</span>`
          : `<label><input type="radio" name="scope" value="all"${S.scope !== "batch" ? " checked" : ""}> সেশনের সব ক্লাস ব্যাচ</label><label><input type="radio" name="scope" value="batch"${S.scope === "batch" ? " checked" : ""}> নির্দিষ্ট একটি ক্লাস ব্যাচ</label>
          ${S.scope === "batch" ? `<select data-scope-batch>${X.opt([["", "ব্যাচ বেছে নিন"], ...ps.all.map((b) => [b, X.batchName(b)])], S.scopeBatch)}</select>` : ""}`}</div></div>
      <div class="ex-head">${typeChip(ex.type)}<b>${esc(ex.title)}</b> ${stateChip(ex)}<small>${[U.date(ex.date), EC.sessionName(ex), `পূর্ণমান ${bn(EC.fullOf(ex))}`, scopeName].filter(Boolean).map(esc).join(" · ")}</small></div>
      <div class="rs-checks">${checks.map(([k, t]) => `<p class="rs-c ${k}">${k === "ok" ? "✓" : k === "warn" ? "!" : "✗"} ${t}</p>`).join("")}</div>
      ${(() => {
        // বেছে নেওয়া পরিধির (সব ব্যাচ / একটা ব্যাচ) এখনকার অবস্থা — বাটনেই বোঝা যায় কোনটা হয়ে আছে
        const pubN = sel.filter((b) => ex.published && ex.published[b]).length, st = !sel.length ? "none" : pubN === sel.length ? "full" : pubN ? "part" : "draft";
        const ver = S.verified[ex.id];
        const label = st === "full" ? '<span class="rs-state ok">প্রকাশিত</span>' : st === "part" ? `<span class="rs-state warn">আংশিক প্রকাশিত (${bn(pubN)}/${bn(sel.length)} ব্যাচ)</span>` : '<span class="rs-state">Draft — প্রকাশ হয়নি</span>';
        return `<div class="rs-act"><span class="rs-now">এখন অবস্থা (${esc(scopeName)}):</span>${label}
          <button type="button" class="btn ${ver ? "rs-done" : "line"}" data-verify>${ver ? "✓ যাচাই হয়েছে" : "✓ Verify"}</button>
          <button type="button" class="btn ${st === "full" ? "rs-done" : "gold"}" data-publish${st === "full" ? " disabled" : ""}>${st === "full" ? "✓ প্রকাশিত" : st === "part" ? "বাকি ব্যাচে Publish" : "Publish"}</button>
          <button type="button" class="btn line danger" data-unpublish${st === "draft" || st === "none" ? " disabled" : ""}>Unpublish Result</button>
          <a class="btn line" href="#exams/${ex.id}">✎ নম্বর এন্ট্রি</a></div>`;
      })()}
      <div class="tbl-wrap"><table class="exam-entry-table"><thead><tr><th>ব্যাচ</th><th class="num">শিক্ষার্থী</th><th class="num">নম্বর দেওয়া</th><th class="num">অনুপস্থিত</th><th class="num">বাকি</th><th class="num">পাস</th><th class="num">ফেল</th><th>অবস্থা</th><th></th></tr></thead><tbody>
      ${rows.map((r) => `<tr class="${sel.includes(r.b) ? "rs-sel" : ""}"><td><b>${esc(X.batchName(r.b))}</b></td><td class="num">${bn(r.ids.length)}</td><td class="num">${bn(r.entered)}</td><td class="num">${bn(r.absent)}</td><td class="num${r.pending ? " ex-fail" : ""}">${bn(r.pending)}</td><td class="num">${bn(r.pass)}</td><td class="num">${bn(r.fail)}</td>
        <td>${r.pub ? `<span class="chip ok">প্রকাশিত</span><small>${U.date(r.pub.at.slice(0, 10))}</small>` : '<span class="chip">Draft</span>'}</td>
        <td class="num" style="white-space:nowrap">${r.pub ? `<button type="button" class="btn sm gold" data-sms-batch="${r.b}">📩 ফলাফল SMS</button> ` : ""}${allOnly ? "" : r.pub ? `<button type="button" class="btn line sm danger" data-unpub-one="${r.b}">প্রত্যাহার</button>` : `<button type="button" class="btn gold sm" data-pub-one="${r.b}">প্রকাশ</button>`}</td></tr>`).join("") || '<tr><td colspan="9" class="empty">এই পরীক্ষায় কোনো ব্যাচ নেই</td></tr>'}</tbody></table></div>
      <p class="ex-rule">Publish করলে ঐ ব্যাচের শিক্ষার্থীরা নিজের প্যানেলে নম্বর, পাস-ফেল আর মেধাক্রম দেখবে; প্রকাশিত নম্বর লক থাকে ("পরীক্ষা" পেজে "সংশোধন" চালু করে কারণসহ বদলানো যায়)। Unpublish করলে সাময়িকভাবে লুকানো হয় — নম্বর বা ইতিহাস মুছে না। কিছু ব্যাচ বাকি থাকলে সেশনের মেধাতালিকা "চূড়ান্ত নয়" দেখায়। প্রকাশিত ব্যাচের সারিতে "ফলাফল SMS" চাপলে ঐ ব্যাচের শিক্ষার্থী ও অভিভাবকের নম্বরে নম্বর চলে যায়।</p></section>
    <section class="card" style="margin-top:14px"><h3>এই সেশনের সব পরীক্ষার অবস্থা</h3><div class="tbl-wrap"><table class="exam-entry-table"><thead><tr><th>পরীক্ষা</th><th>তারিখ</th><th class="num">নম্বর দেওয়া</th><th>ব্যাচ অনুযায়ী</th><th>অবস্থা</th><th></th></tr></thead><tbody>
      ${list.map((e) => { const p = pubState(e), s = resOf(e).stats; return `<tr${e.id === ex.id ? ' class="rs-sel"' : ""}><td>${typeChip(e.type)} <b>${esc(e.title)}</b></td><td>${U.date(e.date)}</td><td class="num">${bn(s.sat)}/${bn(s.students)}</td><td>${p.all.map((b) => `<span class="chip ${p.pub.includes(b) ? "ok" : ""}">${esc(X.batchName(b))}</span>`).join(" ")}</td><td>${stateChip(e)}</td><td class="num"><button type="button" class="btn line sm" data-go-exam="${e.id}">খুলুন</button></td></tr>`; }).join("")}</tbody></table></div></section>
    <section class="card" style="margin-top:14px"><h3>Publication History <small class="ln-count">কে কখন কোন ব্যাচের ফলাফল প্রকাশ / প্রত্যাহার / সংশোধন করেছে</small></h3>
      ${log.length ? `<div class="tbl-wrap"><table class="exam-entry-table"><thead><tr><th>সময়</th><th>কাজ</th><th>পরীক্ষা</th><th>ব্যাচ / শিক্ষার্থী</th><th>নোট</th></tr></thead><tbody>${log.map((l) => { const [t, k] = ACTIONS[l.action] || [l.action, ""], e = exById(l.examId) || {}; return `<tr><td>${new Date(l.at).toLocaleString("bn-BD", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</td><td><span class="chip ${k}">${t}</span></td><td>${esc(e.title || "")}</td><td>${esc((l.batchIds || []).map(X.batchName).join(", "))}${l.studentIds ? `<small>${esc(l.studentIds.join(", "))}</small>` : ""}</td><td>${esc(l.note || "")}</td></tr>`; }).join("")}</tbody></table></div>` : empty("এখনো কোনো প্রকাশ বা প্রত্যাহার হয়নি।")}</section>`;
  }
  // ব্যাচের ফলাফল SMS: একজন একজন করে; আগে পেয়েছে (নম্বর না বদলালে) তাকে আবার নয়; পরপর ৩ বার না গেলে থামে (যেমন ব্যালেন্স শেষ)
  async function smsBatch(batchId, btn) {
    const ex = exById(S.examId); if (!ex) return;
    try {
      const pl = await api("/api/admin/results/sms-plan", { body: { examId: ex.id, batchId } });
      const skip = [pl.got && `আগে পেয়েছে ${bn(pl.got)} জন`, pl.pending && `নম্বর বাকি ${bn(pl.pending)} জন`, pl.off && `পড়া বন্ধ ${bn(pl.off)} জন`, pl.noPhone && `মোবাইল নেই ${bn(pl.noPhone)} জন`].filter(Boolean).join(", ");
      if (!pl.todo.length) return toast(skip ? `পাঠানোর মতো কেউ নেই — ${skip}` : "পাঠানোর মতো কেউ নেই", true);
      if (!confirm(`${ex.title} — ব্যাচ ${X.batchName(batchId)}\n\n${bn(pl.todo.length)} জনের ফলাফল ${bn(pl.numbers)}টি নম্বরে যাবে (শিক্ষার্থী ও অভিভাবক)। প্রতিটার জন্য SMS ব্যালেন্স কাটবে।${skip ? `\n\nবাদ যাবে: ${skip}` : ""}\n\nপাঠাবেন?`)) return;
      const label = btn.textContent, failed = [];
      let ok = 0, inRow = 0, why = "";
      btn.disabled = true;
      for (const [i, s] of pl.todo.entries()) {
        btn.textContent = `পাঠানো হচ্ছে ${bn(i + 1)}/${bn(pl.todo.length)}…`;
        try { await api("/api/admin/results/sms", { body: { examId: ex.id, studentId: s.id } }); ok++; inRow = 0; }
        catch (e) { failed.push(s.name); why = e.message; if (++inRow >= 3) break; }
      }
      btn.disabled = false; btn.textContent = label;
      await X.load();
      if (!failed.length) return toast(`${bn(ok)} জনের ফলাফল SMS-এ গেছে`);
      const left = pl.todo.length - ok - failed.length;
      alert(`${bn(ok)} জনের ফলাফল গেছে, ${bn(failed.length)} জনের যায়নি${left ? `, ${bn(left)} জনকে পাঠানো হয়নি` : ""}।\n\nকারণ: ${why}\nযায়নি: ${failed.join(", ")}\n\nআবার চাপলে যারা পায়নি শুধু তাদের কাছে যাবে।`);
    } catch (e) { toast(e.message, true); }
  }
  async function publish(action, batchIds) {
    const ex = exById(S.examId); if (!ex) return;
    if (action === "publish") {
      const R = resOf(ex), pend = (ex.studentIds || []).filter((id) => batchIds.includes(batchOf(id)) && !(R.rows.find((r) => r.sid === id) || {}).attempts && !((ex.marks || {})[id] || []).some((a) => EC.isAbsent(a))).length;
      if (pend && !confirm(`${bn(pend)} জনের নম্বর এখনো দেওয়া হয়নি। তবুও প্রকাশ করবেন?`)) return;
    } else if (!confirm("ফলাফল প্রত্যাহার করবেন? শিক্ষার্থীরা আর দেখতে পাবে না — নম্বর বা ইতিহাস মুছবে না।")) return;
    try {
      await api("/api/admin/results/publish", { body: { examId: ex.id, batchIds, action } });
      await X.load(); render(); toast(action === "publish" ? `ফলাফল প্রকাশিত — ${batchIds.map(X.batchName).join(", ")}` : "ফলাফল প্রত্যাহার করা হয়েছে");
    } catch (e) { toast(e.message, true); }
  }

  // ================= Result Sheets =================
  function examSheet(ex) {
    const ps = EC.parts(ex), R = resOf(ex);
    const bRank = new Map(); // ব্যাচের ভেতরে মেধাক্রম (শুধু পাস)
    for (const b of exBatches(ex)) rankBy(R.rows.filter((r) => !r.absent && r.pass && batchOf(r.sid) === b).map((r) => ({ sid: r.sid, v: r.total + r.cq / 1e4 })), "v").forEach((x) => bRank.set(x.sid, x.vRank));
    let rows = R.rows.filter((r) => !S.f.batch || batchOf(r.sid) === S.f.batch);
    rows = sortRows(rows.map((r) => ({ ...r, id: r.sid, name: stu(r.sid).name, merit: r.rank ? -r.rank : -1e9, val: r.absent ? -1 : r.total })));
    const head = ["সেশন মেধা", "ব্যাচ মেধা", "আইডি", "নাম", "ব্যাচ", ...ps.map((p) => `${p.subject} ${p.part.toUpperCase()}`), "মোট", "%", "ফলাফল"];
    const body = rows.filter(hit).map((r) => [r.rank ? bn(r.rank) : "—", bRank.has(r.sid) ? bn(bRank.get(r.sid)) : "—", r.sid, r.name, X.batchName(batchOf(r.sid)), ...ps.map((p) => (r.absent ? "—" : num2(r.scores[p.key]))), r.absent ? "—" : num2(r.total), r.absent ? "—" : bn(Math.round(r.percent)) + "%", r.absent ? "অনুপস্থিত" : r.pass ? "পাস" : "ফেল"]);
    return { title: `${ex.title} — রেজাল্ট শিট`, sub: `${EC.typeName(ex.type)} · ${U.date(ex.date)} · পূর্ণমান ${bn(EC.fullOf(ex))}${S.f.batch ? " · ব্যাচ " + X.batchName(S.f.batch) : ""}`, head, body, list: [ex] };
  }
  function combinedSheet(kind) {
    const batch = kind === "batch" ? S.f.batch : "";
    const list = withMarks(exams({ batch })).sort(EC.byTitle); // কলাম নামের ক্রমে
    const studs = students(batch);
    const rows = studs.map((s) => ({ id: s.id, name: s.name, batch: s.batchId, ...scoreOf(s.id, list) }));
    const val = S.f.type ? "mean" : "combined";
    // ব্যাচ মেধা ও সেশন মেধা (গড় শতাংশ ধরে)
    const sess = rankBy(students("").map((s) => ({ id: s.id, v: scoreOf(s.id, list)[val] })), "v"), sRank = new Map(sess.map((x) => [x.id, x.vRank]));
    const bRank = new Map();
    for (const b of [...new Set(rows.map((r) => r.batch))]) rankBy(rows.filter((r) => r.batch === b).map((r) => ({ id: r.id, v: r[val] })), "v").forEach((x) => bRank.set(x.id, x.vRank));
    const sorted = sortRows(rows.map((r) => ({ ...r, merit: sRank.has(r.id) ? -sRank.get(r.id) : -1e9, val: r[val] ?? -1 })));
    const short = (e) => (e.title.length > 18 ? e.title.slice(0, 17) + "…" : e.title);
    const head = ["সেশন মেধা", "ব্যাচ মেধা", "আইডি", "নাম", "ব্যাচ", ...list.map(short), "দিয়েছে", S.f.type ? "গড়" : "Combined"];
    const body = sorted.filter(hit).map((r) => [sRank.has(r.id) ? bn(sRank.get(r.id)) : "—", bRank.has(r.id) ? bn(bRank.get(r.id)) : "—", r.id, r.name, X.batchName(r.batch),
      ...list.map((e) => { if (!(e.studentIds || []).includes(r.id)) return "·"; const p = pctIn(e, r.id); return p === null ? "—" : isAbs(e, r.id) ? "অনু" : bn(Math.round(p)) + "%"; }),
      `${bn(r.given)}/${bn(r.total)}`, pct(r[val])]);
    return { title: kind === "batch" ? `ব্যাচ ${X.batchName(batch)} — সম্মিলিত রেজাল্ট` : `${session()} — সম্পূর্ণ সেশনের রেজাল্ট`, sub: `${S.f.type ? EC.typeName(S.f.type) : "সব ধরনের পরীক্ষা (Combined: ভার অনুযায়ী)"} · ${bn(list.length)}টি পরীক্ষা · "অনু" = অনুপস্থিত (০%), "—" = নম্বর বাকি, "·" = এই পরীক্ষায় ছিল না`, head, body, list };
  }
  // খোঁজ: নাম বা আইডি (বাংলা / ইংরেজি সংখ্যা দুটোই)
  const hit = (r) => !S.q || `${r[2] ?? r.id} ${r[3] ?? r.name}`.toLowerCase().includes(enNum(S.q).toLowerCase()) || `${r[3] ?? r.name}`.includes(S.q.trim());
  function sortRows(rows) {
    const k = S.sort;
    return rows.sort((a, b) => (k === "id" ? a.id.localeCompare(b.id) : k === "name" ? String(a.name).localeCompare(String(b.name), "bn") : b.merit - a.merit || b.val - a.val || a.id.localeCompare(b.id)));
  }
  // পরীক্ষা: একটা নির্দিষ্ট পরীক্ষা → সেই পরীক্ষার শিট; "সব" → সম্মিলিত শিট (ব্যাচ বাছা থাকলে ঐ ব্যাচের, না থাকলে পুরো সেশনের)
  function currentSheet() {
    if (S.sheetExam && exams().some((e) => e.id === S.sheetExam)) return examSheet(exById(S.sheetExam));
    S.sheetExam = ""; // ফিল্টার বদলালে যে পরীক্ষা আর তালিকায় নেই
    if (!withMarks(exams()).length) return null;
    return combinedSheet(S.f.batch && !batchLocked() ? "batch" : "session");
  }
  const tableHtml = (sh) => `<div class="tbl-wrap"><table class="exam-entry-table rs-table"><thead><tr>${sh.head.map((h, i) => `<th${i >= 5 && i !== sh.head.length ? ' class="num"' : ""}>${esc(h)}</th>`).join("")}</tr></thead><tbody>${sh.body.map((r) => `<tr>${r.map((c, i) => `<td${i >= 5 ? ' class="num"' : ""}>${c === "ফেল" ? '<span class="chip bad">ফেল</span>' : c === "পাস" ? '<span class="chip ok">পাস</span>' : esc(c)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${sh.head.length}" class="empty">কোনো তথ্য নেই</td></tr>`}</tbody></table></div>`;
  function sheets() {
    const sh = currentSheet(), list = exams().sort(EC.byTitle); // নম্বর না থাকলেও নাম তালিকায় আসে
    return `<section class="card">
      <div class="rs-bar">${filtersHtml()}<label class="grow">পরীক্ষার নাম<select data-sheet-exam><option value="">সব</option>${list.map((e) => `<option value="${e.id}"${e.id === S.sheetExam ? " selected" : ""}>${esc(U.examLabel(e))}</option>`).join("")}</select></label>
        <label>সাজানো<select data-sort>${X.opt([["merit", "মেধা অনুযায়ী"], ["id", "আইডি অনুযায়ী"], ["name", "নাম অনুযায়ী"]], S.sort)}</select></label>
        <label class="grow">খুঁজুন<input data-q value="${esc(S.q)}" placeholder="নাম বা আইডি"></label>
        <span class="rs-btns"><button type="button" class="btn line sm" data-print-sheet>Print / PDF</button><button type="button" class="btn line sm" data-excel-sheet>↓ Excel</button></span></div>
      ${!sh ? empty("এই ফিল্টারে নম্বর দেওয়া কোনো পরীক্ষা নেই।") : `<div class="rs-sheethead"><b>${esc(sh.title)}</b> ${finalNote(sh.list)}<small>${esc(sh.sub)}</small></div>${tableHtml(sh)}`}
      <p class="ex-rule">একটি পরীক্ষার শিটে মেধাক্রম শুধু পাস করা শিক্ষার্থীদের। সম্মিলিত শিটে প্রতিটা পরীক্ষার শতাংশ, আর ${S.f.type ? "ঐ ধরনের পরীক্ষার গড়" : "Combined (সব ধরনের গড় × ভার)"} ধরে ব্যাচ ও সেশনের মেধাক্রম। কোর্সভিত্তিক শিট এখনো নেই — পরীক্ষা এখন সেশন / ব্যাচ ধরে হয়।</p></section>`;
  }

  // ================= Merit List =================
  // সেশন → ব্যাচ → Merit Category → পরীক্ষা নির্বাচন (সব / নির্দিষ্ট একটা)
  // • একটা পরীক্ষা: শুধু পাস করা শিক্ষার্থী, নম্বরের শতাংশ ধরে  • "সব": ঐ ধরনের সব পরীক্ষার গড় শতাংশ (অনুপস্থিত = ০%)
  // • কুইজ: প্রতিটা কুইজে সবচেয়ে ভালো চেষ্টা  • Combined Academic Merit: শুধু Weekly + Monthly + Chapter Final + Model (ভার অনুযায়ী)
  const MCATS = [["weekly", "Weekly Test Merit"], ["monthly", "Monthly Test Merit"], ["chapter", "Chapter Final Merit"], ["model", "Model Test Merit"], ["class", "Class Assessment Merit"], ["gk", "Weekly GK Test Merit"], ["special", "Special Exam Merit"], ["quiz", "Online Quiz Merit"], ["combined", "Combined Academic Merit"]];
  const ALL_LABEL = { weekly: "All Weekly Tests", monthly: "All Monthly Tests", chapter: "All Chapter Finals", model: "All Model Tests", class: "All Class Assessments", gk: "All GK Tests", special: "All Special Exams", quiz: "All Quizzes" };
  const quizzesIn = () => (DB().quizzes || []).filter((q) => (!q.session || q.session === session()) && (!S.f.batch || !(q.batchIds || []).length || q.batchIds.includes(S.f.batch)));
  const quizEligible = (q, s) => (!q.session || q.session === s.session) && (!(q.batchIds || []).length || q.batchIds.includes(s.batchId));
  const quizBest = (q, sid) => { const d = ((q.attempts || {})[sid] || []).filter((a) => a.submittedAt); return d.length ? d.reduce((a, b) => (b.score > a.score ? b : a)) : null; };
  // এই ক্যাটাগরির পরীক্ষা / কুইজের তালিকা (পরীক্ষা নির্বাচনের ঘরে)
  function meritChoices() {
    if (S.mcat === "combined") return [];
    if (S.mcat === "quiz") return quizzesIn().filter((q) => Object.values(q.attempts || {}).some((a) => a.some((x) => x.submittedAt))).map((q) => ({ id: q.id, label: `${q.title}${q.opensAt ? ` (${U.date(q.opensAt.slice(0, 10))})` : ""}` }));
    return withMarks(exams({ anyType: true, type: S.mcat })).sort(EC.byTitle).map((e) => ({ id: e.id, label: U.examLabel(e) }));
  }
  function meritData() {
    const cat = S.mcat, batch = S.f.batch, where = `${session()} • ${batch ? "ব্যাচ " + X.batchName(batch) : "সকল ব্যাচ"}`;
    const choices = meritChoices();
    if (S.mexam && !choices.some((c) => c.id === S.mexam)) S.mexam = "";
    const studs = students(batch);
    const base = (r) => [r.id, r.name, X.batchName(r.batch)];
    // ---- একটা নির্দিষ্ট পরীক্ষা ----
    if (cat !== "quiz" && cat !== "combined" && S.mexam) {
      const ex = exById(S.mexam), R = resOf(ex);
      const rows = R.present.filter((r) => r.pass && (!batch || batchOf(r.sid) === batch)).map((r) => ({ id: r.sid, name: stu(r.sid).name, batch: batchOf(r.sid), r, v: r.percent, k: r.total + r.cq / 1e4 }));
      const ranked = rankBy(rows, "k");
      return { list: [ex], title: ex.title, where, head: ["মেধা", "আইডি", "নাম", "ব্যাচ", "নম্বর", "Score"], body: ranked.map((x) => [x.kRank, ...base(x), `${num2(x.r.total)}/${bn(x.r.full)}`, pct(x.v)]), count: ranked.length, top: ranked.length ? Math.max(...ranked.map((x) => x.v)) : null, note: "একটি পরীক্ষা — শুধু পাস করা শিক্ষার্থী মেধাক্রমে" };
    }
    // ---- কুইজ ----
    if (cat === "quiz") {
      const qs = S.mexam ? quizzesIn().filter((q) => q.id === S.mexam) : quizzesIn();
      if (!qs.length) return null;
      const rows = studs.map((s) => {
        const got = qs.filter((q) => quizEligible(q, s)).map((q) => ({ q, b: quizBest(q, s.id) })), done = got.filter((x) => x.b);
        const v = done.length ? (done.reduce((t, x) => t + (x.b.full ? x.b.score / x.b.full : 0), 0) / done.length) * 100 : null;
        return { id: s.id, name: s.name, batch: s.batchId, v, n: done.length, of: got.length, one: done[0] && done[0].b };
      });
      const ranked = rankBy(rows, "v");
      return { list: [], title: S.mexam ? qs[0].title : ALL_LABEL.quiz, where, head: ["মেধা", "আইডি", "নাম", "ব্যাচ", S.mexam ? "নম্বর" : "দিয়েছে", "Score"],
        body: ranked.map((x) => [x.vRank, ...base(x), S.mexam ? `${num2(x.one.score)}/${num2(x.one.full)}` : `${bn(x.n)}/${bn(x.of)}`, pct(x.v)]), count: ranked.length, top: ranked.length ? Math.max(...ranked.map((x) => x.v)) : null,
        note: S.mexam ? "সবচেয়ে ভালো চেষ্টা ধরে" : "প্রতিটা কুইজে সবচেয়ে ভালো চেষ্টার গড় শতাংশ (যেগুলো দিয়েছে)" };
    }
    // ---- সব পরীক্ষা (এক ধরন) অথবা Combined ----
    const list = cat === "combined" ? withMarks(exams({ anyType: true })).filter((e) => CORE.includes(e.type)) : withMarks(exams({ anyType: true, type: cat }));
    if (!list.length) return null;
    const rows = studs.map((s) => { const sc = scoreOf(s.id, list); return { id: s.id, name: s.name, batch: s.batchId, ...sc, v: cat === "combined" ? sc.combined : sc.mean }; });
    const ranked = rankBy(rows, "v"), typesHere = EC.TYPES.filter(([k]) => CORE.includes(k) && list.some((e) => e.type === k));
    return {
      list, title: cat === "combined" ? "Combined Academic Merit" : ALL_LABEL[cat], where,
      head: ["মেধা", "আইডি", "নাম", "ব্যাচ", "দিয়েছে", ...(cat === "combined" ? typesHere.map(([, t]) => t) : []), "Score"],
      body: ranked.map((x) => [x.vRank, ...base(x), `${bn(x.given)}/${bn(x.total)}`, ...(cat === "combined" ? typesHere.map(([k]) => pct(x.avg[k])) : []), pct(x.v)]),
      count: ranked.length, top: ranked.length ? Math.max(...ranked.map((x) => x.v)) : null,
      note: cat === "combined" ? "Weekly + Monthly + Chapter Final + Model Test-এর গড় শতাংশ × ভার (Class Assessment ও অনলাইন কুইজ গোনা হয় না) · অনুপস্থিত = ০%" : `${bn(list.length)}টি পরীক্ষার গড় শতাংশ · অনুপস্থিত = ০%`,
    };
  }
  // মেধা সার্টিফিকেট: A4 আড়াআড়ি এক পাতা — প্রিন্ট বা PDF হিসেবে সেভ
  function printCertificate(d, row) {
    const [rank, id, name, batch] = row, score = row[row.length - 1], s = stu(id) || {}, set = DB().settings || {}, O = location.origin;
    const w = window.open("", "_blank"); if (!w) return toast("পপ-আপ বন্ধ আছে — ব্রাউজারে পপ-আপের অনুমতি দিন", true);
    const nameSize = String(name).length > 32 ? 34 : String(name).length > 22 ? 42 : 50;
    w.document.write(`<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>${esc(name)} - ${esc(id)} - মেধা সার্টিফিকেট</title>${U.DOC_FONTS}
<style>${U.DOC_CSS}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4 landscape;margin:0}
body{margin:0;background:#e9eef0;font-family:'BnNum','Hind Siliguri','Nirmala UI',sans-serif;color:#16302b}
.cert{position:relative;width:297mm;height:210mm;margin:14px auto;padding:9mm;background:#fff;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.15)}
.cert::before,.cert::after{content:"";position:absolute;width:150mm;height:150mm;border-radius:50%;z-index:0}.cert::before{left:-80mm;top:-90mm;background:#0b3b36}.cert::after{right:-80mm;bottom:-90mm;background:#d9a441}
.fr{position:relative;z-index:1;height:100%;padding:8mm 16mm 7mm;border:1.4mm solid #0b3b36;outline:.5mm solid #d9a441;outline-offset:-3mm;border-radius:3mm;background:#fff;display:flex;flex-direction:column;align-items:center;text-align:center}
.lg{height:29mm;width:auto}.ins{margin:1mm 0 0;font-size:14px;color:#44605a}
h1{margin:3mm 0 0;font:900 46px 'Noto Serif Bengali','Nirmala UI',serif;color:#0b3b36}.rb{width:62mm;height:1mm;margin:1.5mm 0 4mm;background:linear-gradient(90deg,transparent,#d9a441,transparent)}
.lead{margin:0;font-size:18px;color:#33433f}.nm{margin:2mm 0 1mm;font:800 ${nameSize}px 'Noto Serif Bengali','Nirmala UI',serif;color:#9a6a12;line-height:1.25}
.meta{margin:0 0 4mm;font-size:15px;font-weight:600;color:#44605a}.body{max-width:215mm;margin:0;font-size:20px;line-height:1.7;color:#1d2b28}.body b{color:#0b3b36}
.badge{display:inline-block;padding:0 4mm;border-radius:999px;background:#fff0c9;color:#7a5200!important;font-weight:800}
.sg{margin-top:auto;width:100%;display:flex;justify-content:space-between;align-items:flex-end;padding:0 14mm;font-size:14px}.sg>div{width:66mm;position:relative}.sg .sm{position:absolute;left:50%;bottom:100%;transform:translateX(-50%);height:10mm;width:auto}.sg div{text-align:center}.sg .ln{display:block;border-top:.4mm solid #16302b;padding-top:1.5mm;font-weight:700}.sg small{display:block;font-size:12.5px;color:#44605a;font-weight:600}
@media print{body{background:#fff}.pbar{display:none}.cert{margin:0;box-shadow:none;break-after:avoid}}${U.PRINT_BAR_CSS}</style></head><body>${U.PRINT_BAR}
<main class="cert"><div class="fr"><img class="lg" src="${O}/images/logo-receipt.png" alt="শাহিন’স আইসিটি কেয়ার"><p class="ins">${esc(set.address || "মাস্টার কলোনি, মাদারীপুর")} · ০১৭৪৯-১০৫৯০২</p>
<h1>মেধা সার্টিফিকেট</h1><div class="rb"></div><p class="lead">এই মর্মে প্রত্যয়ন করা যাচ্ছে যে</p>
<div class="nm">${esc(name)}</div><p class="meta">আইডি: ${esc(id)}${s.session ? " · সেশন: " + esc(s.session) : ""}${batch ? " · ব্যাচ: " + esc(batch) : ""}</p>
<p class="body">শাহিন’স আইসিটি কেয়ার-এর <b>${esc(d.title)}</b> মেধাতালিকায় <b class="badge">${U.rankName(rank)} স্থান</b> অধিকার করেছে। প্রাপ্ত স্কোর <b>${esc(score)}</b>। আমরা তার উজ্জ্বল ভবিষ্যৎ কামনা করি।</p>
<div class="sg"><div><span class="ln">তারিখ</span><small>${esc(U.date(U.today()))}</small></div><div><img class="sm" src="${O}/images/signature.png" alt=""><span class="ln">Md Shahin Miah</span><small>Mentor-ICT, শাহিন’স আইসিটি কেয়ার</small></div></div></div></main></body></html>`);
    w.document.close();
  }
  function merit() {
    const d = meritData(), w = DB().settings.meritWeights || {}, choices = meritChoices();
    return `<section class="card">
      <div class="rs-bar">${filtersHtml(["session", "batch"])}<label>Merit Category<select data-mcat>${X.opt(MCATS, S.mcat)}</select></label>
        ${S.mcat !== "combined" ? `<label class="grow">পরীক্ষা নির্বাচন<select data-mexam><option value="">${esc(ALL_LABEL[S.mcat])}</option>${choices.map((c) => `<option value="${esc(c.id)}"${c.id === S.mexam ? " selected" : ""}>${esc(c.label)}</option>`).join("")}</select></label>` : ""}
        <span class="rs-btns"><button type="button" class="btn line sm" data-print-merit>Print / PDF</button><button type="button" class="btn line sm" data-excel-merit>↓ Excel</button></span></div>
      ${!d ? empty(S.mcat === "quiz" ? "এই সেশন / ব্যাচে কোনো অনলাইন কুইজ নেই।" : "এই ক্যাটাগরিতে নম্বর দেওয়া কোনো পরীক্ষা নেই।") : `<div class="rs-sel-head"><small>Selected Ranking</small><b>${esc(d.title)}</b><span>${esc(d.where)}</span>
          <span class="rs-sel-nums"><i>মোট শিক্ষার্থী: <b>${bn(d.count)}</b></i><i>সর্বোচ্চ: <b>${pct(d.top)}</b></i></span> ${d.list.length ? finalNote(d.list) : ""}<small class="rs-sel-note">${esc(d.note)}</small></div>
        <div class="tbl-wrap"><table class="exam-entry-table rs-table"><thead><tr>${d.head.map((h, i) => `<th${i >= 4 ? ' class="num"' : ""}>${esc(h)}</th>`).join("")}<th class="num no-print">সার্টিফিকেট</th></tr></thead><tbody>${d.body.map((r) => `<tr class="${r[0] <= 3 ? "rs-top" : ""}">${r.map((c, i) => `<td${i >= 4 ? ' class="num"' : ""}>${i === 0 ? `<b>${U.rankName(c)}</b>` : i === r.length - 1 ? `<b>${esc(c)}</b>` : esc(c)}</td>`).join("")}<td class="num no-print"><button type="button" class="btn line sm" style="white-space:nowrap" data-cert="${esc(r[1])}" title="সার্টিফিকেট প্রিন্ট / PDF">🎓 সার্টিফিকেট</button></td></tr>`).join("") || `<tr><td colspan="${d.head.length + 1}" class="empty">মেধাতালিকায় কেউ নেই</td></tr>`}</tbody></table></div>`}
    </section>
    ${S.mcat === "combined" ? `<section class="card" style="margin-top:14px"><h3>Combined Academic Merit-এর ভার <small class="ln-count">কোন ধরনের পরীক্ষা কতটা গুরুত্ব পাবে (০ = গোনা হবে না)</small></h3>
      <div class="rs-weights">${EC.TYPES.filter(([k]) => CORE.includes(k)).map(([k]) => `<label>${typeChip(k)}<input data-w="${k}" inputmode="decimal" value="${esc(String(w[k] ?? 1))}"></label>`).join("")}<button type="button" class="btn gold" data-save-w>ভার সংরক্ষণ</button></div>
      <p class="ex-sub" style="margin:10px 0 0">যেমন সব ১ হলে চার ধরনের সমান গুরুত্ব; Model Test ২ দিলে সেটা দ্বিগুণ গুরুত্ব পাবে। Class Assessment, অনলাইন কুইজ, হাজিরা বা বাড়ির কাজ এই মেধায় মেশে না।</p></section>` : ""}`;
  }

  // ================= Performance =================
  function perfRows() {
    const list = withMarks(exams({ anyType: true })).filter((e) => !EC.EXTRA_TYPES.includes(e.type)); // জিকে / বিশেষ পরীক্ষা মোট পারফরম্যান্সে নয়
    return students(S.f.batch).map((s) => {
      const sc = scoreOf(s.id, list), at = attOf(s.id), mine = list.filter((e) => pctIn(e, s.id) !== null).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      const ps = mine.map((e) => pctIn(e, s.id)), last = ps.slice(-3), prev = ps.slice(0, -3);
      const trend = last.length && prev.length ? last.reduce((a, b) => a + b, 0) / last.length - prev.reduce((a, b) => a + b, 0) / prev.length : null;
      // অধ্যায় অনুযায়ী (পরীক্ষায় অধ্যায় লেখা থাকলে) — সবচেয়ে দুর্বল
      const ch = {}; mine.forEach((e) => { if (e.chapter) (ch[e.chapter] ||= []).push(pctIn(e, s.id)); });
      const weak = Object.entries(ch).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length]).sort((a, b) => a[1] - b[1])[0];
      const hw = DB().homework || [];
      return { s, sc, at, trend, weak, hw: U.hwRate(hw, s, "homework"), ls: U.hwRate(hw, s, "lesson") };
    });
  }
  const level = (p) => (p === null ? ["—", ""] : p >= 80 ? ["খুব ভালো", "ok"] : p >= 60 ? ["ভালো", "ok"] : p >= 40 ? ["মাঝারি", "warn"] : ["দুর্বল", "bad"]);
  // ---- Class Performance Leaderboard (Performance ট্যাবের ভেতরে) ----
  // Overall = পরীক্ষা (Combined Academic) + হাজিরা + বাড়ির কাজ + পড়া, ভাগ অনুযায়ী (শুরুতে ৪০:২০:২০:২০);
  // কোনো অংশের তথ্য না থাকলে বাকি অংশগুলোর ভাগে হিসাব। র‍্যাঙ্কিংয়ে আসতে কমপক্ষে minDays দিন হাজিরা লাগে।
  const PCATS = [["overall", "Overall Class Performance"], ["points", "মাসিক পয়েন্ট"], ["att", "Attendance"], ["hw", "Homework"], ["lesson", "Lesson"], ["exam", "Academic Exam"], ["all", "সব শিক্ষার্থী"]];
  const perfW = () => ({ exam: 40, att: 20, hw: 20, lesson: 20, minDays: 5, ...(DB().settings.perfWeights || {}) });
  function perfScore(r, cat, w) {
    const c = { exam: r.sc.combined, att: r.at.pct, hw: r.hw.pct, lesson: r.ls.pct };
    if (cat !== "overall") return c[cat] ?? null;
    const ks = Object.keys(c).filter((k) => c[k] !== null && c[k] !== undefined && Number(w[k]) > 0), ws = ks.reduce((t, k) => t + Number(w[k]), 0);
    return ws ? ks.reduce((t, k) => t + c[k] * Number(w[k]), 0) / ws : null;
  }
  function leaderboard() {
    const w = perfW(), cat = S.pcat, rows = perfRows();
    const ok = rows.filter((r) => r.at.total >= w.minDays).map((r) => ({ ...r, id: r.s.id, v: perfScore(r, cat, w) }));
    const ranked = rankBy(ok, "v"), out = rows.filter((r) => !ranked.some((x) => x.s.id === r.s.id));
    const cell = (v, sub) => `<td class="num">${pct(v)}${sub ? `<small>${sub}</small>` : ""}</td>`;
    const comps = (r) => cell(r.sc.combined) + cell(r.at.pct, `${bn(r.at.p)}/${bn(r.at.total)} দিন`) + cell(r.hw.pct, `${bn(r.hw.done)}/${bn(r.hw.done + r.hw.not)}`) + cell(r.ls.pct, `${bn(r.ls.done)}/${bn(r.ls.done + r.ls.not)}`);
    const sub = { att: (r) => `${bn(r.at.p)}/${bn(r.at.total)} দিন`, hw: (r) => `${bn(r.hw.done)}/${bn(r.hw.done + r.hw.not)} কাজ`, lesson: (r) => `${bn(r.ls.done)}/${bn(r.ls.done + r.ls.not)} পড়া`, exam: (r) => `${bn(r.sc.given)}/${bn(r.sc.total)} পরীক্ষা` };
    const why = { overall: `পরীক্ষা ${bn(w.exam)} : হাজিরা ${bn(w.att)} : বাড়ির কাজ ${bn(w.hw)} : পড়া ${bn(w.lesson)} — যে অংশের তথ্য নেই সেটা বাদে বাকিগুলোর ভাগে`, att: "উপস্থিতির হার (উপস্থিত ÷ উপস্থিত + অনুপস্থিত — ছুটির দিন বাদ)", hw: "যাচাই করা বাড়ির কাজের হার — অনুপস্থিত দিন বাদে", lesson: "ক্লাসে পড়া পারার হার — অনুপস্থিত দিন বাদে", exam: "Weekly + Monthly + Chapter Final + Model Test-এর Combined (Class Assessment ও কুইজ নয়)" }[cat];
    return `<section class="card"><div class="rs-sel-head"><small>Class Performance Leaderboard</small><b>${esc((PCATS.find((x) => x[0] === cat) || [])[1] || "")}</b><span>${esc(session())} • ${esc(S.f.batch ? "ব্যাচ " + X.batchName(S.f.batch) : "সকল ব্যাচ")}</span>
        <span class="rs-sel-nums"><i>র‍্যাঙ্কিংয়ে: <b>${bn(ranked.length)}</b></i><i>সর্বোচ্চ: <b>${pct(ranked.length ? Math.max(...ranked.map((x) => x.v)) : null)}</b></i></span><small class="rs-sel-note">${esc(why)} · কমপক্ষে ${bn(w.minDays)} দিন হাজিরা থাকলে তবেই র‍্যাঙ্কিংয়ে</small></div>
      <div class="tbl-wrap"><table class="exam-entry-table rs-table"><thead><tr><th>মেধা</th><th>শিক্ষার্থী</th><th>ব্যাচ</th>${cat === "overall" ? '<th class="num">পরীক্ষা</th><th class="num">হাজিরা</th><th class="num">বাড়ির কাজ</th><th class="num">পড়া</th>' : ""}<th class="num">Score</th></tr></thead><tbody>
      ${ranked.map((r) => `<tr class="${r.vRank <= 3 ? "rs-top" : ""}"><td><b>${U.rankName(r.vRank)}</b></td><td><a href="#results/${esc(r.s.id)}" target="_blank" rel="noopener" title="নতুন ট্যাবে প্রোফাইল" data-profile="${esc(r.s.id)}"><b>${esc(r.s.name)}</b></a><small>${esc(r.s.id)}</small></td><td>${esc(X.batchName(r.s.batchId))}</td>${cat === "overall" ? comps(r) : ""}<td class="num"><b>${pct(r.v)}</b>${cat !== "overall" ? `<small>${sub[cat](r)}</small>` : ""}</td></tr>`).join("") || `<tr><td colspan="${cat === "overall" ? 8 : 4}" class="empty">র‍্যাঙ্কিংয়ে কেউ নেই</td></tr>`}</tbody></table></div>
      ${out.length ? `<h4 class="ex-rh ex-rh-bad">র‍্যাঙ্কিংয়ে নেই (${bn(out.length)} জন)</h4><p class="ex-sub" style="margin:4px 0 0">${out.map((r) => esc(`${r.s.name} (${r.s.id}) — ${r.at.total < w.minDays ? `হাজিরা ${bn(r.at.total)} দিন (কমপক্ষে ${bn(w.minDays)} লাগবে)` : "এই অংশের তথ্য নেই"}`)).join(" · ")}</p>` : ""}</section>
      ${cat === "overall" ? `<section class="card" style="margin-top:14px"><h3>Overall-এর ভাগ ও শর্ত <small class="ln-count">মোট ১০০ হতে হবে না — অনুপাত ধরে হিসাব</small></h3>
        <div class="rs-weights">${[["exam", "পরীক্ষা"], ["att", "হাজিরা"], ["hw", "বাড়ির কাজ"], ["lesson", "পড়া"], ["minDays", "ন্যূনতম হাজিরা (দিন)"]].map(([k, t]) => `<label><span class="chip">${t}</span><input data-pw="${k}" inputmode="numeric" value="${esc(String(w[k]))}"></label>`).join("")}<button type="button" class="btn gold" data-save-pw>সংরক্ষণ</button></div></section>` : ""}`;
  }
  // ---- ★ মাসিক পয়েন্ট: উপস্থিত ১ + বাড়ির কাজ ১ + পড়া পারা ১ (দিনে সর্বোচ্চ ৩), মাস ধরে যোগ ----
  // পয়েন্ট সমান হলে যার উপস্থিতি বেশি সে আগে; ওই মাসে হাজিরা না থাকলে তালিকায় আসে না
  function pointsBoard() {
    const hw = DB().homework || [], sess = students(S.f.batch);
    const months = [...new Set([...Object.keys(DB().attendance || {}).map((k) => k.slice(0, 7)), ...hw.filter((h) => h.session === session()).map((h) => (h.dueDate || h.givenDate || "").slice(0, 7))].filter(Boolean))].sort().reverse();
    if (!months.includes(S.pmonth)) S.pmonth = months.includes(U.today().slice(0, 7)) ? U.today().slice(0, 7) : months[0] || U.today().slice(0, 7);
    const mo = S.pmonth;
    const rows = sess.map((s) => { const at = attOf(s.id, mo), h = U.hwRate(hw, s, "homework", mo), l = U.hwRate(hw, s, "lesson", mo), pts = at.p + h.done + l.done; return { s, at, h, l, pts, id: s.id, v: pts + at.p / 1000 }; });
    const ranked = rankBy(rows.filter((r) => r.at.total + r.at.l > 0), "v"), out = rows.filter((r) => !ranked.includes(r));
    const head = ["মেধা", "ID", "নাম", "ব্যাচ", "উপস্থিত", "বাড়ির কাজ", "পড়া পারা", "মোট পয়েন্ট"];
    S.pointsSheet = { title: `মাসিক পয়েন্ট — ${U.month(mo)}`, sub: `${session()} • ${S.f.batch ? "ব্যাচ " + X.batchName(S.f.batch) : "সকল ব্যাচ"} · উপস্থিত ১ + বাড়ির কাজ ১ + পড়া ১`, head, body: ranked.map((r) => [r.vRank, r.s.id, r.s.name, X.batchName(r.s.batchId), r.at.p, r.h.done, r.l.done, r.pts]) };
    return `<section class="card"><div class="ln-months">${months.map((m) => `<button type="button" data-pmonth="${m}" class="${mo === m ? "on" : ""}">${U.month(m)}</button>`).join("")}</div>
      <div class="rs-sel-head"><small>Monthly Points Ranking</small><b>★ মাসিক পয়েন্ট — ${esc(U.month(mo))}</b><span>${esc(session())} • ${esc(S.f.batch ? "ব্যাচ " + X.batchName(S.f.batch) : "সকল ব্যাচ")}</span>
        <span class="rs-sel-nums"><i>র‍্যাঙ্কিংয়ে: <b>${bn(ranked.length)}</b></i><i>সর্বোচ্চ: <b>${ranked.length ? bn(Math.max(...ranked.map((x) => x.pts))) : "—"}</b></i><span class="rs-btns"><button type="button" class="btn line sm" data-print-points>Print / PDF</button><button type="button" class="btn line sm" data-excel-points>↓ Excel</button></span></span>
        <small class="rs-sel-note">প্রতিদিন: উপস্থিত ১ + বাড়ির কাজ ১ + পড়া পারা ১ = সর্বোচ্চ ৩ পয়েন্ট · অনুপস্থিত / ছুটিতে ০ · সমান পয়েন্টে যার উপস্থিতি বেশি সে আগে</small></div>
      <div class="tbl-wrap"><table class="exam-entry-table rs-table"><thead><tr><th>মেধা</th><th>শিক্ষার্থী</th><th>ব্যাচ</th><th class="num">উপস্থিত</th><th class="num">বাড়ির কাজ</th><th class="num">পড়া পারা</th><th class="num">মোট পয়েন্ট</th></tr></thead><tbody>
      ${ranked.map((r) => `<tr class="${r.vRank <= 3 ? "rs-top" : ""}"><td><b>${U.rankName(r.vRank)}</b></td><td><a href="#results/${esc(r.s.id)}" target="_blank" rel="noopener" title="নতুন ট্যাবে প্রোফাইল" data-profile="${esc(r.s.id)}"><b>${esc(r.s.name)}</b></a><small>${esc(r.s.id)}</small></td><td>${esc(X.batchName(r.s.batchId))}</td>
        <td class="num">${bn(r.at.p)}<small>${bn(r.at.total)} দিনের মধ্যে${r.at.l ? ` · ছুটি ${bn(r.at.l)}` : ""}</small></td><td class="num">${bn(r.h.done)}</td><td class="num">${bn(r.l.done)}</td><td class="num"><b>${bn(r.pts)}</b></td></tr>`).join("") || '<tr><td colspan="7" class="empty">এই মাসে কারো হাজিরা নেই</td></tr>'}</tbody></table></div>
      ${out.length ? `<h4 class="ex-rh ex-rh-bad">এই মাসে হাজিরা নেই (${bn(out.length)} জন)</h4><p class="ex-sub" style="margin:4px 0 0">${out.map((r) => esc(`${r.s.name} (${r.s.id})`)).join(" · ")}</p>` : ""}</section>`;
  }
  function perf() {
    S.pcat ||= "overall";
    const seg = `<div class="rs-seg rs-seg-wrap">${PCATS.map(([k, t]) => `<button type="button" data-pcat="${k}" class="${S.pcat === k ? "on" : ""}">${t}</button>`).join("")}</div>`;
    if (S.pcat === "points") return `<section class="card rs-fcard">${seg}${filterBar(["session", "batch"])}</section>${pointsBoard()}`;
    if (S.pcat !== "all") return `<section class="card rs-fcard">${seg}${filterBar(["session", "batch"])}</section>${leaderboard()}`;
    const rows = perfRows(), ex = rows.map((r) => r.sc.mean).filter((x) => x !== null), at = rows.map((r) => r.at.pct).filter((x) => x !== null);
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    return `<section class="card rs-fcard">${seg}${filterBar(["session", "batch"])}</section><div class="rs-tiles"><span><small>গড় পরীক্ষার নম্বর</small><b>${pct(avg(ex))}</b></span><span><small>গড় উপস্থিতি</small><b>${pct(avg(at))}</b></span><span class="ok"><small>ভালো / খুব ভালো (৬০%+)</small><b>${bn(ex.filter((x) => x >= 60).length)}</b></span><span class="bad"><small>দুর্বল (৪০%-এর কম)</small><b>${bn(ex.filter((x) => x < 40).length)}</b></span></div>
      <section class="card"><h3>শিক্ষার্থীদের অগ্রগতি <small class="ln-count">${esc(S.f.batch ? "ব্যাচ " + X.batchName(S.f.batch) : session())} · নামে চাপ দিলে পুরো প্রোফাইল</small></h3>
      <div class="tbl-wrap"><table class="exam-entry-table"><thead><tr><th>শিক্ষার্থী</th><th>ব্যাচ</th><th class="num">পরীক্ষা দিয়েছে</th><th class="num">পরীক্ষার গড়</th><th class="num">উন্নতি</th><th class="num">উপস্থিতি</th><th class="num">বাড়ির কাজ</th><th class="num">পড়া</th><th>দুর্বল অধ্যায়</th><th>অবস্থা</th></tr></thead><tbody>
      ${rows.map((r) => { const [lv, k] = level(r.sc.mean); return `<tr><td><a href="#results/${esc(r.s.id)}" target="_blank" rel="noopener" title="নতুন ট্যাবে প্রোফাইল" data-profile="${esc(r.s.id)}"><b>${esc(r.s.name)}</b></a><small>${esc(r.s.id)}</small></td><td>${esc(X.batchName(r.s.batchId))}</td><td class="num">${bn(r.sc.given)}/${bn(r.sc.total)}${r.sc.missed ? `<small>মিস ${bn(r.sc.missed)}</small>` : ""}</td><td class="num"><b>${pct(r.sc.mean)}</b></td>
        <td class="num">${r.trend === null ? "—" : `<span class="${r.trend >= 0 ? "rs-up" : "rs-down"}">${r.trend >= 0 ? "▲" : "▼"} ${bn(Math.abs(Math.round(r.trend)))}%</span>`}</td><td class="num">${pct(r.at.pct)}<small>${bn(r.at.p)}/${bn(r.at.total)} দিন</small></td><td class="num">${pct(r.hw.pct)}<small>${bn(r.hw.done)}/${bn(r.hw.done + r.hw.not)}</small></td><td class="num">${pct(r.ls.pct)}<small>${bn(r.ls.done)}/${bn(r.ls.done + r.ls.not)}</small></td><td>${r.weak ? `${esc(r.weak[0])} <small>${pct(r.weak[1])}</small>` : "—"}</td><td>${k ? `<span class="chip ${k}">${lv}</span>` : "—"}</td></tr>`; }).join("") || '<tr><td colspan="10" class="empty">কোনো শিক্ষার্থী নেই</td></tr>'}</tbody></table></div>
      <p class="ex-rule">উন্নতি = শেষ ৩টি পরীক্ষার গড় − আগের পরীক্ষাগুলোর গড়। দুর্বল অধ্যায় দেখাতে পরীক্ষা তৈরির সময় "অধ্যায় / সিলেবাস" ঘরটা পূরণ করুন। বাড়ির কাজ / পড়া = করেছে ÷ (করেছে + করেনি), অনুপস্থিত দিন বাদে — <a href="#homework">বাড়ির কাজ / পড়া</a> পেজ থেকে আসে; পরীক্ষার মেধায় মেশে না।</p></section>`;
  }

  // ================= Individual Result =================
  function profileData(sid) {
    const s = X.studentById(sid); if (!s) return null;
    const list = DB().exams.filter((e) => (e.studentIds || []).includes(sid)).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const sessList = withMarks(DB().exams.filter((e) => !e.session || e.session === s.session));
    const sc = scoreOf(sid, sessList), at = attOf(sid);
    const peers = DB().students.filter((x) => x.status !== "inactive" && x.session === s.session);
    const posIn = (group, key, fl) => { const r = rankBy(group.map((x) => ({ id: x.id, v: scoreOf(x.id, fl)[key] })), "v"); const me = r.find((x) => x.id === sid); return me ? [me.vRank, r.length] : null; };
    const merits = [["Combined (সেশন)", posIn(peers, "combined", sessList)], ["Combined (ব্যাচ)", posIn(peers.filter((x) => x.batchId === s.batchId), "combined", sessList)],
      ...EC.TYPES.map(([k, t]) => [t, posIn(peers, "mean", sessList.filter((e) => e.type === k))])].filter((x) => x[1]);
    const rows = list.map((e) => { const r = resOf(e).rows.find((x) => x.sid === sid) || EC.studentResult(e, sid); return { e, r, p: pctIn(e, sid), abs: isAbs(e, sid), pub: !!(e.published && e.published[s.batchId]) }; });
    // হাজিরা: মাস অনুযায়ী, আর কোন কোন দিন অনুপস্থিত / ছুটি
    const months = {}, days = [];
    for (const [k, m] of Object.entries(DB().attendance || {})) {
      const v = m[sid]; if (!v) continue;
      const mo = k.slice(0, 7); (months[mo] ||= { p: 0, a: 0, l: 0, absent: [], late: [] });
      if (v === "P") months[mo].p++; else if (v === "A") { months[mo].a++; months[mo].absent.push(k.slice(0, 10)); } else { months[mo].l++; months[mo].late.push(k.slice(0, 10)); }
      days.push(k.slice(0, 10));
    }
    // বাড়ির কাজ / পড়া: প্রতিটা কাজ আর তার অবস্থা
    const hwAll = (DB().homework || []).filter((h) => U.hwFor(h, s)).sort((a, b) => (b.dueDate || b.givenDate || "").localeCompare(a.dueDate || a.givenDate || ""));
    const hw = U.hwRate(DB().homework, s, "homework"), ls = U.hwRate(DB().homework, s, "lesson");
    // Class Performance-এ অবস্থান (Performance ট্যাবের একই নিয়ম — কমপক্ষে minDays দিন হাজিরা)
    const w = perfW(), prow = (x) => ({ id: x.id, sc: scoreOf(x.id, sessList), at: attOf(x.id), hw: U.hwRate(DB().homework, x, "homework"), ls: U.hwRate(DB().homework, x, "lesson") });
    const pr = peers.map(prow), perfPos = [["Overall Performance", "overall"], ["Attendance", "att"], ["Homework", "hw"], ["Lesson", "lesson"]].map(([t, cat]) => {
      const r = rankBy(pr.filter((x) => x.at.total >= w.minDays).map((x) => ({ id: x.id, v: perfScore(x, cat, w) })), "v"), me = r.find((x) => x.id === sid);
      return [t, me ? [me.vRank, r.length] : null];
    });
    return { s, sc, at, merits, rows, months, hwAll, hw, ls, perfPos, minDays: w.minDays };
  }
  function chartSvg(rows) {
    const pts = rows.filter((x) => x.p !== null); if (!pts.length) return "";
    const W = 640, H = 170, pad = 26, step = (W - pad * 2) / Math.max(1, pts.length - 1);
    const xy = pts.map((x, i) => [pad + (pts.length === 1 ? (W - pad * 2) / 2 : i * step), H - pad - (x.p / 100) * (H - pad * 2)]);
    return `<svg class="rs-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="পরীক্ষার শতাংশ — সময়ের সাথে">${[0, 50, 100].map((v) => { const y = H - pad - (v / 100) * (H - pad * 2); return `<line x1="${pad}" x2="${W - pad}" y1="${y}" y2="${y}" class="g"/><text x="2" y="${y + 4}">${bn(v)}%</text>`; }).join("")}
      <polyline points="${xy.map((p) => p.join(",")).join(" ")}" class="l"/>${xy.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="5" style="fill:${TYPE_C[pts[i].e.type]}"><title>${esc(pts[i].e.title)}: ${Math.round(pts[i].p)}%</title></circle>`).join("")}</svg>`;
  }
  // কোন কোন অনলাইন কুইজ এই শিক্ষার্থীর জন্য, আর তার সবচেয়ে ভালো চেষ্টা
  function quizRowsOf(s) {
    return (DB().quizzes || []).filter((q) => q.live && (!q.session || q.session === s.session) && (!(q.batchIds || []).length || q.batchIds.includes(s.batchId)))
      .map((q) => { const d = ((q.attempts || {})[s.id] || []).filter((a) => a.submittedAt); return { q, best: d.length ? d.reduce((a, b) => (b.score > a.score ? b : a)) : null, n: d.length }; })
      .sort((a, b) => String(b.q.opensAt || "").localeCompare(String(a.q.opensAt || "")));
  }
  // examsOnly = একক রেজাল্ট: শুধু পরীক্ষা (সব ধরন + অনলাইন কুইজ) — হাজিরা, বাড়ির কাজ, পড়া নেই
  function profileHtml(d, examsOnly) {
    const { s, sc, at, merits, rows, months } = d;
    const byType = EC.TYPES.map(([k, t]) => [k, t, rows.filter((x) => x.e.type === k)]).filter((x) => x[2].length);
    const qz = examsOnly ? quizRowsOf(s) : [];
    return `<div class="rs-prof"><img src="${s.photo ? `/api/admin/photo/s/${encodeURIComponent(s.id)}` : U.avatarSrc(s.gender)}" alt=""><div><h2>${esc(s.name)}</h2><p>${esc(s.id)} · ${esc(s.session || "")} · ব্যাচ ${esc(X.batchName(s.batchId))}</p></div></div>
      <div class="rs-tiles"><span><small>পরীক্ষার গড়</small><b>${pct(sc.mean)}</b></span><span><small>Combined</small><b>${pct(sc.combined)}</b></span><span><small>পরীক্ষা দিয়েছে / মিস</small><b>${bn(sc.given)} / ${bn(sc.missed)}</b></span>${examsOnly
        ? `<span><small>মোট পরীক্ষা</small><b>${bn(rows.length)}</b></span>${qz.length ? `<span><small>অনলাইন কুইজ দিয়েছে</small><b>${bn(qz.filter((x) => x.best).length)}/${bn(qz.length)}</b></span>` : ""}`
        : `<span><small>উপস্থিতি</small><b>${pct(at.pct)}</b><i class="rs-ti">${bn(at.p)}/${bn(at.total)} দিন · অনুপস্থিত ${bn(at.a)}</i></span><span><small>বাড়ির কাজ</small><b>${pct(d.hw.pct)}</b><i class="rs-ti">করেছে ${bn(d.hw.done)}/${bn(d.hw.done + d.hw.not)}${d.hw.pending ? ` · যাচাই বাকি ${bn(d.hw.pending)}` : ""}</i></span><span><small>পড়া</small><b>${pct(d.ls.pct)}</b><i class="rs-ti">পেরেছে ${bn(d.ls.done)}/${bn(d.ls.done + d.ls.not)}${d.ls.pending ? ` · যাচাই বাকি ${bn(d.ls.pending)}` : ""}</i></span>`}</div>
      ${merits.length ? `<div class="rs-merits">${merits.map(([t, [r, n]]) => `<span><small>${esc(t)}</small><b>${r === 1 ? "১ম " : ""}${bn(r)}<i>/${bn(n)}</i></b></span>`).join("")}</div>` : ""}
      ${!examsOnly && d.perfPos ? `<div class="rs-merits rs-merits-perf"><span class="rs-mh"><small>Class Performance</small><b>অবস্থান</b></span>${d.perfPos.map(([t, p]) => `<span><small>${esc(t)}</small>${p ? `<b>${p[0] === 1 ? "১ম " : ""}${bn(p[0])}<i>/${bn(p[1])}</i></b>` : `<b class="rs-na">—</b><i class="rs-ti">${at.total < d.minDays ? `${bn(d.minDays)} দিন হাজিরা লাগবে` : "তথ্য নেই"}</i>`}</span>`).join("")}</div>` : ""}
      ${chartSvg(rows) ? `<section class="card"><h3>অগ্রগতি — প্রতিটা পরীক্ষার শতাংশ</h3>${chartSvg(rows)}<p class="ex-sub" style="margin:4px 0 0">${EC.TYPES.map(([k, t]) => `<span class="ex-key" style="--k:${TYPE_C[k]}"><i></i>${esc(t)}</span>`).join(" ")}</p></section>` : ""}
      ${byType.map(([k, t, list]) => `<section class="card" style="margin-top:12px"><h3>${typeChip(k)} ${esc(t)} <small class="ln-count">${bn(list.length)}টি</small></h3><div class="tbl-wrap"><table class="exam-entry-table"><thead><tr><th>পরীক্ষা</th><th>তারিখ</th><th>নম্বর</th><th class="num">মোট</th><th class="num">%</th><th>ফলাফল</th><th class="num">মেধা</th><th>প্রকাশ</th></tr></thead><tbody>
        ${list.map(({ e, r, p, abs, pub }) => { const ps = EC.parts(e); return `<tr><td><b>${esc(e.title)}</b>${e.chapter ? `<small>${esc(e.chapter)}</small>` : ""}</td><td>${U.date(e.date)}</td><td>${r.absent ? (abs ? "অনুপস্থিত" : "নম্বর বাকি") : `<small>${ps.map((pp) => `${esc(pp.part.toUpperCase())} ${num2(r.scores[pp.key])}`).join(" · ")}${r.attempts > 1 || EC.attemptsOf(e) > 1 ? ` (${bn(r.attempts)}বারের গড়)` : ""}</small>`}</td>
          <td class="num">${r.absent ? "—" : `${num2(r.total)}/${bn(r.full)}`}</td><td class="num">${p === null ? "—" : bn(Math.round(p)) + "%"}</td><td>${r.absent ? "—" : r.pass ? '<span class="chip ok">পাস</span>' : '<span class="chip bad">ফেল</span>'}</td><td class="num">${r.rank ? bn(r.rank) : "—"}</td><td>${pub ? '<span class="chip ok">প্রকাশিত</span>' : '<span class="chip">Draft</span>'}</td></tr>`; }).join("")}</tbody></table></div></section>`).join("") || `<section class="card">${empty("এই শিক্ষার্থী এখনো কোনো পরীক্ষায় নেই।")}</section>`}
      ${qz.length ? `<section class="card" style="margin-top:12px"><h3>অনলাইন কুইজ <small class="ln-count">${bn(qz.length)}টি · মূল পরীক্ষার মেধায় মেশে না</small></h3><div class="tbl-wrap"><table class="exam-entry-table"><thead><tr><th>কুইজ</th><th>তারিখ</th><th class="num">নম্বর</th><th class="num">%</th><th class="num">সঠিক</th><th class="num">ভুল</th><th class="num">উত্তর দেয়নি</th><th class="num">কতবার</th></tr></thead><tbody>
        ${qz.map(({ q, best, n }) => `<tr><td><b>${esc(q.title)}</b><small>${esc([q.subject, q.chapter, q.negative ? `নেগেটিভ −${num2(q.negValue)}` : ""].filter(Boolean).join(" · "))}</small></td><td>${q.opensAt ? U.date(q.opensAt.slice(0, 10)) : "—"}</td>${best ? `<td class="num"><b>${num2(best.score)}</b>/${num2(best.full)}</td><td class="num">${bn(Math.round(best.full ? (best.score / best.full) * 100 : 0))}%</td><td class="num">${bn(best.correct)}</td><td class="num">${bn(best.wrong)}</td><td class="num">${bn(best.skipped)}</td><td class="num">${bn(n)}</td>` : '<td class="num" colspan="6"><span class="chip">দেয়নি</span></td>'}</tr>`).join("")}</tbody></table></div></section>` : ""}
      ${examsOnly ? "" : `<section class="card" style="margin-top:12px"><h3>হাজিরা — মাস অনুযায়ী <small class="ln-count">হিসাবে ধরা ${bn(at.total)} দিন · উপস্থিত ${bn(at.p)} · ছুটি ${bn(at.l)} · অনুপস্থিত ${bn(at.a)}</small></h3>${Object.keys(months).length ? `<div class="rs-months">${Object.entries(months).sort().reverse().map(([mo, v]) => { const t = v.p + v.a, dd = (l) => l.sort().map((x) => bn(Number(x.slice(8)))).join(", "); return `<span><small>${U.month(mo)}</small><b>${pct(t ? (v.p / t) * 100 : null)}</b><i>উপস্থিত ${bn(v.p)} · অনুপস্থিত ${bn(v.a)} · ছুটি ${bn(v.l)}</i>${v.absent.length ? `<i class="rs-abs">অনুপস্থিত: ${dd(v.absent)} তারিখ</i>` : ""}${v.late.length ? `<i class="rs-late">ছুটি: ${dd(v.late)} তারিখ</i>` : ""}</span>`; }).join("")}</div>` : empty("হাজিরার তথ্য নেই।")}</section>
      ${[["homework", "বাড়ির কাজ", "করেছে", "করেনি"], ["lesson", "পড়া", "পেরেছে", "পারেনি"]].map(([k, t, yes, no]) => { const l = d.hwAll.filter((h) => h.kind === k); return `<section class="card" style="margin-top:12px"><h3>${t} <small class="ln-count">${bn(l.length)}টি · ${k === "homework" ? `করেছে ${bn(d.hw.done)}, করেনি ${bn(d.hw.not)}, অনুপস্থিত ${bn(d.hw.absent)}` : `পেরেছে ${bn(d.ls.done)}, পারেনি ${bn(d.ls.not)}, অনুপস্থিত ${bn(d.ls.absent)}`}</small></h3>
        ${l.length ? `<div class="tbl-wrap"><table class="exam-entry-table"><thead><tr><th>${k === "homework" ? "কাজ" : "পড়া"}</th><th>দেওয়া</th><th>${k === "homework" ? "জমা" : "পড়া দেওয়ার তারিখ"}</th><th>অবস্থা</th></tr></thead><tbody>${l.map((h) => { const v = (h.checks || {})[s.id]; return `<tr><td><b>${esc(h.title)}</b>${h.chapter || h.subject ? `<small>${esc([h.subject, h.chapter].filter(Boolean).join(" · "))}</small>` : ""}</td><td>${U.date(h.givenDate)}</td><td>${h.dueDate ? U.date(h.dueDate) : "—"}</td><td>${v === "done" ? `<span class="chip ok">✓ ${yes}</span>` : v === "not" ? `<span class="chip bad">✗ ${no}</span>` : v === "absent" ? '<span class="chip">অনুপস্থিত</span>' : '<span class="chip warn">যাচাই হয়নি</span>'}</td></tr>`; }).join("")}</tbody></table></div>` : empty(`এখনো কোনো ${k === "homework" ? "বাড়ির কাজ" : "পড়া"} দেওয়া হয়নি।`)}</section>`; }).join("")}`}`;
  }
  // আইডি দিয়ে সরাসরি, অথবা সেশন → ব্যাচ → শিক্ষার্থী বেছে
  function profile() {
    const studs = students(S.f.batch), cur = S.pid && X.studentById(S.pid);
    // আইডি দিয়ে খোঁজা শিক্ষার্থী (নিষ্ক্রিয় হলেও) তালিকায় রাখা হয়
    if (cur && !studs.some((s) => s.id === cur.id) && cur.session === session() && (!S.f.batch || cur.batchId === S.f.batch)) studs.unshift(cur);
    if (!studs.some((s) => s.id === S.pid)) S.pid = (studs[0] || {}).id || "";
    const d = S.pid && profileData(S.pid);
    return `<section class="card"><div class="rs-bar"><label>আইডি দিয়ে খুঁজুন<span class="rs-idfind"><input data-one-id inputmode="numeric" placeholder="যেমন: 270001" autocomplete="off"><button type="button" class="btn gold sm" data-one-go>খুঁজুন</button></span></label>
        <span class="rs-or">অথবা</span>${filtersHtml(["session", "batch"])}<label class="grow">শিক্ষার্থী নির্বাচন করুন<select data-one>${studs.map((s) => `<option value="${esc(s.id)}"${s.id === S.pid ? " selected" : ""}>${esc(`${s.id} — ${s.name} (${X.batchName(s.batchId)})`)}</option>`).join("") || '<option value="">এই ব্যাচে শিক্ষার্থী নেই</option>'}</select></label>
        <span class="rs-btns">${d ? '<button type="button" class="btn line sm" data-print-one>Print / PDF</button><button type="button" class="btn gold sm" data-print-profile>Student’s Progress Report</button>' : ""}</span></div></section>
      ${d ? `<div style="margin-top:14px">${profileHtml(d)}</div>` : `<section class="card" style="margin-top:14px">${empty("একজন শিক্ষার্থী বেছে নিন।")}</section>`}`;
  }

  // ================= Online Quiz =================
  // কুইজের ফলাফল আলাদা — মূল সব ধরনের পরীক্ষার মেধায় মেশে না
  // ব্যাচের ঘরে "অনলাইন শিক্ষার্থী" — ব্যাচের বাইরে থেকে /quiz পেজে যারা কুইজ দিয়েছে (শুধু এই ট্যাবে)
  const quizBar = () => `<div class="rs-bar">${filtersHtml(["session"])}<label>ব্যাচ<select data-qwho>${X.opt([["", "সব ব্যাচ"], ...DB().batches.filter((b) => b.session === session()).map((b) => [b.id, U.batchLabel(b)]), ["online", "অনলাইন শিক্ষার্থী (ব্যাচের বাইরে)"]], S.qOnline ? "online" : S.f.batch)}</select></label></div>`;
  function quizOnline() {
    const guests = DB().quizGuests || [], isG = (sid) => guests.some((g) => g.id === sid);
    const list = (DB().quizzes || []).filter((q) => (!q.session || q.session === session()) && (q.open || Object.keys(q.attempts || {}).some(isG)));
    if (!list.length) return `<section class="card">${quizBar()}${empty('এই সেশনে ব্যাচের বাইরের শিক্ষার্থীদের জন্য খোলা কোনো কুইজ নেই। কুইজের সেটিংসে "ব্যাচের বাইরের (অনলাইন) শিক্ষার্থীরাও দিতে পারবে" টিক দিন — <a href="#quiz">অনলাইন কুইজ</a>।')}</section>`;
    const best = (q, sid) => { const d = ((q.attempts || {})[sid] || []).filter((a) => a.submittedAt); return d.length ? d.reduce((a, b) => (b.score > a.score ? b : a)) : null; };
    const rows = guests.map((g) => { const got = list.map((q) => best(q, g.id)).filter(Boolean); return { g, n: got.length, pct: got.length ? (got.reduce((t, a) => t + (a.full ? a.score / a.full : 0), 0) / got.length) * 100 : null }; }).filter((r) => r.n);
    const ranked = rankBy(rows.map((r) => ({ ...r, v: r.pct })), "v");
    S.quizSheet = { head: ["মেধা", "আইডি", "নাম", "এইচএসসি ব্যাচ", "গ্রুপ", "কলেজ", "মোবাইল", "কুইজ দিয়েছে", "গড়"], body: ranked.map((r) => [r.vRank, r.g.id, r.g.name, r.g.hsc, r.g.group, r.g.college, r.g.phone, `${r.n}/${list.length}`, pct(r.v)]) };
    return `<section class="card">${quizBar()}<h3>অনলাইন শিক্ষার্থীদের কুইজ ফলাফল <small class="ln-count">ব্যাচের বাইরে থেকে <a href="/quiz" target="_blank">/quiz</a> পেজে দেওয়া · ${bn(list.length)}টি কুইজ · বিস্তারিত: <a href="#quiz">অনলাইন কুইজ → ফলাফল</a></small></h3>
      <div class="tbl-wrap"><table class="exam-entry-table"><thead><tr><th>কুইজ</th><th class="num">প্রশ্ন</th><th>নেগেটিভ</th><th class="num">দিয়েছে</th><th class="num">গড়</th><th class="num">সর্বোচ্চ</th></tr></thead><tbody>
      ${list.map((q) => { const sc = guests.map((g) => best(q, g.id)).filter(Boolean).map((a) => a.score), full = q.questions.length * q.mark; return `<tr><td><b>${esc(q.title)}</b><small>${esc([q.subject, q.chapter].filter(Boolean).join(" · "))}${q.open ? "" : " · এখন শুধু ব্যাচের জন্য"}</small></td><td class="num">${bn(q.questions.length)}</td><td>${q.negative ? `−${num2(q.negValue)}` : "নেই"}</td><td class="num">${bn(sc.length)} জন</td><td class="num">${sc.length ? num2(sc.reduce((a, b) => a + b, 0) / sc.length) + "/" + num2(full) : "—"}</td><td class="num">${sc.length ? num2(Math.max(...sc)) : "—"}</td></tr>`; }).join("")}</tbody></table></div></section>
      <section class="card" style="margin-top:14px"><div class="qz-head"><h3>Quiz Merit — অনলাইন শিক্ষার্থী <small class="ln-count">প্রতিটা কুইজে সবচেয়ে ভালো চেষ্টার শতাংশের গড়</small></h3><span class="rs-btns"><button type="button" class="btn line sm" data-print-qsheet>Print / PDF</button><button type="button" class="btn line sm" data-excel-qsheet>↓ Excel</button></span></div>
      <div class="tbl-wrap"><table class="exam-entry-table"><thead><tr><th>মেধা</th><th>আইডি</th><th>নাম</th><th>এইচএসসি ব্যাচ · গ্রুপ</th><th>কলেজ</th><th>মোবাইল</th><th class="num">কুইজ দিয়েছে</th><th class="num">গড়</th></tr></thead><tbody>
      ${ranked.map((r) => `<tr class="${r.vRank <= 3 ? "rs-top" : ""}"><td><b>${U.rankName(r.vRank)}</b></td><td>${esc(r.g.id)}</td><td><b>${esc(r.g.name)}</b></td><td>${esc(r.g.hsc)} · ${esc(r.g.group)}</td><td>${esc(r.g.college)}</td><td><a href="tel:${esc(r.g.phone)}">${esc(r.g.phone)}</a></td><td class="num">${bn(r.n)}/${bn(list.length)}</td><td class="num"><b>${pct(r.v)}</b></td></tr>`).join("") || '<tr><td colspan="8" class="empty">এখনো কোনো অনলাইন শিক্ষার্থী এই কুইজগুলো দেয়নি</td></tr>'}</tbody></table></div></section>`;
  }
  function quiz() {
    if (S.qOnline) return quizOnline();
    const list = (DB().quizzes || []).filter((q) => (!q.session || q.session === session()) && (!S.f.batch || !(q.batchIds || []).length || q.batchIds.includes(S.f.batch)));
    if (!list.length) return `<section class="card">${quizBar()}${empty('এই সেশনে কোনো অনলাইন কুইজ নেই। কুইজ তৈরি করুন <a href="#quiz">অনলাইন কুইজ</a> থেকে।')}</section>`;
    const best = (q, sid) => { const d = ((q.attempts || {})[sid] || []).filter((a) => a.submittedAt); return d.length ? d.reduce((a, b) => (b.score > a.score ? b : a)) : null; };
    const studs = students(S.f.batch);
    const rows = studs.map((s) => { const got = list.map((q) => best(q, s.id)).filter(Boolean); return { s, n: got.length, pct: got.length ? (got.reduce((t, a) => t + (a.full ? a.score / a.full : 0), 0) / got.length) * 100 : null }; });
    const ranked = rankBy(rows.map((r) => ({ ...r, v: r.pct })), "v"), rk = new Map(ranked.map((r) => [r.s.id, r.vRank]));
    return `<section class="card">${quizBar()}<h3>Online Quiz Results <small class="ln-count">${bn(list.length)}টি কুইজ · মূল পরীক্ষার মেধায় মেশে না · বিস্তারিত: <a href="#quiz">অনলাইন কুইজ → ফলাফল</a></small></h3>
      <div class="tbl-wrap"><table class="exam-entry-table"><thead><tr><th>কুইজ</th><th class="num">প্রশ্ন</th><th>নেগেটিভ</th><th class="num">দিয়েছে</th><th class="num">গড়</th><th class="num">সর্বোচ্চ</th></tr></thead><tbody>
      ${list.map((q) => { const sc = studs.map((s) => best(q, s.id)).filter(Boolean).map((a) => a.score), full = q.questions.length * q.mark; return `<tr><td><b>${esc(q.title)}</b><small>${esc([q.subject, q.chapter].filter(Boolean).join(" · "))}</small></td><td class="num">${bn(q.questions.length)}</td><td>${q.negative ? `−${num2(q.negValue)}` : "নেই"}</td><td class="num">${bn(sc.length)}/${bn(studs.filter((s) => !(q.batchIds || []).length || q.batchIds.includes(s.batchId)).length)}</td><td class="num">${sc.length ? num2(sc.reduce((a, b) => a + b, 0) / sc.length) + "/" + num2(full) : "—"}</td><td class="num">${sc.length ? num2(Math.max(...sc)) : "—"}</td></tr>`; }).join("")}</tbody></table></div></section>
      <section class="card" style="margin-top:14px"><h3>Quiz Merit — সব কুইজ মিলিয়ে <small class="ln-count">প্রতিটা কুইজে সবচেয়ে ভালো চেষ্টার শতাংশের গড়</small></h3>
      <div class="tbl-wrap"><table class="exam-entry-table"><thead><tr><th>মেধা</th><th>আইডি</th><th>নাম</th><th>ব্যাচ</th><th class="num">কুইজ দিয়েছে</th><th class="num">গড়</th></tr></thead><tbody>
      ${rows.slice().sort((a, b) => (rk.get(a.s.id) || 1e9) - (rk.get(b.s.id) || 1e9)).map((r) => `<tr><td><b>${rk.has(r.s.id) ? bn(rk.get(r.s.id)) : "—"}</b></td><td>${esc(r.s.id)}</td><td>${esc(r.s.name)}</td><td>${esc(X.batchName(r.s.batchId))}</td><td class="num">${bn(r.n)}/${bn(list.length)}</td><td class="num">${pct(r.pct)}</td></tr>`).join("")}</tbody></table></div></section>`;
  }

  // ================= Talent Hunt — একদম আলাদা ফলাফল (কোনো পরীক্ষার মেধায় মেশে না) =================
  function talent() {
    const hunts = [...(DB().talentHunts || [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (!hunts.length) return `<section class="card">${empty('এখনো কোনো ট্যালেন্ট হান্ট নেই — <a href="#talent">ট্যালেন্ট হান্ট</a> থেকে তৈরি করুন।')}</section>`;
    const regs = (h) => (DB().thRegs || []).filter((r) => r.huntId === h.id);
    const full = (h) => (h.subjects || []).reduce((t, s) => t + (Number(s.full) || 0), 0);
    const tot = (h, r) => (h.subjects || []).reduce((t, s) => t + (Number((r.marks || {})[s.name]) || 0), 0);
    const merit = (h) => { const rows = regs(h).filter((r) => !r.absent && r.marks && Object.keys(r.marks).length).map((r) => ({ r, t: tot(h, r) })).sort((a, b) => b.t - a.t); let rank = 0, prev = null; rows.forEach((x, i) => { if (x.t !== prev) { rank = i + 1; prev = x.t; } x.rank = rank; }); return rows; };
    return hunts.map((h) => { const M = merit(h), R = regs(h), F = full(h); return `<section class="card" style="margin-bottom:14px"><div class="qz-head"><div><h3>${esc(h.title)} <small class="ln-count">কোড ${esc(h.code)} · ${h.examDate ? U.date(h.examDate) : "তারিখ নেই"} · পূর্ণমান ${bn(F)}</small></h3>
        <p class="ex-sub" style="margin:0">রেজিস্ট্রেশন ${bn(R.length)} · নম্বর দেওয়া ${bn(R.filter((r) => r.absent || (r.marks && Object.keys(r.marks).length)).length)} · ${h.resultPublished ? '<span class="chip ok">ওয়েবসাইটে প্রকাশিত</span>' : '<span class="chip">প্রকাশ হয়নি</span>'}</p></div>
        <a class="btn gold sm" href="#talent/${h.id}">নম্বর দিন / প্রকাশ করুন →</a></div>
      <div class="tbl-wrap"><table class="exam-entry-table rs-table"><thead><tr><th>মেধা</th><th>রোল</th><th>নাম</th><th>প্রতিষ্ঠান</th><th class="num">মোট</th><th class="num">%</th></tr></thead><tbody>
      ${M.slice(0, 10).map((x) => `<tr class="${x.rank <= 3 ? "rs-top" : ""}"><td><b>${U.rankName(x.rank)}</b></td><td>${esc(x.r.roll)}</td><td><b>${esc(x.r.name)}</b></td><td>${esc(x.r.college || "—")}</td><td class="num"><b>${bn(String(x.t))}</b>/${bn(F)}</td><td class="num">${bn(Math.round((x.t / F) * 100))}%</td></tr>`).join("") || '<tr><td colspan="6" class="empty">এখনো নম্বর দেওয়া হয়নি</td></tr>'}</tbody></table></div>
      ${M.length > 10 ? `<p class="ex-sub" style="margin:8px 0 0">প্রথম ১০ জন দেখানো হলো — পুরো তালিকা <a href="#talent/${h.id}">ট্যালেন্ট হান্ট পেজে</a>।</p>` : ""}</section>`; }).join("");
  }

  // ================= Reports & PDF =================
  function reports() {
    const list = withMarks(exams()), batches = DB().batches.filter((b) => b.session === session());
    const card = (t, d, controls, btn) => `<div class="rs-rep"><b>${t}</b><small>${d}</small><div class="rs-rep-ctl">${controls}</div><button type="button" class="btn gold sm" data-rep="${btn}">Print / PDF</button></div>`;
    return `<section class="card"><div class="rs-bar" style="justify-content:center">${filtersHtml()}<label>পাতা<select data-land>${X.opt([["0", "A4 Portrait (খাড়া)"], ["1", "A4 Landscape (আড়াআড়ি)"]], S.land ? "1" : "0")}</select></label><span class="ex-sub" style="margin:0;flex-basis:100%;text-align:center">প্রিন্ট উইন্ডোতে "Save as PDF" বেছে নিলে PDF হয়। প্রতিটা রিপোর্টে লোগো, প্রতিষ্ঠানের নাম আর স্বাক্ষরের জায়গা থাকে।</span></div>
      <div class="rs-reps">
        ${card("Individual Exam Result", "একটি পরীক্ষার পূর্ণ রেজাল্ট", `<select data-rep-exam>${[...list].sort(EC.byTitle).map((e) => `<option value="${e.id}"${e.id === S.sheetExam ? " selected" : ""}>${esc(U.examLabel(e))}</option>`).join("")}</select>`, "exam")}
        ${card("Batch Result Sheet", "একটি ব্যাচের সম্মিলিত রেজাল্ট", `<select data-rep-batch>${X.opt(batches.map((b) => [b.id, U.batchLabel(b)]), S.f.batch || (batches[0] || {}).id)}</select>`, "batch")}
        ${card("Session Result Sheet", "পুরো সেশনের সম্মিলিত রেজাল্ট", `<div class="rs-rep-fix">${esc(session())} — সব ব্যাচ</div>`, "session")}
        ${card("Merit List Report", "মেধাক্রমসহ মেধাতালিকা", '<div class="rs-rep-fix">Merit Lists ট্যাবের ফিল্টার অনুযায়ী</div>', "merit")}
        ${card("Student's Progress Report", "একজন শিক্ষার্থীর পুরো অগ্রগতি — ফল, হাজিরা, বাড়ির কাজ, পরামর্শ", `<input data-rep-sid placeholder="আইডি, যেমন 270001" value="${esc(S.pid)}">`, "student")}
        ${card("Monthly Progress Report", "এক মাসে প্রত্যেকের পরীক্ষার গড় আর হাজিরা", `<input type="month" data-rep-month value="${esc(S.month)}">`, "monthly")}
      </div></section>`;
  }
  function printReport(title, sub, html) {
    X.printDoc(title, `<style>${S.land ? "@page{size:A4 landscape}.pg{max-width:285mm}" : "@page{size:A4}"}.num{text-align:right}td small{display:block;color:#5d7570}h1{font-size:22px}.sub{color:#5d7570;margin:4px 0 12px}.chip{font-weight:700}</style><h1>${esc(title)}</h1><p class="sub">${esc(sub)}</p>${html}<div class="sign"><span>শ্রেণি শিক্ষক</span>${U.sig("কর্তৃপক্ষ")}</div>`);
  }
  // শিক্ষার্থী মূল্যায়ন প্রতিবেদন — সম্ভারুণের "Evaluation" রিপোর্টের ফরম্যাটে, এক পাতা A4:
  // হেডার (বামে "শিক্ষার্থী মূল্যায়ন প্রতিবেদন", মাঝে প্রতিষ্ঠান, ডানে লোগো) → পারফরম্যান্স কার্ড + অবস্থা → ৭টা সংখ্যা →
  // পরীক্ষার অগ্রগতি (শুধু পরীক্ষা) + অধ্যায়ভিত্তিক ফল → সপ্তাহ / মাসের তুলনা → উপস্থিতি + বাড়ির কাজ → পরামর্শ + অভিভাবকের প্রতি অনুরোধ → স্বাক্ষর
  function progressReport(d, asHtml, month) {
    // মাসিক রিপোর্ট কার্ড: শুধু সেই মাসের পরীক্ষা, হাজিরা আর বাড়ির কাজ
    if (month) {
      const s0 = d.s, inMo = (x) => String(x || "").startsWith(month);
      d = { ...d, rows: d.rows.filter((x) => inMo(x.e.date)), at: attOf(s0.id, month), hw: U.hwRate(DB().homework, s0, "homework", month),
        hwAll: d.hwAll.filter((h) => inMo(h.dueDate || h.givenDate)), sc: scoreOf(s0.id, withMarks(DB().exams.filter((e) => (!e.session || e.session === s0.session) && inMo(e.date)))) };
    }


    const st = DB().settings, O = location.origin, s = d.s, P = (x) => (x === null || x === undefined ? "—" : bn(String(Math.round(x * 10) / 10)) + "%");
    const avgOf = (l) => (l.length ? l.reduce((t, x) => t + x.percent, 0) / l.length : null);
    // যত পরীক্ষা / ক্লাস টেস্টে নম্বর আছে (অনুপস্থিত বাদ), পুরনো → নতুন
    const entries = d.rows.filter((x) => x.p !== null && !x.r.absent && !EC.EXTRA_TYPES.includes(x.e.type)).map((x) => ({ e: x.e, percent: x.p, date: x.e.date || "", test: x.e.type === "class" }));
    const tests = entries.filter((x) => x.test), exams = entries.filter((x) => !x.test);
    const overall = avgOf(entries), testAvg = avgOf(tests);
    const status = overall === null ? ["—", "e"] : overall > 70 ? ["খুব ভালো", "vg"] : overall > 60 ? ["ভালো", "g"] : overall > 50 ? ["মোটামুটি ভালো", "mg"] : overall > 30 ? ["মোটামুটি", "av"] : ["দুর্বল", "wk"];
    const rankB = (d.merits.find((m) => m[0] === "Combined (ব্যাচ)") || [])[1] || (d.merits.find((m) => m[0] === "Combined (সেশন)") || [])[1];
    // অধ্যায়ভিত্তিক: পরীক্ষার "অধ্যায় / সিলেবাস" ঘর ধরে (কমা দিয়ে একাধিক অধ্যায় হলে প্রতিটাতে গোনা) — সেই অধ্যায়ের সব পরীক্ষার মোট প্রাপ্ত / মোট পূর্ণমান
    const chap = {};
    for (const { e } of entries) {
      const r = d.rows.find((x) => x.e === e).r, names = String(e.chapter || "").split(/[,;،]/).map((x) => x.trim()).filter(Boolean);
      for (const nm of names) { const o = (chap[nm] ||= { got: 0, full: 0, n: 0 }); o.got += r.total || 0; o.full += r.full || 0; o.n++; }
    }
    const subs = Object.entries(chap).map(([n, o]) => ({ name: n, percent: o.full ? (o.got / o.full) * 100 : 0, n: o.n })).sort((a, b) => b.percent - a.percent);
    const noChap = entries.filter((x) => !String(x.e.chapter || "").trim()).length;
    // অগ্রগতির চার্ট: শেষ ৮টা, পরীক্ষা আর ক্লাস টেস্ট আলাদা রেখা
    // গ্রাফে শুধু পরীক্ষা (ক্লাস টেস্ট নয়)
    const last = exams.slice(-8), CW = 360, CH = 170, L = 30, R = 10, T = 18, B = 30, stp = (CW - L - R) / Math.max(1, last.length - 1);
    const PX = (i) => (last.length === 1 ? (CW - L - R) / 2 + L : L + i * stp), Y = (v) => T + (1 - Math.max(0, v) / 100) * (CH - T - B);
    const line = (isTest) => { const pts = last.map((x, i) => [x, i]).filter(([x]) => x.test === isTest); return pts.length ? `<polyline class="${isTest ? "lt" : "le"}" points="${pts.map(([x, i]) => `${PX(i).toFixed(1)},${Y(x.percent).toFixed(1)}`).join(" ")}"/>${pts.map(([x, i]) => `<circle class="${isTest ? "ct" : "ce"}" cx="${PX(i).toFixed(1)}" cy="${Y(x.percent).toFixed(1)}" r="3.5"/><text class="v" x="${PX(i).toFixed(1)}" y="${(Y(x.percent) - 7).toFixed(1)}">${bn(Math.round(x.percent))}%</text>`).join("")}` : ""; };
    const chart = last.length ? `<div class="ev-leg"><span><i class="k1"></i>পরীক্ষার নম্বর (%)</span></div><svg viewBox="0 0 ${CW} ${CH}" class="ev-ch">${[0, 50, 100].map((v) => `<line x1="${L}" x2="${CW - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${L - 5}" y="${Y(v) + 3}">${bn(v)}%</text>`).join("")}
      ${line(false)}${last.map((x, i) => `<text class="n" x="${PX(i).toFixed(1)}" y="${CH - 8}">${esc(String(x.e.title || "").slice(0, 14))}</text>`).join("")}</svg>` : '<p class="em">এখনও পরীক্ষার নম্বর নেই।</p>';
    // সপ্তাহ / মাস: সর্বশেষ সময়ের গড় বনাম আগের সময়, আর ব্যাচের গড়ের সাথে তুলনা
    const batchPct = (e) => { const R = EC.results(e); const t = R.present.map((x) => x.percent); return t.length ? t.reduce((a, b) => a + b, 0) / t.length : null; };
    const now = new Date(), wk = (ds) => Math.floor((new Date(ds + "T00:00:00").getTime() / 864e5 + 4) / 7), mo = (ds) => { const x = new Date(ds + "T00:00:00"); return x.getFullYear() * 12 + x.getMonth(); };
    const period = (kind) => {
      const lab = kind === "w" ? ["এই সপ্তাহে", "সর্বশেষ সপ্তাহে", "গত সপ্তাহের"] : ["এই মাসে", "সর্বশেষ মাসে", "গত মাসের"], key = kind === "w" ? wk : mo, g = new Map();
      entries.filter((x) => x.date).forEach((x) => { const k = key(x.date); (g.get(k) || g.set(k, []).get(k)).push(x); });
      const ks = [...g.keys()].sort((a, b) => a - b); if (!ks.length) return `<p><b>${lab[0]}:</b> তারিখ না থাকায় হিসাব করা যায়নি।</p>`;
      const lk = ks[ks.length - 1], pk = ks.length > 1 ? ks[ks.length - 2] : null, cur = avgOf(g.get(lk));
      const isNow = lk === (kind === "w" ? Math.floor((now.getTime() / 864e5 + 4) / 7) : now.getFullYear() * 12 + now.getMonth());
      const delta = pk === null ? null : cur - avgOf(g.get(pk));
      const trend = delta === null ? `তুলনার জন্য ${lab[2]} তথ্য নেই` : Math.abs(delta) < 1 ? `${lab[2]} মতোই আছে` : delta > 0 ? `${lab[2]} চেয়ে ${bn(Math.round(delta))}% উন্নতি হয়েছে` : `${lab[2]} চেয়ে ${bn(Math.round(-delta))}% কমেছে`;
      const bv = g.get(lk).map((x) => batchPct(x.e)).filter((v) => v !== null), bAvg = bv.length ? bv.reduce((a, b) => a + b, 0) / bv.length : null;
      const bt = bAvg === null ? "" : cur - bAvg >= 1 ? ", ব্যাচের গড়ের চেয়ে ভালো করছে" : bAvg - cur >= 1 ? ", ব্যাচের গড়ের চেয়ে পিছিয়ে আছে" : ", ব্যাচের গড়ের সমান আছে";
      return `<p><b>${isNow ? lab[0] : lab[1]}:</b> ${trend}${bt}।</p>`;
    };
    // বাড়ির কাজ: মোট / জমা / বাকি
    const hwList = d.hwAll.filter((h) => h.kind === "homework"), hwDone = hwList.filter((h) => (h.checks || {})[s.id] === "done").length;
    const att = d.at;
    // জিকে টেস্ট আর অনলাইন কুইজ: আলাদা গড় আর আলাদা মেধা (মূল গড় / অবস্থানে ধরা হয় না)
    const gkRows = d.rows.filter((x) => x.e.type === "gk"), gkDone = gkRows.filter((x) => x.p !== null && !x.r.absent);
    const gkAvg = avgOf(gkDone.map((x) => ({ percent: x.p }))), gkRank = (d.merits.find((m) => m[0] === EC.typeName("gk")) || [])[1];
    const qOf = (st) => quizRowsOf(st).filter((x) => !month || String(x.q.opensAt || "").startsWith(month)), qPct = (b) => (b && b.full ? (b.score / b.full) * 100 : 0);
    const qAvgOf = (l) => { const t = l.filter((x) => x.best); return t.length ? t.reduce((a, x) => a + qPct(x.best), 0) / t.length : null; };
    const qz = qOf(s), qAvg = qAvgOf(qz);
    const qRanked = rankBy(DB().students.filter((x) => x.status !== "inactive" && x.session === s.session).map((x) => ({ id: x.id, v: qAvgOf(qOf(x)) })), "v"), qMe = qRanked.find((x) => x.id === s.id), qRank = qMe ? [qMe.vRank, qRanked.length] : null;
    const sideBox = (cls, title, tiles, items, none) => `<section class="bx rc ${cls}"><h3>${title}</h3><div>${tiles.map(([l, v]) => `<span>${l} <b>${v}</b></span>`).join("")}</div>${items.length ? `<ul class="ql">${items.join("")}</ul>` : `<p class="cn" style="margin:2mm 0 0">${none}</p>`}</section>`;
    const gkBox = sideBox("gk", "সাপ্তাহিক জিকে টেস্ট", [["গড়", P(gkAvg)], ["দিয়েছে", `${bn(gkDone.length)}/${bn(gkRows.length)}`], ["মেধা", gkRank ? `${bn(gkRank[0])}/${bn(gkRank[1])}` : "—"]],
      gkRows.slice(-5).reverse().map((x) => `<li><span>${esc(x.e.title)} <small class="cn">${x.e.date ? esc(U.date(x.e.date)) : ""}</small></span><b>${x.r.absent ? "অনুপস্থিত" : x.p === null ? "—" : P(x.p)}</b></li>`), "এখনও কোনো জিকে টেস্ট হয়নি।");
    // বিশেষ পরীক্ষা (যেমন চিত্র অংকন): প্রতিটা আলাদা — নম্বর, শতাংশ, ওই পরীক্ষায় মেধা
    const spRows = d.rows.filter((x) => x.e.type === "special").slice().reverse();
    const spBox = spRows.length ? `<section class="bx sp"><h3>বিশেষ পরীক্ষা <small class="cn">মোট ফলাফলে যোগ হয় না</small></h3><ul class="ql">${spRows.map((x) => { const all = EC.results(x.e), me = all.present.find((y) => y.sid === s.id), of = all.present.filter((y) => y.rank).length;
      return `<li><span><b>${esc(x.e.title)}</b> <small class="cn">${x.e.date ? esc(U.date(x.e.date)) : ""}${x.e.chapter ? " · " + esc(x.e.chapter) : ""}</small></span><b>${x.r.absent ? "অনুপস্থিত" : x.p === null ? "নম্বর বাকি" : `${bn(String(Math.round((x.r.total || 0) * 100) / 100))}/${bn(String(x.r.full || 0))} · ${P(x.p)}${me && me.rank ? ` · মেধা ${bn(me.rank)}/${bn(of)}` : ""}`}</b></li>`; }).join("")}</ul></section>` : "";
    const qzBox = sideBox("qz", "অনলাইন কুইজ", [["গড়", P(qAvg)], ["দিয়েছে", `${bn(qz.filter((x) => x.best).length)}/${bn(qz.length)}`], ["মেধা", qRank ? `${bn(qRank[0])}/${bn(qRank[1])}` : "—"]],
      qz.slice(0, 5).map((x) => `<li><span>${esc(x.q.title)} <small class="cn">${esc(x.q.subject || "")}</small></span><b>${x.best ? `${bn(String(Math.round(x.best.score * 100) / 100))}/${bn(String(x.best.full))} · ${P(qPct(x.best))}` : "দেয়নি"}</b></li>`), "এখনও কোনো অনলাইন কুইজ নেই।");
    // পরামর্শ আর অভিভাবকের প্রতি অনুরোধ (সম্ভারুণের নিয়মে)
    const tips = [];
    if (overall === null) tips.push("পরীক্ষার নম্বর যোগ হলে ফলাফলের বিশ্লেষণ দেখা যাবে।"); else if (overall < 50) tips.push("পরীক্ষার ফলাফলে বিশেষ মনোযোগ প্রয়োজন।");
    if (att.pct !== null && att.pct < 75) tips.push("উপস্থিতি ৭৫%-এর নিচে — নিয়মিত ক্লাসে অংশগ্রহণ প্রয়োজন।");
    if (d.hw.pct !== null && d.hw.pct < 70) tips.push("বাড়ির কাজ জমার হার কম — অসম্পূর্ণ কাজগুলো অনুসরণ করুন।");
    if (subs.length) { tips.push(`শক্তিশালী অধ্যায়: ${subs[0].name}।`); if (subs.length > 1) tips.push(`আরও অনুশীলন প্রয়োজন: ${subs[subs.length - 1].name}।`); }
    if (!tips.length) tips.push("শিক্ষার্থীর অগ্রগতি সন্তোষজনক। ধারাবাহিকতা বজায় রাখুন।");
    const ask = [overall === null ? "নিয়মিত পরীক্ষা ও ক্লাস টেস্টে অংশ নিতে উৎসাহ দিন।" : overall < 50 ? "পড়াশোনার অগ্রগতি নিয়মিত পর্যবেক্ষণ করুন এবং দুর্বল বিষয়ে সহায়তা দিন।" : "ভালো ফলের ধারাবাহিকতা বজায় রাখতে নিয়মিত উৎসাহ দিন।"];
    if (att.pct !== null && att.pct < 75) ask.push("ক্লাসে নিয়মিত উপস্থিতি নিশ্চিত করুন।");
    if (hwList.length - hwDone > 0) ask.push(`বাকি ${bn(hwList.length - hwDone)}টি বাড়ির কাজ সম্পন্ন করতে সহযোগিতা করুন।`);
    const mods = (DB().enrollments || []).filter((e) => e.studentId === s.id && e.status === "active").map((e) => (DB().courses.find((c) => c.id === e.courseId) || {}).name).filter(Boolean).join(", ");
    const tile = (l, v, sub2, c) => `<div class="t ${c}"><small>${l}</small><b>${v}</b>${sub2 ? `<i>${sub2}</i>` : ""}</div>`;
    // ছবি থাকলে শিক্ষার্থীর ছবি, না থাকলে লিঙ্গ অনুযায়ী ছেলে / মেয়ের ছবি
    const pic = s.photo ? `${O}/api/admin/photo/s/${encodeURIComponent(s.id)}` : U.avatarSrc(s.gender);
    const t = new Date(), p2 = (n) => String(n).padStart(2, "0"), hh = t.getHours();
    const html = (`<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>${esc(s.name)} - ${esc(s.id)} - Evaluation</title>${U.DOC_FONTS}
<style>${U.DOC_CSS}*{box-sizing:border-box}@page{size:A4;margin:8mm}body{margin:0;background:#eef2f0;font-family:'BnNum','Hind Siliguri','Nirmala UI',sans-serif;color:#1d2b28;font-size:12px}
.pb{position:sticky;top:0;z-index:5;background:#0b3b36;padding:10px;text-align:center}.pb button{font:700 14px 'Hind Siliguri',sans-serif;background:#f3c55d;border:0;border-radius:999px;padding:8px 22px;cursor:pointer}
.pg{width:194mm;margin:14px auto;background:#fff;padding:7mm 8mm;box-shadow:0 4px 18px rgba(0,0,0,.08);display:grid;gap:3mm}
.hd{display:grid;grid-template-columns:46mm 1fr 46mm;align-items:center;gap:4mm;padding:2mm 0 3mm;border-bottom:1.6px solid #1f6b52}
.mk{line-height:1.05;font-family:'Noto Serif Bengali','Nirmala UI',serif}.mk small{display:block;font-size:13px;font-weight:700;color:#1f6b52}.mk b{display:block;font-size:24px;font-weight:900;color:#0b2e28}
.org{text-align:center}.org b{display:block;font:900 21px 'Noto Serif Bengali','Nirmala UI',serif;color:#0b2e28}.org small{display:block;font-size:11.5px;font-weight:600;color:#33433f}.lg{justify-self:end;width:36mm;max-height:22mm;object-fit:contain}
.hero{display:grid;grid-template-columns:auto 1fr;gap:4mm;align-items:center;background:linear-gradient(120deg,#0e5a4b,#1f7a62);color:#fff;border-radius:3mm;padding:4mm 5mm}
.av{width:19mm;height:22mm;border-radius:3mm;background:#fff;overflow:hidden;border:2px solid rgba(255,255,255,.7);box-shadow:0 4px 12px rgba(0,0,0,.18)}.av img{width:100%;height:100%;object-fit:cover;display:block}
.hero small{color:#bfeadb;font-size:11px}.hero h2{margin:0;font-size:20px;color:#fff}.hero p{margin:1px 0 0;font-size:11.5px;color:#e2f3ed}
.stc{grid-column:1/-1;display:inline-block;justify-self:start;padding:1.3mm 5mm;border-radius:2mm;background:#fff;color:#0e5a4b;font-weight:800;font-size:12.5px}
.stc.wk{color:#b42318}.stc.av{color:#b45309}
.ts{display:grid;grid-template-columns:repeat(7,1fr);gap:2mm}.t{border-radius:2.2mm;padding:2mm 2.4mm;border:1px solid #e2e8e5;background:#fff}.t small{display:block;font-size:9.6px;color:#56645f;line-height:1.25;min-height:6mm}.t b{font-size:17px}.t i{display:block;font-style:normal;font-size:9px;color:#6c7a75}
.c1{background:#eaf6f0}.c2{background:#eef3fb}.c3{background:#f4f6f5}.c4{background:#fdf4e4}.c5{background:#fdeef0}.c6{background:#eef7f8}.c7{background:#f4effb}
.row{display:grid;grid-template-columns:1.25fr 1fr;gap:3mm}.r2{display:grid;grid-template-columns:1fr 1fr;gap:3mm}
.bx{border:1px solid #e2e8e5;border-radius:2.5mm;padding:3mm 3.5mm}.bx h3{margin:0 0 2mm;font-size:13.5px;color:#0b2e28}
.cn{color:#6c7a75;font-size:10px;font-weight:500}.ev-leg{display:flex;gap:4mm;font-size:10px;color:#56645f}.ev-leg i{display:inline-block;width:5mm;height:0;border-top:2px solid #1f7a62;vertical-align:middle;margin-right:1.2mm}.ev-leg i.k2{border-top:2px dashed #d9a441}
.ev-ch{width:100%;height:auto}.ev-ch line{stroke:#e3e9e6}.ev-ch .ax{font-size:8px;fill:#7b8884;text-anchor:end}.ev-ch .le{fill:none;stroke:#1f7a62;stroke-width:2.2}.ev-ch .lt{fill:none;stroke:#d9a441;stroke-width:2.2;stroke-dasharray:5 3}
.ev-ch .ce{fill:#1f7a62;stroke:#fff;stroke-width:1.2}.ev-ch .ct{fill:#d9a441;stroke:#fff;stroke-width:1.2}.ev-ch .v{font-size:8.2px;font-weight:700;fill:#1d2b28;text-anchor:middle}.ev-ch .n{font-size:6.8px;fill:#7b8884;text-anchor:middle}
.sb{display:grid;grid-template-columns:1fr auto;gap:1mm 3mm;align-items:center;margin-bottom:2mm}.sb span{font-weight:600}.sb em{font-style:normal;font-weight:800}.sb i{grid-column:1/-1;height:2.2mm;background:#e8eeeb;border-radius:9px;overflow:hidden}.sb i u{display:block;height:100%;background:#1f7a62;border-radius:9px}
.sm{background:#f6f9f7;border:1px solid #e2e8e5;border-radius:2.5mm;padding:2.6mm 3.5mm}.sm p{margin:.5mm 0}
.rc>div{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm}.rc span{display:grid;gap:1px;padding:2mm 2.6mm;border-radius:2mm;background:#dff3eb;font-size:11px;color:#3f504b}.rc span b{font-size:17px;color:#16302b}
.rc span:nth-child(2){background:#ffe5e5}.rc span:nth-child(3){background:#fff0c9}.rc.hw span:nth-child(1){background:#eef3fb}
.rc.gk span:nth-child(1){background:#fdeee2}.rc.gk span:nth-child(2){background:#eef7f8}.rc.gk span:nth-child(3){background:#f4effb}.rc.qz span:nth-child(1){background:#e8f0fe}.rc.qz span:nth-child(2){background:#eaf6f0}.rc.qz span:nth-child(3){background:#fdf4e4}
.ql{list-style:none;margin:2mm 0 0;padding:0;font-size:10.5px}.ql li{display:flex;justify-content:space-between;gap:3mm;padding:1mm 0;border-top:1px dashed #e2e8e5}.ql b{white-space:nowrap}.sp{background:#f0fafb;border-color:#cde9ee}.sp .ql{font-size:11.5px}.sp .ql li>span b{white-space:normal}.rc .ql li>span{display:block;padding:0;border-radius:0;background:none!important;font-size:inherit;color:inherit}
.ad{background:#fffaf0;border-color:#f1e0b8}.ad.gd{background:#f3f8ff;border-color:#d3e3fb}.ad ul{margin:0;padding-left:4.5mm}.ad li{margin:.6mm 0}
.sg{display:grid;grid-template-columns:repeat(3,1fr);gap:10mm;padding-top:12mm;text-align:center;font-weight:600}.sg span{border-top:1.2px solid #1d2b28;padding-top:1.4mm}
.ft{display:flex;justify-content:space-between;font-size:9.5px;color:#7b8884;border-top:1px dashed #d4dcd8;padding-top:1.6mm}.em{color:#7b8884;margin:6mm 0;text-align:center}
@media print{body{background:#fff}.pb{display:none}.pg{margin:0;box-shadow:none;padding:0;width:auto}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
<div class="pb"><b style="color:#fff;margin-right:10px;font-family:Hind Siliguri,sans-serif">প্রিন্ট প্রিভিউ</b><button onclick="print()">প্রিন্ট / PDF</button> <button onclick="window.close()" style="background:rgba(255,255,255,.18);color:#fff">✕ বন্ধ করুন</button></div>
<main class="pg">
  <header class="hd"><div class="mk"><small>শিক্ষার্থী মূল্যায়ন</small><b>প্রতিবেদন</b></div><div class="org"><b>${esc(st.nameBn || "শাহিন'স আইসিটি কেয়ার")}</b><small>${esc(st.address || "মাস্টার কলোনি, মাদারীপুর")}</small><small>${esc(st.phone || "")}</small></div><img class="lg" src="${O}/images/logo-receipt.png" alt=""></header>
  <section class="hero"><div class="av"><img src="${esc(pic)}" alt=""></div><div><small>${month ? `মাসিক রিপোর্ট কার্ড · ${esc(U.month(month))}` : "শিক্ষার্থীর পারফরম্যান্স"}</small><h2>${esc(s.name)}</h2><p>${esc(s.id)} · ${esc(mods || "—")} · ${esc(s.session || "")} · ${esc(X.batchName(s.batchId))}</p></div><span class="stc ${status[1]}">${status[0]}</span></section>
  <section class="ts">${tile("পরীক্ষা ও ক্লাস টেস্টের গড়", P(overall), `${bn(entries.length)}টি ফলাফল`, "c1")}${tile("ক্লাস টেস্টের গড়", P(testAvg), `${bn(tests.length)}টি ক্লাস টেস্ট`, "c2")}${tile("কোচিংয়ের সব পরীক্ষার গড়", P(d.sc.mean), `${bn(d.sc.total)}টি পরীক্ষার হিসাবে`, "c3")}${tile("উপস্থিতি", P(att.pct), "", "c4")}${tile("বাড়ির কাজ", P(d.hw.pct), "", "c5")}${tile("পরীক্ষা দিয়েছে", bn(entries.length), "", "c6")}${tile("অবস্থান", rankB ? bn(rankB[0]) : "—", rankB ? `${bn(rankB[1])} জনের মধ্যে` : "", "c7")}</section>
  <div class="row"><section class="bx"><h3>পরীক্ষার অগ্রগতি</h3>${chart}</section>
    <section class="bx"><h3>অধ্যায়ভিত্তিক ফলাফল</h3>${subs.length ? subs.map((x) => `<div class="sb"><span>${esc(x.name)} <small class="cn">${bn(x.n)}টি পরীক্ষা</small></span><em>${P(x.percent)}</em><i><u style="width:${Math.max(2, Math.min(100, x.percent))}%"></u></i></div>`).join("") + (noChap ? `<p class="cn">অধ্যায় উল্লেখ নেই এমন পরীক্ষা: ${bn(noChap)}টি</p>` : "") : '<p class="em">পরীক্ষায় অধ্যায়ের নাম দেওয়া নেই। পরীক্ষা তৈরির সময় "অধ্যায় / সিলেবাস" ঘরে অধ্যায়ের নাম দিলে এখানে অধ্যায়ভিত্তিক ফল দেখাবে।</p>'}</section></div>
  <section class="sm">${entries.length ? period("w") + period("m") : "<p>এখনও পরীক্ষা বা ক্লাস টেস্টের নম্বর নেই।</p>"}</section>
  <div class="r2"><section class="bx rc"><h3>উপস্থিতির হিসাব</h3><div><span>উপস্থিত <b>${bn(att.p)}</b></span><span>অনুপস্থিত <b>${bn(att.a)}</b></span><span>ছুটি <b>${bn(att.l)}</b></span></div></section>
    <section class="bx rc hw"><h3>বাড়ির কাজ</h3><div><span>মোট <b>${bn(hwList.length)}</b></span><span>জমা <b>${bn(hwDone)}</b></span><span>বাকি <b>${bn(hwList.length - hwDone)}</b></span></div></section></div>
  <div class="r2">${gkBox}${qzBox}</div>${spBox}
  <div class="r2"><section class="bx ad"><h3>${esc(s.name)}-এর জন্য পরামর্শ</h3><ul>${tips.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></section>
    <section class="bx ad gd"><h3>অভিভাবকের প্রতি অনুরোধ</h3><ul>${ask.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></section></div>
  <div class="sg">${U.sig("কর্তৃপক্ষের স্বাক্ষর")}<span>শিক্ষার্থীর স্বাক্ষর</span><span>অভিভাবকের স্বাক্ষর</span></div>
  <div class="ft"><span>Time: ${(hh % 12) || 12}.${p2(t.getMinutes())} ${hh < 12 ? "AM" : "PM"}</span><span>${esc(st.nameBn || "শাহিন'স আইসিটি কেয়ার")} · ${esc(st.phone || "")}</span><span>Date: ${p2(t.getDate())}-${p2(t.getMonth() + 1)}-${String(t.getFullYear()).slice(-2)}</span></div>
</main></body></html>`);
    if (asHtml) return html; // অ্যাডমিনের শিক্ষার্থী পাতার "মূল্যায়ন প্রতিবেদন" ট্যাবে দেখানোর জন্য
    const w = window.open("", "_blank");
    if (!w) return toast("পপ-আপ বন্ধ আছে — ব্রাউজারে পপ-আপের অনুমতি দিন", true);
    w.document.write(html);
    w.document.close();
  }
  // ================= মূল্যায়ন — সামগ্রিক (লিডারবোর্ড) · একক (শিক্ষার্থী বেছে Previous / Next, প্রতিবেদন পাতাতেই) · মাসিক রিপোর্ট কার্ড (এক মাস, প্রতি শিক্ষার্থী এক পাতা) =================
  const EV_STYLE = `<style>html{overflow:hidden}body{background:transparent!important;font-size:13.5px}.pb,.hd,.sg,.ft{display:none!important}.pg{width:auto!important;max-width:none!important;margin:0!important;padding:0!important;box-shadow:none!important;background:transparent!important;gap:16px!important}.bx,.sm{background-color:#fff;border-radius:16px!important;box-shadow:0 8px 24px rgba(30,58,138,.07)}.hero{border-radius:18px!important;padding:18px 22px!important}.t{border-radius:14px!important;padding:10px 12px!important}.t b{font-size:21px!important}.t small{font-size:11.5px!important}.ts,.row,.r2{gap:14px!important}.bx h3{font-size:16px!important}</style>`;
  function evalTab() {
    const segs = [["all", "সামগ্রিক"], ["one", "একক"], ["card", "মাসিক রিপোর্ট কার্ড"]];
    const head = `<section class="card ev-top"><div><span class="eyebrow">সমন্বিত মূল্যায়ন</span><div class="ev-ttl"><h2>মূল্যায়ন</h2><div class="ev-seg">${segs.map(([k, t]) => `<button type="button" data-emode="${k}" class="${S.emode === k ? "on" : ""}">${t}</button>`).join("")}</div></div>
      <p>পরীক্ষা, ক্লাস টেস্ট, উপস্থিতি ও বাড়ির কাজের ভিত্তিতে শিক্ষার্থীদের অগ্রগতি দেখুন।</p></div></section>`;
    if (S.emode === "all") return head + perf();
    const studs = students(S.f.batch);
    if (!studs.length) return head + `<section class="card">${filterBar(["session", "batch"])}${empty("এই সেশন / ব্যাচে কোনো সক্রিয় শিক্ষার্থী নেই।")}</section>`;
    if (S.emode === "card") {
      const picked = S.cardSel || (S.cardSel = new Set(studs.map((s) => s.id)));
      return head + `<section class="card ev-cardpick"><h3>মাসিক রিপোর্ট কার্ড</h3><p class="ex-sub">প্রতি শিক্ষার্থীর জন্য এক পাতা — "একক" মূল্যায়ন প্রতিবেদনের ডিজাইনেই, শুধু বাছা মাসের পরীক্ষা, হাজিরা আর বাড়ির কাজ ধরে। শিক্ষার্থী বাছুন, মাস ঠিক করুন, তারপর প্রিন্ট করুন।</p>
        <div class="rs-bar">${filtersHtml(["session", "batch"])}<label>মাস<input type="month" data-card-month value="${esc(S.month)}"></label>
          <span class="rs-btns"><button type="button" class="btn line sm" data-card-all>সবাই</button><button type="button" class="btn line sm" data-card-none>কেউ না</button><button type="button" class="btn gold" data-card-print>${bn(studs.filter((s) => picked.has(s.id)).length)}টি রিপোর্ট কার্ড প্রিন্ট</button></span></div>
        <div class="ev-pick">${studs.map((s) => `<label class="${picked.has(s.id) ? "on" : ""}"><input type="checkbox" data-card-sid="${esc(s.id)}"${picked.has(s.id) ? " checked" : ""}><b>${esc(s.name)}</b><small>${esc(s.id)} · ${esc(X.batchName(s.batchId))}</small></label>`).join("")}</div></section>`;
    }
    if (!studs.some((s) => s.id === S.eid)) S.eid = studs[0].id;
    const i = studs.findIndex((s) => s.id === S.eid), prev = studs[i - 1], next = studs[i + 1];
    return head + `<section class="card ev-picker"><div class="rs-bar">${filtersHtml(["session", "batch"])}</div>
      <label class="ev-sel">নির্দিষ্ট শিক্ষার্থী নির্বাচন করুন<select data-eval-sid>${studs.map((s) => `<option value="${esc(s.id)}"${s.id === S.eid ? " selected" : ""}>${esc(s.name)} · ${esc(s.id)}</option>`).join("")}</select></label>
      <div class="ev-nav"><button type="button" class="btn line" data-eval-go="${prev ? esc(prev.id) : ""}"${prev ? "" : " disabled"}>◄ Previous</button><span>${bn(i + 1)} / ${bn(studs.length)}</span>
        <button type="button" class="btn gold" data-eval-go="${next ? esc(next.id) : ""}"${next ? "" : " disabled"}>Next ► ${next ? `<small>${esc(next.id)}</small>` : ""}</button><button type="button" class="btn ev-print" data-eval-print>Print</button></div></section>
      <iframe id="evOne" class="ev-frame" title="মূল্যায়ন প্রতিবেদন" scrolling="no"></iframe>`;
  }
  // একক: প্রতিবেদন পাতার ভেতরেই (প্রিন্টের হেডার / স্বাক্ষর ছাড়া), উচ্চতা নিজে থেকে
  function fillEval() {
    const fr = $("#evOne", C), d = fr && profileData(S.eid); if (!d) return;
    fr.onload = () => { const doc = fr.contentDocument; if (!doc) return; const fit = () => (fr.style.height = Math.ceil(doc.documentElement.scrollHeight) + 2 + "px"); fit(); setTimeout(fit, 400); setTimeout(fit, 1200); };
    fr.srcdoc = progressReport(d, true).replace("</head>", EV_STYLE + "</head>");
  }
  // মাসিক রিপোর্ট কার্ড: বাছা শিক্ষার্থীদের প্রতিবেদন একসাথে, প্রতিটা আলাদা পাতায়
  function printCards() {
    const ids = students(S.f.batch).filter((s) => S.cardSel && S.cardSel.has(s.id)).map((s) => s.id);
    if (!ids.length) return toast("অন্তত একজন শিক্ষার্থী বাছুন", true);
    const pages = ids.map((id) => progressReport(profileData(id), true, S.month)).filter(Boolean);
    const headPart = pages[0].slice(0, pages[0].indexOf("<main")), mains = pages.map((h) => h.slice(h.indexOf("<main"), h.lastIndexOf("</main>") + 7));
    const w = window.open("", "_blank"); if (!w) return toast("পপ-আপ বন্ধ আছে — ব্রাউজারে পপ-আপের অনুমতি দিন", true);
    w.document.write(headPart.replace("</head>", "<style>.pg{break-after:page;page-break-after:always}.pg:last-of-type{break-after:auto}</style></head>").replace(/<title>[^<]*<\/title>/, `<title>মাসিক রিপোর্ট কার্ড — ${esc(U.month(S.month))}</title>`) + mains.join("") + "</body></html>");
    w.document.close();
  }
  const plainTable = (head, body) => `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c, i) => `<td${i >= 4 ? ' class="num"' : ""}>${esc(i === 0 && typeof c === "number" ? bn(c) : c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  function runReport(kind) {
    const keep = { sheet: S.sheet, sheetExam: S.sheetExam, batch: S.f.batch, q: S.q };
    S.q = "";
    try {
      if (kind === "exam") { const id = ($("[data-rep-exam]", C) || {}).value; if (!id) return toast("পরীক্ষা নেই", true); const sh = examSheet(exById(id)); return printReport(sh.title, sh.sub, plainTable(sh.head, sh.body)); }
      if (kind === "batch") { S.f.batch = ($("[data-rep-batch]", C) || {}).value; if (!S.f.batch) return toast("ব্যাচ নেই", true); const sh = combinedSheet("batch"); return printReport(sh.title, sh.sub, plainTable(sh.head, sh.body)); }
      if (kind === "session") { const sh = combinedSheet("session"); return printReport(sh.title, sh.sub, plainTable(sh.head, sh.body)); }
      if (kind === "merit") { const d = meritData(); if (!d || d.need) return toast("Merit Lists ট্যাবে ফিল্টার ঠিক করুন", true); return printReport(`${d.title} — মেধাতালিকা`, `${d.where} · ${d.note}`, plainTable(d.head, d.body)); }
      if (kind === "student") {
        const sid = enNum(($("[data-rep-sid]", C) || {}).value || ""); const d = profileData(sid); if (!d) return toast("এই আইডির কোনো শিক্ষার্থী নেই", true);
        const body = d.rows.map(({ e, r, p, abs }) => [U.date(e.date), e.title, EC.typeName(e.type), r.absent ? (abs ? "অনুপস্থিত" : "নম্বর বাকি") : `${num2(r.total)}/${bn(r.full)}`, p === null ? "—" : bn(Math.round(p)) + "%", r.absent ? "—" : r.pass ? "পাস" : "ফেল", r.rank ? bn(r.rank) : "—"]);
        // একক রেজাল্ট থেকে প্রিন্ট: শুধু পরীক্ষা ও অনলাইন কুইজ, হাজিরা নেই
        const only = S.examsOnlyPrint, qz = only ? quizRowsOf(d.s) : [];
        if (!only) return progressReport(d);
        return printReport(only ? "একক রেজাল্ট" : "Student Academic Report", `${d.s.name} · ${d.s.id} · ${d.s.session} · ব্যাচ ${X.batchName(d.s.batchId)} · পরীক্ষার গড় ${pct(d.sc.mean)} · Combined ${pct(d.sc.combined)}${only ? "" : ` · উপস্থিতি ${pct(d.at.pct)} · বাড়ির কাজ ${pct(d.hw.pct)} · পড়া ${pct(d.ls.pct)}`}`,
          `<p>${d.merits.map(([t, [r, n]]) => `${esc(t)}: <b>${bn(r)}/${bn(n)}</b>`).join(" · ")}</p>` + plainTable(["তারিখ", "পরীক্ষা", "ধরন", "নম্বর", "%", "ফলাফল", "মেধা"], body)
          + (qz.length ? `<h3 style="margin-top:16px">অনলাইন কুইজ</h3>` + plainTable(["কুইজ", "নম্বর", "%", "সঠিক", "ভুল", "উত্তর দেয়নি"], qz.map(({ q, best }) => [q.title, best ? `${num2(best.score)}/${num2(best.full)}` : "দেয়নি", best ? bn(Math.round(best.full ? (best.score / best.full) * 100 : 0)) + "%" : "—", best ? bn(best.correct) : "—", best ? bn(best.wrong) : "—", best ? bn(best.skipped) : "—"])) : ""));
      }
      if (kind === "monthly") {
        const mo = ($("[data-rep-month]", C) || {}).value || today().slice(0, 7); S.month = mo;
        const list = withMarks(exams({ anyType: true })).filter((e) => (e.date || "").startsWith(mo));
        const body = students(S.f.batch).map((s) => { const sc = scoreOf(s.id, list), at = attOf(s.id, mo); return [s.id, s.name, X.batchName(s.batchId), `${bn(sc.given)}/${bn(sc.total)}`, pct(sc.mean), pct(at.pct), `${bn(at.p)}/${bn(at.total)}`]; });
        return printReport("Monthly Progress Report", `${U.month(mo)} · ${S.f.batch ? "ব্যাচ " + X.batchName(S.f.batch) : session()} · ${bn(list.length)}টি পরীক্ষা`, plainTable(["আইডি", "নাম", "ব্যাচ", "পরীক্ষা দিয়েছে", "পরীক্ষার গড়", "উপস্থিতি", "উপস্থিত দিন"], body));
      }
    } finally { Object.assign(S, { sheet: keep.sheet, sheetExam: keep.sheetExam, q: keep.q }); S.f.batch = keep.batch; }
  }
  const excel = (name, head, body) => U.xlsx(`${name}-${today()}.xlsx`, head, body.map((r) => r.map((c) => String(c).replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d)))));

  // ================= ঘটনা =================
  function onClick(e) {
    const t = (s) => e.target.closest(s); let el;
    if ((el = t("[data-tab]"))) { S.tab = el.dataset.tab; return render(); }
    if ((el = t("[data-emode]"))) { S.emode = el.dataset.emode; return render(); }
    if ((el = t("[data-eval-go]"))) { if (!el.dataset.evalGo) return; S.eid = el.dataset.evalGo; return render(); }
    if (t("[data-eval-print]")) { const d = profileData(S.eid); return d ? progressReport(d) : toast("শিক্ষার্থী বাছুন", true); }
    if (t("[data-card-all]") || t("[data-card-none]")) { S.cardSel = new Set(t("[data-card-all]") ? students(S.f.batch).map((s) => s.id) : []); return render(); }
    if (t("[data-card-print]")) return printCards();
    if (t("[data-one-go]")) return findOne();
    if (t("[data-print-one]")) { const keep = S.pid; const inp = document.createElement("input"); inp.setAttribute("data-rep-sid", ""); inp.value = S.pid; inp.hidden = true; C.append(inp); S.examsOnlyPrint = true; try { runReport("student"); } finally { S.examsOnlyPrint = false; } inp.remove(); S.pid = keep; return; }
    if (t("[data-verify]")) { S.verified[S.examId] = true; render(); const c = $(".rs-checks", C); if (c) c.classList.add("flash"); return toast("যাচাই হয়েছে — উপরের তালিকা দেখুন"); }
    if (t("[data-publish]") || t("[data-unpublish]")) {
      const ex = exById(S.examId), all = pubState(ex).all;
      if (S.scope === "batch" && !S.scopeBatch) return toast("কোন ব্যাচ — বেছে নিন", true);
      return publish(t("[data-publish]") ? "publish" : "unpublish", S.scope === "batch" ? [S.scopeBatch] : all);
    }
    if ((el = t("[data-sms-batch]"))) return smsBatch(el.dataset.smsBatch, el);
    if ((el = t("[data-pub-one]"))) return publish("publish", [el.dataset.pubOne]);
    if ((el = t("[data-unpub-one]"))) return publish("unpublish", [el.dataset.unpubOne]);
    if ((el = t("[data-go-exam]"))) { S.examId = el.dataset.goExam; render(); return window.scrollTo({ top: 0, behavior: "smooth" }); }
    if (t("[data-print-sheet]") || t("[data-excel-sheet]")) {
      const sh = currentSheet(); if (!sh) return toast("এই ফিল্টারে নম্বর দেওয়া কোনো পরীক্ষা নেই", true);
      return t("[data-print-sheet]") ? printReport(sh.title, sh.sub, plainTable(sh.head, sh.body)) : excel("result-sheet", sh.head, sh.body);
    }
    if ((el = t("[data-cert]"))) { const d = meritData(), row = d && d.body.find((r) => String(r[1]) === el.dataset.cert); return row ? printCertificate(d, row) : toast("মেধাতালিকায় পাওয়া যায়নি", true); }
    if (t("[data-print-merit]") || t("[data-excel-merit]")) {
      const d = meritData(); if (!d || d.need) return toast("আগে ফিল্টার ঠিক করুন", true);
      return t("[data-print-merit]") ? printReport(`${d.title} — মেধাতালিকা`, `${d.where} · ${d.note}`, plainTable(d.head, d.body)) : excel("merit-list", d.head, d.body);
    }
    if (t("[data-save-w]")) return saveWeights();
    if ((el = t("[data-pcat]"))) { S.pcat = el.dataset.pcat; return render(); }
    if ((el = t("[data-pmonth]"))) { S.pmonth = el.dataset.pmonth; return render(); }
    if (t("[data-print-qsheet]") || t("[data-excel-qsheet]")) { const d = S.quizSheet; return t("[data-print-qsheet]") ? printReport("Quiz Merit — অনলাইন শিক্ষার্থী", `${session()} · ব্যাচের বাইরে থেকে দেওয়া কুইজ`, plainTable(d.head, d.body)) : excel("online-quiz-merit", d.head, d.body); }
    if (t("[data-print-points]") || t("[data-excel-points]")) { const d = S.pointsSheet; return t("[data-print-points]") ? printReport(d.title, d.sub, plainTable(d.head, d.body)) : excel("monthly-points", d.head, d.body); }
    if (t("[data-save-pw]")) {
      const body = {}; $$("[data-pw]", C).forEach((i) => (body[i.dataset.pw] = Number(enNum(i.value)) || 0));
      api("/api/admin/results/perf-weights", { body }).then(() => X.load()).then(() => { render(); toast("সংরক্ষণ হয়েছে — Leaderboard নতুন করে হিসাব হলো"); }).catch((er) => toast(er.message, true));
      return;
    }
    if ((el = t("[data-profile]"))) { if (el.target === "_blank") return; // নতুন ট্যাবে প্রোফাইল খোলে (#results/আইডি)
      e.preventDefault(); openProfile(el.dataset.profile); render(); return window.scrollTo({ top: 0, behavior: "smooth" }); }
    if (t("[data-print-profile]")) { const inp = document.createElement("input"); inp.setAttribute("data-rep-sid", ""); inp.value = S.pid; inp.hidden = true; C.append(inp); runReport("student"); return inp.remove(); }
    if ((el = t("[data-rep]"))) return runReport(el.dataset.rep);
  }
  async function saveWeights() {
    const body = {}; $$("[data-w]", C).forEach((i) => (body[i.dataset.w] = Number(enNum(i.value)) || 0));
    try { await api("/api/admin/results/weights", { body }); await X.load(); render(); toast("ভার সংরক্ষণ হয়েছে — Combined Merit নতুন করে হিসাব হলো"); } catch (e) { toast(e.message, true); }
  }
  function onChange(e) {
    const el = e.target;
    if (el.dataset.f) {
      S.f[el.dataset.f] = el.value;
      if (el.dataset.f === "session") S.f.batch = "";
      // সব ব্যাচের ধরন → ব্যাচ "সব ব্যাচ", প্রকাশও সব ব্যাচে
      if (el.dataset.f === "type" && batchLocked()) { S.f.batch = ""; S.scope = "all"; S.scopeBatch = ""; if (S.sheet === "batch") S.sheet = "session"; }
      // ব্যাচ বাছলে প্রকাশের পরিধিও সেই ব্যাচ
      if (el.dataset.f === "batch") { S.scope = el.value ? "batch" : "all"; S.scopeBatch = el.value; S.qOnline = false; }
      keepFilter(); return render();
    }
    if (el.matches("[data-qwho]")) { S.qOnline = el.value === "online"; S.f.batch = S.qOnline ? "" : el.value; S.scope = S.f.batch ? "batch" : "all"; S.scopeBatch = S.f.batch; keepFilter(); return render(); }
    if (el.matches("[data-pick-exam]")) { S.examId = el.value; return render(); }
    if (el.name === "scope") { S.scope = el.value; return render(); }
    if (el.matches("[data-scope-batch]")) { S.scopeBatch = el.value; return render(); }
    if (el.matches("[data-sheet]")) { S.sheet = el.value; return render(); }
    if (el.matches("[data-one]")) { S.pid = el.value; return render(); }
    if (el.matches("[data-sheet-exam]")) { S.sheetExam = el.value; return render(); }
    if (el.matches("[data-sort]")) { S.sort = el.value; return render(); }
    if (el.matches("[data-merit]")) { S.merit = el.value; return render(); }
    if (el.matches("[data-merit-exam]")) { S.meritExam = el.value; return render(); }
    if (el.matches("[data-mod]")) { S.mod = el.value; return render(); }
    if (el.matches("[data-mcat]")) { S.mcat = el.value; S.mexam = ""; return render(); }
    if (el.matches("[data-mexam]")) { S.mexam = el.value; return render(); }
    if (el.matches("[data-land]")) { S.land = el.value === "1"; return; }
    if (el.matches("[data-rep-month]")) { S.month = el.value; }
    if (el.matches("[data-eval-sid]")) { S.eid = el.value; return render(); }
    if (el.matches("[data-card-month]")) { S.month = el.value || today().slice(0, 7); return; }
    if (el.matches("[data-card-sid]")) { S.cardSel ||= new Set(); S.cardSel[el.checked ? "add" : "delete"](el.dataset.cardSid); return render(); }
  }
  function onInput(e) {
    if (e.target.matches("[data-q]")) {
      S.q = e.target.value; render();
      const i = $("[data-q]", C); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
    }
  }
  // একক রেজাল্ট: আইডি দিয়ে সরাসরি — শিক্ষার্থীর সেশন / ব্যাচে ফিল্টার নিজে থেকে বদলায়
  function openProfile(id) { const s = X.studentById(id); if (!s) return; S.f.session = s.session; S.f.batch = s.batchId || ""; keepFilter(); S.pid = s.id; S.tab = "profile"; }
  function findOne() {
    const inp = $("[data-one-id]", C), id = enNum(inp ? inp.value : "").toUpperCase(), s = id && X.studentById(id);
    if (!s) { toast(id ? `${id} — এই আইডির কোনো শিক্ষার্থী নেই` : "আইডি লিখুন", true); if (inp) inp.focus(); return; }
    openProfile(s.id); render();
  }
  function onKey(e) {
    if (e.target.matches("[data-one-id]") && e.key === "Enter") { e.preventDefault(); return findOne(); }
  }

  // শিক্ষার্থীর পাতা থেকে সরাসরি "মূল্যায়ন প্রতিবেদন" (ফলাফল পাতা না খুলেই)
  window.SICEvalReport = (sid) => { const d = profileData(sid); if (!d) return toast("শিক্ষার্থী পাওয়া যায়নি", true); progressReport(d); };
  window.SICEvalHtml = (sid) => { const d = profileData(sid); return d ? progressReport(d, true) : ""; };
  return function resultsPage(c, arg) {
    C = c;
    if (arg && X.studentById(arg)) openProfile(arg);
    if (arg === "eval") S.tab = "eval"; else if (!arg && S.tab === "eval") S.tab = "review";
    if (!S.f.session) S.f.session = session();
    c.onclick = onClick; c.onchange = onChange; c.oninput = onInput; c.onkeydown = onKey;
    render();
  };
};
