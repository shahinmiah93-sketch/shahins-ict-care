// শিক্ষার্থী অ্যাপের (PWA) service worker।
// নিয়ম: /api (PIN, ছবি, ফলাফল — সব ব্যক্তিগত তথ্য) কখনো জমা রাখা হয় না — সবসময় সরাসরি সার্ভার থেকে।
// পাতা খোলা: আগে ইন্টারনেট; না থাকলে "ইন্টারনেট নেই" পাতা। CSS / JS / ছবি / ফন্ট: আগের কপি দেখিয়ে পেছনে নতুনটা এনে রাখে।
// অ্যাডমিন পাতা আর তার স্ক্রিপ্টে হাত দেয় না।
const VERSION = "sic-pwa-v1";
const SHELL = ["/offline.html", "/pwa-192.png", "/images/logo-nav.png"];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const STATIC = /^\/(css|js|fonts|images|vendor)\//;
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  const p = url.pathname;
  if (p.startsWith("/api/") || p.startsWith("/admin") || p.startsWith("/js/admin") || req.headers.has("range")) return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }
  if (STATIC.test(p) || p === "/manifest.webmanifest" || /^\/(pwa|favicon|apple-touch)/.test(p)) {
    e.respondWith(caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(req);
      const net = fetch(req).then((r) => { if (r && r.ok) cache.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});
