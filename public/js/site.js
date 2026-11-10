// পাবলিক ওয়েবসাইট — সব তথ্য সার্ভার (/api/public) থেকে আসে, অ্যাডমিন প্যানেল থেকে বদলানো যায়
(async function () {
  const { $, $$, esc, bn, money } = U;

  // মেনু
  const nav = $(".nav"), burger = $("#burger"), links = $("#links");
  const onScroll = () => nav.classList.toggle("solid", scrollY > 30);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  burger.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    burger.setAttribute("aria-expanded", open);
  });
  const closeMenu = () => { links.classList.remove("open"); burger.setAttribute("aria-expanded", false); };
  links.addEventListener("click", (e) => { if (e.target.closest("a")) { closeMenu(); closeDropdowns(); } });

  // ড্রপডাউন — কম্পিউটারে মাউস রাখলে খোলে, মোবাইলে চাপ দিলে
  const hoverable = matchMedia("(hover: hover) and (min-width: 981px)");
  const dds = $$(".dd");
  function closeDropdowns(except) {
    dds.forEach((d) => { if (d !== except) { d.classList.remove("open"); $(".dd-btn", d).setAttribute("aria-expanded", false); } });
  }
  dds.forEach((dd) => {
    const btn = $(".dd-btn", dd);
    const set = (open) => { if (open) closeDropdowns(dd); dd.classList.toggle("open", open); btn.setAttribute("aria-expanded", open); };
    btn.addEventListener("click", () => set(!dd.classList.contains("open")));
    let t;
    dd.addEventListener("mouseenter", () => { if (hoverable.matches) { clearTimeout(t); set(true); } });
    dd.addEventListener("mouseleave", () => { if (hoverable.matches) t = setTimeout(() => set(false), 150); });
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".dd")) closeDropdowns(); if (!e.target.closest(".nav-search")) $("#searchResults").hidden = true; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeDropdowns(); $("#searchResults").hidden = true; } });

  // মোবাইলে সার্চ বক্স মেনুর ভেতরে চলে যায়
  const search = $("#navSearch"), bar = $(".nav-bar"), mobile = matchMedia("(max-width: 980px)");
  const placeSearch = () => { if (mobile.matches) $(".m-search").append(search); else bar.insertBefore(search, links); };
  mobile.addEventListener("change", placeSearch); placeSearch();
  $("#year").textContent = bn(new Date().getFullYear());

  // স্ক্রল করলে ভেসে ওঠা
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
  const watch = () => $$(".reveal:not(.in)").forEach((el) => io.observe(el));
  watch();

  let data;
  try { data = await U.api("/api/public"); }
  catch { $("#programList").innerHTML = '<p class="empty">তথ্য আনা যায়নি — সার্ভার চালু আছে কিনা দেখুন।</p>'; return; }
  const S = data.settings;
  if (data.hasBooks && $("#navBooks")) $("#navBooks").hidden = false; // অনলাইনে অর্ডারের মতো বই থাকলে মেনুতে "বই ও শিট"

  $$("[data-s]").forEach((el) => { if (S[el.dataset.s]) el.textContent = S[el.dataset.s]; });
  document.title = `${S.name} — HSC ICT কোর্স প্ল্যান`;
  if (data.mentorPhoto) $("#mentorImg").src = data.mentorPhoto; // অ্যাডমিন → সেটিংস থেকে দেওয়া মেন্টরের ছবি
  if (S.mentorName) $("#mentorImg").alt = S.mentorName;

  // প্রতিটি সংখ্যার পাশে ছোট আইকন (শিক্ষার্থী, বই, ক্যালেন্ডার, কম্পিউটার)
  const ico = {
    users: '<path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19"/><circle cx="10" cy="7.5" r="3.5"/><path d="M20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.2a3.5 3.5 0 0 1 0 6.6"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/>',
    star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    award: '<circle cx="12" cy="9" r="5.5"/><path d="m9 13.8-1.5 7.2 4.5-2.5 4.5 2.5-1.5-7.2"/><path d="m12 6.5.8 1.6 1.7.2-1.2 1.2.3 1.7-1.6-.8-1.6.8.3-1.7-1.2-1.2 1.7-.2z"/>',
  };
  $("#stats").innerHTML = [
    // এ পর্যন্ত মোট শিক্ষার্থী অ্যাডমিন → সেটিংস থেকে (বর্তমান ভর্তি শুধু সিস্টেমে থাকা শিক্ষার্থী গোনে)
    [S.studentsTotal || "৬০০০+", "শিক্ষার্থী", "users"],
    [S.experience || "১০+", "বছরের অভিজ্ঞতা", "award"],
    // শিক্ষার্থীরা প্যানেল থেকে যে রেটিং দেয় তার গড়; কেউ না দেওয়া পর্যন্ত আগের মতো ক্লাস ব্যাচ
    data.rating && data.rating.count ? [bn(data.rating.avg.toFixed(1)) + "★", `রেটিং · ${bn(data.rating.count)} জন`, "star", "#reviews"] : [bn(data.batches.length), "ক্লাস ব্যাচ", "cal"],
    // সফল শিক্ষার্থীর সংখ্যা অ্যাডমিন → সেটিংস থেকে; না দিলে "সফল শিক্ষার্থী" অংশের ছবির সংখ্যা
    [S.aplus || bn(324), "সফল শিক্ষার্থী", "trophy"],
  ].map(([v, l, i, go]) => `<div${go ? ` class="stat-go" role="link" tabindex="0" data-go="${go}" title="সব মতামত দেখুন"` : ""}><i aria-hidden="true"><svg viewBox="0 0 24 24">${ico[i]}</svg></i><dt>${v}</dt><dd>${l}</dd></div>`).join("");
  // রেটিংয়ের ঘরে চাপলে নিচের "শিক্ষার্থীদের মতামত" অংশে নিয়ে যায় (অংশটা লুকানো থাকলে কিছু হয় না)
  $$("#stats .stat-go").forEach((el) => {
    const go = () => { const t = $(el.dataset.go); if (t && !t.hidden) t.scrollIntoView({ behavior: "smooth", block: "start" }); };
    el.onclick = go; el.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
  });
  const sessionsOf = () => (data.sessions || []).filter((s) => data.batches.some((b) => b.session === s.name));

  // ব্যানার স্লাইডার — মাঝের ছবি বড়, দুই পাশে আগের ও পরের ছবি ছোট আর একটু অন্ধকার হয়ে উঁকি দেয়; লুপে ঘোরে
  const banners = data.banners || [];
  if (banners.length) {
    const sec = $("#banners"), stage = $("#bnrStage"), n = banners.length, secs = Math.max(2, Number(S.bannerSeconds) || 5) * 1000;
    sec.hidden = false;
    stage.innerHTML = banners.map((b, i) => {
      const tag = b.link ? "a" : "div", href = b.link ? ` href="${esc(b.link)}"${/^https?:/i.test(b.link) ? ' target="_blank" rel="noopener"' : ""}` : "";
      return `<${tag} class="bnr-slide" data-i="${i}"${href}><img class="bg" src="${esc(b.img)}" alt="" aria-hidden="true"><img class="fg" src="${esc(b.img)}" alt="${esc(b.title || "বিজ্ঞাপন")}"${i > 1 ? ' loading="lazy"' : ""}></${tag}>`;
    }).join("") + (n > 1 ? `<button type="button" class="bnr-arrow prev" aria-label="আগের ছবি">←</button><button type="button" class="bnr-arrow next" aria-label="পরের ছবি">→</button>
      <div class="bnr-dots">${banners.map((_, i) => `<button type="button" data-go="${i}" aria-label="ছবি ${bn(i + 1)}"></button>`).join("")}</div>` : "");
    const slides = $$(".bnr-slide", stage), dots = $$(".bnr-dots button", stage);
    let cur = 0, prevOff = [], timer;
    const offOf = (i) => { let d = (((i - cur) % n) + n) % n; if (d > n / 2) d -= n; return d; };
    const draw = () => {
      slides.forEach((s, i) => {
        const d = offOf(i);
        // এক পাশ থেকে অন্য পাশে লাফ দিলে (লুপের মোড়) মাঝখান দিয়ে না গিয়ে সরাসরি জায়গায় বসে
        if (prevOff[i] !== undefined && Math.abs(d - prevOff[i]) > 1) { s.classList.add("jump"); void s.offsetWidth; }
        s.dataset.pos = d === 0 ? "c" : d === -1 ? "l" : d === 1 ? "r" : d < 0 ? "ll" : "rr";
        s.tabIndex = d === 0 ? 0 : -1;
        prevOff[i] = d;
        requestAnimationFrame(() => s.classList.remove("jump"));
      });
      dots.forEach((b, i) => b.classList.toggle("on", i === cur));
    };
    const go = (k) => { cur = ((k % n) + n) % n; draw(); };
    const play = () => { clearInterval(timer); if (n > 1) timer = setInterval(() => go(cur + 1), secs); };
    stage.addEventListener("click", (e) => {
      const t = e.target.closest("button, .bnr-slide");
      if (!t) return;
      if (t.matches(".prev")) { go(cur - 1); return play(); }
      if (t.matches(".next")) { go(cur + 1); return play(); }
      if (t.dataset.go) { go(Number(t.dataset.go)); return play(); }
      // পাশের ছবিতে চাপ দিলে সেটা মাঝে আসে (লিংকে যায় না)
      if (t.classList.contains("bnr-slide") && t.dataset.pos !== "c") { e.preventDefault(); go(Number(t.dataset.i)); play(); }
    });
    stage.addEventListener("mouseenter", () => clearInterval(timer)); stage.addEventListener("mouseleave", play);
    // মোবাইলে আঙুল দিয়ে টেনে বদলানো
    let sx = null;
    stage.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; clearInterval(timer); }, { passive: true });
    stage.addEventListener("touchend", (e) => { if (sx !== null) { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1)); } sx = null; play(); });
    draw(); play();
  }

  // দিনলিপি (ফটো গ্যালারি) — অ্যালবাম ধরে ফিল্টার, বেন্টো গ্রিডে ছবি নিজে বদলায়, ছবিতে চাপ দিলে বড় করে দেখা (আগে / পরে, কিবোর্ড, সোয়াইপ)
  const gal = data.gallery || [];
  if (gal.length) {
    const albumsG = [...new Set(gal.map((g) => g.album).filter(Boolean))];
    let gFilter = "", gTimer = 0, view = [], lbAt = 0;
    $("#gallery").hidden = false;
    const drawG = () => {
      view = gFilter ? gal.filter((g) => g.album === gFilter) : gal;
      $("#galChips").innerHTML = albumsG.length > 1 ? [["", "সব ছবি", gal.length], ...albumsG.map((a) => [a, a, gal.filter((g) => g.album === a).length])]
        .map(([v, t, n]) => `<button type="button" class="${gFilter === v ? "on" : ""}" data-gal-album="${esc(v)}">${esc(t)} <i>${bn(n)}</i></button>`).join("") : "";
      // দিনলিপি: বেন্টো গ্রিড — একটা বড় ঘর আর চারপাশে ছোট ঘর (মোট ৬টা)। ছবি ৬টার বেশি হলে কয়েক সেকেন্ড পরপর
      // এলোমেলো একটা ঘরের ছবি নরমভাবে মিলিয়ে গিয়ে নতুন ছবি আসে (যেটা এখন পর্দায় নেই); মাউস রাখলে থামে।
      // ৬টার কম ছবি হলে সংখ্যা অনুযায়ী বড়, স্থির কার্ড
      clearInterval(gTimer);
      const grid = $("#galGrid"), N = Math.min(6, view.length), bento = view.length >= 6;
      const cap = (g) => `<b>${esc(g.title || g.album || "আমাদের দিনলিপি")}</b>${g.date ? `<small>${esc(U.date(g.date))}</small>` : ""}`;
      grid.className = "gal-grid" + (bento ? " bento" : ` few few-${N}`);
      grid.innerHTML = view.slice(0, N).map((g, i) => `<figure class="gal-it c${i}" data-gal-i="${i}" tabindex="0" role="button" aria-label="${esc(g.title || g.album || "ছবি")} — বড় করে দেখুন">
        <img class="on" src="${esc(g.img)}" alt="${esc(g.title || g.album || "")}" decoding="async"><img alt="" aria-hidden="true" decoding="async"><figcaption>${cap(g)}</figcaption></figure>`).join("");
      $("#galMore").hidden = true;
      if (view.length > N) {
        const cells = $$(".gal-it", grid);
        let last = -1, next = N, paused = false;
        grid.onmouseenter = () => { paused = true; }; grid.onmouseleave = () => { paused = false; };
        const swap = () => {
          if (paused || document.hidden) return;
          const vis = cells.map((el, i) => (el.offsetParent ? i : -1)).filter((i) => i >= 0 && (i !== last || cells.length < 2)); // মোবাইলে লুকানো ঘর বাদ
          const c = vis[Math.floor(Math.random() * vis.length)]; last = c;
          const onScreen = cells.map((el) => Number(el.dataset.galI));
          while (onScreen.includes(next % view.length)) next++;
          const idx = next % view.length; next++;
          const cell = cells[c], g = view[idx], [a, b] = cell.querySelector("img.on") === cell.querySelectorAll("img")[0] ? [...cell.querySelectorAll("img")] : [...cell.querySelectorAll("img")].reverse();
          b.onload = () => { b.classList.add("on"); a.classList.remove("on"); b.alt = g.title || g.album || ""; a.alt = ""; cell.dataset.galI = idx; cell.setAttribute("aria-label", `${g.title || g.album || "ছবি"} — বড় করে দেখুন`); $("figcaption", cell).innerHTML = cap(g); };
          b.src = g.img;
        };
        gTimer = setInterval(swap, Math.max(1.5, Number(S.gallerySeconds) || 2.6) * 1000);
      }
    };
    const lb = $("#galLb"), lbImg = $("#galLbImg"), lbCap = $("#galLbCap");
    const showLb = (i) => { lbAt = (i + view.length) % view.length; const g = view[lbAt]; lbImg.src = g.img; lbImg.alt = g.title || g.album || ""; lbCap.innerHTML = `${g.title ? `<b>${esc(g.title)}</b>` : ""}${g.description ? `<p class="gal-description">${esc(g.description)}</p>` : ""}<small>${esc([g.album, g.date && U.date(g.date)].filter(Boolean).join(" · "))} · ${bn(lbAt + 1)} / ${bn(view.length)}</small>`; };
    const openLb = (i) => { showLb(i); lb.hidden = false; document.body.style.overflow = "hidden"; $(".gal-x", lb).focus(); };
    const closeLb = () => { lb.hidden = true; document.body.style.overflow = ""; };
    $("#gallery").addEventListener("click", (e) => {
      const a = e.target.closest("[data-gal-album]"); if (a) { gFilter = a.dataset.galAlbum; return drawG(); }
      const it = e.target.closest("[data-gal-i]"); if (it) openLb(Number(it.dataset.galI));
    });
    $("#galGrid").addEventListener("keydown", (e) => { const it = e.target.closest("[data-gal-i]"); if (it && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openLb(Number(it.dataset.galI)); } });
    lb.addEventListener("click", (e) => { const b = e.target.closest("[data-lb]"); if (b) return b.dataset.lb === "close" ? closeLb() : showLb(lbAt + (b.dataset.lb === "next" ? 1 : -1)); if (e.target === lb) closeLb(); });
    addEventListener("keydown", (e) => { if (lb.hidden) return; if (e.key === "Escape") closeLb(); if (e.key === "ArrowRight") showLb(lbAt + 1); if (e.key === "ArrowLeft") showLb(lbAt - 1); });
    let lx = null;
    lb.addEventListener("touchstart", (e) => { lx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", (e) => { if (lx !== null) { const dx = e.changedTouches[0].clientX - lx; if (Math.abs(dx) > 40) showLb(lbAt + (dx < 0 ? 1 : -1)); } lx = null; });
    drawG();
  }

  // সফল শিক্ষার্থী — দুই ভাগ: University Achievers, তার নিচে Career Achievers; প্রতিটার নিচে ছবির কার্ড এক সারিতে নিজে থেকে চলতে থাকে
  // (প্রথম সারি বাঁয়ে, দ্বিতীয়টা ডানে); মাউস রাখলে থামে
  const ach = data.achievers || [];
  if (ach.length) {
    const GROUPS = [["university", "University Achievers", "দেশের বিভিন্ন বিশ্ববিদ্যালয়ে অধ্যয়নরত সাবেক শিক্ষার্থীরা"], ["career", "Career Achievers", "বিভিন্ন পেশায় প্রতিষ্ঠিত সাবেক শিক্ষার্থীরা"]];
    const batchYear = ({ batch }) => {
      const digits = String(batch || "").replace(/[০-৯]/g, digit => "০১২৩৪৫৬৭৮৯".indexOf(digit));
      const year = digits.match(/(?:^|[^0-9])([0-9]{4}|[0-9]{2})(?![0-9])/);
      if (!year) return Infinity;
      return year[1].length === 2 ? 2000 + Number(year[1]) : Number(year[1]);
    };
    const rows = GROUPS.map(([g, t, sub]) => [
      g, t, sub, ach.filter(a => a.group === g).sort((a, b) => batchYear(a) - batchYear(b)),
    ]).filter(row => row[3].length);
    const careerInfo = a => {
      const section = (label, rows) => rows.some(([value]) => value)
        ? `<div class="ach-info-group"><span class="ach-info-label">${label}</span>${rows.filter(([value]) => value).map(([value, style]) => `<p class="${style}">${esc(value)}</p>`).join("")}</div>`
        : "";
      return section("বর্তমান পেশা", [[a.subject, "ach-job"], [a.detail, "ach-sub2"]])
        + section("শিক্ষাগত তথ্য", [[a.careerUniversity, "ach-sub2"], [a.careerSubject, "ach-sub2"]]);
    };
    const card = (a, dup) => `<article class="ach-card"${dup ? ' aria-hidden="true"' : ""}><div class="ach-in"><div class="ach-photo"><img src="${esc(a.img)}" alt="${dup ? "" : esc(a.name)}" loading="lazy" decoding="async">${a.batch ? `<span class="ach-badge">${esc(a.batch)}</span>` : ""}</div><div class="ach-cap"><h4>${esc(a.name)}</h4>${a.group === "career" ? careerInfo(a) : (a.detail ? `<p>${esc(a.detail)}</p>` : "") + (a.subject ? `<p class="ach-sub2">${esc(a.subject)}</p>` : "")}</div></div></article>`;
    $("#achievers").hidden = false;
    const grid = $("#achGrid");
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let carousels = [], inView = false;
    new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; }).observe(grid);
    const draw = () => {
      const compact = matchMedia("(max-width: 650px)").matches;
      const step = compact ? 206 : 262;
      grid.innerHTML = rows.map(([g, t, sub, list]) => {
        const repeats = reducedMotion.matches ? 1 : Math.max(1, Math.ceil(grid.clientWidth / (list.length * step)) + 1);
        const cards = Array.from({ length: repeats }, (_, i) => list.map(a => card(a, i > 0)).join("")).join("");
        const copy = reducedMotion.matches ? "" : '<div class="ach-batch" aria-hidden="true">' + cards.replace(/alt="[^"]*"/g, 'alt=""') + '</div>';
        return `<div class="ach-row reveal" data-g="${g}"><header class="ach-head"><span class="ach-pill">${t}</span><p>${sub}</p></header>
          <div class="ach-controls"><button type="button" data-step="-1" aria-label="আগের ছবি">←</button><button type="button" data-step="1" aria-label="পরের ছবি">→</button></div>
          <div class="ach-ribbon" tabindex="0" role="region" aria-label="${t} ছবি"><div class="ach-track"><div class="ach-batch">${cards}</div>${copy}</div></div></div>`;
      }).join("");
      carousels = [...grid.querySelectorAll(".ach-row")].map((row, i) => {
        const ribbon = row.querySelector(".ach-ribbon");
        const loop = reducedMotion.matches ? 0 : row.querySelector(".ach-batch").offsetWidth;
        const state = { ribbon, loop, direction: i % 2 ? -1 : 1, pauseUntil: 0, remainder: 0 };
        const pause = () => { state.pauseUntil = performance.now() + 3000; };
        ribbon.addEventListener("pointerdown", pause);
        ribbon.addEventListener("pointerup", pause);
        ribbon.addEventListener("wheel", pause, { passive: true });
        ribbon.addEventListener("keydown", pause);
        if (loop && state.direction < 0) ribbon.scrollLeft = loop;
        state.autoPosition = ribbon.scrollLeft;
        ribbon.addEventListener("scroll", () => {
          if (ribbon.scrollLeft !== state.autoPosition) pause();
        }, { passive: true });
        row.querySelectorAll("[data-step]").forEach(button => {
          button.disabled = ribbon.scrollWidth <= ribbon.clientWidth;
          button.onclick = () => {
            pause();
            const direction = Number(button.dataset.step);
            if (loop && direction < 0 && ribbon.scrollLeft < step) ribbon.scrollLeft += loop;
            if (loop && direction > 0 && ribbon.scrollLeft + step >= ribbon.scrollWidth - ribbon.clientWidth) ribbon.scrollLeft -= loop;
            ribbon.scrollBy({ left: direction * step, behavior: reducedMotion.matches ? "instant" : "smooth" });
          };
        });
        return state;
      });
      watch();
    };
    draw();
    let last = 0;
    const advance = now => {
      const elapsed = Math.min(now - last, 50);
      last = now;
      for (const state of carousels) {
        const { ribbon, loop, direction } = state;
        if (!inView || !loop || now < state.pauseUntil || ribbon.matches(":hover, :focus-within")) continue;
        state.remainder += elapsed * .034;
        const pixels = Math.floor(state.remainder);
        if (!pixels) continue;
        state.remainder -= pixels;
        const next = ribbon.scrollLeft + pixels * direction;
        ribbon.scrollLeft = ((next % loop) + loop) % loop;
        state.autoPosition = ribbon.scrollLeft;
      }
      requestAnimationFrame(advance);
    };
    requestAnimationFrame(advance);
    reducedMotion.addEventListener("change", draw);
    let rt;
    addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(draw, 200); });
  }

  // 🎬 ফ্রি ক্লাস (প্রথম ৪টা) — বাকিগুলো আলাদা পাতায়; রেকর্ড ক্লাস এখন অনলাইন কোর্স মডিউলের ভেতরে
  const FC = data.freeClasses || [];
  if (FC.length) {
    $("#free-classes").hidden = false;
    $("#fcGrid").innerHTML = FC.slice(0, 4).map((c, i) => U.fcCard(c, i)).join("");
    $("#fcMore").hidden = FC.length <= 4;
    $("#fcGrid").addEventListener("click", (e) => { const b = e.target.closest("[data-fc]"); if (b) { const c = FC[Number(b.dataset.fc)]; U.playVideo(c.video, c.title); } });
  }

  // ⭐ শিক্ষার্থীদের মতামত — দুই সারি উল্টো দিকে ধীরে চলে (মাউস রাখলে থামে); কম হলে স্থির; লম্বা লেখা "…" চাপলে পুরোটা
  const RV = data.reviews || [];
  $("#reviews").hidden = false;
  $("#rvAll").hidden = !RV.length;
  const reviewForm = $("#rvForm");
  reviewForm.onsubmit = async (event) => {
    event.preventDefault();
    const button = reviewForm.querySelector('button[type="submit"]');
    if (button.disabled) return;
    const status = $("#rvFormStatus");
    button.disabled = true;
    status.textContent = "পাঠানো হচ্ছে…";
    try {
      await U.api("/api/public/reviews", { body: Object.fromEntries(new FormData(reviewForm)) });
      reviewForm.reset();
      status.textContent = "মতামত পেয়েছি। অনুমোদনের পর প্রকাশ হবে।";
    } catch (error) {
      status.textContent = error.message || "মতামত পাঠানো যায়নি। আবার চেষ্টা করুন।";
    } finally {
      button.disabled = false;
    }
  };
  if (RV.length) {
    const stars = (n) => `<span class="rv-stars" aria-label="${bn(n)} তারা">${"★".repeat(n)}<i>${"★".repeat(5 - n)}</i></span>`;
    const hue = (s) => [...s].reduce((t, ch) => t + ch.charCodeAt(0), 0) % 360; // নাম অনুযায়ী আলাদা রঙের গোল অক্ষর
    const card = (r, full) => `<article class="rv-card">${stars(r.stars)}
      <p class="rv-text${full ? " full" : ""}">“${esc(r.text)}”</p>${!full && r.text.length > 95 ? `<button type="button" class="rv-more" data-rv="${esc(r.id)}" aria-label="পুরো মতামত পড়ুন">…</button>` : ""}
      <div class="rv-who"><span class="rv-av" style="--h:${hue(r.name)}">${esc(r.name.trim().charAt(0).toUpperCase())}</span><span><b>${esc(r.name)}</b><small>${esc(r.course)}</small></span></div></article>`;
    const rows = RV.length >= 4 ? [RV.filter((_, i) => i % 2 === 0), RV.filter((_, i) => i % 2 === 1)] : [RV];
    $("#rvRows").innerHTML = rows.map((list, k) => {
      const moving = RV.length >= 4;
      // চলমান সারি: একই কার্ড দুবার (শেষে গিয়ে আবার শুরু যেন জোড়া না বোঝা যায়)
      const items = moving ? [...list, ...list, ...(list.length < 4 ? [...list, ...list] : [])] : list;
      return `<div class="rv-row${moving ? " moving" : " still"}${k ? " rev" : ""}" style="--dur:${Math.max(30, items.length * 6)}s"><div class="rv-track">${items.map((r) => card(r)).join("")}</div></div>`;
    }).join("");
    const avg = RV.reduce((t, r) => t + r.stars, 0) / RV.length;
    $("#rvSum").innerHTML = `<b>${bn(avg.toFixed(1))}</b> ${stars(Math.round(avg))} <span>${bn(RV.length)} জন শিক্ষার্থীর মতামত</span>`;
    // পপআপ: একটা মতামত পুরো, অথবা সব মতামত
    const pop = (title, html) => {
      const d = document.createElement("div"); d.className = "rv-pop";
      d.innerHTML = `<div class="rv-box" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h3>${esc(title)}</h3><button type="button" class="rv-x" aria-label="বন্ধ করুন">✕</button></header><div class="rv-grid">${html}</div></div>`;
      const close = () => { d.remove(); document.removeEventListener("keydown", esc_); };
      const esc_ = (e) => { if (e.key === "Escape") close(); };
      d.onclick = (e) => { if (e.target === d || e.target.closest(".rv-x")) close(); };
      document.addEventListener("keydown", esc_);
      document.body.append(d); d.querySelector(".rv-x").focus();
    };
    $("#rvAll").onclick = () => pop(`সব মতামত (${bn(RV.length)})`, RV.map((r) => card(r, true)).join(""));
    $("#rvRows").addEventListener("click", (e) => { const b = e.target.closest("[data-rv]"); if (b) { const r = RV.find((x) => x.id === b.dataset.rv); if (r) pop(r.name + "-এর মতামত", card(r, true)); } });
  }

  // ট্যালেন্ট হান্ট চালু থাকলে: ভর্তির আগ্রহ অংশে ব্যানার আর "আরও" মেনুতে লিংক
  U.api("/api/talent").then((t) => {
    const h = t && t.hunt; if (!h) return;
    const more = $$(".dd-menu.right")[0];
    if (more) more.insertAdjacentHTML("afterbegin", `<a href="/talent-hunt"><b>🏆 ${esc(h.title)}</b><small>${h.live ? "রেজিস্ট্রেশন চলছে — ফ্রি" : h.resultPublished ? "ফলাফল প্রকাশিত" : ""}</small></a>`);
    const cta = $("#thCta");
    cta.innerHTML = `<i class="th-cup" aria-hidden="true">🏆</i><span class="th-tx"><small class="th-st"><i></i>${h.live ? "রেজিস্ট্রেশন চলছে" : "ফলাফল প্রকাশিত"}</small><b>${esc(h.title)}</b><span class="th-facts">${(h.live ? [h.examDate && `📅 ${U.date(h.examDate)}`] : ["রোল আর মোবাইল নম্বর দিয়ে নিজের ফলাফল দেখো"]).filter(Boolean).map((x) => `<em>${esc(x)}</em>`).join("")}</span></span><span class="th-go"><b>${h.live ? "ফ্রি রেজিস্ট্রেশন করো" : "ফলাফল দেখুন"}</b></span>`;
    cta.hidden = !(h.live || h.resultPublished);
  }).catch(() => {});

  // নোটিশের চলন্ত পট্টি সরানো হয়েছে — নোটিশ এখন মেনুর "নোটিশ" বোর্ডে


  // প্রোগ্রাম — অফলাইন মডিউল "আইসিটি কোর্স প্ল্যান"-এ, অনলাইন মডিউল আলাদা অংশে (একই কার্ড)
  // মডিউল কার্ড: কভার ছবি + নাম + দুই বোতাম (বিস্তারিত পাতা / ভর্তি)
  const progCard = (c, i) => `
    <article class="mtile reveal" id="prog-${esc(c.id)}">
      ${c.popular ? '<span class="pop">জনপ্রিয়</span>' : ""}
      <a class="mt-cover" href="/module?c=${encodeURIComponent(c.id)}" aria-label="${esc(c.name)} — বিস্তারিত">${U.modCover(c, i)}</a>
      <div class="mt-body"><p class="mt-no"><span>Module</span><b>${esc(c.code || "")}</b></p><h3><a href="/module?c=${encodeURIComponent(c.id)}">${esc(c.name)}</a></h3></div>
      <div class="mt-btns"><a class="mt-more" href="/module?c=${encodeURIComponent(c.id)}">বিস্তারিত দেখুন</a><a class="mt-buy" href="${c.mode === "online" ? "/online-apply" : "/apply"}?c=${encodeURIComponent(c.id)}">কোর্সটি কিনুন</a></div>
    </article>`;
  const onlineMods = data.courses.filter((c) => c.mode === "online");
  const offlineMods = data.courses.filter((c) => c.mode !== "online");
  $("#programList").innerHTML = offlineMods.map(progCard).join("") || '<p class="empty">শীঘ্রই আসছে</p>';
  $("#progCount").textContent = bn(offlineMods.length); if ($("#onlineCount")) $("#onlineCount").textContent = bn(onlineMods.length); // "৬টি মডিউল" — অফলাইন মডিউল গুনে
  $("#onlineProgList").innerHTML = onlineMods.map(progCard).join("");
  // মডিউলের সারি পাতা হিসেবে: পাশাপাশি স্ক্রল (আঙুলে সরানো যায়), ‹ › বোতাম আর নিচে পাতার বিন্দু
  const pager = (list) => {
    const nav = document.createElement("div"); nav.className = "mt-nav";
    nav.innerHTML = '<button type="button" class="mt-arrow" aria-label="আগের পাতা">‹</button><div class="mt-dots"></div><button type="button" class="mt-arrow" aria-label="পরের পাতা">›</button>';
    list.after(nav);
    const [prev, dots, next] = nav.children;
    const step = () => list.clientWidth + parseFloat(getComputedStyle(list).columnGap || 0);
    const update = () => {
      const cards = list.querySelectorAll(".mtile").length, card = list.querySelector(".mtile");
      const per = card ? Math.max(1, Math.round(step() / (card.offsetWidth + parseFloat(getComputedStyle(list).columnGap || 0)))) : 1;
      const pages = Math.ceil(cards / per), cur = Math.min(pages - 1, Math.round(list.scrollLeft / step()));
      nav.classList.toggle("off", pages <= 1); // এক পাতা হলেও জায়গাটা থাকে — অফলাইন আর অনলাইন অংশ সমান উঁচু
      if (dots.children.length !== pages) dots.innerHTML = Array.from({ length: pages }, (_, i) => `<button type="button" aria-label="পাতা ${bn(i + 1)}"></button>`).join("");
      [...dots.children].forEach((d, i) => d.classList.toggle("on", i === cur));
      prev.disabled = cur <= 0; next.disabled = cur >= pages - 1;
    };
    prev.onclick = () => list.scrollBy({ left: -step(), behavior: "smooth" });
    next.onclick = () => list.scrollBy({ left: step(), behavior: "smooth" });
    dots.onclick = (e) => { const i = [...dots.children].indexOf(e.target); if (i >= 0) list.scrollTo({ left: i * step(), behavior: "smooth" }); };
    list.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
    addEventListener("resize", update);
    update();
  };
  pager($("#programList")); pager($("#onlineProgList"));
  $("#online-programs").hidden = !onlineMods.length;

  // ক্লাস ব্যাচ — সেশন অনুযায়ী
  const seat = (b) => {
    const cls = b.seatsLeft === 0 ? "full" : b.seatsLeft <= 3 ? "low" : "";
    return `<span class="seat ${cls}">${b.seatsLeft === 0 ? "সিট পূর্ণ" : `${bn(b.seatsLeft)}টি সিট খালি`}</span>`;
  };
  // প্রতিটা সেশনের কার্ড আলাদা রঙের (c0 লাল-কমলা, c1 নীল, c2 সবুজ, c3 বেগুনি)
  $("#batchList").innerHTML = sessionsOf().map((s, i) => `
    <div class="sess reveal c${i % 4}"><h3 class="sess-h"><span class="sess-pill"><em>সেশন</em>${esc(s.name)}</span><i class="sess-line"></i><small>${bn(data.batches.filter((b) => b.session === s.name).length)}টি ব্যাচ</small></h3>
      <div class="batches">${data.batches.filter((b) => b.session === s.name).map((b) => `<div class="bt-col"><article class="bt${b.tag || (b.seatsLeft > 0 && b.seatsLeft <= 3) ? " hot" : ""}"><div class="bt-tile"><b>${esc(b.name)}</b><small>${esc(s.name)}</small></div><h3>${esc(b.days || "শীঘ্রই জানানো হবে")}</h3><p>${esc(b.time || "—")}</p>${seat(b)}</article>${b.tag ? `<span class="bt-tagbox"><span class="bt-tag">${esc(b.tag)}</span></span>` : ""}</div>`).join("")}</div></div>`).join("")
    || '<p class="empty">শীঘ্রই নতুন ব্যাচ</p>';

  // মেনুর ড্রপডাউন ও ফোন
  // মেনুর "কোর্স": প্রথমে দুটো ভাগ — অনলাইন কোর্স, অফলাইন কোর্স; ভাগে মাউস রাখলে (মোবাইলে চাপ দিলে) পাশে সেই ভাগের মডিউলগুলো
  const ddGroup = (key, title, sub, list, all) => `<div class="dd-sub" data-sub="${key}"><button type="button" class="dd-sub-btn" aria-expanded="false"><span><b>${title}</b><small>${list.length ? bn(list.length) + "টি মডিউল · " : ""}${sub}</small></span><i class="dd-arrow" aria-hidden="true"></i></button>
    <div class="dd-fly">${list.map((c) => `<a href="#prog-${esc(c.id)}"><b>${esc(c.code ? c.code + " — " : "")}${esc(c.name)}</b>${c.short ? `<small>${esc(c.short)}</small>` : ""}</a>`).join("") || '<a href="#programs"><b>শীঘ্রই আসছে</b></a>'}<a class="dd-all" href="${all}"><b>সব দেখুন →</b></a></div></div>`;
  $("#ddCourses").innerHTML = ddGroup("online", "অনলাইন কোর্স", "ঘরে বসে শেখো", onlineMods, "#online-programs") + ddGroup("offline", "অফলাইন কোর্স", "ক্লাসরুমে শেখো", offlineMods, "#programs");
  $("#ddCourses").addEventListener("click", (e) => { const b = e.target.closest(".dd-sub-btn"); if (!b) return; e.stopPropagation(); const g = b.parentElement, open = !g.classList.contains("open"); $$(".dd-sub", $("#ddCourses")).forEach((x) => { x.classList.toggle("open", x === g && open); $(".dd-sub-btn", x).setAttribute("aria-expanded", x === g && open); }); });
  $("#ddBatches").innerHTML = sessionsOf().map((s) => `<div class="dd-group">${esc(s.name)}</div>
    <div class="dd-batches">${data.batches.filter((b) => b.session === s.name).map((b) => `<a href="#batches" title="${esc(b.days)} · ${esc(b.time)}"><b>${esc(b.name)}</b><small class="seat-s${b.seatsLeft ? "" : " full"}">${b.seatsLeft ? bn(b.seatsLeft) + " সিট" : "পূর্ণ"}</small></a>`).join("")}</div>`).join("")
    || '<a href="#batches"><b>শীঘ্রই নতুন ব্যাচ</b></a>';
  // ফ্রি ক্লাস / প্রশ্ন ও উত্তর থাকলে মেনুতে দেখায়
  $("#navFree").hidden = !(data.freeClasses || []).length;

  // সাধারণ প্রশ্ন (FAQ) — প্রশ্নে চাপ দিলে উত্তর খোলে (একটা খুললে অন্যগুলো বন্ধ)
  const FAQ = data.faqs || [];
  if (FAQ.length) {
    $("#faqWrap").hidden = false; // প্রশ্নোত্তর বক্সের নিচে "সাধারণ প্রশ্ন"
    $("#faqList").innerHTML = FAQ.map((f, i) => `<details class="faq-it reveal"${i ? "" : " open"}><summary><span class="faq-n">${bn(i + 1)}</span><b>${esc(f.q)}</b><i class="faq-ic" aria-hidden="true"></i></summary><div class="faq-a">${esc(f.a).replace(/\n/g, "<br>")}</div></details>`).join("");
    $("#faqList").addEventListener("toggle", (e) => { if (e.target.open) $$(".faq-it[open]", $("#faqList")).forEach((d) => { if (d !== e.target) d.open = false; }); }, true);
    watch();
  }

  // নোটিশ বোর্ড — মেনুর "নোটিশ" চাপলে পপআপ; যে নোটিশ এই ব্রাউজারে আগে খোলা হয়নি তার সংখ্যা লাল ব্যাজে
  const NT = data.notices || [], OLD = data.oldNotices || [];
  if (NT.length || OLD.length) {
    const SEEN = "sic-seen-notices";
    const seen = () => { try { return JSON.parse(localStorage.getItem(SEEN) || "[]"); } catch { return []; } };
    const badge = () => { const n = NT.filter((x) => !seen().includes(x.id)).length; $("#nnBadge").hidden = !n; $("#nnBadge").textContent = bn(n); };
    const pop = $("#ntPop");
    const ntCard = (n, old) => `<article class="nt-it${n.important ? " hot" : ""}${old ? " old" : seen().includes(n.id) ? "" : " new"}">
      <div class="nt-meta"><span class="nt-tag">${esc(n.tag || (n.important ? "জরুরি" : "নোটিশ"))}</span>${n.date ? `<small>${esc(U.date(n.date))}</small>` : ""}${old || seen().includes(n.id) ? "" : '<em class="nt-new">নতুন</em>'}</div>
      <h3>${esc(n.title)}</h3>${n.body ? `<p>${U.richText(n.body)}</p>` : ""}
      ${n.pdf ? `<a class="nt-pdf" href="/api/notice/${esc(n.id)}/pdf?download=1&v=${n.pdf.v}" download>PDF ডাউনলোড — ${esc(n.pdf.name)}</a>` : ""}</article>`;
    // চলতি নোটিশ আগে, তারপর মেয়াদ শেষ হওয়াগুলো "পুরোনো নোটিশ" ভাগে (ফিকে করে)
    $("#ntList").innerHTML = NT.map((n) => ntCard(n)).join("") + (OLD.length ? `<div class="nt-sep">পুরোনো নোটিশ</div>${OLD.map((n) => ntCard(n, true)).join("")}` : "");
    const open = () => { pop.hidden = false; document.body.style.overflow = "hidden"; $(".nt-x", pop).focus(); try { localStorage.setItem(SEEN, JSON.stringify(NT.map((x) => x.id))); } catch {} badge(); };
    const close = () => { pop.hidden = true; document.body.style.overflow = ""; $$(".nt-it.new", pop).forEach((el) => el.classList.remove("new")); $$(".nt-new", pop).forEach((el) => el.remove()); };
    $("#navNotice").hidden = false; badge();
    $("#navNotice").addEventListener("click", open);
    pop.addEventListener("click", (e) => { if (e.target === pop || e.target.closest("[data-nt-close]")) close(); });
    addEventListener("keydown", (e) => { if (e.key === "Escape" && !pop.hidden) close(); });
  }
  if (S.phone) { $("#navPhone").href = "tel:" + S.phone; $("#navPhone span").textContent = S.phone; } else $("#navPhone").hidden = true;

  // কোর্স সার্চ
  const sIn = $("#searchInput"), sOut = $("#searchResults");
  let hits = [], active = -1;
  const go = (c) => {
    sOut.hidden = true; sIn.value = ""; closeMenu();
    const el = document.getElementById("prog-" + c.id);
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("hit"); setTimeout(() => el.classList.remove("hit"), 1800); }
  };
  const drawHits = () => {
    const q = sIn.value.trim().toLowerCase();
    if (!q) { sOut.hidden = true; return; }
    hits = data.courses.filter((c) => [c.name, c.short, c.desc, ...(c.features || [])].join(" ").toLowerCase().includes(q));
    active = hits.length ? 0 : -1;
    sOut.innerHTML = hits.map((c, i) => `<li><a href="#prog-${esc(c.id)}" data-i="${i}" class="${i === active ? "on" : ""}" role="option"><span class="ic">${esc(c.icon || c.name.slice(0, 1))}</span><span><b>${esc(c.name)}</b><small>${money(c.fee)}${esc(c.feeUnit)} · ${esc(c.duration)}</small></span></a></li>`).join("")
      || `<li class="none">"${esc(sIn.value.trim())}" নামে কোনো কোর্স পাওয়া যায়নি</li>`;
    sOut.hidden = false;
  };
  sIn.addEventListener("input", drawHits);
  sIn.addEventListener("focus", drawHits);
  sIn.addEventListener("keydown", (e) => {
    if (sOut.hidden || !hits.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % hits.length;
      $$("a", sOut).forEach((a, i) => a.classList.toggle("on", i === active));
    }
    if (e.key === "Enter") { e.preventDefault(); go(hits[Math.max(0, active)]); }
  });
  sOut.addEventListener("click", (e) => { const a = e.target.closest("a[data-i]"); if (a) { e.preventDefault(); go(hits[a.dataset.i]); } });

  // শিক্ষক
  // কার্ডে শুধু ছবি, নাম, পদ; পরিচিতি (bio) চাপলে পপআপে দেখায়
  $("#teachers").innerHTML = data.teachers.map((t, i) => `
    <article class="person reveal${t.bio ? " openable" : ""}"${t.bio ? ` data-person="${i}" role="button" tabindex="0" aria-haspopup="dialog" aria-label="${esc(t.name)} — বিস্তারিত দেখুন"` : ""}><div class="ph">${t.photo ? `<img src="${esc(t.photo)}" alt="${esc(t.name)}">` : esc(t.name.slice(0, 1))}</div>
    <h4>${esc(t.name)}</h4><p class="sub">${esc(t.subject)}</p>${t.bio ? '<span class="person-more">বিস্তারিত দেখুন <i aria-hidden="true">→</i></span>' : ""}</article>`).join("");
  const openPerson = (t) => {
    const d = document.createElement("dialog"); d.className = "person-dialog";
    d.innerHTML = `<button type="button" class="pd-x" aria-label="বন্ধ করুন">✕</button><div class="pd-ph">${t.photo ? `<img src="${esc(t.photo)}" alt="${esc(t.name)}">` : esc(t.name.slice(0, 1))}</div><div class="pd-body"><h3>${esc(t.name)}</h3><p class="pd-sub">${esc(t.subject)}</p>${String(t.bio || "").split(/\n{2,}|\r?\n/).map((x) => x.trim()).filter(Boolean).map((x) => `<p>${esc(x)}</p>`).join("")}</div>`;
    document.body.append(d); d.addEventListener("close", () => d.remove());
    d.addEventListener("click", (e) => { if (e.target === d || e.target.closest(".pd-x")) d.close(); });
    d.showModal();
  };
  const personCard = (el) => { const c = el.closest("[data-person]"); if (c) openPerson(data.teachers[Number(c.dataset.person)]); };
  $("#teachers").addEventListener("click", (e) => personCard(e.target));
  $("#teachers").addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.closest("[data-person]")) { e.preventDefault(); personCard(e.target); } });

  // যোগাযোগ
  if ($("#footAddr")) $("#footAddr").innerHTML = `${esc(S.address)}<br>${esc([S.phone, S.phone2].filter(Boolean).join(" · "))}`;
  // হোম পাতার ফুটার: ঠিকানা আর ফোন আলাদা সারিতে, ফোনে চাপলে কল
  if ($("#footAddrLine")) $("#footAddrLine").textContent = S.address || "";
  if ($("#footPhones")) $("#footPhones").innerHTML = [S.phone, S.phone2].filter(Boolean).map((n) => `<a href="tel:${esc(n)}">${esc(n)}</a>`).join(" · ");
  $("#footPrograms").innerHTML = data.courses.map((c) => `<li><a href="#programs">${esc(c.name)}</a></li>`).join("");
  if (S.whatsapp) $("#fabWa").href = `https://wa.me/${S.whatsapp}`; else $("#fabWa").hidden = true;

  // ভর্তির আগ্রহ ফর্ম
  const sel = $("#courseSelect");
  data.courses.forEach((c) => sel.add(new Option(c.name, c.name)));
  document.addEventListener("click", (e) => { const n = e.target.dataset && e.target.dataset.course; if (n) sel.value = n; });
  const form = $("#enquiryForm"), msg = $("#formMsg");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(form));
    body.phone = (body.phone || "").replace(/[^\d]/g, "").replace(/^88/, "");
    if (!body.name.trim() || !/^01\d{9}$/.test(body.phone)) {
      msg.className = "form-msg bad"; msg.textContent = "নাম আর সঠিক মোবাইল নম্বর (01XXXXXXXXX) দিন।"; return;
    }
    const btn = form.querySelector("button"); btn.disabled = true;
    try {
      await U.api("/api/enquiry", { body });
      let extra = "";
      // সাথে ট্যালেন্ট হান্টের রেজিস্ট্রেশনও (টিক দিলে)
      if (body.talent) {
        try { const r = await U.api("/api/talent/register", { body }); extra = ` 🏆 ট্যালেন্ট হান্টে আপনার রোল: ${r.reg.roll} — প্রবেশপত্র নিন /talent-hunt পাতা থেকে।`; }
        catch (er) { extra = ` (ট্যালেন্ট হান্টে রেজিস্ট্রেশন হয়নি: ${er.message})`; }
      }
      msg.className = "form-msg ok"; msg.textContent = `ধন্যবাদ ${body.name}! আমরা শীঘ্রই ফোন করবো।${extra}`; form.reset();
    } catch (err) { msg.className = "form-msg bad"; msg.textContent = err.message; }
    btn.disabled = false;
  });

  watch();
})();
