// অ্যাডমিন প্যানেল
// কাঠামো: সেশন (HSC-27) → ক্লাস ব্যাচ (27-B) ; মডিউল (০১–০৫) ; শিক্ষার্থী → এক বা একাধিক মডিউলে ভর্তি (enrollment)
(function () {
  const { $, $$, esc, bn, money, api, toast } = U;
  let DB = null;
  let adminLock = false; // সার্ভারে লগইন চালু আছে কিনা

  // ================= সাধারণ =================
  const batchById = (id) => DB.batches.find((b) => b.id === id);
  const courseById = (id) => DB.courses.find((c) => c.id === id);
  const studentById = (id) => DB.students.find((s) => s.id === id);
  const batchName = (id) => { const b = batchById(id); return b ? U.batchLabel(b) : "—"; };
  const batchFull = (b) => U.batchLabel(b);
  const studentName = (id) => (studentById(id) || {}).name || id;
  const activeStudents = () => DB.students.filter((s) => s.status !== "inactive");
  const pauseOf = (s) => (s.pauses || []).find((p) => !p.to); // এখন চলমান "পড়া বন্ধ"
  const stToggle = (s) => `<button type="button" class="st-toggle ${s.status === "inactive" ? "off" : "on"}" data-status="${s.id}" title="${esc(s.status === "inactive" ? `পড়া বন্ধ${pauseOf(s) ? " — " + U.date(pauseOf(s).from) + " থেকে" + (pauseOf(s).reason ? " · " + pauseOf(s).reason : "") : ""} · চাপ দিয়ে আবার চালু করুন` : "চাপ দিয়ে পড়া বন্ধ রাখুন")}"><i></i>${s.status === "inactive" ? "❚❚ পড়া বন্ধ" : "সক্রিয়"}</button>`;
  const liveSessions = () => DB.sessions.filter((s) => s.active !== false);
  const thisMonth = () => U.today().slice(0, 7);
  const enrollmentsOf = (sid) => DB.enrollments.filter((e) => e.studentId === sid);
  const modulesOf = (sid) => enrollmentsOf(sid).filter((e) => e.status === "active").map((e) => (courseById(e.courseId) || {}).name).filter(Boolean);
  const opt = (list, val) => list.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(val ?? "") ? " selected" : ""}>${esc(l)}</option>`).join("");
  const sessionOptions = (all) => [...(all ? [["", all]] : []), ...DB.sessions.map((s) => [s.name, `${s.name}${s.active === false ? " — বন্ধ" : ""}`])];
  // ব্যাচের তালিকা সেশন অনুযায়ী ভাগ করে (optgroup)
  const batchSelectHtml = (name, val, placeholder, session, liveOnly) => {
    const groups = DB.sessions.filter((s) => !session || s.name === session).map((s) => {
      const list = DB.batches.filter((b) => b.session === s.name && (!liveOnly || b.active !== false || b.id === val));
      return list.length ? `<optgroup label="${esc(s.name)}">${list.map((b) => `<option value="${b.id}"${b.id === val ? " selected" : ""}>${esc(U.batchLabel(b))}${b.active === false ? " — নিষ্ক্রিয়" : ""}</option>`).join("")}</optgroup>` : "";
    }).join("");
    return `<select name="${name}" id="${name}Sel">${placeholder ? `<option value="">${esc(placeholder)}</option>` : ""}${groups}</select>`;
  };
  const feeText = (c) => {
    if (!c) return "";
    if (c.feeType === "monthly") return `${money(c.fee)}/মাস`;
    if (c.feeType === "chapter") { const f = (c.chapters || []).map((x) => x.fee); return f.length ? `অধ্যায় প্রতি ${money(Math.min(...f))}–${money(Math.max(...f))}` : "অধ্যায়ভিত্তিক"; }
    return `${money(c.fee)} এককালীন`;
  };
  const chapterNames = (c, ids) => (c && c.chapters ? c.chapters.filter((x) => (ids || []).includes(x.id)).map((x) => x.name) : []);
  const waLink = (phone, text) => `https://wa.me/88${String(phone || "").replace(/\D/g, "").replace(/^88/, "")}?text=${encodeURIComponent(text)}`;
  const balanceChip = (f) => (f.balance > 0 ? `<span class="chip bad">বকেয়া ${money(f.balance)}</span>` : f.balance < 0 ? `<span class="chip ok">অগ্রিম ${money(-f.balance)}</span>` : `<span class="chip ok">পরিশোধিত</span>`);

  async function load() { DB = await api("/api/admin/db"); DB.batches.sort(U.compareBatchSchedule); U.extraLists = DB.lists || {}; updateChrome(); }
  async function save(col, body, id) { return api(`/api/admin/c/${col}${id ? "/" + id : ""}`, { body }); }
  async function remove(col, id, what) {
    if (!confirm(`${what || "এটি"} মুছে ফেলবেন? এটা আর ফেরানো যাবে না।`)) return false;
    try { await api(`/api/admin/c/${col}/${id}`, { method: "DELETE" }); toast("মুছে ফেলা হয়েছে"); await refresh(); return true; }
    catch (e) { toast(e.message, true); return false; }
  }
  async function refresh() { await load(); route(); }

  function updateChrome() {
    $$("[data-s=name]").forEach((el) => (el.textContent = DB.settings.name || "Shahin's ICT Care"));
    document.title = `অ্যাডমিন প্যানেল — ${DB.settings.name}`;
    const n = (DB.leads || []).filter((l) => l.status === "new").length; // নতুন সম্ভাব্য শিক্ষার্থী
    const badge = $("#enqBadge"); badge.hidden = !n; badge.textContent = bn(n);
    const np = (DB.ocEnrolls || []).filter((e) => e.status === "pending").length; // অনলাইন কোর্সে অনুমোদনের অপেক্ষায়
    const lb = $("#learnBadge"); if (lb) { lb.hidden = !np; lb.textContent = bn(np); }
    const na = DB.applications.filter((a) => a.status === "pending").length;
    const ab = $("#appBadge"); ab.hidden = !na; ab.textContent = bn(na);
    const no = (DB.onlineApps || []).filter((a) => a.status === "pending").length;
    const ob = $("#oaBadge"); if (ob) { ob.hidden = !no; ob.textContent = bn(no); }
    const nq = (DB.qna || []).filter((q) => q.status !== "answered").length; // প্রশ্নোত্তর বক্সে উত্তরের অপেক্ষায়
    const qb = $("#qnaBadge"); if (qb) { qb.hidden = !nq; qb.textContent = bn(nq); }
    const nb = (DB.bookOrders || []).filter((o) => o.status === "new").length; // ওয়েবসাইট থেকে আসা নতুন বইয়ের অর্ডার
    const bb = $("#bookBadge"); if (bb) { bb.hidden = !nb; bb.textContent = bn(nb); }
  }
  const photoUrl = (kind, id) => `/api/admin/photo/${kind}/${encodeURIComponent(id)}?t=${Date.now()}`;
  // ছবি না থাকলে লিঙ্গ অনুযায়ী ছেলে/মেয়ের আইকন
  const avatar = (has, kind, id, name, size = 40, gender) =>
    `<img src="${has ? photoUrl(kind, id) : U.avatarSrc(gender)}" alt="" style="width:${size}px;height:${size}px;border-radius:12px;object-fit:cover;vertical-align:middle">`;

  // কোন মাসে কেন ফি কম ধরা হয়েছে (দেরিতে ভর্তি / ব্যাচ বন্ধ)
  const monthName = (mk) => new Date(mk + "-01T00:00:00").toLocaleDateString("bn-BD", { month: "long", year: "numeric" });
  const feeAdjustHtml = (it) => (it.adjust || []).map((a) => a.paused ? `<small>${monthName(a.month)}: ❚❚ পড়া বন্ধ → ${money(0)}</small>` : `<small>${monthName(a.month)}: ${bn(a.got)}/${bn(a.total)} ক্লাস${a.shut ? ` · ${bn(a.shut)}টি বন্ধ${a.reasons.length ? ` (${esc(a.reasons.join(", "))})` : ""}` : ""}${a.scheduled ? ` · মাসভিত্তিক ফি ${money(a.monthlyRate)}` : ""}${a.late ? " · দেরিতে ভর্তি" : ""} → ${money(a.fee)}</small>`).join("");
  // মাসিক কোর্সে ভর্তির মাসের ফি (সার্ভারের হিসাবের মতোই: ১–৬ তারিখে পুরো মাস, পরে হলে শুরুর দিন থেকে, "টাকা কমবে" এমন বন্ধ বাদ)
  function firstMonthDue(enr, net) {
    const s = studentById(enr.studentId), b = s && batchById(s.batchId);
    if (!b || !enr.startDate) return net;
    const st = new Date(enr.startDate + "T00:00:00");
    net = U.monthlyFeeFor(courseById(enr.courseId) || {}, enr, enr.startDate.slice(0, 7));
    const fromDay = enr.firstTotal && !enr.firstGrace ? st.getDate() : 1;
    return U.monthFee(net, b.days, st.getFullYear(), st.getMonth(), fromDay, U.feeClosedDates(DB.closures, b.id)).fee;
  }
  // ভর্তি ফর্ম প্রিন্ট — d: শিক্ষার্থী বা আবেদন; enr: মডিউলে ভর্তি (থাকলে)
  function printAdmission(d, extra = {}, enr) {
    const c = courseById(enr ? enr.courseId : d.courseId);
    const chapters = chapterNames(c, enr ? enr.chapters : d.chapters);
    const fee = enr ? enr.fee : d.fee;
    const discount = enr ? enr.discount || 0 : 0;
    const b = batchById(d.batchId);
    // কোর্সের মেয়াদ: শুরু-শেষ তারিখ থাকলে মাসের হিসাব, না থাকলে মডিউলের মেয়াদ
    const start = enr ? enr.startDate : "", end = enr ? enr.planEnd || (enr.status === "ended" ? enr.endDate : "") : "";
    let duration = c ? c.duration || "" : "";
    if (start && end) { const a = new Date(start), z = new Date(end); const m = (z.getFullYear() - a.getFullYear()) * 12 + z.getMonth() - a.getMonth() + (z.getDate() >= a.getDate() ? 0 : -1); duration = m > 0 ? `${bn(m)} মাস` : `${bn(Math.max(1, Math.round((z - a) / 864e5)))} দিন`; }
    const firstPay = enr ? DB.payments.filter((p) => p.enrollmentId === enr.id).sort((x, y) => x.receiptNo - y.receiptNo)[0] : null;
    U.printHtml("ভর্তি ফর্ম", U.admissionFormHtml(d, {
      settings: DB.settings, courseName: c ? c.name : "", chapters,
      batchLabel: b ? `${b.name} | ${b.days || ""}${b.time ? " | " + b.time : ""}` : "",
      serial: d.serial, joiningDate: d.admissionDate,
      paymentType: c ? { monthly: "মাসিক", once: "এককালীন", chapter: "অধ্যায়ভিত্তিক" }[c.feeType] : "",
      // মাসিক কোর্সে "পরিশোধযোগ্য" = ভর্তির মাসের (আংশিক) ফি
      fee, discount: fee !== undefined ? discount : undefined, payable: fee !== undefined ? (c && c.feeType === "monthly" && enr ? firstMonthDue(enr, fee - discount) : fee - discount) : undefined,
      startDate: start, endDate: end, duration, receiptNo: firstPay ? firstPay.receiptNo : "",
      ...extra,
    }));
  }

  // ================= মডাল ফর্ম (ছোট কাজের জন্য) =================
  const modal = $("#modal");
  let modalSubmit = null;
  function field(f, v) {
    const val = v ?? f.value ?? "";
    const req = f.required ? " required" : "";
    const cls = f.wide ? ' class="wide"' : f.span ? ` class="span${f.span}"` : "";
    if (f.type === "html") return `<div class="wide">${f.html}</div>`;
    if (f.type === "none") return "";
    // বর্তমান ও স্থায়ী ঠিকানা পাশাপাশি, সাথে "একই ঠিকানা" টিক
    if (f.type === "address") return `<div class="${f.span === 2 ? "span2" : "wide"} addr-row">
      <label>বর্তমান ঠিকানা<textarea name="address" rows="2" placeholder="গ্রাম/মহল্লা, উপজেলা, জেলা">${esc(val)}</textarea></label>
      <label>স্থায়ী ঠিকানা<textarea name="permanentAddress" rows="2" placeholder="গ্রাম/মহল্লা, উপজেলা, জেলা">${esc(f.values ? f.values.permanentAddress || "" : "")}</textarea></label>
      <label class="check same-addr"><input type="checkbox" name="sameAddress"${f.values && f.values.sameAddress ? " checked" : ""}> বর্তমান ঠিকানাই স্থায়ী ঠিকানা</label>
    </div>`;
    if (f.type === "check") return `<label class="check${f.wide ? " wide" : ""}"><input type="checkbox" name="${f.name}"${val ? " checked" : ""}> ${esc(f.label)}</label>`;
    let input;
    if (f.type === "batch") input = batchSelectHtml(f.name, val, f.placeholder || "ব্যাচ বেছে নিন", f.session, true);
    else if (f.type === "select") input = `<select name="${f.name}"${req}>${opt(f.options, val)}</select>`;
    else if (f.type === "textarea") input = `<textarea name="${f.name}" rows="${f.rows || 3}"${req} placeholder="${esc(f.placeholder || "")}">${esc(val)}</textarea>`;
    else input = `<input name="${f.name}" type="${f.type || "text"}" value="${esc(val)}"${req}${f.min !== undefined ? ` min="${f.min}"` : ""}${f.step ? ` step="${f.step}"` : ""}${f.combo ? ` data-combo="${f.combo}"` : ""} placeholder="${esc(f.placeholder || (f.combo ? "লিখে খুঁজুন বা বেছে নিন" : ""))}">`;
    return `<label${cls}>${esc(f.label)}${f.required ? " *" : ""}${f.hint ? ` <small style="color:var(--muted);font-weight:400">${esc(f.hint)}</small>` : ""}${input}</label>`;
  }
  function openModal({ title, body, saveText = "সেভ করুন", onSave, wide, noFoot }) {
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = body;
    $("#modalErr").textContent = "";
    $("#modalSave").textContent = saveText;
    $("#modalSave").disabled = false;
    $("#modalSave").hidden = !onSave;
    $("#modalCancel").textContent = onSave ? "বাতিল" : "বন্ধ করুন";
    $("#modalFoot").hidden = !!noFoot;
    modal.style.width = wide ? "min(900px, calc(100% - 24px))" : "";
    modalSubmit = onSave || null;
    if (!modal.open) modal.showModal();
    const first = $("#modalBody input:not([type=hidden]), #modalBody select, #modalBody textarea");
    if (first && onSave) first.focus();
  }
  function openForm({ title, fields, values = {}, saveText, onSave }) {
    openModal({
      title, saveText,
      body: `<div class="fgrid">${fields.map((f) => field(f, values[f.name])).join("")}</div>`,
      onSave: async () => {
        const data = {};
        for (const f of fields) {
          if (!f.name) continue;
          const el = $(`#modalBody [name="${f.name}"]`);
          data[f.name] = f.type === "check" ? el.checked : f.type === "number" ? Number(el.value || 0) : el.value.trim();
          if (f.required && !String(data[f.name]).trim()) throw new Error(`"${f.label}" দিতে হবে`);
        }
        return onSave(data);
      },
    });
  }
  const closeModal = () => modal.close();
  $("#modalX").onclick = closeModal;
  $("#modalCancel").onclick = closeModal;
  $("#modalForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!modalSubmit) return closeModal();
    const btn = $("#modalSave"); btn.disabled = true; $("#modalErr").textContent = "";
    try { const keepOpen = await modalSubmit(); if (keepOpen !== true) closeModal(); }
    catch (err) { $("#modalErr").textContent = err.message; }
    btn.disabled = false;
  });

  // ================= প্রিন্ট =================
  // উপরের "প্রিন্ট" — যে পাতা খোলা আছে সেটাই: বোতাম বাদ, ফিল্টার/ইনপুট লেখা হয়ে যায়, ফাঁকা কাজের কলাম বাদ, উপরে প্রতিষ্ঠানের হেডার
  function printPage(part) {
    const src = part || $("#content"), O = location.origin, st = DB.settings;
    // একটা অংশ প্রিন্ট হলে: সেই অংশের শিরোনাম, আর পাতার বাকি ফিল্টার (সেশন, ব্যাচ, মাস…) এক লাইনে
    const head = part ? (part.querySelector("h1,h2,h3") || {}).textContent || "" : "";
    const filt = part ? [...$("#content").querySelectorAll("select,input[type=month],input[type=date]")].filter((el) => !part.contains(el) && el.offsetParent).map((el) => { const l = el.closest("label"), lt = l ? [...l.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim() : ""; const v = el.tagName === "SELECT" ? (el.selectedOptions[0] || {}).textContent || "" : el.value; return v ? (lt ? lt + ": " : "") + v : ""; }).filter(Boolean).join(" · ") : "";
    const wide = [...src.querySelectorAll("table")].some((t) => t.scrollWidth > 980);
    const c = src.cloneNode(true);
    // ইনপুটের মান আগে মূল পাতা থেকে নিই (clone-এ টাইপ করা মান থাকে না)
    const orig = [...src.querySelectorAll("input,select,textarea")], copy = [...c.querySelectorAll("input,select,textarea")];
    copy.forEach((el, i) => {
      const o = orig[i], sp = document.createElement("span"); sp.className = "pv";
      if (o.type === "checkbox" || o.type === "radio") { if (o.type === "radio" && !o.checked) return el.remove(); sp.textContent = o.type === "radio" ? "◉" : o.checked ? "✓" : "☐"; }
      else if (o.tagName === "SELECT") sp.textContent = o.selectedOptions[0] ? o.selectedOptions[0].textContent : "";
      else if (o.type === "file" || o.type === "hidden" || o.type === "password") return el.remove();
      else sp.textContent = o.value;
      if (!sp.textContent.trim() && o.type !== "checkbox") return el.remove();
      el.replaceWith(sp);
    });
    // টেবিলের ভেতরের তথ্য-বোতাম (যেমন সক্রিয় / নিষ্ক্রিয় টগল) লেখা হয়ে থাকে, বাকি বোতাম বাদ
    // বাছাই-বোতামের দল (হাজিরার P / A / ছুটি): শুধু যেটা বাছা আছে সেটা
    c.querySelectorAll("td button.on, .att-row button.on").forEach((b) => [...b.parentElement.children].forEach((x) => x.tagName === "BUTTON" && !x.classList.contains("on") && x.remove()));
    c.querySelectorAll(".att-row").forEach((r) => { if (!r.querySelector("button.on")) r.textContent = "—"; });
    c.querySelectorAll("td button:not(.btn):not(.icon-btn), .att-row button").forEach((b) => { const t = b.textContent.trim(); if (/[\p{L}\p{N}]/u.test(t)) { const sp = document.createElement("span"); sp.textContent = t; b.replaceWith(sp); } });
    c.querySelectorAll("button,.btn,.icon-btn,dialog,script,[hidden],.no-print,.pager,.sec-pr").forEach((el) => el.remove());
    c.querySelectorAll("img,source,video").forEach((el) => { if (el.getAttribute("src")) el.setAttribute("src", new URL(el.getAttribute("src"), location.href).href); });
    c.querySelectorAll("a[href]").forEach((a) => a.removeAttribute("href"));
    // সব সারিতে ফাঁকা হয়ে যাওয়া কলাম (যেখানে শুধু বোতাম ছিল) বাদ
    c.querySelectorAll("table").forEach((t) => {
      const rows = [...t.rows]; if (!rows.length) return;
      const n = Math.max(...rows.map((r) => r.cells.length));
      for (let i = n - 1; i >= 0; i--) {
        const body = rows.filter((r) => r.parentElement.tagName !== "THEAD" && r.cells.length === n);
        if (body.length && body.every((r) => !r.cells[i].textContent.trim() && !r.cells[i].querySelector("img,svg"))) rows.forEach((r) => r.cells.length === n && r.cells[i].remove());
      }
    });
    const w = window.open("", "_blank");
    if (!w) return toast("পপ-আপ বন্ধ আছে — ব্রাউজারে পপ-আপের অনুমতি দিন", true);
    const title = $("#pageTitle").textContent.trim() + (head.trim() ? " — " + head.trim().replace(/\s+/g, " ").slice(0, 70) : "");
    w.document.write(`<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>${esc(title)} — ${esc(U.date(U.today()))}</title>
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@600;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${O}/css/app.css"><link rel="stylesheet" href="${O}/css/exams.css">${U.DOC_FONTS}
<style>${U.DOC_CSS}.pt{font:800 18px "Noto Serif Bengali","Nirmala UI",serif;color:#0b2e28;margin:0 0 3mm}.pw table th{background:#1f6b52!important;color:#fff!important}.pw tbody tr:nth-child(even) td{background:#f5f9f7}@font-face{font-family:'BnNum';src:local('Kalpurush'),url('${O}/fonts/kalpurush.ttf') format('truetype');unicode-range:U+0030-0039}${U.TIRO_CSS}
@page{size:A4 ${wide ? "landscape" : "portrait"};margin:9mm}html,body{background:#fff!important}body{font-family:'BnNum','Hind Siliguri','Nirmala UI',sans-serif;margin:0;color:#16302b}
.pb{position:sticky;top:0;z-index:5;background:#0b3b36;padding:10px;text-align:center}.pb button{font:700 14px 'Hind Siliguri',sans-serif;background:#f3c55d;border:0;border-radius:999px;padding:8px 22px;cursor:pointer}
.pw{max-width:${wide ? "1100px" : "800px"};margin:0 auto;padding:14px}.ph{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;background:#f3f6f4;border-radius:10px;padding:10px 14px;border-bottom:2px solid #1f6b52;margin-bottom:12px}
.ph .lg{height:52px;justify-self:end}.ph .org{text-align:center}.ph .org b{display:block;font:900 20px 'Noto Serif Bengali','Nirmala UI',serif;color:#0b2e28}.ph .org small{display:block;font-size:12px;font-weight:600;color:#33433f}.ph .tl{font-weight:800;font-size:17px;color:#0b2e28}.ph .tl small{display:block;font-weight:500;font-size:11px;color:#5d7570}
.pv{font-weight:700;padding:0 4px;border-bottom:1px dotted #9bb0aa}.card{box-shadow:none!important;border:1px solid #e2e8e5;break-inside:avoid}.tbl-wrap{overflow:visible!important;max-height:none!important}table{font-size:12px}
th,td{padding:5px 7px!important}thead{display:table-header-group}tr{break-inside:avoid}.ft{text-align:center;font-size:10px;color:#7b8884;margin-top:14px;border-top:1px dashed #d4dcd8;padding-top:5px}
@media print{.pb{display:none}.pw{padding:0;max-width:none}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
<div class="pb"><b style="color:#fff;margin-right:10px;font-family:Hind Siliguri,sans-serif">প্রিন্ট প্রিভিউ</b><button onclick="print()">প্রিন্ট / PDF</button> <button onclick="window.close()" style="background:rgba(255,255,255,.18);color:#fff">✕ বন্ধ করুন</button></div>
<div class="pw">${U.docHead(title, st)}<h1 class="pt">${esc(title)}</h1>
${filt ? `<p style="margin:0 0 10px;font-weight:600;color:#33433f">${esc(filt)}</p>` : ""}${part ? c.outerHTML : c.innerHTML}${U.docFoot(st)}</div>
</body></html>`);
    w.document.close();
  }
  // যে অংশে টেবিল বা চার্ট আছে, তার নিচে নিজে থেকেই "এই অংশ প্রিন্ট" — নিজস্ব প্রিন্ট বোতাম থাকলে বাদ
  function addSectionPrints() {
    const root = $("#content"), done = new Set();
    root.querySelectorAll("table, svg.rs-chart").forEach((t) => {
      let sec = null;
      for (let el = t.parentElement; el && el !== root; el = el.parentElement) if (el.matches(".card, section")) sec = el;
      if (!sec || done.has(sec)) return; done.add(sec);
      if (sec.querySelector(":scope > .sec-pr") || [...sec.querySelectorAll("button,a.btn")].some((b) => /|print/i.test(b.textContent) && !b.closest(".sec-pr,td") && !b.classList.contains("icon-btn"))) return;
      const d = document.createElement("div"); d.className = "sec-pr no-print";
      d.innerHTML = '<button type="button" class="btn sm line" title="শুধু এই অংশটা প্রিন্ট / PDF">এই অংশ প্রিন্ট</button>';
      d.firstChild.onclick = (e) => { e.stopPropagation(); printPage(sec); };
      sec.append(d);
    });
  }
  // যেকোনো পাতায় শিক্ষার্থীর নাম → নতুন ট্যাবে তার প্রোফাইল (#results/আইডি)।
  // নামটা লিংক হয় শুধু যদি কাছের সারি / ঘরে (৫ ধাপ উপর পর্যন্ত) তার আইডিও থাকে — যাতে অন্য লেখায় ভুল লিংক না হয়
  function linkStudents() {
    const root = $("#content"), byName = new Map();
    for (const s of DB.students || []) { const k = String(s.name || "").trim(); if (k) (byName.get(k) || byName.set(k, []).get(k)).push(s); }
    root.querySelectorAll("b,strong,td,span,div,h2,h3,p").forEach((el) => {
      if (el.dataset.sl || el.children.length || el.closest("a,button,label,select,option,textarea,.stu-link,.no-link")) return;
      const list = byName.get(el.textContent.trim()); if (!list) return;
      let s = null;
      for (let up = el.parentElement, i = 0; up && up !== root && i < 5 && !s; up = up.parentElement, i++) s = list.find((x) => up.textContent.includes(x.id)) || null;
      if (!s) return;
      el.dataset.sl = 1;
      el.innerHTML = `<a class="stu-link" data-sid="${esc(s.id)}" href="${panelUrl(s.id)}" title="${esc(s.name)}-এর শিক্ষার্থী পাতা">${esc(s.name)}</a>`;
    });
  }
  // শুধু শিক্ষার্থীর নামে ক্লিক → অ্যাডমিন প্যানেলের ভেতরেই ঐ শিক্ষার্থীর পাতা (#student/আইডি),
  // শিক্ষার্থী নিজের প্যানেলে যা দেখে হুবহু তাই (শুধু দেখার জন্য)। Ctrl চেপে ক্লিক করলে নতুন ট্যাবে।
  const panelUrl = (id) => `#student/${encodeURIComponent(id)}`;
  function studentPanelPage(c, id) {
    const s = studentById(decodeURIComponent(id || ""));
    if (!s) { c.innerHTML = '<div class="card"><p class="empty">শিক্ষার্থী পাওয়া যায়নি</p></div>'; return; }
    $("#pageTitle").textContent = `শিক্ষার্থী: ${s.name}`;
    c.innerHTML = `<div class="card stu-embed"><iframe title="${esc(s.name)}-এর শিক্ষার্থী প্যানেল" src="/student.html?as=${encodeURIComponent(s.id)}&embed=1"></iframe></div>`;
    // ফ্রেমের উচ্চতা = ভেতরের পাতার উচ্চতা (পাতা নিজেই মেপে জানায়) — আলাদা স্ক্রলবার আসে না
  }
  let editBack = null;
  // পড়া বন্ধ রাখা / আবার চালু: কারণ আর তারিখ থাকে; বন্ধের মাস থেকে চালুর আগের মাস পর্যন্ত মাসিক ফি ধরা হয় না
  async function togglePause(s, after) {
    if (!s) return;
    const soon = (s.pauses || []).find((p) => !p.to && p.startPending); // সামনের তারিখে বন্ধ ঠিক করা আছে
    const paused = s.status === "inactive" || !!soon;
    const ask = soon ? `"${s.name}"-এর পড়া ${U.date(soon.from)} থেকে বন্ধ হওয়ার কথা।\n\nবন্ধ বাতিল করতে ${soon.from} বা আগের তারিখ দিন; অথবা কবে আবার চালু হবে সেই তারিখ দিন (YYYY-MM-DD)` : paused ? `"${s.name}"-এর পড়া আবার চালু করবেন?\n\nকোন তারিখ থেকে চালু? (YYYY-MM-DD)` : `"${s.name}"-এর পড়া বন্ধ রাখবেন?\nহাজিরা, ফলাফল আর শিক্ষার্থী প্যানেলে আর দেখাবে না; বন্ধের মাসে একদিনও উপস্থিত না থাকলে ফি শূন্য। উপস্থিত থাকলে বন্ধের তারিখ পর্যন্ত ক্লাসের ফি ধরা হবে। পরে আবার চালু করা যাবে।\n\nকোন তারিখ থেকে বন্ধ? (YYYY-MM-DD)`;
    const date = prompt(ask, soon ? soon.from : U.today()); if (date === null) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) return toast("তারিখ এভাবে লিখুন: 2026-10-26", true);
    const reason = paused ? "" : prompt("কেন বন্ধ? (না লিখলেও চলবে)", ""); if (reason === null) return;
    try { await api(`/api/admin/students/${encodeURIComponent(s.id)}/${paused ? "resume" : "pause"}`, { body: { date: date.trim(), reason } }); await load(); after ? after() : route();
      const d = date.trim(), later = d > U.today();
      toast(soon && d <= soon.from ? "পড়া বন্ধ বাতিল হয়েছে" : paused ? (later ? `${U.date(d)} থেকে পড়া আবার চালু হবে` : "পড়া আবার চালু হয়েছে") : later ? `${U.date(d)} থেকে পড়া বন্ধ হবে` : "পড়া বন্ধ রাখা হয়েছে"); }
    catch (er) { toast(er.message, true); }
  }
  // শিক্ষার্থীর পাতায় পপআপ (মডিউল শেষ / পেমেন্ট…) বন্ধ হলে পাতাটা নতুন তথ্যে আবার দেখানো
  modal.addEventListener("close", () => { if (location.hash.startsWith("#student/")) setTimeout(route, 50); }); // শিক্ষার্থীর পাতা থেকে Edit করলে সেভের পর সেখানেই ফেরা
  addEventListener("message", (e) => {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.sicAct && studentById(e.data.id)) {
      if (e.data.sicAct === "edit") { editBack = "student/" + encodeURIComponent(e.data.id); return studentForm(studentById(e.data.id)); }
      if (e.data.sicAct === "sms") { const s = studentById(e.data.id); if (confirm(`${s.name}-কে আইডি আর PIN SMS-এ পাঠাবেন?\n\n${loginSmsNote(s)}`)) resendLogin(s); return; }
      if (e.data.sicAct === "report") return printStudentReport(e.data.id);
      if (e.data.sicAct === "pause") return togglePause(studentById(e.data.id));
      if (e.data.sicAct === "eval") return evalReport(e.data.id);
      if (e.data.sicAct === "evalhtml") { ensureResults(); return e.source.postMessage({ sicEvalHtml: window.SICEvalHtml(e.data.id) || "" }, location.origin); }
      if (e.data.sicAct === "course") { editBack = "student/" + encodeURIComponent(e.data.id); return viewStudent(e.data.id); }
    }
    if (!e.data.sicH) return;
    const fr = $(".stu-embed iframe"); if (fr && e.source === fr.contentWindow) fr.style.height = Math.max(600, Math.ceil(e.data.sicH)) + "px";
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#content") || e.button || e.target.closest(".stu-embed")) return;
    const link = e.target.closest("a.stu-link, a[data-profile], a[data-view]");
    const id = link && (link.dataset.sid || link.dataset.profile || link.dataset.view);
    if (!id || !studentById(id)) return;
    e.preventDefault(); e.stopPropagation();
    if (e.ctrlKey || e.metaKey) window.open("/admin.html" + panelUrl(id), "_blank"); else location.hash = panelUrl(id).slice(1);
  }, true);
  let secTimer = 0;
  new MutationObserver(() => { clearTimeout(secTimer); secTimer = setTimeout(() => { addSectionPrints(); linkStudents(); }, 120); }).observe(document.getElementById("content"), { childList: true, subtree: true });
  // রিপোর্টের প্রিন্ট (রেজাল্ট, মেধাতালিকা, কুইজ, আইডি কার্ড…): Progress Report-এর মতো হেডার, সবুজ টেবিল, Kalpurush সংখ্যা, নিচে স্বাক্ষর ও তারিখ
  function printDoc(title, html) {
    const w = window.open("", "_blank");
    if (!w) return toast("পপ-আপ বন্ধ আছে — ব্রাউজারে পপ-আপের অনুমতি দিন", true);
    w.document.write(`<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>${esc(title)}</title>${U.DOC_FONTS}
      <style>${U.DOC_CSS}*{box-sizing:border-box}@page{size:A4;margin:9mm}body{font-family:"BnNum","Hind Siliguri","Nirmala UI",sans-serif;color:#1d2b28;margin:0;background:#eef2f0;font-size:13px}
      .pg{max-width:200mm;margin:14px auto;background:#fff;padding:8mm;box-shadow:0 4px 18px rgba(0,0,0,.08)}
      h1,h2{font-family:"Noto Serif Bengali","Nirmala UI",serif;margin:0;color:#0b2e28}h1{font-size:20px}h3{color:#0b2e28}
      table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12.5px}th,td{border:1px solid #d6e3de;padding:6px 9px;text-align:left}
      th{background:#1f6b52;color:#fff;font-weight:700}tbody tr:nth-child(even) td{background:#f5f9f7}thead{display:table-header-group}tr{break-inside:avoid}
      .r{text-align:right}.big{font-size:22px;font-weight:700}
      .sign{display:flex;justify-content:space-between;gap:12mm;margin-top:16mm}.sign span{flex:0 0 52mm;border-top:1.2px solid #1d2b28;padding-top:1.5mm;text-align:center;font-weight:600}
      .card{width:54mm;height:85.6mm;border:1px solid #ccc;border-radius:10px;overflow:hidden;text-align:center;display:inline-block;vertical-align:top;margin:6px;font-size:11px}
      .card .t{background:linear-gradient(150deg,#0b3b36,#071f3a);color:#fff;padding:8px 4px}.card .t img{display:block;width:56px;margin:0 auto 2px}.card .t b{display:block;font-size:12px}.card .t .ct{display:block;font-size:10px;line-height:1.3;color:#f3c55d}.card .t .lb{display:inline-block;margin-top:6px;padding:2px 10px;border:1px solid #f8dc91;border-radius:999px;background:#f5d47f;color:#143e42;font-size:10px;font-weight:800;line-height:1.5}
      .card .ph{width:48px;height:48px;border-radius:14px;background:#f3c55d;margin:8px auto 4px;display:grid;place-items:center;font-size:26px;font-weight:900;overflow:hidden}
      .card .card-sign{display:flex;flex-direction:column;align-items:center;margin:0 8px 4px}.card-sign img{height:14px;width:auto;max-width:68px;object-fit:contain}.card-sign span{border-top:1px solid #7b9390;min-width:90px;font-size:9px;padding-top:2px}
      .card h3{margin:2px;font-size:13px}.card .id{font-family:Consolas,Hind Siliguri,monospace;font-weight:700;color:#b07d1c}.card dl{display:grid;grid-template-columns:auto 1fr;gap:1px 6px;text-align:left;padding:6px 8px;margin:0}.card dt{color:#5d7570}.card dd{margin:0;font-weight:600}
      @media print{body{background:#fff}.pg{margin:0;padding:0;box-shadow:none;max-width:none}button{display:none}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}${U.PRINT_BAR_CSS}</style></head><body>${U.PRINT_BAR}
      <main class="pg">${U.docHead(title, DB.settings)}${html}${U.docFoot(DB.settings)}</main></body></html>`);
    w.document.close();
  }
  // স্টুডেন্ট রিপোর্ট — একজন শিক্ষার্থীর সব কিছুর সারাংশ এক জায়গায় (A4, প্রিভিউ থেকে প্রিন্ট / PDF):
  // পরিচয় ও ভর্তি, যোগাযোগ, মডিউল-ফি-পেমেন্ট, মাসভিত্তিক হাজিরা, পরীক্ষার ফল ও মেধাক্রম, অনলাইন কুইজ, বাড়ির কাজ / পড়া, মন্তব্য
  function printStudentReport(id) {
    const s = studentById(id); if (!s) return toast("শিক্ষার্থী পাওয়া যায়নি", true);
    const EC = window.ExamCalc, f = s.fees, pc = (x) => (x === null || x === undefined ? "—" : bn(String(Math.round(x * 10) / 10)) + "%");
    const row = (k, v) => (v ? `<div><small>${k}</small><b>${esc(v)}</b></div>` : "");
    // হাজিরা: মাস অনুযায়ী
    const months = {}; let P = 0, A = 0, L = 0;
    for (const [k, m] of Object.entries(DB.attendance || {})) { const v = m[id]; if (!v) continue; const mo = k.slice(0, 7); const o = (months[mo] ||= { p: 0, a: 0, l: 0 }); if (v === "P") { o.p++; P++; } else if (v === "A") { o.a++; A++; } else { o.l++; L++; } }
    const attRate = P + A ? (P / (P + A)) * 100 : null;
    // পরীক্ষা: নম্বর, %, পাস/ফেল, মেধাক্রম (সেই পরীক্ষায়)
    const exs = (DB.exams || []).filter((e) => (e.studentIds || []).includes(id)).sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    const rs = exs.map((e) => { const r = EC.studentResult(e, id), all = EC.results(e), me = all.present.find((x) => x.sid === id); return { e, r, rank: me && me.rank, of: all.present.filter((x) => x.rank).length }; });
    const sat = rs.filter((x) => !x.r.absent), avg = sat.length ? sat.reduce((t, x) => t + x.r.percent, 0) / sat.length : null;
    const passN = sat.filter((x) => x.r.pass).length, best = sat.reduce((b, x) => (!b || x.r.percent > b.r.percent ? x : b), null);
    // অনলাইন কুইজ: প্রতিটার সবচেয়ে ভালো চেষ্টা
    const qz = (DB.quizzes || []).map((q) => { const d = ((q.attempts || {})[id] || []).filter((a) => a.submittedAt); return d.length ? { q, b: d.reduce((x, y) => (y.score > x.score ? y : x)), n: d.length } : null; }).filter(Boolean);
    const hw = U.hwRate(DB.homework, s, "homework"), ls = U.hwRate(DB.homework, s, "lesson");
    const pays = (DB.payments || []).filter((p) => p.studentId === id).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    // মন্তব্য (নম্বর দেখে নিজে থেকে)
    const notes = [];
    if (avg !== null) notes.push(avg >= 80 ? `পরীক্ষায় ধারাবাহিক ভালো ফল (গড় ${pc(avg)})।` : avg >= 50 ? `পরীক্ষার গড় ${pc(avg)} — আরও অনুশীলন করলে ফল ভালো হবে।` : `পরীক্ষার গড় ${pc(avg)} — মৌলিক অধ্যায়গুলো আবার পড়া দরকার।`);
    if (attRate !== null) notes.push(attRate >= 90 ? `উপস্থিতি খুব ভালো (${pc(attRate)})।` : `উপস্থিতি ${pc(attRate)} — ক্লাসে আরও নিয়মিত হতে হবে।`);
    if (f.balance > 0) notes.push(`ফি বকেয়া ${money(f.balance)}।`);
    if (hw.pct !== null && hw.pct < 70) notes.push("বাড়ির কাজ নিয়মিত জমা দিতে হবে।");
    const photo = s.photo ? `${location.origin}/api/admin/photo/s/${encodeURIComponent(s.id)}` : U.avatarSrc(s.gender);
    const contact = [["শিক্ষার্থী", s.name, s.phone], ["অভিভাবক" + (s.guardianRelation ? ` (${s.guardianRelation})` : ""), s.guardianName, s.guardianPhone], ["বাবা", s.fatherName, s.fatherPhone], ["মা", s.motherName, s.motherPhone]];
    const html = `<style>
      .sr-top{display:grid;grid-template-columns:auto 1fr auto;gap:5mm;align-items:center;padding:4mm 5mm;border-radius:3mm;background:linear-gradient(125deg,#0b3b36,#176b5d);color:#fff;margin-bottom:4mm}
      .sr-top img{width:24mm;height:28mm;object-fit:cover;border-radius:2.5mm;border:2px solid rgba(255,255,255,.5);background:#fff}
      .sr-top h1{color:#fff;margin:0 0 1mm;font-size:22px}.sr-top p{margin:0;color:#d4ebe6;font-size:12.5px}
      .sr-st{padding:1.5mm 4mm;border-radius:99px;background:#dff7ee;color:#0b5a4b;font-weight:800;font-size:12px}.sr-st.off{background:#ffe3e3;color:#a72929}
      .sr-k{display:grid;grid-template-columns:repeat(5,1fr);gap:2.5mm;margin-bottom:4mm}
      .sr-k div{border-radius:2.5mm;padding:2.5mm 3mm;border:1px solid #dfe7e4}.sr-k small{display:block;color:#475569;font-size:11px;font-weight:600}.sr-k b{font-size:18px}
      .sr-k div:nth-child(1){background:#e3f5ed}.sr-k div:nth-child(2){background:#eef2ff}.sr-k div:nth-child(3){background:#fff0c9}.sr-k div:nth-child(4){background:#fdeef0}.sr-k div:nth-child(5){background:#f3effb}
      .sr-h{margin:4mm 0 2mm;font-size:15px;color:#0b3b36;border-left:4px solid #14a779;padding-left:2.5mm;break-after:avoid}
      .sr-i{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm}.sr-i div{border:1px solid #dce8e4;border-radius:2mm;padding:1.6mm 2.5mm;background:#f8fbfa}.sr-i small{display:block;color:#5b6e69;font-size:10.5px}.sr-i b{font-size:12.5px}
      .sr-two{display:grid;grid-template-columns:1fr 1fr;gap:4mm;align-items:start}
      .sr table{margin-top:0;font-size:12px}.sr td small{display:block;color:#5b6e69;font-size:10.5px}
      .sr .ok{color:#047857;font-weight:700}.sr .bad{color:#b91c1c;font-weight:700}
      .sr-n{margin:0;padding:3mm 4mm;border-radius:2mm;background:#f6f9f7;border-left:3px solid #14a779}.sr-n li{margin:.8mm 0}
      .sr-cm{min-height:16mm;border:1px dashed #b8c6c1;border-radius:2mm;padding:2mm 3mm;color:#7b8884;font-size:11px}
      .sr section{break-inside:avoid}
    </style><div class="sr">
      <div class="sr-top"><img src="${esc(photo)}" alt=""><div><h1>${esc(s.name)}${s.nameEn ? ` <small style="font-size:13px;opacity:.85">(${esc(s.nameEn)})</small>` : ""}</h1>
        <p>আইডি ${esc(s.id)} · ${esc(s.session || "—")} · ব্যাচ ${esc(batchName(s.batchId))}</p><p>মডিউল: ${esc(modulesOf(s.id).join(", ") || "—")} · ভর্তি: ${s.admissionDate ? U.date(s.admissionDate) : "—"}</p></div>
        <span class="sr-st ${s.status === "inactive" ? "off" : ""}">${s.status === "inactive" ? "❚❚ পড়া বন্ধ" : "সক্রিয়"}</span></div>
      <div class="sr-k"><div><small>উপস্থিতি</small><b>${pc(attRate)}</b></div><div><small>পরীক্ষার গড়</small><b>${pc(avg)}</b></div><div><small>পরীক্ষা দিয়েছে / পাস</small><b>${bn(sat.length)} / ${bn(passN)}</b></div><div><small>ফি বকেয়া</small><b>${f.balance > 0 ? money(f.balance) : "নেই"}</b></div><div><small>বাড়ির কাজ / পড়া</small><b>${pc(hw.pct)} / ${pc(ls.pct)}</b></div></div>

      <section><h3 class="sr-h">১. ব্যক্তিগত ও ভর্তির তথ্য</h3><div class="sr-i">
        ${row("জন্ম তারিখ", s.dob && s.dob.split("-").reverse().join("/"))}${row("লিঙ্গ", { M: "ছেলে", F: "মেয়ে", O: "অন্যান্য" }[s.gender])}${row("রক্তের গ্রুপ", s.bloodGroup)}${row("ধর্ম", s.religion)}
        ${row("কলেজ", s.college)}${row("শ্রেণি / বিভাগ", [s.klass, s.group].filter(Boolean).join(" · "))}${row("ক্লাস ব্যাচ", batchFull(batchById(s.batchId)))}${row("বর্তমান ঠিকানা", s.address)}
        ${row("স্থায়ী ঠিকানা", s.sameAddress ? "বর্তমান ঠিকানাই" : s.permanentAddress)}${row("অনলাইন আবেদন নং", s.appNo)}</div></section>

      <section><h3 class="sr-h">২. যোগাযোগ</h3><table><thead><tr><th>কে</th><th>নাম</th><th>মোবাইল</th></tr></thead><tbody>
        ${contact.map(([k, n, ph]) => `<tr><td>${esc(k)}</td><td>${esc(n || "—")}</td><td><b>${esc(ph || "দেওয়া নেই")}</b></td></tr>`).join("")}</tbody></table></section>

      <section><h3 class="sr-h">৩. মডিউল, ফি ও পেমেন্ট</h3><div class="sr-two">
        <table><thead><tr><th>মডিউল</th><th class="r">ফি</th><th class="r">এখন পর্যন্ত দেনা</th></tr></thead><tbody>
          ${f.items.map((it) => `<tr><td>${esc(it.course)}${it.status === "ended" ? " <small>(শেষ)</small>" : ""}<small>শুরু ${U.date(it.startDate)}</small></td><td class="r">${money(it.fee)}${it.monthly ? "/মাস" : ""}${it.discount ? `<small>ছাড় ${money(it.discount)}</small>` : ""}</td><td class="r">${money(it.due)}${it.monthly ? `<small>${bn(it.months)} মাস</small>` : ""}</td></tr>`).join("") || '<tr><td colspan="3">কোনো মডিউল নেই</td></tr>'}
          <tr><td><b>মোট</b></td><td></td><td class="r"><b>${money(f.totalDue)}</b></td></tr><tr><td><b>জমা</b></td><td></td><td class="r ok">${money(f.paid)}</td></tr><tr><td><b>বকেয়া</b></td><td></td><td class="r ${f.balance > 0 ? "bad" : "ok"}">${money(Math.max(0, f.balance))}</td></tr></tbody></table>
        <table><thead><tr><th>তারিখ</th><th>রসিদ / মাস</th><th class="r">টাকা</th></tr></thead><tbody>
          ${pays.slice(0, 12).map((p) => `<tr><td>${U.date(p.date)}</td><td>#${bn(p.receiptNo || "")}${p.month ? `<small>${U.month(p.month)} · ${esc(p.method || "")}</small>` : ""}</td><td class="r">${money(p.amount)}</td></tr>`).join("") || '<tr><td colspan="3">কোনো পেমেন্ট নেই</td></tr>'}</tbody></table></div></section>

      <section><h3 class="sr-h">৪. হাজিরা (মাস অনুযায়ী)</h3><table><thead><tr><th>মাস</th><th class="r">উপস্থিত</th><th class="r">অনুপস্থিত</th><th class="r">ছুটি</th><th class="r">হার</th></tr></thead><tbody>
        ${Object.keys(months).sort().reverse().map((mo) => { const o = months[mo]; return `<tr><td>${U.month(mo)}</td><td class="r">${bn(o.p)}</td><td class="r">${bn(o.a)}</td><td class="r">${bn(o.l)}</td><td class="r">${pc(o.p + o.a ? (o.p / (o.p + o.a)) * 100 : null)}</td></tr>`; }).join("") || '<tr><td colspan="5">এখনো হাজিরা নেই</td></tr>'}
        ${P + A + L ? `<tr><td><b>মোট</b></td><td class="r"><b>${bn(P)}</b></td><td class="r"><b>${bn(A)}</b></td><td class="r"><b>${bn(L)}</b></td><td class="r"><b>${pc(attRate)}</b></td></tr>` : ""}</tbody></table></section>

      <section><h3 class="sr-h">৫. পরীক্ষার ফলাফল</h3><table><thead><tr><th>তারিখ</th><th>পরীক্ষা</th><th class="r">নম্বর</th><th class="r">%</th><th>ফলাফল</th><th class="r">মেধা</th></tr></thead><tbody>
        ${rs.map(({ e, r, rank, of }) => `<tr><td>${e.date ? U.date(e.date) : "—"}</td><td>${esc(e.title)}<small>${esc(EC.typeName(e.type))}</small></td><td class="r">${r.absent ? "—" : `${bn(String(Math.round(r.total * 100) / 100))}/${bn(r.full)}`}</td><td class="r">${r.absent ? "—" : pc(r.percent)}</td><td>${r.absent ? (r.attempts === 0 && ((e.marks || {})[id] || []).length ? "অনুপস্থিত" : "নম্বর বাকি") : r.pass ? '<span class="ok">পাস</span>' : '<span class="bad">ফেল</span>'}</td><td class="r">${rank ? `${bn(rank)}/${bn(of)}` : "—"}</td></tr>`).join("") || '<tr><td colspan="6">এখনো কোনো পরীক্ষা নেই</td></tr>'}</tbody></table>
        ${best ? `<p style="margin:2mm 0 0;font-size:12px">সবচেয়ে ভালো: <b>${esc(best.e.title)}</b> — ${pc(best.r.percent)}</p>` : ""}</section>

      <div class="sr-two">
        <section><h3 class="sr-h">৬. অনলাইন কুইজ</h3><table><thead><tr><th>কুইজ</th><th class="r">নম্বর</th><th class="r">বার</th></tr></thead><tbody>
          ${qz.map(({ q, b, n }) => `<tr><td>${esc(q.title)}</td><td class="r">${bn(String(b.score))}/${bn(String(b.full))}</td><td class="r">${bn(n)}</td></tr>`).join("") || '<tr><td colspan="3">কোনো কুইজ দেয়নি</td></tr>'}</tbody></table></section>
        <section><h3 class="sr-h">৭. বাড়ির কাজ ও পড়া</h3><table><thead><tr><th></th><th class="r">করেছে / পেরেছে</th><th class="r">করেনি</th><th class="r">হার</th></tr></thead><tbody>
          <tr><td>বাড়ির কাজ</td><td class="r">${bn(hw.done)}</td><td class="r">${bn(hw.not)}</td><td class="r">${pc(hw.pct)}</td></tr><tr><td>পড়া</td><td class="r">${bn(ls.done)}</td><td class="r">${bn(ls.not)}</td><td class="r">${pc(ls.pct)}</td></tr></tbody></table></section></div>

      <section><h3 class="sr-h">৮. মন্তব্য</h3>${notes.length ? `<ul class="sr-n">${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}<div class="sr-cm" style="margin-top:2mm">শিক্ষকের মন্তব্য:</div></section>
      <div class="sign"><span>অভিভাবকের স্বাক্ষর</span><span>শ্রেণি শিক্ষকের স্বাক্ষর</span>${U.sig("পরিচালকের স্বাক্ষর")}</div></div>`;
    printDoc("শিক্ষার্থীর পূর্ণ রিপোর্ট — " + s.name, html);
  }
  // মানি রিসিট — সবুজ ফ্রেম, উপরে "Money Receipt" + প্রতিষ্ঠানের নাম + লোগো, "লেনদেনের তথ্য" বার, তথ্যের ঘর, মাঝে হালকা লোগো, নিচে দুই স্বাক্ষর
  // মানি রসিদ: একটা বা অনেকগুলো — অনেকগুলো হলে প্রতিটা আলাদা পাতায়, এক উইন্ডোতে (একসাথে এক PDF)
  const receiptCode = (p) => "SIC" + String(p.date || U.today()).replace(/-/g, "").slice(2) + String(p.receiptNo).padStart(4, "0");
  function printReceipt(p) { printReceipts([p]); }
  // একটা পেমেন্টে কোন কোন মাস শোধ হলো: এই মডিউলের সব পেমেন্ট তারিখ অনুযায়ী সাজিয়ে, প্রতিটা টাকা আগে সবচেয়ে পুরনো বাকি মাসে বসে
  // (বন্ধ / ছুটির মাসে কম ফি ধরা থাকলে সেটাই)। ফেরত: [{ mk, amt, fee, rest }] (rest = এরপরও সেই মাসে বাকি) আর মাসের বাইরে গেলে অগ্রিম
  function feeCoverage(p) {
    const s = studentById(p.studentId);
    if (!s || !s.fees) return null;
    const solo = s.fees.items.length === 1;
    const it = s.fees.items.find((i) => i.enrollmentId === p.enrollmentId) || (solo && !p.enrollmentId ? s.fees.items[0] : null);
    if (!it || !it.monthly || !it.startDate) return null;
    const pays = DB.payments.filter((x) => x.studentId === s.id && (x.enrollmentId === it.enrollmentId || (solo && !x.enrollmentId)))
      .sort((a, b) => (a.date + String(a.receiptNo).padStart(8, "0")).localeCompare(b.date + String(b.receiptNo).padStart(8, "0")));
    const feeOf = (mk) => { const adj = (it.adjust || []).find((x) => x.month === mk); return adj ? adj.fee : it.net; };
    const next = (mk) => { let [Y, M] = mk.split("-").map(Number); M++; if (M > 12) { M = 1; Y++; } return `${Y}-${String(M).padStart(2, "0")}`; };
    const last = thisMonth(), left = {};
    let mk = it.startDate.slice(0, 7), out = null, advance = 0;
    for (const x of pays) {
      let amt = x.amount;
      const mine = x.id === p.id ? [] : null;
      while (amt > 0) {
        if (!(mk in left)) left[mk] = feeOf(mk);
        if (mk > last && left[mk] > 0) break; // সামনের মাসের ফি এখনো ধরা হয়নি — বাকিটা অগ্রিম
        const take = Math.min(amt, left[mk]);
        if (take > 0 && mine) mine.push({ mk, amt: take, fee: feeOf(mk), rest: left[mk] - take });
        left[mk] -= take; amt -= take;
        if (left[mk] <= 0) mk = next(mk);
      }
      if (mine) { out = mine; advance = amt; break; }
    }
    return out ? { list: out, advance } : null;
  }
  // পুরো মাস = শুধু টাকা; আগের বাকিটুকু শোধ = "(বাকি শোধ)"; এখনো বাকি থাকলে = "(আংশিক, বাকি ৳…)"
  const coverageText = (cv) => [...cv.list.map((x) => `${U.month(x.mk)} — ${money(x.amt)}${x.rest > 0 ? ` (আংশিক, বাকি ${money(x.rest)})` : x.amt < x.fee ? " (বাকি শোধ)" : ""}`), ...(cv.advance > 0 ? [`অগ্রিম — ${money(cv.advance)}`] : [])].join(" · ");
  function receiptHtml(p) {
    const s = studentById(p.studentId) || { name: p.studentId };
    const enr = DB.enrollments.find((e) => e.id === p.enrollmentId);
    const c = enr && courseById(enr.courseId);
    const st = DB.settings, org = st.nameBn || "শাহিন'স আইসিটি কেয়ার", logo = location.origin + "/images/logo-receipt.png";
    const cov = feeCoverage(p);
    const kind = !c ? (cov ? "মাসিক ফি" : "সাধারণ ফি") : c.feeType === "monthly" ? (cov ? "মাসিক ফি" : `মাসিক ফি${p.month ? " — " + U.month(p.month) : ""}`) : c.feeType === "chapter" ? "অধ্যায়ভিত্তিক ফি" : "কোর্স ফি";
    const mod = c ? c.name + (enr.chapters && enr.chapters.length ? " — " + chapterNames(c, enr.chapters).join(", ") : "") : "";
    const due = s.fees ? Math.max(0, s.fees.balance) : 0;
    const code = receiptCode(p);
    const cell = (k, v, sub) => `<div class="c"><small>${k}</small><b>${v}</b>${sub ? `<i>${sub}</i>` : ""}</div>`;
    return `<section class="r"><img class="wm" src="${logo}" alt="">
        <div class="hd"><div class="mr">Money<br>Receipt</div><div class="org"><b>${esc(org)}</b><small>${esc(st.address || "মাস্টার কলোনি, মাদারীপুর")}</small><small>${esc(st.phone || "")}</small></div><img class="lg" src="${location.origin}/images/logo-receipt.png" alt=""></div>
        <div class="bar">লেনদেনের তথ্য<span><small>রশিদ নম্বর</small>${esc(code)}</span></div>
        <div class="g">
          ${cell("শিক্ষার্থীর নাম", esc(s.name))}${cell("তারিখ", U.date(p.date))}
          ${cell("শিক্ষার্থী আইডি", esc(p.studentId))}${cell("ফি-এর ধরন", esc(kind), esc(mod))}
          ${cell("সেশন / ব্যাচ", esc([s.session, batchName(s.batchId)].filter(Boolean).join(" · ") || "—"))}${cell("পেমেন্টের মাধ্যম", esc(p.method || "নগদ"), p.note ? esc(p.note) : "")}
          ${cov && (cov.list.length || cov.advance) ? `<div class="c cov"><small>এই টাকায় যে মাসের ফি শোধ হলো</small><b>${esc(coverageText(cov))}</b></div>` : ""}
          <div class="c amt"><small>টাকার পরিমাণ</small><b>${money(p.amount)}</b></div>
          <div class="c ${due ? "unpaid" : "paid"}"><small>পেমেন্ট স্ট্যাটাস</small><b>${due ? `আংশিক পরিশোধ — বকেয়া ${money(due)}` : "পরিশোধিত (Paid)"}</b></div>
        </div>
        <div class="sg"><span><img class="receipt-signature" src="${location.origin}/images/signature.png" alt="শাহিন স্যারের স্বাক্ষর">গ্রহণকারীর স্বাক্ষর</span><span>প্রদানকারীর স্বাক্ষর</span></div></section>`;
  }
  function printReceipts(list) {
    list = list.filter(Boolean);
    if (!list.length) return;
    const st = DB.settings, logo = location.origin + "/images/logo-receipt.png";
    const w = window.open("", "_blank");
    if (!w) return toast("পপ-আপ বন্ধ আছে — ব্রাউজারে পপ-আপের অনুমতি দিন", true);
    w.document.write(`<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>${list.length === 1 ? "Money Receipt " + esc(receiptCode(list[0])) : "Money Receipts (" + list.length + ")"}</title>
      <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@700;900&family=Oswald:wght@600;700&display=swap" rel="stylesheet">
      <style>@font-face{font-family:'BnNum';src:local('Kalpurush'),url('${location.origin}/fonts/kalpurush.ttf') format('truetype');unicode-range:U+0030-0039}${U.TIRO_CSS}*{box-sizing:border-box}@page{size:A5 landscape;margin:5mm}body{margin:0;background:#eef2f0;font-family:'BnNum','Hind Siliguri','Nirmala UI',sans-serif;color:#1d2b28}
      .r{position:relative;width:198mm;min-height:126mm;margin:8mm auto;padding:6mm 9mm 6mm;background:#fff;border:5mm solid #8ee0b4;border-radius:2px;overflow:hidden;display:flex;flex-direction:column}
      .wm{position:absolute;left:50%;top:56%;width:96mm;transform:translate(-50%,-50%);opacity:.07;pointer-events:none}
      .hd{display:grid;grid-template-columns:40mm 1fr 40mm;align-items:center;gap:5mm;padding-bottom:3mm;border-bottom:1.6px solid #1d2b28}
      .mr{font:700 24px/0.95 Oswald,'Arial Narrow',sans-serif;color:#2c2f33;letter-spacing:.3px}
      .org{text-align:center}.org b{display:block;font:900 20px/1.25 'Noto Serif Bengali',serif;color:#0b3b36}.org small{display:block;font-size:12.5px;color:#3a4a46}
      .lg{justify-self:end;width:36mm;height:auto;max-height:24mm;object-fit:contain}
      .bar{display:flex;justify-content:space-between;align-items:center;margin:4mm 0 0;padding:1.5mm 4mm;background:#3fae74;color:#06301c;font-weight:700;font-size:15px}
      .bar span{display:grid;text-align:right;line-height:1.15}.bar small{font-size:11px;font-weight:600;color:#063d22;letter-spacing:.06em}
      .g{display:grid;grid-template-columns:1fr 1fr;border:1px solid #cfd8d4;border-top:0}
      .c{padding:1.6mm 4mm;border-top:1px solid #cfd8d4;min-height:10.5mm}.c:nth-child(odd){border-right:1px solid #cfd8d4}
      .c small{display:block;color:#6a7a76;font-size:11.5px}.c b{display:block;font-size:14px;font-weight:600;line-height:1.35}.c i{display:block;font-style:normal;font-size:11.5px;color:#55625f}
      .cov{grid-column:1/-1;border-right:0!important;background:#f3fbf6}.cov b{font-size:13.5px;color:#0b5c3c}@media print{.cov{min-height:0!important;padding:.6mm 4mm!important}.cov b{font-size:12px;line-height:1.3}.r:has(.cov) .sg{padding-top:8mm!important}.r:has(.cov) .hd{padding-bottom:1.2mm!important}.r:has(.cov) .bar{margin-top:2mm!important}.r:has(.cov) .c{min-height:8mm!important;padding:.8mm 4mm!important}}.amt b{font-size:18px;color:#0b3b36}.paid b{color:#0b7a4b}.unpaid b{color:#b4233c}
      .sg{margin-top:auto;padding-top:9mm;display:flex;justify-content:space-between}.sg span{position:relative;width:36mm;border-top:1.4px solid #1d2b28;padding-top:1.5mm;text-align:center;font-size:12.5px;font-weight:600}
      .receipt-signature{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);width:29mm;height:7mm;object-fit:contain}
      .pb{position:sticky;top:0;background:#0b3b36;color:#fff;text-align:center;padding:8px}.pb button{font:inherit;font-weight:700;padding:6px 18px;border:0;border-radius:999px;background:#f3c55d;cursor:pointer}
      @media print{body{background:#fff}.pb{display:none}.r{break-inside:avoid}.r+.r{break-before:page}.r{margin:0 auto;min-height:0;padding:5mm 8mm 5mm}.hd{padding-bottom:2mm}.bar{margin-top:3mm}.c{padding:1.1mm 4mm;min-height:9mm}.sg{padding-top:8mm}}</style></head><body>
      <div class="pb"><b style="color:#fff;margin-right:10px;font-family:Hind Siliguri,sans-serif">প্রিন্ট প্রিভিউ${list.length > 1 ? ` — ${bn(list.length)}টি রসিদ, প্রতিটা আলাদা পাতায়` : ""}</b><button onclick="print()">প্রিন্ট / PDF</button> <button onclick="window.close()" style="background:rgba(255,255,255,.18);color:#fff">✕ বন্ধ করুন</button></div>
${list.map(receiptHtml).join("")}
      </body></html>`);
    w.document.close();
  }
  function idCardHtml(s) {
    return `<div class="card"><div class="t"><img src="${location.origin}/images/logo-nav.png" alt=""><span class="ct">${esc(DB.settings.address || "মাস্টার কলোনি, মাদারীপুর")}</span><span class="ct">০১৭৪৯-১০৫৯০২</span><span class="lb">শিক্ষার্থী আইডি কার্ড</span></div>
      <div class="ph">${s.photo ? `<img src="${location.origin}${photoUrl("s", s.id)}" style="width:100%;height:100%;object-fit:cover">` : `<img src="${U.avatarSrc(s.gender)}" style="width:100%;height:100%;object-fit:cover">`}</div><h3 style="white-space:nowrap;font-size:${Math.max(8, Math.min(13, Math.floor(186 / (String(s.name).length * 0.6))))}px">${esc(s.name)}</h3><div class="id">${esc(s.id)}</div>
      <dl><dt>সেশন</dt><dd>${esc(s.session || "")}</dd><dt>ব্যাচ</dt><dd>${esc(batchName(s.batchId))}</dd><dt>সময়</dt><dd>${esc([(batchById(s.batchId) || {}).days, (batchById(s.batchId) || {}).time].filter(Boolean).join(" · "))}</dd><dt>মোবাইল</dt><dd>${esc(s.phone || s.guardianPhone)}</dd></dl><div class="card-sign"><img src="${location.origin}/images/signature.png" alt="কর্তৃপক্ষের স্বাক্ষর"><span>কর্তৃপক্ষের স্বাক্ষর</span></div></div>`;
  }

  // পরীক্ষার পেজ (admin-exams.js) — এখানকার সাধারণ জিনিসগুলো সেখানে দেওয়া হয়
  let examsCtx = null;
  const examsPage = (c, arg) => {
    examsCtx = examsCtx || window.SICExams({
      get DB() { return DB; }, save, load, refresh, remove, route, openModal, closeModal, printDoc, opt,
      batchById, studentById, studentName, batchName, sessionOptions, liveSessions, activeStudents,
    });
    examsCtx(c, arg);
  };
  // বাড়ির কাজ / পড়া (admin-homework.js)
  let homeworkCtx = null;
  const homeworkPage = (c, arg) => {
    homeworkCtx = homeworkCtx || window.SICHomework({ get DB() { return DB; }, save, load, remove, opt, studentById, batchName, liveSessions });
    homeworkCtx(c, arg);
  };
  // অনলাইন কুইজ (admin-quiz.js) — ব্যাচের শিক্ষার্থী + ব্যাচের বাইরের অনলাইন শিক্ষার্থী
  let quizCtx = null;
  const quizPage = (c, arg) => {
    quizCtx = quizCtx || window.SICQuizPage({ get DB() { return DB; }, save, load, remove, opt, printDoc, studentById, batchName, liveSessions });
    quizCtx(c, arg);
  };
  // মূল পাতার ব্যানার স্লাইডার (admin-banners.js)
  // মূল পাতার প্রশ্নোত্তর বক্স (admin-qna.js)
  let qnaCtx = null;
  const qnaPage = (c, arg) => {
    qnaCtx = qnaCtx || window.SICQna({ get DB() { return DB; }, load });
    qnaCtx(c, arg);
  };
  let galleryCtx = null;
  const galleryPage = (c, arg) => {
    galleryCtx = galleryCtx || window.SICGallery({ get DB() { return DB; }, save, load, remove });
    galleryCtx(c, arg);
  };
  let classMomentsCtx;
  const classMomentsPage = (c) => {
    classMomentsCtx ||= window.SICGallery({ get DB() { return DB; }, save, load, remove }, true);
    classMomentsCtx(c);
  };
  let bannersCtx = null;
  const bannersPage = (c, arg) => {
    bannersCtx = bannersCtx || window.SICBanners({ get DB() { return DB; }, save, load, remove });
    bannersCtx(c, arg);
  };
  // ফ্রি ক্লাস ও অনলাইন কোর্স (admin-learn.js)
  let learnCtx = null;
  const learnPage = (c, arg) => {
    learnCtx = learnCtx || window.SICLearn({ get DB() { return DB; }, save, load, remove, opt });
    learnCtx(c, arg);
  };
  // ট্যালেন্ট হান্ট (admin-talent.js)
  let talentCtx = null;
  const talentPage = (c, arg) => {
    talentCtx = talentCtx || window.SICTalent({ get DB() { return DB; }, save, load, remove, opt, openForm, printDoc });
    talentCtx(c, arg);
  };
  // সম্ভাব্য শিক্ষার্থী / Leads (admin-leads.js) — ভর্তির খোঁজ আর অনলাইন কুইজের শিক্ষার্থীরা এখানে এক তালিকায়
  let leadsCtx = null;
  const leadsPage = (c, arg) => {
    leadsCtx = leadsCtx || window.SICLeads({ get DB() { return DB; }, save, load, remove, opt, openForm, studentForm: (s, p) => studentForm(s, p) });
    leadsCtx(c, arg);
  };
  // মূল পাতার সফল শিক্ষার্থী (admin-achievers.js)
  let achieversCtx = null;
  const achieversPage = (c, arg) => {
    achieversCtx = achieversCtx || window.SICAchievers({ get DB() { return DB; }, save, load, remove });
    achieversCtx(c, arg);
  };
  // SMS প্যানেল (admin-sms.js) — ব্যাচ / আইডি ধরে নিজের লেখা বার্তা বা পরীক্ষার ফলাফল
  let smsCtx = null;
  const smsPage = (c, arg) => {
    smsCtx = smsCtx || window.SICSms({ get DB() { return DB; }, load, opt, batchName, liveSessions });
    smsCtx(c, arg);
  };
  // বই ও শিট (admin-books.js) — স্টক, বিক্রি (ছাড় / ফ্রি / বাকি), ওয়েবসাইটের অনলাইন অর্ডার
  let booksCtx = null;
  const booksPage = (c, arg) => {
    booksCtx = booksCtx || window.SICBooks({ get DB() { return DB; }, save, load, remove, opt, openForm, printDoc, batchName });
    booksCtx(c, arg);
  };
  // ফলাফল ব্যবস্থাপনা (admin-results.js)
  let resultsCtx = null;
  const ensureResults = () => (resultsCtx = resultsCtx || window.SICResults({
    get DB() { return DB; }, load, printDoc, opt, studentById, batchName, liveSessions,
  }));
  const resultsPage = (c, arg) => ensureResults()(c, arg);
  const evalReport = (id) => { ensureResults(); window.SICEvalReport(id); };

  // পরীক্ষা পাতার ভেতরেই সব: সাপ্তাহিক / মাসিক / জিকে / বিশেষ পরীক্ষা আর ট্যালেন্ট হান্ট — আলাদা মেনু নেই
  const examShell = (key, fn) => (c, arg) => {
    const own = ["model", "gk", "special"], ex = arg && DB.exams.find((e) => e.id === arg);
    const on = key === "talent" || key === "quiz" ? key : own.includes(arg) ? "exams/" + arg : ex && own.includes(ex.type) ? "exams/" + ex.type : "exams";
    c.innerHTML = `<div class="ln-tabs ex-switch sub-switch no-print">${[["exams", "পরীক্ষা <small>সাপ্তাহিক · মাসিক · অধ্যায়</small>"], ["exams/model", "মডেল টেস্ট"], ["exams/gk", "সাপ্তাহিক জিকে টেস্ট"], ["exams/special", "বিশেষ পরীক্ষা"], ["quiz", "অনলাইন কুইজ"], ["talent", "ট্যালেন্ট হান্ট"]].map(([k, t]) => `<a href="#${k}" class="${k === on ? "on" : ""}">${t}</a>`).join("")}</div><div class="ex-sub-page"></div>`;
    return fn($(".ex-sub-page", c), arg);
  };

  // মেনুর ৭টা ভাগ: প্রতিটার ভেতরের পাতাগুলো পাতার উপরে বোতাম হিসেবে — [পাতা, নাম, সংখ্যার badge-এর id]
  const SEC_NAME = { admission: "ভর্তি", students: "শিক্ষার্থী", exams: "পরীক্ষা ও ফলাফল", website: "ওয়েবসাইট", teachers: "সেটআপ" };
  const SECTIONS = [
    ["admission", [["admission", "ভর্তি ফর্ম"], ["applications", "অনলাইন আবেদন", "appBadge"], ["onlineApps", "অনলাইন কোর্সে ভর্তি", "oaBadge"], ["leads", "সম্ভাব্য শিক্ষার্থী", "enqBadge"]]],
    ["exams", [["exams", "পরীক্ষা"], ["results", "ফলাফল ও মূল্যায়ন"]]],
    ["website", [["banners", "বিজ্ঞাপন"], ["notices", "নোটিশ"], ["ebooks", "ই-বুক"], ["daily", "প্রতিদিন শিখি"], ["qna", "প্রশ্নোত্তর বক্স", "qnaBadge"], ["faqs", "সাধারণ প্রশ্ন (FAQ)"], ["gallery", "আমাদের দিনলিপি"], ["classMoments", "ক্লাসের ক্যানভাস"], ["achievers", "সফল শিক্ষার্থী"], ["ratings", "শিক্ষার্থীদের মতামত"], ["learn", "ফ্রি ক্লাস", "learnBadge"]]],
    ["teachers", [["teachers", "শিক্ষক"], ["settings", "সেটিংস"]]],
  ];
  const SEC_ALIAS = { website: "banners", talent: "exams", quiz: "exams" }; // #website = ব্যানার; ট্যালেন্ট হান্ট ও অনলাইন কুইজ পরীক্ষার ভেতরে
  // কোন মেনু আইটেম জ্বলবে
  const NAV_OF = { student: "students", batchmove: "students", enquiries: "admission", ...Object.fromEntries(SECTIONS.flatMap(([nav, tabs]) => tabs.map(([k]) => [k, nav]))) };
  NAV_OF.talent = NAV_OF.quiz = "exams";
  const badgeText = (id) => { const b = id && $("#" + id); return b && !b.hidden ? b.textContent : ""; };
  // পাতার উপরে ভাগের বোতাম, নিচে পাতা নিজে
  function sectionWrap(key, c) {
    const k = SEC_ALIAS[key] || key, sec = SECTIONS.find(([, tabs]) => tabs.some(([t]) => t === k));
    if (!sec) return c;
    // সম্ভারুণের ধাঁচে: বাঁয়ে ভাগের নাম, তারপর প্রতিটা বোতাম আলাদা হালকা রঙে; খোলা পাতারটা উজ্জ্বল, সাদা রিং
    c.innerHTML = `<nav class="sec-tabs no-print"><span class="sec-name">${SEC_NAME[sec[0]]}</span>${sec[1].map(([t, label, bid], i) => `<a href="#${t}" class="sec-b c${i % 6}${t === k ? " on" : ""}">${label}${badgeText(bid) ? ` <b class="sec-n">${esc(badgeText(bid))}</b>` : ""}</a>`).join("")}</nav><div class="ex-sub-page"></div>`;
    return $(".ex-sub-page", c);
  }

  // ================= পেজগুলো =================
  const PAGES = {
    website: ["ওয়েবসাইট — বিজ্ঞাপন", (c, arg) => bannersPage(c, arg)],
    dashboard: ["ড্যাশবোর্ড", dashboard],
    admission: ["ভর্তি ফর্ম", admission],
    applications: ["অনলাইন ভর্তির আবেদন", applications],
    onlineApps: ["অনলাইন কোর্সে ভর্তির আবেদন", onlineApps],
    students: ["শিক্ষার্থী", students],
    student: ["শিক্ষার্থীর প্যানেল", studentPanelPage],
    attendance: ["দৈনিক হাজিরা", attendance],
    batchmove: ["ব্যাচ পরিবর্তন", batchMove],
    fees: ["ফি ও পেমেন্ট", fees],
    exams: ["পরীক্ষা", examShell("exams", examsPage)],
    quiz: ["পরীক্ষা — অনলাইন কুইজ", examShell("quiz", quizPage)],
    results: ["ফলাফল ব্যবস্থাপনা", (c, arg) => resultsPage(c, arg)],
    homework: ["বাড়ির কাজ / পড়া", (c, arg) => homeworkPage(c, arg)],
    books: ["বই ও শিট", booksPage],
    sms: ["SMS প্যানেল", smsPage],
    bloodbank: ["ব্লাড ব্যাংক", bloodBank],
    enquiries: ["ভর্তির খোঁজ", enquiries],
    leads: ["সম্ভাব্য শিক্ষার্থী", (c, arg) => leadsPage(c, arg)],
    talent: ["পরীক্ষা — ট্যালেন্ট হান্ট", examShell("talent", talentPage)],
    learn: ["ওয়েবসাইট — ফ্রি ক্লাস", (c, arg) => learnPage(c, arg)],
    courses: ["মডিউল, সেশন ও ব্যাচ", courses],
    banners: ["ওয়েবসাইট — বিজ্ঞাপন", (c, arg) => bannersPage(c, arg)],
    gallery: ["ওয়েবসাইট — আমাদের দিনলিপি", (c, arg) => galleryPage(c, arg)],
    classMoments: ["ওয়েবসাইট — ক্লাসের ক্যানভাস", classMomentsPage],
    achievers: ["ওয়েবসাইট — সফল শিক্ষার্থী", (c, arg) => achieversPage(c, arg)],
    ratings: ["ওয়েবসাইট — শিক্ষার্থীদের মতামত", ratingsPage],
    notices: ["ওয়েবসাইট — নোটিশ", notices],
    faqs: ["ওয়েবসাইট — সাধারণ প্রশ্ন (FAQ)", faqs],
    ebooks: ["ওয়েবসাইট — ই-বুক", ebooks],
    daily: ["ওয়েবসাইট — প্রতিদিন শিখি", daily],
    access: ["শিক্ষার্থী — মেয়াদ (রেকর্ড ক্লাস ও ই-বুক)", (c) => accessPage(c).catch((e) => { c.innerHTML = `<div class="card"><p class="empty">${esc(e.message)}</p></div>`; })],
    qna: ["ওয়েবসাইট — প্রশ্নোত্তর বক্স", (c, arg) => qnaPage(c, arg)],
    teachers: ["শিক্ষক", teachers],
    settings: ["সেটিংস", settings],
  };
  function route() {
    const [key, ...rest] = (location.hash.slice(1) || "dashboard").split("/");
    const arg = rest.join("/");
    const [title, fn] = PAGES[key] || PAGES.dashboard;
    // ভর্তি হয়ে যাওয়া শিক্ষার্থীর তথ্য বদলানো / নতুন মডিউল = শিক্ষার্থী ভাগের কাজ, ভর্তির নয়
    const ofStudent = key === "admission" && /^(edit|enroll)\//.test(arg);
    $("#pageTitle").textContent = ofStudent ? (arg.startsWith("edit") ? "শিক্ষার্থীর তথ্য সম্পাদনা" : "শিক্ষার্থী — নতুন মডিউলে ভর্তি") : title;
    document.body.classList.add("dash-dark"); // অ্যাডমিনের সব পাতার পেছন কালো
    const navKey = ofStudent ? "students" : NAV_OF[key] || (PAGES[key] ? key : "dashboard");
    $$(".nav-item").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + navKey));
    $("#side").classList.remove("open");
    if (modal.open) closeModal();
    const c = $("#content");
    c.innerHTML = "";
    c.onclick = c.onchange = c.oninput = c.onkeydown = c.onsubmit = null;
    fn(sectionWrap(ofStudent ? "students" : key, c), arg);
  }
  addEventListener("hashchange", route);
  // মেনুতে ভাগের মোট সংখ্যা: ভেতরের পাতাগুলোর (লুকানো) সংখ্যা যোগ করে
  const sideBadges = () => $$(".side .nav-item").forEach((a) => {
    const sb = $(".sbadge", a); if (!sb) return;
    const n = $$(".kids .badge", a).filter((b) => !b.hidden).reduce((t, b) => t + (Number(String(b.textContent).replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d))) || 0), 0), t = bn(n);
    if (sb.hidden !== !n) sb.hidden = !n; // বদলালে তবেই লেখা (না হলে নজরদারি নিজেই আবার চলে)
    if (sb.textContent !== t) sb.textContent = t;
  });
  new MutationObserver(sideBadges).observe($("#side"), { subtree: true, attributes: true, attributeFilter: ["hidden"], childList: true, characterData: true });
  sideBadges();

  // ---------- ড্যাশবোর্ড ----------
  // ---------- ড্যাশবোর্ডের চার্ট (SVG, কোনো লাইব্রেরি ছাড়া) ----------
  // লিডের উৎস = প্রথম যেখান থেকে এসেছে। রং: নির্দিষ্ট ক্রমে (ক্যাটাগরি ১, ২, ৩…) — প্রতিটা জিনিসের রং সবসময় একই থাকে
  const DV = ["#4f8ff7", "#ff8a5c", "#2fbf8f", "#e5a12a", "#9b7ff5", "#ef65a8"];
  const tipAttr = (t) => ` data-tip="${esc(t)}"`;
  // রেখা-চার্ট: এক সিরিজ, ০–১০০%
  function dvLine(pts, unit = "%") {
    const ok = pts.filter((p) => p.v !== null); if (!ok.length) return '<p class="dv-empty">এখনো কোনো তথ্য নেই</p>';
    const W = 520, H = 210, L = 34, R = 12, T = 16, B = 30, st = (W - L - R) / Math.max(1, pts.length - 1);
    const x = (i) => L + i * st, y = (v) => T + (1 - v / 100) * (H - T - B);
    let path = "", pen = false;
    pts.forEach((p, i) => { if (p.v === null) { pen = false; return; } path += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`; pen = true; });
    const last = pts.map((p, i) => [p, i]).filter(([p]) => p.v !== null).pop();
    return `<svg class="dv" viewBox="0 0 ${W} ${H}" role="img" aria-label="উপস্থিতির হার, দিন অনুযায়ী">
      ${[0, 50, 100].map((v) => `<line class="g" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${bn(v)}${unit}</text>`).join("")}
      <defs><linearGradient id="dvArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f8ff7" stop-opacity=".28"/><stop offset="1" stop-color="#4f8ff7" stop-opacity="0"/></linearGradient></defs>
      ${ok.length > 1 ? (() => { const seg = []; let cur = []; pts.forEach((p, i) => { if (p.v === null) { if (cur.length) seg.push(cur); cur = []; } else cur.push(i); }); if (cur.length) seg.push(cur); return seg.filter((g) => g.length > 1).map((g) => `<path class="ar" d="M${x(g[0])},${y(0)}${g.map((i) => `L${x(i).toFixed(1)},${y(pts[i].v).toFixed(1)}`).join("")}L${x(g[g.length - 1])},${y(0)}Z"/>`).join(""); })() : ""}
      <path class="ln" d="${path}"/>
      ${pts.map((p, i) => (p.v === null ? "" : `<circle class="mk" cx="${x(i)}" cy="${y(p.v)}" r="4"/><circle class="hit" cx="${x(i)}" cy="${y(p.v)}" r="13"${tipAttr(`${p.lab}: ${bn(Math.round(p.v))}${unit}${p.sub ? " · " + p.sub : ""}`)}/>`)).join("")}
      ${pts.map((p, i) => (i % 2 === pts.length % 2 || i === pts.length - 1 ? `<text class="ax" x="${x(i)}" y="${H - 9}" text-anchor="middle">${esc(p.short)}</text>` : "")).join("")}
      ${last ? `<text class="dl" x="${x(last[1])}" y="${y(last[0].v) - 10}" text-anchor="${last[1] > pts.length - 3 ? "end" : "middle"}">${bn(Math.round(last[0].v))}${unit}</text>` : ""}</svg>`;
  }
  // কলাম-চার্ট: এক সিরিজ, প্রতিটার মাথায় মান
  function dvBars(items, fmt) {
    const max = Math.max(1, ...items.map((d) => d.v)); if (!items.some((d) => d.v)) return '<p class="dv-empty">এখনো কোনো আদায় নেই</p>';
    const W = 520, H = 210, L = 10, R = 10, T = 22, B = 30, slot = (W - L - R) / items.length, bw = Math.min(46, slot * 0.56);
    const y = (v) => T + (1 - v / max) * (H - T - B), base = H - B;
    return `<svg class="dv" viewBox="0 0 ${W} ${H}" role="img" aria-label="মাসিক আদায়"><defs><linearGradient id="dvBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2fbf8f"/><stop offset="1" stop-color="#9fe6cc"/></linearGradient></defs>
      <line class="g" x1="${L}" x2="${W - R}" y1="${base}" y2="${base}"/>
      ${items.map((d, i) => { const cx = L + slot * i + slot / 2, top = y(d.v), h = base - top, r = Math.min(4, h);
        return `${h > 0 ? `<path class="bar" d="M${cx - bw / 2},${base}V${top + r}Q${cx - bw / 2},${top} ${cx - bw / 2 + r},${top}H${cx + bw / 2 - r}Q${cx + bw / 2},${top} ${cx + bw / 2},${top + r}V${base}Z"/>` : ""}
          <rect class="hit" x="${cx - slot / 2}" y="${T}" width="${slot}" height="${base - T}"${tipAttr(`${d.lab}: ${fmt(d.v)}`)}/>
          <text class="dl" x="${cx}" y="${top - 6}" text-anchor="middle">${d.v ? fmt(d.v) : ""}</text><text class="ax" x="${cx}" y="${H - 9}" text-anchor="middle">${esc(d.short)}</text>`; }).join("")}</svg>`;
  }
  // ডোনাট (পাই): অংশগুলোর মাঝে ২px ফাঁক, মাঝে মোট, পাশে লেজেন্ডে নাম + সংখ্যা + %
  function dvDonut(parts, center, fmt = (v) => bn(v)) {
    const all = parts.reduce((t, p) => t + p.v, 0); if (!all) return '<p class="dv-empty">এখনো কোনো তথ্য নেই</p>';
    const R = 70, r = 46, C = 90; let a0 = -Math.PI / 2;
    const arc = (a, b) => { const big = b - a > Math.PI ? 1 : 0, p = (rad, t) => `${(C + rad * Math.cos(t)).toFixed(2)},${(C + rad * Math.sin(t)).toFixed(2)}`;
      return `M${p(R, a)}A${R},${R} 0 ${big} 1 ${p(R, b)}L${p(r, b)}A${r},${r} 0 ${big} 0 ${p(r, a)}Z`; };
    const segs = parts.map((p) => { const a = a0, b = a0 + (p.v / all) * Math.PI * 2; a0 = b; return { ...p, a, b }; });
    return `<div class="dv-donut"><svg class="dv" viewBox="0 0 180 180" role="img" aria-label="${esc(center[1])}">
      ${segs.filter((s) => s.v).map((s) => (s.v === all ? `<circle cx="${C}" cy="${C}" r="${(R + r) / 2}" fill="none" stroke="${s.c}" stroke-width="${R - r}"${tipAttr(`${s.lab}: ${fmt(s.v)} (১০০%)`)}/>` : `<path d="${arc(s.a, s.b)}" fill="${s.c}" class="seg"${tipAttr(`${s.lab}: ${fmt(s.v)} (${bn(Math.round((s.v / all) * 100))}%)`)}/>`)).join("")}
      <text class="dc" x="${C}" y="${C + 2}" text-anchor="middle">${center[0]}</text><text class="ax" x="${C}" y="${C + 20}" text-anchor="middle">${esc(center[1])}</text></svg>
      <ul class="dv-leg">${parts.map((p) => `<li><i style="background:${p.c}"></i><span>${esc(p.lab)}</span><b>${fmt(p.v)}</b><small>${bn(Math.round((p.v / all) * 100))}%</small></li>`).join("")}</ul></div>`;
  }
  // চার্টের উপর মাউস রাখলে ছোট বাক্সে মান
  function dvTips(root) {
    let tip = $("#dvTip"); if (!tip) { tip = document.createElement("div"); tip.id = "dvTip"; tip.className = "dv-tip"; document.body.append(tip); }
    root.onmousemove = (e) => { const t = e.target.closest("[data-tip]"); if (!t || !root.contains(t)) return (tip.hidden = true); tip.textContent = t.dataset.tip; tip.hidden = false; tip.style.left = Math.min(innerWidth - tip.offsetWidth - 8, e.clientX + 14) + "px"; tip.style.top = e.clientY - 38 + "px"; };
    root.onmouseleave = () => (tip.hidden = true);
  }
  function dashCharts(act) {
    // উপস্থিতি: গত ১৪ দিন, প্রতিদিন সব ব্যাচ মিলিয়ে (ছুটি বাদ)
    const days = [...Array(14)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 13 + i); return d.toISOString().slice(0, 10); });
    const att = days.map((d) => { let p = 0, a = 0; for (const [k, m] of Object.entries(DB.attendance)) if (k.startsWith(d + "|")) for (const v of Object.values(m)) v === "P" ? p++ : v === "A" && a++;
      return { lab: U.date(d), short: bn(Number(d.slice(8))), v: p + a ? (p / (p + a)) * 100 : null, sub: p + a ? `${bn(p)}/${bn(p + a)} জন` : "" }; });
    // আদায়: গত ৬ মাস
    const mons = [...Array(6)].map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); return d.toISOString().slice(0, 7); });
    const pay = mons.map((m) => ({ lab: U.month(m), short: U.month(m).split(" ")[0], v: DB.payments.filter((p) => (p.date || "").startsWith(m)).reduce((t, p) => t + p.amount, 0) }));
    const paid = DB.payments.reduce((t, p) => t + p.amount, 0), due = act.reduce((t, s) => t + Math.max(0, s.fees.balance), 0);
    const sess = liveSessions().map((se, i) => ({ lab: se.name, v: act.filter((s) => s.session === se.name).length, c: DV[i % DV.length] }));
    const SRC = [["qna", "প্রশ্ন ও উত্তর"], ["guest", "অতিথি অ্যাকাউন্ট"], ["quiz", "অনলাইন কুইজ"], ["enquiry", "ভর্তির আগ্রহ ফর্ম"], ["talent", "Talent Hunt"], ["course", "অনলাইন কোর্স"], ["offline", "অফলাইন মার্কেটিং"], ["manual", "হাতে যোগ"]];
    const leads = SRC.map(([k, t], i) => ({ lab: t, v: (DB.leads || []).filter((l) => ((l.sources || [])[0] || {}).type === k).length, c: DV[i] })).filter((x) => x.v);
    const card = (t, sub, body, link, k) => `<div class="card dv-card ${k}"><div class="card-head"><div><h2>${t}</h2><small class="dv-sub">${sub}</small></div>${link || ""}</div>${body}</div>`;
    return `<div class="dv-grid">
      ${card("উপস্থিতির ধারা", "গত ১৪ দিন · সব ব্যাচ মিলিয়ে উপস্থিতির হার", dvLine(att), '<a href="#attendance">হাজিরা →</a>', "dv-blue")}
      ${card("মাসিক আদায়", "গত ৬ মাসে প্রতি মাসে কত টাকা জমা", dvBars(pay, money), '<a href="#fees">ফি →</a>', "dv-green")}
      ${card("ফি-র অবস্থা", "মোট আদায় আর এখনকার বকেয়া", dvDonut([{ lab: "আদায় হয়েছে", v: paid, c: DV[2] }, { lab: "বকেয়া", v: due, c: DV[1] }], [paid + due ? bn(Math.round((paid / (paid + due)) * 100)) + "%" : "—", "আদায়ের হার"], money), '<a href="#fees/dues">বকেয়া →</a>', "dv-peach")}
      ${card("শিক্ষার্থী — সেশন অনুযায়ী", "চালু সেশনের সক্রিয় শিক্ষার্থী", dvDonut(sess, [bn(act.length), "মোট শিক্ষার্থী"]), '<a href="#students">সব →</a>', "dv-violet")}
      ${card("লিড কোথা থেকে এসেছে", "সম্ভাব্য শিক্ষার্থীর উৎস", dvDonut(leads, [bn((DB.leads || []).length), "মোট লিড"]), '<a href="#leads">লিডস →</a>', "dv-pink")}
    </div>`;
  }
  function dashboard(c) {
    const act = activeStudents();
    const todayRecs = Object.entries(DB.attendance).filter(([k]) => k.startsWith(U.today() + "|"));
    const marks = todayRecs.flatMap(([, m]) => Object.values(m));
    const present = marks.filter((v) => v === "P").length; // L = ছুটি (উপস্থিত ধরা হয় না)
    const collected = DB.payments.filter((p) => (p.date || "").startsWith(thisMonth())).reduce((t, p) => t + p.amount, 0);
    const dues = act.filter((s) => s.fees.balance > 0).sort((a, b) => b.fees.balance - a.fees.balance);
    const totalDue = dues.reduce((t, s) => t + s.fees.balance, 0);
    const newApps = DB.applications.filter((a) => a.status === "pending");
    const notices = DB.notices.filter((n) => !n.until || n.until >= U.today());
    c.innerHTML = `
      <div class="tiles kpi">
        <a class="tile k1" href="#students"><i></i><small>সক্রিয় শিক্ষার্থী</small><b>${bn(act.length)}</b><em>সব চালু সেশন মিলিয়ে</em></a>
        <a class="tile k2" href="#attendance"><i>✓</i><small>আজকের হাজিরা</small><b>${marks.length ? bn(present) + " / " + bn(marks.length) : "—"}</b><em>${marks.length ? "উপস্থিত / মোট" : "আজ এখনো নেওয়া হয়নি"}</em></a>
        <a class="tile k3" href="#fees"><i>৳</i><small>এই মাসের আদায়</small><b>${money(collected)}</b><em>${esc(U.month(thisMonth()))}</em></a>
        <a class="tile k4" href="#fees/dues"><i></i><small>মোট বকেয়া</small><b>${money(totalDue)}</b><em>${bn(dues.length)} জনের কাছে</em></a>
        <a class="tile k5" href="#applications"><i></i><small>নতুন অনলাইন আবেদন</small><b>${bn(newApps.length)}</b><em>দেখার অপেক্ষায়</em></a>
        <a class="tile k6" href="#leads/follow"><i></i><small>আজ যাদের ফোন করতে হবে</small><b>${bn((DB.leads || []).filter((l) => l.followUp && l.followUp <= U.today() && !["admitted", "notinterested", "wrong", "dnc"].includes(l.status)).length)}</b><em>লিডের ফলো-আপ</em></a>
      </div>
      <div class="toolbar" style="margin:0"><a class="btn gold" href="#admission">＋ নতুন ভর্তি</a><a class="btn line" href="#attendance">✓ আজকের হাজিরা</a><a class="btn line" href="#fees">৳ পেমেন্ট নিন</a></div>
      ${dashCharts(act)}
      <div class="card sess-card"><div class="card-head"><h2>সেশন ও ক্লাস ব্যাচ</h2><a href="#courses">পরিচালনা →</a></div>
        ${liveSessions().map((se) => {
          const list = DB.batches.filter((b) => b.session === se.name);
          const n = act.filter((s) => s.session === se.name).length;
          return `<h3 style="font-size:16px;margin:10px 0 8px">${esc(se.name)} <small style="color:var(--muted);font-weight:400">${bn(n)} জন</small></h3>
            <div class="batch-chips">${list.map((b) => { const k = act.filter((s) => s.batchId === b.id).length; return `<a href="#students/batch/${b.id}" class="bchip${k >= b.capacity ? " full" : ""}"><b>${esc(b.name)}</b><small>${esc(b.days || "—")} · ${esc(b.time || "")}</small><span>${bn(k)}/${bn(b.capacity)}</span></a>`; }).join("") || '<span class="muted">কোনো ব্যাচ নেই</span>'}</div>`;
        }).join("") || '<p class="empty">কোনো চালু সেশন নেই</p>'}
      </div>
      <div class="grid2">
        <div class="card dues-card"><div class="card-head"><h2>বকেয়া বেশি যাদের</h2><a href="#fees/dues">সব দেখুন →</a></div>
          ${dues.length ? `<ul class="list">${dues.slice(0, 6).map((s) => `<li><b>${esc(s.name)}</b> <span class="chip bad" style="float:right">${money(s.fees.balance)}</span><p>${esc(s.id)} · ${esc(s.session || "")} · ${esc(batchName(s.batchId))}</p></li>`).join("")}</ul>` : '<p class="empty">কোনো বকেয়া নেই </p>'}
        </div>
        <div class="card"><div class="card-head"><h2>নতুন অনলাইন আবেদন</h2><a href="#applications">সব দেখুন →</a></div>
          ${newApps.length ? `<ul class="list">${newApps.slice(-6).reverse().map((a) => `<li><b>${esc(a.name)}</b> <a style="float:right" href="tel:${esc(a.phone)}">${esc(a.phone)}</a><p>${esc((courseById(a.courseId) || {}).name || "")} · ${esc(a.session || "")} · ${U.date(a.createdAt)}</p></li>`).join("")}</ul>` : '<p class="empty">নতুন কোনো আবেদন নেই</p>'}
        </div>
      </div>
      <div class="card"><div class="card-head"><h2>নোটিশ বোর্ড</h2><a href="#notices">পরিচালনা →</a></div>
        ${notices.length ? `<ul class="list">${notices.map((n) => `<li><b>${n.important ? "" : ""}${esc(n.title)}</b><p>${esc(n.body)}</p></li>`).join("")}</ul>` : '<p class="empty">কোনো নোটিশ নেই</p>'}
      </div>`;
    dvTips(c);
  }

  // ---------- অনলাইন আবেদন ----------
  const APP_STATUS = [["pending", "নতুন / অপেক্ষমাণ"], ["contacted", "যোগাযোগ করা হয়েছে"], ["approved", "ভর্তি সম্পন্ন"], ["rejected", "বাতিল"]];
  const appChip = (st) => `<span class="chip ${{ pending: "gold", contacted: "", approved: "ok", rejected: "bad" }[st] || ""}">${esc((APP_STATUS.find((x) => x[0] === st) || [, st])[1])}</span>`;
  function viewApplication(id) {
    const a = DB.applications.find((x) => x.id === id);
    if (!a) return;
    const c = courseById(a.courseId) || {}, b = batchById(a.batchId);
    const r = (k, v) => (v ? `<dt>${k}</dt><dd>${esc(v)}</dd>` : "");
    openModal({
      title: `আবেদন ${a.appNo}`, wide: true,
      body: `<div style="display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap">
          <div>${avatar(a.photo, "a", a.id, a.name, 110, a.gender)}</div>
          <dl class="kv" style="flex:1;min-width:260px">
            <dt>অবস্থা</dt><dd>${appChip(a.status)}${a.studentId ? ` → <a href="#" id="goStu">${esc(a.studentId)}</a>` : ""}</dd>
            ${r("মডিউল", c.name)}${r("অধ্যায়", chapterNames(c, a.chapters).join(", "))}${r("ফি", a.fee ? money(a.fee) + (c.feeType === "monthly" ? "/মাস" : "") : "")}
            ${r("সেশন", a.session)}${r("ক্লাস ব্যাচ", b ? batchFull(b) : "বাছাই করেনি")}
            ${r("নাম", a.name)}${r("ইংরেজিতে", a.nameEn)}${r("লিঙ্গ", { M: "ছেলে", F: "মেয়ে", O: "অন্যান্য" }[a.gender] || "")}
            ${r("মোবাইল", a.phone)}${r("জন্ম তারিখ", a.dob && U.date(a.dob))}${r("ইমেইল", a.email)}
            ${r("কলেজ", a.college)}${r("শ্রেণি / বিভাগ", [a.klass, a.group].filter(Boolean).join(" · "))}
            ${r("SSC", [a.sscRoll && "রোল " + a.sscRoll, a.sscBoard, a.sscGpa && "GPA " + a.sscGpa, a.sscYear].filter(Boolean).join(" · "))}
            ${r("বাবা", [a.fatherName, a.fatherOccupation, a.fatherPhone].filter(Boolean).join(" · "))}
            ${r("মা", [a.motherName, a.motherOccupation, a.motherPhone].filter(Boolean).join(" · "))}
            ${r("অভিভাবক", [a.guardianName, a.guardianRelation && `(${a.guardianRelation})`, a.guardianPhone].filter(Boolean).join(" "))}
            ${r("বর্তমান ঠিকানা", a.address)}${r("স্থায়ী ঠিকানা", a.sameAddress ? "বর্তমান ঠিকানাই" : a.permanentAddress)}${r("জেনেছে", a.source)}${r("বার্তা", a.message)}${r("আবেদনের সময়", new Date(a.createdAt).toLocaleString("bn-BD"))}
          </dl></div>
        <div class="fgrid" style="margin-top:16px">
          <label>অবস্থা<select id="apSt">${opt(APP_STATUS, a.status)}</select></label>
          <label>অফিসের নোট (আবেদনকারী দেখতে পাবে)<input id="apNote" value="${esc(a.note)}" placeholder="যেমন: শনিবার অফিসে আসুন"></label>
        </div>
        <div class="toolbar" style="margin-top:14px">
          ${a.status !== "approved" ? '<button type="button" class="btn gold" id="apApprove">✓ ভর্তি করুন (আইডি তৈরি)</button>' : ""}
          <button type="button" class="btn line" id="apSave">অবস্থা সেভ</button>
          <button type="button" class="btn line" id="apPrint">ভর্তি ফর্ম</button>
          <a class="btn line" href="tel:${esc(a.phone)}">কল</a>
          <a class="btn wa" target="_blank" rel="noopener" href="${waLink(a.guardianPhone || a.phone, `আসসালামু আলাইকুম। ${DB.settings.name} থেকে বলছি — ${a.name}-এর ভর্তির আবেদন (${a.appNo}) পেয়েছি।`)}">WhatsApp</a>
        </div>`,
    });
    const gs = $("#goStu"); if (gs) gs.onclick = (e) => { e.preventDefault(); viewStudent(a.studentId); };
    $("#apSave").onclick = async () => {
      try { await save("applications", { status: $("#apSt").value, note: $("#apNote").value }, a.id); await load(); route(); toast("সেভ হয়েছে"); viewApplication(a.id); } catch (e) { toast(e.message, true); }
    };
    $("#apPrint").onclick = () => printAdmission(a, { appNo: a.appNo, photoUrl: a.photo ? photoUrl("a", a.id) : "", date: U.date(a.createdAt), studentId: a.studentId });
    const ap = $("#apApprove"); if (ap) ap.onclick = () => approveForm(a);
  }
  // আবেদন থেকে ভর্তি — পূর্ণ পেজের ভর্তি ফর্মে আবেদনের তথ্য বসে যায়
  function approveForm(a) { if (modal.open) closeModal(); location.hash = `admission/app/${a.id}`; }
  // ---------- ★ শিক্ষার্থীদের মতামত (শিক্ষার্থী প্যানেল থেকে আসে; মন্তব্যসহগুলো ওয়েবসাইটের "যারা শিখছে, তারা যা বলে" অংশে) ----------
  function ratingsPage(c) {
    const L = [...(DB.ratings || [])].sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const avg = L.length ? L.reduce((t, r) => t + r.stars, 0) / L.length : 0;
    const st = (n) => `<span style="color:#e8a317;letter-spacing:1px">${"★".repeat(n)}<span style="color:#d9d4c7">${"★".repeat(5 - n)}</span></span>`;
    c.innerHTML = `<div class="card"><div class="card-head"><h2>★ শিক্ষার্থীদের মতামত <small style="color:var(--muted);font-weight:400">গড় ${bn(avg.toFixed(1))} · ${bn(L.length)}টি</small></h2>
        <a class="btn line" href="/#reviews" target="_blank">→ ওয়েবসাইটে দেখুন</a></div>
      <p style="margin:0 0 12px;color:var(--muted)">ওয়েবসাইটের ফর্ম থেকে আসা মতামত আগে যাচাই করুন। প্রকাশ করতে “দেখান” চাপুন।</p>
      <div class="tbl-wrap"><table><thead><tr><th>শিক্ষার্থী</th><th>রেটিং</th><th>মন্তব্য</th><th>তারিখ</th><th>ওয়েবসাইটে</th><th></th></tr></thead><tbody>
      ${L.map((r) => { const s = DB.students.find((x) => x.id === r.studentId) || {}; return `<tr${r.hidden ? ' class="muted-row"' : ""}>
        <td><b>${esc(r.publicSubmission ? r.name : s.name || "—")}</b><small>${esc(r.publicSubmission ? [r.affiliation === "alumni" ? "সাবেক শিক্ষার্থী" : "বর্তমান শিক্ষার্থী", r.batch].filter(Boolean).join(" · ") : r.studentId)}${s.session ? " · " + esc(s.session) : ""}</small></td><td>${st(r.stars)}</td>
        <td style="max-width:420px">${esc(r.comment || "—")}</td><td>${U.date(r.at)}</td>
        <td>${!r.comment ? '<span class="chip">মন্তব্য নেই</span>' : r.hidden ? '<span class="chip bad">প্রকাশিত নয়</span>' : '<span class="chip ok">দেখাচ্ছে</span>'}</td>
        <td class="num" style="white-space:nowrap">${r.comment ? `<button class="btn sm line" data-rh="${r.id}">${r.hidden ? "দেখান" : "লুকান"}</button> ` : ""}<button class="icon-btn" title="মুছুন" data-rd="${r.id}">✕</button></td></tr>`; }).join("")
        || '<tr><td colspan="6" class="empty">এখনো কোনো মতামত আসেনি</td></tr>'}</tbody></table></div></div>`;
    c.onclick = async (e) => {
      const t = e.target.closest("[data-rh],[data-rd]"); if (!t) return;
      if (t.dataset.rd) return remove("ratings", t.dataset.rd, "এই মতামত");
      const r = DB.ratings.find((x) => x.id === t.dataset.rh);
      try { await save("ratings", { hidden: !r.hidden }, r.id); await load(); route(); toast(r.hidden ? "ওয়েবসাইটে দেখাচ্ছে" : "ওয়েবসাইট থেকে লুকানো হয়েছে"); } catch (err) { toast(err.message, true); }
    };
  }
  // ---------- অনলাইন কোর্সে ভর্তি (ওয়েবসাইটের /online-apply থেকে আসে) ----------
  const PAY_STATUS = [["unpaid", "বাকি"], ["verifying", "যাচাই বাকি"], ["paid", "পরিশোধিত"], ["rejected", "মেলেনি"]];
  const PAY_LABEL = { ...Object.fromEntries(PAY_STATUS), initiated: "গেটওয়েতে শুরু", failed: "ব্যর্থ", cancelled: "বাতিল" };
  const PAY_VIA = { bkash: "বিকাশ", nagad: "নগদ", rocket: "রকেট", bank: "ব্যাংক", gateway: "অনলাইন গেটওয়ে" };
  const payOf = (a) => (a.pay && a.pay.status) || "unpaid";
  const payChip = (a) => !(a.fee > 0) ? '<span class="chip">ফি নেই</span>'
    : `<span class="chip ${{ paid: "ok", verifying: "gold", rejected: "bad", failed: "bad" }[payOf(a)] || ""}">${esc(PAY_LABEL[payOf(a)] || payOf(a))}</span>${a.pay && a.pay.method ? `<small>${esc(PAY_VIA[a.pay.method] || a.pay.method)}${a.pay.trxId ? " · " + esc(a.pay.trxId) : a.pay.channel ? " · " + esc(a.pay.channel) : ""}</small>` : ""}`;
  // পেমেন্ট সেটিংস: হাতে পাঠানোর নম্বর/ব্যাংক (সেটিংসে) + গেটওয়ে SSLCommerz (আলাদা ফাইলে, পাসওয়ার্ড ফেরত আসে না)
  async function paySettingsForm() {
    const g = await api("/api/admin/payment-config");
    const st = DB.settings || {};
    openForm({
      title: "পেমেন্ট সেটিংস",
      fields: [
        { type: "html", html: '<h3 style="margin:0">নিজে পাঠানো (সেন্ড মানি / ব্যাংকে জমা)</h3><p style="margin:2px 0 0;color:var(--muted)">যে ঘর খালি রাখবেন সেটা ওয়েবসাইটে দেখাবে না। শিক্ষার্থী টাকা পাঠিয়ে TrxID দেবে, এখানে "যাচাই বাকি" দেখাবে।</p>' },
        { name: "payBkash", label: "বিকাশ নম্বর", placeholder: "01XXXXXXXXX (পার্সোনাল / মার্চেন্ট)" },
        { name: "payNagad", label: "নগদ নম্বর", placeholder: "01XXXXXXXXX" },
        { name: "payRocket", label: "রকেট নম্বর", placeholder: "01XXXXXXXXXX (১২ সংখ্যা)" },
        { name: "payBank", label: "ব্যাংক অ্যাকাউন্ট (প্রতি লাইনে একটি তথ্য)", type: "textarea", wide: true, rows: 4, placeholder: "ব্যাংক: ডাচ-বাংলা ব্যাংক\nঅ্যাকাউন্টের নাম: Shahin's ICT Care\nঅ্যাকাউন্ট নম্বর: ...\nশাখা: মাদারীপুর" },
        { name: "cardNote", label: "বেতন কার্ডে শিক্ষকের বার্তা", wide: true, placeholder: "আগামী ১০ তারিখের মধ্যে বকেয়া পরিশোধ করুন।" },
        { name: "payNote", label: "পেমেন্টের নিচে ছোট বার্তা (ঐচ্ছিক)", type: "textarea", wide: true, rows: 2, placeholder: "যেমন: পেমেন্টের ২৪ ঘণ্টার মধ্যে অফিস থেকে ফোন করা হবে" },
        { type: "html", html: `<h3 style="margin:10px 0 0">অনলাইন গেটওয়ে — SSLCommerz</h3><p style="margin:2px 0 0;color:var(--muted)">এক জায়গায় বিকাশ, নগদ, রকেট, কার্ড আর ইন্টারনেট ব্যাংকিং। sslcommerz.com থেকে মার্চেন্ট অ্যাকাউন্ট খুলে Store ID ও Store Password এখানে দিন।
          এখন: <b>${g.live ? (g.sslSandbox ? "চালু (পরীক্ষামূলক / Sandbox)" : "চালু (আসল)") : "বন্ধ"}</b></p>` },
        { name: "sslStoreId", label: "Store ID", placeholder: "যেমন: shahinsict0live" },
        { name: "sslStorePass", label: "Store Password", type: "password", placeholder: g.hasPass ? "দেওয়া আছে — বদলাতে নতুনটা লিখুন" : "Store Password" },
        { name: "sslSandbox", label: "পরীক্ষামূলক (Sandbox) — আসল টাকা কাটবে না", type: "check" },
        { name: "sslEnabled", label: "ওয়েবসাইটে \"অনলাইনে পেমেন্ট করুন\" বোতাম চালু", type: "check" },
      ],
      values: { cardNote: st.cardNote, payBkash: st.payBkash, payNagad: st.payNagad, payRocket: st.payRocket, payBank: st.payBank, payNote: st.payNote, sslStoreId: g.sslStoreId, sslSandbox: g.sslSandbox, sslEnabled: g.sslEnabled },
      onSave: async (d) => {
        if (d.sslEnabled && (!d.sslStoreId || (!d.sslStorePass && !g.hasPass))) throw new Error("গেটওয়ে চালু করতে Store ID আর Store Password দুটোই দিন");
        await api("/api/admin/settings", { body: { cardNote: d.cardNote, payBkash: d.payBkash, payNagad: d.payNagad, payRocket: d.payRocket, payBank: d.payBank, payNote: d.payNote } });
        await api("/api/admin/payment-config", { body: { sslStoreId: d.sslStoreId, sslStorePass: d.sslStorePass, sslSandbox: d.sslSandbox, sslEnabled: d.sslEnabled } });
        await load(); route(); toast("পেমেন্ট সেটিংস সেভ হয়েছে");
      },
    });
  }
  function onlineAppForm(a) {
    const m = courseById(a.courseId) || {};
    openForm({
      title: `আবেদন ${a.appNo} — ${a.nameEn}`,
      fields: [
        { type: "html", html: `<table class="review" style="width:100%"><tbody>
          <tr><th>মডিউল</th><td>${esc(m.code ? "Module " + m.code + " — " : "")}${esc(m.name || "—")}</td></tr>
          <tr><th>নাম (ENGLISH)</th><td>${esc(a.nameEn)}</td></tr><tr><th>কলেজ</th><td>${esc(a.college)}</td></tr>
          <tr><th>বিভাগ</th><td>${esc(a.group)}</td></tr><tr><th>এইচএসসি ব্যাচ</th><td>${esc(a.hscBatch || "—")}</td></tr>
          <tr><th>শিক্ষার্থীর মোবাইল</th><td><a href="tel:${esc(a.phone)}">${esc(a.phone)}</a></td></tr>
          <tr><th>অভিভাবকের মোবাইল</th><td><a href="tel:${esc(a.guardianPhone)}">${esc(a.guardianPhone)}</a></td></tr>
          <tr><th>আবেদনের সময়</th><td>${U.date(a.createdAt)}</td></tr>
          <tr><th>ফি</th><td>${a.fee > 0 ? money(a.fee) : "নেই"}</td></tr>
          ${(() => { const s = a.studentId && DB.students.find((x) => x.id === a.studentId); return s ? `<tr><th>শিক্ষার্থী আইডি · PIN</th><td><b>${esc(s.id)}</b> · PIN <b>${esc(s.pin)}</b><br><small>${esc(loginSmsNote(s))} — শিক্ষার্থী প্যানেলে (/student) ঢুকবে</small></td></tr>` : ""; })()}
          ${a.pay ? `<tr><th>পেমেন্ট</th><td>${payChip(a)}${a.pay.sender ? `<br>পাঠিয়েছে: <b>${esc(a.pay.sender)}</b>` : ""}${a.pay.trxId ? `<br>TrxID / রেফারেন্স: <b>${esc(a.pay.trxId)}</b>` : ""}${a.pay.bankTranId ? `<br>গেটওয়ে রসিদ: ${esc(a.pay.bankTranId)}` : ""}${a.pay.paidAt ? `<br>পরিশোধ: ${U.date(a.pay.paidAt)}` : a.pay.at ? `<br>জমা: ${U.date(a.pay.at)}` : ""}</td></tr>` : ""}</tbody></table>
          ${a.pay && a.pay.status === "verifying" ? '<p style="margin:8px 0 0;color:#8a5a00">নিজের বিকাশ / নগদ / রকেট / ব্যাংকের হিসাবে এই TrxID আর টাকা মিলিয়ে নিচে "পরিশোধিত" করুন।</p>' : ""}` },
        { type: "html", html: a.studentId ? "" : '<p style="margin:0;color:var(--muted)">অবস্থা <b>"ভর্তি সম্পন্ন"</b> করে সেভ করলে শিক্ষার্থী আইডি আর PIN নিজে থেকে তৈরি হয়ে মোবাইলে SMS-এ যাবে, মডিউলে ভর্তি হবে আর টাকা পেয়ে থাকলে তার হিসাবও উঠবে।</p>' },
        { name: "status", label: "অবস্থা", type: "select", options: APP_STATUS },
        ...(a.fee > 0 ? [{ name: "payStatus", label: "পেমেন্টের অবস্থা", type: "select", options: PAY_STATUS }] : []),
        { name: "note", label: "শিক্ষার্থীর জন্য বার্তা (মোবাইল দিয়ে অবস্থা দেখলে দেখাবে)", type: "textarea", wide: true, rows: 2 },
      ],
      values: { ...a, payStatus: ["initiated", "failed", "cancelled"].includes(payOf(a)) ? "unpaid" : payOf(a) },
      onSave: async (d) => {
        await save("onlineApps", { status: d.status, note: d.note }, a.id);
        if (d.payStatus && d.payStatus !== payOf(a)) await api(`/api/admin/online-apps/${encodeURIComponent(a.id)}/pay`, { body: { status: d.payStatus } });
        await load(); route(); toast("সেভ হয়েছে");
      },
    });
  }
  function onlineApps(c) {
    c.innerHTML = `<div class="card">
      <div class="toolbar">
        <select id="oas">${opt([["", "সব আবেদন"], ...APP_STATUS], "pending")}</select>
        <input class="grow" id="oaq" placeholder="নাম, মোবাইল, কলেজ বা আবেদন নম্বর">
        <button class="btn line" id="paySet">পেমেন্ট সেটিংস</button>
        <a class="btn line" href="/online-apply" target="_blank">→ অনলাইন ভর্তি ফর্ম</a>
        <button class="btn line" id="oacsv">↓ Excel</button>
      </div>
      <div class="tbl-wrap"><table><thead><tr><th>আবেদন</th><th>শিক্ষার্থী</th><th>মডিউল</th><th>বিভাগ</th><th>এইচএসসি ব্যাচ</th><th>মোবাইল</th><th>পেমেন্ট</th><th>অবস্থা</th><th></th></tr></thead><tbody id="oarows"></tbody></table></div></div>`;
    const list = () => {
      const st = $("#oas").value, q = $("#oaq").value.trim().toLowerCase();
      return (DB.onlineApps || []).filter((a) => (!st || a.status === st) && (!q || [a.appNo, a.nameEn, a.phone, a.guardianPhone, a.college].join(" ").toLowerCase().includes(q)))
        .sort((x, y) => (y.createdAt || "").localeCompare(x.createdAt || ""));
    };
    const draw = () => {
      $("#oarows").innerHTML = list().map((a) => `<tr>
        <td><b>${esc(a.appNo)}</b><small>${U.date(a.createdAt)}</small></td>
        <td><a href="#" data-oview="${a.id}"><b>${esc(a.nameEn)}</b></a><small>${esc(a.college)}</small>${a.studentId ? `<small>আইডি: <b>${esc(a.studentId)}</b></small>` : ""}</td>
        <td>${esc((courseById(a.courseId) || {}).name || "—")}</td>
        <td>${esc(a.group)}</td>
        <td>${esc(a.hscBatch || "—")}</td>
        <td><a href="tel:${esc(a.phone)}">${esc(a.phone)}</a><small>অভি: <a href="tel:${esc(a.guardianPhone)}">${esc(a.guardianPhone)}</a></small></td>
        <td>${payChip(a)}</td>
        <td>${appChip(a.status)}${a.note ? `<small>${esc(a.note)}</small>` : ""}</td>
        <td class="num" style="white-space:nowrap"><button class="btn sm gold" data-oview="${a.id}">✎ অবস্থা</button> <button class="icon-btn" title="মুছুন" data-odel="${a.id}">✕</button></td></tr>`).join("")
        || `<tr><td colspan="9" class="empty">এই তালিকায় কোনো আবেদন নেই। আবেদন আসবে ওয়েবসাইটের অনলাইন মডিউলের "কোর্সটি কিনুন" থেকে।</td></tr>`;
    };
    draw();
    $("#oas").onchange = draw; $("#oaq").oninput = draw;
    $("#paySet").onclick = () => paySettingsForm().catch((e) => toast(e.message, true));
    $("#oarows").onclick = (e) => {
      const t = e.target.closest("[data-oview],[data-odel]"); if (!t) return; e.preventDefault();
      if (t.dataset.oview) onlineAppForm(DB.onlineApps.find((a) => a.id === t.dataset.oview));
      if (t.dataset.odel) remove("onlineApps", t.dataset.odel, "এই আবেদন");
    };
    $("#oacsv").onclick = () => U.xlsx(`online-admissions-${U.today()}.xlsx`, ["আবেদন নং", "তারিখ", "নাম (ENGLISH)", "কলেজ", "বিভাগ", "এইচএসসি ব্যাচ", "শিক্ষার্থীর মোবাইল", "অভিভাবকের মোবাইল", "মডিউল", "ফি", "পেমেন্ট", "মাধ্যম", "TrxID / রেফারেন্স", "অবস্থা", "নোট"],
      list().map((a) => [a.appNo, (a.createdAt || "").slice(0, 10), a.nameEn, a.college, a.group, a.hscBatch, a.phone, a.guardianPhone, (courseById(a.courseId) || {}).name, a.fee, PAY_LABEL[payOf(a)], a.pay ? PAY_VIA[a.pay.method] : "", a.pay ? a.pay.trxId || a.pay.bankTranId || "" : "", (APP_STATUS.find((x) => x[0] === a.status) || [])[1], a.note]));
  }
  function applications(c) {
    c.innerHTML = `<div class="card">
      <div class="toolbar">
        <select id="as">${opt([["", "সব আবেদন"], ...APP_STATUS], "pending")}</select>
        <input class="grow" id="aq" placeholder="নাম, মোবাইল বা আবেদন নম্বর">
        <a class="btn line" href="/apply" target="_blank">→ ভর্তি ফর্ম দেখুন</a>
        <button class="btn line" id="acsv">↓ Excel</button>
      </div>
      <div class="tbl-wrap"><table><thead><tr><th>আবেদন</th><th>শিক্ষার্থী</th><th>মডিউল</th><th>সেশন / ব্যাচ</th><th>মোবাইল</th><th>অবস্থা</th><th></th></tr></thead><tbody id="arows"></tbody></table></div></div>`;
    const list = () => {
      const st = $("#as").value, q = $("#aq").value.trim().toLowerCase();
      return DB.applications.filter((a) => (!st || a.status === st) && (!q || [a.appNo, a.name, a.phone, a.guardianPhone].join(" ").toLowerCase().includes(q)))
        .sort((x, y) => (y.createdAt || "").localeCompare(x.createdAt || ""));
    };
    const draw = () => {
      $("#arows").innerHTML = list().map((a) => `<tr>
        <td><b>${esc(a.appNo)}</b><small>${U.date(a.createdAt)}</small></td>
        <td>${avatar(a.photo, "a", a.id, a.name, 36, a.gender)} <a href="#" data-view="${a.id}"><b>${esc(a.name)}</b></a><small>${esc(a.college)}</small></td>
        <td>${esc((courseById(a.courseId) || {}).name || "—")}${a.chapters && a.chapters.length ? `<small>অধ্যায় ${esc(a.chapters.join(", "))}</small>` : ""}</td>
        <td>${esc(a.session || "—")}<small>${esc(batchName(a.batchId))}</small></td><td><a href="tel:${esc(a.phone)}">${esc(a.phone)}</a><small>অভি: ${esc(a.guardianPhone || "—")}</small></td>
        <td>${appChip(a.status)}</td>
        <td class="num" style="white-space:nowrap">${a.status !== "approved" ? `<button class="btn sm gold" data-approve="${a.id}">ভর্তি করুন</button> ` : ""}<button class="icon-btn" title="বিস্তারিত" data-view="${a.id}">দেখুন</button><button class="icon-btn" title="মুছুন" data-del="${a.id}">✕</button></td></tr>`).join("")
        || `<tr><td colspan="7" class="empty">এই তালিকায় কোনো আবেদন নেই। আবেদন আসবে ওয়েবসাইটের <a href="/apply" target="_blank">অনলাইন ভর্তি</a> পেজ থেকে।</td></tr>`;
    };
    draw();
    $("#as").onchange = draw; $("#aq").oninput = draw;
    $("#arows").onclick = (e) => {
      const t = e.target.closest("[data-view],[data-approve],[data-del]"); if (!t) return; e.preventDefault();
      if (t.dataset.view) viewApplication(t.dataset.view);
      if (t.dataset.approve) approveForm(DB.applications.find((a) => a.id === t.dataset.approve));
      if (t.dataset.del) remove("applications", t.dataset.del, "এই আবেদন");
    };
    $("#acsv").onclick = () => U.xlsx(`applications-${U.today()}.xlsx`, ["আবেদন নং", "তারিখ", "নাম", "মোবাইল", "অভিভাবকের মোবাইল", "মডিউল", "অধ্যায়", "সেশন", "ব্যাচ", "কলেজ", "SSC GPA", "অবস্থা", "আইডি"],
      list().map((a) => [a.appNo, (a.createdAt || "").slice(0, 10), a.name, a.phone, a.guardianPhone, (courseById(a.courseId) || {}).name, (a.chapters || []).join(", "), a.session, batchName(a.batchId), a.college, a.sscGpa, (APP_STATUS.find((x) => x[0] === a.status) || [])[1], a.studentId]));
  }

  // ---------- ভর্তি ফর্ম (পূর্ণ পেজ) ----------
  const GROUPS = [["", "বেছে নিন"], ["বিজ্ঞান", "বিজ্ঞান"], ["মানবিক", "মানবিক"], ["ব্যবসায় শিক্ষা", "ব্যবসায় শিক্ষা"], ["অন্যান্য", "অন্যান্য"]];
  const BOARDS = ["", "ঢাকা", "রাজশাহী", "চট্টগ্রাম", "যশোর", "কুমিল্লা", "সিলেট", "বরিশাল", "দিনাজপুর", "ময়মনসিংহ", "মাদ্রাসা", "কারিগরি"].map((b) => [b, b || "বেছে নিন"]);
  const METHODS = [["নগদ", "নগদ (Cash)"], ["বিকাশ", "বিকাশ"], ["নগদ (মোবাইল)", "নগদ (মোবাইল)"], ["রকেট", "রকেট"], ["ব্যাংক", "ব্যাংক"]];
  // remind: খালি থাকলে সেভের আগে মনে করিয়ে দেয়
  const personSections = () => [
    // PDF-এর মতো: নাম (ENGLISH) · নাম (বাংলা) / জন্ম তারিখ · লিঙ্গ · রক্তের গ্রুপ · ধর্ম / জাতীয়তা · মোবাইল-১ · মোবাইল-২ · হোয়াটসঅ্যাপ
    ["১. শিক্ষার্থীর তথ্য", [
      { name: "nameEn", label: "নাম (ENGLISH)", placeholder: "SSC সার্টিফিকেট অনুযায়ী", span: 2 },
      { name: "name", label: "নাম (বাংলা)", required: true, span: 2 },
      { name: "dob", label: "জন্ম তারিখ", type: "date" },
      { name: "gender", label: "লিঙ্গ", type: "select", options: [["", "বেছে নিন"], ["M", "ছেলে (Male)"], ["F", "মেয়ে (Female)"], ["O", "অন্যান্য (Other)"]] },
      { name: "bloodGroup", label: "রক্তের গ্রুপ", type: "select", options: [["", "বেছে নিন"], ...U.BLOOD_GROUPS.map((x) => [x, x])] },
      { name: "religion", label: "ধর্ম", type: "select", options: [["", "বেছে নিন"], ...U.RELIGIONS.map((x) => [x, x])] },
      { name: "nationality", label: "জাতীয়তা", value: "বাংলাদেশী" },
      { name: "phone", label: "শিক্ষার্থীর মোবাইল নাম্বার-১", type: "tel", placeholder: "01XXXXXXXXX", remind: true },
      { name: "phone2", label: "শিক্ষার্থীর মোবাইল নাম্বার-২", type: "tel", placeholder: "01XXXXXXXXX" },
      { name: "whatsapp", label: "শিক্ষার্থীর হোয়াটসঅ্যাপ", type: "tel", placeholder: "01XXXXXXXXX" },
    ], "g4"],
    // ছবির মতো ৩ × ৩: নাম · পেশা · মোবাইল
    ["৪. শিক্ষার্থীর অভিভাবক ও পারিবারিক তথ্য", [
      { name: "fatherName", label: "বাবার নাম", remind: true },
      { name: "fatherOccupation", label: "বাবার পেশা", combo: "OCCUPATIONS" },
      { name: "fatherPhone", label: "বাবার মোবাইল নাম্বার", type: "tel", placeholder: "01XXXXXXXXX" },
      { name: "motherName", label: "মায়ের নাম" },
      { name: "motherOccupation", label: "মায়ের পেশা", combo: "OCCUPATIONS" },
      { name: "motherPhone", label: "মায়ের মোবাইল নাম্বার", type: "tel", placeholder: "01XXXXXXXXX" },
      { name: "guardianName", label: "অভিভাবকের নাম" },
      { name: "guardianOccupation", label: "অভিভাবকের পেশা", combo: "OCCUPATIONS" },
      { name: "guardianPhone", label: "অভিভাবকের নাম্বার", type: "tel", placeholder: "01XXXXXXXXX", remind: true },
      { name: "guardianRelation", label: "অভিভাবকের সাথে সম্পর্ক", combo: "RELATIONS" },
      { name: "address", label: "বর্তমান ঠিকানা", type: "address", remind: true, span: 2 },
      { name: "permanentAddress", type: "none" },
      { name: "sameAddress", type: "none" },
    ]],
    ["৫. শিক্ষাগত যোগ্যতা", [
      { name: "sscExam", label: "পরীক্ষা", combo: "EXAMS", value: "SSC" },
      { name: "sscSchool", label: "প্রতিষ্ঠান", placeholder: "স্কুল / মাদ্রাসার নাম" },
      { name: "sscBoard", label: "বোর্ড", type: "select", options: BOARDS },
      { name: "sscGroup", label: "গ্রুপ", type: "select", options: GROUPS },
      { name: "sscYear", label: "সাল", placeholder: "যেমন: 2025" },
      { name: "sscGpa", label: "GPA", placeholder: "যেমন: 5.00" },
    ]],
    ["৬. একাডেমিক তথ্য", [
      { name: "college", label: "কলেজ", remind: true, span: 2 },
      { name: "collegeRoll", label: "কলেজ রোল" },
      { name: "klass", label: "শ্রেণি", type: "select", options: [["", "বেছে নিন"], ...["একাদশ", "দ্বাদশ", "সেকেন্ড টাইমার"].map((x) => [x, x])] },
      { name: "group", label: "বিভাগ", type: "select", options: GROUPS },
      // সম্ভারুণের নিয়ম: বিভাগ অনুযায়ী বিষয়-০১/০২/০৩ আর ৪র্থ বিষয়; নিচে আবশ্যিক + পত্রসহ পুরো তালিকা
      { name: "subject1", label: "বিষয়-০১", type: "select", options: [["", "বিষয় নির্বাচন করুন"]] },
      { name: "subject2", label: "বিষয়-০২", type: "select", options: [["", "বিষয় নির্বাচন করুন"]] },
      { name: "subject3", label: "বিষয়-০৩", type: "select", options: [["", "বিষয় নির্বাচন করুন"]] },
      { name: "subject4", label: "৪র্থ বিষয়", type: "select", options: [["", "৪র্থ বিষয় নির্বাচন করুন"]] },
      { type: "html", html: '<div class="subj-sum" id="subjSum"></div>' },
    ], "g4"],
    ["৭. ভর্তির উৎস ও রেফারেন্স তথ্য", [
      { name: "source", label: "আমাদের ব্যাপারে কিভাবে জেনেছো?", combo: "SOURCES", span: 2 },
      { name: "refName", label: "রেফারেন্সকারীর নাম", span: 2 },
      { name: "refPhone", label: "রেফারেন্সকারীর মোবাইল নাম্বার", type: "tel", placeholder: "01XXXXXXXXX", span: 2 },
      { name: "refOccupation", label: "রেফারেন্সকারীর পেশা", combo: "OCCUPATIONS", span: 2 },
    ], "g4"],
    // সক্রিয় / নিষ্ক্রিয় এখানে না — শিক্ষার্থীর মূল তালিকা থেকে বদলানো হয়
  ];
  let admissionPrefill = null;
  function newAdmissionHref(filters) {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    return params.size ? "#admission/new?" + params : "#admission";
  }
  function studentForm(s, prefill) {
    if (modal.open) closeModal();
    admissionPrefill = prefill || null;
    const h = s ? `admission/edit/${s.id}` : "admission";
    if (location.hash === "#" + h) route(); else location.hash = h;
  }
  function admission(c, arg) {
    // মোড: new (নতুন ভর্তি) · edit/<id> (তথ্য বদল) · app/<id> (অনলাইন আবেদন থেকে) · enroll/<id> (আগের শিক্ষার্থী নতুন মডিউলে)
    const mode = arg.startsWith("edit/") ? "edit" : arg.startsWith("app/") ? "app" : arg.startsWith("enroll/") ? "enroll" : "new";
    const s = mode === "edit" || mode === "enroll" ? studentById(arg.split("/")[1]) : null;
    const a = mode === "app" ? DB.applications.find((x) => x.id === arg.slice(4) && x.status !== "approved") : null;
    if ((mode === "edit" || mode === "enroll") && !s) { c.innerHTML = '<div class="card"><p class="empty">শিক্ষার্থী পাওয়া যায়নি। <a href="#students">তালিকায় ফিরুন</a></p></div>'; return; }
    const replaceId = mode === "enroll" ? arg.split("/")[2] : "";
    const currentModules = s ? enrollmentsOf(s.id).filter(e => e.status === "active") : [];
    const replacing = replaceId && currentModules.find(e => e.id === replaceId);
    if (replaceId && !replacing) {
      c.innerHTML = `<div class="card"><p>সক্রিয় মডিউল পাওয়া যায়নি। <a href="#admission/edit/${esc(s.id)}">শিক্ষার্থীর Edit ফর্মে ফিরুন</a></p></div>`;
      return;
    }
    if (mode === "app" && !a) { c.innerHTML = '<div class="card"><p class="empty">আবেদনটি পাওয়া যায়নি বা আগেই ভর্তি হয়েছে। <a href="#applications">আবেদনের তালিকা</a></p></div>'; return; }
    const prefill = admissionPrefill; admissionPrefill = null;
    const showPerson = mode !== "enroll", showModule = mode !== "edit";
    const sections = showPerson ? personSections() : [];
    const fields = sections.flatMap(([, f]) => f);
    let vals = s || {};
    if (a) vals = { ...a, guardianName: a.guardianName || a.fatherName, note: `অনলাইন আবেদন ${a.appNo}`, status: "active" };
    else if (prefill) vals = prefill;
    fields.forEach((f) => { if (f.type === "address") f.values = vals; });
    let photoData = "", photoGone = false, reminded = false;
    let pick = { courseId: a ? a.courseId : "", chapters: a ? [...(a.chapters || [])] : [] };
    const oldPhoto = s && s.photo ? photoUrl("s", s.id) : a && a.photo ? photoUrl("a", a.id) : "";
    const listFilters = new URLSearchParams(arg.startsWith("new?") ? arg.slice(4) : "");
    const listBatch = batchById(listFilters.get("batch"));
    const listSession = liveSessions().find(session => session.name === listFilters.get("session"));
    const firstSession = vals.session || listBatch?.session || listSession?.name || liveSessions()[0]?.name || "";
    $("#pageTitle").textContent = mode === "edit" ? "শিক্ষার্থীর তথ্য বদলান" : mode === "enroll" ? "নতুন মডিউলে ভর্তি" : "ভর্তি ফর্ম";

    const head = {
      new: ["নতুন শিক্ষার্থী ভর্তি", "ভর্তি ফর্ম", "শুধু নাম, ক্লাস ব্যাচ আর মডিউল দিলেই ভর্তি নেওয়া যাবে — বাকি তথ্য পরেও দেওয়া যাবে। সেভ করলে আইডি আর PIN তৈরি হয়ে মোবাইলে SMS-এ চলে যাবে।"],
      app: [`অনলাইন আবেদন ${a ? a.appNo : ""} থেকে ভর্তি`, "ভর্তি ফর্ম", "আবেদনের তথ্য বসানো আছে — দেখে, দরকার হলে বদলে সেভ করুন।"],
      edit: ["তথ্য সম্পাদনা", s ? `${s.name} — ${s.id}` : "", "তথ্য বদলে সেভ করুন। মডিউল বদলানোর অপশন নিচে আছে।"],
      enroll: ["আগের শিক্ষার্থী", s ? `${s.name} — ${s.id}` : "", replacing ? `মডিউল বদলান। সেভ করলে ${courseById(replacing.courseId)?.name || "পুরোনো মডিউল"} শেষ হবে এবং নতুনটি চালু হবে। আগের ফি ও পেমেন্টের হিসাব থাকবে।` : "এই শিক্ষার্থীকে আরেকটি মডিউলে ভর্তি করুন। আইডি একই থাকবে।"],
    }[mode];

    const moduleCards = DB.courses.filter(m => !replacing || (m.active !== false && !currentModules.some(e => e.courseId === m.id))).map((m) => `<label class="mod-card${m.active === false ? " off" : ""}"><input type="radio" name="courseId" value="${m.id}"${pick.courseId === m.id ? " checked" : ""}><span class="code">${esc(m.code || m.icon || "")}</span><span><b>${esc(m.name)}</b><small>${feeText(m)}</small></span></label>`).join("");

    c.innerHTML = `
      <div class="card adm-head">
        <div><span class="eyebrow-s">${esc(head[0])}</span><h2>${esc(head[1])}</h2><p>${esc(head[2])}</p></div>
        <div class="toolbar" style="margin:0">${mode === "new" ? '<button type="button" class="btn gold" id="admExcelImport">Excel থেকে ভর্তি</button><button type="button" class="btn line" id="admClean">✕ Clean</button>' : `<a class="btn line" href="#${mode === "edit" && editBack ? editBack : mode === "app" ? "applications" : "students"}">← ফিরে যান</a>`}${s ? '<button type="button" class="btn gold" id="admPrintNow">ভর্তি ফর্ম প্রিন্ট</button>' : ""}<button type="button" class="btn line" id="admBlank">খালি ফর্ম</button></div>
      </div>
      <form class="card adm-form" id="admForm" novalidate>
        ${showPerson ? `<div class="adm-top">
          <div class="adm-photo">
            <div class="pv" id="admPv" style="background-image:url('${oldPhoto || U.avatarSrc(vals.gender)}')"></div>
            <label class="btn sm line">ছবি দিন<input type="file" accept="image/*" id="admPhoto" hidden></label>
            <button type="button" class="btn sm line" id="admPhotoDel"${oldPhoto ? "" : " hidden"}>সরান</button>
            <small>পাসপোর্ট সাইজ ছবি</small>
          </div>
          <div class="adm-info" id="admInfo"></div>
        </div>` : `<div class="adm-top"><div>${avatar(s.photo, "s", s.id, s.name, 70, s.gender)}</div><div class="adm-info"><b>${esc(s.name)}</b><span>${esc(s.id)} · ${esc(s.session || "")} · ${esc(batchName(s.batchId))}</span><span>এখন ভর্তি আছে: ${esc(modulesOf(s.id).join(", ") || "—")}</span></div></div>`}
        ${sections.slice(0, 1).map(([title, fl, g]) => `<section class="adm-sec"><h3>${title}</h3><div class="fgrid adm-grid ${g || ""}">${fl.map((f) => field(f, vals[f.name])).join("")}</div></section>`).join("")}
        ${mode !== "enroll" ? `<section class="adm-sec"><h3>২. একাডেমিক সেশন ও ক্লাসের সময়সূচি</h3><div class="fgrid adm-grid">
          <label>এইচএসসি/আলিম *<select name="session" id="sessionSel">${opt(sessionOptions(), firstSession)}</select></label>
          <label>ক্লাসের দিন ও সময় (ব্যাচ) *<span id="batchWrap">${batchSelectHtml("batchId", vals.batchId || listBatch?.id || "", "ব্যাচ বেছে নিন", firstSession, true)}</span></label>
          <label>ভর্তির তারিখ<input type="date" name="admissionDate" value="${esc(vals.admissionDate || U.today())}"></label>
        </div></section>` : ""}
        ${mode === "edit" ? `<section class="adm-sec">
          <div class="adm-module-head"><div><h3>৩. মডিউল</h3><p>এই শিক্ষার্থীর চালু মডিউল</p></div>
            <a class="btn line" href="#admission/enroll/${esc(s.id)}">＋ নতুন মডিউলে ভর্তি</a></div>
          <div class="adm-module-list">${currentModules.map(e => {
            const course = courseById(e.courseId);
            return `<div class="adm-module-item">
              <div><span class="chip ok">সক্রিয়</span><strong>${esc(course?.name || "মডিউল")}</strong>${e.startDate ? `<small>শুরু ${esc(U.date(e.startDate))}</small>` : ""}</div>
              <a class="btn gold" href="#admission/enroll/${esc(s.id)}/${esc(e.id)}">মডিউল বদলান →</a></div>`;
          }).join("") || '<p class="empty">কোনো সক্রিয় মডিউল নেই।</p>'}</div></section>` : ""}
        ${showModule ? `<section class="adm-sec"><h3>${mode === "enroll" ? "মডিউল ও ফি" : "৩. মডিউল ও ফি"}</h3>
          <div class="mod-cards">${moduleCards}</div>
          <div id="chapterBox" class="chapter-box" hidden></div>
          <div class="fgrid adm-grid" style="margin-top:14px">
            <label>কোর্স শুরুর তারিখ${mode !== "enroll" ? ' <small>(ভর্তির তারিখ অনুযায়ী)</small>' : ""}<input type="date" name="startDate" value="${esc(mode === "enroll" ? U.today() : vals.admissionDate || U.today())}"${mode !== "enroll" || replacing ? " readonly" : ""}></label>
            <label>কোর্স শেষ হওয়ার তারিখ <small style="color:var(--muted);font-weight:400">(ঐচ্ছিক)</small><input type="date" name="planEnd"></label>
            <label>ডিসকাউন্ট (৳)<input type="number" name="discount" min="0" value="0"></label>
            <label>এখন জমা (৳)<input type="number" name="paid" min="0" value="0"></label>
            <label>পেমেন্ট পদ্ধতি<select name="method">${opt(METHODS, "নগদ")}</select></label>
          </div>
          <div class="fee-sum" id="feeSum"></div>
        </section>` : ""}
        ${sections.slice(1).map(([title, fl, g]) => `<section class="adm-sec"><h3>${title}</h3><div class="fgrid adm-grid ${g || ""}">${fl.map((f) => field(f, vals[f.name])).join("")}</div></section>`).join("")}
        <div class="adm-remind" id="admRemind" hidden></div>
        <div class="adm-actions">
          <span class="err" id="admErr"></span>
          <button type="submit" class="btn gold" data-print="0">${mode === "edit" ? "সেভ করুন" : "✓ সেভ (ভর্তি করুন)"}</button>
          ${mode !== "enroll" ? '<button type="submit" class="btn" data-print="1">সেভ ও প্রিন্ট</button>' : ""}
        </div>
      </form>`;

    const form = $("#admForm"), q = (n) => form.querySelector(`[name="${n}"]`);
    $$("[data-combo]", form).forEach((el) => U.combo(el, () => U.optList(el.dataset.combo)));
    U.combo(q("college"), U.MADARIPUR_INSTITUTIONS || []);
    const previousExam = q("sscExam"), previousGroup = q("sscGroup");
    if (previousExam && previousGroup) {
      const dakhilGroups = ["সাধারণ", "বিজ্ঞান", "মুজাবিদ", "হিফজুল কুরআন"];
      const updatePreviousGroups = (keepSaved) => {
        const isDakhil = /^(দাখিল|dakhil)$/i.test(previousExam.value.trim());
        const current = keepSaved ? vals.sscGroup || previousGroup.value : previousGroup.value;
        const options = isDakhil ? [["", "বেছে নিন"], ...dakhilGroups.map(group => [group, group])] : [...GROUPS];
        if (keepSaved && current && !options.some(([value]) => value === current)) options.push([current, current]);
        previousGroup.replaceChildren(...options.map(([value, label]) => new Option(label, value)));
        previousGroup.value = options.some(([value]) => value === current) ? current : "";
      };
      previousExam.addEventListener("change", () => updatePreviousGroups(false));
      updatePreviousGroups(true);
    }
    const curBatch = () => (q("batchId") ? batchById(q("batchId").value) : s ? batchById(s.batchId) : null);
    const info = () => {
      if (!$("#admInfo") || !showPerson) return;
      const b = curBatch();
      const n = b ? activeStudents().filter((x) => x.batchId === b.id && (!s || x.id !== s.id)).length : 0;
      $("#admInfo").innerHTML = b ? `<b>ক্লাস ব্যাচ ${esc(b.name)} · ${esc(b.session)}</b><span>${esc(b.days || "দিন ঠিক হয়নি")} · ${esc(b.time || "")}</span><span>সিট: ${bn(n)} / ${bn(b.capacity)} ভর্তি ${n >= b.capacity ? '<span class="chip bad">পূর্ণ</span>' : ""}</span>`
        : '<span>সেশন আর ক্লাস ব্যাচ বেছে নিলে দিন, সময় আর সিটের তথ্য এখানে দেখাবে।</span>';
    };
    // মডিউল ও ফি হিসাব: ফি → ডিসকাউন্ট বাদে → জমা → বকেয়া
    const calc = () => {
      if (!showModule) return { fee: 0 };
      const m = courseById(pick.courseId);
      const fee = !m ? 0 : m.feeType === "chapter" ? (m.chapters || []).filter((x) => pick.chapters.includes(x.id)).reduce((t, x) => t + x.fee, 0) : m.fee;
      const discount = Math.min(Math.max(0, Number(q("discount").value || 0)), fee);
      const paid = Math.max(0, Number(q("paid").value || 0));
      let net = fee - discount;
      // রেগুলার (মাসিক) ব্যাচ: ভর্তির মাসে যত ক্লাস পাবে সেই হিসাবে ফি (১–৬ তারিখে ভর্তি হলে পুরো মাস; "টাকা কমবে" এমন বন্ধের ক্লাস বাদ)
      let first = net, fm = null, grace = false;
      if (m && m.feeType === "monthly") {
        const b = curBatch(), sd = (mode === "enroll" ? q("startDate")?.value : q("admissionDate")?.value) || U.today(), st = new Date(sd + "T00:00:00");
        grace = st.getDate() <= U.FULL_FEE_UNTIL_DAY;
        const monthNet = U.monthlyFeeFor(m, { fee, discount }, sd.slice(0, 7)); net = monthNet;
        fm = b ? U.monthFee(monthNet, b.days, st.getFullYear(), st.getMonth(), grace ? 1 : st.getDate(), U.feeClosedDates(DB.closures, b.id)) : null;
        first = fm ? fm.fee : monthNet;
      }
      return { m, fee, discount, paid, net, first, fm, grace, due: Math.max(0, first - paid), extra: Math.max(0, paid - first) };
    };
    const drawFee = () => {
      if (!showModule) return;
      const m = courseById(pick.courseId);
      const box = $("#chapterBox");
      if (m && m.feeType === "chapter") {
        box.hidden = false;
        box.innerHTML = `<b>কোন কোন অধ্যায়?</b><div class="ch-list">${(m.chapters || []).map((x) => `<label class="ch"><input type="checkbox" value="${esc(x.id)}"${pick.chapters.includes(x.id) ? " checked" : ""}><span>${esc(x.name)}</span><em>${money(x.fee)}</em></label>`).join("")}</div>`;
      } else { box.hidden = true; box.innerHTML = ""; }
      const k = calc();
      const monthly = k.m && k.m.feeType === "monthly";
      $("#feeSum").innerHTML = k.m ? `
        <div><small>${monthly ? "মাসিক ফি" : k.m.feeType === "chapter" ? `অধ্যায়ের ফি (${bn(pick.chapters.length)}টি)` : "কোর্স ফি (এককালীন)"}</small><b>${money(k.fee)}</b></div>
        <div><small>${monthly ? "এই মাসের ফি" : "ডিসকাউন্ট বাদে"}</small><b>${money(k.first)}</b></div>
        <div><small>জমা</small><b>${money(k.paid)}</b></div>
        <div class="${k.due ? "due" : "ok"}"><small>${k.extra ? "অগ্রিম" : "বকেয়া"}</small><b>${money(k.extra || k.due)}</b></div>
        ${monthly ? `<p>${!k.fm || !k.fm.total
          ? "ব্যাচের ক্লাসের দিন ঠিক না থাকায় এ মাসে পুরো ফি ধরা হয়েছে।"
          : k.fm.got >= k.fm.total
            ? (k.grace ? `মাসের ১–${bn(U.FULL_FEE_UNTIL_DAY)} তারিখের মধ্যে ভর্তি — এ মাসে পুরো ${money(k.net)}।` : `ভর্তির মাসের সব ক্লাস (${bn(k.fm.total)}টি) পাবে — এ মাসে পুরো ${money(k.net)}।`)
            : (() => {
              const fmt = (x) => bn(Number.isInteger(x) ? x : x.toFixed(2));
              return `ভর্তির মাসে এই ব্যাচের মোট <b>${bn(k.fm.total)}টি</b> ক্লাস, ${k.grace ? "" : "শুরুর তারিখ থেকে "}পাবে <b>${bn(k.fm.got)}টি</b>${k.fm.shut ? ` (${bn(k.fm.shut)}টি ব্যাচ বন্ধের জন্য বাদ)` : ""}। `
                + `ক্লাস প্রতি ৳${fmt(k.fm.perClass)}${k.fm.total > U.STD_CLASSES ? ` (এ মাসে ${bn(U.STD_CLASSES)}টির বেশি ক্লাস, তাই ${money(k.net)} ÷ ${bn(k.fm.total)})` : ""} → `
                + `${bn(k.fm.got)} × ${fmt(k.fm.perClass)} = ৳${fmt(Math.round(k.fm.raw * 100) / 100)} → রাউন্ড করে এ মাসে <b>${money(k.first)}</b>${k.fm.raw > k.net ? " (মাসিক ফি-র বেশি ধরা হয় না)" : ""}।`;
            })()} অন্য মাসে মাসভিত্তিক তালিকা অনুযায়ী ফি; তালিকার বাইরে মূল ফি ${money(Math.max(0, k.fee - k.discount))}${(DB.closures || []).some((c) => c.reduceFee) ? " (\"টাকা কমবে\" এমন ব্যাচ বন্ধ থাকলে সেই মাসে কম)" : ""}।</p>` : ""}` : '<p class="muted" style="grid-column:1/-1;margin:0">উপরে একটি মডিউল বেছে নিন।</p>';
    };
    info(); drawFee();
    const sessionSel = q("session");
    if (sessionSel) sessionSel.addEventListener("change", () => {
      $("#batchWrap").innerHTML = batchSelectHtml("batchId", "", "ব্যাচ বেছে নিন", sessionSel.value, true);
      q("batchId").addEventListener("change", info); info();
    });
    if (q("batchId")) q("batchId").addEventListener("change", info);
    form.addEventListener("change", (e) => {
      if (e.target.name === "admissionDate" && q("startDate") && mode !== "enroll") q("startDate").value = e.target.value;
      if (e.target.name === "courseId") { pick.courseId = e.target.value; pick.chapters = []; drawFee(); }
      if (e.target.closest && e.target.closest("#chapterBox")) { pick.chapters = $$("#chapterBox input:checked").map((x) => x.value); drawFee(); }
      if (["batchId", "session", "startDate", "admissionDate"].includes(e.target.name)) drawFee(); // ব্যাচের দিন / শুরুর তারিখ বদলালে প্রথম মাসের ফি আবার হিসাব
    });
    form.addEventListener("input", (e) => { $("#admErr").textContent = ""; if (["discount", "paid"].includes(e.target.name)) drawFee(); });
    // সম্পর্ক "বাবা" বা "মা" হলে অভিভাবকের নাম ও নাম্বার নিজে থেকে বসে যায়
    const syncGuardian = () => {
      if (!q("guardianRelation")) return;
      const rel = q("guardianRelation").value.trim();
      const src = /^(বাবা|পিতা|আব্বা)$/.test(rel) ? "father" : /^(মা|মাতা|আম্মা)$/.test(rel) ? "mother" : null;
      const gf = ["Name", "Occupation", "Phone"].filter((k) => q("guardian" + k));
      if (!src) {
        // বাবা/মা থেকে অন্য সম্পর্কে গেলে কপি করা তথ্য মুছে খালি ঘর দেয়
        if (q("guardianName").readOnly) gf.forEach((k) => { const el = q("guardian" + k); el.value = ""; el.readOnly = false; el.classList.remove("auto-copied"); });
        return;
      }
      gf.forEach((k) => { const el = q("guardian" + k); el.value = q(src + k).value; el.readOnly = true; el.classList.add("auto-copied"); });
    };
    ["guardianRelation", "fatherName", "fatherPhone", "fatherOccupation", "motherName", "motherPhone", "motherOccupation"].forEach((n) => {
      const el = q(n);
      if (el) { el.addEventListener("input", syncGuardian); el.addEventListener("change", syncGuardian); }
    });
    syncGuardian(); // এডিটে সম্পর্ক বাবা/মা থাকলে শুরু থেকেই মিলিয়ে রাখে
    // HSC বিষয়: বিভাগ অনুযায়ী বিষয়-০১/০২/০৩ ও ৪র্থ বিষয়ের তালিকা; নিচে আবশ্যিক + পত্রসহ পুরো তালিকা (নম্বর একটানা)
    const setSubjectOptions = (keep) => {
      const g = (Object.entries(U.HSC_SUBJECTS).find(([name]) => name.normalize("NFC") === String(q("group").value).normalize("NFC")) || [])[1] || { main: [], fourth: [] };
      const fill = (name, items, label) => {
        const sel = q(name), cur = keep ? vals[name] || sel.value : sel.value;
        sel.innerHTML = `<option value="">${label}</option>` + items.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
        if (keep && cur && !items.includes(cur)) sel.add(new Option(cur, cur)); // শুধু সেভ করা পুরনো মান হারাবে না; বিভাগ বদলালে বাইরের বিষয় আসবে না
        sel.value = items.includes(cur) || (cur && keep) ? cur : "";
      };
      ["subject1", "subject2", "subject3"].forEach((n) => fill(n, g.main, q("group").value ? "বিষয় নির্বাচন করুন" : "আগে বিভাগ বেছে নিন"));
      fill("subject4", g.fourth, q("group").value ? "৪র্থ বিষয় নির্বাচন করুন" : "আগে বিভাগ বেছে নিন");
      lockSubjects();
    };
    // একই বিষয় দুইবার নেওয়া যাবে না — অন্য ঘরে নেওয়া বিষয় বন্ধ (ধূসর) থাকে
    const SUBJ = ["subject1", "subject2", "subject3", "subject4"];
    const lockSubjects = () => {
      SUBJ.forEach((n) => {
        const taken = SUBJ.filter((m) => m !== n).map((m) => q(m).value).filter(Boolean);
        [...q(n).options].forEach((o) => { o.disabled = !!o.value && taken.includes(o.value); });
      });
    };
    const renderSubjects = () => {
      const box = $("#subjSum"); if (!box) return;
      const c = U.subjectColumns({ subject1: q("subject1").value, subject2: q("subject2").value, subject3: q("subject3").value, subject4: q("subject4").value });
      const list = (items) => (items.length ? `<ol>${items.map((x) => `<li><i>${bn(x.n)}.</i>${esc(x.s)}</li>`).join("")}</ol>` : "<p>এখনও বিষয় নির্বাচন করা হয়নি</p>");
      box.innerHTML = `<div><strong>আবশ্যিক বিষয়সমূহ</strong><small>নিজে থেকে যুক্ত</small>${list(c.fixed)}</div><div><strong>গ্রুপ সাবজেক্টসমূহ</strong>${list(c.main)}</div><div><strong>৪র্থ বিষয়</strong>${list(c.fourth)}</div>`;
    };
    if (q("subject1")) {
      setSubjectOptions(true); renderSubjects();
      q("group").addEventListener("change", () => { setSubjectOptions(false); renderSubjects(); });
      SUBJ.forEach((n) => q(n).addEventListener("change", () => { lockSubjects(); renderSubjects(); }));
    }
    // "বর্তমান ঠিকানাই স্থায়ী ঠিকানা" টিক দিলে স্থায়ী ঠিকানা নিজে থেকে একই থাকে
    const syncAddress = () => {
      const same = q("sameAddress");
      if (!same) return;
      q("permanentAddress").readOnly = same.checked;
      if (same.checked) q("permanentAddress").value = q("address").value;
    };
    if (q("sameAddress")) { q("sameAddress").addEventListener("change", syncAddress); q("address").addEventListener("input", syncAddress); syncAddress(); }
    const ph = $("#admPhoto");
    if (ph) {
      ph.onchange = async (e) => {
        try { photoData = await U.resizeImage(e.target.files[0]); photoGone = false; $("#admPv").style.backgroundImage = `url('${photoData}')`; $("#admPv").textContent = ""; $("#admPhotoDel").hidden = false; }
        catch (er) { toast(er.message, true); }
      };
      // ছবি না থাকলে লিঙ্গ অনুযায়ী আইকন দেখায়
      const showIcon = () => { if (!photoData && (!oldPhoto || photoGone)) $("#admPv").style.backgroundImage = `url('${U.avatarSrc(q("gender") && q("gender").value)}')`; };
      $("#admPhotoDel").onclick = () => { photoData = ""; photoGone = true; showIcon(); $("#admPhotoDel").hidden = true; };
      if (q("gender")) q("gender").addEventListener("change", showIcon);
    }
    const excelImport = $("#admExcelImport"); if (excelImport) excelImport.onclick = () => window.SICAdmissionImport({ DB, opt, openModal, closeModal, load, route });
    const clean = $("#admClean"); if (clean) clean.onclick = () => { if (confirm("ফর্মের সব লেখা মুছে নতুন করে শুরু করবেন?")) route(); };
    const pn = $("#admPrintNow"); if (pn) pn.onclick = () => printStudentForm(s);
    $("#admBlank").onclick = () => U.printHtml("খালি ভর্তি ফর্ম", U.admissionFormHtml({}, { settings: DB.settings }));

    form.onsubmit = async (e) => {
      e.preventDefault();
      const print = e.submitter && e.submitter.dataset.print === "1";
      const err = (msg, el) => { $("#admErr").textContent = msg; if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => el.focus && el.focus(), 300); } };
      const d = {};
      fields.forEach((f) => { if (!f.name) return; const el = q(f.name); if (el) d[f.name] = el.type === "checkbox" ? el.checked : el.value.trim(); });
      if (mode !== "enroll") { d.batchId = q("batchId").value; d.admissionDate = q("admissionDate").value; }
      if (showPerson && !d.name) return err("শিক্ষার্থীর নাম দিন", q("name"));
      if (mode !== "enroll" && !d.batchId) return err("ক্লাস ব্যাচ বেছে নিন", q("batchId"));
      for (const n of ["phone", "phone2", "whatsapp", "fatherPhone", "motherPhone", "guardianPhone", "refPhone"]) if (d[n] && !/^01\d{9}$/.test(d[n].replace(/[০-৯]/g, (x) => "০১২৩৪৫৬৭৮৯".indexOf(x)).replace(/\D/g, "").replace(/^88/, ""))) return err("মোবাইল নম্বর ঠিক নেই (01XXXXXXXXX)", q(n));
      const k = calc();
      if (showModule) {
        if (!k.m) return err("একটি মডিউল বেছে নিন", $(".mod-cards"));
        if (k.m.feeType === "chapter" && !pick.chapters.length) return err("অন্তত একটি অধ্যায় বেছে নিন", $("#chapterBox"));
      }
      // সম্ভারুণের মতো: জরুরি ঘর খালি থাকলে একবার মনে করিয়ে দাও, আবার চাপলে সেভ
      const empty = fields.filter((f) => f.remind && !String(d[f.name] || "").trim());
      if (empty.length && !reminded && mode !== "edit") {
        reminded = true;
        const box = $("#admRemind");
        box.hidden = false;
        box.innerHTML = `<b>কিছু তথ্য এখনো বাকি:</b> ${empty.map((f) => `<button type="button" data-f="${f.name}">○ ${esc(f.label)}</button>`).join("")}<p>পূরণ করুন, অথবা আবার "সেভ" চাপুন — তথ্যগুলো পরে প্রোফাইল থেকে দেওয়া যাবে।</p>`;
        box.onclick = (ev) => { const bt = ev.target.closest("[data-f]"); if (bt) { const el = q(bt.dataset.f); el.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => el.focus(), 300); } };
        box.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      $$(".adm-actions .btn").forEach((b) => (b.disabled = true));
      try {
        let stu, enr, pay;
        const enrollment = { courseId: pick.courseId, chapters: pick.chapters, discount: k.discount, startDate: q("startDate") ? q("startDate").value : "", planEnd: q("planEnd") ? q("planEnd").value : "" };
        const payment = { amount: k.paid, method: q("method") ? q("method").value : "" };
        if (mode === "edit") stu = (await save("students", { ...s, ...d }, s.id)).item;
        else if (mode === "enroll") { const r = await api("/api/admin/enroll", { body: { studentId: s.id, enrollment, payment, replaceId } }); stu = s; enr = r.enrollment; pay = r.payment; }
        else {
          const r = await api("/api/admin/admit", { body: { student: d, enrollment, payment, applicationId: a ? a.id : "", enquiryId: prefill && prefill._enquiryId, leadId: prefill && prefill._leadId } });
          stu = r.student; enr = r.enrollment; pay = r.payment;
        }
        if (showPerson && photoData) await api("/api/admin/student-photo", { body: { id: stu.id, photo: photoData } });
        else if (showPerson && photoGone && (s || a)) await api("/api/admin/student-photo", { body: { id: stu.id, remove: true } });
        await load();
        stu = studentById(stu.id);
        if (enr) enr = DB.enrollments.find((x) => x.id === enr.id);
        if (pay) pay = DB.payments.find((x) => x.id === pay.id);
        if (print) printAdmission(stu, formExtra(stu, enr, pay), enr);
        if (mode === "edit") { toast("সেভ হয়েছে"); location.hash = editBack || "students"; editBack = null; return; }
        if (replacing) { toast("মডিউল বদলানো হয়েছে"); location.hash = `admission/edit/${s.id}`; return; }
        admissionDone(c, stu, enr, pay, mode === "enroll");
      } catch (er) { err(er.message); $$(".adm-actions .btn").forEach((b) => (b.disabled = false)); }
    };
  }
  // সেভ করা শিক্ষার্থীর ভর্তি ফর্ম (প্রথম মডিউলের ফিসহ)
  const printStudentForm = (s) => {
    if (!s) return;
    const enr = enrollmentsOf(s.id).sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""))[0];
    printAdmission(s, formExtra(s, enr, null), enr);
  };
  // আইডি আর PIN SMS-এ গেল কি না
  function loginSmsNote(s) {
    const r = s.loginSms;
    return !r ? "এখনো SMS পাঠানো হয়নি" : r.ok ? `আইডি আর PIN-এর SMS ${r.phone} নম্বরে পাঠানোর জন্য গেটওয়ে গ্রহণ করেছে। ফোনে পৌঁছাতে কিছু সময় লাগতে পারে` : r.status === "unknown" ? `SMS পাঠানোর ফল নিশ্চিত নয়: ${r.error}` : `SMS পাঠানো যায়নি: ${r.error}`;
  }
  const loginSmsSending = new Set();
  async function resendLogin(s, note) { // note না থাকলে শুধু টোস্ট
    if (loginSmsSending.has(s.id)) return;
    loginSmsSending.add(s.id);
    const buttons = $$("#dnSms,#pinSms"), labels = buttons.map(b => b.textContent);
    buttons.forEach(b => { b.disabled = true; b.textContent = "SMS পাঠানো হচ্ছে…"; });
    try { const r = await api("/api/admin/login-sms", { body: { id: s.id } }); s.loginSms = r.loginSms; toast("SMS গেটওয়ে গ্রহণ করেছে; ফোনে পৌঁছানোর অপেক্ষা করুন"); }
    catch (e) { s.loginSms = e.loginSms || { ok: false, status: e.status ? "failed" : "unknown", error: e.message }; toast(e.message, true); }
    finally { loginSmsSending.delete(s.id); buttons.forEach((b, i) => { b.disabled = false; b.textContent = labels[i]; }); }
    if (note) note.textContent = loginSmsNote(s);
  }
  const formExtra = (s, enr, pay) => ({ studentId: s.id, pin: s.pin, appNo: s.appNo, photoUrl: s.photo ? photoUrl("s", s.id) : "", ...(pay ? { receiptNo: pay.receiptNo } : {}) });
  // ভর্তি সম্পন্ন — একই পেজে আইডি, PIN আর ফির হিসাব
  function admissionDone(c, s, enr, pay, enrolled) {
    const m = enr && courseById(enr.courseId);
    $("#pageTitle").textContent = enrolled ? "মডিউলে ভর্তি সম্পন্ন" : "ভর্তি সম্পন্ন";
    c.innerHTML = `<div class="card adm-done">
      <div class="big">✓</div><h2>${enrolled ? "নতুন মডিউলে ভর্তি হয়েছে!" : "ভর্তি সম্পন্ন হয়েছে!"}</h2>
      <p>${esc(s.name)} — ${esc(s.session || "")} · ক্লাস ব্যাচ ${esc(batchName(s.batchId))}</p>
      ${m ? `<p><b>মডিউল ${esc(m.code)} — ${esc(m.name)}</b>${enr.chapters && enr.chapters.length ? `<br><small>${esc(chapterNames(m, enr.chapters).join(" · "))}</small>` : ""}</p>` : ""}
      <div class="adm-ids">
        ${enrolled ? "" : `<div><small>শিক্ষার্থী আইডি</small><b>${esc(s.id)}</b></div><div><small>লগইন PIN</small><b>${esc(s.pin)}</b></div>`}
        ${enr ? `<div class="mny"><small>ফি (ডিসকাউন্ট বাদে)</small><b>${money(enr.fee - enr.discount)}${m && m.feeType === "monthly" ? "<small>/মাস</small>" : ""}</b></div>` : ""}
        <div class="mny"><small>জমা</small><b>${money(pay ? pay.amount : 0)}</b></div>
        <div class="mny ${s.fees.balance > 0 ? "due" : ""}"><small>মোট বকেয়া</small><b>${money(Math.max(0, s.fees.balance))}</b></div>
      </div>
      ${enrolled ? "" : `<p class="muted"><span id="dnSmsNote">${esc(loginSmsNote(s))}</span> — এটা দিয়ে শিক্ষার্থী প্যানেলে লগইন করবে।</p>`}
      <div class="toolbar" style="justify-content:center">
        ${pay ? '<button type="button" class="btn gold" id="dnRec">রসিদ প্রিন্ট</button>' : '<button type="button" class="btn gold" id="dnPay">৳ পেমেন্ট নিন</button>'}
        ${enrolled ? "" : '<button type="button" class="btn line" id="dnSms">আবার SMS পাঠান</button>'}
        <button type="button" class="btn line" id="dnForm">ভর্তি ফর্ম</button>
        <button type="button" class="btn line" id="dnCard">আইডি কার্ড</button>
        <button type="button" class="btn line" id="dnView">প্রোফাইল</button>
        <a class="btn line" href="${esc(newAdmissionHref({ session: s.session, batch: s.batchId }))}" id="dnNew">+ আরেকজন ভর্তি</a>
      </div></div>`;
    const rec = $("#dnRec"); if (rec) rec.onclick = () => printReceipt(pay);
    const dp = $("#dnPay"); if (dp) dp.onclick = () => paymentForm(s.id);
    const dnSms = $("#dnSms"); if (dnSms) dnSms.onclick = () => resendLogin(s, $("#dnSmsNote"));
    $("#dnForm").onclick = () => printAdmission(s, formExtra(s, enr, pay), enr);
    $("#dnCard").onclick = () => printDoc("আইডি কার্ড", idCardHtml(s));
    $("#dnView").onclick = () => viewStudent(s.id);
    $("#dnNew").onclick = (e) => {
      if (e.currentTarget.hash !== location.hash) return;
      e.preventDefault();
      route();
    };
  }

  // ---------- শিক্ষার্থী ----------
  function correctEnrollmentStart(student, enrollmentId) {
    const e = DB.enrollments.find(x => x.id === enrollmentId);
    if (!e) return;
    const first = DB.enrollments.find(x => x.studentId === student.id);
    let preview = null;
    openModal({
      title: "বেতন শুরুর তারিখ সংশোধন",
      body: `<p><b>${esc(student.name)}</b> · ${esc(courseById(e.courseId)?.name || "")}</p>
        <p>ভর্তির তারিখ: <b>${U.date(student.admissionDate)}</b><br>বর্তমানে মডিউল শুরু: <b>${U.date(e.startDate)}</b></p>
        <label>সঠিক শুরুর তারিখ<input id="feeStartDate" type="date" min="${esc(student.admissionDate || "")}" max="${U.today()}" value="${esc(first?.id === e.id ? student.admissionDate : e.startDate)}"></label>
        <div class="toolbar"><button type="button" class="btn gold" id="feeStartPreview">নতুন হিসাব দেখুন</button></div><div id="feeStartResult" aria-live="polite"></div>`,
      saveText: "তারিখ ও হিসাব সংরক্ষণ",
      onSave: async () => {
        if (!preview || preview.proposed.startDate !== $("#feeStartDate").value) throw new Error("আগে নতুন হিসাব দেখুন");
        await api("/api/admin/enrollment-start", { body: { id: e.id, startDate: preview.proposed.startDate, token: preview.token, commit: true } });
        await load(); viewStudent(student.id); toast("শুরুর তারিখ ও বেতন সংশোধন হয়েছে"); return true;
      },
    });
    $("#modalSave").disabled = true;
    $("#feeStartDate").oninput = () => { preview = null; $("#modalSave").disabled = true; $("#feeStartResult").textContent = ""; };
    $("#feeStartPreview").onclick = async () => {
      const button = $("#feeStartPreview"), dateInput = $("#feeStartDate"); button.disabled = true; $("#modalErr").textContent = "";
      preview = null; $("#modalSave").disabled = true;
      try {
        const result = await api("/api/admin/enrollment-start", { body: { id: e.id, startDate: dateInput.value } });
        if ($("#feeStartDate") !== dateInput || result.proposed.startDate !== dateInput.value) return;
        preview = result;
        $("#feeStartResult").innerHTML = `<dl class="kv"><dt>আগের মোট দেনা</dt><dd>${money(result.current.due)}</dd><dt>প্রথম মাসের ফি</dt><dd>${money(result.proposed.firstMonth)}</dd><dt>নতুন মোট দেনা (${bn(result.proposed.months)} মাস)</dt><dd><b>${money(result.proposed.due)}</b></dd><dt>সব জমা বাদে মোট বাকি</dt><dd><b>${money(result.proposed.balance)}</b></dd></dl><p class="muted">আগের পেমেন্ট অপরিবর্তিত থাকবে। সংরক্ষণের আগে ব্যাকআপ রাখা হবে।</p>`;
        $("#modalSave").disabled = false;
      } catch (error) { if ($("#feeStartDate") === dateInput) $("#modalErr").textContent = error.message; }
      finally { button.disabled = false; }
    };
  }
  function reviewProfileChanges(id) {
    const student = studentById(id), pending = student?.pendingProfile;
    if (!pending) return toast("সংশোধনের অনুরোধ নেই", true);
    const value = v => typeof v === "boolean" ? v ? "হ্যাঁ" : "না" : String(v || "—");
    let busy = false;
    const decide = async action => {
      if (busy) return true;
      busy = true; $("#modalSave").disabled = true; $("#rejectProfileChanges").disabled = true;
      try { await api("/api/admin/student-profile-review",{body:{id,version:pending.version,action}}); await load(); route(); viewStudent(id); toast(action === "approve" ? "তথ্য সংশোধন অনুমোদিত হয়েছে" : "সংশোধন অনুমোদিত হয়নি"); return true; }
      finally { busy = false; if ($("#rejectProfileChanges")) { $("#rejectProfileChanges").disabled=false; $("#modalSave").disabled=false; } }
    };
    openModal({title:"তথ্য সংশোধনের অনুমোদন",wide:true,saveText:"✓ সংশোধন অনুমোদন করুন",onSave:()=>decide("approve"),body:`<p><b>${esc(student.name)}</b> · রোল ${esc(student.id)}</p><p class="muted">নিচের আগের তথ্যগুলো এখনো চালু আছে। অনুমোদন দিলে নতুন তথ্য বসবে।</p><div class="tbl-wrap"><table class="profile-change-table"><thead><tr><th>তথ্য</th><th>আগের তথ্য</th><th>নতুন তথ্য</th></tr></thead><tbody>${Object.entries(pending.changes).map(([key,change])=>`<tr><td><b>${esc(change.label || key)}</b></td><td>${esc(value(change.from))}</td><td><strong>${esc(value(change.to))}</strong></td></tr>`).join("")}</tbody></table></div><p><button type="button" class="btn line" id="rejectProfileChanges">অনুমোদন না দিন</button></p>`});
    $("#rejectProfileChanges").onclick=()=>decide("reject").catch(error=>toast(error.message,true));
  }
  function reviewStudentPhotos(scopeIds) {
    const pending = () => DB.students.filter(s => scopeIds.has(s.id) && s.pendingPhoto);
    const selected = new Map();
    const photoUrl = s => "/api/admin/photo/p/" + encodeURIComponent(s.id) + "?v=" + encodeURIComponent(s.pendingPhoto.version);

    function render(id) {
      const queue = pending(), student = queue.find(s => s.id === id);
      for (const [sid, version] of selected) {
        if (!queue.some(s => s.id === sid && s.pendingPhoto.version === version)) selected.delete(sid);
      }
      openModal({
        title: "ছবি অনুমোদন (" + bn(queue.length) + ")",
        body: '<div class="photo-approval-queue"></div>',
      });
      const panel = $(".photo-approval-queue");
      if (!queue.length) {
        panel.innerHTML = '<p class="empty">অনুমোদনের অপেক্ষায় কোনো ছবি নেই।</p>';
        return;
      }
      if (student) {
        panel.innerHTML = '<button type="button" class="btn line" data-photo-list>‹ ছবির তালিকা</button>'
          + '<h3>' + esc(student.name) + ' · ' + esc(student.id) + '</h3>'
          + '<img class="photo-approval-preview" src="' + photoUrl(student) + '" alt="শিক্ষার্থীর পাঠানো ছবি">'
          + '<div class="toolbar"><button type="button" class="btn gold" data-decision="approve">✓ অনুমোদন করুন</button>'
          + '<button type="button" class="btn line" data-decision="reject">অনুমোদন না দিন</button></div>';
        $("[data-photo-list]", panel).onclick = () => render();
        $$("[data-decision]", panel).forEach(button => {
          button.onclick = () => {
            const action = button.dataset.decision;
            if (action === "reject" && !confirm("এই ছবিটি অনুমোদন না দিয়ে ফেরত দেবেন?")) return;
            const index = queue.indexOf(student);
            decide(panel, [student], action, queue.slice(index + 1).concat(queue.slice(0, index)).map(s => s.id));
          };
        });
        return;
      }
      panel.innerHTML = '<div class="toolbar"><label class="photo-approval-all"><input type="checkbox" data-photo-all> সব নির্বাচন</label><button type="button" class="btn gold" data-bulk-photo>নির্বাচিত ছবি অনুমোদন</button></div>'
        + queue.map(s => '<div class="photo-approval-row"><input type="checkbox" aria-label="' + esc(s.name + " · " + s.id + " নির্বাচন") + '">'
          + '<button type="button" class="btn line"><img src="' + photoUrl(s) + '" alt=""><span>' + esc(s.name) + ' · ' + esc(s.id)
          + '<small>ছবিটি দেখে সিদ্ধান্ত দিন →</small></span></button></div>').join("");
      const approve = $("[data-bulk-photo]", panel);
      const selectAll = $("[data-photo-all]", panel);
      const rows = $$(".photo-approval-row", panel);
      const updateCount = () => {
        selectAll.checked = selected.size === queue.length;
        selectAll.indeterminate = selected.size > 0 && !selectAll.checked;
        approve.disabled = !selected.size;
        approve.textContent = "নির্বাচিত ছবি অনুমোদন (" + bn(selected.size) + ")";
      };
      selectAll.onchange = () => {
        rows.forEach((row) => {
          const checkbox = $("input", row);
          checkbox.checked = selectAll.checked;
        });
        selected.clear();
        if (selectAll.checked) queue.forEach(s => selected.set(s.id, s.pendingPhoto.version));
        updateCount();
      };
      rows.forEach((row, index) => {
        const s = queue[index], checkbox = $("input", row);
        checkbox.checked = selected.has(s.id);
        checkbox.onchange = () => {
          if (checkbox.checked) selected.set(s.id, s.pendingPhoto.version);
          else selected.delete(s.id);
          updateCount();
        };
        $("button", row).onclick = () => render(s.id);
      });
      approve.onclick = () => {
        const targets = queue.filter(s => selected.has(s.id));
        if (targets.length && confirm(bn(targets.length) + "টি নির্বাচিত ছবি অনুমোদন করবেন?")) {
          decide(panel, targets, "approve");
        }
      };
      updateCount();
    }

    async function decide(panel, targets, action, nextIds = []) {
      $$("button,input", panel).forEach(control => control.disabled = true);
      let completed = 0;
      const errors = [];
      for (const s of targets) {
        try {
          const version = s.pendingPhoto.version;
          await api("/api/admin/student-photo-review", { body: { id: s.id, version, action } });
          delete s.pendingPhoto;
          selected.delete(s.id);
          completed++;
        } catch (error) {
          errors.push(s.id + " · " + error.message);
        }
      }
      try { await load(); } catch (error) { errors.push(error.message); }
      if (completed) toast(bn(completed) + "টি ছবির সিদ্ধান্ত সংরক্ষিত হয়েছে");
      const queue = pending(), button = $("#reviewStudentPhotos");
      if (button) {
        button.hidden = !queue.length;
        button.textContent = "ছবি অনুমোদন (" + bn(queue.length) + ")";
      }
      if (!modal.open || !panel.isConnected) return;
      const next = errors.length ? targets.find(s => queue.some(item => item.id === s.id))?.id
        : nextIds.find(id => queue.some(s => s.id === id));
      render(next);
      if (errors.length) $("#modalErr").textContent = errors.join(" | ");
    }

    render();
  }

  function viewStudent(id) {
    const s = studentById(id);
    if (!s) return;
    const f = s.fees;
    // উপস্থিতি = উপস্থিত ÷ (উপস্থিত + অনুপস্থিত) — ছুটির দিন (L) বাদ
    const att = Object.values(DB.attendance).map((m) => m[s.id]).filter((v) => v === "P" || v === "A");
    const pct = att.length ? Math.round((att.filter((v) => v === "P").length / att.length) * 100) : null;
    openModal({
      title: s.name, wide: true,
      body: `
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">${avatar(s.photo, "s", s.id, s.name, 84, s.gender)}
          <div><label class="btn sm line">${s.photo ? "ছবি বদলান" : "ছবি দিন"}<input type="file" accept="image/*" id="stuPhoto" hidden></label>
          ${s.photo ? '<button type="button" class="btn sm line" id="stuPhotoDel">সরান</button>' : ""}</div></div>
        ${s.pendingPhoto ? `<section class="student-photo-review"><h3>নতুন ছবি অনুমোদনের অপেক্ষায়</h3><img src="/api/admin/photo/p/${encodeURIComponent(s.id)}?v=${encodeURIComponent(s.pendingPhoto.version)}" alt="শিক্ষার্থীর পাঠানো ছবি" style="width:120px;height:145px;object-fit:contain;border:1px solid #dae4e2;border-radius:12px;background:#f2f6f8"><p>অনুমোদন দিলে এই ছবি প্রোফাইল ও আইডি কার্ডে ব্যবহার হবে।</p><div class="toolbar"><button type="button" class="btn gold" data-photo-review="approve">✓ অনুমোদন করুন</button><button type="button" class="btn line" data-photo-review="reject">অনুমোদন না দিন</button></div></section>` : ""}
        ${s.pendingProfile ? `<section class="student-photo-review"><h3>তথ্য সংশোধন অনুমোদনের অপেক্ষায়</h3><p>${bn(Object.keys(s.pendingProfile.changes).length)}টি তথ্য বদলানোর অনুরোধ এসেছে।</p><button type="button" class="btn gold" id="viewProfileChanges">আগের ও নতুন তথ্য দেখুন →</button></section>` : ""}
        <dl class="kv">
          <dt>আইডি</dt><dd>${esc(s.id)}</dd><dt>নাম</dt><dd>${esc(s.name)}${s.nameEn ? ` · ${esc(s.nameEn)}` : ""} (${s.gender === "F" ? "মেয়ে" : s.gender === "O" ? "অন্যান্য" : s.gender === "M" ? "ছেলে" : "লিঙ্গ দেওয়া নেই"})</dd>
          ${s.dob || s.bloodGroup || s.religion ? `<dt>জন্ম · রক্ত · ধর্ম</dt><dd>${esc([s.dob && s.dob.split("-").reverse().join("/"), s.bloodGroup, s.religion, s.nationality].filter(Boolean).join(" · "))}</dd>` : ""}
          <dt>সেশন / ব্যাচ</dt><dd>${esc(s.session || "")} · ${esc(batchFull(batchById(s.batchId)))}</dd>
          <dt>মোবাইল</dt><dd>${esc(s.phone || "—")}</dd>${s.fatherName || s.fatherPhone ? `<dt>বাবা</dt><dd>${esc([s.fatherName, s.fatherOccupation, s.fatherPhone].filter(Boolean).join(" · "))}</dd>` : ""}
          ${s.motherName || s.motherPhone ? `<dt>মা</dt><dd>${esc([s.motherName, s.motherOccupation, s.motherPhone].filter(Boolean).join(" · "))}</dd>` : ""}
          <dt>অভিভাবক</dt><dd>${esc(s.guardianName || s.fatherName || "—")}${s.guardianRelation ? ` (${esc(s.guardianRelation)})` : ""} · ${esc(s.guardianPhone || "")}</dd>
          <dt>কলেজ</dt><dd>${esc(s.college || "—")}</dd>
          ${s.address ? `<dt>বর্তমান ঠিকানা</dt><dd>${esc(s.address)}</dd>` : ""}${s.permanentAddress || s.sameAddress ? `<dt>স্থায়ী ঠিকানা</dt><dd>${s.sameAddress ? "বর্তমান ঠিকানাই" : esc(s.permanentAddress)}</dd>` : ""}
          <dt>ভর্তি</dt><dd>${U.date(s.admissionDate)}${s.appNo ? ` · অনলাইন আবেদন ${esc(s.appNo)}` : ""}</dd>
          <dt>হাজিরা</dt><dd>${pct === null ? "এখনো নেই" : bn(pct) + "% (" + bn(att.length) + " দিন)"}</dd>
          ${s.note ? `<dt>নোট</dt><dd>${esc(s.note)}</dd>` : ""}
        </dl>
        <h3 style="font-size:16px;margin:18px 0 8px">মডিউল ও ফি</h3>
        <div class="tbl-wrap"><table><thead><tr><th>মডিউল</th><th>শুরু</th><th class="num">ফি</th><th class="num">ছাড়</th><th class="num">মোট দেনা</th><th></th></tr></thead><tbody>
          ${f.items.map((it) => { const m = courseById(it.courseId) || {}; return `<tr><td><b>${esc(it.course)}</b> ${it.status === "ended" ? '<span class="chip">শেষ</span>' : ""}${it.chapters.length ? `<small>${esc(chapterNames(m, it.chapters).join(", "))}</small>` : ""}</td><td>${U.date(it.startDate)}</td>
            <td class="num">${money(it.fee)}${it.monthly ? "/মাস" : ""}</td><td class="num">${it.discount ? money(it.discount) : "—"}</td><td class="num">${money(it.due)}${it.monthly ? `<small>${bn(it.months)} মাস</small>${feeAdjustHtml(it)}` : ""}</td>
            <td class="num">${it.monthly ? `<button type="button" class="btn sm line" data-start="${it.enrollmentId}">শুরুর তারিখ সংশোধন</button> ` : ""}${it.monthly && it.status === "active" ? `<button type="button" class="btn sm line" data-end="${it.enrollmentId}">শেষ করুন</button>` : ""}</td></tr>`; }).join("") || '<tr><td colspan="6" class="empty">কোনো মডিউলে ভর্তি নেই</td></tr>'}
          <tr><td colspan="4"><b>মোট</b> · পরিশোধ ${money(f.paid)}</td><td class="num" colspan="2">${balanceChip(f)}</td></tr>
        </tbody></table></div>
        <div class="pin-box">লগইন PIN: <b id="pinVal">${esc(s.pin)}</b><button type="button" class="btn sm line" id="pinReset">নতুন PIN</button><button type="button" class="btn sm line" id="pinSms">SMS পাঠান</button><small id="pinSmsNote">${esc(loginSmsNote(s))}</small></div>
        <div class="toolbar" style="margin-top:16px">
          <button type="button" class="btn sm gold" id="vsPay">৳ পেমেন্ট নিন</button>
          <button type="button" class="btn sm" id="vsEnroll">＋ নতুন মডিউলে ভর্তি</button>
          <button type="button" class="btn sm line" id="vsCard">আইডি কার্ড</button>
          <button type="button" class="btn sm line" id="vsForm">ভর্তি ফর্ম</button>
          <button type="button" class="btn sm line" id="vsEdit">✎ তথ্য / ব্যাচ বদলান</button>
          ${s.guardianPhone ? `<a class="btn sm wa" target="_blank" rel="noopener" href="${waLink(s.guardianPhone, `আসসালামু আলাইকুম। ${DB.settings.name} থেকে বলছি — ${s.name} সম্পর্কে।`)}">WhatsApp</a>` : ""}
        </div>`,
    });
    $("#pinSms").onclick = () => { if (confirm(`${s.name}-কে আইডি আর PIN SMS-এ পাঠাবেন?`)) resendLogin(s, $("#pinSmsNote")); };
    if ($("#viewProfileChanges")) $("#viewProfileChanges").onclick=()=>reviewProfileChanges(s.id);
    $$("#modalBody [data-start]").forEach(button => { button.onclick = () => correctEnrollmentStart(s, button.dataset.start); });
    $$("#modalBody [data-photo-review]").forEach(button => { button.onclick = async () => {
      if (!confirm(button.dataset.photoReview === "approve" ? "এই ছবিটি অনুমোদন করবেন?" : "এই ছবিটি অনুমোদন না দিয়ে ফেরত দেবেন?")) return;
      $$("#modalBody [data-photo-review]").forEach(b => b.disabled = true);
      try { await api("/api/admin/student-photo-review", { body: { id: s.id, action: button.dataset.photoReview, version: s.pendingPhoto.version } }); await load(); viewStudent(s.id); toast("ছবির সিদ্ধান্ত সংরক্ষিত হয়েছে"); }
      catch (error) { toast(error.message, true); $$("#modalBody [data-photo-review]").forEach(b => b.disabled = false); }
    }; });
    $("#pinReset").onclick = async () => {
      if (!confirm("নতুন PIN তৈরি করবেন? আগের PIN আর কাজ করবে না।")) return;
      try { const r = await api("/api/admin/student-pin", { body: { id: s.id } }); $("#pinVal").textContent = r.pin; s.pin = r.pin; delete s.loginSms; $("#pinSmsNote").textContent = loginSmsNote(s); toast("নতুন PIN তৈরি হয়েছে"); } catch (e) { toast(e.message, true); }
    };
    $$("#modalBody [data-end]").forEach((b) => (b.onclick = async () => {
      if (!confirm("এই মাসিক মডিউল আজ থেকে শেষ করবেন? এরপর আর মাসিক ফি যোগ হবে না।")) return;
      const e = DB.enrollments.find((x) => x.id === b.dataset.end);
      try { await save("enrollments", { ...e, status: "ended", endDate: U.today() }, e.id); await load(); toast("শেষ করা হয়েছে"); viewStudent(s.id); } catch (er) { toast(er.message, true); }
    }));
    $("#vsPay").onclick = () => paymentForm(s.id);
    $("#vsEnroll").onclick = () => { closeModal(); location.hash = `admission/enroll/${s.id}`; };
    $("#vsCard").onclick = () => printDoc("আইডি কার্ড", idCardHtml(s));
    $("#vsForm").onclick = () => { const enr = enrollmentsOf(s.id)[0]; printAdmission(s, formExtra(s, enr, null), enr); };
    $("#vsEdit").onclick = () => studentForm(s);
    $("#stuPhoto").onchange = async (e) => {
      try { const data = await U.resizeImage(e.target.files[0]); await api("/api/admin/student-photo", { body: { id: s.id, photo: data } }); await load(); toast("ছবি সেভ হয়েছে"); viewStudent(s.id); }
      catch (er) { toast(er.message, true); }
    };
    const pdel = $("#stuPhotoDel"); if (pdel) pdel.onclick = async () => { await api("/api/admin/student-photo", { body: { id: s.id, remove: true } }); await load(); viewStudent(s.id); };
  }
  const studentBatchFilters = new Map();
  function students(c, arg = "") {
    const type = ["offline","online","quiz","talent"].includes(arg.split("/")[0]) ? arg.split("/")[0] : "offline";
    const rest = type === "offline" && arg.startsWith("batch/") ? arg : arg.split("/").slice(1).join("/");
    c.innerHTML = SICStudentDirectory.header(DB,type) + '<div id="studentDirectoryContent"></div>';
    const target=$("#studentDirectoryContent");
    if(type === "offline" || type === "online") studentList(target,rest,type);
    else SICStudentDirectory.audience(target,type,DB);
  }
  function studentList(c, arg, mode = "offline") {
    const scopeIds = SICStudentDirectory.ids(DB, mode);
    const scopedCourses = DB.courses.filter(m => modeOf(m) === mode);
    const listModules = sid => enrollmentsOf(sid).filter(e => e.status === "active" && modeOf(courseById(e.courseId)) === mode).map(e => courseById(e.courseId)?.name).filter(Boolean);
    const scopedFees = s => { const items = (s.fees?.items || []).filter(i => modeOf(courseById(i.courseId)) === mode), enrollmentIds = new Set(items.map(i => i.enrollmentId)); const totalDue=items.reduce((n,i)=>n+i.due,0), paid=DB.payments.filter(p=>p.studentId===s.id&&(enrollmentIds.has(p.enrollmentId)||(!p.enrollmentId&&mode==="offline"))).reduce((n,p)=>n+Number(p.amount||0),0); return {items,totalDue,paid,balance:totalDue-paid}; };
    const linkedBatch = arg.startsWith("batch/") ? batchById(arg.slice(6)) : null;
    const filterKey = linkedBatch ? `${mode}/${linkedBatch.id}` : mode;
    const remembered = studentBatchFilters.get(filterKey);
    const preBatch = remembered?.batch || (remembered ? "" : linkedBatch?.id || "");
    const preSession = remembered?.session || (remembered ? "" : linkedBatch?.session || "");
    c.innerHTML = `<div class="card"><div class="sd-list-title"><div><h2>${mode === "online" ? "অনলাইন" : "অফলাইন"} শিক্ষার্থীর তালিকা</h2><p>এই তালিকায় শুধু ${mode === "online" ? "অনলাইন" : "অফলাইন"} মডিউলের ভর্তি ও হিসাব দেখানো হচ্ছে।</p></div>${mode === "offline" ? '<a class="sd-batch-move" href="#batchmove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4"/></svg><span>ব্যাচ পরিবর্তন</span><span aria-hidden="true">→</span></a>' : ""}</div>
      <div class="toolbar">
        <input class="grow" id="q" placeholder="নাম, আইডি বা মোবাইল">
        <select id="fse">${opt(sessionOptions("সব সেশন"), preSession)}</select>
        <span id="fbWrap"${mode === "online" ? " hidden" : ""}></span>
        <select id="fm">${opt([["", "সব মডিউল"], ...scopedCourses.map((m) => [m.id, `${m.code} — ${m.name}`]), ...(mode === "online" ? (DB.onlineCourses || []).map(m => ["legacy:"+m.id, m.title]) : [])])}</select>
        <select id="fs">${opt([["", "সবাই"], ["active", "শুধু সক্রিয় (পড়ছে)"], ["inactive", "শুধু পড়া বন্ধ"]], "")}</select>
      </div>
      <div class="toolbar">
        <a class="btn gold" id="sdNewAdmission" href="${mode === "online" ? "#onlineApps" : "#admission"}">＋ ${mode === "online" ? "অনলাইন " : "নতুন "}ভর্তি</a>
        <button type="button" class="btn line" id="reviewStudentPhotos"${DB.students.some(s => scopeIds.has(s.id) && s.pendingPhoto) ? "" : " hidden"}>ছবি অনুমোদন (${bn(DB.students.filter(s => scopeIds.has(s.id) && s.pendingPhoto).length)})</button>
        <button type="button" class="btn line" id="reviewStudentProfiles">তথ্য সংশোধন (${bn(DB.students.filter(s => scopeIds.has(s.id) && s.pendingProfile).length)})</button>
        <button class="btn line" id="csv">↓ Excel</button>
        <button class="btn line" id="cards">এই তালিকার আইডি কার্ড</button>
        <button class="btn line" id="loginSlips" title="A4 পাতায় ১০টি করে নাম, রোল ও PIN-এর স্লিপ">↓ লগইন স্লিপ PDF</button>
        <button class="btn line" id="smsAll">📩 এই তালিকার সবাইকে আইডি ও PIN</button>
        <span class="grow"></span><span class="muted" id="cnt"></span>
      </div>
      <div class="tbl-wrap"><table class="students-table"><thead><tr><th>আইডি</th><th>নাম</th><th>সেশন / ব্যাচ</th><th>মডিউল</th><th>মোবাইল</th><th>ফি</th><th>অবস্থা</th><th></th></tr></thead><tbody id="rows"></tbody></table></div>
    </div>${mode === "online" ? '<div id="sdLegacyOnline"></div>' : ""}`;
    $("#reviewStudentProfiles").onclick = () => {
      const pending=DB.students.filter(s=>scopeIds.has(s.id)&&s.pendingProfile);
      openModal({title:`তথ্য সংশোধনের অনুরোধ (${bn(pending.length)})`,body:pending.length ? `<div style="display:grid;gap:10px">${pending.map(s=>`<button type="button" class="btn line" data-review-profile="${esc(s.id)}">${esc(s.name)} · ${esc(s.id)} · ${bn(Object.keys(s.pendingProfile.changes).length)}টি সংশোধন →</button>`).join("")}</div>` : '<p class="empty">এখন কোনো সংশোধন অনুমোদনের অপেক্ষায় নেই।</p>'});
      $$("#modalBody [data-review-profile]").forEach(b=>b.onclick=()=>reviewProfileChanges(b.dataset.reviewProfile));
    };
    $("#reviewStudentPhotos").onclick = () => reviewStudentPhotos(scopeIds);
    const drawBatchSel = (keep) => { $("#fbWrap").innerHTML = batchSelectHtml("fb", keep || "", "সব ব্যাচ", $("#fse").value); $("#fbSel").onchange = rememberAndDraw; };
    const list = () => {
      const qv = $("#q").value.trim().toLowerCase(), se = $("#fse").value, fb = $("#fbSel").value, fm = $("#fm").value, fs = $("#fs").value;
      return DB.students.filter((s) => scopeIds.has(s.id) && (!se || s.session === se) && (!fb || s.batchId === fb) && (!fs || s.status === fs)
        && (!fm || enrollmentsOf(s.id).some((e) => e.courseId === fm && e.status === "active"))
        && (!qv || [s.id, s.name, s.phone, s.guardianPhone].join(" ").toLowerCase().includes(qv))).map(s => ({ ...s, fees: scopedFees(s) }));
    };
    const draw = () => {
      const l = list();
      const legacyCount = mode === "online" ? SICStudentDirectory.legacyTable($("#sdLegacyOnline"), DB, { q:$("#q").value.trim().toLowerCase(), session:$("#fse").value, module:$("#fm").value, status:$("#fs").value }) || 0 : 0;
      $("#cnt").textContent = `${bn(l.length + legacyCount)} জন`;
      $("#rows").closest(".tbl-wrap").hidden = mode === "online" && !l.length && legacyCount > 0;
      $("#rows").innerHTML = l.map((s) => `<tr>
        <td><b>${esc(s.id)}</b></td><td class="student-name-cell"><div class="student-name-line">${avatar(s.photo, "s", s.id, s.name, 32, s.gender)}<a href="#" data-view="${s.id}"><b>${esc(s.name)}</b></a></div><small>${esc(s.college)}</small></td>
        <td>${esc(s.session || "—")}<small>${esc(batchName(s.batchId))}</small></td>
        <td>${listModules(s.id).map((n) => `<span class="chip" style="margin:1px">${esc(n)}</span>`).join("") || "—"}</td>
        <td>${esc(s.phone || "—")}<small>অভি: ${esc(s.guardianPhone || "—")}</small></td>
        <td>${balanceChip(s.fees)}<button type="button" class="btn sm line" style="display:block;margin-top:5px;white-space:nowrap" data-list-pay="${esc(s.id)}">৳ পেমেন্ট নিন</button></td>
        <td>${stToggle(s)}</td>
        <td class="num" style="white-space:nowrap"><button class="icon-btn" title="বিস্তারিত" data-view="${s.id}">দেখুন</button><button class="icon-btn" title="ভর্তি ফর্ম প্রিন্ট" data-print="${s.id}">প্রিন্ট</button><button class="icon-btn" title="বদলান" data-edit="${s.id}">✎</button><button class="icon-btn" title="মুছুন" data-del="${s.id}">✕</button></td></tr>`).join("")
        || `<tr><td colspan="8" class="empty">কোনো শিক্ষার্থী পাওয়া যায়নি</td></tr>`;
    };
    const rememberAndDraw = () => {
      const filter = { session: $("#fse").value, batch: $("#fbSel").value };
      studentBatchFilters.set(filterKey, filter);
      studentBatchFilters.set(mode, filter);
      if (mode === "offline") {
        $("#sdNewAdmission").href = newAdmissionHref(filter);
      }
      draw();
    };
    drawBatchSel(preBatch); rememberAndDraw();
    $("#fse").onchange = () => { drawBatchSel(); rememberAndDraw(); };
    ["q", "fm", "fs"].forEach((id) => $("#" + id).addEventListener("input", draw));
    $("#rows").onclick = async (e) => {
      const pay = e.target.closest("[data-list-pay]");
      if (pay) return paymentForm(pay.dataset.listPay, draw);
      const tg = e.target.closest("[data-status]");
      if (tg) {
        // পড়া চলছে ⇄ পড়া বন্ধ
        return togglePause(studentById(tg.dataset.status), draw);
      }
      const pr = e.target.closest("[data-print]");
      if (pr) { printStudentForm(studentById(pr.dataset.print)); return; }
      const t = e.target.closest("[data-view],[data-edit],[data-del]"); if (!t) return; e.preventDefault();
      if (t.dataset.view) viewStudent(t.dataset.view);
      if (t.dataset.edit) studentForm(studentById(t.dataset.edit));
      if (t.dataset.del) remove("students", t.dataset.del, `"${studentName(t.dataset.del)}" এর সব তথ্য, ভর্তি আর পেমেন্ট`);
    };
    $("#csv").onclick = () => U.xlsx(`students-${U.today()}.xlsx`, ["আইডি", "নাম", "ছাত্র/ছাত্রী", "সেশন", "ব্যাচ", "মডিউল", "মোবাইল", "পিতা", "অভিভাবকের মোবাইল", "কলেজ", "ভর্তির তারিখ", "মোট দেনা", "পরিশোধ", "বকেয়া", "অবস্থা"],
      list().map((s) => [s.id, s.name, { M: "ছেলে", F: "মেয়ে", O: "অন্যান্য" }[s.gender] || "", s.session, batchName(s.batchId), listModules(s.id).join(", "), s.phone, s.fatherName, s.guardianPhone, s.college, s.admissionDate, s.fees.totalDue, s.fees.paid, s.fees.balance, s.status === "active" ? "সক্রিয়" : "নিষ্ক্রিয়"]));
    $("#loginSlips").onclick = async () => {
      const button=$("#loginSlips"), students=list();
      if(!students.length) return toast("কোনো শিক্ষার্থী নেই",true);
      button.disabled=true; button.textContent="PDF তৈরি হচ্ছে…";
      try { const result=await SICLoginSlips.download(students,{settings:DB.settings,batchName}); toast(`${bn(result.count)} জনের লগইন স্লিপ ডাউনলোড হয়েছে`); }
      catch(error){toast(error.message || "PDF তৈরি হয়নি",true);}
      finally{button.disabled=false;button.textContent="↓ লগইন স্লিপ PDF";}
    };
    $("#cards").onclick = () => { const l = list(); if (!l.length) return toast("কোনো শিক্ষার্থী নেই", true); printDoc("আইডি কার্ড", l.map(idCardHtml).join("")); };
    // তালিকার সবাইকে আইডি ও PIN: একজন একজন করে, আগে পেয়েছে বা পড়া বন্ধ এমন কাউকে নয়; পরপর ৩ বার না গেলে থামে (যেমন ব্যালেন্স শেষ)
    $("#smsAll").onclick = async () => {
      const l = list(), hasPhone = (s) => [s.phone, s.guardianPhone].some((p) => /^(88)?01\d{9}$/.test(String(p || "").replace(/\D/g, "")));
      const off = l.filter((s) => s.status === "inactive"), rest = l.filter((s) => s.status !== "inactive");
      const got = rest.filter((s) => s.loginSms && s.loginSms.ok), noPhone = rest.filter((s) => !(s.loginSms && s.loginSms.ok) && !hasPhone(s));
      const todo = rest.filter((s) => !(s.loginSms && s.loginSms.ok) && hasPhone(s));
      if (!todo.length) return toast(l.length ? "এই তালিকায় পাঠানোর মতো কেউ নেই" : "কোনো শিক্ষার্থী নেই", true);
      const skip = [got.length && `আগে পেয়েছে ${bn(got.length)} জন`, off.length && `পড়া বন্ধ ${bn(off.length)} জন`, noPhone.length && `মোবাইল নেই ${bn(noPhone.length)} জন`].filter(Boolean).join(", ");
      if (!confirm(`${bn(todo.length)} জনের মোবাইলে আইডি ও PIN যাবে। প্রতিটার জন্য SMS ব্যালেন্স কাটবে।${skip ? `\n\nবাদ যাবে: ${skip}` : ""}\n\nপাঠাবেন?`)) return;
      const btn = $("#smsAll"), label = btn.textContent, failed = [];
      let sent = 0, inRow = 0, why = "";
      btn.disabled = true;
      for (const [i, s] of todo.entries()) {
        btn.textContent = `পাঠানো হচ্ছে ${bn(i + 1)}/${bn(todo.length)}…`;
        try { const r = await api("/api/admin/login-sms", { body: { id: s.id } }); s.loginSms = r.loginSms; sent++; inRow = 0; }
        catch (e) { failed.push(s); why = e.message; if (++inRow >= 3) break; }
      }
      btn.disabled = false; btn.textContent = label;
      if (!failed.length) return toast(`${bn(sent)} জনের কাছে SMS গেছে`);
      const left = todo.length - sent - failed.length;
      alert(`${bn(sent)} জনের কাছে SMS গেছে, ${bn(failed.length)} জনের কাছে যায়নি${left ? `, ${bn(left)} জনকে পাঠানো হয়নি` : ""}।\n\nকারণ: ${why}\nযায়নি: ${failed.map((s) => s.name).join(", ")}\n\nআবার চাপলে যারা পায়নি শুধু তাদের কাছে যাবে।`);
    };
  }

  // ---------- হাজিরা ----------
  // হাজিরা: উপরে শিরোনাম + সেভ, ফিল্টার প্যানেল, সারাংশের ঘর (রিং + উপস্থিত / অনুপস্থিত / ছুটি / বাকি), নিচে খোঁজা + সবাইকে একসাথে, প্রতি শিক্ষার্থীর সারি
  // ব্যাচ পরিবর্তন: তালিকা ছেঁকে যার যার "নতুন ব্যাচ" বেছে একসাথে সেভ (একই সেশনের ব্যাচগুলোর মধ্যে)
  function batchMove(c) {
    const offlineIds = SICStudentDirectory.ids(DB, "offline");
    const moves = new Map(); // আইডি → নতুন ব্যাচ; ছাঁকনি বদলালেও বাছাই থাকে
    const selected = new Set();
    const label = (id) => { const b = batchById(id); return b ? U.batchLabel(b) : "—"; };
    c.innerHTML = `<div class="card">
      <div class="toolbar">
        <input class="grow" id="q" placeholder="নাম, আইডি বা মোবাইল">
        <select id="fse">${opt(sessionOptions("সব সেশন"), "")}</select>
        <span id="fbWrap"></span>
        <select id="fm">${opt([["", "সব মডিউল"], ...DB.courses.filter(m => modeOf(m) === "offline").map((m) => [m.id, `${m.code} — ${m.name}`])])}</select>
        <select id="fs">${opt([["", "সবাই"], ["active", "শুধু সক্রিয় (পড়ছে)"], ["inactive", "শুধু পড়া বন্ধ"]], "")}</select>
      </div>
      <div class="toolbar">
        <label><input type="checkbox" id="bmAll"> তালিকার সবাইকে বাছুন</label>
        <select id="bmTarget" aria-label="নির্বাচিতদের নতুন ব্যাচ"></select>
        <button type="button" class="btn line" id="bmApply" disabled>নির্বাচিতদের ব্যাচ বসান</button>
        <button type="button" class="btn gold" id="bmSave" disabled>পরিবর্তন সেভ করুন</button>
        <span class="grow"></span><span class="muted" id="cnt"></span>
      </div>
      <div class="tbl-wrap"><table><thead><tr><th>বাছাই</th><th>আইডি</th><th>নাম</th><th>বর্তমান ব্যাচ</th><th>নতুন ব্যাচ</th></tr></thead><tbody id="rows"></tbody></table></div>
    </div>`;
    const drawBatchSel = () => { $("#fbWrap").innerHTML = batchSelectHtml("fb", "", "সব ব্যাচ", $("#fse").value); $("#fbSel").onchange = draw; };
    const list = () => {
      const qv = $("#q").value.trim().toLowerCase(), se = $("#fse").value, fb = $("#fbSel").value, fm = $("#fm").value, fs = $("#fs").value;
      return DB.students.filter((s) => offlineIds.has(s.id) && (!se || s.session === se) && (!fb || s.batchId === fb) && (!fs || s.status === fs)
        && (!fm || enrollmentsOf(s.id).some((e) => e.courseId === fm && e.status === "active"))
        && (!qv || [s.id, s.name, s.phone, s.guardianPhone].join(" ").toLowerCase().includes(qv)));
    };
    const syncSave = () => { const n = moves.size, b = $("#bmSave"); b.disabled = !n; b.textContent = n ? `পরিবর্তন সেভ করুন (${bn(n)} জন)` : "পরিবর্তন সেভ করুন"; };
    const available = (student, batch) => batch.active !== false && batch.session === student.session && batch.id !== student.batchId;
    const syncBulk = (visible) => {
      const picked = visible.filter(s => selected.has(s.id)), all = $("#bmAll"), target = $("#bmTarget");
      all.disabled = !visible.length;
      all.checked = !!visible.length && picked.length === visible.length;
      all.indeterminate = !!picked.length && !all.checked;
      const value = target.value;
      const batches = picked.length ? DB.batches.filter(b => picked.every(s => available(s, b))) : [];
      target.innerHTML = opt([["", "নতুন ব্যাচ বেছে নিন"], ...batches.map(b => [b.id, U.batchLabel(b)])], value);
      $("#bmApply").disabled = !target.value;
      $("#bmApply").textContent = `নির্বাচিতদের ব্যাচ বসান (${bn(picked.length)} জন)`;
    };
    const draw = () => {
      const l = list();
      const visibleIds = new Set(l.map(s => s.id));
      for (const id of selected) if (!visibleIds.has(id)) selected.delete(id);
      syncBulk(l);
      $("#cnt").textContent = `${bn(l.length)} জন`;
      $("#rows").innerHTML = l.map((s) => {
        const others = DB.batches.filter(b => available(s, b));
        return `<tr><td><input type="checkbox" data-bm-pick="${esc(s.id)}" aria-label="${esc(s.name)} বাছুন"${selected.has(s.id) ? " checked" : ""}></td><td><b>${esc(s.id)}</b></td><td><a href="#" data-view="${s.id}"><b>${esc(s.name)}</b></a></td><td>${esc(label(s.batchId))}</td>
          <td>${others.length ? `<select data-move="${s.id}">${opt([["", "— বাছুন —"], ...others.map((b) => [b.id, U.batchLabel(b)])], moves.get(s.id) || "")}</select>` : '<span class="muted">এই সেশনে আর ব্যাচ নেই</span>'}</td></tr>`;
      }).join("") || `<tr><td colspan="5" class="empty">কোনো শিক্ষার্থী পাওয়া যায়নি</td></tr>`;
    };
    drawBatchSel(); draw();
    $("#fse").onchange = () => { drawBatchSel(); draw(); };
    ["q", "fm", "fs"].forEach((id) => $("#" + id).addEventListener("input", draw));
    $("#bmAll").onchange = (e) => {
      selected.clear();
      if (e.target.checked) list().forEach(s => selected.add(s.id));
      draw();
    };
    $("#bmTarget").onchange = (e) => { $("#bmApply").disabled = !e.target.value; };
    $("#bmApply").onclick = () => {
      const batch = batchById($("#bmTarget").value);
      if (!batch) return;
      list().filter(s => selected.has(s.id) && available(s, batch)).forEach(s => moves.set(s.id, batch.id));
      draw();
      syncSave();
    };
    $("#rows").onchange = (e) => {
      const picked = e.target.dataset.bmPick;
      if (picked) {
        if (e.target.checked) selected.add(picked); else selected.delete(picked);
        syncBulk(list());
        return;
      }
      const id = e.target.dataset.move; if (!id) return;
      if (e.target.value) moves.set(id, e.target.value); else moves.delete(id);
      syncSave();
    };
    $("#bmSave").onclick = async (e) => {
      e.target.disabled = true;
      let done = 0;
      try {
        for (const [id, batchId] of moves) { await save("students", { ...studentById(id), batchId }, id); done++; }
        toast(`${bn(done)} জনের ব্যাচ বদলানো হয়েছে`);
      } catch (er) { toast(`${bn(done)} জনের পর থেমে গেছে: ${er.message}`, true); }
      await refresh();
    };
  }
  function attendance(c) {
    const se = (liveSessions()[0] || {}).name || "";
    c.innerHTML = `<div class="at-head"><div><span class="at-eye">দৈনিক হাজিরা</span><h2>উপস্থিতি ব্যবস্থাপনা</h2><p>সেশন ও ব্যাচ বেছে হাজিরা, বাড়ির কাজ আর পড়া একসাথে দিন।</p></div><button class="btn gold" id="saveAtt">✓ হাজিরা সংরক্ষণ</button></div>
      <div class="card at-ctl">
        <label>তারিখ<input type="date" id="ad" value="${U.today()}" max="${U.today()}"></label>
        <label>সেশন<select id="ase">${opt(sessionOptions(), se)}</select></label>
        <label>ব্যাচ<span id="abWrap"></span></label>
        <button type="button" class="btn line" id="attClean" title="এই পাতার সব চিহ্ন মুছে দিন (সেভ না করা পর্যন্ত কিছু বদলাবে না)">Clean</button>
      </div>
      <div class="at-closed" id="attClosed" hidden><span>❚❚</span><div><b>এই দিনে ব্যাচটি বন্ধ</b><small id="attClosedTx"></small></div></div>
      <div class="at-sum" id="attSum"></div>
      <div class="card at-reg">
        <div class="at-reg-head"><div><h3>শিক্ষার্থীর হাজিরা</h3><small id="attMeta"></small></div>
          <div class="at-tools"><label class="at-search">⌕ <input id="attQ" placeholder="নাম বা আইডি দিয়ে খুঁজুন"></label>
            <button type="button" class="at-all p" data-all="P">✓ উপস্থিত</button><button type="button" class="at-all a" data-all="A">× অনুপস্থিত</button><button type="button" class="at-all l" data-all="L">○ ছুটি</button></div></div>
        <div class="at-cols"><span>শিক্ষার্থী</span><span class="at-nbh">নতুন ব্যাচ <button type="button" class="at-lock" id="attLock"></button></span><span>হাজিরা</span><span>বাড়ির কাজ</span><span>পড়া পারা</span><span>পয়েন্ট</span><span>অবস্থা</span></div>
        <div id="arows"></div>
        <p class="at-note">পয়েন্ট: উপস্থিত ১ + বাড়ির কাজ ১ + পড়া পারা ১ = দিনে সর্বোচ্চ ৩ · ছুটি উপস্থিতির হিসাবে ধরা হয় না · একই বোতামে আবার চাপলে চিহ্ন উঠে যায়</p>
      </div>`;
    // ট্যাব: হাজিরা দিন | 📞 অনুপস্থিতি কল তালিকা (অনুপস্থিতদের অভিভাবককে কল — admin-absence.js)
    const absCalls = window.SICAbsence({ get DB() { return DB; }, batchName, load });
    const callBadge = () => { const b = $("#attCallN"); if (b) b.textContent = absCalls.pending() || ""; };
    c.classList.remove("at-show-calls");
    c.querySelector(".at-head").insertAdjacentHTML("afterend", '<div class="at-tabs" id="attTabs"><button type="button" class="on" data-at-tab="reg">✓ হাজিরা দিন</button><button type="button" data-at-tab="calls">📞 অনুপস্থিতি কল তালিকা <span class="at-tabn" id="attCallN"></span></button></div>');
    c.insertAdjacentHTML("beforeend", '<div id="attCalls"></div>');
    callBadge();
    $("#attTabs").onclick = (e) => { const b = e.target.closest("[data-at-tab]"); if (!b) return; $$("#attTabs button").forEach((x) => x.classList.toggle("on", x === b)); const calls = b.dataset.atTab === "calls"; c.classList.toggle("at-show-calls", calls); if (calls) absCalls($("#attCalls")); else callBadge(); };
    let marks = {}, ticks = {}, moveLock = true; // নতুন ব্যাচের ঘর শুরুতে সবসময় লক; ব্যাচ / তারিখ বদলালে আবার লক
    const paintLock = () => { const b = $("#attLock"); b.textContent = moveLock ? "🔒 লক" : "🔓 খোলা"; b.classList.toggle("open", !moveLock); b.title = moveLock ? "চাপ দিয়ে খুলুন — তারপর ব্যাচ বদলানো যাবে" : "চাপ দিয়ে আবার লক করুন"; $$("#arows select[data-move]").forEach((x) => (x.disabled = moveLock)); };
    // ওই দিনে ওই ব্যাচের বাড়ির কাজ / পড়ার রেকর্ড (সার্ভারও একই নিয়মে খোঁজে)
    const hwRec = (kind, date, b) => { const bt = DB.batches.find((x) => x.id === b); return bt && (DB.homework || []).find((h) => h.kind === kind && h.session === bt.session && h.dueDate === date && (!(h.batchIds || []).length || h.batchIds.includes(b))); };
    const pts = (sid) => (marks[sid] === "P" ? 1 + (ticks[sid]?.hw ? 1 : 0) + (ticks[sid]?.lesson ? 1 : 0) : 0);
    const rows = () => $$("#arows .at-person:not(.at-off)"); // পড়া বন্ধ যাদের, তারা হাজিরার হিসাবে নেই
    const paintRow = (sid) => {
      const r = $(`#arows .at-person[data-sid="${sid}"]`); if (!r) return;
      $$(".att-row button", r).forEach((b) => b.classList.toggle("on", b.dataset.v === marks[sid]));
      $$("input[data-tk]", r).forEach((i) => { i.disabled = marks[sid] !== "P"; i.checked = marks[sid] === "P" && !!ticks[sid]?.[i.dataset.tk]; i.closest(".at-tk").classList.toggle("on", i.checked); i.closest(".at-tk").classList.toggle("off", i.disabled); });
      $("[data-pts]", r).textContent = marks[sid] ? bn(pts(sid)) : "—";
    };
    const summary = () => {
      const ids = rows().map((r) => r.dataset.sid), n = (f) => ids.filter(f).length;
      const p = n((i) => marks[i] === "P"), a = n((i) => marks[i] === "A"), l = n((i) => marks[i] === "L"), left = ids.length - p - a - l;
      const pct = p + a ? Math.round((p / (p + a)) * 100) : 0;
      const box = (cls, t, v, sub) => `<article><span class="at-dot ${cls}"></span><div><small>${t}</small><b>${v}</b>${sub ? `<i>${sub}</i>` : ""}</div></article>`;
      $("#attSum").innerHTML = `<article class="at-rate"><div class="at-ring" style="--p:${pct}%"><b>${bn(pct)}%</b></div><div><span>আজকের উপস্থিতি</span><small>${bn(ids.length)} জনের মধ্যে ${bn(p + a + l)} জনের হাজিরা দেওয়া</small></div></article>
        ${box("p", "উপস্থিত", bn(p))}${box("a", "অনুপস্থিত", bn(a))}${box("l", "ছুটি", bn(l))}${box("w", "বাকি", bn(left))}
        ${box("hw", "বাড়ির কাজ / পড়া", `${bn(n((i) => marks[i] === "P" && ticks[i]?.hw))} / ${bn(n((i) => marks[i] === "P" && ticks[i]?.lesson))}`, `পয়েন্ট ${bn(ids.reduce((t, i) => t + pts(i), 0))}/${bn(p * 3)}`)}`;
    };
    const bsel = () => {
      const first = DB.batches.find((b) => b.session === $("#ase").value);
      $("#abWrap").innerHTML = batchSelectHtml("ab", first ? first.id : "", "", $("#ase").value);
      $("#abSel").onchange = fresh;
    };
    const fresh = () => { moveLock = true; draw(); };
    // ব্যাচ বদলানো / পড়া বন্ধ-চালুর পর: তালিকা নতুন করে, কিন্তু এখনো সেভ না করা চিহ্নগুলো থাকে
    const keepDraw = () => {
      const m = marks, t = ticks;
      draw();
      rows().forEach((r) => { const i = r.dataset.sid; marks[i] = m[i]; if (t[i]) ticks[i] = t[i]; paintRow(i); });
      summary();
    };
    const draw = () => {
      const date = $("#ad").value, b = $("#abSel").value;
      marks = { ...(DB.attendance[`${date}|${b}`] || {}) };
      const rh = hwRec("homework", date, b), rl = hwRec("lesson", date, b);
      ticks = {};
      // এই দিনে ব্যাচ বন্ধ থাকলে জানিয়ে দেয়
      const cl = U.closureOn(DB.closures, b, date);
      $("#attClosed").hidden = !cl;
      if (cl) $("#attClosedTx").textContent = `${U.date(cl.from)} – ${U.date(cl.to)}${cl.reason ? " · " + cl.reason : ""} — সাধারণত এই দিনে হাজিরা লাগবে না।`;
      const list = activeStudents().filter((s) => s.batchId === b);
      const month = date.slice(0, 7);
      $("#attMeta").textContent = `${bn(list.length)} জন শিক্ষার্থী · ${batchName(b)} · ${U.date(date)}`;
      const moveCell = (s) => { const others = DB.batches.filter((x) => x.session === s.session && x.id !== s.batchId && x.active !== false); return `<div class="at-nb">${others.length ? `<select data-move="${s.id}" aria-label="নতুন ব্যাচ">${opt([["", "— বাছুন —"], ...others.map((x) => [x.id, U.batchLabel(x)])], "")}</select>` : "—"}</div>`; };
      const offList = DB.students.filter((s) => s.batchId === b && s.status === "inactive"); // এদের হাজিরা নেই, শুধু আবার চালু করা বা ব্যাচ বদলানো যায়
      const offRows = offList.map((s) => `<div class="at-person at-off" data-sid="${s.id}" data-q="${esc((s.id + " " + s.name).toLowerCase())}">
          <div class="at-stu"><span class="at-av">${esc(String(s.name || "?").trim().split(/\s+/).map((x) => x[0]).slice(0, 2).join(""))}</span><div><b>${esc(s.name)}</b><small>${esc(s.id)}</small></div></div>
          ${moveCell(s)}<div class="at-offtx">পড়া বন্ধ — হাজিরা লাগবে না</div><span></span><span></span><b class="at-pts">—</b><div class="at-st">${stToggle(s)}</div></div>`).join("");
      $("#arows").innerHTML = (list.map((s) => {
        const ms = Object.entries(DB.attendance)
          .filter(([key, marks]) => {
            const [day, batchId] = key.split("|");
            return day.slice(0, 7) === month && batchId === s.batchId && (marks[s.id] === "P" || marks[s.id] === "A");
          })
          .map(([, marks]) => marks[s.id]);
        const pct = ms.length ? Math.round((ms.filter((v) => v === "P").length / ms.length) * 100) : null; // ছুটি বাদ
        const chip = pct === null ? "" : ` · <span class="chip ${pct >= 80 ? "ok" : pct >= 60 ? "warn" : "bad"}" title="এই মাসে উপস্থিতি">এই মাসে ${bn(pct)}%</span>`;
        ticks[s.id] = { hw: (rh?.checks || {})[s.id] === "done", lesson: (rl?.checks || {})[s.id] === "done" };
        const on = marks[s.id] === "P";
        const ini = esc(String(s.name || "?").trim().split(/\s+/).map((x) => x[0]).slice(0, 2).join(""));
        return `<div class="at-person" data-sid="${s.id}" data-q="${esc((s.id + " " + s.name).toLowerCase())}">
          <div class="at-stu"><span class="at-av">${ini}</span><div><b>${esc(s.name)}</b><small>${esc(s.id)}${chip}</small></div></div>
          ${moveCell(s)}
          <div class="att-row" data-sid="${s.id}">${[["P", "✓ উপস্থিত"], ["A", "× অনুপস্থিত"], ["L", "○ ছুটি"]].map(([v, t]) => `<button type="button" data-v="${v}" class="${marks[s.id] === v ? "on" : ""}">${t}</button>`).join("")}</div>
          ${[["hw", "বাড়ির কাজ"], ["lesson", "পড়া পারা"]].map(([k, t]) => `<label class="at-tk${on && ticks[s.id][k] ? " on" : ""}${on ? "" : " off"}" title="${t} — শুধু উপস্থিত হলে দেওয়া যায়"><input type="checkbox" class="att-tk" data-tk="${k}"${on ? "" : " disabled"}${on && ticks[s.id][k] ? " checked" : ""}><span>${t}</span></label>`).join("")}
          <b class="at-pts" data-pts>${marks[s.id] ? bn(pts(s.id)) : "—"}</b>
          <div class="at-st">${stToggle(s)}</div></div>`;
      }).join("") + offRows) || `<div class="at-empty">এই ব্যাচে কোনো শিক্ষার্থী নেই</div>`;
      $("#attQ").value = "";
      paintLock();
      summary();
    };
    bsel(); draw();
    $("#attLock").onclick = () => { moveLock = !moveLock; paintLock(); };
    $("#ad").onchange = fresh; $("#ase").onchange = () => { bsel(); fresh(); };
    $("#arows").onchange = async (e) => {
      const sid = e.target.dataset.move; if (!sid || !e.target.value) return;
      const s = studentById(sid), to = e.target.value;
      if (!confirm(`"${s.name}"-কে ${batchName(s.batchId)} থেকে ${batchName(to)} ব্যাচে নেবেন?`)) { e.target.value = ""; return; }
      try { await save("students", { ...s, batchId: to }, sid); await load(); toast(`${s.name} এখন ${batchName(to)} ব্যাচে`); keepDraw(); }
      catch (er) { e.target.value = ""; toast(er.message, true); }
    };
    $("#arows").onclick = (e) => {
      const st = e.target.closest("[data-status]");
      if (st) return togglePause(studentById(st.dataset.status), keepDraw);
      const tk =e.target.closest("input[data-tk]");
      if (tk) { const sid = tk.closest(".at-person").dataset.sid; (ticks[sid] ||= {})[tk.dataset.tk] = tk.checked; paintRow(sid); return summary(); }
      const btn = e.target.closest("button[data-v]"); if (!btn) return;
      const sid = btn.parentElement.dataset.sid;
      marks[sid] = marks[sid] === btn.dataset.v ? undefined : btn.dataset.v;
      if (marks[sid] !== "P") ticks[sid] = { hw: false, lesson: false }; // অনুপস্থিত / ছুটি দিলে টিক উঠে যায়
      paintRow(sid); summary();
    };
    // খোঁজা: শুধু দেখা যাওয়া সারিতেই "সবাইকে একসাথে" কাজ করে
    $("#attQ").oninput = (e) => { const q = e.target.value.trim().toLowerCase().replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d)); rows().forEach((r) => (r.hidden = !!q && !r.dataset.q.includes(q))); };
    $$("[data-all]", c).forEach((b) => (b.onclick = () => { rows().filter((r) => !r.hidden).forEach((r) => { const sid = r.dataset.sid; marks[sid] = b.dataset.all; if (b.dataset.all !== "P") ticks[sid] = { hw: false, lesson: false }; paintRow(sid); }); summary(); }));
    $("#attClean").onclick = () => { rows().forEach((r) => { marks[r.dataset.sid] = undefined; ticks[r.dataset.sid] = { hw: false, lesson: false }; paintRow(r.dataset.sid); }); summary(); toast("চিহ্ন মুছে গেছে — সেভ করলে তবেই বদলাবে"); };
    $("#saveAtt").onclick = async () => {
      if (!$("#abSel").value) return toast("ব্যাচ বেছে নিন", true);
      const clean = Object.fromEntries(Object.entries(marks).filter(([, v]) => v));
      // কারো হাজিরা বাকি থাকলে আগে জিজ্ঞেস — চিহ্ন না দেওয়া মানে উপস্থিত নয়, তার কোনো হাজিরাই সেভ হয় না
      const left = [...new Set(rows().map((r) => r.dataset.sid))].filter((sid) => !clean[sid]);
      if (left.length && Object.keys(clean).length) {
        if (!confirm(`${bn(left.length)} জনের হাজিরা এখনো দেওয়া হয়নি।\n\nOK = বাকি ${bn(left.length)} জনকে উপস্থিত ধরে সেভ\nCancel = ফিরে গিয়ে নিজে চিহ্ন দিন`)) return;
        left.forEach((sid) => { marks[sid] = clean[sid] = "P"; paintRow(sid); }); summary();
      }
      const tks = Object.fromEntries(Object.entries(ticks).filter(([sid]) => clean[sid] === "P"));
      try { await api("/api/admin/attendance", { body: { date: $("#ad").value, batchId: $("#abSel").value, marks: clean, ticks: tks } }); await load(); toast("হাজিরা, বাড়ির কাজ ও পড়া সেভ হয়েছে"); draw(); callBadge(); }
      catch (e) { toast(e.message, true); }
    };
  }

  // ---------- ফি ও পেমেন্ট ----------
  function paymentForm(studentId, onSaved) {
    const studs = DB.students.filter(s => s.status !== "inactive" || s.id === studentId).map((s) => [s.id, `${s.id} — ${s.name}`]);
    openForm({
      title: "পেমেন্ট নিন", saveText: "সেভ ও রসিদ প্রিন্ট",
      fields: [
        { name: "studentId", label: "শিক্ষার্থী", type: "select", options: [["", "বেছে নিন"], ...studs], required: true },
        { name: "idQ", label: "অথবা আইডি লিখুন", placeholder: "যেমন: 270001" },
        { type: "html", html: '<div id="payInfo" style="color:var(--muted)"></div>' },
        { name: "enrollmentId", label: "কোন মডিউলের ফি", type: "select", options: [["", "সাধারণ"]], wide: true },
        { name: "amount", label: "টাকার পরিমাণ", type: "number", min: 1, required: true },
        { name: "month", label: "কোন মাসের ফি", type: "month", value: thisMonth() },
        { name: "method", label: "মাধ্যম", type: "select", options: METHODS },
        { name: "date", label: "তারিখ", type: "date", value: U.today() },
        { name: "note", label: "নোট", wide: true, placeholder: "যেমন: অক্টোবর মাসের ফি" },
      ],
      values: { studentId, idQ: studentId },
      onSave: async (d) => {
        delete d.idQ;
        const r = await save("payments", d);
        await load();
        if (location.hash.startsWith("#fees")) route();
        else onSaved?.();
        toast("পেমেন্ট সেভ হয়েছে");
        printReceipt(DB.payments.find((p) => p.id === r.item.id));
      },
    });
    const sel = $('#modalBody [name="studentId"]'), idQ = $('#modalBody [name="idQ"]'), amt = $('#modalBody [name="amount"]'), es = $('#modalBody [name="enrollmentId"]');
    const info = () => {
      const s = studentById(sel.value), typed = idQ.value.trim();
      $("#payInfo").innerHTML = s ? `${esc(s.session || "")} · ${esc(batchName(s.batchId))} · ${balanceChip(s.fees)}` : typed ? `<span style="color:var(--bad)">এই আইডির কোনো সক্রিয় শিক্ষার্থী নেই</span>` : "";
      es.innerHTML = opt([["", "সাধারণ"], ...(s ? s.fees.items.filter((i) => i.status === "active").map((i) => [i.enrollmentId, `${i.course} — ${money(i.net)}${i.monthly ? "/মাস" : ""}`]) : [])], s && s.fees.items[0] ? s.fees.items[0].enrollmentId : "");
      const it = s && s.fees.items.find((i) => i.enrollmentId === es.value);
      if (s && !amt.value) amt.value = Math.max(0, Math.min(s.fees.balance, it && it.monthly ? it.net : s.fees.balance)) || "";
    };
    sel.addEventListener("change", () => { idQ.value = sel.value; amt.value = ""; info(); });
    // আইডি লিখলে (বাংলা অঙ্কেও) তালিকা নিজে থেকে সেই শিক্ষার্থীতে যায়
    idQ.addEventListener("input", () => { const id = idQ.value.trim().replace(/[০-৯]/g, (x) => "০১২৩৪৫৬৭৮৯".indexOf(x)); sel.value = studs.some(([k]) => k === id) ? id : ""; amt.value = ""; info(); });
    idQ.addEventListener("keydown", (e) => { if (e.key === "Enter") e.preventDefault(); });
    info();
  }
  // ---------- ব্লাড ব্যাংক: শিক্ষার্থীর তথ্য থেকে — রক্তের গ্রুপ আর শিক্ষার্থী / অভিভাবক / বাবা / মায়ের নম্বর ----------
  const bb = { q: "", g: "", sess: "", batch: "", old: false };
  function bloodBank(c) {
    const GROUPS = U.BLOOD_GROUPS.filter((x) => /^(A|B|AB|O)[+-]$/.test(x));
    const norm = (v) => String(v || "").toUpperCase().replace(/\s+/g, "").replace("−", "-");
    const groupOf = (s) => (GROUPS.includes(norm(s.bloodGroup)) ? norm(s.bloodGroup) : "");
    const pool = () => DB.students.filter((s) => bb.old || s.status !== "inactive");
    const sessions = [...new Set(DB.students.map((s) => s.session).filter(Boolean))].sort();
    c.innerHTML = `<div class="card bb">
      <div class="card-head"><div><h2>ব্লাড ব্যাংক</h2><small class="muted">শিক্ষার্থীর ভর্তির তথ্য থেকে — রক্তের গ্রুপ বদলাতে শিক্ষার্থীর তথ্য সম্পাদনা করুন</small></div>
        <div class="toolbar" style="margin:0"><button type="button" class="btn line" id="bbPrint">প্রিন্ট / PDF</button><button type="button" class="btn line" id="bbXl">Excel</button></div></div>
      <div class="bb-groups" id="bbGroups"></div>
      <div class="toolbar bb-bar">
        <input class="grow" id="bbQ" placeholder="নাম, আইডি বা মোবাইল" value="${esc(bb.q)}">
        <select id="bbS">${opt([["", "সব সেশন"], ...sessions.map((x) => [x, x])], bb.sess)}</select>
        <select id="bbB"></select>
        <label class="check bb-old"><input type="checkbox" id="bbOld"${bb.old ? " checked" : ""}> নিষ্ক্রিয় শিক্ষার্থীসহ</label>
      </div>
      <div class="tbl-wrap"><table class="bb-tbl"><thead><tr><th class="c">নং</th><th>শিক্ষার্থী</th><th class="c">রক্তের গ্রুপ</th><th>শিক্ষার্থীর নম্বর</th><th>অভিভাবকের নম্বর</th><th>বাবার নম্বর</th><th>মায়ের নম্বর</th></tr></thead><tbody id="bbRows"></tbody></table></div>
    </div>`;
    const batchOpts = () => { const L = DB.batches.filter((b) => !bb.sess || b.session === bb.sess); if (!L.some((b) => b.id === bb.batch)) bb.batch = ""; return opt([["", "সব ব্যাচ"], ...L.map((b) => [b.id, U.batchLabel(b)])], bb.batch); };
    const list = () => {
      const q = bb.q.trim().toLowerCase();
      return pool().filter((s) => (!bb.sess || s.session === bb.sess) && (!bb.batch || s.batchId === bb.batch)
        && (!bb.g || (bb.g === "?" ? !groupOf(s) : groupOf(s) === bb.g))
        && (!q || [s.name, s.nameEn, s.id, s.phone, s.guardianPhone, s.fatherPhone, s.motherPhone].join(" ").toLowerCase().includes(q)))
        .sort((a, b) => (groupOf(a) || "zz").localeCompare(groupOf(b) || "zz") || a.id.localeCompare(b.id));
    };
    const tel = (n, who) => n ? `<a class="bb-tel" href="tel:${esc(n)}">${esc(n)}</a>${who ? `<small>${esc(who)}</small>` : ""}` : '<span class="muted">—</span>';
    const draw = () => {
      // গ্রুপের ঘর: সেশন / ব্যাচ ফিল্টার মেনে কতজন
      const base = pool().filter((s) => (!bb.sess || s.session === bb.sess) && (!bb.batch || s.batchId === bb.batch));
      const cnt = (g) => base.filter((s) => (g === "?" ? !groupOf(s) : groupOf(s) === g)).length;
      $("#bbGroups").innerHTML = [["", "সব", base.length], ...GROUPS.map((g) => [g, g, cnt(g)]), ["?", "জানা নেই", cnt("?")]]
        .map(([g, l, n]) => `<button type="button" class="bb-g${bb.g === g ? " on" : ""}${g === "?" ? " unk" : ""}" data-g="${g}"><b>${l}</b><small>${bn(n)} জন</small></button>`).join("");
      const L = list();
      $("#bbRows").innerHTML = L.map((s, i) => `<tr${s.status === "inactive" ? ' class="off"' : ""}><td class="c">${bn(i + 1)}</td>
        <td><b>${esc(s.name)}</b><small>${esc(s.id)} · ${esc([s.session, batchName(s.batchId)].filter(Boolean).join(" · ") || "—")}${s.status === "inactive" ? " · নিষ্ক্রিয়" : ""}</small></td>
        <td class="c">${groupOf(s) ? `<span class="bb-badge">${groupOf(s)}</span>` : '<span class="muted">জানা নেই</span>'}</td>
        <td>${tel(s.phone)}</td><td>${tel(s.guardianPhone, [s.guardianName, s.guardianRelation && "(" + s.guardianRelation + ")"].filter(Boolean).join(" "))}</td>
        <td>${tel(s.fatherPhone, s.fatherName)}</td><td>${tel(s.motherPhone, s.motherName)}</td></tr>`).join("")
        || '<tr><td colspan="7" class="empty">এই খোঁজে কেউ নেই</td></tr>';
    };
    $("#bbB").innerHTML = batchOpts();
    $("#bbGroups").onclick = (e) => { const t = e.target.closest("[data-g]"); if (t) { bb.g = t.dataset.g; draw(); } };
    $("#bbQ").oninput = (e) => { bb.q = e.target.value; draw(); };
    $("#bbS").onchange = (e) => { bb.sess = e.target.value; $("#bbB").innerHTML = batchOpts(); draw(); };
    $("#bbB").onchange = (e) => { bb.batch = e.target.value; draw(); };
    $("#bbOld").onchange = (e) => { bb.old = e.target.checked; draw(); };
    $("#bbPrint").onclick = () => printPage($(".bb", c));
    $("#bbXl").onclick = () => {
      const L = list();
      if (!L.length) return toast("এই খোঁজে কেউ নেই", true);
      U.xlsx(`blood-bank-${bb.g ? bb.g.replace("+", "pos").replace("-", "neg") + "-" : ""}${U.today()}.xlsx`, ["আইডি", "নাম", "সেশন", "ব্যাচ", "রক্তের গ্রুপ", "শিক্ষার্থীর নম্বর", "অভিভাবক", "অভিভাবকের নম্বর", "বাবা", "বাবার নম্বর", "মা", "মায়ের নম্বর"],
        L.map((s) => [s.id, s.name, s.session || "", batchName(s.batchId), groupOf(s) || "জানা নেই", s.phone || "", s.guardianName || "", s.guardianPhone || "", s.fatherName || "", s.fatherPhone || "", s.motherName || "", s.motherPhone || ""]));
    };
    draw();
  }

  // ব্যাচ ভিত্তিক পেমেন্ট: ব্যাচ + মাস বাছলে পুরো ব্যাচের তালিকা; টিক দেওয়া সবার পেমেন্ট একসাথে সেভ
  let bpBatch = "", bpSess = "", remindTo = "guardian";
  let remindMsg = "আসসালামু আলাইকুম। {নাম} (আইডি {আইডি})-এর ফি বাবদ {বকেয়া} টাকা বকেয়া আছে{মাসসমূহ}। অনুগ্রহ করে দ্রুত পরিশোধ করুন। — {প্রতিষ্ঠান}";
  function batchPay(body) {
    const $$ = (q, r = document) => [...r.querySelectorAll(q)];
    const batches = DB.batches;
    const sessions = [...new Set([...DB.sessions.map((x) => x.name), ...batches.map((x) => x.session)])].filter((se) => batches.some((x) => x.session === se));
    if (!sessions.includes(bpSess)) bpSess = sessions.find((se) => batches.some((b) => b.session === se && activeStudents().some((s) => s.batchId === b.id))) || sessions[0] || "";
    const sessBatches = () => batches.filter((b) => b.session === bpSess);
    // শুরুতে যে ব্যাচে শিক্ষার্থী আছে সেটা
    const firstBatch = () => { const L = sessBatches(); return (L.find((b) => activeStudents().some((s) => s.batchId === b.id)) || L[0] || {}).id || ""; };
    if (bpBatch !== "*" && !sessBatches().some((b) => b.id === bpBatch)) bpBatch = firstBatch();
    const batchOpts = () => opt([...sessBatches().map((b) => [b.id, U.batchLabel(b)]), ["*", "সব ব্যাচ"]], bpBatch);
    body.innerHTML = `<div class="toolbar bp-bar">
        <label>সেশন<select id="bpS">${opt(sessions.map((se) => [se, se]), bpSess)}</select></label>
        <label>ব্যাচসমূহ<select id="bpB">${batchOpts()}</select></label>
        <label>কোন মাসের ফি<input type="month" id="bpM" value="${thisMonth()}"></label>
        <label>মাধ্যম<select id="bpMt">${opt(METHODS, METHODS[0][0])}</select></label>
        <label>তারিখ<input type="date" id="bpD" value="${U.today()}"></label>
        <button type="button" class="btn line bp-pdf" id="bpPdf" title="এই ব্যাচের পুরো পেমেন্ট শিট — প্রিন্ট বা PDF">পেমেন্ট শিট (PDF)</button>
        <button type="button" class="btn line bp-pdf" id="bpCard" title="প্রত্যেকের বেতন কার্ড — A4-এ ৩টি করে, কেটে রসিদের মতো দেওয়ার জন্য">বেতন কার্ড (PDF)</button>
        <button type="button" class="btn gold bp-pdf" id="bpDues">ব্যাচের বকেয়া দেখুন</button>
        <button type="button" class="btn line bp-pdf" id="bpRemind" title="বকেয়া আছে যাদের — WhatsApp বা Bulk SMS (Excel)">বকেয়ার তাগাদা</button>
      </div>
      <p class="bp-due-summary" id="bpDueSummary" aria-live="polite"></p>
      <p class="bp-hint">যে টাকা দিচ্ছে তার Pay ঘরে টাকা লিখুন — শুধু তাদেরই পেমেন্ট সেভ হবে। Due = মোট বকেয়া থেকে Pay বাদে বাকি।</p>
      <div class="tbl-wrap"><table class="bp-tbl"><thead id="bpHead"></thead><tbody id="bpRows"></tbody></table></div>
      <div class="bp-foot"><span id="bpSum"></span><button type="button" class="btn gold" id="bpSave">সেভ করুন</button></div>`;
    const studs = () => activeStudents().filter((s) => (bpBatch === "*" ? sessBatches().some((b) => b.id === s.batchId) : s.batchId === bpBatch)).sort((a, b) => a.id.localeCompare(b.id));
    const overdue = (students) => students.filter(s => s.fees.balance > 0);
    const dueTotal = (students) => students.reduce((total, s) => total + s.fees.balance, 0);
    $("#bpDues").onclick = () => {
      const due = overdue(studs());
      const batch = bpBatch === "*" ? "সব ব্যাচ" : batchName(bpBatch);
      openModal({
        title: `বকেয়া তালিকা · ${bpSess} · ${batch}`,
        body: due.length ? `<p><b>${bn(due.length)} জনের মোট বকেয়া ${money(dueTotal(due))}</b></p>
          <div class="tbl-wrap"><table><thead><tr><th>আইডি</th><th>শিক্ষার্থী</th><th>ব্যাচ</th><th class="num">বকেয়া</th></tr></thead>
          <tbody>${due.map(s => `<tr><td>${esc(s.id)}</td><td>${esc(s.name)}</td><td>${esc(batchName(s.batchId))}</td><td class="num">${money(s.fees.balance)}</td></tr>`).join("")}</tbody></table></div>`
          : '<p class="empty">বাছাই করা ব্যাচে সক্রিয় শিক্ষার্থীদের কোনো বকেয়া নেই।</p>',
      });
    };
    const itemOf = (s, enr) => s.fees.items.find((i) => i.enrollmentId === enr);
    // বাছাই করা মাসসহ শেষ ৩ মাস (পুরনো থেকে নতুন)
    const last3 = () => { const [Y, M] = ($("#bpM").value || thisMonth()).split("-").map(Number); return [2, 1, 0].map((k) => { const d = new Date(Y, M - 1 - k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }); };
    // মাসের বকেয়া: ভর্তির মাস থেকে প্রতি মাসের ফি (বন্ধ / ছুটিতে কম ধরা হলে সেটা); এই মডিউলে যত টাকা দেওয়া হয়েছে
    // তা পুরনো মাস থেকে শোধ ধরা হয় — তাই মাসের ঘরগুলো সবসময় মোট বকেয়ার সাথে মেলে। ভর্তির আগের বা সামনের মাস = "—"
    const monthDues = (s, it) => {
      const out = {}, from = (it.startDate || "").slice(0, 7), to = thisMonth();
      if (!from) return out;
      const solo = s.fees.items.length === 1; // একটাই মডিউল হলে "সাধারণ" পেমেন্টও এই মডিউলের
      let pool = DB.payments.filter((p) => p.studentId === s.id && (p.enrollmentId === it.enrollmentId || (solo && !p.enrollmentId))).reduce((t, p) => t + p.amount, 0);
      let [Y, M] = from.split("-").map(Number);
      for (let mk = from; mk <= to; ) {
        const adj = (it.adjust || []).find((x) => x.month === mk), fee = adj ? adj.fee : it.net, got = Math.min(pool, fee);
        pool -= got; out[mk] = fee - got;
        M++; if (M > 12) { M = 1; Y++; } mk = `${Y}-${String(M).padStart(2, "0")}`;
      }
      return out;
    };
    const monthDue = (s, it, mk) => { if (!it || !it.monthly) return null; const d = monthDues(s, it); return mk in d ? d[mk] : null; };
    const dueCell = (v, i) => v === null ? `<td class="c muted bp-m${i}">—</td>` : `<td class="c bp-m${i}">${v > 0 ? `<span class="chip bad">${money(v)}</span>` : '<span class="chip ok">পরিশোধ</span>'}</td>`;
    // মাসের ঘর: মাসিক মডিউলে মাসের বকেয়া, কোর্সে (মাসিক নয়) মাসিক ফির মতো "—"
    const midCells = (s, it) => last3().map((mk, i) => dueCell(it && it.monthly ? monthDue(s, it, mk) : null, i)).join("");
    const totCell = (s) => `<td class="num">${s.fees.balance > 0 ? `<span class="chip bad">${money(s.fees.balance)}</span>` : '<span class="chip ok">নেই</span>'}</td>`;
    const feeCell = (it) => it && it.monthly ? money(it.net) : "—";
    const left = (s, pay) => s.fees.balance - (Number(pay) || 0);
    const leftCell = (s, pay) => { const v = left(s, pay); return v > 0 ? `<b class="bp-due">${money(v)}</b>` : v < 0 ? `<b class="bp-adv">অগ্রিম ${money(-v)}</b>` : '<b class="bp-ok">০</b>'; };
    const draw = () => {
      const students = studs(), due = overdue(students);
      $("#bpDueSummary").textContent = `বর্তমান মোট বকেয়া ${money(dueTotal(due))} · বকেয়া আছে ${bn(due.length)} জনের`;
      $("#bpHead").innerHTML = `<tr><th rowspan="2">শিক্ষার্থী</th><th rowspan="2">মডিউল</th><th rowspan="2" class="c">মাসিক ফি</th><th colspan="3" class="c bp-grp">বকেয়া (শেষ ৩ মাস)</th><th rowspan="2" class="num">মোট বকেয়া</th><th rowspan="2" class="num">Pay</th><th rowspan="2" class="num">Due</th></tr>
        <tr>${last3().map((mk, i) => `<th class="c bp-m${i}">${U.month(mk)}</th>`).join("")}</tr>`;
      $("#bpRows").innerHTML = students.map((s) => {
        const items = s.fees.items.filter((i) => i.status === "active"), it = items[0];
        return `<tr data-sid="${s.id}">
          <td class="bp-who"><b>${esc(s.name)}</b><small>${esc(s.id)}${bpBatch === "*" ? " · " + esc(batchName(s.batchId)) : ""}</small></td>
          <td><select class="bp-enr">${opt([["", "সাধারণ"], ...items.map((i) => [i.enrollmentId, i.course])], it ? it.enrollmentId : "")}</select></td>
          <td class="c bp-fee">${feeCell(it)}</td>${midCells(s, it)}${totCell(s)}
          <td class="num"><input type="number" class="bp-amt marks-input" min="1" placeholder="৳"></td>
          <td class="num bp-left">${leftCell(s, 0)}</td></tr>`;
      }).join("") || '<tr><td colspan="9" class="empty">এই ব্যাচে কোনো সক্রিয় শিক্ষার্থী নেই</td></tr>';
      sum();
    };
    const picked = () => [...$$("#bpRows tr[data-sid]")].filter((tr) => Number($(".bp-amt", tr).value) > 0);
    const sum = () => {
      const P = picked(), tot = P.reduce((t, tr) => t + Number($(".bp-amt", tr).value || 0), 0);
      $("#bpSum").innerHTML = P.length ? `Pay দিয়েছেন <b>${bn(P.length)}</b> জন · মোট <b>${money(tot)}</b>` : "কারো Pay ঘরে এখনো টাকা লেখা হয়নি";
      $("#bpSave").disabled = !P.length;
    };
    // পুরো ব্যাচের পেমেন্ট শিট: টেবিলে এখন যা দেখা যাচ্ছে (মডিউল, Pay-তে লেখা টাকা সহ) — A4 আড়াআড়ি, শেষে যোগফল ও স্বাক্ষর
    $("#bpPdf").onclick = () => {
      const months = last3(), st = DB.settings, org = st.nameBn || "শাহিন'স আইসিটি কেয়ার";
      const rows = [...$$("#bpRows tr[data-sid]")].map((tr) => {
        const s = studentById(tr.dataset.sid), it = itemOf(s, $(".bp-enr", tr).value), pay = Number($(".bp-amt", tr).value) || 0;
        return { s, it, pay, md: months.map((mk) => (it && it.monthly ? monthDue(s, it, mk) : null)), tot: s.fees.balance, left: s.fees.balance - pay };
      });
      if (!rows.length) return toast("এই ব্যাচে কোনো সক্রিয় শিক্ষার্থী নেই", true);
      const sumOf = (f) => rows.reduce((t, r) => t + (f(r) || 0), 0);
      const m = (v) => (v === null ? "—" : v > 0 ? money(v) : "পরিশোধ");
      const bName = bpSess + " · " + (bpBatch === "*" ? "সব ব্যাচ" : batchName(bpBatch));
      const w = window.open("", "_blank");
      if (!w) return toast("পপ-আপ বন্ধ আছে — ব্রাউজারে পপ-আপের অনুমতি দিন", true);
      w.document.write(`<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>Payment Sheet — ${esc(bName)} — ${esc(U.month($("#bpM").value))}</title>
        <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@700;900&display=swap" rel="stylesheet">
        <style>${U.TIRO_CSS}*{box-sizing:border-box}@page{size:A4 landscape;margin:10mm}
        body{margin:0;background:#eef2f0;font-family:'Hind Siliguri','Nirmala UI',sans-serif;color:#1d2b28;font-size:12.5px}
        .pg{width:277mm;margin:8mm auto;padding:8mm 9mm;background:#fff;box-shadow:0 6px 24px rgba(0,0,0,.08)}
        .hd{display:flex;align-items:center;gap:12px;padding-bottom:8px;border-bottom:2px solid #0b3b36}
        .hd img{width:46px;height:46px;object-fit:contain}.hd b{display:block;font:900 20px/1.2 'Noto Serif Bengali',serif;color:#0b3b36}.hd small{color:#55625f}
        .hd .tt{margin-left:auto;text-align:right}.hd .tt b{font:700 17px 'Hind Siliguri',sans-serif;color:#1d2b28}
        .meta{display:flex;flex-wrap:wrap;gap:6px 22px;margin:10px 0;font-size:13px}.meta span b{color:#0b3b36}
        table{width:100%;border-collapse:collapse}th,td{border:1px solid #cfd8d4;padding:5px 6px;text-align:left;vertical-align:middle}
        thead th{background:#f1f5f3;font-weight:700;font-size:12px;text-align:center!important}.c{text-align:center}.n{text-align:right;white-space:nowrap}
        td small{display:block;color:#6a7a76;font-size:11px}
        .m0{background:#fffaf5}.m1{background:#fdf8fb}.m2{background:#f6fbfb}thead .m0{background:#fdf1e6}thead .m1{background:#f8ecf3}thead .m2{background:#e7f4f3}
        .due{color:#b4233c;font-weight:600}.ok{color:#0b6b45}.pay{font-weight:700}tbody tr:nth-child(even) td:not(.m0):not(.m1):not(.m2){background:#fbfcfc}
        tfoot td{background:#f1f5f3;font-weight:700}
        .sg{display:flex;justify-content:space-between;margin-top:26mm}.sg span{width:60mm;border-top:1.3px solid #1d2b28;padding-top:4px;text-align:center;font-weight:600}
        .ft{margin-top:8px;color:#6a7a76;font-size:11px;text-align:right}
        .receipt-signature{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);width:29mm;height:7mm;object-fit:contain}
      .pb{position:sticky;top:0;background:#0b3b36;color:#fff;text-align:center;padding:8px;z-index:2}.pb button{font:inherit;font-weight:700;padding:6px 18px;border:0;border-radius:999px;background:#f3c55d;cursor:pointer}
        thead{display:table-header-group}tr{break-inside:avoid}
        @media print{body{background:#fff}.pb{display:none}.pg{width:auto;margin:0;padding:0;box-shadow:none}}</style></head><body>
        <div class="pb"><b style="margin-right:10px">পেমেন্ট শিট — ${bn(rows.length)} জন</b><button onclick="print()">প্রিন্ট / PDF</button> <button onclick="window.close()" style="background:rgba(255,255,255,.18);color:#fff">✕ বন্ধ করুন</button></div>
        <div class="pg">
          <div class="hd"><img src="${location.origin}/images/logo-receipt.png" alt=""><div><b>${esc(org)}</b><small>${esc(st.address || "")}${st.phone ? " · " + esc(st.phone) : ""}</small></div><div class="tt"><b>ব্যাচ পেমেন্ট শিট</b><small>${esc(U.month($("#bpM").value))}-এর ফি</small></div></div>
          <div class="meta"><span>সেশন · ব্যাচ: <b>${esc(bName)}</b></span><span>কোন মাসের ফি: <b>${esc(U.month($("#bpM").value))}</b></span><span>মাধ্যম: <b>${esc($("#bpMt").value)}</b></span><span>তারিখ: <b>${U.date($("#bpD").value)}</b></span><span>শিক্ষার্থী: <b>${bn(rows.length)} জন</b></span></div>
          <table><thead><tr><th rowspan="2" class="c">নং</th><th rowspan="2">শিক্ষার্থী</th><th rowspan="2">মডিউল</th><th rowspan="2" class="c">মাসিক ফি</th><th colspan="3" class="c">বকেয়া (শেষ ৩ মাস)</th><th rowspan="2" class="n">মোট বকেয়া</th><th rowspan="2" class="n">Pay</th><th rowspan="2" class="n">Due</th></tr>
            <tr>${months.map((mk, i) => `<th class="c m${i}">${U.month(mk)}</th>`).join("")}</tr></thead>
            <tbody>${rows.map((r, k) => `<tr><td class="c">${bn(k + 1)}</td><td><b>${esc(r.s.name)}</b><small>${esc(r.s.id)}${bpBatch === "*" ? " · " + esc(batchName(r.s.batchId)) : ""}</small></td><td>${esc(r.it ? r.it.course : "সাধারণ")}</td>
              <td class="c">${r.it && r.it.monthly ? money(r.it.net) : "—"}</td>${r.md.map((v, i) => `<td class="c m${i} ${v > 0 ? "due" : v === 0 ? "ok" : ""}">${m(v)}</td>`).join("")}
              <td class="n ${r.tot > 0 ? "due" : "ok"}">${r.tot > 0 ? money(r.tot) : "নেই"}</td><td class="n pay">${r.pay ? money(r.pay) : ""}</td><td class="n ${r.left > 0 ? "due" : "ok"}">${r.left > 0 ? money(r.left) : r.left < 0 ? "অগ্রিম " + money(-r.left) : "০"}</td></tr>`).join("")}</tbody>
            <tfoot><tr><td colspan="4" class="n">মোট</td>${months.map((mk, i) => `<td class="c m${i}">${money(sumOf((r) => r.md[i]))}</td>`).join("")}<td class="n">${money(sumOf((r) => Math.max(0, r.tot)))}</td><td class="n">${money(sumOf((r) => r.pay))}</td><td class="n">${money(sumOf((r) => Math.max(0, r.left)))}</td></tr></tfoot></table>
          <div class="sg"><span>হিসাবরক্ষকের স্বাক্ষর</span>${U.sig("পরিচালকের স্বাক্ষর")}</div>
          <div class="ft">প্রিন্টের সময়: ${U.date(U.today())} · ${esc(org)}</div>
        </div></body></html>`);
      w.document.close();
    };
    // বেতন কার্ড: প্রত্যেক শিক্ষার্থীর আলাদা কার্ড — মাসওয়ারি ফি / জমা / বকেয়া আর সাম্প্রতিক পেমেন্ট; A4-এ ৩টি করে, মাঝে কাটার দাগ
    $("#bpCard").onclick = () => {
      const st = DB.settings, org = st.nameBn || "শাহিন'স আইসিটি কেয়ার", mo = $("#bpM").value || thisMonth();
      const trs = [...$$("#bpRows tr[data-sid]")];
      if (!trs.length) return toast("এই ব্যাচে কোনো সক্রিয় শিক্ষার্থী নেই", true);
      // বাছাই করা মাসসহ শেষ ৩ মাস; আগে "পূর্বের দেনা" (তার আগের সব মাস), শেষে "মোট দেনা"
      const [Y, M] = mo.split("-").map(Number);
      const months = [2, 1, 0].map((k) => { const d = new Date(Y, M - 1 - k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
      const short = (mk) => U.month(mk).replace(/\s*২০\S\S$/, "") + " '" + bn(mk.slice(2, 4));
      // কার্ডের নিচের অংশ: বার্তা (সেটিংস → পেমেন্ট সেটিংস থেকে বদলানো যায়) আর বিকাশ / নগদ / রকেট নম্বর
      const cardNote = st.cardNote || "আগামী ১০ তারিখের মধ্যে বকেয়া পরিশোধ করুন।";
      // ফি দেওয়ার তিন পথ: অফিসে নগদ টাকায়, মোবাইল ব্যাংকিং (একই নম্বর হলে একবার), ব্যাংক (সেটিংসের ব্যাংক অ্যাকাউন্ট ঘরের প্রথম ৩ লাইনের মান; না থাকলে লাইনটা নেই)
      const mob = [["বিকাশ", st.payBkash], ["নগদ", st.payNagad], ["রকেট", st.payRocket]].filter((x) => x[1]);
      const mobTxt = mob.length && new Set(mob.map((x) => x[1])).size === 1 ? `${mob.map((x) => x[0]).join("/")}: <b>${esc(mob[0][1])}</b>` : mob.map(([n, v]) => `${n}: <b>${esc(v)}</b>`).join(" · ");
      const bankTxt = String(st.payBank || "").split(/\r?\n/).map((x) => x.replace(/^[^:]*:\s*/, "").trim()).filter(Boolean).slice(0, 3).map((x) => (/^[0-9 -]{6,}$/.test(x) ? `<b>${esc(x)}</b>` : esc(x))).join(" · ");
      const payWays = `<div class="pw"><em>অফিসে</em><span>নগদ টাকায় সরাসরি পরিশোধ</span>${mobTxt ? `<em>মোবাইল ব্যাংকিং</em><span>${mobTxt}</span>` : ""}${bankTxt ? `<em>ব্যাংক</em><span>${bankTxt}</span>` : ""}</div>`;
      const card = (tr) => {
        const s = studentById(tr.dataset.sid), it = itemOf(s, $(".bp-enr", tr).value), monthly = it && it.monthly;
        const dues = monthly ? monthDues(s, it) : {};
        const feeOf = (mk) => { const adj = (it.adjust || []).find((x) => x.month === mk); return adj ? adj.fee : it.net; };
        // পূর্বের দেনা = দেখানো ৩ মাসের আগের সব মাস; মোট দেনা = বাছাই করা মাস পর্যন্ত সব মাস
        const keys = Object.keys(dues).filter((mk) => mk <= mo), prev = keys.filter((mk) => mk < months[0]);
        const sum = (list, f) => list.reduce((t, mk) => t + f(mk), 0);
        const col = (list) => ({ fee: sum(list, feeOf), paid: sum(list, (mk) => feeOf(mk) - dues[mk]), due: sum(list, (mk) => dues[mk]) });
        const P = col(prev), T = col(keys);
        const stat = (d, has) => (!has ? "—" : d > 0 ? "বাকি " + money(d) : "পরিশোধ");
        const grid = monthly ? `<table class="mg"><tr><th></th><th class="pv">পূর্বের দেনা</th>${months.map((mk) => `<th>${short(mk)}</th>`).join("")}<th class="tt2">মোট দেনা</th></tr>
          <tr><td>ফি</td><td class="pv">${prev.length ? money(P.fee) : "—"}</td>${months.map((mk) => `<td>${mk in dues ? money(feeOf(mk)) : "—"}</td>`).join("")}<td class="tt2 one${T.due > 0 ? "" : " paid"}" rowspan="3">${money(T.due)}</td></tr>
          <tr><td>জমা</td><td class="pv">${prev.length ? money(P.paid) : "—"}</td>${months.map((mk) => `<td>${mk in dues ? money(feeOf(mk) - dues[mk]) : "—"}</td>`).join("")}</tr>
          <tr><td>অবস্থা</td><td class="pv ${prev.length ? (P.due > 0 ? "due" : "ok") : ""}">${stat(P.due, prev.length)}</td>${months.map((mk) => `<td class="${!(mk in dues) ? "" : dues[mk] > 0 ? "due" : "ok"}">${stat(dues[mk], mk in dues)}</td>`).join("")}</tr></table>` : "";
        return `<section class="cd">
          <div class="hd"><img src="${location.origin}/images/logo-receipt.png" alt=""><div class="org"><b>${esc(org)}</b><small>${esc(st.address || "")}${st.phone ? " · " + esc(st.phone) : ""}</small></div>
            <div class="tt"><b>বেতন কার্ড</b><small>${esc(new Date(mo + "-01T00:00:00").toLocaleString("en-US", { month: "long" }) + "-" + mo.slice(2, 4))}</small></div></div>
          <div class="info"><span><i>নাম</i><b class="nm">${esc(s.name)}</b></span><span><i>আইডি</i><b>${esc(s.id)}</b></span><span><i>ভর্তির তারিখ</i><b>${s.admissionDate ? U.date(s.admissionDate) : "—"}</b></span><span><i>সেশন</i><b>${esc(s.session || "—")}</b></span><span><i>ব্যাচ</i><b>${(() => { const bt = DB.batches.find((x) => x.id === s.batchId); return esc(bt ? [bt.days, bt.time ? bt.time.replace(/s*টা$/, "") + " টা" : ""].filter(Boolean).join(": ") || bt.name : "—"); })()}</b></span>
            <span><i>মডিউল</i><b class="cl">${esc(it ? it.course : "সাধারণ")}</b></span><span><i>${monthly ? "মাসিক ফি" : "কোর্স ফি"}</i><b>${it ? money(it.net) : "—"}</b></span></div>
          <div class="body">${grid}<div class="nt"><div class="nt-m"><i>শিক্ষকের বার্তা</i><b>${esc(cardNote)}</b></div><div class="nt-p"><i>ফি দেওয়ার নিয়ম</i>${payWays}</div></div></div>
          <div class="ft"><div class="sg">গ্রহণকারীর স্বাক্ষর</div></div>
        </section>`;
      };
      const cards = trs.map(card), pages = [];
      for (let i = 0; i < cards.length; i += 3) pages.push(cards.slice(i, i + 3));
      const bName = bpSess + " · " + (bpBatch === "*" ? "সব ব্যাচ" : batchName(bpBatch));
      const w = window.open("", "_blank");
      if (!w) return toast("পপ-আপ বন্ধ আছে — ব্রাউজারে পপ-আপের অনুমতি দিন", true);
      w.document.write(`<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>বেতন কার্ড — ${esc(bName)} — ${esc(U.month(mo))}</title>
        <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@700;900&display=swap" rel="stylesheet">
        <style>${U.TIRO_CSS}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4 portrait;margin:6mm}
        body{margin:0;background:#e9eeec;font-family:'Hind Siliguri','Nirmala UI',sans-serif;color:#1d2b28;font-size:11px}
        .pg{width:198mm;height:285mm;margin:8mm auto;background:#fff;display:grid;grid-template-rows:repeat(3,1fr);box-shadow:0 6px 24px rgba(0,0,0,.08)}
        .cd{position:relative;padding:3.5mm 5mm 2mm;display:flex;flex-direction:column;gap:1.8mm;border:1.2px solid #0b3b36;border-radius:2mm;margin:3mm 2.5mm;min-height:0}
        .cd+.cd::before{content:"✂";position:absolute;left:-2.5mm;right:-2.5mm;top:-3.6mm;height:0;border-top:1.2px dashed #8a9a95;color:#5f6f6a;font-size:12px;line-height:0;text-indent:-1mm}
        .hd{display:flex;align-items:center;gap:3mm;padding-bottom:1.6mm;border-bottom:1.4px solid #0b3b36}
        .hd img{width:15mm;height:10mm;object-fit:contain}.org b{display:block;font:900 14px/1.15 'Noto Serif Bengali',serif;color:#0b3b36}.org small{color:#55625f;font-size:9.5px}
        .tt{margin-left:auto;text-align:center}.tt b{display:block;font:800 15px/1.1 'Hind Siliguri',sans-serif;color:#fff;background:#0b3b36;padding:1mm 3mm;border-radius:1.2mm}.tt small{display:block;margin-top:1mm;color:#0f766e;font:800 12px/1.1 'Hind Siliguri',sans-serif;letter-spacing:.3px} /* মাস-বছর (যেমন November-26) বেতন কার্ডের নিচে, মাঝ বরাবর, গাঢ় সবুজ */
        .mg .pv{background:#f3f5f4}.mg .tt2{background:#eef2f0;font-weight:800}.mg .tt2.one{font-size:15px;color:#b4233c;text-align:center;vertical-align:middle}.mg .tt2.one.paid{color:#15803d}
        .info{display:grid;grid-template-columns:50mm repeat(6,auto);gap:0;border:1px solid #cfd8d4;border-radius:1.2mm;overflow:hidden} /* নামের ঘর ৫০ মিমি (এর বেশি লম্বা নাম ছোট হয়ে এক লাইনে), বাকি জায়গা ডানের ঘরগুলোয় ভাগ হয় */
        .info span{padding:1mm 1.5mm;border-right:1px solid #e3e9e6;white-space:nowrap;min-width:0}.info .nm,.info .cl{display:block;overflow:hidden;text-overflow:ellipsis}.info .cl{max-width:34mm}.info span:last-child{border-right:0}.info i{display:block;font-style:normal;color:#6a7a76;font-size:8.5px}.info b{font-size:11px}
        .body{display:flex;flex-direction:column;gap:2mm;flex:1;min-height:0}
        .nt{display:grid;grid-template-columns:.85fr 1.35fr;flex:none;border:1px solid #cfd8d4;border-radius:1.2mm;overflow:hidden}
        .nt>div{padding:1mm 2.5mm;display:grid;gap:.4mm;align-content:start}.nt i{font-style:normal;font-weight:700;font-size:9.5px;color:#0f766e}
        .nt-m{background:#eef2f0;border-right:1px solid #cfd8d4}.nt-m b{font-size:11.5px;color:#0b3b36;line-height:1.35}
        .pw{display:grid;grid-template-columns:max-content 1fr;gap:.3mm 3mm;font-size:10.5px;line-height:1.3}.pw em{font-style:normal;font-weight:600;color:#55625f}.pw b{color:#0b3b36}
        table{width:100%;border-collapse:collapse}th,td{border:1px solid #d7dfdb;padding:.5mm 1.4mm;text-align:center;font-size:10px}
        th{background:#f1f5f3;font-weight:700}.mg td:first-child{font-weight:700;background:#f8faf9;text-align:left;width:14mm}
        .pl th,.pl td{text-align:left}.pl .n{text-align:right}.pl .c{text-align:center;color:#6a7a76}.pl .more{text-align:center;color:#6a7a76;font-size:9px}
        .due{color:#b4233c;font-weight:700}.ok{color:#0b6b45;font-weight:700}
        .ft{display:flex;align-items:flex-end;justify-content:flex-end}
        .sg{width:38mm;border-top:.6px solid #1d2b28;padding-top:.8mm;text-align:center;font-size:9.5px;font-weight:600}
        .receipt-signature{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);width:29mm;height:7mm;object-fit:contain}
      .pb{position:sticky;top:0;background:#0b3b36;color:#fff;text-align:center;padding:8px;z-index:2}.pb button{font:inherit;font-weight:700;padding:6px 18px;border:0;border-radius:999px;background:#f3c55d;cursor:pointer}
        @media print{body{background:#fff}.pb{display:none}.pg{margin:0 auto;box-shadow:none;break-after:page}.pg:last-child{break-after:auto}}</style></head><body>
        <div class="pb"><b style="margin-right:10px">বেতন কার্ড — ${bn(cards.length)} জন · ${bn(pages.length)} পাতা (প্রতি পাতায় ৩টি)</b><button onclick="print()">প্রিন্ট / PDF</button> <button onclick="window.close()" style="background:rgba(255,255,255,.18);color:#fff">✕ বন্ধ করুন</button></div>
        ${pages.map((pg) => `<div class="pg">${pg.join("")}</div>`).join("")}
        <script>/* খুব লম্বা নাম হলে দুই লাইনে না গিয়ে লেখা একটু ছোট হয় */function fit(){document.querySelectorAll(".nm").forEach(function(b){b.style.fontSize="";for(var z=11;z>8&&b.scrollWidth>b.clientWidth;)b.style.fontSize=(z-=.25)+"px"})}fit();if(document.fonts)document.fonts.ready.then(fit)</script>
        </body></html>`);
      w.document.close();
    };
    // বকেয়ার তাগাদা: যাদের বকেয়া আছে — বার্তা ঠিক করে একজন একজন করে WhatsApp, অথবা Bulk SMS-এর Excel
    $("#bpRemind").onclick = () => {
      const org = DB.settings.nameBn || "শাহিন'স আইসিটি কেয়ার"; // রসিদের মতো বাংলা নাম
      const bName = bpSess + " · " + (bpBatch === "*" ? "সব ব্যাচ" : batchName(bpBatch));
      const list = [...$$("#bpRows tr[data-sid]")].map((tr) => studentById(tr.dataset.sid)).filter((s) => s.fees.balance > 0).map((s) => {
        const months = s.fees.items.filter((i) => i.status === "active" && i.monthly).flatMap((it) => Object.entries(monthDues(s, it)).filter(([, v]) => v > 0).map(([mk]) => mk));
        return { s, due: s.fees.balance, months: [...new Set(months)].sort() };
      });
      if (!list.length) return toast("এই ব্যাচে কারো বকেয়া নেই");
      const phoneOf = (s) => String((remindTo === "guardian" ? s.guardianPhone || s.phone : s.phone || s.guardianPhone) || "").replace(/\D/g, "").replace(/^88/, "");
      const textOf = (r) => remindMsg.replace(/\{নাম\}/g, r.s.name).replace(/\{আইডি\}/g, r.s.id).replace(/\{বকেয়া\}/g, money(r.due).replace("৳", "")).replace(/\{ব্যাচ\}/g, batchName(r.s.batchId)).replace(/\{প্রতিষ্ঠান\}/g, org)
        .replace(/\{মাসসমূহ\}/g, r.months.length ? ` (${r.months.map((mk) => U.month(mk)).join(", ")})` : "");
      const sent = new Set();
      openModal({
        title: "বকেয়ার তাগাদা — " + bName, wide: true,
        body: `<div class="rm">
          <div class="rm-top"><div><b>${bn(list.length)} জনের</b> বকেয়া আছে · মোট <b>${money(list.reduce((t, r) => t + r.due, 0))}</b></div>
            <label>কাকে পাঠাবেন<select id="rmTo">${opt([["guardian", "অভিভাবকের নম্বরে"], ["student", "শিক্ষার্থীর নম্বরে"]], remindTo)}</select></label></div>
          <label class="rm-msg">বার্তা <small>{নাম} {আইডি} {বকেয়া} {মাসসমূহ} {ব্যাচ} {প্রতিষ্ঠান} — এগুলো প্রত্যেকের নিজের তথ্যে বদলে যাবে</small><textarea id="rmMsg" rows="3">${esc(remindMsg)}</textarea></label>
          <div class="rm-acts"><button type="button" class="btn gold" id="rmNext">পরের জনকে WhatsApp</button><button type="button" class="btn line" id="rmXl">Bulk SMS-এর Excel</button><span id="rmProg"></span></div>
          <div class="rm-list" id="rmList"></div></div>`,
      });
      const paint = () => {
        $("#rmList").innerHTML = list.map((r, i) => { const ph = phoneOf(r.s); return `<div class="rm-row${sent.has(i) ? " done" : ""}">
          <span class="bpc-n">${bn(i + 1)}</span><span class="rm-who"><b>${esc(r.s.name)}</b><small>${esc(r.s.id)} · ${esc(batchName(r.s.batchId))} · ${ph ? esc(ph) : "<em>নম্বর নেই</em>"}</small><i>${esc(textOf(r))}</i></span>
          <b class="rm-due">${money(r.due)}</b>${ph ? `<button type="button" class="btn sm ${sent.has(i) ? "line" : "wa"}" data-wa="${i}">${sent.has(i) ? "আবার পাঠান" : "WhatsApp"}</button>` : '<span class="muted">—</span>'}</div>`; }).join("");
        const can = list.filter((r) => phoneOf(r.s)).length;
        $("#rmProg").textContent = `পাঠানো হয়েছে ${bn(sent.size)} / ${bn(can)}`;
        $("#rmNext").disabled = !list.some((r, i) => phoneOf(r.s) && !sent.has(i));
      };
      const send = (i) => { const r = list[i]; window.open(waLink(phoneOf(r.s), textOf(r)), "_blank", "noopener"); sent.add(i); paint(); };
      $("#rmTo").onchange = (e) => { remindTo = e.target.value; paint(); };
      $("#rmMsg").oninput = (e) => { remindMsg = e.target.value; paint(); };
      $("#rmList").onclick = (e) => { const t = e.target.closest("[data-wa]"); if (t) send(Number(t.dataset.wa)); };
      $("#rmNext").onclick = () => { const i = list.findIndex((r, k) => phoneOf(r.s) && !sent.has(k)); if (i >= 0) send(i); };
      $("#rmXl").onclick = () => {
        const rows = list.filter((r) => phoneOf(r.s)).map((r) => ["88" + phoneOf(r.s), textOf(r), r.s.name, r.s.id, batchName(r.s.batchId), String(r.due)]);
        if (!rows.length) return toast("কারো নম্বর নেই", true);
        U.xlsx(`bokeya-sms-${bName.replace(/[^\w-]+/g, "_")}-${U.today()}.xlsx`, ["Number", "Message", "নাম", "আইডি", "ব্যাচ", "বকেয়া (৳)"], rows);
        const miss = list.length - rows.length;
        toast(`${bn(rows.length)} জনের Excel নামানো হয়েছে${miss ? ` — ${bn(miss)} জনের নম্বর নেই` : ""}`);
      };
      paint();
    };
    $("#bpS").onchange = (e) => { bpSess = e.target.value; bpBatch = firstBatch(); $("#bpB").innerHTML = batchOpts(); draw(); };
    $("#bpB").onchange = (e) => { bpBatch = e.target.value; draw(); };
    $("#bpM").onchange = draw;
    $("#bpRows").oninput = (e) => {
      const tr = e.target.closest("tr[data-sid]"); if (!tr) return;
      const s = studentById(tr.dataset.sid);
      if (e.target.classList.contains("bp-enr")) {
        const it = itemOf(s, e.target.value);
        $(".bp-fee", tr).innerHTML = feeCell(it);
        [...tr.children].slice(3, 6).forEach((td) => td.remove());
        $(".bp-fee", tr).insertAdjacentHTML("afterend", midCells(s, it));
      }
      $(".bp-left", tr).innerHTML = leftCell(s, $(".bp-amt", tr).value);
      sum();
    };
    $("#bpRows").onchange = $("#bpRows").oninput;
    $("#bpSave").onclick = () => {
      const P = picked(), mo = $("#bpM").value;
      const items = P.map((tr) => ({ studentId: tr.dataset.sid, enrollmentId: $(".bp-enr", tr).value, amount: Number($(".bp-amt", tr).value || 0), month: mo, method: $("#bpMt").value, date: $("#bpD").value, note: `${U.month(mo)} — ব্যাচ পেমেন্ট` }));
      const bad = items.find((x) => !(x.amount > 0));
      if (bad) return toast(`${studentName(bad.studentId)} — টাকার পরিমাণ দিন`, true);
      const tot = items.reduce((t, x) => t + x.amount, 0), bName = bpSess + " · " + (bpBatch === "*" ? "সব ব্যাচ" : batchName(bpBatch));
      const modName = (x) => { const e = DB.enrollments.find((y) => y.id === x.enrollmentId); return e ? (courseById(e.courseId) || {}).name || "" : "সাধারণ"; };
      const kv = (k, v) => `<div><small>${k}</small><b>${v}</b></div>`;
      // ধাপ ১: সুন্দর নিশ্চিতকরণ — কার কত টাকা, মোট কত
      openModal({
        title: "পেমেন্ট নিশ্চিত করুন", saveText: `হ্যাঁ, ${bn(items.length)} জনের পেমেন্ট সেভ করুন`,
        body: `<div class="bpc">
          <div class="bpc-top">${kv("সেশন · ব্যাচ", esc(bName))}${kv("কোন মাসের ফি", U.month(mo))}${kv("মাধ্যম", esc(items[0].method))}${kv("তারিখ", U.date(items[0].date))}</div>
          <div class="bpc-list">${items.map((x, i) => `<div class="bpc-row"><span class="bpc-n">${bn(i + 1)}</span><span class="bpc-who"><b>${esc(studentName(x.studentId))}</b><small>${esc(x.studentId)} · ${esc(modName(x))}</small></span><b class="bpc-amt">${money(x.amount)}</b></div>`).join("")}</div>
          <div class="bpc-total"><span>মোট <b>${bn(items.length)}</b> জন</span><b>${money(tot)}</b></div>
          <p class="bpc-note">সেভ করলে প্রত্যেকের জন্য আলাদা মানি রসিদ তৈরি হবে — পরে সবগুলো এক PDF-এ বা আলাদা করে প্রিন্ট করা যাবে।</p>
        </div>`,
        onSave: async () => {
          const r = await api("/api/admin/payments/batch", { body: { items } });
          await load(); draw();
          const list = r.items.map((p) => DB.payments.find((x) => x.id === p.id) || p);
          lastBatch = list.map((p) => p.id);
          markSaved(list);
          toast(`${bn(list.length)} জনের পেমেন্ট সেভ হয়েছে — মোট ${money(tot)}`);
          // ধাপ ২: সফল — সব রসিদ এক PDF-এ, অথবা আলাদা আলাদা
          const nos = list.map((p) => p.receiptNo);
          openModal({
            title: "পেমেন্ট সেভ হয়েছে",
            body: `<div class="bpc bpc-done">
              <div class="bpc-ok">✓</div>
              <h3>${bn(list.length)} জনের পেমেন্ট সেভ হয়েছে</h3>
              <p>মোট ${money(tot)} · রসিদ #${bn(Math.min(...nos))}${nos.length > 1 ? "–#" + bn(Math.max(...nos)) : ""}</p>
              <button type="button" class="btn gold bpc-all" data-rc-all>সব রসিদ এক PDF-এ প্রিন্ট (${bn(list.length)}টি)</button>
              <div class="bpc-list">${list.map((p, i) => `<div class="bpc-row"><span class="bpc-n">${bn(i + 1)}</span><span class="bpc-who"><b>${esc(studentName(p.studentId))}</b><small>${esc(p.studentId)} · রসিদ #${bn(p.receiptNo)}</small></span><b class="bpc-amt">${money(p.amount)}</b><button type="button" class="btn sm line" data-rc="${p.id}">আলাদা প্রিন্ট</button></div>`).join("")}</div>
            </div>`,
          });
          $("#modalBody .bpc-done").addEventListener("click", (e) => {
            if (e.target.closest("[data-rc-all]")) return printReceipts(list);
            const t = e.target.closest("[data-rc]"); if (t) printReceipt(DB.payments.find((p) => p.id === t.dataset.rc));
          });
          return true;
        },
      });
    };
    // সেভের পর তালিকায় প্রত্যেকের পাশে রসিদ, নিচে "সব রসিদ এক PDF-এ"
    let lastBatch = [];
    const markSaved = (list) => {
      list.forEach((p) => { const tr = $(`#bpRows tr[data-sid="${p.studentId}"]`); if (tr) $(".bp-who", tr).insertAdjacentHTML("beforeend", `<button type="button" class="btn sm line bp-rc" data-rc="${p.id}">রসিদ #${bn(p.receiptNo)} · ${money(p.amount)}</button>`); });
      const old = $("#bpAllRc"); if (old) old.remove();
      $("#bpSum").insertAdjacentHTML("afterend", `<button type="button" class="btn line" id="bpAllRc">সর্বশেষ ${bn(list.length)}টি রসিদ এক PDF-এ</button>`);
      $("#bpAllRc").onclick = () => printReceipts(lastBatch.map((id) => DB.payments.find((p) => p.id === id)));
    };
    body.addEventListener("click", (e) => { const t = e.target.closest("[data-rc]"); if (t) printReceipt(DB.payments.find((p) => p.id === t.dataset.rc)); });
    draw();
  }
  function fees(c, tab) {
    const act = activeStudents();
    const dues = act.filter((s) => s.fees.balance > 0).sort((a, b) => b.fees.balance - a.fees.balance);
    c.innerHTML = `
      <div class="tiles">
        <div class="tile dark"><small>এই মাসের আদায়</small><b>${money(DB.payments.filter((p) => (p.date || "").startsWith(thisMonth())).reduce((t, p) => t + p.amount, 0))}</b></div>
        <div class="tile"><small>মোট বকেয়া</small><b>${money(dues.reduce((t, s) => t + s.fees.balance, 0))}</b></div>
        <div class="tile"><small>বকেয়া আছে</small><b>${bn(dues.length)} জন</b></div>
        <div class="tile"><small>মোট পেমেন্ট</small><b>${bn(DB.payments.length)}টি</b></div>
      </div>
      <div class="card">
        <div class="toolbar">
          <a class="btn ${!tab ? "" : "line"}" href="#fees">পেমেন্টের তালিকা</a>
          <a class="btn ${tab === "dues" ? "" : "line"}" href="#fees/dues">বকেয়া তালিকা</a>
          <a class="btn ${tab === "report" ? "" : "line"}" href="#fees/report">সেশন ও ব্যাচের হিসাব</a>
          <span class="grow"></span>
          <button class="btn gold" id="newPay">+ একজনের পেমেন্ট</button>
          <a class="btn ${tab === "batch" ? "" : "gold"}" href="#fees/batch">+ ব্যাচ ভিত্তিক পেমেন্ট</a>
        </div>
        <div id="feeBody"></div>
      </div>`;
    $("#newPay").onclick = () => paymentForm();
    const body = $("#feeBody");
    if (tab === "batch") return batchPay(body);
    if (tab === "dues") {
      body.innerHTML = `<div class="tbl-wrap"><table><thead><tr><th>শিক্ষার্থী</th><th>সেশন / ব্যাচ</th><th>মডিউল</th><th class="num">মোট দেনা</th><th class="num">পরিশোধ</th><th class="num">বকেয়া</th><th></th></tr></thead><tbody>
        ${dues.map((s) => `<tr><td><b>${esc(s.name)}</b><small>${esc(s.id)}</small></td><td>${esc(s.session || "")}<small>${esc(batchName(s.batchId))}</small></td><td>${esc(modulesOf(s.id).join(", "))}</td><td class="num">${money(s.fees.totalDue)}</td><td class="num">${money(s.fees.paid)}</td><td class="num"><span class="chip bad">${money(s.fees.balance)}</span></td>
        <td class="num" style="white-space:nowrap"><button class="btn sm gold" data-pay="${s.id}">পেমেন্ট</button> ${s.guardianPhone ? `<a class="btn sm wa" target="_blank" rel="noopener" href="${waLink(s.guardianPhone, `আসসালামু আলাইকুম। ${s.name}-এর ফি বাবদ ${money(s.fees.balance).replace("৳", "")} টাকা বকেয়া আছে। অনুগ্রহ করে পরিশোধ করুন। — ${DB.settings.name}`)}">মনে করিয়ে দিন</a>` : ""}</td></tr>`).join("")
        || `<tr><td colspan="7" class="empty">কোনো বকেয়া নেই </td></tr>`}</tbody></table></div>`;
      body.onclick = (e) => { const t = e.target.closest("[data-pay]"); if (t) paymentForm(t.dataset.pay); };
      return;
    }
    if (tab === "report") {
      const sum = (list) => list.reduce((a, s) => ({ n: a.n + 1, due: a.due + s.fees.totalDue, paid: a.paid + s.fees.paid, bal: a.bal + Math.max(0, s.fees.balance) }), { n: 0, due: 0, paid: 0, bal: 0 });
      const pct = (k) => (k.due ? Math.min(100, Math.round((k.paid / k.due) * 100)) : 0);
      const bar = (k) => `<div class="fr-rate"><div class="fr-bar"><i style="width:${pct(k)}%"></i></div><b>${bn(pct(k))}%</b></div>`;
      const balCell = (k) => (k.bal > 0 ? `<b class="fr-due">${money(k.bal)}</b>` : '<span class="fr-ok">পরিশোধ</span>');
      const head = '<thead><tr><th>ব্যাচ</th><th class="num">শিক্ষার্থী</th><th class="num">মোট দেনা</th><th class="num">আদায়</th><th class="num">বকেয়া</th><th>আদায়ের হার</th></tr></thead>';
      const stat = (t, v, cls) => `<div class="fr-stat"><small>${t}</small><b${cls ? ` class="${cls}"` : ""}>${v}</b></div>`;
      // ব্যাচের সারি: নাম বড় করে, দিন-সময় নিচে ছোট; শিক্ষার্থী নেই এমন ব্যাচ আলাদা ভাঁজে, যাতে ৳০-এর ভিড় না থাকে
      const batchRow = (name, sub, k) => `<tr><td><b class="fr-name">${esc(name)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</td><td class="num">${bn(k.n)} জন</td><td class="num">${money(k.due)}</td><td class="num fr-paid">${money(k.paid)}</td><td class="num">${balCell(k)}</td><td>${bar(k)}</td></tr>`;
      const when = (b) => [b.days, b.time].filter(Boolean).join(" · ");
      const sessions = DB.sessions.map((se) => {
        const ss = act.filter((x) => x.session === se.name), k = sum(ss);
        if (!ss.length) return "";
        const bs = DB.batches.filter((b) => b.session === se.name), full = bs.filter((b) => ss.some((x) => x.batchId === b.id)), empty = bs.filter((b) => !full.includes(b));
        const noBatch = ss.filter((x) => !bs.some((b) => b.id === x.batchId));
        return `<section class="fr-sess"><header><h3>${esc(se.name)}</h3>${stat("শিক্ষার্থী", bn(k.n) + " জন")}${stat("মোট দেনা", money(k.due))}${stat("আদায়", money(k.paid))}${stat("বকেয়া", money(k.bal), k.bal > 0 ? "due" : "")}${bar(k)}</header>
          <div class="tbl-wrap"><table class="fr-tbl">${head}<tbody>${full.map((b) => batchRow(b.name, when(b), sum(ss.filter((x) => x.batchId === b.id)))).join("")}${noBatch.length ? batchRow("ব্যাচ নেই (অনলাইন)", "", sum(noBatch)) : ""}</tbody></table></div>
          ${empty.length ? `<details class="fr-empty"><summary>শিক্ষার্থী নেই এমন ব্যাচ: ${bn(empty.length)}টি</summary><p>${empty.map((b) => `<span>${esc(U.batchLabel(b))}</span>`).join("")}</p></details>` : ""}</section>`;
      }).join("");
      const mods = DB.courses.map((m) => { const enr = DB.enrollments.filter((e) => e.courseId === m.id && e.status === "active"); return { m, n: enr.length, fee: enr.reduce((t, e) => t + (e.fee - e.discount), 0) }; });
      const modOn = mods.filter((x) => x.n).sort((x, y) => y.fee - x.fee), modOff = mods.filter((x) => !x.n);
      const total = sum(act);
      body.innerHTML = `<div class="fr-total"><h3>সর্বমোট</h3>${stat("শিক্ষার্থী", bn(total.n) + " জন")}${stat("মোট দেনা", money(total.due))}${stat("আদায়", money(total.paid))}${stat("বকেয়া", money(total.bal), total.bal > 0 ? "due" : "")}${bar(total)}</div>
        ${sessions || '<p class="empty">কোনো শিক্ষার্থীর হিসাব নেই</p>'}
        <section class="fr-sess"><header><h3>মডিউল অনুযায়ী</h3><span class="fr-note">চলমান ভর্তি</span></header>
          <div class="tbl-wrap"><table class="fr-tbl"><thead><tr><th>মডিউল</th><th class="num">ভর্তি</th><th class="num">ফি (ছাড় বাদে)</th></tr></thead><tbody>${modOn.map((x) => `<tr><td><b class="fr-name">${esc(x.m.name)}</b><small>${esc(x.m.code)}</small></td><td class="num">${bn(x.n)} জন</td><td class="num"><b>${money(x.fee)}</b>${x.m.feeType === "monthly" ? "<small>প্রতি মাসে</small>" : ""}</td></tr>`).join("") || '<tr><td colspan="3" class="empty">কোনো চলমান ভর্তি নেই</td></tr>'}</tbody></table></div>
          ${modOff.length ? `<details class="fr-empty"><summary>ভর্তি নেই এমন মডিউল: ${bn(modOff.length)}টি</summary><p>${modOff.map((x) => `<span>${esc(x.m.name)}</span>`).join("")}</p></details>` : ""}</section>`;
      return;
    }
    body.innerHTML = `<div class="toolbar"><input type="month" id="pm" value="" data-dp-empty="সব মাস"><input class="grow" id="pq" placeholder="নাম বা আইডি"><button class="btn line" id="pcsv">↓ Excel</button></div>
      <div class="tbl-wrap"><table><thead><tr><th>রসিদ</th><th>তারিখ</th><th>শিক্ষার্থী</th><th>মডিউল</th><th>মাস</th><th>মাধ্যম</th><th class="num">টাকা</th><th></th></tr></thead><tbody id="prows"></tbody></table></div>`;
    const modOf = (p) => { const e = DB.enrollments.find((x) => x.id === p.enrollmentId); return e ? (courseById(e.courseId) || {}).name || "" : "সাধারণ"; };
    const list = () => { const mo = $("#pm").value, qv = $("#pq").value.trim().toLowerCase(); return DB.payments.filter((p) => (!mo || (p.date || "").startsWith(mo)) && (!qv || (p.studentId + " " + studentName(p.studentId)).toLowerCase().includes(qv))).sort((a, b) => (b.date + String(b.receiptNo)).localeCompare(a.date + String(a.receiptNo))); };
    const draw = () => {
      $("#prows").innerHTML = list().map((p) => `<tr><td>#${bn(p.receiptNo)}</td><td>${U.date(p.date)}</td><td><b>${esc(studentName(p.studentId))}</b><small>${esc(p.studentId)}</small></td><td>${esc(modOf(p))}</td><td>${U.month(p.month)}</td><td>${esc(p.method)}</td><td class="num"><b>${money(p.amount)}</b></td>
        <td class="num"><button class="icon-btn" title="রসিদ প্রিন্ট" data-print="${p.id}">প্রিন্ট</button><button class="icon-btn" title="মুছুন" data-del="${p.id}">✕</button></td></tr>`).join("") || `<tr><td colspan="8" class="empty">কোনো পেমেন্ট নেই</td></tr>`;
    };
    draw();
    $("#pm").oninput = draw; $("#pq").oninput = draw;
    $("#prows").onclick = (e) => { const t = e.target.closest("[data-print],[data-del]"); if (!t) return; if (t.dataset.print) printReceipt(DB.payments.find((p) => p.id === t.dataset.print)); if (t.dataset.del) remove("payments", t.dataset.del, "এই পেমেন্টটি"); };
    $("#pcsv").onclick = () => U.xlsx(`payments-${U.today()}.xlsx`, ["রসিদ", "তারিখ", "আইডি", "নাম", "মডিউল", "মাস", "মাধ্যম", "টাকা", "নোট"], list().map((p) => [p.receiptNo, p.date, p.studentId, studentName(p.studentId), modOf(p), p.month, p.method, p.amount, p.note]));
  }

  // ---------- পরীক্ষা: নতুন পরীক্ষা, নম্বর এন্ট্রি, ক্যালেন্ডার, সম্পন্ন, পরবর্তী, ডকুমেন্টস — admin-exams.js ফাইলে ----------

  // ---------- ভর্তির খোঁজ ----------
  const ENQ_STATUS = [["new", "নতুন"], ["called", "ফোন করা হয়েছে"], ["admitted", "ভর্তি হয়েছে"], ["closed", "আগ্রহ নেই"]];
  function enquiries(c) {
    c.innerHTML = `<div class="card">
      <div class="toolbar"><select id="es">${opt([["", "সব"], ...ENQ_STATUS], "")}</select><span class="grow"></span><button class="btn line" id="ecsv">↓ Excel</button></div>
      <div class="tbl-wrap"><table><thead><tr><th>তারিখ</th><th>নাম ও মোবাইল</th><th>প্রোগ্রাম / শ্রেণি</th><th>বার্তা</th><th>অবস্থা</th><th></th></tr></thead><tbody id="qrows"></tbody></table></div></div>`;
    const list = () => DB.enquiries.filter((e) => !$("#es").value || e.status === $("#es").value).sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date));
    const draw = () => {
      $("#qrows").innerHTML = list().map((e) => `<tr><td>${U.date(e.date)}</td>
        <td><b>${esc(e.name)}</b><small><a href="tel:${esc(e.phone)}">${esc(e.phone)}</a> · <a target="_blank" rel="noopener" href="${waLink(e.phone, `আসসালামু আলাইকুম ${e.name}, ${DB.settings.name} থেকে বলছি।`)}">WhatsApp</a></small></td>
        <td>${esc(e.course || "—")}<small>${esc(e.klass)} ${e.college ? "· " + esc(e.college) : ""}</small></td>
        <td style="max-width:240px">${esc(e.message || "—")}${e.note ? `<small>নোট: ${esc(e.note)}</small>` : ""}</td>
        <td><select class="field" data-status="${e.id}">${opt(ENQ_STATUS, e.status)}</select></td>
        <td class="num" style="white-space:nowrap">${e.status !== "admitted" ? `<button class="btn sm gold" data-admit="${e.id}">ভর্তি করুন</button>` : ""} <button class="icon-btn" title="নোট" data-note="${e.id}"></button><button class="icon-btn" title="মুছুন" data-del="${e.id}">✕</button></td></tr>`).join("")
        || `<tr><td colspan="6" class="empty">কোনো খোঁজ নেই</td></tr>`;
    };
    draw(); $("#es").onchange = draw;
    $("#qrows").onchange = async (ev) => {
      const id = ev.target.dataset.status; if (!id) return;
      const e = DB.enquiries.find((x) => x.id === id);
      try { await save("enquiries", { ...e, status: ev.target.value }, id); await load(); updateChrome(); toast("অবস্থা বদলানো হয়েছে"); } catch (err) { toast(err.message, true); }
    };
    $("#qrows").onclick = (ev) => {
      const t = ev.target.closest("[data-admit],[data-note],[data-del]"); if (!t) return;
      if (t.dataset.del) return remove("enquiries", t.dataset.del, "এই খোঁজটি");
      const e = DB.enquiries.find((x) => x.id === (t.dataset.admit || t.dataset.note));
      if (t.dataset.note) return openForm({ title: "নোট — " + e.name, fields: [{ name: "note", label: "নোট", type: "textarea", wide: true }], values: e, onSave: async (d) => { await save("enquiries", { ...e, note: d.note }, e.id); await load(); route(); } });
      studentForm(null, { name: e.name, phone: e.phone, college: e.college, _enquiryId: e.id });
    };
    $("#ecsv").onclick = () => U.xlsx(`enquiries-${U.today()}.xlsx`, ["তারিখ", "নাম", "মোবাইল", "প্রোগ্রাম", "শ্রেণি", "প্রতিষ্ঠান", "বার্তা", "অবস্থা", "নোট"], list().map((e) => [e.date, e.name, e.phone, e.course, e.klass, e.college, e.message, (ENQ_STATUS.find((s) => s[0] === e.status) || [])[1], e.note]));
  }

  // ---------- মডিউল, সেশন ও ব্যাচ ----------
  const FEE_TYPES = [["monthly", "মাসিক ফি"], ["once", "এককালীন ফি"], ["chapter", "অধ্যায়ভিত্তিক ফি"]];
  // অধ্যায়ভিত্তিক মডিউল: প্রতিটা অধ্যায়ের নম্বর, নাম আর ফি আলাদা সারিতে; নতুন মডিউলে HSC ICT-র ৬ অধ্যায় আগে থেকে বসানো
  const ICT_CHAPTERS = [["1", "তথ্য ও যোগাযোগ প্রযুক্তি: বিশ্ব ও বাংলাদেশ প্রেক্ষিত"], ["2", "কমিউনিকেশন সিস্টেমস ও নেটওয়ার্কিং"], ["3", "সংখ্যা পদ্ধতি ও ডিজিটাল ডিভাইস"], ["4", "ওয়েব ডিজাইন পরিচিতি এবং HTML"], ["5", "প্রোগ্রামিং ভাষা"], ["6", "ডেটাবেজ ম্যানেজমেন্ট সিস্টেম"]];
  const chRow = (c = {}) => `<div class="ch-row" data-ch><input data-ch-id value="${esc(c.id || "")}" placeholder="নং" title="অধ্যায় নম্বর (যেমন 1 বা 3.1)"><input data-ch-name value="${esc(c.name || "")}" placeholder="অধ্যায়ের নাম"><input data-ch-fee type="number" min="0" value="${c.fee || c.fee === 0 ? esc(c.fee) : ""}" placeholder="ফি ৳"><button type="button" class="icon-btn" data-ch-del title="বাদ দিন">✕</button></div>`;
  const chapterBox = (co) => `<div class="ch-box wide" id="chBox"><div class="ch-head"><b>অধ্যায় ও প্রতি অধ্যায়ের ফি</b><span><button type="button" class="btn sm line" data-ch-ict>HSC ICT-র ৬ অধ্যায় বসান</button> <button type="button" class="btn sm gold" data-ch-add>+ অধ্যায়</button></span></div>
      <p class="ch-note">শিক্ষার্থী ইচ্ছেমতো অধ্যায় বেছে কিনতে পারবে — বাছাই করা অধ্যায়গুলোর ফি যোগ হয়ে মোট ফি হবে, আর শুধু সেই অধ্যায়ের ভিডিও ক্লাস দেখবে। ভিডিও ক্লাসে কোন ক্লাস কোন অধ্যায়ের তা বেছে দিন।</p>
      <div class="ch-cols"><span>নং</span><span>অধ্যায়ের নাম</span><span>ফি (৳)</span><span></span></div>
      <div id="chRows">${((co && (co.chapters || []).length) ? co.chapters : ICT_CHAPTERS.map(([id, name]) => ({ id, name }))).map(chRow).join("")}</div></div>`;
  // ফি-এর ধরন বদলালে: অধ্যায়ের ঘর দেখানো / লুকানো, "ফি (টাকা)" লুকানো; অনলাইন মডিউলে "মাসিক ফি" নেই
  function bindFeeForm(fixedMode) {
    const box = document.getElementById("modalBody"), ft = box.querySelector("[name=feeType]"), md = box.querySelector("[name=mode]"), feeL = box.querySelector("[name=fee]") && box.querySelector("[name=fee]").closest("label"), ch = document.getElementById("chBox");
    if (!ft || !ch) return;
    const sync = () => {
      const online = (md ? md.value : fixedMode) === "online", mOpt = ft.querySelector('option[value="monthly"]');
      if (mOpt) { mOpt.hidden = online; mOpt.disabled = online; }
      if (online && ft.value === "monthly") ft.value = "once";
      ch.hidden = ft.value !== "chapter"; if (feeL) feeL.hidden = ft.value === "chapter";
    };
    ft.addEventListener("change", sync); if (md) md.addEventListener("change", sync); sync();
    ch.addEventListener("click", (e) => {
      if (e.target.closest("[data-ch-add]")) { document.getElementById("chRows").insertAdjacentHTML("beforeend", chRow()); document.getElementById("chRows").lastElementChild.querySelector("[data-ch-id]").focus(); }
      if (e.target.closest("[data-ch-ict]")) { if (document.querySelectorAll("#chRows [data-ch]").length && !confirm("এখনকার অধ্যায়গুলোর জায়গায় HSC ICT-র ৬ অধ্যায় বসবে (ফি আবার লিখতে হবে)। ঠিক আছে?")) return; document.getElementById("chRows").innerHTML = ICT_CHAPTERS.map(([id, name]) => chRow({ id, name })).join(""); }
      const del = e.target.closest("[data-ch-del]"); if (del) del.closest("[data-ch]").remove();
    });
  }
  // সেভের সময় সারিগুলো থেকে অধ্যায়ের তালিকা
  function readChapters() {
    const rows = [...document.querySelectorAll("#chRows [data-ch]")].map((r) => ({ id: r.querySelector("[data-ch-id]").value.trim().replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d)), name: r.querySelector("[data-ch-name]").value.trim(), fee: r.querySelector("[data-ch-fee]").value.trim() })).filter((c) => c.id || c.name || c.fee);
    if (!rows.length) throw new Error("অধ্যায়ভিত্তিক মডিউলে অন্তত একটা অধ্যায় দিন");
    for (const c of rows) { if (!c.id || !c.name) throw new Error("প্রতিটা অধ্যায়ের নম্বর আর নাম লিখুন"); if (!(Number(c.fee) > 0)) throw new Error(`অধ্যায় ${c.id}-এর ফি লিখুন`); }
    if (new Set(rows.map((c) => c.id)).size !== rows.length) throw new Error("একই অধ্যায় নম্বর দুবার দেওয়া হয়েছে");
    return rows.map((c) => ({ ...c, fee: Number(c.fee) }));
  }
  const MODES = [["offline", "অফলাইন কোর্স মডিউল"], ["online", "অনলাইন কোর্স মডিউল"]];
  const modeOf = (m) => (m.mode === "online" ? "online" : "offline");
  // ---------- অনলাইন মডিউলের রেকর্ড ক্লাস (ভর্তি হওয়া শিক্ষার্থী প্যানেলের "ক্লাস ভিডিও"-তে দেখে) ----------
  // অফলাইন মডিউলের সব শিক্ষার্থীকে এক ক্লিকে অনলাইন মডিউলের অ্যাক্সেস (ফি ০, মেয়াদ আজ থেকে অনলাইন মডিউলের নিয়মে)
  document.addEventListener("click", (e) => { if (!e.target.closest(".acc-dd")) document.querySelectorAll(".acc-menu").forEach((x) => (x.hidden = true)); });
  addEventListener("scroll", () => document.querySelectorAll(".acc-menu").forEach((x) => (x.hidden = true)), true); // স্ক্রল করলে মেনু বন্ধ
  // এই অফলাইন মডিউল থেকে দেওয়া (চালু) অনলাইন অ্যাক্সেস
  const grantsOf = (fromId) => (DB.enrollments || []).filter((e) => e.grantedFrom === fromId && e.status === "active");
  // অ্যাক্সেস বাতিল: কোন অনলাইন মডিউলের অ্যাক্সেস কতজনের — প্রতিটার পাশে "বাতিল"
  function revokeOnline(from) {
    const byTo = {}; grantsOf(from.id).forEach((e) => { byTo[e.courseId] = (byTo[e.courseId] || 0) + 1; });
    openModal({
      title: `অ্যাক্সেস বাতিল — ${from.name}`, saveText: "বন্ধ করুন",
      body: `<p style="margin:0 0 10px;color:var(--muted)">"${esc(from.name)}"-এর শিক্ষার্থীদের এখান থেকে দেওয়া অনলাইন অ্যাক্সেস। বাতিল করলে তারা ঐ অনলাইন মডিউলের ভিডিও ক্লাস আর দেখতে পাবে না। যে শিক্ষার্থী নিজে টাকা দিয়ে কিনেছে, তার অ্যাক্সেসে হাত পড়বে না।</p>
        <div style="display:grid;gap:8px">${Object.entries(byTo).map(([to, n]) => { const c = courseById(to) || { name: to }; return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #e3e6ee;border-radius:10px"><b style="flex:1">${esc((c.code ? c.code + " — " : "") + c.name)}</b><span class="chip">${bn(n)} জন</span><button type="button" class="btn sm line danger" data-rv="${esc(to)}">অ্যাক্সেস তুলে নিন</button></div>`; }).join("")}</div>`,
      onSave: async () => {},
    });
    $("#modalBody").onclick = async (e) => {
      const b = e.target.closest("[data-rv]"); if (!b) return;
      const c = courseById(b.dataset.rv) || { name: "" };
      if (!confirm(`"${from.name}"-এর শিক্ষার্থীদের "${c.name}"-এর অ্যাক্সেস বাতিল করবেন?`)) return;
      try {
        const x = await api(`/api/admin/grant-online?from=${encodeURIComponent(from.id)}&to=${encodeURIComponent(b.dataset.rv)}`, { method: "DELETE" });
        toast(`${bn(x.removed)} জনের অ্যাক্সেস বাতিল হয়েছে`); await load(); route();
        if (grantsOf(from.id).length) revokeOnline(from); else $("#modalCancel").click();
      } catch (er) { toast(er.message, true); }
    };
  }
  async function grantOnline(from) {
    const online = DB.courses.filter((c) => modeOf(c) === "online");
    if (!online.length) return toast("আগে একটা অনলাইন মডিউল তৈরি করুন", true);
    openModal({
      title: `অনলাইন অ্যাক্সেস — ${from.name}`, saveText: "অ্যাক্সেস দিন",
      body: `<div class="fgrid"><label class="wide">কোন অনলাইন মডিউলের ভিডিও ক্লাস দেবেন<select id="gTo">${online.map((c) => `<option value="${c.id}">${esc((c.code ? c.code + " — " : "") + c.name)}</option>`).join("")}</select></label>
        <div class="wide" id="gChs"></div><p class="wide" id="gInfo" style="margin:0;color:var(--muted)">হিসাব হচ্ছে…</p></div>`,
      onSave: async () => {
        const to = courseById($("#gTo").value), all = $("#gAll") && $("#gAll").checked;
        const chapters = [...document.querySelectorAll("#gChs [data-gch]:checked")].map((x) => x.value);
        if (to.feeType === "chapter" && !all && !chapters.length) throw new Error("অন্তত একটা অধ্যায় বাছুন");
        const r = await api(`/api/admin/grant-online?from=${encodeURIComponent(from.id)}&to=${encodeURIComponent(to.id)}`, { body: { allChapters: all, chapters } });
        await load(); route(); toast(`${bn(r.added)} জন শিক্ষার্থী অ্যাক্সেস পেয়েছে${r.skipped ? ` · ${bn(r.skipped)} জনের আগে থেকেই ছিল` : ""}`);
      },
    });
    const draw = async () => {
      const to = courseById($("#gTo").value);
      $("#gChs").innerHTML = to.feeType === "chapter" && (to.chapters || []).length ? `<b style="display:block;margin-bottom:6px">কোন অধ্যায়</b><label class="check"><input type="checkbox" id="gAll" checked> সব অধ্যায়</label>
        <div id="gChList" hidden style="display:grid;gap:4px;margin-top:6px">${to.chapters.map((x) => `<label class="check"><input type="checkbox" data-gch value="${esc(x.id)}"> অধ্যায় ${esc(x.id)} — ${esc(x.name)}</label>`).join("")}</div>` : "";
      const all = $("#gAll"); if (all) all.onchange = () => { $("#gChList").hidden = all.checked; };
      try {
        const r = await api(`/api/admin/grant-online?from=${encodeURIComponent(from.id)}&to=${encodeURIComponent(to.id)}`);
        $("#gInfo").innerHTML = `"${esc(from.name)}"-এ ভর্তি <b>${bn(r.total)}</b> জন শিক্ষার্থী। ${r.total - r.already ? `<b>${bn(r.total - r.already)}</b> জন নতুন করে "${esc(to.name)}"-এর ভিডিও ক্লাস পাবে — কোনো ফি লাগবে না; মেয়াদ আজ থেকে অনলাইন মডিউলের নিয়মে।` : "সবার আগে থেকেই এই অনলাইন মডিউল আছে।"}${r.already ? ` (${bn(r.already)} জনের আগে থেকেই আছে)` : ""}
          ${r.granted ? `<br>এই অফলাইন মডিউল থেকে আগে দেওয়া অ্যাক্সেস: ${bn(r.granted)} জন · <button type="button" class="btn sm line" id="gUndo">অ্যাক্সেস তুলে নিন</button>` : ""}`;
        const u = $("#gUndo"); if (u) u.onclick = async () => {
          if (!confirm(`"${from.name}" থেকে দেওয়া "${to.name}"-এর অ্যাক্সেস ${r.granted} জনের কাছ থেকে তুলে নেবেন?`)) return;
          const x = await api(`/api/admin/grant-online?from=${encodeURIComponent(from.id)}&to=${encodeURIComponent(to.id)}`, { method: "DELETE" });
          toast(`${bn(x.removed)} জনের অ্যাক্সেস তুলে নেওয়া হয়েছে`); await load(); draw();
        };
      } catch (er) { $("#gInfo").textContent = er.message; }
    };
    $("#gTo").onchange = draw; draw();
  }
  function lessonEditor(co) {
    const newId = () => "les" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    let L = (co.lessons || []).map((l) => ({ ...l, ytUrl: l.yt ? `https://youtu.be/${l.yt}` : "" }));
    const chap = co.feeType === "chapter" && (co.chapters || []).length; // অধ্যায়ভিত্তিক হলে প্রতিটা ক্লাসের অধ্যায় বাছাই
    const files = new Map(); // ক্লাসের id → বাছাই করা ভিডিও ফাইল
    const mb = (n) => bn((n / 1048576).toFixed(n > 104857600 ? 0 : 1)) + " MB";
    const collect = () => $$("#modalBody .les-row").forEach((r, i) => {
      const l = L[i]; if (!l) return;
      l.title = r.querySelector("[data-k=title]").value.trim(); l.source = r.querySelector("[data-k=source]").value;
      const ch = r.querySelector("[data-k=chapter]"); if (ch) l.chapter = ch.value;
      const y = r.querySelector("[data-k=ytUrl]"); if (y) l.ytUrl = y.value.trim();
    });
    const draw = () => {
      $("#modalBody").innerHTML = `<p style="margin:0 0 12px;color:var(--muted)">এই মডিউলে ভর্তি হওয়া শিক্ষার্থীরা শিক্ষার্থী প্যানেলের <b>"ক্লাস ভিডিও"</b> ট্যাবে এই ক্রমে দেখবে।
          YouTube-এ <b>Unlisted</b> করে লিংক দিন, অথবা ভিডিও ফাইল আপলোড করুন (MP4 ভালো, ২ GB পর্যন্ত)।</p>
        <div class="les-list">${L.map((l, i) => `<div class="les-row" data-i="${i}">
          <span class="les-no">${bn(i + 1)}</span>
          <div class="les-main">
            <input data-k="title" value="${esc(l.title || "")}" placeholder="ক্লাসের নাম, যেমন: অধ্যায় ১ — বিশ্ব ও বাংলাদেশ প্রেক্ষিত (পর্ব ১)">
            ${chap ? `<select data-k="chapter" title="কোন অধ্যায়ের ক্লাস — শুধু সেই অধ্যায় কেনা শিক্ষার্থীরা দেখবে"><option value="">সবার জন্য (সব অধ্যায়ের সাধারণ ক্লাস)</option>${co.chapters.map((c) => `<option value="${esc(c.id)}"${l.chapter === c.id ? " selected" : ""}>অধ্যায় ${esc(c.id)} — ${esc(c.name)}</option>`).join("")}</select>` : ""}
            <div class="les-src"><select data-k="source"><option value="youtube"${l.source !== "file" ? " selected" : ""}>► YouTube লিংক</option><option value="file"${l.source === "file" ? " selected" : ""}>ভিডিও ফাইল</option></select>
              ${l.source === "file"
                ? `<label class="btn sm line">${files.has(l.id) ? "✓ " + esc(files.get(l.id).name) + " (" + mb(files.get(l.id).size) + ")" : l.file ? "✓ ভিডিও আছে (" + mb(l.file.size) + ") — বদলাতে বাছুন" : "ভিডিও বাছুন"}<input type="file" accept="video/mp4,video/webm,video/quicktime,.m4v" data-file="${l.id}" hidden></label>`
                : `<input data-k="ytUrl" value="${esc(l.ytUrl || "")}" placeholder="https://youtu.be/…">`}</div>
          </div>
          <div class="les-acts"><button type="button" class="icon-btn" data-up="${i}" title="উপরে"${i ? "" : " disabled"}>↑</button><button type="button" class="icon-btn" data-down="${i}" title="নিচে"${i < L.length - 1 ? "" : " disabled"}>↓</button><button type="button" class="icon-btn" data-del="${i}" title="মুছুন">✕</button></div>
        </div>`).join("") || '<p class="empty">এখনো কোনো ক্লাস নেই</p>'}</div>
        <button type="button" class="btn line" data-add style="margin-top:12px">+ নতুন ক্লাস</button>
        <div class="les-prog" id="lesProg" hidden></div>`;
    };
    openModal({
      title: `ভিডিও ক্লাস — ${co.code ? co.code + " · " : ""}${co.name}`, body: "", wide: true, saveText: "সেভ করুন",
      onSave: async () => {
        collect();
        const bad = L.find((l) => !l.title); if (bad) throw new Error("প্রতিটা ক্লাসের নাম লিখুন");
        const noVid = L.find((l) => (l.source === "file" ? !files.has(l.id) && !l.file : !/youtu/.test(l.ytUrl || ""))); if (noVid) throw new Error(`"${noVid.title}" — YouTube লিংক দিন বা ভিডিও ফাইল বাছুন`);
        await api(`/api/admin/courses/${encodeURIComponent(co.id)}/lessons`, { body: { lessons: L.map(({ id, title, source, ytUrl, yt, chapter }) => ({ id, title, source, ytUrl, yt, chapter: chapter || "" })) } });
        // ভিডিও ফাইল একটা একটা করে, অগ্রগতি দেখিয়ে
        const pg = $("#lesProg"); let n = 0;
        for (const [lid, f] of files) {
          if (!L.some((l) => l.id === lid && l.source === "file")) continue;
          n++; pg.hidden = false;
          const ext = "." + (f.name.split(".").pop() || "mp4").toLowerCase();
          await new Promise((resolve, reject) => {
            const x = new XMLHttpRequest();
            x.open("POST", `/api/admin/video?col=courses&id=${encodeURIComponent(co.id)}&lesson=${encodeURIComponent(lid)}&ext=${encodeURIComponent(ext)}`);
            x.upload.onprogress = (e) => { if (e.lengthComputable) pg.innerHTML = `<span>ভিডিও আপলোড হচ্ছে (${bn(n)}): ${esc(f.name)}</span><i style="width:${(e.loaded / e.total) * 100}%"></i><b>${bn(Math.round((e.loaded / e.total) * 100))}%</b>`; };
            x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch {} x.status < 300 ? resolve() : reject(new Error(`"${f.name}" আপলোড হয়নি: ${j.error || "আবার চেষ্টা করুন"}`)); };
            x.onerror = () => reject(new Error("আপলোড হয়নি — সংযোগ দেখুন"));
            x.send(f);
          }).catch(async (e) => { await load(); route(); throw e; });
        }
        await load(); route(); toast("ভিডিও ক্লাস সেভ হয়েছে");
      },
    });
    draw();
    $("#modalBody").onclick = (e) => {
      const b = e.target.closest("[data-add],[data-up],[data-down],[data-del]"); if (!b) return;
      collect();
      if (b.dataset.add !== undefined) L.push({ id: newId(), title: "", source: "youtube", ytUrl: "" });
      const i = Number(b.dataset.up ?? b.dataset.down ?? b.dataset.del);
      if (b.dataset.up) [L[i - 1], L[i]] = [L[i], L[i - 1]];
      if (b.dataset.down) [L[i + 1], L[i]] = [L[i], L[i + 1]];
      if (b.dataset.del && confirm(`"${L[i].title || "এই ক্লাস"}" মুছবেন?`)) { files.delete(L[i].id); L.splice(i, 1); }
      draw();
    };
    $("#modalBody").onchange = (e) => {
      if (e.target.dataset.file) { const f = e.target.files[0]; if (f) { if (f.size > 2 * 1024 * 1024 * 1024) return toast("ভিডিও ২ GB-এর মধ্যে দিন", true); files.set(e.target.dataset.file, f); } collect(); draw(); }
      else if (e.target.dataset.k === "source") { collect(); draw(); }
    };
  }
  function courseForm(co, mode = "offline") {
    let crop;
    const readMonthlyFeeRows = () => $$("#monthlyFeeRows .monthly-fee-row").map(row => ({ from: row.querySelector('[data-month="from"]').value, to: row.querySelector('[data-month="to"]').value, fee: row.querySelector('[data-month="fee"]').value === "" ? NaN : Number(row.querySelector('[data-month="fee"]').value) }));
    const addMonthlyFeeRow = (r = {}) => {
      const row = document.createElement("div"); row.className = "monthly-fee-row";
      row.innerHTML = `<label>শুরুর মাস<input type="month" data-month="from" value="${esc(r.from || "")}" required></label><label>শেষের মাস <small>(খালি রাখলে চলবে)</small><input type="month" data-month="to" data-dp-empty="চলবে" value="${esc(r.to || "")}"></label><label>মাসিক ফি (৳)<input type="number" min="0" step="any" data-month="fee" value="${esc(r.fee ?? "")}" required></label><button type="button" class="monthly-fee-remove" data-remove-month title="এই ফি সারি সরান" aria-label="এই ফি সারি সরান"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg><span>সরান</span></button>`;
      row.querySelector('[data-remove-month]').onclick = () => row.remove();
      $("#monthlyFeeRows").append(row);
    };
    setTimeout(() => {
      crop = photoCropper($("#cCrop"), { fw: 280, fh: 280, ow: 800, oh: 800, pw: 200, ph: 200, fit: true, face: false,
        hint: "ছবি টেনে ঠিক জায়গায় আনুন। জুম কমালে পুরো ছবি (কিছু না কেটে) বসবে, ফাঁকা অংশ সাদা থাকবে।" });
      $("#cImg").onchange = async (e) => {
        const f = e.target.files[0]; if (!f) return;
        if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { e.target.value = ""; return toast("কভার ছবি দিন — JPG, PNG বা WEBP", true); }
        try { await crop.load(f); } catch { toast("ছবিটি খোলা যায়নি", true); }
      };
    });
    openForm({
      title: co ? "মডিউল বদলান" : mode === "online" ? "নতুন অনলাইন মডিউল" : "নতুন অফলাইন মডিউল",
      fields: [
        // নতুন মডিউল যে প্যানেলের "+ নতুন মডিউল" থেকে খোলা, সেখানেই যায় — প্যানেল বাছাইয়ের ঘর শুধু পুরোনো মডিউল বদলানোর সময় (অন্য প্যানেলে সরাতে)
        ...(co ? [{ name: "mode", label: "কোন প্যানেলে থাকবে", type: "select", options: MODES, wide: true }] : []),
        { name: "code", label: "মডিউল নম্বর", placeholder: "যেমন: 06" },
        { name: "name", label: "মডিউলের নাম", required: true },
        { name: "short", label: "এক লাইনে পরিচিতি", wide: true },
        { name: "desc", label: "বিস্তারিত", type: "textarea", wide: true },
        { name: "feeType", label: "ফি-এর ধরন", type: "select", options: FEE_TYPES },
        { name: "fee", label: "ফি (টাকা)", type: "number", min: 0, hint: "অধ্যায়ভিত্তিক হলে নিচে প্রতি অধ্যায়ের ফি" },
        { type: "html", html: `<section id="monthlyFeeEditor"><h3>মাসভিত্তিক ফি</h3><p class="muted">নির্ধারিত মাসে এই ফি, অন্য মাসে মূল ফি। পুরোনো ভর্তির বকেয়াও পুনর্গণনা হবে; জমা টাকা বদলাবে না।</p><div id="monthlyFeeRows"></div><button type="button" class="btn sm line" id="addMonthlyFee">+ মাসভিত্তিক ফি</button></section>` },
        { type: "html", html: chapterBox(co) },
        { name: "features", label: "কী কী থাকবে (প্রতি লাইনে একটি)", type: "textarea", wide: true, rows: 3 },
        { name: "duration", label: "মেয়াদ (ওয়েবসাইটে লেখা হিসেবে দেখায়)", placeholder: "যেমন: ৬ মাস / ১৫টি পরীক্ষা" },
        ...((co ? modeOf(co) : mode) === "online" ? [{ name: "validityText", label: "রেকর্ড ক্লাস কত দিন খোলা থাকবে (ভর্তির দিন থেকে)", placeholder: "আজীবন, অথবা দিনের সংখ্যা — যেমন ৪৫" }] : []), // অফলাইন মডিউলে লাগে না
        { name: "popular", label: "\"জনপ্রিয়\" ব্যাজ দেখান", type: "check" },
        { name: "active", label: "ওয়েবসাইটে দেখান ও ভর্তি চালু", type: "check", value: true },
        { name: "teacherId", label: "কোর্স ইন্সট্রাক্টর (বিস্তারিত পাতায় দেখাবে)", type: "select", options: [["", "প্রথম শিক্ষক (ডিফল্ট)"], ...DB.teachers.map((t) => [t.id, t.name + (t.subject ? " — " + t.subject : "")])] },
        { type: "html", html: `<div class="fgrid" style="margin:0">
          <label>কভার ছবি (কার্ডে দেখাবে — বর্গাকার, যেমন ১০৮০×১০৮০; বাছার পর ফ্রেমে বসিয়ে নিন)<input type="file" id="cImg" accept="image/jpeg,image/png,image/webp"></label>
          <label>ক্লাসের রুটিন PDF (ঐচ্ছিক — ১৫ MB পর্যন্ত)<input type="file" id="cPdf" accept="application/pdf,.pdf"></label>
          ${co && co.image ? `<p style="margin:0"><img src="/api/cimage/${co.id}/image?v=${co.image.v}" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:12px;vertical-align:middle"> এখন এই ছবি · নতুন দিলে বদলাবে</p>` : '<p style="margin:0;color:var(--muted)">ছবি না দিলে মডিউল নম্বর দিয়ে রঙিন কভার তৈরি হবে</p>'}
          ${co && co.routine ? `<p style="margin:0"><a href="/api/module/${co.id}/routine?v=${co.routine.v}" target="_blank" rel="noopener">${esc(co.routine.name)}</a>
            <label class="check" style="display:inline-flex;margin-left:10px"><input type="checkbox" id="cPdfDel"> রুটিন সরিয়ে দিন</label></p>` : ""}
        </div>
        <div class="pc" id="cCrop" hidden></div>` },
      ],
      values: co ? { ...co, ...validityVals(co.validityDays), mode: modeOf(co), features: (co.features || []).join("\n"), chapters: (co.chapters || []).map((x) => `${x.id} | ${x.name} | ${x.fee}`).join("\n") } : { ...validityVals(0), active: true, feeType: "once", mode },
      onSave: async (d) => {
        d.monthlyFees = readMonthlyFeeRows();
        for (const r of d.monthlyFees) if (!r.from || (r.to && r.from > r.to) || !Number.isFinite(r.fee) || r.fee < 0) throw new Error("মাসভিত্তিক ফির মাস ও টাকা সঠিকভাবে দিন");
        const sorted = [...d.monthlyFees].sort((a,b) => a.from.localeCompare(b.from));
        for (let i=1;i<sorted.length;i++) if (sorted[i].from <= (sorted[i-1].to || "9999-12")) throw new Error("একই মাস একাধিক সারিতে রাখা যাবে না");
        const pdf = $("#cPdf").files[0], delPdf = $("#cPdfDel") && $("#cPdfDel").checked;
        const img = crop && crop.ready ? await crop.blob() : null; // ফ্রেম থেকে ৮০০×৮০০ ধারালো JPG
        if (pdf && !/\.pdf$/i.test(pdf.name)) throw new Error("রুটিন হিসেবে শুধু PDF দিন");
        if (pdf && pdf.size > 15 * 1024 * 1024) throw new Error("PDF অনেক বড় — ১৫ MB-এর মধ্যে দিন");
        d.validityDays = "validityText" in d ? validityFrom(d) : (co && co.validityDays) || 0; delete d.validityText;
        d.icon = (co && co.icon) || "";
        if (!d.mode) d.mode = mode; // নতুন মডিউল: যে প্যানেল থেকে খোলা
        if (d.mode === "online" && d.feeType === "monthly") throw new Error("অনলাইন মডিউলে মাসিক ফি নেই — এককালীন বা অধ্যায়ভিত্তিক বাছুন");
        d.chapters = d.feeType === "chapter" ? readChapters() : []; // আইকনের ঘর ফর্মে নেই — আগের আইকন থেকে যায়
        const r = await save("courses", d, co && co.id), id = (co && co.id) || r.item.id;
        // ছবি / রুটিন আলাদা করে পাঠানো — একটা না গেলে মডিউল সেভ থাকে, শুধু সেটা জানায়
        const send = async (url, body, what) => {
          const x = await fetch(url, { method: body ? "POST" : "DELETE", body });
          const j = await x.json().catch(() => ({}));
          if (!x.ok) { await load(); route(); throw new Error(`মডিউল সেভ হয়েছে, কিন্তু ${what} যায়নি: ${j.error || "আবার চেষ্টা করুন"}`); }
        };
        if (img) await send(`/api/admin/courses/${encodeURIComponent(id)}/image?ext=.jpg`, img, "ছবি");
        if (pdf) await send(`/api/admin/courses/${encodeURIComponent(id)}/routine?name=${encodeURIComponent(pdf.name)}`, pdf, "রুটিন");
        else if (delPdf) await send(`/api/admin/courses/${encodeURIComponent(id)}/routine`, null, "রুটিন সরানো");
        await load(); route(); toast("সেভ হয়েছে");
      },
    });
    attachValidityList();
    bindFeeForm(co ? modeOf(co) : mode); // ফি-এর ধরন অনুযায়ী অধ্যায়ের ঘর দেখানো / লুকানো
    (co?.monthlyFees || []).forEach(addMonthlyFeeRow);
    $("#addMonthlyFee").onclick = () => addMonthlyFeeRow();
    const feeTypeInput = $('#modalBody [name="feeType"]');
    const showMonthlyFees = () => { const active = feeTypeInput.value === "monthly"; $("#monthlyFeeEditor").hidden = !active; $$("#monthlyFeeEditor input").forEach(el => el.disabled = !active); };
    feeTypeInput.addEventListener("change", showMonthlyFees); showMonthlyFees();
  }
  function batchForm(b, session) {
    const clock = U.parseBatchTime(b?.time);
    openForm({
      title: b ? `ব্যাচ বদলান — ${b.name}` : "নতুন ক্লাস ব্যাচ",
      fields: [
        { name: "session", label: "সেশন", type: "select", options: sessionOptions(), required: true },
        { name: "name", label: "ব্যাচের নাম", required: true, placeholder: "যেমন: 27-H" },
        { name: "days", label: "দিন", placeholder: "যেমন: শনি, সোম, বুধ" },
        { name: "timePeriod", label: "সময়কাল", type: "select", options: [["", "সময় নির্ধারণ হয়নি"], ...["ভোর", "সকাল", "দুপুর", "বিকাল", "সন্ধ্যা", "রাত"].map(p => [p, p]), ...(!clock && b?.time ? [["__legacy", b.time + " (বর্তমান সময়)"]] : [])] },
        { name: "timeHour", label: "ঘণ্টা", type: "select", options: [["", "ঘণ্টা বাছুন"], ...Array.from({length:12}, (_, i) => [String(i + 1), bn(i + 1)])] },
        { name: "timeMinute", label: "মিনিট", type: "select", options: Array.from({length:60}, (_, i) => [String(i).padStart(2, "0"), bn(String(i).padStart(2, "0"))]) },
        { name: "capacity", label: "মোট সিট", type: "number", value: 15, min: 1 },
        { name: "tag", label: "ওয়েবসাইটে লাল ট্যাগ (ঐচ্ছিক)", placeholder: "যেমন: নতুন ব্যাচে ভর্তি চলছে — খালি রাখলে ট্যাগ দেখাবে না", wide: true },
      ],
      values: { ...(b || { session, name: session ? `${session.slice(-2)}-${String.fromCharCode(65 + DB.batches.filter((x) => x.session === session).length)}` : "" }), timePeriod: clock?.period || (b?.time ? "__legacy" : ""), timeHour: clock?.hour || "", timeMinute: clock?.minute || "00" },
      onSave: async (d) => { const { timePeriod, timeHour, timeMinute, ...details } = d;
        if (timePeriod && timePeriod !== "__legacy" && !timeHour) throw new Error("সময় নির্ধারণ করতে ঘণ্টা বাছুন");
        if (!timePeriod && (timeHour || timeMinute !== "00")) throw new Error("সকাল, দুপুর, বিকাল বা রাত বাছুন");
        const time = timePeriod === "__legacy" ? b.time : timePeriod ? timePeriod + " " + bn(timeHour + ":" + timeMinute) : "";
        await save("batches", { ...details, time, active: !b || b.active !== false }, b && b.id); await load(); route(); toast("সেভ হয়েছে"); },
    });
  }
  function sessionForm(se) {
    if (se) {
      return openForm({
        title: `সেশন — ${se.name}`,
        fields: [{ name: "name", label: "এইচএসসি ব্যাচের নাম", required: true }, { name: "active", label: "চালু (ভর্তি ও ওয়েবসাইটে দেখাবে)", type: "check" }],
        values: se,
        onSave: async (d) => { await save("sessions", d, se.id); await load(); route(); toast("সেভ হয়েছে"); },
      });
    }
    const y = new Date().getFullYear() % 100;
    const next = [y + 1, y + 2, y + 3, y + 4].map((n) => `HSC-${n}`).find((n) => !DB.sessions.some((s) => s.name === n)) || "";
    openForm({
      title: "নতুন সেশন খুলুন",
      fields: [
        { type: "html", html: '<p style="margin:0;color:var(--muted)">নতুন সেশনের সাথে ক্লাস ব্যাচগুলোও (A, B, C…) নিজে থেকে তৈরি হবে। দিন ও সময় পরে বসাতে পারবেন।</p>' },
        { name: "name", label: "সেশনের নাম", required: true, placeholder: "HSC-29" },
        { name: "batches", label: "কয়টা ক্লাস ব্যাচ", type: "number", value: 7, min: 0 },
      ],
      values: { name: next },
      onSave: async (d) => { await api("/api/admin/session-open", { body: d }); await load(); route(); toast(`${d.name} খোলা হয়েছে`); },
    });
  }
  // ---------- ব্যাচ বন্ধ / ছুটি ----------
  const CLOSE_REASONS = ["ঈদের ছুটি", "পূজার ছুটি", "পরীক্ষার জন্য বন্ধ", "শিক্ষক ছুটিতে", "অন্যান্য"];
  const closureStatus = (cl) => (cl.to < U.today() ? "শেষ" : cl.from > U.today() ? "সামনে" : "চলছে");
  const pastMonthTouched = (cl) => cl && cl.from && cl.from.slice(0, 7) < U.today().slice(0, 7);
  const closureFeeText = (cl) => !cl.reduceFee ? "ফি পুরো থাকবে"
    : U.closureCutsFee(cl) ? "বন্ধের ক্লাসের টাকা কমবে" : `টাকা কমবে না (${bn(U.MIN_CLOSURE_DAYS)} দিনের কম বন্ধ)`;
  function closureForm(cl) {
    const sel = new Set(cl ? cl.batchIds : []);
    const groups = DB.sessions.map((se) => {
      const list = DB.batches.filter((b) => b.session === se.name);
      return list.length ? `<div class="cl-sess"><b>${esc(se.name)}</b><div class="cl-batches">${list.map((b) => `<label class="cl-b"><input type="checkbox" name="clb" value="${b.id}"${sel.has(b.id) ? " checked" : ""}><span><b>${esc(b.name)}</b><small>${esc(b.days || "দিন ঠিক হয়নি")} · ${esc(b.time || "")}</small></span></label>`).join("")}</div></div>` : "";
    }).join("");
    const dayGroups = [...new Set(DB.batches.map((b) => b.days).filter(Boolean))];
    openModal({
      title: cl ? "ব্যাচ বন্ধ — বদলান" : "❚❚ ব্যাচ বন্ধ রাখুন",
      wide: true,
      saveText: cl ? "সেভ করুন" : "বন্ধ রাখুন",
      body: `<div class="fgrid">
        <div class="wide"><b>কোন কোন ব্যাচ বন্ধ থাকবে?</b>
          <div class="cl-quick">${dayGroups.map((d) => `<button type="button" class="btn sm line" data-qd="${esc(d)}">সব ${esc(d)}</button>`).join("")}<button type="button" class="btn sm line" data-qd="*">সব ব্যাচ</button><button type="button" class="btn sm line" data-qd="">কোনোটা না</button></div>
          ${groups || '<p class="empty">কোনো ব্যাচ নেই</p>'}</div>
        <label>কবে থেকে *<input type="date" name="from" value="${esc(cl ? cl.from : U.today())}" required></label>
        <label>কবে পর্যন্ত *<input type="date" name="to" value="${esc(cl ? cl.to : "")}" required></label>
        <label class="wide">কারণ<input name="reason" value="${esc(cl ? cl.reason : "")}" placeholder="যেমন: ঈদের ছুটি" data-combo="CLOSE_REASONS"></label>
        <div class="wide"><b>এই বন্ধে মাসের ফি?</b>
          <label class="cl-fee"><input type="radio" name="reduceFee" value="0"${!cl || !cl.reduceFee ? " checked" : ""}><span><b>ফি পুরো থাকবে</b><small>যেমন ঈদের ছুটি — বন্ধ থাকলেও মাসের পুরো ফি</small></span></label>
          <label class="cl-fee"><input type="radio" name="reduceFee" value="1"${cl && cl.reduceFee ? " checked" : ""}><span><b>বন্ধের ক্লাসের টাকা কমবে</b><small>ঐ মাসে যতগুলো ক্লাস হবে, শুধু সেগুলোর টাকা (ক্লাস প্রতি ৮৩ টাকা, ৫০-এ রাউন্ড)। তবে ${bn(U.MIN_CLOSURE_DAYS)} দিনের কম বন্ধ হলে কমবে না।</small></span></label>
        </div>
        <p class="wide cl-days" id="clDays"></p>
      </div>`,
      onSave: async () => {
        const body = {
          batchIds: $$('#modalBody [name="clb"]:checked').map((x) => x.value),
          from: $('#modalBody [name="from"]').value, to: $('#modalBody [name="to"]').value,
          reason: $('#modalBody [name="reason"]').value.trim(),
          reduceFee: $('#modalBody [name="reduceFee"]:checked').value === "1",
        };
        if (!body.batchIds.length) throw new Error("অন্তত একটি ব্যাচ বেছে নিন");
        if (!body.from || !body.to) throw new Error("কবে থেকে আর কবে পর্যন্ত — দুটো তারিখই দিন");
        if (body.to < body.from) throw new Error("শেষ তারিখ শুরুর তারিখের আগে হতে পারে না");
        // আগের মাসের বকেয়া বদলাবে — জানিয়ে নেওয়া
        const feeChanges = cl ? (cl.reduceFee !== body.reduceFee || cl.from !== body.from || cl.to !== body.to || String(cl.batchIds) !== String(body.batchIds)) && (cl.reduceFee || body.reduceFee) : body.reduceFee;
        if (feeChanges && (pastMonthTouched(cl) || pastMonthTouched(body)) && !confirm("এই বন্ধ আগের মাসের সাথে জড়িত। সেভ করলে ঐ মাসের শিক্ষার্থীদের বকেয়া হিসাবও বদলে যাবে। তবুও সেভ করবেন?")) return true;
        await save("closures", body, cl && cl.id); await load(); route(); toast(cl ? "সেভ হয়েছে" : "ব্যাচ বন্ধ রাখা হয়েছে");
      },
    });
    const box = $("#modalBody");
    U.combo($('[name="reason"]', box), () => CLOSE_REASONS);
    const showDays = () => {
      const f = $('[name="from"]', box).value, t = $('[name="to"]', box).value;
      $("#clDays").textContent = f && t && t >= f ? `মোট ${bn(U.closureDays({ from: f, to: t }))} দিন বন্ধ${U.closureDays({ from: f, to: t }) < U.MIN_CLOSURE_DAYS ? ` — ${bn(U.MIN_CLOSURE_DAYS)} দিনের কম, তাই ফি কমবে না` : ""}` : "";
    };
    box.addEventListener("input", showDays); showDays();
    box.onclick = (e) => {
      const q = e.target.closest("[data-qd]"); if (!q) return;
      $$('[name="clb"]', box).forEach((x) => { const b = batchById(x.value); x.checked = q.dataset.qd === "*" ? true : q.dataset.qd === "" ? false : x.checked || (b && b.days === q.dataset.qd); });
    };
  }
  // কোর্স মডিউল পাতার প্যানেল-শিরোনাম (রং: t-off / t-on / t-close / t-sess)
  const panelHead = (ic, title, sub) => `<h2 class="panel-title"><i>${ic}</i><span>${title}<small>${sub}</small></span></h2>`;
  function closuresCard() {
    const list = [...(DB.closures || [])].sort((a, b) => b.from.localeCompare(a.from));
    const now = list.filter((cl) => closureStatus(cl) !== "শেষ").length;
    return `<div class="card cm-panel t-close"><div class="card-head">${panelHead("❚❚", "অফলাইন ব্যাচ বন্ধ / ছুটি", `কোন ব্যাচ কবে বন্ধ, ফি কমবে কিনা · ${now ? bn(now) + "টি চলছে / সামনে" : "এখন কোনো বন্ধ নেই"}`)}<button class="btn gold" id="addCl">❚❚ ব্যাচ বন্ধ রাখুন</button></div>
      <div class="tbl-wrap"><table><thead><tr><th>সময়</th><th>ব্যাচ</th><th>কারণ</th><th>ফি</th><th></th></tr></thead><tbody>
      ${list.map((cl) => { const st = closureStatus(cl); return `<tr${st === "শেষ" ? ' class="muted-row"' : ""}><td><b>${U.date(cl.from)} – ${U.date(cl.to)}</b><small>${bn(U.closureDays(cl))} দিন · <span class="chip ${st === "চলছে" ? "bad" : st === "সামনে" ? "gold" : ""}">${st}</span></small></td>
        <td>${cl.batchIds.map((id) => esc(batchName(id))).join(", ")}</td><td>${esc(cl.reason || "—")}</td>
        <td>${U.closureCutsFee(cl) ? '<span class="chip ok">টাকা কমবে</span>' : `<span class="chip">${esc(closureFeeText(cl))}</span>`}</td>
        <td class="num"><button class="icon-btn" data-ecl="${cl.id}">✎</button><button class="icon-btn" data-dcl="${cl.id}">✕</button></td></tr>`; }).join("") || '<tr><td colspan="5" class="empty">কোনো বন্ধ নেই। ছুটি বা বন্ধ থাকলে "❚❚ ব্যাচ বন্ধ রাখুন" চাপুন।</td></tr>'}
      </tbody></table></div></div>`;
  }
  function courses(c) {
    const act = activeStudents();
    c.innerHTML = `
      ${[["offline", "", "কোচিংয়ে সরাসরি ক্লাস"], ["online", "", "অনলাইনে ক্লাস"]].map(([md, ic, sub]) => `<div class="card cm-panel ${md === "online" ? "t-on" : "t-off"}"><div class="card-head">${panelHead(ic, (md === "online" ? "অনলাইন" : "অফলাইন") + " কোর্স মডিউল", `${sub} · ${bn(DB.courses.filter((m) => modeOf(m) === md).length)}টি মডিউল`)}<button class="btn gold" data-addc="${md}">+ নতুন মডিউল</button></div>
        <div class="tbl-wrap"><table><thead><tr><th>মডিউল</th><th>ফি</th><th class="num">ভর্তি আছে</th><th>ওয়েবসাইটে</th><th></th></tr></thead><tbody>
        ${DB.courses.filter((m) => modeOf(m) === md).map((m) => `<tr><td>${m.image ? `<img class="cm-thumb" src="/api/cimage/${m.id}/image?v=${m.image.v}" alt="">` : ""}<b>${esc(m.code)} — ${esc(m.name)}</b>${m.routine ? ' <span class="chip">রুটিন</span>' : ""} ${m.popular ? '<span class="chip gold">জনপ্রিয়</span>' : ""}<small>${esc(m.short)}</small>${m.feeType === "chapter" ? `<small>${(m.chapters || []).map((x) => `${esc(x.id)}: ${money(x.fee)}`).join(" · ")}</small>` : ""}</td>
          <td>${feeText(m)}</td><td class="num">${bn(DB.enrollments.filter((e) => e.courseId === m.id && e.status === "active").length)}</td><td>${m.active !== false ? '<span class="chip ok">চালু</span>' : '<span class="chip">লুকানো</span>'}</td>
          <td class="num" style="white-space:nowrap">${modeOf(m) === "online" ? `<button class="btn sm line" data-les="${m.id}">ভিডিও ক্লাস (${bn((m.lessons || []).length)})</button> ` : `<span class="acc-dd"><button class="btn sm line${grantsOf(m.id).length ? " on" : ""}" data-accmenu="${m.id}" title="এই মডিউলের সব শিক্ষার্থীর অনলাইন অ্যাক্সেস">অনলাইন অ্যাক্সেস ▾</button>
            <span class="acc-menu" hidden><button type="button" class="acc-on" data-grant="${m.id}">● অনলাইন অ্যাক্সেস চালু</button><button type="button" class="acc-off" data-revoke="${m.id}">● অনলাইন অ্যাক্সেস বন্ধ</button></span></span> `}<button class="icon-btn" data-ec="${m.id}">✎</button><button class="icon-btn" data-dc="${m.id}">✕</button></td></tr>`).join("") || `<tr><td colspan="5" class="empty">কোনো মডিউল নেই — "+ নতুন মডিউল" চাপুন</td></tr>`}
        </tbody></table></div></div>`).join("")}
      ${closuresCard()}
      <div class="card cm-panel t-sess"><div class="card-head">${panelHead("", "অফলাইন সেশন ও ব্যাচসমূহ", `${bn(DB.sessions.length)}টি সেশন · ${bn(DB.batches.length)}টি ব্যাচ`)}<button class="btn gold" id="addS">+ নতুন সেশন খুলুন</button></div>
        ${DB.sessions.map((se) => {
          const list = DB.batches.filter((b) => b.session === se.name);
          return `<div class="sess-block${se.active === false ? " off" : ""}">
            <div class="sess-head"><h3><span class="sess-name">${esc(se.name)}</span> <small>${se.active === false ? "বন্ধ · " : ""}${bn(act.filter((s) => s.session === se.name).length)} জন শিক্ষার্থী</small></h3>
              <div><button class="btn sm gold" data-addb="${esc(se.name)}">+ ব্যাচ যোগ</button> <button class="btn sm line" data-es="${esc(se.id)}">✎ সেশন</button> <button class="icon-btn" title="সেশন মুছুন" data-ds="${esc(se.id)}">✕</button></div></div>
            <div class="tbl-wrap"><table><thead><tr><th>ব্যাচ</th><th>দিন</th><th>সময়</th><th class="num">শিক্ষার্থী / সিট</th><th>অবস্থা</th><th></th></tr></thead><tbody>
            ${list.map((b) => { const n = act.filter((s) => s.batchId === b.id).length; const cl = U.closureOn(DB.closures, b.id, U.today()); const next = !cl && (DB.closures || []).filter((x) => x.batchIds.includes(b.id) && x.from > U.today()).sort((x, y) => x.from.localeCompare(y.from))[0];
              return `<tr><td><b>${esc(U.batchLabel(b))}</b>${cl ? `<small><span class="chip bad">❚❚ বন্ধ: ${U.date(cl.to)} পর্যন্ত</span></small>` : next ? `<small><span class="chip gold">${U.date(next.from)} থেকে বন্ধ</span></small>` : ""}</td><td>${esc(b.days || "—")}</td><td>${esc(b.time || "—")}</td><td class="num">${n >= b.capacity ? '<span class="chip bad">পূর্ণ</span> ' : ""}${bn(n)} / ${bn(b.capacity)}</td>
              <td><button type="button" class="st-toggle ${b.active === false ? "off" : "on"}" data-btoggle="${b.id}" title="${b.active === false ? "চাপ দিয়ে সক্রিয় করুন" : "চাপ দিয়ে নিষ্ক্রিয় করুন — নতুন ভর্তি ও ওয়েবসাইটে আর দেখাবে না"}"><i></i>${b.active === false ? "নিষ্ক্রিয়" : "সক্রিয়"}</button></td>
              <td class="num"><button class="icon-btn" data-eb="${b.id}">✎</button><button class="icon-btn" data-db="${b.id}">✕</button></td></tr>`; }).join("") || '<tr><td colspan="6" class="empty">কোনো ব্যাচ নেই — "+ ব্যাচ যোগ" চাপুন</td></tr>'}
            </tbody></table></div></div>`;
        }).join("") || '<p class="empty">কোনো সেশন নেই — "নতুন সেশন খুলুন" চাপুন</p>'}
      </div>`;
    $("#addS").onclick = () => sessionForm();
    $("#addCl").onclick = () => closureForm();
    c.onclick = async (e) => {
      const bt = e.target.closest("[data-btoggle]");
      if (bt) {
        const b = batchById(bt.dataset.btoggle), off = b.active === false, n = DB.students.filter((s) => s.batchId === b.id && s.status !== "inactive").length;
        if (!off && !confirm(`${b.name} ব্যাচ নিষ্ক্রিয় করবেন?\n\nনতুন ভর্তি, ব্যাচ বদল আর ওয়েবসাইটে এই ব্যাচ আর দেখাবে না।${n ? `\nএই ব্যাচের ${bn(n)} জন শিক্ষার্থী, তাদের হাজিরা, ফি আর ফলাফল আগের মতোই থাকবে।` : ""}`)) return;
        try { await save("batches", { ...b, active: off }, b.id); await load(); route(); toast(off ? `${b.name} সক্রিয় হয়েছে` : `${b.name} নিষ্ক্রিয় হয়েছে`); } catch (er) { toast(er.message, true); }
        return;
      }
      const t = e.target.closest("[data-les],[data-accmenu],[data-grant],[data-revoke],[data-addc],[data-ec],[data-dc],[data-eb],[data-db],[data-addb],[data-es],[data-ds],[data-ecl],[data-dcl]"); if (!t) return;
      if (t.dataset.ecl) closureForm(DB.closures.find((x) => x.id === t.dataset.ecl));
      if (t.dataset.dcl) {
        const cl = DB.closures.find((x) => x.id === t.dataset.dcl);
        if (cl && U.closureCutsFee(cl) && pastMonthTouched(cl) && !confirm("এই বন্ধে আগের মাসের ফি কমানো হয়েছিল। মুছলে ঐ মাসের শিক্ষার্থীদের বকেয়া আবার বেড়ে যাবে। তবুও মুছবেন?")) return;
        remove("closures", t.dataset.dcl, "এই বন্ধ");
      }
      if (t.dataset.les) lessonEditor(courseById(t.dataset.les));
      // অনলাইন অ্যাক্সেসের ছোট মেনু খোলা / বন্ধ (একবারে একটাই খোলা)
      if (t.dataset.accmenu) { const mn = t.nextElementSibling, open = mn.hidden; document.querySelectorAll(".acc-menu").forEach((x) => (x.hidden = true)); mn.hidden = !open; if (open) { const r = t.getBoundingClientRect(); Object.assign(mn.style, { position: "fixed", top: r.bottom + 6 + "px", left: Math.max(8, r.right - 210) + "px", right: "auto" }); } return; }
      document.querySelectorAll(".acc-menu").forEach((x) => (x.hidden = true));
      if (t.dataset.grant) grantOnline(courseById(t.dataset.grant));
      if (t.dataset.revoke) { if (!grantsOf(t.dataset.revoke).length) return toast("এই মডিউল থেকে এখনো কোনো অনলাইন অ্যাক্সেস দেওয়া হয়নি", true); revokeOnline(courseById(t.dataset.revoke)); }
      if (t.dataset.addc) courseForm(null, t.dataset.addc);
      if (t.dataset.ec) courseForm(courseById(t.dataset.ec));
      if (t.dataset.dc) remove("courses", t.dataset.dc, "এই মডিউল");
      if (t.dataset.eb) batchForm(batchById(t.dataset.eb));
      if (t.dataset.db) remove("batches", t.dataset.db, "এই ব্যাচ");
      if (t.dataset.addb) batchForm(null, t.dataset.addb);
      if (t.dataset.es) sessionForm(DB.sessions.find((s) => s.id === t.dataset.es));
      if (t.dataset.ds) remove("sessions", t.dataset.ds, "এই সেশন");
    };
  }

  // ---------- নোটিশ ----------
  function noticeForm(n) {
    const selB = new Set((n && n.batchIds) || []), selS = new Set((n && n.sessions) || []);
    const targetHtml = `<div id="ntTarget"><b>কাদের দেখাবে?</b> <small style="color:var(--muted)">কিছু না বাছলে সব শিক্ষার্থী দেখবে। সেশন বা ব্যাচ বাছলে শুধু তারাই দেখবে (ওয়েবসাইটে যাবে না)।</small>
      ${DB.sessions.map((se) => { const list = DB.batches.filter((b) => b.session === se.name); return `<div class="cl-sess"><label class="check"><input type="checkbox" name="nts" value="${esc(se.name)}"${selS.has(se.name) ? " checked" : ""}> <b>পুরো সেশন — ${esc(se.name)}</b></label>${list.length ? `<div class="cl-batches">${list.map((b) => `<label class="cl-b"><input type="checkbox" name="ntb" value="${b.id}"${selB.has(b.id) || selS.has(se.name) ? " checked" : ""}><span><b>${esc(b.name)}</b><small>${esc(b.days || "")}${b.time ? " · " + esc(b.time) : ""}</small></span></label>`).join("")}</div>` : ""}</div>`; }).join("")}</div>`;
    openForm({
      title: n ? "নোটিশ বদলান" : "নতুন নোটিশ",
      fields: [
        { name: "title", label: "শিরোনাম", required: true, wide: true },
        { name: "body", label: "বিস্তারিত", type: "textarea", wide: true },
        { name: "date", label: "তারিখ", type: "date", value: U.today() },
        { name: "until", label: "কবে পর্যন্ত দেখাবে (ঐচ্ছিক)", type: "date" },
        { type: "html", html: targetHtml },
        { name: "public", label: "ওয়েবসাইটেও দেখান (সবাই দেখবে)", type: "check" },
        { name: "important", label: "জরুরি — উপরে দেখান", type: "check" },
        { type: "html", html: `<label>PDF সংযুক্তি (ঐচ্ছিক — যেমন পরীক্ষার পূর্ণ রুটিন; ১৫ MB পর্যন্ত)<input type="file" id="nPdf" accept="application/pdf,.pdf"></label>
          ${n && n.pdf ? `<p style="margin:6px 0 0">এখন আছে: <a href="/api/notice/${n.id}/pdf?v=${n.pdf.v}" target="_blank" rel="noopener">${esc(n.pdf.name)}</a> · নতুন PDF দিলে এটা বদলে যাবে
          <label class="check" style="display:inline-flex;margin-left:10px"><input type="checkbox" id="nPdfDel"> PDF সরিয়ে দিন</label></p>` : ""}` },
      ],
      values: n || {},
      onSave: async (d) => {
        d.sessions = $$('#modalBody [name="nts"]:checked').map((x) => x.value);
        d.batchIds = $$('#modalBody [name="ntb"]:checked').map((x) => x.value).filter((id) => { const b = DB.batches.find((x) => x.id === id); return !(b && d.sessions.includes(b.session)); });
        if (d.public && (d.batchIds.length || d.sessions.length)) throw new Error("নির্দিষ্ট সেশন / ব্যাচের নোটিশ ওয়েবসাইটে দেখানো যায় না — \"ওয়েবসাইটেও দেখান\" টিকটি তুলে দিন, অথবা সেশন / ব্যাচের টিক সরান");
        const file = $("#nPdf").files[0], del = $("#nPdfDel") && $("#nPdfDel").checked;
        if (file && !/\.pdf$/i.test(file.name)) throw new Error("শুধু PDF ফাইল দিন");
        if (file && file.size > 15 * 1024 * 1024) throw new Error("PDF অনেক বড় — ১৫ MB-এর মধ্যে দিন");
        const r = await save("notices", d, n && n.id), id = (n && n.id) || r.item.id;
        if (file) {
          const up = await fetch(`/api/admin/notices/${encodeURIComponent(id)}/pdf?name=${encodeURIComponent(file.name)}`, { method: "POST", body: file });
          const j = await up.json().catch(() => ({}));
          if (!up.ok) { await load(); route(); throw new Error("নোটিশ সেভ হয়েছে, কিন্তু PDF আপলোড হয়নি: " + (j.error || "আবার চেষ্টা করুন")); }
        } else if (del) await api(`/api/admin/notices/${encodeURIComponent(id)}/pdf`, { method: "DELETE" });
        await load(); route(); toast("সেভ হয়েছে");
      },
    });
  }
  // নোটিশের "কাদের দেখাবে?": পুরো সেশন টিক দিলে তার সব ব্যাচ টিক হয়; কোনো ব্যাচ বাদ দিলে সেশনের টিক উঠে যায়
  document.addEventListener("change", (e) => {
    const t = e.target, sec = t && t.closest && t.closest("#ntTarget .cl-sess");
    if (!sec || !t.name) return;
    const batches = [...sec.querySelectorAll('[name="ntb"]')];
    if (t.name === "nts") batches.forEach((x) => { x.checked = t.checked; });
    else if (t.name === "ntb") { const s = sec.querySelector('[name="nts"]'); if (s) s.checked = batches.length > 0 && batches.every((x) => x.checked); }
  });
  function noticeTargetChip(n) {
    const parts = [...(n.sessions || []).map((s) => "সেশন " + s), ...(n.batchIds || []).map((id) => batchName(id))];
    if (parts.length) return `<span class="chip gold" title="${esc(parts.join(", "))}">শুধু: ${esc(parts.join(", "))}</span>`;
    if (n.studentIds && n.studentIds.length) return '<span class="chip gold">নির্দিষ্ট শিক্ষার্থী</span>';
    return '<span class="chip gold">সব শিক্ষার্থী (প্যানেল)</span>';
  }
  function notices(c) {
    c.innerHTML = `<div class="card"><div class="card-head"><h2>সব নোটিশ</h2><button class="btn gold" id="addN">+ নতুন নোটিশ</button></div>
      <p style="margin-top:0;color:var(--muted)">সব নোটিশ শিক্ষার্থী প্যানেলে দেখায়। "ওয়েবসাইটেও দেখান" দিলে পাবলিক সাইটের "নোটিশ" বোর্ডেও দেখাবে।</p>
      <div class="tbl-wrap"><table><thead><tr><th>নোটিশ</th><th>তারিখ</th><th>কোথায়</th><th></th></tr></thead><tbody>
      ${DB.notices.slice().sort((a, b) => b.date.localeCompare(a.date)).map((n) => {
        const expired = n.until && n.until < U.today();
        return `<tr><td><b>${n.important ? "" : ""}${esc(n.title)}</b>${n.pdf ? ` <a class="chip" href="/api/notice/${n.id}/pdf?v=${n.pdf.v}" target="_blank" rel="noopener" title="${esc(n.pdf.name)}">PDF</a>` : ""}<small>${esc(n.body)}</small></td><td>${U.date(n.date)}${n.until ? `<small>${expired ? "মেয়াদ শেষ" : "চলবে " + U.date(n.until) + " পর্যন্ত"}</small>` : ""}</td>
        <td>${expired ? '<span class="chip">মেয়াদ শেষ</span>' : n.public ? '<span class="chip ok">ওয়েবসাইট + প্যানেল</span>' : noticeTargetChip(n)}</td>
        <td class="num"><button class="icon-btn" data-en="${n.id}">✎</button><button class="icon-btn" data-dn="${n.id}">✕</button></td></tr>`;
      }).join("") || `<tr><td colspan="4" class="empty">কোনো নোটিশ নেই</td></tr>`}</tbody></table></div></div>`;
    $("#addN").onclick = () => noticeForm();
    c.onclick = (e) => { const t = e.target.closest("[data-en],[data-dn]"); if (!t) return; if (t.dataset.en) noticeForm(DB.notices.find((n) => n.id === t.dataset.en)); if (t.dataset.dn) remove("notices", t.dataset.dn, "এই নোটিশ"); };
  }

  // ---------- মেয়াদ: মডিউলের রেকর্ড ক্লাস আর প্রিমিয়াম ই-বুক — কার কবে শেষ, বাড়ানো ----------
  // মেয়াদ: একটাই ঘর — "আজীবন (কখনো বন্ধ হবে না)" লেখা থাকে; মুছে যেকোনো দিনের সংখ্যা লেখা যায়, বা তালিকা থেকে ১/৩/৬ মাস, ১/২ বছর বাছা যায়
  const LIFE = "আজীবন (কখনো বন্ধ হবে না)";
  const VALIDITY_LIST = [LIFE, "৩০ দিন (১ মাস)", "৯০ দিন (৩ মাস)", "১৮০ দিন (৬ মাস)", "৩৬৫ দিন (১ বছর)", "৭৩০ দিন (২ বছর)"];
  const validityVals = (n) => ({ validityText: Number(n) > 0 ? (VALIDITY_LIST.find((t) => t.startsWith(bn(n) + " দিন")) || `${bn(n)} দিন`) : LIFE });
  const validityFrom = (d) => {
    const t = String(d.validityText || "").trim(), m = t.replace(/[০-৯]/g, (x) => "০১২৩৪৫৬৭৮৯".indexOf(x)).match(/\d+/);
    if (!t || /আজীবন/.test(t)) return 0;
    if (!m || !(Number(m[0]) > 0)) throw new Error("মেয়াদের ঘরে \"আজীবন\" রাখুন, অথবা দিনের সংখ্যা লিখুন (যেমন ৪৫)");
    return Math.min(3650, Number(m[0]));
  };
  // মেয়াদের ঘরে তালিকা জুড়ে দেওয়া (টাইপও করা যায়)
  function attachValidityList() {
    const inp = document.querySelector("#modalBody [name=validityText]"); if (!inp) return;
    if (!document.getElementById("valOpts")) document.body.insertAdjacentHTML("beforeend", `<datalist id="valOpts">${VALIDITY_LIST.map((t) => `<option value="${t}"></option>`).join("")}</datalist>`);
    inp.setAttribute("list", "valOpts"); inp.setAttribute("autocomplete", "off");
    inp.addEventListener("focus", () => { if (inp.value === LIFE) inp.select(); });
  }
  let accessFilter = "soon";
  async function accessPage(c) {
    c.innerHTML = '<div class="card"><p class="empty">লোড হচ্ছে…</p></div>';
    const r = await api("/api/admin/access"), items = r.items;
    const groups = [["soon", "৭ দিনের মধ্যে শেষ", (x) => !x.expired && x.daysLeft !== null && x.daysLeft <= 7], ["expired", "মেয়াদ শেষ", (x) => x.expired], ["active", "চালু", (x) => !x.expired], ["life", "আজীবন", (x) => x.lifetime], ["all", "সব", () => true]];
    const [, , test] = groups.find((g) => g[0] === accessFilter) || groups[4];
    const list = items.filter(test).sort((a, b) => (a.lifetime ? 1 : 0) - (b.lifetime ? 1 : 0) || String(a.until).localeCompare(String(b.until)));
    const left = (x) => x.lifetime ? '<span class="chip ok">আজীবন</span>' : x.expired ? `<span class="chip bad">শেষ (${U.date(x.until)})</span>` : `<span class="chip ${x.daysLeft <= 7 ? "gold" : "ok"}">${bn(x.daysLeft)} দিন বাকি</span>`;
    c.innerHTML = `<div class="card"><div class="card-head"><h2>মেয়াদ — রেকর্ড ক্লাস ও প্রিমিয়াম ই-বুক</h2></div>
      <p style="margin-top:0;color:var(--muted)">মডিউলে "রেকর্ড ক্লাস কত দিন খোলা থাকবে" দিলে শিক্ষার্থীর ভর্তির দিন থেকে গোনা হয়; শেষ হলে রেকর্ড ক্লাস নিজে থেকে বন্ধ হয় (ফলাফল, হাজিরা, ফি দেখা যায়)। শেষ হওয়ার ৭ দিন আগে থেকে শিক্ষার্থী প্যানেলে সতর্কবার্তা দেখায়। এখান থেকে মেয়াদ বাড়ানো যায়।</p>
      <div class="qn-tabs" style="margin-bottom:12px">${groups.map(([k, t, f]) => `<button type="button" class="${accessFilter === k ? "on" : ""}" data-af="${k}">${t} (${bn(items.filter(f).length)})</button>`).join("")}</div>
      <div class="tbl-wrap"><table><thead><tr><th>শিক্ষার্থী / ক্রেতা</th><th>কী</th><th>শুরু</th><th>শেষ</th><th>অবস্থা</th><th>মেয়াদ বাড়ান</th></tr></thead><tbody>
      ${list.map((x, i) => `<tr><td><b>${esc(x.name || "—")}</b><small>${esc(x.phone || "")}${x.studentId ? " · " + esc(x.studentId) : ""}</small></td>
        <td>${x.kind === "ebook" ? "📕 " : "🎬 "}${esc(x.item)}<small>${x.kind === "ebook" ? "প্রিমিয়াম ই-বুক" : x.mode === "online" ? "অনলাইন মডিউল" : "মডিউল"}</small></td>
        <td>${x.since ? U.date(x.since) : "—"}</td><td>${x.until ? U.date(x.until) : "—"}</td><td>${left(x)}</td>
        <td class="num" style="white-space:nowrap"><button class="btn sm line" data-ax="${i}" data-add="30">+৩০ দিন</button> <button class="btn sm line" data-ax="${i}" data-date>তারিখ…</button> <button class="btn sm line" data-ax="${i}" data-life>আজীবন</button>${x.lifetime || x.until ? ` <button class="btn sm line" data-ax="${i}" data-reset title="মডিউল / ই-বুকের নিয়মে ফেরান">↺</button>` : ""}</td></tr>`).join("") || '<tr><td colspan="6" class="empty">এই ভাগে কেউ নেই</td></tr>'}</tbody></table></div></div>`;
    c.onclick = async (ev) => {
      const f = ev.target.closest("[data-af]"); if (f) { accessFilter = f.dataset.af; return accessPage(c); }
      const b = ev.target.closest("[data-ax]"); if (!b) return;
      const x = list[b.dataset.ax], body = { kind: x.kind, id: x.id, phone: x.phone };
      if (b.dataset.add) body.addDays = Number(b.dataset.add);
      else if (b.hasAttribute("data-life")) { if (!confirm(`${x.name || x.phone} — "${x.item}" আজীবন খোলা থাকবে?`)) return; body.lifetime = true; }
      else if (b.hasAttribute("data-reset")) body.reset = true;
      else if (b.hasAttribute("data-date")) {
        const v = prompt("কোন তারিখ পর্যন্ত খোলা থাকবে? (যেমন 2027-06-30)", x.until || U.today());
        if (!v) return; if (!/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return toast("তারিখ এভাবে লিখুন: 2027-06-30", true); body.until = v.trim();
      }
      try { await api("/api/admin/access", { body }); toast("মেয়াদ বদলানো হয়েছে"); } catch (er) { toast(er.message, true); }
      accessPage(c);
    };
  }

  // ---------- প্রতিদিন শিখি (/daily) — ৬ ক্যাটাগরি, প্রতিদিনের পোস্ট, খসড়া, প্রকাশের তারিখ, MCQ কুইজ ----------
  const DAILY_CATS = [["bangla", "Daily Bangla"], ["ict", "Daily ICT"], ["gk", "Daily GK"], ["english", "Daily English"], ["fact", "আজকের তথ্য"], ["brain", "Brain Booster"]];
  const dailyCat = (k) => (DAILY_CATS.find((c) => c[0] === k) || [k, k])[1];
  let dailyFilter = { cat: "", status: "" };
  const dqRow = (q = {}, i = 0) => `<div class="dq-row" data-dq>
      <div class="dq-top"><b>প্রশ্ন ${bn(i + 1)}</b><button type="button" class="btn sm line" data-dq-del>✕ বাদ দিন</button></div>
      <label>প্রশ্ন<input data-dq-q value="${esc(q.q || "")}" placeholder="যেমন: কোনটি আউটপুট ডিভাইস?"></label>
      <div class="dq-opts">${[0, 1, 2, 3].map((j) => `<label class="dq-opt"><input type="radio" name="dqc${i}" data-dq-c value="${j}"${(q.correct || 0) === j ? " checked" : ""} title="সঠিক উত্তর"><input data-dq-o value="${esc((q.options || [])[j] || "")}" placeholder="অপশন ${"কখগঘ"[j]}"></label>`).join("")}</div>
      <small style="color:var(--muted)">গোল বোতামে টিক দিয়ে সঠিক উত্তর বাছুন</small>
      <label>ব্যাখ্যা (উত্তর দেওয়ার পর দেখাবে, ঐচ্ছিক)<textarea data-dq-e rows="2">${esc(q.explain || "")}</textarea></label></div>`;
  function dailyForm(d) {
    openForm({
      title: d ? "পোস্ট বদলান" : "নতুন পোস্ট — প্রতিদিন শিখি",
      fields: [
        { name: "category", label: "ক্যাটাগরি", type: "select", options: DAILY_CATS },
        { name: "date", label: "প্রকাশের তারিখ (সামনের তারিখ দিলে সেদিন নিজে থেকে দেখা দেবে)", type: "date", value: U.today() },
        { name: "title", label: "শিরোনাম", required: true, wide: true, placeholder: "যেমন: আজকের শব্দ — Resilient" },
        { name: "body", label: "বিস্তারিত (Description) — নতুন লাইনে নতুন অনুচ্ছেদ", type: "textarea", wide: true, rows: 9 },
        { name: "status", label: "অবস্থা", type: "select", options: [["published", "প্রকাশিত"], ["draft", "খসড়া (ওয়েবসাইটে দেখাবে না)"]] },
        { type: "html", html: `<label>ছবি (ঐচ্ছিক — চওড়া, ১৬:৯ হলে সবচেয়ে ভালো)<input type="file" id="dImg" accept="image/jpeg,image/png,image/webp"></label>
          ${d && d.image ? `<p style="margin:4px 0 0"><img src="/api/dimage/${d.id}/image?v=${d.image.v}" alt="" style="height:70px;border-radius:8px"> এখন আছে — নতুন দিলে বদলাবে</p>` : ""}` },
        { type: "html", html: `<div class="dq-box wide"><div class="dq-head"><h3 style="margin:0">MCQ কুইজ (ঐচ্ছিক)</h3><button type="button" class="btn sm gold" data-dq-add>+ প্রশ্ন যোগ করুন</button></div>
          <p style="margin:2px 0 8px;color:var(--muted)">শিক্ষার্থী উত্তর দিলে সাথে সাথে সঠিক উত্তর, ব্যাখ্যা আর স্কোর দেখবে। Brain Booster-এ ধাঁধা / IQ প্রশ্ন এভাবেই দিন।</p>
          <div id="dqList">${(d && d.quiz || []).map(dqRow).join("")}</div></div>` },
      ],
      values: d || { category: dailyFilter.cat || "ict", status: "published", date: U.today() },
      onSave: async (v) => {
        const quiz = [...document.querySelectorAll("#dqList [data-dq]")].map((row) => ({
          q: row.querySelector("[data-dq-q]").value.trim(), options: [...row.querySelectorAll("[data-dq-o]")].map((o) => o.value.trim()),
          correct: Number((row.querySelector("[data-dq-c]:checked") || {}).value || 0), explain: row.querySelector("[data-dq-e]").value.trim(),
        })).filter((q) => q.q || q.options.some(Boolean));
        for (const [i, q] of quiz.entries()) {
          if (!q.q) throw new Error(`প্রশ্ন ${bn(i + 1)}: প্রশ্নটা লিখুন`);
          if (q.options.filter(Boolean).length < 2) throw new Error(`প্রশ্ন ${bn(i + 1)}: অন্তত ২টা অপশন দিন`);
          if (!q.options[q.correct]) throw new Error(`প্রশ্ন ${bn(i + 1)}: সঠিক উত্তরের ঘরটা খালি`);
          // খালি অপশন বাদ দিলে সঠিক উত্তরের নম্বর ঠিক রাখা
          const keep = q.options.map((o, j) => [o, j]).filter(([o]) => o); q.correct = keep.findIndex(([, j]) => j === q.correct); q.options = keep.map(([o]) => o);
        }
        const img = $("#dImg").files[0];
        if (img && img.size > 8 * 1024 * 1024) throw new Error("ছবি ৮ MB-এর মধ্যে দিন");
        const r = await save("daily", { ...v, quiz }, d && d.id), id = (d && d.id) || r.item.id;
        if (img) {
          const x = await fetch(`/api/admin/daily/${encodeURIComponent(id)}/image?ext=${(img.name.match(/\.[a-z]+$/i) || [".jpg"])[0].toLowerCase().replace(".jpeg", ".jpg")}`, { method: "POST", body: img });
          if (!x.ok) { await load(); route(); throw new Error("পোস্ট সেভ হয়েছে, কিন্তু ছবি জমা হয়নি: " + ((await x.json().catch(() => ({}))).error || "")); }
        }
        await load(); route(); toast(v.status === "draft" ? "খসড়া সেভ হয়েছে" : "প্রকাশিত হয়েছে");
      },
    });
    // কুইজের প্রশ্ন যোগ / বাদ
    const box = document.getElementById("modalBody");
    box.onclick = (e) => {
      if (e.target.closest("[data-dq-add]")) { const list = $("#dqList"); list.insertAdjacentHTML("beforeend", dqRow({}, list.children.length)); list.lastElementChild.querySelector("[data-dq-q]").focus(); }
      const del = e.target.closest("[data-dq-del]"); if (del) del.closest("[data-dq]").remove();
    };
  }
  function daily(c) {
    const all = (DB.daily || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)));
    const list = all.filter((d) => (!dailyFilter.cat || d.category === dailyFilter.cat) && (!dailyFilter.status || (dailyFilter.status === "draft" ? d.status === "draft" : dailyFilter.status === "scheduled" ? d.status !== "draft" && d.date > U.today() : d.status !== "draft" && d.date <= U.today())));
    const st = (d) => d.status === "draft" ? '<span class="chip">খসড়া</span>' : d.date > U.today() ? '<span class="chip gold">নির্ধারিত</span>' : '<span class="chip ok">প্রকাশিত</span>';
    c.innerHTML = `<div class="card"><div class="card-head"><h2>প্রতিদিন শিখি</h2><div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn line" href="/daily" target="_blank" rel="noopener">→ ওয়েবসাইটে দেখুন</a><button class="btn gold" id="addDaily">+ নতুন পোস্ট</button></div></div>
      <p style="margin-top:0;color:var(--muted)">সবার জন্য ফ্রি — পড়তে লগইন লাগে না। প্রতিটি পোস্টে শিরোনাম, বিস্তারিত, ছবি, প্রকাশের তারিখ আর চাইলে MCQ কুইজ। খসড়া ওয়েবসাইটে দেখায় না; সামনের তারিখ দিলে সেদিন নিজে থেকে প্রকাশ হয়।</p>
      <div class="toolbar" style="margin:0 0 12px">
        <select id="dfCat"><option value="">সব ক্যাটাগরি</option>${DAILY_CATS.map(([k, t]) => `<option value="${k}"${dailyFilter.cat === k ? " selected" : ""}>${t} (${bn(all.filter((d) => d.category === k).length)})</option>`).join("")}</select>
        <select id="dfSt"><option value="">সব অবস্থা</option><option value="live"${dailyFilter.status === "live" ? " selected" : ""}>প্রকাশিত</option><option value="scheduled"${dailyFilter.status === "scheduled" ? " selected" : ""}>নির্ধারিত (সামনের তারিখ)</option><option value="draft"${dailyFilter.status === "draft" ? " selected" : ""}>খসড়া</option></select></div>
      <div class="tbl-wrap"><table><thead><tr><th>তারিখ</th><th>পোস্ট</th><th>ক্যাটাগরি</th><th>কুইজ</th><th>অবস্থা</th><th></th></tr></thead><tbody>
      ${list.map((d) => `<tr><td>${U.date(d.date)}</td><td><b>${esc(d.title)}</b><small>${esc(String(d.body || "").slice(0, 90))}</small></td><td>${esc(dailyCat(d.category))}</td><td>${(d.quiz || []).length ? bn(d.quiz.length) + "টি প্রশ্ন" : "—"}</td><td>${st(d)}</td>
        <td class="num">${d.status !== "draft" && d.date <= U.today() ? `<a class="icon-btn" href="/daily?post=${d.id}" target="_blank" rel="noopener" title="ওয়েবসাইটে দেখুন">↗</a>` : ""}<button class="icon-btn" data-ed="${d.id}">✎</button><button class="icon-btn" data-dd="${d.id}">✕</button></td></tr>`).join("") || '<tr><td colspan="6" class="empty">কোনো পোস্ট নেই — "+ নতুন পোস্ট" চাপুন</td></tr>'}</tbody></table></div></div>`;
    $("#addDaily").onclick = () => dailyForm();
    $("#dfCat").onchange = (e) => { dailyFilter.cat = e.target.value; daily(c); };
    $("#dfSt").onchange = (e) => { dailyFilter.status = e.target.value; daily(c); };
    c.onclick = (ev) => { const t = ev.target.closest("[data-ed],[data-dd]"); if (!t) return; if (t.dataset.ed) dailyForm(DB.daily.find((x) => x.id === t.dataset.ed)); if (t.dataset.dd) remove("daily", t.dataset.dd, "এই পোস্ট আর এর ছবি"); };
  }

  // ---------- ই-বুক (মূল পাতার "ই-বুক" অংশ) ----------
  // ফ্রি: লগইন করলেই PDF নামানো যায়; প্রিমিয়াম: "ক্রেতা" ঘরে যার মোবাইল নম্বর লেখা আছে শুধু সে নামাতে পারে
  // (ওয়েবসাইটে "কিনুন" চাপলে WhatsApp-এ অর্ডারের বার্তা আসে — টাকা পেলে এখানে তার নম্বর যোগ করুন)
  function ebookForm(e) {
    const categories = [...new Set([...DB.sessions.map((s) => s.name), ...(DB.ebooks || []).map((book) => book.category), e && e.category].filter(name => name && name !== "উভয়"))];
    openForm({
      title: e ? "ই-বুক বদলান" : "নতুন ই-বুক",
      fields: [
        { name: "title", label: "ই-বুকের নাম", required: true, wide: true, placeholder: "যেমন: আইসিটি শর্ট নোট — HSC 27" },
        { name: "short", label: "ছোট বিবরণ (কার্ডে দুই লাইন দেখায়)", type: "textarea", wide: true, rows: 3 },
        { name: "category", label: "শ্রেণি / সেশন (ফিল্টারে দেখায়)", type: "select", options: [["", "শ্রেণি / সেশন বেছে নিন"], ["উভয়", "উভয় (HSC-27 ও HSC-28)"], ...categories.map((name) => [name, name])] },
        { name: "kind", label: "ধরন", type: "select", options: [["free", "ফ্রি"], ["students", "ভর্তি হওয়া শিক্ষার্থীদের জন্য"], ["premium", "প্রিমিয়াম (টাকায়)"]] },
        { name: "price", label: "দাম (৳) — প্রিমিয়াম হলে", type: "number" },
        { name: "oldPrice", label: "আগের দাম (৳) — কেটে দেখাবে, ঐচ্ছিক", type: "number" },
        { name: "active", label: "ওয়েবসাইটে দেখাবে", type: "check", value: true },
        { name: "pinned", label: "উপরে রাখুন — নতুন বই এলেও এটা সবার আগে দেখাবে", type: "check" },
        { name: "validityText", label: "প্রিমিয়াম: কেনার পর কত দিন খোলা থাকবে", placeholder: "আজীবন, অথবা দিনের সংখ্যা — যেমন ৪৫" },
        { name: "buyers", label: "ক্রেতাদের মোবাইল নম্বর (প্রিমিয়াম) — প্রতি লাইনে একটা বা কমা দিয়ে", type: "textarea", wide: true, rows: 3, placeholder: "01XXXXXXXXX" },
        { type: "html", html: `<label>কভার ছবি (খাড়া, ৩:৪ — যেমন ৯০০ × ১২০০)<input type="file" id="ebCover" accept="image/jpeg,image/png,image/webp"></label>
          ${e && e.image ? `<p style="margin:4px 0 0"><img src="/api/ebook/${e.id}/image?v=${e.image.v}" alt="" style="height:90px;border-radius:8px"> এখন আছে — নতুন দিলে বদলাবে</p>` : ""}` },
        { type: "html", html: `<label>PDF ফাইল (৮০ MB পর্যন্ত)<input type="file" id="ebPdf" accept="application/pdf,.pdf"></label>
          ${e && e.pdf ? `<p style="margin:4px 0 0">এখন আছে: <a href="/api/admin/ebooks/${e.id}/pdf" target="_blank" rel="noopener">${esc(e.pdf.name)}</a> · নতুন দিলে বদলাবে</p>` : '<p style="margin:4px 0 0;color:var(--muted)">PDF না দিলে কার্ডে "শীঘ্রই আসছে" দেখাবে</p>'}` },
      ],
      values: e ? { ...e, ...validityVals(e.validityDays), buyers: (e.buyers || []).join("\n") } : { kind: "free", active: true, ...validityVals(0) },
      onSave: async (d) => {
        const cover = $("#ebCover").files[0], pdf = $("#ebPdf").files[0];
        if (cover && cover.size > 8 * 1024 * 1024) throw new Error("কভার ছবি ৮ MB-এর মধ্যে দিন");
        if (pdf && !/\.pdf$/i.test(pdf.name)) throw new Error("শুধু PDF ফাইল দিন");
        if (pdf && pdf.size > 80 * 1024 * 1024) throw new Error("PDF ৮০ MB-এর মধ্যে দিন");
        d.validityDays = d.kind === "premium" ? validityFrom(d) : 0; delete d.validityText;
        if (d.kind !== "premium") { d.price = 0; d.oldPrice = 0; d.buyers = ""; }
        const r = await save("ebooks", d, e && e.id), id = (e && e.id) || r.item.id;
        const up = async (url, file, type) => { const x = await fetch(url, { method: "POST", headers: { "Content-Type": type }, body: file }); if (!x.ok) throw new Error((await x.json().catch(() => ({}))).error || "ফাইল জমা হয়নি"); };
        try {
          if (cover) await up(`/api/admin/ebooks/${encodeURIComponent(id)}/image?ext=${(cover.name.match(/\.[a-z]+$/i) || [".jpg"])[0].toLowerCase().replace(".jpeg", ".jpg")}`, cover, cover.type);
          if (pdf) await up(`/api/admin/ebooks/${encodeURIComponent(id)}/pdf?name=${encodeURIComponent(pdf.name)}`, pdf, "application/pdf");
        } catch (er) { await load(); route(); throw new Error("ই-বুক সেভ হয়েছে, কিন্তু ফাইল জমা হয়নি: " + er.message); }
        await load(); route(); toast("সেভ হয়েছে");
      },
    });
    attachValidityList();
    const kind = $('#modalBody [name="kind"]');
    const updatePremiumFields = () => {
      const premium = kind.value === "premium";
      for (const name of ["price", "oldPrice", "validityText", "buyers"]) {
        const input = $(`#modalBody [name="${name}"]`);
        input.closest("label").style.display = premium ? "" : "none";
        input.disabled = !premium;
      }
    };
    kind.addEventListener("change", updatePremiumFields);
    updatePremiumFields();
  }
  function ebooks(c) {
    const list = (DB.ebooks || []).slice().sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || String(b.createdAt).localeCompare(String(a.createdAt)));
    c.innerHTML = `<div class="card"><div class="card-head"><h2>ই-বুক</h2><button class="btn gold" id="addEb">+ নতুন ই-বুক</button></div>
      <p style="margin-top:0;color:var(--muted)">মূল পাতার "ই-বুক" অংশে দেখায়। <b>ফ্রি</b> ই-বুক যে কেউ অতিথি বা শিক্ষার্থী লগইন করে নামাতে পারে। <b>প্রিমিয়াম</b> ই-বুকে "কিনুন" চাপলে আপনার WhatsApp-এ অর্ডারের বার্তা আসে — টাকা পেলে বইটির "ক্রেতা" ঘরে তার মোবাইল নম্বর যোগ করুন, তখন সে নিজের লগইনে নামাতে পারবে।</p>
      <div class="tbl-wrap"><table><thead><tr><th>কভার</th><th>ই-বুক</th><th>ধরন ও দাম</th><th>অবস্থা</th><th></th></tr></thead><tbody>
      ${list.map((e) => `<tr><td>${e.image ? `<img src="/api/ebook/${e.id}/image?v=${e.image.v}" alt="" style="width:46px;height:62px;object-fit:cover;border-radius:6px">` : "—"}</td>
        <td><b>${esc(e.title)}</b><small>${esc([e.category, e.pdf ? "PDF আছে" : "PDF নেই"].filter(Boolean).join(" · "))}</small></td>
        <td>${e.pinned ? '<span class="chip gold">📌 উপরে</span> ' : ""}${e.kind === "premium" ? `<span class="chip gold">প্রিমিয়াম</span> ${U.money(e.price)}${e.oldPrice ? ` <s>${U.money(e.oldPrice)}</s>` : ""}<small>ক্রেতা ${bn((e.buyers || []).length)} জন</small>` : e.kind === "students" ? '<span class="chip warn">ভর্তি শিক্ষার্থী</span>' : '<span class="chip ok">ফ্রি</span>'}</td>
        <td>${e.active !== false ? '<span class="chip ok">দেখাচ্ছে</span>' : '<span class="chip">বন্ধ</span>'}</td>
        <td class="num"><button class="icon-btn" data-ee="${e.id}">✎</button><button class="icon-btn" data-de="${e.id}">✕</button></td></tr>`).join("") || '<tr><td colspan="5" class="empty">এখনো কোনো ই-বুক নেই — "+ নতুন ই-বুক" চাপুন</td></tr>'}</tbody></table></div></div>`;
    $("#addEb").onclick = () => ebookForm();
    c.onclick = (ev) => { const t = ev.target.closest("[data-ee],[data-de]"); if (!t) return; if (t.dataset.ee) ebookForm(DB.ebooks.find((x) => x.id === t.dataset.ee)); if (t.dataset.de) remove("ebooks", t.dataset.de, "এই ই-বুক, তার কভার আর PDF"); };
  }

  // ---------- প্রশ্ন ও উত্তর (মূল পাতার FAQ — ক্রম ছোট থেকে বড়) ----------
  function faqForm(f) {
    openForm({
      title: f ? "প্রশ্ন ও উত্তর বদলান" : "নতুন প্রশ্ন ও উত্তর",
      fields: [
        { name: "q", label: "প্রশ্ন", required: true, wide: true },
        { name: "a", label: "উত্তর", type: "textarea", required: true, wide: true },
        { name: "order", label: "ক্রম (ছোট সংখ্যা আগে দেখায়)", type: "number", value: (DB.faqs || []).length + 1 },
        { name: "active", label: "ওয়েবসাইটে দেখাবে", type: "check", value: true },
      ],
      values: f || { active: true },
      onSave: async (d) => { await save("faqs", d, f && f.id); await load(); route(); toast("সেভ হয়েছে"); },
    });
  }
  function faqs(c) {
    const list = (DB.faqs || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.createdAt).localeCompare(String(b.createdAt)));
    c.innerHTML = `<div class="card"><div class="card-head"><h2>প্রশ্ন ও উত্তর</h2><button class="btn gold" id="addF">+ নতুন প্রশ্ন</button></div>
      <p style="margin-top:0;color:var(--muted)">মূল পাতার "প্রশ্ন ও উত্তর" অংশে দেখায় — প্রশ্নে চাপ দিলে উত্তর খোলে। অভিভাবক আর শিক্ষার্থীরা বারবার যা জিজ্ঞেস করে, সেগুলো এখানে লিখে রাখুন।</p>
      <div class="tbl-wrap"><table><thead><tr><th>ক্রম</th><th>প্রশ্ন ও উত্তর</th><th>অবস্থা</th><th></th></tr></thead><tbody>
      ${list.map((f) => `<tr><td>${U.bn(f.order || 0)}</td><td><b>${esc(f.q)}</b><small>${esc(f.a)}</small></td>
        <td>${f.active !== false ? '<span class="chip ok">দেখাচ্ছে</span>' : '<span class="chip">বন্ধ</span>'}</td>
        <td class="num"><button class="icon-btn" data-ef="${f.id}">✎</button><button class="icon-btn" data-df="${f.id}">✕</button></td></tr>`).join("") || '<tr><td colspan="4" class="empty">এখনো কোনো প্রশ্ন নেই — "+ নতুন প্রশ্ন" চাপুন</td></tr>'}</tbody></table></div></div>`;
    $("#addF").onclick = () => faqForm();
    c.onclick = (e) => { const t = e.target.closest("[data-ef],[data-df]"); if (!t) return; if (t.dataset.ef) faqForm(DB.faqs.find((f) => f.id === t.dataset.ef)); if (t.dataset.df) remove("faqs", t.dataset.df, "এই প্রশ্ন"); };
  }

  // ---------- শিক্ষক ----------
  // ছবি-কাটার ফ্রেম: ছবি টেনে / জুম করে ফ্রেমে বসানো; সেভে সঠিক মাপের ধারালো JPG তৈরি — যেকোনো মাপের ছবিও ওয়েবসাইটে পরিষ্কার দেখায়
  //   শিক্ষক: ৪:৫ ফ্রেম → ৪০০×৫০০ (মুখের দিকে আগে থেকে জুম)   মডিউল কভার: বর্গাকার → ৮০০×৮০০ (জুম কমিয়ে পুরো ছবিও রাখা যায়, ফাঁকা অংশ সাদা)
  function photoCropper(box, o = {}) {
    const { fw: FW = 240, fh: FH = 300, ow: OW = 400, oh: OH = 500, pw = 150, ph = 188, fit = false, face = true,
      hint = "ছবি টেনে মুখ ফ্রেমের মাঝে আনুন, জুম দিয়ে ছোট-বড় করুন" } = o;
    box.innerHTML = `<div class="pc-frame" style="width:${FW}px;height:${FH}px"><img alt=""></div>
      <div class="pc-ctl"><label>জুম<input type="range" min="1" max="4" step="0.01" value="1"></label>
        <small>${hint}</small>
        <div class="pc-prev"><canvas width="${pw}" height="${ph}" style="width:${pw}px;height:${ph}px"></canvas><span>ওয়েবসাইটে এভাবে দেখাবে</span></div></div>`;
    const frame = box.querySelector(".pc-frame"), im = frame.querySelector("img"), zoom = box.querySelector("input"), mini = box.querySelector("canvas");
    let img = null, base = 1, s = 1, x = 0, y = 0;
    // ছবি ফ্রেমের চেয়ে বড় হলে কিনারা পেরোতে দেয় না, ছোট হলে মাঝখানে রাখে
    const clamp = () => {
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      x = w <= FW ? (FW - w) / 2 : Math.min(0, Math.max(FW - w, x));
      y = h <= FH ? (FH - h) / 2 : Math.min(0, Math.max(FH - h, y));
    };
    // ফ্রেমের চেহারা যেকোনো ক্যানভাসে আঁকা (k = ক্যানভাস / ফ্রেমের অনুপাত)
    const paint = (cv, src, k) => {
      const g = cv.getContext("2d"); g.imageSmoothingQuality = "high";
      g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
      g.drawImage(src, x * k, y * k, img.naturalWidth * s * k, img.naturalHeight * s * k);
      return g;
    };
    const draw = () => {
      clamp();
      Object.assign(im.style, { width: img.naturalWidth * s + "px", height: img.naturalHeight * s + "px", left: x + "px", top: y + "px" });
      paint(mini, img, pw / FW);
    };
    const setZoom = (z) => { const cx = (FW / 2 - x) / s, cy = (FH / 2 - y) / s; s = base * z; x = FW / 2 - cx * s; y = FH / 2 - cy * s; draw(); };
    const zoomTo = (v) => { zoom.value = Math.min(+zoom.max, Math.max(+zoom.min, v)); setZoom(+zoom.value); };
    zoom.oninput = () => setZoom(+zoom.value);
    frame.onwheel = (e) => { e.preventDefault(); zoomTo(+zoom.value - Math.sign(e.deltaY) * 0.1); };
    frame.onpointerdown = (e) => {
      if (!img) return; frame.setPointerCapture(e.pointerId);
      const sx = e.clientX - x, sy = e.clientY - y;
      frame.onpointermove = (m) => { x = m.clientX - sx; y = m.clientY - sy; draw(); };
      frame.onpointerup = frame.onpointercancel = () => { frame.onpointermove = null; };
    };
    return {
      async load(file) {
        img = new Image(); img.src = URL.createObjectURL(file); await img.decode();
        im.src = img.src; box.hidden = false;
        const nw = img.naturalWidth, nh = img.naturalHeight;
        base = Math.max(FW / nw, FH / nh); // ১ = ফ্রেম পুরো ভরা
        zoom.min = fit ? Math.min(1, Math.min(FW / nw, FH / nh) / base).toFixed(3) : 1; // fit: জুম কমিয়ে পুরো ছবি
        // মুখের ছবি: বর্গাকার / চওড়া (পুরো শরীর) হলে শুরুতেই একটু জুম, উপরের অংশ ফ্রেমে; কভার: পুরো ফ্রেম ভরা, মাঝখান
        const z0 = face ? (nw / nh >= 0.9 ? 1.5 : 1.15) : 1;
        zoom.value = z0; s = base * z0; x = (FW - nw * s) / 2; y = face ? -nh * s * 0.06 : (FH - nh * s) / 2; draw();
      },
      // বড় ছবি ধাপে ধাপে অর্ধেক করে (ভালো মান), তারপর OW×OH-এ আঁকা ও হালকা ধারালো করা
      async blob() {
        const k = OW / FW, need = img.naturalWidth * s * k;
        let src = img, w = img.naturalWidth, h = img.naturalHeight;
        while (w / 2 >= need) {
          const n = document.createElement("canvas"); n.width = Math.round(w / 2); n.height = Math.round(h / 2);
          const g = n.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(src, 0, 0, n.width, n.height);
          src = n; w = n.width; h = n.height;
        }
        const out = document.createElement("canvas"); out.width = OW; out.height = OH;
        const g = paint(out, src, k);
        const d = g.getImageData(0, 0, OW, OH), p = d.data, q = new Uint8ClampedArray(p), amt = 0.6; // হালকা আনশার্প
        for (let yy = 1; yy < OH - 1; yy++) for (let xx = 1; xx < OW - 1; xx++) {
          const i = (yy * OW + xx) * 4;
          for (let ch = 0; ch < 3; ch++) { const v = q[i + ch], avg = (q[i - 4 + ch] + q[i + 4 + ch] + q[i - OW * 4 + ch] + q[i + OW * 4 + ch]) / 4; p[i + ch] = v + amt * (v - avg); }
        }
        g.putImageData(d, 0, 0);
        return new Promise((r) => out.toBlob(r, "image/jpeg", 0.92));
      },
      get ready() { return !!img; },
    };
  }
  function teacherForm(t) {
    let crop;
    setTimeout(() => {
      crop = photoCropper($("#tCrop"));
      $("#tImg").onchange = async (e) => {
        const f = e.target.files[0]; if (!f) return;
        if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { e.target.value = ""; return toast("ছবি দিন — JPG, PNG বা WEBP", true); }
        try { await crop.load(f); $("#tPrev").hidden = true; } catch { toast("ছবিটি খোলা যায়নি", true); }
      };
    });
    openForm({
      title: t ? "শিক্ষকের তথ্য বদলান" : "নতুন শিক্ষক",
      fields: [
        { name: "name", label: "নাম", required: true },
        { name: "subject", label: "বিষয় / পদবি" },
        { name: "bio", label: "ছোট পরিচিতি", type: "textarea", wide: true },
        { type: "html", html: `<div class="t-photo-row">${t && t.photo ? `<img id="tPrev" src="${esc(t.photo)}" alt="">` : '<img id="tPrev" alt="" hidden>'}
          <label>ছবি দিন (JPG, PNG বা WEBP — যেকোনো মাপ; বাছার পর ফ্রেমে বসিয়ে নিন)<input type="file" id="tImg" accept="image/jpeg,image/png,image/webp"></label></div>
          <div class="pc" id="tCrop" hidden></div>` },
        { name: "photo", label: "অথবা ছবির ঠিকানা (ছবি দিলে নিজে থেকে বসে যাবে)", wide: true, placeholder: "/images/teacher.jpg" },
      ],
      values: t || {},
      onSave: async (d) => {
        const img = crop && crop.ready ? await crop.blob() : null;
        const r = await save("teachers", d, t && t.id), id = (t && t.id) || r.item.id;
        if (img) {
          const x = await fetch(`/api/admin/teachers/${encodeURIComponent(id)}/image?ext=.jpg`, { method: "POST", body: img });
          const j = await x.json().catch(() => ({}));
          if (!x.ok) { await load(); route(); throw new Error("শিক্ষকের তথ্য সেভ হয়েছে, কিন্তু ছবি যায়নি: " + (j.error || "আবার চেষ্টা করুন")); }
        }
        await load(); route(); toast("সেভ হয়েছে");
      },
    });
  }
  function teachers(c) {
    c.innerHTML = `<div class="card"><div class="card-head"><h2>আমাদের শিক্ষা পরিবার (ওয়েবসাইটে দেখায়)</h2><button class="btn gold" id="addT">+ নতুন শিক্ষক</button></div>
      <div class="tbl-wrap"><table><thead><tr><th>নাম</th><th>বিষয়</th><th>পরিচিতি</th><th></th></tr></thead><tbody>
      ${DB.teachers.map((t) => `<tr><td><b>${esc(t.name)}</b></td><td>${esc(t.subject)}</td><td>${esc(t.bio)}</td><td class="num"><button class="icon-btn" data-et="${t.id}">✎</button><button class="icon-btn" data-dt="${t.id}">✕</button></td></tr>`).join("") || `<tr><td colspan="4" class="empty">কোনো শিক্ষক যোগ করা হয়নি</td></tr>`}
      </tbody></table></div></div>`;
    $("#addT").onclick = () => teacherForm();
    c.onclick = (e) => { const t = e.target.closest("[data-et],[data-dt]"); if (!t) return; if (t.dataset.et) teacherForm(DB.teachers.find((x) => x.id === t.dataset.et)); if (t.dataset.dt) remove("teachers", t.dataset.dt, "এই শিক্ষকের তথ্য"); };
  }

  // ---------- সেটিংস ----------
  function settings(c) {
    const S = DB.settings;
    const sf = [
      ["name", "প্রতিষ্ঠানের নাম"], ["location", "এলাকা (হিরোর উপরে ছোট লেখা)"], ["tagline", "বড় শিরোনাম"], ["taglineAccent", "শিরোনামের সোনালি অংশ"],
      ["intro", "পরিচিতি", true], ["phone", "ফোন ১"], ["phone2", "ফোন ২"], ["whatsapp", "WhatsApp (দেশের কোডসহ, যেমন 88017...)"], ["email", "ইমেইল"],
      ["address", "ঠিকানা", true], ["hours", "খোলা থাকার সময়"], ["facebook", "Facebook পেজের লিংক"], ["mapUrl", "Google Map লিংক"], ["motto", "মটো (ইংরেজিতে)"],
      ["aplus", "সফল শিক্ষার্থীর সংখ্যা (324)"], ["experience", "শেখানোর অভিজ্ঞতা, বছর (যেমন ১০+)"], ["mentorName", "মেন্টরের নাম — হিরোর ছবির নিচে (যেমন Md Shahin Miah)"], ["mentorRole", "মেন্টরের পদবি — নামের নিচে (Enter চাপলে নতুন লাইন)", true], ["studentsTotal", "মোট শিক্ষার্থীর সংখ্যা (যেমন ৬০০০+)"],
    ];
    c.innerHTML = `
      <div class="card"><div class="card-head"><h2>প্রতিষ্ঠানের তথ্য (ওয়েবসাইটে দেখায়)</h2></div>
        <form id="sForm" class="fgrid">${sf.map(([k, l, w]) => `<label${w ? ' class="wide"' : ""}>${esc(l)}${w ? `<textarea name="${k}" rows="2">${esc(S[k])}</textarea>` : `<input name="${k}" value="${esc(S[k])}">`}</label>`).join("")}
        <div class="wide"><button class="btn gold">তথ্য সেভ করুন</button></div></form></div>
      <div class="card"><div class="card-head"><h2>অনলাইন পেমেন্ট</h2><button type="button" class="btn gold" id="paySet2">পেমেন্ট সেটিংস</button></div>
        <p style="margin:0;color:var(--muted)">অনলাইন কোর্সে ভর্তির পর শিক্ষার্থী যেভাবে টাকা দেবে: বিকাশ / নগদ / রকেট নম্বর, ব্যাংক অ্যাকাউন্ট আর অনলাইন গেটওয়ে (SSLCommerz)।
          এখন চালু: <b>${[DB.settings.payBkash && "বিকাশ", DB.settings.payNagad && "নগদ", DB.settings.payRocket && "রকেট", DB.settings.payBank && "ব্যাংক"].filter(Boolean).join(", ") || "কিছুই দেওয়া হয়নি"}</b></p></div>
      <div class="card"><div class="card-head"><h2>SMS সার্ভিস (BulkSMSBD)</h2><button type="button" class="btn gold" id="smsSet">SMS সেটিংস</button></div>
        <p style="margin:0 0 10px;color:var(--muted)">অতিথি অ্যাকাউন্ট খোলার সময় আর PIN ভুলে গেলে মোবাইলে যাচাই কোড (OTP) যায়। BulkSMSBD-র প্যানেল থেকে API key আর Sender ID এনে এখানে বসান।
          এখন: <b id="smsState">দেখা হচ্ছে…</b></p>
        <div class="toolbar" style="margin:0"><button type="button" class="btn line" id="smsBal">ব্যালেন্স দেখুন</button><button type="button" class="btn line" id="smsTest">পরীক্ষার SMS পাঠান</button></div></div>
      <div class="card"><div class="card-head"><h2>মেন্টরের ছবি (ওয়েবসাইটের উপরের বড় গোল ছবি)</h2></div>
        <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
          <img id="mentorPrev" src="${esc(S.mentorPhoto ? `/api/mentor-photo?v=${S.mentorPhoto.v}` : "/images/teachers/shahin-hero.webp")}" alt="মেন্টরের ছবি" style="width:120px;height:120px;border-radius:50%;object-fit:cover;object-position:50% 18%;border:3px solid #818cf8">
          <div style="display:grid;gap:8px"><p style="margin:0;color:var(--muted)">বর্গাকার ছবি দিন, মুখ উপরের দিকে থাকলে গোলের মধ্যে ভালো বসে। JPG / PNG / WEBP, ৮ MB পর্যন্ত। নাম আর পদবি উপরের ঘরে বদলান।</p>
            <div class="toolbar" style="margin:0"><label class="btn gold">↑ নতুন ছবি দিন<input type="file" id="mentorFile" accept="image/jpeg,image/png,image/webp" hidden></label>
            ${S.mentorPhoto ? '<button type="button" class="btn line" id="mentorReset">↺ আগের ছবিতে ফেরান</button>' : ""}</div></div></div></div>
      <div class="grid2">
        ${!adminLock ? `<div class="card"><div class="card-head"><h2>লগইন বন্ধ আছে</h2></div>
          <p style="margin-top:0">এখন অ্যাডমিন প্যানেল খুলতে পাসওয়ার্ড লাগে না। ওয়েবসাইট শুধু এই কম্পিউটার থেকেই খোলা যায়, তাই এটা নিরাপদ।</p>
          <p style="color:var(--bad);font-weight:600">অনলাইনে নেওয়ার আগে অবশ্যই লগইন চালু করতে হবে।</p></div>` : `<div class="card"><div class="card-head"><h2>অ্যাডমিন লগইন</h2></div>
          <p style="margin-top:0;color:var(--muted)">লগইনে প্রথমে PIN, তারপর ইমেইল আর পাসওয়ার্ড লাগে। যেটা বদলাতে চান শুধু সেই ঘরটা পূরণ করুন, বাকিগুলো ফাঁকা রাখলে আগের মতো থাকবে।</p>
          <form id="pForm" class="fgrid" novalidate><label class="wide">লগইনের ইমেইল<input type="email" name="email" id="credEmail" autocomplete="username" placeholder="লোড হচ্ছে…"></label>
          <label>নতুন PIN (৬ সংখ্যা)<input type="password" name="pin" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="বদলাবেন না হলে ফাঁকা"></label>
          <label>নতুন পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)<input type="password" name="next" autocomplete="new-password" placeholder="বদলাবেন না হলে ফাঁকা"></label>
          <label class="wide">বর্তমান পাসওয়ার্ড <small style="font-weight:400;color:var(--muted)">(যেকোনো কিছু বদলাতে লাগবে)</small><input type="password" name="current" autocomplete="current-password" required></label>
          <div class="wide"><button class="btn gold">সেভ করুন</button></div></form></div>`}
        <div class="card"><div class="card-head"><h2>ব্যাকআপ</h2></div>
          <p style="margin-top:0;color:var(--muted)">প্রতিদিন নিজে থেকে <b>data/backups</b> ফোল্ডারে ব্যাকআপ হয় (শেষ ৩০ দিন)। মাঝে মাঝে নিচের বাটনে ব্যাকআপ নামিয়ে USB বা Google Drive-এ রাখুন। ছবিগুলো থাকে <b>data/photos</b> ফোল্ডারে — সেটাও কপি করে রাখুন।</p>
          <div class="toolbar"><a class="btn gold" href="/api/admin/backup">↓ ব্যাকআপ ডাউনলোড</a>
          <label class="btn line">↑ ব্যাকআপ থেকে ফেরান<input type="file" id="restore" accept=".json" hidden></label></div>
          <div class="toolbar"><a class="btn line" href="#students">শিক্ষার্থী Excel →</a><a class="btn line" href="#fees">পেমেন্ট Excel →</a></div>
        </div>
      </div>
      <div class="card" style="border-color:#f3c0c9"><div class="card-head"><h2>নমুনা তথ্য মুছুন</h2></div>
        <p style="margin-top:0;color:var(--muted)">আসল কাজ শুরু করার আগে সব নমুনা শিক্ষার্থী, মডিউলে ভর্তি, পেমেন্ট, হাজিরা, পরীক্ষা, আবেদন আর ভর্তির খোঁজ মুছে ফেলুন। মডিউল, সেশন, ব্যাচ, নোটিশ, শিক্ষক আর সেটিংস থাকবে। (মোছার আগে নিজে থেকে ব্যাকআপ হবে।)</p>
        <button class="btn red" id="clearSample">সব শিক্ষার্থী ও হিসাব মুছে নতুন করে শুরু করুন</button></div>`;
    $("#paySet2").onclick = () => paySettingsForm().catch((e) => toast(e.message, true));
    // SMS: অবস্থা দেখানো, সেটিংস, ব্যালেন্স, পরীক্ষার SMS
    const smsState = () => api("/api/admin/sms-config").then((g) => { const el = $("#smsState"); if (el) el.textContent = g.live ? `চালু · Sender ID: ${g.senderId}` : g.hasKey ? "বন্ধ (API key দেওয়া আছে)" : "বন্ধ — API key দেওয়া হয়নি"; return g; });
    smsState().catch(() => {});
    $("#smsSet").onclick = async () => {
      const g = await smsState().catch((e) => toast(e.message, true)); if (!g) return;
      openForm({
        title: "SMS সেটিংস — BulkSMSBD",
        fields: [
          { type: "html", html: '<p style="margin:0;color:var(--muted)">BulkSMSBD-তে লগইন করে <b>API</b> বা <b>Developer</b> পাতা থেকে API key কপি করুন। Sender ID হলো যে নামে বা নম্বর থেকে SMS যাবে (BulkSMSBD-তে অনুমোদিত হতে হবে)। BulkSMSBD-র প্যানেলে এই কম্পিউটারের / সার্ভারের IP whitelist করতে হতে পারে।</p>' },
          { name: "apiKey", label: "API key", type: "password", wide: true, placeholder: g.hasKey ? "দেওয়া আছে — বদলাতে নতুনটা লিখুন" : "BulkSMSBD-র API key" },
          { name: "senderId", label: "Sender ID", placeholder: "যেমন: 8809617XXXXXX বা অনুমোদিত নাম" },
          { name: "enabled", label: "OTP চালু — অতিথি অ্যাকাউন্টে মোবাইলে কোড যাবে", type: "check" },
        ],
        values: { senderId: g.senderId, enabled: g.enabled },
        onSave: async (d) => {
          if (d.enabled && (!d.senderId || (!d.apiKey && !g.hasKey))) throw new Error("চালু করতে API key আর Sender ID দুটোই দিন");
          await api("/api/admin/sms-config", { body: { apiKey: d.apiKey, senderId: d.senderId, enabled: d.enabled } });
          await smsState(); toast("SMS সেটিংস সেভ হয়েছে");
        },
      });
    };
    $("#smsBal").onclick = async () => { try { const r = await api("/api/admin/sms-balance"); toast(`BulkSMSBD ব্যালেন্স: ${r.balance}`); } catch (e) { toast(e.message, true); } };
    $("#smsTest").onclick = () => openForm({
      title: "পরীক্ষার SMS",
      fields: [{ name: "phone", label: "কোন নম্বরে পাঠাবেন", type: "tel", required: true, placeholder: "01XXXXXXXXX" }],
      values: {}, saveText: "পাঠান",
      onSave: async (d) => { await api("/api/admin/sms-test", { body: { phone: d.phone } }); toast("পরীক্ষার SMS পাঠানো হয়েছে — মোবাইল দেখুন"); },
    });
    $("#sForm").onsubmit = async (e) => {
      e.preventDefault();
      try { await api("/api/admin/settings", { body: Object.fromEntries(new FormData(e.target)) }); await load(); toast("সেভ হয়েছে"); } catch (err) { toast(err.message, true); }
    };
    $("#mentorFile").onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const ext = (f.name.match(/\.\w+$/) || [".jpg"])[0].toLowerCase();
      try {
        const r = await fetch(`/api/admin/mentor-photo?ext=${encodeURIComponent(ext)}`, { method: "POST", body: f });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "ছবি আপলোড হয়নি");
        await load(); toast("মেন্টরের ছবি বদলানো হয়েছে"); route();
      } catch (err) { toast(err.message, true); e.target.value = ""; }
    };
    if ($("#mentorReset")) $("#mentorReset").onclick = async () => {
      if (!confirm("আপলোড করা ছবি মুছে আগের ছবিতে ফেরাবেন?")) return;
      try { const r = await fetch("/api/admin/mentor-photo", { method: "DELETE" }); if (!r.ok) throw new Error("ফেরানো যায়নি"); await load(); toast("আগের ছবিতে ফেরানো হয়েছে"); route(); } catch (err) { toast(err.message, true); }
    };
    if ($("#pForm")) $("#pForm").onsubmit = async (e) => {
      e.preventDefault();
      const b = Object.fromEntries(new FormData(e.target));
      b.pin = String(b.pin || "").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d));
      if (b.pin && !/^\d{6}$/.test(b.pin)) return toast("নতুন PIN ঠিক ৬ সংখ্যার হতে হবে", true);
      try { await api("/api/admin/password", { body: b }); const em = b.email; e.target.reset(); $("#credEmail").value = em; toast("লগইনের তথ্য বদলানো হয়েছে"); } catch (err) { toast(err.message, true); }
    };
    if ($("#credEmail")) api("/api/admin/creds").then((r) => { $("#credEmail").value = r.email || ""; $("#credEmail").placeholder = ""; }).catch(() => {});
    $("#restore").onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (!confirm("এই ব্যাকআপ থেকে ফেরালে এখনকার সব তথ্য বদলে যাবে (আগের অবস্থার একটি কপি রাখা হবে)। চালিয়ে যাবেন?")) return (e.target.value = "");
      try { await api("/api/admin/restore", { body: JSON.parse(await f.text()) }); await load(); toast("ব্যাকআপ থেকে ফেরানো হয়েছে"); route(); }
      catch (err) { toast(err instanceof SyntaxError ? "ফাইলটি পড়া যায়নি" : err.message, true); }
      e.target.value = "";
    };
    $("#clearSample").onclick = async () => {
      if (prompt('নিশ্চিত হলে বড় হাতের অক্ষরে "DELETE" লিখুন') !== "DELETE") return;
      try { await api("/api/admin/clear-sample", { body: {} }); await load(); toast("নমুনা তথ্য মুছে ফেলা হয়েছে"); location.hash = "dashboard"; route(); } catch (err) { toast(err.message, true); }
    };
  }

  // ================= লগইন =================
  async function start() {
    $("#todayDate").textContent = new Date().toLocaleDateString("bn-BD", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    let st;
    try { st = await api("/api/admin/status"); }
    catch { document.body.innerHTML = '<p style="padding:40px;text-align:center">সার্ভার চালু নেই। "Start Website.bat" চালান।</p>'; return; }
    adminLock = !!st.lock;
    if (!adminLock) $("#logoutBtn").hidden = true; // লগইন বন্ধ থাকলে লগআউটও লাগে না
    if (st.loggedIn) {
      try { await load(); $("#app").hidden = false; route(); return; } catch {}
    }
    // লগইন: ধাপ ১ PIN → ধাপ ২ ইমেইল + পাসওয়ার্ড। প্রথমবার সব একসাথে সেটআপ।
    const isSetup = !st.setup, f = $("#loginForm");
    const en = (v) => String(v || "").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d)).replace(/\D/g, "");
    f.querySelectorAll(".pin-in").forEach((i) => (i.oninput = () => (i.value = en(i.value).slice(0, 6))));
    let ticket = "";
    const show = (names) => f.querySelectorAll("label[data-f]").forEach((l) => (l.hidden = !names.includes(l.dataset.f)));
    const stepTo = (n) => {
      ticket = n === 1 ? "" : ticket;
      show(n === 1 ? ["pin"] : ["email", "password"]);
      document.querySelectorAll("#loginSteps li").forEach((li, i) => { li.classList.toggle("on", i === n - 1); li.classList.toggle("done", i < n - 1); });
      $("#loginHint").textContent = n === 1 ? "Step 1 — Enter your 6-digit admin PIN" : "Step 2 — Enter your email and password";
      $("#loginBtn").textContent = n === 1 ? "Next →" : "Log in";
      $("#loginBack").hidden = n === 1;
      if (n === 1) f.pin.value = ""; else f.password.value = "";
      (n === 1 ? f.pin : f.email.value ? f.password : f.email).focus();
    };
    const fail = (msg) => {
      $("#loginErr").textContent = msg;
      const box = $("#loginBox"); box.classList.remove("shake"); void box.offsetWidth; box.classList.add("shake");
    };
    $("#loginScreen").hidden = false;
    if (isSetup) {
      $("#loginSteps").hidden = true;
      $("#loginHint").textContent = "First time — set up the admin login. Remember your PIN, email and password.";
      show(["pin", "pin2", "email", "password", "confirm"]);
      f.password.autocomplete = "new-password";
      $("#loginBtn").textContent = "Set up login";
      f.pin.focus();
    } else stepTo(1);
    $("#loginBack").onclick = () => { $("#loginErr").textContent = ""; stepTo(1); };
    f.onsubmit = async (e) => {
      e.preventDefault();
      $("#loginErr").textContent = "";
      const pin = en(f.pin.value), email = f.email.value.trim(), pw = f.password.value;
      try {
        if (isSetup) {
          if (!/^\d{6}$/.test(pin)) throw new Error("PIN must be exactly 6 digits");
          if (pin !== en(f.pin2.value)) throw new Error("The two PINs do not match");
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email");
          if (pw.length < 8) throw new Error("Password must be at least 8 characters");
          if (pw !== f.confirm.value) throw new Error("The two passwords do not match");
          await api("/api/admin/setup", { body: { pin, email, password: pw } });
        } else if (!ticket) {
          if (!/^\d{6}$/.test(pin)) throw new Error("Enter a 6-digit PIN");
          ticket = (await api("/api/admin/pin", { body: { pin } })).ticket;
          return stepTo(2);
        } else {
          if (!email || !pw) throw new Error("Please enter both email and password");
          try { await api("/api/admin/login", { body: { ticket, email, password: pw } }); }
          catch (err) { if (/re-enter PIN/i.test(err.message)) stepTo(1); throw err; }
        }
        await load();
        $("#loginScreen").hidden = true; $("#app").hidden = false; route();
      } catch (err) { fail(err.message); }
    };
  }
  $("#menuBtn").onclick = () => $("#side").classList.toggle("open");
  // সংখ্যার ঘরে মাউসের চাকা ঘুরিয়ে ভুল করে টাকা / নম্বর বদলে না যায়
  document.addEventListener("wheel", (e) => { if (e.target.matches?.("input[type=number]") && document.activeElement === e.target) e.target.blur(); }, { passive: true });
  $("#printPageBtn").onclick = () => printPage();
  $("#logoutBtn").onclick = async (e) => { e.preventDefault(); await api("/api/admin/logout", { body: {} }).catch(() => {}); location.reload(); };
  start();
})();
