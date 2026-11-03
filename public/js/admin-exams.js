// অ্যাডমিন → পরীক্ষা (Sombharun-এর "পরীক্ষা" পেজের মতো)
// উপরে ব্যানার + ফিল্টার, তারপর ৫টা ট্যাব:
//   ✎ নম্বর এন্ট্রি · পরীক্ষা ক্যালেন্ডার · ✓ সম্পন্ন পরীক্ষা · » পরবর্তী পরীক্ষা · পরীক্ষা ডকুমেন্টস
// যেকোনো পরীক্ষায় চাপ দিলে তার পাতা খোলে: তথ্য, ফলাফলের সারসংক্ষেপ, প্রশ্ন / উত্তরপত্র / মূল্যায়ন খাতা।
// "নতুন পরীক্ষা" ফর্ম: পরীক্ষার ধরন (Weekly / Monthly / Chapter Final / Model), প্রশ্নের ধরন, বিষয়ভিত্তিক CQ / MCQ পূর্ণমান
// (যেকোনো অংশ × দিয়ে বাদ, ＋ দিয়ে ফেরত), পরীক্ষার্থী নির্বাচন। গড়, পাস-ফেল আর মেধাক্রমের হিসাব examcalc.js-এ।
window.SICExams = function (X) {
  "use strict";
  const { $, $$, esc, bn, api, toast } = U;
  const EC = window.ExamCalc;
  const DB = () => X.DB;
  const today = () => U.today();
  const DAYS = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];
  const TYPE_C = { weekly: "#286fa3", monthly: "#6c5bb5", chapter: "#9a6a12", model: "#c0394f", class: "#187460", gk: "#b4531f", special: "#0e7490" };
  const ICON = { pdf: "PDF", image: "ছবি", video: "ভিডিও", audio: "অডিও", youtube: "►", link: "লিংক", file: "ফাইল" };
  const CATS = { question: "প্রশ্ন", answer: "উত্তরপত্র", script: "মূল্যায়ন খাতা" };
  const num2 = (x) => (x === null || x === undefined ? "—" : bn(String(EC.round2(x))));
  const enNum = (v) => String(v ?? "").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d)).replace(/[−–]/g, "-").trim();
  const negHere = () => EC.allowsNegative(exById(S.examId));
  const monthBn = (ym) => { const [y, m] = ym.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("bn-BD", { month: "long", year: "numeric" }); };
  const dayParts = (d) => { const x = new Date(d + "T00:00:00"); return { day: bn(x.getDate()), mon: x.toLocaleDateString("bn-BD", { month: "long" }), wd: x.toLocaleDateString("bn-BD", { weekday: "long" }) }; };
  const daysTo = (d) => Math.round((new Date(d + "T00:00:00") - new Date(today() + "T00:00:00")) / 864e5);
  const ymOf = (d) => String(d || "").slice(0, 7);
  const addMonth = (ym, n) => { const [y, m] = ym.split("-").map(Number), d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const sizeBn = (n) => (n > 1048576 ? `${bn((n / 1048576).toFixed(1))} MB` : `${bn(Math.max(1, Math.round(n / 1024)))} KB`);
  const typeChip = (t) => `<span class="ex-type" style="--k:${TYPE_C[t] || TYPE_C.weekly}">${esc(EC.typeName(t))}</span>`;
  const modeName = (m) => (EC.MODES.find((x) => x[0] === m) || EC.MODES[0])[1];
  const empty = (t) => `<div class="ln-empty">${t}</div>`;

  // ---------- অবস্থা (ফিল্টার মনে থাকে) ----------
  const S = { correct: {}, tab: "entry", month: "", pick: "", open: "", sub: "question", q: "", examId: "", attempt: 0, entry: "bulk", docTarget: "", docType: "", docCat: "question", f: { session: "", batch: "", type: "" } };
  try { Object.assign(S.f, JSON.parse(localStorage.getItem("sicExamFilter") || "{}")); } catch {}
  const keepFilter = () => { try { localStorage.setItem("sicExamFilter", JSON.stringify(S.f)); } catch {} };
  let C = null, dirty = false, idSid = "", focusAfter = "";
  const recent = []; // Student ID Entry-তে এইমাত্র সেভ হওয়া

  // ---------- তথ্য ----------
  const exById = (id) => DB().exams.find((e) => e.id === id);
  // "সাপ্তাহিক জিকে টেস্ট" ভাগে শুধু জিকে টেস্ট, মূল "পরীক্ষা" ভাগে জিকে বাদে সব
  // নিজের আলাদা ট্যাব (#exams/model ইত্যাদি): শিরোনাম, বিবরণ — মূল "পরীক্ষা" ট্যাবে এগুলো দেখায় না
  const OWN_TAB = {
    model: ["মডেল টেস্ট", "মডেল টেস্ট — তারিখ, নম্বর, মেধাক্রম আর প্রশ্ন / উত্তরপত্র / দেখা খাতা। ফলাফল Combined মেধায় ভার অনুযায়ী যোগ হয়।"],
    gk: ["সাপ্তাহিক জিকে টেস্ট", "প্রতি সপ্তাহের জিকে টেস্ট — তারিখ, নম্বর, মেধাক্রম আর প্রশ্ন / উত্তরপত্র। ফলাফল মোট মেধায় যোগ হয় না; আলাদা মেধাতালিকা আর প্রগ্রেস রিপোর্টে আলাদা অংশে দেখায়।"],
    special: ["বিশেষ পরীক্ষা", "চিত্র অংকনের মতো বিশেষ পরীক্ষা — পরীক্ষার নামে বিষয় লিখুন। ফলাফল মোট মেধায় যোগ হয় না; আলাদা মেধাতালিকা আর প্রগ্রেস রিপোর্টে আলাদা অংশে দেখায়।"],
  };
  const TYPES_HERE = () => EC.TYPES.filter(([k]) => (S.only ? k === S.only : !OWN_TAB[k]));
  const inFilter = (ex) => {
    const f = S.f;
    if (S.only ? ex.type !== S.only : OWN_TAB[ex.type]) return false;
    if (f.type && ex.type !== f.type) return false;
    if (f.session && ex.session && ex.session !== f.session) return false; // Both দুই সেশনেই দেখায়
    if (f.batch && !(ex.batchIds || []).includes(f.batch) && !(ex.studentIds || []).some((id) => (X.studentById(id) || {}).batchId === f.batch)) return false;
    return true;
  };
  const exams = () => DB().exams.filter(inFilter);
  const dateOf = (ex, a) => (a === 0 ? ex.date : (ex.attemptDates || [])[a]) || "";
  // ক্যালেন্ডারের প্রতিটা ঘটনা = একটা পরীক্ষার একটা বার
  function items() {
    const out = [];
    for (const ex of exams()) for (let a = 0; a < EC.attemptsOf(ex); a++) {
      const date = dateOf(ex, a);
      out.push({ key: `${ex.id}~${a}`, ex, a, date, done: !!date && date <= today(), isToday: date === today(), title: ex.title + (EC.attemptsOf(ex) > 1 ? ` · ${EC.ATTEMPT_NAMES[a]}` : "") });
    }
    return out.sort((x, y) => (x.date || "9999").localeCompare(y.date || "9999"));
  }
  const docsOf = (exId) => DB().docs.filter((d) => d.examId === exId);
  const batchesOfEx = (ex) => [...new Set((ex.studentIds || []).map((id) => (X.studentById(id) || {}).batchId).filter(Boolean))].map(X.batchName);

  // ================= পেজ =================
  function render() {
    if (!C) return;
    const all = items(), it = S.open && all.find((i) => i.key === S.open);
    if (S.open && !it) S.open = "";
    C.innerHTML = `<div class="ex-page">${it ? detail(it) : head(all) + body(all)}</div>`;
    if (focusAfter) { const el = $(focusAfter, C); if (el) { el.focus(); if (el.setSelectionRange && el.value) el.setSelectionRange(el.value.length, el.value.length); } focusAfter = ""; }
  }
  function head(all) {
    const done = all.filter((i) => i.done), next = all.filter((i) => !i.done && i.date), up = next[0];
    const nd = DB().docs.filter((d) => exams().some((e) => e.id === d.examId)).length, f = S.f;
    const batches = DB().batches.filter((b) => !f.session || b.session === f.session);
    const tabs = [["entry", "নম্বর এন্ট্রি"], ["cal", "পরীক্ষা ক্যালেন্ডার"], ["done", "সম্পন্ন পরীক্ষা", done.length], ["next", "পরবর্তী পরীক্ষা", next.length], ["docs", "পরীক্ষা ডকুমেন্টস", nd], ["routine", "রুটিন PDF", routines().length]];
    return `<section class="ln-banner"><div><span class="eyebrow">পরীক্ষার ক্যালেন্ডার ও নম্বরের খাতা</span><h2>${S.only ? OWN_TAB[S.only][0] : "পরীক্ষা"}</h2>
      <p>${S.only ? OWN_TAB[S.only][1] : "Weekly, Monthly, Chapter Final আর Class Assessment — তারিখ, নম্বর, মেধাক্রম আর প্রশ্ন / উত্তরপত্র / দেখা খাতা এক জায়গায়। নম্বর দিলেই শিক্ষার্থী নিজের প্যানেলে ফলাফল পায়।"}</p>
      <div class="ln-nums"><span><b>${bn(all.length)}</b>মোট পরীক্ষা</span><span><b>${bn(done.length)}</b>সম্পন্ন</span><span><b>${bn(next.length)}</b>সামনে</span><span><b>${bn(nd)}</b>ডকুমেন্ট</span>${up ? `<span><b>${daysTo(up.date) === 0 ? "আজ" : daysTo(up.date) === 1 ? "আগামীকাল" : bn(daysTo(up.date)) + " দিন"}</b>পরবর্তী: ${esc(up.title.slice(0, 24))}</span>` : ""}</div></div>
      <button type="button" class="btn gold" data-new="${today()}">＋ নতুন পরীক্ষা</button></section>
      <div class="ln-filter"><label>সেশন<select data-f="session">${X.opt([["", "সব সেশন"], ...DB().sessions.map((s) => [s.name, s.name])], f.session)}</select></label>
        <label>ব্যাচ<select data-f="batch">${X.opt([["", "সব ব্যাচ"], ...batches.map((b) => [b.id, U.batchLabel(b)])], f.batch)}</select></label>
        <label>পরীক্ষার ধরন<select data-f="type">${X.opt([["", "সব ধরন"], ...TYPES_HERE()], f.type)}</select></label></div>
      <div class="ln-tabs">${tabs.map(([k, t, n]) => `<button type="button" data-tab="${k}" class="${S.tab === k ? "on" : ""}">${t}${n !== undefined ? ` <i>${bn(n)}</i>` : ""}</button>`).join("")}</div>`;
  }
  function body(all) {
    if (S.tab === "entry") return entryTab();
    if (S.tab === "cal") {
      if (!S.month) S.month = ((all.find((i) => i.date && i.date >= today()) || all.filter((i) => i.date).slice(-1)[0] || {}).date || today()).slice(0, 7);
      return (all.length ? "" : empty('এখনো কোনো পরীক্ষা দেওয়া হয়নি — "＋ নতুন পরীক্ষা" চাপুন, অথবা ক্যালেন্ডারের যেকোনো তারিখে চাপ দিন।') + '<div style="height:14px"></div>') + board(all);
    }
    if (S.tab === "done" || S.tab === "next") return listTab(all);
    if (S.tab === "routine") return routineTab();
    return docsTab();
  }

  // ---------- সারি, মাসের বোতাম, ছোট ক্যালেন্ডার ----------
  function statusTag(i) {
    if (i.isToday) return '<span class="ln-tag today">আজ</span>';
    if (i.done) return '<span class="ln-tag done">সম্পন্ন</span>';
    if (!i.date) return '<span class="ln-tag">তারিখ নেই</span>';
    const n = daysTo(i.date); return `<span class="ln-tag next">${n === 1 ? "আগামীকাল" : bn(n) + " দিন পর"}</span>`;
  }
  function row(i, n) {
    const p = i.date ? dayParts(i.date) : null, nd = docsOf(i.ex.id).length, st = EC.attemptStats(i.ex, i.a);
    return `<button type="button" class="ln-row" style="--k:${TYPE_C[i.ex.type]}" data-open="${i.key}">${n ? `<span class="ln-sl">${bn(n)}</span>` : ""}<span class="ln-date">${p ? `<b>${p.day}</b><small>${p.mon}</small>` : "<b>—</b>"}</span>
      <span class="ln-main"><b>${esc(i.title)}</b><small>${[EC.typeName(i.ex.type), p && p.wd, i.ex.time, EC.sessionName(i.ex), batchesOfEx(i.ex).join(", "), `পূর্ণমান ${bn(EC.fullOf(i.ex))}`].filter(Boolean).map(esc).join(" · ")}</small>${i.ex.chapter || i.ex.syllabus ? `<small class="ln-syl">${esc([i.ex.chapter, i.ex.syllabus].filter(Boolean).join(" — ").slice(0, 120))}</small>` : ""}</span>
      <span class="ln-side">${statusTag(i)}${nd ? `<span class="ln-tag docs">${bn(nd)}</span>` : ""}${st.entered ? `<span class="ln-tag">${bn(st.entered)} জন অংশ নিয়েছে</span>` : ""}</span></button>`;
  }
  function monthsFor(list, tab) {
    const dated = list.filter((i) => i.date).map((i) => ymOf(i.date)).sort(), now = ymOf(today());
    if (!dated.length) return [];
    let from = dated[0], to = dated[dated.length - 1];
    if (tab === "done" && to < now) to = now;
    if (tab === "next" && from > now) from = now;
    const out = []; for (let ym = from; ym <= to && out.length < 60; ym = addMonth(ym, 1)) out.push(ym);
    return tab === "done" ? out.reverse() : out;
  }
  const monthChips = (list, months, pick) => `<div class="ln-months"><button type="button" data-pick="" class="${pick === "" ? "on" : ""}">সব মাস <i>${bn(list.length)}</i></button>${months.map((ym) => { const n = list.filter((i) => ymOf(i.date) === ym).length; return `<button type="button" data-pick="${ym}" class="${pick === ym ? "on" : ""}${n ? "" : " none"}">${monthBn(ym)} <i>${bn(n)}</i></button>`; }).join("")}</div>`;
  function miniCal(list, ym) {
    const [y, m] = ym.split("-").map(Number), first = new Date(y, m - 1, 1).getDay(), days = new Date(y, m, 0).getDate(), t = today(), here = list.filter((i) => ymOf(i.date) === ym);
    let cells = DAYS.map((d) => `<span class="mc-wd">${d}</span>`).join("") + "<i></i>".repeat(first);
    for (let d = 1; d <= days; d++) {
      const iso = `${ym}-${String(d).padStart(2, "0")}`, l = here.filter((i) => i.date === iso);
      cells += l.length ? `<button type="button" class="mc-d on${iso === t ? " today" : ""}" style="--k:${TYPE_C[l[0].ex.type]}" data-open="${l[0].key}" title="${esc(l.map((i) => i.title).join(", "))}">${bn(d)}${l.length > 1 ? "<sup>" + bn(l.length) + "</sup>" : ""}</button>`
        : `<button type="button" class="mc-d${iso === t ? " today" : ""}" data-new="${iso}" title="এই দিনে পরীক্ষা যোগ করুন">${bn(d)}</button>`;
    }
    return `<div class="mc"><button type="button" class="mc-h" data-pick="${ym}"><b>${monthBn(ym)}</b><small>${here.length ? bn(here.length) + "টি" : "ছিল না"}</small></button><div class="mc-g">${cells}</div></div>`;
  }
  function listTab(all) {
    const done = all.filter((i) => i.done), next = all.filter((i) => !i.done && i.date);
    const list0 = S.tab === "done" ? [...done].reverse() : next, months = monthsFor(list0, S.tab), label = S.tab === "done" ? "সম্পন্ন" : "পরবর্তী";
    if (S.pick && !months.includes(S.pick)) S.pick = "";
    if (!list0.length) {
      S.month = S.month || ymOf(today());
      return empty(S.tab === "done" ? "এখনো কোনো পরীক্ষা সম্পন্ন হয়নি।" : 'সামনের কোনো পরীক্ষা দেওয়া নেই — "＋ নতুন পরীক্ষা" বা ক্যালেন্ডারের তারিখে চাপ দিয়ে যোগ করুন।') + `<div style="margin-top:14px">${board(all)}</div>`;
    }
    const pick = S.pick, list = pick === "" ? list0 : list0.filter((i) => ymOf(i.date) === pick);
    const title = pick === "" ? `${label} পরীক্ষা — ${S.tab === "done" ? "নতুন থেকে পুরনো" : "কাছ থেকে দূরে"}` : `${monthBn(pick)} — ${label} পরীক্ষা`;
    let h = monthChips(list0, months, pick) + `<section class="card"><h3>${title} <small class="ln-count">${bn(list.length)}টি</small></h3>${list.length ? `<div class="ln-list">${list.map((i, k) => row(i, k + 1)).join("")}</div>` : `<div class="ln-none">${monthBn(pick)}-এ কোনো পরীক্ষা ${S.tab === "done" ? "ছিল না" : "নেই"}।</div>`}</section>`;
    if (pick === "") h += `<section class="card" style="margin-top:14px"><h3>সব মাসের ক্যালেন্ডার <small class="ln-count">যেকোনো মাসে চাপ দিলে সেই মাস খুলবে</small></h3><div class="mc-wrap">${months.map((ym) => miniCal(list0, ym)).join("")}</div></section>`;
    else { S.month = pick; h += `<div style="margin-top:16px">${board(list0)}</div>`; }
    return h;
  }

  // ---------- মাসের বোর্ড: ব্যানার · অংশগ্রহণ ও সেরা ৫ · ক্যালেন্ডার ----------
  const ringSvg = (v) => { const r = 54, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, v || 0)); return `<svg viewBox="0 0 140 140" class="mb-ring"><circle cx="70" cy="70" r="${r}" fill="none" stroke="#ece4d0" stroke-width="16"/>${v == null || !p ? "" : `<circle cx="70" cy="70" r="${r}" fill="none" stroke="${p < 60 ? "#b4233c" : p < 80 ? "#d9a441" : "#187460"}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${(c * p) / 100} ${c}" transform="rotate(-90 70 70)"/>`}<text x="70" y="78" text-anchor="middle">${v == null ? "—" : bn(Math.round(p)) + "%"}</text></svg>`; };
  const typeKey = () => `<span class="ex-key">${TYPES_HERE().map(([k, t]) => `<span style="--k:${TYPE_C[k]}"><i></i>${esc(t)}</span>`).join("")}</span>`;
  function board(all) {
    const ym = S.month || ymOf(today()); S.month = ym;
    const list = all.filter((i) => ymOf(i.date) === ym), held = list.filter((i) => i.done);
    let sat = 0, rows = 0, pctSum = 0, pctN = 0, passN = 0; const sc = new Map();
    for (const i of held) {
      const ps = EC.parts(i.ex), full = EC.fullOf(i.ex);
      for (const sid of i.ex.studentIds || []) {
        rows++;
        const cell = ((i.ex.marks || {})[sid] || [])[i.a];
        if (!EC.attemptDone(cell, ps)) continue;
        sat++;
        const pct = full ? (ps.reduce((t, p) => t + (EC.num(cell[p.key]) || 0), 0) / full) * 100 : 0;
        pctSum += pct; pctN++;
        if (ps.every((p) => (EC.num(cell[p.key]) || 0) >= EC.passMark(p.full, i.ex, p.part))) passN++;
        const c = sc.get(sid) || { sum: 0, n: 0 }; c.sum += pct; c.n++; sc.set(sid, c);
      }
    }
    const rate = rows ? (sat / rows) * 100 : null;
    const top = [...sc.entries()].map(([id, c]) => ({ id, avg: c.sum / c.n, n: c.n })).sort((a, b) => b.avg - a.avg).slice(0, 5);
    const chips = [["মোট পরীক্ষা", bn(list.length) + "টি"], ["পরীক্ষার্থী", sat ? bn(sat) + " জন" : "—"], ["গড় নম্বর", pctN ? bn(Math.round(pctSum / pctN)) + "%" : "—"]];
    const left = `<section class="mb-left"><h3>অংশগ্রহণ</h3><div class="mb-ring-wrap">${ringSvg(rate)}</div>
      <div class="mb-boxes"><span class="p"><b>${held.length ? bn(Math.round(sat / held.length)) : "—"}</b>গড় অংশ নিয়েছে</span><span class="a"><b>${held.length ? bn(Math.round((rows - sat) / held.length)) : "—"}</b>গড় অনুপস্থিত</span><span class="l"><b>${pctN ? bn(Math.round((passN / pctN) * 100)) + "%" : "—"}</b>পাসের হার</span></div>
      <p class="mb-note">${rate == null ? "এই মাসে এখনো কোনো পরীক্ষা হয়নি।" : `প্রতি পরীক্ষায় গড়ে ${bn(Math.round(sat / held.length))} জন অংশ নিয়েছে`}</p>
      <div class="mb-list good"><h4>এই মাসের সেরা ${bn(Math.min(5, top.length) || 5)} জন</h4>${top.length ? `<ol>${top.map((x) => `<li><span class="mb-n">${esc(X.studentName(x.id))}</span><small>${esc(x.id)}</small><b>${bn(Math.round(x.avg))}%${x.n > 1 ? ` <i>(${bn(x.n)}টি)</i>` : ""}</b></li>`).join("")}</ol>` : "<p>এই মাসের তথ্য নেই।</p>"}</div></section>`;
    const [y, m] = ym.split("-").map(Number), first = new Date(y, m - 1, 1).getDay(), days = new Date(y, m, 0).getDate(), t = today();
    let cells = DAYS.map((d) => `<span class="mb-wd">${d}</span>`).join("") + "<i></i>".repeat(first);
    for (let d = 1; d <= days; d++) {
      const iso = `${ym}-${String(d).padStart(2, "0")}`, l = list.filter((i) => i.date === iso);
      cells += `<div class="mb-day${l.length ? " on" : ""}${iso === t ? " today" : ""}${iso > t ? " future" : ""}"${l.length ? ` style="--k:${TYPE_C[l[0].ex.type]}"` : ""} data-new="${iso}" title="চাপ দিন — এই দিনে পরীক্ষা যোগ করুন"><b>${bn(d)}</b>${l.slice(0, 2).map((i) => `<button type="button" data-open="${i.key}" title="${esc(i.title)}">${i.done ? "✓ " : ""}${esc(i.title)}${docsOf(i.ex.id).length ? " " : ""}</button>`).join("")}${l.length > 2 ? `<small>+${bn(l.length - 2)}</small>` : ""}</div>`;
    }
    const right = `<section class="mb-right"><div class="mb-calnav"><button type="button" data-month="-1">‹ আগের</button><b>${monthBn(ym)}</b><span class="mb-navr"><button type="button" class="mb-addbig" data-new="${ym === ymOf(t) ? t : ym + "-01"}">＋ পরীক্ষা যোগ করুন</button><button type="button" data-month="1">পরের ›</button></span></div>
      <p class="mb-hint">ক্যালেন্ডারের যেকোনো তারিখে চাপ দিন — সেদিনের জন্য নতুন পরীক্ষা তৈরি হবে।</p><div class="mb-grid">${cells}</div>
      <div class="mb-foot"><span class="c1">পরীক্ষা ${bn(list.length)}</span><span class="c2">সম্পন্ন ${bn(held.length)}</span><span class="c3">বাকি ${bn(list.length - held.length)}</span>${typeKey()}<small>যেকোনো পরীক্ষায় চাপ দিলে সেটার পাতা খুলবে · যেকোনো তারিখে চাপলে সেদিন নতুন পরীক্ষা যোগ হবে</small></div></section>`;
    return `<section class="mb-banner t-exam"><span class="mb-ico">✎</span><div class="mb-title"><h2>${monthBn(ym)}</h2><p>${list.length ? `এই মাসে ${bn(list.length)}টি পরীক্ষা — ${bn(held.length)}টি সম্পন্ন` : `এই মাসে কোনো পরীক্ষা ${ym < ymOf(t) ? "ছিল না" : "দেওয়া নেই"}`}</p></div><div class="mb-chips">${chips.map(([k, v]) => `<span><small>${k}</small><b>${v}</b></span>`).join("")}</div></section>
      <div class="mb-body">${left}${right}</div>`;
  }

  // ================= নম্বর এন্ট্রি =================
  function entryTab() {
    const list = exams().slice().sort(EC.byTitle);
    if (!list.length) return `<section class="card ex-entry">${empty('কোনো পরীক্ষা নেই — নম্বর দিতে আগে "＋ নতুন পরীক্ষা" চাপুন।')}<p style="text-align:center;margin:14px 0 0"><button type="button" class="btn gold" data-new="${today()}">＋ নতুন পরীক্ষা</button></p></section>`;
    // তালিকা নামের ক্রমে; শুরুতে খোলে সবচেয়ে নতুন পরীক্ষা
    if (!list.some((e) => e.id === S.examId)) { S.examId = list.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0].id; S.attempt = 0; }
    const ex = exById(S.examId), n = EC.attemptsOf(ex), ps = EC.parts(ex);
    if (S.attempt >= n) S.attempt = 0;
    const st = EC.attemptStats(ex, S.attempt);
    const pass = ps.map((p) => `<span><small>${esc(p.subject)} ${p.part.toUpperCase()} পাস</small><b>${bn(EC.passMark(p.full, ex, p.part))}/${bn(p.full)}</b></span>`).join("") + `<span class="full"><small>পূর্ণমান</small><b>${bn(EC.fullOf(ex))}</b></span>`;
    return `<section class="card ex-entry">
      <div class="ex-etop">
        <label class="grow">পরীক্ষা<select data-pick-exam>${list.map((e) => `<option value="${e.id}"${e.id === ex.id ? " selected" : ""}>${esc(U.examLabel(e))}</option>`).join("")}</select></label>
        ${n > 1 ? `<label>কোন বারের নম্বর<select data-pick-attempt>${EC.ATTEMPT_NAMES.map((t, a) => `<option value="${a}"${a === S.attempt ? " selected" : ""}>${t}${a === 0 ? " — প্রথম পরীক্ষা" : " — মানোন্নয়ন"}${dateOf(ex, a) ? " (" + U.date(dateOf(ex, a)) + ")" : ""}</option>`).join("")}</select></label>` : ""}
        <div class="ex-eact"><button type="button" class="btn line sm" data-edit-exam="${ex.id}">✎ সম্পাদনা</button><button type="button" class="btn line sm" data-open="${ex.id}~${S.attempt}">পরীক্ষার পাতা</button><button type="button" class="btn line sm" data-print-rank>Print / PDF</button><button type="button" class="btn line sm danger" data-del-exam="${ex.id}" title="পরীক্ষা মুছুন">✕</button></div>
      </div>
      <div class="ex-head">${typeChip(ex.type)}<b>${esc(ex.title)}</b><small>${[U.date(ex.date), modeName(ex.mode), EC.sessionName(ex), batchesOfEx(ex).join(", "), ex.chapter].filter(Boolean).map(esc).join(" · ")}</small></div>
      <div class="ex-pass">${pass}</div>
      ${lockBanner(ex)}
      ${n > 1 ? '<p class="ex-rule">Chapter Final: প্রতিবারের CQ ও MCQ নম্বর আলাদা থাকে। যতবার পরীক্ষা দিয়েছে শুধু সেগুলোর <b>গড়</b> নেওয়া হয় (সবচেয়ে ভালোটা নয়) — গড় CQ + গড় MCQ = মোট।</p>' : ""}
      <div class="exam-summary"><div><span>শিক্ষার্থী</span><b>${bn(st.students)}</b></div><div><span>নম্বর দেওয়া হয়েছে</span><b>${bn(st.entered)}</b></div><div><span>অনুপস্থিত</span><b>${bn(st.absent)}</b></div><div><span>বাকি</span><b>${bn(st.pending)}</b></div><div><span>গড় নম্বর</span><b>${num2(st.avg)}</b></div><div><span>সর্বোচ্চ নম্বর</span><b>${num2(st.high)}</b></div></div>
      <div class="ln-subs ex-modes">${[["bulk", "Bulk Entry"], ["id", "Student ID Entry"], ["rank", "Ranking"]].map(([k, t]) => `<button type="button" data-entry="${k}" class="${S.entry === k ? "on" : ""}">${t}</button>`).join("")}</div>
      ${S.entry === "bulk" ? bulk(ex) : S.entry === "id" ? idEntry(ex) : ranking(ex)}
    </section>`;
  }
  const cellTotal = (cell, ps) => { if (cell._absent) return "অনুপস্থিত"; const v = ps.map((p) => EC.num(cell[p.key])).filter((x) => x !== null); return v.length ? num2(v.reduce((t, x) => t + x, 0)) : "—"; };
  // নম্বরের ঘর (পূর্ণমানের বেশি লেখা যায় না) আর পাশে "অনুপস্থিত" টিক
  const markInput = (p, j, cell, locked) => `<input class="mk" inputmode="${negHere() ? "text" : "decimal"}" data-key="${esc(p.key)}" data-max="${p.full}" data-col="${j}" data-prev="${cell[p.key] ?? ""}" value="${cell[p.key] ?? ""}" autocomplete="off" placeholder="—" title="${locked ? "ফলাফল প্রকাশিত — সংশোধন চালু করুন" : negHere() ? "মাইনাসও লেখা যায় (যেমন -২৩), সর্বোচ্চ " + bn(p.full) : "০ থেকে " + bn(p.full)}"${cell._absent || locked ? " disabled" : ""}>`;
  const absentBox = (cell, locked) => `<label class="ex-abs-t" title="অনুপস্থিত হলে টিক দিন"><input type="checkbox" class="abs"${cell._absent ? " checked" : ""}${locked ? " disabled" : ""}><span>অনুপস্থিত</span></label>`;
  // ফলাফল প্রকাশিত হলে সেই ব্যাচের নম্বর লক (ফলাফল ব্যবস্থাপনা থেকে প্রকাশ হয়); "সংশোধন" চালু করলে কারণসহ বদলানো যায়
  const pubFor = (ex, sid) => !!(ex.published && ex.published[(X.studentById(sid) || {}).batchId]);
  const lockedFor = (ex, sid) => pubFor(ex, sid) && !S.correct[ex.id];
  function lockBanner(ex) {
    const pb = Object.keys(ex.published || {});
    if (!pb.length) return `<div class="ex-lock draft">Draft — ফলাফল এখনো প্রকাশ হয়নি, শিক্ষার্থীরা নম্বর দেখতে পায় না। যাচাই করে <a href="#results">ফলাফল ব্যবস্থাপনা</a> থেকে Publish করুন।</div>`;
    const why = S.correct[ex.id];
    return `<div class="ex-lock">প্রকাশিত: ${esc(pb.map(X.batchName).join(", "))} — ঐ ব্যাচের নম্বর লক করা। ${why
      ? `<b>✎ সংশোধন চলছে</b> (কারণ: ${esc(why)}) <button type="button" class="btn line sm" data-correct-end>সংশোধন শেষ</button>`
      : `<button type="button" class="btn line sm" data-correct>✎ সংশোধন চালু করুন</button>`} <a href="#results">ফলাফল ব্যবস্থাপনা →</a></div>`;
  }
  // এই সারির (এখন লেখা নম্বরসহ) ফলাফল — Chapter Final-এ অন্য বারের নম্বরসহ গড় ধরে
  function liveResult(ex, sid, cell) {
    const marks = { ...(ex.marks || {}) }, arr = [...(marks[sid] || [])];
    arr[S.attempt] = cell; marks[sid] = arr;
    return EC.studentResult({ ...ex, marks }, sid);
  }
  const passChip = (r) => (r.absent ? '<span class="chip">অনুপস্থিত</span>' : r.pass ? '<span class="chip ok">পাস</span>' : `<span class="chip bad" title="${esc(r.fails.map((k) => k.replace("|", " ").toUpperCase()).join(", "))}-এ ফেল">ফেল</span>`);
  function bulk(ex) {
    const ps = EC.parts(ex), R = EC.results(ex), rankOf = new Map(R.present.filter((r) => r.rank).map((r) => [r.sid, r.rank]));
    const studs = (ex.studentIds || []).map((id) => X.studentById(id) || { id, name: id }).sort((a, b) => a.id.localeCompare(b.id));
    return `<div class="ex-bulkbar"><span>না এলে "অনুপস্থিত" টিক দিন · পূর্ণমানের বেশি লেখা যায় না · Enter = ডানের ঘর (সারির শেষে পরের জন) · ↓ ↑ = নিচে / উপরে</span><span class="grow"></span><span class="ex-dirty" ${dirty ? "" : "hidden"}>● সেভ হয়নি</span><button type="button" class="btn line sm" data-clean title="সব লেখা নম্বর পরিষ্কার করুন">Clean</button><button type="button" class="btn gold" data-save-bulk>সব নম্বর সংরক্ষণ করুন</button></div>
      <div class="ek-panel"><div class="ek-title"><strong>${esc(ex.title)}</strong><span>খালি ঘর পূরণ করে নম্বর সংরক্ষণ করুন</span></div>
      <div class="tbl-wrap"><table class="exam-entry-table ek-sheet"><thead><tr><th class="ek-b">আইডি</th><th class="ek-b">শিক্ষার্থীর নাম</th><th class="ek-b">ব্যাচ</th>${ps.map((p) => `<th class="ek-s">${esc(p.subject)} - ${p.part.toUpperCase()}<small>পূর্ণমান ${bn(p.full)}</small></th>`).join("")}<th class="ek-s">অনুপস্থিত</th><th class="ek-s">মোট${EC.attemptsOf(ex) > 1 ? `<small>${EC.ATTEMPT_NAMES[S.attempt]}</small>` : ""}</th><th class="ek-r">ফলাফল${EC.attemptsOf(ex) > 1 ? "<small>৩ বারের গড়ে</small>" : ""}</th><th class="ek-r">Rank<small>শুধু পাস</small></th></tr></thead>
      <tbody>${studs.map((s) => { const cell = ((ex.marks || {})[s.id] || [])[S.attempt] || {}; const lk = lockedFor(ex, s.id); return `<tr data-sid="${esc(s.id)}"${lk ? ' class="ex-locked"' : ""}><td class="ek-id">${lk ? "" : ""}${esc(s.id)}</td><td class="ek-nm">${esc(s.name)}</td><td class="ek-bt">${esc(X.batchName(s.batchId))}</td>${ps.map((p, j) => `<td class="ek-m">${markInput(p, j, cell, lk)}</td>`).join("")}<td class="ek-m ek-ab">${absentBox(cell, lk)}</td><td class="tot ek-t">${cellTotal(cell, ps)}</td><td class="res ek-rs">${passChip(EC.studentResult(ex, s.id))}</td><td class="ek-rk">${rankOf.has(s.id) ? `<span class="ek-pill">${bn(rankOf.get(s.id))}</span>` : "—"}</td></tr>`; }).join("") || `<tr><td colspan="${ps.length + 7}" class="empty">এই পরীক্ষায় কোনো পরীক্ষার্থী নেই — "✎ সম্পাদনা" থেকে যোগ করুন</td></tr>`}</tbody></table></div></div>`;
  }
  function idEntry(ex) {
    const ps = EC.parts(ex), s = idSid && X.studentById(idSid), inEx = s && (ex.studentIds || []).includes(s.id);
    const cell = (s && ((ex.marks || {})[s.id] || [])[S.attempt]) || {};
    const mine = recent.filter((r) => r.exam === ex.id && r.a === S.attempt);
    return `<div class="ex-id"><label>Student Unique ID<input data-id-input inputmode="numeric" placeholder="যেমন: ${esc((ex.studentIds || [])[0] || "270001")}" value="${esc(idSid)}" autocomplete="off"></label><button type="button" class="btn line" data-id-find>খুঁজুন</button></div>
      ${idSid && !s ? '<p class="ex-msg">এই আইডির কোনো শিক্ষার্থী নেই।</p>' : ""}
      ${s && !inEx ? `<p class="ex-msg">${esc(s.name)} (${esc(s.id)}) এই পরীক্ষার পরীক্ষার্থী তালিকায় নেই — "✎ সম্পাদনা" থেকে যোগ করুন।</p>` : ""}
      ${s && inEx ? `<div class="ex-idcard"><div class="ex-idwho"><b>${esc(s.name)}</b><small>${esc(s.id)} · ${esc(X.batchName(s.batchId))}${EC.attemptsOf(ex) > 1 ? " · " + EC.ATTEMPT_NAMES[S.attempt] : ""}</small></div>
        <div class="ex-idmarks">${ps.map((p, j) => `<label>${esc(p.subject)} ${p.part.toUpperCase()} <small>/ ${bn(p.full)}</small>${markInput(p, j, cell, lockedFor(ex, s.id))}</label>`).join("")}${absentBox(cell, lockedFor(ex, s.id))}</div>
        ${lockedFor(ex, s.id) ? '<p class="ex-msg" style="flex-basis:100%">এই শিক্ষার্থীর ফলাফল প্রকাশিত — বদলাতে উপরের "✎ সংশোধন চালু করুন" চাপুন।</p>' : ""}
        <button type="button" class="btn gold" data-save-id>✓ সেভ করুন (Enter)</button></div>`
        : !idSid ? '<p class="ex-hint">আইডি লিখে Enter চাপুন → নাম দেখে নম্বর দিন → আবার Enter চাপলে সেভ হয়ে পরের আইডির জন্য তৈরি হবে।</p>' : ""}
      ${mine.length ? `<h4 class="ex-rh">এইমাত্র সেভ হলো (${bn(mine.length)})</h4><div class="ex-recent">${mine.slice(0, 12).map((r) => `<span><b>${esc(r.sid)}</b> ${esc(r.name)} — ${r.total} ${passChip(EC.studentResult(ex, r.sid))}</span>`).join("")}</div>` : ""}`;
  }
  function rankingTable(ex) {
    const ps = EC.parts(ex), R = EC.results(ex), n = EC.attemptsOf(ex);
    const head = `<tr><th>মেধাক্রম</th><th>আইডি</th><th>শিক্ষার্থীর নাম</th>${n > 1 ? '<th class="num">কতবার</th>' : ""}${ps.map((p) => `<th class="num">${esc(p.subject)} ${p.part.toUpperCase()}${n > 1 ? " (গড়)" : ""}<small>/ ${bn(p.full)}</small></th>`).join("")}<th class="num">মোট<small>/ ${bn(EC.fullOf(ex))}</small></th><th class="num">%</th><th>ফলাফল</th></tr>`;
    const rowOf = (r) => {
      const s = X.studentById(r.sid) || { name: r.sid };
      return r.absent
        ? `<tr class="ex-abs"><td>—</td><td>${esc(r.sid)}</td><td>${esc(s.name)}</td>${n > 1 ? '<td class="num">০</td>' : ""}${ps.map(() => '<td class="num">—</td>').join("")}<td class="num">—</td><td class="num">—</td><td><span class="chip">অনুপস্থিত</span></td></tr>`
        : `<tr><td><b>${r.rank ? U.rankName(r.rank) : "—"}</b></td><td>${esc(r.sid)}</td><td>${esc(s.name)}</td>${n > 1 ? `<td class="num">${bn(r.attempts)}/${bn(n)}</td>` : ""}${ps.map((p) => `<td class="num${r.fails.includes(p.key) ? " ex-fail" : ""}">${num2(r.scores[p.key])}</td>`).join("")}<td class="num"><b>${num2(r.total)}</b></td><td class="num">${bn(Math.round(r.percent))}%</td><td>${r.pass ? '<span class="chip ok">পাস</span>' : '<span class="chip bad">ফেল</span>'}</td></tr>`;
    };
    // মেধাক্রমে শুধু পাস করা; ফেল আর অনুপস্থিত আলাদা তালিকায়
    const rows = R.rows.filter((r) => r.rank).map(rowOf).join(""), others = R.rows.filter((r) => !r.rank).map(rowOf).join("");
    return { head, rows, others, R, cols: ps.length + (n > 1 ? 7 : 6) };
  }
  function ranking(ex) {
    const { head, rows, others, R, cols } = rankingTable(ex), s = R.stats;
    return `<div class="ex-rsum"><span><b>${bn(s.sat)}/${bn(s.students)}</b>অংশ নিয়েছে</span><span class="ok"><b>${bn(s.pass)}</b>পাস</span><span class="bad"><b>${bn(s.fail)}</b>ফেল</span><span><b>${num2(s.avg)}</b>গড়</span><span><b>${num2(s.high)}</b>সর্বোচ্চ</span></div>
      <h4 class="ex-rh">মেধাক্রম — শুধু পাস করা শিক্ষার্থী (${bn(s.pass)} জন)</h4>
      <div class="tbl-wrap"><table class="exam-entry-table"><thead>${head}</thead><tbody>${rows || `<tr><td colspan="${cols}" class="empty">এখনো কেউ পাস করেনি / নম্বর দেওয়া হয়নি</td></tr>`}</tbody></table></div>
      ${others ? `<h4 class="ex-rh ex-rh-bad">মেধাক্রমে নেই — ফেল ও অনুপস্থিত (${bn(s.fail + s.absent)} জন)</h4><div class="tbl-wrap"><table class="exam-entry-table ex-others"><thead>${head}</thead><tbody>${others}</tbody></table></div>` : ""}
      <p class="ex-rule">পাস: প্রতিটা বিষয়ের CQ আর MCQ — দুটোতেই আলাদাভাবে এক-তৃতীয়াংশ নম্বর লাগে (লাল ঘর = ঐ অংশে ফেল)। ফেল করলে মেধাক্রমে আসে না। মোট সমান হলে যার CQ বেশি সে আগে।${EC.attemptsOf(ex) > 1 ? " যতবার পরীক্ষা দিয়েছে শুধু সেগুলোর গড় ধরা হয়, দশমিকসহ।" : ""}</p>`;
  }
  function printRank() {
    const ex = exById(S.examId); if (!ex) return;
    const { head, rows, R } = rankingTable(ex);
    X.printDoc(`মেধা তালিকা — ${ex.title}`, `<style>.num{text-align:right}th small{display:block;font-weight:400;color:#5d7570}.ex-fail{color:#b4233c;font-weight:700}.chip{font-weight:700}.chip.ok{color:#0b5a4b}.chip.bad{color:#9b1c3c}tr.ex-abs td{color:#888}</style>
      <h1>মেধা তালিকা</h1><p><b>${esc(ex.title)}</b> · ${esc(EC.typeName(ex.type))} · ${U.date(ex.date)} · পূর্ণমান ${bn(EC.fullOf(ex))}${batchesOfEx(ex).length ? " · ব্যাচ " + esc(batchesOfEx(ex).join(", ")) : ""}</p>
      <table><thead>${head}</thead><tbody>${rows || '<tr><td colspan="9">কেউ পাস করেনি</td></tr>'}</tbody></table>
      <p>অংশ নিয়েছে ${bn(R.stats.sat)} জন · পাস ${bn(R.stats.pass)} জন · ফেল ${bn(R.stats.fail)} জন · অনুপস্থিত ${bn(R.stats.absent)} জন</p><div class="sign"><span></span><span>শিক্ষকের স্বাক্ষর</span></div>`);
  }
  // ঘরের নম্বর পড়া — ভুল হলে লাল
  function readCells(scope) {
    const ab = $(".abs", scope);
    if (ab && ab.checked) return { cell: { _absent: true }, bad: null };
    const cell = {}; let bad = null;
    for (const inp of $$(".mk", scope)) {
      const v = enNum(inp.value);
      if (v === "") continue;
      const n = Number(v);
      if (!Number.isFinite(n) || (n < 0 && !negHere()) || n > Number(inp.dataset.max)) { bad = bad || inp; continue; }
      cell[inp.dataset.key] = n;
    }
    return { cell, bad };
  }
  async function saveMarks(marks) {
    const why = S.correct[S.examId];
    await api("/api/admin/exam-marks", { body: { examId: S.examId, attempt: S.attempt, marks, ...(why ? { correction: true, reason: why } : {}) } });
  }
  async function saveBulk() {
    const marks = {}; let bad = null;
    for (const tr of $$("tr[data-sid]", C)) { const r = readCells(tr); marks[tr.dataset.sid] = r.cell; bad = bad || r.bad; }
    if (bad) { bad.focus(); return toast("লাল ঘরের নম্বর ঠিক করুন — ০ থেকে পূর্ণমানের মধ্যে", true); }
    try { await saveMarks(marks); dirty = false; await X.load(); render(); toast("সব নম্বর সংরক্ষণ হয়েছে"); } catch (e) { toast(e.message, true); }
  }
  async function saveId() {
    const card = $(".ex-idcard", C), s = X.studentById(idSid); if (!card || !s) return;
    const { cell, bad } = readCells(card);
    if (bad) { bad.focus(); return toast("লাল ঘরের নম্বর ঠিক করুন — ০ থেকে পূর্ণমানের মধ্যে", true); }
    try {
      await saveMarks({ [s.id]: cell });
      const v = Object.values(cell).filter((x) => typeof x === "number");
      recent.unshift({ exam: S.examId, a: S.attempt, sid: s.id, name: s.name, total: cell._absent ? "অনুপস্থিত" : v.length ? num2(v.reduce((t, x) => t + x, 0)) : "নম্বর মুছে ফেলা হয়েছে" });
      idSid = ""; dirty = false; await X.load(); focusAfter = "[data-id-input]"; render(); toast(`${s.name} — নম্বর সেভ হয়েছে`);
    } catch (e) { toast(e.message, true); }
  }
  function findId() {
    const inp = $("[data-id-input]", C); if (!inp) return;
    idSid = enNum(inp.value).toUpperCase();
    focusAfter = X.studentById(idSid) ? ".ex-idcard .mk" : "[data-id-input]";
    render();
  }

  // ================= ডকুমেন্টস =================
  function docCard(d, target) {
    const ex = exById(d.examId) || {}, src = `/api/admin/docs/${encodeURIComponent(d.id)}/file`;
    return `<div class="ln-doc k-${esc(d.kind)}"><span class="ln-doc-i">${ICON[d.kind] || ""}</span><div><b>${esc(d.title)}</b>${target ? `<small class="ln-target">${esc(ex.title || "")}${ex.date ? " · " + esc(U.date(ex.date)) : ""}</small>` : ""}
      <small>${[CATS[d.category], d.file ? sizeBn(d.file.size) : d.kind === "youtube" ? "YouTube" : "লিংক", d.category === "script" && d.studentId ? `শিক্ষার্থী ${d.studentId}` : "", U.date(String(d.createdAt || "").slice(0, 10))].filter(Boolean).map(esc).join(" · ")}</small>${d.note ? `<small class="ln-note">${esc(d.note)}</small>` : ""}</div>
      <span class="ln-doc-a"><button type="button" class="btn gold sm" data-view-doc="${d.id}">দেখুন</button>${d.file ? `<a class="btn line sm" href="${src}?download=1">↓ ডাউনলোড</a>` : `<a class="btn line sm" href="${esc(d.url)}" target="_blank" rel="noopener">→ খুলুন</a>`}<button type="button" class="btn line sm" data-edit-doc="${d.id}">সম্পাদনা</button><button type="button" class="btn line sm danger" data-del-doc="${d.id}">মুছুন</button></span></div>`;
  }
  const uploader = (examId, category, studentId = "", attempt = 0) => `<form class="ln-up" data-up data-exam="${examId}" data-category="${category}" data-student="${esc(studentId)}" data-attempt="${attempt}">
    <div class="ln-up-drop"><input type="file" name="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.mp4,.webm,.mp3,.m4a"><span>ফাইল বেছে নিন বা এখানে টেনে আনুন <small>PDF, ছবি, Word, PowerPoint, Excel, MP4 · একসাথে কয়েকটা · প্রতিটা ৬০ MB পর্যন্ত</small></span></div>
    <div class="ln-up-row"><input name="title" placeholder="শিরোনাম (খালি রাখলে ফাইলের নাম)"><input name="url" placeholder="অথবা YouTube / Google Drive লিংক"><input name="note" placeholder="ছোট নোট (ঐচ্ছিক)"><button class="btn gold" type="submit">যোগ করুন</button></div>
    <div class="ln-prog" hidden><i></i><span></span></div></form>`;
  // রুটিন PDF: আপলোড করলেই ঐ সেশন / ব্যাচের সব শিক্ষার্থীর প্যানেলে "পরীক্ষার রুটিন" ঘরে যায়
  const routines = () => { const ty = TYPES_HERE().map(([k]) => k); return (DB().examRoutines || []).filter((r) => !r.type ? !S.only : ty.includes(r.type)); };
  function routineTab() {
    const list = routines().slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const se = S.rtSession === undefined ? S.f.session : S.rtSession, bs = DB().batches.filter((b) => b.session === se && (b.active !== false || b.id === S.rtBatch));
    const who = (r) => [r.session || "সব সেশন", (r.batchIds || []).map((id) => (X.batchById(id) || {}).name || "").filter(Boolean).join(", ") || "সব ব্যাচ"].join(" · ");
    return `<section class="card"><h3>রুটিন PDF (${bn(list.length)})</h3>
      ${list.length ? `<div class="tbl-wrap"><table><thead><tr><th>রুটিন</th><th>ধরন</th><th>কারা পাবে</th><th>যোগের তারিখ</th><th></th></tr></thead><tbody>${list.map((r) => `<tr><td><b>${esc(r.title)}</b><small>${esc(r.pdf ? r.pdf.name : "")}</small></td><td>${r.type ? esc(EC.typeName(r.type)) : "সব পরীক্ষা"}</td><td>${esc(who(r))}</td><td>${U.date(String(r.createdAt).slice(0, 10))}</td><td class="num" style="white-space:nowrap"><a class="btn sm line" href="/api/admin/exam-routines/${encodeURIComponent(r.id)}/pdf" target="_blank" rel="noopener">দেখুন</a> <button type="button" class="icon-btn" title="মুছুন" data-del-routine="${r.id}">✕</button></td></tr>`).join("")}</tbody></table></div>` : empty("এখনো কোনো রুটিন PDF দেওয়া হয়নি।")}</section>
      <section class="card" style="margin-top:14px"><h3>＋ নতুন রুটিন PDF</h3><p class="ex-sub">আপলোড করলেই বেছে নেওয়া সেশন / ব্যাচের সব শিক্ষার্থী নিজের প্যানেলের "পরীক্ষার রুটিন" ঘরে পাবে।</p>
      <form data-routine-up novalidate><div class="ln-filter light"><label>সেশন<select data-rt-session name="session">${X.opt([["", "সব সেশন"], ...DB().sessions.map((s) => [s.name, s.name])], se)}</select></label>
        <label>ব্যাচ<select name="batch"${se ? "" : " disabled"}>${X.opt([["", se ? "সব ব্যাচ" : "আগে সেশন বাছুন"], ...bs.map((b) => [b.id, U.batchLabel(b)])], "")}</select></label>
        <label>পরীক্ষার ধরন<select name="type">${X.opt([...(S.only ? [] : [["", "সব পরীক্ষা"]]), ...TYPES_HERE()], S.only || "")}</select></label>
        <label style="flex:1">রুটিনের নাম<input name="title" placeholder="যেমন: Model Test রুটিন" value="${esc(S.rtTitle || "")}"></label></div>
        <p style="margin:12px 0"><input type="file" name="file" accept="application/pdf,.pdf"></p>
        <button type="submit" class="btn gold">আপলোড করুন</button><div class="ln-prog" hidden><i></i><span></span></div></form></section>`;
  }
  async function uploadRoutine(form) {
    const file = form.file.files[0], prog = $(".ln-prog", form), btn = $("button[type=submit]", form);
    if (!file) return toast("PDF ফাইল বেছে নিন", true);
    if (file.size > 15 * 1024 * 1024) return toast("PDF অনেক বড় — ১৫ MB-এর মধ্যে দিন", true);
    btn.disabled = true;
    try {
      const meta = { session: form.session.value, batchIds: form.batch.value ? [form.batch.value] : [], type: form.type.value, title: form.title.value.trim(), fileName: file.name };
      await sendFile(`/api/admin/exam-routines/upload?meta=${encodeURIComponent(JSON.stringify(meta))}`, file, prog);
      S.rtTitle = ""; await X.load(); render(); toast("রুটিন যোগ হয়েছে — শিক্ষার্থীরা নিজের প্যানেলে পাবে");
    } catch (e) { toast(e.message, true); btn.disabled = false; if (prog) prog.hidden = true; }
  }
  function docsTab() {
    const nd = DB().docs.filter((d) => exams().some((e) => e.id === d.examId)), q = S.q.toLowerCase();
    const list = nd.filter((d) => !q || `${d.title} ${(exById(d.examId) || {}).title} ${d.note || ""} ${d.studentId || ""}`.toLowerCase().includes(q)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    // নতুন ডকুমেন্ট: আগে পরীক্ষার ধরন, তারপর সেই ধরনের পরীক্ষার নাম, তারপর ডকুমেন্টের ধরন ও ফাইল
    const typesHere = TYPES_HERE(), docEx = exById(S.docTarget), docType = docEx ? docEx.type : S.docType || (typesHere.length === 1 ? typesHere[0][0] : "");
    const targets = docType ? exams().filter((e) => e.type === docType).sort(EC.byTitle) : [];
    return `<section class="card"><div class="ln-dochead"><h3>সব ডকুমেন্ট (${bn(nd.length)})</h3><input data-docq placeholder="খুঁজুন — শিরোনাম, পরীক্ষা, আইডি…" value="${esc(S.q)}"></div>
      ${list.length ? `<div class="ln-docs">${list.map((d) => docCard(d, true)).join("")}</div>` : empty(nd.length ? "এই খোঁজে কিছু পাওয়া যায়নি।" : "এখনো কোনো ডকুমেন্ট নেই।")}</section>
      <section class="card" style="margin-top:14px"><h3>＋ নতুন ডকুমেন্ট যোগ করুন</h3><p class="ex-sub">কোন পরীক্ষার ডকুমেন্ট বেছে নিন, তারপর ফাইল বা লিংক দিন। প্রশ্ন আর উত্তরপত্র ঐ পরীক্ষার সব পরীক্ষার্থী নিজের প্যানেলে পায়। প্রত্যেকের দেখা খাতা দিতে পরীক্ষার পাতা খুলে "মূল্যায়ন খাতা"-তে যান।</p>
      <div class="ln-filter light"><label>পরীক্ষার ধরন<select data-doc-type>${X.opt([["", "বেছে নিন…"], ...typesHere], docType)}</select></label><label style="flex:1">পরীক্ষার নাম<select data-doc-target${docType && targets.length ? "" : " disabled"}><option value="">${!docType ? "আগে পরীক্ষার ধরন বাছুন" : targets.length ? "বেছে নিন…" : "এই ধরনের কোনো পরীক্ষা নেই"}</option>${targets.map((e) => `<option value="${e.id}"${S.docTarget === e.id ? " selected" : ""}>${esc(U.examLabel(e))}</option>`).join("")}</select></label><label>ডকুমেন্টের ধরন<select data-doc-cat>${X.opt([["question", "প্রশ্ন"], ["answer", "উত্তরপত্র"]], S.docCat)}</select></label></div>
      ${S.docTarget && exById(S.docTarget) ? uploader(S.docTarget, S.docCat) : ""}</section>`;
  }

  // ================= একটা পরীক্ষার পাতা =================
  function detail(i) {
    const ex = i.ex, d = i.date ? dayParts(i.date) : null, docs = docsOf(ex.id), st = EC.attemptStats(ex, i.a), R = EC.results(ex), n = EC.attemptsOf(ex);
    const info = [["তারিখ", d ? `${U.date(i.date)} · ${d.wd}` : "তারিখ নেই"], ["সময়", ex.time], ["পরীক্ষার ধরন", EC.typeName(ex.type)], ["প্রশ্নের ধরন", modeName(ex.mode)], ["পূর্ণমান", bn(EC.fullOf(ex))],
      ["বিষয়", (ex.subjects || []).map((s) => `${s.name} (${[s.cq && "CQ " + bn(s.cq), s.mcq && "MCQ " + bn(s.mcq)].filter(Boolean).join(" + ")})`).join(", ")], ["সেশন", EC.sessionName(ex)], ["ব্যাচ", batchesOfEx(ex).join(", ") || "—"], ["পরীক্ষার্থী", bn((ex.studentIds || []).length) + " জন"],
      n > 1 ? ["তিন বারের তারিখ", [0, 1, 2].map((a) => (dateOf(ex, a) ? U.date(dateOf(ex, a)) : "—")).join(" · ")] : null].filter((x) => x && x[1]);
    const top = R.present.filter((r) => r.rank).slice(0, 3);
    const summary = st.entered
      ? `<div class="ln-att"><span class="p"><b>${bn(st.entered)}</b>অংশ নিয়েছে</span><span><b>${num2(st.avg)}/${bn(EC.fullOf(ex))}</b>গড়</span><span class="p"><b>${num2(st.high)}</b>সর্বোচ্চ</span><span class="a"><b>${bn(st.absent)}</b>অনুপস্থিত</span>${st.pending ? `<span><b>${bn(st.pending)}</b>বাকি</span>` : ""}</div>
        <p class="ex-sub" style="margin:10px 0 6px">${n > 1 ? "তিন বারের গড় ধরে" : "ফলাফল"}: <b>${bn(R.stats.pass)}</b> জন পাস, <b>${bn(R.stats.fail)}</b> জন ফেল</p>
        ${top.length ? `<ol class="ex-top">${top.map((r) => `<li><b>${bn(r.rank)}.</b> ${esc(X.studentName(r.sid))} <small>${esc(r.sid)}</small> <em>${num2(r.total)}</em></li>`).join("")}</ol>` : ""}
        <p style="margin:10px 0 0"><button type="button" class="btn line sm" data-go-entry="bulk">✎ নম্বর এন্ট্রিতে যান →</button> <button type="button" class="btn line sm" data-go-entry="rank">মেধাক্রম</button></p>`
      : empty(i.done ? "এই পরীক্ষার নম্বর এখনো দেওয়া হয়নি।" : "পরীক্ষা এখনো হয়নি।") + `<p style="margin:10px 0 0"><button type="button" class="btn line sm" data-go-entry="bulk">✎ নম্বর দিন →</button></p>`;
    const head = `<div class="ln-bar"><button type="button" class="btn line" data-back>‹ সব পরীক্ষা</button><span>${statusTag(i)} <button type="button" class="btn line sm" data-edit-exam="${ex.id}">✎ সম্পাদনা</button></span></div>
      <section class="ln-hero" style="--k:${TYPE_C[ex.type]}"><span class="ln-date big">${d ? `<b>${d.day}</b><small>${d.mon}</small>` : "<b>—</b>"}</span><div><small>${esc(EC.typeName(ex.type))}${n > 1 ? " · " + EC.ATTEMPT_NAMES[i.a] : ""}</small><h2>${esc(ex.title)}</h2>${ex.chapter || ex.syllabus ? `<p>${esc([ex.chapter, ex.syllabus].filter(Boolean).join(" — "))}</p>` : ""}</div></section>
      <div class="ln-two"><section class="card"><h3>তথ্য</h3><div class="ln-info">${info.map(([k, v]) => `<div><small>${k}</small><b>${esc(v)}</b></div>`).join("")}</div></section>
        <section class="card"><h3>ফলাফলের সারসংক্ষেপ${n > 1 ? ` <small class="ln-count">${EC.ATTEMPT_NAMES[i.a]}</small>` : ""}</h3>${summary}</section></div>`;
    const SUBS = [["question", "প্রশ্ন"], ["answer", "উত্তরপত্র"], ["script", "মূল্যায়ন খাতা"]];
    let sub;
    if (S.sub === "script") {
      const rankOf = new Map(R.present.map((r) => [r.sid, r]));
      sub = `<p class="ex-sub">প্রত্যেক শিক্ষার্থীর দেখা খাতা (স্ক্যান / ছবি / PDF) তার নিজের নামের পাশে দিন — শুধু সে-ই নিজের খাতা দেখতে পারবে।</p><div class="ln-scripts">${(ex.studentIds || []).map((id) => {
        const s = X.studentById(id), r = rankOf.get(id), mine = docs.filter((x) => x.category === "script" && x.studentId === id);
        return `<div class="ln-script"><div class="ln-sh"><b>${esc(s ? s.name : id)}</b><small>${esc(id)}${r ? ` · ${num2(r.total)}/${bn(r.full)} · ${r.rank ? "মেধাক্রম " + bn(r.rank) : "ফেল"}` : " · নম্বর নেই"}</small></div>${mine.map((x) => docCard(x)).join("")}<details${mine.length ? "" : ""}><summary>${mine.length ? "＋ আরেকটা খাতা" : "＋ খাতা আপলোড"}</summary>${uploader(ex.id, "script", id, i.a)}</details></div>`;
      }).join("") || empty("এই পরীক্ষার শিক্ষার্থী পাওয়া যায়নি।")}</div>`;
    } else {
      const list = docs.filter((x) => x.category === S.sub);
      sub = `${list.length ? `<div class="ln-docs">${list.map((x) => docCard(x)).join("")}</div>` : empty(S.sub === "question" ? "প্রশ্নপত্র এখনো দেওয়া হয়নি।" : "উত্তরপত্র এখনো দেওয়া হয়নি।")}${uploader(ex.id, S.sub, "", i.a)}`;
    }
    return head + `<section class="card" style="margin-top:14px"><div class="ln-subs">${SUBS.map(([k, t]) => `<button type="button" data-sub="${k}" class="${S.sub === k ? "on" : ""}">${t} <i>${bn(docs.filter((x) => x.category === k).length)}</i></button>`).join("")}</div>${sub}</section>`;
  }

  // ---------- ডকুমেন্ট দেখা / সম্পাদনা / আপলোড ----------
  let viewer = null;
  function viewDoc(d) {
    if (!viewer) {
      viewer = document.createElement("dialog"); viewer.className = "ex-viewer"; document.body.append(viewer);
      viewer.addEventListener("click", (e) => { if (e.target.closest("[data-x]") || e.target === viewer) { viewer.close(); viewer.innerHTML = ""; } });
    }
    const src = `/api/admin/docs/${encodeURIComponent(d.id)}/file`;
    const body = d.kind === "youtube" ? `<iframe referrerpolicy="strict-origin-when-cross-origin" src="https://www.youtube-nocookie.com/embed/${esc(d.youtube)}" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`
      : d.kind === "pdf" ? `<iframe src="${src}" title="${esc(d.title)}"></iframe>` : d.kind === "image" ? `<img src="${src}" alt="${esc(d.title)}">` : d.kind === "video" ? `<video src="${src}" controls playsinline></video>` : d.kind === "audio" ? `<audio src="${src}" controls></audio>`
      : d.kind === "link" ? `<p class="ln-empty">এই লিংকটি নতুন ট্যাবে খুলুন: <a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.url)}</a></p>` : '<p class="ln-empty">এই ফাইলটি ব্রাউজারে দেখা যায় না — ডাউনলোড করে খুলুন।</p>';
    viewer.innerHTML = `<div class="exv-head"><h3>${ICON[d.kind] || ""} ${esc(d.title)}</h3><button type="button" data-x aria-label="বন্ধ করুন">×</button></div><div class="ln-vbody">${body}</div><div class="exv-foot">${d.file ? `<a class="btn gold" href="${src}?download=1">↓ ডাউনলোড</a>` : `<a class="btn gold" href="${esc(d.url)}" target="_blank" rel="noopener">→ নতুন ট্যাবে</a>`}<button type="button" class="btn line" data-x>বন্ধ</button></div>`;
    viewer.showModal();
  }
  function editDoc(d) {
    X.openModal({
      title: "ডকুমেন্ট সম্পাদনা",
      body: `<div class="fgrid"><label class="wide">শিরোনাম<input name="title" value="${esc(d.title)}" required></label><label class="wide">নোট<textarea name="note" rows="3">${esc(d.note || "")}</textarea></label>
        ${d.category !== "script" ? `<label>ধরন<select name="category">${X.opt([["question", "প্রশ্ন"], ["answer", "উত্তরপত্র"]], d.category)}</select></label>` : ""}${d.file ? "" : `<label class="wide">লিংক<input name="url" value="${esc(d.url || "")}"></label>`}</div>`,
      onSave: async () => {
        const v = (n) => { const el = $(`#modalBody [name="${n}"]`); return el ? el.value.trim() : undefined; };
        await X.save("docs", { ...d, title: v("title") || d.title, note: v("note") || "", category: v("category") || d.category, url: d.file ? "" : v("url") || d.url }, d.id);
        await X.load(); render(); toast("ডকুমেন্ট সংরক্ষণ হয়েছে");
      },
    });
  }
  function sendFile(url, file, prog) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest(); x.open("POST", url); x.setRequestHeader("Content-Type", "application/octet-stream");
      x.upload.onprogress = (e) => { if (prog && e.lengthComputable) { prog.hidden = false; $("i", prog).style.width = (e.loaded / e.total) * 100 + "%"; $("span", prog).textContent = `${file.name} — ${bn(Math.round((e.loaded / e.total) * 100))}%`; } };
      x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch {} x.status < 300 ? resolve(j) : reject(new Error(j.error || "আপলোড হয়নি")); };
      x.onerror = () => reject(new Error("আপলোড হয়নি — সার্ভার চালু আছে কি না দেখুন"));
      x.send(file);
    });
  }
  async function upload(form) {
    const files = [...form.file.files], link = form.url.value.trim(), title = form.title.value.trim(), note = form.note.value.trim(), prog = $(".ln-prog", form);
    const base = { examId: form.dataset.exam, category: form.dataset.category, studentId: form.dataset.student || "", attempt: Number(form.dataset.attempt || 0) };
    if (!files.length && !link) return toast("ফাইল বেছে নিন বা লিংক দিন", true);
    const big = files.find((f) => f.size > 60 * 1024 * 1024); if (big) return toast(`${big.name} — ৬০ MB-এর বেশি, ছোট করে দিন`, true);
    const btn = $("button[type=submit]", form); btn.disabled = true;
    try {
      for (const file of files) await sendFile(`/api/admin/docs/upload?meta=${encodeURIComponent(JSON.stringify({ ...base, title: files.length === 1 ? title : "", note, fileName: file.name }))}`, file, prog);
      if (link) await X.save("docs", { ...base, title, note, url: link });
      await X.load(); render(); toast(`${bn(files.length + (link ? 1 : 0))}টি ডকুমেন্ট যোগ হয়েছে — শিক্ষার্থীরা নিজের প্যানেলে পাবে`);
    } catch (e) { toast(e.message, true); btn.disabled = false; if (prog) prog.hidden = true; }
  }

  // ================= "নতুন পরীক্ষা" ফর্ম =================
  let dlg = null, B = null; // B = ফর্মের অবস্থা
  function builderDialog() {
    if (dlg) return dlg;
    dlg = document.createElement("dialog"); dlg.className = "exam-builder-dialog"; document.body.append(dlg);
    dlg.innerHTML = `<form novalidate><div class="dialog-head"><div><span class="eyebrow">পরীক্ষা কাস্টমাইজ করুন</span><h2 data-btitle>নতুন পরীক্ষা</h2></div><button type="button" data-x aria-label="বন্ধ করুন">×</button></div>
      <div class="exam-builder-body">
        <div class="form-grid exam-builder-basics">
          <label>পরীক্ষার ধরন<select name="type">${TYPES_HERE().map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join("")}</select></label>
          <label>পরীক্ষার নাম<input name="title" required placeholder="যেমন: Weekly Test-01"></label>
          <label>প্রশ্নের ধরন<select name="mode">${EC.MODES.map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join("")}</select></label>
          <label>পরীক্ষার তারিখ<input name="date" type="date"></label>
          <label>পূর্ণমান<input name="full" class="calculated-full-marks" readonly placeholder="—" aria-label="নির্বাচিত বিষয়গুলোর মোট পূর্ণমান"></label>
        </div>
        <div class="form-grid exam-builder-more">
          <label>সেশন<select name="session"></select></label>
          <label class="span2">অধ্যায় / সিলেবাস<input name="chapter" placeholder="যেমন: অধ্যায় ১ — তথ্য ও যোগাযোগ প্রযুক্তি: বিশ্ব ও বাংলাদেশ প্রেক্ষিত"></label>
          <label>সময় (ঐচ্ছিক)<input name="time" placeholder="যেমন: সকাল ১০:০০"></label>
          <label class="builder-pass-cq">CQ পাস (%)<input name="passCq" inputmode="decimal" autocomplete="off"></label>
          <label class="builder-pass-mcq">MCQ পাস (%)<input name="passMcq" inputmode="decimal" autocomplete="off"></label>
        </div>
        <div class="exam-chapter-dates" data-only-ch>
          <p><b>Chapter Final Test — একই অধ্যায়ে ৩ বার পরীক্ষা।</b> ফলাফল = যতবার দিয়েছে তার গড় (সবচেয়ে ভালোটা নয়)। ১ম বার = উপরের তারিখ।</p>
          <label>২য় বারের তারিখ<input type="date" name="d2"></label><label>৩য় বারের তারিখ<input type="date" name="d3"></label>
        </div>
        <section class="exam-builder-section"><div class="exam-builder-section-head"><div><b>বিষয় ও পূর্ণমান</b><small>প্রতিটি বিষয়ে CQ/MCQ রাখা বা বাদ দেওয়া যাবে</small></div><button type="button" class="btn line" data-add-subject>＋ বিষয় যোগ করুন</button></div><div class="exam-subject-builder"></div></section>
        <section class="exam-builder-section"><div class="exam-builder-section-head"><div><b>পরীক্ষার্থী নির্বাচন</b><small data-pmeta>সেশন অনুযায়ী শিক্ষার্থী দেখানো হবে</small></div><button type="button" class="btn line" data-toggle-all>সব নির্বাচন করুন</button></div>
          <div class="exam-student-course-filter"></div><div class="exam-student-picker"></div></section>
      </div>
      <div class="dialog-actions"><span class="ex-berr"></span><button type="button" class="btn line" data-x>Cancel</button><button type="submit" class="btn gold" data-bsave>OK — নম্বর এন্ট্রি তৈরি করুন</button></div></form>`;
    const F = $("form", dlg), rowsBox = $(".exam-subject-builder", dlg);
    dlg.addEventListener("click", (e) => {
      if (e.target.closest("[data-x]")) return dlg.close();
      if (e.target.closest("[data-add-subject]")) { addRow("", "", ""); return calcFull(); }
      const rm = e.target.closest(".remove-exam-subject");
      if (rm) { rm.closest(".exam-subject-row").remove(); if (!rowsBox.children.length) addRow("", "", ""); return calcFull(); }
      const tg = e.target.closest(".toggle-exam-part");
      if (tg) {
        const part = tg.closest(".builder-mark-part"), on = part.classList.contains("part-removed"), P = tg.dataset.part.toUpperCase();
        part.classList.toggle("part-removed", !on); $("input", part).disabled = !on;
        tg.textContent = on ? "×" : `＋ ${P}`; tg.setAttribute("aria-label", on ? `${P} অংশ বাদ দিন` : `${P} অংশ ফিরিয়ে আনুন`);
        return calcFull();
      }
      const chip = e.target.closest("[data-pbatch]");
      if (chip) { B.view = chip.dataset.pbatch; return drawPicker(); }
      if (e.target.closest("[data-toggle-all]")) {
        const shown = pickerList(), allOn = shown.every((s) => B.sel.has(s.id));
        shown.forEach((s) => (allOn ? B.sel.delete(s.id) : B.sel.add(s.id))); return drawPicker();
      }
    });
    dlg.addEventListener("change", (e) => {
      const t = e.target;
      if (t.name === "mode") { refreshMode(); calcFull(); }
      if (t.name === "type") { onType(); }
      if (t.name === "session") { B.view = ""; B.sel = new Set(activeIn(t.value).map((s) => s.id)); drawPicker(); }
      if (t.matches(".exam-student-choice input")) { t.checked ? B.sel.add(t.value) : B.sel.delete(t.value); drawPickerMeta(); }
    });
    dlg.addEventListener("input", (e) => { if (e.target.matches(".builder-cq-mark,.builder-mcq-mark")) calcFull(); });
    dlg.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || !e.target.matches(".builder-cq-mark,.builder-mcq-mark,.builder-subject-name")) return;
      e.preventDefault();
      const inputs = $$(".builder-subject-name,.builder-cq-mark:not(:disabled),.builder-mcq-mark:not(:disabled)", rowsBox), nx = inputs[inputs.indexOf(e.target) + 1];
      if (nx) { nx.focus(); nx.select(); }
    });
    F.addEventListener("submit", (e) => { e.preventDefault(); submitBuilder(); });
    return dlg;
  }
  const activeIn = (session) => DB().students.filter((s) => s.status !== "inactive" && (!session || s.session === session));
  function addRow(name, cq, mcq, cqOn = true, mcqOn = true) {
    const box = $(".exam-subject-builder", dlg), row = document.createElement("div");
    row.className = "exam-subject-row";
    const part = (k, v, on) => `<div class="builder-mark-part builder-${k}-wrap${on ? "" : " part-removed"}"><div class="builder-mark-part-head"><span>${k.toUpperCase()} পূর্ণমান</span><button type="button" class="toggle-exam-part" data-part="${k}" aria-label="${on ? `${k.toUpperCase()} অংশ বাদ দিন` : `${k.toUpperCase()} অংশ ফিরিয়ে আনুন`}">${on ? "×" : "＋ " + k.toUpperCase()}</button></div><input class="builder-${k}-mark" inputmode="decimal" value="${v === "" || v === undefined || v === 0 ? "" : esc(v)}" placeholder="${k.toUpperCase()} পূর্ণমান"${on ? "" : " disabled"}></div>`;
    row.innerHTML = `<label>বিষয়ের নাম *<input class="builder-subject-name" value="${esc(name)}" placeholder="বিষয়ের নাম" required></label>${part("cq", cq, cqOn)}${part("mcq", mcq, mcqOn)}<button type="button" class="remove-exam-subject" aria-label="বিষয় বাদ দিন">×</button>`;
    box.append(row);
    refreshMode();
  }
  const F = () => $("form", dlg);
  function refreshMode() {
    const mode = F().mode.value;
    $(".builder-pass-cq", dlg).hidden = mode === "mcq"; $(".builder-pass-mcq", dlg).hidden = mode === "cq";
    $$(".exam-subject-row", dlg).forEach((r) => { $(".builder-cq-wrap", r).hidden = mode === "mcq"; $(".builder-mcq-wrap", r).hidden = mode === "cq"; });
  }
  function readSubjects() {
    const mode = F().mode.value;
    return $$(".exam-subject-row", dlg).map((r) => {
      const on = (k) => (k === "cq" ? mode !== "mcq" : mode !== "cq") && !$(`.builder-${k}-wrap`, r).classList.contains("part-removed");
      const v = (k) => (on(k) ? Number(enNum($(`.builder-${k}-mark`, r).value)) || 0 : 0);
      return { name: $(".builder-subject-name", r).value.trim(), cq: v("cq"), mcq: v("mcq"), cqOn: on("cq"), mcqOn: on("mcq") };
    });
  }
  function calcFull() { const t = readSubjects().reduce((n, s) => n + s.cq + s.mcq, 0); F().full.value = t ? bn(t) : ""; }
  function onType() {
    const f = F(), type = f.type.value;
    $("[data-only-ch]", dlg).hidden = type !== "chapter";
    // পাস মার্ক: নিজে না বদলালে ধরন অনুযায়ী
    if (!B.edit) for (const i of [f.passCq, f.passMcq]) if (i.value === "" || i.dataset.auto === i.value) { i.value = EC.passPctDefault(type); i.dataset.auto = i.value; }
    // নাম খালি বা আগের মতো স্বয়ংক্রিয় হলে নতুন নাম প্রস্তাব
    if (!B.edit && (!f.title.value.trim() || f.title.dataset.auto === f.title.value)) { f.title.value = suggestTitle(type, f.session.value); f.title.dataset.auto = f.title.value; }
    // Chapter Final: পূর্ণমান খালি থাকলে CQ ২০ + MCQ ১৫
    if (type === "chapter") $$(".exam-subject-row", dlg).forEach((r) => { const c = $(".builder-cq-mark", r), m = $(".builder-mcq-mark", r); if (!c.value && !m.value) { c.value = 20; m.value = 15; } });
    calcFull();
  }
  function suggestTitle(type, session) {
    const n = Math.max(0, ...DB().exams.filter((e) => e.type === type && (!session || !e.session || e.session === session)).map((e) => Number((EC.titleKey(e.title).match(/(\d+)$/) || [])[1]) || 0)) + 1; // সবচেয়ে বড় নম্বরের পরেরটা
    return `${EC.typeName(type)}-${String(n).padStart(2, "0")}`; // ইংরেজি সংখ্যা — আগের পরীক্ষাগুলোর নামের মতো (Weekly Test-01)
  }
  // পরীক্ষার্থী বাছাই: উপরে ব্যাচের চিপ (দেখানোর ফিল্টার), নিচে টিক দেওয়া তালিকা
  const pickerList = () => activeIn(F().session.value).filter((s) => !B.view || s.batchId === B.view).sort((a, b) => a.id.localeCompare(b.id));
  function drawPicker() {
    const session = F().session.value, studs = activeIn(session), batches = DB().batches.filter((b) => !session || b.session === session);
    const cnt = (list) => `${bn(list.filter((s) => B.sel.has(s.id)).length)}/${bn(list.length)}`;
    $(".exam-student-course-filter", dlg).innerHTML = [["", "সব ব্যাচ", studs], ...batches.map((b) => [b.id, b.name, studs.filter((s) => s.batchId === b.id)])].filter(([k, , l]) => !k || l.length)
      .map(([k, t, l]) => `<button type="button" data-pbatch="${k}" class="${B.view === k ? "active" : ""}">${esc(t)} <b>${cnt(l)}</b></button>`).join("");
    const list = pickerList();
    $(".exam-student-picker", dlg).innerHTML = list.map((s) => `<label class="exam-student-choice"><input type="checkbox" value="${esc(s.id)}"${B.sel.has(s.id) ? " checked" : ""}><span><b>${esc(s.name)}</b><small>${esc(s.id)} · ${esc(X.batchName(s.batchId))}</small></span></label>`).join("") || '<p class="ex-sub" style="grid-column:1/-1">এই সেশনে / ব্যাচে কোনো সক্রিয় শিক্ষার্থী নেই।</p>';
    drawPickerMeta();
  }
  function drawPickerMeta() {
    const shown = pickerList();
    $("[data-pmeta]", dlg).textContent = `${bn(B.sel.size)} জন নির্বাচিত · ${F().session.value || "উভয়"}${B.view ? " · ব্যাচ " + X.batchName(B.view) : ""}`;
    $("[data-toggle-all]", dlg).textContent = shown.length && shown.every((s) => B.sel.has(s.id)) ? "সব বাদ দিন" : "সব নির্বাচন করুন";
    $$(".exam-student-course-filter [data-pbatch]", dlg).forEach((b) => { const k = b.dataset.pbatch, l = activeIn(F().session.value).filter((s) => !k || s.batchId === k); $("b", b).textContent = `${bn(l.filter((s) => B.sel.has(s.id)).length)}/${bn(l.length)}`; });
  }
  function openBuilder(ex, date) {
    builderDialog();
    const f = F(), session = ex ? ex.session : S.f.session || (X.liveSessions()[0] || {}).name || "";
    B = { edit: ex || null, view: ex ? "" : S.f.batch || "", sel: new Set() };
    $("[data-btitle]", dlg).textContent = ex ? "পরীক্ষা সম্পাদনা" : "নতুন পরীক্ষা";
    $("[data-bsave]", dlg).textContent = ex ? "সংরক্ষণ করুন" : "OK — নম্বর এন্ট্রি তৈরি করুন";
    $(".ex-berr", dlg).textContent = "";
    f.session.innerHTML = X.opt([...DB().sessions.map((s) => [s.name, s.name + (s.active === false ? " — বন্ধ" : "")]), ...(DB().sessions.length > 1 ? [["", `উভয় (${DB().sessions.map((s) => s.name).join(" + ")})`]] : [])], session);
    // ফর্ম একবারই তৈরি হয়, তাই ধরনের তালিকা প্রতিবার এই ট্যাব অনুযায়ী (মডেল টেস্ট ট্যাবে শুধু Model Test)
    const typeNow = ex ? ex.type : S.only || S.f.type || "weekly";
    f.type.innerHTML = X.opt(EC.TYPES.filter(([k]) => k === typeNow || TYPES_HERE().some(([h]) => h === k)), typeNow);
    f.mode.value = ex ? ex.mode : "both";
    f.passCq.value = ex ? ex.passCq || EC.passPctDefault(ex.type) : ""; f.passMcq.value = ex ? ex.passMcq || EC.passPctDefault(ex.type) : ""; f.passCq.dataset.auto = f.passMcq.dataset.auto = "";
    f.date.value = ex ? ex.date || "" : date || today();
    f.title.value = ex ? ex.title : ""; f.title.dataset.auto = "";
    f.chapter.value = ex ? ex.chapter || "" : ""; f.time.value = ex ? ex.time || "" : "";
    f.d2.value = ex ? (ex.attemptDates || [])[1] || "" : ""; f.d3.value = ex ? (ex.attemptDates || [])[2] || "" : "";
    $(".exam-subject-builder", dlg).innerHTML = "";
    if (ex) (ex.subjects || []).forEach((s) => addRow(s.name, s.cq, s.mcq, s.cq > 0 || ex.mode === "mcq", s.mcq > 0 || ex.mode === "cq"));
    else addRow("ICT", "", "");
    if (ex) B.sel = new Set(ex.studentIds || []);
    else B.sel = new Set(activeIn(session).filter((s) => !B.view || s.batchId === B.view).map((s) => s.id));
    $("[data-only-ch]", dlg).hidden = f.type.value !== "chapter";
    if (!ex) onType(); else calcFull();
    drawPicker();
    dlg.showModal();
    setTimeout(() => f.title.focus(), 30);
  }
  async function submitBuilder() {
    const f = F(), err = (m, el) => { $(".ex-berr", dlg).textContent = m; toast(m, true); if (el) el.focus(); };
    const title = f.title.value.trim(), subjects = readSubjects().filter((s) => s.name);
    if (!title) return err("পরীক্ষার নাম লিখুন।", f.title);
    if (EC.sameNameExam(DB().exams, { title, session: f.session.value }, B.edit && B.edit.id)) return err(`"${title}" নামে এই সেশনে আগেই একটা পরীক্ষা আছে — অন্য নাম দিন।`, f.title);
    if (!subjects.length) return err("কমপক্ষে একটি বিষয় যোগ করুন।", $(".builder-subject-name", dlg));
    if (subjects.some((s) => !s.cqOn && !s.mcqOn)) return err("প্রতিটি বিষয়ে CQ অথবা MCQ — কমপক্ষে একটি অংশ রাখুন।");
    if (subjects.some((s) => (s.cqOn && s.cq <= 0) || (s.mcqOn && s.mcq <= 0))) return err("রাখা প্রতিটি অংশের পূর্ণমান লিখুন।");
    if (new Set(subjects.map((s) => s.name)).size !== subjects.length) return err("একই নামের বিষয় দুইবার দেওয়া হয়েছে।");
    if (!B.sel.size) return err("কমপক্ষে একজন পরীক্ষার্থী নির্বাচন করুন।");
    const passCq = Number(enNum(f.passCq.value)), passMcq = Number(enNum(f.passMcq.value));
    if (f.mode.value !== "mcq" && !(passCq > 0 && passCq <= 100)) return err("CQ পাস মার্ক ১ থেকে ১০০-এর মধ্যে লিখুন (শতকরা হিসাবে)।", f.passCq);
    if (f.mode.value !== "cq" && !(passMcq > 0 && passMcq <= 100)) return err("MCQ পাস মার্ক ১ থেকে ১০০-এর মধ্যে লিখুন (শতকরা হিসাবে)।", f.passMcq);
    const ex = B.edit, type = f.type.value;
    const body = {
      type, passCq: passCq || 0, passMcq: passMcq || 0, mode: f.mode.value, title, date: f.date.value, time: f.time.value.trim(), session: f.session.value, chapter: f.chapter.value.trim(), syllabus: ex ? ex.syllabus || "" : "",
      attemptDates: type === "chapter" ? [f.date.value, f.d2.value, f.d3.value] : [],
      subjects: subjects.map(({ name, cq, mcq }) => ({ name, cq, mcq })), studentIds: [...B.sel],
      batchIds: [...new Set([...B.sel].map((id) => (X.studentById(id) || {}).batchId).filter(Boolean))], marks: ex ? ex.marks : {},
    };
    if (ex) {
      // বাদ দেওয়া বিষয় / অংশ / শিক্ষার্থীর নম্বর থাকলে আগে জানানো
      const keep = new Set(EC.parts(body).map((p) => p.key)), lost = Object.entries(ex.marks || {}).some(([sid, arr]) => !B.sel.has(sid) || (arr || []).some((a) => a && Object.keys(a).some((k) => !keep.has(k))));
      const fewer = EC.attemptsOf(ex) > EC.attemptsOf(body) && Object.values(ex.marks || {}).some((arr) => (arr || []).slice(1).some(Boolean));
      if ((lost || fewer) && !confirm("বাদ দেওয়া বিষয় / অংশ / শিক্ষার্থী (বা ২য়-৩য় বারের) কিছু নম্বর মুছে যাবে। তবুও সেভ করবেন?")) return;
    }
    const btn = $("[data-bsave]", dlg); btn.disabled = true;
    try {
      const r = await X.save("exams", body, ex && ex.id);
      dlg.close();
      S.examId = r.item.id; S.attempt = 0; S.tab = "entry"; S.entry = "bulk"; S.open = ""; dirty = false;
      await X.load(); render(); window.scrollTo({ top: 0, behavior: "smooth" });
      toast(ex ? "পরীক্ষা সংরক্ষণ হয়েছে" : "নম্বর এন্ট্রি পেজ তৈরি হয়েছে");
    } catch (e2) { err(e2.message); }
    btn.disabled = false;
  }

  // ================= ঘটনা (ক্লিক, বদল, টাইপ) =================
  const leaveOk = () => (!dirty || confirm("নম্বর এখনো সেভ হয়নি। সেভ না করে চলে যাবেন?"));
  function onClick(e) {
    const t = (sel) => e.target.closest(sel);
    let el;
    if ((el = t("[data-open]"))) { if (!leaveOk()) return; dirty = false; S.open = el.dataset.open; S.sub = "question"; render(); return window.scrollTo({ top: 0 }); }
    if ((el = t("[data-new]"))) return openBuilder(null, el.dataset.new);
    if ((el = t("[data-tab]"))) { if (!leaveOk()) return; dirty = false; S.tab = el.dataset.tab; S.pick = ""; return render(); }
    if (t("[data-back]")) { S.open = ""; return render(); }
    if ((el = t("[data-month]"))) { const n = Number(el.dataset.month); S.month = n === 0 ? ymOf(today()) : addMonth(S.month || ymOf(today()), n); return render(); }
    if ((el = t("[data-pick]"))) { S.pick = el.dataset.pick; return render(); }
    if ((el = t("[data-entry]"))) { if (!leaveOk()) return; dirty = false; S.entry = el.dataset.entry; if (S.entry === "id") focusAfter = "[data-id-input]"; return render(); }
    if ((el = t("[data-edit-exam]"))) return openBuilder(exById(el.dataset.editExam));
    if ((el = t("[data-del-exam]"))) { dirty = false; return X.remove("exams", el.dataset.delExam, "এই পরীক্ষা, এর সব নম্বর ও ডকুমেন্ট"); }
    if (t("[data-print-rank]")) return printRank();
    if (t("[data-save-bulk]")) return saveBulk();
    if (t("[data-clean]")) {
      // প্রকাশিত (লক) সারি বাদ
      $$("tr[data-sid]:not(.ex-locked) .abs", C).forEach((a) => (a.checked = false));
      $$("tr[data-sid]:not(.ex-locked) .mk", C).forEach((i) => { i.value = ""; i.dataset.prev = ""; i.disabled = false; i.classList.remove("bad"); });
      $$("tr[data-sid]:not(.ex-locked)", C).forEach(refreshRow);
      return markDirty();
    }
    if (t("[data-correct]")) {
      const why = (prompt("সংশোধনের কারণ লিখুন (যেমন: খাতা আবার দেখে নম্বর বেড়েছে)") || "").trim();
      if (why.length < 3) return why ? toast("কারণ একটু বিস্তারিত লিখুন", true) : null;
      S.correct[S.examId] = why; toast("সংশোধন চালু — নম্বর বদলে সেভ করুন, ইতিহাসে কারণসহ থাকবে"); return render();
    }
    if (t("[data-correct-end]")) { if (!leaveOk()) return; dirty = false; delete S.correct[S.examId]; return render(); }
    if (t("[data-id-find]")) return findId();
    if (t("[data-save-id]")) return saveId();
    if ((el = t("[data-sub]"))) { S.sub = el.dataset.sub; return render(); }
    if ((el = t("[data-go-entry]"))) { const it = items().find((i) => i.key === S.open); if (it) { S.examId = it.ex.id; S.attempt = it.a; } S.tab = "entry"; S.entry = el.dataset.goEntry; S.open = ""; return render(); }
    if ((el = t("[data-view-doc]"))) return viewDoc(DB().docs.find((d) => d.id === el.dataset.viewDoc));
    if ((el = t("[data-edit-doc]"))) return editDoc(DB().docs.find((d) => d.id === el.dataset.editDoc));
    if ((el = t("[data-del-doc]"))) return X.remove("docs", el.dataset.delDoc, "এই ডকুমেন্ট");
    if ((el = t("[data-del-routine]"))) return X.remove("examRoutines", el.dataset.delRoutine, "এই রুটিন");
  }
  function markDirty() { dirty = true; const f = $(".ex-dirty", C); if (f) f.hidden = false; }
  function onChange(e) {
    const el = e.target;
    if (el.dataset.f) { S.f[el.dataset.f] = el.value; if (el.dataset.f === "session" && S.f.batch && (X.batchById(S.f.batch) || {}).session !== el.value) S.f.batch = ""; keepFilter(); S.pick = ""; return render(); }
    if (el.matches("[data-pick-exam]")) { if (!leaveOk()) { el.value = S.examId; return; } dirty = false; S.examId = el.value; S.attempt = 0; idSid = ""; return render(); }
    if (el.matches("[data-pick-attempt]")) { if (!leaveOk()) { el.value = S.attempt; return; } dirty = false; S.attempt = Number(el.value); return render(); }
    // অনুপস্থিত টিক: নম্বরের ঘর খালি ও বন্ধ; টিক তুললে আবার লেখা যায়
    if (el.matches(".abs")) {
      const scope = el.closest("tr[data-sid]") || el.closest(".ex-idcard");
      $$(".mk", scope).forEach((i) => { if (el.checked) { i.value = ""; i.dataset.prev = ""; } i.disabled = el.checked; i.classList.remove("bad"); });
      if (!el.checked) { const f = $(".mk", scope); if (f) f.focus(); }
      refreshRow(el.closest("tr[data-sid]"));
      return markDirty();
    }
    if (el.matches("[data-rt-session]")) { S.rtSession = el.value; S.rtTitle = el.form.title.value; return render(); }
    if (el.matches("[data-doc-type]")) { S.docType = el.value; S.docTarget = ""; return render(); }
    if (el.matches("[data-doc-target]")) { S.docTarget = el.value; return render(); }
    if (el.matches("[data-doc-cat]")) { S.docCat = el.value; return render(); }
    if (el.matches(".ln-up input[type=file]")) { const n = el.files.length; $("span", el.parentNode).firstChild.textContent = n ? `${n === 1 ? el.files[0].name : bn(n) + "টি ফাইল বেছে নেওয়া হয়েছে"} ` : "ফাইল বেছে নিন বা এখানে টেনে আনুন "; }
  }
  // সারির মোট, পাস / ফেল আর সবার Rank সাথে সাথে বদলায় — সেভ না করেও (সেভের পরের নিয়মেই: শুধু পাস, সমান নম্বরে একই Rank)
  function refreshRow(tr) {
    if (!tr) return;
    const ab = $(".abs", tr), mk = $$(".mk", tr);
    const vals = ab && ab.checked ? [] : mk.filter((i) => enNum(i.value) !== "").map((i) => Number(enNum(i.value))).filter(Number.isFinite);
    $(".tot", tr).textContent = ab && ab.checked ? "অনুপস্থিত" : vals.length ? num2(vals.reduce((a, b) => a + b, 0)) : "—";
    const res = $(".res", tr), ex = exById(S.examId);
    if (res && ex) res.innerHTML = passChip(liveResult(ex, tr.dataset.sid, readCells(tr).cell));
    liveRanks(tr.closest("tbody"), ex);
  }
  function liveRanks(tbody, ex) {
    if (!tbody || !ex) return;
    const marks = { ...(ex.marks || {}) }, rows = $$("tr[data-sid]", tbody);
    for (const r of rows) { const arr = [...(marks[r.dataset.sid] || [])]; arr[S.attempt] = readCells(r).cell; marks[r.dataset.sid] = arr; }
    const rk = new Map(EC.results({ ...ex, marks }).present.filter((x) => x.rank).map((x) => [x.sid, x.rank]));
    for (const r of rows) { const c = $(".ek-rk", r); if (c) c.innerHTML = rk.has(r.dataset.sid) ? `<span class="ek-pill">${bn(rk.get(r.dataset.sid))}</span>` : "—"; }
  }
  let warnAt = 0;
  function onInput(e) {
    const el = e.target;
    if (el.matches(".mk")) {
      // শুধু সংখ্যা (দশমিকসহ, ২ ঘর পর্যন্ত; জিকে ও বিশেষ পরীক্ষায় মাইনাসও), আর পূর্ণমানের বেশি হলে লেখাই যাবে না — আগের মান ফিরে আসে
      const v = enNum(el.value), max = Number(el.dataset.max);
      const okShape = v === "" || (negHere() ? /^-?\d*\.?\d{0,2}$/ : /^\d*\.?\d{0,2}$/).test(v), over = okShape && v !== "" && v !== "." && Number(v) > max;
      if (!okShape || over) {
        el.value = el.dataset.prev || "";
        el.classList.add("bad"); setTimeout(() => el.classList.remove("bad"), 700);
        if (Date.now() - warnAt > 1200) { warnAt = Date.now(); toast(over ? `পূর্ণমান ${bn(max)} — এর বেশি নম্বর দেওয়া যাবে না` : "শুধু সংখ্যা লিখুন", true); }
        return;
      }
      el.dataset.prev = el.value;
      el.classList.remove("bad");
      refreshRow(el.closest("tr[data-sid]"));
      return markDirty();
    }
    if (el.matches("[data-docq]")) { S.q = el.value; focusAfter = "[data-docq]"; return render(); }
  }
  function onKey(e) {
    const el = e.target;
    if (el.matches("[data-id-input]") && e.key === "Enter") { e.preventDefault(); return findId(); }
    // ID Entry-তে অনুপস্থিত টিক দিয়ে Enter চাপলেও সেভ
    if (el.matches(".ex-idcard .abs") && e.key === "Enter") { e.preventDefault(); return saveId(); }
    if (!el.matches(".mk")) return;
    if (el.closest(".ex-idcard")) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const all = $$(".ex-idcard .mk", C), nx = all[all.indexOf(el) + 1];
      return nx ? (nx.focus(), nx.select()) : saveId();
    }
    if (!["Enter", "ArrowDown", "ArrowUp"].includes(e.key)) return;
    e.preventDefault();
    // Enter: ডানের ঘরে, সারির শেষে পরের শিক্ষার্থীর প্রথম ঘরে (Shift+Enter উল্টো দিকে) — অনুপস্থিত / লক ঘর বাদ
    if (e.key === "Enter") {
      const all = $$("tr[data-sid] .mk", C).filter((i) => !i.disabled), at = all.indexOf(el), nx = all[at + (e.shiftKey ? -1 : 1)];
      if (nx) { nx.focus(); nx.select(); }
      return;
    }
    // একই কলামের পরের (বা আগের) ঘরে — অনুপস্থিত সারি বাদ দিয়ে
    const col = el.dataset.col, rows = $$("tr[data-sid]", C), step = e.key === "ArrowUp" ? -1 : 1;
    for (let j = rows.indexOf(el.closest("tr")) + step; j >= 0 && j < rows.length; j += step) {
      const nx = $(`.mk[data-col="${col}"]`, rows[j]);
      if (nx && !nx.disabled) { nx.focus(); nx.select(); return; }
    }
  }
  function onSubmit(e) { const rf = e.target.closest("form[data-routine-up]"); if (rf) { e.preventDefault(); return uploadRoutine(rf); } const f = e.target.closest("form[data-up]"); if (!f) return; e.preventDefault(); upload(f); }
  // ড্র্যাগ করে ফাইল আনলে ঘর হাইলাইট
  document.addEventListener("dragover", (e) => { const z = e.target.closest && e.target.closest(".ex-page .ln-up-drop"); $$(".ex-page .ln-up-drop.over").forEach((x) => x !== z && x.classList.remove("over")); if (z) z.classList.add("over"); });
  document.addEventListener("drop", () => $$(".ex-page .ln-up-drop.over").forEach((x) => x.classList.remove("over")));
  addEventListener("beforeunload", (e) => { if (dirty && C && C.querySelector(".ex-page")) { e.preventDefault(); e.returnValue = ""; } });

  // অ্যাডমিন রাউটার এটাকে ডাকে (প্রতিবার পেজ খুললে বা ডেটা নতুন করে আনলে)
  return function examsPage(c, arg) {
    C = c; dirty = false;
    const only = OWN_TAB[arg] ? arg : arg && exById(arg) && OWN_TAB[exById(arg).type] ? exById(arg).type : "";
    if (only !== S.only) { S.only = only; S.examId = ""; S.open = ""; S.f.type = ""; S.docType = ""; S.docTarget = ""; }
    if (arg && exById(arg)) { S.examId = arg; S.tab = "entry"; S.open = ""; }
    c.onclick = onClick; c.onchange = onChange; c.oninput = onInput; c.onkeydown = onKey; c.onsubmit = onSubmit;
    render();
  };
};
