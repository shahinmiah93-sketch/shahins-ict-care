// অ্যাডমিন → ফি ও পেমেন্ট → "📞 বকেয়া কল তালিকা"
// যাদের ফি বকেয়া আছে, তাদের অভিভাবককে কল / WhatsApp / SMS করার তালিকা। প্রতিটা কলের পর অবস্থা
// (কথা হয়েছে / ধরেনি / পরে ফোন করব / টাকা দেওয়ার কথা দিয়েছেন), কারণ, নোট আর তারিখ জমা থাকে (db.dueCalls)।
// তালিকা থেকেই "💵 পেমেন্ট নিন" — টাকা এলে বকেয়া কমে শিক্ষার্থী নিজে থেকে তালিকা থেকে সরে যায়।
window.SICDues = function (X) {
  "use strict";
  const { $, $$, esc, bn, api, toast } = U;
  const DB = () => X.DB;
  const today = () => U.today();
  const money = (n) => U.money(n);
  const enNum = (s) => String(s || "").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d));
  const cleanPhone = (s) => enNum(s).replace(/\D/g, "").replace(/^88/, "");
  const addDays = (d, n) => { const x = new Date(d + "T00:00:00"); x.setDate(x.getDate() + n); return x.toLocaleDateString("en-CA"); };

  const STATUS = [["talked", "✅ কথা হয়েছে", "ok"], ["noanswer", "📵 ফোন ধরেনি / বন্ধ", "bad"], ["later", "🔁 পরে ফোন করব", "warn"], ["promised", "💰 টাকা দেওয়ার কথা দিয়েছেন", "ok"]];
  const ST_TX = Object.fromEntries(STATUS.map(([k, t]) => [k, t.replace(/^\S+\s/, "")]));
  const REASONS = ["টাকার সমস্যা", "পরে দেবেন", "ভুলে গিয়েছিলেন", "ফি নিয়ে আপত্তি", "ছেড়ে দিতে পারে", "জানতেন না", "অন্যান্য"];
  // ফি পাতা আবার আঁকা হলেও (যেমন পেমেন্টের পর) বাছাই করা ফিল্টার থেকে যায়
  const S = (window.__sicDuesState ||= { session: "", batch: "", q: "", need: false });

  const calls = () => (DB().dueCalls ||= {});
  const batchOf = (id) => DB().batches.find((b) => b.id === id);

  // কাকে কল করবেন (অভিভাবক · বাবা · মা · শিক্ষার্থী) — admin-contacts.js (SICContacts)
  const lastPay = (sid) => (DB().payments || []).filter((p) => p.studentId === sid).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.receiptNo).localeCompare(String(a.receiptNo)))[0];

  // কত জরুরি: ০ = টাকা দেওয়ার তারিখ পেরিয়ে গেছে · ১ = ফোন করার তারিখ এসেছে · ২ = এখনো কল হয়নি · ৩ = ধরেনি · ৪ = টাকা দেবে (সামনে) · ৫ = পরে ফোন (সামনে) · ৬ = কথা হয়েছে
  const priority = (sid) => {
    const c = calls()[sid], t = today();
    if (!c || !c.status) return 2;
    if (c.status === "promised" && c.promiseDate && c.promiseDate < t) return 0;
    if (c.status === "later" && (!c.followUp || c.followUp <= t)) return 1;
    if (c.status === "noanswer") return 3;
    if (c.status === "promised") return 4;
    if (c.status === "later") return 5;
    return 6;
  };
  const inScope = (s) => {
    const b = batchOf(s.batchId), q = S.q.trim().toLowerCase();
    return (!S.session || (b && b.session === S.session)) && (!S.batch || s.batchId === S.batch) && (!q || (s.id + " " + s.name).toLowerCase().includes(q));
  };
  const dueStudents = () => DB().students.filter((s) => s.status !== "inactive" && s.fees && s.fees.balance > 0);
  const msgFor = (s) => `আসসালামু আলাইকুম। ${DB().settings.name || "Shahin's ICT Care"} থেকে বলছি। ${s.name}-এর ফি বাবদ ${money(s.fees.balance).replace("৳", "")} টাকা বকেয়া আছে। অনুগ্রহ করে পরিশোধ করুন।`;

  // আজ এই শিক্ষার্থীর অভিভাবককে বকেয়ার SMS গেছে কি না — SMS খাতা (smsLog) থেকে
  const smsChip = (s) => ((DB().smsLog || []).some((l) => l.ok && l.date === today() && String(l.text || "").includes(`— ${s.id}`) && l.filter === "CallDue") ? ` <span class="chip ok">✉ আজ SMS গেছে</span>` : "");

  function absenceDates(student) {
    const now = today();
    const cutoff = addDays(now, -120);
    const absent = new Set(), present = new Set();
    for (const [key, marks] of Object.entries(DB().attendance || {})) {
      const [date, batchId] = key.split("|");
      if (date < cutoff || date > now) continue;
      if (marks[student.id] === "P") present.add(date);
      if (batchId === student.batchId && marks[student.id] === "A") absent.add(date);
    }
    return [...absent].filter((date) => !present.has(date)).sort().reverse();
  }

  const rowHtml = (s) => {
    const c = calls()[s.id] || {}, f = s.fees, pr = priority(s.id), t = today();
    const lp = lastPay(s.id), contact = SICContacts.html(s, s.id, msgFor(s), `<button type="button" class="ab-btn pay" data-dpay>💵 পেমেন্ট নিন</button>${absenceDates(s).length ? '<button type="button" class="ab-btn ab-cross-update" data-dc-absence>অনুপস্থিতির আপডেট</button>' : ""}`);
    const reasons = [...REASONS]; if (c.reason && !reasons.includes(c.reason)) reasons.push(c.reason);
    const promise = c.status === "promised" && c.promiseDate ? (c.promiseDate < t ? `<span class="chip bad">⚠ ${esc(U.date(c.promiseDate))}-এর মধ্যে দেওয়ার কথা ছিল, পেরিয়ে গেছে</span>` : `<span class="chip ok">💰 ${esc(U.date(c.promiseDate))}-এর মধ্যে দেবেন</span>`) : "";
    const follow = c.status === "later" && c.followUp ? (c.followUp <= t ? `<span class="chip warn">📌 আজ আবার ফোন করার কথা</span>` : `<span class="chip">🔁 ${esc(U.date(c.followUp))} আবার ফোন</span>`) : "";
    const last = c.at ? `<span class="chip" title="${esc(c.note || "")}">শেষ কল ${esc(U.date(c.at.slice(0, 10)))} — ${esc(ST_TX[c.status] || "")}</span>` : "";
    // কলের অবস্থার বাটন — নাম ও চিহ্নের ঠিক নিচে (ডানের যোগাযোগ কার্ডের পাশের ফাঁকা জায়গায়)
    const stBtns = `<div class="ab-st">${STATUS.map(([v, tx, cls]) => `<button type="button" class="${cls}${c.status === v ? " on" : ""}" data-dst="${v}">${tx}</button>`).join("")}</div>`;
    // কয়েকদিন টানা অনুপস্থিত থাকলে বকেয়ার পাশেই চিহ্ন (শেষ ১৪ দিনের হাজিরা ধরে) — কলের সময় অভিভাবককে এটাও বলা যায়
    const stk = SICContacts.streak(DB().attendance, s.id, t), absChip = stk.n > 1 && stk.last >= addDays(t, -14) ? `<span class="chip bad" title="শেষ হাজিরা ${esc(U.date(stk.last))}">${bn(stk.n)} দিন টানা অনুপস্থিত</span> ` : "";
    const log = (c.log || []).slice().reverse();
    return `<div class="ab-row${pr === 6 ? " done" : ""}${pr <= 1 ? " fu" : ""}" data-sid="${esc(s.id)}">
      <div class="ab-top">
        <div class="ab-stu"><b>${esc(s.name)}</b><small>${esc(s.id)} · ${esc(X.batchName(s.batchId))}</small>
          <small>${absChip}<span class="chip bad" title="মোট ফি ${esc(money(f.totalDue))} · জমা ${esc(money(f.paid))}">বকেয়া ${money(f.balance)}</span> <span class="chip">মোট ${money(f.totalDue)} · জমা ${money(f.paid)}</span>${f.discounts > 0 ? ` <span class="chip">ছাড় ${money(f.discounts)}</span>` : ""}${lp ? ` <span class="chip">শেষ পেমেন্ট ${esc(U.date(lp.date))} · ${money(lp.amount)}</span>` : ` <span class="chip warn">এখনো কোনো পেমেন্ট নেই</span>`}</small>
          <small>${promise}${follow}${last}${smsChip(s)}</small>${stBtns}</div>
        ${contact}
      </div>
      <div class="ab-note-row">
        <label class="ab-field ab-field-reason"><span>কারণ</span><select class="ab-reason"><option value="">কারণ (ঐচ্ছিক)</option>${reasons.map((x) => `<option value="${esc(x)}"${c.reason === x ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></label>
        <label class="ab-field ab-field-note"><span>কথার নোট</span><input class="ab-note" placeholder="কী কথা হলো?" maxlength="300" value="${esc(c.note || "")}"></label>
        <label class="ab-fu-wrap"${c.status === "later" ? "" : " hidden"}><small>আবার ফোন করার তারিখ</small><input type="date" class="ab-fu" min="${t}" value="${esc(c.followUp || addDays(t, 1))}"></label>
        <label class="ab-fu-wrap ab-pd-wrap"${c.status === "promised" ? "" : " hidden"}><small>কোন তারিখের মধ্যে দেবেন</small><input type="date" class="ab-pd" min="${t}" value="${esc(c.promiseDate || addDays(t, 3))}"></label>
      </div>
      ${log.length > 1 ? `<details class="ab-hist"><summary>কলের ইতিহাস (${bn(log.length)}টি)</summary><ul>${log.slice(0, 8).map((l) => `<li>${esc(U.date(String(l.at).slice(0, 10)))} — ${esc(ST_TX[l.status] || "")}${l.note ? ` · ${esc(l.note)}` : ""}</li>`).join("")}</ul></details>` : ""}
    </div>`;
  };

  function render(host) {
    const sessions = DB().sessions.filter((x) => x.active !== false);
    host.innerHTML = `<div class="card ab-ctl ab-ctl-dues">
        <label>সেশন<select id="dcSe"><option value="">সব সেশন</option>${sessions.map((x) => `<option value="${esc(x.name)}"${x.name === S.session ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
        <label>ব্যাচ<select id="dcBa"></select></label>
        <label>খুঁজুন<input id="dcQ" class="dc-q" placeholder="নাম বা আইডি" value="${esc(S.q)}"></label>
        <label class="ab-switch" title="যাদের কথা হয়ে গেছে বা টাকা দেওয়ার কথা দিয়েছেন, তাদের সরিয়ে শুধু যাদের এখন কল করা দরকার তাদের দেখান"><input type="checkbox" id="dcNeed"${S.need ? " checked" : ""}><i class="ab-sw"></i><span>শুধু যাদের এখন কল করা দরকার</span></label>
      </div>
      <div class="ab-sum" id="dcSum"></div>
      <div id="dcList"></div>`;
    const batchOpts = () => DB().batches.filter((b) => b.active !== false && (!S.session || b.session === S.session));
    const fillBatches = () => { $("#dcBa").innerHTML = `<option value="">সব ব্যাচ</option>` + batchOpts().map((b) => `<option value="${esc(b.id)}"${b.id === S.batch ? " selected" : ""}>${esc(U.batchLabel(b))}</option>`).join(""); };
    const draw = () => {
      const all = dueStudents().filter(inScope), st = (s) => (calls()[s.id] || {}).status || "";
      const total = all.reduce((t, s) => t + s.fees.balance, 0);
      const n = (f) => all.filter((s) => f(priority(s.id))).length;
      const box = (tx, v, cls, raw) => `<article class="${cls || ""}"><small>${tx}</small><b>${raw ? v : bn(v)}</b></article>`;
      $("#dcSum").innerHTML = box("মোট বকেয়া", money(total), total ? "bad" : "", true) + box("বকেয়া আছে", all.length) + box("কল করা হয়নি", n((p) => p === 2), n((p) => p === 2) ? "warn" : "") + box("টাকা দেওয়ার তারিখ পেরিয়েছে", n((p) => p === 0), n((p) => p === 0) ? "bad" : "") + box("আজ আবার ফোন", n((p) => p === 1), n((p) => p === 1) ? "warn" : "") + box("টাকা দেবেন বলেছেন", all.filter((s) => st(s) === "promised").length, "ok");
      const list = all.filter((s) => !S.need || priority(s.id) <= 3).sort((a, b) => priority(a.id) - priority(b.id) || b.fees.balance - a.fees.balance || String(a.id).localeCompare(String(b.id)));
      $("#dcList").innerHTML = list.map(rowHtml).join("") || `<div class="card empty">${all.length ? "এখন কাউকে কল করার দরকার নেই 🎉" : "কোনো বকেয়া নেই 🎉"}</div>`;
      // ওপরের ট্যাবের লাল সংখ্যা (ফি পাতার টুলবারে) — কল করার সাথে সাথে কমে
      const tab = document.querySelector('.toolbar a[href="#fees/calls"]');
      if (tab) { const n = render.pending(); let bd = tab.querySelector(".at-tabn"); if (!bd && n) { bd = document.createElement("span"); bd.className = "at-tabn"; tab.append(" ", bd); } if (bd) bd.textContent = n ? bn(n) : ""; }
    };
    fillBatches(); draw();
    $("#dcSe").onchange = (e) => { S.session = e.target.value; S.batch = ""; fillBatches(); draw(); };
    $("#dcBa").onchange = (e) => { S.batch = e.target.value; draw(); };
    $("#dcNeed").onchange = (e) => { S.need = e.target.checked; draw(); };
    $("#dcQ").oninput = (e) => { S.q = e.target.value; const pos = e.target.selectionStart; draw(); const q = $("#dcQ"); q.focus(); q.setSelectionRange(pos, pos); };

    const persist = async (row, status) => {
      const sid = row.dataset.sid, body = { studentId: sid, status, reason: $(".ab-reason", row).value, note: $(".ab-note", row).value.trim(),
        followUp: status === "later" ? $(".ab-fu", row).value || addDays(today(), 1) : "", promiseDate: status === "promised" ? $(".ab-pd", row).value || addDays(today(), 3) : "" };
      try {
        const r = await api("/api/admin/due-call", { body });
        if (r.removed) delete calls()[sid]; else calls()[sid] = r.item;
        draw();
      } catch (e) { toast(e.message, true); }
    };
    // "✉ SMS পাঠান" → সরাসরি BulkSMSBD দিয়ে অভিভাবকের মোবাইলে (বকেয়ার বার্তা); আগে নম্বর আর বার্তা দেখিয়ে জিজ্ঞেস করে
    const smsGuardian = async (row, phone) => {
      const body = { kind: "due", studentId: row.dataset.sid, phone };
      try {
        const pre = await api("/api/admin/call-sms", { body: { ...body, dry: true } });
        if (!pre.live) { if (confirm("SMS সার্ভিস চালু নেই (সেটআপ → সেটিংস)।\n\nতার বদলে ফোনের SMS অ্যাপে খুলবেন?")) location.href = `sms:${pre.phone}?body=${encodeURIComponent(pre.text)}`; return; }
        if (!confirm(`${bn(pre.phone)} নম্বরে এই SMS পাঠাবেন?\n\n${pre.text}${pre.already ? "\n\n⚠ আজ এই শিক্ষার্থীর অভিভাবককে আগেই বকেয়ার SMS পাঠানো হয়েছে। তবুও আবার পাঠাবেন?" : ""}`)) return;
        await api("/api/admin/call-sms", { body: { ...body, force: !!pre.already } });
        toast(`${bn(pre.phone)} নম্বরে SMS পাঠানো হয়েছে`);
        await X.load(); render(host);
      } catch (er) { toast(er.message, true); }
    };
    const updateAbsenceCall = (sid) => {
      const student = DB().students.find((s) => s.id === sid);
      if (!student) return;
      const dates = absenceDates(student);
      if (!dates.length) return toast("এই শিক্ষার্থীর সেভ করা অনুপস্থিতির তারিখ নেই", true);
      const saved = DB().absenceCalls || {};
      const preferred = dates.find((date) => saved[`${date}|${sid}`]?.status !== "talked") || dates[0];
      X.openForm({
        title: `অনুপস্থিতির আপডেট — ${student.name}`,
        fields: [
          { name: "date", label: "কোন দিনের অনুপস্থিতি?", type: "select", options: dates.map((date) => [date, U.date(date)]), required: true },
          { name: "note", label: "অনুপস্থিতি নিয়ে কী কথা হলো?", type: "textarea", wide: true },
        ],
        values: { date: preferred },
        saveText: "কথা হয়েছে হিসেবে সেভ করুন",
        onSave: async ({ date, note }) => {
          if (!absenceDates(student).includes(date)) throw new Error("সেভ করা অনুপস্থিতির তারিখ বেছে নিন");
          const key = `${date}|${sid}`;
          const previous = DB().absenceCalls?.[key];
          const result = await api("/api/admin/absence-call", {
            body: { studentId: sid, date, status: "talked", reason: previous?.reason || "", note: note || previous?.note || "" },
          });
          (DB().absenceCalls ||= {})[key] = result.item;
          toast("অনুপস্থিতি কল তালিকায় কথা হয়েছে হিসেবে সেভ হয়েছে");
        },
      });
    };
    host.onclick = (e) => {
      const absence = e.target.closest("[data-dc-absence]");
      if (absence) return updateAbsenceCall(absence.closest(".ab-row").dataset.sid);
      const who = e.target.closest("[data-who]");
      if (who) { SICContacts.pick(who.closest(".ab-row").dataset.sid, Number(who.dataset.who)); draw(); return; }
      const smsBtn = e.target.closest("[data-sms]");
      if (smsBtn) return smsGuardian(smsBtn.closest(".ab-row"), smsBtn.dataset.phone);
      const pay = e.target.closest("[data-dpay]");
      if (pay) return X.paymentForm(pay.closest(".ab-row").dataset.sid);
      const b = e.target.closest("[data-dst]"); if (!b) return;
      const row = b.closest(".ab-row"), cur = (calls()[row.dataset.sid] || {}).status;
      persist(row, cur === b.dataset.dst ? "" : b.dataset.dst);
    };
    host.onchange = (e) => {
      if (!e.target.matches(".ab-reason, .ab-note, .ab-fu, .ab-pd")) return;
      const row = e.target.closest(".ab-row"), cur = (calls()[row.dataset.sid] || {}).status;
      if (!cur) return toast("আগে কলের অবস্থা বাছুন, তারপর কারণ বা নোট সেভ হবে", true);
      persist(row, cur);
    };
  }
  // ট্যাবের লাল সংখ্যা: যাদের এখন কল করা দরকার (কল হয়নি, ফোন করার তারিখ এসেছে, বা টাকা দেওয়ার তারিখ পেরিয়েছে)
  render.pending = () => dueStudents().filter((s) => priority(s.id) <= 2).length;
  return render;
};
