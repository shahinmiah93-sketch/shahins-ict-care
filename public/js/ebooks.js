// মূল পাতার "ই-বুক" অংশ — শ্রেণি / সেশন আর ফ্রি / প্রিমিয়াম / আমার ই-বুক দিয়ে ফিল্টার।
// ফ্রি: অতিথি বা শিক্ষার্থী লগইন করলেই পড়া / নামানো যায়; প্রিমিয়াম: "কিনুন" চাপলে WhatsApp-এ অর্ডারের বার্তা,
// অ্যাডমিন ক্রেতার মোবাইল নম্বর যোগ করলে তখন নিজের লগইনে খোলে।
(async () => {
  const $ = (s, r = document) => r.querySelector(s);
  const sec = $("#ebooks");
  if (!sec) return;
  const { esc, bn } = U;
  let rd = null; // পড়ার জানালা
  let books = [], wa = "", mine = { loggedIn: false, open: [], owned: [] }, cat = "", kind = "";
  try { const d = await U.api("/api/public"); books = d.ebooks || []; wa = String((d.settings || {}).whatsapp || "").replace(/\D/g, ""); } catch { return; }
  if (!books.length) return;
  sec.hidden = false;
  const nav = $("#navEbook"); if (nav) nav.hidden = false;
  const loadMine = async () => { try { mine = await fetch("/api/ebooks/mine").then((r) => r.json()); } catch {} draw(); };
  const money = (n) => "৳" + bn(Number(n || 0).toLocaleString("en-IN"));
  const off = (b) => (b.kind === "premium" && b.oldPrice > b.price && b.price > 0 ? Math.round((1 - b.price / b.oldPrice) * 100) : 0);
  const categoryMatches = (b, selected) => !selected || b.category === selected || (b.category === "উভয়" && ["HSC-27", "HSC-28"].includes(selected));
  const cats = () => [...new Set(books.flatMap((b) => b.category === "উভয়" ? ["HSC-27", "HSC-28"] : b.category ? [b.category] : []))];

  const btn = (b) => {
    if (!b.hasPdf) return '<button type="button" class="eb-btn wait" disabled>শীঘ্রই আসছে</button>';
    // খোলা থাকলে দুটো বোতাম: পড়ুন (সাইটের ভেতরে পড়া, নামানোর সুযোগ নেই) আর ডাউনলোড; ফ্রি বই লগইন না থাকলে দুটোই আগে লগইন চায়
    const two = (read, dl) => `<div class="eb-btns">${read}${dl}</div>`;
    if (mine.open.includes(b.id)) return two(`<button type="button" class="eb-btn read" data-eb-read="${esc(b.id)}">পড়ুন</button>`, `<a class="eb-btn dl" href="/api/ebook/${esc(b.id)}/pdf?download=1" download>${b.kind !== "free" ? "ডাউনলোড" : "ফ্রি ডাউনলোড"}</a>`);
    if (b.kind === "students") return '<a class="eb-btn read" href="/student">শিক্ষার্থী লগইন করে পড়ুন</a>';
    if (b.kind !== "premium") return two(`<button type="button" class="eb-btn read" data-eb-login>পড়ুন</button>`, `<button type="button" class="eb-btn dl" data-eb-login>ফ্রি ডাউনলোড</button>`);
    return `<button type="button" class="eb-btn buy" data-eb-buy="${esc(b.id)}">কিনুন →</button>`;
  };
  const card = (b) => `<article class="eb-card">
    <div class="eb-cover">${b.cover ? `<img src="${esc(b.cover)}" alt="${esc(b.title)}" loading="lazy">` : `<div class="eb-ph"><b>${esc(b.title)}</b></div>`}
      <span class="eb-tag ${b.kind === "premium" ? "pre" : b.kind === "students" ? "st" : "fr"}">${b.kind === "premium" ? "PREMIUM" : b.kind === "students" ? "ভর্তি শিক্ষার্থী" : "FREE"}</span>${off(b) ? `<span class="eb-off">-${bn(off(b))}%</span>` : ""}
      ${mine.owned.includes(b.id) ? (mine.open.includes(b.id) ? `<span class="eb-own">কেনা আছে${(mine.expiry || {})[b.id] ? " · " + U.date(mine.expiry[b.id]) + " পর্যন্ত" : ""}</span>` : '<span class="eb-own exp">মেয়াদ শেষ — নবায়ন করুন</span>') : ""}</div>
    <div class="eb-body"><div class="eb-head"><h3>${esc(b.title)}</h3>${b.short ? `<p>${esc(b.short)}</p>` : ""}</div>
      <div class="eb-foot"><div class="eb-price">${b.kind === "premium" ? `<b>${money(b.price)}</b>${b.oldPrice > b.price ? `<s>${money(b.oldPrice)}</s>` : ""}` : b.kind === "students" ? '<b class="st">শুধু ভর্তি হওয়া শিক্ষার্থীদের জন্য</b>' : '<b class="fr">ফ্রি</b>'}</div>${btn(b)}</div></div></article>`;

  // স্লাইডার: এক সারিতে সব বই — তীর চাপলে বা টানলে সরে, নিজে থেকেও ধীরে সরে; মাউস রাখলে থামে, শেষে গিয়ে আবার শুরু
  const fits = () => { const g = $("#ebGrid"); return g.scrollWidth <= g.clientWidth + 2; };
  // নাম ও বিবরণের ঘর সব কার্ডে সমান উঁচু, যাতে নিচের দাগ এক লাইনে থাকে
  const alignHeads = () => { const hs = [...document.querySelectorAll("#ebGrid .eb-head")]; hs.forEach((h) => (h.style.minHeight = "")); const m = Math.max(0, ...hs.map((h) => h.offsetHeight)); hs.forEach((h) => (h.style.minHeight = m + "px")); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(alignHeads);
  const syncNav = () => { const hide = fits(); $("#ebPrev").hidden = hide; $("#ebNext").hidden = hide; };
  function slide(dir) {
    const g = $("#ebGrid"), c = $(".eb-card", g); if (!c || fits()) return;
    const step = c.offsetWidth + 16, end = g.scrollWidth - g.clientWidth;
    const to = dir > 0 && g.scrollLeft >= end - 4 ? 0 : dir < 0 && g.scrollLeft <= 4 ? end : g.scrollLeft + dir * step;
    g.scrollTo({ left: to, behavior: "smooth" });
  }
  let hold = false;
  const box = $(".eb-slider");
  ["mouseenter", "focusin", "touchstart"].forEach((n) => box.addEventListener(n, () => (hold = true), { passive: true }));
  ["mouseleave", "focusout", "touchend"].forEach((n) => box.addEventListener(n, () => (hold = false), { passive: true }));
  if (!matchMedia("(prefers-reduced-motion:reduce)").matches) setInterval(() => { if (!hold && !document.hidden && !(rd && !rd.hidden)) slide(1); }, 4000);
  addEventListener("resize", () => { syncNav(); alignHeads(); });

  function draw() {
    const list = books.filter((b) => categoryMatches(b, cat) && (kind === "mine" ? mine.open.includes(b.id) : !kind || b.kind === kind));
        $("#ebCats").innerHTML = cats().length > 1 ? [["", "সব ই-বুক", books.length], ...cats().map((c) => [c, c, books.filter((b) => categoryMatches(b, c)).length])]
      .map(([v, t, n]) => `<button type="button" class="${cat === v ? "on" : ""}" data-eb-cat="${esc(v)}">${esc(t)} <i>${bn(n)}</i></button>`).join("") : "";
    // ধরন: প্রতিটার নিজের রং আর আইকন — সব (সোনালি), ফ্রি (সবুজ), প্রিমিয়াম (কমলা), আমার ই-বুক (নীল)
    const IC = { all: '<path d="M4 5h7v14H4zM13 5h7v14h-7z"/>', free: '<path d="M20 12v8H4v-8M2 7h20v5H2zM12 20V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z"/>', premium: '<path d="m2 8 5 4 5-7 5 7 5-4-2 11H4z"/>', mine: '<path d="M6 2h12v20l-6-4-6 4z"/>', students: '<path d="m2 9 10-5 10 5-10 5zM6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5"/>' };
    $("#ebKinds").innerHTML = [["", "all", "সব ই-বুক", books.length], ["free", "free", "ফ্রি", books.filter((b) => b.kind === "free").length], ["premium", "premium", "প্রিমিয়াম", books.filter((b) => b.kind === "premium").length], ...(books.some((b) => b.kind === "students") ? [["students", "students", "ভর্তি শিক্ষার্থী", books.filter((b) => b.kind === "students").length]] : []), ["mine", "mine", "আমার ই-বুক", mine.loggedIn ? mine.open.length : null]]
      .map(([v, k, t, n]) => `<button type="button" class="ek ek-${k}${kind === v ? " on" : ""}" data-eb-kind="${v}"><span class="ek-ic"><svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg></span><span class="ek-t">${t}</span>${n !== null ? `<span class="ek-n">${bn(n)}</span>` : ""}</button>`).join("");
    $("#ebGrid").innerHTML = list.map(card).join("") || `<p class="eb-empty">${kind === "mine" ? (mine.loggedIn ? "আপনার কোনো ই-বুক এখনো খোলা নেই — ফ্রি ই-বুক নিন বা প্রিমিয়াম কিনুন।" : "নিজের ই-বুক দেখতে আগে লগইন করুন।") : "এই ভাগে কোনো ই-বুক নেই।"}</p>`;
    $("#ebGrid").scrollLeft = 0; syncNav(); alignHeads();
  }

  sec.addEventListener("click", (e) => {
    const t = (s) => e.target.closest(s); let el;
    if ((el = t("[data-eb-cat]"))) { cat = el.dataset.ebCat; return draw(); }
    if ((el = t("[data-eb-kind]"))) { kind = el.dataset.ebKind; if (kind === "mine" && !mine.loggedIn && window.SICGuestLogin) SICGuestLogin("login"); return draw(); }
    if (t("#ebPrev")) return slide(-1);
    if (t("#ebNext")) return slide(1);
    if ((el = t("[data-eb-read]"))) return openReader(books.find((x) => x.id === el.dataset.ebRead));
    if (t("[data-eb-login]")) return window.SICGuestLogin && SICGuestLogin("register");
    if ((el = t("[data-eb-buy]"))) {
      const b = books.find((x) => x.id === el.dataset.ebBuy);
      if (!wa) return alert("অর্ডার করতে অফিসে যোগাযোগ করুন।");
      const msg = `আসসালামু আলাইকুম। আমি "${b.title}" ই-বুকটি কিনতে চাই (${money(b.price)})।${mine.loggedIn ? "" : " (ওয়েবসাইটে অতিথি অ্যাকাউন্ট খুলে নেব)"} আমার মোবাইল নম্বর: `;
      window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
    }
  });
  // ---------- পড়ার জানালা: pdf.js দিয়ে পাতাগুলো ছবির মতো আঁকা — ব্রাউজারের PDF দেখার জিনিস নয়, তাই নামানো / প্রিন্টের বোতাম নেই ----------
  let pdfLib = null;
  const loadPdfJs = () => pdfLib ? Promise.resolve(pdfLib) : new Promise((ok, bad) => {
    const sc = document.createElement("script"); sc.src = "/vendor/pdf-3.11.174.min.js";
    sc.onload = () => { pdfLib = window.pdfjsLib; pdfLib.GlobalWorkerOptions.workerSrc = "/vendor/pdf-3.11.174.worker.min.js"; ok(pdfLib); };
    sc.onerror = () => bad(new Error("পড়ার জিনিস লোড হয়নি")); document.head.append(sc);
  });
  async function openReader(b) {
    if (!rd) {
      rd = document.createElement("div"); rd.className = "eb-reader"; rd.hidden = true;
      rd.innerHTML = `<div class="ebr-bar"><b class="ebr-title"></b><span class="ebr-page"></span><div class="ebr-zoom"><button type="button" data-z="-1" aria-label="ছোট করুন">−</button><button type="button" data-z="1" aria-label="বড় করুন">+</button></div><button type="button" class="ebr-x" aria-label="বন্ধ করুন">✕</button></div><div class="ebr-pages"></div>`;
      document.body.append(rd);
      rd.addEventListener("contextmenu", (e) => e.preventDefault()); // ডান-ক্লিকে "ছবি সেভ" না আসে
      rd.querySelector(".ebr-x").onclick = () => { rd.hidden = true; document.body.style.overflow = ""; rd.querySelector(".ebr-pages").innerHTML = ""; rd.doc && rd.doc.destroy(); rd.doc = null; };
      rd.querySelector(".ebr-zoom").onclick = (e) => { const z = e.target.closest("[data-z]"); if (!z || !rd.doc) return; rd.scale = Math.min(2.5, Math.max(0.6, rd.scale + Number(z.dataset.z) * 0.2)); paint(); };
      addEventListener("keydown", (e) => { if (!rd.hidden && e.key === "Escape") rd.querySelector(".ebr-x").click(); if (!rd.hidden && (e.ctrlKey || e.metaKey) && /^[sp]$/i.test(e.key)) e.preventDefault(); });
      rd.querySelector(".ebr-pages").addEventListener("scroll", () => { const ps = [...rd.querySelectorAll(".ebr-pg")], top = rd.querySelector(".ebr-pages").scrollTop + 80; const i = ps.findIndex((p) => p.offsetTop + p.offsetHeight > top); rd.querySelector(".ebr-page").textContent = rd.doc ? `${bn(Math.max(1, i + 1))} / ${bn(rd.doc.numPages)}` : ""; }, { passive: true });
    }
    rd.querySelector(".ebr-title").textContent = b.title; rd.querySelector(".ebr-page").textContent = "";
    const box = rd.querySelector(".ebr-pages"); box.innerHTML = '<p class="ebr-msg">খোলা হচ্ছে…</p>';
    rd.hidden = false; document.body.style.overflow = "hidden";
    try {
      const [lib, buf] = await Promise.all([loadPdfJs(), fetch(`/api/ebook/${encodeURIComponent(b.id)}/pdf`).then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "খোলা যায়নি"); return r.arrayBuffer(); })]);
      rd.doc = await lib.getDocument({ data: buf }).promise;
      rd.scale = innerWidth < 700 ? 0.9 : 1.3; paint();
    } catch (er) { box.innerHTML = `<p class="ebr-msg">${esc(er.message || "খোলা যায়নি")}</p>`; }
  }
  let painting = 0;
  async function paint() {
    const job = ++painting, box = rd.querySelector(".ebr-pages"), ratio = Math.min(2, window.devicePixelRatio || 1);
    box.innerHTML = "";
    for (let n = 1; n <= rd.doc.numPages; n++) {
      if (job !== painting) return;
      const page = await rd.doc.getPage(n), vp = page.getViewport({ scale: rd.scale * Math.min(1, (box.clientWidth - 24) / page.getViewport({ scale: rd.scale }).width) });
      const cv = document.createElement("canvas"); cv.className = "ebr-pg"; cv.width = vp.width * ratio; cv.height = vp.height * ratio; cv.style.width = vp.width + "px"; cv.style.height = vp.height + "px";
      box.append(cv);
      await page.render({ canvasContext: cv.getContext("2d"), viewport: vp, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null }).promise;
      if (n === 1) rd.querySelector(".ebr-page").textContent = `১ / ${bn(rd.doc.numPages)}`;
    }
  }
  window.addEventListener("sic-guest", loadMine);
  window.addEventListener("sic-guest-out", loadMine);
  draw(); loadMine();
})();
