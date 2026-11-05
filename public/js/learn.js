// ফ্রি ক্লাস আর অনলাইন কোর্সের পাতা — একই ফাইল, ঠিকানা দেখে কোনটা:
//   /free-classes — সব ফ্রি ক্লাস (বিষয় অনুযায়ী বাছা যায়), চাপ দিলে পপআপে চলে
//   /courses      — সব অনলাইন কোর্স + আমার কোর্স + মোবাইল ও PIN দিয়ে ঢোকা
//   /course?id=   — কোর্সের বিস্তারিত, ভর্তির ফর্ম; ভর্তি (অনুমোদিত) হলে ক্রম অনুযায়ী ভিডিও ক্লাস
(async function () {
  const { $, $$, esc, bn } = U;
  const KLASS = ["নবম শ্রেণি", "দশম শ্রেণি", "একাদশ শ্রেণি", "দ্বাদশ শ্রেণি", "HSC পরীক্ষার্থী", "অন্যান্য"];
  const enDigits = (s) => String(s || "").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d));
  const cleanPhone = (s) => enDigits(s).replace(/\D/g, "").replace(/^88/, "");
  const pane = $("#pane"), side = $("#side"), mainEl = $("#lMain");
  const path = location.pathname.replace(/\/+$/, "");
  let PUB, SITE;

  try {
    PUB = await U.api("/api/public"); SITE = PUB.settings;
    $$("[data-s=name]").forEach((el) => (el.textContent = SITE.name));
    $("#year").textContent = bn(new Date().getFullYear());
    $("#footAddr").textContent = [SITE.address, SITE.phone].filter(Boolean).join(" · ");
    if (SITE.phone) { $("#navPhone").href = "tel:" + SITE.phone; $("#navPhone span").textContent = SITE.phone; } else $("#navPhone").hidden = true;
  } catch { pane.innerHTML = '<p class="sub">সার্ভার চালু নেই। কিছুক্ষণ পরে চেষ্টা করুন।</p>'; return; }
  const full = (on) => { mainEl.classList.toggle("qp-full", on); side.hidden = on; };

  // ---------- মোবাইল + PIN দিয়ে ঢোকা (সব পাতায়) ----------
  const loginHtml = (title = "আগে ভর্তি হয়েছেন? ঢুকুন") => `<h2 id="login">${title}</h2><p class="sub">ভর্তির সময় পাওয়া ৪ সংখ্যার PIN আর মোবাইল নম্বর দিন।</p>
    <form class="form qp-form" id="loginForm" novalidate style="grid-template-columns:1fr">
      <label>মোবাইল নম্বর<input name="phone" inputmode="tel" placeholder="01XXXXXXXXX" autocomplete="tel"></label>
      <label>PIN<input name="pin" inputmode="numeric" maxlength="4" placeholder="৪ সংখ্যা" autocomplete="current-password"></label>
      <p class="form-msg bad" id="loginErr"></p><div class="qp-acts"><button class="btn gold" type="submit">ঢুকুন</button></div></form>
    <p class="qp-note">PIN ভুলে গেলে অফিসে ফোন করুন${SITE.phone ? ` (${esc(SITE.phone)})` : ""}।</p>`;
  async function doLogin(f) {
    const err = $("#loginErr"), body = { phone: cleanPhone(f.phone.value), pin: enDigits(f.pin.value) };
    err.textContent = "";
    if (!/^01\d{9}$/.test(body.phone) || !/^\d{4}$/.test(body.pin)) return (err.textContent = "সঠিক মোবাইল আর ৪ সংখ্যার PIN দিন");
    try { await U.api("/api/learn/login", { body }); location.reload(); } catch (e) { err.textContent = e.message; }
  }
  const meHtml = (me) => `<h2>আমার অ্যাকাউন্ট</h2><dl class="qp-me"><dt>নাম</dt><dd>${esc(me.name)}</dd><dt>মোবাইল</dt><dd>${esc(me.phone)}</dd></dl>
    <p class="qp-acts"><a class="btn ghost dark sm" href="/courses">আমার কোর্স</a><button type="button" class="btn ghost dark sm" data-logout>⎋ বের হোন</button></p>`;
  document.addEventListener("submit", (e) => { if (e.target.id === "loginForm") { e.preventDefault(); doLogin(e.target); } });
  document.addEventListener("click", async (e) => { if (e.target.closest("[data-logout]")) { await U.api("/api/learn/logout", { body: {} }).catch(() => {}); location.reload(); } });

  // ================= /free-classes =================
  if (path === "/free-classes") {
    document.body.classList.add("free-class-page");
    const FC = PUB.freeClasses || [], subs = [...new Set(FC.map((c) => c.subject).filter(Boolean))];
    document.title = `ফ্রি ক্লাস — ${SITE.name}`;
    $("#lhEye").textContent = "বিনামূল্যে শেখো"; $("#lhTitle").textContent = "সব ফ্রি ক্লাস";
    $("#lhLead").textContent = FC.length ? "যে কেউ দেখতে পারবে — চাপ দিলেই ক্লাস শুরু।" : "এখনো কোনো ফ্রি ক্লাস দেওয়া হয়নি।";
    $("#lhMeta").innerHTML = `<span>🎬 ${bn(FC.length)}টি ক্লাস</span>`;
    full(true);
    let sub = "";
    const draw = () => {
      const list = FC.map((c, i) => [c, i]).filter(([c]) => !sub || c.subject === sub);
      pane.innerHTML = `${subs.length > 1 ? `<div class="ap-tabs" style="flex-wrap:wrap">${["", ...subs].map((s) => `<button type="button" data-sub="${esc(s)}" class="${sub === s ? "on" : ""}">${s ? esc(s) : "সব"}</button>`).join("")}</div>` : ""}
        <div class="fc-grid">${list.map(([c, i]) => U.fcCard(c, i).replace(" reveal", "")).join("") || '<p class="sub">কোনো ক্লাস নেই</p>'}</div>`;
    };
    pane.addEventListener("click", (e) => {
      const s = e.target.closest("[data-sub]"); if (s) { sub = s.dataset.sub; return draw(); }
      const b = e.target.closest("[data-fc]"); if (b) { const c = FC[Number(b.dataset.fc)]; U.playVideo(c.video, c.title); }
    });
    return draw();
  }

  // পুরোনো অনলাইন কোর্সের পাতা আর নেই — রেকর্ড ক্লাস এখন অনলাইন কোর্স মডিউলের ভেতরে (ভর্তি হলে শিক্ষার্থী প্যানেলে)
  if (path === "/courses" || path === "/course") { location.replace("/#online-programs"); return; }

  // ================= /courses =================
  if (path === "/courses") {
    const OC = PUB.onlineCourses || [], my = await U.api("/api/learn/me").catch(() => ({ me: null }));
    document.title = `অনলাইন কোর্স — ${SITE.name}`;
    $("#lhTitle").textContent = "আমাদের অনলাইন কোর্সসমূহ";
    $("#lhLead").textContent = "কোর্সে ভর্তি হলে ভেতরে ক্রম অনুযায়ী সব ভিডিও ক্লাস দেখতে পারবেন।";
    $("#lhMeta").innerHTML = `<span>💻 ${bn(OC.length)}টি কোর্স</span>${my.me ? `<span>👤 ${esc(my.me.name)}</span>` : ""}`;
    pane.innerHTML = `${my.me && my.courses.length ? `<h2>📚 আমার কোর্স</h2><div class="lc-my">${my.courses.map((c) => `<a class="lc-myc" href="/course?id=${encodeURIComponent(c.id)}">${c.cover ? `<img src="${esc(c.cover)}" alt="">` : ""}<span><b>${esc(c.title)}</b><small>${c.status === "active" ? `▶ ${bn(c.lessons)}টি ক্লাস — দেখুন` : "⏳ অনুমোদনের অপেক্ষায়"}</small></span></a>`).join("")}</div><h2 style="margin-top:22px">সব কোর্স</h2>` : ""}
      <div class="oc-grid">${OC.map((c) => U.ocCard(c).replace(" reveal", "")).join("") || '<p class="sub">এখনো কোনো অনলাইন কোর্স নেই।</p>'}</div>`;
    side.innerHTML = my.me ? meHtml(my.me) : loginHtml();
    return;
  }

  // ================= /course?id= =================
  const id = new URLSearchParams(location.search).get("id");
  let D;
  try { D = await U.api(`/api/learn/course?id=${encodeURIComponent(id || "")}`); }
  catch (e) { $("#lhTitle").textContent = "কোর্সটি পাওয়া যায়নি"; $("#lhLead").textContent = ""; pane.innerHTML = '<p class="qp-acts" style="justify-content:flex-start"><a class="btn gold" href="/courses">সব কোর্স দেখুন</a></p>'; full(true); return; }
  const C = D.course;
  document.title = `${C.title} — ${SITE.name}`;
  $("#lhTitle").textContent = C.title; $("#lhLead").textContent = C.subtitle || "";
  $("#lhMeta").innerHTML = [C.duration && `⏱ ${esc(C.duration)}`, `🎬 ${bn(C.lessons)}টি ক্লাস`, `👥 ${bn(C.enrolled)} জন ভর্তি`, C.access === "approval" ? "✅ ভর্তির পর অনুমোদন" : "⚡ ভর্তি হলেই সাথে সাথে ক্লাস"].filter(Boolean).map((t) => `<span>${t}</span>`).join("");
  const L = await U.api(`/api/learn/lessons?id=${encodeURIComponent(C.id)}`).catch(() => ({ open: false, lessons: [] }));

  // ---------- ভর্তি হলে: প্লেয়ার + ক্রম অনুযায়ী ক্লাস ----------
  if (L.open) {
    full(true);
    let cur = Math.max(0, Number(localStorage.getItem(`lc_${C.id}`) || 0) || 0);
    if (cur >= L.lessons.length) cur = 0;
    const draw = () => {
      const l = L.lessons[cur];
      pane.innerHTML = L.lessons.length ? `<div class="lc-player"><div class="lc-screen">${l && l.video ? U.videoEmbed(l.video, false) : '<p class="sub" style="color:#fff;padding:20px">এই ক্লাসের ভিডিও এখনো দেওয়া হয়নি</p>'}</div>
          <div class="lc-now"><small>ক্লাস ${bn(cur + 1)}/${bn(L.lessons.length)}</small><b>${esc(l.title)}</b>
            <span class="qp-acts" style="justify-content:flex-start;margin:6px 0 0"><button type="button" class="btn ghost dark sm" data-go="${cur - 1}"${cur ? "" : " disabled"}>‹ আগের ক্লাস</button><button type="button" class="btn gold sm" data-go="${cur + 1}"${cur < L.lessons.length - 1 ? "" : " disabled"}>পরের ক্লাস ›</button></span></div></div>
        <div class="lc-list"><h3>📋 কোর্সের ক্লাসগুলো</h3><ol>${L.lessons.map((x, i) => `<li><button type="button" data-go="${i}" class="${i === cur ? "on" : ""}"><span>${bn(i + 1)}</span>${esc(x.title)}${x.video ? "" : " <small>(শীঘ্রই)</small>"}</button></li>`).join("")}</ol></div>`
        : '<p class="sub">এই কোর্সে এখনো কোনো ক্লাস দেওয়া হয়নি — শীঘ্রই আসবে।</p>';
    };
    pane.addEventListener("click", (e) => { const b = e.target.closest("[data-go]"); if (b && !b.disabled) { cur = Number(b.dataset.go); try { localStorage.setItem(`lc_${C.id}`, cur); } catch {} draw(); pane.scrollIntoView({ behavior: "smooth" }); } });
    return draw();
  }

  // ---------- ভর্তি হয়নি / অনুমোদন বাকি: বিস্তারিত + ভর্তির ফর্ম ----------
  const lessonRows = () => `<ol class="lc-lock">${L.lessons.map((x, i) => `<li>${x.video ? `<button type="button" data-pv="${i}">▶ ${esc(x.title)} <small>ফ্রি প্রিভিউ</small></button>` : `<span>🔒 ${esc(x.title)}</span>`}</li>`).join("")}</ol>`;
  function enrollHtml() {
    if (D.status === "pending") return `<div class="lc-status"><span class="qp-chip warn">⏳ ভর্তির অনুরোধ জমা হয়েছে</span><p class="sub">অফিস থেকে ফোন করে নিশ্চিত করা হবে। অনুমোদন হলেই এই পাতায় সব ক্লাস খুলে যাবে।</p></div>`;
    if (D.me) return `<h2 id="enroll">কোর্সে ভর্তি হোন</h2><p class="sub">${esc(D.me.name)} (${esc(D.me.phone)}) হিসেবে ভর্তি হবেন।</p><form id="enrollForm" class="form qp-form" novalidate><div class="wide qp-acts" style="justify-content:flex-start"><button class="btn oc-buy" type="submit">✓ ভর্তি নিশ্চিত করুন</button></div><p class="form-msg bad" id="enErr"></p></form>`;
    return `<h2 id="enroll">কোর্সে ভর্তি হোন</h2><p class="sub">${C.access === "approval" ? "ফর্ম জমা দিলে অফিস থেকে ফোন করে ভর্তি নিশ্চিত করা হবে; তারপর ক্লাস খুলবে।" : "ফর্ম জমা দিলেই সাথে সাথে সব ক্লাস খুলে যাবে।"} একটা ৪ সংখ্যার PIN পাবেন — পরে মোবাইল আর PIN দিয়ে ঢুকবেন।</p>
      <form class="form qp-form" id="enrollForm" novalidate>
        <label class="wide"><span>শিক্ষার্থীর নাম <span class="req">*</span></span><input name="name" autocomplete="name" placeholder="পুরো নাম"></label>
        <label><span>মোবাইল নম্বর <span class="req">*</span></span><input name="phone" inputmode="tel" autocomplete="tel" placeholder="01XXXXXXXXX"></label>
        <label>শ্রেণি<select name="klass"><option value="">বেছে নিন</option>${KLASS.map((k) => `<option>${esc(k)}</option>`).join("")}</select></label>
        <label class="wide">প্রতিষ্ঠানের নাম<input name="college" placeholder="আপনার স্কুল / কলেজ"></label>
        <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <p class="form-msg bad" id="enErr"></p><div class="wide qp-acts"><button class="btn oc-buy" type="submit">✓ ভর্তি হোন</button></div></form>`;
  }
  function draw() {
    pane.innerHTML = `${C.cover ? `<img class="lc-cover" src="${esc(C.cover)}" alt="${esc(C.title)}">` : `<div class="lc-cover">${U.autoPoster(C.title, C.subtitle, [C.duration && "⏱ " + C.duration, C.lessons && "🎬 " + bn(C.lessons) + "টি ক্লাস"].filter(Boolean).join("  ·  "), "oc", C)}</div>`}
      ${C.description ? `<h2>কোর্স সম্পর্কে</h2><p class="lc-desc">${esc(C.description)}</p>` : ""}
      ${C.features.length ? `<h3 style="margin-top:14px">এই কোর্সে যা পাবেন</h3><ul class="lc-feat">${C.features.map((f) => `<li>✓ ${esc(f)}</li>`).join("")}</ul>` : ""}
      <h3 style="margin-top:14px">📋 কোর্সের ক্লাসগুলো (${bn(L.lessons.length)}টি)</h3>${lessonRows()}
      <div class="lc-enroll">${enrollHtml()}</div>`;
    side.innerHTML = `<h2>কোর্স ফি</h2><div class="oc-price lc-bigprice">${U.ocPrice(C)}</div>${C.duration ? `<p class="sub" style="margin:4px 0 12px">⏱ ${esc(C.duration)}</p>` : ""}
      ${D.status ? "" : '<p><a class="btn oc-buy" href="#enroll" style="width:100%">ভর্তি হোন</a></p>'}
      ${D.me ? meHtml(D.me) : loginHtml()}`;
  }
  pane.addEventListener("click", (e) => { const b = e.target.closest("[data-pv]"); if (b) { const x = L.lessons[Number(b.dataset.pv)]; U.playVideo(x.video, x.title); } });
  pane.addEventListener("submit", async (e) => {
    if (e.target.id !== "enrollForm") return;
    e.preventDefault();
    const f = e.target, err = $("#enErr"), btn = $('button[type="submit"]', f), body = { courseId: C.id };
    if (f.name) Object.assign(body, { name: f.name.value.trim(), phone: cleanPhone(f.phone.value), klass: f.klass.value, college: f.college.value.trim(), website: f.website.value });
    err.textContent = "";
    if (f.name && (body.name.length < 2 || !/^01\d{9}$/.test(body.phone))) return (err.textContent = "নাম আর সঠিক মোবাইল নম্বর (01XXXXXXXXX) দিন");
    btn.disabled = true;
    try {
      const r = await U.api("/api/learn/enroll", { body });
      $(".lc-enroll").innerHTML = `<div class="lc-status"><span class="qp-chip ok">✓ ${r.status === "active" ? "ভর্তি সম্পন্ন" : "ভর্তির অনুরোধ জমা হয়েছে"}</span>
        ${r.pin ? `<div class="th-roll"><small>আপনার PIN — লিখে রাখুন</small><b>${esc(r.pin)}</b></div><p class="sub">পরে আবার ঢুকতে মোবাইল নম্বর আর এই PIN লাগবে।${r.smsSent ? " আপনার মোবাইলেও SMS-এ পাঠানো হয়েছে।" : ""}</p>` : ""}
        <p class="sub">${r.status === "active" ? "এখনই সব ক্লাস দেখতে পারবেন।" : "অফিস থেকে ফোন করে নিশ্চিত করা হবে; অনুমোদন হলেই এই পাতায় ক্লাস খুলবে।"}</p>
        ${r.status === "active" ? '<p class="qp-acts" style="justify-content:flex-start"><button type="button" class="btn gold" onclick="location.reload()">▶ ক্লাস শুরু করুন</button></p>' : ""}</div>`;
    } catch (er) {
      err.textContent = er.message; btn.disabled = false;
      if (/PIN/.test(er.message)) { const lf = $("#loginForm"); if (lf) { lf.phone.value = body.phone || ""; lf.pin.focus(); lf.scrollIntoView({ behavior: "smooth", block: "center" }); } }
    }
  });
  draw();
  if (location.hash === "#enroll") setTimeout(() => { const el = $("#enroll"); if (el) el.scrollIntoView({ behavior: "smooth" }); }, 200);
})();
