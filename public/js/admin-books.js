// অ্যাডমিন → বই ও শিট — ছাপা বই / লেকচার শিটের স্টক, বিক্রি আর ওয়েবসাইটের অনলাইন অর্ডার।
// ট্যাব: বই ও শিট (তালিকা, স্টক যোগ) · নতুন বিক্রি (শিক্ষার্থী বা বাইরের ক্রেতা; ছাড়, ফ্রি, বাকি) · বিক্রির খাতা (বাকি জমা, রসিদ, বাতিল)
//        · অনলাইন অর্ডার (বিভাগ / জেলা / ঠিকানা; নিশ্চিত → পাঠানো → পৌঁছেছে) · স্টকের হিসাব
window.SICBooks = function (X) {
  "use strict";
  const { $, esc, bn, money, api, toast } = U;
  const DB = () => X.DB;
  const META = () => DB().bookMeta || { geo: {}, ship: {}, methods: ["নগদ (Cash)"], status: {} };
  const KIND = { book: "বই", sheet: "শিট" };
  const ST_CLS = { new: "warn", confirmed: "", shipped: "gold", delivered: "ok", cancelled: "bad" };
  const blankSale = () => ({ buyerType: "student", studentId: "", name: "", phone: "", items: [{ bookId: "", qty: 1, price: "" }], discount: 0, free: false, paid: "", method: META().methods[0], date: U.today(), note: "" });
  const S = { tab: "items", q: "", saleFilter: "all", saleQ: "", month: "", orderFilter: "open", sale: null, studentSession: "", studentBatch: "" };
  let C = null, coverFile = null;

  const books = () => [...(DB().books || [])].sort((a, b) => Number(b.active !== false) - Number(a.active !== false) || (a.order || 0) - (b.order || 0) || String(a.title).localeCompare(String(b.title)));
  const bookById = (id) => (DB().books || []).find((b) => b.id === id);
  const paidOf = (s) => (s.payments || []).reduce((a, p) => a + Number(p.amount || 0), 0);
  const dueOf = (s) => Math.max(0, Number(s.total || 0) - paidOf(s));
  const sales = () => [...(DB().bookSales || [])].sort((a, b) => String(b.date + b.createdAt).localeCompare(String(a.date + a.createdAt)));
  const orders = () => [...(DB().bookOrders || [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const soldQty = (id) => (DB().bookSales || []).reduce((n, s) => n + s.lines.filter((l) => l.bookId === id).reduce((a, l) => a + l.qty, 0), 0);
  const low = (b) => b.active !== false && Number(b.stock || 0) <= Number(b.lowStock || 0);
  const cover = (b) => (b && b.image ? `/api/bookimg/${b.id}/image?v=${b.image.v}` : "");
  const when = (iso) => (iso ? new Date(iso).toLocaleString("bn-BD", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");
  const linesText = (ls) => ls.map((l) => `${l.title} × ${bn(l.qty)}`).join(", ");
  const buyer = (s) => `<b>${esc(s.name)}</b><small>${s.buyerType === "student" ? `শিক্ষার্থী · ${esc(s.studentId)}` : "বাইরের ক্রেতা"}${s.phone ? " · " + esc(s.phone) : ""}</small>`;

  function render() {
    if (!C) return;
    const B = books(), SL = sales(), O = orders();
    const stockVal = B.reduce((a, b) => a + Number(b.stock || 0) * Number(b.price || 0), 0);
    const due = SL.reduce((a, s) => a + dueOf(s), 0), newO = O.filter((o) => o.status === "new").length;
    const tabs = [["items", "বই ও শিট", B.length], ["sell", "＋ নতুন বিক্রি"], ["sales", "বিক্রির খাতা", SL.length], ["orders", "অনলাইন অর্ডার", newO], ["stock", "স্টকের হিসাব"]];
    C.innerHTML = `<div class="ex-page bk-page">
      <section class="ln-banner"><div><span class="eyebrow">স্টক · বিক্রি · অনলাইন অর্ডার</span><h2>বই ও শিট</h2>
        <p>বই আর লেকচার শিট স্টকে তুলুন, শিক্ষার্থী বা বাইরের যে কাউকে বিক্রি করুন (ছাড়, ফ্রি, বাকি), আর ওয়েবসাইট থেকে আসা অর্ডার সামলান।</p>
        <div class="ln-nums"><span><b>${bn(B.filter((b) => b.active !== false).length)}</b>বই ও শিট</span><span><b>${bn(B.reduce((a, b) => a + Number(b.stock || 0), 0))}</b>কপি স্টকে</span><span><b>${money(stockVal)}</b>স্টকের দাম</span><span><b>${money(due)}</b>মোট বাকি</span><span><b>${bn(newO)}</b>নতুন অর্ডার</span></div></div>
        <span class="rs-btns"><a class="btn line" href="/books" target="_blank">→ ওয়েবসাইটে দেখুন</a></span></section>
      <div class="sms-tabs bk-tabs">${tabs.map(([k, t, n]) => `<button type="button" data-tab="${k}" class="${S.tab === k ? "on" : ""}">${t}${n ? ` <i>${bn(n)}</i>` : ""}</button>`).join("")}</div>
      <div id="bkBody">${({ items: itemsHtml, sell: sellHtml, sales: salesHtml, orders: ordersHtml, stock: stockHtml }[S.tab] || itemsHtml)()}</div></div>`;
    if (S.tab === "sell") sumSale();
  }

  // ---------- বই ও শিট ----------
  function itemsHtml() {
    const q = S.q.trim().toLowerCase(), L = books().filter((b) => !q || `${b.title} ${b.author}`.toLowerCase().includes(q));
    return `<section class="card"><div class="bk-head"><h3>বই ও শিটের তালিকা</h3><input type="search" data-q value="${esc(S.q)}" placeholder="নাম দিয়ে খুঁজুন"><button type="button" class="btn gold" data-new>＋ নতুন বই / শিট</button></div>
      ${L.length ? `<div class="tbl-wrap"><table class="exam-entry-table bk-tbl"><thead><tr><th>বই / শিট</th><th class="num">দাম</th><th class="num">স্টকে</th><th class="num">বিক্রি</th><th>ওয়েবসাইটে</th><th></th></tr></thead><tbody>
      ${L.map((b) => `<tr class="${b.active === false ? "bk-off" : ""}"><td><div class="bk-item">${cover(b) ? `<img src="${cover(b)}" alt="">` : `<span class="bk-ph">${b.kind === "sheet" ? "📄" : "📘"}</span>`}<span><b>${esc(b.title)}</b><small>${KIND[b.kind] || "বই"}${b.author ? " · " + esc(b.author) : ""}${b.active === false ? " · বন্ধ" : ""}</small></span></div></td>
        <td class="num">${money(b.price)}${b.oldPrice > b.price ? `<small><s>${money(b.oldPrice)}</s></small>` : ""}</td>
        <td class="num"><b class="${low(b) ? "bk-low" : ""}">${bn(b.stock || 0)}</b>${low(b) ? '<small class="bk-low">কম আছে</small>' : ""}</td><td class="num">${bn(soldQty(b.id))}</td>
        <td>${b.online && b.active !== false ? '<span class="chip ok">অর্ডার চালু</span>' : '<span class="chip">বন্ধ</span>'}</td>
        <td class="num bk-acts"><button type="button" class="btn sm gold" data-stock="${b.id}">＋ স্টক</button><button type="button" class="btn sm line" data-sell="${b.id}">বিক্রি</button><button type="button" class="btn sm line" data-edit="${b.id}">✎</button><button type="button" class="btn sm line danger" data-del="${b.id}">🗑</button></td></tr>`).join("")}</tbody></table></div>`
      : `<p class="empty">${q ? "এই নামে কিছু পাওয়া যায়নি।" : "এখনো কোনো বই বা শিট যোগ করা হয়নি — \"＋ নতুন বই / শিট\" চাপুন।"}</p>`}</section>`;
  }
  function bookForm(b) {
    coverFile = null;
    X.openForm({
      title: b ? "বই / শিট বদলান" : "নতুন বই / শিট",
      fields: [
        { name: "kind", label: "ধরন", type: "select", options: [["book", "বই"], ["sheet", "লেকচার শিট"]] },
        { name: "title", label: "নাম", required: true, placeholder: "যেমন: HSC ICT সম্পূর্ণ গাইড" },
        { name: "author", label: "লেখক / বিষয়", placeholder: "যেমন: Shahin Sir · অধ্যায় ১–৬" },
        { name: "price", label: "বিক্রির দাম (৳)", type: "number", min: 0, required: true },
        { name: "oldPrice", label: "আগের দাম (৳) — কাটা দাম দেখাতে", type: "number", min: 0 },
        { name: "cost", label: "খরচ / কেনা দাম (৳) — শুধু আপনার হিসাবে", type: "number", min: 0 },
        { name: "lowStock", label: "কতটায় নামলে \"কম আছে\" দেখাবে", type: "number", min: 0 },
        ...(b ? [] : [{ name: "opening", label: "এখন স্টকে কতটি আছে", type: "number", min: 0 }]),
        { name: "short", label: "ছোট বিবরণ (ওয়েবসাইটে দেখায়)", type: "textarea", wide: true },
        { type: "html", html: `<label class="wide">কভার ছবি <b>(খাড়া, ৩:৪ — সবচেয়ে ভালো ৯০০ × ১২০০ পিক্সেল)</b> <small style="color:var(--muted);font-weight:400">JPG / PNG, ৮ MB পর্যন্ত${b && b.image ? " — না দিলে আগেরটাই থাকবে" : ""}</small><small style="display:block;color:var(--muted);font-weight:400;margin:2px 0 4px">ওয়েবসাইটে সব বইয়ের ছবি ৩:৪ ফ্রেমে বসে — অন্য মাপ দিলে কিনারা কেটে যায়, তাই নাম ও গুরুত্বপূর্ণ লেখা ছবির মাঝখানে রাখুন।</small><input type="file" accept="image/jpeg,image/png,image/webp" id="bkCover"></label>` },
        { name: "online", label: "ওয়েবসাইটে অনলাইন অর্ডার চালু", type: "check" },
        { name: "active", label: "চালু (বন্ধ করলে বিক্রি / অর্ডারে আসে না, হিসাব থাকে)", type: "check" },
      ],
      values: b ? { ...b } : { kind: "book", price: 0, lowStock: 5, opening: 0, online: true, active: true },
      onSave: async (d) => {
        const opening = Math.max(0, Math.floor(d.opening || 0)); delete d.opening;
        const r = await X.save("books", d, b && b.id), id = r.item.id;
        if (opening) await api("/api/admin/books/stock", { body: { bookId: id, qty: opening, note: "শুরুর স্টক" } });
        if (coverFile) {
          const ext = "." + (coverFile.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
          const res = await fetch(`/api/admin/books/${encodeURIComponent(id)}/image?ext=${encodeURIComponent(ext)}`, { method: "POST", body: coverFile });
          if (!res.ok) toast((await res.json().catch(() => ({}))).error || "ছবি আপলোড হয়নি", true);
        }
        await X.load(); render(); toast("সেভ হয়েছে");
      },
    });
    const f = $("#bkCover"); if (f) f.onchange = () => { coverFile = f.files[0] || null; };
  }
  function stockForm(b) {
    X.openForm({
      title: `স্টক — ${b.title}`,
      fields: [
        { type: "html", html: `<p class="bk-note wide">এখন স্টকে আছে <b>${bn(b.stock || 0)}টি</b>। নতুন ছাপা / কেনা এলে যোগ করুন; হারানো বা নষ্ট হলে মাইনাস দিন (যেমন -২)।</p>` },
        { name: "qty", label: "কতটি (+ যোগ / − বিয়োগ)", type: "number", required: true },
        { name: "cost", label: "মোট খরচ (৳) — ঐচ্ছিক", type: "number", min: 0 },
        { name: "date", label: "তারিখ", type: "date" },
        { name: "note", label: "নোট", placeholder: "যেমন: প্রেস থেকে ২০০ কপি" },
      ],
      values: { date: U.today() },
      onSave: async (d) => { await api("/api/admin/books/stock", { body: { bookId: b.id, ...d } }); await X.load(); render(); toast("স্টক আপডেট হয়েছে"); },
    });
  }

  // ---------- নতুন বিক্রি ----------
  function saleStudents() {
    return DB().students.filter((x) => x.status !== "inactive"
      && (!S.studentSession || x.session === S.studentSession)
      && (!S.studentBatch || x.batchId === S.studentBatch));
  }
  function sellHtml() {
    const s = S.sale || (S.sale = blankSale()), avail = books().filter((b) => b.active !== false);
    const st = s.buyerType === "student" && s.studentId ? DB().students.find((x) => x.id === s.studentId.trim()) : null;
    return `<section class="card bk-sell"><h3>নতুন বিক্রি</h3>
      <div class="sms-tabs">${[["student", "শিক্ষার্থী"], ["outside", "বাইরের ক্রেতা"]].map(([k, t]) => `<button type="button" data-buyer="${k}" class="${s.buyerType === k ? "on" : ""}">${t}</button>`).join("")}</div>
      ${s.buyerType === "student" ? `<div class="bk-row"><label class="sms-f">শিক্ষার্থীর আইডি<input data-s="studentId" value="${esc(s.studentId)}" placeholder="যেমন: 270001" list="bkStuList"></label>
          <div class="bk-who" id="bkWho">${st ? `<b>${esc(st.name)}</b><small>${esc(X.batchName(st.batchId))} · ${esc(st.phone || st.guardianPhone || "")}</small>` : s.studentId ? '<span class="bk-low">এই আইডিতে কেউ নেই</span>' : '<small>আইডি লিখলে নাম দেখাবে</small>'}</div></div>
          <div class="bk-row">
          <label class="sms-f">সেশন<select data-student-session>${X.opt([["", "সব সেশন"], ...DB().sessions.map((x) => [x.name, x.name])], S.studentSession)}</select></label>
          <label class="sms-f">ব্যাচ<select data-student-batch>${X.opt([["", "সব ব্যাচ"], ...DB().batches.filter((x) => !S.studentSession || x.session === S.studentSession).map((x) => [x.id, x.name + ([x.days, x.time].filter(Boolean).length ? " (" + [x.days, x.time].filter(Boolean).join(" · ") + ")" : "")])], S.studentBatch)}</select></label>
          <label class="sms-f">শিক্ষার্থী বেছে নিন<select data-student-pick>${X.opt([["", saleStudents().length ? "— শিক্ষার্থী বেছে নিন —" : "এই সেশন / ব্যাচে শিক্ষার্থী নেই"], ...saleStudents().map((x) => [x.id, x.id + " · " + x.name])], s.studentId)}</select></label>
        </div>
          <datalist id="bkStuList">${saleStudents().map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("")}</datalist>`
        : `<div class="bk-row"><label class="sms-f">ক্রেতার নাম<input data-s="name" value="${esc(s.name)}" placeholder="নাম"></label><label class="sms-f">মোবাইল<input data-s="phone" value="${esc(s.phone)}" placeholder="01XXXXXXXXX" inputmode="tel"></label></div>`}
      <div class="tbl-wrap"><table class="exam-entry-table bk-lines"><thead><tr><th>বই / শিট</th><th class="num">স্টকে</th><th class="num">পরিমাণ</th><th class="num">দাম (প্রতিটি)</th><th class="num">মোট</th><th></th></tr></thead><tbody>
        ${s.items.map((it, i) => { const b = bookById(it.bookId); return `<tr><td><select data-line="${i}" data-k="bookId"><option value="">— বেছে নিন —</option>${avail.map((x) => `<option value="${x.id}"${x.id === it.bookId ? " selected" : ""}${!x.stock ? " disabled" : ""}>${esc(x.title)} (${KIND[x.kind]})${!x.stock ? " — স্টক নেই" : ""}</option>`).join("")}</select></td>
          <td class="num">${b ? bn(b.stock || 0) : "—"}</td><td class="num"><input type="number" min="1" data-line="${i}" data-k="qty" value="${esc(it.qty)}" class="bk-num"></td>
          <td class="num"><input type="number" min="0" data-line="${i}" data-k="price" value="${esc(it.price === "" && b ? b.price : it.price)}" class="bk-num"></td><td class="num" id="bkLt${i}">—</td>
          <td class="num">${s.items.length > 1 ? `<button type="button" class="btn sm line danger" data-rmline="${i}">✕</button>` : ""}</td></tr>`; }).join("")}</tbody></table></div>
      <button type="button" class="btn line sm" data-addline>＋ আরেকটা বই / শিট</button>
      <div class="bk-pay">
        <label class="sms-check"><input type="checkbox" data-s="free"${s.free ? " checked" : ""}> 🎁 ফ্রি দিন (টাকা লাগবে না, স্টক কমবে)</label>
        <div class="bk-row">
          <label class="sms-f">ছাড় (৳)<input type="number" min="0" data-s="discount" value="${esc(s.discount)}"${s.free ? " disabled" : ""}></label>
          <label class="sms-f">এখন জমা (৳)<input type="number" min="0" data-s="paid" value="${esc(s.paid)}" placeholder="পুরোটা"${s.free ? " disabled" : ""}></label>
          <label class="sms-f">মাধ্যম<select data-s="method">${X.opt(META().methods.map((m) => [m, m]), s.method)}</select></label>
          <label class="sms-f">তারিখ<input type="date" data-s="date" value="${esc(s.date)}"></label>
        </div>
        <label class="sms-f">নোট<input data-s="note" value="${esc(s.note)}" placeholder="ঐচ্ছিক"></label>
        <div class="bk-sum" id="bkSum"></div>
        <div class="rs-act"><button type="button" class="btn gold" data-dosale>✓ বিক্রি সেভ করুন</button><button type="button" class="btn line" data-resetsale>নতুন করে</button></div>
      </div></section>`;
  }
  // বিক্রির হিসাব (টাইপ করার সাথে সাথে)
  function calc() {
    const s = S.sale, lines = s.items.map((it) => { const b = bookById(it.bookId); return { b, qty: Math.max(0, Math.floor(Number(it.qty) || 0)), price: it.price === "" ? (b ? b.price : 0) : Math.max(0, Number(it.price) || 0) }; });
    const subtotal = lines.reduce((a, l) => a + (l.b ? l.qty * l.price : 0), 0), discount = s.free ? subtotal : Math.min(subtotal, Math.max(0, Number(s.discount) || 0));
    const total = s.free ? 0 : subtotal - discount, paid = s.free ? 0 : s.paid === "" ? total : Math.min(total, Math.max(0, Number(s.paid) || 0));
    return { lines, subtotal, discount, total, paid, due: total - paid };
  }
  function sumSale() {
    const el = $("#bkSum", C); if (!el || !S.sale) return;
    const c = calc();
    c.lines.forEach((l, i) => { const td = $("#bkLt" + i, C); if (td) td.textContent = l.b ? money(l.qty * l.price) : "—"; });
    el.innerHTML = `<span>মোট <b>${money(c.subtotal)}</b></span>${c.discount ? `<span>ছাড় <b>− ${money(c.discount)}</b></span>` : ""}<span class="bk-total">দিতে হবে <b>${money(c.total)}</b></span><span>জমা <b>${money(c.paid)}</b></span><span class="${c.due ? "bk-low" : ""}">বাকি <b>${money(c.due)}</b></span>${S.sale.free ? '<span class="chip ok">🎁 ফ্রি</span>' : ""}`;
  }
  async function doSale() {
    const s = S.sale, c = calc();
    const items = s.items.filter((it) => it.bookId).map((it) => ({ bookId: it.bookId, qty: Math.floor(Number(it.qty) || 0), price: it.price === "" ? undefined : Number(it.price) || 0 }));
    if (!items.length) return toast("অন্তত একটা বই / শিট বেছে নিন", true);
    if (c.due && s.buyerType === "outside" && !s.phone && !confirm("বাকি রাখছেন কিন্তু ক্রেতার মোবাইল নেই। তবুও সেভ করবেন?")) return;
    try {
      const r = await api("/api/admin/books/sale", { body: { ...s, studentId: s.studentId.trim(), items, paid: c.paid } });
      S.sale = blankSale(); await X.load(); render();
      toast(`বিক্রি সেভ হয়েছে — রসিদ নং S${bn(r.item.saleNo)}`);
      if (confirm("রসিদ প্রিন্ট করবেন?")) receipt(r.item);
    } catch (e) { toast(e.message, true); }
  }

  // ---------- বিক্রির খাতা ----------
  function salesHtml() {
    const q = S.saleQ.trim().toLowerCase();
    const L = sales().filter((s) => (S.saleFilter === "due" ? dueOf(s) > 0 : S.saleFilter === "free" ? s.free : S.saleFilter === "student" ? s.buyerType === "student" : S.saleFilter === "outside" ? s.buyerType === "outside" : true)
      && (!S.month || String(s.date).startsWith(S.month)) && (!q || `${s.name} ${s.studentId} ${s.phone} S${s.saleNo} ${linesText(s.lines)}`.toLowerCase().includes(q)));
    const tot = L.reduce((a, s) => a + Number(s.total || 0), 0), got = L.reduce((a, s) => a + paidOf(s), 0), due = L.reduce((a, s) => a + dueOf(s), 0), copies = L.reduce((a, s) => a + s.lines.reduce((n, l) => n + l.qty, 0), 0);
    const chips = [["all", "সব"], ["due", "বাকি আছে"], ["free", "ফ্রি দেওয়া"], ["student", "শিক্ষার্থী"], ["outside", "বাইরের ক্রেতা"]];
    return `<section class="card"><div class="bk-head"><h3>বিক্রির খাতা</h3><input type="search" data-saleq value="${esc(S.saleQ)}" placeholder="নাম, আইডি, মোবাইল, রসিদ নং"><input type="month" data-month value="${esc(S.month)}" title="মাস (খালি = সব)"></div>
      <div class="gl-chips">${chips.map(([k, t]) => `<button type="button" data-sf="${k}" class="${S.saleFilter === k ? "on" : ""}">${t}</button>`).join("")}</div>
      <div class="bk-sum bk-sum-top"><span>বিক্রি <b>${bn(L.length)}টি</b> · <b>${bn(copies)}</b> কপি</span><span>মোট দাম <b>${money(tot)}</b></span><span>জমা <b>${money(got)}</b></span><span class="${due ? "bk-low" : ""}">বাকি <b>${money(due)}</b></span></div>
      ${L.length ? `<div class="tbl-wrap"><table class="exam-entry-table bk-tbl"><thead><tr><th>রসিদ · তারিখ</th><th>ক্রেতা</th><th>কী কী</th><th class="num">মোট</th><th class="num">জমা</th><th class="num">বাকি</th><th></th></tr></thead><tbody>
      ${L.map((s) => `<tr><td><b>S${bn(s.saleNo)}</b><small>${U.date(s.date)}${s.orderId ? " · অনলাইন" : ""}</small></td><td class="bk-buyer">${buyer(s)}</td><td class="bk-what">${esc(linesText(s.lines))}${s.discount && !s.free ? `<small>ছাড় ${money(s.discount)}</small>` : ""}${s.delivery ? `<small>ডেলিভারি ${money(s.delivery)}</small>` : ""}</td>
        <td class="num">${s.free ? '<span class="chip ok">ফ্রি</span>' : money(s.total)}</td><td class="num">${money(paidOf(s))}</td><td class="num">${dueOf(s) ? `<b class="bk-low">${money(dueOf(s))}</b>` : "—"}</td>
        <td class="num bk-acts">${dueOf(s) ? `<button type="button" class="btn sm gold" data-pay="${s.id}">টাকা জমা</button>` : ""}<button type="button" class="btn sm line" data-rcpt="${s.id}">রসিদ</button><button type="button" class="btn sm line danger" data-cancel="${s.id}" title="বিক্রি বাতিল — স্টক ফেরত আসবে">বাতিল</button></td></tr>`).join("")}</tbody></table></div>`
      : '<p class="empty">এই ফিল্টারে কোনো বিক্রি নেই।</p>'}</section>`;
  }
  function payForm(s) {
    X.openForm({
      title: `বাকি জমা — S${bn(s.saleNo)} · ${s.name}`,
      fields: [
        { type: "html", html: `<p class="bk-note wide">মোট ${money(s.total)} · আগে জমা ${money(paidOf(s))} · <b>বাকি ${money(dueOf(s))}</b></p>` },
        { name: "amount", label: "কত টাকা জমা নিচ্ছেন", type: "number", min: 1, required: true },
        { name: "method", label: "মাধ্যম", type: "select", options: META().methods.map((m) => [m, m]) },
        { name: "date", label: "তারিখ", type: "date" },
      ],
      values: { amount: dueOf(s), method: META().methods[0], date: U.today() },
      onSave: async (d) => { const r = await api(`/api/admin/books/sales/${s.id}/pay`, { body: d }); await X.load(); render(); toast(dueOf(r.item) ? `জমা হয়েছে — আরও বাকি ${money(dueOf(r.item))}` : "পুরো টাকা শোধ হয়েছে"); },
    });
  }
  function receipt(s) {
    const st = s.studentId && DB().students.find((x) => x.id === s.studentId);
    X.printDoc(`বইয়ের রসিদ S${s.saleNo}`, `<h2 style="margin:6px 0 2px">মানি রসিদ — বই ও শিট</h2>
      <p>রসিদ নং: <b>S${bn(s.saleNo)}</b> · তারিখ: <b>${U.date(s.date)}</b>${s.orderId ? " · অনলাইন অর্ডার" : ""}</p>
      <p>ক্রেতা: <b>${esc(s.name)}</b>${st ? ` · আইডি ${esc(st.id)} · ব্যাচ ${esc(X.batchName(st.batchId))}` : ""}${s.phone ? " · মোবাইল " + esc(s.phone) : ""}${s.address ? `<br>ঠিকানা: ${esc(s.address)}` : ""}</p>
      <table><thead><tr><th>#</th><th>বই / শিট</th><th class="r">পরিমাণ</th><th class="r">দাম</th><th class="r">মোট</th></tr></thead><tbody>
      ${s.lines.map((l, i) => `<tr><td>${bn(i + 1)}</td><td>${esc(l.title)}</td><td class="r">${bn(l.qty)}</td><td class="r">${money(l.price)}</td><td class="r">${money(l.qty * l.price)}</td></tr>`).join("")}
      <tr><td colspan="4" class="r">মোট</td><td class="r">${money(s.subtotal)}</td></tr>
      ${s.discount ? `<tr><td colspan="4" class="r">${s.free ? "ফ্রি" : "ছাড়"}</td><td class="r">− ${money(s.discount)}</td></tr>` : ""}
      ${s.delivery ? `<tr><td colspan="4" class="r">ডেলিভারি চার্জ</td><td class="r">${money(s.delivery)}</td></tr>` : ""}
      <tr><td colspan="4" class="r"><b>দিতে হবে</b></td><td class="r"><b>${money(s.total)}</b></td></tr>
      <tr><td colspan="4" class="r">জমা</td><td class="r">${money(paidOf(s))}</td></tr>
      <tr><td colspan="4" class="r"><b>বাকি</b></td><td class="r"><b>${money(dueOf(s))}</b></td></tr></tbody></table>
      ${(s.payments || []).length > 1 ? `<p style="margin-top:8px">জমার ইতিহাস: ${s.payments.map((p) => `${U.date(p.date)} — ${money(p.amount)} (${esc(p.method)})`).join(" · ")}</p>` : ""}
      <div class="sign"><span>ক্রেতার স্বাক্ষর</span><span>গ্রহণকারীর স্বাক্ষর</span></div>`);
  }

  // ---------- অনলাইন অর্ডার ----------
  function ordersHtml() {
    const ST = META().status, sh = META().ship;
    const L = orders().filter((o) => S.orderFilter === "all" || (S.orderFilter === "open" ? ["new", "confirmed", "shipped"].includes(o.status) : o.status === S.orderFilter));
    const chips = [["open", "চলমান"], ["new", "নতুন"], ["confirmed", "নিশ্চিত"], ["shipped", "পাঠানো হয়েছে"], ["delivered", "পৌঁছেছে"], ["cancelled", "বাতিল"], ["all", "সব"]];
    const cnt = (k) => orders().filter((o) => (k === "all" ? true : k === "open" ? ["new", "confirmed", "shipped"].includes(o.status) : o.status === k)).length;
    return `<section class="card"><div class="bk-head"><h3>ওয়েবসাইট থেকে আসা অর্ডার</h3><button type="button" class="btn line" data-shipset>⚙ ডেলিভারি চার্জ</button></div>
      <p class="bp-hint">ডেলিভারি চার্জ: ${esc(sh.home)} জেলায় ${money(sh.inside)}, অন্য জেলায় ${money(sh.outside)}${sh.pickup ? " · অফিস থেকে নিজে নিলে ফ্রি" : ""}। টাকা পণ্য হাতে পেয়ে (ক্যাশ অন ডেলিভারি)। "নিশ্চিত" করলে বিক্রির খাতায় ওঠে আর স্টক কমে; "পৌঁছেছে" চাপলে বাকি টাকা জমা ধরা হয়।</p>
      <div class="gl-chips">${chips.map(([k, t]) => `<button type="button" data-of="${k}" class="${S.orderFilter === k ? "on" : ""}">${t} <i>${bn(cnt(k))}</i></button>`).join("")}</div>
      ${L.length ? `<div class="bk-orders">${L.map((o) => `<article class="bk-order st-${o.status}">
        <header><b>#${bn(o.orderNo)}</b><span class="chip ${ST_CLS[o.status] || ""}">${esc(ST[o.status] || o.status)}</span><small>${when(o.createdAt)}</small></header>
        <div class="bk-ob"><div><b>${esc(o.name)}</b> · <a href="tel:${esc(o.phone)}">${esc(o.phone)}</a>${o.studentId ? ` · শিক্ষার্থী ${esc(o.studentId)}` : ""}
          <small>${o.pickup ? "🏢 অফিস থেকে নিজে নেবে" : `📍 ${esc([o.address, o.area, o.district, o.division].filter(Boolean).join(", "))}`}</small>${o.note ? `<small>💬 ${esc(o.note)}</small>` : ""}</div>
          <ul>${o.lines.map((l) => `<li>${esc(l.title)} × ${bn(l.qty)} <span>${money(l.qty * l.price)}</span></li>`).join("")}<li>ডেলিভারি <span>${money(o.delivery)}</span></li><li class="bk-ot">মোট <span>${money(o.total)}</span></li></ul></div>
        <footer>${o.status === "new" ? `<button type="button" class="btn sm gold" data-oa="confirm" data-o="${o.id}">✓ নিশ্চিত করুন</button>` : ""}
          ${["new", "confirmed"].includes(o.status) ? `<button type="button" class="btn sm line" data-oa="ship" data-o="${o.id}">🚚 পাঠানো হয়েছে</button>` : ""}
          ${["new", "confirmed", "shipped"].includes(o.status) ? `<button type="button" class="btn sm line" data-oa="deliver" data-o="${o.id}">📦 পৌঁছেছে, টাকা পেয়েছি</button><button type="button" class="btn sm line danger" data-oa="cancel" data-o="${o.id}">বাতিল</button>` : ""}
          ${["delivered", "cancelled"].includes(o.status) ? `<button type="button" class="btn sm line" data-oa="reopen" data-o="${o.id}">আবার খুলুন</button>` : ""}
          ${o.saleId && (DB().bookSales || []).some((s) => s.id === o.saleId) ? `<button type="button" class="btn sm line" data-rcpt="${o.saleId}">রসিদ</button>` : ""}
          <a class="btn sm line" href="https://wa.me/88${esc(o.phone)}" target="_blank" rel="noopener">WhatsApp</a></footer></article>`).join("")}</div>`
      : '<p class="empty">এই ভাগে কোনো অর্ডার নেই।</p>'}</section>`;
  }
  async function orderAct(id, action) {
    const o = orders().find((x) => x.id === id); if (!o) return;
    const ask = { confirm: `#${o.orderNo} নিশ্চিত করবেন? বিক্রির খাতায় উঠবে আর স্টক কমবে।`, deliver: `#${o.orderNo} পৌঁছে গেছে আর ${money(o.total)} পেয়েছেন?`, cancel: `#${o.orderNo} বাতিল করবেন?${o.saleId ? " বিক্রিও বাতিল হবে, স্টক ফেরত আসবে।" : ""}` }[action];
    if (ask && !confirm(ask)) return;
    try { await api(`/api/admin/books/orders/${id}`, { body: { action } }); await X.load(); render(); toast("অর্ডার আপডেট হয়েছে"); }
    catch (e) { toast(e.message, true); }
  }
  function shipForm() {
    const sh = META().ship, geo = META().geo;
    X.openForm({
      title: "ডেলিভারি চার্জ",
      fields: [
        { name: "homeDiv", label: "আপনার বিভাগ", type: "select", options: Object.keys(geo).map((d) => [d, d]) },
        { name: "home", label: "আপনার জেলা", type: "select", options: Object.values(geo).flat().map((d) => [d, d]) },
        { name: "inside", label: "নিজের জেলায় চার্জ (৳)", type: "number", min: 0 },
        { name: "outside", label: "অন্য জেলায় চার্জ (৳)", type: "number", min: 0 },
        { name: "pickup", label: "অফিস থেকে নিজে নেওয়া যাবে (চার্জ ০)", type: "check" },
        { name: "note", label: "অর্ডার পাতায় নোট (ঐচ্ছিক)", type: "textarea", wide: true, placeholder: "যেমন: অর্ডারের ২–৪ দিনের মধ্যে কুরিয়ারে পাঠানো হয়।" },
      ],
      values: sh,
      onSave: async (d) => {
        if (!(geo[d.homeDiv] || []).includes(d.home)) throw new Error("জেলাটা ঐ বিভাগের নয় — ঠিক করে বাছুন");
        await api("/api/admin/books/settings", { body: d }); await X.load(); render(); toast("সেভ হয়েছে");
      },
    });
  }

  // ---------- স্টকের হিসাব ----------
  function stockHtml() {
    const mv = [...(DB().bookMoves || [])].map((m) => ({ ...m, k: "in" })), out = (DB().bookSales || []).map((s) => ({ k: "sale", date: s.date, createdAt: s.createdAt, s }));
    const L = [...mv, ...out].sort((a, b) => String(b.date + b.createdAt).localeCompare(String(a.date + a.createdAt))).slice(0, 200);
    return `<section class="card"><h3>স্টকের হিসাব <small class="ln-count">স্টক যোগ / বিয়োগ আর বিক্রি — শেষ ২০০টি</small></h3>
      ${L.length ? `<div class="tbl-wrap"><table class="exam-entry-table bk-tbl"><thead><tr><th>তারিখ</th><th>কী হয়েছে</th><th>বই / শিট</th><th class="num">পরিমাণ</th><th>নোট</th></tr></thead><tbody>
      ${L.map((x) => x.k === "in" ? `<tr><td>${U.date(x.date)}</td><td><span class="chip ${x.qty > 0 ? "ok" : "bad"}">${x.qty > 0 ? "স্টক যোগ" : "স্টক বিয়োগ"}</span></td><td>${esc((bookById(x.bookId) || {}).title || "—")}</td><td class="num"><b>${x.qty > 0 ? "+" : "−"}${bn(Math.abs(x.qty))}</b></td><td>${esc(x.note || "")}${x.cost ? ` · খরচ ${money(x.cost)}` : ""}</td></tr>`
        : `<tr><td>${U.date(x.date)}</td><td><span class="chip ${x.s.free ? "gold" : ""}">${x.s.free ? "ফ্রি দেওয়া" : "বিক্রি"} S${bn(x.s.saleNo)}</span></td><td>${esc(linesText(x.s.lines))}</td><td class="num"><b>−${bn(x.s.lines.reduce((n, l) => n + l.qty, 0))}</b></td><td>${esc(x.s.name)}</td></tr>`).join("")}</tbody></table></div>`
      : '<p class="empty">এখনো কোনো হিসাব নেই।</p>'}</section>`;
  }

  // ---------- ঘটনা ----------
  function onClick(e) {
    const t = (s) => e.target.closest(s); let el;
    if ((el = t("[data-tab]"))) { S.tab = el.dataset.tab; return render(); }
    if (t("[data-new]")) return bookForm(null);
    if ((el = t("[data-edit]"))) return bookForm(bookById(el.dataset.edit));
    if ((el = t("[data-stock]"))) return stockForm(bookById(el.dataset.stock));
    if ((el = t("[data-del]"))) { const b = bookById(el.dataset.del); return X.remove("books", b.id, `"${b.title}"`); }
    if ((el = t("[data-sell]"))) { S.sale = blankSale(); S.sale.items[0].bookId = el.dataset.sell; S.tab = "sell"; return render(); }
    if ((el = t("[data-buyer]"))) { S.sale.buyerType = el.dataset.buyer; return render(); }
    if (t("[data-addline]")) { S.sale.items.push({ bookId: "", qty: 1, price: "" }); return render(); }
    if ((el = t("[data-rmline]"))) { S.sale.items.splice(+el.dataset.rmline, 1); return render(); }
    if (t("[data-dosale]")) return doSale();
    if (t("[data-resetsale]")) { S.sale = blankSale(); return render(); }
    if ((el = t("[data-sf]"))) { S.saleFilter = el.dataset.sf; return render(); }
    if ((el = t("[data-pay]"))) return payForm(sales().find((s) => s.id === el.dataset.pay));
    if ((el = t("[data-rcpt]"))) return receipt(sales().find((s) => s.id === el.dataset.rcpt));
    if ((el = t("[data-cancel]"))) {
      const s = sales().find((x) => x.id === el.dataset.cancel);
      if (!confirm(`S${s.saleNo} — ${s.name}-এর বিক্রি বাতিল করবেন?\n${linesText(s.lines)} স্টকে ফেরত যাবে${paidOf(s) ? `, আর জমা ${money(paidOf(s))}-এর হিসাবও মুছে যাবে` : ""}।`)) return;
      return api(`/api/admin/books/sales/${s.id}`, { method: "DELETE" }).then(async () => { await X.load(); render(); toast("বিক্রি বাতিল হয়েছে"); }).catch((er) => toast(er.message, true));
    }
    if ((el = t("[data-of]"))) { S.orderFilter = el.dataset.of; return render(); }
    if ((el = t("[data-oa]"))) return orderAct(el.dataset.o, el.dataset.oa);
    if (t("[data-shipset]")) return shipForm();
  }
  function onInput(e) {
    const d = e.target.dataset;
    if ("q" in d) { S.q = e.target.value; const pos = e.target.selectionStart; render(); const i = $("[data-q]", C); i.focus(); i.selectionStart = i.selectionEnd = pos; return; }
    if ("saleq" in d) { S.saleQ = e.target.value; const pos = e.target.selectionStart; render(); const i = $("[data-saleq]", C); i.focus(); i.selectionStart = i.selectionEnd = pos; return; }
    if (!S.sale) return;
    if ("line" in d && d.k !== "bookId") { S.sale.items[+d.line][d.k] = e.target.value; return sumSale(); }
    if (d.s && e.target.type !== "checkbox" && e.target.tagName !== "SELECT") {
      S.sale[d.s] = e.target.value;
      if (d.s === "studentId") { const pick = $("[data-student-pick]", C); if (pick) pick.value = e.target.value.trim(); const st = DB().students.find((x) => x.id === e.target.value.trim()), w = $("#bkWho", C); if (w) w.innerHTML = st ? `<b>${esc(st.name)}</b><small>${esc(X.batchName(st.batchId))} · ${esc(st.phone || st.guardianPhone || "")}</small>` : e.target.value ? '<span class="bk-low">এই আইডিতে কেউ নেই</span>' : "<small>আইডি লিখলে নাম দেখাবে</small>"; }
      return sumSale();
    }
  }
  function onChange(e) {
    const d = e.target.dataset;
    if ("month" in d) { S.month = e.target.value; return render(); }
    if (!S.sale) return;
    if ("studentSession" in d || "studentBatch" in d) {
      if ("studentSession" in d) { S.studentSession = e.target.value; S.studentBatch = ""; }
      else S.studentBatch = e.target.value;
      if (!saleStudents().some((x) => x.id === S.sale.studentId)) S.sale.studentId = "";
      return render();
    }
    if ("studentPick" in d) { S.sale.studentId = e.target.value; return render(); }
    if ("line" in d && d.k === "bookId") { const it = S.sale.items[+d.line]; it.bookId = e.target.value; it.price = ""; return render(); }
    if (d.s === "free") { S.sale.free = e.target.checked; return render(); }
    if (d.s) { S.sale[d.s] = e.target.value; return sumSale(); } // মাধ্যম, তারিখ (ক্যালেন্ডার থেকে)
  }

  return function booksPage(c) { C = c; c.onclick = onClick; c.oninput = onInput; c.onchange = onChange; render(); };
};
