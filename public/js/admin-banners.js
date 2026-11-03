// অ্যাডমিন → ব্যানার — ওয়েবসাইটের মূল পাতার ব্যানার স্লাইডার (নোটিশের নিচে)
// মাঝে বড় ছবি, দুই পাশে আগের ও পরের ছবি উঁকি দেয়; নিজে থেকে লুপে ঘোরে। ক্রম, চালু / বন্ধ, লিংক এখান থেকে।
window.SICBanners = function (X) {
  "use strict";
  const { $, $$, esc, bn, api, toast } = U;
  const DB = () => X.DB;
  const LINKS = [["", "কোথাও না — শুধু ছবি"], ["/apply", "অনলাইনে ভর্তি (/apply)"], ["/talent-hunt", "ট্যালেন্ট হান্ট (/talent-hunt)"], ["/quiz", "অনলাইন কুইজ (/quiz)"], ["#programs", "কোর্স প্ল্যান"], ["#batches", "ক্লাস ব্যাচ"], ["#enquiry", "ভর্তির আগ্রহ ফর্ম"]];
  let C = null, F = null, file = null, preview = "", busy = false;

  const list = () => [...(DB().banners || [])].sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.createdAt).localeCompare(String(b.createdAt)));
  const imgOf = (b) => (b.image ? `/api/banner/${b.id}/image?v=${b.image.v}` : "");
  const blank = () => ({ id: "", title: "", link: "/apply", linkSel: "/apply", active: true });
  const isCustom = (l) => l && !LINKS.some(([v]) => v === l);

  function formHtml() {
    const f = F, sel = f.linkSel ?? (isCustom(f.link) ? "__custom" : f.link || "");
    const img = preview || (f.id ? imgOf(DB().banners.find((b) => b.id === f.id) || {}) : "");
    return `<section class="card bn-form"><h3>${f.id ? "✎ বিজ্ঞাপন বদলান" : "＋ নতুন বিজ্ঞাপন"}</h3>
      <div class="bn-grid">
        <label class="bn-pick">${img ? `<img src="${esc(img)}" alt="">` : '<span><b>ছবি বেছে নিন</b><small>চওড়া (১৬:৯) ছবি সবচেয়ে ভালো দেখায় — যেমন ১৬০০×৯০০<br>অন্য মাপের ছবিও চলবে, দুই পাশে ঝাপসা ভরাট হবে<br>JPG, PNG, WEBP বা GIF · ৮ MB পর্যন্ত</small></span>'}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-bn-file hidden></label>
        <div class="bn-fields">
          <label>নাম (নিজের চেনার জন্য — যেমন "HSC-28 ভর্তি")<input data-k="title" value="${esc(f.title)}" maxlength="120"></label>
          <label>চাপ দিলে কোথায় যাবে<select data-k="linkSel">${LINKS.map(([v, t]) => `<option value="${esc(v)}"${sel === v ? " selected" : ""}>${esc(t)}</option>`).join("")}<option value="__custom"${sel === "__custom" ? " selected" : ""}>অন্য লিংক (Facebook, YouTube…)</option></select></label>
          ${sel === "__custom" ? `<label>লিংক<input data-k="link" value="${esc(isCustom(f.link) ? f.link : "")}" placeholder="https://…"></label>` : ""}
          <label class="bn-chk"><input type="checkbox" data-k="active"${f.active ? " checked" : ""}> <b>ওয়েবসাইটে দেখাবে</b></label>
          <div class="rs-act"><button type="button" class="btn gold" data-bn-save>${f.id ? "✓ সংরক্ষণ করুন" : "✓ বিজ্ঞাপন যোগ করুন"}</button><button type="button" class="btn line" data-bn-cancel>বাতিল</button></div>
        </div></div></section>`;
  }
  function listHtml() {
    const l = list();
    return `<section class="card"><h3>সব বিজ্ঞাপন <small class="ln-count">${bn(l.length)}টি · উপর থেকে নিচের ক্রমে ঘোরে</small></h3>
      ${l.length ? `<div class="bn-list">${l.map((b, i) => `<div class="bn-item${b.active ? "" : " off"}">
        <div class="bn-thumb">${b.image ? `<img src="${esc(imgOf(b))}" alt="">` : "<span>ছবি নেই</span>"}</div>
        <div class="bn-info"><span class="chip ${b.active && b.image ? "ok" : ""}">${b.active ? (b.image ? "দেখাচ্ছে" : "ছবি নেই") : "❚❚ বন্ধ"}</span><b>${esc(b.title || `বিজ্ঞাপন ${bn(i + 1)}`)}</b><small>${esc(b.link || "লিংক নেই")}</small></div>
        <div class="bn-acts"><button type="button" class="icon-btn" data-bn-up="${b.id}" title="আগে"${i ? "" : " disabled"}>↑</button><button type="button" class="icon-btn" data-bn-down="${b.id}" title="পরে"${i < l.length - 1 ? "" : " disabled"}>↓</button>
          <button type="button" class="btn line sm" data-bn-toggle="${b.id}">${b.active ? "❚❚ বন্ধ করুন" : "► চালু করুন"}</button><button type="button" class="btn gold sm" data-bn-edit="${b.id}">✎ বদলান</button><button type="button" class="icon-btn" data-bn-del="${b.id}" title="মুছুন">✕</button></div></div>`).join("")}</div>`
      : '<div class="ln-empty">এখনো কোনো বিজ্ঞাপন নেই — "＋ নতুন বিজ্ঞাপন" চাপুন। বিজ্ঞাপন না থাকলে ওয়েবসাইটে এই অংশটা দেখায় না।</div>'}</section>`;
  }
  function render() {
    if (!C) return;
    const l = list(), live = l.filter((b) => b.active && b.image), secs = Number(DB().settings.bannerSeconds) || 5;
    C.innerHTML = `<div class="ex-page">
      <section class="ln-banner"><div><span class="eyebrow">ওয়েবসাইটের মূল পাতা</span><h2>বিজ্ঞাপন স্লাইডার</h2>
        <p>নোটিশের নিচের বড় স্লাইডারে যে ছবিগুলো ঘুরবে। মাঝে একটা বড় দেখায়, দুই পাশে আগের ও পরের ছবি উঁকি দেয়, নিজে থেকে লুপে ঘোরে।</p>
        <div class="ln-nums"><span><b>${bn(l.length)}</b>মোট</span><span><b>${bn(live.length)}</b>দেখাচ্ছে</span><span><b>${bn(secs)}</b>সেকেন্ড পরপর বদলায়</span></div></div>
        <span class="rs-btns"><a class="btn line" href="/#banners" target="_blank">→ ওয়েবসাইটে দেখুন</a>${F ? "" : '<button type="button" class="btn gold" data-bn-new>＋ নতুন বিজ্ঞাপন</button>'}</span></section>
      ${F ? formHtml() : ""}${listHtml()}
      <section class="card" style="margin-top:14px"><h3>ঘোরার গতি</h3><div class="bn-sec"><label>প্রতিটা ছবি কত সেকেন্ড থাকবে<input data-bn-secs inputmode="numeric" value="${esc(String(secs))}"></label><button type="button" class="btn gold sm" data-bn-secs-save>সংরক্ষণ</button></div></section></div>`;
  }
  function read() {
    if (!F) return;
    $$("[data-k]", C).forEach((el) => { F[el.dataset.k] = el.type === "checkbox" ? el.checked : el.value; });
    if (F.linkSel !== "__custom") F.link = F.linkSel || "";
  }
  async function upload(id) {
    const ext = "." + (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const r = await fetch(`/api/admin/banners/${encodeURIComponent(id)}/image?ext=${encodeURIComponent(ext)}`, { method: "POST", body: file });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "ছবি আপলোড হয়নি");
  }
  async function save() {
    if (busy) return;
    read();
    if (!F.id && !file) return toast("আগে ছবি বেছে নিন", true);
    if (F.linkSel === "__custom" && !/^https?:\/\//i.test(F.link || "")) return toast("লিংক http:// বা https:// দিয়ে শুরু করুন", true);
    busy = true;
    try {
      const order = F.id ? (DB().banners.find((b) => b.id === F.id) || {}).order : list().reduce((m, b) => Math.max(m, b.order || 0), 0) + 10;
      const r = await X.save("banners", { title: F.title.trim(), link: F.link, active: !!F.active, order }, F.id || undefined);
      if (file) await upload(r.item.id);
      F = null; file = null; preview = "";
      await X.load(); render(); toast("বিজ্ঞাপন সংরক্ষণ হয়েছে");
    } catch (e) { toast(e.message, true); } finally { busy = false; }
  }
  async function move(id, dir) {
    const l = list(), i = l.findIndex((b) => b.id === id), j = i + dir;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    try { for (const [k, b] of l.entries()) if ((b.order || 0) !== (k + 1) * 10) await X.save("banners", { ...b, order: (k + 1) * 10 }, b.id); await X.load(); render(); } catch (e) { toast(e.message, true); }
  }
  function onClick(e) {
    const t = (s) => e.target.closest(s); let el;
    if (t("[data-bn-new]")) { F = blank(); file = null; preview = ""; render(); return window.scrollTo({ top: 0, behavior: "smooth" }); }
    if ((el = t("[data-bn-edit]"))) { const b = DB().banners.find((x) => x.id === el.dataset.bnEdit); F = { ...blank(), ...b, linkSel: undefined }; file = null; preview = ""; render(); return window.scrollTo({ top: 0, behavior: "smooth" }); }
    if (t("[data-bn-cancel]")) { F = null; file = null; preview = ""; return render(); }
    if (t("[data-bn-save]")) return save();
    if ((el = t("[data-bn-up]"))) return move(el.dataset.bnUp, -1);
    if ((el = t("[data-bn-down]"))) return move(el.dataset.bnDown, 1);
    if ((el = t("[data-bn-toggle]"))) { const b = DB().banners.find((x) => x.id === el.dataset.bnToggle); return X.save("banners", { ...b, active: !b.active }, b.id).then(() => X.load()).then(() => { render(); toast(b.active ? "বিজ্ঞাপন বন্ধ করা হয়েছে" : "বিজ্ঞাপন চালু হয়েছে"); }).catch((er) => toast(er.message, true)); }
    if ((el = t("[data-bn-del]"))) { if (F && F.id === el.dataset.bnDel) F = null; return X.remove("banners", el.dataset.bnDel, "এই বিজ্ঞাপন আর এর ছবি"); }
    if (t("[data-bn-secs-save]")) {
      const v = Math.max(2, Math.min(60, Number(String($("[data-bn-secs]", C).value).replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d))) || 5));
      return api("/api/admin/settings", { body: { bannerSeconds: String(v) } }).then(() => X.load()).then(() => { render(); toast(`প্রতিটা ছবি ${bn(v)} সেকেন্ড থাকবে`); }).catch((er) => toast(er.message, true));
    }
  }
  function onChange(e) {
    const el = e.target;
    if (el.matches("[data-bn-file]")) {
      const f = el.files[0]; if (!f) return;
      if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) return toast("ছবি দিন — JPG, PNG, WEBP বা GIF", true);
      if (f.size > 8 * 1024 * 1024) return toast("ছবি অনেক বড় — ৮ MB-এর মধ্যে দিন", true);
      read(); file = f; if (preview) URL.revokeObjectURL(preview); preview = URL.createObjectURL(f); return render();
    }
    if (el.dataset.k === "linkSel") { read(); return render(); }
  }
  return function bannersPage(c) { C = c; c.onclick = onClick; c.onchange = onChange; render(); };
};
