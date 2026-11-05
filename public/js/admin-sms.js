// অ্যাডমিন → SMS প্যানেল — ব্যাচ বা আইডি ধরে শিক্ষার্থী বাছা; নিজের লেখা বার্তা অথবা কোনো পরীক্ষার ফলাফল পাঠানো।
// লেখায় {নাম} {আইডি} {ব্যাচ} {সেশন} {প্রতিষ্ঠান} প্রত্যেকের নিজেরটা দিয়ে বদলায়। আগে তালিকায় দেখায় কে কোন নম্বরে ঠিক কী পাবে
// (নয়তো কেন বাদ), তারপর একজন একজন করে যায় — পরপর ৩ জনের না গেলে থামে (যেমন ব্যালেন্স শেষ)।
window.SICSms = function (X) {
  "use strict";
  const { $, $$, esc, bn, api, toast } = U;
  const DB = () => X.DB;
  const EC = window.ExamCalc;
  const TAGS = [["{নাম}", "নাম"], ["{আইডি}", "আইডি"], ["{ব্যাচ}", "ব্যাচ"], ["{সেশন}", "সেশন"], ["{প্রতিষ্ঠান}", "প্রতিষ্ঠান"]];
  const TEMPLATES = [
    ["ক্লাস বন্ধ", "প্রিয় {নাম}, আগামীকাল {ব্যাচ} ব্যাচের ক্লাস বন্ধ থাকবে। — Shahin Sir"],
    ["পরীক্ষার নোটিশ", "প্রিয় {নাম}, আগামী শনিবার {ব্যাচ} ব্যাচের সাপ্তাহিক পরীক্ষা হবে। প্রস্তুতি নিয়ে আসবে। — Shahin Sir"],
    ["অভিভাবক সভা", "সম্মানিত অভিভাবক, {নাম}-এর অগ্রগতি নিয়ে আলোচনার জন্য আগামী শুক্রবার বিকাল ৪টায় অভিভাবক সভায় আসার অনুরোধ রইল। — {প্রতিষ্ঠান}"],
    ["শুভেচ্ছা", "প্রিয় {নাম}, তোমার সাফল্যে আন্তরিক অভিনন্দন ও শুভকামনা। — Shahin Sir"],
    ["দাওয়াত", "প্রিয় {নাম}, আমাদের অনুষ্ঠানে তোমাকে সাদর আমন্ত্রণ। তারিখ: …, সময়: …, স্থান: …। — Shahin Sir"],
  ];
  const TO = [["both", "শিক্ষার্থী ও অভিভাবক দুজনকেই"], ["student", "শুধু শিক্ষার্থী"], ["guardian", "শুধু অভিভাবক"]];
  const S = { by: "batch", sess: "", batchIds: [], idsText: "", withOff: false, to: "both", mode: "custom", text: "", examType: "", examId: "", skipGot: true };
  let C = null, plan = null, unticked = new Set(), timer = 0, seq = 0, busy = false;

  // SMS-এর ভাগ: বাংলা (ইউনিকোড) ৭০ অক্ষরে ১টা, বড় হলে প্রতি ৬৭-তে ১টা; শুধু ইংরেজি ১৬০ / ১৫৩
  const parts = (t) => { const n = [...t].length, uni = /[^\x00-\x7f]/.test(t); return !n ? 0 : uni ? (n <= 70 ? 1 : Math.ceil(n / 67)) : n <= 160 ? 1 : Math.ceil(n / 153); };
  const sessions = () => X.liveSessions().map((s) => s.name);
  const sessBatches = () => (DB().batches || []).filter((b) => b.session === S.sess);
  const parseIds = () => [...new Set(S.idsText.replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d)).split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean))];
  // কাদের তালিকা চাওয়া হবে
  const wantIds = () => S.by === "achievers" ? (DB().achievers || []).map(a => a.id)
    : S.by === "ids" ? parseIds()
    : DB().students.filter((s) => S.batchIds.includes(s.batchId) && (S.withOff || s.status !== "inactive")).map((s) => s.id);
  const exams = () => [...DB().exams].filter((e) => Object.keys(e.published || {}).length).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const ready = () => (plan ? plan.rows.filter((r) => !r.skip && !unticked.has(r.id)) : []);
  const body = () => ({ audience: S.by, to: S.to, mode: S.mode, text: S.text, examId: S.examId, skipGot: S.skipGot });

  function render() {
    if (!C) return;
    if (!S.sess || !sessions().includes(S.sess)) S.sess = sessions()[0] || "";
    // ফলাফল: আগে পরীক্ষার ধরন (Weekly / Monthly …), তারপর সেই ধরনের পরীক্ষার নাম
    const bs = sessBatches(), allEx = exams(), types = [...new Set(allEx.map((e) => e.type))];
    if (S.examType && !types.includes(S.examType)) S.examType = "";
    const ex = allEx.filter((e) => !S.examType || e.type === S.examType);
    if (S.mode === "result" && !ex.some((e) => e.id === S.examId)) S.examId = (ex[0] || {}).id || "";
    C.innerHTML = `<div class="ex-page sms-page">
      <section class="ln-banner"><div><span class="eyebrow">শিক্ষার্থী ও অভিভাবক</span><h2>SMS প্যানেল</h2>
        <p>ব্যাচ বা আইডি দিয়ে শিক্ষার্থী বেছে নিজের লেখা বার্তা বা পরীক্ষার ফলাফল পাঠান। পাঠানোর আগে তালিকায় দেখবেন কে কোন নম্বরে ঠিক কী পাবে।</p>
        <div class="ln-nums" id="smsNums"></div></div>
        <span class="rs-btns"><button type="button" class="btn line" data-sms-bal>ব্যালেন্স দেখুন</button><a class="btn line" href="#settings">SMS সেটিংস</a></span></section>
      <p class="sms-off" id="smsOff" hidden>⚠ SMS সার্ভিস এখন বন্ধ — তালিকা দেখা যাবে, কিন্তু পাঠানো যাবে না। <a href="#settings">সেটআপ → সেটিংস</a> থেকে BulkSMSBD-এর API key আর Sender ID দিয়ে চালু করুন।</p>

      <div class="sms-grid">
        <section class="card"><h3>১. কাকে পাঠাবেন</h3>
          <div class="sms-tabs">${[["batch", "ব্যাচ অনুযায়ী"], ["ids", "আইডি দিয়ে"], ["achievers", "সফল শিক্ষার্থী"]].map(([k, t]) => `<button type="button" data-by="${k}" class="${S.by === k ? "on" : ""}">${t}</button>`).join("")}</div>
          ${S.by === "batch" ? `<label class="sms-f">সেশন<select data-sess>${X.opt(sessions().map((s) => [s, s]), S.sess)}</select></label>
            <div class="sms-f">ব্যাচ <small>(একাধিক বাছা যায়)</small>
              <div class="gl-chips sms-chips">${bs.length ? `<button type="button" data-allb class="${bs.length && bs.every((b) => S.batchIds.includes(b.id)) ? "on" : ""}">সব ব্যাচ</button>${bs.map((b) => `<button type="button" data-b="${esc(b.id)}" class="${S.batchIds.includes(b.id) ? "on" : ""}">${esc(b.name)} <i>${bn(DB().students.filter((s) => s.batchId === b.id && s.status !== "inactive").length)}</i></button>`).join("")}` : '<span class="muted">এই সেশনে কোনো ব্যাচ নেই</span>'}</div></div>
            <label class="sms-check"><input type="checkbox" data-off${S.withOff ? " checked" : ""}> "পড়া বন্ধ" শিক্ষার্থীদেরও রাখুন</label>`
          : S.by === "achievers" ? `<p>নম্বর দেওয়া সফল শিক্ষার্থীরা নিচের তালিকায় নির্বাচিত থাকবে।</p><a href="#achievers">মোবাইল নম্বর যোগ বা বদলান</a>`
          : `<label class="sms-f">শিক্ষার্থীর আইডি <small>কমা, স্পেস বা নতুন লাইনে আলাদা করে</small><textarea data-ids rows="4" placeholder="যেমন: 270001, 270002, 280005">${esc(S.idsText)}</textarea></label>`}
          ${S.by === "achievers" ? "" : `<label class="sms-f">কোন নম্বরে<select data-to>${X.opt(TO, S.to)}</select></label>`}
        </section>

        <section class="card"><h3>২. কী পাঠাবেন</h3>
          <div class="sms-tabs">${[["custom", "নিজের লেখা বার্তা"], ["result", "পরীক্ষার ফলাফল"]].filter(([key]) => S.by !== "achievers" || key === "custom").map(([k, t]) => `<button type="button" data-mode="${k}" class="${S.mode === k ? "on" : ""}">${t}</button>`).join("")}</div>
          ${S.mode === "custom" ? `<div class="sms-f">বার্তা
              <div class="sms-tags">${TAGS.map(([t, l]) => `<button type="button" data-tag="${t}" title="প্রত্যেকের নিজের ${l} বসবে">＋ ${l}</button>`).join("")}<span class="sms-tpl">নমুনা: ${TEMPLATES.map(([l], i) => (S.by === "achievers" ? i >= 3 : i < 3) ? `<button type="button" data-tpl="${i}">${l}</button>` : "").join("")}</span></div>
              <textarea data-text rows="6" maxlength="1000" placeholder="এখানে আপনার বার্তা লিখুন… যেমন: প্রিয় {নাম}, আগামীকাল ক্লাস বন্ধ থাকবে।">${esc(S.text)}</textarea>
              <small class="sms-count" id="smsCount"></small></div>`
          : `${allEx.length ? `<div class="sms-pair"><label class="sms-f">পরীক্ষা<select data-extype>${X.opt([["", "সব ধরনের পরীক্ষা"], ...types.map((t) => [t, EC.typeName(t)])], S.examType)}</select></label>
              <label class="sms-f">পরীক্ষার নাম<select data-exam>${X.opt(ex.map((e) => [e.id, `${e.title} — ${U.date(e.date)}`]), S.examId)}</select></label></div>
              <p class="bp-hint sms-pair-note">শুধু যেসব পরীক্ষার ফলাফল প্রকাশিত, সেগুলো দেখায়।</p>
              <label class="sms-check"><input type="checkbox" data-skipgot${S.skipGot ? " checked" : ""}> আগে এই ফলাফল পেয়েছে, তাদের আবার পাঠাবেন না</label>
              <p class="bp-hint">প্রত্যেকের নিজের নম্বর, পাস / ফেল আর মেধাক্রম যায়; অনুপস্থিত হলে সেটাই জানায়। নিচের তালিকায় প্রত্যেকের লেখা দেখা যাবে।</p>`
            : '<p class="empty">এখনো কোনো পরীক্ষার ফলাফল প্রকাশ হয়নি। "পরীক্ষা ও ফলাফল → ফলাফল ও মূল্যায়ন" থেকে আগে প্রকাশ করুন।</p>'}`}
          <div class="sms-preview" id="smsPrev"></div>
        </section>
      </div>

      <section class="card"><h3>৩. তালিকা যাচাই করে পাঠান <small class="ln-count" id="smsListN"></small></h3>
        <div id="smsList"><p class="empty">উপর থেকে শিক্ষার্থী বেছে নিন।</p></div>
        <div class="bp-foot sms-foot"><span id="smsSum">—</span><button type="button" class="btn gold" data-send disabled>📨 পাঠান</button></div>
      </section>

      <section class="card"><h3>সাম্প্রতিক SMS <small class="ln-count">এই প্যানেল আর ফলাফল থেকে পাঠানো — শেষ ৩০টি</small></h3>${historyHtml()}</section>
    </div>`;
    count(); refresh(0);
  }

  function historyHtml() {
    const log = [...(DB().smsLog || [])].filter((l) => ["Panel", "Result"].includes(l.filter)).sort((a, b) => String(b.at || b.date).localeCompare(String(a.at || a.date))).slice(0, 30);
    if (!log.length) return '<p class="empty">এখনো এখান থেকে কোনো SMS যায়নি।</p>';
    return `<div class="tbl-wrap"><table class="exam-entry-table"><thead><tr><th>সময়</th><th>ধরন</th><th>কাকে · কী</th><th>অবস্থা</th></tr></thead><tbody>${log.map((l) => `<tr><td style="white-space:nowrap">${l.at ? new Date(l.at).toLocaleString("bn-BD", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : U.date(l.date)}</td>
      <td><span class="chip">${l.filter === "Result" ? "ফলাফল" : "বার্তা"}</span></td><td class="sms-logt">${esc(l.text || "")}</td><td>${l.ok === false ? '<span class="chip bad">যায়নি</span>' : '<span class="chip ok">গেছে</span>'}</td></tr>`).join("")}</tbody></table></div>`;
  }

  // লেখার নিচে অক্ষর আর SMS-এর ভাগ (প্রথম জনের নাম বসানোর পরের লেখা ধরে); প্রথম জনের জন্য ঠিক কেমন দেখাবে
  function count() {
    const first = plan && plan.rows.find((r) => r.text);
    const el = $("#smsCount", C);
    if (el) { const t = (S.mode === "custom" && first && first.text) || S.text, n = [...t].length, p = parts(t); el.textContent = S.text.trim() ? `${bn(n)} অক্ষর · প্রতিজনে প্রায় ${bn(p)}টি SMS${/[^\x00-\x7f]/.test(t) ? " (বাংলা: ৭০ অক্ষরে ১টি, বড় হলে ৬৭-তে ১টি)" : " (ইংরেজি: ১৬০ অক্ষরে ১টি)"}` : ""; el.classList.toggle("warn", p > 2); }
    const pv = $("#smsPrev", C);
    if (pv) pv.innerHTML = first ? `<small>${esc(first.name)} যা পাবে:</small><p>${esc(first.text)}</p>` : "";
  }

  // তালিকা সার্ভার থেকে (লেখা বদলালে একটু থেমে)
  function refresh(delay = 350) {
    clearTimeout(timer);
    const my = ++seq;
    plan = null;
    drawList();
    timer = setTimeout(async () => {
      const ids = wantIds();
      if (!ids.length) { plan = null; drawList(); count(); return; }
      try { const r = await api("/api/admin/sms/plan", { body: { ids, ...body() } }); if (my !== seq) return; plan = r; drawList(); count(); }
      catch (e) { toast(e.message, true); }
    }, delay);
  }

  function drawList() {
    const box = $("#smsList", C); if (!box) return;
    const off = $("#smsOff", C); if (off) off.hidden = !plan || plan.live;
    const rows = plan ? plan.rows : [], ok = rows.filter((r) => !r.skip), go = ready();
    const nums = go.reduce((n, r) => n + r.phones.length, 0), sms = go.reduce((n, r) => n + r.phones.length * parts(r.text), 0);
    $("#smsListN", C).textContent = rows.length ? `${bn(rows.length)} জন` : "";
    $("#smsNums", C).innerHTML = `<span><b>${bn(go.length)}</b>জন পাবে</span><span><b>${bn(nums)}</b>মোবাইল নম্বর</span><span><b>${bn(sms)}</b>SMS (প্রায়)</span>`;
    $("#smsSum", C).innerHTML = go.length ? `<b>${bn(go.length)}</b> জন · <b>${bn(nums)}</b>টি নম্বর · প্রায় <b>${bn(sms)}</b>টি SMS-এর ব্যালেন্স কাটবে` : "পাঠানোর মতো কেউ বাছা হয়নি";
    $("[data-send]", C).disabled = busy || !go.length || !(plan && plan.live);
    if (!plan) { box.innerHTML = `<p class="empty">${S.by === "ids" ? "উপরে শিক্ষার্থীর আইডি লিখুন।" : "উপর থেকে এক বা একাধিক ব্যাচ বেছে নিন।"}</p>`; return; }
    const bad = plan.notFound.length ? `<p class="sms-miss">এই আইডিগুলো পাওয়া যায়নি: <b>${plan.notFound.map(esc).join(", ")}</b></p>` : "";
    if (!rows.length) { box.innerHTML = bad || '<p class="empty">কেউ নেই।</p>'; return; }
    const all = ok.length && ok.every((r) => !unticked.has(r.id));
    box.innerHTML = `${bad}<div class="tbl-wrap"><table class="exam-entry-table sms-tbl"><thead><tr><th><input type="checkbox" data-tickall${all ? " checked" : ""}${ok.length ? "" : " disabled"} title="সবাই"></th><th>আইডি</th><th>নাম</th><th>ব্যাচ</th><th>মোবাইল</th><th>যা যাবে</th></tr></thead><tbody>
      ${rows.map((r) => `<tr class="${r.skip ? "sms-skip" : unticked.has(r.id) ? "sms-un" : ""}"><td><input type="checkbox" data-tick="${esc(r.id)}"${!r.skip && !unticked.has(r.id) ? " checked" : ""}${r.skip ? " disabled" : ""}></td>
        <td>${esc(r.id)}</td><td><b>${esc(r.name)}</b>${r.off ? ' <span class="chip warn">পড়া বন্ধ</span>' : ""}</td><td>${esc(r.batch || X.batchName(r.batchId))}</td>
        <td class="sms-ph">${r.phones.map(esc).join("<br>") || "—"}</td>
        <td class="sms-txt">${r.skip ? `<span class="chip bad">বাদ: ${esc(r.skip)}</span>` : `${esc(r.text)} <small>${bn(parts(r.text))}টি SMS × ${bn(r.phones.length)}</small>`}</td></tr>`).join("")}</tbody></table></div>`;
  }

  async function sendAll(btn) {
    const go = ready();
    if (!go.length || busy) return;
    const nums = go.reduce((n, r) => n + r.phones.length, 0), sms = go.reduce((n, r) => n + r.phones.length * parts(r.text), 0);
    const what = S.mode === "result" ? `"${(DB().exams.find((e) => e.id === S.examId) || {}).title}" পরীক্ষার ফলাফল` : "আপনার লেখা বার্তা";
    if (!confirm(`${bn(go.length)} জনকে ${what} ${bn(nums)}টি নম্বরে যাবে — প্রায় ${bn(sms)}টি SMS-এর ব্যালেন্স কাটবে।\n\nপাঠাবেন?`)) return;
    const payload = body();
    busy = true; btn.disabled = true;
    const failed = []; let ok = 0, inRow = 0, why = "";
    for (const [i, r] of go.entries()) {
      btn.textContent = `পাঠানো হচ্ছে ${bn(i + 1)}/${bn(go.length)}…`;
      try { await api("/api/admin/sms/send", { body: { id: r.id, ...payload } }); ok++; inRow = 0; }
      catch (e) { failed.push(`${r.name} (${r.id})`); why = e.message; if (++inRow >= 3) break; }
    }
    busy = false;
    await X.load(); unticked.clear(); render();
    if (!failed.length) return toast(`${bn(ok)} জনের কাছে SMS গেছে`);
    const left = go.length - ok - failed.length;
    alert(`${bn(ok)} জনের কাছে গেছে, ${bn(failed.length)} জনের যায়নি${left ? `, ${bn(left)} জনকে পাঠানো হয়নি` : ""}।\n\nকারণ: ${why}\nযায়নি: ${failed.join(", ")}`);
  }

  function insertTag(tag) {
    const ta = $("[data-text]", C); if (!ta) return;
    const a = ta.selectionStart ?? ta.value.length, b = ta.selectionEnd ?? a;
    ta.value = ta.value.slice(0, a) + tag + ta.value.slice(b);
    ta.focus(); ta.selectionStart = ta.selectionEnd = a + tag.length;
    S.text = ta.value; count(); refresh();
  }

  function onClick(e) {
    const t = (s) => e.target.closest(s);
    let el;
    if ((el = t("[data-by]"))) { S.by = el.dataset.by; if (S.by === "achievers") S.mode = "custom"; unticked.clear(); plan = null; return render(); }
    if ((el = t("[data-mode]"))) { S.mode = el.dataset.mode; return render(); }
    if ((el = t("[data-allb]"))) { const ids = sessBatches().map((b) => b.id), on = ids.every((id) => S.batchIds.includes(id)); S.batchIds = on ? [] : ids; return render(); }
    if ((el = t("[data-b]"))) { const id = el.dataset.b; S.batchIds = S.batchIds.includes(id) ? S.batchIds.filter((x) => x !== id) : [...S.batchIds, id]; return render(); }
    if ((el = t("[data-tag]"))) return insertTag(el.dataset.tag);
    if ((el = t("[data-tpl]"))) { const ta = $("[data-text]", C); if (S.text.trim() && !confirm("লেখা বার্তাটা নমুনা দিয়ে বদলে যাবে। ঠিক আছে?")) return; S.text = TEMPLATES[+el.dataset.tpl][1]; if (ta) ta.value = S.text; count(); return refresh(0); }
    if ((el = t("[data-send]"))) return sendAll(el);
    if (t("[data-sms-bal]")) return api("/api/admin/sms-balance").then((r) => toast(`BulkSMSBD ব্যালেন্স: ${r.balance}`)).catch((er) => toast(er.message, true));
  }
  function onChange(e) {
    const d = e.target.dataset;
    if ("sess" in d) { S.sess = e.target.value; S.batchIds = []; plan = null; return render(); }
    if ("off" in d) { S.withOff = e.target.checked; return refresh(0); }
    if ("to" in d) { S.to = e.target.value; return refresh(0); }
    if ("extype" in d) { S.examType = e.target.value; S.examId = ""; return render(); }
    if ("exam" in d) { S.examId = e.target.value; return refresh(0); }
    if ("skipgot" in d) { S.skipGot = e.target.checked; return refresh(0); }
    if ("tickall" in d) { const ok = plan.rows.filter((r) => !r.skip); unticked = e.target.checked ? new Set() : new Set(ok.map((r) => r.id)); return drawList(); }
    if ("tick" in d) { if (e.target.checked) unticked.delete(d.tick); else unticked.add(d.tick); return drawList(); }
  }
  function onInput(e) {
    const d = e.target.dataset;
    if ("text" in d) { S.text = e.target.value; count(); return refresh(); }
    if ("ids" in d) { S.idsText = e.target.value; return refresh(); }
  }

  return function smsPage(c) { C = c; c.onclick = onClick; c.onchange = onChange; c.oninput = onInput; render(); };
};
