// অ্যাডমিন → সফল শিক্ষার্থী — ওয়েবসাইটের "আমাদের সফল শিক্ষার্থীরা" অংশ
// দুই কলাম: University Achievers (বিশ্ববিদ্যালয়ে পড়ছে) আর Career Achievers (পেশায় প্রতিষ্ঠিত)।
// প্রতিটা কলামে ছবি আর নাম-বিবরণ কয়েক সেকেন্ড পরপর পালা করে বদলায়।
window.SICAchievers = function (X) {
  "use strict";
  const { $, $$, esc, bn, api, toast } = U;
  const DB = () => X.DB;
  const GROUPS = [["university", "University Achievers", "বিশ্ববিদ্যালয়ে পড়ছে", "যেমন: ঢাকা বিশ্ববিদ্যালয়"], ["career", "Career Achievers", "পেশায় প্রতিষ্ঠিত", "যেমন: সফটওয়্যার ইঞ্জিনিয়ার, ঢাকা"]];
  let C = null, F = null, file = null, preview = "", busy = false;

  const all = () => [...(DB().achievers || [])].sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.createdAt).localeCompare(String(b.createdAt)));
  const inGroup = (g) => all().filter((a) => a.group === g);
  const imgOf = (a) => (a.image ? `/api/achiever/${a.id}/image?v=${a.image.v}` : "");
  const blank = (g) => ({ id: "", group: g || "university", name: "", detail: "", subject: "", batch: "", active: true });
  const num = (v) => Number(String(v).replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d)));

  const historyKey = "sic-achiever-field-history-v1";
  const remembered = () => { try { return JSON.parse(localStorage.getItem(historyKey) || "{}"); } catch { return {}; } };
  const fieldKey = key => ["detail","subject"].includes(key) ? `${F.group}:${key}` : key;
  function rememberField(el) {
    const key = el.dataset.k, value = el.value.trim();
    if (!["name","detail","subject","batch"].includes(key) || !value) return;
    const history = remembered(), id = fieldKey(key);
    history[id] = [...new Set([value,...(history[id] || [])])].slice(0,40);
    try { localStorage.setItem(historyKey,JSON.stringify(history)); } catch {}
  }
  function suggest(el) {
    C.querySelectorAll(".ac-suggestions").forEach(n => n.remove());
    const key = el.dataset.k;
    if (!["name","detail","subject","batch"].includes(key)) return;
    const values = [...new Set([...(remembered()[fieldKey(key)] || []),...all().filter(a => !["detail","subject"].includes(key) || a.group === F.group).map(a => a[key]).filter(Boolean)])];
    const query = el.value.trim().toLocaleLowerCase(), matches = values.filter(v => !query || v.toLocaleLowerCase().includes(query)).slice(0,12);
    if (!matches.length) return;
    const list = document.createElement("div"); list.className = "ac-suggestions"; list.setAttribute("role","listbox"); list.setAttribute("aria-label","আগের লেখা");
    list.innerHTML = matches.map(v => `<button type="button" role="option">${esc(v)}</button>`).join("");
    el.parentElement.style.position = "relative"; el.parentElement.append(list);
    list.querySelectorAll("button").forEach(b => { const choose = () => { el.value = b.textContent; rememberField(el); list.remove(); el.focus(); }; b.onmousedown = e => { e.preventDefault(); choose(); }; b.onclick = choose; });
    el.onkeydown = e => { if (e.key === "Escape") list.remove(); };
  }

  function formHtml() {
    const f = F, G = GROUPS.find((x) => x[0] === f.group);
    const img = preview || (f.id ? imgOf(DB().achievers.find((a) => a.id === f.id) || {}) : "");
    return `<section class="card bn-form"><h3>${f.id ? "✎ শিক্ষার্থীর তথ্য বদলান" : "＋ নতুন সফল শিক্ষার্থী"}</h3>
      <div class="bn-grid">
        <label class="bn-pick">${img ? `<img src="${esc(img)}" alt="">` : '<span><b>ছবি বেছে নিন</b><small>চওড়া ছবি (১৬:১০) সবচেয়ে ভালো — মুখ ছবির উপরের দিকে থাকলে ভালো দেখায়<br>JPG, PNG, WEBP বা GIF · ৮ MB পর্যন্ত</small></span>'}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-ac-file hidden></label>
        <div class="bn-fields">
          <div class="ac-groups">${GROUPS.map(([g, t, s]) => `<label class="hw-pill${f.group === g ? " on" : ""}"><input type="radio" name="acg" value="${g}"${f.group === g ? " checked" : ""}>${t}<small>${s}</small></label>`).join("")}</div>
          <label>শিক্ষার্থীর নাম *<input data-k="name" value="${esc(f.name)}" maxlength="120" placeholder="যেমন: রাফি আহমেদ"></label>
          <label>${f.group === "career" ? "পেশা ও প্রতিষ্ঠান" : "বিশ্ববিদ্যালয়"}<input data-k="detail" value="${esc(f.detail)}" maxlength="200" placeholder="${esc(G[3])}"></label>
          <label>${f.group === "career" ? "চাকরির পদবি / Job title (ঐচ্ছিক)" : "বিষয় (ঐচ্ছিক)"}<input data-k="subject" value="${esc(f.subject || "")}" maxlength="120" placeholder="${f.group === "career" ? "যেমন: সহকারী কমিশনার" : "যেমন: কম্পিউটার সায়েন্স অ্যান্ড ইঞ্জিনিয়ারিং"}"></label>
          <label>কোন ব্যাচের (ঐচ্ছিক)<input data-k="batch" value="${esc(f.batch)}" maxlength="40" placeholder="যেমন: HSC-24"></label>
          <label class="bn-chk"><input type="checkbox" data-k="active"${f.active ? " checked" : ""}> <b>ওয়েবসাইটে দেখাবে</b></label>
          <div class="rs-act"><button type="button" class="btn gold" data-ac-save>${f.id ? "✓ সংরক্ষণ করুন" : "✓ যোগ করুন"}</button><button type="button" class="btn line" data-ac-cancel>বাতিল</button></div>
        </div></div></section>`;
  }
  function groupHtml([g, t, s]) {
    const l = inGroup(g);
    return `<section class="card"><div class="qz-head"><h3>${t} <small class="ln-count">${s} · ${bn(l.length)} জন</small></h3><button type="button" class="btn gold sm" data-ac-new="${g}">＋ যোগ করুন</button></div>
      ${l.length ? `<div class="bn-list">${l.map((a, i) => `<div class="bn-item${a.active ? "" : " off"}">
        <div class="bn-thumb">${a.image ? `<img src="${esc(imgOf(a))}" alt="" style="object-position:50% 25%">` : "<span>ছবি নেই</span>"}</div>
        <div class="bn-info"><span class="chip ${a.active && a.image ? "ok" : ""}">${a.active ? (a.image ? "দেখাচ্ছে" : "ছবি নেই") : "❚❚ বন্ধ"}</span><b>${esc(a.name)}</b>${a.detail || a.subject ? `<small>${esc([a.detail, a.subject].filter(Boolean).join(" · "))}</small>` : ""}${a.batch ? `<small>${esc(a.batch)}</small>` : ""}</div>
        <div class="bn-acts"><button type="button" class="icon-btn" data-ac-up="${a.id}" title="আগে"${i ? "" : " disabled"}>↑</button><button type="button" class="icon-btn" data-ac-down="${a.id}" title="পরে"${i < l.length - 1 ? "" : " disabled"}>↓</button>
          <button type="button" class="btn line sm" data-ac-toggle="${a.id}">${a.active ? "❚❚ বন্ধ" : "► চালু"}</button><button type="button" class="btn gold sm" data-ac-edit="${a.id}">✎ বদলান</button><button type="button" class="icon-btn" data-ac-del="${a.id}" title="মুছুন">✕</button></div></div>`).join("")}</div>`
      : '<div class="ln-empty">এখনো কেউ নেই — "＋ যোগ করুন" চাপুন। খালি থাকলে ওয়েবসাইটে এই কলাম দেখায় না।</div>'}</section>`;
  }
  function render() {
    if (!C) return;
    const l = all(), live = l.filter((a) => a.active && a.image), secs = Number(DB().settings.achieverSeconds) || 3.5;
    C.onfocusin = e => { if (e.target.matches("input[data-k]")) suggest(e.target); };
    C.oninput = e => { if (e.target.matches("input[data-k]")) suggest(e.target); };
    C.onfocusout = e => { if (!e.relatedTarget?.closest(".ac-suggestions")) C.querySelectorAll(".ac-suggestions").forEach(n => n.remove()); };
    C.innerHTML = `<div class="ex-page">
      <section class="ln-banner"><div><span class="eyebrow">ওয়েবসাইটের মূল পাতা</span><h2>সফল শিক্ষার্থী</h2>
        <p>"আমাদের সফল শিক্ষার্থীরা" অংশে দুই কলাম — বিশ্ববিদ্যালয়ে পড়ছে আর পেশায় প্রতিষ্ঠিত। প্রতিটা কলামে ছবি আর নাম-বিবরণ কয়েক সেকেন্ড পরপর বদলায়। শুধু আসল শিক্ষার্থীর ছবি দিন — তাদের অনুমতি নিয়ে।</p>
        <div class="ln-nums"><span><b>${bn(inGroup("university").length)}</b>বিশ্ববিদ্যালয়</span><span><b>${bn(inGroup("career").length)}</b>পেশা</span><span><b>${bn(live.length)}</b>দেখাচ্ছে</span><span><b>${bn(String(secs))}</b>সেকেন্ড পরপর বদলায়</span></div></div>
        <span class="rs-btns"><a class="btn line" href="/#achievers" target="_blank">→ ওয়েবসাইটে দেখুন</a></span></section>
      ${F ? formHtml() : ""}
      <div class="ac-cols">${GROUPS.map(groupHtml).join("")}</div>
      <section class="card" style="margin-top:14px"><h3>বদলানোর গতি</h3><div class="bn-sec"><label>প্রতিটা ছবি কত সেকেন্ড থাকবে<input data-ac-secs inputmode="decimal" value="${esc(String(secs))}"></label><button type="button" class="btn gold sm" data-ac-secs-save>সংরক্ষণ</button></div></section></div>`;
  }
  function read() {
    if (!F) return;
    $$("[data-k]", C).forEach((el) => { F[el.dataset.k] = el.type === "checkbox" ? el.checked : el.value; });
    const g = $('input[name="acg"]:checked', C); if (g) F.group = g.value;
  }
  async function upload(id) {
    const ext = "." + (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const r = await fetch(`/api/admin/achievers/${encodeURIComponent(id)}/image?ext=${encodeURIComponent(ext)}`, { method: "POST", body: file });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "ছবি আপলোড হয়নি");
  }
  async function save() {
    if (busy) return;
    read();
    $$("input[data-k]", C).forEach(rememberField);
    if (!F.name.trim()) { toast("শিক্ষার্থীর নাম লিখুন", true); return $('[data-k="name"]', C).focus(); }
    if (!F.id && !file) return toast("আগে ছবি বেছে নিন", true);
    busy = true;
    try {
      const old = F.id && DB().achievers.find((a) => a.id === F.id);
      const order = old && old.group === F.group ? old.order : inGroup(F.group).reduce((m, a) => Math.max(m, a.order || 0), 0) + 10;
      const r = await X.save("achievers", { group: F.group, name: F.name.trim(), detail: F.detail.trim(), subject: String(F.subject || "").trim(), batch: F.batch.trim(), active: !!F.active, order }, F.id || undefined);
      if (file) await upload(r.item.id);
      F = null; file = null; preview = "";
      await X.load(); render(); toast("সংরক্ষণ হয়েছে");
    } catch (e) { toast(e.message, true); } finally { busy = false; }
  }
  async function move(id, dir) {
    const a0 = DB().achievers.find((a) => a.id === id), l = inGroup(a0.group), i = l.findIndex((a) => a.id === id), j = i + dir;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    try { for (const [k, a] of l.entries()) if ((a.order || 0) !== (k + 1) * 10) await X.save("achievers", { ...a, order: (k + 1) * 10 }, a.id); await X.load(); render(); } catch (e) { toast(e.message, true); }
  }
  function onClick(e) {
    const t = (s) => e.target.closest(s); let el;
    if ((el = t("[data-ac-new]"))) { F = blank(el.dataset.acNew); file = null; preview = ""; render(); return window.scrollTo({ top: 0, behavior: "smooth" }); }
    if ((el = t("[data-ac-edit]"))) { F = { ...blank(), ...DB().achievers.find((a) => a.id === el.dataset.acEdit) }; file = null; preview = ""; render(); return window.scrollTo({ top: 0, behavior: "smooth" }); }
    if (t("[data-ac-cancel]")) { F = null; file = null; preview = ""; return render(); }
    if (t("[data-ac-save]")) return save();
    if ((el = t("[data-ac-up]"))) return move(el.dataset.acUp, -1);
    if ((el = t("[data-ac-down]"))) return move(el.dataset.acDown, 1);
    if ((el = t("[data-ac-toggle]"))) { const a = DB().achievers.find((x) => x.id === el.dataset.acToggle); return X.save("achievers", { ...a, active: !a.active }, a.id).then(() => X.load()).then(() => { render(); toast(a.active ? "বন্ধ করা হয়েছে" : "চালু হয়েছে"); }).catch((er) => toast(er.message, true)); }
    if ((el = t("[data-ac-del]"))) { if (F && F.id === el.dataset.acDel) F = null; return X.remove("achievers", el.dataset.acDel, "এই শিক্ষার্থীর তথ্য আর ছবি"); }
    if (t("[data-ac-secs-save]")) {
      const v = Math.max(2, Math.min(30, Math.round((num($("[data-ac-secs]", C).value) || 3.5) * 2) / 2));
      return api("/api/admin/settings", { body: { achieverSeconds: String(v) } }).then(() => X.load()).then(() => { render(); toast(`প্রতিটা ছবি ${bn(String(v))} সেকেন্ড থাকবে`); }).catch((er) => toast(er.message, true));
    }
  }
  function onChange(e) {
    const el = e.target;
    if (el.matches("input[data-k]")) rememberField(el);
    if (el.matches("[data-ac-file]")) {
      const f = el.files[0]; if (!f) return;
      if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) return toast("ছবি দিন — JPG, PNG, WEBP বা GIF", true);
      if (f.size > 8 * 1024 * 1024) return toast("ছবি অনেক বড় — ৮ MB-এর মধ্যে দিন", true);
      read(); file = f; if (preview) URL.revokeObjectURL(preview); preview = URL.createObjectURL(f); return render();
    }
    if (el.name === "acg") { read(); return render(); }
  }
  return function achieversPage(c) { C = c; c.onclick = onClick; c.onchange = onChange; render(); };
};
