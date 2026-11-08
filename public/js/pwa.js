// শিক্ষার্থী প্যানেলকে মোবাইল অ্যাপের মতো ইনস্টল করার ব্যবস্থা (PWA):
// ১) service worker চালু করা  ২) "অ্যাপ ইনস্টল করুন" বোতাম — ব্রাউজার সুযোগ দিলে (beforeinstallprompt) এক চাপে ইনস্টল;
// না দিলে (আগে বাদ দিলে / আনইনস্টল করার পর Chrome কিছুদিন সুযোগ দেয় না) বোতাম তবুও আসে, চাপলে ব্রাউজারের মেনু থেকে ইনস্টলের নিয়ম দেখায়
// ৩) আইফোনে (Safari) "হোম স্ক্রিনে যোগ করুন"-এর নিয়ম। অ্যাপ হিসেবে খোলা থাকলে বোতাম দেখায় না।
// "✕" দিলে শুধু এই ভিজিটের জন্য সরে — নতুন করে খুললে আবার আসে।
(function () {
  "use strict";
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const KEY = "sic-install-hide-visit"; // আগের ৭ দিনের লুকানো ("sic-install-hide") আর ধরা হয় না
  const hidden = () => { try { return sessionStorage.getItem(KEY) === "1"; } catch { return false; } };
  const hide = () => { try { sessionStorage.setItem(KEY, "1"); } catch {} };
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent); // iOS-এ শুধু Safari থেকে যোগ করা যায়
  let deferred = null, pill = null, goFn = null, native = false;

  function remove() { if (pill) { pill.remove(); pill = null; } }
  // label / কাজ বসানো; বোতাম আগে থেকে থাকলে শুধু কাজ বদলায় (যেমন নিয়ম-দেখানো থেকে সরাসরি ইনস্টলে)
  function show(label, fn) {
    goFn = fn;
    if (pill) { pill.querySelector(".pwa-go").textContent = `📲 ${label}`; return; }
    if (standalone() || hidden()) return;
    pill = document.createElement("div");
    pill.className = "pwa-pill no-print";
    pill.innerHTML = `<button type="button" class="pwa-go">📲 ${label}</button><button type="button" class="pwa-x" aria-label="বন্ধ করুন">✕</button>`;
    pill.querySelector(".pwa-go").onclick = () => goFn && goFn();
    pill.querySelector(".pwa-x").onclick = () => { hide(); remove(); const h = document.getElementById("pwaHelp"); if (h) h.remove(); };
    document.body.appendChild(pill);
  }
  function help(title, steps) {
    const old = document.getElementById("pwaHelp"); if (old) return old.remove();
    const d = document.createElement("div"); d.id = "pwaHelp"; d.className = "pwa-help no-print";
    d.innerHTML = `<b>${title}</b><ol>${steps.map((x) => `<li>${x}</li>`).join("")}</ol><button type="button">ঠিক আছে</button>`;
    d.querySelector("button").onclick = () => d.remove();
    document.body.appendChild(d);
  }

  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); deferred = e; native = true;
    show("অ্যাপ ইনস্টল করুন", async () => {
      if (!deferred) return;
      deferred.prompt();
      try { await deferred.userChoice; } catch {}
      deferred = null; remove();
    });
  });
  addEventListener("appinstalled", () => { deferred = null; remove(); });

  const whenReady = (fn) => (document.readyState === "complete" ? fn() : addEventListener("load", fn));
  if (ios && !standalone()) {
    whenReady(() => show("হোম স্ক্রিনে যোগ করুন", () => help("অ্যাপের মতো ব্যবহার করতে", ["Safari-র নিচের <b>শেয়ার</b> বোতাম (⬆️) চাপুন", '<b>"Add to Home Screen"</b> বাছুন', "<b>Add</b> চাপুন — হোম স্ক্রিনে আইকন বসে যাবে"])));
  } else if (!standalone()) {
    // ব্রাউজার ইনস্টলের সুযোগ না দিলেও বোতাম থাকে — চাপলে মেনু থেকে ইনস্টলের নিয়ম
    whenReady(() => setTimeout(() => {
      if (native || pill) return;
      show("অ্যাপ ইনস্টল করুন", () => help("অ্যাপ ইনস্টল করতে", ["Chrome-এর ওপরে ডানের <b>⋮</b> (তিন ফোঁটা) মেনু চাপুন", "<b>\"Install app\"</b> বা <b>\"Add to Home screen\"</b> বাছুন", "<b>Install</b> চাপুন — হোম স্ক্রিনে আইকন বসে যাবে"]));
    }, 2500));
  }
})();
