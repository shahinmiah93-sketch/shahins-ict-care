// অ্যাডমিন → ট্যালেন্ট হান্ট
// প্রতিবার আলাদা ট্যালেন্ট হান্ট: নাম, কোড (রোলের শুরু, যেমন TH26 → TH26-0001), তারিখ-সময়-কেন্দ্র, বিষয় ও পূর্ণমান (MCQ, অফলাইনে কাগজে)।
// "রেজিস্ট্রেশন চালু" করলে ওয়েবসাইটের /talent-hunt পাতায় রেজিস্ট্রেশন খোলে (বন্ধ থাকলে কেউ পারে না)।
// অফলাইন ব্যাচের শিক্ষার্থীদের এক ক্লিকে রেজিস্ট্রেশন। নম্বর রোল ধরে; ফলাফল আলাদা — অন্য কোনো পরীক্ষার সাথে মেশে না।
window.SICTalent = function (X) {
  "use strict";
  const { $, $$, esc, bn, api, toast } = U;
  const DB = () => X.DB;
  const num = (v) => Number(String(v ?? "").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d)).replace(/[−–]/g, "-"));
  const SRC = { online: ["অনলাইন", ""], batch: ["ব্যাচের শিক্ষার্থী", "ok"], manual: ["✎ হাতে যোগ", ""] };
  const S = { id: "", tab: "regs", q: "", form: null, marks: {}, dirty: false };
  let C = null;

  const hunts = () => [...(DB().talentHunts || [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const hunt = () => (DB().talentHunts || []).find((h) => h.id === S.id);
  const regs = (hid) => (DB().thRegs || []).filter((r) => r.huntId === hid).sort((a, b) => String(a.roll).localeCompare(String(b.roll)));
  const full = (h) => (h.subjects || []).reduce((t, s) => t + (Number(s.full) || 0), 0);
  // পাস: CQ আর MCQ-তে আলাদা (সেটিংসে দেওয়া %, না থাকলে ৪০%) — সব অংশে পাস করলে তবেই পাস
  const passOf = (h, c) => Math.ceil((c.full * (Number(c.part === "cq" ? h.passCq : h.passMcq) || 40)) / 100 - 1e-9);
  const passed = (h, m) => cols(h).every((c) => (num(m[c.key]) || 0) >= passOf(h, c));
  const passChip = (h, m) => (passed(h, m) ? '<span class="chip ok">পাস</span>' : '<span class="chip bad">ফেল</span>');
  const passCell = (h, m) => (m._absent || !cols(h).some((c) => String(m[c.key] ?? "").trim() !== "") ? "—" : passChip(h, m));
  const hasMarks = (r) => r.absent || (r.marks && Object.keys(r.marks).length);
  // নম্বরের ঘর: বিষয়ে CQ আর MCQ দুটোই থাকলে আলাদা দুই ঘর; একটা থাকলে বিষয়ের নামেই (পুরনো {name, full} = শুধু MCQ)
  const partsOf = (s) => (s.cq === undefined && s.mcq === undefined ? { cq: 0, mcq: Number(s.full) || 0 } : { cq: Number(s.cq) || 0, mcq: Number(s.mcq) || 0 });
  const cols = (h) => (h.subjects || []).flatMap((s) => { const { cq, mcq } = partsOf(s);
    return cq && mcq ? [{ key: `${s.name} CQ`, label: `${s.name} CQ`, full: cq, part: "cq" }, { key: `${s.name} MCQ`, label: `${s.name} MCQ`, full: mcq, part: "mcq" }] : [{ key: s.name, label: `${s.name} (${cq ? "CQ" : "MCQ"})`, full: cq || mcq, part: cq ? "cq" : "mcq" }]; });
  const subText = (s) => { const { cq, mcq } = partsOf(s); return `${esc(s.name)} ${[cq && `CQ ${bn(cq)}`, mcq && `MCQ ${bn(mcq)}`].filter(Boolean).join(" + ")}`; };
  const total = (h, r) => cols(h).reduce((t, c) => t + (Number((r.marks || {})[c.key]) || 0), 0);
  function merit(h) {
    const rows = regs(h.id).filter((r) => !r.absent && r.marks && Object.keys(r.marks).length).map((r) => ({ r, t: total(h, r), pass: passed(h, r.marks) })).sort((a, b) => Number(b.pass) - Number(a.pass) || b.t - a.t || String(a.r.roll).localeCompare(String(b.r.roll)));
    // পাস করা আগে (মেধাক্রমসহ), ফেল করলে মেধাক্রম নেই
    let rank = 0, prev = null; rows.forEach((x, i) => { if (!x.pass) { x.rank = null; return; } if (x.t !== prev) { rank = i + 1; prev = x.t; } x.rank = rank; });
    return rows;
  }
  const site = () => DB().settings || {};
  const info = (h) => ({ ...h, full: full(h) });
  const filteredRegs = (h) => { const q = S.q.trim().toLowerCase(); return regs(h.id).filter((r) => !q || [r.roll, r.name, r.phone, r.college, r.klass].join(" ").toLowerCase().includes(q)); };

  // ================= সব ট্যালেন্ট হান্ট =================
  function listView() {
    const L = hunts();
    return `<section class="ln-banner"><div><span class="eyebrow">CQ ও MCQ · অফলাইনে কাগজে</span><h2>ট্যালেন্ট হান্ট</h2>
        <p>নতুন ট্যালেন্ট হান্ট তৈরি করুন, ঘোষণার দিন "রেজিস্ট্রেশন চালু" করুন — ওয়েবসাইটের <a href="/talent-hunt" target="_blank" style="color:inherit;text-decoration:underline">/talent-hunt</a> পাতায় রেজিস্ট্রেশন খুলবে (ব্যানারে লিংক দিতে পারেন)। বন্ধ থাকলে কেউ রেজিস্ট্রেশন করতে পারে না।</p>
        <div class="ln-nums"><span><b>${bn(L.length)}</b>মোট</span><span><b>${bn(L.filter((h) => h.live).length)}</b>রেজিস্ট্রেশন চালু</span><span><b>${bn(L.filter((h) => h.resultPublished).length)}</b>ফলাফল প্রকাশিত</span></div></div>
        <button type="button" class="btn gold" data-new>＋ নতুন ট্যালেন্ট হান্ট</button></section>
      ${L.length ? `<div class="qz-list th-list">${L.map((h) => { const R = regs(h.id); return `<div class="qz-card">
        <div class="qz-top"><span class="chip ${h.live ? "ok" : ""}">${h.live ? "রেজিস্ট্রেশন চালু" : "❚❚ রেজিস্ট্রেশন বন্ধ"}</span>${h.resultPublished ? '<span class="chip ok">ফলাফল প্রকাশিত</span>' : ""}</div>
        <b>${esc(h.title)}</b><small>কোড ${esc(h.code)} · ${h.examDate ? U.date(h.examDate) : "তারিখ ঠিক হয়নি"}${h.venue ? " · " + esc(h.venue) : ""}</small>
        <div class="qz-nums"><span><b>${bn(R.length)}</b>রেজিস্ট্রেশন</span><span><b>${bn(R.filter((r) => r.source === "batch").length)}</b>ব্যাচের</span><span><b>${bn(R.filter(hasMarks).length)}</b>নম্বর দেওয়া</span><span><b>${bn(full(h))}</b>পূর্ণমান</span></div>
        <div class="qz-acts"><button type="button" class="btn gold sm" data-open="${h.id}">খুলুন</button><button type="button" class="btn line sm" data-live="${h.id}">${h.live ? "❚❚ রেজিস্ট্রেশন বন্ধ" : "► রেজিস্ট্রেশন চালু"}</button><button type="button" class="btn gold sm" data-enroll-all-of="${h.id}">আমাদের সব শিক্ষার্থীর রেজিস্ট্রেশন</button></div></div>`; }).join("")}</div>`
      : '<section class="card"><div class="ln-empty">এখনো কোনো ট্যালেন্ট হান্ট নেই — "＋ নতুন ট্যালেন্ট হান্ট" চাপুন। তৈরি হলে এখানে তার কার্ডে <b>আমাদের সব শিক্ষার্থীর রেজিস্ট্রেশন</b> বোতাম আসবে — এক ক্লিকে সব মডিউলের শিক্ষার্থীর রেজিস্ট্রেশন।</div></section>'}`;
  }

  // ================= একটা ট্যালেন্ট হান্ট =================
  function huntView() {
    const h = hunt(); if (!h) { S.id = ""; return listView(); }
    const R = regs(h.id);
    const tabs = [["regs", "রেজিস্ট্রেশন", R.length], ["marks", "নম্বর", R.filter(hasMarks).length], ["result", "ফলাফল"], ["setup", "সেটিংস"]];
    return `<div class="ln-bar"><button type="button" class="btn line" data-back>‹ সব ট্যালেন্ট হান্ট</button><span><a class="btn line sm" href="/talent-hunt" target="_blank">→ ওয়েবসাইটে দেখুন</a></span></div>
      <section class="ln-banner"><div><span class="eyebrow">কোড ${esc(h.code)} · রোল ${esc(h.code)}-0001…</span><h2>${esc(h.title)}</h2>
        <p>${[h.examDate && "" + U.date(h.examDate), h.examTime && "" + esc(h.examTime), h.venue && "" + esc(h.venue), (h.subjects || []).map(subText).join(" · ")].filter(Boolean).join(" &nbsp; ")}</p>
        <div class="ln-nums"><span><b>${bn(R.length)}</b>মোট রেজিস্ট্রেশন</span><span><b>${bn(R.filter((r) => r.source === "online").length)}</b>অনলাইনে</span><span><b>${bn(R.filter((r) => r.source === "batch").length)}</b>ব্যাচের</span><span><b>${bn(R.filter(hasMarks).length)}</b>নম্বর দেওয়া</span></div></div>
        <div class="th-switches"><button type="button" class="btn ${h.live ? "gold" : "line"}" data-live="${h.id}">${h.live ? "রেজিস্ট্রেশন চালু আছে" : "❚❚ রেজিস্ট্রেশন বন্ধ"}</button><button type="button" class="btn ${h.resultPublished ? "gold" : "line"}" data-pub="${h.id}">${h.resultPublished ? "ফলাফল প্রকাশিত" : "ফলাফল প্রকাশ করুন"}</button></div></section>
      <div class="ln-tabs">${tabs.map(([k, t, n]) => `<button type="button" data-tab="${k}" class="${S.tab === k ? "on" : ""}">${t}${n !== undefined ? ` <i>${bn(n)}</i>` : ""}</button>`).join("")}</div>
      ${({ regs: regsTab, marks: marksTab, result: resultTab, setup: () => setupForm(h) })[S.tab](h)}`;
  }

  // ---------- রেজিস্ট্রেশন ----------
  function regsTab(h) {
    const R = filteredRegs(h), have = new Set(regs(h.id).map((r) => r.studentId).filter(Boolean));
    const sessions = (DB().sessions || []).filter((s) => s.active !== false);
    const act = (DB().students || []).filter((s) => s.status !== "inactive");
    return `<section class="card"><h3>অফলাইন ব্যাচের শিক্ষার্থীদের এক ক্লিকে রেজিস্ট্রেশন <small class="ln-count">যাদের আগে থেকে আছে তারা বাদ</small></h3>
      ${sessions.map((se) => `<div class="th-batches"><b>${esc(se.name)}</b>${DB().batches.filter((b) => b.session === se.name).map((b) => { const n = act.filter((s) => s.batchId === b.id).length, d = act.filter((s) => s.batchId === b.id && have.has(s.id)).length; return `<label class="cl-b"><input type="checkbox" name="thb" value="${b.id}"${n && d < n ? "" : " disabled"}><span><b>${esc(b.name)}</b><small>${bn(n)} জন${d ? ` · ${bn(d)} জনের হয়েছে` : ""}</small></span></label>`; }).join("")}</div>`).join("")}
      ${(() => { const shown = DB().batches.filter((b) => sessions.some((se) => se.name === b.session)).map((b) => b.id), left = act.filter((s) => shown.includes(s.batchId) && !have.has(s.id)).length; return `<div class="rs-act" style="margin-top:10px"><button type="button" class="btn gold sm" data-enroll${left ? "" : " disabled"}>✓ বাছাই করা ব্যাচের সবাইকে রেজিস্ট্রেশন করুন</button><button type="button" class="btn line sm" data-all-batches${left ? "" : " disabled"}>সব ব্যাচ বাছুন</button><span class="ex-sub">${left ? `${bn(left)} জনের রেজিস্ট্রেশন বাকি` : "ব্যাচের সবার রেজিস্ট্রেশন হয়ে গেছে, বাছাই করার মতো ব্যাচ নেই"}</span></div>`; })()}</section>
    <section class="card th-mods" style="margin-top:14px"><h3>মডিউল ধরে এক ক্লিকে রেজিস্ট্রেশন <small class="ln-count">যেকোনো মডিউলে চালু ভর্তি আছে এমন শিক্ষার্থী · যাদের আগে থেকে আছে তারা বাদ</small></h3>
      ${(() => { const en = (DB().enrollments || []).filter((e) => e.status === "active"), actIds = new Set(act.map((s) => s.id)), studs = (cid) => [...new Set(en.filter((e) => (!cid || e.courseId === cid) && actIds.has(e.studentId)).map((e) => e.studentId))];
        const all = studs(""), allLeft = all.filter((id) => !have.has(id)).length;
        return `<div class="th-batches">${(DB().courses || []).map((c) => { const ids = studs(c.id), d = ids.filter((id) => have.has(id)).length; return ids.length ? `<label class="cl-b"><input type="checkbox" name="thm" value="${c.id}"${d < ids.length ? "" : " disabled"}><span><b>${esc(c.name)}</b><small>${bn(ids.length)} জন${d ? ` · ${bn(d)} জনের হয়েছে` : ""}</small></span></label>` : ""; }).join("") || '<small class="ex-sub">কোনো মডিউলে চালু ভর্তি নেই</small>'}</div>
        <div class="rs-act" style="margin-top:10px"><button type="button" class="btn gold" data-enroll-all${allLeft ? "" : " disabled"}>সকল মডিউলের সব শিক্ষার্থী — এক ক্লিকে রেজিস্ট্রেশন (${bn(allLeft)} জন বাকি)</button><button type="button" class="btn line sm" data-enroll-mods${allLeft ? "" : " disabled"}>✓ বাছাই করা মডিউলের সবাইকে</button>${allLeft ? "" : '<span class="ex-sub">মডিউলের সবার রেজিস্ট্রেশন হয়ে গেছে, বাছাই করার মতো মডিউল নেই</span>'}</div>`; })()}</section>
      <section class="card" style="margin-top:14px"><div class="ld-bar"><label class="grow" style="display:grid;gap:4px;font-weight:600;font-size:13.5px">খুঁজুন<input data-q value="${esc(S.q)}" placeholder="রোল, নাম, মোবাইল, প্রতিষ্ঠান…"></label>
        <span class="rs-btns"><button type="button" class="btn line sm" data-add>＋ হাতে যোগ</button><button type="button" class="btn line sm" data-admits>প্রবেশপত্র (${bn(R.length)})</button><button type="button" class="btn line sm" data-excel>↓ Excel</button></span></div>
      <div class="tbl-wrap"><table class="exam-entry-table ld-table"><thead><tr><th>রোল</th><th>নাম</th><th>মোবাইল</th><th>শ্রেণি / প্রতিষ্ঠান</th><th>কীভাবে</th><th></th></tr></thead><tbody>
      ${R.map((r) => `<tr><td><b>${esc(r.roll)}</b></td><td><b>${esc(r.name)}</b>${r.studentId ? `<small>${esc(r.studentId)}</small>` : ""}</td><td>${r.phone ? `<a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>` : "—"}</td><td>${esc(r.klass || "—")}<small>${esc(r.college || "")}</small></td>
        <td><span class="chip ${SRC[r.source]?.[1] || ""}">${SRC[r.source]?.[0] || esc(r.source)}</span><small>${U.date((r.createdAt || "").slice(0, 10))}</small></td>
        <td class="num" style="white-space:nowrap"><button type="button" class="icon-btn" data-admit1="${r.id}" title="প্রবেশপত্র">প্রিন্ট</button><button type="button" class="icon-btn" data-edit="${r.id}" title="বদলান">✎</button><button type="button" class="icon-btn" data-del="${r.id}" title="মুছুন">✕</button></td></tr>`).join("") || '<tr><td colspan="6" class="empty">এখনো কেউ রেজিস্ট্রেশন করেনি</td></tr>'}</tbody></table></div></section>`;
  }
  // ---------- ✎ নম্বর ----------
  function marksTab(h) {
    const R = filteredRegs(h), subs = cols(h);
    if (!subs.length) return '<section class="card"><div class="ln-empty">আগে সেটিংসে বিষয় আর পূর্ণমান দিন।</div></section>';
    return `<section class="card"><div class="ld-bar"><label class="grow" style="display:grid;gap:4px;font-weight:600;font-size:13.5px">রোল / নাম দিয়ে খুঁজুন<input data-q value="${esc(S.q)}" placeholder="যেমন: ${esc(h.code)}-0012"></label>
        <span class="ex-sub">নেগেটিভ মার্কিং: মাইনাসও লেখা যায় (যেমন -২৩) · পূর্ণমানের বেশি দেওয়া যায় না · Enter চাপলে পরের ঘরে যায়</span></div>
      <div class="tbl-wrap"><table class="exam-entry-table th-marks"><thead><tr><th>রোল</th><th>নাম</th>${subs.map((s) => `<th class="num">${esc(s.label)}<small>/${bn(s.full)} · পাস ${bn(passOf(h, s))}</small></th>`).join("")}<th class="num">মোট</th><th>ফলাফল</th><th>অনুপস্থিত</th></tr></thead><tbody>
      ${R.map((r) => { const m = S.marks[r.id] || { ...(r.marks || {}), _absent: r.absent }; return `<tr data-r="${r.id}"><td><b>${esc(r.roll)}</b></td><td>${esc(r.name)}</td>
        ${subs.map((s) => `<td class="num"><input class="field th-in" data-mk="${esc(s.key)}" data-max="${s.full}" inputmode="text" value="${m[s.key] ?? ""}"${m._absent ? " disabled" : ""}></td>`).join("")}
        <td class="num"><b data-tot>${m._absent ? "—" : bn(String(subs.reduce((t, s) => t + (Number(m[s.key]) || 0), 0)))}</b></td>
        <td data-res>${passCell(h, m)}</td>
        <td><label class="ld-chk"><input type="checkbox" data-abs${m._absent ? " checked" : ""}> অনুপস্থিত</label></td></tr>`; }).join("") || `<tr><td colspan="${subs.length + 5}" class="empty">কেউ নেই</td></tr>`}</tbody></table></div>
      <div class="qz-save"><span>${S.dirty ? "পরিবর্তন সেভ হয়নি" : `${bn(regs(h.id).filter(hasMarks).length)}/${bn(regs(h.id).length)} জনের নম্বর দেওয়া`}</span><button type="button" class="btn gold" data-save-marks>✓ নম্বর সংরক্ষণ করুন</button></div></section>`;
  }
  // ---------- ফলাফল ----------
  function resultTab(h) {
    const M = merit(h), F = full(h), R = regs(h.id), abs = R.filter((r) => r.absent).length;
    return `<section class="card"><div class="qz-head"><div><h3>মেধাতালিকা <small class="ln-count">মোট নম্বর বেশি থেকে কম · সমান হলে একই মেধা · অন্য কোনো পরীক্ষার সাথে মেশে না</small></h3>
        <p class="ex-sub" style="margin:0">উপস্থিত ${bn(M.length)} · অনুপস্থিত ${bn(abs)} · নম্বর বাকি ${bn(R.length - M.length - abs)} · ${h.resultPublished ? `ওয়েবসাইটে প্রকাশিত (${h.meritShow ? `প্রথম ${bn(h.meritShow)} জন` : "সবাই"} মেধাতালিকায়; প্রত্যেকে রোল আর মোবাইল দিয়ে নিজেরটা দেখতে পারে)` : "এখনো প্রকাশ হয়নি"}</p></div>
        <span class="rs-btns"><button type="button" class="btn ${h.resultPublished ? "line" : "gold"} sm" data-pub="${h.id}">${h.resultPublished ? "ফলাফল প্রত্যাহার" : "ফলাফল প্রকাশ করুন"}</button><button type="button" class="btn line sm" data-print-merit>Print / PDF</button><button type="button" class="btn line sm" data-excel-merit>↓ Excel</button></span></div>
      <div class="tbl-wrap"><table class="exam-entry-table rs-table"><thead><tr><th>মেধা</th><th>রোল</th><th>নাম</th><th>প্রতিষ্ঠান</th>${cols(h).map((c) => `<th class="num">${esc(c.label)}</th>`).join("")}<th class="num">মোট</th><th class="num">%</th><th>ফলাফল</th></tr></thead><tbody>
      ${M.map((x) => `<tr class="${x.rank && x.rank <= 3 ? "rs-top" : ""}"><td><b>${x.rank ? U.rankName(x.rank) : "—"}</b></td><td>${esc(x.r.roll)}</td><td><b>${esc(x.r.name)}</b>${x.r.source === "batch" ? '<small>আমাদের ব্যাচ</small>' : ""}</td><td>${esc(x.r.college || "—")}</td>${cols(h).map((c) => `<td class="num">${bn(String(Number(x.r.marks[c.key]) || 0))}</td>`).join("")}<td class="num"><b>${bn(String(x.t))}</b>/${bn(F)}</td><td class="num">${bn(Math.round((x.t / F) * 100))}%</td><td>${passChip(h, x.r.marks)}</td></tr>`).join("") || `<tr><td colspan="${cols(h).length + 7}" class="empty">এখনো নম্বর দেওয়া হয়নি — ✎ নম্বর ট্যাবে দিন</td></tr>`}</tbody></table></div></section>`;
  }
  const meritRows = (h) => merit(h).map((x) => [x.rank || "—", x.r.roll, x.r.name, x.r.college, ...cols(h).map((c) => Number(x.r.marks[c.key]) || 0), x.t, Math.round((x.t / full(h)) * 100) + "%", passed(h, x.r.marks) ? "পাস" : "ফেল"]);
  const meritHead = (h) => ["মেধা", "রোল", "নাম", "প্রতিষ্ঠান", ...cols(h).map((c) => c.label), "মোট", "%", "ফলাফল"];
  // ---------- সেটিংস (নতুন / বদল) ----------
  function newCode() { const y = String(new Date().getFullYear()).slice(-2); let c = "TH" + y, i = 0; const used = new Set((DB().talentHunts || []).map((h) => h.code)); while (used.has(c)) c = "TH" + y + "ABCDEFGHIJ"[i++]; return c; }
  function setupForm(h) {
    const F = (S.form ||= h ? JSON.parse(JSON.stringify(h)) : { id: "", title: `ট্যালেন্ট হান্ট ${bn(new Date().getFullYear())}`, code: newCode(), examDate: "", examTime: "সকাল ১০:০০", venue: "Shahin's ICT Care, মাস্টার কলোনি, মাদারীপুর", details: "", subjects: [{ name: "ICT", cq: 0, mcq: 50 }], live: false, resultPublished: false, meritShow: 0 });
    const locked = h && regs(h.id).length;
    return `<section class="card qz-set"><h3>${F.id ? "সেটিংস" : "＋ নতুন ট্যালেন্ট হান্ট"}</h3>
      <div class="ld-grid">
        <label class="span2">নাম *<input data-t="title" value="${esc(F.title)}"></label>
        <label>কোড (রোলের শুরু)<input data-t="code" value="${esc(F.code)}"${locked ? " disabled" : ""} maxlength="12"><small class="ex-sub">রোল হবে ${esc(F.code)}-0001${locked ? " · রেজিস্ট্রেশন হয়ে গেছে, বদলানো যাবে না" : ""}</small></label>
        <label>পরীক্ষার তারিখ<input type="date" data-t="examDate" value="${esc(F.examDate)}"></label><label>সময়<input data-t="examTime" value="${esc(F.examTime)}"></label>
        <label>কেন্দ্র<input data-t="venue" value="${esc(F.venue)}"></label>
        <label class="span2">বিস্তারিত / নিয়ম (ঐচ্ছিক — ওয়েবসাইটে দেখায়)<textarea data-t="details" rows="3">${esc(F.details)}</textarea></label>
        <label>CQ পাস (%)<input data-t="passCq" inputmode="decimal" value="${esc(String(F.passCq || 40))}"></label><label>MCQ পাস (%)<input data-t="passMcq" inputmode="decimal" value="${esc(String(F.passMcq || 40))}"></label>
        <label>মেধাতালিকায় কতজন দেখাবে<input data-t="meritShow" inputmode="numeric" value="${esc(String(F.meritShow || 0))}"><small class="ex-sub">০ = সবাই</small></label>
      </div>
      <h4 style="margin:16px 0 8px">বিষয় ও পূর্ণমান — CQ আর MCQ <small class="ln-count">মোট ${bn(F.subjects.reduce((t, s) => { const p = partsOf(s); return t + (num(p.cq) || 0) + (num(p.mcq) || 0); }, 0))} · যেটা নেই সেখানে ০ বা খালি রাখুন</small></h4>
      <div class="th-subs th-subs2"><div class="th-sh"><span>বিষয়</span><span>CQ পূর্ণমান</span><span>MCQ পূর্ণমান</span><span></span></div>${F.subjects.map((s, i) => { const p = partsOf(s); return `<div data-si="${i}"><input data-sn placeholder="বিষয়ের নাম (যেমন ICT, গণিত, সাধারণ জ্ঞান)" value="${esc(s.name)}"><input data-scq inputmode="numeric" placeholder="CQ" value="${p.cq ? esc(String(p.cq)) : ""}"><input data-smcq inputmode="numeric" placeholder="MCQ" value="${p.mcq ? esc(String(p.mcq)) : ""}"><button type="button" class="icon-btn" data-srm="${i}" title="বাদ">✕</button></div>`; }).join("")}</div>
      <p><button type="button" class="btn line sm" data-sadd>＋ বিষয় যোগ</button></p>
      <label class="ld-chk"><input type="checkbox" data-t="live"${F.live ? " checked" : ""}> <b>রেজিস্ট্রেশন চালু</b> — ওয়েবসাইটে সবাই রেজিস্ট্রেশন করতে পারবে</label>
      <div class="rs-act" style="margin-top:14px"><button type="button" class="btn gold" data-save-hunt>✓ সংরক্ষণ করুন</button>${F.id ? `<button type="button" class="btn line" data-del-hunt="${F.id}">মুছে ফেলুন</button>` : '<button type="button" class="btn line" data-back>বাতিল</button>'}</div></section>`;
  }
  function readSetup() {
    const F = S.form; if (!F) return;
    $$("[data-t]", C).forEach((el) => { F[el.dataset.t] = el.type === "checkbox" ? el.checked : el.value; });
    F.subjects = $$(".th-subs > div[data-si]", C).map((d) => ({ name: $("[data-sn]", d).value.trim(), cq: $("[data-scq]", d).value, mcq: $("[data-smcq]", d).value }));
  }
  async function saveHunt() {
    readSetup();
    const F = S.form, body = { ...F, meritShow: num(F.meritShow) || 0, subjects: F.subjects.filter((s) => s.name).map((s) => { const p = partsOf(s); return { name: s.name, cq: num(p.cq) || 0, mcq: num(p.mcq) || 0, full: (num(p.cq) || 0) + (num(p.mcq) || 0) }; }) };
    if (!body.title.trim()) return toast("নাম লিখুন", true);
    body.passCq = num(F.passCq); body.passMcq = num(F.passMcq);
    if (![body.passCq, body.passMcq].every((p) => p > 0 && p <= 100)) return toast("CQ আর MCQ পাস মার্ক ১ থেকে ১০০-এর মধ্যে লিখুন (শতকরা হিসাবে)", true);
    if (!body.subjects.length || body.subjects.some((s) => !s.full)) return toast("প্রতিটা বিষয়ের নাম আর CQ বা MCQ-এর পূর্ণমান দিন", true);
    try { const r = await X.save("talentHunts", body, F.id || undefined); await X.load(); S.form = null; S.id = r.item.id; S.tab = F.id ? "setup" : "regs"; render(); toast("সংরক্ষণ হয়েছে"); }
    catch (e) { toast(e.message, true); }
  }
  // ---------- নম্বর পড়া / সেভ ----------
  function readMarksRow(tr) {
    const id = tr.dataset.r, m = {};
    $$("[data-mk]", tr).forEach((i) => { if (i.value.trim() !== "") m[i.dataset.mk] = i.value; });
    m._absent = $("[data-abs]", tr).checked;
    S.marks[id] = m; S.dirty = true;
    const h = hunt(); $("[data-tot]", tr).textContent = m._absent ? "—" : bn(String(cols(h).reduce((t, c) => t + (num(m[c.key]) || 0), 0)));
    $("[data-res]", tr).innerHTML = passCell(h, m);
  }
  async function saveMarks() {
    const h = hunt(), body = {}, bad = $(".th-in.bad", C);
    if (bad) { bad.focus(); return toast("লাল ঘরের নম্বর ঠিক করুন — পূর্ণমানের বেশি বা ভুল সংখ্যা", true); } // ভুল নম্বর চুপচাপ পূর্ণমান হয়ে সেভ না হয়
    for (const [id, m] of Object.entries(S.marks)) body[id] = m._absent ? { _absent: true } : Object.fromEntries(Object.entries(m).filter(([k]) => k !== "_absent").map(([k, v]) => [k, num(v)]));
    if (!Object.keys(body).length) return toast("কোনো পরিবর্তন নেই");
    try { const r = await api(`/api/admin/talent/${h.id}/marks`, { body: { marks: body } }); await X.load(); S.marks = {}; S.dirty = false; render(); toast(`${bn(r.saved)} জনের নম্বর সংরক্ষণ হয়েছে`); }
    catch (e) { toast(e.message, true); }
  }
  function regForm(r) {
    const h = hunt();
    X.openForm({
      title: r ? `✎ ${r.roll}` : `＋ হাতে রেজিস্ট্রেশন — ${h.title}`,
      fields: [{ name: "name", label: "নাম", required: true }, { name: "phone", label: "মোবাইল", placeholder: "01XXXXXXXXX" }, { name: "klass", label: "শ্রেণি / ব্যাচ" }, { name: "college", label: "প্রতিষ্ঠান" }, { name: "course", label: "আগ্রহী প্রোগ্রাম" }],
      values: r || {},
      onSave: async (d) => { d.phone = String(d.phone || "").replace(/[০-৯]/g, (x) => "০১২৩৪৫৬৭৮৯".indexOf(x)).replace(/\D/g, "").replace(/^88/, ""); const res = await X.save("thRegs", { ...d, huntId: h.id }, r ? r.id : undefined); await X.load(); render(); toast(r ? "সংরক্ষণ হয়েছে" : `রেজিস্ট্রেশন হয়েছে — রোল ${res.item.roll}`); },
    });
  }

  function render() {
    if (!C) return;
    C.innerHTML = `<div class="ex-page th-page">${S.id === "new" ? `<div class="ln-bar"><button type="button" class="btn line" data-back>‹ সব ট্যালেন্ট হান্ট</button></div>${setupForm(null)}` : S.id ? huntView() : listView()}</div>`;
  }
  const leaveOk = () => !S.dirty || confirm("নম্বর সেভ হয়নি। তবুও যাবেন?");
  async function toggle(h, key, label) {
    if (key === "resultPublished" && !h.resultPublished && !merit(h).length) return toast("আগে নম্বর দিন — মেধাতালিকা খালি", true);
    if (key === "resultPublished" && !h.resultPublished && !confirm("ফলাফল ওয়েবসাইটে প্রকাশ করবেন? সবাই মেধাতালিকা আর নিজের নম্বর দেখতে পাবে।")) return;
    try { await X.save("talentHunts", { ...h, [key]: !h[key] }, h.id); await X.load(); render(); toast(label(!h[key])); } catch (e) { toast(e.message, true); }
  }
  function onClick(e) {
    const t = (s) => e.target.closest(s); let el;
    if (t("[data-new]")) { S.id = "new"; S.form = null; return render(); }
    if (t("[data-back]")) { if (!leaveOk()) return; S.id = ""; S.form = null; S.marks = {}; S.dirty = false; return render(); }
    if ((el = t("[data-open]"))) { S.id = el.dataset.open; S.tab = "regs"; S.form = null; S.q = ""; return render(); }
    if ((el = t("[data-tab]"))) { if (!leaveOk()) return; S.tab = el.dataset.tab; S.form = null; S.marks = {}; S.dirty = false; return render(); }
    if ((el = t("[data-live]"))) { const h = DB().talentHunts.find((x) => x.id === el.dataset.live); return toggle(h, "live", (on) => (on ? "রেজিস্ট্রেশন চালু — ওয়েবসাইটে খুলেছে" : "রেজিস্ট্রেশন বন্ধ করা হয়েছে")); }
    if ((el = t("[data-pub]"))) { const h = DB().talentHunts.find((x) => x.id === el.dataset.pub); return toggle(h, "resultPublished", (on) => (on ? "ফলাফল প্রকাশিত হয়েছে" : "ফলাফল প্রত্যাহার করা হয়েছে")); }
    if (t("[data-sadd]")) { readSetup(); S.form.subjects.push({ name: "", cq: "", mcq: "" }); return render(); }
    if ((el = t("[data-srm]"))) { readSetup(); S.form.subjects.splice(Number(el.dataset.srm), 1); return render(); }
    if (t("[data-save-hunt]")) return saveHunt();
    if ((el = t("[data-del-hunt]"))) { const h = hunt(); X.remove("talentHunts", el.dataset.delHunt, `"${h.title}" আর এর ${bn(regs(h.id).length)}টি রেজিস্ট্রেশন ও নম্বর`).then((ok) => { if (ok) { S.id = ""; S.form = null; render(); } }); return; }
    if (t("[data-all-batches]")) { $$('input[name="thb"]:not(:disabled)', C).forEach((i) => (i.checked = true)); return; }
    if (t("[data-enroll]")) {
      const ids = $$('input[name="thb"]:checked', C).map((i) => i.value);
      if (!ids.length) return toast("অন্তত একটা ব্যাচ বাছুন", true);
      return api(`/api/admin/talent/${S.id}/enroll`, { body: { batchIds: ids } }).then((r) => X.load().then(() => { render(); toast(`${bn(r.added)} জনের রেজিস্ট্রেশন হয়েছে${r.skipped ? ` · ${bn(r.skipped)} জনের আগেই ছিল` : ""}`); })).catch((er) => toast(er.message, true));
    }
    if (t("[data-enroll-all]") || t("[data-enroll-mods]") || (el = t("[data-enroll-all-of]"))) {
      const of = el && el.dataset.enrollAllOf, all = !!of || !!t("[data-enroll-all]"), ids = all ? [] : $$('input[name="thm"]:checked', C).map((i) => i.value);
      if (!all && !ids.length) return toast("অন্তত একটা মডিউল বাছুন", true);
      if (of && !confirm("যেকোনো মডিউলে ভর্তি আছে এমন সব শিক্ষার্থীর রেজিস্ট্রেশন করবেন? যাদের আগে থেকে আছে তারা বাদ যাবে।")) return;
      return api(`/api/admin/talent/${of || S.id}/enroll`, { body: all ? { allModules: true } : { courseIds: ids } }).then((r) => X.load().then(() => { render(); toast(`${bn(r.added)} জনের রেজিস্ট্রেশন হয়েছে${r.skipped ? ` · ${bn(r.skipped)} জনের আগেই ছিল` : ""}`); })).catch((er) => toast(er.message, true));
    }
    if (t("[data-add]")) return regForm(null);
    if ((el = t("[data-edit]"))) return regForm(DB().thRegs.find((r) => r.id === el.dataset.edit));
    if ((el = t("[data-del]"))) { const r = DB().thRegs.find((x) => x.id === el.dataset.del); return X.remove("thRegs", r.id, `${r.roll} ${r.name}-এর রেজিস্ট্রেশন`); }
    if ((el = t("[data-admit1]"))) return U.talentAdmit([DB().thRegs.find((r) => r.id === el.dataset.admit1)], info(hunt()), site());
    if (t("[data-admits]")) { const R = filteredRegs(hunt()); return R.length ? U.talentAdmit(R, info(hunt()), site()) : toast("কেউ নেই", true); }
    if (t("[data-excel]")) { const h = hunt(); return U.xlsx(`talent-${h.code}-registrations.xlsx`, ["রোল", "নাম", "মোবাইল", "শ্রেণি", "প্রতিষ্ঠান", "আগ্রহী প্রোগ্রাম", "কীভাবে", "তারিখ"], filteredRegs(h).map((r) => [r.roll, r.name, r.phone, r.klass, r.college, r.course, (SRC[r.source] || [r.source])[0], (r.createdAt || "").slice(0, 10)])); }
    if (t("[data-save-marks]")) return saveMarks();
    if (t("[data-print-merit]")) { const h = hunt(); return X.printDoc(`মেধাতালিকা — ${h.title}`, `<h1>${esc(h.title)} — মেধাতালিকা</h1><p>${h.examDate ? U.date(h.examDate) : ""} · পূর্ণমান ${bn(full(h))}</p><table><thead><tr>${meritHead(h).map((x) => `<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${meritRows(h).map((r) => `<tr>${r.map((c) => `<td>${esc(bn(String(c ?? "")))}</td>`).join("")}</tr>`).join("")}</tbody></table>`); }
    if (t("[data-excel-merit]")) { const h = hunt(); return U.xlsx(`talent-${h.code}-merit.xlsx`, meritHead(h), meritRows(h)); }
  }
  function onChange(e) {
    const el = e.target;
    if (el.matches("[data-abs]")) { const tr = el.closest("tr"); $$("[data-mk]", tr).forEach((i) => (i.disabled = el.checked)); return readMarksRow(tr); }
    if (el.matches("[data-mk]")) return readMarksRow(el.closest("tr"));
  }
  function onInput(e) {
    const el = e.target;
    if (el.matches("[data-q]")) { S.q = el.value; const pos = el.selectionStart; if (S.tab === "marks") $$("tr[data-r]", C).forEach((tr) => readMarksRow(tr)); render(); const i = $("[data-q]", C); if (i) { i.focus(); i.setSelectionRange(pos, pos); } return; }
    if (el.matches("[data-mk]")) { const v = num(el.value), max = Number(el.dataset.max); if (el.value.trim() !== "" && (!Number.isFinite(v) || v > max)) { el.classList.add("bad"); el.title = `সর্বোচ্চ ${bn(max)}`; toast(`পূর্ণমান ${bn(max)} — এর বেশি নম্বর দেওয়া যাবে না`, true); } else el.classList.remove("bad"); readMarksRow(el.closest("tr")); }
  }
  function onKey(e) {
    if (e.key !== "Enter" || !e.target.matches(".th-in")) return;
    e.preventDefault(); const all = $$(".th-in:not(:disabled)", C), i = all.indexOf(e.target); if (all[i + 1]) { all[i + 1].focus(); all[i + 1].select(); }
  }
  addEventListener("beforeunload", (e) => { if (S.dirty && C && C.isConnected) { e.preventDefault(); e.returnValue = ""; } });
  return function talentPage(c, arg) {
    C = c; if (arg && (DB().talentHunts || []).some((h) => h.id === arg)) { S.id = arg; S.tab = "result"; }
    c.onclick = onClick; c.onchange = onChange; c.oninput = onInput; c.onkeydown = onKey;
    render();
  };
};
