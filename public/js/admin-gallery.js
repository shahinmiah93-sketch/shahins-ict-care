// অ্যাডমিন → ফটো গ্যালারি — পাবলিক সাইটের গ্যালারির ছবি
// একসাথে অনেক ছবি তোলা যায় (অ্যালবাম + তারিখ বেছে), প্রতিটা ছবির শিরোনাম / অ্যালবাম বদল, দেখানো / লুকানো, মোছা।
window.SICGallery = function (X, studentOnly) {
  "use strict";
  studentOnly = studentOnly === true;
  const { $, $$, esc, bn, toast } = U;
  const DB = () => X.DB;
  const SUGGEST = ["ক্লাসরুম", "অনুষ্ঠান", "পুরস্কার বিতরণ", "পরীক্ষা", "শিক্ষা সফর", "অন্যান্য"];
  let C = null, files = [], album = "", newAlbum = "", date = U.today(), filter = "", edit = null, busy = false;
  const selected = new Set();

  // নতুন ছবি আগে (বড় order আগে)
  const list = () => (DB().gallery || []).filter((g) => !!g.studentOnly === studentOnly).sort((a, b) => (b.order || 0) - (a.order || 0) || String(b.createdAt).localeCompare(String(a.createdAt)));
  const imgOf = (g) => (g.image ? `/api/gphoto/${g.id}/image?v=${g.image.v}` : "");
  const albums = () => [...new Set([...list().map((g) => g.album).filter(Boolean), ...SUGGEST])];

  function render() {
    if (!C) return;
    const l = list(), shown = l.filter((g) => g.active && g.image), al = albums(), view = filter ? l.filter((g) => g.album === filter) : l;
    const used = [...new Set(l.map((g) => g.album).filter(Boolean))];
    for (const id of selected) if (!view.some(g => g.id === id)) selected.delete(id);
    C.innerHTML = `<div class="ex-page">
      <section class="ln-banner"><div><span class="eyebrow">${studentOnly ? "শিক্ষার্থী প্যানেল" : "পাবলিক ওয়েবসাইট"}</span><h2>${studentOnly ? "ক্লাসের ক্যানভাস" : "আমাদের দিনলিপি"}</h2>
        <p>${studentOnly ? "প্রতিদিনের ক্লাসের ছবি যোগ করুন। শিক্ষার্থী প্যানেলে রেটিংয়ের পাশে ছবিগুলো একে একে দেখাবে।" : "কোচিংয়ের ক্লাস, অনুষ্ঠান, পুরস্কার বিতরণের ছবি। অ্যালবাম ধরে ওয়েবসাইটের গ্যালারিতে দেখায়, ছবিতে চাপলে বড় হয়।"}</p>
        <div class="ln-nums"><span><b>${bn(l.length)}</b>মোট ছবি</span><span><b>${bn(shown.length)}</b>দেখাচ্ছে</span><span><b>${bn(used.length)}</b>অ্যালবাম</span></div></div>
        ${studentOnly ? "" : '<span class="rs-btns"><a class="btn line" href="/#gallery" target="_blank">→ ওয়েবসাইটে দেখুন</a></span>'}</section>

      <section class="card gl-up"><h3>＋ নতুন ছবি যোগ করুন <small class="ln-count">একসাথে অনেকগুলো বেছে নেওয়া যায়</small></h3>
        <div class="gl-up-grid">
          <label class="gl-drop"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple data-gl-files hidden>
            ${files.length ? `<div class="gl-pre">${files.map((f) => `<img src="${esc(f.url)}" alt="">`).join("")}</div><b>${bn(files.length)}টি ছবি বাছা হয়েছে</b><small>আবার চাপলে নতুন করে বাছবেন</small>`
              : '<span></span><b>ছবি বেছে নিন</b><small>সবচেয়ে ভালো: আড়াআড়ি (Landscape) ছবি, মাপ <b>১৬০০ × ১২০০ পিক্সেল</b> (৪:৩)<br>কমপক্ষে ১২০০ পিক্সেল চওড়া · JPG ভালো, ৫০০ KB–২ MB হলে পাতা দ্রুত খোলে<br>JPG, PNG, WEBP বা GIF · প্রতিটা ৮ MB পর্যন্ত</small>'}</label>
          <div class="gl-fields">
            <label>অ্যালবাম<select data-gl-album>${al.map((a) => `<option${a === album ? " selected" : ""}>${esc(a)}</option>`).join("")}<option value="__new"${album === "__new" ? " selected" : ""}>＋ নতুন অ্যালবাম…</option></select></label>
            ${album === "__new" ? `<label>নতুন অ্যালবামের নাম<input data-gl-newalbum value="${esc(newAlbum)}" maxlength="60" placeholder="যেমন: বার্ষিক পুরস্কার ২০২৬"></label>` : ""}
            <label>তারিখ<input type="date" data-gl-date value="${esc(date)}"></label>
            <div class="rs-act"><button type="button" class="btn gold" data-gl-upload${files.length ? "" : " disabled"}>↑ ${files.length ? bn(files.length) + "টি " : ""}ছবি তুলুন</button>${files.length ? '<button type="button" class="btn line" data-gl-clear>বাতিল</button>' : ""}</div>
            <p class="gl-prog" hidden></p>
          </div></div>
${files.length ? `<div class="gl-upload-details">${files.map((f, i) => `<div class="card"><b>${bn(i + 1)}. ${esc(f.file.name)}</b><label>ছবির ক্যাপশন<input data-gf="title" data-fi="${i}" value="${esc(f.title || "")}" maxlength="150" placeholder="ছবির সংক্ষিপ্ত ক্যাপশন"></label><label>ছবির বিস্তারিত বিবরণ<textarea data-gf="description" data-fi="${i}" maxlength="3000" rows="3" placeholder="এই ছবির গল্প বা বিস্তারিত লিখুন">${esc(f.description || "")}</textarea></label></div>`).join("")}</div>` : ""}</section>

      <section class="card"><h3>সব ছবি <small class="ln-count">${bn(view.length)}টি</small></h3>
        ${used.length ? `<div class="gl-chips"><button type="button" class="${filter ? "" : "on"}" data-gl-filter="">সব</button>${used.map((a) => `<button type="button" class="${filter === a ? "on" : ""}" data-gl-filter="${esc(a)}">${esc(a)} <i>${bn(l.filter((g) => g.album === a).length)}</i></button>`).join("")}</div>` : ""}
        ${view.length ? `<div class="gl-bulk"><label class="gl-bulk-all"><input type="checkbox" data-gl-all> ${filter ? "এই অ্যালবামের সব নির্বাচন" : "সব ছবি নির্বাচন"}</label><span data-gl-count role="status" aria-live="polite"></span><button type="button" class="btn line sm" data-gl-unselect>নির্বাচন বাতিল</button><button type="button" class="btn sm gl-delete-selected" data-gl-delete-selected disabled>নির্বাচিত ছবি মুছুন</button></div><div class="gl-grid">${view.map((g) => edit && edit.id === g.id ? editCard(g, al) : `<figure class="gl-item${g.active ? "" : " off"}" data-gl-card="${esc(g.id)}">
          <div class="gl-ph">${g.image ? `<img src="${esc(imgOf(g))}" alt="" loading="lazy">` : "<span>ছবি নেই</span>"}${g.active ? "" : '<em>লুকানো</em>'}<label class="gl-pick"><input type="checkbox" data-gl-select="${esc(g.id)}" aria-label="${esc(g.title || g.album || "ছবি")} নির্বাচন"> নির্বাচন</label></div>
          <figcaption><b>${esc(g.title || "শিরোনাম নেই")}</b><small>${esc(g.album || "—")}${g.date ? " · " + U.date(g.date) : ""}</small>
          <span class="gl-acts"><button type="button" class="btn line sm" data-gl-toggle="${g.id}">${g.active ? "লুকান" : "দেখান"}</button><button type="button" class="btn gold sm" data-gl-edit="${g.id}">✎</button><button type="button" class="icon-btn" data-gl-del="${g.id}" title="মুছুন">✕</button></span></figcaption></figure>`).join("")}</div>`
          : '<div class="ln-empty">এখনো কোনো ছবি নেই — উপরের "ছবি বেছে নিন" থেকে যোগ করুন। ছবি না থাকলে ওয়েবসাইটে গ্যালারি অংশ দেখায় না।</div>'}</section></div>`;
    updateSelection();
  }
  function updateSelection() {
    if (!C) return;
    const visible = list().filter(g => !filter || g.album === filter);
    const count = $("[data-gl-count]", C), all = $("[data-gl-all]", C);
    if (count) count.textContent = `${bn(selected.size)}টি ছবি নির্বাচিত`;
    if (all) { all.checked = visible.length > 0 && visible.every(g => selected.has(g.id)); all.indeterminate = selected.size > 0 && !all.checked; all.disabled = busy; }
    $$("[data-gl-select]", C).forEach(el => { el.checked = selected.has(el.dataset.glSelect); el.disabled = busy; });
    $$("[data-gl-card]", C).forEach(el => el.classList.toggle("is-selected", selected.has(el.dataset.glCard)));
    const del = $("[data-gl-delete-selected]", C), clear = $("[data-gl-unselect]", C);
    if (del) { del.disabled = busy || !selected.size || !!edit; del.textContent = busy ? "মোছা হচ্ছে…" : `নির্বাচিত ${bn(selected.size)}টি ছবি মুছুন`; }
    if (clear) clear.disabled = busy || !selected.size;
  }
  async function deleteSelected() {
    if (busy || edit || !selected.size) return;
    const ids = [...selected];
    if (!confirm(`নির্বাচিত ${bn(ids.length)}টি ছবি মুছে ফেলবেন?${filter ? "\nঅ্যালবাম: " + filter : ""}`)) return;
    busy = true; updateSelection();
    try {
      const result = await U.api("/api/admin/gallery-delete", { body: { ids } });
      selected.clear(); await X.load(); render(); toast(`${bn(result.deleted)}টি ছবি মুছে ফেলা হয়েছে`);
    } catch (e) { toast(e.message, true); }
    finally { busy = false; updateSelection(); }
  }
  function editCard(g, al) {
    return `<figure class="gl-item gl-edit"><div class="gl-ph">${g.image ? `<img src="${esc(imgOf(g))}" alt="">` : ""}</div>
      <div class="gl-ef"><label>ছবির ক্যাপশন<input data-ge="title" value="${esc(edit.title || "")}" maxlength="150" placeholder="যেমন: HSC-27 এর ক্লাস"></label>
        <label>ছবির বিস্তারিত বিবরণ<textarea data-ge="description" maxlength="3000" rows="4">${esc(edit.description || "")}</textarea></label>
        <label>অ্যালবাম<input data-ge="album" value="${esc(edit.album || "")}" list="glAlbums" maxlength="60"></label><datalist id="glAlbums">${al.map((a) => `<option value="${esc(a)}">`).join("")}</datalist>
        <label>তারিখ<input type="date" data-ge="date" value="${esc(edit.date || "")}"></label>
        <label class="gl-rep">ছবি বদলান<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-ge-file></label>
        <span class="gl-acts"><button type="button" class="btn gold sm" data-ge-save>✓ সংরক্ষণ</button><button type="button" class="btn line sm" data-ge-cancel>বাতিল</button></span></div></figure>`;
  }
  const extOf = (f) => "." + (f.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  async function sendImg(id, f) {
    const r = await fetch(`/api/admin/gallery/${encodeURIComponent(id)}/image?ext=${encodeURIComponent(extOf(f))}`, { method: "POST", body: f });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "ছবি আপলোড হয়নি");
  }
  async function uploadAll() {
    if (busy || !files.length) return;
    const al = album === "__new" ? newAlbum.trim() : album || albums()[0];
    if (!al) return toast("অ্যালবামের নাম লিখুন", true);
    busy = true;
    const prog = $(".gl-prog", C); prog.hidden = false;
    let top = list().reduce((m, g) => Math.max(m, g.order || 0), 0), ok = 0;
    try {
      for (const [i, f] of files.entries()) {
        prog.textContent = `↑ তোলা হচ্ছে… ${bn(i + 1)} / ${bn(files.length)}`;
        top += 10;
        const r = await X.save("gallery", { title: (f.title || "").trim(), description: (f.description || "").trim(), album: al, date, active: true, studentOnly, order: top });
        await sendImg(r.item.id, f.file); ok++;
      }
      files.forEach((f) => URL.revokeObjectURL(f.url)); files = []; album = al; newAlbum = ""; filter = "";
      toast(`${bn(ok)}টি ছবি গ্যালারিতে যোগ হয়েছে`);
    } catch (e) { toast(e.message, true); } finally { busy = false; await X.load(); render(); }
  }
  async function saveEdit() {
    if (busy) return;
    $$("[data-ge]", C).forEach((el) => (edit[el.dataset.ge] = el.value));
    busy = true;
    try {
      const g = DB().gallery.find((x) => x.id === edit.id);
      await X.save("gallery", { ...g, title: edit.title.trim(), description: (edit.description || "").trim(), album: edit.album.trim() || "অন্যান্য", date: edit.date }, g.id);
      if (edit.file) await sendImg(g.id, edit.file);
      edit = null; await X.load(); render(); toast("ছবির তথ্য সংরক্ষণ হয়েছে");
    } catch (e) { toast(e.message, true); } finally { busy = false; }
  }
  function onClick(e) {
    const t = (s) => e.target.closest(s); let el;
    if (busy) return;
    if (t("[data-gl-delete-selected]")) return deleteSelected();
    if (t("[data-gl-unselect]")) { selected.clear(); return updateSelection(); }
    if (t("[data-gl-upload]")) return uploadAll();
    if (t("[data-gl-clear]")) { files.forEach((f) => URL.revokeObjectURL(f.url)); files = []; return render(); }
    if ((el = t("[data-gl-filter]"))) { filter = el.dataset.glFilter; edit = null; selected.clear(); return render(); }
    if ((el = t("[data-gl-edit]"))) { const g = DB().gallery.find((x) => x.id === el.dataset.glEdit); edit = { id: g.id, title: g.title || "", description: g.description || "", album: g.album, date: g.date }; return render(); }
    if (t("[data-ge-cancel]")) { edit = null; return render(); }
    if (t("[data-ge-save]")) return saveEdit();
    if ((el = t("[data-gl-toggle]"))) { const g = DB().gallery.find((x) => x.id === el.dataset.glToggle); return X.save("gallery", { ...g, active: !g.active }, g.id).then(() => X.load()).then(() => { render(); toast(g.active ? "ছবি লুকানো হয়েছে" : "ছবি ওয়েবসাইটে দেখাচ্ছে"); }).catch((er) => toast(er.message, true)); }
    if ((el = t("[data-gl-del]"))) return X.remove("gallery", el.dataset.glDel, "এই ছবি");
  }
  function onChange(e) {
    const el = e.target;
    if (busy) return;
    if (el.matches("[data-gl-select]")) {
      if (el.checked) selected.add(el.dataset.glSelect); else selected.delete(el.dataset.glSelect);
      return updateSelection();
    }
    if (el.matches("[data-gl-all]")) {
      list().filter(g => !filter || g.album === filter).forEach(g => el.checked ? selected.add(g.id) : selected.delete(g.id));
      return updateSelection();
    }
    if (el.matches("[data-gl-files]")) {
      const ok = [...el.files].filter((f) => /^image\/(jpeg|png|webp|gif)$/.test(f.type) && f.size <= 8 * 1024 * 1024);
      if (ok.length < el.files.length) toast(`${bn(el.files.length - ok.length)}টি ফাইল বাদ — শুধু ছবি, ৮ MB পর্যন্ত`, true);
      files.forEach((f) => URL.revokeObjectURL(f.url));
      files = ok.map((f) => ({ file: f, url: URL.createObjectURL(f) }));
      return render();
    }
    if (el.matches("[data-gl-album]")) { album = el.value; return render(); }
    if (el.matches("[data-gl-newalbum]")) newAlbum = el.value;
    if (el.matches("[data-gl-date]")) date = el.value;
    if (el.matches("[data-ge-file]")) { $$("[data-ge]", C).forEach((x) => (edit[x.dataset.ge] = x.value)); edit.file = el.files[0] || null; }
  }
  function onInput(e) { if (e.target.matches("[data-gf]")) files[Number(e.target.dataset.fi)][e.target.dataset.gf] = e.target.value; if (e.target.matches("[data-gl-newalbum]")) newAlbum = e.target.value; }
  return function galleryPage(c) { C = c; if (!album) album = albums()[0]; c.onclick = onClick; c.onchange = onChange; c.oninput = onInput; render(); };
};
