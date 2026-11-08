// শিক্ষার্থী প্যানেলকে মোবাইল অ্যাপের মতো ইনস্টল করার ব্যবস্থা (PWA):
// ১) service worker চালু করা  ২) অ্যান্ড্রয়েড/ক্রোমে "অ্যাপ ইনস্টল করুন" বোতাম  ৩) আইফোনে (Safari) "হোম স্ক্রিনে যোগ করুন"-এর নিয়ম দেখানো।
// অ্যাপ হিসেবে খোলা থাকলে বোতাম দেখায় না; "✕" দিলে ৭ দিন আর বিরক্ত করে না।
(function () {
  "use strict";
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const KEY = "sic-install-hide";
  const hidden = () => { try { return Date.now() - Number(localStorage.getItem(KEY) || 0) < 7 * 864e5; } catch { return false; } };
  const hide = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch {} };
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent); // iOS-এ শুধু Safari থেকে যোগ করা যায়
  let deferred = null, pill = null;

  function show(label, onGo) {
    if (pill || standalone() || hidden()) return;
    pill = document.createElement("div");
    pill.className = "pwa-pill no-print";
    pill.innerHTML = `<button type="button" class="pwa-go">📲 ${label}</button><button type="button" class="pwa-x" aria-label="বন্ধ করুন">✕</button>`;
    pill.querySelector(".pwa-go").onclick = onGo;
    pill.querySelector(".pwa-x").onclick = () => { hide(); remove(); };
    document.body.appendChild(pill);
  }
  function remove() { if (pill) { pill.remove(); pill = null; } }

  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); deferred = e;
    show("অ্যাপ ইনস্টল করুন", async () => {
      if (!deferred) return;
      deferred.prompt();
      try { await deferred.userChoice; } catch {}
      deferred = null; remove();
    });
  });
  addEventListener("appinstalled", () => { deferred = null; remove(); });

  if (ios && !standalone()) {
    const go = () => show("হোম স্ক্রিনে যোগ করুন", () => {
      const old = document.getElementById("pwaHelp"); if (old) return old.remove();
      const d = document.createElement("div"); d.id = "pwaHelp"; d.className = "pwa-help no-print";
      d.innerHTML = `<b>অ্যাপের মতো ব্যবহার করতে</b><ol><li>Safari-র নিচের <b>শেয়ার</b> বোতাম (⬆️) চাপুন</li><li><b>"Add to Home Screen"</b> বাছুন</li><li><b>Add</b> চাপুন — হোম স্ক্রিনে আইকন বসে যাবে</li></ol><button type="button">ঠিক আছে</button>`;
      d.querySelector("button").onclick = () => d.remove();
      document.body.appendChild(d);
    });
    if (document.readyState === "complete") go(); else addEventListener("load", go);
  }
})();
