// অনলাইন কুইজ পেজ (/quiz) — ব্যাচের বাইরের শিক্ষার্থী অতিথি অ্যাকাউন্টে (মোবাইল = আইডি, PIN; SMS চালু থাকলে কোড দিয়ে যাচাই) লগইন করে
// "সবার জন্য খোলা" কুইজ দেয়। একই অ্যাকাউন্টে আবার এলে আগের তথ্য ও আগের নম্বর থাকে। নম্বর সার্ভারে গোনা হয়।
(async function () {
  const { $, $$, esc, bn } = U;
  const L = ["ক", "খ", "গ", "ঘ", "ঙ", "চ"];
  const n2 = (x) => bn(String(Math.round(x * 100) / 100));
  const enDigits = (s) => String(s || "").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d));
  const dt = (s) => (s ? new Date(s).toLocaleString("bn-BD", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }) : "");
  const keyOf = (id, no) => `sicGQuiz_${id}_${no}`;
  const pane = $("#pane"), side = $("#side"), wrap = $(".qp-wrap");
  let P = null, QR = null, editing = false;
  window.SIC_GUEST_STAY = true; // অতিথি লগইনের পরে এই পাতাতেই থাকা
  window.addEventListener("sic-guest", () => { editing = false; load(); });
  window.addEventListener("sic-guest-out", () => load());

  try {
    const S = (await U.api("/api/public")).settings;
    $$("[data-s=name]").forEach((el) => (el.textContent = S.name));
    $("#year").textContent = bn(new Date().getFullYear());
    $("#footAddr").textContent = [S.address, S.phone].filter(Boolean).join(" · ");
    if (S.phone) { $("#navPhone").href = "tel:" + S.phone; $("#navPhone span").textContent = S.phone; } else $("#navPhone").hidden = true;
  } catch { pane.innerHTML = '<p class="sub">সার্ভার চালু নেই। কিছুক্ষণ পরে চেষ্টা করো।</p>'; return; }

  async function load() { P = await U.api("/api/quiz/public"); draw(); }
  function full(on) { wrap.classList.toggle("qp-full", on); side.hidden = on; }

  // ---------- ফর্ম ----------
  // লগইন না থাকলে: অতিথি অ্যাকাউন্ট (মোবাইল = আইডি, PIN; SMS চালু থাকলে কোড দিয়ে যাচাই) — প্রশ্নোত্তর বক্সের একই অ্যাকাউন্ট
  function gateHtml() {
    return `<h2>কুইজ দিতে লগইন করো</h2><p class="sub">মোবাইল নম্বরই তোমার আইডি। একবার অ্যাকাউন্ট খুললে PIN দিয়ে যখন খুশি লগইন করে কুইজ দিতে পারবে, আগের নম্বরও থাকবে।</p>
      <div class="qp-acts qp-gate"><button type="button" class="btn gold" data-greg>নতুন অ্যাকাউন্ট খোলো</button><button type="button" class="btn ghost dark" data-gin>অতিথি লগইন</button></div>
      <p class="sub" style="margin-top:10px">আগে এই পাতার ফর্ম দিয়ে কুইজ দিয়ে থাকলে "নতুন অ্যাকাউন্ট খোলো" থেকে একই মোবাইল নম্বরে একবার PIN বেছে নাও — আগের নম্বর থেকে যাবে।</p>`;
  }
  function formHtml() {
    if (!P.me) return gateHtml();
    const me = P.me || {};
    const sel = (name, list, v) => `<select name="${name}" required><option value="">বেছে নাও</option>${list.map((x) => `<option${x === v ? " selected" : ""}>${esc(x)}</option>`).join("")}</select>`;
    return `<h2>${P.me ? "তোমার তথ্য বদলাও" : "কুইজ দিতে ছোট ফর্মটা পূরণ করো"}</h2><p class="sub">একবার পূরণ করলেই হবে — পরে একই মোবাইল নম্বর দিলে আগের নম্বরগুলো দেখতে পাবে।</p>
      <form class="form qp-form" id="joinForm" novalidate>
        <label class="wide"><span>শিক্ষার্থীর নাম <span class="req">*</span></span><input name="name" value="${esc(me.name || "")}" required autocomplete="name" placeholder="পুরো নাম"></label>
        <label><span>মোবাইল <span class="req">*</span></span><input name="phone" value="${esc(me.phone || "")}" readonly title="মোবাইল নম্বর তোমার আইডি — বদলানো যায় না"></label>
        <label><span>এইচএসসি ব্যাচ <span class="req">*</span></span>${sel("hsc", P.hsc, me.hsc)}</label>
        <label><span>গ্রুপ <span class="req">*</span></span>${sel("group", P.groups, me.group)}</label>
        <label><span>কলেজ <span class="req">*</span></span><input name="college" value="${esc(me.college || "")}" required placeholder="কলেজের নাম"></label>
        <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <p class="form-msg bad" id="joinErr"></p>
        <div class="wide qp-acts">${P.me ? '<button type="button" class="btn ghost dark" data-cancel>বাতিল</button>' : ""}<button class="btn gold" type="submit">${P.me ? "✓ সেভ করো" : "▶ কুইজে প্রবেশ করো"}</button></div>
      </form>`;
  }
  // ---------- কুইজের তালিকা ----------
  function card(q) {
    const best = q.myAttempts.length ? q.myAttempts.reduce((a, b) => (b.score > a.score ? b : a)) : null;
    return `<li class="qp-q"><div class="qp-qh"><b>🧠 ${esc(q.title)}</b>${best ? `<span class="qp-chip ok">${n2(best.score)}/${n2(best.full)}</span>` : ""}</div>
      <p>${[q.subject, q.chapter].filter(Boolean).map(esc).join(" · ")}${q.subject || q.chapter ? " · " : ""}${bn(q.count)}টি প্রশ্ন · ${bn(q.duration)} মিনিট · পূর্ণমান ${n2(q.full)} · ${q.negative ? `<b class="qp-neg">প্রতি ভুলে −${n2(q.negValue)}</b>` : "নেগেটিভ মার্কিং নেই"}</p>
      <p class="qp-time">${q.state === "upcoming" ? `শুরু হবে: <b>${dt(q.opensAt)}</b>` : q.closesAt ? `শেষ: ${dt(q.closesAt)}` : ""}${q.attemptsAllowed > 1 ? ` · ${bn(q.attemptsAllowed)} বার দেওয়া যাবে (দিয়েছ ${bn(q.myAttempts.length)})` : ""}</p>
      ${P.me ? `<p class="qp-acts">${q.canStart ? `<button class="btn gold sm" data-qstart="${q.id}">${q.inProgress ? "▶ চালিয়ে যাও" : q.myAttempts.length ? "↻ আবার দাও" : "▶ শুরু করো"}</button>` : ""}${q.myAttempts.length && q.showAnswers ? `<button class="btn ghost dark sm" data-qreview="${q.id}">✅ উত্তর দেখো</button>` : ""}</p>` : ""}</li>`;
  }
  function listHtml() {
    const open = P.quizzes.filter((q) => q.state === "open"), up = P.quizzes.filter((q) => q.state === "upcoming"), past = P.quizzes.filter((q) => q.state === "closed" && q.myAttempts.length);
    const block = (t, l, none) => `<h2 class="qp-h">${t}</h2>${l.length ? `<ul class="qp-list">${l.map(card).join("")}</ul>` : none ? `<p class="sub">${none}</p>` : ""}`;
    return block("চলমান কুইজ", open, "এখন কোনো কুইজ চলছে না — পরে আবার দেখো।") + (up.length ? block("সামনের কুইজ", up) : "") + (past.length ? block("যে কুইজগুলো দিয়েছ", past) : "");
  }
  function sideHtml() {
    // কুইজ না থাকলে পাশে আর "কুইজ নেই" লেখা হয় না — মূল অংশেই একবার বলা আছে
    if (!P.me) return `${P.quizzes.filter((q) => q.state !== "closed").length ? `<h2>এখন যে কুইজ চলছে</h2><ul class="qp-mini">${P.quizzes.filter((q) => q.state !== "closed").map((q) => `<li><b>${esc(q.title)}</b><small>${bn(q.count)}টি প্রশ্ন · ${bn(q.duration)} মিনিট${q.state === "upcoming" ? ` · শুরু ${dt(q.opensAt)}` : " · 🟢 চলছে"}</small></li>`).join("")}</ul>` : ""}
      <p class="qp-note">ব্যাচের শিক্ষার্থী? <a href="/student">শিক্ষার্থী প্যানেলে লগইন</a> করে কুইজ দাও — নম্বর তোমার প্রোফাইলে জমা হবে।</p>`;
    const m = P.me;
    return `<h2>তুমি</h2><dl class="qp-me"><dt>নাম</dt><dd>${esc(m.name)}</dd><dt>আইডি</dt><dd>${esc(m.id)}</dd><dt>মোবাইল</dt><dd>${esc(m.phone)}</dd><dt>ব্যাচ</dt><dd>${esc(m.hsc)} · ${esc(m.group)}</dd><dt>কলেজ</dt><dd>${esc(m.college)}</dd></dl>
      <p class="qp-acts"><button type="button" class="btn ghost dark sm" data-edit>✎ তথ্য বদলাও</button><button type="button" class="btn ghost dark sm" data-logout>⎋ বের হও</button></p>
      <p class="qp-note">ব্যাচের শিক্ষার্থী? <a href="/student">শিক্ষার্থী প্যানেলে লগইন</a> করো।</p>`;
  }
  function draw() {
    full(false);
    pane.innerHTML = !P.me || editing ? formHtml() + (!P.me ? `<div class="qp-preview">${listHtml()}</div>` : "") : listHtml();
    side.innerHTML = sideHtml();
  }

  // ---------- কুইজ দেওয়া (শিক্ষার্থী প্যানেলের মতোই) ----------
  async function startQuiz(id) {
    try {
      const d = await U.api("/api/quiz/start", { body: { id } });
      let saved = {}; try { saved = JSON.parse(localStorage.getItem(keyOf(id, d.attemptNo)) || "{}"); } catch {}
      QR = { id, d, answers: saved, skew: Date.now() - d.now, done: false };
      drawQuiz(); QR.timer = setInterval(tick, 1000); tick();
      scrollTo({ top: pane.offsetTop - 90, behavior: "smooth" });
    } catch (e) { alert(e.message); }
  }
  function drawQuiz() {
    const { d, answers } = QR; full(true);
    pane.innerHTML = `<div class="qr"><div class="qr-top"><div><h2>🧠 ${esc(d.title)}</h2><p>${bn(d.questions.length)}টি প্রশ্ন · প্রতিটি ${n2(d.mark)} নম্বর · ${d.negative ? `<b class="qp-neg">প্রতি ভুলে −${n2(d.negValue)}</b> — না জানলে ফাঁকা রাখো` : "নেগেটিভ মার্কিং নেই"}</p></div><div class="qr-timer" id="qrTimer">--:--</div></div>
      <div class="qr-prog"><i id="qrBar"></i></div><p class="qr-cnt" id="qrCnt"></p>
      <ol class="qr-qs">${d.questions.map((q, i) => `<li data-q="${q.id}"><b>${bn(i + 1)}. ${esc(q.text)}</b><div class="qr-os">${q.options.map((o, j) => `<button type="button" data-a="${j}" class="${answers[q.id] === j ? "on" : ""}"><span>${L[j]}</span>${esc(o)}</button>`).join("")}</div>${answers[q.id] !== undefined ? '<button type="button" class="qr-clear" data-clear>উত্তর মুছো</button>' : ""}</li>`).join("")}</ol>
      <p style="text-align:center"><button class="btn gold" data-qsubmit>✓ জমা দাও</button></p></div>`;
    count();
  }
  function count() { const n = Object.keys(QR.answers).length, t = QR.d.questions.length; $("#qrCnt").textContent = `উত্তর দিয়েছ ${bn(n)}/${bn(t)}`; $("#qrBar").style.width = `${(n / t) * 100}%`; }
  function tick() {
    if (!QR || QR.done) return;
    const left = Math.max(0, QR.d.endsAt - (Date.now() - QR.skew)), m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    const el = $("#qrTimer"); if (el) { el.textContent = `${bn(String(m).padStart(2, "0"))}:${bn(String(s).padStart(2, "0"))}`; el.classList.toggle("low", left < 60000); }
    if (!left) submitQuiz(true);
  }
  async function submitQuiz(auto) {
    if (!QR || QR.done || QR.sending) return;
    const left = QR.d.questions.length - Object.keys(QR.answers).length;
    if (!auto && left && !confirm(`${bn(left)}টি প্রশ্নের উত্তর দাওনি। জমা দেবে?`)) return;
    QR.sending = true;
    try {
      const r = await U.api("/api/quiz/submit", { body: { id: QR.id, attemptNo: QR.d.attemptNo, answers: QR.answers } });
      try { localStorage.removeItem(keyOf(QR.id, QR.d.attemptNo)); } catch {}
      QR.done = true; clearInterval(QR.timer);
      P = await U.api("/api/quiz/public");
      drawResult(QR.d.title, r.result, r.review, auto);
    } catch (e) {
      QR.sending = false;
      if (e.status === 409 || e.status === 410) { QR.done = true; clearInterval(QR.timer); }
      alert(e.message);
    }
  }
  function drawResult(title, res, review, auto) {
    full(true);
    pane.innerHTML = `<div class="qr"><h2>🧠 ${esc(title)} — ফলাফল</h2>${auto ? '<p class="qp-chip warn">সময় শেষ — নিজে থেকে জমা হয়েছে</p>' : ""}
      <div class="qp-tiles"><div class="dark"><small>প্রাপ্ত নম্বর</small><b>${n2(res.score)}/${n2(res.full)}</b></div><div><small>সঠিক</small><b class="ok">${bn(res.correct)}</b></div><div><small>ভুল</small><b class="bad">${bn(res.wrong)}</b></div><div><small>উত্তর দাওনি</small><b>${bn(res.skipped)}</b></div></div>
      ${review ? `<h3 style="margin-top:16px">উত্তর মিলিয়ে দেখো</h3><ol class="qr-qs">${review.map((q) => `<li><b>${esc(q.text)}</b><div class="qr-os">${q.options.map((o, j) => `<div class="qr-r${j === q.correct ? " ok" : j === q.your ? " bad" : ""}"><span>${L[j]}</span>${esc(o)}${j === q.correct ? " ✓" : j === q.your ? " ✗ (তোমার উত্তর)" : ""}</div>`).join("")}</div>${q.your === null ? '<small class="qp-muted">উত্তর দাওনি</small>' : ""}${q.explain ? `<p class="qr-ex">💡 ${esc(q.explain)}</p>` : ""}</li>`).join("")}</ol>` : '<p class="qp-muted">এই কুইজের সঠিক উত্তর দেখানো বন্ধ রাখা হয়েছে।</p>'}
      <p style="text-align:center"><button class="btn ghost dark" data-qback>‹ কুইজের তালিকা</button></p></div>`;
  }

  // ---------- ক্লিক / জমা ----------
  pane.addEventListener("submit", async (e) => {
    if (e.target.id !== "joinForm") return;
    e.preventDefault();
    const f = e.target, err = $("#joinErr"), btn = $('button[type="submit"]', f);
    const body = { name: f.name.value.trim(), hsc: f.hsc.value, group: f.group.value, college: f.college.value.trim() };
    err.textContent = "";
    if (body.name.length < 2) return (err.textContent = "তোমার নাম লেখো");
    if (!body.hsc) return (err.textContent = "এইচএসসি ব্যাচ বেছে নাও");
    if (!body.group) return (err.textContent = "গ্রুপ বেছে নাও");
    if (body.college.length < 2) return (err.textContent = "কলেজের নাম লেখো");
    btn.disabled = true;
    try { await U.api("/api/quiz/join", { body }); editing = false; await load(); }
    catch (er) { err.textContent = er.message; btn.disabled = false; }
  });
  document.addEventListener("click", async (e) => {
    const t = (s) => e.target.closest(s); let el;
    if (t("[data-greg]")) return window.SICGuestLogin && SICGuestLogin("register");
    if (t("[data-gin]")) return window.SICGuestLogin && SICGuestLogin("login");
    if (t("[data-edit]")) { editing = true; return draw(); }
    if (t("[data-cancel]")) { editing = false; return draw(); }
    if (t("[data-logout]")) { if (!confirm("বের হবে? আবার মোবাইল নম্বর আর PIN দিয়ে ঢুকলে আগের নম্বর দেখতে পাবে।")) return; await U.api("/api/quiz/logout", { body: {} }).catch(() => {}); window.dispatchEvent(new CustomEvent("sic-guest-out")); editing = false; return load(); }
    if ((el = t("[data-qstart]"))) return startQuiz(el.dataset.qstart);
    if ((el = t("[data-qreview]"))) { try { const r = await U.api(`/api/quiz/review?id=${encodeURIComponent(el.dataset.qreview)}`); drawResult(r.title, r.result, r.review); } catch (er) { alert(er.message); } return; }
    if (t("[data-qback]")) { QR = null; return load(); }
    if (!QR || QR.done) return;
    if ((el = t("[data-a]"))) {
      const li = el.closest("li[data-q]"); QR.answers[li.dataset.q] = Number(el.dataset.a);
      $$("[data-a]", li).forEach((b) => b.classList.toggle("on", b === el));
      if (!$("[data-clear]", li)) li.insertAdjacentHTML("beforeend", '<button type="button" class="qr-clear" data-clear>উত্তর মুছো</button>');
      try { localStorage.setItem(keyOf(QR.id, QR.d.attemptNo), JSON.stringify(QR.answers)); } catch {}
      return count();
    }
    if ((el = t("[data-clear]"))) { const li = el.closest("li[data-q]"); delete QR.answers[li.dataset.q]; $$("[data-a]", li).forEach((b) => b.classList.remove("on")); el.remove(); try { localStorage.setItem(keyOf(QR.id, QR.d.attemptNo), JSON.stringify(QR.answers)); } catch {} return count(); }
    if (t("[data-qsubmit]")) return submitQuiz(false);
  });
  addEventListener("beforeunload", (e) => { if (QR && !QR.done) { e.preventDefault(); e.returnValue = ""; } });

  try { await load(); } catch (e) { pane.innerHTML = `<p class="sub">${esc(e.message)}</p>`; }
})();
