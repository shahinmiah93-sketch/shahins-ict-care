// অ্যাডমিন → প্রশ্নোত্তর বক্স — মূল পাতা থেকে আসা প্রশ্ন (লেখা / ছবি / ভয়েস); শিক্ষক লেখা, ছবি, অডিও (রেকর্ড বা ফাইল),
// ভিডিও ফাইল বা YouTube লিংক — যেকোনোটা বা মিলিয়ে উত্তর দেন। উত্তর শুধু প্রশ্নকারী নিজে দেখে।
window.SICQna = function (X) {
  "use strict";
  const { $, $$, esc, bn, toast } = U;
  const DB = () => X.DB;
  const A_KINDS = [["a-image", "ছবি", "image/jpeg,image/png,image/webp,image/gif"], ["a-audio", "অডিও", "audio/*"], ["a-video", "ভিডিও", "video/mp4,video/webm,video/quicktime"]];
  let C = null, filter = "new", open = "", pending = {}, busy = false, rec = null;
  const BY = "sic-qna-by";
  const byName = () => { try { return localStorage.getItem(BY) || ""; } catch { return ""; } };

  const all = () => [...(DB().qna || [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const fileUrl = (q, k) => (q.files && q.files[k] ? `/api/admin/qna/${q.id}/${k}?v=${q.files[k].v}` : "");
  const when = (s) => (s ? U.date(s.slice(0, 10)) : "");
  const mediaHtml = (q, img, aud, vid) => `${img && fileUrl(q, img) ? `<a href="${fileUrl(q, img)}" target="_blank" rel="noopener"><img class="qn-img" src="${fileUrl(q, img)}" alt=""></a>` : ""}${aud && fileUrl(q, aud) ? `<audio controls preload="none" src="${fileUrl(q, aud)}"></audio>` : ""}${vid && fileUrl(q, vid) ? `<video controls preload="metadata" src="${fileUrl(q, vid)}"></video>` : ""}`;

  function editor(q) {
    return `<div class="qn-edit">
      <label>উত্তর (লেখা)<textarea data-f="answer" rows="5" maxlength="6000" placeholder="উত্তর লিখুন — চাইলে নিচে ছবি, অডিও বা ভিডিও জুড়ে দিন">${esc(q.answer || "")}</textarea></label>
      <div class="qn-files">${A_KINDS.map(([k, t, acc]) => {
        const has = q.files && q.files[k], pend = pending[k];
        return `<div class="qn-file"><b>${t}</b>
          ${pend ? `<span class="chip gold">নতুন: ${esc(pend.name || "রেকর্ড করা ভয়েস")}</span><button type="button" class="btn sm line" data-unpend="${k}">বাদ দিন</button>`
            : has ? `<span class="chip ok">যোগ করা আছে</span><button type="button" class="btn sm line" data-del-file="${k}">মুছুন</button>` : ""}
          <label class="btn sm line">${has || pend ? "বদলান" : "ফাইল বাছুন"}<input type="file" accept="${acc}" data-pick="${k}" hidden></label>
          ${k === "a-audio" ? `<button type="button" class="btn sm line" data-rec>${rec ? "■ রেকর্ড থামান" : "● ভয়েস রেকর্ড"}</button>` : ""}</div>`;
      }).join("")}</div>
      <div class="qn-row"><label>YouTube ভিডিও লিংক (ঐচ্ছিক)<input data-f="yt" value="${esc(q._yt !== undefined ? q._yt : q.yt ? "https://youtu.be/" + q.yt : "")}" placeholder="https://youtu.be/…"></label>
        <label>উত্তরদাতার নাম (ঐচ্ছিক)<input data-f="answeredBy" value="${esc(q.answeredBy || byName())}" maxlength="80" placeholder="যেমন: শাহিন স্যার"></label></div>
      <div class="qn-act"><button type="button" class="btn gold" data-save>${busy ? "সেভ হচ্ছে…" : "✓ উত্তর সেভ করুন"}</button><button type="button" class="btn line" data-close>বাতিল</button>
        <button type="button" class="btn line danger" data-del-q>প্রশ্নটা মুছুন</button></div></div>`;
  }

  function render() {
    const list = all(), nNew = list.filter((q) => q.status !== "answered").length;
    const view = list.filter((q) => filter === "all" || (filter === "new" ? q.status !== "answered" : q.status === "answered"));
    C.innerHTML = `<div class="card"><div class="card-head"><h2>প্রশ্নোত্তর বক্স</h2>
        <div class="qn-tabs">${[["new", `নতুন প্রশ্ন (${bn(nNew)})`], ["answered", `উত্তর দেওয়া (${bn(list.length - nNew)})`], ["all", `সব (${bn(list.length)})`]].map(([k, t]) => `<button type="button" class="${filter === k ? "on" : ""}" data-filter="${k}">${t}</button>`).join("")}</div></div>
      <p style="margin-top:0;color:var(--muted)">মূল পাতার "প্রশ্ন ও উত্তর" বক্স থেকে আসা প্রশ্ন। লেখা, ছবি, অডিও, ভিডিও বা YouTube লিংক — যেকোনোটা বা মিলিয়ে উত্তর দিন। উত্তর শুধু প্রশ্নকারী নিজের অ্যাকাউন্টে (মূল পাতার "আমার প্রশ্ন") দেখে, সবার জন্য দেখানো হয় না।</p>
      <div class="qn-list">${view.map((q) => `<article class="qn-card${q.status === "answered" ? " done" : ""}${open === q.id ? " open" : ""}">
        <div class="qn-head"><b>${esc(q.name || "নাম দেয়নি")}</b>${q.phone ? `<a href="tel:${esc(q.phone)}">${bn(q.phone)}</a>` : ""}<small>${when(q.createdAt)}</small>
          ${q.status === "answered" ? '<span class="chip ok">উত্তর দেওয়া</span>' : '<span class="chip gold">নতুন</span>'}</div>
        ${q.text ? `<p class="qn-text">${esc(q.text).replace(/\n/g, "<br>")}</p>` : ""}${mediaHtml(q, "q-image", "q-audio")}
        ${open === q.id ? editor(q) : q.status === "answered" ? `<div class="qn-ans"><b>উত্তর${q.answeredBy ? " — " + esc(q.answeredBy) : ""}:</b>${q.answer ? `<p>${esc(q.answer).replace(/\n/g, "<br>")}</p>` : ""}${mediaHtml(q, "a-image", "a-audio", "a-video")}${q.yt ? `<p><a href="https://youtu.be/${esc(q.yt)}" target="_blank" rel="noopener">YouTube ভিডিও</a></p>` : ""}</div>` : ""}
        ${open === q.id ? "" : `<div class="qn-act"><button type="button" class="btn ${q.status === "answered" ? "line" : "gold"}" data-open="${q.id}">${q.status === "answered" ? "✎ উত্তর বদলান" : "উত্তর দিন"}</button></div>`}
      </article>`).join("") || `<p class="empty">${filter === "new" ? "নতুন কোনো প্রশ্ন নেই" : "কিছু নেই"}</p>`}</div></div>`;
  }

  const qOf = () => DB().qna.find((x) => x.id === open);
  const val = (f) => { const el = $(`[data-f="${f}"]`, C); return el ? (el.type === "checkbox" ? el.checked : el.value) : undefined; };
  const keep = () => { const q = qOf(); if (!q) return; q.answer = val("answer"); q.answeredBy = val("answeredBy"); q._yt = val("yt"); }; // রেন্ডারের আগে লেখা ধরে রাখা
  const call = async (path, opts) => { const r = await fetch(path, opts); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "সমস্যা হয়েছে"); return j; };

  async function save() {
    const q = qOf(); if (!q || busy) return;
    keep(); busy = true; render();
    try {
      try { localStorage.setItem(BY, q.answeredBy || ""); } catch {}
      await call(`/api/admin/qna/${q.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answer: q.answer, yt: q._yt, answeredBy: q.answeredBy }) });
      for (const [k, f] of Object.entries(pending)) await call(`/api/admin/qna/${q.id}/${k}`, { method: "POST", headers: { "Content-Type": (f.type || "").split(";")[0] }, body: f });
      pending = {}; open = ""; await X.load(); toast("উত্তর সেভ হয়েছে");
    } catch (e) { toast(e.message, true); await X.load().catch(() => {}); }
    busy = false; render();
  }

  async function toggleRec() {
    if (rec) { rec.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) return toast("এই ব্রাউজারে রেকর্ড করা যায় না — অডিও ফাইল বাছুন", true);
    let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return toast("মাইক্রোফোনের অনুমতি পাওয়া যায়নি", true); }
    const type = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t)) || "", chunks = [];
    keep();
    rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); const t = (rec.mimeType || type || "audio/webm").split(";")[0].replace(/^video\//, "audio/"); rec = null; if (chunks.length) pending["a-audio"] = new File(chunks, "রেকর্ড করা ভয়েস", { type: t }); keep(); render(); };
    rec.start(); render(); toast("রেকর্ড হচ্ছে — শেষ হলে \"রেকর্ড থামান\" চাপুন");
  }

  async function onClick(e) {
    const t = (s) => e.target.closest(s); let el;
    if ((el = t("[data-filter]"))) { filter = el.dataset.filter; return render(); }
    if ((el = t("[data-open]"))) { if (rec) return toast("আগে রেকর্ড থামান", true); open = el.dataset.open; pending = {}; return render(); }
    if (t("[data-close]")) { if (rec) rec.stop(); open = ""; pending = {}; await X.load(); return render(); }
    if (t("[data-save]")) return save();
    if (t("[data-rec]")) return toggleRec();
    if ((el = t("[data-unpend]"))) { keep(); delete pending[el.dataset.unpend]; return render(); }
    if ((el = t("[data-del-file]"))) {
      if (!confirm("এই ফাইলটা উত্তর থেকে মুছে ফেলবেন?")) return;
      keep(); const q = qOf();
      try { const r = await call(`/api/admin/qna/${q.id}/${el.dataset.delFile}`, { method: "DELETE" }); Object.assign(q, { files: r.item.files, status: r.item.status }); toast("মুছে ফেলা হয়েছে"); } catch (err) { toast(err.message, true); }
      return render();
    }
    if (t("[data-del-q]")) {
      if (!confirm("প্রশ্নটা আর এর সব ছবি / অডিও / ভিডিও পুরোপুরি মুছে ফেলবেন?")) return;
      try { await call(`/api/admin/qna/${open}`, { method: "DELETE" }); open = ""; pending = {}; await X.load(); toast("মুছে ফেলা হয়েছে"); } catch (err) { toast(err.message, true); }
      return render();
    }
  }
  function onChange(e) {
    const k = e.target.dataset && e.target.dataset.pick; if (!k) return;
    const f = e.target.files[0]; if (!f) return;
    const max = { "a-image": 8, "a-audio": 15, "a-video": 300 }[k];
    if (f.size > max * 1024 * 1024) return toast(`ফাইল অনেক বড় — ${bn(max)} MB-এর মধ্যে দিন`, true);
    keep(); pending[k] = f; render();
  }
  return function qnaPage(c) { C = c; c.onclick = onClick; c.onchange = onChange; render(); };
};
