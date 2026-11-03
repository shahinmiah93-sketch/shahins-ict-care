// অনলাইন কোর্স মডিউলে ভর্তি (/online-apply) — মডিউল বাছাই + ৬টি ঘর, জমা দিলে আবেদন নম্বর
(async function () {
  const { $, esc, bn, money } = U;
  // এইচএসসি ব্যাচ: চলতি সাল থেকে ৫টা (২০২৬ → HSC-26 … HSC-30)
  const HSC = [0, 1, 2, 3, 4].map((i) => `HSC-${String((new Date().getFullYear() % 100) + i).padStart(2, "0")}`);
  const GROUPS = ["বিজ্ঞান", "ব্যবসায় শিক্ষা", "মানবিক"];
  const enDigits = (s) => String(s || "").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d));
  const cleanPhone = (s) => enDigits(s).replace(/\D/g, "").replace(/^88/, "");

  let D, S, data = {};
  try { D = await U.api("/api/public"); } catch { $("#pane").innerHTML = '<p class="sub">সার্ভার চালু নেই। কিছুক্ষণ পরে চেষ্টা করুন।</p>'; return; }
  S = D.settings;
  document.querySelectorAll("[data-s=name]").forEach((el) => (el.textContent = S.name));
  $("#year").textContent = bn(new Date().getFullYear());
  $("#footAddr").textContent = [S.address, S.phone].filter(Boolean).join(" · ");
  if (S.phone) { $("#navPhone").href = "tel:" + S.phone; $("#navPhone span").textContent = S.phone; } else $("#navPhone").hidden = true;

  const mods = D.courses.filter((c) => c.mode === "online");
  const qc = new URLSearchParams(location.search).get("c");
  if (mods.some((c) => c.id === qc)) data.courseId = qc;
  const course = () => mods.find((c) => c.id === data.courseId);
  const isCh = (c) => c && c.feeType === "chapter" && (c.chapters || []).length;
  const chFee = (c) => (c.chapters || []).filter((x) => (data.chapters || []).includes(x.id)).reduce((t, x) => t + Number(x.fee || 0), 0);
  const feeLine = (c) => (isCh(c) ? `অধ্যায় প্রতি ${money(Math.min(...c.chapters.map((x) => x.fee)))} থেকে` : c.feeType === "monthly" ? `${money(c.fee)}/মাস` : `${money(c.fee)} এককালীন`);
  // মডিউল বাছার পর অধ্যায়ের তালিকা (টিক দিয়ে বাছাই) আর মোট ফি
  // টিক বদলালে শুধু মোট ফি আর বোতামের লেখা বদলায় (তালিকা আবার আঁকা হয় না)
  function chTotal() {
    const c = course(), t = document.querySelector(".oa-total"); if (!t || !isCh(c)) return;
    t.querySelector("b").textContent = money(chFee(c)); t.querySelector("small").textContent = `(${bn((data.chapters || []).length)}টি অধ্যায়)`;
    t.querySelector("[data-chall]").textContent = (data.chapters || []).length === c.chapters.length ? "সব বাদ দিন" : "সব অধ্যায় বাছুন";
  }
  function drawCh() {
    const box = $("#oaCh"), c = course(); if (!box) return;
    if (!isCh(c)) { box.innerHTML = ""; return; }
    box.innerHTML = `<h3 style="margin-top:20px">কোন কোন অধ্যায় কিনবেন? <span class="req">*</span></h3><p class="sub" style="margin:0 0 10px">যতগুলো ইচ্ছা বাছুন — শুধু বাছাই করা অধ্যায়ের ভিডিও ক্লাস আপনার প্যানেলে খুলবে।</p>
      <div class="oa-chs">${c.chapters.map((x) => `<label class="oa-ch"><input type="checkbox" name="chapters" value="${esc(x.id)}"${(data.chapters || []).includes(x.id) ? " checked" : ""}><span><b>অধ্যায় ${esc(bn(x.id))}</b>${esc(x.name)}</span><em>${money(x.fee)}</em></label>`).join("")}</div>
      <p class="oa-total">মোট ফি: <b>${money(chFee(c))}</b> <small>(${bn((data.chapters || []).length)}টি অধ্যায়)</small> <button type="button" class="oa-all" data-chall>${(data.chapters || []).length === c.chapters.length ? "সব বাদ দিন" : "সব অধ্যায় বাছুন"}</button></p>`;
  }

  // ---------- পাশের কার্ড ----------
  function side() {
    const c = course();
    $("#side").innerHTML = `<h2>${c ? "আপনার বাছাই" : "কোর্সের তথ্য"}</h2>
      ${c ? `<div class="fee-boxes"><div><b>${money(isCh(c) ? chFee(c) : c.fee)}</b><small>${isCh(c) ? `${bn((data.chapters || []).length)}টি অধ্যায়ের মোট ফি` : c.feeType === "monthly" ? "প্রতি মাসে" : "এককালীন ফি"}</small></div><div><b>${esc(c.duration || "—")}</b><small>মেয়াদ</small></div></div>
        <div class="side-info"><p><span>মডিউল ${esc(c.code || "")}</span><b>${esc(c.name)}</b></p><p><span>ক্লাস</span><b>💻 অনলাইনে</b></p></div>`
        : '<p class="side-empty">একটি অনলাইন মডিউল বেছে নিলে এখানে ফি আর মেয়াদ দেখাবে।</p>'}
      <div class="side-help"><p>ফর্ম পূরণে সমস্যা হলে ফোন করুন</p><a href="tel:${esc(S.phone)}">📞 ${esc(S.phone)}</a><p style="margin:8px 0 0">${esc(S.hours || "")}</p></div>`;
  }

  // ---------- ফর্ম ----------
  const input = (name, label, o = {}) => `<label><span>${label} <span class="req">*</span></span><input name="${name}" value="${esc(data[name] || "")}"${o.mode ? ` inputmode="${o.mode}"` : ""}${o.auto ? ` autocomplete="${o.auto}"` : ""} placeholder="${esc(o.ph || "")}"${o.max ? ` maxlength="${o.max}"` : ""}></label>`;
  const select = (name, label, list) => `<label><span>${label} <span class="req">*</span></span><select name="${name}"><option value="">বেছে নিন</option>${list.map((x) => `<option${data[name] === x ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></label>`;
  function render(err = "") {
    if (!mods.length) { $("#pane").innerHTML = '<h3>এখন কোনো অনলাইন মডিউলে ভর্তি চলছে না</h3><p class="sub">শীঘ্রই আসছে। জানতে ফোন করুন।</p>'; side(); return; }
    $("#pane").innerHTML = `<form id="oaForm" novalidate>
      <h3>কোন মডিউলে ভর্তি হতে চান? <span class="req">*</span></h3>
      <div class="opts">${mods.map((m) => `<label class="opt"><input type="radio" name="courseId" value="${esc(m.id)}"${data.courseId === m.id ? " checked" : ""}><span class="dot"></span>
        <span><span class="mno">Module ${esc(m.code || "")}</span><b>${esc(m.name)}</b><small><span class="fee">${feeLine(m)}</span>${m.short ? "<br>" + esc(m.short) : ""}</small></span></label>`).join("")}</div>
      <div id="oaCh"></div>
      <h3 style="margin-top:22px">শিক্ষার্থীর তথ্য</h3>
      <div class="form">
        ${input("nameEn", "নাম (ENGLISH)", { ph: "যেমন: Md Rahim Uddin", auto: "name", max: 120 })}
        ${input("college", "কলেজ", { ph: "আপনার কলেজের নাম", max: 150 })}
        ${select("group", "বিভাগ", GROUPS)}
        ${select("hscBatch", "এইচএসসি ব্যাচ", HSC)}
        ${input("phone", "শিক্ষার্থীর মোবাইল নাম্বার", { mode: "tel", ph: "01XXXXXXXXX", auto: "tel", max: 14 })}
        ${input("guardianPhone", "অভিভাবকের মোবাইল নাম্বার", { mode: "tel", ph: "01XXXXXXXXX", max: 14 })}
        <label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
      </div>
      <p class="form-msg bad" id="oaErr">${esc(err)}</p>
      <div class="step-btns"><button type="submit" class="btn gold" id="oaSend">আবেদন জমা দিন →</button></div>
      <p class="draft-note">আগে আবেদন করেছেন? <a href="/apply?tab=status">মোবাইল নম্বর দিয়ে আবেদনের অবস্থা দেখুন →</a></p>
    </form>`;
    const f = $("#oaForm");
    f.onchange = (e) => { const was = data.courseId; collect(); if (data.courseId !== was) { data.chapters = []; drawCh(); } else if (e.target.name === "chapters") chTotal(); side(); };
    f.addEventListener("click", (e) => { if (!e.target.closest("[data-chall]")) return; const c = course(); data.chapters = (data.chapters || []).length === c.chapters.length ? [] : c.chapters.map((x) => x.id); drawCh(); side(); });
    drawCh();
    f.onsubmit = (e) => { e.preventDefault(); submit(); };
    side();
  }
  function collect() {
    const f = $("#oaForm"); if (!f) return;
    const ch = f.querySelector("[name=courseId]:checked");
    data = { courseId: ch ? ch.value : "", chapters: [...f.querySelectorAll("[name=chapters]:checked")].map((x) => x.value), nameEn: f.nameEn.value.trim(), college: f.college.value.trim(), group: f.group.value, hscBatch: f.hscBatch.value,
      phone: cleanPhone(f.phone.value), guardianPhone: cleanPhone(f.guardianPhone.value), website: f.website.value };
  }
  function check() {
    if (!data.courseId) return "একটি অনলাইন মডিউল বেছে নিন";
    if (isCh(course()) && !(data.chapters || []).length) return "অন্তত একটি অধ্যায় বেছে নিন";
    if (!/^[A-Za-z][A-Za-z .'-]{1,119}$/.test(data.nameEn)) return "নাম ইংরেজিতে লিখুন (যেমন: Md Rahim Uddin)";
    if (data.college.length < 2) return "কলেজের নাম লিখুন";
    if (!data.group) return "বিভাগ বেছে নিন";
    if (!data.hscBatch) return "এইচএসসি ব্যাচ বেছে নিন";
    if (!/^01\d{9}$/.test(data.phone)) return "শিক্ষার্থীর সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)";
    if (!/^01\d{9}$/.test(data.guardianPhone)) return "অভিভাবকের সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)";
    return "";
  }
  async function submit() {
    collect();
    const err = check(); if (err) { $("#oaErr").textContent = err; return; }
    const btn = $("#oaSend"); btn.disabled = true; btn.textContent = "জমা হচ্ছে…";
    try { done(await U.api("/api/online-apply", { body: data })); }
    catch (e) { $("#oaErr").textContent = e.message; btn.disabled = false; btn.textContent = "আবেদন জমা দিন →"; }
  }
  function done(r) {
    const c = course();
    $("#pane").innerHTML = `<div class="done-head"><div class="big">${r.again ? "📋" : "🎉"}</div><h2>${r.again ? "আপনি আগেই এই মডিউলে আবেদন করেছেন" : "আবেদন জমা হয়েছে!"}</h2>
      <p class="sub">আবেদন নম্বর <b>${esc(r.appNo)}</b> লিখে রাখুন। অফিস থেকে শীঘ্রই ${esc(data.phone)} নম্বরে ফোন করে ভর্তি নিশ্চিত করা হবে।</p></div>
      ${slipHtml(r, c)}
      <div class="done-btns"><button type="button" class="btn gold" id="oaPrint">🖨 আবেদনপত্র প্রিন্ট / PDF</button></div>
      <div id="payBox"></div>
      <div class="done-btns"><a class="btn ghost dark" href="/#online-programs">অনলাইন কোর্সে ফিরে যান</a><button type="button" class="btn ghost dark" id="oaNew">আরেকটি আবেদন</button></div>
      <p class="draft-note">পরে <a href="/apply?tab=status">"আবেদনের অবস্থা"</a> পাতায় শুধু মোবাইল নম্বর দিয়ে অবস্থা দেখতে পারবেন।</p>`;
    $("#oaNew").onclick = () => { data = { courseId: data.courseId }; render(); };
    $("#oaPrint").onclick = () => U.printHtml("আবেদনপত্র " + r.appNo, slipHtml(r, c));
    payBox({ appNo: r.appNo, phone: data.phone, fee: r.fee, pay: r.pay || { status: "unpaid" } });
    side();
    scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- আবেদনপত্র: শিরোনামে মডিউল, ছবি · তথ্য · QR, নিয়ম, স্বাক্ষর — QR স্ক্যান করলে আবেদনের সব তথ্য লেখা হিসেবে দেখায় ----------
  const SLIP_CSS = `.aps{max-width:190mm;margin:18px auto 6px;background:#fff;color:#102420;border:1.4px solid #0b3b36;border-radius:14px;padding:18px 20px;box-shadow:0 14px 34px rgba(11,59,54,.10);text-align:left}
    .aps-head{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;padding-bottom:12px;border-bottom:1.4px solid #0d554b}
    .aps-tag{padding:7px 14px;border-radius:8px;background:#0b3b36;color:#fff;font-weight:700;font-size:15px;white-space:nowrap}
    .aps-org{text-align:center;min-width:0}.aps-org h2{margin:0;font-size:22px;line-height:1.35;color:#0b3b36}.aps-org small{display:block;font-size:11px;color:#526861}
    .aps-head img{width:100px;height:68px;object-fit:contain}
    .aps-title{margin:14px 0 12px;text-align:center;font-size:19px;line-height:1.4;color:#0b3b36}
    .aps-body{display:grid;grid-template-columns:100px 1fr 112px;gap:16px;align-items:start}
    .aps-photo{width:100px;height:122px;object-fit:cover;border:3px solid #f3c55d;border-radius:8px;background:#f6faf8}
    .aps-body table{width:100%;border-collapse:collapse;font-size:14px}.aps-body th{background:#f1f7f5;color:#0b3b36;width:38%;text-align:left;font-weight:600}.aps-body th,.aps-body td{border:1px solid #c9dbd4;padding:6px 9px;vertical-align:top}
    .aps-qr svg{width:112px;height:112px;display:block}.aps-qr small{display:block;margin-top:4px;text-align:center;font-size:10.5px;color:#526861}
    .aps-notes{margin:14px 0 0;padding:10px 14px 10px 32px;border-radius:8px;background:#f6faf8;font-size:13px;line-height:1.7}
    .aps-sign{display:flex;justify-content:space-between;gap:20px;margin-top:44px;font-size:12px}.aps-sign span{min-width:160px;text-align:center;border-top:1px solid #333;padding-top:4px}
    @media(max-width:640px){.aps{padding:14px}.aps-head{grid-template-columns:1fr auto}.aps-tag{grid-column:1/-1;justify-self:start}.aps-org{text-align:left}.aps-org h2{font-size:19px}
      .aps-body{grid-template-columns:84px 1fr}.aps-photo{width:84px;height:102px}.aps-body table{grid-column:1/-1;grid-row:2}.aps-qr{justify-self:end}.aps-qr svg{width:92px;height:92px}.aps-sign span{min-width:0;flex:1}}
    @media print{@page{size:A4;margin:10mm}.aps{box-shadow:none;max-width:none;margin:0;padding:5mm 6mm}.aps-head{grid-template-columns:auto 1fr auto}.aps-tag{grid-column:auto}.aps-org{text-align:center}
      .aps-body{grid-template-columns:28mm 1fr 32mm}.aps-body table{grid-column:auto;grid-row:auto}.aps-photo{width:28mm;height:34mm}.aps-qr svg{width:32mm;height:32mm}.aps *{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;
  const qrSvg = (text) => {
    try { qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"]; const q = qrcode(0, "L"); q.addData(text, "Byte"); q.make(); return q.createSvgTag({ cellSize: 3, margin: 0, scalable: true }); }
    catch { return ""; }
  };
  function slipHtml(r, c) {
    const mod = c ? `Module ${c.code || ""} — ${c.name}` : "";
    const fee = r.fee > 0 ? `${money(r.fee)}${c && c.feeType === "monthly" ? " / মাস" : ""}` : "";
    const when = U.date(r.createdAt || new Date().toISOString());
    const rows = [["নাম", data.nameEn], ["আবেদন নম্বর", r.appNo, true], ["মডিউল", mod], ["কলেজ", data.college], ["বিভাগ · ব্যাচ", `${data.group} · ${data.hscBatch}`],
      ["শিক্ষার্থীর মোবাইল", data.phone], ["অভিভাবকের মোবাইল", data.guardianPhone], ["ফি", fee], ["আবেদনের তারিখ", when]].filter((x) => x[1]);
    // QR-এ সাধারণ লেখা — যেকোনো মোবাইলের ক্যামেরায় স্ক্যান করলে ইন্টারনেট ছাড়াই সব তথ্য দেখা যায়
    // (ঘরের নাম ইংরেজিতে — বাংলা অক্ষর ৩ গুণ জায়গা নেয়, QR ঘন হয়ে স্ক্যান কঠিন হয়)
    const qrText = [`${S.name} - Online Admission`, `App No: ${r.appNo}`, `Name: ${data.nameEn}`, `Module: ${c ? (c.code ? c.code + " - " : "") + c.name : ""}`,
      `College: ${data.college}`, `Group: ${data.group}`, `Batch: ${data.hscBatch}`, `Student: ${data.phone}`, `Guardian: ${data.guardianPhone}`,
      ...(r.fee > 0 ? [`Fee: BDT ${r.fee}${c && c.feeType === "monthly" ? "/month" : ""}`] : []), `Date: ${(r.createdAt || new Date().toISOString()).slice(0, 10)}`].join("\n");
    return `<style>${SLIP_CSS}</style><article class="aps">
      <div class="aps-head"><div class="aps-tag">আবেদনপত্র</div><div class="aps-org"><h2>${esc(S.name)}</h2><small>${esc([S.address, S.phone, S.phone2].filter(Boolean).join(" · "))}</small></div><img src="${location.origin}/images/logo-receipt.png" alt="Shahin's ICT Care"></div>
      <h3 class="aps-title">${esc(mod)}</h3>
      <div class="aps-body"><img class="aps-photo" src="${U.avatarSrc("")}" alt="">
        <table>${rows.map(([k, v, strong]) => `<tr><th>${esc(k)}</th><td>${strong ? `<b>${esc(v)}</b>` : esc(v)}</td></tr>`).join("")}</table>
        <div class="aps-qr">${qrSvg(qrText)}<small>স্ক্যান করে সব তথ্য দেখুন</small></div></div>
      <ol class="aps-notes"><li>অফিস থেকে ফোন করে ভর্তি নিশ্চিত করা হবে।</li><li>ভর্তির সময় এই আবেদনপত্র (প্রিন্ট বা মোবাইলে) সঙ্গে রাখুন।</li>
        <li>আবেদনের অবস্থা দেখতে ওয়েবসাইটের "আবেদনের অবস্থা" পাতায় মোবাইল নম্বর দিন।</li>${S.phone ? `<li>প্রয়োজনে ফোন করুন: ${esc(S.phone)}</li>` : ""}</ol>
      <div class="aps-sign"><span>আবেদনকারীর স্বাক্ষর</span>${U.sig("অফিস কর্তৃপক্ষের স্বাক্ষর")}</div></article>`;
  }

  // ---------- পেমেন্ট: অনলাইন গেটওয়ে (বিকাশ/নগদ/রকেট/কার্ড/ব্যাংক) অথবা নিজে পাঠিয়ে TrxID ----------
  const PAY_KEY = "sic_online_pay"; // গেটওয়েতে যাওয়ার আগে আবেদন নম্বর + মোবাইল মনে রাখা, ফিরে এলে আবার পেমেন্টের অংশ দেখাতে
  const MANUAL = [["bkash", "বিকাশ", S.payBkash, "#e2136e"], ["nagad", "নগদ", S.payNagad, "#f6921e"], ["rocket", "রকেট", S.payRocket, "#8c3494"], ["bank", "ব্যাংক", S.payBank, "#0b6b52"]].filter((m) => m[2]);
  const PAY_ST = { paid: ["✅ পেমেন্ট সম্পন্ন — ধন্যবাদ!", "ok"], verifying: ["⏳ পেমেন্ট যাচাই হচ্ছে — অফিস মিলিয়ে নিশ্চিত করবে", "mid"], rejected: ["⚠ পেমেন্ট মেলেনি — আবার পাঠান বা অফিসে ফোন করুন", "bad"],
    failed: ["⚠ পেমেন্ট হয়নি — আবার চেষ্টা করুন", "bad"], cancelled: ["পেমেন্ট বাতিল করেছেন — আবার চেষ্টা করুন", "bad"] };
  function payBox(app, msg = "") {
    const box = $("#payBox"); if (!box) return;
    if (!(app.fee > 0)) { box.innerHTML = ""; return; }
    const st = app.pay.status, [stTxt, stCls] = PAY_ST[st] || ["", ""];
    if (st === "paid" || st === "verifying") { box.innerHTML = `<div class="pay-box"><h3>পেমেন্ট — ${money(app.fee)}</h3><p class="pay-st ${stCls}">${stTxt}</p></div>`; return; }
    let tab = MANUAL[0] ? MANUAL[0][0] : "";
    const draw = (err = "") => {
      const m = MANUAL.find((x) => x[0] === tab);
      box.innerHTML = `<div class="pay-box"><h3>পেমেন্ট করুন — <b>${money(app.fee)}</b></h3>
        ${stTxt ? `<p class="pay-st ${stCls}">${stTxt}</p>` : ""}${msg ? `<p class="pay-st bad">${esc(msg)}</p>` : ""}
        ${D.payGateway ? `<button type="button" class="pay-go" id="payGo">💳 অনলাইনে পেমেন্ট করুন<small>বিকাশ · নগদ · রকেট · কার্ড · ইন্টারনেট ব্যাংকিং</small></button>` : ""}
        ${MANUAL.length ? `${D.payGateway ? '<p class="pay-or"><span>অথবা নিজে টাকা পাঠিয়ে TrxID দিন</span></p>' : '<p class="sub" style="margin:0 0 10px">নিচের যেকোনো মাধ্যমে টাকা পাঠিয়ে Transaction ID দিন — অফিস মিলিয়ে নিশ্চিত করবে।</p>'}
          <div class="pay-tabs">${MANUAL.map(([k, l, , c]) => `<button type="button" data-pt="${k}" class="${k === tab ? "on" : ""}" style="--pc:${c}">${l}</button>`).join("")}</div>
          <div class="pay-how" style="--pc:${m[3]}">${tab === "bank"
            ? `<p>নিচের অ্যাকাউন্টে <b>${money(app.fee)}</b> জমা / ট্রান্সফার করুন:</p><pre>${esc(m[2])}</pre>`
            : `<p>${m[1]} অ্যাপ বা ${{ bkash: "*247#", nagad: "*167#", rocket: "*322#" }[tab]} ডায়াল করে নিচের নম্বরে <b>${money(app.fee)}</b> <b>সেন্ড মানি</b> করুন:</p><div class="pay-no"><b>${esc(m[2])}</b><button type="button" id="payCopy">কপি</button></div>`}
            <p class="pay-ref">রেফারেন্সে লিখুন: <b>${esc(app.appNo)}</b></p></div>
          <form class="form" id="payForm" novalidate>
            <label><span>${tab === "bank" ? "যে অ্যাকাউন্ট / নাম থেকে পাঠিয়েছেন" : `যে ${m[1]} নম্বর থেকে পাঠিয়েছেন`} <span class="req">*</span></span><input name="sender"${tab === "bank" ? "" : ' inputmode="tel" placeholder="01XXXXXXXXX" maxlength="14"'}></label>
            <label><span>${tab === "bank" ? "রেফারেন্স / ট্রানজেকশন নম্বর" : "Transaction ID (TrxID)"} <span class="req">*</span></span><input name="trxId" placeholder="${tab === "bank" ? "ব্যাংকের রসিদের নম্বর" : "যেমন 9F7A2B3C4D"}" autocapitalize="characters" maxlength="40"></label>
          </form>
          <p class="form-msg bad">${esc(err)}</p>
          <button type="button" class="btn gold" id="paySend">পেমেন্টের তথ্য জমা দিন</button>`
          : D.payGateway ? "" : '<p class="sub">পেমেন্টের নিয়ম অফিস থেকে ফোনে জানানো হবে।</p>'}
        ${S.payNote ? `<p class="draft-note">${esc(S.payNote)}</p>` : ""}</div>`;
      const go = $("#payGo");
      if (go) go.onclick = async () => {
        go.disabled = true; go.firstChild.textContent = "গেটওয়ে খোলা হচ্ছে… ";
        try {
          const r = await U.api("/api/online-apply/pay/init", { body: { appNo: app.appNo, phone: app.phone } });
          try { sessionStorage.setItem(PAY_KEY, JSON.stringify({ appNo: app.appNo, phone: app.phone, fee: app.fee })); } catch {}
          location.href = r.url;
        } catch (e) { draw(e.message); }
      };
      box.querySelectorAll("[data-pt]").forEach((b) => (b.onclick = () => { tab = b.dataset.pt; draw(); }));
      const cp = $("#payCopy"); if (cp) cp.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(m[2]); cp.textContent = "কপি হয়েছে ✓"; };
      const send = $("#paySend");
      if (send) send.onclick = async () => {
        const f = $("#payForm");
        const body = { appNo: app.appNo, phone: app.phone, method: tab, sender: tab === "bank" ? f.sender.value.trim() : cleanPhone(f.sender.value), trxId: enDigits(f.trxId.value).trim() };
        if (!body.sender || !body.trxId) return draw("দুটো ঘরই পূরণ করুন");
        send.disabled = true;
        try { const r = await U.api("/api/online-apply/pay/manual", { body }); payBox({ ...app, pay: r.pay }); }
        catch (e) { draw(e.message); }
      };
    };
    draw();
  }

  // গেটওয়ে থেকে ফিরে এলে (?pay=success|fail|cancel)
  const back = new URLSearchParams(location.search);
  if (back.get("pay")) {
    let saved = null; try { saved = JSON.parse(sessionStorage.getItem(PAY_KEY) || "null"); } catch {}
    const ok = back.get("pay") === "success";
    $("#pane").innerHTML = `<div class="done-head"><div class="big">${ok ? "✅" : "⚠"}</div><h2>${ok ? "পেমেন্ট সফল হয়েছে!" : back.get("pay") === "cancel" ? "পেমেন্ট বাতিল হয়েছে" : "পেমেন্ট হয়নি"}</h2>
      <p class="sub">আবেদন নম্বর <b>${esc(back.get("app") || (saved && saved.appNo) || "")}</b>। ${ok ? "অফিস থেকে শীঘ্রই ফোন করে ক্লাসের তথ্য জানানো হবে।" : "নিচ থেকে আবার চেষ্টা করুন বা অন্য মাধ্যমে পাঠান।"}</p></div>
      <div id="payBox"></div>
      <div class="done-btns"><a class="btn ghost dark" href="/#online-programs">অনলাইন কোর্সে ফিরে যান</a><a class="btn ghost dark" href="/apply?tab=status">আবেদনের অবস্থা দেখুন</a></div>`;
    if (!ok && saved && saved.appNo === back.get("app")) payBox({ ...saved, pay: { status: back.get("pay") === "cancel" ? "cancelled" : "failed" } });
    // সফল হলে: ভর্তি হয়ে গেছে — শিক্ষার্থী আইডি আর PIN (শিক্ষার্থী প্যানেলে ঢোকার জন্য)
    if (ok && saved && saved.appNo === back.get("app")) {
      U.api("/api/online-apply/account", { body: { appNo: saved.appNo, phone: saved.phone } }).then((r) => {
        if (!r.studentId) return;
        $("#payBox").innerHTML = `<div class="pay-box acc-box"><h3>🎓 আপনার শিক্ষার্থী অ্যাকাউন্ট তৈরি হয়েছে</h3>
          <div class="acc-ids"><div><small>শিক্ষার্থী আইডি</small><b>${esc(r.studentId)}</b></div><div><small>PIN</small><b>${esc(r.pin)}</b></div></div>
          <p>এই আইডি আর PIN দিয়ে <b>শিক্ষার্থী প্যানেলে</b> ঢুকে ক্লাস ভিডিও, নোটিশ, পরীক্ষা আর ফলাফল দেখবেন। <b>লিখে রাখুন বা স্ক্রিনশট নিন</b> — PIN আর কাউকে দেবেন না।</p>
          <a class="btn gold" href="/student">শিক্ষার্থী প্যানেলে ঢুকুন →</a></div>`;
      }).catch(() => {});
    }
    side();
  } else render();
})();
