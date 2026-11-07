// অ্যাডমিন → বাড়ির কাজ / পড়া (পরীক্ষা পেজের মতো গাঢ় প্যানেল)
//   কাজ দিন · সব কাজ · ✓ যাচাই · হিসাব
// কাজ দেওয়া যায় পুরো সেশনের সব ব্যাচকে (যেমন HSC-27 / HSC-28) অথবা নির্দিষ্ট ব্যাচকে (যেমন 28-A, 28-B)।
// যাচাই: করেছে / পেরেছে = ১ পয়েন্ট, করেনি / পারেনি = ০, অনুপস্থিত = হিসাবে ধরা হয় না। এই হিসাব পরীক্ষার মেধায় মেশে না।
window.SICHomework = function (X) {
  "use strict";
  const { $, $$, esc, bn, api, toast } = U;
  const DB = () => X.DB;
  const today = () => U.today();
  const KIND = { homework: ["বাড়ির কাজ", "#286fa3", "করেছে", "করেনি"], lesson: ["পড়া", "#9a6a12", "পেরেছে", "পারেনি"] };
  const pct = (x) => (x === null || x === undefined ? "—" : bn(Math.round(x)) + "%");
  const empty = (t) => `<div class="ln-empty">${t}</div>`;
  const dayParts = (d) => { const x = new Date(d + "T00:00:00"); return { day: bn(x.getDate()), mon: x.toLocaleDateString("bn-BD", { month: "long" }), wd: x.toLocaleDateString("bn-BD", { weekday: "long" }) }; };
  const daysTo = (d) => Math.round((new Date(d + "T00:00:00") - new Date(today() + "T00:00:00")) / 864e5);
  const addDays = (d, n) => { const x = new Date(d + "T00:00:00"); x.setDate(x.getDate() + n); return x.toLocaleDateString("en-CA"); };
  const kindChip = (k) => `<span class="ex-type" style="--k:${KIND[k][1]}">${KIND[k][0]}</span>`;

  const S = { tab: "list", f: { session: "", batch: "", kind: "" }, show: "all", checkId: "", form: null, month: "" };
  try { Object.assign(S.f, JSON.parse(localStorage.getItem("sicHwFilter") || "{}")); } catch {}
  S.f.kind = ""; // Start with both types visible, even after an older saved filter.
  const keepFilter = () => { try { localStorage.setItem("sicHwFilter", JSON.stringify(S.f)); } catch {} };
  let C = null, dirty = false;
  const drafts = {};

  const session = () => S.f.session || (X.liveSessions()[0] || {}).name || "";
  const batches = (sess) => DB().batches.filter((b) => b.session === (sess || session()));
  const hwById = (id) => DB().homework.find((h) => h.id === id);
  const whoText = (h) => ((h.batchIds || []).length ? h.batchIds.map(X.batchName).join(", ") : `${h.session} — সব ব্যাচ`);
  // কাজটা কোন শিক্ষার্থীদের জন্য
  const recipients = (h) => DB().students.filter((s) => s.status !== "inactive" && U.hwFor(h, s)).sort((a, b) => (a.batchId || "").localeCompare(b.batchId || "") || a.id.localeCompare(b.id));
  const list = () => DB().homework.filter((h) => h.session === session() && (!S.f.kind || h.kind === S.f.kind) && (!S.f.batch || !(h.batchIds || []).length || h.batchIds.includes(S.f.batch)))
    .sort((a, b) => (b.dueDate || b.givenDate || "").localeCompare(a.dueDate || a.givenDate || ""));
  function counts(h) {
    const r = recipients(h), c = h.checks || {};
    const done = r.filter((s) => c[s.id] === "done").length, not = r.filter((s) => c[s.id] === "not").length, absent = r.filter((s) => c[s.id] === "absent").length;
    return { total: r.length, done, not, absent, pending: r.length - done - not - absent };
  }
  const dueTag = (h) => {
    const d = h.dueDate; if (!d) return '<span class="ln-tag">তারিখ নেই</span>';
    const n = daysTo(d); return n === 0 ? '<span class="ln-tag today">আজ জমা</span>' : n === 1 ? '<span class="ln-tag next">আগামীকাল</span>' : n > 1 ? `<span class="ln-tag next">${bn(n)} দিন পর</span>` : '<span class="ln-tag done">সময় শেষ</span>';
  };

  // ================= পেজ =================
  function render() {
    if (!C) return;
    const all = DB().homework.filter((h) => h.session === session()), open = all.filter((h) => !h.dueDate || h.dueDate >= today());
    const toCheck = all.filter((h) => h.dueDate && h.dueDate <= today() && counts(h).pending > 0);
    const listLabel = S.f.kind === "lesson" ? "দেওয়া পড়া" : S.f.kind === "homework" ? "দেওয়া বাড়ির কাজ" : "দেওয়া কাজ ও পড়া";
    const tabs = [["list", listLabel, list().length], ["new", S.form && S.form.id ? "সম্পাদনা" : "নতুন দিন"], ["edit", "✎ বদলান"], ["check", "কে করেছে / পেরেছে", toCheck.length], ["stats", "শিক্ষার্থীদের হিসাব"]];
    C.innerHTML = `<div class="ex-page hw-page">
      <section class="hw-intro"><div><span class="eyebrow">ক্লাস ব্যবস্থাপনা</span><h2>বাড়ির কাজ ও ক্লাসের পড়া</h2><p>যা দিয়েছেন সব নিচে পাবেন। বাড়িতে লিখে আনার কাজ ও ক্লাসে শিখে আসার পড়া আলাদা করে দেখুন।</p></div><button type="button" class="btn gold" data-new>＋ কাজ / পড়া দিন</button></section>
      <div class="ln-tabs hw-nav">${tabs.map(([k,t,n]) => `<button type="button" data-tab="${k}" class="${S.tab === k ? "on" : ""}">${t}${n !== undefined ? ` <i>${bn(n)}</i>` : ""}</button>`).join("")}</div>
      ${S.tab === "new" ? "" : `<div class="hw-toolbar"><div class="hw-type-tabs" aria-label="তালিকায় দেখুন">${[["", "সব"], ["homework", "বাড়ির কাজ"], ["lesson", "ক্লাসের পড়া"]].map(([k,t]) => `<button type="button" data-kind="${k}" aria-pressed="${S.f.kind === k}" class="${S.f.kind === k ? "on" : ""}">${t}</button>`).join("")}</div>
      <div class="ln-filter"><label>সেশন<select data-f="session">${X.opt(DB().sessions.map((s) => [s.name, s.name]), session())}</select></label><label>ব্যাচ<select data-f="batch">${X.opt([["", "সব ব্যাচ"], ...batches().map((b) => [b.id, U.batchLabel(b)])], S.f.batch)}</select></label></div></div>`}
      ${({ new: formTab, list: listTab, edit: editTab, check: checkTab, stats: statsTab })[S.tab]()}</div>`;
  }

  // ================= কাজ দিন =================
  function blankForm(kind = "homework") { return { id: "", kind, subject: "ICT", chapter: "", title: "", details: "", givenDate: today(), dueDate: addDays(today(), 2), session: session(), scope: S.f.batch ? "batch" : "all", batchIds: S.f.batch ? [S.f.batch] : [] }; }
  function draftFor(kind) {
    return drafts[kind] ||= blankForm(kind);
  }
  function copyBatches(form) {
    const source = form.copyOf && hwById(form.copyOf);
    return batches(form.session).filter((b) => !source || source.session !== form.session ||
      (source.batchIds?.length && !source.batchIds.includes(b.id)));
  }
  function suggestCopyDate() {
    const form = S.form;
    if (!form.copyOf) return;
    const selected = copyBatches(form).filter((b) => form.batchIds.includes(b.id));
    const nextClass = (batch) => {
      const schedule = batchDayGroup(batch.days);
      if (schedule.startsWith("9")) return "";
      for (let offset = 1; offset <= 366; offset++) {
        const date = addDays(form.givenDate, offset);
        const weekday = new Date(date + "T00:00:00").getDay();
        if (schedule.includes(String((weekday + 1) % 7)) && !U.closureOn(DB().closures, batch.id, date)) return date;
      }
      return "";
    };
    const dates = new Set(form.givenDate ? selected.map(nextClass) : []);
    form.dueDate = dates.size === 1 ? [...dates][0] : "";
    form.mixedDates = dates.size > 1;
  }
  function formTab() {
    const F = (S.form ||= draftFor(S.f.kind || "homework")), bs = copyBatches(F), days = [...new Set(bs.map((b) => b.days).filter(Boolean))];
    const formTitle = F.copyOf ? "একই পড়া অন্য ব্যাচে দিন" : F.id ? `${KIND[F.kind][0]} বদলান` : `নতুন ${KIND[F.kind][0]} দিন`;
    return `<section class="card hw-form">
      <div class="hw-group-title">
        <div><h3>${formTitle}</h3><p>${F.copyOf ? "ব্যাচ বাছলে পরের ক্লাসের তারিখ বসবে। চাইলে তারিখ বদলাতে পারবেন।" : "আগে দেওয়া কাজ বা পড়া পাশের বাটন থেকে দেখুন।"}</p></div>
        <div class="hw-acts">
          ${F.id && F.kind === "lesson" ? copyButton(F) : ""}
          <button type="button" class="btn line sm" data-view-kind="homework">দেওয়া বাড়ির কাজ দেখুন</button>
          <button type="button" class="btn line sm" data-view-kind="lesson">দেওয়া পড়া দেখুন</button>
        </div>
      </div>
      ${F.id || F.copyOf ? `<div>${kindChip(F.kind)}</div>` : `<div class="hw-kinds" role="group" aria-label="ফর্মের ধরন">${Object.entries(KIND).map(([k, [t]]) => `<label class="hw-kind${F.kind === k ? " on" : ""}"><input type="radio" name="kind" value="${k}"${F.kind === k ? " checked" : ""}>${t}<small>${k === "homework" ? "লিখে / সমাধান করে আনবে" : "শিখে / প্রস্তুতি নিয়ে আসবে"}</small></label>`).join("")}</div>`}
      <div class="hw-grid">
        <label>বিষয়<input name="subject" value="${esc(F.subject)}" placeholder="যেমন: ICT"></label>
        <label>অধ্যায়<input name="chapter" value="${esc(F.chapter)}" placeholder="যেমন: অধ্যায় ৩.১ — সংখ্যা পদ্ধতি"></label>
        <label class="span2">টপিক *<input name="title" value="${esc(F.title)}" placeholder="${F.kind === "lesson" ? "যেমন: বাইনারি থেকে ডেসিমেল রূপান্তরের নিয়ম মুখস্থ" : "যেমন: অনুশীলনী ১–১০ সমাধান খাতায়"}" required></label>
        <label class="span2">বিস্তারিত (ঐচ্ছিক)<textarea name="details" rows="3" placeholder="পৃষ্ঠা নম্বর, প্রশ্ন নম্বর, নির্দেশনা…">${esc(F.details)}</textarea></label>
        <label>${F.kind === "lesson" ? "পড়া দেওয়ার তারিখ" : "দেওয়ার তারিখ"}<input type="date" name="givenDate" value="${esc(F.givenDate)}"></label>
        <label>${F.kind === "lesson" ? "পড়া নেওয়ার তারিখ" : "জমার তারিখ"}<input type="date" name="dueDate" value="${esc(F.dueDate)}"></label>
      </div>
      <div class="hw-who"><b>কাদের জন্য?</b>
        ${F.mixedDates ? '<p class="ex-sub">বাছা ব্যাচগুলোর পরের ক্লাসের তারিখ এক নয়। একই রুটিনের ব্যাচ একবারে দিন, অথবা সবার জন্য একটি তারিখ নিজে বাছুন।</p>' : ""}
        <div class="hw-scope"><label><span>সেশন</span><select name="session">${X.opt(DB().sessions.map((s) => [s.name, s.name]), F.session)}</select></label>
          ${F.copyOf ? "" : `<label class="hw-pill${F.scope === "all" ? " on" : ""}"><input type="radio" name="scope" value="all"${F.scope === "all" ? " checked" : ""}>পুরো ${esc(F.session)} — সব ব্যাচ</label>
          <label class="hw-pill${F.scope === "batch" ? " on" : ""}"><input type="radio" name="scope" value="batch"${F.scope === "batch" ? " checked" : ""}>নির্দিষ্ট ব্যাচ</label>`}</div>
        ${F.scope === "batch" ? `<div class="cl-quick">${days.map((d) => `<button type="button" class="btn sm line" data-qd="${esc(d)}">সব ${esc(d)}</button>`).join("")}<button type="button" class="btn sm line" data-qd="*">সব</button><button type="button" class="btn sm line" data-qd="">কোনোটা না</button></div>
          <div class="cl-batches">${bs.map((b) => `<label class="cl-b"><input type="checkbox" name="hb" value="${b.id}"${F.batchIds.includes(b.id) ? " checked" : ""}><span><b>${esc(b.name)}</b><small>${esc(b.days || "")} · ${esc(b.time || "")}</small></span></label>`).join("") || '<p class="ex-sub">এই সেশনে কোনো ব্যাচ নেই</p>'}</div>` : ""}
        <p class="ex-sub hw-count">${(() => { const h = { session: F.session, batchIds: F.scope === "batch" ? F.batchIds : [] }; return `মোট ${bn(recipients(h).length)} জন শিক্ষার্থী পাবে`; })()}</p></div>
      <div class="rs-act"><button type="button" class="btn gold" data-save-hw>${F.id ? "✓ সংরক্ষণ করুন" : F.kind === "lesson" ? "✓ পড়া দিন" : "✓ বাড়ির কাজ দিন"}</button>${F.id || F.copyOf ? '<button type="button" class="btn line" data-cancel-edit>বাতিল</button>' : '<button type="button" class="btn line" data-reset>খালি করুন</button>'}</div></section>`;
  }
  function readForm() {
    const F = S.form, q = (n) => $(`.hw-form [name="${n}"]`, C);
    for (const n of ["subject", "chapter", "title", "details", "givenDate", "dueDate"]) if (q(n)) F[n] = q(n).value;
    if (q("session")) F.session = q("session").value;
    F.batchIds = $$('.hw-form [name="hb"]:checked', C).map((x) => x.value);
  }
  async function saveForm() {
    readForm();
    const F = S.form;
    if (!F.title.trim()) { toast(F.kind === "lesson" ? "কোন পড়া — লিখুন" : "কী কাজ — লিখুন", true); return $('.hw-form [name="title"]', C).focus(); }
    if (F.scope === "batch" && !F.batchIds.length) return toast("অন্তত একটি ব্যাচ বেছে নিন", true);
    try {
      const body = { kind: F.kind, subject: F.subject.trim(), chapter: F.chapter.trim(), title: F.title.trim(), details: F.details.trim(), givenDate: F.givenDate, dueDate: F.dueDate, session: F.session, batchIds: F.scope === "batch" ? F.batchIds : [] };
      await X.save("homework", body, F.id || undefined);
      const who = whoText(body);
      if (drafts[F.kind] === F) delete drafts[F.kind];
      S.form = null; S.tab = "list"; S.show = "all"; S.f.kind = body.kind; S.f.batch = ""; S.f.session = body.session; keepFilter();
      await X.load(); render(); toast(`${F.id ? "সংরক্ষণ হয়েছে" : KIND[F.kind][0] + " দেওয়া হয়েছে"} — ${who}`);
    } catch (e) { toast(e.message, true); }
  }

  // ================= সব কাজ =================
  function topic(h) {
    return `<div class="hw-topic">
      ${h.subject ? `<span>বিষয় · ${esc(h.subject)}</span>` : ""}
      ${h.chapter ? `<span class="hw-chapter">অধ্যায় · ${esc(h.chapter)}</span>` : ""}
      <div class="hw-topic-title"><span>টপিক</span><b>${esc(h.title)}</b></div>
    </div>`;
  }
  function dates(h) {
    if (h.kind === "lesson") {
      return [h.givenDate && `পড়া দেওয়ার তারিখ ${U.dateWithWeekday(h.givenDate)}`, h.dueDate && `পড়া নেওয়ার তারিখ ${U.dateWithWeekday(h.dueDate)}`]
        .filter(Boolean).map(esc).join("<br>");
    }
    return [h.givenDate && `দেওয়া: ${U.date(h.givenDate)}`, h.dueDate && `জমার তারিখ: ${U.date(h.dueDate)}`]
      .filter(Boolean).map(esc).join(" · ");
  }
  function editTab() {
    const entries = list();
    return `<section class="card">
      <h3>কোন কাজ বা পড়া বদলাবেন?</h3>
      ${entries.length ? `<div class="tbl-wrap"><table class="exam-entry-table">
        <thead><tr><th scope="col">ধরন</th><th scope="col">টপিক</th><th scope="col">ব্যাচ</th><th scope="col">তারিখ</th><th scope="col">সম্পাদনা</th></tr></thead>
        <tbody>${entries.map((h) => `<tr>
          <td>${kindChip(h.kind)}</td>
          <td><b>${esc(h.title)}</b>${h.chapter ? `<small>${esc(h.chapter)}</small>` : ""}</td>
          <td>${esc(whoText(h))}</td>
          <td>${h.dueDate ? esc(U.date(h.dueDate)) : "—"}</td>
          <td><button type="button" class="btn line sm" data-edit="${esc(h.id)}" aria-label="বদলান: ${esc(h.title)}">✎ বদলান</button>${h.kind === "lesson" ? copyButton(h) : ""}</td>
        </tr>`).join("")}</tbody>
      </table></div>` : empty("এই বাছাইয়ে কোনো কাজ বা পড়া নেই।")}
    </section>`;
  }
  const copyButton = (h) => `<button type="button" class="btn line sm" data-copy-lesson="${esc(h.id)}">অন্য ব্যাচে দিন</button>`;
  function row(h) {
    const c = counts(h), d = h.dueDate ? dayParts(h.dueDate) : null;
    return `<div class="ln-row hw-row" style="--k:${KIND[h.kind][1]}"><span class="ln-date">${d ? `<b>${d.day}</b><small>${d.mon}</small>` : "<b>—</b>"}</span>
      <div class="ln-main">
        ${kindChip(h.kind)}
        ${topic(h)}
        ${h.details ? `<div class="ln-syl"><strong>নির্দেশনা</strong><div>${esc(h.details)}</div></div>` : ""}
        <small class="hw-meta">${dates(h)}</small>
        <small class="hw-wholine">${esc(whoText(h))} · ${bn(c.total)} জন</small>
      </div>
      <span class="ln-side"><span class="hw-status">${dueTag(h)}${c.done + c.not + c.absent ? `<span class="ln-tag done">✓ ${bn(c.done)}</span><span class="ln-tag" style="background:#fde3e8;color:#9b1c3c">✗ ${bn(c.not)}</span>${c.absent ? `<span class="ln-tag">অনু ${bn(c.absent)}</span>` : ""}` : ""}${c.pending && h.dueDate && h.dueDate <= today() ? `<span class="ln-tag today">যাচাই বাকি ${bn(c.pending)}</span>` : ""}
        </span><span class="hw-acts"><button type="button" class="btn gold sm" data-check="${h.id}">✓ যাচাই</button><button type="button" class="icon-btn" data-edit="${h.id}" title="বদলান" aria-label="কাজ বদলান">✎ বদলান</button>${h.kind === "lesson" ? copyButton(h) : ""}<button type="button" class="icon-btn" data-del="${h.id}" title="মুছুন" aria-label="কাজ মুছুন">✕ মুছুন</button></span></span></div>`;
  }
  function listTab() {
    const all = list(), open = all.filter((h) => !h.dueDate || h.dueDate >= today()).reverse(), past = all.filter((h) => h.dueDate && h.dueDate < today());
    const show = S.show === "past" ? past : S.show === "open" ? open : all;
    const group = (kind, title, hint) => { const items = show.filter(h => h.kind === kind); return `<section class="card hw-group" style="--k:${KIND[kind][1]}"><div class="hw-group-title"><div><h3>${title} <small class="ln-count">${bn(items.length)}টি</small></h3><p>${hint}</p></div><button type="button" class="btn line sm" data-add-kind="${kind}">＋ ${kind === "lesson" ? "পড়া দিন" : "কাজ দিন"}</button></div>${items.length ? `<div class="ln-list">${items.map(row).join("")}</div>` : empty("এই বাছাইয়ে কোনো " + title + " নেই।")}</section>`; };
    return `<div class="hw-list-heading"><h3>আপনার ${S.f.kind === "lesson" ? "দেওয়া পড়া" : S.f.kind === "homework" ? "দেওয়া বাড়ির কাজ" : "দেওয়া কাজ ও পড়া"}</h3><p>${esc(session())} · ${S.f.batch ? esc(X.batchName(S.f.batch)) : "সব ব্যাচ"} · মোট ${bn(all.length)}টি</p></div><div class="hw-period">${[["all","সব তারিখ",all.length],["open","চলমান ও সামনে",open.length],["past","আগের",past.length]].map(([k,t,n]) => `<button type="button" data-show="${k}" class="${S.show === k ? "on" : ""}">${t} <span>${bn(n)}</span></button>`).join("")}</div>
    ${!S.f.kind || S.f.kind === "homework" ? group("homework", "বাড়ির কাজ", "খাতায় লিখে বা সমাধান করে আনবে · যাচাই: করেছে / করেনি") : ""}
    ${!S.f.kind || S.f.kind === "lesson" ? group("lesson", "ক্লাসের পড়া", "শিখে বা প্রস্তুতি নিয়ে আসবে · যাচাই: পেরেছে / পারেনি") : ""}`;
  }

  // ================= ✓ যাচাই =================
  function attOn(date, s) { const m = (DB().attendance || {})[`${date}|${s.batchId}`]; return m ? m[s.id] || "" : ""; }
  function checkTab() {
    const all = list();
    if (!all.length) return `<section class="card">${empty("কোনো কাজ নেই — আগে কাজ দিন।")}</section>`;
    if (!all.some((h) => h.id === S.checkId)) S.checkId = (all.find((h) => h.dueDate && h.dueDate <= today() && counts(h).pending) || all.find((h) => h.dueDate && h.dueDate <= today()) || all[0]).id;
    const h = hwById(S.checkId), c = counts(h), [, , yes, no] = KIND[h.kind], studs = recipients(h).filter((s) => !S.f.batch || s.batchId === S.f.batch), ch = h.checks || {};
    const ATT = { P: ["উপস্থিত", "ok"], A: ["অনুপস্থিত", "bad"], L: ["ছুটি", "warn"] };
    return `<section class="card hw-check">
      <div class="ex-etop"><label class="grow">কোন কাজ যাচাই করবেন<select data-pick>${all.map((x) => `<option value="${x.id}"${x.id === h.id ? " selected" : ""}>${esc(`${x.dueDate ? U.date(x.dueDate) : "তারিখ নেই"} — ${x.kind === "lesson" ? "পড়া" : "বাড়ির কাজ"}: ${x.title} (${whoText(x)})`)}</option>`).join("")}</select></label></div>
      <div class="hw-check-topic">
        <div class="hw-status">${kindChip(h.kind)}${dueTag(h)}</div>
        ${topic(h)}
        ${h.details ? `<div class="ln-syl"><strong>নির্দেশনা</strong><div>${esc(h.details)}</div></div>` : ""}
        <small class="hw-meta">${dates(h)}</small><small class="hw-meta">${esc(whoText(h))}</small>
      </div>
      <div class="ex-rsum"><span><b>${bn(c.total)}</b>শিক্ষার্থী</span><span class="ok"><b>${bn(c.done)}</b>${yes}</span><span class="bad"><b>${bn(c.not)}</b>${no}</span><span><b>${bn(c.absent)}</b>অনুপস্থিত</span><span><b>${bn(c.pending)}</b>বাকি</span></div>
      <div class="ex-bulkbar"><span>প্রত্যেকের পাশে চাপ দিন · অনুপস্থিত হলে হিসাবে ধরা হয় না</span><span class="grow"></span><span class="ex-dirty" ${dirty ? "" : "hidden"}>● সেভ হয়নি</span>
        <button type="button" class="btn line sm" data-all="done">✓ সবাই ${yes}</button><button type="button" class="btn line sm" data-from-att>হাজিরা থেকে অনুপস্থিত / ছুটি</button><button type="button" class="btn line sm" data-all="">Clean</button><button type="button" class="btn gold" data-save-check>সংরক্ষণ করুন</button></div>
      <div class="tbl-wrap"><table class="exam-entry-table"><thead><tr><th>আইডি</th><th>শিক্ষার্থীর নাম</th><th>ব্যাচ</th><th>হাজিরা${h.dueDate ? `<small>${U.date(h.dueDate)}</small>` : ""}</th><th>অবস্থা</th></tr></thead><tbody>
      ${studs.map((s) => { const v = ch[s.id] || "", a = h.dueDate ? attOn(h.dueDate, s) : ""; return `<tr data-sid="${esc(s.id)}" data-v="${v}"><td><b>${esc(s.id)}</b></td><td>${esc(s.name)}</td><td>${esc(X.batchName(s.batchId))}</td><td>${a ? `<span class="chip ${ATT[a][1]}">${ATT[a][0]}</span>` : "—"}</td>
        <td><div class="hw-seg">${[["done", "" + yes, "ok"], ["not", "✗ " + no, "bad"], ["absent", "অনুপস্থিত", "abs"]].map(([k, t, cl]) => `<button type="button" data-set="${k}" class="${cl}${v === k ? " on" : ""}">${t}</button>`).join("")}</div></td></tr>`; }).join("") || '<tr><td colspan="5" class="empty">এই কাজের কোনো শিক্ষার্থী নেই</td></tr>'}</tbody></table></div></section>`;
  }
  function setRow(tr, v) { tr.dataset.v = v; $$("[data-set]", tr).forEach((b) => b.classList.toggle("on", b.dataset.set === v)); }
  function markDirty() { dirty = true; const f = $(".ex-dirty", C); if (f) f.hidden = false; }
  async function saveChecks() {
    const checks = {}; $$(".hw-check tr[data-sid]", C).forEach((tr) => (checks[tr.dataset.sid] = tr.dataset.v || ""));
    try { await api("/api/admin/homework-check", { body: { id: S.checkId, checks } }); dirty = false; await X.load(); render(); toast("যাচাই সংরক্ষণ হয়েছে"); } catch (e) { toast(e.message, true); }
  }

  // ================= হিসাব =================
  function statsTab() {
    const hw = DB().homework.filter((h) => h.session === session()), mo = S.month;
    const studs = DB().students.filter((s) => s.status !== "inactive" && s.session === session() && (!S.f.batch || s.batchId === S.f.batch)).sort((a, b) => a.id.localeCompare(b.id));
    const rows = studs.map((s) => { const h = U.hwRate(hw, s, "homework", mo), l = U.hwRate(hw, s, "lesson", mo); const pts = h.done + l.done, poss = h.done + h.not + l.done + l.not; return { s, h, l, pts, poss, all: poss ? (pts / poss) * 100 : null }; });
    const lv = (p) => (p === null ? ["—", ""] : p >= 80 ? ["খুব ভালো", "ok"] : p >= 60 ? ["ভালো", "ok"] : p >= 40 ? ["মাঝারি", "warn"] : ["দুর্বল", "bad"]);
    const months = [...new Set(hw.map((h) => (h.dueDate || h.givenDate || "").slice(0, 7)).filter(Boolean))].sort().reverse();
    const avg = (k) => { const v = rows.map((r) => r[k].pct ?? null).filter((x) => x !== null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    return `<div class="ln-months"><button type="button" data-month="" class="${!mo ? "on" : ""}">সব মাস</button>${months.map((m) => `<button type="button" data-month="${m}" class="${mo === m ? "on" : ""}">${U.month(m)}</button>`).join("")}</div>
      <div class="rs-tiles"><span><small>বাড়ির কাজের গড় হার</small><b>${pct(avg("h"))}</b></span><span><small>পড়া পারার গড় হার</small><b>${pct(avg("l"))}</b></span><span class="ok"><small>৮০%-এর বেশি</small><b>${bn(rows.filter((r) => r.all >= 80).length)}</b></span><span class="bad"><small>৪০%-এর কম</small><b>${bn(rows.filter((r) => r.all !== null && r.all < 40).length)}</b></span></div>
      <section class="card"><h3>শিক্ষার্থী অনুযায়ী হিসাব <small class="ln-count">${esc(S.f.batch ? "ব্যাচ " + X.batchName(S.f.batch) : session())}${mo ? " · " + U.month(mo) : ""} · করেছে = ১ পয়েন্ট, অনুপস্থিত গোনা হয় না</small></h3>
      <div class="tbl-wrap"><table class="exam-entry-table"><thead><tr><th>শিক্ষার্থী</th><th>ব্যাচ</th><th class="num">বাড়ির কাজ<small>করেছে / মোট</small></th><th class="num">হার</th><th class="num">পড়া<small>পেরেছে / মোট</small></th><th class="num">হার</th><th class="num">পয়েন্ট</th><th>অবস্থা</th></tr></thead><tbody>
      ${rows.map((r) => { const [t, k] = lv(r.all); return `<tr><td><b>${esc(r.s.name)}</b><small>${esc(r.s.id)}</small></td><td>${esc(X.batchName(r.s.batchId))}</td><td class="num">${bn(r.h.done)}/${bn(r.h.done + r.h.not)}${r.h.absent ? `<small>অনু ${bn(r.h.absent)}</small>` : ""}</td><td class="num"><b>${pct(r.h.pct)}</b></td><td class="num">${bn(r.l.done)}/${bn(r.l.done + r.l.not)}${r.l.absent ? `<small>অনু ${bn(r.l.absent)}</small>` : ""}</td><td class="num"><b>${pct(r.l.pct)}</b></td><td class="num">${bn(r.pts)}/${bn(r.poss)}</td><td>${k ? `<span class="chip ${k}">${t}</span>` : "—"}</td></tr>`; }).join("") || '<tr><td colspan="8" class="empty">কোনো শিক্ষার্থী নেই</td></tr>'}</tbody></table></div>
      <p class="ex-rule">হার = করেছে ÷ (করেছে + করেনি)। অনুপস্থিত দিনের কাজ হিসাবে ধরা হয় না, আর এই হিসাব পরীক্ষার মেধাক্রমে মেশে না। "ফলাফল ব্যবস্থাপনা → Performance"-এও দেখায়।</p></section>`;
  }

  // ================= ঘটনা =================
  const leaveOk = () => !dirty || confirm("যাচাই এখনো সেভ হয়নি। সেভ না করে চলে যাবেন?");
  function onClick(e) {
    const t = (s) => e.target.closest(s); let el;
    if ((el = t("[data-tab]"))) { if (!leaveOk()) return; dirty = false; if (S.tab === "new") readFormSafe(); S.tab = el.dataset.tab; return render(); }
    if ((el = t("[data-view-kind]"))) {
      readFormSafe();
      S.f.session = S.form.session;
      S.f.batch = "";
      S.f.kind = el.dataset.viewKind;
      S.show = "all";
      S.tab = "list";
      keepFilter();
      return render();
    }
    if ((el = t("[data-kind]"))) { if (!leaveOk()) return; readFormSafe(); dirty = false; S.f.kind = el.dataset.kind; keepFilter(); return render(); }
    if ((el = t("[data-add-kind]"))) { if (!leaveOk()) return; dirty = false; S.form = draftFor(el.dataset.addKind); S.tab = "new"; return render(); }
    if (t("[data-new]")) { if (!leaveOk()) return; dirty = false; S.form = draftFor(S.f.kind || "homework"); S.tab = "new"; render(); return $('.hw-form [name="title"]', C).focus(); }
    if ((el = t("[data-show]"))) { S.show = el.dataset.show; return render(); }
    if ((el = t("[data-month]"))) { S.month = el.dataset.month; return render(); }
    if ((el = t("[data-check]"))) { S.checkId = el.dataset.check; S.tab = "check"; return render(); }
    if ((el = t("[data-copy-lesson]"))) {
      const source = hwById(el.dataset.copyLesson);
      if (!source || source.kind !== "lesson") return;
      S.form = {
        ...blankForm("lesson"), copyOf: source.id, session: source.session,
        subject: source.subject || "", chapter: source.chapter || "", title: source.title, details: source.details || "",
        scope: "batch", batchIds: [], dueDate: "",
      };
      S.tab = "new";
      return render();
    }
    if ((el = t("[data-edit]"))) { const h = hwById(el.dataset.edit); S.form = { id: h.id, kind: h.kind, subject: h.subject || "", chapter: h.chapter || "", title: h.title, details: h.details || "", givenDate: h.givenDate || today(), dueDate: h.dueDate || "", session: h.session, scope: (h.batchIds || []).length ? "batch" : "all", batchIds: [...(h.batchIds || [])] }; S.tab = "new"; return render(); }
    if ((el = t("[data-del]"))) return X.remove("homework", el.dataset.del, "এই কাজ ও এর যাচাই");
    if (t("[data-save-hw]")) return saveForm();
    if (t("[data-reset]")) {
      const kind = S.form.kind;
      S.form = drafts[kind] = blankForm(kind);
      return render();
    }
    if (t("[data-cancel-edit]")) { S.form = null; S.tab = "list"; return render(); }
    if ((el = t("[data-qd]"))) { readForm(); const bs = copyBatches(S.form); S.form.batchIds = el.dataset.qd === "*" ? bs.map((b) => b.id) : el.dataset.qd === "" ? [] : [...new Set([...S.form.batchIds, ...bs.filter((b) => b.days === el.dataset.qd).map((b) => b.id)])]; suggestCopyDate(); return render(); }
    if ((el = t("[data-set]"))) { const tr = el.closest("tr"); setRow(tr, tr.dataset.v === el.dataset.set ? "" : el.dataset.set); return markDirty(); }
    if ((el = t("[data-all]"))) { $$(".hw-check tr[data-sid]", C).forEach((tr) => setRow(tr, el.dataset.all)); return markDirty(); }
    if (t("[data-from-att]")) {
      const h = hwById(S.checkId); if (!h.dueDate) return toast("এই কাজের তারিখ নেই", true);
      let n = 0; $$(".hw-check tr[data-sid]", C).forEach((tr) => { const s = X.studentById(tr.dataset.sid); if (s && ["A", "L"].includes(attOn(h.dueDate, s))) { setRow(tr, "absent"); n++; } }); // অনুপস্থিত বা ছুটি → হিসাবে ধরা হয় না
      toast(n ? `${bn(n)} জনকে অনুপস্থিত বসানো হয়েছে` : `${U.date(h.dueDate)}-এ কেউ অনুপস্থিত নেই (বা হাজিরা নেওয়া হয়নি)`); return n && markDirty();
    }
    if (t("[data-save-check]")) return saveChecks();
  }
  function readFormSafe() { if (S.form && $(".hw-form", C)) readForm(); }
  function onChange(e) {
    const el = e.target;
    if (el.dataset.f) { if (!leaveOk()) return render(); dirty = false; S.f[el.dataset.f] = el.value; if (el.dataset.f === "session") S.f.batch = ""; keepFilter(); return render(); }
    if (el.matches("[data-pick]")) { if (!leaveOk()) { el.value = S.checkId; return; } dirty = false; S.checkId = el.value; return render(); }
    if (el.closest(".hw-form")) {
      readForm();
      if (el.name === "kind" && !S.form.id) {
        S.form = draftFor(el.value);
        return render();
      }
      if (el.name === "scope") { S.form.scope = el.value; return render(); }
      if (el.name === "session") { S.form.batchIds = []; suggestCopyDate(); return render(); }
      if (S.form.copyOf && ["hb", "givenDate"].includes(el.name)) { suggestCopyDate(); return render(); }
      if (el.name === "hb") { const n = recipients({ session: S.form.session, batchIds: S.form.batchIds }).length; $(".hw-count", C).textContent = `মোট ${bn(n)} জন শিক্ষার্থী পাবে`; }
    }
  }
  addEventListener("beforeunload", (e) => { if (dirty && C && C.querySelector(".hw-page")) { e.preventDefault(); e.returnValue = ""; } });

  return function homeworkPage(c) {
    C = c; dirty = false;
    if (!S.f.session) S.f.session = session();
    c.onclick = onClick; c.onchange = onChange;
    render();
  };
};
