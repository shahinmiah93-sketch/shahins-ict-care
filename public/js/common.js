function parseBatchTime(value) {
  const text = String(value || "").replace(/[০-৯]/g, d => "০১২৩৪৫৬৭৮৯".indexOf(d));
  const match = text.match(/(\d{1,2})(?:[:ঃ.](\d{2}))?/);
  if (!match) return null;
  let hour = Number(match[1]), minute = Number(match[2] || 0);
  if (hour > 23 || minute > 59) return null;
  let period = /সকাল/.test(text) ? "সকাল" : /দুপুর/.test(text) ? "দুপুর" : /বিক[াে]ল/.test(text) ? "বিকাল" : /সন্ধ্যা/.test(text) ? "সন্ধ্যা" : /রাত/.test(text) ? "রাত" : /ভোর/.test(text) ? "ভোর" : "";
  if (period && (hour < 1 || hour > 12)) return null;
  if (!period) period = hour < 6 ? "রাত" : hour < 12 ? "সকাল" : hour < 16 ? "দুপুর" : hour < 18 ? "বিকাল" : "রাত";
  let h24 = hour;
  if (hour <= 12) {
    if (["দুপুর", "বিকাল", "সন্ধ্যা"].includes(period)) h24 = hour % 12 + 12;
    else if (period === "রাত") h24 = hour >= 6 && hour < 12 ? hour + 12 : hour % 12;
  }
  return { period, hour: String(hour % 12 || 12), minute: String(minute).padStart(2, "0"), minutes: h24 * 60 + minute };
}
function batchDayGroup(value) {
  const text = String(value || "").trim();
  const days = [/শনি|sat/i, /রবি|sun/i, /সোম|mon/i, /মঙ্গল|tue/i, /বুধ|wed/i, /বৃহস্পতি|thu/i, /শুক্র|fri/i];
  const key = days.map((pattern, i) => pattern.test(text) ? String(i) : "").join("");
  return key || "9" + text;
}
function compareBatchSchedule(a, b) {
  return String(a.session || "").localeCompare(String(b.session || ""), "en", { numeric: true }) ||
    batchDayGroup(a.days).localeCompare(batchDayGroup(b.days), "en") ||
    ((parseBatchTime(a.time)?.minutes ?? 9999) - (parseBatchTime(b.time)?.minutes ?? 9999)) ||
    String(a.name || "").localeCompare(String(b.name || ""), "en", { numeric: true }) || String(a.id || "").localeCompare(String(b.id || ""));
}

// সব পেজে ব্যবহৃত ছোট সাহায্যকারী ফাংশন
window.U = {
  parseBatchTime, compareBatchSchedule,
  // বাবা-মায়ের সম্ভাব্য পেশা (ড্রপডাউন)
  OCCUPATIONS: [
    "সরকারি চাকরিজীবী", "বেসরকারি চাকরিজীবী", "ব্যবসায়ী", "শিক্ষক", "কৃষক", "প্রবাসী", "গৃহিণী",
    "ডাক্তার", "ইঞ্জিনিয়ার", "আইনজীবী", "ব্যাংকার", "পুলিশ", "সেনাবাহিনী / প্রতিরক্ষা", "নার্স / স্বাস্থ্যকর্মী",
    "ইমাম / ধর্মীয় পেশা", "সাংবাদিক", "এনজিও কর্মী", "ফ্রিল্যান্সার", "ঠিকাদার", "দোকানদার",
    "কারিগর / মিস্ত্রি", "দর্জি", "গাড়িচালক", "রিকশা / ভ্যানচালক", "জেলে", "শ্রমিক", "দিনমজুর",
    "অবসরপ্রাপ্ত", "বেকার", "মৃত", "অন্যান্য",
  ],
  $: (s, root = document) => root.querySelector(s),
  $$: (s, root = document) => [...root.querySelectorAll(s)],
  esc: (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
  bn: (v) => String(v ?? "").replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]),
  // প্রিন্টের স্বাক্ষরের ঘর: দাগের উপরে শাহিন স্যারের স্বাক্ষর
  sig: (label) => `<span style="position:relative"><img src="${location.origin}/images/signature.png" alt="" style="position:absolute;left:50%;bottom:calc(100% + 1px);transform:translateX(-50%);height:7mm;width:auto;max-width:95%">${label}</span>`,
  // মেধাক্রম: ১ম, ২য়, ৩য়, ৪র্থ, ৫ম, ৬ষ্ঠ … ১০ম, ১১তম
  rankName: (n) => ({ 1: "১ম", 2: "২য়", 3: "৩য়", 4: "৪র্থ", 5: "৫ম", 6: "৬ষ্ঠ", 7: "৭ম", 8: "৮ম", 9: "৯ম", 10: "১০ম" }[n] || U.bn(n) + "তম"),
  modCover: (c, i = 0) => {
    if (c.image) return `<img src="/api/cimage/${encodeURIComponent(c.id)}/image?v=${c.image.v}" alt="${U.esc(c.name)}" loading="lazy">`;
    const P = [["#0b6b52", "#14b8a6"], ["#1d3fa8", "#3d7bff"], ["#7c2d92", "#e0457b"], ["#9a3412", "#f59e0b"], ["#0f4c5c", "#22c55e"], ["#3b2a17", "#d4a13c"]];
    const [a, b] = P[i % P.length];
    return `<div class="mt-fallback" style="--a:${a};--b:${b}"><b>${U.esc(U.bn(c.code || String(i + 1).padStart(2, "0")))}</b><span>${U.esc(c.name)}</span></div>`;
  },
  money: (n) => "৳" + U.bn(Math.round(Number(n) || 0).toLocaleString("en-IN")),
  today: () => new Date().toLocaleDateString("en-CA"),
  date: (s) => {
    if (!s) return "—";
    const d = new Date(s.length === 10 ? s + "T00:00:00" : s);
    return isNaN(d) ? s : d.toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" });
  },
  month: (s) => {
    if (!s) return "—";
    const d = new Date(s + "-01T00:00:00");
    return isNaN(d) ? s : d.toLocaleDateString("bn-BD", { month: "long", year: "numeric" });
  },
  async api(path, opts = {}) {
    const res = await fetch(path, {
      method: opts.method || (opts.body ? "POST" : "GET"),
      headers: opts.body ? { "Content-Type": "application/json" } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
    });
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      const err = new Error(data.error || "সমস্যা হয়েছে (" + res.status + ")");
      err.status = res.status;
      if (data.loginSms) err.loginSms = data.loginSms;
      throw err;
    }
    return data;
  },
  toast(msg, bad) {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.append(t); }
    t.textContent = msg;
    t.className = "toast show" + (bad ? " bad" : "");
    clearTimeout(t._h);
    t._h = setTimeout(() => (t.className = "toast"), 2800);
  },
  // সার্চ করা যায় এমন ড্রপডাউন: চাপ দিলে পুরো তালিকা, লিখলে মিলে যাওয়াগুলো; তালিকার বাইরেও লেখা যায়
  // মূল তালিকা + আগে ব্যবহার করা নিজের লেখা (সার্ভারে সেভ থাকে); "অন্যান্য" সবার শেষে
  extraLists: {},
  optList(key) {
    const base = (U[key] || []).filter((x) => x !== "অন্যান্য");
    const extra = (U.extraLists[key] || []).filter((x) => x && !base.includes(x) && x !== "অন্যান্য");
    return [...base, ...extra, "অন্যান্য"];
  },
  // রেগুলার ব্যাচের প্রথম মাস: ব্যাচের দিন ধরে ঐ মাসের মোট ক্লাস আর শুরুর দিন থেকে পাওয়া ক্লাস (সার্ভারেও একই নিয়ম)
  firstMonthClasses(days, startDate) {
    const W = [[0, /রবি|sun/i], [1, /সোম|mon/i], [2, /মঙ্গল|tue/i], [3, /বুধ|wed/i], [4, /বৃহস্পতি|thu/i], [5, /শুক্র|fri/i], [6, /শনি|sat/i]];
    const wd = W.filter(([, re]) => re.test(String(days || ""))).map(([d]) => d);
    const start = new Date((startDate || U.today()) + "T00:00:00");
    if (!wd.length || isNaN(start)) return null;
    const y = start.getFullYear(), m = start.getMonth(), last = new Date(y, m + 1, 0).getDate();
    let total = 0, left = 0;
    for (let d = 1; d <= last; d++) if (wd.includes(new Date(y, m, d).getDay())) { total++; if (d >= start.getDate()) left++; }
    return total ? { firstClasses: left, firstTotal: total, firstGrace: start.getDate() <= U.FULL_FEE_UNTIL_DAY } : null;
  },
  monthlyFeeFor(course, enrollment, month) {
    const rule = (course.monthlyFees || []).find(r => r.from <= month && (!r.to || r.to >= month));
    return Math.max(0, Number(rule ? rule.fee : enrollment.fee) - Number(enrollment.discount || 0));
  },
  FULL_FEE_UNTIL_DAY: 6, // ১–৬ তারিখের মধ্যে ভর্তি হলে ঐ মাসের পুরো ফি
  // ক্লাস প্রতি ৮৩ টাকা (১০০০ ÷ ১২); মাসে ১২-র বেশি ক্লাস হলে ক্লাস প্রতি ১০০০ ÷ মোট ক্লাস (একটু কম)
  STD_CLASSES: 12,
  perClassFee: (net, total) => Math.min(Math.floor(net / U.STD_CLASSES), total ? net / total : Infinity),
  // এক মাসের ফি (সার্ভারের monthFee-এর সাথে একই নিয়ম): fromDay থেকে ক্লাস গোনা, closed = "টাকা কমবে" এমন বন্ধের তারিখ।
  // পুরো মাস পেলে পুরো ফি; কম পেলে পাওয়া ক্লাস × ক্লাস প্রতি টাকা → ৫০ টাকার রাউন্ড ফিগার (৪৯৩ → ৫০০), মাসিক ফি-র বেশি না
  monthFee(net, days, y, m, fromDay = 1, closed = new Set()) {
    const W = [[0, /রবি|sun/i], [1, /সোম|mon/i], [2, /মঙ্গল|tue/i], [3, /বুধ|wed/i], [4, /বৃহস্পতি|thu/i], [5, /শুক্র|fri/i], [6, /শনি|sat/i]];
    const wd = W.filter(([, re]) => re.test(String(days || ""))).map(([d]) => d);
    if (!wd.length) return { fee: net, total: 0, got: 0, shut: 0, perClass: 0 };
    const p2 = (n) => String(n).padStart(2, "0"), last = new Date(y, m + 1, 0).getDate();
    let total = 0, got = 0, shut = 0;
    for (let d = 1; d <= last; d++) {
      if (!wd.includes(new Date(y, m, d).getDay())) continue;
      total++;
      if (d < fromDay) continue;
      if (closed.has(`${y}-${p2(m + 1)}-${p2(d)}`)) shut++; else got++;
    }
    const perClass = U.perClassFee(net, total);
    if (!total || got >= total) return { fee: net, total, got, shut, perClass };
    return { fee: Math.min(net, Math.round((perClass * got) / 50) * 50), total, got, shut, perClass, raw: perClass * got };
  },
  // কোনো ব্যাচের "টাকা কমবে" এমন বন্ধের সব তারিখ — অল্প দিনের বন্ধে (৭ দিনের কম) টাকা কমে না (সার্ভারেও একই)
  MIN_CLOSURE_DAYS: 7,
  closureDays: (c) => Math.round((new Date(c.to + "T00:00:00") - new Date(c.from + "T00:00:00")) / 864e5) + 1,
  closureCutsFee: (c) => !!c.reduceFee && !!c.from && !!c.to && U.closureDays(c) >= U.MIN_CLOSURE_DAYS,
  feeClosedDates(closures, batchId) {
    const set = new Set(), p2 = (n) => String(n).padStart(2, "0");
    for (const c of closures || []) {
      if (!U.closureCutsFee(c) || !(c.batchIds || []).includes(batchId)) continue;
      const end = new Date(c.to + "T00:00:00");
      for (let d = new Date(c.from + "T00:00:00"), n = 0; d <= end && n < 400; d.setDate(d.getDate() + 1), n++) set.add(`${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`);
    }
    return set;
  },
  // পরীক্ষার নাম তালিকায়: "Model Test-01 (২০ অক্টোবর, ২০২৬)"
  examLabel: (e) => (e ? `${e.title}${e.date ? ` (${U.date(e.date)})` : ""}` : ""),
  // ব্যাচের নাম তালিকায়: "27-A — শনি, সোম, বুধ (সকাল ৭:০০)"
  batchLabel: (b) => (b ? `${b.name}${[b.days, b.time].filter(Boolean).length ? " (" + [b.days, b.time].filter(Boolean).join(" · ") + ")" : ""}` : ""),
  // বাড়ির কাজ / পড়া: কাজটা কোন কোন শিক্ষার্থীর জন্য (পুরো সেশন বা নির্দিষ্ট ব্যাচ)
  hwFor: (h, s) => !!s && h.session === s.session && (!(h.batchIds || []).length || h.batchIds.includes(s.batchId)),
  // একজনের হার: করেছে ÷ (করেছে + করেনি); অনুপস্থিত আর যাচাই না হওয়া গোনা হয় না (প্রতিটা "করেছে" = ১ পয়েন্ট)
  hwRate(list, s, kind, month) {
    let done = 0, not = 0, absent = 0, pending = 0;
    for (const h of list || []) {
      if ((kind && h.kind !== kind) || !U.hwFor(h, s) || (month && !(h.dueDate || h.givenDate || "").startsWith(month))) continue;
      const v = (h.checks || {})[s.id];
      v === "done" ? done++ : v === "not" ? not++ : v === "absent" ? absent++ : pending++;
    }
    return { done, not, absent, pending, pct: done + not ? (done / (done + not)) * 100 : null };
  },
  // কোনো তারিখে ব্যাচটা বন্ধ কি না (থাকলে সেই বন্ধটা ফেরত দেয়)
  closureOn: (closures, batchId, date) => (closures || []).find((c) => (c.batchIds || []).includes(batchId) && c.from <= date && c.to >= date),
  // ছবি না থাকলে লিঙ্গ অনুযায়ী আইকন: ছেলে / মেয়ে / অন্যান্য
  avatarSrc: (gender) => `${location.origin}/images/avatar-${gender === "M" ? "male" : gender === "F" ? "female" : "person"}.svg`,
  combo(input, list) {
    if (!input || input.dataset.comboOn) return;
    const getList = typeof list === "function" ? list : () => list;
    let picking = false;
    input.dataset.comboOn = "1";
    input.classList.add("combo-in");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("role", "combobox");
    if (!document.getElementById("comboCss")) {
      const st = document.createElement("style"); st.id = "comboCss";
      st.textContent = `.combo-wrap{position:relative;display:block;width:100%;min-width:0}.combo-wrap>input{width:100%;box-sizing:border-box}
        .combo-in{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%235d7570' stroke-width='1.6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px!important}
        .combo-list{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:30;margin:0;padding:6px;list-style:none;max-height:240px;overflow:auto;background:#fff;border:1px solid #e6dcc4;border-radius:12px;box-shadow:0 16px 36px rgba(0,0,0,.18)}
        .combo-list li{padding:7px 10px;border-radius:8px;cursor:pointer;font-weight:500;color:#16302b}
        .combo-list li.on,.combo-list li:hover{background:#eef6f2;color:#0b3b36}
        .combo-list li mark{background:#fff1cf;color:inherit;border-radius:3px}
        .combo-list .none{color:#5d7570;cursor:default;background:none!important;font-size:13px}`;
      document.head.append(st);
    }
    const wrap = document.createElement("span"); wrap.className = "combo-wrap";
    input.parentNode.insertBefore(wrap, input); wrap.append(input);
    const ul = document.createElement("ul"); ul.className = "combo-list"; ul.hidden = true; ul.setAttribute("role", "listbox");
    wrap.append(ul);
    let items = [], active = -1;
    const draw = (all) => {
      if (input.readOnly) return; // অটো-কপি করা (লক) ঘরে তালিকা খুলবে না
      const q = all ? "" : input.value.trim().toLowerCase();
      items = getList().filter((x) => !q || x.toLowerCase().includes(q));
      active = items.length && q ? 0 : -1;
      const mark = (x) => { if (!q) return U.esc(x); const i = x.toLowerCase().indexOf(q); return U.esc(x.slice(0, i)) + "<mark>" + U.esc(x.slice(i, i + q.length)) + "</mark>" + U.esc(x.slice(i + q.length)); };
      ul.innerHTML = items.map((x, i) => `<li role="option" data-i="${i}" class="${i === active ? "on" : ""}">${mark(x)}</li>`).join("")
        || `<li class="none">তালিকায় নেই — "${U.esc(input.value.trim())}" নতুন হিসেবে থাকবে, সেভ করলে পরের বার তালিকায় আসবে</li>`;
      ul.hidden = false;
    };
    const pick = (x) => {
      input.value = x; ul.hidden = true;
      picking = true; input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); picking = false;
    };
    input.addEventListener("focus", () => draw(true));
    input.addEventListener("click", () => { if (ul.hidden) draw(true); });
    input.addEventListener("input", () => { if (!picking && document.activeElement === input) draw(false); });
    input.addEventListener("blur", () => setTimeout(() => (ul.hidden = true), 150));
    input.addEventListener("keydown", (e) => {
      if (ul.hidden && (e.key === "ArrowDown" || e.key === "ArrowUp")) { draw(true); e.preventDefault(); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!items.length) return;
        active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        [...ul.children].forEach((li, i) => li.classList.toggle("on", i === active));
        ul.children[active] && ul.children[active].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && !ul.hidden && active >= 0) { e.preventDefault(); pick(items[active]); }
      else if (e.key === "Escape") ul.hidden = true;
    });
    ul.addEventListener("mousedown", (e) => { const li = e.target.closest("li[data-i]"); if (li) { e.preventDefault(); pick(items[+li.dataset.i]); } });
  },
  EXAMS: ["SSC", "দাখিল", "SSC (ভোকেশনাল)", "O Level", "অন্যান্য"],
  COMPULSORY_SUBJECTS: ["বাংলা ১ম পত্র", "বাংলা ২য় পত্র", "ইংরেজি ১ম পত্র", "ইংরেজি ২য় পত্র", "তথ্য ও যোগাযোগ প্রযুক্তি (ICT)"],
  // HSC বিষয় নির্বাচনের নিয়ম (সম্ভারুণের মতো): বিভাগ অনুযায়ী ৩টি গ্রুপ সাবজেক্ট + ১টি ৪র্থ বিষয়
  HSC_SUBJECTS: {
    "বিজ্ঞান": { main: ["পদার্থবিজ্ঞান", "রসায়ন", "উচ্চতর গণিত", "জীববিজ্ঞান"], fourth: ["উচ্চতর গণিত", "জীববিজ্ঞান", "কৃষি"] },
    "মানবিক": {
      main: ["ইতিহাস", "ইসলামের ইতিহাস ও সংস্কৃতি", "পৌরনীতি ও সুশাসন", "অর্থনীতি", "সমাজবিজ্ঞান", "সমাজকর্ম", "যুক্তিবিদ্যা", "ভূগোল", "মনোবিজ্ঞান", "পরিসংখ্যান", "কৃষিশিক্ষা", "গার্হস্থ্য বিজ্ঞান"],
      fourth: ["ইতিহাস", "ইসলামের ইতিহাস ও সংস্কৃতি", "পৌরনীতি ও সুশাসন", "অর্থনীতি", "সমাজবিজ্ঞান", "সমাজকর্ম", "যুক্তিবিদ্যা", "ভূগোল", "মনোবিজ্ঞান", "পরিসংখ্যান", "কৃষিশিক্ষা", "গার্হস্থ্য বিজ্ঞান"],
    },
    "ব্যবসায় শিক্ষা": {
      main: ["হিসাববিজ্ঞান", "ব্যবসায় সংগঠন ও ব্যবস্থাপনা", "ফিন্যান্স, ব্যাংকিং ও বিমা", "উৎপাদন ব্যবস্থাপনা ও বিপণন", "অর্থনীতি", "পরিসংখ্যান"],
      fourth: ["হিসাববিজ্ঞান", "ব্যবসায় সংগঠন ও ব্যবস্থাপনা", "ফিন্যান্স, ব্যাংকিং ও বিমা", "উৎপাদন ব্যবস্থাপনা ও বিপণন", "অর্থনীতি", "পরিসংখ্যান"],
    },
  },
  // বিষয় → ১ম ও ২য় পত্র (ICT বা আগে থেকে "পত্র" লেখা থাকলে ভাগ হয় না)
  expandPapers: (list) => list.filter(Boolean).flatMap((s) => (/(পত্র|ICT|তথ্য ও যোগাযোগ প্রযুক্তি)/.test(s) ? [s] : [`${s} ১ম পত্র`, `${s} ২য় পত্র`])),
  // শিক্ষার্থীর তিন কলাম: আবশ্যিক (১–৫), গ্রুপ সাবজেক্ট (৬–), ৪র্থ বিষয় — নম্বর একটানা
  subjectColumns(d) {
    const fixed = U.COMPULSORY_SUBJECTS, main = U.expandPapers([d.subject1, d.subject2, d.subject3]), fourth = U.expandPapers([d.subject4]);
    let n = 0; const num = (arr) => arr.map((s) => ({ n: ++n, s }));
    return { fixed: num(fixed), main: num(main), fourth: num(fourth) };
  },
  GROUP_SUBJECTS: {
    "বিজ্ঞান": "পদার্থবিজ্ঞান ১ম ও ২য় পত্র, রসায়ন ১ম ও ২য় পত্র, জীববিজ্ঞান / উচ্চতর গণিত ১ম ও ২য় পত্র",
    "মানবিক": "অর্থনীতি, পৌরনীতি ও সুশাসন, ইতিহাস / ইসলামের ইতিহাস ও সংস্কৃতি / ভূগোল (১ম ও ২য় পত্র)",
    "ব্যবসায় শিক্ষা": "হিসাববিজ্ঞান, ব্যবসায় সংগঠন ও ব্যবস্থাপনা, ফিন্যান্স ব্যাংকিং ও বিমা (১ম ও ২য় পত্র)",
  },
  FOURTH_SUBJECTS: ["উচ্চতর গণিত", "জীববিজ্ঞান", "পরিসংখ্যান", "অর্থনীতি", "ভূগোল", "মনোবিজ্ঞান", "কৃষিশিক্ষা", "গার্হস্থ্য বিজ্ঞান", "উৎপাদন ব্যবস্থাপনা ও বিপণন", "অন্যান্য"],
  SOURCES: ["শিক্ষকের মাধ্যমে", "বন্ধু / সহপাঠী", "বড় ভাই-বোন", "পরিবারের মাধ্যমে", "Facebook", "YouTube", "পোস্টার / লিফলেট", "ব্যানার / সাইনবোর্ড", "স্কুল / কলেজ", "অন্যান্য"],
  BLOOD_GROUPS: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "জানা নেই"],
  RELIGIONS: ["ইসলাম", "হিন্দু", "বৌদ্ধ", "খ্রিস্টান", "অন্যান্য"],
  RELATIONS: ["বাবা", "মা", "ভাই", "বোন", "চাচা", "চাচী", "মামা", "মামী", "খালা", "খালু", "ফুফু", "ফুফা", "দাদা", "দাদী", "নানা", "নানী", "অন্যান্য"],
  // ছবি ছোট করে JPEG বানানো (আপলোডের আগে)
  resizeImage(file, max = 420) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) return reject(new Error("শুধু ছবি (JPG/PNG) দিন"));
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const r = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
        const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("ছবিটি খোলা যায়নি")); };
      img.src = url;
    });
  },
  // প্রিন্টের পাতার উপরে বাটন — প্রিন্টের ঘর বন্ধ করে ফেললেও আবার প্রিন্ট করা যায় (কাগজে আসে না)
  PRINT_BAR: `<div class="pbar"><b>প্রিন্ট প্রিভিউ</b><button type="button" onclick="print()">🖨 প্রিন্ট করুন</button><button type="button" class="x" onclick="close()">✕ বন্ধ করুন</button></div>`,
  // সব প্রিন্টের এক রকম হেডার (Progress Report-এর ডিজাইন): বামে ইংরেজি দুই লাইনের টাইটেল, মাঝে প্রতিষ্ঠান, ডানে লোগো, নিচে সবুজ দাগ
  docKind(t) {
    const k = [[/পূর্ণ রিপোর্ট|Full Report/i, "Student", "Full Report"], [/আইডি কার্ড|ID Card/i, "ID", "Card"], [/আবেদন|Application/i, "Admission", "Applications"], [/ভর্তি ফর্ম|Admission/i, "Admission", "Form"], [/প্রবেশপত্র|Admit/i, "Admit", "Card"], [/মেধা|Merit/i, "Merit", "List"], [/কুইজ|Quiz/i, "Quiz", "Result"], [/Progress/i, "Progress", "Report"],
      [/রেজাল্ট|Result|ফলাফল/i, "Result", "Sheet"], [/হাজিরা|উপস্থিতি|Attendance/i, "Attendance", "Report"], [/ফি|পেমেন্ট|Payment/i, "Payment", "Report"], [/সম্ভাব্য|লিড|Lead/i, "Lead", "List"],
      [/শিক্ষক|Teacher/i, "Teacher", "List"], [/শিক্ষার্থী|Student/i, "Student", "List"], [/নোটিশ|Notice/i, "Notice", "Board"], [/পরীক্ষা|Exam/i, "Exam", "Report"], [/ট্যালেন্ট|Talent/i, "Talent", "Hunt"], [/মডিউল|ব্যাচ|Batch/i, "Course", "& Batches"], [/বাড়ির কাজ|Homework/i, "Homework", "Report"], [/কোর্স|ফ্রি ক্লাস|Course/i, "Online", "Courses"], [/ব্যানার|Banner/i, "Banner", "List"], [/সফল|Achiever/i, "Success", "Stories"], [/সেটিংস|Setting/i, "Settings", "Summary"], [/ড্যাশবোর্ড|Dashboard/i, "Dashboard", "Summary"]].find(([r]) => r.test(t || ""));
    return k ? [k[1], k[2]] : ["Official", "Report"];
  },
  // দুই লাইনের টাইটেল (SVG): উপরেরটা বড় ধূসর, নিচেরটা কালো — ফন্ট লোড হলে আসল মাপ মেপে নিচের লাইন ঠিক উপরের লাইনের সমান চওড়া করা হয়
  // (অক্ষর টেনে লম্বা করা হয় না: আগে ফন্ট বড়-ছোট, তারপর বাকিটুকু অক্ষরের ফাঁক দিয়ে)
  docMark(a, b) {
    return `<svg class="dh-k" viewBox="0 0 170 64" role="img" aria-label="${a} ${b}"><text x="0" y="34" font-size="40" fill="#4b4b4b">${a}</text><text x="0" y="58" font-size="20" fill="#111">${b.toUpperCase()}</text></svg>
      <script>(function(){var fit=function(){document.querySelectorAll("svg.dh-k").forEach(function(s){if(s.dataset.fit)return;var t=s.querySelectorAll("text"),w1=t[0].getComputedTextLength();if(!w1)return;
        var f1=40,w2=t[1].getComputedTextLength(),f2=Math.min(f1*0.78,20*w1/w2);t[1].setAttribute("font-size",f2.toFixed(2));w2=t[1].getComputedTextLength();
        if(w2<w1-0.5){t[1].setAttribute("textLength",w1.toFixed(2));t[1].setAttribute("lengthAdjust","spacing");}
        var y2=34+f2+6;t[1].setAttribute("y",y2.toFixed(1));s.setAttribute("viewBox","0 0 "+(w1+1).toFixed(1)+" "+(y2+4).toFixed(1));s.dataset.fit=1;});};
        (document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(fit);setTimeout(fit,1200);})();</script>`;
  },
  docHead(title, st = {}, sub = "") {
    const [a, b] = U.docKind(title), O = location.origin;
    return `<header class="dh">${U.docMark(a === "Student" ? "Student’s" : a, b)}<div class="dh-o"><strong>${U.esc(st.nameBn || "শাহিন'স আইসিটি কেয়ার")}</strong><small>${U.esc(st.address || "মাস্টার কলোনি, মাদারীপুর")}</small><small>${U.esc(st.phone || "")}</small></div><img class="dh-l" src="${O}/images/logo-receipt.png" alt=""></header>${sub ? `<p class="dh-s">${sub}</p>` : ""}`;
  },
  docFoot: (st = {}) => `<div class="dft">${U.esc(st.nameBn || "শাহিন'স আইসিটি কেয়ার")} · ${U.esc(st.phone || "")} · প্রিন্টের তারিখ: ${U.esc(U.date(U.today()))}</div>`,
  DOC_FONTS: `<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@700;900&family=Oswald:wght@600;700&display=swap" rel="stylesheet">`,
  // বাংলা অঙ্ক ০-৯ = Tiro Bangla (প্রিন্টের জানালাগুলোর জন্য; ওয়েবপেজে app.css / site.css-এ একই নিয়ম)
  get TIRO_CSS() { return "@font-face{font-family:'Hind Siliguri';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:100;font-style:normal;font-display:swap}@font-face{font-family:'Hind Siliguri';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:200;font-style:normal;font-display:swap}@font-face{font-family:'Hind Siliguri';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:300;font-style:normal;font-display:swap}@font-face{font-family:'Hind Siliguri';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:400;font-style:normal;font-display:swap}@font-face{font-family:'Hind Siliguri';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:500;font-style:normal;font-display:swap}@font-face{font-family:'Hind Siliguri';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:600;font-style:normal;font-display:swap}@font-face{font-family:'Hind Siliguri';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:700;font-style:normal;font-display:swap}@font-face{font-family:'Hind Siliguri';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:800;font-style:normal;font-display:swap}@font-face{font-family:'Hind Siliguri';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:900;font-style:normal;font-display:swap}@font-face{font-family:'Noto Serif Bengali';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:100;font-style:normal;font-display:swap}@font-face{font-family:'Noto Serif Bengali';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:200;font-style:normal;font-display:swap}@font-face{font-family:'Noto Serif Bengali';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:300;font-style:normal;font-display:swap}@font-face{font-family:'Noto Serif Bengali';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:400;font-style:normal;font-display:swap}@font-face{font-family:'Noto Serif Bengali';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:500;font-style:normal;font-display:swap}@font-face{font-family:'Noto Serif Bengali';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:600;font-style:normal;font-display:swap}@font-face{font-family:'Noto Serif Bengali';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:700;font-style:normal;font-display:swap}@font-face{font-family:'Noto Serif Bengali';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:800;font-style:normal;font-display:swap}@font-face{font-family:'Noto Serif Bengali';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:900;font-style:normal;font-display:swap}@font-face{font-family:'Montserrat';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:100;font-style:normal;font-display:swap}@font-face{font-family:'Montserrat';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:200;font-style:normal;font-display:swap}@font-face{font-family:'Montserrat';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:300;font-style:normal;font-display:swap}@font-face{font-family:'Montserrat';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:400;font-style:normal;font-display:swap}@font-face{font-family:'Montserrat';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:500;font-style:normal;font-display:swap}@font-face{font-family:'Montserrat';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:600;font-style:normal;font-display:swap}@font-face{font-family:'Montserrat';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:700;font-style:normal;font-display:swap}@font-face{font-family:'Montserrat';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:800;font-style:normal;font-display:swap}@font-face{font-family:'Montserrat';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:900;font-style:normal;font-display:swap}@font-face{font-family:'Oswald';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:100;font-style:normal;font-display:swap}@font-face{font-family:'Oswald';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:200;font-style:normal;font-display:swap}@font-face{font-family:'Oswald';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:300;font-style:normal;font-display:swap}@font-face{font-family:'Oswald';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:400;font-style:normal;font-display:swap}@font-face{font-family:'Oswald';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:500;font-style:normal;font-display:swap}@font-face{font-family:'Oswald';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:600;font-style:normal;font-display:swap}@font-face{font-family:'Oswald';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:700;font-style:normal;font-display:swap}@font-face{font-family:'Oswald';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:800;font-style:normal;font-display:swap}@font-face{font-family:'Oswald';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:900;font-style:normal;font-display:swap}@font-face{font-family:'Tiro Bangla';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:100;font-style:normal;font-display:swap}@font-face{font-family:'Tiro Bangla';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:200;font-style:normal;font-display:swap}@font-face{font-family:'Tiro Bangla';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:300;font-style:normal;font-display:swap}@font-face{font-family:'Tiro Bangla';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:400;font-style:normal;font-display:swap}@font-face{font-family:'Tiro Bangla';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:500;font-style:normal;font-display:swap}@font-face{font-family:'Tiro Bangla';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:600;font-style:normal;font-display:swap}@font-face{font-family:'Tiro Bangla';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:700;font-style:normal;font-display:swap}@font-face{font-family:'Tiro Bangla';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:800;font-style:normal;font-display:swap}@font-face{font-family:'Tiro Bangla';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:900;font-style:normal;font-display:swap}@font-face{font-family:'BnNum';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:100;font-style:normal;font-display:swap}@font-face{font-family:'BnNum';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:200;font-style:normal;font-display:swap}@font-face{font-family:'BnNum';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:300;font-style:normal;font-display:swap}@font-face{font-family:'BnNum';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:400;font-style:normal;font-display:swap}@font-face{font-family:'BnNum';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:500;font-style:normal;font-display:swap}@font-face{font-family:'BnNum';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:600;font-style:normal;font-display:swap}@font-face{font-family:'BnNum';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:700;font-style:normal;font-display:swap}@font-face{font-family:'BnNum';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:800;font-style:normal;font-display:swap}@font-face{font-family:'BnNum';src:url('@@/fonts/tiro-digits-bold.ttf') format('truetype');unicode-range:U+09E6-09EF;font-weight:900;font-style:normal;font-display:swap}".split("@@").join(location.origin); },
  get DOC_CSS() {
    return `@font-face{font-family:'BnNum';src:local('Kalpurush'),url('${location.origin}/fonts/kalpurush.ttf') format('truetype');unicode-range:U+0030-0039}${U.TIRO_CSS}
      .dh{display:grid;grid-template-columns:46mm 1fr 46mm;align-items:center;gap:4mm;background:#f3f6f4;border-radius:3mm;padding:3mm 4mm;border-bottom:1.6px solid #1f6b52;margin-bottom:4mm}
      .dh-k{display:block;height:15mm;width:auto;max-width:44mm;font-family:Oswald,'Arial Narrow',sans-serif;font-weight:700;overflow:visible}.dh-k-old b{display:block}.dh-k span{display:block;font-size:15px;font-weight:700;color:#111}
      .dh-o{text-align:center}.dh-o strong{display:block;font:900 21px 'Noto Serif Bengali','Nirmala UI',serif;color:#0b2e28}.dh-o small{display:block;font-size:12px;font-weight:600;color:#33433f}
      .dh-l{justify-self:end;width:36mm;max-height:24mm;object-fit:contain}.dh-s{margin:-1mm 0 4mm;font-weight:600;color:#33433f}
      .dft{text-align:center;font-size:10px;color:#7b8884;margin-top:6mm;border-top:1px dashed #d4dcd8;padding-top:2mm}`;
  },
  PRINT_BAR_CSS: `.pbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:center;gap:10px;padding:10px;background:#0b3b36;box-shadow:0 4px 14px rgba(0,0,0,.3);font-family:'Hind Siliguri','Nirmala UI',sans-serif}
    .pbar b{color:#f3c55d;margin-right:10px}.pbar button{font:700 15px 'Hind Siliguri','Nirmala UI',sans-serif;padding:8px 22px;border-radius:999px;border:0;cursor:pointer;background:linear-gradient(180deg,#ffe6a8,#d9a441);color:#2b1c00}
    .pbar button.x{background:rgba(255,255,255,.12);color:#fff}
    @media print{.pbar{display:none!important}}`,
  // নতুন উইন্ডোতে প্রিন্ট
  // ছবি না দিলে নিজে থেকে একটা পোস্টারের মতো কভার — নাম থেকে রঙ বাছা হয়, তাই প্রতিটা আলাদা দেখায়
  autoPoster(title, sub, meta, kind, course) {
    const e = U.esc, P = [["#0b3b36", "#11846f"], ["#1d2b64", "#3d7bff"], ["#5b1a8c", "#d1307a"], ["#8a1c12", "#e8730f"], ["#0f4c5c", "#2bb39a"], ["#3b2a17", "#c58b2b"]];
    let h = 0; for (const ch of String(title)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const [a, b] = P[h % P.length];
    const price = course ? (course.salePrice || course.price ? "৳" + U.bn(Number(course.salePrice || course.price).toLocaleString("en-IN")) : "ফ্রি") : "";
    return `<span class="ap-poster ap-${kind}" style="--pa:${a};--pb:${b}"><span class="ap-ring"></span><span class="ap-brand"><img src="/images/logo-nav.png" alt="শাহিন’স আইসিটি কেয়ার">Shahin's ICT Care</span>
      ${kind === "oc" && price ? `<span class="ap-price">${e(price)}</span>` : ""}<b class="ap-t">${e(title)}</b>${sub ? `<span class="ap-s">${e(sub)}</span>` : ""}${meta ? `<span class="ap-m">${e(meta)}</span>` : ""}</span>`;
  },
  // ফ্রি ক্লাস আর অনলাইন কোর্সের কার্ড (মূল পাতা আর /courses, /free-classes পাতায় একই রকম)
  fcCard(c, i) {
    const e = U.esc;
    return `<button type="button" class="fc-card reveal" data-fc="${i}" aria-label="${e(c.title)} — দেখুন">
      <span class="fc-bar fc-top"><span class="fc-no"><small>ক্লাস</small><b>${U.bn(String(i + 1).padStart(2, "0"))}</b></span>${c.subject ? `<span class="fc-tag"><i aria-hidden="true"></i>${e(c.subject)}</span>` : ""}</span>
      <span class="fc-thumb">${c.thumb ? `<img src="${e(c.thumb)}" alt="" loading="lazy">` : U.autoPoster(c.subject || "ফ্রি ক্লাস", "", "", "fc")}<span class="fc-play" aria-hidden="true"></span></span>
      <span class="fc-bar fc-foot"><span class="fc-tt"><b class="fc-title">${e(c.title)}</b><small>▶ ফ্রি ভিডিও ক্লাস</small></span><em aria-hidden="true">→</em></span></button>`;
  },
  ocPrice(c) {
    const m = (n) => "৳" + U.bn(Number(n).toLocaleString("en-IN"));
    if (!c.price && !c.salePrice) return '<b class="oc-free">ফ্রি</b>';
    return c.salePrice && c.salePrice < c.price ? `<b>${m(c.salePrice)}</b><s>${m(c.price)}</s>` : `<b>${m(c.salePrice || c.price)}</b>`;
  },
  ocCard(c) {
    const e = U.esc, bn = U.bn;
    return `<article class="oc-card reveal"><a class="oc-cover" href="/course?id=${encodeURIComponent(c.id)}">${c.cover ? `<img src="${e(c.cover)}" alt="${e(c.title)}" loading="lazy">` : U.autoPoster(c.title, c.subtitle, [c.duration && "⏱ " + c.duration, c.lessons && "🎬 " + bn(c.lessons) + "টি ক্লাস"].filter(Boolean).join("  ·  "), "oc", c)}</a>
      <div class="oc-body"><div class="oc-meta">${c.duration ? `<span>⏱ ${e(c.duration)}</span>` : "<span></span>"}<span>👥 ${bn(c.enrolled)} · 🎬 ${bn(c.lessons)}টি ক্লাস</span></div>
        <h3>${e(c.title)}</h3>${c.subtitle ? `<p>${e(c.subtitle)}</p>` : ""}<div class="oc-price">${U.ocPrice(c)}</div>
        <div class="oc-acts"><a class="btn ghost dark" href="/course?id=${encodeURIComponent(c.id)}">বিস্তারিত দেখুন</a><a class="btn oc-buy" href="/course?id=${encodeURIComponent(c.id)}#enroll">ভর্তি হোন</a></div></div></article>`;
  },
  // ভিডিও প্লেয়ার (পপআপ): video = { type: "youtube", yt } বা { type: "file", src }
  playVideo(video, title) {
    if (!video) return;
    let dlg = document.getElementById("vpDlg");
    if (!dlg) {
      dlg = document.createElement("dialog"); dlg.id = "vpDlg"; dlg.className = "vp-dlg";
      dlg.innerHTML = '<div class="vp-head"><b id="vpTitle"></b><button type="button" id="vpX" aria-label="বন্ধ করুন">×</button></div><div class="vp-box" id="vpBox"></div>';
      document.body.append(dlg);
      const close = () => { document.getElementById("vpBox").innerHTML = ""; dlg.close(); };
      dlg.querySelector("#vpX").onclick = close;
      dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });
      dlg.addEventListener("cancel", () => { document.getElementById("vpBox").innerHTML = ""; });
    }
    document.getElementById("vpTitle").textContent = title || "";
    document.getElementById("vpBox").innerHTML = U.videoEmbed(video, true);
    dlg.showModal();
  },
  videoEmbed(video, autoplay) {
    if (!video) return "";
    if (video.type === "youtube") return `<iframe referrerpolicy="strict-origin-when-cross-origin" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.yt)}?rel=0&modestbranding=1${autoplay ? "&autoplay=1" : ""}" title="ভিডিও" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    return `<video src="${U.esc(video.src)}" controls${autoplay ? " autoplay" : ""} playsinline controlslist="nodownload" oncontextmenu="return false"></video>`;
  },
  // ট্যালেন্ট হান্টের প্রবেশপত্র — এক বা অনেকজনের (A4 পাতায় দুটো করে)। regs: [{roll,name,klass,college}], hunt: {title,examDate,examTime,venue,subjects,full}
  talentAdmit(regs, hunt, site = {}) {
    const w = window.open("", "_blank");
    if (!w) { (U.toast || alert)("পপ-আপ বন্ধ আছে — ব্রাউজারে পপ-আপের অনুমতি দিন", true); return; }
    const e = U.esc, bn = U.bn, logo = location.origin + "/images/logo-receipt.png";
    const subj = (hunt.subjects || []).map((s) => `${e(s.name)} (${bn(s.full)})`).join(" · ");
    const card = (r) => `<section class="ac"><header><img src="${logo}" alt=""><div><b>${e(site.name || "Shahin's ICT Care")}</b><small>${e([site.address, site.phone].filter(Boolean).join(" · "))}</small></div><span>প্রবেশপত্র</span></header>
      <h1>🏆 ${e(hunt.title)}</h1>
      <div class="roll"><small>রোল নম্বর</small><b>${e(r.roll)}</b></div>
      <dl><dt>নাম</dt><dd>${e(r.name)}</dd><dt>শ্রেণি / ব্যাচ</dt><dd>${e(r.klass || "—")}</dd><dt>প্রতিষ্ঠান</dt><dd>${e(r.college || "—")}</dd>
        <dt>পরীক্ষার তারিখ</dt><dd>${hunt.examDate ? U.date(hunt.examDate) : "পরে জানানো হবে"}${hunt.examTime ? " · " + e(hunt.examTime) : ""}</dd><dt>কেন্দ্র</dt><dd>${e(hunt.venue || "পরে জানানো হবে")}</dd>
        <dt>বিষয়</dt><dd>${subj || "—"}${hunt.full ? ` · মোট ${bn(hunt.full)} নম্বর (MCQ)` : ""}</dd></dl>
      <ul><li>পরীক্ষার দিন এই প্রবেশপত্র (প্রিন্ট বা মোবাইলে) সাথে আনতে হবে।</li><li>পরীক্ষা শুরুর অন্তত ১৫ মিনিট আগে কেন্দ্রে আসতে হবে। কলম সাথে আনবে।</li><li>ফলাফল ওয়েবসাইটে রোল আর মোবাইল নম্বর দিয়ে দেখা যাবে।</li></ul>
      <footer><span>শিক্ষার্থীর স্বাক্ষর</span>${U.sig("কর্তৃপক্ষের স্বাক্ষর")}</footer></section>`;
    w.document.write(`<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>প্রবেশপত্র — ${e(hunt.title)}</title>
      <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&family=Noto+Serif+Bengali:wght@700;900&display=swap" rel="stylesheet">
      <style>${U.DOC_CSS}*{box-sizing:border-box}body{margin:0;font-family:'BnNum','Hind Siliguri','Nirmala UI',sans-serif;color:#16302b;background:#eee}
      .ac{width:190mm;height:136mm;margin:6mm auto;background:#fff;border:2px solid #0b3b36;border-radius:14px;padding:8mm 10mm;position:relative;overflow:hidden;page-break-inside:avoid}
      .ac:nth-of-type(2n){page-break-after:always}
      header{display:flex;align-items:center;gap:10px;background:#f3f6f4;border-radius:3mm;padding:2mm 3mm;border-bottom:1.6px solid #1f6b52}header img{width:30mm;max-height:18mm;object-fit:contain}header b{font:900 18px 'Noto Serif Bengali',serif;color:#0b3b36;display:block}header small{color:#5d7570;font-size:12px}
      header span{margin-left:auto;padding:4px 14px;border-radius:999px;background:#0b3b36;color:#f3c55d;font-weight:700}
      h1{margin:8px 0 6px;font:900 20px 'Noto Serif Bengali',serif;color:#0b3b36}
      .roll{position:absolute;right:10mm;top:34mm;text-align:center;border:2px dashed #d9a441;border-radius:12px;padding:6px 14px;background:#fff8e6}.roll small{display:block;color:#8a5a00;font-weight:700}.roll b{font:800 22px Consolas,Hind Siliguri,monospace;color:#0b3b36}
      dl{display:grid;grid-template-columns:34mm 1fr;gap:3px 8px;margin:6px 0;font-size:14px;max-width:120mm}dt{color:#5d7570}dd{margin:0;font-weight:600}
      ul{margin:6px 0 0;padding-left:18px;font-size:12.5px;color:#3a5550}footer{position:absolute;left:10mm;right:10mm;bottom:7mm;display:flex;justify-content:space-between}footer span{border-top:1px solid #777;padding-top:3px;width:52mm;text-align:center;font-size:12px}
      .bar{position:sticky;top:0;background:#0b3b36;color:#fff;padding:10px;text-align:center}.bar button{font:inherit;font-weight:700;padding:6px 18px;border-radius:999px;border:0;background:#f3c55d;cursor:pointer}
      @media print{body{background:#fff}.bar{display:none}.ac{margin:4mm auto;border-width:1.5px}}</style></head>
      <body><div class="bar">প্রিন্ট প্রিভিউ · ${bn(regs.length)}টি প্রবেশপত্র · <button onclick="print()">🖨 প্রিন্ট / PDF</button> <button onclick="close()" style="background:rgba(255,255,255,.18);color:#fff">✕ বন্ধ করুন</button></div>${regs.map(card).join("")}
      </body></html>`);
    w.document.close();
  },
  printHtml(title, inner) {
    const w = window.open("", "_blank");
    if (!w) { U.toast("পপ-আপ বন্ধ আছে — ব্রাউজারে পপ-আপের অনুমতি দিন", true); return; }
    // fit: লম্বা লেখা ঘরের মাপে ছোট করা; ফন্ট লোড হলে তারপর প্রিন্ট
    const fit = `function fitAll(){document.querySelectorAll('.fit').forEach(function(el){var s=parseFloat(el.style.fontSize)||12;while((el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1)&&s>5){s-=0.3;el.style.fontSize=s+'pt';}});}
      window.onload=function(){(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(function(){fitAll();});};`;
    w.document.write(`<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>${U.esc(title)}</title>
      <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@500;600;700&family=Montserrat:wght@600;700;800&display=swap" rel="stylesheet">
      <style>${U.TIRO_CSS}${U.PRINT_CSS}${U.PRINT_BAR_CSS}</style></head><body>${U.PRINT_BAR}${inner.includes("afx") ? inner : `<div class="pad">${inner}</div>`}<script>${fit}<\/script></body></html>`);
    w.document.close();
  },
  // প্রিন্টের ডিজাইন — ভর্তি ফর্ম: শাহিন'স আইসিটি কেয়ারের আসল PDF পাতা (নমুনা লেখা মুছে) পেছনে, তার উপর ঘরে ঘরে তথ্য
  PRINT_CSS: `@page{size:A4;margin:0}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{font-family:'Hind Siliguri','Nirmala UI',sans-serif;color:#16302b;margin:0;font-size:13.5px;line-height:1.45;background:#777}
    @media print{body{background:none}}
    .pad{padding:12mm;background:#fff;min-height:100vh}
    /* ===== ভর্তি ফর্ম ===== */
    .afx{position:relative;width:210mm;height:297mm;margin:0 auto;background:#fff center/100% 100% no-repeat;overflow:hidden;page-break-after:always;break-after:page}
    .afx:last-child{page-break-after:auto;break-after:auto}
    @media screen{.afx{margin:8mm auto;box-shadow:0 6px 24px rgba(0,0,0,.4)}}
    .afx .v{position:absolute;display:flex;align-items:center;overflow:hidden;color:#0a5a4e;font-family:'Montserrat','Hind Siliguri','Segoe UI','Nirmala UI',sans-serif;font-weight:700;white-space:nowrap;line-height:1.15}
    .afx .v.c{justify-content:center}
    .afx .v.wrap{white-space:normal;align-items:flex-start;padding-top:.6mm;line-height:1.3}
    .afx .v.list{display:block;white-space:normal;padding-top:.8mm;line-height:1.42;font-family:'Hind Siliguri','Nirmala UI',sans-serif}
    .afx .er{position:absolute;background:rgb(226,245,196)}
    .afx .sl{position:absolute;color:#fff;font:800 13pt 'Montserrat','Segoe UI',Arial,sans-serif;letter-spacing:.02em}
    .afx .ph{position:absolute;object-fit:cover;background:#fff}
    .afx .note{position:absolute;left:0;right:0;bottom:2.2mm;text-align:center;font-size:7.5pt;color:#cfe3dc}
    /* ===== আবেদনের স্লিপ ===== */
    .slip{max-width:520px;margin:0 auto;border:2px solid #0b3b36;border-radius:14px;overflow:hidden}.slip header{background:#0b3b36;color:#fff;padding:12px 16px}.slip header small{color:#f3c55d}
    .slip .sb{padding:14px 16px}.slip .no{font:700 26px Consolas,Hind Siliguri,monospace;color:#0b3b36;letter-spacing:2px}`,
  // PDF পাতার প্রতিটি ঘরের মাপ (পাতার % হিসেবে): [ঘর, লেখা শুরু x, লেখা শুরু y, ঘরের বাঁ, ঘরের ডান, ঘরের নিচ]
  FORM_MAP: {
    p1: [["studentId", 5.708, 35.853, 5.428, 49.692, 38.979, "c"], ["joiningDate", 49.86, 35.853, 49.86, 92.445, 38.979, "c"],
      ["nameEn", 7.051, 42.026, 5.428, 49.468, 45.113], ["name", 50.811, 42.026, 49.636, 92.557, 45.113],
      ["dob", 6.659, 47.21, 5.596, 27.588, 49.98], ["gender", 29.267, 47.21, 27.756, 49.301, 49.98], ["bloodGroup", 50.979, 47.21, 49.524, 72.692, 49.98], ["religion", 74.538, 47.21, 72.971, 92.557, 49.98],
      ["nationality", 6.659, 52.236, 5.764, 27.588, 54.887], ["phone", 28.875, 52.236, 27.812, 49.301, 54.887], ["phone2", 50.811, 52.236, 49.524, 72.636, 54.887], ["whatsapp", 73.867, 52.236, 72.86, 92.557, 54.887],
      ["fatherName", 6.827, 63.87, 5.764, 32.065, 66.64], ["fatherOccupation", 33.576, 63.87, 32.177, 65.305, 66.64], ["fatherPhone", 66.592, 63.87, 65.417, 92.949, 66.64],
      ["motherName", 6.939, 69.173, 5.876, 32.177, 71.903], ["motherOccupation", 33.688, 69.173, 32.289, 65.417, 71.903], ["motherPhone", 66.704, 69.173, 65.529, 93.005, 71.903],
      ["guardianName", 6.827, 74.476, 5.82, 32.121, 77.246], ["guardianOccupation", 33.632, 74.476, 32.177, 65.361, 77.246], ["guardianPhone", 66.592, 74.476, 65.473, 92.949, 77.246],
      ["guardianRelation", 6.883, 79.897, 5.876, 32.121, 82.509], ["address", 33.6, 79.897, 32.233, 65.137, 82.509, "wrap"], ["permanentAddress", 66.6, 79.897, 65.249, 93.005, 82.509, "wrap"],
      ["sscExam", 7.331, 92.244, 6.603, 15.893, 94.46], ["sscSchool", 16.788, 92.244, 16.06, 52.154, 94.46], ["sscBoard", 53.05, 92.244, 52.322, 62.843, 94.46],
      ["sscGroup", 63.738, 92.244, 63.011, 73.195, 94.46], ["sscYear", 74.091, 92.244, 73.363, 83.044, 94.46], ["sscGpa", 83.996, 92.244, 83.268, 93.285, 94.46]],
    p2: [["college", 7.666, 8.271, 6.659, 70.733, 11.041], ["collegeRoll", 71.405, 8.271, 70.845, 93.285, 11.041],
      ["klass", 7.89, 13.296, 6.771, 28.036, 15.908], ["group", 29.155, 13.296, 28.148, 50.14, 15.908], ["courseType", 51.371, 13.296, 50.252, 70.621, 15.908], ["batchLabel", 71.405, 13.296, 70.677, 93.397, 15.908, "wrap"],
      // বিষয়ের তিন ঘর: আবশ্যিক (PDF-এর ছাপা তালিকা ঢেকে নতুন করে লেখা, নম্বর একটানা), গ্রুপ সাবজেক্ট, ৪র্থ বিষয়
      ["compulsory", 7.9, 18.995, 6.9, 32.68, 30.985, "list"],
      ["groupSubjects", 34.527, 18.995, 33.128, 65.976, 30.985, "list"], ["fourthSubject", 67.264, 18.995, 66.2, 93.397, 30.985, "list"],
      ["paymentType", 7.611, 40.364, 6.491, 27.756, 43.055], ["fee", 28.987, 40.364, 27.868, 49.86, 43.055], ["discount", 51.035, 40.364, 49.972, 70.341, 43.055], ["payable", 71.237, 40.364, 70.453, 93.117, 43.055],
      ["startDate", 7.611, 45.667, 6.491, 27.756, 48.397], ["endDate", 28.987, 45.667, 27.868, 49.86, 48.397], ["duration", 51.203, 45.667, 49.972, 70.341, 48.397], ["receiptNo", 71.181, 45.667, 70.453, 93.117, 48.397],
      ["source", 7.778, 57.499, 6.491, 49.748, 60.625], ["refName", 50.979, 57.499, 49.916, 93.117, 60.625],
      ["refPhone", 7.778, 63.277, 6.659, 49.86, 65.849], ["refOccupation", 50.588, 63.277, 49.916, 93.285, 65.849]],
    sl: [4.029, 5.936], photo: [84.443, 3.008, 96.698, 11.041],
  },
  // A4 ভর্তি ফর্ম (২ পাতা) — d: শিক্ষার্থী/আবেদনের তথ্য; ctx: আইডি, ফি ইত্যাদি। d খালি হলে হাতে পূরণের খালি ফর্ম
  admissionFormHtml(d, ctx) {
    const e = U.esc, M = U.FORM_MAP;
    const dmy = (s) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split("-").reverse().join("/") : s || "");
    const tk = (n) => (n === undefined || n === null || n === "" ? "" : `${Number(n).toLocaleString("en-IN")}/-`);
    const blank = !d.name && !d.nameEn;
    const val = {
      studentId: ctx.studentId, joiningDate: dmy(ctx.joiningDate),
      nameEn: d.nameEn, name: d.name, dob: dmy(d.dob), gender: { M: "Male", F: "Female", O: "Other" }[d.gender] || "",
      bloodGroup: d.bloodGroup, religion: d.religion, nationality: d.nationality, phone: d.phone, phone2: d.phone2, whatsapp: d.whatsapp,
      fatherName: d.fatherName, fatherOccupation: d.fatherOccupation, fatherPhone: d.fatherPhone,
      motherName: d.motherName, motherOccupation: d.motherOccupation, motherPhone: d.motherPhone,
      guardianName: d.guardianName, guardianOccupation: d.guardianOccupation, guardianPhone: d.guardianPhone,
      guardianRelation: d.guardianRelation, address: d.address, permanentAddress: d.sameAddress && d.address ? d.address : d.permanentAddress,
      sscExam: d.sscExam || (blank ? "" : "SSC"), sscSchool: d.sscSchool, sscBoard: d.sscBoard, sscGroup: d.sscGroup, sscYear: d.sscYear, sscGpa: d.sscGpa,
      college: d.college, collegeRoll: d.collegeRoll, klass: [d.klass, d.session].filter(Boolean).join(" · "), group: d.group,
      courseType: ctx.courseName, batchLabel: ctx.batchLabel,
      ...(() => {
        // বিষয়: subject1–4 থাকলে পত্রসহ নম্বর দেওয়া তালিকা; পুরনো রেকর্ডে লেখা থাকলে সেটাই
        const c = U.subjectColumns(d), bnum = (n) => String(n).replace(/\d/g, (x) => "০১২৩৪৫৬৭৮৯"[x]) + "।";
        const lines = (arr) => arr.map((x) => `${bnum(x.n)} ${x.s}`);
        const chap = ctx.chapters && ctx.chapters.length ? ["অধ্যায়: " + ctx.chapters.join(", ")] : [];
        return {
          compulsory: lines(c.fixed),
          groupSubjects: c.main.length ? [...lines(c.main), ...chap] : [d.groupSubjects, ...chap].filter(Boolean),
          fourthSubject: c.fourth.length ? lines(c.fourth) : [d.fourthSubject].filter(Boolean),
        };
      })(),
      paymentType: ctx.paymentType, fee: tk(ctx.fee), discount: tk(ctx.discount), payable: tk(ctx.payable),
      startDate: dmy(ctx.startDate), endDate: dmy(ctx.endDate), duration: ctx.duration, receiptNo: ctx.receiptNo,
      source: d.source, refName: d.refName, refPhone: d.refPhone, refOccupation: d.refOccupation,
    };
    // ঘরের উচ্চতা থেকে লেখার মাপ (মিমি → pt); লম্বা লেখা প্রিন্ট উইন্ডোতে ছোট হয়ে ঘরে ধরে যায়
    const cells = (list) => list.map(([k, x, y, x0, x1, y1, mode]) => {
      const v = val[k];
      if (mode === "list") {
        // আবশ্যিক ঘরে PDF-এর আগের ছাপা লেখা ঢেকে দেওয়া (খালি ফর্মেও নম্বর ঠিক থাকে)
        const cover = k === "compulsory" ? `<div class="er" style="left:${x0}%;top:${y - 0.3}%;width:${x1 - x0}%;height:${y1 - y + 0.2}%"></div>` : "";
        if (!v || !v.length) return cover;
        return cover + `<div class="v fit list" style="left:${x}%;top:${y}%;width:${x1 - x - 0.6}%;height:${y1 - y}%;font-size:11.5pt">${v.map((s) => `<div>${e(s)}</div>`).join("")}</div>`;
      }
      if (v === undefined || v === null || v === "") return "";
      const big = ["studentId", "joiningDate", "nameEn", "name"].includes(k);
      const hmm = ((y1 - y) / 100) * 297, fs = Math.min(mode === "wrap" ? 11.5 : big ? 19 : 15.5, hmm * 0.68 * 2.835);
      const left = mode === "c" ? x0 : x, width = (mode === "c" ? x1 - x0 : x1 - x - 0.6);
      return `<div class="v fit ${mode || ""}" style="left:${left}%;top:${y}%;width:${width}%;height:${y1 - y}%;font-size:${fs.toFixed(1)}pt">${e(String(v))}</div>`;
    }).join("");
    const [px0, py0, px1, py1] = M.photo;
    return `
<div class="afx" style="background-image:url('${location.origin}/images/form-p1.png')">
  ${ctx.serial ? `<div class="sl" style="left:${M.sl[0]}%;top:${M.sl[1]}%">${e(String(ctx.serial))}</div>` : ""}
  <img class="ph" src="${e(ctx.photoUrl || U.avatarSrc(d.gender))}" style="left:${px0}%;top:${py0}%;width:${px1 - px0}%;height:${py1 - py0}%" alt="">
  ${cells(M.p1)}
</div>
<div class="afx" style="background-image:url('${location.origin}/images/form-p2.png')">
  ${cells(M.p2)}
</div>`;
  },
  // ছোট .xlsx ফাইল (লাইব্রেরি ছাড়া): সব ঘর লেখা হিসেবে — তাই ৮৮০১… নম্বর Excel-এ 8.8E+12 হয়ে যায় না
  xlsx(filename, headers, rows) {
    // টাকা, নম্বর ইত্যাদি সংখ্যা হিসেবে (যোগ করা যায়); মোবাইলের মতো ০ দিয়ে শুরু বা লম্বা নম্বর লেখাই থাকে
    const isNum = (v) => (typeof v === "number" && isFinite(v)) || (typeof v === "string" && /^-?(0|[1-9]\d{0,8})(\.\d+)?$/.test(v));
    const widths = headers.map((h, i) => Math.min(60, Math.max(10, ...[h, ...rows.map((r) => r[i])].map((v) => String(v ?? "").length + 2))));
    const ESC ={ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
    const x = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ESC[c]).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
    const col = (i) => { let n = "", k = i + 1; while (k) { n = String.fromCharCode(65 + ((k - 1) % 26)) + n; k = Math.floor((k - 1) / 26); } return n; };
    const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const sheet = `${X}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${headers.map((h, i) => `<col min="${i + 1}" max="${i + 1}" width="${widths[i]}" customWidth="1"/>`).join("")}</cols><sheetData>${[headers, ...rows].map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => (ri && isNum(v) ? `<c r="${col(ci)}${ri + 1}"><v>${Number(v)}</v></c>` : `<c r="${col(ci)}${ri + 1}" t="inlineStr"><is><t xml:space="preserve">${x(v)}</t></is></c>`)).join("")}</row>`).join("")}</sheetData></worksheet>`;
    const files = {
      "[Content_Types].xml": `${X}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
      "_rels/.rels": `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      "xl/workbook.xml": `${X}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
      "xl/worksheets/sheet1.xml": sheet,
    };
    // zip (সংকোচন ছাড়া)
    const enc = new TextEncoder(), crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const u16 = (v) => [v & 255, (v >>> 8) & 255], u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
    const parts = [], cen = []; let off = 0;
    for (const [name, text] of Object.entries(files)) {
      const nb = enc.encode(name), db = enc.encode(text), c = crc(db);
      const head = [...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(c), ...u32(db.length), ...u32(db.length), ...u16(nb.length), ...u16(0)];
      parts.push(new Uint8Array(head), nb, db);
      cen.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(c), ...u32(db.length), ...u32(db.length), ...u16(nb.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nb);
      off += head.length + nb.length + db.length;
    }
    const cenLen = cen.reduce((t, b) => t + b.length, 0), n = Object.keys(files).length;
    const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(n), ...u16(n), ...u32(cenLen), ...u32(off), ...u16(0)]);
    const blob = new Blob([...parts, ...cen, end], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return blob;
  },
  csv(filename, headers, rows) {
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const text = "﻿" + [headers.map(q).join(","), ...rows.map((r) => r.map(q).join(","))].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
};

// সব পেজে "← Back" বোতাম: অ্যাডমিনে উপরের বারে, বাকি পেজে নিচে বাম কোণে ভাসমান।
// আগের পাতা থাকলে সেখানে ফেরে, না থাকলে মূল পাতায় (অ্যাডমিনে ড্যাশবোর্ডে)। মূল পাতা (হোমপেজ, অ্যাডমিন ড্যাশবোর্ড)-এ দেখায় না।
(() => {
  const add = () => {
    if (document.getElementById("sicBack")) return;
    const path = location.pathname.replace(/\/index\.html$/, "/"), home = path === "/";
    const fromSite = document.referrer && new URL(document.referrer).origin === location.origin;
    if (home || new URLSearchParams(location.search).has("embed")) return; // অ্যাডমিনের ভেতরে বসানো পাতায় Back অ্যাডমিনের উপরের বারেই আছে
    const b = document.createElement("button");
    b.type = "button"; b.id = "sicBack"; b.className = "sic-back no-print"; b.title = "আগের পাতায় ফিরে যান"; b.textContent = "← Back";
    const admin = document.getElementById("pageTitle");
    b.onclick = () => {
      if (history.length > 1) return history.back();
      if (admin) location.hash = "#dashboard"; else location.href = "/";
    };
    const st = document.createElement("style");
    st.textContent = `.sic-back{font:700 14px 'Hind Siliguri','Nirmala UI',sans-serif;cursor:pointer;border-radius:999px;padding:8px 16px;line-height:1}
      .sic-back.fl{position:fixed;left:16px;bottom:16px;z-index:900;background:#0b3b36;color:#f3c55d;border:1.5px solid #f3c55d;box-shadow:0 6px 18px rgba(0,0,0,.25)}
      .sic-back.fl:hover{background:#f3c55d;color:#0b3b36}
      .sic-back.tb{background:#fff;color:#0b3b36;border:1.5px solid #cbded7;padding:7px 14px;margin-right:4px}.sic-back.tb:hover{border-color:#0b3b36}
      @media print{.sic-back{display:none!important}}.sic-back[hidden]{display:none}`;
    document.head.append(st);
    if (admin) { b.classList.add("tb"); admin.before(b); const vis = () => (b.hidden = (location.hash || "#dashboard").startsWith("#dashboard")); vis(); addEventListener("hashchange", vis); } else { b.classList.add("fl"); document.body.append(b); }
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", add) : add();
})();

// মেনুতে ফোন নম্বরের ঠিক পাশে সবুজ WhatsApp বোতাম — নম্বর আসে সেটিংসের "WhatsApp" ঘর থেকে, খালি থাকলে দেখায় না
(function () {
  const add = async () => {
    const ph = document.getElementById("navPhone");
    if (!ph || document.getElementById("navWa")) return;
    let c = {};
    try { c = await fetch("/api/contact").then((r) => r.json()); } catch { return; }
    if (!c.whatsapp) return;
    const a = document.createElement("a");
    a.className = "nav-wa"; a.id = "navWa"; a.href = "https://wa.me/" + c.whatsapp; a.target = "_blank"; a.rel = "noopener"; a.setAttribute("aria-label", "WhatsApp-এ মেসেজ করুন");
    a.innerHTML = '<i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.15l-.3-.18-3 .78.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.25-.12-1.470-.72-1.7-.8s-.39-.12-.56.12-.64.8-.78.97-.29.18-.54.06a6.7 6.7 0 0 1-3.3-2.9c-.25-.43.25-.4.7-1.33a.44.44 0 0 0-.02-.42c-.06-.12-.56-1.34-.76-1.84s-.4-.42-.56-.43h-.48a.92.92 0 0 0-.67.31 2.8 2.8 0 0 0-.87 2.08 4.9 4.9 0 0 0 1 2.58 11.1 11.1 0 0 0 4.270 3.77c1.6.69 2.22.75 3.02.63a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .15-1.2c-.06-.11-.23-.17-.48-.29z"/></svg></i><span>WhatsApp</span>';
    ph.after(a);
    document.documentElement.classList.add("has-nav-wa");
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", add) : add();
})();

// ওয়েবসাইটের "লগইন" বোতাম: চাপলে তিনটা পথ — অ্যাডমিন (অ্যাডমিন প্যানেল), শিক্ষার্থী (শিক্ষার্থী প্যানেল), অতিথি (প্রশ্নোত্তর বক্স ও কুইজ)
(function () {
  const OPTS = [["/admin", "🛡️", "অ্যাডমিন", "PIN, তারপর ইমেইল ও পাসওয়ার্ড দিয়ে প্যানেলে"], ["/student", "🎓", "শিক্ষার্থী", "আইডি আর PIN দিয়ে নিজের প্যানেলে"], ["#guest", "👤", "অতিথি", "মোবাইল নম্বর আর PIN দিয়ে — প্রশ্ন করুন, কুইজ দিন"]];
  let box = null, from = null;
  const close = () => { if (box) box.hidden = true; if (from) from.setAttribute("aria-expanded", "false"); from = null; };
  const place = () => {
    if (!box || box.hidden || !from) return;
    const r = from.getBoundingClientRect(), w = box.offsetWidth, x = Math.min(Math.max(12, r.right - w), innerWidth - w - 12);
    box.style.left = x + "px"; box.style.top = r.bottom + 10 + "px";
  };
  // কে লগইন আছে (অতিথি / শিক্ষার্থী) — থাকলে "লগইন" বোতামে তার নাম
  let who = null;
  const setWho = (w) => {
    who = w;
    document.querySelectorAll(".nav-login").forEach((btn) => {
      let t = btn.querySelector(".nl-text");
      if (!t) { [...btn.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).forEach((n) => n.remove()); t = document.createElement("span"); t.className = "nl-text"; btn.append(t); }
      const first = w ? String(w.name || "").trim().split(/\s+/)[0] : "";
      t.textContent = w ? (first.length > 12 ? first.slice(0, 11) + "…" : first || "আমার অ্যাকাউন্ট") : "লগইন";
      btn.classList.toggle("in", !!w); btn.title = w ? `${w.name} (${w.kind === "guest" ? "অতিথি" : "শিক্ষার্থী"})` : "";
    });
  };
  const loadWho = async () => {
    try { const g = await fetch("/api/guest/me").then((r) => r.json()); if (g.me) return setWho({ ...g.me, kind: "guest" }); } catch {}
    try { const r = await fetch("/api/student/me"); if (r.ok) { const j = await r.json(); return setWho({ name: (j.profile && j.profile.name) || "শিক্ষার্থী", kind: "student" }); } } catch {}
    setWho(null);
  };
  window.addEventListener("sic-guest", (e) => setWho({ ...e.detail, kind: "guest" }));
  window.addEventListener("sic-guest-out", () => setWho(null));
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", loadWho) : loadWho();
  const menuHtml = () => who
    ? `<b class="lp-h">${U.esc(who.name)} <small>· ${who.kind === "guest" ? "অতিথি" : "শিক্ষার্থী"}</small></b>${(who.kind === "guest"
        ? [["/#faq", "💬", "প্রশ্ন করুন", "আইসিটির যেকোনো প্রশ্ন — লেখা, ছবি বা ভয়েসে"], ["/quiz", "📝", "অনলাইন কুইজ", "কুইজ দিন, ফলাফল দেখুন"], ["#logout", "⎋", "লগআউট", "এই ব্রাউজার থেকে বের হন"]]
        : [["/student", "🎓", "আমার প্যানেল", "ফলাফল, হাজিরা, ফি — সব এক জায়গায়"], ["/#faq", "💬", "প্রশ্ন করুন", "আইসিটির যেকোনো প্রশ্ন"], ["#slogout", "⎋", "লগআউট", "এই ব্রাউজার থেকে বের হন"]]
      ).map(([href, ic, t, sub]) => `<a role="menuitem" href="${href}"><i>${ic}</i><span><b>${t}</b><small>${sub}</small></span><em aria-hidden="true">→</em></a>`).join("")}`
    : `<b class="lp-h">কি হিসেবে লগইন করবেন?</b>${OPTS.map(([href, ic, t, s]) => `<a role="menuitem" href="${href}"><i>${ic}</i><span><b>${t}</b><small>${s}</small></span><em aria-hidden="true">→</em></a>`).join("")}`;
  const open = (btn) => {
    if (!box) {
      box = document.createElement("div"); box.className = "login-pick"; box.setAttribute("role", "menu"); box.hidden = true;
      document.body.append(box);
    }
    if (box.hidden) box.innerHTML = menuHtml();
    if (from === btn && !box.hidden) return close();
    from = btn; btn.setAttribute("aria-expanded", "true"); box.hidden = false; place(); box.querySelector("a").focus({ preventScroll: true });
  };
  // অপশন বাছলে পপআপ: শিক্ষার্থী = আইডি + PIN একসাথে; অ্যাডমিন = ধাপ ১ PIN → ধাপ ২ ইমেইল + পাসওয়ার্ড
  const en = (v) => String(v || "").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d));
  const post = async (url, body) => {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Something went wrong, please try again");
    return j;
  };
  let dlg = null;
  function loginDialog(kind) {
    if (!dlg) { dlg = document.createElement("dialog"); dlg.className = "lg-dlg"; document.body.append(dlg); dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }); }
    const field = (name, label, attrs) => `<label data-f="${name}">${label}<input name="${name}" ${attrs}></label>`;
    const isAdmin = kind === "admin";
    dlg.innerHTML = `<form method="dialog" novalidate>
      <button type="button" class="lg-x" aria-label="Close">×</button>
      <img class="lg-logo" src="/images/logo-nav.png" alt="শাহিন’স আইসিটি কেয়ার">
      <h2>${isAdmin ? "Admin Login" : "Student Login"}</h2>
      ${isAdmin ? `<ol class="lg-steps"><li class="on">PIN</li><li>Email &amp; Password</li></ol>` : ""}
      <p class="lg-hint">${isAdmin ? "Step 1 — Enter your 6-digit admin PIN" : "Enter the ID and PIN you got at admission"}</p>
      ${isAdmin
        ? field("pin", "Admin PIN", 'class="lg-pin" type="password" inputmode="numeric" maxlength="6" autocomplete="off"') +
          field("email", "Email", 'type="email" autocomplete="username"') + field("password", "Password", 'type="password" autocomplete="current-password"')
        : field("id", "Student ID", 'inputmode="numeric" autocomplete="username" placeholder="e.g. 270001"') +
          field("pin", "PIN", 'class="lg-pin" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password"')}
      <p class="lg-err" role="alert"></p>
      <button class="btn gold lg-go" type="submit">${isAdmin ? "Next →" : "Log in"}</button>
      <button type="button" class="lg-back" hidden>← Re-enter PIN</button>
    </form>`;
    const f = dlg.querySelector("form"), err = f.querySelector(".lg-err"), go = f.querySelector(".lg-go");
    const show = (names) => f.querySelectorAll("label[data-f]").forEach((l) => (l.hidden = !names.includes(l.dataset.f)));
    f.querySelectorAll(".lg-pin").forEach((i) => (i.oninput = () => (i.value = en(i.value).replace(/\D/g, ""))));
    f.querySelector(".lg-x").onclick = () => dlg.close();
    let ticket = "";
    const step = (n) => {
      ticket = n === 1 ? "" : ticket;
      show(n === 1 ? ["pin"] : ["email", "password"]);
      f.querySelectorAll(".lg-steps li").forEach((li, i) => { li.classList.toggle("on", i === n - 1); li.classList.toggle("done", i < n - 1); });
      f.querySelector(".lg-hint").textContent = n === 1 ? "Step 1 — Enter your 6-digit admin PIN" : "Step 2 — Enter your email and password";
      go.textContent = n === 1 ? "Next →" : "Log in";
      f.querySelector(".lg-back").hidden = n === 1;
      if (n === 1) f.pin.value = ""; else f.password.value = "";
      (n === 1 ? f.pin : f.email.value ? f.password : f.email).focus();
    };
    f.querySelector(".lg-back").onclick = () => { err.textContent = ""; step(1); };
    const shake = (m) => { err.textContent = m; f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake"); };
    f.onsubmit = async (e) => {
      e.preventDefault(); err.textContent = ""; go.disabled = true;
      try {
        if (!isAdmin) {
          const id = en(f.elements.namedItem("id").value).trim(), pin = en(f.elements.namedItem("pin").value).trim();
          if (!id || !pin) throw new Error("শিক্ষার্থী আইডি ও PIN দুটোই দিন");
          try { await post("/api/student/login", { id, pin }); }
          catch (error) { if (error.message === "Wrong ID or PIN") throw new Error("আইডি বা PIN মেলেনি। ভর্তি ফর্মের সঠিক আইডি ও PIN দিন।"); throw error; }
          location.href = "/student"; return;
        }
        if (!ticket) {
          const pin = en(f.pin.value);
          if (!/^\d{6}$/.test(pin)) throw new Error("Enter a 6-digit PIN");
          ticket = (await post("/api/admin/pin", { pin })).ticket;
          step(2);
        } else {
          if (!f.email.value.trim() || !f.password.value) throw new Error("Please enter both email and password");
          try { await post("/api/admin/login", { ticket, email: f.email.value.trim(), password: f.password.value }); }
          catch (er) { if (/re-enter PIN/i.test(er.message)) step(1); throw er; }
          location.href = "/admin"; return;
        }
      } catch (er) { shake(er.message); }
      go.disabled = false;
    };
    if (isAdmin) step(1); else show(["id", "pin"]);
    dlg.showModal();
    (isAdmin ? f.pin : f.id).focus();
  }
  // অতিথি: লগইন (মোবাইল + PIN) অথবা নতুন অ্যাকাউন্ট (ভর্তির আগ্রহের তথ্য + নিজের বাছা ৪ সংখ্যার PIN) — প্রশ্নোত্তর বক্স আর কুইজে কাজে লাগে
  // মোবাইলে আসা কোড আলাদা ছোট পপআপে — শুধু কোড চায়; verify(code) ভুল হলে এখানেই দেখায়, আবার পাঠানোর বোতাম থাকে
  let codeDlg = null;
  function askCode(phone, resend, verify) {
    if (!codeDlg) { codeDlg = document.createElement("dialog"); codeDlg.className = "lg-dlg lg-code"; document.body.append(codeDlg); }
    codeDlg.innerHTML = `<form method="dialog" novalidate>
      <button type="button" class="lg-x" aria-label="Close">×</button>
      <i class="lg-ic" aria-hidden="true">✉️</i>
      <h2>Enter the code</h2>
      <p class="lg-hint">We sent a 6-digit code by SMS to <b>${U.esc(phone)}</b>. It works for 5 minutes.</p>
      <input name="otp" class="lg-otp" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="••••••" aria-label="6-digit code">
      <p class="lg-err" role="alert"></p>
      <button class="btn gold lg-go" type="submit">Verify</button>
      <button type="button" class="lg-back" data-resend>Didn't get it? Send the code again</button>
    </form>`;
    const f = codeDlg.querySelector("form"), err = f.querySelector(".lg-err"), go = f.querySelector(".lg-go"), inp = f.otp;
    const shake = (m, ok) => { err.textContent = m; err.classList.toggle("ok", !!ok); if (!ok) { f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake"); } };
    inp.oninput = () => { inp.value = en(inp.value).replace(/\D/g, ""); if (inp.value.length === 6) f.requestSubmit(); };
    f.querySelector(".lg-x").onclick = () => codeDlg.close();
    f.querySelector("[data-resend]").onclick = async () => { try { await resend(); shake("A new code was sent.", true); inp.value = ""; inp.focus(); } catch (er) { shake(er.message); } };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const code = en(inp.value).trim();
      if (!/^\d{6}$/.test(code)) return shake("Enter the 6-digit code from the SMS");
      go.disabled = true;
      try { await verify(code); codeDlg.close(); } catch (er) { shake(er.message); inp.select(); }
      go.disabled = false;
    };
    codeDlg.showModal(); inp.focus();
  }
  async function guestDialog(mode = "login") {
    if (!dlg) { dlg = document.createElement("dialog"); dlg.className = "lg-dlg"; document.body.append(dlg); dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }); }
    let opts = { hsc: [], groups: [], otp: false };
    try { opts = await fetch("/api/guest/me").then((r) => r.json()); } catch {}
    // mode: login / register (নতুন অ্যাকাউন্ট) / reset (PIN ভুলে গেলে) — SMS চালু থাকলে register আর reset-এ মোবাইলে কোড যায়, কোড চায় আলাদা পপআপ
    const reg = mode === "register", reset = mode === "reset", otp = !!opts.otp && (reg || reset);
    const sel = (name, label, list) => `<label>${label}<select name="${name}"><option value="">— Select —</option>${list.map((v) => `<option>${U.esc(v)}</option>`).join("")}</select></label>`;
    const title = reg ? "Create Guest Account" : reset ? "Reset your PIN" : "Guest Login";
    const hint = reg ? `Your mobile number will be your ID.${otp ? " We'll text a code to verify it." : ""} Choose a 4-digit PIN to log in any time.`
      : reset ? "Enter your mobile number and a new PIN — we'll text you a code to confirm." : "Log in with your mobile number and PIN";
    dlg.innerHTML = `<form method="dialog" novalidate>
      <button type="button" class="lg-x" aria-label="Close">×</button>
      <i class="lg-ic" aria-hidden="true">👤</i>
      <h2>${title}</h2>
      <p class="lg-hint">${hint}</p>
      ${reg ? `<label>Your name<input name="name" maxlength="80" autocomplete="name"></label>` : ""}
      <label>Mobile number (your ID)<input name="phone" inputmode="numeric" maxlength="14" autocomplete="username" placeholder="01XXXXXXXXX"></label>
      ${reg ? `<div class="lg-two">${sel("hsc", "HSC batch", opts.hsc || [])}${sel("group", "Group", opts.groups || [])}</div><label>College<input name="college" maxlength="150"></label>` : ""}
      <label>${reg ? "Choose a 4-digit PIN" : reset ? "New 4-digit PIN" : "PIN"}<input name="pin" class="lg-pin" type="password" inputmode="numeric" maxlength="4" autocomplete="${reg || reset ? "new-password" : "current-password"}"></label>
      ${reg || reset ? `<label>Confirm PIN<input name="pin2" class="lg-pin" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password"></label>` : ""}
      ${reg ? `<input name="website" class="lg-hp" tabindex="-1" autocomplete="off" aria-hidden="true">` : ""}
      <p class="lg-err" role="alert"></p>
      <button class="btn gold lg-go" type="submit">${reg ? (otp ? "Send code" : "Create account") : reset ? "Send code" : "Log in"}</button>
      ${!reg && !reset && opts.otp ? `<button type="button" class="lg-back" data-forgot>Forgot PIN?</button>` : ""}
      <button type="button" class="lg-back" data-swap>${reg || reset ? "Already have an account? Log in" : "New here? Create a guest account"}</button>
    </form>`;
    const f = dlg.querySelector("form"), err = f.querySelector(".lg-err"), go = f.querySelector(".lg-go");
    f.querySelectorAll(".lg-pin, [name=phone]").forEach((i) => (i.oninput = () => (i.value = en(i.value).replace(/\D/g, ""))));
    f.querySelector(".lg-x").onclick = () => dlg.close();
    f.querySelector("[data-swap]").onclick = () => guestDialog(reg || reset ? "login" : "register");
    if (f.querySelector("[data-forgot]")) f.querySelector("[data-forgot]").onclick = () => guestDialog("reset");
    const shake = (m) => { err.textContent = m; f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake"); };
    const done = (r) => {
      dlg.close();
      window.dispatchEvent(new CustomEvent("sic-guest", { detail: r.me }));
      if (!document.getElementById("qaForm") && !window.SIC_GUEST_STAY) location.href = "/#faq"; // কুইজের মতো পাতা নিজেই সামলায়
    };
    f.onsubmit = async (e) => {
      e.preventDefault(); err.textContent = ""; go.disabled = true;
      try {
        const phone = en(f.phone.value).trim();
        if (!/^01\d{9}$/.test(phone)) throw new Error("Enter a valid 11-digit mobile number (01…)");
        if (reg && f.name.value.trim().length < 2) throw new Error("Please enter your name");
        const pin = en(f.pin.value).trim();
        if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be 4 digits");
        if ((reg || reset) && pin !== en(f.pin2.value).trim()) throw new Error("The two PINs don't match");
        const submit = (code) => reg
          ? post("/api/guest/register", { name: f.name.value.trim(), phone, pin, otp: code || "", hsc: f.hsc.value, group: f.group.value, college: f.college.value.trim(), website: f.website.value })
          : post("/api/guest/reset", { phone, pin, otp: code });
        if (otp) {
          const resend = () => post("/api/guest/otp", { phone, purpose: reset ? "reset" : "register" });
          await resend();
          askCode(phone, resend, async (code) => done(await submit(code)));
        } else if (reg) done(await submit(""));
        else {
          try { done(await post("/api/guest/login", { phone, pin })); }
          catch (er) { if (/PIN নেই/.test(er.message)) { guestDialog("register"); return; } throw er; }
        }
      } catch (er) { shake(er.message); }
      go.disabled = false;
    };
    dlg.showModal();
    (reg ? f.name : f.phone).focus();
  }
  window.SICGuestLogin = guestDialog;
  async function pick(href) {
    close();
    if (href === "#guest") return guestDialog("login");
    if (href === "#logout" || href === "#slogout") {
      await fetch(href === "#logout" ? "/api/guest/logout" : "/api/student/logout", { method: "POST" }).catch(() => {});
      setWho(null); window.dispatchEvent(new CustomEvent("sic-guest-out")); return;
    }
    if (href.startsWith("/#") && location.pathname === "/") { location.hash = href.slice(1); return; }
    if (!href.startsWith("/admin") && href !== "/student") { location.href = href; return; }
    try {
      if (href === "/admin") {
        // লগইন বন্ধ / আগেই লগইন / প্রথমবার সেটআপ বাকি → সরাসরি অ্যাডমিন পাতায়
        const st = await fetch("/api/admin/status").then((r) => r.json());
        if (!st.lock || st.loggedIn || !st.setup) return (location.href = "/admin");
        return loginDialog("admin");
      }
      const me = await fetch("/api/student/me").then((r) => r.ok);
      if (me) return (location.href = "/student");
      loginDialog("student");
    } catch { location.href = href; }
  }
  document.addEventListener("click", (e) => {
    const opt = e.target.closest(".login-pick a");
    if (opt) { e.preventDefault(); return pick(opt.getAttribute("href")); }
    const btn = e.target.closest(".nav-login, [data-login-pick]");
    if (btn) { e.preventDefault(); return open(btn); }
    if (box && !box.hidden && !e.target.closest(".login-pick")) close();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  addEventListener("resize", place); addEventListener("scroll", place, { passive: true });
})();
