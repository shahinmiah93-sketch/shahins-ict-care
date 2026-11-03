// ট্যালেন্ট হান্ট পেজ (/talent-hunt) — রেজিস্ট্রেশন (চালু থাকলে), প্রবেশপত্র (মোবাইল দিয়ে), ফলাফল (রোল + মোবাইল) আর মেধাতালিকা (প্রকাশের পরে)
// রেজিস্ট্রেশনের তথ্য ভর্তির আগ্রহ ফর্মের মতোই: নাম, মোবাইল, আগ্রহী প্রোগ্রাম, শ্রেণি, প্রতিষ্ঠান। একই মোবাইলে আবার দিলে আগের রোলই দেখায়।
(async function () {
  const { $, $$, esc, bn } = U;
  const KLASS = ["নবম শ্রেণি", "দশম শ্রেণি", "একাদশ শ্রেণি", "দ্বাদশ শ্রেণি", "HSC পরীক্ষার্থী", "অন্যান্য"];
  const enDigits = (s) => String(s || "").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d));
  const cleanPhone = (s) => enDigits(s).replace(/\D/g, "").replace(/^88/, "");
  const pane = $("#pane"), side = $("#side");
  let SITE = {}, D = null, tab = "";

  try {
    SITE = (await U.api("/api/public")).settings;
    $$("[data-s=name]").forEach((el) => (el.textContent = SITE.name));
    $("#year").textContent = bn(new Date().getFullYear());
    $("#footAddr").textContent = [SITE.address, SITE.phone].filter(Boolean).join(" · ");
    if (SITE.phone) { $("#navPhone").href = "tel:" + SITE.phone; $("#navPhone span").textContent = SITE.phone; } else $("#navPhone").hidden = true;
    D = await U.api("/api/talent");
  } catch { pane.innerHTML = '<p class="sub">সার্ভার চালু নেই। কিছুক্ষণ পরে চেষ্টা করো।</p>'; return; }

  const H = D.hunt;
  if (!H) {
    $("#thLead").textContent = "এখন কোনো ট্যালেন্ট হান্ট চালু নেই। ঘোষণা হলে এই পাতায় রেজিস্ট্রেশন খুলবে।";
    pane.innerHTML = '<h2>শীঘ্রই আসছে</h2><p class="sub">নতুন ট্যালেন্ট হান্টের খবর জানতে আমাদের Facebook পেজ দেখো বা ফোন করো।</p><p class="qp-acts" style="justify-content:flex-start"><a class="btn gold" href="/">মূল পাতায় যাও</a></p>';
    side.hidden = true; $(".qp-wrap").classList.add("qp-full");
    return;
  }
  // উপরের অংশ: নাম, তারিখ, সময়, কেন্দ্র, বিষয়
  $("#thTitle").textContent = H.title;
  document.title = `${H.title} — ${SITE.name || "Shahin's ICT Care"}`;
  $("#thLead").textContent = H.live ? "রেজিস্ট্রেশন চলছে — নিচের ফর্ম পূরণ করলেই রোল নম্বর আর প্রবেশপত্র পাবে। রেজিস্ট্রেশন ফ্রি।" : H.resultPublished ? "ফলাফল প্রকাশিত হয়েছে — রোল আর মোবাইল নম্বর দিয়ে নিজের ফলাফল দেখো।" : "";
  $("#thMeta").innerHTML = [H.examDate && `📅 ${U.date(H.examDate)}`, H.examTime && `⏰ ${esc(H.examTime)}`, H.venue && `📍 ${esc(H.venue)}`, H.full && `📝 ${[H.subjects.some((s) => s.cq) && "CQ", H.subjects.some((s) => s.mcq) && "MCQ"].filter(Boolean).join(" + ") || "MCQ"} · মোট ${bn(H.full)} নম্বর`].filter(Boolean).map((t) => `<span>${t}</span>`).join("");

  const TABS = [H.live && ["reg", "রেজিস্ট্রেশন"], ["admit", "প্রবেশপত্র"], H.resultPublished && ["result", "ফলাফল"]].filter(Boolean);
  tab = H.resultPublished ? "result" : TABS[0][0];
  $("#thTabs").hidden = false;
  const drawTabs = () => { $("#thTabs").innerHTML = TABS.map(([k, t]) => `<button type="button" data-tab="${k}" class="${tab === k ? "on" : ""}" role="tab">${t}</button>`).join(""); };

  // ---------- পাশের অংশ ----------
  side.innerHTML = `<h2>বিষয় ও নম্বর</h2><ul class="qp-mini">${H.subjects.map((s) => `<li><b>${esc(s.name)}</b><small>পূর্ণমান ${bn(s.full)} · ${[s.cq && `CQ ${bn(s.cq)}`, s.mcq && `MCQ ${bn(s.mcq)}`].filter(Boolean).join(" + ") || "MCQ"}</small></li>`).join("")}</ul>
    ${H.details ? `<p class="qp-note" style="white-space:pre-line">${esc(H.details)}</p>` : ""}
    <p class="qp-note">আমাদের অফলাইন ব্যাচের শিক্ষার্থীদের রেজিস্ট্রেশন অফিস থেকেই করে দেওয়া হয় — রোল জানতে প্রবেশপত্র ট্যাবে মোবাইল নম্বর দাও।</p>`;

  // ---------- রেজিস্ট্রেশন ----------
  function regHtml() {
    return `<h2>ট্যালেন্ট হান্টে রেজিস্ট্রেশন করো</h2><p class="sub">রেজিস্ট্রেশন সম্পূর্ণ ফ্রি। একই মোবাইল নম্বরে একবারই রেজিস্ট্রেশন হয়।</p>
      <form class="form qp-form" id="regForm" novalidate>
        <label class="wide"><span>শিক্ষার্থীর নাম <span class="req">*</span></span><input name="name" required autocomplete="name" placeholder="পুরো নাম"></label>
        <label><span>মোবাইল নম্বর <span class="req">*</span></span><input name="phone" required inputmode="tel" autocomplete="tel" placeholder="01XXXXXXXXX"></label>
        <label>শ্রেণি<select name="klass"><option value="">বেছে নাও</option>${KLASS.map((k) => `<option>${esc(k)}</option>`).join("")}</select></label>
        <label>আগ্রহী প্রোগ্রাম<select name="course"><option value="">বেছে নাও</option>${(D.courses || []).map((c) => `<option>${esc(c)}</option>`).join("")}</select></label>
        <label>প্রতিষ্ঠানের নাম<input name="college" placeholder="তোমার স্কুল / কলেজ"></label>
        <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <p class="form-msg bad" id="regErr"></p>
        <div class="wide qp-acts"><button class="btn gold" type="submit">🏆 রেজিস্ট্রেশন করো</button></div>
      </form>`;
  }
  function doneHtml(r, again) {
    return `<div class="th-done"><span class="qp-chip ok">${again ? "এই মোবাইলে আগেই রেজিস্ট্রেশন আছে" : "✓ রেজিস্ট্রেশন সম্পন্ন"}</span>
      <h2>${esc(r.name)}</h2><div class="th-roll"><small>তোমার রোল নম্বর</small><b>${esc(r.roll)}</b></div>
      <p class="sub">রোল নম্বরটা লিখে রাখো। পরীক্ষার দিন প্রবেশপত্র সাথে আনবে। ফলাফলও এই রোল আর মোবাইল দিয়ে দেখবে।</p>
      <p class="qp-acts" style="justify-content:flex-start"><button type="button" class="btn gold" data-print>🖨 প্রবেশপত্র প্রিন্ট / PDF</button></p></div>`;
  }
  // ---------- প্রবেশপত্র / ফলাফল খোঁজা ----------
  function lookupHtml(kind) {
    return `<h2>${kind === "result" ? "নিজের ফলাফল দেখো" : "প্রবেশপত্র নাও"}</h2><p class="sub">${kind === "result" ? "রোল নম্বর আর রেজিস্ট্রেশনের মোবাইল নম্বর দাও।" : "রেজিস্ট্রেশনের মোবাইল নম্বর দাও — রোল আর প্রবেশপত্র দেখাবে।"}</p>
      <form class="form qp-form" id="lookForm" novalidate>
        ${kind === "result" ? '<label><span>রোল নম্বর <span class="req">*</span></span><input name="roll" required placeholder="যেমন: TH26-0001" autocapitalize="characters"></label>' : ""}
        <label${kind === "result" ? "" : ' class="wide"'}><span>মোবাইল নম্বর <span class="req">*</span></span><input name="phone" required inputmode="tel" placeholder="01XXXXXXXXX"></label>
        <p class="form-msg bad" id="lookErr"></p>
        <div class="wide qp-acts"><button class="btn gold" type="submit">${kind === "result" ? "ফলাফল দেখো" : "খুঁজে দেখো"}</button></div>
      </form><div id="lookOut"></div>
      ${kind === "result" && D.merit ? meritHtml() : ""}`;
  }
  function resultHtml(x) {
    const R = x.result;
    if (!R) return doneHtml(x.reg, true);
    if (R.absent) return `<div class="th-done"><h2>${esc(x.reg.name)} · ${esc(x.reg.roll)}</h2><p class="qp-chip warn">পরীক্ষায় অনুপস্থিত ছিলে</p></div>`;
    if (R.pending) return `<div class="th-done"><h2>${esc(x.reg.name)} · ${esc(x.reg.roll)}</h2><p class="sub">তোমার নম্বর এখনো তোলা হয়নি — পরে আবার দেখো।</p></div>`;
    return `<div class="th-done"><h2>${esc(x.reg.name)}</h2><p class="sub">রোল ${esc(x.reg.roll)}${x.reg.college ? " · " + esc(x.reg.college) : ""}</p>
      <div class="qp-tiles"><div class="dark"><small>মেধাক্রম</small><b>${R.rank ? `${R.rank <= 3 ? ["", "🥇", "🥈", "🥉"][R.rank] + " " : ""}${bn(R.rank)}<small style="display:inline;color:#cfe3dc">/${bn(R.of)}</small>` : "—"}</b></div><div><small>মোট নম্বর</small><b>${bn(String(R.total))}/${bn(R.full)}</b></div><div><small>শতাংশ</small><b>${bn(Math.round((R.total / R.full) * 100))}%</b></div><div><small>ফলাফল</small><b style="color:${R.pass ? "#15803d" : "#b4233c"}">${R.pass ? "পাস" : "ফেল"}</b></div></div>
      <div class="tbl-wrap" style="margin-top:12px"><table class="th-table"><thead><tr><th>বিষয়</th><th class="num">প্রাপ্ত</th><th class="num">পূর্ণমান</th><th class="num">পাস নম্বর</th><th class="num">অবস্থা</th></tr></thead><tbody>${R.marks.map((m) => `<tr><td>${esc(m.name)}</td><td class="num"><b>${bn(String(m.got))}</b></td><td class="num">${bn(m.full)}</td><td class="num">${bn(m.passMark)}</td><td class="num"><b style="color:${m.got >= m.passMark ? "#15803d" : "#b4233c"}">${m.got >= m.passMark ? "পাস" : "ফেল"}</b></td></tr>`).join("")}</tbody></table></div></div>`;
  }
  function meritHtml() {
    const list = D.merit || [];
    return `<h2 class="qp-h" style="margin-top:26px">🏆 মেধাতালিকা <small class="sub" style="font-size:14px">${bn(list.length)} জন</small></h2>
      <div class="tbl-wrap"><table class="th-table"><thead><tr><th>মেধা</th><th>রোল</th><th>নাম</th><th>প্রতিষ্ঠান</th><th class="num">নম্বর</th></tr></thead><tbody>
      ${list.map((x) => `<tr class="${x.rank <= 3 ? "top" : ""}"><td><b>${x.rank <= 3 ? ["", "🥇", "🥈", "🥉"][x.rank] + " " : ""}${U.rankName(x.rank)}</b></td><td>${esc(x.roll)}</td><td><b>${esc(x.name)}</b></td><td>${esc(x.college || "—")}</td><td class="num"><b>${bn(String(x.total))}</b>/${bn(H.full)}</td></tr>`).join("") || '<tr><td colspan="5" class="sub">এখনো কেউ নেই</td></tr>'}</tbody></table></div>`;
  }
  let lastReg = null;
  function draw() { drawTabs(); pane.innerHTML = tab === "reg" ? regHtml() : lookupHtml(tab); }

  $("#thTabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) { tab = b.dataset.tab; draw(); } });
  pane.addEventListener("click", (e) => { if (e.target.closest("[data-print]") && lastReg) U.talentAdmit([lastReg], H, SITE); });
  pane.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, btn = $('button[type="submit"]', f);
    if (f.id === "regForm") {
      const err = $("#regErr"), body = { name: f.name.value.trim(), phone: cleanPhone(f.phone.value), klass: f.klass.value, course: f.course.value, college: f.college.value.trim(), website: f.website.value };
      err.textContent = "";
      if (body.name.length < 2) return (err.textContent = "তোমার নাম লেখো");
      if (!/^01\d{9}$/.test(body.phone)) return (err.textContent = "সঠিক মোবাইল নম্বর দাও (০১ দিয়ে শুরু, ১১ সংখ্যা)");
      btn.disabled = true;
      try { const r = await U.api("/api/talent/register", { body }); lastReg = r.reg; pane.innerHTML = doneHtml(r.reg, r.again); }
      catch (er) { err.textContent = er.message; btn.disabled = false; }
      return;
    }
    if (f.id === "lookForm") {
      const err = $("#lookErr"), body = { phone: cleanPhone(f.phone.value), roll: f.roll ? enDigits(f.roll.value).trim() : "" };
      err.textContent = "";
      if (!/^01\d{9}$/.test(body.phone)) return (err.textContent = "সঠিক মোবাইল নম্বর দাও");
      if (f.roll && !body.roll) return (err.textContent = "রোল নম্বর দাও");
      btn.disabled = true;
      try { const r = await U.api("/api/talent/lookup", { body }); lastReg = r.reg; $("#lookOut").innerHTML = tab === "result" ? resultHtml(r) : doneHtml(r.reg, true).replace("এই মোবাইলে আগেই রেজিস্ট্রেশন আছে", "✓ রেজিস্ট্রেশন পাওয়া গেছে"); }
      catch (er) { err.textContent = er.message; }
      btn.disabled = false;
    }
  });
  draw();
})();
