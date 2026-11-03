// অনলাইন ভর্তি — ৪ ধাপের ফর্ম, আবেদন নম্বর, অবস্থা দেখা, A4 ফর্ম প্রিন্ট
(async function () {
  const { $, $$, esc, bn, money } = U;
  const qs = new URLSearchParams(location.search);
  const DRAFT_KEY = "sic_apply_draft";
  const STEPS = ["কোর্স ও ব্যাচ", "শিক্ষার্থী", "SSC ও অভিভাবক", "যাচাই ও জমা"];
  const BOARDS = ["ঢাকা", "রাজশাহী", "চট্টগ্রাম", "যশোর", "কুমিল্লা", "সিলেট", "বরিশাল", "দিনাজপুর", "ময়মনসিংহ", "মাদ্রাসা", "কারিগরি"];
  const STATUS = { pending: ["অপেক্ষমাণ — অফিস শীঘ্রই ফোন করবে", ""], contacted: ["যোগাযোগ করা হয়েছে", "mid"], approved: ["ভর্তি সম্পন্ন 🎉", "ok"], rejected: ["বাতিল", "bad"] };
  const enDigits = (s) => String(s || "").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d));
  const cleanPhone = (s) => enDigits(s).replace(/\D/g, "").replace(/^88/, "");

  let D, S, step = 0, photo = "", data = {};
  try { D = await U.api("/api/public"); } catch { $("#pane").innerHTML = '<p class="sub">সার্ভার চালু নেই। কিছুক্ষণ পরে চেষ্টা করুন।</p>'; return; }
  S = D.settings;
  const onlineC = D.courses.find((c) => c.id === qs.get("c") && c.mode === "online");
  if (onlineC) { location.replace("/online-apply?c=" + encodeURIComponent(onlineC.id)); return; }
  D.courses = D.courses.filter((c) => c.mode !== "online"); // অনলাইন মডিউলের ভর্তি আলাদা ফর্মে (/online-apply)
  U.extraLists = D.lists || {};
  $$("[data-s=name]").forEach((el) => (el.textContent = S.name));
  $("#year").textContent = bn(new Date().getFullYear());
  $("#footAddr").textContent = [S.address, S.phone].filter(Boolean).join(" · ");
  if (S.phone) { $("#navPhone").href = "tel:" + S.phone; $("#navPhone span").textContent = S.phone; } else $("#navPhone").hidden = true;
  addEventListener("scroll", () => $(".nav").classList.toggle("solid", true), { passive: true });

  const course = () => D.courses.find((c) => c.id === data.courseId);
  const batch = () => D.batches.find((b) => b.id === data.batchId && b.session === data.session);
  const batchLabel = (b) => (b ? `${b.name} (${b.session}) — ${b.days}, ${b.time}` : "");
  const chosenChapters = (c) => (c && c.feeType === "chapter" ? (c.chapters || []).filter((x) => (data.chapters || []).includes(x.id)) : []);
  // মডিউলের ফি: মাসিক → প্রতি মাসে; এককালীন; অধ্যায়ভিত্তিক → বাছাই করা অধ্যায়ের যোগফল
  const feeOf = (c) => (!c ? 0 : c.feeType === "chapter" ? chosenChapters(c).reduce((t, x) => t + x.fee, 0) : c.fee);
  const feeLine = (c) => {
    if (c.feeType === "monthly") return `${money(c.fee)}/মাস`;
    if (c.feeType === "chapter") { const f = (c.chapters || []).map((x) => x.fee); return f.length ? `অধ্যায় প্রতি ${money(Math.min(...f))}–${money(Math.max(...f))}` : ""; }
    return `${money(c.fee)} এককালীন`;
  };

  // খসড়া (ছবি ছাড়া) — ব্রাউজার বন্ধ হলেও লেখা থাকবে
  try { data = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}"); } catch { data = {}; }
  if (qs.get("c") && D.courses.some((c) => c.id === qs.get("c"))) { if (data.courseId !== qs.get("c")) data.batchId = ""; data.courseId = qs.get("c"); }
  const saveDraft = () => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch {} };
  const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch {} };

  // ---------- পাশের কার্ড ----------
  function side() {
    const c = course(), b = batch();
    const ch = chosenChapters(c), fee = feeOf(c);
    $("#side").innerHTML = `<h2>${c ? "আপনার বাছাই" : "কোর্সের তথ্য"}</h2>
      ${c ? `<div class="fee-boxes"><div><b>${money(fee)}</b><small>${c.feeType === "monthly" ? "প্রতি মাসে" : c.feeType === "chapter" ? `${bn(ch.length)}টি অধ্যায়ের ফি` : "এককালীন ফি"}</small></div><div><b>${esc(c.duration || "—")}</b><small>মেয়াদ</small></div></div>
      <div class="side-info"><p><span>মডিউল ${esc(c.code || "")}</span><b>${esc(c.name)}</b></p>${ch.length ? `<p><span>অধ্যায়</span><b>${ch.map((x) => esc(x.name)).join("<br>")}</b></p>` : ""}${data.session ? `<p><span>সেশন</span><b>${esc(data.session)}</b></p>` : ""}${b ? `<p><span>ক্লাস ব্যাচ</span><b>${esc(b.name)}</b></p><p><span>দিন ও সময়</span><b>${esc(b.days)} · ${esc(b.time)}</b></p><p><span>খালি সিট</span><b>${bn(b.seatsLeft)}টি</b></p>` : ""}</div>`
        : '<p class="side-empty">প্রথম ধাপে একটি মডিউল বেছে নিলে এখানে ফি, ক্লাস ব্যাচের সময় আর খালি সিট দেখাবে।</p>'}
      <div class="side-help"><p>ফর্ম পূরণে সমস্যা হলে ফোন করুন</p><a href="tel:${esc(S.phone)}">📞 ${esc(S.phone)}</a><p style="margin:8px 0 0">${esc(S.hours || "")}</p></div>`;
  }

  // ---------- ফর্মের ঘর ----------
  const input = (name, label, o = {}) => `<label class="${o.wide ? "wide" : ""}">${label}${o.req ? ' <span class="req">*</span>' : ""}<input name="${name}" value="${esc(data[name] || "")}" type="${o.type || "text"}"${o.mode ? ` inputmode="${o.mode}"` : ""}${o.ph ? ` placeholder="${esc(o.ph)}"` : ""}${o.auto ? ` autocomplete="${o.auto}"` : ""}${o.max ? ` maxlength="${o.max}"` : ""}${o.combo ? ` data-combo="${o.combo}"` : ""}></label>`;
  const select = (name, label, options, o = {}) => `<label class="${o.wide ? "wide" : ""}">${label}${o.req ? ' <span class="req">*</span>' : ""}<select name="${name}"><option value="">বেছে নিন</option>${options.map((x) => `<option${data[name] === x ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></label>`;
  const radio = (name, value, title, sub, o = {}) => `<label class="opt${o.disabled ? " full" : ""}"><input type="radio" name="${name}" value="${esc(value)}"${data[name] === value ? " checked" : ""}${o.disabled ? " disabled" : ""}><span class="dot"></span><span><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</span></label>`;

  const STEP_HTML = [
    () => {
      const c = course();
      const list = D.batches.filter((b) => b.session === data.session);
      return `<h3>কোন মডিউলে ভর্তি হতে চান? <span class="req">*</span></h3>
        <div class="opts">${D.courses.map((m) => radio("courseId", m.id, `<span class="mno">Module ${esc(m.code || "")}</span>${esc(m.name)}`, `<span class="fee">${feeLine(m)}</span><br>${esc(m.short)}`)).join("")}</div>
        ${c && c.feeType === "chapter" ? `<h3>কোন কোন অধ্যায়? <span class="req">*</span></h3>
          <div class="ch-pick">${(c.chapters || []).map((x) => `<label class="opt chk"><input type="checkbox" name="chapters" value="${esc(x.id)}"${(data.chapters || []).includes(x.id) ? " checked" : ""}><span class="dot sq"></span><span><b>${esc(x.name)}</b><small class="fee">${money(x.fee)}</small></span></label>`).join("")}</div>
          <p class="draft-note">মোট: <b>${money(feeOf(c))}</b> (${bn(chosenChapters(c).length)}টি অধ্যায়)</p>` : ""}
        <h3>আপনার সেশন <span class="req">*</span></h3>
        <div class="chips">${D.sessions.map((s) => radio("session", s.name, esc(s.name))).join("")}</div>
        <p class="draft-note">HSC পরীক্ষা যে বছর দেবেন সেটাই সেশন। যেমন ২০২৭ সালে HSC দিলে HSC-27।</p>
        ${data.session ? `<h3>কোন ক্লাস ব্যাচে পড়তে চান?</h3>${list.length ? `<div class="opts bopts">${list.map((b) => radio("batchId", b.id, esc(b.name), `${esc(b.days || "দিন পরে জানানো হবে")}<br>${esc(b.time || "")}<br>${b.seatsLeft ? `✅ ${bn(b.seatsLeft)}টি সিট খালি` : "❌ সিট পূর্ণ"}`, { disabled: !b.seatsLeft })).join("")}</div>` : '<p class="sub">এই সেশনের ক্লাস ব্যাচ অফিস থেকে জানানো হবে।</p>'}` : ""}`;
    },
    () => `<div class="form">
        ${input("nameEn", "নাম (ENGLISH)", { ph: "SSC সার্টিফিকেট অনুযায়ী" })}
        ${input("name", "নাম (বাংলা)", { req: true, auto: "name", ph: "পুরো নাম" })}
        <div class="wide g3">
          ${input("dob", "জন্ম তারিখ", { type: "date" })}
          <label>লিঙ্গ<select name="gender"><option value="">বেছে নিন</option><option value="M"${data.gender === "M" ? " selected" : ""}>ছেলে (Male)</option><option value="F"${data.gender === "F" ? " selected" : ""}>মেয়ে (Female)</option><option value="O"${data.gender === "O" ? " selected" : ""}>অন্যান্য (Other)</option></select></label>
          ${select("bloodGroup", "রক্তের গ্রুপ", U.BLOOD_GROUPS)}
          ${select("religion", "ধর্ম", U.RELIGIONS)}
          <label>জাতীয়তা<input name="nationality" value="${esc(data.nationality ?? "বাংলাদেশী")}"></label>
          ${input("phone", "শিক্ষার্থীর মোবাইল নাম্বার-১", { req: true, mode: "tel", ph: "01XXXXXXXXX", auto: "tel", max: 14 })}
          ${input("phone2", "শিক্ষার্থীর মোবাইল নাম্বার-২", { mode: "tel", ph: "ঐচ্ছিক", max: 14 })}
          ${input("whatsapp", "শিক্ষার্থীর হোয়াটসঅ্যাপ", { mode: "tel", ph: "ঐচ্ছিক", max: 14 })}
        </div>
        <div class="wide g3">
          ${input("college", "কলেজ", { ph: "যেমন: আপনার কলেজের নাম" })}
          ${input("collegeRoll", "কলেজ রোল", { mode: "numeric", ph: "ঐচ্ছিক" })}
          ${select("klass", "শ্রেণি", ["একাদশ", "দ্বাদশ", "সেকেন্ড টাইমার"])}
          ${select("group", "বিভাগ", ["বিজ্ঞান", "মানবিক", "ব্যবসায় শিক্ষা", "অন্যান্য"])}
        </div>
        <div class="photo-box"><div class="pv" id="pv" style="background-image:url('${photo || U.avatarSrc(data.gender)}')"></div>
          <div><b>শিক্ষার্থীর ছবি</b><small>ঐচ্ছিক · পাসপোর্ট সাইজ ছবি, মোবাইলে তোলা হলেও চলবে</small>
          <label class="btn ghost dark" style="margin-top:8px">📷 ছবি বেছে নিন<input type="file" accept="image/*" id="photoIn" hidden></label>
          ${photo ? '<button type="button" class="btn ghost dark" id="photoDel" style="margin:8px 0 0 6px">সরান</button>' : ""}</div></div>
      </div>`,
    () => `<div class="form">
        <h3 class="wide" style="margin:0">শিক্ষাগত যোগ্যতা <small style="color:var(--muted);font-weight:400">(ঐচ্ছিক)</small></h3>
        <div class="wide g3">
          <label>পরীক্ষা<input name="sscExam" value="${esc(data.sscExam ?? "SSC")}" data-combo="EXAMS"></label>
          ${input("sscSchool", "প্রতিষ্ঠান", { ph: "স্কুল / মাদ্রাসার নাম" })}
          ${select("sscBoard", "বোর্ড", BOARDS)}
          ${select("sscGroup", "গ্রুপ", ["বিজ্ঞান", "মানবিক", "ব্যবসায় শিক্ষা", "অন্যান্য"])}
          ${input("sscYear", "সাল", { mode: "numeric", ph: "যেমন: 2025", max: 4 })}
          ${input("sscGpa", "GPA", { mode: "decimal", ph: "যেমন: 5.00", max: 4 })}
        </div>
        <h3 class="wide" style="margin:10px 0 0">অভিভাবকের তথ্য</h3>
        <div class="wide g3">
          ${input("fatherName", "বাবার নাম")}
          ${input("fatherOccupation", "বাবার পেশা", { combo: "OCCUPATIONS", ph: "লিখে খুঁজুন বা বেছে নিন" })}
          ${input("fatherPhone", "বাবার মোবাইল নাম্বার", { mode: "tel", ph: "01XXXXXXXXX", max: 14 })}
          ${input("motherName", "মায়ের নাম")}
          ${input("motherOccupation", "মায়ের পেশা", { combo: "OCCUPATIONS", ph: "লিখে খুঁজুন বা বেছে নিন" })}
          ${input("motherPhone", "মায়ের মোবাইল নাম্বার", { mode: "tel", ph: "01XXXXXXXXX", max: 14 })}
          ${input("guardianName", "অভিভাবকের নাম")}
          ${input("guardianOccupation", "অভিভাবকের পেশা", { combo: "OCCUPATIONS", ph: "লিখে খুঁজুন বা বেছে নিন" })}
          ${input("guardianPhone", "অভিভাবকের নাম্বার", { req: true, mode: "tel", ph: "01XXXXXXXXX", max: 14 })}
          ${input("guardianRelation", "অভিভাবকের সাথে সম্পর্ক", { combo: "RELATIONS", ph: "যেমন: বাবা" })}
        </div>
        <div class="wide addr-row">
          <label>বর্তমান ঠিকানা<textarea name="address" rows="2" placeholder="গ্রাম/মহল্লা, উপজেলা, জেলা">${esc(data.address || "")}</textarea></label>
          <label>স্থায়ী ঠিকানা<textarea name="permanentAddress" rows="2" placeholder="গ্রাম/মহল্লা, উপজেলা, জেলা"${data.sameAddress ? " readonly" : ""}>${esc(data.sameAddress ? data.address || "" : data.permanentAddress || "")}</textarea></label>
          <label class="check same-addr"><input type="checkbox" name="sameAddress"${data.sameAddress ? " checked" : ""}> বর্তমান ঠিকানাই স্থায়ী ঠিকানা</label>
        </div>
      </div>`,
    () => {
      const c = course(), b = batch();
      const r = (k, v) => `<tr><th>${k}</th><td>${v ? esc(v) : '<span style="color:var(--muted);font-weight:400">—</span>'}</td></tr>`;
      const g = (t, i) => `<tr class="grp"><th colspan="2">${t}<button type="button" class="edit" data-go="${i}">✎ বদলান</button></th></tr>`;
      return `<table class="review">
          ${g("মডিউল, সেশন ও ব্যাচ", 0)}${r("মডিউল", c && `${c.code || ""} — ${c.name}`)}${r("অধ্যায়", chosenChapters(c).map((x) => x.name).join(", "))}${r("ফি", c ? money(feeOf(c)) + (c.feeType === "monthly" ? " (প্রতি মাসে)" : "") : "")}${r("সেশন", data.session)}${r("ক্লাস ব্যাচ", batchLabel(b))}
          ${g("শিক্ষার্থী", 1)}${r("নাম (ENGLISH)", data.nameEn)}${r("নাম (বাংলা)", data.name)}${r("জন্ম তারিখ", data.dob && U.date(data.dob))}${r("লিঙ্গ", { M: "ছেলে", F: "মেয়ে", O: "অন্যান্য" }[data.gender] || "")}${r("রক্তের গ্রুপ", data.bloodGroup)}${r("ধর্ম", data.religion)}${r("জাতীয়তা", data.nationality)}${r("মোবাইল", [data.phone, data.phone2].filter(Boolean).join(", "))}${r("হোয়াটসঅ্যাপ", data.whatsapp)}${r("কলেজ", [data.college, data.collegeRoll && "রোল " + data.collegeRoll].filter(Boolean).join(" · "))}${r("শ্রেণি / বিভাগ", [data.klass, data.group].filter(Boolean).join(" · "))}${r("ছবি", photo ? "✅ দেওয়া হয়েছে" : "")}
          ${g("শিক্ষাগত যোগ্যতা ও অভিভাবক", 2)}${r("শিক্ষাগত যোগ্যতা", [data.sscExam, data.sscSchool, data.sscBoard, data.sscGroup, data.sscYear, data.sscGpa && "GPA " + data.sscGpa].filter(Boolean).join(" · "))}${r("বাবা", [data.fatherName, data.fatherOccupation, data.fatherPhone].filter(Boolean).join(" · "))}${r("মা", [data.motherName, data.motherOccupation, data.motherPhone].filter(Boolean).join(" · "))}${r("অভিভাবক", [data.guardianName, data.guardianRelation && `(${data.guardianRelation})`, data.guardianPhone].filter(Boolean).join(" "))}${r("বর্তমান ঠিকানা", data.address)}${r("স্থায়ী ঠিকানা", data.sameAddress ? "বর্তমান ঠিকানাই" : data.permanentAddress)}
        </table>
        <div class="form" style="margin-top:16px">
          <h3 class="wide" style="margin:0">ভর্তির উৎস ও রেফারেন্স <small style="color:var(--muted);font-weight:400">(ঐচ্ছিক)</small></h3>
          ${input("source", "আমাদের ব্যাপারে কিভাবে জেনেছো?", { combo: "SOURCES", ph: "লিখে খুঁজুন বা বেছে নিন" })}
          ${input("refName", "রেফারেন্সকারীর নাম")}
          ${input("refPhone", "রেফারেন্সকারীর মোবাইল নাম্বার", { mode: "tel", ph: "01XXXXXXXXX", max: 14 })}
          ${input("refOccupation", "রেফারেন্সকারীর পেশা", { combo: "OCCUPATIONS", ph: "লিখে খুঁজুন বা বেছে নিন" })}
          <label class="wide">কিছু জানাতে চাইলে<textarea name="message" rows="2" placeholder="ঐচ্ছিক">${esc(data.message || "")}</textarea></label>
          <label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
        </div>
        <label class="decl"><input type="checkbox" name="agree"${data.agree ? " checked" : ""}> <span>আমি নিশ্চিত করছি যে উপরের সব তথ্য সত্য। প্রতিষ্ঠানের নিয়ম মেনে চলবো এবং নির্ধারিত সময়ে ফি পরিশোধ করবো।</span></label>`;
    },
  ];

  function collect() {
    if ($('#stepBody [name="chapters"]')) data.chapters = $$('#stepBody [name="chapters"]:checked').map((x) => x.value);
    $$("#stepBody [name]").forEach((el) => {
      if (el.type === "file" || el.name === "website" || el.name === "chapters") return;
      if (el.type === "radio") { if (el.checked) data[el.name] = el.value; }
      else if (el.type === "checkbox") data[el.name] = el.checked;
      else data[el.name] = el.value.trim();
    });
    saveDraft();
  }
  function validate(i) {
    if (i === 0) {
      const c = course();
      if (!c) return "একটি মডিউল বেছে নিন";
      if (c.feeType === "chapter" && !chosenChapters(c).length) return "অন্তত একটি অধ্যায় বেছে নিন";
      if (!D.sessions.some((s) => s.name === data.session)) return "আপনার সেশন বেছে নিন";
      const list = D.batches.filter((b) => b.session === data.session && b.seatsLeft);
      if (list.length && !list.some((b) => b.id === data.batchId)) return "একটি ক্লাস ব্যাচ বেছে নিন";
    }
    if (i === 1) {
      data.phone = cleanPhone(data.phone);
      if ((data.name || "").length < 2) return "শিক্ষার্থীর নাম লিখুন";
      if (!/^01\d{9}$/.test(data.phone)) return "সঠিক মোবাইল নম্বর দিন — ০১ দিয়ে শুরু, ১১ সংখ্যা";
    }
    if (i === 2) {
      data.guardianPhone = cleanPhone(data.guardianPhone);
      if (!/^01\d{9}$/.test(data.guardianPhone)) return "অভিভাবকের সঠিক মোবাইল নম্বর দিন";
      for (const [k, who] of [["fatherPhone", "বাবার"], ["motherPhone", "মায়ের"]]) {
        if (data[k]) { data[k] = cleanPhone(data[k]); if (!/^01\d{9}$/.test(data[k])) return `${who} মোবাইল নম্বর ঠিক নেই`; }
      }
      if (data.sscGpa && !/^[0-5](\.\d{1,2})?$/.test(enDigits(data.sscGpa))) return "GPA ঠিক নেই (যেমন 4.50)";
    }
    if (i === 1) for (const [k, who] of [["phone2", "মোবাইল নাম্বার-২"], ["whatsapp", "হোয়াটসঅ্যাপ নাম্বার"]]) {
      if (data[k]) { data[k] = cleanPhone(data[k]); if (!/^01\d{9}$/.test(data[k])) return `${who} ঠিক নেই`; }
    }
    if (i === 3 && data.refPhone) { data.refPhone = cleanPhone(data.refPhone); if (!/^01\d{9}$/.test(data.refPhone)) return "রেফারেন্সকারীর মোবাইল নম্বর ঠিক নেই"; }
    if (i === 3 && !data.agree) return "জমা দেওয়ার আগে অঙ্গীকারে টিক দিন";
    return "";
  }

  function renderApply(err) {
    $("#pane").innerHTML = `
      <ol class="steps-bar">${STEPS.map((t, i) => `<li class="${i < step ? "done" : i === step ? "on" : ""}">${t}</li>`).join("")}</ol>
      <div class="step" id="stepBody">${STEP_HTML[step]()}</div>
      ${err ? `<p class="err-box" role="alert">⚠ ${esc(err)}</p>` : ""}
      <div class="nav-btns">
        ${step ? '<button type="button" class="btn ghost dark" id="back">← আগের ধাপ</button>' : "<span></span>"}
        ${step < 3 ? '<button type="button" class="btn gold" id="next">পরের ধাপ →</button>' : '<button type="button" class="btn gold" id="submit">✓ আবেদন জমা দিন</button>'}
      </div>
      <p class="draft-note">💾 আপনার লেখা এই ব্রাউজারে নিজে থেকে সেভ হচ্ছে — পরে এসে বাকিটা পূরণ করতে পারবেন।</p>`;
    side();
    $$("#stepBody [data-combo]").forEach((el) => U.combo(el, () => U.optList(el.dataset.combo)));
    const pin = $("#photoIn");
    if (pin) pin.onchange = async () => {
      try { photo = await U.resizeImage(pin.files[0]); collect(); renderApply(); }
      catch (e) { collect(); renderApply(e.message); }
    };
    const pd = $("#photoDel"); if (pd) pd.onclick = () => { photo = ""; collect(); renderApply(); };
    // ছবি না দিলে লিঙ্গ অনুযায়ী আইকন
    const gsel = $('#stepBody [name="gender"]');
    if (gsel && $("#pv")) gsel.addEventListener("change", () => { if (!photo) $("#pv").style.backgroundImage = `url('${U.avatarSrc(gsel.value)}')`; });
    // সম্পর্ক "বাবা" বা "মা" হলে অভিভাবকের নাম ও নাম্বার নিজে থেকে বসে যায়
    const syncGuardian = () => {
      const f = (n) => $(`#stepBody [name="${n}"]`);
      if (!f("guardianRelation")) return;
      const rel = f("guardianRelation").value.trim();
      const src = /^(বাবা|পিতা|আব্বা)$/.test(rel) ? "father" : /^(মা|মাতা|আম্মা)$/.test(rel) ? "mother" : null;
      if (!src) return;
      f("guardianName").value = f(src + "Name").value;
      f("guardianPhone").value = f(src + "Phone").value;
      if (f("guardianOccupation")) f("guardianOccupation").value = f(src + "Occupation").value;
    };
    // "বর্তমান ঠিকানাই স্থায়ী ঠিকানা" টিক দিলে স্থায়ী ঠিকানা একই থাকে
    const syncAddress = () => {
      const same = $('#stepBody [name="sameAddress"]');
      if (!same) return;
      const perm = $('#stepBody [name="permanentAddress"]');
      perm.readOnly = same.checked;
      if (same.checked) perm.value = $('#stepBody [name="address"]').value;
    };
    $("#stepBody").addEventListener("input", (e) => {
      if (["guardianRelation", "fatherName", "fatherPhone", "fatherOccupation", "motherName", "motherPhone", "motherOccupation"].includes(e.target.name)) { syncGuardian(); collect(); }
      if (e.target.name === "address") { syncAddress(); collect(); }
    });
    $("#stepBody").addEventListener("change", (e) => { if (e.target.name === "sameAddress") { syncAddress(); collect(); } });
    $("#stepBody").addEventListener("change", (e) => {
      if (e.target.name === "courseId") { collect(); data.chapters = []; saveDraft(); renderApply(); return; }
      if (e.target.name === "session") { collect(); data.batchId = ""; saveDraft(); renderApply(); return; }
      if (e.target.name === "chapters") { collect(); renderApply(); return; }
      collect(); side();
    });
    const back = $("#back"); if (back) back.onclick = () => { collect(); step--; renderApply(); scrollTop(); };
    const next = $("#next"); if (next) next.onclick = () => { collect(); const e = validate(step); if (e) return renderApply(e); step++; renderApply(); scrollTop(); };
    $$("[data-go]").forEach((b) => (b.onclick = () => { collect(); step = +b.dataset.go; renderApply(); scrollTop(); }));
    const sub = $("#submit"); if (sub) sub.onclick = submit;
  }
  const scrollTop = () => $("#mainCard").scrollIntoView({ behavior: "smooth", block: "start" });

  async function submit() {
    collect();
    for (let i = 0; i < 4; i++) { const e = validate(i); if (e) { if (i < 3) step = i; return renderApply(e); } }
    const btn = $("#submit"); btn.disabled = true; btn.textContent = "জমা হচ্ছে…";
    try {
      const body = { ...data, sscGpa: enDigits(data.sscGpa), sscRoll: enDigits(data.sscRoll), sscYear: enDigits(data.sscYear), photo: photo || undefined, website: ($('[name="website"]') || {}).value || "" };
      const r = await U.api("/api/apply", { body });
      const snapshot = { ...data }, snapPhoto = photo;
      clearDraft(); data = {}; photo = ""; step = 0;
      showDone(r, snapshot, snapPhoto);
    } catch (e) { renderApply(e.message); }
  }

  function slipHtml(a) {
    const [txt, cls] = STATUS[a.status] || STATUS.pending;
    return `<div class="slip"><header><small>ভর্তির আবেদন · ${esc(S.name)}</small><b>${esc(a.course || "")}</b></header><div class="sb">
      <p>আবেদন নম্বর</p><div class="no">${esc(a.appNo)}</div>
      <p>নাম: <b>${esc(a.name)}</b></p><p>মোবাইল: ${esc(a.phone)}</p>${a.chapters && a.chapters.length ? `<p>অধ্যায়: ${a.chapters.map(esc).join(", ")}</p>` : ""}${a.session ? `<p>সেশন: ${esc(a.session)}</p>` : ""}${a.batch ? `<p>ক্লাস ব্যাচ: <b>${esc(a.batch)}</b></p>` : ""}
      <p>অবস্থা: <span class="st ${cls}">${txt}</span></p>
      ${a.fee > 0 && a.pay ? `<p>পেমেন্ট (${money(a.fee)}): <b>${{ paid: "✅ পরিশোধিত", verifying: "⏳ যাচাই হচ্ছে", rejected: "⚠ মেলেনি — অফিসে ফোন করুন" }[a.pay.status] || "বাকি"}</b></p>` : ""}
      ${a.studentId ? `<p>শিক্ষার্থী আইডি: <b>${esc(a.studentId)}</b> — আইডি আর PIN মোবাইলে SMS-এ পাঠানো হয়; না পেলে অফিসে যোগাযোগ করুন। <a href="/student">শিক্ষার্থী প্যানেলে লগইন →</a></p>` : ""}
      ${a.note ? `<p>অফিসের বার্তা: ${esc(a.note)}</p>` : ""}
      ${a.createdAt ? `<p style="color:var(--muted);font-size:13px">আবেদনের তারিখ: ${U.date(a.createdAt)}</p>` : ""}</div>
      <footer>মোবাইল নম্বর দিয়ে এই পাতার "আবেদনের অবস্থা" থেকে পরে দেখতে পারবেন। প্রয়োজনে: ${esc(S.phone)}</footer></div>`;
  }
  function showDone(r, d, ph) {
    const c = D.courses.find((x) => x.id === d.courseId), b = D.batches.find((x) => x.id === d.batchId);
    const chs = c && c.feeType === "chapter" ? (c.chapters || []).filter((x) => (d.chapters || []).includes(x.id)) : [];
    const a = { ...d, appNo: r.appNo, status: r.status, createdAt: r.createdAt, course: c ? `মডিউল ${c.code || ""} — ${c.name}` : "", chapters: chs.map((x) => x.name), batch: batchLabel(b) };
    $("#pane").innerHTML = `<div class="done-head"><div class="big">${r.again ? "📋" : "🎉"}</div><h2>${r.again ? "আপনি আগেই এই কোর্সে আবেদন করেছেন" : "আবেদন জমা হয়েছে!"}</h2>
      <p class="sub">আবেদন নম্বর <b>${esc(r.appNo)}</b> লিখে রাখুন বা প্রিন্ট করুন। অফিস থেকে শীঘ্রই ফোন করা হবে।</p></div>
      ${slipHtml(a)}
      <div class="done-btns">${r.again ? "" : '<button type="button" class="btn gold" id="pForm">🖨 পূর্ণ ভর্তি ফর্ম প্রিন্ট / PDF</button>'}<button type="button" class="btn ghost dark" id="pSlip">স্লিপ প্রিন্ট</button><button type="button" class="btn ghost dark" id="again">নতুন আবেদন</button></div>`;
    side();
    const pf = $("#pForm"); if (pf) pf.onclick = () => U.printHtml("ভর্তি ফর্ম " + r.appNo, U.admissionFormHtml(d, { settings: S, appNo: r.appNo, courseName: c ? c.name : "", chapters: a.chapters, batchLabel: b ? `${b.name} | ${b.days || ""}${b.time ? " | " + b.time : ""}` : "", photoUrl: ph, paymentType: c ? { monthly: "মাসিক", once: "এককালীন", chapter: "অধ্যায়ভিত্তিক" }[c.feeType] : "", fee: r.fee, payable: r.fee, duration: c ? c.duration : "" }));
    $("#pSlip").onclick = () => U.printHtml("আবেদন " + r.appNo, slipHtml(a));
    $("#again").onclick = () => { renderApply(); scrollTop(); };
    scrollTop();
  }

  function renderStatus(err, result) {
    $("#pane").innerHTML = `<h2>আবেদনের অবস্থা</h2><p class="sub">যে মোবাইল নম্বর দিয়ে আবেদন করেছিলেন, সেটা দিন — ঐ নম্বরের সব আবেদন (অফলাইন ও অনলাইন) দেখাবে।</p>
      <form class="form" id="lookForm" novalidate style="box-shadow:none;border:0;padding:0">
        <label class="wide">মোবাইল নম্বর<input name="phone" required inputmode="tel" placeholder="01XXXXXXXXX" autocomplete="tel"></label>
        <button class="btn gold wide" type="submit">অবস্থা দেখুন</button></form>
      ${err ? `<p class="err-box" role="alert">⚠ ${esc(err)}</p>` : ""}${result ? result.list.map(slipHtml).join("") : ""}`;
    side();
    $("#lookForm").onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target.elements;
      try { const r = await U.api("/api/apply/status", { body: { phone: cleanPhone(f.phone.value) } }); renderStatus("", r); }
      catch (er) { renderStatus(er.message); }
    };
  }

  function setTab(t) {
    $$(".ap-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
    t === "status" ? renderStatus() : renderApply();
  }
  $(".ap-tabs").onclick = (e) => { const b = e.target.closest("[data-tab]"); if (b) { if (b.dataset.tab === "status") collect && $("#stepBody") && collect(); setTab(b.dataset.tab); } };
  $("#blankForm").onclick = () => U.printHtml("খালি ভর্তি ফর্ম", U.admissionFormHtml({}, { settings: S }));
  setTab(qs.get("tab") === "status" ? "status" : "apply");
})();
