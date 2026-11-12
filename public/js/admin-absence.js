// অ্যাডমিন → দৈনিক হাজিরা → "📞 অনুপস্থিতি কল তালিকা"
// যেদিনের হাজিরায় যারা অনুপস্থিত (A), তাদের অভিভাবককে কল / WhatsApp / SMS করার তালিকা — ব্যাচ ধরে।
// প্রতিটা কলের পর অবস্থা (কথা হয়েছে / ধরেনি / পরে ফোন করব), কারণ আর নোট জমা থাকে (db.absenceCalls)।
window.SICAbsence = function (X) {
  "use strict";
  const { $, $$, esc, bn, api, toast } = U;
  const DB = () => X.DB;
  const today = () => U.today();
  const enNum = (s) => String(s || "").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d));
  const cleanPhone = (s) => enNum(s).replace(/\D/g, "").replace(/^88/, "");
  const addDays = (d, n) => { const x = new Date(d + "T00:00:00"); x.setDate(x.getDate() + n); return x.toLocaleDateString("en-CA"); };

  const STATUS = [["talked", "✅ কথা হয়েছে", "ok"], ["noanswer", "📵 ফোন ধরেনি / বন্ধ", "bad"], ["later", "🔁 পরে ফোন করব", "warn"]];
  const REASONS = window.SICAbsence.reasons;
  const S = { date: X.callDate || today(), session: "", batch: "", hideDone: false };

  const calls = () => (DB().absenceCalls ||= {});
  const drafts = SICContacts.callDrafts((row) => row.dataset.key, "[data-abst]", "abst");
  const batchOf = (id) => DB().batches.find((b) => b.id === id);

  // কাকে কল করবেন (অভিভাবক · বাবা · মা · শিক্ষার্থী) — admin-contacts.js (SICContacts)

  // একজনের P/A ইতিহাস (ছুটি বাদ; একই দিনে কোথাও উপস্থিত থাকলে উপস্থিত), নতুন থেকে পুরোনো
  const history = (sid) => {
    const byDate = {};
    for (const [key, marks] of Object.entries(DB().attendance || {})) {
      const st = marks[sid]; if (st !== "P" && st !== "A") continue;
      const d = key.split("|")[0]; if (byDate[d] !== "P") byDate[d] = st;
    }
    return Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0]));
  };
  const streakOf = (sid, date) => { let n = 0; for (const [d, st] of history(sid)) { if (d > date) continue; if (st !== "A") break; n++; } return n; };
  const monthAbsent = (sid, date) => history(sid).filter(([d, st]) => d.slice(0, 7) === date.slice(0, 7) && d <= date && st === "A").length;

  const inScope = (s) => {
    const b = batchOf(s.batchId);
    return (!S.session || (b && b.session === S.session)) && (!S.batch || s.batchId === S.batch);
  };
  // ওই দিনের অনুপস্থিত সক্রিয় শিক্ষার্থী (অন্য ব্যাচে উপস্থিত থাকলে বাদ)
  const absentRows = (date) => {
    const att = DB().attendance || {}, seen = new Set(), rows = [];
    for (const [key, marks] of Object.entries(att)) {
      const [d, bid] = key.split("|");
      if (d !== date) continue;
      for (const [sid, st] of Object.entries(marks)) {
        if (st !== "A" || seen.has(sid)) continue;
        const s = DB().students.find((x) => x.id === sid);
        if (!s || s.status === "inactive") continue;
        if (bid !== s.batchId) continue; // এখন অন্য ব্যাচে (ব্যাচ বদলেছে) — পুরোনো ব্যাচের অনুপস্থিতি আর গোনা হয় না
        if (Object.entries(att).some(([k2, m2]) => k2.startsWith(date + "|") && m2[sid] === "P")) continue;
        seen.add(sid);
        rows.push({ s, key: `${date}|${sid}`, date });
      }
    }
    return rows.filter((r) => inScope(r.s));
  };
  // আগের দিনের ফলো-আপ: "পরে ফোন করব" (তারিখ এসে গেছে) আর গত ৩ দিনের "ধরেনি"
  const followRows = (date) => {
    const rows = [];
    for (const [key, c] of Object.entries(calls())) {
      const [d, sid] = key.split("|");
      if (d >= date) continue;
      const due = (c.status === "later" && (!c.followUp || c.followUp <= date)) || (c.status === "noanswer" && d >= addDays(date, -3));
      if (!due) continue;
      const s = DB().students.find((x) => x.id === sid);
      if (!s || s.status === "inactive" || !inScope(s)) continue;
      if (history(sid).some(([day, status]) => day > d && day <= date && status === "P")) continue;
      rows.push({ s, key, date: d, follow: true });
    }
    return rows;
  };
  // যে ব্যাচের ওই দিনের হাজিরা এখনো সেভ হয়নি, তার সর্বশেষ সেভ করা হাজিরা (ওই দিনের আগের) — সেই দিনের অনুপস্থিতি তালিকায় দেখানো হয়
  const lastSaved = (bid, date) => { let best = ""; for (const [key, marks] of Object.entries(DB().attendance || {})) { const [d, b] = key.split("|"); if (b === bid && d < date && d > best && Object.keys(marks || {}).length) best = d; } return best; };
  const lastRows = (date) => {
    const out = [];
    for (const b of unsavedBatches(date)) { const ld = lastSaved(b.id, date); if (!ld) continue; for (const r of absentRows(ld)) if (r.s.batchId === b.id) out.push({ ...r, last: true }); }
    return out;
  };
  const pendingCount = (date) => [...absentRows(date), ...lastRows(date)].filter((r) => !calls()[r.key]).length;
  // হাজিরা এখনো সেভ হয়নি এমন ব্যাচ (ছুটি / বন্ধ বাদে) — তাদের অনুপস্থিতি এই তালিকায় আসবে না
  const unsavedBatches = (date) => DB().batches.filter((b) => b.active !== false && (!S.session || b.session === S.session) && (!S.batch || b.id === S.batch)
    && DB().students.some((s) => s.batchId === b.id && s.status !== "inactive") && !DB().attendance[`${date}|${b.id}`] && !U.closureOn(DB().closures, b.id, date));

  const msgFor = (s, date) => `আসসালামু আলাইকুম। ${DB().settings.name || "Shahin's ICT Care"} থেকে বলছি। আপনার সন্তান ${s.name} ${U.date(date)} তারিখে ক্লাসে অনুপস্থিত ছিল। অনুগ্রহ করে কারণটা জানাবেন।`;

  // পড়া বন্ধের পপ-আপ: অভিভাবক জানালে "আর পড়বে না" — আজ থেকে, আগামী মাসের ১ তারিখ থেকে, বা অন্য তারিখ থেকে (পুরোনো "পড়া বন্ধ" ব্যবস্থাই ব্যবহার হয়)
  const nextMonthFirst = () => { const [y, m] = today().split("-").map(Number); return new Date(y, m, 1).toLocaleDateString("en-CA"); };
  const stopHtml = (s, uid) => `<div class="ab-stop" hidden>
      <b>⏸ ${esc(s.name)}-এর পড়া বন্ধ করুন</b>
      <label class="ab-opt"><input type="radio" name="stop-${uid}" value="today" checked><span><b>আজ থেকে</b><small>এই মাসে আর পড়বে না। এই মাসে একদিনও উপস্থিত না থাকলে ফি শূন্য; থাকলে আজ পর্যন্ত ক্লাসের ফি ধরা হবে।</small></span></label>
      <label class="ab-opt"><input type="radio" name="stop-${uid}" value="next"><span><b>আগামী মাসের ১ তারিখ (${esc(U.date(nextMonthFirst()))}) থেকে</b><small>এই মাস পর্যন্ত পড়বে। ঐ তারিখ এলে নিজে থেকেই পড়া বন্ধ হয়ে যাবে।</small></span></label>
      <label class="ab-opt"><input type="radio" name="stop-${uid}" value="custom"><span><b>অন্য তারিখ থেকে</b><input type="date" class="ab-stop-date" value="${today()}"></span></label>
      <input class="ab-stop-reason" maxlength="300" placeholder="কারণ" value="অভিভাবক জানিয়েছেন — আর পড়বে না">
      <div class="ab-stop-acts"><button type="button" class="ab-btn call" data-abstop-ok>নিশ্চিত করুন — পড়া বন্ধ</button><button type="button" class="ab-btn" data-abstop-cancel>বাতিল</button></div>
      <small>পরে আবার চালু করতে: শিক্ষার্থীর পাতা বা হাজিরা পাতার "পড়া বন্ধ" বোতাম।</small>
    </div>`;

  // ব্যাচ বদলের পপ-আপ: শিক্ষার্থী আসলে অন্য ব্যাচে পড়ে — একই সেশনের অন্য ব্যাচে নেওয়া (আগের হাজিরা, পরীক্ষা, পেমেন্ট থেকে যায়)
  const moveHtml = (s) => {
    const others = DB().batches.filter((b) => b.session === s.session && b.id !== s.batchId && b.active !== false);
    return `<div class="ab-move" hidden>
      <b>🔄 ${esc(s.name)}-কে অন্য ব্যাচে নিন</b>
      ${others.length ? `<label>নতুন ব্যাচ<select class="ab-move-to"><option value="">— ব্যাচ বাছুন —</option>${others.map((b) => `<option value="${esc(b.id)}">${esc(U.batchLabel(b))}</option>`).join("")}</select></label>
      <div class="ab-stop-acts"><button type="button" class="ab-btn call" data-abmove-ok>ব্যাচ বদল করুন</button><button type="button" class="ab-btn" data-abmove-cancel>বাতিল</button></div>
      <small>${esc(s.session || "")} সেশনের এখনকার ব্যাচ: ${esc(X.batchName(s.batchId))}। বদলালে আগের হাজিরা, পরীক্ষা আর পেমেন্ট থেকে যায়, আর ঐ অনুপস্থিতি এই তালিকা থেকে সরে যায়।</small>`
        : `<p class="ab-warn">এই সেশনে আর কোনো ব্যাচ নেই।</p><div class="ab-stop-acts"><button type="button" class="ab-btn" data-abmove-cancel>বন্ধ করুন</button></div>`}
    </div>`;
  };

  // বকেয়ার চিহ্ন: কলের সময় অভিভাবককে ফি-র কথাও মনে করানো যায় (সারির ওপর মাউস রাখলে মোট ফি আর জমা দেখায়)
  // আজ এই শিক্ষার্থীর অভিভাবককে অনুপস্থিতির SMS গেছে কি না (এই তালিকা থেকে বা সন্ধ্যার অটো SMS-এ) — SMS খাতা (smsLog) থেকে
  const smsChip = (s) => ((DB().smsLog || []).some((l) => l.ok && l.date === today() && String(l.text || "").includes(`— ${s.id}`) && (l.filter === "CallAbsent" || l.filter === "Absent")) ? ` <span class="chip ok">✉ আজ SMS গেছে</span>` : "");
  const dueChip = (s) => {
    const f = s.fees; if (!f) return "";
    const b = Number(f.balance) || 0, tip = esc(`মোট ফি ${U.money(f.totalDue)} · জমা ${U.money(f.paid)}`);
    return b > 0 ? `<span class="chip bad" title="${tip}">বকেয়া ${U.money(b)}</span>` : b < 0 ? `<span class="chip ok" title="${tip}">অগ্রিম ${U.money(-b)}</span>` : `<span class="chip ok" title="${tip}">বকেয়া নেই</span>`;
  };

  const rowHtml = (r) => {
    const { s, key, date } = r, c = calls()[key] || {};
    const pending = (s.pauses || []).find((p) => !p.to && p.startPending); // সামনের তারিখে বন্ধ ঠিক করা আছে
    const uid = `${esc(s.id)}-${r.follow ? "f" : "a"}`;
    const streak = streakOf(s.id, date), mon = monthAbsent(s.id, date);
    const reasons = [...REASONS]; if (c.reason && !reasons.includes(c.reason)) reasons.push(c.reason);
    // কলের অবস্থার বাটন — নাম ও চিহ্নের ঠিক নিচে (ডানের যোগাযোগ কার্ডের পাশের ফাঁকা জায়গায়)
    const stBtns = `<div class="ab-st">${STATUS.map(([v, t, cls]) => `<button type="button" class="${cls}${c.status === v ? " on" : ""}" data-abst="${v}">${t}</button>`).join("")}<button type="button" class="move" data-abmove>🔄 ব্যাচ বদল</button>${pending ? "" : `<button type="button" class="stop" data-abstop>⏸ আর পড়বে না</button>`}</div>`;
    const dueUpdate = s.fees?.balance > 0 ? '<button type="button" class="ab-btn ab-cross-update" data-ab-due>বকেয়ার আপডেট</button>' : "";
    const contact = SICContacts.html(s, key, msgFor(s, date), dueUpdate); // অভিভাবক · বাবা · মা · শিক্ষার্থী — যাকে বাছবেন তার নম্বরে কল / WhatsApp / SMS
    return `<div class="ab-row${c.status === "talked" ? " done" : ""}${r.follow ? " fu" : ""}" data-key="${esc(key)}" data-saved-status="${esc(c.status || "")}" data-sid="${esc(s.id)}" data-date="${esc(date)}">
      <div class="ab-top">
        <div class="ab-stu"><b>${esc(s.name)}</b><small>${esc(s.id)} · ${esc(X.batchName(s.batchId))}${r.follow ? ` · <span class="chip warn">ফলো-আপ — ${esc(U.date(date))}-এর অনুপস্থিতি</span>` : ""}${r.last ? ` · <span class="chip warn">সর্বশেষ হাজিরা (${esc(U.date(date))})-এর অনুপস্থিতি</span>` : ""}</small>
          <small>${streak > 1 ? `<span class="chip bad">${bn(streak)} দিন টানা অনুপস্থিত</span> ` : ""}${date === today() && !(streak > 1) ? '<span class="chip bad">আজ অনুপস্থিত</span> ' : ""}<span class="chip">এই মাসে ${bn(mon)} দিন অনুপস্থিত</span> ${dueChip(s)}${smsChip(s)}${pending ? ` <span class="chip warn">⏸ ${esc(U.date(pending.from))} থেকে পড়া বন্ধ হবে</span>` : ""}</small>${stBtns}</div>
        ${contact}
      </div>
      ${moveHtml(s)}${pending ? "" : stopHtml(s, uid)}
      <div class="ab-note-row">
        <label class="ab-field ab-field-reason"><span>কারণ</span><select class="ab-reason"><option value="">কারণ (ঐচ্ছিক)</option>${reasons.map((x) => `<option value="${esc(x)}"${c.reason === x ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></label>
        <label class="ab-field ab-field-note"><span>কথার নোট</span><input class="ab-note" placeholder="কী কথা হলো?" maxlength="300" value="${esc(c.note || "")}"></label>
        <label class="ab-fu-wrap"${c.status === "later" ? "" : " hidden"}><small>আবার ফোন করার তারিখ</small><input type="date" class="ab-fu" min="${today()}" value="${esc(c.followUp || addDays(today(), 1))}"></label>
        <div class="ab-save"><small class="ab-save-status" aria-live="polite"></small><button type="button" class="btn gold sm" data-call-save>সেভ করুন</button></div>
      </div>
    </div>`;
  };

  function render(host) {
    const sessions = DB().sessions.filter((x) => x.active !== false);
    if (!X.callDate && !S.session && !host.dataset.once) { S.session = (sessions[0] || {}).name || ""; host.dataset.once = "1"; }
    const batchOpts = () => DB().batches.filter((b) => b.active !== false && (!S.session || b.session === S.session));
    host.innerHTML = `<div class="card ab-ctl">
        <label>তারিখ<input type="date" id="abD" value="${esc(S.date)}" max="${today()}"></label>
        <label>সেশন<select id="abSe"><option value="">সব সেশন</option>${sessions.map((x) => `<option value="${esc(x.name)}"${x.name === S.session ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
        <label>ব্যাচ<select id="abBa"></select></label>
        <label class="ab-switch" title="যাদের সাথে কথা হয়ে গেছে, তাদের সারি তালিকা থেকে সরিয়ে রাখুন"><input type="checkbox" id="abHide"${S.hideDone ? " checked" : ""}><i class="ab-sw"></i><span>কথা হয়ে গেছে যাদের, লুকান</span></label>
      </div>
      <div class="ab-sum" id="abSum"></div>
      <div id="abNote"></div>
      <div id="abList"></div>`;
    const fillBatches = () => { $("#abBa").innerHTML = `<option value="">সব ব্যাচ</option>` + batchOpts().map((b) => `<option value="${esc(b.id)}"${b.id === S.batch ? " selected" : ""}>${esc(U.batchLabel(b))}</option>`).join(""); };
    const draw = () => {
      const fol = followRows(S.date), folKeys = new Set(fol.map((r) => r.key));
      const abs = [...absentRows(S.date), ...lastRows(S.date).filter((r) => !folKeys.has(r.key))]; // আজকের হাজিরা সেভ না হলে ব্যাচের সর্বশেষ হাজিরার অনুপস্থিতি
      const st = (r) => (calls()[r.key] || {}).status || "";
      const n = (f) => abs.filter((r) => st(r) === f).length, pend = abs.filter((r) => !st(r)).length;
      const box = (t, v, cls) => `<article class="${cls || ""}"><small>${t}</small><b>${bn(v)}</b></article>`;
      $("#abSum").innerHTML = box("মোট অনুপস্থিত", abs.length) + box("এখনো কল করা হয়নি", pend, pend ? "warn" : "") + box("কথা হয়েছে", n("talked"), "ok") + box("ফোন ধরেনি", n("noanswer"), n("noanswer") ? "bad" : "") + box("পরে ফোন করব", n("later")) + box("আগের ফলো-আপ", fol.length, fol.length ? "warn" : "");
      const un = unsavedBatches(S.date), withLast = [], without = [];
      for (const b of un) { const ld = lastSaved(b.id, S.date); (ld ? withLast : without).push({ b, ld }); }
      $("#abNote").innerHTML = (withLast.length ? `<p class="ab-info">ℹ ${U.date(S.date)} তারিখের হাজিরা এখনো সেভ হয়নি, তাই এই ব্যাচগুলোর <b>সর্বশেষ সেভ করা হাজিরার</b> অনুপস্থিতি দেখানো হচ্ছে: ${withLast.map(({ b, ld }) => `<b>${esc(b.name)}</b> (${esc(U.date(ld))})`).join(", ")}। আজকের হাজিরা সেভ করলে এখানে আজকের অনুপস্থিতিই আসবে।</p>` : "") + (without.length ? `<p class="ab-warn">⚠ এই ব্যাচগুলোর হাজিরা এখনো সেভ হয়নি (আগের কোনো হাজিরাও নেই), তাই এদের অনুপস্থিতি এখানে আসেনি: ${without.map(({ b }) => esc(b.name)).join(", ")}</p>` : "");
      const completed = S.hideDone ? [] : abs.filter((row) => st(row) === "talked");
      const order = { "": 0, noanswer: 1, later: 2, talked: 3 };
      const sorted = (list) => list.filter((row) => st(row) !== "talked").sort((a, b) => order[st(a)] - order[st(b)] || streakOf(b.s.id, S.date) - streakOf(a.s.id, S.date) || String(a.s.id).localeCompare(String(b.s.id)));
      const byBatch = new Map();
      for (const r of sorted(abs)) { const k = r.s.batchId; if (!byBatch.has(k)) byBatch.set(k, []); byBatch.get(k).push(r); }
      const batchOrder = [...byBatch.keys()].sort((a, b) => (DB().batches.findIndex((x) => x.id === a)) - (DB().batches.findIndex((x) => x.id === b)));
      let html = "";
      if (fol.length) html += `<h3 class="ab-batchhead">📌 আগের ফলো-আপ — আজ আবার ফোন করার কথা (${bn(fol.length)})</h3>` + sorted(fol).map(rowHtml).join("");
      html += batchOrder.map((k) => `<h3 class="ab-batchhead">${esc(X.batchName(k))} — ${bn(byBatch.get(k).length)} জন অনুপস্থিত${byBatch.get(k)[0].last ? ` <small class="ab-lastd">· সর্বশেষ হাজিরা: ${esc(U.date(byBatch.get(k)[0].date))}</small>` : ""}</h3>${byBatch.get(k).map(rowHtml).join("")}`).join("");
      if (completed.length) {
        html += `<h3 class="ab-batchhead">✓ কথা হয়েছে (${bn(completed.length)})</h3>` + completed.map(rowHtml).join("");
      }
      $("#abList").innerHTML = html || `<div class="card empty">${abs.length ? "সবার সাথে কথা হয়ে গেছে 🎉" : `${esc(U.date(S.date))} তারিখে কোনো অনুপস্থিত শিক্ষার্থী নেই (বা হাজিরা এখনো সেভ হয়নি)।`}</div>`;
      const badge = $("#attCallN"); if (badge) badge.textContent = pendingCount(today()) || "";
      drafts.restore(host);
    };
    fillBatches(); draw();
    $("#abD").onchange = (e) => { S.date = e.target.value || today(); draw(); };
    $("#abSe").onchange = (e) => { S.session = e.target.value; S.batch = ""; fillBatches(); draw(); };
    $("#abBa").onchange = (e) => { S.batch = e.target.value; draw(); };
    $("#abHide").onchange = (e) => { S.hideDone = e.target.checked; draw(); };

    const persist = async (row, status) => {
      const key = row.dataset.key;
      const body = { date: row.dataset.date, studentId: row.dataset.sid, status,
        reason: $(".ab-reason", row).value, note: $(".ab-note", row).value.trim(),
        followUp: status === "later" ? $(".ab-fu", row).value || addDays(today(), 1) : "" };
      if (status && body.reason === "আর পড়বে না") {
        body.stopStudying = true;
        body.status = "talked";
        body.followUp = "";
      }
      const r = await api("/api/admin/absence-call", { body });
      if (r.removed) delete calls()[key]; else calls()[key] = r.item;
      if (body.stopStudying && r.studentStatus === "inactive") {
        const student = DB().students.find((item) => item.id === body.studentId);
        if (student) { student.status = r.studentStatus; student.pauses = r.pauses || []; }
        toast("শিক্ষার্থীকে নিষ্ক্রিয় করা হয়েছে");
      }
    };
    // "আর পড়বে না" → পড়া বন্ধ (আজ / আগামী মাসের ১ তারিখ / অন্য তারিখ থেকে) আর কলের হিসাবে "কথা হয়েছে" লিখে রাখা
    const stopStudent = async (row) => {
      const panel = $(".ab-stop", row), sid = row.dataset.sid, s = DB().students.find((x) => x.id === sid);
      const pick = ($('input[type="radio"]:checked', panel) || {}).value || "today";
      const d = pick === "next" ? nextMonthFirst() : pick === "custom" ? $(".ab-stop-date", panel).value : today();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return toast("পড়া বন্ধের তারিখ বেছে নিন", true);
      const reason = $(".ab-stop-reason", panel).value.trim();
      const when = d > today() ? `${U.date(d)} থেকে পড়া বন্ধ হবে` : d === today() ? "আজ থেকে পড়া বন্ধ হবে" : `${U.date(d)} থেকে পড়া বন্ধ হবে`;
      if (!confirm(`"${s ? s.name : sid}" — ${when}।\n\nনিশ্চিত করবেন?`)) return;
      try {
        await api(`/api/admin/students/${encodeURIComponent(sid)}/pause`, { body: { date: d, reason } });
        const prevNote = $(".ab-note", row).value.trim();
        const r = await api("/api/admin/absence-call", { body: { date: row.dataset.date, studentId: sid, status: "talked", reason: "আর পড়বে না",
          note: `${prevNote ? prevNote + " · " : ""}পড়া বন্ধ — ${U.date(d)} থেকে`.slice(0, 300), followUp: "" } });
        calls()[row.dataset.key] = r.item;
        await X.load();
        render(host);
        toast(d > today() ? `${U.date(d)} থেকে পড়া বন্ধ হবে` : "পড়া বন্ধ রাখা হয়েছে");
      } catch (er) { toast(er.message, true); }
    };
    // "ব্যাচ বদল" → শিক্ষার্থীকে একই সেশনের অন্য ব্যাচে নেওয়া আর কলের হিসাবে লিখে রাখা
    const moveStudent = async (row) => {
      const panel = $(".ab-move", row), sid = row.dataset.sid, s = DB().students.find((x) => x.id === sid), to = $(".ab-move-to", panel).value;
      if (!s) return;
      if (!to) return toast("নতুন ব্যাচ বেছে নিন", true);
      const fromName = X.batchName(s.batchId), toName = X.batchName(to);
      if (!confirm(`"${s.name}"-কে ${fromName} থেকে ${toName} ব্যাচে নেবেন?`)) return;
      try {
        await X.save("students", { ...s, batchId: to }, sid);
        const prevNote = $(".ab-note", row).value.trim();
        const r = await api("/api/admin/absence-call", { body: { date: row.dataset.date, studentId: sid, status: "talked", reason: "অন্য ব্যাচে পড়ে",
          note: `${prevNote ? prevNote + " · " : ""}ব্যাচ বদল — ${fromName} থেকে ${toName}`.slice(0, 300), followUp: "" } });
        calls()[row.dataset.key] = r.item;
        await X.load();
        render(host);
        toast(`${s.name} এখন ${toName} ব্যাচে`);
      } catch (er) { toast(er.message, true); }
    };
    // "✉ SMS পাঠান" → সরাসরি BulkSMSBD দিয়ে অভিভাবকের মোবাইলে; আগে নম্বর আর বার্তা দেখিয়ে জিজ্ঞেস করে (ভুল চাপে টাকা কাটা ঠেকাতে)
    const smsGuardian = async (row, phone) => {
      const body = { kind: "absence", studentId: row.dataset.sid, date: row.dataset.date, phone };
      try {
        const pre = await api("/api/admin/call-sms", { body: { ...body, dry: true } });
        if (!pre.live) { if (confirm("SMS সার্ভিস চালু নেই (সেটআপ → সেটিংস)।\n\nতার বদলে ফোনের SMS অ্যাপে খুলবেন?")) location.href = `sms:${pre.phone}?body=${encodeURIComponent(pre.text)}`; return; }
        if (!confirm(`${bn(pre.phone)} নম্বরে এই SMS পাঠাবেন?\n\n${pre.text}${pre.already ? "\n\n⚠ আজ এই শিক্ষার্থীর অভিভাবককে আগেই SMS পাঠানো হয়েছে। তবুও আবার পাঠাবেন?" : ""}`)) return;
        await api("/api/admin/call-sms", { body: { ...body, force: !!pre.already } });
        toast(`${bn(pre.phone)} নম্বরে SMS পাঠানো হয়েছে`);
        await X.load(); render(host);
      } catch (er) { toast(er.message, true); }
    };
    const updateDueCall = (sid) => {
      const student = DB().students.find((s) => s.id === sid);
      if (!student || !(student.fees?.balance > 0)) return;
      const previous = DB().dueCalls?.[sid];
      const reasons = [...new Set([...window.SICDues.reasons, previous?.reason].filter(Boolean))];
      X.openForm({
        title: `বকেয়ার আপডেট — ${student.name}`,
        fields: [
          { name: "reason", label: "বকেয়ার কারণ", type: "select", wide: true, options: [["", "কারণ বাছুন (ঐচ্ছিক)"], ...reasons.map((reason) => [reason, reason])] },
          { name: "note", label: "অতিরিক্ত নোট (ঐচ্ছিক)", type: "textarea", rows: 2, wide: true },
        ],
        values: { reason: previous?.reason || "", note: previous?.note || "" },
        saveText: "কথা হয়েছে হিসেবে সেভ করুন",
        onSave: async ({ reason, note }) => {
          const result = await api("/api/admin/due-call", {
            body: { studentId: sid, status: "talked", reason, note },
          });
          (DB().dueCalls ||= {})[sid] = result.item;
          toast("বকেয়া কল তালিকায় কথা হয়েছে হিসেবে সেভ হয়েছে");
        },
      });
    };
    host.onclick = (e) => {
      const due = e.target.closest("[data-ab-due]");
      if (due) return updateDueCall(due.closest(".ab-row").dataset.sid);
      const who = e.target.closest("[data-who]");
      if (who) { SICContacts.pick(who.closest(".ab-row").dataset.key, Number(who.dataset.who)); draw(); return; }
      const smsBtn = e.target.closest("[data-sms]");
      if (smsBtn) return smsGuardian(smsBtn.closest(".ab-row"), smsBtn.dataset.phone);
      const moveBtn = e.target.closest("[data-abmove]");
      if (moveBtn) { const row = moveBtn.closest(".ab-row"), p = $(".ab-move", row), sp = $(".ab-stop", row); if (sp) sp.hidden = true; p.hidden = !p.hidden; return; }
      if (e.target.closest("[data-abmove-cancel]")) { $(".ab-move", e.target.closest(".ab-row")).hidden = true; return; }
      if (e.target.closest("[data-abmove-ok]")) return moveStudent(e.target.closest(".ab-row"));
      const stopBtn = e.target.closest("[data-abstop]");
      if (stopBtn) { const row = stopBtn.closest(".ab-row"), p = $(".ab-stop", row); $(".ab-move", row).hidden = true; p.hidden = !p.hidden; return; }
      if (e.target.closest("[data-abstop-cancel]")) { $(".ab-stop", e.target.closest(".ab-row")).hidden = true; return; }
      if (e.target.closest("[data-abstop-ok]")) return stopStudent(e.target.closest(".ab-row"));
      const saveButton = e.target.closest("[data-call-save]");
      if (saveButton) {
        const row = saveButton.closest(".ab-row");
        if ($(".ab-reason", row).value === "আর পড়বে না") drafts.remember(row, "talked");
        return drafts.save(row, persist, toast).then((saved) => {
          if (saved) { draw(); toast("কলের আপডেট সেভ হয়েছে"); }
        });
      }
      const button = e.target.closest("[data-abst]");
      if (!button) return;
      const row = button.closest(".ab-row");
      const current = drafts.get(row)?.status ?? row.dataset.savedStatus;
      drafts.remember(row, current === button.dataset.abst ? "" : button.dataset.abst);
    };
    host.oninput = (e) => {
      if (!e.target.matches(".ab-reason, .ab-note, .ab-fu, .ab-pd")) return;
      const row = e.target.closest(".ab-row");
      drafts.remember(row, drafts.get(row)?.status ?? row.dataset.savedStatus);
    };
    host.onchange = host.oninput;
  }
  // ট্যাবের লাল সংখ্যা: আজ কতজনকে এখনো কল করা হয়নি (ফিল্টার ছাড়া, সব সেশনে)
  render.pending = () => { const keep = [S.session, S.batch]; S.session = ""; S.batch = ""; const n = pendingCount(today()); [S.session, S.batch] = keep; return n; };
  return render;
};

window.SICAbsence.reasons = ["অসুস্থ", "বাইরে গেছে", "পারিবারিক কাজ", "স্কুল / কলেজের কাজ", "আগ্রহ কমে গেছে", "জানতেন না", "অন্য ব্যাচে পড়ে", "আর পড়বে না", "অন্যান্য"];
