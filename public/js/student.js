// শিক্ষার্থী প্যানেল
(function () {
  const { $, $$, esc, bn, money, api } = U;
  let D = null;
  const STATUS = { P: "উপস্থিত", A: "অনুপস্থিত", L: "ছুটি" };
  function requestProfilePhoto() {
    if (AS) return;
    const dialog = document.createElement("dialog"); dialog.className = "student-photo-dialog";
    dialog.innerHTML = `<h2>নিজের ছবি পাঠান</h2><p>মুখ পরিষ্কার বোঝা যায় এমন ছবি দিন। অ্যাডমিন অনুমোদন দিলে প্রোফাইল ও আইডি কার্ডে দেখাবে।</p><label>ছবি বেছে নিন<input type="file" accept="image/jpeg,image/png,image/webp"></label><img alt="নির্বাচিত ছবির প্রিভিউ" hidden><p class="student-photo-error" role="alert"></p><div class="student-photo-actions"><button type="button" class="btn line" data-cancel>বাতিল</button><button type="button" class="btn gold" data-send disabled>অনুমোদনের জন্য পাঠান</button></div>`;
    document.body.append(dialog); const input = dialog.querySelector("input"), preview = dialog.querySelector("img"), error = dialog.querySelector('[role="alert"]'), sendButton = dialog.querySelector('[data-send]');
    let photo = "", busy = false, revision = 0;
    dialog.addEventListener("close", () => dialog.remove());
    dialog.addEventListener("cancel", e => { if (busy) e.preventDefault(); });
    dialog.querySelector('[data-cancel]').onclick = () => { if (!busy) dialog.close(); };
    input.onchange = async () => {
      const current = ++revision; photo = ""; sendButton.disabled = true; preview.hidden = true; error.textContent = "";
      const file = input.files[0]; if (!file) return;
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) { error.textContent = "JPG, PNG বা WEBP ছবি দিন (১০ MB-এর মধ্যে)।"; return; }
      const url = URL.createObjectURL(file);
      try {
        const image = new Image(); image.src = url; await image.decode();
        const scale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(image,0,0,canvas.width,canvas.height);
        let result = canvas.toDataURL("image/jpeg", .85);
        if (result.length > 540000) result = canvas.toDataURL("image/jpeg", .65);
        if (current !== revision || !dialog.isConnected) return;
        photo = result; preview.src = photo; preview.hidden = false; sendButton.disabled = false;
      } catch { if (current === revision) error.textContent = "ছবিটি খোলা যায়নি। অন্য ছবি দিন।"; }
      finally { URL.revokeObjectURL(url); }
    };
    sendButton.onclick = async () => {
      if (!photo || busy) return; busy = true; sendButton.disabled = true; input.disabled = true; error.textContent = "";
      try { const result = await api("/api/student/photo-request", { body: { photo } }); D.profile.pendingPhoto = result.pendingPhoto; $("#studentPhotoStatus").textContent = "ছবি পাঠানো হয়েছে — অ্যাডমিনের অনুমোদনের অপেক্ষায়।"; dialog.close(); }
      catch (e) { error.textContent = e.message; }
      finally { busy = false; sendButton.disabled = false; input.disabled = false; }
    };
    dialog.showModal();
  }
  function moduleFeeCard(i) {
    const rows = (i.breakdown || []).map(a => {
      const month = new Date(a.month + "-01T00:00:00").toLocaleDateString("bn-BD", { month: "long", year: "numeric" });
      const note = a.paused ? "পড়া বন্ধ — ফি নেই" : a.late ? `${bn(a.fromDay)} তারিখ থেকে · ${bn(a.got)}টি ক্লাসের আংশিক ফি` : a.shut ? `${bn(a.shut)}টি বন্ধের ক্লাস বাদ দিয়ে` : "পুরো মাসের ফি";
      return `<div class="sf-month"><div><b>${esc(month)}</b><small>${esc(note)}</small></div><div class="sf-month-rate"><small>মাসিক ফি${i.discount ? " (ছাড় বাদে)" : ""}</small><span>${a.paused ? "—" : money(a.monthlyRate)}</span></div><strong>${money(a.fee)}</strong></div>`;
    }).join("");
    return `<article class="sf-module"><header><div><h3>${esc(i.course)}</h3><p>শুরু: ${U.date(i.startDate)}${i.monthly ? ` · ${bn(i.months)} মাসের হিসাব` : ""}</p></div><span class="sf-status">${i.status === "ended" ? "কোর্স শেষ" : "চলমান"}</span></header><div class="sf-meta"><span>মূল ফি <b>${money(i.fee)}${i.monthly ? "/মাস" : ""}</b></span>${i.discount ? `<span>ছাড় <b>${money(i.discount)}${i.monthly ? "/মাস" : ""}</b></span>` : ""}${i.chapters?.length ? `<span>অধ্যায় ${esc(i.chapters.join(", "))}</span>` : ""}</div>${i.monthly ? `<div class="sf-months">${rows || `<p>মাসভিত্তিক হিসাব দেখতে পেজ রিফ্রেশ করুন।</p>`}</div>` : `<div class="sf-once">এককালীন কোর্স ফি <b>${money(i.due)}</b></div>`}<footer><span>এই মডিউলের মোট ফি</span><strong>${money(i.due)}</strong></footer></article>`;
  }

  function ring(pct, label, color) {
    return `<div style="text-align:center"><div class="ring" style="--p:${pct ?? 0};--c:${color || "var(--em2)"}"><span>${pct === null ? "—" : bn(pct) + "%"}</span></div><small style="color:var(--muted);font-weight:600">${label}</small></div>`;
  }
  // উপস্থিতি = উপস্থিত ÷ (উপস্থিত + অনুপস্থিত) — ছুটির দিন বাদ
  const attPct = () => { const l = D.attendance.filter((a) => a.status === "P" || a.status === "A"); return l.length ? Math.round((l.filter((a) => a.status === "P").length / l.length) * 100) : null; };
  // পরীক্ষা: সার্ভার থেকে নতুন থেকে পুরনো ক্রমে আসে; me = নিজের ফলাফল (examcalc.js-এর হিসাব)
  const taken = () => D.results.filter((r) => r.me && !r.me.absent);
  const avgPct = () => { const t = taken().filter((r) => !window.ExamCalc.EXTRA_TYPES.includes(r.type)); // জিকে / বিশেষ পরীক্ষা মোট গড়ে নয়
  return t.length ? Math.round(t.reduce((s, r) => s + r.me.percent, 0) / t.length) : null; };
  const n2 = (x) => (x === null || x === undefined ? "—" : bn(String(Math.round(x * 100) / 100)));
  // পরীক্ষার ধরনের রং (অ্যাডমিনের পরীক্ষা পাতার মতো)
  const RT_C = { weekly: "#286fa3", monthly: "#6c5bb5", chapter: "#9a6a12", model: "#c0394f", class: "#187460", gk: "#b4531f", special: "#0e7490" };
  // 🖨 ফলাফল রিপোর্ট কার্ড — A4 এক পাতা: শিক্ষার্থীর তথ্য, সব পরীক্ষার টেবিল, সার্বিক, উপস্থিতি ও অন্যান্য, মন্তব্য, স্বাক্ষর
  function printReportCard() {
    const EC = window.ExamCalc, t = U.today(), s = D.profile, site = D.site || {}, O = location.origin;
    const rows = D.results.filter((r) => !r.date || r.date <= t || !r.me.absent).slice().sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const done = rows.filter((r) => r.published !== false && !r.me.absent), main = done.filter((r) => !EC.EXTRA_TYPES.includes(r.type));
    const avg = (l) => (l.length ? l.reduce((a, r) => a + r.me.percent, 0) / l.length : null), P = (x) => (x === null ? "—" : bn(String(Math.round(x * 10) / 10)) + "%");
    const att = D.attendance || [], ap = att.filter((a) => a.status === "P").length, aa = att.filter((a) => a.status === "A").length, attPct = ap + aa ? (ap / (ap + aa)) * 100 : null;
    const hw = (D.homework || []).filter((h) => h.kind === "homework" && ["done", "not"].includes(h.status)), hwDone = hw.filter((h) => h.status === "done").length;
    const qz = (D.quizzes || []).map((q) => (q.myAttempts || []).reduce((b, x) => (!b || x.score > b.score ? x : b), null)).filter(Boolean), qAvg = qz.length ? (qz.reduce((a, x) => a + (x.full ? x.score / x.full : 0), 0) / qz.length) * 100 : null;
    const gkAvg = avg(done.filter((r) => r.type === "gk")), mAvg = avg(main);
    // সারাংশ: সর্বোচ্চ / সর্বনিম্ন নম্বর (শতাংশ ধরে) আর সবচেয়ে ভালো / খারাপ অবস্থান
    const byPct = main.slice().sort((a, b) => b.me.percent - a.me.percent), hi = byPct[0], lo = byPct[byPct.length - 1];
    const byRank = main.filter((r) => r.me.rank).sort((a, b) => a.me.rank - b.me.rank), rkHi = byRank[0], rkLo = byRank[byRank.length - 1];
    const ranks = main.filter((r) => r.me.rank), dd =(d) => (d ? `${d.slice(8, 10)}-${d.slice(5, 7)}` : "—");
    const weak = main.slice().sort((a, b) => a.me.percent - b.me.percent)[0], strong = main.slice().sort((a, b) => b.me.percent - a.me.percent)[0];
    const fb = mAvg === null ? "পরীক্ষার ফল প্রকাশ হলে এখানে মন্তব্য দেখাবে।" : [mAvg >= 80 ? "সার্বিক ফল খুব ভালো।" : mAvg >= 60 ? "সার্বিক ফল ভালো, আরও উন্নতির সুযোগ আছে।" : mAvg >= 40 ? "সার্বিক ফল মোটামুটি — নিয়মিত অনুশীলন দরকার।" : "ফলাফলে বিশেষ মনোযোগ দরকার।",
      strong && strong !== weak ? `সবচেয়ে ভালো: ${strong.title} (${P(strong.me.percent)})।` : "", weak && weak.me.percent < 60 ? `আরও অনুশীলন দরকার: ${weak.title} (${P(weak.me.percent)})।` : "", attPct !== null && attPct < 75 ? "উপস্থিতি ৭৫%-এর নিচে — নিয়মিত ক্লাসে আসা দরকার।" : ""].filter(Boolean).join(" ");
    // CQ আর MCQ আলাদা: পরীক্ষায় যে অংশ নেই সেখানে "—"; তারপর মোট, ব্যাচে অবস্থান, সেশনে অবস্থান
    const partSum = (r, part) => { const ps = EC.parts(r).filter((p) => p.part === part); if (!ps.length) return null; return { got: ps.reduce((a, p) => a + (Number(r.me.scores && r.me.scores[p.key]) || 0), 0), full: ps.reduce((a, p) => a + p.full, 0) }; };
    const cell = (r) => {
      if (r.published === false || r.me.absent) return `<td class="n">—</td><td class="n">—</td><td class="n st">${r.published === false ? "প্রকাশ হয়নি" : "অনুপস্থিত"}</td><td class="n">—</td><td class="n">—</td>`;
      const pc = (part) => { const x = partSum(r, part); return x ? `${n2(x.got)}/${bn(x.full)}` : "—"; };
      return `<td class="n">${pc("cq")}</td><td class="n">${pc("mcq")}</td><td class="n${r.me.pass ? "" : " fl"}"><b>${n2(r.me.total)}/${bn(r.full)}</b>${r.me.pass ? "" : " <small>(ফেল)</small>"}</td>
        <td class="n">${r.batchRank ? `${bn(r.batchRank)}/${bn(r.batchOf)}` : "—"}</td><td class="n">${r.me.rank ? `${bn(r.me.rank)}/${bn(r.of)}` : "—"}</td>`;
    };
    const tn = { weekly: "সাপ্তাহিক", monthly: "মাসিক", chapter: "অধ্যায়", model: "মডেল টেস্ট", class: "ক্লাস টেস্ট", gk: "জিকে", special: "বিশেষ" };
    openCard("ফলাফল রিপোর্ট কার্ড", `<table><thead><tr><th class="c">নং</th><th>তারিখ</th><th>পরীক্ষা</th><th>সিলেবাস</th><th class="n">CQ</th><th class="n">MCQ</th><th class="n">Total</th><th class="n">Batch Rank</th><th class="n">Rank</th></tr></thead><tbody>
${rows.map((r, i) => `<tr><td class="c">${bn(i + 1)}</td><td>${bn(dd(r.date))}</td><td>${esc(r.title)}<small class="ty">${tn[r.type] || esc(EC.typeName(r.type))}</small></td><td class="sy">${esc([r.chapter, r.syllabus].filter(Boolean).join(" — ") || "—")}</td>${cell(r)}</tr>`).join("") || '<tr><td colspan="9" style="text-align:center">এখনো কোনো পরীক্ষা নেই</td></tr>'}
<tr class="ov"><td colspan="6">সার্বিক (জিকে ও বিশেষ পরীক্ষা বাদে) · ${bn(main.filter((r) => r.me.pass).length)} পাস · ${bn(main.filter((r) => !r.me.pass).length)} ফেল</td><td class="n">গড় ${P(mAvg)}</td><td colspan="2" class="n">সেরা অবস্থান: ${ranks.length ? bn(Math.min(...ranks.map((r) => r.me.rank))) : "—"}</td></tr></tbody></table>
<div class="bx"><h3>পরীক্ষার সারাংশ <small style="font-weight:400;opacity:.8">(জিকে ও বিশেষ পরীক্ষা বাদে)</small></h3><div class="g"><div><span>Total Exam</span><b>${bn(main.length)} <small>(মোট ${bn(rows.filter((r) => r.published !== false && !EC.EXTRA_TYPES.includes(r.type)).length)}টির মধ্যে)</small></b></div><div><span>Average Mark</span><b>${P(mAvg)}</b></div>
  <div><span>Highest Marks</span><b>${hi ? `${n2(hi.me.total)}/${bn(hi.full)} (${bn(Math.round(hi.me.percent))}%) · ${esc(hi.title)}` : "—"}</b></div><div><span>Lowest Marks</span><b>${lo ? `${n2(lo.me.total)}/${bn(lo.full)} (${bn(Math.round(lo.me.percent))}%) · ${esc(lo.title)}` : "—"}</b></div>
  <div><span>Highest Rank</span><b>${rkHi ? `${bn(rkHi.me.rank)}/${bn(rkHi.of)} · ${esc(rkHi.title)}` : "—"}</b></div><div><span>Lowest Rank</span><b>${rkLo ? `${bn(rkLo.me.rank)}/${bn(rkLo.of)} · ${esc(rkLo.title)}` : "—"}</b></div></div></div>`, fb);
  }
  // 🖨 অনলাইন কুইজ রিপোর্ট কার্ড — একই A4 নকশা: প্রতিটা শেষ হওয়া কুইজে সেরা চেষ্টার নম্বর, সঠিক / ভুল / বাদ, অবস্থান
  function printQuizCard() {
    const list = (D.quizzes || []).filter((q) => q.state !== "upcoming" || q.myAttempts.length).slice().sort((a, b) => (a.opensAt || "").localeCompare(b.opensAt || ""));
    const best = (q) => (q.myAttempts.length ? q.myAttempts.reduce((a, b) => (b.score > a.score ? b : a)) : null);
    const pct = (b) => (b && b.full ? (b.score / b.full) * 100 : 0), P = (x) => (x === null ? "—" : bn(String(Math.round(x * 10) / 10)) + "%");
    const done = list.filter((q) => best(q)), avg = done.length ? done.reduce((a, q) => a + pct(best(q)), 0) / done.length : null;
    const byPct = done.slice().sort((a, b) => pct(best(b)) - pct(best(a))), hi = byPct[0], lo = byPct[byPct.length - 1];
    const byRank = done.filter((q) => q.rank).sort((a, b) => a.rank - b.rank), rkHi = byRank[0], rkLo = byRank[byRank.length - 1];
    const missed = list.filter((q) => !best(q) && q.state === "closed").length;
    const dd = (d) => (d ? `${d.slice(8, 10)}-${d.slice(5, 7)}` : "—"), sc = (q) => { const b = best(q); return `${n2(b.score)}/${n2(b.full)} (${bn(Math.round(pct(b)))}%)`; };
    const cell = (q) => {
      const b = best(q);
      if (!b) return `<td class="n">—</td><td class="n">—</td><td class="n">—</td><td class="n">—</td><td class="n st">${q.state === "open" ? "চলছে" : "অংশ নেয়নি"}</td><td class="n">—</td>`;
      return `<td class="n">${bn(q.count || b.correct + b.wrong + b.skipped)}</td><td class="n">${bn(b.correct)}</td><td class="n">${bn(b.wrong)}</td><td class="n">${bn(b.skipped)}</td>
        <td class="n"><b>${n2(b.score)}/${n2(b.full)}</b>${q.myAttempts.length > 1 ? ` <small class="ty">${bn(q.myAttempts.length)} বারের সেরা</small>` : ""}</td><td class="n">${q.rank ? `${bn(q.rank)}/${bn(q.of)}` : "—"}</td>`;
    };
    const fb = avg === null ? "কুইজে অংশ নিলে এখানে মন্তব্য দেখাবে।" : [avg >= 80 ? "অনলাইন কুইজে ফল খুব ভালো।" : avg >= 60 ? "অনলাইন কুইজে ফল ভালো, আরও উন্নতির সুযোগ আছে।" : avg >= 40 ? "অনলাইন কুইজে ফল মোটামুটি — নিয়মিত অনুশীলন দরকার।" : "অনলাইন কুইজে বিশেষ মনোযোগ দরকার।",
      missed ? `${bn(missed)}টি কুইজে অংশ নেয়নি — সব কুইজে অংশ নেওয়া দরকার।` : "", done.some((q) => q.negative && best(q).wrong) ? "নেগেটিভ মার্কিংয়ের কুইজে না জেনে উত্তর দেওয়া কমাতে হবে।" : ""].filter(Boolean).join(" ");
    openCard("অনলাইন কুইজ রিপোর্ট কার্ড", `<table><thead><tr><th class="c">নং</th><th>তারিখ</th><th>কুইজ</th><th>বিষয় / অধ্যায়</th><th class="n">প্রশ্ন</th><th class="n">সঠিক</th><th class="n">ভুল</th><th class="n">বাদ</th><th class="n">নম্বর</th><th class="n">Rank</th></tr></thead><tbody>
${list.map((q, i) => `<tr><td class="c">${bn(i + 1)}</td><td>${bn(dd(q.opensAt))}</td><td>${esc(q.title)}<small class="ty">${bn(q.duration)} মিনিট${q.negative ? ` · নেগেটিভ −${n2(q.negValue)}` : ""}</small></td><td class="sy">${esc([q.subject, q.chapter].filter(Boolean).join(" — ") || "—")}</td>${cell(q)}</tr>`).join("") || '<tr><td colspan="10" style="text-align:center">এখনো কোনো কুইজ নেই</td></tr>'}
<tr class="ov"><td colspan="8">সার্বিক · ${bn(done.length)}টি কুইজে অংশ নিয়েছে${missed ? ` · ${bn(missed)}টিতে নেয়নি` : ""}</td><td class="n">গড় ${P(avg)}</td><td class="n">সেরা: ${rkHi ? bn(rkHi.rank) : "—"}</td></tr></tbody></table>
<div class="bx"><h3>কুইজের সারাংশ</h3><div class="g"><div><span>Total Quiz</span><b>${bn(done.length)} <small>(মোট ${bn(list.filter((q) => q.state === "closed" || best(q)).length)}টির মধ্যে)</small></b></div><div><span>Average Mark</span><b>${P(avg)}</b></div>
  <div><span>Highest Marks</span><b>${hi ? `${sc(hi)} · ${esc(hi.title)}` : "—"}</b></div><div><span>Lowest Marks</span><b>${lo ? `${sc(lo)} · ${esc(lo.title)}` : "—"}</b></div>
  <div><span>Highest Rank</span><b>${rkHi ? `${bn(rkHi.rank)}/${bn(rkHi.of)} · ${esc(rkHi.title)}` : "—"}</b></div><div><span>Lowest Rank</span><b>${rkLo ? `${bn(rkLo.rank)}/${bn(rkLo.of)} · ${esc(rkLo.title)}` : "—"}</b></div></div></div>`, fb);
  }
  const ddmy = (d) => (d ? bn(`${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`) : "—");
  const pc1 = (x) => (x === null ? "—" : bn(String(Math.round(x * 10) / 10)) + "%");
  // 🖨 বাড়ির কাজ ও পড়ার রিপোর্ট — প্রতিটা কাজ, জমার তারিখ আর অবস্থা; করেছে / পেরেছে-র হার
  function printHwCard() {
    const t = U.today(), list = (D.homework || []).slice().sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
    const K = { homework: ["বাড়ির কাজ", "করেছে", "করেনি"], lesson: ["পড়া", "পেরেছে", "পারেনি"] };
    const of = (k) => { const l = list.filter((h) => h.kind === k), d = l.filter((h) => h.status === "done").length, n = l.filter((h) => h.status === "not").length; return { all: l.length, d, n, ab: l.filter((h) => h.status === "absent").length, r: d + n ? (d / (d + n)) * 100 : null }; };
    const H = of("homework"), L = of("lesson");
    const st = (h) => (h.status === "done" ? `<b style="color:#187460">✓ ${K[h.kind][1]}</b>` : h.status === "not" ? `<b style="color:#b42318">✗ ${K[h.kind][2]}</b>` : h.status === "absent" ? "অনুপস্থিত" : h.dueDate && h.dueDate >= t ? "সামনে" : "যাচাই হয়নি");
    const ov = H.d + L.d + H.n + L.n ? ((H.d + L.d) / (H.d + L.d + H.n + L.n)) * 100 : null;
    const fb = ov === null ? "বাড়ির কাজ / পড়া যাচাই হলে এখানে মন্তব্য দেখাবে।" : [ov >= 80 ? "বাড়ির কাজ ও পড়ায় খুব নিয়মিত।" : ov >= 60 ? "বাড়ির কাজ ও পড়া মোটামুটি নিয়মিত — আরও মনোযোগ দরকার।" : "বাড়ির কাজ ও পড়ায় অনিয়মিত — বাসায় নিয়মিত তদারকি দরকার।",
      H.n ? `${bn(H.n)}টি বাড়ির কাজ করেনি।` : "", L.n ? `${bn(L.n)} দিন পড়া পারেনি।` : ""].filter(Boolean).join(" ");
    openCard("বাড়ির কাজ ও পড়ার রিপোর্ট", `<table><thead><tr><th class="c">নং</th><th>জমার তারিখ</th><th>ধরন</th><th>কাজ</th><th>বিষয় / অধ্যায়</th><th class="n">অবস্থা</th></tr></thead><tbody>
${list.map((h, i) => `<tr><td class="c">${bn(i + 1)}</td><td>${ddmy(h.dueDate)}</td><td>${K[h.kind] ? K[h.kind][0] : "—"}</td><td>${esc(h.title)}${h.details ? `<small class="ty">${esc(h.details)}</small>` : ""}</td><td class="sy">${esc([h.subject, h.chapter].filter(Boolean).join(" — ") || "—")}</td><td class="n">${st(h)}</td></tr>`).join("") || '<tr><td colspan="6" style="text-align:center">এখনো কোনো বাড়ির কাজ / পড়া নেই</td></tr>'}
<tr class="ov"><td colspan="5">সার্বিক · ${bn(H.d + L.d)}টি সম্পন্ন · ${bn(H.n + L.n)}টি অসম্পন্ন</td><td class="n">${pc1(ov)}</td></tr></tbody></table>
<div class="bx"><h3>সারাংশ</h3><div class="g"><div><span>মোট বাড়ির কাজ</span><b>${bn(H.all)}</b></div><div><span>মোট পড়া</span><b>${bn(L.all)}</b></div>
  <div><span>বাড়ির কাজ করেছে / করেনি</span><b>${bn(H.d)} / ${bn(H.n)} (${pc1(H.r)})</b></div><div><span>পড়া পেরেছে / পারেনি</span><b>${bn(L.d)} / ${bn(L.n)} (${pc1(L.r)})</b></div>
  <div><span>অনুপস্থিত থাকায় যাচাই হয়নি</span><b>${bn(H.ab + L.ab)}</b></div><div><span>সামনের কাজ</span><b>${bn(list.filter((h) => !h.dueDate || h.dueDate >= t).length)}</b></div></div></div>`, fb);
  }
  // 🖨 হাজিরার রিপোর্ট — মাসভিত্তিক উপস্থিত / অনুপস্থিত / ছুটি আর হার, অনুপস্থিত দিনগুলোর তালিকা
  function printAttCard() {
    const att = (D.attendance || []).slice().sort((a, b) => a.date.localeCompare(b.date)), months = [...new Set(att.map((a) => a.date.slice(0, 7)))];
    const cnt = (l, s) => l.filter((a) => a.status === s).length, rate = (p, a) => (p + a ? (p / (p + a)) * 100 : null);
    const M = months.map((m) => { const l = att.filter((a) => a.date.startsWith(m)), p = cnt(l, "P"), a = cnt(l, "A"); return { m, p, a, lv: cnt(l, "L"), r: rate(p, a) }; });
    const P = cnt(att, "P"), A = cnt(att, "A"), LV = cnt(att, "L"), R = rate(P, A), rated = M.filter((x) => x.r !== null), bestM = rated.slice().sort((a, b) => b.r - a.r)[0], worstM = rated.slice().sort((a, b) => a.r - b.r)[0];
    const abs = att.filter((a) => a.status === "A").map((a) => ddmy(a.date));
    const fb = R === null ? "হাজিরা নেওয়া হলে এখানে মন্তব্য দেখাবে।" : R >= 90 ? "ক্লাসে খুব নিয়মিত — চমৎকার।" : R >= 75 ? "উপস্থিতি ভালো, তবে আরও নিয়মিত হওয়া দরকার।" : "উপস্থিতি ৭৫%-এর নিচে — নিয়মিত ক্লাসে আসা জরুরি।";
    openCard("হাজিরার রিপোর্ট", `<table><thead><tr><th class="c">নং</th><th>মাস</th><th class="n">মোট ক্লাস</th><th class="n">উপস্থিত</th><th class="n">অনুপস্থিত</th><th class="n">ছুটি</th><th class="n">উপস্থিতির হার</th></tr></thead><tbody>
${M.map((x, i) => `<tr><td class="c">${bn(i + 1)}</td><td>${U.month(x.m)}</td><td class="n">${bn(x.p + x.a + x.lv)}</td><td class="n">${bn(x.p)}</td><td class="n${x.a ? " fl" : ""}">${x.a ? `<b>${bn(x.a)}</b>` : bn(0)}</td><td class="n">${bn(x.lv)}</td><td class="n"><b>${pc1(x.r)}</b></td></tr>`).join("") || '<tr><td colspan="7" style="text-align:center">এখনো কোনো হাজিরা নেই</td></tr>'}
<tr class="ov"><td colspan="2">সার্বিক</td><td class="n">${bn(P + A + LV)}</td><td class="n">${bn(P)}</td><td class="n">${bn(A)}</td><td class="n">${bn(LV)}</td><td class="n">${pc1(R)}</td></tr></tbody></table>
<div class="bx"><h3>সারাংশ <small style="font-weight:400;opacity:.8">(হার = উপস্থিত ÷ (উপস্থিত + অনুপস্থিত), ছুটি বাদে)</small></h3><div class="g"><div><span>Total Class</span><b>${bn(P + A + LV)}</b></div><div><span>Attendance</span><b>${pc1(R)}</b></div>
  <div><span>Present / Absent</span><b>${bn(P)} / ${bn(A)}</b></div><div><span>Leave</span><b>${bn(LV)}</b></div>
  <div><span>সবচেয়ে ভালো মাস</span><b>${bestM ? `${U.month(bestM.m)} (${pc1(bestM.r)})` : "—"}</b></div><div><span>সবচেয়ে কম উপস্থিতি</span><b>${worstM ? `${U.month(worstM.m)} (${pc1(worstM.r)})` : "—"}</b></div></div></div>
<div class="bx"><h3>অনুপস্থিত দিনগুলো (${bn(abs.length)})</h3><p style="margin:0;padding:1.8mm 2mm;font-size:11.5px;line-height:1.7">${abs.join(", ") || "কোনো অনুপস্থিতি নেই"}</p></div>`, fb);
  }
  // 🖨 ফি ও পেমেন্টের রিপোর্ট — মডিউলভিত্তিক ফি, পেমেন্টের ইতিহাস আর বকেয়া
  function printFeeCard() {
    const f = D.fees, pays = (D.payments || []).slice().sort((a, b) => (a.date || "").localeCompare(b.date || "")), last = pays[pays.length - 1];
    const fb = f.balance > 0 ? `${money(f.balance)} বকেয়া আছে — দ্রুত পরিশোধ করার অনুরোধ রইল।` : f.balance < 0 ? `${money(-f.balance)} অগ্রিম জমা আছে।` : "এখন পর্যন্ত সব ফি পরিশোধিত — ধন্যবাদ।";
    openCard("ফি ও পেমেন্টের রিপোর্ট", `<h4 class="sh">মডিউল ও ফি</h4><table><thead><tr><th class="c">নং</th><th>মডিউল</th><th>শুরু</th><th class="n">ফি</th><th class="n">ছাড়</th><th class="n">এখন পর্যন্ত</th></tr></thead><tbody>
${f.items.map((i, k) => `<tr><td class="c">${bn(k + 1)}</td><td>${esc(i.course)}${i.status === "ended" ? " (শেষ)" : ""}${i.chapters.length ? `<small class="ty">অধ্যায় ${esc(i.chapters.join(", "))}</small>` : ""}</td><td>${ddmy(i.startDate)}</td><td class="n">${money(i.fee)}${i.monthly ? "/মাস" : ""}</td><td class="n">${i.discount ? money(i.discount) : "—"}</td><td class="n"><b>${money(i.due)}</b>${i.monthly ? `<small class="ty">${bn(i.months)} মাস${(i.adjust || []).filter((a) => a.paused).length ? ` · ⏸ ${bn(i.adjust.filter((a) => a.paused).length)} মাস বন্ধ` : ""}</small>` : ""}</td></tr>`).join("") || '<tr><td colspan="6" style="text-align:center">কোনো মডিউল নেই</td></tr>'}
<tr class="ov"><td colspan="5">মোট ফি (এখন পর্যন্ত)</td><td class="n">${money(f.totalDue)}</td></tr></tbody></table>
<h4 class="sh">পেমেন্টের ইতিহাস</h4><table><thead><tr><th class="c">নং</th><th>রসিদ</th><th>তারিখ</th><th>মাস</th><th>মাধ্যম</th><th class="n">টাকা</th></tr></thead><tbody>
${pays.map((p, k) => `<tr><td class="c">${bn(k + 1)}</td><td>#${bn(p.receiptNo)}</td><td>${ddmy(p.date)}</td><td>${p.month ? U.month(p.month) : "—"}</td><td>${esc(p.method || "—")}</td><td class="n"><b>${money(p.amount)}</b></td></tr>`).join("") || '<tr><td colspan="6" style="text-align:center">কোনো পেমেন্ট নেই</td></tr>'}
<tr class="ov"><td colspan="5">মোট পরিশোধ</td><td class="n">${money(f.paid)}</td></tr></tbody></table>
<div class="bx"><h3>সারাংশ</h3><div class="g"><div><span>মোট ফি</span><b>${money(f.totalDue)}</b></div><div><span>পরিশোধ</span><b>${money(f.paid)}</b></div>
  <div><span>${f.balance >= 0 ? "বকেয়া" : "অগ্রিম"}</span><b style="color:${f.balance > 0 ? "#b42318" : "#187460"}">${money(Math.abs(f.balance))}</b></div><div><span>শেষ পেমেন্ট</span><b>${last ? `${money(last.amount)} · ${ddmy(last.date)}` : "—"}</b></div></div></div>`, fb);
  }
  // রিপোর্ট কার্ডের A4 কাঠামো (সব রিপোর্টে একই): মাথার নকশা, শিক্ষার্থীর তথ্য, মাঝের অংশ, মন্তব্য, একদম নিচে স্বাক্ষর
  function openCard(h1, inner, fb) {
    const s = D.profile, site = D.site || {}, O = location.origin, now = new Date(), p2 = (x) => String(x).padStart(2, "0");
    const html = `<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>${esc(s.name)} - ${esc(s.id)} - ${h1}</title>${U.DOC_FONTS || ""}
<style>${U.DOC_CSS || ""}*{box-sizing:border-box}@page{size:A4;margin:8mm}body{margin:0;background:#e9eef0;font-family:'BnNum','Hind Siliguri','Nirmala UI',sans-serif;color:#1d2b28}
.pb{position:sticky;top:0;z-index:5;background:#0b3b36;padding:10px;text-align:center}.pb button{font:700 14px 'Hind Siliguri',sans-serif;background:#f3c55d;border:0;border-radius:999px;padding:8px 22px;cursor:pointer;margin:0 4px}
.a4{width:194mm;min-height:280mm;margin:14px auto;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.12);overflow:hidden;padding-bottom:6mm;display:flex;flex-direction:column}
.hd{position:relative;height:46mm}.sw{position:absolute;inset:0;width:100%;height:100%}
.lc{position:absolute;left:8mm;top:5mm;width:36mm;height:36mm;border-radius:50%;background:#fff;border:1.5mm solid #1f7a62;box-shadow:0 6px 18px rgba(0,0,0,.18);display:grid;place-items:center}.lc img{width:27mm}
.tt{position:absolute;left:51mm;top:8mm;right:8mm}.tt h1{margin:0;font:900 27px 'Noto Serif Bengali','Nirmala UI',serif;color:#fff}.tt p{margin:1mm 0 0;color:#f3c55d;font-weight:600;font-size:13px}
.inf{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:1.5mm 5mm;margin:1mm 8mm 4mm;font-size:12.5px}.inf span{border-bottom:1px dotted #9aa8a3;padding:.8mm 0}.inf b{color:#0b3b36}
table{border-collapse:collapse;width:calc(100% - 16mm);margin:0 8mm;font-size:11.5px}th{background:#2f3e46;color:#fff;text-align:left;padding:1.8mm 2mm;font-weight:600}td{border:1px solid #c9d3cf;padding:1.5mm 2mm}
.n{text-align:right}.c{text-align:center;width:7mm}td small.ty{display:block;color:#6c7a75;font-size:10px}td.sy{font-size:10.5px;color:#33433f;max-width:42mm}td.st{color:#6c7a75;font-size:10.5px}td.fl b{color:#b42318}td.fl small{color:#b42318;font-size:9.5px}tr:nth-child(even) td{background:#f6f9f8}tr.ov td{background:#e3efe9!important;font-weight:700}
.sh{margin:4mm 8mm 1.5mm;font-size:12.5px;color:#0b3b36}.bx{margin:4mm 8mm 0;border:1px solid #c9d3cf}.bx h3{margin:0;background:#2f3e46;color:#fff;font-size:12.5px;padding:1.6mm 2mm;font-weight:600}
.g{display:grid;grid-template-columns:1fr 1fr}.g div{display:flex;justify-content:space-between;padding:1.6mm 2mm;border-top:1px solid #c9d3cf;font-size:11.5px}.g div:nth-child(odd){border-right:1px solid #c9d3cf}
.tail{flex:1;display:flex;flex-direction:column;break-inside:avoid;page-break-inside:avoid}.fb{flex:1;display:flex;flex-direction:column;margin:4mm 8mm 0;font-size:12px}.fb b{color:#0b3b36}.fb p{margin:1mm 0 0}.fb .lines{flex:1;min-height:14mm}
.sg{display:grid;grid-template-columns:repeat(3,1fr);gap:8mm;margin:12mm 8mm 0;text-align:center;font-weight:600;font-size:12px}.sg span{border-top:1.2px solid #1d2b28;padding-top:1.4mm}
.ft{display:flex;justify-content:space-between;margin:5mm 8mm 0;padding-top:2mm;border-top:1px dashed #c9d3cf;font-size:10.5px;color:#6c7a75}
thead{display:table-header-group}tr,.bx,.sh{break-inside:avoid;page-break-inside:avoid}.sh{break-after:avoid;page-break-after:avoid}
@page{@bottom-right{content:"পৃষ্ঠা " counter(page) " / " counter(pages);font:9px sans-serif;color:#6c7a75}}
@media print{body{background:#fff}.pb{display:none}.a4{margin:0;box-shadow:none;width:auto;min-height:280mm;overflow:visible}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
<div class="pb"><button onclick="print()">🖨 প্রিন্ট / PDF</button><button onclick="close()" style="background:rgba(255,255,255,.18);color:#fff">✕ বন্ধ করুন</button></div>
<main class="a4"><div class="hd"><svg class="sw" viewBox="0 0 794 190" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0H794V112C620 96 430 132 260 150C160 160 70 156 0 146Z" fill="#0b3b36"/><path d="M0 146C70 156 160 160 260 150C430 132 620 96 794 112V126C620 112 430 148 262 166C160 176 70 172 0 162Z" fill="#d9a441"/></svg>
  <div class="lc"><img src="${O}/images/logo-receipt.png" alt=""></div><div class="tt"><h1>${h1}</h1><p>শাহিন'স আইসিটি কেয়ার · ${esc(site.address || "মাস্টার কলোনি, মাদারীপুর")}</p></div></div>
<div class="inf"><span>নাম: <b>${esc(s.name)}</b></span><span>আইডি: <b>${esc(s.id)}</b></span><span>তারিখ: <b>${bn(p2(now.getDate()))}-${bn(p2(now.getMonth() + 1))}-${bn(now.getFullYear())}</b></span>
  <span>মডিউল: <b>${esc((D.courses || []).join(", ") || "—")}</b></span><span>সেশন: <b>${esc(s.session || "—")}</b></span><span>ব্যাচ: <b>${esc((D.batch || {}).name || "—")}</b></span></div>
${inner}
<div class="tail">${fb === null ? "" : `<div class="fb"><b>শিক্ষকের মন্তব্য:</b><p>${esc(fb)}</p><div class="lines"></div></div>
<div class="sg"><span>শিক্ষকের স্বাক্ষর</span>${U.sig("কর্তৃপক্ষের স্বাক্ষর")}<span>অভিভাবকের স্বাক্ষর</span></div>`}
<div class="ft"><span>শাহিন'স আইসিটি কেয়ার · ${esc(site.address || "")}</span><span>${esc(site.phone || "")}</span></div></div></main></body></html>`;
    const w = window.open("", "_blank"); if (!w) return alert("পপ-আপ বন্ধ আছে — ব্রাউজারে পপ-আপের অনুমতি দিন");
    w.document.write(html); w.document.close();
  }
  const docLink = (d) => `<a class="chip" href="${esc(d.url || `/api/student/docs/${encodeURIComponent(d.id)}/file${Q}`)}" target="_blank" rel="noopener">${{ question: "📝 প্রশ্ন", answer: "✅ উত্তরপত্র", script: "📒 আমার খাতা" }[d.category] || "📎"}: ${esc(d.title)}</a>`;

  // অ্যাডমিন ভিউ: শিক্ষার্থী, অভিভাবক, বাবা, মা — সবার নাম ও নম্বর, পাশে কল / SMS / WhatsApp
  function contactCard() {
    const p = D.profile, wa = (n) => "88" + String(n).replace(/\D/g, "").replace(/^88/, "");
    const rows = [["🎓", "শিক্ষার্থী", p.name, p.phone], ["👪", "অভিভাবক" + (p.guardianRelation ? ` (${p.guardianRelation})` : ""), p.guardianName, p.guardianPhone], ["👨", "বাবা", p.fatherName, p.fatherPhone], ["👩", "মা", p.motherName, p.motherPhone]]; // চারজনই সবসময় — নম্বর না থাকলে "নম্বর দেওয়া নেই"
    if (p.phone2) rows.splice(1, 0, ["📱", "শিক্ষার্থীর ২য় নম্বর", p.name, p.phone2]);
    return `<div class="card ct-card"><h2>📞 যোগাযোগ</h2><div class="ct-grid">${rows.map(([ic, who, nm, ph]) => `<div class="ct-row"><span class="ct-ic">${ic}</span><div class="ct-who"><small>${who}</small><b>${esc(nm || "—")}</b><a class="ct-num" href="${ph ? "tel:" + esc(ph) : "#"}">${ph ? esc(ph) : "নম্বর দেওয়া নেই"}</a></div>
      ${ph ? `<div class="ct-acts"><a class="c-call" href="tel:${esc(ph)}" title="কল করুন">📞 কল</a><a class="c-sms" href="sms:${esc(ph)}" title="SMS পাঠান">✉ SMS</a><a class="c-wa" href="https://wa.me/${wa(ph)}" target="_blank" rel="noopener" title="WhatsApp-এ খুলুন">🟢 WhatsApp</a></div>` : ""}</div>`).join("")}</div>
      ${p.address ? `<p class="ct-addr">📍 ঠিকানা: ${esc(p.address)}</p>` : ""}</div>`;
  }
  // ⭐ রেটিং কার্ড: ১-৫ তারা আর ছোট মতামত; আগে দিয়ে থাকলে সেটাই দেখায়, চাইলে বদলানো যায় (অ্যাডমিন ভিউতে শুধু দেখা)
  const RATE_WORDS = ["", "ভালো লাগেনি", "মোটামুটি", "ভালো", "খুব ভালো", "অসাধারণ"];
  function rateCard() {
    const r = D.myRating, cur = (TABS._stars ?? r?.stars) || 0;
    if (AS) return `<div class="card rate-card"><h2>⭐ শিক্ষার্থীর রেটিং</h2>${r ? `<p class="rate-stars ro">${"★".repeat(r.stars)}${"☆".repeat(5 - r.stars)} <small>${RATE_WORDS[r.stars]}</small></p>${r.comment ? `<p>${esc(r.comment)}</p>` : ""}` : '<p class="empty">এখনো রেটিং দেয়নি</p>'}</div>`;
    return `<div class="card rate-card"><h2>⭐ ${r ? "তোমার রেটিং" : "আমাদের রেটিং দাও"}</h2>
      <p class="rate-sub">${r ? "চাইলে বদলাতে পারো — নতুনটা আগেরটার জায়গায় বসবে।" : "ক্লাস, পড়ানো আর পুরো ব্যবস্থা কেমন লাগছে? তোমার রেটিং ওয়েবসাইটে সবার গড় রেটিংয়ে যোগ হবে।"}</p>
      <form id="rateForm"><div class="rate-stars" role="radiogroup" aria-label="রেটিং">${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="${n === cur}" aria-label="${bn(n)} তারা" data-star="${n}" class="${n <= cur ? "on" : ""}">★</button>`).join("")}<small id="rateWord">${RATE_WORDS[cur] || "তারায় চাপ দাও"}</small></div>
        <textarea name="comment" class="field" rows="2" maxlength="300" placeholder="কিছু বলতে চাইলে লেখো (না লিখলেও চলবে)">${esc((TABS._comment ?? r?.comment) || "")}</textarea>
        <p class="rate-msg" id="rateMsg"></p><button class="btn gold">${r ? "রেটিং বদলাও" : "রেটিং জমা দাও"}</button></form></div>`;
  }
  let classMomentTimer;
  function classMomentsCard() {
    const photos = D.classMoments || [];
    return `<section class="card class-moments" id="classMoments"><h2>ক্লাসের ক্যানভাস</h2>
      ${photos.length ? `<figure><div class="class-moments-stage"><img class="class-moments-photo" alt=""></div><figcaption></figcaption></figure>
        ${photos.length > 1 ? `<div class="class-moments-track" role="group" aria-label="ছবি বেছে নাও">${photos.map((_, i) => `<button type="button" data-slide="${i}" aria-label="ছবি ${bn(i + 1)}"></button>`).join("")}</div>` : ""}`
        : '<p class="empty">ক্লাসের ছবি যোগ হলে এখানে দেখা যাবে।</p>'}</section>`;
  }
  function bindClassMoments() {
    clearInterval(classMomentTimer);
    const card = $("#classMoments"), photos = D.classMoments || [];
    if (!card || !photos.length) return;
    const img = $(".class-moments-photo", card), caption = $("figcaption", card);
    const slides = $$("[data-slide]", card);
    let index = 0;
    function showPhoto(next) {
      index = next % photos.length;
      const photo = photos[index];
      img.alt = photo.title || "ক্লাসের ছবি";
      img.src = photo.img;
      caption.textContent = [photo.title, photo.date && U.date(photo.date)].filter(Boolean).join(" · ");
      caption.hidden = !caption.textContent;
      slides.forEach((slide, i) => slide.setAttribute("aria-current", i === index ? "true" : "false"));
    }
    showPhoto(0);
    function updateRotation() {
      clearInterval(classMomentTimer);
      if (slides.length && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        classMomentTimer = setInterval(() => {
          if (!document.hidden && !card.matches(":hover, :focus-within")) showPhoto(index + 1);
        }, 5000);
      }
    }
    slides.forEach((button) => {
      button.onclick = () => { showPhoto(Number(button.dataset.slide)); updateRotation(); };
    });
    updateRotation();
  }
  function bindRate() {
    const f = $("#rateForm"); if (!f) return;
    f.onclick = (e) => { const b = e.target.closest("[data-star]"); if (!b) return; TABS._stars = Number(b.dataset.star); TABS._comment = f.comment.value; show("home"); };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const stars = (TABS._stars ?? D.myRating?.stars) || 0;
      if (!stars) { $("#rateMsg").textContent = "আগে তারায় চাপ দিয়ে রেটিং বেছে নাও"; return; }
      try {
        const res = await api("/api/student/rating", { body: { stars, comment: f.comment.value.trim() } });
        D.myRating = res.rating; delete TABS._stars; delete TABS._comment;
        show("home"); $("#rateMsg").textContent = "ধন্যবাদ! তোমার রেটিং জমা হয়েছে ✓"; $("#rateMsg").classList.add("ok");
      } catch (er) { $("#rateMsg").textContent = er.message; }
    };
  }
  // অ্যাডমিন ভিউ: "মূল্যায়ন প্রতিবেদন" ট্যাব — প্রতিবেদন অ্যাডমিন পাতা তৈরি করে পাঠায়, এখানে পাতার ভেতরেই দেখায়
  addEventListener("message", (e) => {
    if (e.origin !== location.origin || !e.data || typeof e.data.sicEvalHtml !== "string") return;
    const fr = $("#evFrame"); if (!fr) return;
    if (!e.data.sicEvalHtml) { fr.replaceWith(Object.assign(document.createElement("p"), { className: "empty", textContent: "প্রতিবেদন তৈরি করা যায়নি" })); return; }
    fr.onload = () => { const d = fr.contentDocument; if (!d) return; const fit = () => (fr.style.height = Math.ceil(d.documentElement.scrollHeight) + 2 + "px"); fit(); setTimeout(fit, 400); setTimeout(fit, 1200); };
    fr.srcdoc = e.data.sicEvalHtml.replace("</head>", "<style>html{overflow:hidden}body{background:transparent!important;font-size:13.5px}.pb,.hd,.hero,.sg,.ft{display:none!important}.pg{width:auto!important;max-width:none!important;margin:0!important;padding:0!important;box-shadow:none!important;background:transparent!important;gap:16px!important}.bx,.sm{background-color:#fff}.bx,.sm{border-radius:16px!important;box-shadow:0 8px 24px rgba(30,58,138,.07)}.hero{border-radius:18px!important;padding:18px 22px!important}.t{border-radius:14px!important;padding:10px 12px!important}.t b{font-size:21px!important}.t small{font-size:11.5px!important}.ts,.row,.r2{gap:14px!important}.bx h3{font-size:16px!important}</style></head>");
  });
  const pBtn = (k, l) => `<p style="text-align:right;margin:0 0 12px"><button type="button" class="btn gold sm" data-pcard="${k}">🖨 ${l} প্রিন্ট</button></p>`;
  // পরীক্ষার রুটিন: তারিখ দেওয়া সব পরীক্ষা
  const ATTEMPT = ["১ম বার", "২য় বার", "৩য় বার"];
  const dayName = (d) => new Date(d + "T00:00").toLocaleDateString("bn-BD", { weekday: "long" });
  const examName = (x) => { const ty = window.ExamCalc.typeName(x.type); return `${x.title.startsWith(ty) ? "" : ty + " — "}${x.title}${x.attempt >= 0 ? " (" + ATTEMPT[x.attempt] + ")" : ""}`; };
  const nextExamsCard = () => {
    const t = U.today(), l = (D.schedule || []).filter((x) => x.date >= t).slice(0, 3);
    return l.length ? `<div class="card"><h2>সামনের পরীক্ষা</h2><ul class="list" style="margin-top:12px">${l.map((x) => `<li><b>${esc(examName(x))}</b><p>${x.date === t ? "আজ · " : ""}${U.date(x.date)} (${dayName(x.date)})${x.time ? " · " + esc(x.time) : ""} · পূর্ণমান ${bn(x.full)}</p></li>`).join("")}</ul><p style="margin:12px 0 0"><button type="button" class="btn sm line" data-go-routine>পুরো রুটিন দেখুন</button></p></div>` : "";
  };
  const routineList = () => (D.schedule || []).filter((x) => !TABS._rt || x.type === TABS._rt);
  function printRoutine() {
    const l = routineList();
    openCard("পরীক্ষার রুটিন", `<table><thead><tr><th class="c">নং</th><th>তারিখ</th><th>দিন</th><th>পরীক্ষা</th><th>সময়</th><th class="n">পূর্ণমান</th><th>সিলেবাস</th></tr></thead><tbody>${l.map((x, i) => `<tr><td class="c">${bn(i + 1)}</td><td>${U.date(x.date)}</td><td>${dayName(x.date)}</td><td>${esc(examName(x))}</td><td>${esc(x.time || "—")}</td><td class="n">${bn(x.full)}</td><td class="sy">${esc(x.chapter || x.syllabus || "—")}</td></tr>`).join("")}</tbody></table>`, null);
  }
  const TABS = {
    routine() {
      const EC = window.ExamCalc, t = U.today(), all = D.schedule || [], pdfs = D.examRoutines || [];
      const types = EC.TYPES.filter(([k]) => all.some((x) => x.type === k));
      if (!types.some(([k]) => k === TABS._rt)) TABS._rt = "";
      const l = routineList(), up = l.filter((x) => x.date >= t), past = l.filter((x) => x.date < t).reverse();
      const url = (r, dl) => { const q = new URLSearchParams(Q.replace(/^\?/, "")); if (dl) q.set("download", "1"); q.set("v", r.pdf.v); return `/api/student/routine/${encodeURIComponent(r.id)}/pdf?${q}`; };
      const row = (x) => `<li><b>${x.date === t ? "📌 আজ — " : ""}${esc(examName(x))}</b><p>${U.date(x.date)} (${dayName(x.date)})${x.time ? " · " + esc(x.time) : ""} · পূর্ণমান ${bn(x.full)}${x.chapter ? " · " + esc(x.chapter) : ""}</p>${x.syllabus ? `<p>সিলেবাস: ${esc(x.syllabus)}</p>` : ""}</li>`;
      return `${pdfs.length ? `<div class="card"><h2>📄 রুটিন PDF</h2><ul class="list" style="margin-top:12px">${pdfs.map((r) => `<li><b>${esc(r.title)}</b><p>${r.type ? esc(EC.typeName(r.type)) + " · " : ""}${U.date(String(r.createdAt).slice(0, 10))}</p><p><a class="btn sm gold" href="${url(r)}" target="_blank" rel="noopener">খুলে দেখুন</a> <a class="btn sm line" href="${url(r, true)}" download>ডাউনলোড</a></p></li>`).join("")}</ul></div>` : ""}
        <div class="card"><div class="rx-bar"><b>ধরন:</b>${[["", "সব"], ...types].map(([k, n]) => `<button type="button" class="rx-chip${k === TABS._rt ? " on" : ""}" data-rt="${k}">${esc(n)} <i>${bn(all.filter((x) => !k || x.type === k).length)}</i></button>`).join("")}${l.length ? '<button type="button" class="btn gold sm rx-print" data-rt-print>🖨 রুটিন প্রিন্ট / PDF</button>' : ""}</div>
          <h2 style="margin-top:14px">সামনের পরীক্ষা</h2>${up.length ? `<ul class="list" style="margin-top:12px">${up.map(row).join("")}</ul>` : '<p class="empty">সামনে কোনো পরীক্ষার তারিখ দেওয়া নেই</p>'}
          ${past.length ? `<h2 style="margin-top:18px">হয়ে যাওয়া পরীক্ষা</h2><ul class="list" style="margin-top:12px;opacity:.7">${past.map(row).join("")}</ul>` : ""}</div>`;
    },
    eval() {
      setTimeout(() => parent.postMessage({ sicAct: "evalhtml", id: AS }, location.origin), 0);
      return `<div class="ev-wrap"><div class="ev-acts"><h2>📊 শিক্ষার্থী মূল্যায়ন প্রতিবেদন</h2><button type="button" class="btn sm gold" data-as-eval>🖨 প্রিন্ট / PDF (A4)</button></div><iframe id="evFrame" title="মূল্যায়ন প্রতিবেদন" scrolling="no"></iframe></div>`;
    },
    home() {
      const lr = taken()[0], last = lr ? { marks: n2(lr.me.total), fullMarks: lr.full, title: lr.title, rank: lr.me.rank, of: lr.of } : null;
      const f = D.fees;
      return `${accessNotes()}
        <div class="tiles">
          <div class="tile">${ring(attPct(), "উপস্থিতি", "var(--ok)")}</div>
          <div class="tile">${ring(avgPct(), "পরীক্ষার গড়", "var(--gold2)")}</div>
          <div class="tile dark"><small>শেষ পরীক্ষা</small><b>${last ? last.marks + "/" + bn(last.fullMarks) : "—"}</b><small>${last ? esc(last.title) + (last.rank ? " · অবস্থান " + bn(last.rank) + "/" + bn(last.of) : " · ফেল") : "এখনো পরীক্ষা হয়নি"}</small></div>
          <div class="tile"><small>ফি</small><b>${f.balance > 0 ? money(f.balance) : "✓"}</b><small>${f.balance > 0 ? "বকেয়া আছে" : "সব পরিশোধিত"}</small></div>
        </div>
        ${(D.books?.balance || 0) > 0 ? `<section class="student-book-alert"><div><small>বই ও শিটের বকেয়া</small><strong>${money(D.books.balance)}</strong><span>বই ও শিটের হিসাব আলাদা করে দেখুন।</span></div><button type="button" class="btn line" data-go-books>হিসাব দেখুন →</button></section>` : ""}
        ${AS ? contactCard() : ""}
        ${nextExamsCard()}
        <div class="grid2">
          <div class="card"><h2>ক্লাসের সময়</h2>${D.batch ? `<dl class="kv" style="margin-top:12px"><dt>মডিউল</dt><dd>${esc(D.courses.join(", ") || "—")}</dd><dt>সেশন</dt><dd>${esc(D.batch.session)}</dd><dt>ক্লাস ব্যাচ</dt><dd>${esc(U.batchLabel(D.batch))}</dd><dt>দিন</dt><dd>${esc(D.batch.days)}</dd><dt>সময়</dt><dd>${esc(D.batch.time)}</dd></dl>` : "<p>ব্যাচ ঠিক করা হয়নি</p>"}
            ${(D.closures || []).map((c) => `<p class="chip ${c.from <= U.today() ? "bad" : "warn"}" style="margin-top:10px;white-space:normal">⏸ ${c.from <= U.today() ? "এখন বন্ধ" : "বন্ধ থাকবে"}: ${U.date(c.from)} – ${U.date(c.to)}${c.reason ? ` (${esc(c.reason)})` : ""}</p>`).join("")}</div>
          <div class="card"><h2>সাম্প্রতিক নোটিশ</h2>${D.notices.length ? `<ul class="list" style="margin-top:12px">${D.notices.slice(0, 3).map((n) => `<li><b>${n.important ? "📌 " : ""}${esc(n.title)}</b><p>${esc(n.body)}</p>${n.pdf ? `<p><a class="btn sm line" href="/api/notice/${n.id}/pdf?download=1&v=${n.pdf.v}" download>📄 ${esc(n.pdf.name)} — ডাউনলোড</a></p>` : ""}</li>`).join("")}</ul>` : '<p class="empty">কোনো নোটিশ নেই</p>'}</div>
        </div>
        <div class="class-moments-row">${rateCard()}${classMomentsCard()}</div>`;
    },
    results() {
      if (!D.results.length) return '<div class="card"><p class="empty">এখনো কোনো পরীক্ষা নেই</p></div>';
      const EC = window.ExamCalc, t = U.today();
      const upcoming = D.results.filter((r) => r.date && r.date > t).reverse();
      const recent = taken().slice(0, 8).reverse();
      // প্রতিটা অংশের নম্বর: Chapter Final-এ প্রতিবারের নম্বর আর গড়
      const detail = (r) => {
        const ps = EC.parts(r), me = r.me;
        if (r.published === false) return '<span class="chip warn">⏳ ফলাফল এখনো প্রকাশ হয়নি</span>';
        if (me.absent) return '<span class="chip">অনুপস্থিত</span>';
        const att = r.attempts > 1 ? `<small>${r.myMarks.map((a, k) => (a && a._absent ? `${EC.ATTEMPT_NAMES[k]}: অনুপস্থিত` : a ? `${EC.ATTEMPT_NAMES[k]}: ${n2(ps.reduce((s, p) => s + (Number(a[p.key]) || 0), 0))}` : `${EC.ATTEMPT_NAMES[k]}: —`)).join(" · ")}</small>` : "";
        return `<small>${ps.map((p) => `${esc(p.subject)} ${p.part.toUpperCase()} <b${me.fails.includes(p.key) ? ' style="color:var(--bad)"' : ""}>${n2(me.scores[p.key])}</b>/${bn(p.full)}`).join(" · ")}${r.attempts > 1 ? " (গড়)" : ""}</small>${att}`;
      };
      // সারাংশ, ধরন বাছাই আর প্রতিটা পরীক্ষা আলাদা কার্ডে (আমার / গড় / সর্বোচ্চ তুলনা সহ)
      const shown = D.results.filter((r) => !r.date || r.date <= t || !r.me.absent);
      const done = shown.filter((r) => r.published !== false && !r.me.absent), main = done.filter((r) => !EC.EXTRA_TYPES.includes(r.type));
      const avgAll = main.length ? main.reduce((s, r) => s + r.me.percent, 0) / main.length : null;
      const ranks = done.filter((r) => r.me.rank).map((r) => r.me.rank), best = ranks.length ? Math.min(...ranks) : null;
      const absN = shown.filter((r) => r.published !== false && r.me.absent).length;
      const types = EC.TYPES.filter(([k]) => shown.some((r) => r.type === k)), sel = types.some(([k]) => k === TABS._rtype) ? TABS._rtype : "";
      const list = shown.filter((r) => !sel || r.type === sel);
      const ord = U.rankName;
      const cmpRow = (l, v, full, c) => `<div><span>${l}</span><i><u style="width:${full ? Math.max(2, Math.min(100, (v / full) * 100)) : 0}%;background:${c}"></u></i><b>${n2(v)}</b></div>`;
      const card = (r) => {
        const k = RT_C[r.type] || RT_C.weekly, me = r.me, head = `<div class="rx-top"><div><h4>${esc(r.title)}</h4><small><span class="rx-t">${esc(EC.typeName(r.type))}</span>${r.date ? U.date(r.date) : ""}${r.chapter ? " · " + esc(r.chapter) : ""}</small></div>`;
        const docs = r.docs.length ? `<div class="rx-docs">${r.docs.map(docLink).join("")}</div>` : "";
        if (r.published === false) return `<div class="rx" style="--k:${k}">${head}<span class="rx-res wait">⏳ প্রকাশ হয়নি</span></div><p class="rx-note">ফলাফল প্রকাশ হলে এখানে নম্বর, অবস্থান আর তুলনা দেখাবে।</p>${docs}</div>`;
        if (me.absent) return `<div class="rx" style="--k:${k}">${head}<span class="rx-res abs">অনুপস্থিত</span></div><p class="rx-note">এই পরীক্ষায় অংশ নেওয়া হয়নি।</p>${docs}</div>`;
        const p = Math.round(me.percent);
        return `<div class="rx" style="--k:${k}">${head}<span class="rx-res ${me.pass ? "ok" : "bad"}">${me.pass ? "✓ পাস" : "✗ ফেল"}</span></div>
          <div class="rx-mid"><div class="rx-ring" style="--p:${Math.max(0, Math.min(100, p))}"><span>${bn(p)}%</span></div>
            <div class="rx-score"><b>${n2(me.total)}</b><small> / ${bn(r.full)}</small><span class="rx-rank${me.pass ? "" : " bad"}">${me.pass ? (me.rank ? `${me.rank === 1 ? "🏆 " : ""}অবস্থান ${ord(me.rank)} · ${bn(r.of)} জনের মধ্যে` : "অবস্থান —") : "কোনো অংশে পাস নম্বর হয়নি"}</span></div></div>
          <div class="rx-cmp">${cmpRow("আমার", me.total, r.full, k)}${r.avg !== null && r.avg !== undefined ? cmpRow("ব্যাচের গড়", r.avg, r.full, "#94a3b8") : ""}${r.high !== null && r.high !== undefined ? cmpRow("সর্বোচ্চ", r.high, r.full, "#d9a441") : ""}</div>
          <div class="rx-parts">${detail(r)}</div>${docs}</div>`;
      };
      return `
        <div class="rx-sum"><div class="s1"><small>পরীক্ষা দিয়েছে</small><b>${bn(done.length)}/${bn(shown.filter((r) => r.published !== false).length)}</b></div>
          <div class="s2"><small>গড় নম্বর</small><b>${avgAll === null ? "—" : bn(String(Math.round(avgAll * 10) / 10)) + "%"}</b></div>
          <div class="s3"><small>সেরা অবস্থান</small><b>${best ? (best === 1 ? "🏆 " : "") + ord(best) : "—"}</b></div>
          <div class="s4"><small>পাস</small><b>${bn(done.filter((r) => r.me.pass).length)}টি</b></div>
          <div class="s5"><small>ফেল / অনুপস্থিত</small><b>${bn(done.filter((r) => !r.me.pass).length)} / ${bn(absN)}</b></div></div>
        <div class="card rx-wrap"><div class="rx-bar"><b>ধরন:</b>${[["", "সব"], ...types].map(([k2, t2]) => `<button type="button" class="rx-chip${k2 === sel ? " on" : ""}" data-rtype="${k2}">${k2 ? esc(t2) : t2} <i>${bn(shown.filter((r) => !k2 || r.type === k2).length)}</i></button>`).join("")}
            <button type="button" class="btn gold sm rx-print" data-rcard>🖨 রিপোর্ট কার্ড প্রিন্ট</button></div>
          <p class="rx-hint">পাস করতে প্রতিটা বিষয়ের CQ আর MCQ দুটোতেই আলাদাভাবে এক-তৃতীয়াংশ নম্বর লাগে। Chapter Final-এ যতবার পরীক্ষা দিয়েছ তার গড় ধরা হয়। জিকে ও বিশেষ পরীক্ষা মোট গড়ে ধরা হয় না।</p>
          <div class="rx-grid">${list.map(card).join("") || '<p class="empty">এই ধরনের কোনো পরীক্ষা নেই</p>'}</div></div>
        ${upcoming.length ? `<div class="card"><h2>সামনের পরীক্ষা</h2><ul class="list" style="margin-top:12px">${upcoming.map((r) => `<li><b>${esc(EC.typeName(r.type))} — ${esc(r.title)}</b><p>${U.date(r.date)}${r.time ? " · " + esc(r.time) : ""} · পূর্ণমান ${bn(r.full)}${r.chapter ? " · " + esc(r.chapter) : ""}</p>${r.docs.filter((d) => d.category === "question").map(docLink).join(" ")}</li>`).join("")}</ul></div>` : ""}
        ${recent.length ? `<div class="card"><h2>অগ্রগতি (%)</h2>
          <div class="bar-chart">${recent.map((r) => { const p = Math.round(r.me.percent); return `<div><b>${bn(p)}%</b><i style="height:${Math.max(4, p)}%"></i><small>${U.date(r.date).split(" ").slice(0, 2).join(" ")}</small></div>`; }).join("")}</div></div>` : ""}
`;
    },
    att() {
      const now = new Date();
      const months = [...new Set([now.toLocaleDateString("en-CA").slice(0, 7), ...D.attendance.map((a) => a.date.slice(0, 7))])].sort().reverse();
      const m = TABS._month || months[0];
      const [y, mo] = m.split("-").map(Number);
      const first = new Date(y, mo - 1, 1).getDay(), days = new Date(y, mo, 0).getDate();
      const map = Object.fromEntries(D.attendance.filter((a) => a.date.startsWith(m)).map((a) => [Number(a.date.slice(8)), a.status]));
      const cnt = (s) => Object.values(map).filter((v) => v === s).length;
      const todayStr = U.today();
      return `${pBtn("att", "হাজিরার রিপোর্ট")}<div class="card">
        <div class="card-head"><h2>হাজিরার ক্যালেন্ডার</h2><select class="field" id="mSel">${months.map((x) => `<option value="${x}"${x === m ? " selected" : ""}>${U.month(x)}</option>`).join("")}</select></div>
        <div class="toolbar"><span class="chip ok">উপস্থিত ${bn(cnt("P"))}</span><span class="chip bad">অনুপস্থিত ${bn(cnt("A"))}</span><span class="chip warn">ছুটি ${bn(cnt("L"))}</span></div>
        <div class="cal">${["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"].map((d) => `<div class="h">${d}</div>`).join("")}
          ${"<div></div>".repeat(first)}
          ${Array.from({ length: days }, (_, i) => { const d = i + 1, ds = `${m}-${String(d).padStart(2, "0")}`; return `<div class="d ${map[d] || ""}${ds === todayStr ? " today" : ""}" title="${map[d] ? STATUS[map[d]] : ""}">${bn(d)}</div>`; }).join("")}
        </div></div>`;
    },
    books() {
      const account = D.books || { total:0, paid:0, balance:0, items:[] };
      return `<div class="student-book-heading"><h2>আমার বই ও শিটের হিসাব</h2><p>আপনার নামে কেনা বই ও শিটের মূল্য, জমা ও বকেয়া।</p></div><div class="tiles"><div class="tile"><small>মোট মূল্য</small><b>${money(account.total)}</b></div><div class="tile"><small>জমা দিয়েছেন</small><b>${money(account.paid)}</b></div><div class="tile dark"><small>বই ও শিটের বকেয়া</small><b>${money(account.balance)}</b></div></div><div class="student-book-sales">${account.items.map(s=>`<article class="sf-module"><header><div><h3>রসিদ S${bn(s.saleNo)}</h3><p>${U.date(s.date)}</p></div><span class="sf-status${s.due ? ' book-unpaid' : ''}">${s.due ? 'বকেয়া আছে' : s.free ? 'বিনামূল্যে' : 'পরিশোধিত'}</span></header><div class="book-line-list">${s.lines.map(l=>`<div class="book-account-line"><div><b>${esc(l.title)}</b><small>${bn(l.qty)}টি × ${money(l.price)}</small></div><strong>${money(l.qty*l.price)}</strong></div>`).join('')}</div><div class="book-account-totals"><span>পণ্যের মূল্য <b>${money(s.subtotal)}</b></span>${s.discount ? `<span>ছাড় <b>− ${money(s.discount)}</b></span>` : ''}${s.delivery ? `<span>ডেলিভারি <b>${money(s.delivery)}</b></span>` : ''}<span>মোট <b>${money(s.total)}</b></span><span>জমা <b>${money(s.paid)}</b></span></div><footer><span>এই রসিদে বাকি</span><strong>${money(s.due)}</strong></footer>${s.payments.length ? `<details class="book-payment-history"><summary>জমার ইতিহাস (${bn(s.payments.length)})</summary>${s.payments.map(p=>`<div><span>${U.date(p.date)} · ${esc(p.method || '')}</span><b>${money(p.amount)}</b></div>`).join('')}</details>` : ''}</article>`).join('') || '<div class="card empty">আপনার নামে বই বা শিটের কোনো হিসাব নেই।</div>'}</div>`;
    },
    fees() {
      const f = D.fees;
      return `${pBtn("fee", "ফি-র রিপোর্ট")}<div class="tiles">
          <div class="tile"><small>মোট ফি (এখন পর্যন্ত)</small><b>${money(f.totalDue)}</b></div>
          <div class="tile"><small>পরিশোধ করেছেন</small><b>${money(f.paid)}</b></div>
          <div class="tile dark"><small>${f.balance >= 0 ? "বকেয়া" : "অগ্রিম"}</small><b>${money(Math.abs(f.balance))}</b></div>
        </div>
        <section class="student-module-fees"><h2>মডিউল অনুযায়ী বেতনের হিসাব</h2><p class="sf-intro">কোন মাসে কত ফি ধরা হয়েছে, নিচে আলাদা করে দেখুন।</p>${f.items.map(moduleFeeCard).join('') || '<p class="empty">কোনো মডিউল নেই</p>'}</section>
        <div class="card"><h2>পেমেন্টের ইতিহাস</h2><div class="tbl-wrap" style="margin-top:12px"><table><thead><tr><th>রসিদ</th><th>তারিখ</th><th>মাস</th><th>মাধ্যম</th><th class="num">টাকা</th></tr></thead><tbody>
          ${D.payments.map((p) => `<tr><td>#${bn(p.receiptNo)}</td><td>${U.date(p.date)}</td><td>${U.month(p.month)}</td><td>${esc(p.method)}</td><td class="num"><b>${money(p.amount)}</b></td></tr>`).join("") || '<tr><td colspan="5" class="empty">কোনো পেমেন্ট নেই</td></tr>'}
        </tbody></table></div></div>`;
    },
    // অনলাইন কুইজ: চলমান (শুরু করো), সামনে, আগে দেওয়া (নম্বর ও উত্তর)
    quiz() {
      const list = D.quizzes || [], n2 = (x) => bn(String(Math.round(x * 100) / 100));
      const open = list.filter((q) => q.state === "open"), up = list.filter((q) => q.state === "upcoming"), past = list.filter((q) => q.state === "closed");
      const dt = (s) => (s ? new Date(s).toLocaleString("bn-BD", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }) : "");
      const best = (q) => (q.myAttempts.length ? q.myAttempts.reduce((a, b) => (b.score > a.score ? b : a)) : null);
      const card = (q) => { const b = best(q); return `<li><b>🧠 ${esc(q.title)}</b>${b ? ` <span class="chip ok">${n2(b.score)}/${n2(b.full)}</span>` : ""}
        <p>${[q.subject, q.chapter].filter(Boolean).map(esc).join(" · ")}${q.subject || q.chapter ? " · " : ""}${q.count ? `${bn(q.count)}টি প্রশ্ন · ` : ""}${bn(q.duration)} মিনিট${q.count ? ` · পূর্ণমান ${n2(q.full)}` : ""} ·${q.negative ? `<b style="color:var(--bad)">নেগেটিভ মার্কিং: প্রতি ভুলে −${n2(q.negValue)}</b>` : "নেগেটিভ মার্কিং নেই"}</p>
        <p>${q.state === "upcoming" ? `শুরু হবে: <b>${dt(q.opensAt)}</b>` : q.closesAt ? `শেষ: ${dt(q.closesAt)}` : ""}${q.attemptsAllowed > 1 ? ` · ${bn(q.attemptsAllowed)} বার দেওয়া যাবে (দিয়েছ ${bn(q.myAttempts.length)})` : ""}</p>
        <p>${q.canStart ? `<button class="btn gold sm" data-qstart="${q.id}">${q.inProgress ? "▶ চালিয়ে যাও" : q.myAttempts.length ? "↻ আবার দাও" : "▶ শুরু করো"}</button> ` : ""}${q.myAttempts.length && q.showAnswers ? `<button class="btn line sm" data-qreview="${q.id}">✅ উত্তর দেখো</button>` : ""}</p></li>`; };
      return `${list.some((q) => q.myAttempts.length || q.state === "closed") ? '<p class="qz-acts" style="text-align:right;margin:0 0 12px"><button type="button" class="btn gold sm" data-qcard>🖨 কুইজ রিপোর্ট কার্ড প্রিন্ট</button></p>' : ""}<div class="card"><h2>চলমান কুইজ</h2>${open.length ? `<ul class="list" style="margin-top:12px">${open.map(card).join("")}</ul>` : '<p class="empty">এখন কোনো কুইজ চলছে না</p>'}</div>
        ${up.length ? `<div class="card"><h2>সামনের কুইজ</h2><ul class="list" style="margin-top:12px">${up.map(card).join("")}</ul></div>` : ""}
        ${past.length ? `<div class="card"><h2>শেষ হয়ে যাওয়া কুইজ</h2><ul class="list" style="margin-top:12px">${past.map(card).join("")}</ul></div>` : ""}`;
    },
    // বাড়ির কাজ / পড়া: সামনের কাজ আর আগের কাজে নিজের অবস্থা
    hw() {
      const today = U.today();
      const list = (D.homework || []).slice().sort((a, b) => (b.dueDate || b.givenDate || "").localeCompare(a.dueDate || a.givenDate || ""));
      const kinds = {
        homework: { title: "বাড়ির কাজ", hint: "লিখে বা সমাধান করে আনবে", yes: "করেছ", no: "করোনি" },
        lesson: { title: "ক্লাসের পড়া", hint: "শিখে বা প্রস্তুতি নিয়ে আসবে", yes: "পেরেছ", no: "পারোনি" },
      };
      const selected = TABS._hwKind || "";
      const period = TABS._hwPeriod || "all";
      const isPast = (h) => !!h.dueDate && h.dueDate < today;
      const filtered = list.filter((h) => !selected || h.kind === selected);
      const items = filtered.filter((h) => period === "all" || isPast(h) === (period === "past"));
      if (period === "open") items.reverse();
      const status = (h, kind) => {
        if (h.status === "done") return `<span class="chip ok">✓ ${kind.yes}</span>`;
        if (h.status === "not") return `<span class="chip bad">✗ ${kind.no}</span>`;
        if (h.status === "absent") return '<span class="chip">অনুপস্থিত</span>';
        return '<span class="chip warn">যাচাই হয়নি</span>';
      };
      const item = (h, kind) => `<article class="stu-hw-item">
        <div class="stu-hw-meta"><span class="stu-hw-kind">${kind.title}</span>${status(h, kind)}</div>
        <h4>${esc(h.title)}</h4>
        <div class="stu-hw-meta">${[h.subject, h.chapter].filter(Boolean).map(esc).join(" · ")}</div>
        ${h.details ? `<p class="stu-hw-details">${esc(h.details)}</p>` : ""}
        <div class="stu-hw-date">${h.kind === "lesson" ? "পড়া দেওয়ার তারিখ" : "জমার তারিখ"} · <b>${h.dueDate ? esc(U.date(h.dueDate)) : "ঠিক করা হয়নি"}</b></div>
      </article>`;
      const section = ([key, kind]) => {
        const entries = items.filter((h) => h.kind === key);
        const checked = list.filter((h) => h.kind === key && ["done", "not"].includes(h.status));
        const completed = checked.filter((h) => h.status === "done").length;
        const rate = checked.length ? bn(Math.round(completed / checked.length * 100)) + "%" : "—";
        return `<section class="card stu-hw-group stu-hw-${key}">
          <div class="stu-hw-head"><div><h3>${kind.title} <small>${bn(entries.length)}টি</small></h3><p class="stu-hw-hint">${kind.hint}</p></div><span class="stu-hw-rate">${kind.yes} <b>${rate}</b></span></div>
          ${entries.length ? `<div class="stu-hw-list">${entries.map((h) => item(h, kind)).join("")}</div>` : '<p class="empty">এই তালিকায় কিছু নেই।</p>'}
        </section>`;
      };
      const filter = (attr, current, choices) => choices.map(([key, title]) =>
        `<button type="button" ${attr}="${key}" aria-pressed="${current === key}">${title}</button>`).join("");
      return `<section class="card stu-hw-panel">
        <div class="stu-hw-head"><h2>আমার কাজ ও পড়া</h2>${pBtn("hw", "কাজ ও পড়ার রিপোর্ট")}</div>
        <div class="stu-hw-filters no-print">
          <div role="group" aria-label="ধরন">${filter("data-stu-hw-kind", selected, [["", "সব"], ...Object.entries(kinds).map(([key, kind]) => [key, kind.title])])}</div>
          <div role="group" aria-label="তারিখ">${filter("data-stu-hw-period", period, [["all", "সব তারিখ"], ["open", "চলমান ও সামনে"], ["past", "আগের"]])}</div>
        </div>
      </section>${Object.entries(kinds).filter(([key]) => !selected || key === selected).map(section).join("")}`;
    },
    notices() {
      return `<div class="card"><h2>নোটিশ বোর্ড</h2>${D.notices.length ? `<ul class="list" style="margin-top:12px">${D.notices.map((n) => `<li><b>${n.important ? "📌 " : ""}${esc(n.title)}</b> <small style="float:right;color:var(--muted)">${U.date(n.date)}</small><p>${esc(n.body)}</p>${n.pdf ? `<p><a class="btn sm line" href="/api/notice/${n.id}/pdf?download=1&v=${n.pdf.v}" download>📄 ${esc(n.pdf.name)} — ডাউনলোড</a></p>` : ""}</li>`).join("")}</ul>` : '<p class="empty">কোনো নোটিশ নেই</p>'}</div>`;
    },
    // রেকর্ড ক্লাস — প্রতিটা মডিউলের মেয়াদ (শেষ হবে কবে / ৭ দিনের কম হলে সতর্কবার্তা / শেষ হলে তালা)
    videos() {
      const mods = D.videos || [];
      if (!mods.length) return '<div class="card"><h2>🎬 ক্লাস ভিডিও</h2><p class="empty">এখনো কোনো রেকর্ড ক্লাস নেই</p></div>';
      const open = mods.filter((m) => !m.locked), all = open.flatMap((m) => m.lessons.map((l) => ({ ...l, mod: m })));
      const cur = all.find((l) => l.id === TABS._les) || all[0];
      const player = !cur ? "" : cur.video.type === "youtube"
        ? `<iframe referrerpolicy="strict-origin-when-cross-origin" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(cur.video.yt)}?rel=0&modestbranding=1" title="${esc(cur.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
        : `<video src="${esc(cur.video.src)}" controls controlsList="nodownload" playsinline preload="metadata"></video>`;
      return `<div class="card vd-card"><h2>🎬 ক্লাস ভিডিও</h2>${accessNotes()}
        ${cur ? `<div class="vd-player">${player}</div>
        <p class="vd-now"><small>${esc(cur.mod.code ? "Module " + cur.mod.code + " · " : "")}${esc(cur.mod.name)}</small><b>${bn(all.indexOf(cur) + 1)}. ${esc(cur.title)}</b></p>` : ""}
        ${mods.map((m) => `<h3 class="vd-mod">${esc(m.code ? "Module " + m.code + " — " : "")}${esc(m.name)} <small>${m.locked ? "🔒 মেয়াদ শেষ" : `${bn(m.lessons.length)}টি ক্লাস`}${accessText(m.access)}</small></h3>${(m.chapters || []).length ? `<p class="vd-chs">আপনার কেনা অধ্যায়: ${m.chapters.map((c) => `<span>অধ্যায় ${bn(c.id)} — ${esc(c.name)}</span>`).join("")}</p>` : ""}
          ${m.locked ? `<div class="vd-lock">🔒 <b>মেয়াদ শেষ — নবায়নের জন্য যোগাযোগ করুন</b><small>মেয়াদ শেষ হয়েছে ${U.date(m.access.until)}। পরীক্ষার ফলাফল, হাজিরা আর ফি আগের মতোই দেখা যাবে।${D.site.phone ? ` ফোন: <a href="tel:${esc(D.site.phone)}">${esc(D.site.phone)}</a>` : ""}</small></div>`
            : `<ol class="vd-list">${m.lessons.map((l, i) => `<li><button type="button" data-les="${esc(l.id)}" class="${l.id === cur.id ? "on" : ""}"><span>${bn(i + 1)}</span>${esc(l.title)}${l.chapter ? ` <small class="vd-ch">অধ্যায় ${bn(l.chapter)}</small>` : ""}${l.id === cur.id ? " <em>▶ চলছে</em>" : ""}</button></li>`).join("")}</ol>`}`).join("")}</div>`;
    },
    card() {
      const p = D.profile;
      return `<div class="card"><div class="idcard">
        <div class="top"><img src="/images/logo-nav.png" alt="শাহিন'স আইসিটি কেয়ার"><span class="ct">${esc(D.site.address || "মাস্টার কলোনি, মাদারীপুর")}</span><span class="ct">০১৭৪৯-১০৫৯০২</span><small>শিক্ষার্থী আইডি কার্ড</small></div>
        <div class="id-person"><div class="ph" style="background:url('${p.photo ? "/api/student/photo" + Q : U.avatarSrc(p.gender)}') center/cover"></div><h3 style="white-space:nowrap;font-size:${Math.max(11, Math.min(19, Math.floor(264 / (String(p.name).length * 0.6))))}px">${esc(p.name)}</h3><div class="id">${esc(p.id)}</div></div>
        <dl><dt>সেশন</dt><dd>${esc(p.session || "—")}</dd><dt>ক্লাস ব্যাচ</dt><dd>${esc(D.batch?.name || "—")}</dd><dt>মডিউল</dt><dd>${esc(D.courses.join(", ") || "—")}</dd><dt>সময়</dt><dd>${esc([D.batch?.days, D.batch?.time].filter(Boolean).join(" · ") || "—")}</dd><dt>ভর্তি</dt><dd>${U.date(p.admissionDate)}</dd></dl><div class="id-authority"><img src="/images/signature.png" alt="কর্তৃপক্ষের স্বাক্ষর"><span>কর্তৃপক্ষের স্বাক্ষর</span></div>
      </div><p style="text-align:center"><button class="btn line no-print" onclick="print()">🖨 প্রিন্ট করুন</button></p></div>`;
    },
  };

  // মেয়াদের লেখা ("মেয়াদ শেষ হবে: ১৫ মে ২০২৭" / আজীবন) আর ৭ দিনের কম বা শেষ হলে সতর্কবার্তা — হোম আর ক্লাস ভিডিও দুই জায়গায়
  const accessText = (a) => !a || a.lifetime ? " · মেয়াদ: আজীবন" : a.expired ? "" : ` · মেয়াদ শেষ হবে: ${U.date(a.until)}`;
  function accessNotes() {
    return (D.videos || []).filter((m) => m.access && !m.access.lifetime && (m.access.expired || m.access.daysLeft <= 7)).map((m) => m.access.expired
      ? `<div class="acc-note bad">🔒 <b>${esc(m.name)}</b> — রেকর্ড ক্লাসের মেয়াদ শেষ (${U.date(m.access.until)})। নবায়নের জন্য যোগাযোগ করুন।</div>`
      : `<div class="acc-note warn">⏳ <b>${esc(m.name)}</b> — রেকর্ড ক্লাসের মেয়াদ শেষ হবে ${U.date(m.access.until)} (${m.access.daysLeft ? bn(m.access.daysLeft) + " দিন বাকি" : "আজই শেষ দিন"})। নবায়নের জন্য যোগাযোগ করুন।</div>`).join("");
  }
  function show(t) {
    if (QR && !QR.done && !confirm("কুইজ চলছে — বের হলে সময় চলতেই থাকবে। তবুও যাবে?")) return;
    stopQuiz();
    $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.t === t));
    $("#tabBody").dataset.tab = t; // কোন ট্যাব — রং আলাদা করার জন্য
    $("#tabBody").innerHTML = TABS[t]();
    const ms = $("#mSel");
    if (ms) ms.onchange = () => { TABS._month = ms.value; show("att"); };
    bindRate();
    bindClassMoments();
  }
  $("#tabs").onclick = (e) => { const b = e.target.closest("button[data-t]"); if (b) show(b.dataset.t); };
  // প্রিন্ট: এই ট্যাবটা নতুন উইন্ডোতে প্রিন্ট প্রিভিউ হিসেবে (বোতাম ছাড়া)
  $("#stuPrint").onclick = () => {
    const w = window.open("", "_blank"); if (!w) return alert("পপ-আপ বন্ধ আছে — ব্রাউজারে পপ-আপের অনুমতি দিন");
    const tab = $("#tabs button.on"), head = $(".stu-top").cloneNode(true), body = $("#tabBody").cloneNode(true);
    $$(".bar>span", head).forEach((x) => x.remove());
    $$(".no-print,button,.btn,iframe,form,.ct-acts", body).forEach((x) => x.remove());
    body.removeAttribute("id"); body.style.cssText = "display:grid;gap:20px";
    w.document.write(`<!doctype html><html lang="bn" class="${esc(document.documentElement.className)}"><head><meta charset="utf-8"><base href="${location.origin}/"><title>${esc(D.profile.name)} - ${esc(D.profile.id)} - ${esc(tab ? tab.textContent : "")}</title>${U.DOC_FONTS}<link rel="stylesheet" href="/css/app.css">
<style>*{-webkit-print-color-adjust:exact;print-color-adjust:exact}html.embed .stu-top{padding:14px 0 16px}.stu-body{margin-top:14px!important}${U.PRINT_BAR_CSS}@media print{.pbar{display:none}}</style></head><body>${U.PRINT_BAR}${head.outerHTML}<main class="wrap stu-body">${body.outerHTML}</main></body></html>`);
    w.document.close();
  };
  // রুটিন ট্যাব: ধরন বাছাই, প্রিন্ট; সারসংক্ষেপের "পুরো রুটিন"
  $("#tabBody").addEventListener("click", (e) => {
    if (e.target.closest("[data-go-books]")) return show("books");
    if (e.target.closest("[data-go-routine]")) return show("routine");
    if ($("#tabBody").dataset.tab !== "routine") return;
    const c = e.target.closest("[data-rt]"); if (c) { TABS._rt = c.dataset.rt; return show("routine"); }
    if (e.target.closest("[data-rt-print]")) printRoutine();
  });
  $("#tabBody").addEventListener("click", (e) => {
    const button = e.target.closest("[data-stu-hw-kind], [data-stu-hw-period]");
    if (!button || $("#tabBody").dataset.tab !== "hw") return;
    const attr = button.hasAttribute("data-stu-hw-kind") ? "data-stu-hw-kind" : "data-stu-hw-period";
    const value = button.getAttribute(attr);
    TABS[attr === "data-stu-hw-kind" ? "_hwKind" : "_hwPeriod"] = value;
    show("hw");
    $(`[${attr}]`, $("#tabBody")).find((b) => b.getAttribute(attr) === value)?.focus();
  });
  // ফলাফল ট্যাব: ধরন বাছাই আর রিপোর্ট কার্ড প্রিন্ট
  $("#tabBody").addEventListener("click", (e) => {
    if ($("#tabBody").dataset.tab !== "results") return;
    const c = e.target.closest("[data-rtype]"); if (c) { TABS._rtype = c.dataset.rtype; return show("results"); }
    if (e.target.closest("[data-rcard]")) printReportCard();
  });
  $("#tabBody").addEventListener("click", (e) => { if ($("#tabBody").dataset.tab === "quiz" && e.target.closest("[data-qcard]")) printQuizCard(); });
  $("#tabBody").addEventListener("click", (e) => { const b = e.target.closest("[data-pcard]"); if (b) ({ hw: printHwCard, att: printAttCard, fee: printFeeCard })[b.dataset.pcard](); });
  $("#tabBody").addEventListener("click", (e) => { const b = e.target.closest("[data-les]"); if (b && $("#tabBody").dataset.tab === "videos") { TABS._les = b.dataset.les; show("videos"); scrollTo({ top: $("#tabBody").offsetTop - 80, behavior: "smooth" }); } });

  // ---------- কুইজ দেওয়া ----------
  // উত্তর ব্রাউজারে সাময়িক রাখা হয় (পেজ রিফ্রেশ হলেও হারায় না); সময় শেষ হলে নিজে থেকে জমা
  let QR = null;
  const L = ["ক", "খ", "গ", "ঘ", "ঙ", "চ"];
  const n2q = (x) => bn(String(Math.round(x * 100) / 100));
  const keyOf = (id, no) => `sicQuiz_${id}_${no}`;
  function stopQuiz() { if (QR && QR.timer) clearInterval(QR.timer); if (QR && QR.done) QR = null; }
  async function startQuiz(id) {
    try {
      const d = await api("/api/student/quiz/start", { body: { id } });
      let saved = {}; try { saved = JSON.parse(localStorage.getItem(keyOf(id, d.attemptNo)) || "{}"); } catch {}
      QR = { id, d, answers: saved, skew: Date.now() - d.now, done: false };
      drawQuiz();
      QR.timer = setInterval(tick, 1000); tick();
    } catch (e) { alert(e.message); }
  }
  function drawQuiz() {
    const { d, answers } = QR;
    $("#tabBody").innerHTML = `<div class="card qr"><div class="qr-top"><div><h2>🧠 ${esc(d.title)}</h2><p>${bn(d.questions.length)}টি প্রশ্ন · প্রতিটি ${n2q(d.mark)} নম্বর · ${d.negative ? `<b style="color:var(--bad)">প্রতি ভুলে −${n2q(d.negValue)}</b> — না জানলে ফাঁকা রাখো` : "নেগেটিভ মার্কিং নেই"}</p></div><div class="qr-timer" id="qrTimer">--:--</div></div>
      <div class="qr-prog"><i id="qrBar"></i></div><p class="qr-cnt" id="qrCnt"></p>
      <ol class="qr-qs">${d.questions.map((q, i) => `<li data-q="${q.id}"><b>${bn(i + 1)}. ${esc(q.text)}</b><div class="qr-os">${q.options.map((o, j) => `<button type="button" data-a="${j}" class="${answers[q.id] === j ? "on" : ""}"><span>${L[j]}</span>${esc(o)}</button>`).join("")}</div>${answers[q.id] !== undefined ? '<button type="button" class="qr-clear" data-clear>উত্তর মুছো</button>' : ""}</li>`).join("")}</ol>
      <p style="text-align:center"><button class="btn gold" data-qsubmit>✓ জমা দাও</button></p></div>`;
    count();
  }
  function count() {
    const n = Object.keys(QR.answers).length, t = QR.d.questions.length;
    $("#qrCnt").textContent = `উত্তর দিয়েছ ${bn(n)}/${bn(t)}`; $("#qrBar").style.width = `${(n / t) * 100}%`;
  }
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
      const r = await api("/api/student/quiz/submit", { body: { id: QR.id, attemptNo: QR.d.attemptNo, answers: QR.answers } });
      try { localStorage.removeItem(keyOf(QR.id, QR.d.attemptNo)); } catch {}
      QR.done = true; clearInterval(QR.timer);
      D = await api("/api/student/me");
      drawResult(QR.d.title, r.result, r.review, auto);
    } catch (e) {
      QR.sending = false;
      if (e.status === 409 || e.status === 410) { QR.done = true; clearInterval(QR.timer); }
      alert(e.message);
    }
  }
  function drawResult(title, res, review, auto) {
    $("#tabBody").innerHTML = `<div class="card qr"><h2>🧠 ${esc(title)} — ফলাফল</h2>${auto ? '<p class="chip warn">সময় শেষ — নিজে থেকে জমা হয়েছে</p>' : ""}
      <div class="tiles" style="margin-top:12px"><div class="tile dark"><small>প্রাপ্ত নম্বর</small><b>${n2q(res.score)}/${n2q(res.full)}</b></div><div class="tile"><small>সঠিক</small><b style="color:var(--ok)">${bn(res.correct)}</b></div><div class="tile"><small>ভুল</small><b style="color:var(--bad)">${bn(res.wrong)}</b></div><div class="tile"><small>উত্তর দাওনি</small><b>${bn(res.skipped)}</b></div></div>
      ${review ? `<h3 style="margin-top:16px">উত্তর মিলিয়ে দেখো</h3><ol class="qr-qs">${review.map((q) => `<li><b>${esc(q.text)}</b><div class="qr-os">${q.options.map((o, j) => `<div class="qr-r${j === q.correct ? " ok" : j === q.your ? " bad" : ""}"><span>${L[j]}</span>${esc(o)}${j === q.correct ? " ✓" : j === q.your ? " ✗ (তোমার উত্তর)" : ""}</div>`).join("")}</div>${q.your === null ? '<small style="color:var(--muted)">উত্তর দাওনি</small>' : ""}${q.explain ? `<p class="qr-ex">💡 ${esc(q.explain)}</p>` : ""}</li>`).join("")}</ol>` : '<p style="color:var(--muted)">এই কুইজের সঠিক উত্তর দেখানো বন্ধ রাখা হয়েছে।</p>'}
      <p style="text-align:center"><button class="btn line" data-qback>‹ কুইজের তালিকা</button></p></div>`;
  }
  $("#tabBody").addEventListener("click", async (e) => {
    const t = (s) => e.target.closest(s); let el;
    if ((el = t("[data-qstart]"))) return AS ? alert("অ্যাডমিন ভিউতে কুইজ দেওয়া যায় না — শুধু দেখার জন্য") : startQuiz(el.dataset.qstart);
    if ((el = t("[data-qreview]"))) { try { const r = await api(`/api/student/quiz/review?id=${encodeURIComponent(el.dataset.qreview)}`); drawResult(r.title, r.result, r.review); } catch (er) { alert(er.message); } return; }
    if (t("[data-qback]")) { QR = null; return show("quiz"); }
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

  // অ্যাডমিন প্যানেল থেকে "?as=আইডি" দিয়ে খুললে: ঐ শিক্ষার্থীর প্যানেল শুধু দেখার জন্য (লগইন / লগআউট / কুইজ দেওয়া বন্ধ)
  const AS = new URLSearchParams(location.search).get("as") || "", Q = AS ? "?as=" + encodeURIComponent(AS) : "";
  const EMBED = !!AS && new URLSearchParams(location.search).has("embed"); // অ্যাডমিন প্যানেলের ভেতরে দেখানো হলে উপরের হলুদ বার লাগে না
  async function openPanel() {
    D = await api("/api/student/me" + Q);
    document.documentElement.classList.add("embed"); // শিক্ষার্থীর প্যানেলেও অ্যাডমিন ভিউয়ের রঙিন নকশা
    if (!EMBED) document.documentElement.classList.add("stu-live");
    if (AS) {
      document.title = D.profile.name + " — শিক্ষার্থী প্যানেল (অ্যাডমিন ভিউ)";
      $("#logout").hidden = true;
      if (EMBED) {
        document.documentElement.classList.add("embed");
        if (!$("#tabs [data-t=\"eval\"]")) $("#tabs [data-t=\"home\"]").insertAdjacentHTML("afterend", '<button data-t="eval" class="tab-eval">📊 মূল্যায়ন প্রতিবেদন</button>');
        document.addEventListener("click", (ev) => { if (ev.target.closest("[data-as-eval]")) parent.postMessage({ sicAct: "eval", id: AS }, location.origin); });
        // অ্যাডমিন প্যানেলের বোতাম: নাম / তথ্য সম্পাদনা আর কোর্স (মডিউল) বদল — কাজটা অ্যাডমিন পাতা করে
        if (!$(".as-acts")) { $("#logout").insertAdjacentHTML("beforebegin", `<span class="as-acts no-print"><button type="button" class="btn sm gold" data-as="eval">📊 মূল্যায়ন প্রতিবেদন</button><button type="button" class="btn sm line" data-as="report">📋 স্টুডেন্ট রিপোর্ট</button><button type="button" class="btn sm gold" data-as="edit">✎ Edit</button><button type="button" class="btn sm line" data-as="course">📚 কোর্স / মডিউল</button><button type="button" class="btn sm line" data-as="sms">📩 আইডি ও PIN SMS</button><button type="button" class="btn sm line" data-as="pause">${D.profile.status === "inactive" ? "▶ পড়া আবার চালু" : "⏸ পড়া বন্ধ রাখুন"}</button></span>`);
          $$(".as-acts [data-as]").forEach((b) => (b.onclick = () => parent.postMessage({ sicAct: b.dataset.as, id: AS }, location.origin))); }
        // অ্যাডমিন পাতাকে নিজের উচ্চতা জানানো, যাতে ফ্রেম পুরো পাতার সমান লম্বা হয়
        const tell = () => parent.postMessage({ sicH: document.body.getBoundingClientRect().height }, location.origin);
        new ResizeObserver(tell).observe(document.body); new MutationObserver(() => setTimeout(tell, 30)).observe(document.body, { childList: true, subtree: true, attributes: true }); tell();
      }
      else if (!$(".as-bar")) document.body.insertAdjacentHTML("afterbegin", `<div class="as-bar no-print">👁 অ্যাডমিন ভিউ — <b>${esc(D.profile.name)}</b> (${esc(D.profile.id)})-এর প্যানেল, শিক্ষার্থী যেভাবে দেখে · শুধু দেখার জন্য <button type="button" class="btn sm line" onclick="close()">✕ বন্ধ করুন</button></div>`);
    }
    const p = D.profile;
    $("#siteName").textContent = "শাহিন’স আইসিটি কেয়ার";
    $("#av").textContent = "";
    $("#av").style.cssText = `background:url('${p.photo ? "/api/student/photo" + Q : U.avatarSrc(p.gender)}') center/cover`; // ছবি না থাকলে ছেলে/মেয়ের আইকন
    $("#av").disabled = !!AS;
    $("#av").innerHTML = AS ? "" : '<span>ছবি বদলান</span>';
    $("#av").onclick = requestProfilePhoto;
    $("#studentPhotoStatus").textContent = p.pendingPhoto ? "নতুন ছবি অ্যাডমিনের অনুমোদনের অপেক্ষায়।" : p.photoReview?.status === "rejected" ? "আগের ছবিটি অনুমোদিত হয়নি। পরিষ্কার ছবি আবার পাঠান।" : "";
    const completion = D.profileCompletion;
    const prompt = $("#studentProfilePrompt");
    prompt.hidden = !!AS || !completion;
    const pendingCount = Object.keys(p.pendingProfile?.changes || {}).length;
    $(".spp-eyebrow", prompt).textContent = pendingCount ? "সংশোধন অনুমোদনের অপেক্ষায়" : completion?.complete ? "ভর্তির তথ্য সম্পূর্ণ" : "ভর্তির তথ্য অসম্পূর্ণ";
    $("#profileMissingCount").textContent = pendingCount ? `${bn(pendingCount)}টি তথ্য সংশোধনের অনুরোধ পাঠানো হয়েছে` : p.profileReview?.status === "rejected" ? "আগের সংশোধন অনুমোদিত হয়নি। আবার পাঠাতে পারেন।" : p.profileReview?.status === "approved" ? "আপনার তথ্য সংশোধন অনুমোদিত হয়েছে" : completion?.complete ? "ভুল তথ্য থাকলে সংশোধন পাঠাতে পারেন" : `${bn(completion?.missing.length || 0)}টি প্রয়োজনীয় তথ্য বাকি আছে`;
    $("#completeStudentProfile>span:nth-child(2)").textContent = pendingCount ? "পাঠানো তথ্য দেখুন" : completion?.complete ? "তথ্য সংশোধন করুন" : "ভর্তি ফর্ম সম্পূর্ণ করুন";
    $("#completeStudentProfile").onclick = () => window.SICStudentProfile({ profile: D.profile, onSaved: async () => { await openPanel(); } });
    $("#sName").textContent = p.name;
    $("#sMeta").innerHTML = `<span class="student-info-item student-roll"><small>শিক্ষার্থী রোল</small><strong>${esc(p.id)}</strong></span><span class="student-info-item student-batch"><small>সেশন · ${esc(p.session || "—")}</small><strong>ব্যাচ ${esc(D.batch?.name || "—")}</strong></span><span class="student-info-item student-schedule"><small>ক্লাসের সময়</small><strong>${esc(D.batch?.time || "সময় নির্ধারিত হয়নি")}</strong><span>${esc(D.batch?.days || "")}</span></span>`;
    // অনলাইন মডিউলের রেকর্ড ক্লাস থাকলে "ক্লাস ভিডিও" ট্যাব (সারসংক্ষেপের পরেই)
    const vt = $("#tabs [data-t=\"videos\"]");
    if ((D.videos || []).length && !vt) $("#tabs [data-t=\"home\"]").insertAdjacentHTML("afterend", '<button data-t="videos" class="tab-vid">🎬 ক্লাস ভিডিও</button>');
    else if (!(D.videos || []).length && vt) vt.remove();
    $("#loginScreen").hidden = true;
    $("#panel").hidden = false;
    show("home");
  }

  $("#loginForm").onsubmit = async (e) => {
    e.preventDefault();
    $("#loginErr").textContent = "";
    try {
      await api("/api/student/login", { body: { id: e.target.elements.id.value.trim(), pin: e.target.elements.pin.value.trim() } });
      await openPanel();
    } catch (err) {
      $("#loginErr").textContent = err.message;
      const box = $("#loginBox"); box.classList.remove("shake"); void box.offsetWidth; box.classList.add("shake");
    }
  };
  $("#logout").onclick = async () => { await api("/api/student/logout", { body: {} }).catch(() => {}); location.reload(); };

  openPanel().catch((er) => { if (AS) { document.body.innerHTML = `<p style="padding:40px;text-align:center">এই শিক্ষার্থীর প্যানেল খোলা যায়নি — ${esc(er.message || "")}</p>`; return; } $("#loginScreen").hidden = false; $('#loginForm [name="id"]').focus(); });
})();
