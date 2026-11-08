// প্রতিদিন শিখি (/daily) — সবার জন্য ফ্রি, লগইন লাগে না।
// তিনটা রূপ: মূল (৬ ক্যাটাগরি + সর্বশেষ পোস্ট), ?cat= (একটা ক্যাটাগরি), ?post= (পুরো পোস্ট + MCQ কুইজ: উত্তর দিলে সঠিক উত্তর, ব্যাখ্যা আর স্কোর)।
// খোঁজা, ক্যাটাগরি আর তারিখ দিয়ে ফিল্টার; পুরোনো পোস্ট তারিখ অনুযায়ী পাতায় পাতায়।
(async () => {
  const $ = (s, r = document) => r.querySelector(s);
  const { esc, bn } = U;
  const main = $("#dl");
  $("#year").textContent = bn(new Date().getFullYear());
  try {
    const S = (await U.api("/api/public")).settings || {};
    if (S.phone) { $("#navPhone").href = "tel:" + S.phone; const sp = $("#navPhone span"); if (sp) sp.textContent = S.phone; } else $("#navPhone").hidden = true;
  } catch {}

  const CATS = {
    bangla: { name: "Daily Bangla", bn: "বাংলা", desc: "বাংলা ব্যাকরণ, শুদ্ধ বানান, সাহিত্য, শব্দার্থ ও ভাষার ব্যবহার", c: ["#ff9a5a", "#f0306e"], ic: '<text x="12" y="17" text-anchor="middle" font-size="15" font-weight="800" fill="currentColor" stroke="none">অ</text>' },
    ict: { name: "Daily ICT", bn: "আইসিটি", desc: "HSC ICT-এর গুরুত্বপূর্ণ তথ্য, টিপস, MCQ, প্রোগ্রামিং ও প্রযুক্তি", c: ["#43e6ff", "#3d6bff"], ic: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4M9 9l-2 2 2 2M15 9l2 2-2 2"/>' },
    gk: { name: "Daily GK", bn: "সাধারণ জ্ঞান", desc: "বাংলাদেশ, আন্তর্জাতিক, ইতিহাস, ভূগোল, বিজ্ঞান ও সাধারণ জ্ঞান", c: ["#7ee8a8", "#16a34a"], ic: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>' },
    english: { name: "Daily English", bn: "ইংরেজি", desc: "Vocabulary, Grammar, Translation, Sentence Making ও Spoken English", c: ["#c9a2ff", "#7a2fd6"], ic: '<text x="12" y="16.5" text-anchor="middle" font-size="11" font-weight="800" fill="currentColor" stroke="none">Aa</text>' },
    fact: { name: "আজকের তথ্য", bn: "আজকের তথ্য", desc: "প্রতিদিন একটি নতুন, মজার, অজানা ও শিক্ষণীয় তথ্য", c: ["#ffe08a", "#f0a020"], ic: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>' },
    brain: { name: "Brain Booster", bn: "ব্রেইন বুস্টার", desc: "IQ Test, Puzzle, ধাঁধা, Mathematical Tricks ও Logical Reasoning", c: ["#ff9ad5", "#d63aa0"], ic: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h1V4zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3h-1V4z"/>' },
  };
  const icon = (k, cls = "") => `<span class="dl-ic ${cls}" style="--c1:${CATS[k].c[0]};--c2:${CATS[k].c[1]}"><svg viewBox="0 0 24 24" aria-hidden="true">${CATS[k].ic}</svg></span>`;
  const date = (d) => (d ? U.date(d) : "");
  const params = new URLSearchParams(location.search);
  const view = { cat: params.get("cat") || "", post: params.get("post") || "", q: params.get("q") || "", date: params.get("date") || "", page: Math.max(1, Number(params.get("page")) || 1) };
  const link = (o) => { const p = new URLSearchParams(); Object.entries(o).forEach(([k, v]) => v && p.set(k, v)); const s = p.toString(); return "/daily" + (s ? "?" + s : ""); };

  const hero = (sub) => `<section class="dl-hero"><div class="wrap">
      <span class="dl-free">✦ 100% Free for All · লগইন লাগে না</span>
      <h1>প্রতিদিন শিখি <small>Daily Learning</small></h1>
      <p>${sub || "প্রতিদিন নতুন কিছু শিখি, জ্ঞানে ও দক্ষতায় এগিয়ে যাই।"}</p></div></section>`;
  const card = (p) => `<a class="dl-card" href="${link({ post: p.id })}" style="--c1:${CATS[p.category].c[0]};--c2:${CATS[p.category].c[1]}">
      <div class="dl-thumb">${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : `<div class="dl-thumb-ph">${icon(p.category, "big")}</div>`}<span class="dl-chip">${esc(CATS[p.category].name)}</span>${p.quiz ? `<span class="dl-qz">🧠 ${bn(p.quiz)}টি MCQ</span>` : ""}</div>
      <div class="dl-cb"><small>${date(p.date)}</small><h3>${esc(p.title)}</h3>${p.excerpt ? `<p>${esc(p.excerpt)}${p.excerpt.length >= 180 ? "…" : ""}</p>` : ""}<span class="dl-more">পড়ুন →</span></div></a>`;
  const tools = (cat) => `<form class="dl-tools" id="dlTools">
      <div class="dl-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input name="q" value="${esc(view.q)}" placeholder="খুঁজুন — শিরোনাম বা বিষয়"></div>
      <select name="cat" aria-label="ক্যাটাগরি"><option value="">সব ক্যাটাগরি</option>${Object.entries(CATS).map(([k, c]) => `<option value="${k}"${cat === k ? " selected" : ""}>${c.name}</option>`).join("")}</select>
      <input type="date" name="date" value="${esc(view.date)}" aria-label="তারিখ" title="নির্দিষ্ট দিনের পোস্ট" data-dp-title="কোন দিনের পোস্ট দেখবেন?" data-dp-empty="যেকোনো দিন">
      <button class="btn gold" type="submit">খুঁজুন</button>${view.q || view.date ? `<a class="dl-clear" href="${link({ cat })}">✕ মুছুন</a>` : ""}</form>`;
  const pager = (d, cat) => d.pages > 1 ? `<nav class="dl-pager">${d.page > 1 ? `<a class="btn ghost" href="${link({ cat, q: view.q, date: view.date, page: d.page - 1 })}">‹ নতুনগুলো</a>` : "<span></span>"}<span>পাতা ${bn(d.page)} / ${bn(d.pages)}</span>${d.page < d.pages ? `<a class="btn ghost" href="${link({ cat, q: view.q, date: view.date, page: d.page + 1 })}">পুরোনোগুলো ›</a>` : "<span></span>"}</nav>` : "";
  const empty = (t) => `<p class="dl-empty">${t}</p>`;

  async function list(cat) {
    const d = await U.api(`/api/daily?${new URLSearchParams({ cat, q: view.q, date: view.date, page: view.page })}`);
    return { d, html: `${tools(cat)}${view.q || view.date ? `<p class="dl-found">${bn(d.total)}টি পোস্ট পাওয়া গেছে</p>` : ""}
      <div class="dl-grid">${d.items.map(card).join("") || empty(view.q || view.date ? "এই খোঁজে কোনো পোস্ট পাওয়া যায়নি।" : "এখনো কোনো পোস্ট নেই — শিগগিরই নতুন কনটেন্ট আসছে।")}</div>${pager(d, cat)}` };
  }

  // ---------- মূল রূপ ----------
  async function home() {
    const { d, html } = await list("");
    main.innerHTML = `${hero()}<div class="wrap">
      <section class="dl-cats">${Object.entries(CATS).map(([k, c]) => `<a class="dl-cat" href="${link({ cat: k })}" style="--c1:${c.c[0]};--c2:${c.c[1]}">${icon(k)}
        <div><h2>${c.name}</h2><p>${c.desc}</p></div>
        <div class="dl-cat-foot">${d.counts[k].today ? `<span class="dl-new">আজ নতুন ${bn(d.counts[k].today)}</span>` : ""}<span>${bn(d.counts[k].total)}টি পোস্ট</span><b>দেখুন →</b></div></a>`).join("")}</section>
      <h2 class="dl-h">সর্বশেষ পোস্ট</h2>${html}</div>`;
  }
  // ---------- একটা ক্যাটাগরি ----------
  async function category(cat) {
    const c = CATS[cat], { d, html } = await list(cat);
    document.title = `${c.name} — প্রতিদিন শিখি`;
    main.innerHTML = `<section class="dl-hero dl-cat-hero" style="--c1:${c.c[0]};--c2:${c.c[1]}"><div class="wrap">
        <a class="dl-back" href="/daily">← প্রতিদিন শিখি</a>
        <div class="dl-cat-title">${icon(cat, "big")}<div><h1>${c.name}</h1><p>${c.desc}</p><span class="dl-free">${bn(d.counts[cat].total)}টি পোস্ট${d.counts[cat].today ? ` · আজ নতুন ${bn(d.counts[cat].today)}` : ""} · সবার জন্য ফ্রি</span></div></div></div></section>
      <div class="wrap">${html}</div>`;
  }
  // ---------- পুরো পোস্ট + কুইজ ----------
  function plainHtml(text) {
    const inline = (t) => esc(t).replace(/\*\*([^*\r\n]+?)\*\*/g, "<strong>$1</strong>"), out = []; let list = false;
    for (const raw of String(text || "").split(/\r?\n/)) {
      const line = raw.trim(), li = line.match(/^[-•]\s+(.*)$/);
      if (li) { if (!list) { out.push("<ul>"); list = true; } out.push(`<li>${inline(li[1])}</li>`); continue; }
      if (list) { out.push("</ul>"); list = false; }
      if (line) out.push(`<p>${inline(line)}</p>`);
    }
    if (list) out.push("</ul>");
    return out.join("");
  }
  async function post(id) {
    let r;
    try { r = await U.api(`/api/daily/${encodeURIComponent(id)}`); }
    catch { main.innerHTML = `${hero()}<div class="wrap">${empty('পোস্টটি পাওয়া যায়নি। <a href="/daily">সব পোস্ট দেখুন</a>')}</div>`; return; }
    const p = r.item, c = CATS[p.category];
    document.title = `${p.title} — ${c.name}`;
    const paras = p.html || plainHtml(p.body); // সাজানো লেখা (সার্ভার পরিষ্কার করে দেয়); পুরোনো সাধারণ লেখা হলে **মোটা** আর "- " তালিকা সহ
    main.innerHTML = `<div class="wrap dl-post-wrap"><article class="dl-post" style="--c1:${c.c[0]};--c2:${c.c[1]}">
        <nav class="dl-crumb"><a href="/daily">প্রতিদিন শিখি</a> › <a href="${link({ cat: p.category })}">${c.name}</a></nav>
        <div class="dl-post-meta">${icon(p.category)}<div><b>${c.name}</b><small>${date(p.date)}</small></div></div>
        <h1>${esc(p.title)}</h1>
        ${p.img ? `<img class="dl-post-img" src="${esc(p.img)}" alt="">` : ""}
        <div class="dl-body">${paras}</div>
        ${p.quiz.length ? `<section class="dl-quiz" id="dlQuiz"><div class="dl-quiz-head"><h2>🧠 নিজেকে যাচাই করুন</h2><span id="dlScore">${bn(p.quiz.length)}টি প্রশ্ন</span></div>
          ${p.quiz.map((q, i) => `<div class="dq" data-i="${i}"><p class="dq-q"><b>${bn(i + 1)}.</b> ${esc(q.q)}</p><div class="dq-os">${q.options.map((o, j) => `<button type="button" class="dq-o" data-j="${j}"><i>${"কখগঘঙচ"[j]}</i>${esc(o)}</button>`).join("")}</div><div class="dq-ex" hidden></div></div>`).join("")}
          <div class="dl-quiz-end" id="dlEnd" hidden></div></section>` : ""}
        <nav class="dl-nav">${r.newer ? `<a href="${link({ post: r.newer.id })}"><small>← নতুন পোস্ট</small>${esc(r.newer.title)}</a>` : "<span></span>"}${r.older ? `<a class="r" href="${link({ post: r.older.id })}"><small>আগের পোস্ট →</small>${esc(r.older.title)}</a>` : "<span></span>"}</nav>
      </article>
      ${r.more.length ? `<h2 class="dl-h">${c.name}-এর আরও পোস্ট</h2><div class="dl-grid">${r.more.map(card).join("")}</div>` : ""}</div>`;
    if (!p.quiz.length) return;
    // কুইজ: প্রতিটা প্রশ্নে একবার উত্তর — সাথে সাথে সঠিক / ভুল আর ব্যাখ্যা; সব শেষ হলে স্কোর, আবার দেওয়ার বোতাম
    let score = 0, done = 0;
    const box = $("#dlQuiz");
    box.addEventListener("click", (e) => {
      if (e.target.closest("[data-retry]")) { score = 0; done = 0; box.querySelectorAll(".dq").forEach((d) => { d.classList.remove("ans"); d.querySelectorAll(".dq-o").forEach((o) => { o.className = "dq-o"; o.disabled = false; }); d.querySelector(".dq-ex").hidden = true; }); $("#dlEnd").hidden = true; $("#dlScore").textContent = `${bn(p.quiz.length)}টি প্রশ্ন`; return box.scrollIntoView({ behavior: "smooth" }); }
      const o = e.target.closest(".dq-o"); if (!o) return;
      const dq = o.closest(".dq"); if (dq.classList.contains("ans")) return;
      const q = p.quiz[dq.dataset.i], j = Number(o.dataset.j), ok = j === q.correct;
      dq.classList.add("ans"); dq.querySelectorAll(".dq-o").forEach((b) => { b.disabled = true; if (Number(b.dataset.j) === q.correct) b.classList.add("right"); });
      if (!ok) o.classList.add("wrong");
      const ex = dq.querySelector(".dq-ex"); ex.hidden = false;
      ex.innerHTML = `<b class="${ok ? "ok" : "no"}">${ok ? "✓ সঠিক!" : `✗ ভুল — সঠিক উত্তর: ${esc(q.options[q.correct])}`}</b>${q.explain ? `<p>${esc(q.explain)}</p>` : ""}`;
      score += ok ? 1 : 0; done++;
      $("#dlScore").textContent = `স্কোর: ${bn(score)} / ${bn(done)}`;
      if (done === p.quiz.length) {
        const pct = Math.round((score / p.quiz.length) * 100);
        $("#dlEnd").hidden = false;
        $("#dlEnd").innerHTML = `<div class="dl-res"><b>${bn(score)} / ${bn(p.quiz.length)}</b><span>${pct >= 80 ? "দারুণ! 🎉" : pct >= 50 ? "ভালো হয়েছে, আরও একটু চেষ্টা!" : "আবার চেষ্টা করুন — প্রতিদিন শিখলেই উন্নতি!"}</span></div><button type="button" class="btn gold" data-retry>↻ আবার দিন</button>`;
      }
    });
  }

  // খোঁজার ফর্ম: ক্যাটাগরি বদলালে সেই ক্যাটাগরির পাতায়
  main.addEventListener("submit", (e) => {
    if (e.target.id !== "dlTools") return;
    e.preventDefault();
    const f = new FormData(e.target);
    location.href = link({ cat: f.get("cat"), q: String(f.get("q") || "").trim(), date: f.get("date") });
  });
  main.addEventListener("change", (e) => { if (e.target.name === "cat" || e.target.name === "date") e.target.form.requestSubmit(); });

  try {
    if (view.post) await post(view.post);
    else if (CATS[view.cat]) await category(view.cat);
    else await home();
  } catch { main.innerHTML = `${hero()}<div class="wrap">${empty("সার্ভারে পৌঁছানো যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।")}</div>`; }
})();
