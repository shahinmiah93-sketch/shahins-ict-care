// প্রশ্নোত্তর বক্স (মূল পাতার "প্রশ্ন ও উত্তর") — যে কেউ লেখা + ছবি + ভয়েস দিয়ে প্রশ্ন পাঠায়;
// নিচে "আমার প্রশ্ন" — শুধু নিজের প্রশ্ন আর শিক্ষকের উত্তর (লেখা / ছবি / অডিও / ভিডিও / YouTube মিলিয়ে), অন্য কেউ দেখে না
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = U.esc, bn = U.bn;
  const form = $("#qaForm");
  if (!form) return;
  const att = $("#qaAtt"), msg = $("#qaMsg"), sendBtn = $("#qaSend"), recBtn = $("#qaRec");
  let img = null, audio = null, imgUrl = "", audUrl = "", me = null, loadMine = () => {};

  // কে প্রশ্ন করছে: অতিথি অ্যাকাউন্ট বা ভর্তি হওয়া শিক্ষার্থী — লগইন ছাড়া প্রশ্ন পাঠানো যায় না
  const gate = $("#qaGate");
  const drawGate = () => {
    form.classList.toggle("locked", !me); loadMine();
    if (me?.kind === "guest") fetch("/api/qna/join", { method:"POST" }).catch(() => {});
    gate.innerHTML = me
      ? (me.kind === "guest" ? '<div class="qa-me"><button type="button" class="qa-link" data-qa-out>অতিথি লগআউট</button></div>' : "") // লগইন থাকলে নামের লেখা লাগে না — অতিথির জন্য শুধু লগআউট
      : `<div class="qa-login"><b>প্রশ্ন করতে লগইন করুন</b><small>মোবাইল নম্বরই আপনার আইডি — একবার অ্যাকাউন্ট খুললে PIN দিয়ে যখন খুশি লগইন করতে পারবেন</small>
          <div class="qa-login-btns"><button type="button" class="btn gold" data-qa-reg>নতুন অ্যাকাউন্ট খুলুন</button><button type="button" class="btn ghost" data-qa-in>অতিথি লগইন</button></div>
          <small>ভর্তি হওয়া শিক্ষার্থী? উপরের "লগইন" → "শিক্ষার্থী" দিয়ে ঢুকলেই প্রশ্ন করতে পারবেন।</small></div>`;
  };
  gate.addEventListener("click", async (e) => {
    if (e.target.closest("[data-qa-reg]")) return window.SICGuestLogin && SICGuestLogin("register");
    if (e.target.closest("[data-qa-in]")) return window.SICGuestLogin && SICGuestLogin("login");
    if (e.target.closest("[data-qa-out]")) { await fetch("/api/guest/logout", { method: "POST" }).catch(() => {}); me = null; drawGate(); window.dispatchEvent(new CustomEvent("sic-guest-out")); }
  });
  window.addEventListener("sic-guest-out", () => { me = null; drawGate(); });
  window.addEventListener("sic-guest", (e) => { me = { ...e.detail, kind: "guest" }; drawGate(); say(""); form.text.focus(); });
  (async () => {
    try { const g = await fetch("/api/guest/me").then((r) => r.json()); if (g.me) me = { ...g.me, kind: "guest" }; } catch {}
    if (!me) try { const r = await fetch("/api/student/me"); if (r.ok) { const s = await r.json(); me = { name: (s.profile && s.profile.name) || "শিক্ষার্থী", kind: "student" }; } } catch {}
    drawGate();
  })();

  const say = (t, bad) => { msg.textContent = t; msg.className = "qa-msg" + (t ? (bad ? " bad" : " ok") : ""); };
  const drawAtt = () => {
    att.innerHTML = (img ? `<div class="qa-chip img"><img src="${imgUrl}" alt=""><button type="button" data-rm="img" aria-label="ছবি সরান">✕</button></div>` : "")
      + (audio ? `<div class="qa-chip aud"><audio controls src="${audUrl}"></audio><button type="button" data-rm="aud" aria-label="ভয়েস সরান">✕</button></div>` : "");
  };
  const setImg = (f) => { if (imgUrl) URL.revokeObjectURL(imgUrl); img = f; imgUrl = f ? URL.createObjectURL(f) : ""; drawAtt(); };
  const setAud = (f) => { if (audUrl) URL.revokeObjectURL(audUrl); audio = f; audUrl = f ? URL.createObjectURL(f) : ""; drawAtt(); };
  att.addEventListener("click", (e) => { const b = e.target.closest("[data-rm]"); if (b) b.dataset.rm === "img" ? setImg(null) : setAud(null); });

  // বড় ছবি পাঠানোর আগে ছোট করা (লম্বা দিক ১৬০০ পিক্সেল, JPG) — GIF যেমন আছে তেমন
  const shrink = (f) => new Promise((ok) => {
    if (f.type === "image/gif" || f.size < 700 * 1024) return ok(f);
    const im = new Image(), u = URL.createObjectURL(f);
    im.onload = () => {
      const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight)), cv = document.createElement("canvas");
      cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k);
      const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(im, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(u); cv.toBlob((b) => ok(b && b.size < f.size ? new File([b], "photo.jpg", { type: "image/jpeg" }) : f), "image/jpeg", 0.85);
    };
    im.onerror = () => { URL.revokeObjectURL(u); ok(f); };
    im.src = u;
  });
  $("#qaImg").addEventListener("change", async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) return say("শুধু JPG, PNG, WEBP বা GIF ছবি দিন", true);
    const s = await shrink(f);
    if (s.size > 8 * 1024 * 1024) return say("ছবিটা অনেক বড় — ৮ MB-এর মধ্যে দিন", true);
    say(""); setImg(s);
  });
  $("#qaAudFile").addEventListener("change", (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) return say("অডিওটা অনেক বড় — ১৫ MB-এর মধ্যে দিন", true);
    say(""); setAud(f);
  });

  // ভয়েস রেকর্ড — একবার চাপলে শুরু, আবার চাপলে থামে (সর্বোচ্চ ৩ মিনিট)
  let rec = null, chunks = [], tick = 0, started = 0;
  const recLabel = $("span", recBtn);
  const stopRec = () => { if (rec && rec.state !== "inactive") rec.stop(); };
  recBtn.addEventListener("click", async () => {
    if (rec && rec.state === "recording") return stopRec();
    if (!navigator.mediaDevices || !window.MediaRecorder) return say("এই ব্রাউজারে রেকর্ড করা যায় না — \"অডিও ফাইল\" দিয়ে রেকর্ড করা ফাইল দিন", true);
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { return say("মাইক্রোফোনের অনুমতি পাওয়া যায়নি — ব্রাউজারে মাইক চালু করার অনুমতি দিন", true); }
    const type = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
    rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined); chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      clearInterval(tick); stream.getTracks().forEach((t) => t.stop());
      recBtn.classList.remove("on"); recLabel.textContent = "ভয়েস রেকর্ড";
      const t = (rec.mimeType || type || "audio/webm").split(";")[0].replace(/^video\//, "audio/");
      if (chunks.length) setAud(new File(chunks, "voice", { type: t }));
    };
    rec.start(); started = Date.now(); say("");
    recBtn.classList.add("on");
    const show = () => { const s = Math.floor((Date.now() - started) / 1000); recLabel.textContent = `থামান · ${bn(Math.floor(s / 60))}:${bn(String(s % 60).padStart(2, "0"))}`; if (s >= 180) stopRec(); };
    show(); tick = setInterval(show, 500);
  });

  // জমা: আগে প্রশ্ন (লেখা), তারপর ছবি / ভয়েস সেই প্রশ্নের সাথে
  const upload = async (id, token, kind, file) => {
    const r = await fetch(`/api/qna/${encodeURIComponent(id)}/${kind}?t=${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": (file.type || "").split(";")[0] }, body: file });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "ফাইল জমা হয়নি");
  };
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (rec && rec.state === "recording") return say("আগে ভয়েস রেকর্ড থামান", true);
    if (!me) { say("প্রশ্ন করতে আগে লগইন করুন", true); return SICGuestLogin && SICGuestLogin("login"); }
    const fd = new FormData(form), text = String(fd.get("text") || "").trim();
    if (!text && !img && !audio) return say("প্রশ্নটা লিখুন, অথবা ছবি / ভয়েস দিন", true);
    sendBtn.disabled = true; say("পাঠানো হচ্ছে…");
    try {
      const r = await U.api("/api/qna", { body: { text, website: fd.get("website"), hasMedia: !!(img || audio) } });
      if (r.id) {
        if (img) await upload(r.id, r.token, "q-image", img);
        if (audio) await upload(r.id, r.token, "q-audio", audio);
      }
      form.reset(); setImg(null); setAud(null);
      say("ধন্যবাদ! আপনার প্রশ্ন শিক্ষকের কাছে পৌঁছেছে। উত্তর দিলে নিচে \"আমার প্রশ্ন\"-তে দেখতে পাবেন।"); loadMine();
    } catch (err) { say(err.message || "পাঠানো যায়নি, আবার চেষ্টা করুন", true); if (/লগইন/.test(err.message || "")) { me = null; drawGate(); } }
    sendBtn.disabled = false;
  });

  // উত্তর পাওয়া প্রশ্ন — প্রথমে ৫টা, "আরও দেখুন" চাপলে বাকিগুলো
  const list = $("#qaList");
  const media = (x) => `${x.img ? `<a class="qa-pic" href="${esc(x.img)}" target="_blank" rel="noopener"><img src="${esc(x.img)}" alt="" loading="lazy"></a>` : ""}${x.audio ? `<audio controls preload="none" src="${esc(x.audio)}"></audio>` : ""}`;
  const card = (q) => {
    const a = q.answer;
    if (q.status !== "answered") return `<article class="qa-item">
      <div class="qa-q"><span class="qa-av" aria-hidden="true">?</span><div class="qa-body">
        <div class="qa-meta"><b>আপনার প্রশ্ন</b>${q.date ? `<small>${esc(U.date(q.date))}</small>` : ""}<span class="qa-wait">উত্তরের অপেক্ষায়</span></div>
        ${q.text ? `<p>${esc(q.text).replace(/\n/g, "<br>")}</p>` : ""}${media(q)}</div></div></article>`;
    return `<article class="qa-item">
      <div class="qa-q"><span class="qa-av" aria-hidden="true">?</span><div class="qa-body">
        <div class="qa-meta"><b>আপনার প্রশ্ন</b>${q.date ? `<small>${esc(U.date(q.date))}</small>` : ""}</div>
        ${q.text ? `<p>${esc(q.text).replace(/\n/g, "<br>")}</p>` : ""}${media(q)}</div></div>
      <div class="qa-a"><span class="qa-av t" aria-hidden="true">✓</span><div class="qa-body">
        <div class="qa-meta"><b>${esc(a.by || "শিক্ষকের উত্তর")}</b>${a.by ? "<small>শিক্ষকের উত্তর</small>" : ""}</div>
        ${a.text ? `<p>${esc(a.text).replace(/\n/g, "<br>")}</p>` : ""}${media(a)}
        ${a.video ? `<video controls preload="metadata" src="${esc(a.video)}"></video>` : ""}
        ${a.yt ? `<button type="button" class="qa-yt" data-yt="${esc(a.yt)}" style="background-image:url(https://i.ytimg.com/vi/${esc(a.yt)}/hqdefault.jpg)" aria-label="ভিডিও উত্তর চালান"><i></i></button>` : ""}
      </div></div></article>`;
  };
  let items = [], all = false;
  const draw = () => {
    list.innerHTML = items.length ? `<h3 class="qa-title">আমার প্রশ্ন <small>${bn(items.length)}টি</small></h3>${(all ? items : items.slice(0, 5)).map(card).join("")}${!all && items.length > 5 ? `<p class="qa-more"><button type="button" class="btn ghost" data-qa-more>আরও দেখুন (${bn(items.length - 5)}টি)</button></p>` : ""}` : "";
  };
  list.addEventListener("click", (e) => {
    if (e.target.closest("[data-qa-more]")) { all = true; return draw(); }
    const y = e.target.closest("[data-yt]");
    if (y) y.outerHTML = `<div class="qa-ytf"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(y.dataset.yt)}?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="ভিডিও উত্তর"></iframe></div>`;
  });
  // নিজের প্রশ্ন — লগইন হলে / প্রশ্ন পাঠালে আবার আনে; লগআউট হলে খালি
  loadMine = () => (me ? U.api("/api/qna/mine").then((r) => { items = r.items || []; draw(); }).catch(() => {}) : ((items = []), draw()));
  loadMine();
})();
