// অ্যাডমিন → সেটআপ → সেটিংস → "SMS খরচের হিসাব": কোন তারিখ থেকে কোন তারিখ (বা আজ / এই মাস / গত মাস / বছর) পর্যন্ত কয়টা SMS গেল, কত টাকা খরচ।
// তথ্য আসে SMS খাতা (smsLog) থেকে — গেটওয়ে হয়ে যাওয়া প্রতিটা SMS-এর একটা করে লেখা। খরচ = SMS-এর অংশ × প্রতি SMS-এর দাম (দাম নিজে বসাতে হয়)।
// বাংলা SMS-এ ৭০ অক্ষরে ১ অংশ (বড় হলে ৬৭-তে ১), ইংরেজিতে ১৬০ (বড় হলে ১৫৩-এ ১); এখন থেকে প্রতিটা লেখায় আসল অংশ জমা থাকে, আগের লেখায় ধরনভেদে আনুমানিক অংশ ধরা হয়।
window.SICSmsCost = function (X) {
  "use strict";
  const { $, esc, bn, api, toast } = U;
  const DB = () => X.DB;
  const KINDS = { OTP: "OTP (যাচাই কোড)", "ID/PIN": "ভর্তির আইডি / PIN", Book: "বইয়ের অর্ডার", Fee: "মাসের ১ তারিখের বকেয়া", DueManual: "বকেয়া SMS তালিকা", CallDue: "বকেয়া কল তালিকা", Absent: "অনুপস্থিতি (সন্ধ্যার অটো)", CallAbsent: "অনুপস্থিতি কল তালিকা", Monthly: "মাসের অগ্রগতি", Birthday: "জন্মদিনের শুভেচ্ছা", Panel: "SMS প্যানেল — নিজের বার্তা", Result: "পরীক্ষার ফলাফল" };
  // পুরোনো লেখায় অংশ জমা নেই — ধরন দেখে আনুমানিক (বাংলা ছোট বার্তা ≈২)
  const EST = { Fee: 2, DueManual: 2, CallDue: 2, Absent: 2, CallAbsent: 2, Monthly: 3, Birthday: 2, Panel: 2, Result: 2 };
  const parts = (t) => { const n = [...String(t || "")].length, uni = /[^\x00-\x7f]/.test(t || ""); return !n ? 1 : uni ? (n <= 70 ? 1 : Math.ceil(n / 67)) : n <= 160 ? 1 : Math.ceil(n / 153); };
  const S = { from: "", to: "", view: "day", rate: null };
  let box = null;

  const pad = (n) => String(n).padStart(2, "0"), ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const PRESETS = [
    ["today", "আজ", (t) => [t, t]],
    ["yesterday", "গতকাল", (t) => { const d = parse(t); d.setDate(d.getDate() - 1); return [ymd(d), ymd(d)]; }],
    ["week", "গত ৭ দিন", (t) => { const d = parse(t); d.setDate(d.getDate() - 6); return [ymd(d), t]; }],
    ["month", "এই মাস", (t) => { const d = parse(t); return [ymd(new Date(d.getFullYear(), d.getMonth(), 1)), t]; }],
    ["lastmonth", "গত মাস", (t) => { const d = parse(t); return [ymd(new Date(d.getFullYear(), d.getMonth() - 1, 1)), ymd(new Date(d.getFullYear(), d.getMonth(), 0))]; }],
    ["year", "এই বছর", (t) => [`${t.slice(0, 4)}-01-01`, t]],
    ["all", "সব সময়", () => ["", ""]],
  ];
  const monthName = (k) => new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1).toLocaleDateString("bn-BD", { month: "long", year: "numeric" });
  const num = (n) => bn(Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 }));
  const taka = (n) => "৳" + bn(Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  // গেটওয়ে থেকে যাওয়া লেখা (ম্যানুয়াল "SMS খাতা"-র লেখায় phone / status থাকে না, তাই বাদ)
  function entries() {
    return (DB().smsLog || []).filter((l) => l.date && (l.phone || l.status)).map((l) => {
      const exact = Number.isFinite(l.segments) && l.segments > 0;
      const seg = exact ? l.segments : (l.filter === "Panel" || l.filter === "Result") && l.text ? Math.max(parts(l.text), EST[l.filter] || 1) : EST[l.filter] || 1;
      return { date: l.date, kind: l.filter || "OTP", seg, exact, st: l.ok ? "ok" : l.status === "unknown" ? "unk" : "bad" };
    });
  }
  function compute() {
    const rows = entries().filter((e) => (!S.from || e.date >= S.from) && (!S.to || e.date <= S.to));
    const sum = { msgs: 0, seg: 0, bad: 0, unk: 0, est: 0 };
    const group = new Map();
    const key = (e) => S.view === "month" ? e.date.slice(0, 7) : S.view === "type" ? e.kind : e.date;
    for (const e of rows) {
      if (e.st === "bad") { sum.bad++; } else if (e.st === "unk") { sum.unk++; }
      const k = key(e), g = group.get(k) || { k, msgs: 0, seg: 0, bad: 0, unk: 0 };
      if (e.st === "ok") { sum.msgs++; sum.seg += e.seg; if (!e.exact) sum.est++; g.msgs++; g.seg += e.seg; } else if (e.st === "bad") g.bad++; else g.unk++;
      group.set(k, g);
    }
    const list = [...group.values()].sort((a, b) => S.view === "type" ? b.seg - a.seg : String(b.k).localeCompare(String(a.k)));
    return { sum, list, total: rows.length };
  }

  function draw() {
    if (!box) return;
    const { sum, list } = compute(), rate = Number(S.rate) || 0, cost = sum.seg * rate, max = Math.max(1, ...list.map((g) => g.seg));
    const label = (g) => S.view === "month" ? monthName(g.k) : S.view === "type" ? KINDS[g.k] || g.k : U.date(g.k);
    $("#scTiles", box).innerHTML = `<div class="sc-t gold"><small>মোট খরচ</small><b>${rate ? taka(cost) : "—"}</b><span>${rate ? `${num(sum.seg)} অংশ × ${taka(rate)}` : "নিচে প্রতি SMS-এর দাম বসান"}</span></div>
      <div class="sc-t"><small>SMS গেছে</small><b>${num(sum.msgs)}</b><span>টি নম্বরে</span></div>
      <div class="sc-t"><small>বিলে কাটে (অংশ)</small><b>${num(sum.seg)}</b><span>বাংলা ৭০ অক্ষরে ১</span></div>
      <div class="sc-t${sum.bad ? " bad" : ""}"><small>যায়নি</small><b>${num(sum.bad)}</b><span>খরচ ধরা হয়নি</span></div>
      ${sum.unk ? `<div class="sc-t warn"><small>ফল অনিশ্চিত</small><b>${num(sum.unk)}</b><span>গেটওয়ের উত্তর পাওয়া যায়নি; খরচ ধরা হয়নি</span></div>` : ""}`;
    $("#scNote", box).innerHTML = sum.est ? `ℹ ${num(sum.est)}টি পুরোনো SMS-এর অংশ ধরন দেখে আনুমানিক ধরা হয়েছে (তখন অংশ জমা রাখা হতো না) — এখন থেকে প্রতিটার আসল অংশ জমা হচ্ছে। চূড়ান্ত হিসাব BulkSMSBD-র রিপোর্টের সাথে মিলিয়ে নিন।` : "";
    $("#scTable", box).innerHTML = list.length ? `<div class="tbl-wrap"><table class="sc-tbl"><thead><tr><th>${S.view === "month" ? "মাস" : S.view === "type" ? "ধরন" : "তারিখ"}</th><th class="num">SMS</th><th class="num">অংশ</th><th class="num">যায়নি</th><th class="num">খরচ</th><th></th></tr></thead><tbody>
      ${list.map((g) => `<tr><td>${esc(label(g))}</td><td class="num">${num(g.msgs)}</td><td class="num">${num(g.seg)}</td><td class="num">${g.bad ? `<span class="chip bad">${num(g.bad)}</span>` : "—"}</td><td class="num"><b>${rate ? taka(g.seg * rate) : "—"}</b></td><td class="sc-barc"><i style="width:${Math.max(2, Math.round((g.seg / max) * 100))}%"></i></td></tr>`).join("")}</tbody>
      <tfoot><tr><td>মোট</td><td class="num">${num(sum.msgs)}</td><td class="num">${num(sum.seg)}</td><td class="num">${num(sum.bad)}</td><td class="num"><b>${rate ? taka(cost) : "—"}</b></td><td></td></tr></tfoot></table></div>` : '<p class="empty">এই সময়ে কোনো SMS যায়নি।</p>';
    $$all(".sc-pre", box).forEach((b) => { const p = PRESETS.find(([k]) => k === b.dataset.pre), [f, t] = p[2](U.today()); b.classList.toggle("on", f === S.from && t === S.to); });
    $$all(".sc-view", box).forEach((b) => b.classList.toggle("on", b.dataset.view === S.view));
    $("#scFrom", box).value = S.from; $("#scTo", box).value = S.to;
  }
  const $$all = (s, r) => [...r.querySelectorAll(s)];

  async function mount(el) {
    box = el;
    if (!S.from && !S.to && !box.dataset.init) { [S.from, S.to] = PRESETS[3][2](U.today()); } // শুরুতে এই মাস
    box.dataset.init = "1";
    box.innerHTML = `<div class="card-head"><h2>SMS খরচের হিসাব</h2></div>
      <p style="margin:0 0 12px;color:var(--muted)">কোন সময়ে কয়টা SMS গেল আর কত টাকা খরচ হলো — দিন, মাস বা ধরন (বকেয়া, অনুপস্থিতি, জন্মদিন …) অনুযায়ী। শুধু সফলভাবে যাওয়া SMS-এর খরচ ধরা হয়।</p>
      <div class="sc-pres">${PRESETS.map(([k, l]) => `<button type="button" class="sc-pre" data-pre="${k}">${l}</button>`).join("")}</div>
      <div class="sc-range"><label>থেকে<input type="date" id="scFrom"></label><label>পর্যন্ত<input type="date" id="scTo"></label>
        <label>প্রতি SMS-এর দাম (৳)<span class="sc-rate"><input type="number" id="scRate" min="0" step="0.01" inputmode="decimal" placeholder="যেমন: 0.35"><button type="button" class="btn sm gold" id="scRateSave">সেভ</button></span></label></div>
      <div class="sc-tiles" id="scTiles"></div><p class="sc-note" id="scNote"></p>
      <div class="sc-views">${[["day", "দিন অনুযায়ী"], ["month", "মাস অনুযায়ী"], ["type", "ধরন অনুযায়ী"]].map(([k, l]) => `<button type="button" class="sc-view" data-view="${k}">${l}</button>`).join("")}</div>
      <div id="scTable"></div>`;
    box.onclick = (e) => {
      const p = e.target.closest(".sc-pre"), v = e.target.closest(".sc-view");
      if (p) { [S.from, S.to] = PRESETS.find(([k]) => k === p.dataset.pre)[2](U.today()); draw(); }
      else if (v) { S.view = v.dataset.view; draw(); }
      else if (e.target.closest("#scRateSave")) saveRate();
    };
    box.onchange = (e) => {
      if (e.target.id === "scFrom") { S.from = e.target.value; if (S.to && S.from > S.to) S.to = S.from; draw(); }
      if (e.target.id === "scTo") { S.to = e.target.value; if (S.from && S.to < S.from) S.from = S.to; draw(); }
    };
    box.querySelector("#scRate").oninput = (e) => { S.rate = e.target.value; draw(); };
    draw();
    try { const g = await api("/api/admin/sms-config"); if (g.rate) { S.rate = g.rate; const r = box.querySelector("#scRate"); if (r) r.value = g.rate; draw(); } } catch {}
  }
  async function saveRate() {
    const v = Number($("#scRate", box).value);
    if (!(v >= 0)) return toast("দাম ঠিকভাবে লিখুন", true);
    try { await api("/api/admin/sms-config", { body: { rate: v } }); S.rate = v; toast("প্রতি SMS-এর দাম সেভ হয়েছে"); draw(); } catch (e) { toast(e.message, true); }
  }
  return { mount };
};
