// হিরো প্যানেলে নেটওয়ার্ক নোড — ছোট বিন্দু ধীরে ভাসে, কাছাকাছি এলে পাতলা রেখায় জুড়ে যায় (কম্পিউটার নেটওয়ার্কের মতো)
// মাউস কাছে আনলে আশপাশের বিন্দুর সাথে রেখা হয়; হিরো স্ক্রিনে না থাকলে বা ট্যাব লুকানো থাকলে থামে; "কম নড়াচড়া" সেটিংয়ে একবার স্থির ছবি
(function () {
  const cv = document.getElementById("heroNet");
  if (!cv || !cv.getContext) return;
  const ctx = cv.getContext("2d");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LINK = 140; // এর চেয়ে কাছে থাকলে দুই বিন্দু জোড়া লাগে (px)
  let w = 0, h = 0, nodes = [], mouse = null, visible = true, raf = 0, last = 0;

  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = cv.clientWidth; h = cv.clientHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const want = Math.max(24, Math.min(90, Math.round((w * h) / 15000)));
    while (nodes.length < want) nodes.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35, r: 1.2 + Math.random() * 1.6, gold: Math.random() < 0.12 });
    nodes.length = want;
  }

  function draw(dt) {
    ctx.clearRect(0, 0, w, h);
    const k = dt / 16;
    for (const n of nodes) {
      n.x += n.vx * k; n.y += n.vy * k;
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;
    }
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < LINK) { ctx.strokeStyle = `rgba(110,160,255,${(1 - d / LINK) * 0.35})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
      if (mouse) {
        const d = Math.hypot(a.x - mouse.x, a.y - mouse.y);
        if (d < LINK * 1.3) { ctx.strokeStyle = `rgba(165,180,252,${(1 - d / (LINK * 1.3)) * 0.6})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke(); }
      }
    }
    for (const n of nodes) {
      ctx.fillStyle = n.gold ? "rgba(243,197,93,.85)" : "rgba(147,197,253,.8)";
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function loop(t) {
    const dt = Math.min(50, t - (last || t)); last = t;
    draw(dt);
    raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0;
  }
  const start = () => { if (!raf && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(loop); } };

  size();
  new ResizeObserver(() => { size(); if (still) draw(0); }).observe(cv); // হিরোর উচ্চতা লেখা লোড হওয়ার পর বদলায়
  if (still) { draw(0); return; }
  const hero = cv.parentElement;
  hero.addEventListener("pointermove", (e) => { const r = cv.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; });
  hero.addEventListener("pointerleave", () => (mouse = null));
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }).observe(cv);
  document.addEventListener("visibilitychange", start);
  start();
})();
