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
  const REASONS = ["অসুস্থ", "বাইরে গেছে", "পারিবারিক কাজ", "স্কুল / কলেজের কাজ", "আগ্রহ কমে গেছে", "জানতেন না", "আর পড়বে না", "অন্যান্য"];
  const S = { date: today(), session: "", batch: "", hideDone: false };

  const calls = () => (DB().absenceCalls ||= {});
  const batchOf = (id) => DB().batches.find((b) => b.id === id);

  // অভিভাবকের নম্বর: প্রথমে অভিভাবক, তারপর বাবা, মা, শেষে শিক্ষার্থী নিজে (একই নম্বর একবার)
  const phones = (s) => {
    const out = [];
    const add = (label, v) => { const p = cleanPhone(v); if (/^01\d{9}$/.test(p) && !out.some((o) => o.p === p)) out.push({ label, p }); };
    add("অভিভাবক", s.guardianPhone); add("বাবা", s.fatherPhone); add("মা", s.motherPhone); add("শিক্ষার্থী", s.phone);
    return out;
  };
  const guardianName = (s) => s.guardianName || s.fatherName || s.motherName || "";

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
      if (key.split("|")[0] !== date) continue;
      for (const [sid, st] of Object.entries(marks)) {
        if (st !== "A" || seen.has(sid)) continue;
        const s = DB().students.find((x) => x.id === sid);
        if (!s || s.status === "inactive") continue;
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
      rows.push({ s, key, date: d, follow: true });
    }
    return rows;
  };
  const pendingCount = (date) => absentRows(date).filter((r) => !calls()[r.key]).length;
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

  const rowHtml = (r) => {
    const { s, key, date } = r, c = calls()[key] || {}, ph = phones(s), main = ph[0], gn = guardianName(s);
    const pending = (s.pauses || []).find((p) => !p.to && p.startPending); // সামনের তারিখে বন্ধ ঠিক করা আছে
    const uid = `${esc(s.id)}-${r.follow ? "f" : "a"}`;
    const streak = streakOf(s.id, date), mon = monthAbsent(s.id, date);
    const reasons = [...REASONS]; if (c.reason && !reasons.includes(c.reason)) reasons.push(c.reason);
    const msg = main ? msgFor(s, date) : "";
    return `<div class="ab-row${c.status === "talked" ? " done" : ""}${r.follow ? " fu" : ""}" data-key="${esc(key)}" data-sid="${esc(s.id)}" data-date="${esc(date)}">
      <div class="ab-top">
        <div class="ab-stu"><b>${esc(s.name)}</b><small>${esc(s.id)} · ${esc(X.batchName(s.batchId))}${r.follow ? ` · <span class="chip warn">ফলো-আপ — ${esc(U.date(date))}-এর অনুপস্থিতি</span>` : ""}</small>
          <small>${streak > 1 ? `<span class="chip bad">${bn(streak)} দিন টানা অনুপস্থিত</span> ` : ""}<span class="chip">এই মাসে ${bn(mon)} দিন অনুপস্থিত</span>${pending ? ` <span class="chip warn">⏸ ${esc(U.date(pending.from))} থেকে পড়া বন্ধ হবে</span>` : ""}</small></div>
        <div class="ab-guard">${main ? `<div><small>${esc(main.label)}${gn && main.label === "অভিভাবক" ? ` · ${esc(gn)}` : ""}</small><br><a class="ab-num" href="tel:${main.p}">${bn(main.p)}</a></div>
          <a class="ab-btn call" href="tel:${main.p}">📞 কল</a>
          <a class="ab-btn wa" target="_blank" rel="noopener" href="https://wa.me/88${main.p}?text=${encodeURIComponent(msg)}">🟢 WhatsApp</a>
          <a class="ab-btn" href="sms:${main.p}?body=${encodeURIComponent(msg)}">✉ SMS</a>`
          : `<span class="ab-warn">অভিভাবকের মোবাইল নম্বর নেই — শিক্ষার্থীর প্রোফাইলে নম্বর যোগ করুন</span>`}</div>
      </div>
      ${ph.length > 1 ? `<div class="ab-more"><small>অন্য নম্বর:</small> ${ph.slice(1).map((o) => `<a href="tel:${o.p}">${esc(o.label)} ${bn(o.p)}</a>`).join(" · ")}</div>` : ""}
      <div class="ab-st">${STATUS.map(([v, t, cls]) => `<button type="button" class="${cls}${c.status === v ? " on" : ""}" data-abst="${v}">${t}</button>`).join("")}${pending ? "" : `<button type="button" class="stop" data-abstop>⏸ আর পড়বে না</button>`}</div>
      ${pending ? "" : stopHtml(s, uid)}
      <div class="ab-note-row">
        <select class="ab-reason" aria-label="অনুপস্থিতির কারণ"><option value="">কারণ (ঐচ্ছিক)</option>${reasons.map((x) => `<option value="${esc(x)}"${c.reason === x ? " selected" : ""}>${esc(x)}</option>`).join("")}</select>
        <input class="ab-note" placeholder="নোট (ঐচ্ছিক) — কী কথা হলো" maxlength="300" value="${esc(c.note || "")}">
        <label class="ab-fu-wrap"${c.status === "later" ? "" : " hidden"}><small>আবার ফোন করার তারিখ</small><input type="date" class="ab-fu" min="${today()}" value="${esc(c.followUp || addDays(today(), 1))}"></label>
      </div>
    </div>`;
  };

  function render(host) {
    const sessions = DB().sessions.filter((x) => x.active !== false);
    if (!S.session && !host.dataset.once) { S.session = (sessions[0] || {}).name || ""; host.dataset.once = "1"; }
    const batchOpts = () => DB().batches.filter((b) => b.active !== false && (!S.session || b.session === S.session));
    host.innerHTML = `<div class="card ab-ctl">
        <label>তারিখ<input type="date" id="abD" value="${esc(S.date)}" max="${today()}"></label>
        <label>সেশন<select id="abSe"><option value="">সব সেশন</option>${sessions.map((x) => `<option value="${esc(x.name)}"${x.name === S.session ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
        <label>ব্যাচ<select id="abBa"></select></label>
        <label class="check"><input type="checkbox" id="abHide"${S.hideDone ? " checked" : ""}> কথা হয়ে গেছে যাদের, লুকান</label>
      </div>
      <div class="ab-sum" id="abSum"></div>
      <div id="abNote"></div>
      <div id="abList"></div>`;
    const fillBatches = () => { $("#abBa").innerHTML = `<option value="">সব ব্যাচ</option>` + batchOpts().map((b) => `<option value="${esc(b.id)}"${b.id === S.batch ? " selected" : ""}>${esc(U.batchLabel(b))}</option>`).join(""); };
    const draw = () => {
      const abs = absentRows(S.date), fol = followRows(S.date);
      const st = (r) => (calls()[r.key] || {}).status || "";
      const n = (f) => abs.filter((r) => st(r) === f).length, pend = abs.filter((r) => !st(r)).length;
      const box = (t, v, cls) => `<article class="${cls || ""}"><small>${t}</small><b>${bn(v)}</b></article>`;
      $("#abSum").innerHTML = box("মোট অনুপস্থিত", abs.length) + box("এখনো কল করা হয়নি", pend, pend ? "warn" : "") + box("কথা হয়েছে", n("talked"), "ok") + box("ফোন ধরেনি", n("noanswer"), n("noanswer") ? "bad" : "") + box("পরে ফোন করব", n("later")) + box("আগের ফলো-আপ", fol.length, fol.length ? "warn" : "");
      const un = unsavedBatches(S.date);
      $("#abNote").innerHTML = un.length ? `<p class="ab-warn">⚠ এই ব্যাচগুলোর হাজিরা এখনো সেভ হয়নি, তাই এদের অনুপস্থিতি এখানে আসেনি: ${un.map((b) => esc(b.name)).join(", ")}</p>` : "";
      const visible = (r) => !(S.hideDone && st(r) === "talked");
      const order = { "": 0, noanswer: 1, later: 2, talked: 3 };
      const sorted = (list) => list.filter(visible).sort((a, b) => order[st(a)] - order[st(b)] || streakOf(b.s.id, S.date) - streakOf(a.s.id, S.date) || String(a.s.id).localeCompare(String(b.s.id)));
      const byBatch = new Map();
      for (const r of sorted(abs)) { const k = r.s.batchId; if (!byBatch.has(k)) byBatch.set(k, []); byBatch.get(k).push(r); }
      const batchOrder = [...byBatch.keys()].sort((a, b) => (DB().batches.findIndex((x) => x.id === a)) - (DB().batches.findIndex((x) => x.id === b)));
      let html = "";
      if (fol.length) html += `<h3 class="ab-batchhead">📌 আগের ফলো-আপ — আজ আবার ফোন করার কথা (${bn(fol.length)})</h3>` + sorted(fol).map(rowHtml).join("");
      html += batchOrder.map((k) => `<h3 class="ab-batchhead">${esc(X.batchName(k))} — ${bn(byBatch.get(k).length)} জন অনুপস্থিত</h3>${byBatch.get(k).map(rowHtml).join("")}`).join("");
      $("#abList").innerHTML = html || `<div class="card empty">${abs.length ? "সবার সাথে কথা হয়ে গেছে 🎉" : `${esc(U.date(S.date))} তারিখে কোনো অনুপস্থিত শিক্ষার্থী নেই (বা হাজিরা এখনো সেভ হয়নি)।`}</div>`;
      const badge = $("#attCallN"); if (badge) badge.textContent = pendingCount(today()) || "";
    };
    fillBatches(); draw();
    $("#abD").onchange = (e) => { S.date = e.target.value || today(); draw(); };
    $("#abSe").onchange = (e) => { S.session = e.target.value; S.batch = ""; fillBatches(); draw(); };
    $("#abBa").onchange = (e) => { S.batch = e.target.value; draw(); };
    $("#abHide").onchange = (e) => { S.hideDone = e.target.checked; draw(); };

    const persist = async (row, status) => {
      const key = row.dataset.key, prev = calls()[key] || {};
      const body = { date: row.dataset.date, studentId: row.dataset.sid, status,
        reason: $(".ab-reason", row).value, note: $(".ab-note", row).value.trim(),
        followUp: status === "later" ? $(".ab-fu", row).value || addDays(today(), 1) : "" };
      try {
        const r = await api("/api/admin/absence-call", { body });
        if (r.removed) delete calls()[key]; else calls()[key] = r.item;
        draw();
      } catch (e) { toast(e.message, true); if (prev.status === undefined) delete calls()[key]; }
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
    host.onclick = (e) => {
      const stopBtn = e.target.closest("[data-abstop]");
      if (stopBtn) { const p = $(".ab-stop", stopBtn.closest(".ab-row")); p.hidden = !p.hidden; return; }
      if (e.target.closest("[data-abstop-cancel]")) { $(".ab-stop", e.target.closest(".ab-row")).hidden = true; return; }
      if (e.target.closest("[data-abstop-ok]")) return stopStudent(e.target.closest(".ab-row"));
      const b = e.target.closest("[data-abst]"); if (!b) return;
      const row = b.closest(".ab-row"), cur = (calls()[row.dataset.key] || {}).status;
      persist(row, cur === b.dataset.abst ? "" : b.dataset.abst);
    };
    host.onchange = (e) => {
      if (!e.target.matches(".ab-reason, .ab-note, .ab-fu")) return;
      const row = e.target.closest(".ab-row"), cur = (calls()[row.dataset.key] || {}).status;
      if (!cur) return toast("আগে কলের অবস্থা বাছুন, তারপর কারণ বা নোট সেভ হবে", true);
      persist(row, cur);
    };
  }
  // ট্যাবের লাল সংখ্যা: আজ কতজনকে এখনো কল করা হয়নি (ফিল্টার ছাড়া, সব সেশনে)
  render.pending = () => { const keep = [S.session, S.batch]; S.session = ""; S.batch = ""; const n = pendingCount(today()); [S.session, S.batch] = keep; return n; };
  return render;
};
