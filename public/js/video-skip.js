// ভিডিওর নিচে "১০ সেকেন্ড পিছনে / সামনে" বোতাম — YouTube প্লেয়ার (enablejsapi=1) আর নিজের ফাইলের <video controls> দুটোতেই।
// পাতায় যেকোনো সময় ভিডিও এলে (পপআপ, ক্লাস ভিডিও, প্রশ্নোত্তরের উত্তর) নিজে থেকে বোতাম বসে; ভিডিও সরে গেলে বোতামও সরে যায়।
// ব্যাকগ্রাউন্ড / হিরোর ভিডিও (controls নেই) আর enablejsapi ছাড়া iframe-এ হাত দেয় না।
(function () {
  "use strict";
  const STEP = 10, bars = new WeakMap();
  let apiP = null;
  const ytApi = () => apiP || (apiP = new Promise((res) => {
    if (window.YT && window.YT.Player) return res(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { try { prev && prev(); } catch {} res(window.YT); };
    const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; s.onerror = () => res(null); document.head.append(s);
    setTimeout(() => res(null), 10000);
  }));

  function makeBar(host, seek) {
    const bar = document.createElement("div"); bar.className = "vskip no-print";
    bar.innerHTML = `<button type="button" data-d="-1" title="১০ সেকেন্ড পিছনে">⏪ ১০ সেকেন্ড পিছনে</button><button type="button" data-d="1" title="১০ সেকেন্ড সামনে">১০ সেকেন্ড সামনে ⏩</button>`;
    bar.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) seek(Number(b.dataset.d) * STEP); });
    host.insertAdjacentElement("afterend", bar);
    return bar;
  }
  function attachVideo(v) {
    if (v.dataset.skip || !v.controls) return; v.dataset.skip = "1";
    const host = v.parentElement; if (!host) return;
    bars.set(v, makeBar(host, (d) => { v.currentTime = Math.max(0, Math.min(isFinite(v.duration) ? v.duration : Infinity, v.currentTime + d)); }));
  }
  async function attachYt(f) {
    if (f.dataset.skip) return; f.dataset.skip = "1";
    const host = f.parentElement; if (!host) return;
    let player = null;
    const bar = makeBar(host, (d) => { if (!player || !player.getCurrentTime) return; const t = player.getCurrentTime() + d, max = player.getDuration ? player.getDuration() : 0; player.seekTo(Math.max(0, max ? Math.min(max, t) : t), true); });
    bars.set(f, bar); bar.classList.add("wait");
    const YT = await ytApi();
    if (!YT || !f.isConnected) { bar.remove(); return; } // ইন্টারনেট / YouTube না পেলে বোতাম দেখানো হয় না
    try { player = new YT.Player(f, { events: { onReady: () => bar.classList.remove("wait"), onError: () => {} } }); } catch { bar.remove(); }
  }
  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    const list = [...(root.matches && root.matches("iframe,video") ? [root] : []), ...root.querySelectorAll("iframe,video")];
    for (const el of list) {
      if (el.tagName === "VIDEO") attachVideo(el);
      else if (/youtube(-nocookie)?\.com\/embed\//.test(el.src) && /enablejsapi=1/.test(el.src)) attachYt(el);
    }
  }
  function gone(root) {
    if (!root || root.nodeType !== 1) return;
    const list = [...(root.matches && root.matches("iframe,video") ? [root] : []), ...root.querySelectorAll("iframe,video")];
    for (const el of list) { const b = bars.get(el); if (b) { b.remove(); bars.delete(el); } }
  }
  const start = () => {
    const css = document.createElement("style");
    css.textContent = `.vskip{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;padding:10px 12px;background:#0b1f24}
.vskip button{padding:9px 16px;border:1px solid rgba(255,255,255,.28);border-radius:999px;background:rgba(255,255,255,.1);color:#fff;font:700 14px/1.2 inherit;font-family:inherit;cursor:pointer;transition:background .15s}
.vskip button:hover{background:rgba(243,197,93,.35);border-color:#f3c55d}.vskip button:active{transform:scale(.97)}
.vskip.wait button{opacity:.55}
dialog:not(.vp-dlg) + .vskip{margin-top:8px;border-radius:12px}
.vd-player + .vskip,.lc-screen + .vskip{margin-top:8px;border-radius:12px}`;
    document.head.append(css);
    scan(document.body);
    new MutationObserver((muts) => { for (const m of muts) { m.removedNodes.forEach(gone); m.addedNodes.forEach(scan); } }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) start(); else addEventListener("DOMContentLoaded", start);
})();
