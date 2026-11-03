// অ্যাডমিন → অনলাইন কুইজ (বাম মেনুর আলাদা পেজ — নিচে SICQuizPage)
// কুইজ তৈরি: নাম, সেশন / ব্যাচ, সময়, খোলা-বন্ধের সময়, প্রতি প্রশ্নে নম্বর, নেগেটিভ মার্কিং (রাখা / না রাখা, কত কাটবে),
// প্রশ্ন এলোমেলো, কতবার দেওয়া যাবে, জমার পর উত্তর দেখানো। প্রশ্ন একটা একটা করে বা একসাথে পেস্ট করে যোগ।
// ব্যাচের শিক্ষার্থী নিজের প্যানেলে কুইজ দেয়; "সবার জন্য খোলা" কুইজ ব্যাচের বাইরের (অনলাইন) শিক্ষার্থীরাও /quiz পেজে
// ছোট ফর্ম পূরণ করে দিতে পারে। নম্বর সার্ভারে গোনা হয়। কুইজের ফলাফল মূল সব ধরনের পরীক্ষার হিসাবে মেশে না।
window.SICQuiz = function (X, rerender, getFilter) {
  "use strict";
  const { $, $$, esc, bn, toast } = U;
  const DB = () => X.DB;
  // অনলাইন শিক্ষার্থী (আইডি G0001…) — ব্যাচের কেউ না
  const guestById = (id) => (DB().quizGuests || []).find((g) => g.id === id);
  const person = (sid) => X.studentById(sid) || guestById(sid) || { name: sid };
  const whereOf = (sid) => { const g = guestById(sid); return g ? `অনলাইন · ${g.hsc} · ${g.group}` : X.batchName((X.studentById(sid) || {}).batchId); };
  const guestCount = (q) => Object.entries(q.attempts || {}).filter(([sid, a]) => guestById(sid) && a.some((x) => x.submittedAt)).length;
  const L = ["ক", "খ", "গ", "ঘ", "ঙ", "চ"];
  const num2 = (x) => bn(String(Math.round(x * 100) / 100));
  const empty = (t) => `<div class="ln-empty">${t}</div>`;
  const nowLocal = () => { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return `${d.toLocaleDateString("en-CA")}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  const dt = (s) => (s ? new Date(s).toLocaleString("bn-BD", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—");
  const state = (q) => { const n = nowLocal(); return !q.live ? ["খসড়া", ""] : q.opensAt && n < q.opensAt ? ["শুরু হবে", "warn"] : q.closesAt && n >= q.closesAt ? ["■ শেষ", ""] : ["চলছে", "ok"]; };
  const whoText = (q) => ((q.batchIds || []).length ? q.batchIds.map(X.batchName).join(", ") : `${q.session || "উভয় সেশন"} — সব ব্যাচ`);
  const eligible = (q) => DB().students.filter((s) => s.status !== "inactive" && (!q.session || s.session === q.session) && (!(q.batchIds || []).length || q.batchIds.includes(s.batchId)));
  const negText = (q) => (q.negative ? `নেগেটিভ −${num2(q.negValue)}` : "নেগেটিভ নেই");
  const Q = { view: "list", id: "", draft: null, paste: false, dirty: false };
  const quizzes = () => { const f = getFilter(); return DB().quizzes.filter((q) => (!f.session || !q.session || q.session === f.session) && (!f.batch || !(q.batchIds || []).length || q.batchIds.includes(f.batch))).sort((a, b) => String(b.opensAt || b.createdAt).localeCompare(String(a.opensAt || a.createdAt))); };
  const byId = (id) => DB().quizzes.find((q) => q.id === id);

  // ================= তালিকা =================
  function listView() {
    const list = quizzes();
    return `<section class="card qz"><div class="qz-head"><div><h3>অনলাইন কুইজ</h3><p class="ex-sub" style="margin:0">ব্যাচের শিক্ষার্থীরা নিজের প্যানেলে কুইজ দেয়; "সবার জন্য খোলা" কুইজ বাইরের শিক্ষার্থীরাও <a href="/quiz" target="_blank">/quiz</a> পেজে ছোট ফর্ম পূরণ করে দিতে পারে। সময় শেষ হলে নিজে থেকে জমা হয়, নম্বর সাথে সাথে।</p></div><button type="button" class="btn gold" data-qz-new>＋ নতুন কুইজ</button></div>
      ${list.length ? `<div class="qz-list">${list.map((q) => { const [t, k] = state(q), el = eligible(q), at = el.filter((s) => (q.attempts?.[s.id] || []).some((x) => x.submittedAt)).length, gc = guestCount(q); return `<div class="qz-card">
        <div class="qz-top"><span class="chip ${k}">${t}</span><span class="chip">${negText(q)}</span>${q.open ? '<span class="chip ok">সবার জন্য</span>' : ""}${q.announce ? '<span class="chip warn">ঘোষিত</span>' : ""}</div>
        <b>${esc(q.title)}</b><small>${[q.subject, q.chapter].filter(Boolean).map(esc).join(" · ") || "&nbsp;"}</small>
        <div class="qz-nums"><span><b>${bn(q.questions.length)}</b>প্রশ্ন</span><span><b>${bn(q.duration)}</b>মিনিট</span><span><b>${num2(q.questions.length * q.mark)}</b>পূর্ণমান</span><span><b>${bn(at)}/${bn(el.length)}</b>ব্যাচ দিয়েছে</span>${q.open ? `<span><b>${bn(gc)}</b>অনলাইন</span>` : ""}</div>
        <small>${esc(whoText(q))}${q.open ? " + অনলাইন শিক্ষার্থী" : ""}</small><small>${dt(q.opensAt)} → ${dt(q.closesAt)}</small>
        <div class="qz-acts"><button type="button" class="btn gold sm" data-qz-edit="${q.id}">✎ প্রশ্ন ও সেটিংস</button><button type="button" class="btn line sm" data-qz-res="${q.id}">ফলাফল</button><button type="button" class="btn line sm" data-qz-live="${q.id}">${q.live ? "❚❚ বন্ধ করুন" : "► চালু করুন"}</button><button type="button" class="icon-btn" data-qz-del="${q.id}" title="মুছুন">✕</button></div></div>`; }).join("")}</div>` : empty('এখনো কোনো কুইজ নেই — "＋ নতুন কুইজ" চাপুন।')}</section>`;
  }

  // ================= কুইজ তৈরি / সম্পাদনা =================
  function blank() {
    const f = getFilter(), sess = f.session || (X.liveSessions()[0] || {}).name || "";
    const t = new Date(); t.setDate(t.getDate() + 1); const d = t.toLocaleDateString("en-CA");
    return { id: "", title: "", subject: "ICT", chapter: "", session: sess, batchIds: f.batch ? [f.batch] : [], scope: f.batch ? "batch" : "all", duration: 20, opensAt: `${d}T18:00`, closesAt: `${d}T22:00`, mark: 1, negative: false, negValue: 0.25, shuffle: true, attemptsAllowed: 1, showAnswers: true, live: false, open: false, announce: true, questions: [newQ()] };
  }
  function newQ() { return { id: "q_" + Math.random().toString(36).slice(2, 10), text: "", options: ["", "", "", ""], correct: -1, explain: "" }; }
  function editView() {
    const d = Q.draft, bs = DB().batches.filter((b) => !d.session || b.session === d.session), full = d.questions.length * (Number(d.mark) || 0), done = d.questions.filter((q) => q.text.trim() && q.correct >= 0 && q.options[q.correct]).length;
    const hasAtt = d.id && Object.values((byId(d.id) || {}).attempts || {}).some((a) => a.length);
    return `<div class="ln-bar"><button type="button" class="btn line" data-qz-back>‹ সব কুইজ</button><span>${d.id ? '<span class="chip">সম্পাদনা</span>' : '<span class="chip ok">নতুন কুইজ</span>'}</span></div>
    <section class="card qz-set"><h3>কুইজের সেটিংস</h3>
      <div class="qz-grid">
        <label class="span2">কুইজের নাম *<input data-d="title" value="${esc(d.title)}" placeholder="যেমন: অধ্যায় ৩.১ — সংখ্যা পদ্ধতি কুইজ-০১"></label>
        <label>বিষয়<input data-d="subject" value="${esc(d.subject)}"></label><label>অধ্যায়<input data-d="chapter" value="${esc(d.chapter)}" placeholder="যেমন: অধ্যায় ৩.১"></label>
        <label>সময় (মিনিট)<input data-d="duration" inputmode="numeric" value="${esc(String(d.duration))}"></label>
        <label>খুলবে<input type="datetime-local" data-d="opensAt" value="${esc(d.opensAt)}"></label><label>বন্ধ হবে<input type="datetime-local" data-d="closesAt" value="${esc(d.closesAt)}"></label>
        <label>প্রতি প্রশ্নে নম্বর<input data-d="mark" inputmode="decimal" value="${esc(String(d.mark))}"></label>
        <label>কতবার দেওয়া যাবে<select data-d="attemptsAllowed">${[1, 2, 3, 5].map((n) => `<option value="${n}"${Number(d.attemptsAllowed) === n ? " selected" : ""}>${bn(n)} বার</option>`).join("")}</select></label>
      </div>
      <div class="qz-neg"><b>নেগেটিভ মার্কিং</b>
        <label class="hw-pill${!d.negative ? " on" : ""}"><input type="radio" name="qzneg" value="0"${!d.negative ? " checked" : ""}>✗ রাখা হবে না</label>
        <label class="hw-pill${d.negative ? " on" : ""}"><input type="radio" name="qzneg" value="1"${d.negative ? " checked" : ""}>✓ রাখা হবে</label>
        ${d.negative ? `<label class="qz-negv">প্রতি ভুলে কাটা যাবে<select data-d="negValue">${[0.25, 0.5, 1].map((v) => `<option value="${v}"${Number(d.negValue) === v ? " selected" : ""}>−${num2(v)}</option>`).join("")}</select></label>` : ""}
        <small>${d.negative ? `সঠিক = +${num2(Number(d.mark) || 0)}, ভুল = −${num2(Number(d.negValue) || 0)}, উত্তর না দিলে ০। মোট কখনো ০-এর নিচে যাবে না।` : `সঠিক = +${num2(Number(d.mark) || 0)}, ভুল বা উত্তর না দিলে ০।`}</small></div>
      <div class="qz-opts"><label class="qz-chk"><input type="checkbox" data-d="shuffle"${d.shuffle ? " checked" : ""}> প্রশ্ন এলোমেলো ক্রমে আসবে</label><label class="qz-chk"><input type="checkbox" data-d="showAnswers"${d.showAnswers ? " checked" : ""}> জমা দেওয়ার পর সঠিক উত্তর ও ব্যাখ্যা দেখাবে</label></div>
      <div class="hw-who"><b>কাদের জন্য?</b><div class="hw-scope"><label><span>সেশন</span><select data-d="session">${X.opt([...DB().sessions.map((s) => [s.name, s.name]), ...(DB().sessions.length > 1 ? [["", `উভয় (${DB().sessions.map((s) => s.name).join(" + ")})`]] : [])], d.session)}</select></label>
        <label class="hw-pill${d.scope !== "batch" ? " on" : ""}"><input type="radio" name="qzscope" value="all"${d.scope !== "batch" ? " checked" : ""}>পুরো ${esc(d.session || "উভয় সেশন")} — সব ব্যাচ</label>
        <label class="hw-pill${d.scope === "batch" ? " on" : ""}"><input type="radio" name="qzscope" value="batch"${d.scope === "batch" ? " checked" : ""}>নির্দিষ্ট ব্যাচ</label></div>
        ${d.scope === "batch" ? `<div class="cl-batches">${bs.map((b) => `<label class="cl-b"><input type="checkbox" name="qzb" value="${b.id}"${d.batchIds.includes(b.id) ? " checked" : ""}><span><b>${esc(b.name)}</b><small>${esc(b.days || "")} · ${esc(b.time || "")}</small></span></label>`).join("")}</div>` : ""}</div>
      <label class="qz-live qz-ann"><input type="checkbox" data-d="announce"${d.announce ? " checked" : ""}> <b>ঘোষণা দিন — সব শিক্ষার্থীর প্যানেল আর নোটিশ বোর্ডে যাবে</b> <small>(কবে, কখন, কোন বিষয় / অধ্যায়ের কুইজ — প্রশ্ন তৈরির আগেই জানানো যায়; কুইজ বদলালে নোটিশও বদলায়)</small></label>
      <label class="qz-live qz-open"><input type="checkbox" data-d="open"${d.open ? " checked" : ""}> <b>ব্যাচের বাইরের (অনলাইন) শিক্ষার্থীরাও দিতে পারবে</b> <small>(ওয়েবসাইটের "অনলাইন কুইজ" পেজে নাম, মোবাইল, এইচএসসি ব্যাচ, গ্রুপ ও কলেজ দিয়ে)</small></label>
      <label class="qz-live"><input type="checkbox" data-d="live"${d.live ? " checked" : ""}> <b>শিক্ষার্থীদের জন্য চালু</b> <small>(টিক না দিলে খসড়া থাকে — শিক্ষার্থীরা দেখে না)</small></label>
    </section>
    <section class="card" style="margin-top:14px"><div class="qz-head"><div><h3>প্রশ্ন <small class="ln-count">${bn(done)}/${bn(d.questions.length)}টি সম্পূর্ণ · পূর্ণমান ${num2(full)}</small></h3><p class="ex-sub" style="margin:0">প্রতিটা প্রশ্নে সঠিক উত্তরের পাশের গোল ঘরে টিক দিন। খালি অপশন বাদ যায় (কমপক্ষে ২টা লাগবে)।</p></div>
      <div class="rs-btns"><button type="button" class="btn line sm" data-qz-paste>একসাথে অনেক প্রশ্ন পেস্ট</button><button type="button" class="btn line sm" data-qz-add>＋ প্রশ্ন যোগ করুন</button></div></div>
      ${Q.paste ? `<div class="qz-paste"><p class="ex-sub" style="margin:0 0 6px">এভাবে লিখে বা Word থেকে কপি করে পেস্ট করুন — প্রতিটা প্রশ্নের নিচে অপশন, তারপর "উত্তর:" (ব্যাখ্যা ঐচ্ছিক):</p>
        <pre>১. ১ বাইট = কত বিট?\nক) ৪\nখ) ৮\nগ) ১৬\nঘ) ৩২\nউত্তর: খ\nব্যাখ্যা: ৮ বিট মিলে ১ বাইট।</pre>
        <textarea data-paste rows="8" placeholder="প্রশ্নগুলো এখানে পেস্ট করুন…"></textarea><div class="rs-act" style="margin:8px 0 0"><button type="button" class="btn gold sm" data-qz-parse>প্রশ্নগুলো যোগ করুন</button><button type="button" class="btn line sm" data-qz-paste>বাতিল</button></div></div>` : ""}
      <div class="qz-qs">${d.questions.map((q, i) => `<div class="qz-q${q.correct < 0 || !q.text.trim() ? " todo" : ""}" data-qi="${i}"><div class="qz-qh"><b>প্রশ্ন ${bn(i + 1)}</b><span><button type="button" class="icon-btn" data-qz-up="${i}" title="উপরে">↑</button><button type="button" class="icon-btn" data-qz-down="${i}" title="নিচে">↓</button><button type="button" class="icon-btn" data-qz-rm="${i}" title="মুছুন">✕</button></span></div>
        <textarea data-qt rows="2" placeholder="প্রশ্ন লিখুন…">${esc(q.text)}</textarea>
        <div class="qz-os">${q.options.map((o, j) => `<label class="qz-o${q.correct === j ? " ok" : ""}"><input type="radio" name="c_${q.id}" data-qc="${j}"${q.correct === j ? " checked" : ""} title="সঠিক উত্তর"><span>${L[j]}</span><input data-qo="${j}" value="${esc(o)}" placeholder="অপশন ${L[j]}"></label>`).join("")}</div>
        <input class="qz-ex" data-qe value="${esc(q.explain || "")}" placeholder="ব্যাখ্যা (ঐচ্ছিক) — জমার পর শিক্ষার্থী দেখবে"></div>`).join("")}</div>
      <p style="text-align:center;margin:12px 0 0"><button type="button" class="btn line" data-qz-add>＋ প্রশ্ন যোগ করুন</button></p></section>
    <div class="qz-save"><span>${hasAtt ? "এই কুইজ কেউ দিয়ে ফেলেছে — প্রশ্ন বা উত্তর বদলালে আগের নম্বর বদলাবে না" : `${bn(d.questions.length)}টি প্রশ্ন · পূর্ণমান ${num2(full)} · ${esc(negText(d))}`}</span><button type="button" class="btn line" data-qz-back>বাতিল</button><button type="button" class="btn gold" data-qz-save>✓ কুইজ সংরক্ষণ করুন</button></div>`;
  }
  // DOM থেকে খসড়া পড়া (যোগ / সরানো / সেভের আগে)
  function readDraft() {
    const d = Q.draft, C = $(".qz-set") ? document : null; if (!C || !d) return;
    $$("[data-d]").forEach((el) => { const k = el.dataset.d; d[k] = el.type === "checkbox" ? el.checked : el.value; });
    const neg = $('input[name="qzneg"]:checked'); if (neg) d.negative = neg.value === "1";
    const sc = $('input[name="qzscope"]:checked'); if (sc) d.scope = sc.value;
    d.batchIds = $$('input[name="qzb"]:checked').map((x) => x.value);
    $$(".qz-q").forEach((el) => {
      const q = d.questions[Number(el.dataset.qi)]; if (!q) return;
      q.text = $("[data-qt]", el).value; q.explain = $("[data-qe]", el).value;
      q.options = $$("[data-qo]", el).map((x) => x.value);
      const c = $("[data-qc]:checked", el); q.correct = c ? Number(c.dataset.qc) : -1;
    });
  }
  // পেস্ট করা লেখা থেকে প্রশ্ন
  const idxOf = (ch) => { const s = String(ch).trim().toLowerCase(); const i = ["ক", "খ", "গ", "ঘ", "ঙ", "চ"].indexOf(s); if (i >= 0) return i; const a = "abcdef".indexOf(s); if (a >= 0) return a; const n = Number(s.replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d))); return n >= 1 && n <= 6 ? n - 1 : -1; };
  function parsePaste(text) {
    const out = []; let cur = null;
    for (const raw of String(text).split(/\r?\n/)) {
      const line = raw.trim(); if (!line) continue;
      let m;
      if ((m = line.match(/^(?:উত্তর|উঃ|উত্তরঃ|ans(?:wer)?|সঠিক উত্তর)\s*[:：ঃ\-–]?\s*\(?([কখগঘঙচa-fA-F১-৬1-6])\)?/i))) { if (cur) cur.correct = idxOf(m[1]); continue; }
      if ((m = line.match(/^(?:ব্যাখ্যা|explain(?:ation)?)\s*[:：ঃ\-–]\s*(.+)$/i))) { if (cur) cur.explain = m[1]; continue; }
      if (cur && (m = line.match(/^\(?([কখগঘঙচ]|[a-fA-F])[\)\.।:]\s*(.+)$/))) { const i = idxOf(m[1]); if (i >= 0) { cur.options[i] = m[2]; continue; } }
      if ((m = line.match(/^(?:প্রশ্ন\s*)?[০-৯\d]+\s*[\.\)।:]\s*(.+)$/))) { cur = { ...newQ(), options: [], text: m[1] }; out.push(cur); continue; }
      if (cur && !cur.options.length) cur.text += " " + line; else if (!cur) { cur = { ...newQ(), options: [], text: line }; out.push(cur); }
    }
    return out.map((q) => ({ ...q, options: Array.from({ length: Math.max(4, q.options.length) }, (_, i) => q.options[i] || "") })).filter((q) => q.text);
  }
  async function save() {
    readDraft();
    const d = Q.draft;
    if (!d.title.trim()) { toast("কুইজের নাম লিখুন", true); return $('[data-d="title"]').focus(); }
    if (d.scope === "batch" && !d.batchIds.length) return toast("অন্তত একটি ব্যাচ বেছে নিন", true);
    const bad = d.questions.findIndex((q) => q.text.trim() && (q.correct < 0 || !q.options[q.correct] || !q.options[q.correct].trim()));
    if (bad >= 0) { toast(`প্রশ্ন ${bn(bad + 1)}-এ সঠিক উত্তর টিক দিন`, true); return $(`.qz-q[data-qi="${bad}"]`).scrollIntoView({ block: "center" }); }
    const qs = d.questions.filter((q) => q.text.trim()).map((q) => ({ id: q.id, text: q.text.trim(), options: q.options.map((o) => o.trim()), correct: q.correct, explain: (q.explain || "").trim() }))
      .map((q) => { const keep = q.options.map((o, i) => [o, i]).filter(([o]) => o); return { ...q, options: keep.map(([o]) => o), correct: keep.findIndex(([, i]) => i === q.correct) }; });
    if (d.live && !qs.length) return toast("প্রশ্ন ছাড়া কুইজ চালু করা যাবে না", true);
    if (qs.some((q) => q.options.length < 2)) return toast("প্রতিটা প্রশ্নে কমপক্ষে ২টা অপশন দিন", true);
    const body = { title: d.title.trim(), subject: d.subject, chapter: d.chapter, session: d.session, batchIds: d.scope === "batch" ? d.batchIds : [], duration: Number(String(d.duration).replace(/[০-৯]/g, (x) => "০১২৩৪৫৬৭৮৯".indexOf(x))) || 20, opensAt: d.opensAt, closesAt: d.closesAt,
      mark: Number(String(d.mark).replace(/[০-৯]/g, (x) => "০১২৩৪৫৬৭৮৯".indexOf(x))) || 1, negative: !!d.negative, negValue: Number(d.negValue) || 0.25, shuffle: !!d.shuffle, attemptsAllowed: Number(d.attemptsAllowed) || 1, showAnswers: !!d.showAnswers, live: !!d.live, open: !!d.open, announce: !!d.announce, questions: qs };
    try { await X.save("quizzes", body, d.id || undefined); Q.view = "list"; Q.draft = null; Q.dirty = false; await X.load(); rerender(); toast(`কুইজ সংরক্ষণ হয়েছে${body.live ? " — শিক্ষার্থীদের জন্য চালু" : " (খসড়া)"}`); } catch (e) { toast(e.message, true); }
  }

  // ================= ফলাফল =================
  function resultRows(q) {
    const rows = Object.entries(q.attempts || {}).map(([sid, list]) => {
      const done = list.filter((a) => a.submittedAt); if (!done.length) return null;
      const best = done.reduce((a, b) => (b.score > a.score ? b : a));
      return { sid, s: person(sid), guest: !!guestById(sid), best, n: done.length, mins: Math.max(1, Math.round((new Date(best.submittedAt) - new Date(best.startedAt)) / 60000)) };
    }).filter(Boolean).sort((a, b) => b.best.score - a.best.score || a.mins - b.mins);
    let rank = 0, prev = null; rows.forEach((r, i) => { if (r.best.score !== prev) { rank = i + 1; prev = r.best.score; } r.rank = rank; });
    return rows;
  }
  function resultsView() {
    const q = byId(Q.id); if (!q) { Q.view = "list"; return listView(); }
    const rows = resultRows(q), full = q.questions.length * q.mark, sc = rows.map((r) => r.best.score), el = eligible(q);
    const avg = sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : null;
    // প্রশ্ন অনুযায়ী: কতজন সঠিক, কোন ভুল অপশন বেশি
    const per = q.questions.map((qq) => { let ok = 0, ans = 0; const pick = {}; rows.forEach((r) => { const a = (r.best.answers || {})[qq.id]; if (a === undefined) return; ans++; if (a === qq.correct) ok++; else pick[a] = (pick[a] || 0) + 1; }); const wrong = Object.entries(pick).sort((a, b) => b[1] - a[1])[0]; return { qq, ok, ans, wrong }; });
    return `<div class="ln-bar"><button type="button" class="btn line" data-qz-back>‹ সব কুইজ</button><span><button type="button" class="btn line sm" data-qz-print="${q.id}">Print / PDF</button> <button type="button" class="btn line sm" data-qz-excel="${q.id}">↓ Excel</button></span></div>
      <section class="card"><div class="ex-head"><b>${esc(q.title)}</b> <span class="chip ${state(q)[1]}">${state(q)[0]}</span> <span class="chip">${negText(q)}</span><small>${[q.subject, q.chapter, `${bn(q.questions.length)}টি প্রশ্ন`, `${bn(q.duration)} মিনিট`, `পূর্ণমান ${num2(full)}`, whoText(q)].filter(Boolean).map(esc).join(" · ")}</small></div>
      <div class="ex-rsum" style="margin:12px 0"><span><b>${bn(rows.filter((r) => !r.guest).length)}/${bn(el.length)}</b>ব্যাচ দিয়েছে</span>${q.open || rows.some((r) => r.guest) ? `<span><b>${bn(rows.filter((r) => r.guest).length)}</b>অনলাইন</span>` : ""}<span><b>${avg === null ? "—" : num2(avg)}</b>গড়</span><span class="ok"><b>${sc.length ? num2(Math.max(...sc)) : "—"}</b>সর্বোচ্চ</span><span class="bad"><b>${sc.length ? num2(Math.min(...sc)) : "—"}</b>সর্বনিম্ন</span></div>
      <h4 class="ex-rh">Quiz Merit <small class="ln-count">একাধিকবার দিলে সবচেয়ে ভালোটা · সমান হলে কম সময়ে যে শেষ করেছে</small></h4>
      <div class="tbl-wrap"><table class="exam-entry-table"><thead><tr><th>মেধা</th><th>আইডি</th><th>নাম</th><th>ব্যাচ</th><th class="num">নম্বর</th><th class="num">সঠিক</th><th class="num">ভুল</th><th class="num">উত্তর দেয়নি</th><th class="num">সময়</th><th class="num">কতবার</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td><b>${U.rankName(r.rank)}</b></td><td>${esc(r.sid)}</td><td>${esc(r.s.name)}${r.guest ? `<small>${esc([r.s.college, r.s.phone].filter(Boolean).join(" · "))}</small>` : ""}</td><td>${esc(whereOf(r.sid))}</td><td class="num"><b>${num2(r.best.score)}</b>/${num2(r.best.full)}</td><td class="num">${bn(r.best.correct)}</td><td class="num">${bn(r.best.wrong)}</td><td class="num">${bn(r.best.skipped)}</td><td class="num">${bn(r.mins)} মি.${r.best.late ? ' <span class="chip warn">দেরিতে</span>' : ""}</td><td class="num">${bn(r.n)}</td></tr>`).join("") || '<tr><td colspan="10" class="empty">এখনো কেউ কুইজটা দেয়নি</td></tr>'}</tbody></table></div>
      ${el.length > rows.length ? `<p class="ex-sub" style="margin:8px 0 0">এখনো দেয়নি: ${el.filter((s) => !rows.some((r) => r.sid === s.id)).map((s) => esc(`${s.name} (${s.id})`)).join(", ")}</p>` : ""}</section>
      <section class="card" style="margin-top:14px"><h3>প্রশ্ন অনুযায়ী বিশ্লেষণ <small class="ln-count">কোন প্রশ্ন বেশি ভুল হয়েছে</small></h3><div class="qz-an">${per.map((p, i) => { const r = p.ans ? (p.ok / p.ans) * 100 : null; return `<div class="qz-ai"><b>${bn(i + 1)}. ${esc(p.qq.text.slice(0, 120))}</b><div class="qz-bar"><i style="width:${r ?? 0}%;background:${r === null ? "#ccc" : r >= 70 ? "#187460" : r >= 40 ? "#d9a441" : "#b4233c"}"></i></div><small>${r === null ? "কেউ উত্তর দেয়নি" : `${bn(Math.round(r))}% সঠিক (${bn(p.ok)}/${bn(p.ans)})`} · সঠিক: ${L[p.qq.correct]}) ${esc(p.qq.options[p.qq.correct] || "")}${p.wrong ? ` · বেশি ভুল বেছেছে: ${L[p.wrong[0]]}) ${esc(p.qq.options[p.wrong[0]] || "")} (${bn(p.wrong[1])} জন)` : ""}</small></div>`; }).join("") || empty("প্রশ্ন নেই")}</div></section>`;
  }

  // ================= বাইরে থেকে =================
  return {
    count: () => quizzes().length,
    html: () => (Q.view === "edit" && Q.draft ? editView() : Q.view === "results" ? resultsView() : listView()),
    click(e) {
      const t = (s) => e.target.closest(s); let el;
      if (t("[data-qz-new]")) { Q.draft = blank(); Q.view = "edit"; Q.paste = false; rerender(); return true; }
      if ((el = t("[data-qz-edit]"))) { const q = byId(el.dataset.qzEdit); Q.draft = { ...JSON.parse(JSON.stringify(q)), scope: (q.batchIds || []).length ? "batch" : "all", questions: q.questions.map((x) => ({ ...x, options: Array.from({ length: Math.max(4, x.options.length) }, (_, i) => x.options[i] || "") })) }; if (!Q.draft.questions.length) Q.draft.questions.push(newQ()); Q.view = "edit"; Q.paste = false; rerender(); return true; }
      if ((el = t("[data-qz-res]"))) { Q.id = el.dataset.qzRes; Q.view = "results"; rerender(); return true; }
      if ((el = t("[data-qz-live]"))) { const q = byId(el.dataset.qzLive); if (!q.live && !q.questions.length) { toast("আগে প্রশ্ন যোগ করুন", true); return true; } X.save("quizzes", { ...q, live: !q.live }, q.id).then(() => X.load()).then(() => { rerender(); toast(q.live ? "কুইজ বন্ধ (খসড়া) করা হয়েছে" : "কুইজ শিক্ষার্থীদের জন্য চালু হয়েছে"); }).catch((er) => toast(er.message, true)); return true; }
      if ((el = t("[data-qz-del]"))) { X.remove("quizzes", el.dataset.qzDel, "এই কুইজ, এর প্রশ্ন আর সবার উত্তর"); return true; }
      if (t("[data-qz-back]")) { if (Q.view === "edit" && Q.dirty && !confirm("পরিবর্তন সেভ হয়নি। তবুও ফিরে যাবেন?")) return true; Q.view = "list"; Q.draft = null; Q.dirty = false; rerender(); return true; }
      if (t("[data-qz-save]")) { save(); return true; }
      if (t("[data-qz-add]")) { readDraft(); Q.draft.questions.push(newQ()); Q.dirty = true; rerender(); const all = $$(".qz-q"); const last = all[all.length - 1]; if (last) { last.scrollIntoView({ block: "center" }); $("[data-qt]", last).focus(); } return true; }
      if (t("[data-qz-paste]")) { readDraft(); Q.paste = !Q.paste; rerender(); if (Q.paste) $("[data-paste]").focus(); return true; }
      if (t("[data-qz-parse]")) {
        readDraft(); const got = parsePaste(($("[data-paste]") || {}).value || "");
        if (!got.length) { toast("কোনো প্রশ্ন পাওয়া যায়নি — নমুনার মতো করে লিখুন", true); return true; }
        Q.draft.questions = Q.draft.questions.filter((q) => q.text.trim() || q.options.some((o) => o.trim())).concat(got); Q.paste = false; Q.dirty = true; rerender();
        const noAns = got.filter((q) => q.correct < 0).length;
        toast(`${bn(got.length)}টি প্রশ্ন যোগ হয়েছে${noAns ? ` — ${bn(noAns)}টিতে সঠিক উত্তর টিক দিন` : ""}`, !!noAns); return true;
      }
      if ((el = t("[data-qz-rm]"))) { readDraft(); const i = Number(el.dataset.qzRm), q = Q.draft.questions[i]; if ((q.text.trim() || q.options.some((o) => o.trim())) && !confirm(`প্রশ্ন ${bn(i + 1)} মুছবেন?`)) return true; Q.draft.questions.splice(i, 1); if (!Q.draft.questions.length) Q.draft.questions.push(newQ()); Q.dirty = true; rerender(); return true; }
      if ((el = t("[data-qz-up]")) || (el = t("[data-qz-down]"))) { readDraft(); const i = Number(el.dataset.qzUp ?? el.dataset.qzDown), j = el.dataset.qzUp !== undefined ? i - 1 : i + 1, a = Q.draft.questions; if (j >= 0 && j < a.length) { [a[i], a[j]] = [a[j], a[i]]; Q.dirty = true; rerender(); } return true; }
      if ((el = t("[data-qz-print]")) || (el = t("[data-qz-excel]"))) {
        const q = byId(el.dataset.qzPrint || el.dataset.qzExcel), rows = resultRows(q);
        const head = ["মেধা", "আইডি", "নাম", "ব্যাচ", "নম্বর", "সঠিক", "ভুল", "উত্তর দেয়নি", "সময় (মিনিট)"], body = rows.map((r) => [r.rank, r.sid, r.s.name, whereOf(r.sid), `${r.best.score}/${r.best.full}`, r.best.correct, r.best.wrong, r.best.skipped, r.mins]);
        if (el.dataset.qzExcel) U.xlsx(`quiz-${q.title}-${U.today()}.xlsx`, head, body);
        else X.printDoc(`কুইজ ফলাফল — ${q.title}`, `<h1>কুইজ ফলাফল — Quiz Merit</h1><p>${esc(q.title)} · ${bn(q.questions.length)}টি প্রশ্ন · পূর্ণমান ${num2(q.questions.length * q.mark)} · ${esc(negText(q))} · ${esc(whoText(q))}</p><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${esc(bn(String(c)))}</td>`).join("")}</tr>`).join("")}</tbody></table><div class="sign"><span></span><span>শিক্ষকের স্বাক্ষর</span></div>`);
        return true;
      }
      return false;
    },
    change(e) {
      if (!e.target.closest(".qz-set, .qz-qs")) return false;
      Q.dirty = true;
      const n = e.target.name;
      if (n === "qzneg" || n === "qzscope" || e.target.dataset.d === "session" || e.target.dataset.d === "negValue" || e.target.dataset.d === "mark") { readDraft(); if (e.target.dataset.d === "session") Q.draft.batchIds = []; rerender(); return true; }
      if (e.target.matches("[data-qc]")) { const box = e.target.closest(".qz-q"); $$(".qz-o", box).forEach((o) => o.classList.toggle("ok", $("[data-qc]", o).checked)); box.classList.toggle("todo", !$("[data-qt]", box).value.trim()); return true; }
      return true;
    },
    input(e) { if (e.target.closest(".qz-set, .qz-qs, .qz-paste")) { Q.dirty = true; return true; } return false; },
    busy: () => Q.view === "edit" && Q.dirty,
  };
};

// ================= বাম মেনুর "অনলাইন কুইজ" পেজ =================
// ট্যাব: কুইজ (তৈরি, প্রশ্ন, ফলাফল) · অনলাইন শিক্ষার্থী (ব্যাচের বাইরে থেকে যারা ফর্ম পূরণ করে কুইজ দিয়েছে)
window.SICQuizPage = function (X) {
  "use strict";
  const { $, esc, bn, toast } = U;
  const DB = () => X.DB;
  const S = { tab: "quiz", f: { session: "", batch: "" }, q: "", hsc: "", group: "" };
  try { Object.assign(S.f, JSON.parse(localStorage.getItem("sicQuizFilter") || "{}")); } catch {}
  let C = null;
  const session = () => S.f.session || (X.liveSessions()[0] || {}).name || "";
  const QZ = window.SICQuiz(X, () => render(), () => ({ session: session(), batch: S.f.batch }));
  const guests = () => DB().quizGuests || [];
  // একজন অনলাইন শিক্ষার্থী কোন কোন কুইজ দিয়েছে (প্রতিটায় সবচেয়ে ভালো নম্বর)
  const taken = (gid) => DB().quizzes.map((q) => { const d = ((q.attempts || {})[gid] || []).filter((a) => a.submittedAt); return d.length ? { q, best: d.reduce((a, b) => (b.score > a.score ? b : a)) } : null; }).filter(Boolean);
  const n2 = (x) => bn(String(Math.round(x * 100) / 100));

  function guestRows() {
    const q = S.q.trim().toLowerCase();
    return guests().filter((g) => (!S.hsc || g.hsc === S.hsc) && (!S.group || g.group === S.group) && (!q || [g.id, g.name, g.phone, g.college].join(" ").toLowerCase().includes(q)))
      .map((g) => ({ g, t: taken(g.id) })).sort((a, b) => String(b.g.createdAt).localeCompare(String(a.g.createdAt)));
  }
  function guestsTab() {
    const rows = guestRows(), hs = [...new Set(guests().map((g) => g.hsc))].sort(), gs = [...new Set(guests().map((g) => g.group))];
    return `<section class="card"><div class="qz-head"><div><h3>অনলাইন শিক্ষার্থী <small class="ln-count">${bn(rows.length)} জন</small></h3><p class="ex-sub" style="margin:0">ব্যাচের বাইরের যারা ওয়েবসাইটের <a href="/quiz" target="_blank">অনলাইন কুইজ</a> পেজে ফর্ম পূরণ করেছে। একই মোবাইলে আবার এলে নতুন করে যোগ হয় না — আগের তথ্য আপডেট হয়। ভর্তির জন্য যোগাযোগ করতে কাজে লাগবে।</p></div>
        <div class="rs-btns"><button type="button" class="btn line sm" data-g-excel>↓ Excel</button></div></div>
      <div class="ln-filter" style="margin:12px 0"><label>খুঁজুন<input data-g="q" value="${esc(S.q)}" placeholder="নাম, মোবাইল, আইডি বা কলেজ"></label>
        <label>এইচএসসি ব্যাচ<select data-g="hsc">${X.opt([["", "সব"], ...hs.map((h) => [h, h])], S.hsc)}</select></label>
        <label>গ্রুপ<select data-g="group">${X.opt([["", "সব"], ...gs.map((h) => [h, h])], S.group)}</select></label></div>
      <div class="tbl-wrap"><table class="exam-entry-table"><thead><tr><th>আইডি</th><th>নাম</th><th>মোবাইল</th><th>এইচএসসি ব্যাচ</th><th>গ্রুপ</th><th>কলেজ</th><th>কুইজ ও নম্বর</th><th>যুক্ত হয়েছে</th></tr></thead><tbody>
      ${rows.map(({ g, t }) => `<tr><td><b>${esc(g.id)}</b></td><td><b>${esc(g.name)}</b></td><td><a href="tel:${esc(g.phone)}">${esc(g.phone)}</a></td><td>${esc(g.hsc)}</td><td>${esc(g.group)}</td><td>${esc(g.college)}</td>
        <td>${t.length ? t.map((x) => `<small>${esc(x.q.title)}: <b>${n2(x.best.score)}/${n2(x.best.full)}</b></small>`).join("") : '<small class="ln-count">এখনো কোনো কুইজ দেয়নি</small>'}</td><td>${U.date((g.createdAt || "").slice(0, 10))}</td></tr>`).join("") || '<tr><td colspan="8" class="empty">এখনো কোনো অনলাইন শিক্ষার্থী নেই</td></tr>'}</tbody></table></div></section>`;
  }
  function render() {
    if (!C) return;
    const all = DB().quizzes.filter((q) => !q.session || q.session === session()), live = all.filter((q) => q.live), open = all.filter((q) => q.live && q.open);
    const tabs = [["quiz", "কুইজ", all.length], ["guests", "অনলাইন শিক্ষার্থী", guests().length]];
    C.innerHTML = `<div class="ex-page qz-page">
      <section class="ln-banner"><div><span class="eyebrow">ঘরে বসে MCQ পরীক্ষা</span><h2>অনলাইন কুইজ</h2>
        <p>ব্যাচের শিক্ষার্থীরা নিজের প্যানেলে কুইজ দেয়। "সবার জন্য খোলা" কুইজ ব্যাচের বাইরের যে কেউ ওয়েবসাইটের <a href="/quiz" target="_blank" style="color:inherit;text-decoration:underline">অনলাইন কুইজ</a> পেজে নাম, মোবাইল, এইচএসসি ব্যাচ, গ্রুপ ও কলেজ দিয়ে দিতে পারে।</p>
        <div class="ln-nums"><span><b>${bn(all.length)}</b>মোট কুইজ (${esc(session())})</span><span><b>${bn(live.length)}</b>চালু</span><span><b>${bn(open.length)}</b>সবার জন্য খোলা</span><span><b>${bn(guests().length)}</b>অনলাইন শিক্ষার্থী</span></div></div>
        <button type="button" class="btn gold" data-qz-new>＋ নতুন কুইজ</button></section>
      ${S.tab === "quiz" ? `<div class="ln-filter"><label>সেশন<select data-f="session">${X.opt(DB().sessions.map((s) => [s.name, s.name]), session())}</select></label>
        <label>ব্যাচ<select data-f="batch">${X.opt([["", "সব ব্যাচ"], ...DB().batches.filter((b) => b.session === session()).map((b) => [b.id, U.batchLabel(b)])], S.f.batch)}</select></label></div>` : ""}
      <div class="ln-tabs">${tabs.map(([k, t, n]) => `<button type="button" data-tab="${k}" class="${S.tab === k ? "on" : ""}">${t} <i>${bn(n)}</i></button>`).join("")}</div>
      ${S.tab === "guests" ? guestsTab() : QZ.html()}</div>`;
  }
  function onClick(e) {
    const el = e.target.closest("[data-tab]");
    if (el) { if (QZ.busy() && !confirm("পরিবর্তন সেভ হয়নি। তবুও যাবেন?")) return; S.tab = el.dataset.tab; return render(); }
    if (e.target.closest("[data-qz-new]") && S.tab !== "quiz") S.tab = "quiz";
    if (e.target.closest("[data-g-excel]")) {
      const head = ["আইডি", "নাম", "মোবাইল", "এইচএসসি ব্যাচ", "গ্রুপ", "কলেজ", "কুইজ দিয়েছে", "যুক্ত হয়েছে"];
      return U.xlsx(`online-students-${U.today()}.xlsx`, head, guestRows().map(({ g, t }) => [g.id, g.name, g.phone, g.hsc, g.group, g.college, t.map((x) => `${x.q.title}: ${x.best.score}/${x.best.full}`).join("; "), (g.createdAt || "").slice(0, 10)]));
    }
    if (S.tab === "quiz") QZ.click(e);
  }
  function onChange(e) {
    const f = e.target.dataset.f, g = e.target.dataset.g;
    if (f) { S.f[f] = e.target.value; if (f === "session") S.f.batch = ""; try { localStorage.setItem("sicQuizFilter", JSON.stringify(S.f)); } catch {} return render(); }
    if (g && g !== "q") { S[g] = e.target.value; return render(); }
    if (S.tab === "quiz") QZ.change(e);
  }
  function onInput(e) {
    if (e.target.dataset.g === "q") { S.q = e.target.value; const pos = e.target.selectionStart; render(); const i = C.querySelector('[data-g="q"]'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } return; }
    if (S.tab === "quiz") QZ.input(e);
  }
  addEventListener("beforeunload", (e) => { if (C && C.isConnected && QZ.busy()) { e.preventDefault(); e.returnValue = ""; } });
  return function quizPage(c) {
    C = c;
    c.onclick = onClick; c.onchange = onChange; c.oninput = onInput;
    render();
  };
};
