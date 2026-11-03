// অ্যাডমিন → সম্ভাব্য শিক্ষার্থী (Leads) — শুধু অ্যাডমিন দেখে
// সব উৎস এক তালিকায় (একই মোবাইল একবার): অনলাইন কুইজ, ভর্তির আগ্রহ ফর্ম (এ দুটো নিজে থেকে আসে),
// Talent Hunt, অফলাইন মার্কেটিং, ✎ হাতে যোগ (হাতে বা Excel/CSV থেকে)।
// ট্যাব: তালিকা · ফলো-আপ · ＋ যোগ · ↑ আমদানি · হিসাব · SMS খাতা
window.SICLeads = function (X) {
  "use strict";
  const { $, $$, esc, bn, api, toast } = U;
  const DB = () => X.DB;
  const today = () => U.today();
  const addDays = (d, n) => { const x = new Date(d + "T00:00:00"); x.setDate(x.getDate() + n); return x.toLocaleDateString("en-CA"); };
  const enNum = (s) => String(s || "").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d));
  const cleanPhone = (s) => enNum(s).replace(/\D/g, "").replace(/^88/, "");

  const STATUS = [["new", "নতুন", ""], ["contacted", "যোগাযোগ হয়েছে", ""], ["interested", "আগ্রহী", "ok"], ["followup", "ফলো-আপ", "warn"], ["admitted", "ভর্তি হয়েছে", "ok"], ["notinterested", "আগ্রহ নেই", "bad"], ["wrong", "ভুল নম্বর", "bad"], ["dnc", "যোগাযোগ করবেন না", "bad"]];
  const SOURCES = [["quiz", "অনলাইন কুইজ"], ["enquiry", "ভর্তির আগ্রহ ফর্ম"], ["talent", "Talent Hunt"], ["course", "অনলাইন কোর্স"], ["offline", "অফলাইন মার্কেটিং"], ["manual", "হাতে যোগ"]];
  const ST = Object.fromEntries(STATUS.map(([k, t, c]) => [k, [t, c]])), SRC = Object.fromEntries(SOURCES);
  const CLOSED = ["admitted", "notinterested", "wrong", "dnc"]; // এদের ফলো-আপ লাগে না
  const smsOk = (l) => l.smsConsent !== false && !["dnc", "wrong"].includes(l.status);

  const S = { tab: "list", f: { q: "", source: "", status: "", batch: "", campaign: "", sms: "" }, form: null, imp: null };
  let C = null;
  const leads = () => DB().leads || [];
  const byId = (id) => leads().find((l) => l.id === id);
  const campaigns = () => [...new Set(leads().flatMap((l) => (l.sources || []).map((s) => s.campaign)).filter(Boolean))].sort();
  const batches = () => [...new Set(leads().map((l) => l.batch).filter(Boolean))].sort();
  const due = () => leads().filter((l) => l.followUp && l.followUp <= today() && !CLOSED.includes(l.status)).sort((a, b) => a.followUp.localeCompare(b.followUp));

  function filtered() {
    const f = S.f, q = f.q.trim().toLowerCase();
    return leads().filter((l) => (!f.source || (l.sources || []).some((s) => s.type === f.source)) && (!f.status || l.status === f.status) && (!f.batch || l.batch === f.batch)
      && (!f.campaign || (l.sources || []).some((s) => s.campaign === f.campaign)) && (!f.sms || (f.sms === "yes" ? smsOk(l) : !smsOk(l)))
      && (!q || [l.leadNo, l.name, l.phone, l.guardianPhone, l.institution, l.location, l.course, l.remarks].join(" ").toLowerCase().includes(q)))
      .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  }
  const filterText = () => { const f = S.f, p = []; if (f.source) p.push(SRC[f.source]); if (f.status) p.push(ST[f.status][0]); if (f.batch) p.push(f.batch); if (f.campaign) p.push("ক্যাম্পেইন: " + f.campaign); if (f.sms) p.push(f.sms === "yes" ? "SMS দেওয়া যাবে" : "SMS দেওয়া যাবে না"); if (f.q) p.push(`"${f.q}"`); return p.join(" · ") || "সবাই"; };
  const srcChips = (l) => (l.sources || []).map((s) => `<span class="chip" title="${esc([U.date((s.at || "").slice(0, 10)), s.campaign, s.place, s.collectedBy && "সংগ্রহ: " + s.collectedBy, s.note].filter(Boolean).join(" · "))}">${esc(SRC[s.type] || s.type)}${s.campaign ? " · " + esc(s.campaign) : ""}</span>`).join(" ");
  const who = (l) => `<b>${esc(l.name || "(নাম নেই)")}</b><small><a href="tel:${esc(l.phone)}">${esc(l.phone)}</a> · <a target="_blank" rel="noopener" href="https://wa.me/88${esc(l.phone)}">WhatsApp</a>${l.guardianPhone ? ` · অভিভাবক ${esc(l.guardianPhone)}` : ""}${smsOk(l) ? "" : ' · <span style="color:#b4233c">SMS না</span>'}</small>`;

  // ================= তালিকা =================
  function listTab() {
    const f = S.f, rows = filtered();
    return `<section class="card"><div class="ld-filter">
        <label class="grow">খুঁজুন<input data-f="q" value="${esc(f.q)}" placeholder="নাম, মোবাইল, Lead ID, কলেজ, এলাকা…"></label>
        <label>উৎস<select data-f="source">${X.opt([["", "সব"], ...SOURCES], f.source)}</select></label>
        <label>অবস্থা<select data-f="status">${X.opt([["", "সব"], ...STATUS.map(([k, t]) => [k, t])], f.status)}</select></label>
        <label>ব্যাচ<select data-f="batch">${X.opt([["", "সব"], ...batches().map((b) => [b, b])], f.batch)}</select></label>
        <label>ক্যাম্পেইন<select data-f="campaign">${X.opt([["", "সব"], ...campaigns().map((c) => [c, c])], f.campaign)}</select></label>
        <label>SMS<select data-f="sms">${X.opt([["", "সব"], ["yes", "দেওয়া যাবে"], ["no", "দেওয়া যাবে না"]], f.sms)}</select></label></div>
      <div class="ld-bar"><b>${bn(rows.length)} জন</b><small>${esc(filterText())}</small><span class="grow"></span>
        <button type="button" class="btn line sm" data-copy>নম্বর কপি</button><button type="button" class="btn line sm" data-excel>↓ Excel</button><button type="button" class="btn line sm" data-sms-new>SMS খাতায় লিখুন</button></div>
      <div class="tbl-wrap"><table class="exam-entry-table ld-table"><thead><tr><th>Lead ID</th><th>শিক্ষার্থী</th><th>ব্যাচ / কলেজ / এলাকা</th><th>উৎস</th><th>অবস্থা</th><th>ফলো-আপ</th><th></th></tr></thead><tbody>
      ${rows.map((l) => `<tr data-id="${l.id}"><td><b>${esc(l.leadNo)}</b><small>${U.date((l.createdAt || "").slice(0, 10))}</small></td><td>${who(l)}</td>
        <td>${esc(l.batch || "—")}<small>${esc([l.institution, l.location].filter(Boolean).join(" · "))}${l.course ? `<br>আগ্রহ: ${esc(l.course)}` : ""}</small></td>
        <td class="ld-src">${srcChips(l)}</td>
        <td><select class="field" data-status="${l.id}">${X.opt(STATUS.map(([k, t]) => [k, t]), l.status)}</select>${l.remarks ? `<small title="${esc(l.remarks)}">${esc(l.remarks.slice(0, 60))}${l.remarks.length > 60 ? "…" : ""}</small>` : ""}</td>
        <td><input type="date" class="field" data-follow="${l.id}" value="${esc(l.followUp || "")}"${CLOSED.includes(l.status) ? " disabled" : ""}>${l.followUp && l.followUp < today() && !CLOSED.includes(l.status) ? '<small style="color:#b4233c">সময় পার হয়ে গেছে</small>' : ""}</td>
        <td class="num" style="white-space:nowrap">${l.status !== "admitted" ? `<button type="button" class="btn sm gold" data-admit="${l.id}">ভর্তি করুন</button> ` : l.studentId ? `<small>${esc(l.studentId)}</small> ` : ""}<button type="button" class="icon-btn" data-edit="${l.id}" title="বদলান">✎</button><button type="button" class="icon-btn" data-del="${l.id}" title="মুছুন">✕</button></td></tr>`).join("")
      || '<tr><td colspan="7" class="empty">কেউ নেই</td></tr>'}</tbody></table></div></section>`;
  }

  // ================= ফলো-আপ =================
  function followTab() {
    const list = due(), next = leads().filter((l) => l.followUp > today() && l.followUp <= addDays(today(), 7) && !CLOSED.includes(l.status)).sort((a, b) => a.followUp.localeCompare(b.followUp));
    const row = (l) => `<tr data-id="${l.id}"><td><b>${esc(l.leadNo)}</b></td><td>${who(l)}</td><td>${U.date(l.followUp)}${l.followUp < today() ? '<small style="color:#b4233c">পার হয়ে গেছে</small>' : ""}</td><td><span class="chip ${ST[l.status][1]}">${ST[l.status][0]}</span>${l.remarks ? `<small>${esc(l.remarks.slice(0, 80))}</small>` : ""}</td>
      <td class="num" style="white-space:nowrap"><button type="button" class="btn sm line" data-done="${l.id}" title="যোগাযোগ হয়েছে, ফলো-আপ সরান">✓ কথা হয়েছে</button> <button type="button" class="btn sm line" data-later="${l.id}">+৩ দিন</button> <button type="button" class="icon-btn" data-edit="${l.id}">✎</button></td></tr>`;
    return `<section class="card"><h3>আজ যাদের ফোন করতে হবে <small class="ln-count">${bn(list.length)} জন · আজ বা আগের তারিখের ফলো-আপ</small></h3>
      <div class="tbl-wrap"><table class="exam-entry-table ld-table"><thead><tr><th>Lead ID</th><th>শিক্ষার্থী</th><th>ফলো-আপ</th><th>অবস্থা</th><th></th></tr></thead><tbody>${list.map(row).join("") || '<tr><td colspan="5" class="empty">আজ কারো ফলো-আপ নেই </td></tr>'}</tbody></table></div></section>
      <section class="card" style="margin-top:14px"><h3>সামনের ৭ দিন <small class="ln-count">${bn(next.length)} জন</small></h3>
      <div class="tbl-wrap"><table class="exam-entry-table ld-table"><tbody>${next.map(row).join("") || '<tr><td class="empty">কেউ নেই</td></tr>'}</tbody></table></div></section>`;
  }

  // ================= ＋ যোগ / বদল =================
  const blank = () => ({ id: "", name: "", phone: "", guardianPhone: "", batch: "", institution: "", location: "", course: "ICT", status: "new", followUp: "", remarks: "", smsConsent: true, source: { type: "offline", campaign: "", place: "", collectedBy: "" } });
  function formTab() {
    const F = (S.form ||= blank()), sessions = (DB().sessions || []).map((s) => s.name);
    const inp = (k, label, ph = "", attrs = "") => `<label>${label}<input data-k="${k}" value="${esc(F[k] || "")}" placeholder="${esc(ph)}" ${attrs}></label>`;
    return `<section class="card"><h3>${F.id ? `✎ ${esc(F.leadNo)} — তথ্য বদলান` : "＋ নতুন সম্ভাব্য শিক্ষার্থী"}</h3>
      <div class="ld-grid">
        ${inp("name", "শিক্ষার্থীর নাম *")}${inp("phone", "মোবাইল *", "01XXXXXXXXX", 'inputmode="tel"')}${inp("guardianPhone", "অভিভাবকের মোবাইল", "01XXXXXXXXX", 'inputmode="tel"')}
        <label>ব্যাচ<input data-k="batch" list="ldBatches" value="${esc(F.batch)}" placeholder="যেমন: HSC-28"><datalist id="ldBatches">${[...new Set([...sessions, ...batches()])].map((b) => `<option value="${esc(b)}">`).join("")}</datalist></label>
        ${inp("institution", "কলেজ / স্কুল")}${inp("location", "এলাকা / উপজেলা")}${inp("course", "কোন কোর্সে আগ্রহী", "ICT")}
        <label>অবস্থা<select data-k="status">${X.opt(STATUS.map(([k, t]) => [k, t]), F.status)}</select></label>
        <label>আবার যোগাযোগের তারিখ<input type="date" data-k="followUp" value="${esc(F.followUp)}"></label>
        <label class="span2">নোট<textarea data-k="remarks" rows="2">${esc(F.remarks)}</textarea></label>
        <label class="ld-chk span2"><input type="checkbox" data-k="smsConsent"${F.smsConsent !== false ? " checked" : ""}> প্রচারমূলক SMS পাঠানোর সম্মতি আছে</label>
      </div>
      ${F.id ? `<p class="ex-sub" style="margin:10px 0 0">উৎস: ${srcChips(F)}</p>` : `<h4 style="margin:16px 0 8px">কোথা থেকে পাওয়া</h4><div class="ld-grid">
        <label>উৎস<select data-src="type">${X.opt(SOURCES.filter(([k]) => !["quiz", "enquiry", "course"].includes(k)), F.source.type)}</select></label>
        <label>ক্যাম্পেইনের নাম<input data-src="campaign" list="ldCamps" value="${esc(F.source.campaign)}" placeholder="যেমন: মাদারীপুর সরকারি কলেজ প্রচার"><datalist id="ldCamps">${campaigns().map((c) => `<option value="${esc(c)}">`).join("")}</datalist></label>
        <label>জায়গা<input data-src="place" value="${esc(F.source.place)}" placeholder="যেমন: কলেজ গেট"></label>
        <label>তথ্য সংগ্রহ করেছেন<input data-src="collectedBy" value="${esc(F.source.collectedBy)}" placeholder="যেমন: রাকিব"></label></div>`}
      <div class="rs-act" style="margin-top:14px"><button type="button" class="btn gold" data-save>✓ ${F.id ? "সংরক্ষণ করুন" : "যোগ করুন"}</button><button type="button" class="btn line" data-cancel>${F.id ? "বাতিল" : "খালি করুন"}</button></div></section>`;
  }
  function readForm() {
    const F = S.form; if (!F) return;
    $$("[data-k]", C).forEach((el) => { F[el.dataset.k] = el.type === "checkbox" ? el.checked : el.value; });
    $$("[data-src]", C).forEach((el) => { F.source[el.dataset.src] = el.value; });
  }
  async function saveForm() {
    readForm();
    const F = S.form, body = { ...F, phone: cleanPhone(F.phone), guardianPhone: cleanPhone(F.guardianPhone) };
    if (!body.name.trim()) return toast("নাম লিখুন", true);
    if (!/^01\d{9}$/.test(body.phone)) return toast("সঠিক মোবাইল নম্বর দিন (০১ দিয়ে শুরু, ১১ সংখ্যা)", true);
    try {
      const r = await X.save("leads", body, F.id || undefined);
      await X.load(); toast(F.id ? "সংরক্ষণ হয়েছে" : `যোগ হয়েছে — ${r.item.leadNo}`);
      S.form = F.id ? null : { ...blank(), source: { ...F.source } }; // নতুন যোগে উৎসের তথ্য থেকে যায় — পরপর অনেকজন লেখা সহজ
      if (F.id) S.tab = "list"; render();
    } catch (e) { toast(e.message, true); }
  }

  // ================= ↑ আমদানি (Excel / CSV) =================
  const HEAD = { name: ["নাম", "name", "student", "শিক্ষার্থী"], phone: ["মোবাইল", "phone", "mobile", "ফোন"], guardianPhone: ["অভিভাবক", "guardian", "parent"], batch: ["ব্যাচ", "batch", "class", "শ্রেণি", "hsc"], institution: ["কলেজ", "স্কুল", "প্রতিষ্ঠান", "institution", "college", "school"], location: ["এলাকা", "location", "area", "ঠিকানা", "উপজেলা"], course: ["কোর্স", "course", "আগ্রহ"], remarks: ["নোট", "remarks", "note", "মন্তব্য"] };
  function parseTable(text) {
    const lines = String(text || "").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return { rows: [], cols: {} };
    const delim = lines[0].includes("\t") ? "\t" : ",";
    const split = (line) => { if (delim === "\t") return line.split("\t"); const out = []; let cur = "", q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; } else if (ch === '"') q = true; else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out; };
    const head = split(lines[0]).map((h) => h.trim().toLowerCase()), cols = {};
    for (const [k, names] of Object.entries(HEAD)) { const i = head.findIndex((h) => names.some((n) => h.includes(n.toLowerCase()))); if (i >= 0 && !Object.values(cols).includes(i)) cols[k] = i; }
    const rows = lines.slice(1).map(split).map((c) => Object.fromEntries(Object.entries(cols).map(([k, i]) => [k, (c[i] || "").trim()]))).filter((r) => Object.values(r).some(Boolean));
    return { rows, cols };
  }
  function importTab() {
    const I = (S.imp ||= { text: "", source: { type: "offline", campaign: "", place: "", collectedBy: "" }, consent: true, result: null });
    const p = parseTable(I.text), good = p.rows.filter((r) => r.name && /^01\d{9}$/.test(cleanPhone(r.phone))).length;
    return `<section class="card"><h3>↑ একসাথে অনেকজন আমদানি <small class="ln-count">Excel থেকে কপি-পেস্ট, অথবা CSV ফাইল</small></h3>
      <p class="ex-sub">Excel-এ প্রথম সারিতে কলামের নাম রাখুন — <b>নাম, মোবাইল, অভিভাবক, ব্যাচ, কলেজ, এলাকা, কোর্স, নোট</b> (যেকোনো ক্রমে; নাম আর মোবাইল লাগবেই)। তারপর পুরো টেবিল সিলেক্ট করে কপি করে নিচে পেস্ট করুন, অথবা Excel থেকে "Save As → CSV" করে ফাইলটা দিন। <a href="#" data-template>↓ নমুনা ফাইল</a></p>
      <div class="ld-grid"><label class="span2">পেস্ট করুন<textarea data-imp-text rows="6" placeholder="নাম	মোবাইল	কলেজ&#10;রাফি	01711000000	সরকারি কলেজ">${esc(I.text)}</textarea></label>
        <label>অথবা CSV ফাইল<input type="file" accept=".csv,text/csv,.txt" data-imp-file></label></div>
      ${p.rows.length ? `<p class="ld-prev">পাওয়া গেছে: <b>${bn(p.rows.length)}</b> সারি · ঠিক আছে <b>${bn(good)}</b>${p.rows.length - good ? ` · <span style="color:#b4233c">নাম বা মোবাইল ঠিক নেই ${bn(p.rows.length - good)}</span>` : ""} · চেনা কলাম: ${Object.keys(p.cols).map((k) => esc(HEAD[k][0])).join(", ") || "—"}</p>
        <div class="tbl-wrap" style="max-height:220px"><table class="exam-entry-table"><thead><tr>${Object.keys(p.cols).map((k) => `<th>${esc(HEAD[k][0])}</th>`).join("")}</tr></thead><tbody>${p.rows.slice(0, 8).map((r) => `<tr>${Object.keys(p.cols).map((k) => `<td>${esc(r[k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : ""}
      <h4 style="margin:16px 0 8px">সবার উৎস</h4><div class="ld-grid">
        <label>উৎস<select data-isrc="type">${X.opt(SOURCES.filter(([k]) => !["quiz", "enquiry", "course"].includes(k)), I.source.type)}</select></label>
        <label>ক্যাম্পেইনের নাম<input data-isrc="campaign" list="ldCamps2" value="${esc(I.source.campaign)}"><datalist id="ldCamps2">${campaigns().map((c) => `<option value="${esc(c)}">`).join("")}</datalist></label>
        <label>জায়গা<input data-isrc="place" value="${esc(I.source.place)}"></label><label>তথ্য সংগ্রহ করেছেন<input data-isrc="collectedBy" value="${esc(I.source.collectedBy)}"></label>
        <label class="ld-chk span2"><input type="checkbox" data-imp-consent${I.consent ? " checked" : ""}> এদের SMS পাঠানোর সম্মতি নেওয়া হয়েছে</label></div>
      <div class="rs-act" style="margin-top:14px"><button type="button" class="btn gold" data-import${good ? "" : " disabled"}>↑ ${bn(good)} জন আমদানি করুন</button></div>
      ${I.result ? `<p class="ld-prev ok">✓ নতুন যোগ হয়েছে ${bn(I.result.added)} জন · আগে থেকে ছিল (উৎস যোগ হয়েছে) ${bn(I.result.merged)} জন${I.result.bad.length ? ` · বাদ গেছে ${bn(I.result.bad.length)}টি সারি (নাম / মোবাইল ঠিক নেই)` : ""}</p>` : ""}</section>`;
  }
  function readImp() {
    const I = S.imp; if (!I) return;
    const t = $("[data-imp-text]", C); if (t) I.text = t.value;
    $$("[data-isrc]", C).forEach((el) => { I.source[el.dataset.isrc] = el.value; });
    const c = $("[data-imp-consent]", C); if (c) I.consent = c.checked;
  }
  async function doImport() {
    readImp();
    const I = S.imp, rows = parseTable(I.text).rows.map((r) => ({ ...r, phone: cleanPhone(r.phone), guardianPhone: cleanPhone(r.guardianPhone) }));
    try { const r = await api("/api/admin/leads/import", { body: { rows, source: I.source, smsConsent: I.consent } }); await X.load(); S.imp = { ...I, text: "", result: r }; render(); toast(`আমদানি হয়েছে — নতুন ${bn(r.added)}, আগের ${bn(r.merged)}`); }
    catch (e) { toast(e.message, true); }
  }

  // ================= হিসাব =================
  function statsTab() {
    const L = leads(), adm = (l) => l.status === "admitted", pct = (a, b) => (b ? bn(Math.round((a / b) * 100)) + "%" : "—");
    const table = (title, groups) => `<section class="card"><h3>${title}</h3><div class="tbl-wrap"><table class="exam-entry-table"><thead><tr><th></th><th class="num">মোট</th><th class="num">ভর্তি হয়েছে</th><th class="num">ভর্তির হার</th></tr></thead><tbody>
      ${groups.map(([t, list]) => `<tr><td><b>${esc(t)}</b></td><td class="num">${bn(list.length)}</td><td class="num">${bn(list.filter(adm).length)}</td><td class="num">${pct(list.filter(adm).length, list.length)}</td></tr>`).join("") || '<tr><td colspan="4" class="empty">তথ্য নেই</td></tr>'}</tbody></table></div></section>`;
    return `<div class="ld-stats">
      ${table("উৎস অনুযায়ী", SOURCES.map(([k, t]) => [t, L.filter((l) => (l.sources || []).some((s) => s.type === k))]).filter(([, l]) => l.length))}
      <section class="card"><h3>অবস্থা অনুযায়ী</h3><div class="ld-bars">${STATUS.map(([k, t]) => { const n = L.filter((l) => l.status === k).length; return `<div><span>${t}</span><i style="width:${L.length ? (n / L.length) * 100 : 0}%"></i><b>${bn(n)}</b></div>`; }).join("")}</div></section>
      ${table("ক্যাম্পেইন অনুযায়ী", campaigns().map((c) => [c, L.filter((l) => (l.sources || []).some((s) => s.campaign === c))]))}
      ${table("ব্যাচ অনুযায়ী", batches().map((b) => [b, L.filter((l) => l.batch === b)]))}</div>`;
  }

  // ================= SMS খাতা =================
  function smsTab() {
    const log = [...(DB().smsLog || [])].sort((a, b) => String(b.date + b.createdAt).localeCompare(String(a.date + a.createdAt)));
    return `<section class="card"><h3>SMS খাতা <small class="ln-count">কাকে কবে কী SMS পাঠানো হয়েছে</small></h3>
      <p class="ex-sub">সত্যিকারের SMS পাঠাতে কোনো SMS সার্ভিসের অ্যাকাউন্ট লাগে। এখন: তালিকা ট্যাবে ফিল্টার করে "নম্বর কপি" চাপুন (যোগাযোগ করবেন না, ভুল নম্বর আর সম্মতি নেই — এরা বাদ যায়) → SMS সার্ভিসে পেস্ট করে পাঠান → এখানে খাতায় লিখে রাখুন।</p>
      <div class="rs-act"><button type="button" class="btn gold sm" data-sms-new>＋ খাতায় লিখুন (তালিকার এখনকার ফিল্টার দিয়ে)</button></div>
      <div class="tbl-wrap" style="margin-top:12px"><table class="exam-entry-table"><thead><tr><th>তারিখ</th><th>লেখা</th><th>কাদের</th><th class="num">কতজন</th><th>কোন সার্ভিস</th><th></th></tr></thead><tbody>
      ${log.map((s) => `<tr><td>${U.date(s.date)}</td><td style="max-width:360px">${esc(s.text)}</td><td><small>${esc(s.filter)}</small></td><td class="num">${bn(s.count)}</td><td>${esc(s.via || "—")}</td><td><button type="button" class="icon-btn" data-sms-del="${s.id}">✕</button></td></tr>`).join("") || '<tr><td colspan="6" class="empty">এখনো কিছু লেখা হয়নি</td></tr>'}</tbody></table></div></section>`;
  }
  function smsForm() {
    const list = filtered().filter(smsOk);
    if (!list.length) return toast("এই ফিল্টারে SMS দেওয়ার মতো কেউ নেই", true);
    X.openForm({
      title: `SMS খাতায় লিখুন — ${bn(list.length)} জন`,
      fields: [{ type: "html", html: `<p style="margin:0;color:var(--muted)">কাদের: ${esc(filterText())} (যোগাযোগ করবেন না / ভুল নম্বর / সম্মতি নেই — বাদ)</p>` },
        { name: "date", label: "কবে পাঠানো হয়েছে", type: "date", value: today() }, { name: "via", label: "কোন SMS সার্ভিস দিয়ে", placeholder: "যেমন: BulkSMS" },
        { name: "text", label: "SMS-এর লেখা", type: "textarea", wide: true, required: true }],
      onSave: async (d) => { await X.save("smsLog", { ...d, filter: filterText(), leadIds: list.map((l) => l.id), count: list.length }); await X.load(); render(); toast("খাতায় লেখা হয়েছে"); },
    });
  }

  // ================= পুরো পেজ =================
  function render() {
    if (!C) return;
    const L = leads(), d = due().length, adm = L.filter((l) => l.status === "admitted").length;
    const tabs = [["list", "তালিকা", L.length], ["follow", "ফলো-আপ", d], ["add", S.form && S.form.id ? "✎ বদলান" : "＋ যোগ"], ["import", "আমদানি"], ["stats", "হিসাব"], ["sms", "SMS খাতা", (DB().smsLog || []).length]];
    C.innerHTML = `<div class="ex-page ld-page">
      <section class="ln-banner"><div><span class="eyebrow">শুধু অ্যাডমিন দেখে</span><h2>সম্ভাব্য শিক্ষার্থী</h2>
        <p>অনলাইন কুইজ আর ওয়েবসাইটের ভর্তির আগ্রহ ফর্ম থেকে নিজে থেকে আসে; Talent Hunt আর অফলাইন মার্কেটিংয়ের তথ্য হাতে বা Excel থেকে যোগ করুন। একই মোবাইল একবারই থাকে — সব উৎস তার পাশে দেখায়।</p>
        <div class="ln-nums"><span><b>${bn(L.length)}</b>মোট</span><span><b>${bn(L.filter((l) => l.status === "new").length)}</b>নতুন</span><span><b>${bn(L.filter((l) => l.status === "interested").length)}</b>আগ্রহী</span><span><b>${bn(d)}</b>আজ ফোন করতে হবে</span><span><b>${bn(adm)}</b>ভর্তি হয়েছে${L.length ? ` (${bn(Math.round((adm / L.length) * 100))}%)` : ""}</span></div></div>
        <button type="button" class="btn gold" data-tab="add">＋ নতুন যোগ করুন</button></section>
      <div class="ln-tabs">${tabs.map(([k, t, n]) => `<button type="button" data-tab="${k}" class="${S.tab === k ? "on" : ""}">${t}${n !== undefined ? ` <i>${bn(n)}</i>` : ""}</button>`).join("")}</div>
      ${({ list: listTab, follow: followTab, add: formTab, import: importTab, stats: statsTab, sms: smsTab })[S.tab]()}</div>`;
  }
  const quick = async (l, patch, msg) => { try { await X.save("leads", { ...l, ...patch }, l.id); await X.load(); render(); toast(msg); } catch (e) { toast(e.message, true); } };
  function onClick(e) {
    const t = (s) => e.target.closest(s); let el;
    if ((el = t("[data-tab]"))) { if (el.dataset.tab === "add" && S.tab !== "add" && S.form && S.form.id) S.form = null; S.tab = el.dataset.tab; return render(); }
    if ((el = t("[data-edit]"))) { const l = byId(el.dataset.edit); S.form = { ...blank(), ...l, source: blank().source }; S.tab = "add"; render(); return window.scrollTo({ top: 0, behavior: "smooth" }); }
    if (t("[data-cancel]")) { const wasEdit = S.form && S.form.id; S.form = null; if (wasEdit) S.tab = "list"; return render(); }
    if (t("[data-save]")) return saveForm();
    if ((el = t("[data-del]"))) { const l = byId(el.dataset.del); return X.remove("leads", l.id, `${l.leadNo} ${l.name}-এর তথ্য`); }
    if ((el = t("[data-admit]"))) { const l = byId(el.dataset.admit); return X.studentForm(null, { name: l.name, phone: l.phone, guardianPhone: l.guardianPhone, college: l.institution, _leadId: l.id }); }
    if ((el = t("[data-done]"))) { const l = byId(el.dataset.done); return quick(l, { followUp: "", status: l.status === "new" || l.status === "followup" ? "contacted" : l.status }, "ফলো-আপ সরানো হয়েছে"); }
    if ((el = t("[data-later]"))) { const l = byId(el.dataset.later); return quick(l, { followUp: addDays(today(), 3), status: "followup" }, "৩ দিন পরে আবার মনে করাবে"); }
    if (t("[data-copy]")) {
      const nums = filtered().filter(smsOk).map((l) => l.phone);
      if (!nums.length) return toast("কপি করার মতো নম্বর নেই", true);
      return navigator.clipboard.writeText(nums.join("\n")).then(() => toast(`${bn(nums.length)}টি নম্বর কপি হয়েছে (SMS-এ বাদ যাদের, তারা বাদ)`)).catch(() => prompt("নম্বরগুলো কপি করুন:", nums.join(",")));
    }
    if (t("[data-excel]")) {
      const head = ["Lead ID", "নাম", "মোবাইল", "অভিভাবক", "ব্যাচ", "কলেজ", "এলাকা", "কোর্স", "উৎস", "ক্যাম্পেইন", "অবস্থা", "ফলো-আপ", "SMS সম্মতি", "নোট", "যোগ হয়েছে"];
      return U.xlsx(`leads-${today()}.xlsx`, head, filtered().map((l) => [l.leadNo, l.name, l.phone, l.guardianPhone, l.batch, l.institution, l.location, l.course, (l.sources || []).map((s) => SRC[s.type]).join("; "), [...new Set((l.sources || []).map((s) => s.campaign).filter(Boolean))].join("; "), ST[l.status][0], l.followUp, smsOk(l) ? "হ্যাঁ" : "না", l.remarks, (l.createdAt || "").slice(0, 10)]));
    }
    if (t("[data-sms-new]")) return smsForm();
    if ((el = t("[data-sms-del]"))) return X.remove("smsLog", el.dataset.smsDel, "খাতার এই লেখা");
    if (t("[data-import]")) return doImport();
    if (t("[data-template]")) { e.preventDefault(); return U.csv("leads-template.csv", ["নাম", "মোবাইল", "অভিভাবক", "ব্যাচ", "কলেজ", "এলাকা", "কোর্স", "নোট"], [["নমুনা নাম", "01700000000", "", "HSC-28", "সরকারি কলেজ", "মাদারীপুর সদর", "ICT", ""]]); }
  }
  function onChange(e) {
    const el = e.target;
    if (el.dataset.f) { S.f[el.dataset.f] = el.value; return render(); }
    if (el.dataset.status) { const l = byId(el.dataset.status); return quick(l, { status: el.value, ...(["admitted", "notinterested", "wrong", "dnc"].includes(el.value) ? { followUp: "" } : {}) }, "অবস্থা বদলানো হয়েছে"); }
    if (el.dataset.follow !== undefined && el.matches("[data-follow]")) { const l = byId(el.dataset.follow); return quick(l, { followUp: el.value, ...(el.value && l.status === "new" ? { status: "followup" } : {}) }, el.value ? `ফলো-আপ: ${U.date(el.value)}` : "ফলো-আপ সরানো হয়েছে"); }
    if (el.matches("[data-imp-file]")) { const f = el.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { readImp(); S.imp.text = String(r.result); S.imp.result = null; render(); }; return r.readAsText(f, "utf-8"); }
    if (el.matches("[data-isrc], [data-imp-consent]")) { readImp(); return; }
    if (el.matches("[data-src], [data-k]")) { readForm(); return; }
  }
  function onInput(e) {
    const el = e.target;
    if (el.dataset.f === "q") { S.f.q = el.value; const pos = el.selectionStart; render(); const i = $('[data-f="q"]', C); if (i) { i.focus(); i.setSelectionRange(pos, pos); } return; }
    if (el.matches("[data-imp-text]")) { clearTimeout(onInput.t); onInput.t = setTimeout(() => { readImp(); S.imp.result = null; const pos = el.selectionStart; render(); const a = $("[data-imp-text]", C); if (a) { a.focus(); a.setSelectionRange(pos, pos); } }, 500); }
  }
  return function leadsPage(c, arg) {
    C = c; if (arg === "follow") S.tab = "follow";
    c.onclick = onClick; c.onchange = onChange; c.oninput = onInput;
    render();
  };
};
