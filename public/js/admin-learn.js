// অ্যাডমিন → ফ্রি ক্লাস (অনলাইন কোর্সের রেকর্ড ক্লাস এখন "কোর্স মডিউল ও ব্যাচ" → অনলাইন কোর্স মডিউলে)
//   ► ফ্রি ক্লাস — মূল পাতায় প্রথম ৪টা, বাকিগুলো /free-classes পাতায়; যে কেউ দেখতে পারে
//   অনলাইন কোর্স — কভার, দাম, ভেতরে ক্রম অনুযায়ী ক্লাস; "ফ্রি" (ভর্তি হলেই খোলে) বা "অনুমোদন লাগবে" (টাকা নিয়ে অনুমোদন দিলে খোলে)
//   ভর্তি — কে কোন কোর্সে, অনুমোদন দেওয়া / ফেরানো, PIN দেখা ও নতুন PIN
// প্রতিটা ভিডিও: YouTube লিংক অথবা ভিডিও ফাইল আপলোড (MP4 ইত্যাদি, ২ GB পর্যন্ত)।
window.SICLearn = function (X) {
  "use strict";
  const { $, $$, esc, bn, toast } = U;
  const DB = () => X.DB;
  const num = (v) => Number(String(v ?? "").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d))) || 0;
  const rid = () => "les_" + Math.random().toString(36).slice(2, 10);
  const ytId = (u) => (String(u).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/) || [])[1] || "";
  const S = { tab: "free", fc: null, oc: null, ef: { course: "", status: "" }, busy: false };
  let C = null, fcFile = null, fcThumb = null, ocCover = null; const lessonFiles = new Map();

  const byOrder = (a, b) => (a.order || 0) - (b.order || 0) || String(a.createdAt).localeCompare(String(b.createdAt));
  const frees = () => [...(DB().freeClasses || [])].sort(byOrder);
  const courses = () => [...(DB().onlineCourses || [])].sort(byOrder);
  const enrolls = () => DB().ocEnrolls || [];
  const learner = (id) => (DB().learners || []).find((l) => l.id === id) || {};
  const thumb = (x, url) => (x.image ? `/api/${url}/${x.id}/image?v=${x.image.v}` : x.source !== "file" && x.yt ? `https://i.ytimg.com/vi/${x.yt}/mqdefault.jpg` : "");
  const vidState = (x) => (x.source === "file" ? (x.file ? `ফাইল (${bn(Math.round(x.file.size / 1048576))} MB)` : "ফাইল দেওয়া হয়নি") : x.yt ? "► YouTube" : "লিংক নেই");
  const money = (n) => "৳" + bn(Number(n || 0).toLocaleString("en-IN"));

  // ফাইল আপলোড (অগ্রগতি দেখায়)
  function upload(urlPath, file, label) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest(), bar = $("#lnUp");
      xhr.open("POST", urlPath);
      xhr.upload.onprogress = (e) => { if (bar && e.lengthComputable) { bar.hidden = false; bar.innerHTML = `<span>${esc(label)}</span><i style="width:${(e.loaded / e.total) * 100}%"></i><b>${bn(Math.round((e.loaded / e.total) * 100))}%</b>`; } };
      xhr.onload = () => { let j = {}; try { j = JSON.parse(xhr.responseText); } catch {} if (bar) bar.hidden = true; xhr.status < 300 ? resolve(j) : reject(new Error(j.error || "আপলোড হয়নি")); };
      xhr.onerror = () => { if (bar) bar.hidden = true; reject(new Error("আপলোড হয়নি — সংযোগ দেখুন")); };
      xhr.send(file);
    });
  }
  const extOf = (f) => "." + (f.name.split(".").pop() || "mp4").toLowerCase().replace("jpeg", "jpg");
  const imgUp = (col, id, f) => upload(`/api/admin/${col}/${encodeURIComponent(id)}/image?ext=${encodeURIComponent(extOf(f))}`, f, "ছবি আপলোড হচ্ছে");
  const vidUp = (q, f, label) => upload(`/api/admin/video?${q}&ext=${encodeURIComponent(extOf(f))}`, f, label);
  const okVideo = (f) => /\.(mp4|webm|m4v|mov)$/i.test(f.name) || toast("ভিডিও দিন — MP4, WEBM, M4V বা MOV", true) && false;

  // ================= ► ফ্রি ক্লাস =================
  function freeTab() {
    const L = frees();
    return `${S.fc ? freeForm() : ""}<section class="card"><div class="qz-head"><h3>► ফ্রি ক্লাস <small class="ln-count">${bn(L.length)}টি · মূল পাতায় প্রথম ৪টা দেখায়</small></h3>${S.fc ? "" : '<button type="button" class="btn gold sm" data-fc-new>＋ নতুন ফ্রি ক্লাস</button>'}</div>
      ${L.length ? `<div class="bn-list">${L.map((c, i) => `<div class="bn-item${c.active ? "" : " off"}"><div class="bn-thumb">${thumb(c, "freeclass") ? `<img src="${esc(thumb(c, "freeclass"))}" alt="">` : "<span>►</span>"}</div>
        <div class="bn-info"><span class="chip ${c.active ? "ok" : ""}">${c.active ? (i < 4 ? "মূল পাতায়" : "সব ক্লাস পাতায়") : "❚❚ বন্ধ"}</span><b>${esc(c.title)}</b><small>${esc(c.subject || "—")} · ${vidState(c)}</small></div>
        <div class="bn-acts"><button type="button" class="icon-btn" data-fc-up="${c.id}"${i ? "" : " disabled"}>↑</button><button type="button" class="icon-btn" data-fc-down="${c.id}"${i < L.length - 1 ? "" : " disabled"}>↓</button><button type="button" class="btn line sm" data-fc-play="${c.id}">► দেখুন</button><button type="button" class="btn line sm" data-fc-toggle="${c.id}">${c.active ? "❚❚ বন্ধ" : "► চালু"}</button><button type="button" class="btn gold sm" data-fc-edit="${c.id}">✎ বদলান</button><button type="button" class="icon-btn" data-fc-del="${c.id}">✕</button></div></div>`).join("")}</div>`
      : '<div class="ln-empty">এখনো কোনো ফ্রি ক্লাস নেই — "＋ নতুন ফ্রি ক্লাস" চাপুন।</div>'}</section>`;
  }
  function freeForm() {
    const F = S.fc, subs = [...new Set(frees().map((c) => c.subject).filter(Boolean))];
    return `<section class="card qz-set" style="margin-bottom:14px"><h3>${F.id ? "✎ ফ্রি ক্লাস বদলান" : "＋ নতুন ফ্রি ক্লাস"}</h3><div class="ld-grid">
      <label class="span2">ক্লাসের নাম *<input data-f="title" value="${esc(F.title)}" placeholder="যেমন: বাইনারি থেকে ডেসিমেল — সহজ নিয়ম"></label>
      <label>বিষয় (ছোট লাল ট্যাগ)<input data-f="subject" list="fcSubs" value="${esc(F.subject)}" placeholder="যেমন: ICT"><datalist id="fcSubs">${subs.map((s) => `<option value="${esc(s)}">`).join("")}</datalist></label>
      <label>ভিডিও কোথা থেকে<select data-f="source">${X.opt([["youtube", "YouTube লিংক"], ["file", "ভিডিও ফাইল আপলোড"]], F.source)}</select></label>
      ${F.source === "file" ? `<label class="span2">ভিডিও ফাইল (MP4, ২ GB পর্যন্ত)${F.file ? ` <small class="ex-sub">— আগের ফাইল আছে; নতুন দিলে বদলাবে</small>` : ""}<input type="file" accept="video/*" data-fc-file></label>`
        : `<label class="span2">YouTube লিংক<input data-f="ytUrl" value="${esc(F.ytUrl || (F.yt ? "https://youtu.be/" + F.yt : ""))}" placeholder="https://youtu.be/…"></label>`}
      <label class="span2">থাম্বনেইল ছবি (ঐচ্ছিক${F.source !== "file" ? " — না দিলে YouTube-এর ছবি" : ""})<input type="file" accept="image/*" data-fc-thumb></label>
      <label class="ld-chk"><input type="checkbox" data-f="active"${F.active !== false ? " checked" : ""}> ওয়েবসাইটে দেখাবে</label></div>
      <div class="rs-act" style="margin-top:12px"><button type="button" class="btn gold" data-fc-save>✓ সংরক্ষণ করুন</button><button type="button" class="btn line" data-fc-cancel>বাতিল</button></div></section>`;
  }
  function readFc() { const F = S.fc; if (!F) return; $$("[data-f]", C).forEach((el) => { F[el.dataset.f] = el.type === "checkbox" ? el.checked : el.value; }); }
  async function saveFc() {
    readFc(); const F = S.fc;
    if (!F.title.trim()) return toast("ক্লাসের নাম লিখুন", true);
    if (F.source !== "file" && !ytId(F.ytUrl || "") && !F.yt) return toast("সঠিক YouTube লিংক দিন", true);
    if (F.source === "file" && !F.file && !fcFile) return toast("ভিডিও ফাইল বেছে নিন", true);
    S.busy = true;
    try {
      const order = F.id ? F.order : frees().reduce((m, c) => Math.max(m, c.order || 0), 0) + 10;
      const r = await X.save("freeClasses", { title: F.title.trim(), subject: F.subject.trim(), source: F.source, ytUrl: F.ytUrl || "", yt: F.yt || "", active: F.active !== false, order }, F.id || undefined);
      if (F.source === "file" && fcFile) await vidUp(`col=freeClasses&id=${encodeURIComponent(r.item.id)}`, fcFile, "ভিডিও আপলোড হচ্ছে");
      if (fcThumb) await imgUp("freeClasses", r.item.id, fcThumb);
      S.fc = null; fcFile = fcThumb = null; await X.load(); render(); toast("ফ্রি ক্লাস সংরক্ষণ হয়েছে");
    } catch (e) { toast(e.message, true); } finally { S.busy = false; }
  }

  // ================= অনলাইন কোর্স =================
  function courseTab() {
    if (S.oc) return courseForm();
    const L = courses();
    return `<section class="card"><div class="qz-head"><h3>অনলাইন কোর্স <small class="ln-count">${bn(L.length)}টি</small></h3><button type="button" class="btn gold sm" data-oc-new>＋ নতুন কোর্স</button></div>
      ${L.length ? `<div class="bn-list">${L.map((c, i) => { const E = enrolls().filter((e) => e.courseId === c.id); return `<div class="bn-item${c.active ? "" : " off"}"><div class="bn-thumb">${c.image ? `<img src="/api/ocourse/${c.id}/image?v=${c.image.v}" alt="">` : "<span></span>"}</div>
        <div class="bn-info"><span class="chip ${c.active ? "ok" : ""}">${c.active ? "ওয়েবসাইটে" : "❚❚ বন্ধ"}</span> <span class="chip">${c.access === "approval" ? "✓ অনুমোদন লাগবে" : "ভর্তি হলেই খোলে"}</span><b>${esc(c.title)}</b>
          <small>${c.salePrice || c.price ? money(c.salePrice || c.price) : "ফ্রি"}${c.duration ? " · " + esc(c.duration) : ""} · ${bn((c.lessons || []).length)}টি ক্লাস · ${bn(E.filter((e) => e.status === "active").length)} জন${E.some((e) => e.status === "pending") ? ` · <b style="color:#b4233c">${bn(E.filter((e) => e.status === "pending").length)} জন অনুমোদনের অপেক্ষায়</b>` : ""}</small></div>
        <div class="bn-acts"><button type="button" class="icon-btn" data-oc-up="${c.id}"${i ? "" : " disabled"}>↑</button><button type="button" class="icon-btn" data-oc-down="${c.id}"${i < L.length - 1 ? "" : " disabled"}>↓</button><a class="btn line sm" href="/course?id=${encodeURIComponent(c.id)}" target="_blank">→ দেখুন</a><button type="button" class="btn line sm" data-oc-toggle="${c.id}">${c.active ? "❚❚ বন্ধ" : "► চালু"}</button><button type="button" class="btn gold sm" data-oc-edit="${c.id}">✎ বদলান ও ক্লাস</button><button type="button" class="icon-btn" data-oc-del="${c.id}">✕</button></div></div>`; }).join("")}</div>`
      : '<div class="ln-empty">এখনো কোনো অনলাইন কোর্স নেই — "＋ নতুন কোর্স" চাপুন।</div>'}</section>`;
  }
  function courseForm() {
    const F = S.oc;
    return `<div class="ln-bar"><button type="button" class="btn line" data-oc-cancel>‹ সব কোর্স</button></div>
      <section class="card qz-set"><h3>${F.id ? "✎ কোর্স বদলান" : "＋ নতুন অনলাইন কোর্স"}</h3><div class="ld-grid">
      <label class="span2">কোর্সের নাম *<input data-o="title" value="${esc(F.title)}" placeholder="যেমন: HSC ICT সম্পূর্ণ কোর্স"></label>
      <label>সময়কাল<input data-o="duration" value="${esc(F.duration)}" placeholder="যেমন: ৩ মাসের কোর্স"></label>
      <label class="span2">ছোট লেখা (কার্ডে নামের নিচে)<input data-o="subtitle" value="${esc(F.subtitle)}" placeholder="যেমন: ৬টি অধ্যায় — বেসিক থেকে বোর্ড প্রস্তুতি"></label>
      <label>আসল দাম (৳)<input data-o="price" inputmode="numeric" value="${esc(String(F.price || ""))}" placeholder="০ = ফ্রি"></label>
      <label>ছাড়ের দাম (৳, ঐচ্ছিক)<input data-o="salePrice" inputmode="numeric" value="${esc(String(F.salePrice || ""))}"></label>
      <label class="span2">ভর্তির পর ক্লাস কখন খুলবে<select data-o="access">${X.opt([["free", "ভর্তির ফর্ম দিলেই সাথে সাথে (ফ্রি কোর্স)"], ["approval", "আমি অনুমোদন দিলে (টাকা নিয়ে)"]], F.access)}</select></label>
      <label class="span2">কোর্স সম্পর্কে<textarea data-o="description" rows="4">${esc(F.description)}</textarea></label>
      <label>এই কোর্সে যা পাবেন (প্রতি লাইনে একটা)<textarea data-o="features" rows="4">${esc(Array.isArray(F.features) ? F.features.join("\n") : F.features || "")}</textarea></label>
      <label class="span2">কভার ছবি (১৬:৯ সবচেয়ে ভালো)${F.image ? ' <small class="ex-sub">— আগের ছবি আছে; নতুন দিলে বদলাবে</small>' : ""}<input type="file" accept="image/*" data-oc-cover></label>
      <label class="ld-chk"><input type="checkbox" data-o="active"${F.active !== false ? " checked" : ""}> ওয়েবসাইটে দেখাবে</label></div></section>
      <section class="card" style="margin-top:14px"><div class="qz-head"><div><h3>কোর্সের ক্লাস <small class="ln-count">${bn(F.lessons.length)}টি · উপর থেকে নিচে ক্রমে দেখাবে</small></h3><p class="ex-sub" style="margin:0">"ফ্রি প্রিভিউ" টিক দিলে সেই ক্লাস ভর্তি ছাড়াই দেখা যায়।</p></div><button type="button" class="btn gold sm" data-ls-add>＋ ক্লাস যোগ</button></div>
      <div class="ls-list">${F.lessons.map((l, i) => `<div class="ls-row" data-li="${i}"><b>${bn(i + 1)}</b>
        <input data-l="title" value="${esc(l.title)}" placeholder="ক্লাসের নাম">
        <select data-l="source">${X.opt([["youtube", "YouTube"], ["file", "ফাইল"]], l.source)}</select>
        ${l.source === "file" ? `<span class="ls-file">${lessonFiles.has(l.id) ? `${esc(lessonFiles.get(l.id).name)}` : l.file ? `আছে (${bn(Math.round(l.file.size / 1048576))} MB)` : "নেই"}<input type="file" accept="video/*" data-l-file="${esc(l.id)}"></span>`
          : `<input data-l="ytUrl" value="${esc(l.ytUrl || (l.yt ? "https://youtu.be/" + l.yt : ""))}" placeholder="YouTube লিংক">`}
        <label class="ld-chk"><input type="checkbox" data-l="preview"${l.preview ? " checked" : ""}> ফ্রি প্রিভিউ</label>
        <span><button type="button" class="icon-btn" data-ls-up="${i}"${i ? "" : " disabled"}>↑</button><button type="button" class="icon-btn" data-ls-down="${i}"${i < F.lessons.length - 1 ? "" : " disabled"}>↓</button><button type="button" class="icon-btn" data-ls-rm="${i}">✕</button></span></div>`).join("") || '<div class="ln-empty">এখনো কোনো ক্লাস নেই — "＋ ক্লাস যোগ" চাপুন।</div>'}</div>
      <div class="qz-save"><span>${bn(F.lessons.length)}টি ক্লাস${lessonFiles.size ? ` · ${bn(lessonFiles.size)}টি ভিডিও আপলোড হবে` : ""}</span><button type="button" class="btn line" data-oc-cancel>বাতিল</button><button type="button" class="btn gold" data-oc-save>✓ কোর্স সংরক্ষণ করুন</button></div></section>`;
  }
  function readOc() {
    const F = S.oc; if (!F) return;
    $$("[data-o]", C).forEach((el) => { F[el.dataset.o] = el.type === "checkbox" ? el.checked : el.value; });
    $$(".ls-row", C).forEach((row) => { const l = F.lessons[Number(row.dataset.li)]; $$("[data-l]", row).forEach((el) => { l[el.dataset.l] = el.type === "checkbox" ? el.checked : el.value; }); });
  }
  async function saveOc() {
    readOc(); const F = S.oc;
    if (!F.title.trim()) return toast("কোর্সের নাম লিখুন", true);
    const bad = F.lessons.findIndex((l) => !l.title.trim());
    if (bad >= 0) return toast(`ক্লাস ${bn(bad + 1)}-এর নাম লিখুন`, true);
    const noYt = F.lessons.findIndex((l) => l.source !== "file" && l.ytUrl && !ytId(l.ytUrl));
    if (noYt >= 0) return toast(`ক্লাস ${bn(noYt + 1)}-এর YouTube লিংক ঠিক নেই`, true);
    S.busy = true;
    try {
      const order = F.id ? F.order : courses().reduce((m, c) => Math.max(m, c.order || 0), 0) + 10;
      const body = { ...F, features: String(F.features || "").split("\n"), price: num(F.price), salePrice: num(F.salePrice), order, lessons: F.lessons.map((l) => ({ id: l.id, title: l.title.trim(), source: l.source, ytUrl: l.ytUrl || "", yt: l.yt || "", preview: !!l.preview })) };
      const r = await X.save("onlineCourses", body, F.id || undefined);
      const cid = r.item.id;
      if (ocCover) await imgUp("onlineCourses", cid, ocCover);
      let k = 0;
      for (const [lid, f] of lessonFiles) { k++; const l = F.lessons.find((x) => x.id === lid); if (!l || l.source !== "file") continue; await vidUp(`col=onlineCourses&id=${encodeURIComponent(cid)}&lesson=${encodeURIComponent(lid)}`, f, `ভিডিও ${bn(k)}/${bn(lessonFiles.size)}: ${l.title}`); }
      lessonFiles.clear(); ocCover = null; S.oc = null; await X.load(); render(); toast("কোর্স সংরক্ষণ হয়েছে");
    } catch (e) { toast(e.message, true); } finally { S.busy = false; }
  }

  // ================= ভর্তি =================
  function enrollTab() {
    const f = S.ef, list = enrolls().filter((e) => (!f.course || e.courseId === f.course) && (!f.status || e.status === f.status)).sort((a, b) => (a.status === "pending" ? -1 : 0) - (b.status === "pending" ? -1 : 0) || String(b.createdAt).localeCompare(String(a.createdAt)));
    const cname = (id) => (courses().find((c) => c.id === id) || {}).title || "(মুছে ফেলা কোর্স)";
    return `<section class="card"><div class="ld-filter"><label>কোর্স<select data-ef="course">${X.opt([["", "সব কোর্স"], ...courses().map((c) => [c.id, c.title])], f.course)}</select></label>
        <label>অবস্থা<select data-ef="status">${X.opt([["", "সব"], ["pending", "অনুমোদনের অপেক্ষায়"], ["active", "চালু"]], f.status)}</select></label></div>
      <div class="tbl-wrap"><table class="exam-entry-table ld-table"><thead><tr><th>শিক্ষার্থী</th><th>কোর্স</th><th>অবস্থা</th><th>PIN</th><th>তারিখ</th><th></th></tr></thead><tbody>
      ${list.map((e) => { const l = learner(e.learnerId); return `<tr><td><b>${esc(l.name || "—")}</b><small><a href="tel:${esc(l.phone)}">${esc(l.phone)}</a>${l.klass ? " · " + esc(l.klass) : ""}${l.college ? " · " + esc(l.college) : ""}</small></td><td>${esc(cname(e.courseId))}</td>
        <td>${e.status === "active" ? '<span class="chip ok">✓ চালু</span>' : '<span class="chip warn">অপেক্ষায়</span>'}</td><td><b style="font-family:Consolas,Hind Siliguri,monospace">${esc(l.pin || "")}</b></td><td>${U.date((e.createdAt || "").slice(0, 10))}</td>
        <td class="num" style="white-space:nowrap">${e.status === "pending" ? `<button type="button" class="btn gold sm" data-ap="${e.id}">✓ অনুমোদন দিন</button>` : `<button type="button" class="btn line sm" data-unap="${e.id}">❚❚ বন্ধ করুন</button>`} <button type="button" class="btn line sm" data-pin="${e.learnerId}">নতুন PIN</button> <button type="button" class="btn sm line" data-lsms="${e.learnerId}">SMS</button> <button type="button" class="icon-btn" data-en-del="${e.id}">✕</button></td></tr>`; }).join("") || '<tr><td colspan="6" class="empty">কেউ নেই</td></tr>'}</tbody></table></div>
      <p class="ex-sub" style="margin:10px 0 0">নতুন অ্যাকাউন্টে মোবাইল নম্বর আর PIN নিজে থেকে SMS-এ যায়। PIN ভুলে গেলে "SMS" চাপুন, অথবা "নতুন PIN" দিয়ে তারপর "SMS" চাপুন। টাকার কোর্সে টাকা পেলে "অনুমোদন দিন" চাপলেই তার ক্লাস খুলে যায়।</p></section>`;
  }

  function render() {
    if (!C) return;
    const pend = enrolls().filter((e) => e.status === "pending").length;
    // অনলাইন কোর্স আর তার ভর্তি এখন "কোর্স মডিউল ও ব্যাচ" → অনলাইন কোর্স মডিউলে (রেকর্ড ক্লাস) — এখানে শুধু ফ্রি ক্লাস
    const tabs = [["free", "ফ্রি ক্লাস", frees().length]];
    C.innerHTML = `<div class="ex-page">
      <section class="ln-banner"><div><span class="eyebrow">ওয়েবসাইটের মূল পাতা</span><h2>ফ্রি ক্লাস</h2>
        <p>ফ্রি ক্লাস যে কেউ দেখে — মূল পাতায় প্রথম ৪টা, বাকিগুলো "সব ফ্রি ক্লাস" পাতায়। ভিডিও — YouTube লিংক বা নিজের আপলোড করা ফাইল। টাকার রেকর্ড ক্লাস দিতে: <a href="#courses">কোর্স মডিউল ও ব্যাচ</a> → অনলাইন কোর্স মডিউলের "ভিডিও ক্লাস"।</p>
        <div class="ln-nums"><span><b>${bn(frees().length)}</b>ফ্রি ক্লাস</span></div></div>
        <span class="rs-btns"><a class="btn line" href="/free-classes" target="_blank">→ ফ্রি ক্লাস</a></span></section>
      <div class="ln-up" id="lnUp" hidden></div>
      <div class="ln-tabs">${tabs.map(([k, t, n]) => `<button type="button" data-tab="${k}" class="${S.tab === k ? "on" : ""}">${t} <i>${bn(n)}</i></button>`).join("")}</div>
      ${({ free: freeTab, courses: courseTab, enroll: enrollTab })[S.tab]()}</div>`;
  }
  async function move(col, list, id, dir) {
    const i = list.findIndex((x) => x.id === id), j = i + dir; if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    try { for (const [k, x] of list.entries()) if ((x.order || 0) !== (k + 1) * 10) await X.save(col, col === "onlineCourses" ? { ...x, features: x.features, order: (k + 1) * 10 } : { ...x, order: (k + 1) * 10 }, x.id); await X.load(); render(); } catch (e) { toast(e.message, true); }
  }
  const quick = (col, x, patch, msg) => X.save(col, { ...x, ...patch }, x.id).then(() => X.load()).then(() => { render(); toast(msg); }).catch((e) => toast(e.message, true));
  function onClick(e) {
    const t = (s) => e.target.closest(s); let el;
    if (S.busy && t("button")) return toast("আপলোড চলছে — একটু অপেক্ষা করুন", true);
    if ((el = t("[data-tab]"))) { S.tab = el.dataset.tab; return render(); }
    // ফ্রি ক্লাস
    if (t("[data-fc-new]")) { S.fc = { id: "", title: "", subject: "", source: "youtube", ytUrl: "", active: true }; fcFile = fcThumb = null; return render(); }
    if ((el = t("[data-fc-edit]"))) { S.fc = { ...DB().freeClasses.find((x) => x.id === el.dataset.fcEdit) }; fcFile = fcThumb = null; render(); return window.scrollTo({ top: 0, behavior: "smooth" }); }
    if (t("[data-fc-cancel]")) { S.fc = null; return render(); }
    if (t("[data-fc-save]")) return saveFc();
    if ((el = t("[data-fc-up]"))) return move("freeClasses", frees(), el.dataset.fcUp, -1);
    if ((el = t("[data-fc-down]"))) return move("freeClasses", frees(), el.dataset.fcDown, 1);
    if ((el = t("[data-fc-toggle]"))) { const c = DB().freeClasses.find((x) => x.id === el.dataset.fcToggle); return quick("freeClasses", c, { active: !c.active }, c.active ? "বন্ধ করা হয়েছে" : "চালু হয়েছে"); }
    if ((el = t("[data-fc-del]"))) return X.remove("freeClasses", el.dataset.fcDel, "এই ফ্রি ক্লাস আর এর ভিডিও");
    if ((el = t("[data-fc-play]"))) { const c = DB().freeClasses.find((x) => x.id === el.dataset.fcPlay); return U.playVideo(c.source === "file" ? (c.file ? { type: "file", src: `/api/freeclass/${c.id}/video?v=${c.file.v}` } : null) : c.yt ? { type: "youtube", yt: c.yt } : null, c.title); }
    // কোর্স
    if (t("[data-oc-new]")) { S.oc = { id: "", title: "", subtitle: "", duration: "", price: 0, salePrice: 0, access: "free", description: "", features: [], active: true, lessons: [] }; lessonFiles.clear(); ocCover = null; return render(); }
    if ((el = t("[data-oc-edit]"))) { const c = DB().onlineCourses.find((x) => x.id === el.dataset.ocEdit); S.oc = JSON.parse(JSON.stringify(c)); S.oc.lessons ||= []; lessonFiles.clear(); ocCover = null; render(); return window.scrollTo({ top: 0, behavior: "smooth" }); }
    if (t("[data-oc-cancel]")) { if (lessonFiles.size && !confirm("বাছাই করা ভিডিওগুলো আপলোড হয়নি। তবুও যাবেন?")) return; S.oc = null; lessonFiles.clear(); return render(); }
    if (t("[data-oc-save]")) return saveOc();
    if ((el = t("[data-oc-up]"))) return move("onlineCourses", courses(), el.dataset.ocUp, -1);
    if ((el = t("[data-oc-down]"))) return move("onlineCourses", courses(), el.dataset.ocDown, 1);
    if ((el = t("[data-oc-toggle]"))) { const c = DB().onlineCourses.find((x) => x.id === el.dataset.ocToggle); return quick("onlineCourses", c, { active: !c.active }, c.active ? "বন্ধ করা হয়েছে" : "চালু হয়েছে"); }
    if ((el = t("[data-oc-del]"))) { const c = DB().onlineCourses.find((x) => x.id === el.dataset.ocDel); return X.remove("onlineCourses", c.id, `"${c.title}" কোর্স, এর সব ভিডিও আর ${bn(enrolls().filter((e) => e.courseId === c.id).length)} জনের ভর্তি`); }
    if (t("[data-ls-add]")) { readOc(); S.oc.lessons.push({ id: rid(), title: "", source: "youtube", ytUrl: "", preview: false }); render(); const r = $$(".ls-row", C).pop(); if (r) { r.scrollIntoView({ block: "center" }); $("[data-l=title]", r).focus(); } return; }
    if ((el = t("[data-ls-rm]"))) { readOc(); const [x] = S.oc.lessons.splice(Number(el.dataset.lsRm), 1); lessonFiles.delete(x.id); return render(); }
    if ((el = t("[data-ls-up]")) || (el = t("[data-ls-down]"))) { readOc(); const i = Number(el.dataset.lsUp ?? el.dataset.lsDown), j = el.dataset.lsUp !== undefined ? i - 1 : i + 1, a = S.oc.lessons; [a[i], a[j]] = [a[j], a[i]]; return render(); }
    // ভর্তি
    if ((el = t("[data-ap]"))) { const x = enrolls().find((e) => e.id === el.dataset.ap); return quick("ocEnrolls", x, { status: "active" }, "অনুমোদন দেওয়া হয়েছে — ক্লাস খুলে গেছে"); }
    if ((el = t("[data-unap]"))) { const x = enrolls().find((e) => e.id === el.dataset.unap); if (!confirm("এই শিক্ষার্থীর ক্লাস বন্ধ করবেন?")) return; return quick("ocEnrolls", x, { status: "pending" }, "বন্ধ করা হয়েছে"); }
    if ((el = t("[data-lsms]"))) { const l = learner(el.dataset.lsms); if (!confirm(`${l.name}-কে মোবাইল নম্বর আর PIN SMS-এ পাঠাবেন?`)) return; return U.api("/api/admin/login-sms", { body: { kind: "learner", id: l.id } }).then(() => toast("SMS পাঠানো হয়েছে")).catch((er) => toast(er.message, true)); }
    if ((el = t("[data-pin]"))) { const l = learner(el.dataset.pin), pin = String(Math.floor(1000 + Math.random() * 9000)); if (!confirm(`${l.name}-এর নতুন PIN হবে ${pin}। দেবেন?`)) return; return quick("learners", l, { pin }, `নতুন PIN: ${pin} — শিক্ষার্থীকে জানিয়ে দিন`); }
    if ((el = t("[data-en-del]"))) return X.remove("ocEnrolls", el.dataset.enDel, "এই ভর্তি");
  }
  function onChange(e) {
    const el = e.target;
    if (el.dataset.f === "source") { readFc(); return render(); }
    if (el.matches("[data-fc-file]")) { const f = el.files[0]; if (f && okVideo(f)) fcFile = f; return; }
    if (el.matches("[data-fc-thumb]")) { fcThumb = el.files[0] || null; return; }
    if (el.matches("[data-oc-cover]")) { ocCover = el.files[0] || null; return; }
    if (el.dataset.l === "source") { readOc(); return render(); }
    if (el.matches("[data-l-file]")) { const f = el.files[0]; if (f && okVideo(f)) { readOc(); lessonFiles.set(el.dataset.lFile, f); render(); } return; }
    if (el.dataset.ef) { S.ef[el.dataset.ef] = el.value; return render(); }
  }
  addEventListener("beforeunload", (e) => { if ((S.busy || lessonFiles.size) && C && C.isConnected) { e.preventDefault(); e.returnValue = ""; } });
  return function learnPage(c) { C = c; S.tab = "free"; c.onclick = onClick; c.onchange = onChange; render(); };
};
