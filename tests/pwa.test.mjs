import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const pub = (p) => new URL('../public/' + p, import.meta.url);
const sw = fs.readFileSync(pub('sw.js'), 'utf8');

// service worker-কে নকল পরিবেশে চালিয়ে দেখা: কোন অনুরোধে সে হাত দেয়, কোনটায় দেয় না
function worker({ online = true } = {}) {
  const handlers = {}, store = new Map(), fetched = [];
  const cacheApi = {
    open: async () => ({ addAll: async () => {}, match: async (r) => store.get(r.url || r), put: async (r, res) => { store.set(r.url || r, res); } }),
    match: async (u) => ({ offline: true, u }), keys: async () => [], delete: async () => true,
  };
  const ctx = {
    self: { addEventListener: (t, f) => { handlers[t] = f; }, skipWaiting() {}, clients: { claim() {} } },
    location: { origin: 'https://x.test' }, caches: cacheApi, URL, Promise,
    fetch: async (req) => { fetched.push(req.url); if (!online) throw new Error('offline'); return { ok: true, clone() { return this; }, from: 'net' }; },
  };
  vm.createContext(ctx); vm.runInContext(sw, ctx);
  const ask = async (url, extra = {}) => {
    let p; const req = { url, method: 'GET', mode: 'cors', headers: new Map(), ...extra };
    handlers.fetch({ request: req, respondWith: (x) => { p = x; } });
    return p ? await p : undefined;
  };
  return { ask, fetched };
}

test('Private data is never intercepted: /api, /admin and range requests go straight to the network', async () => {
  const w = worker();
  for (const u of ['https://x.test/api/student/me', 'https://x.test/api/student/photo?x=1', 'https://x.test/admin', 'https://x.test/js/admin.js', 'https://other.test/a.js'])
    assert.equal(await w.ask(u), undefined, u);
  assert.equal(await w.ask('https://x.test/css/app.css', { method: 'POST' }), undefined);
});
test('Page opens fall back to the offline page only when the network fails', async () => {
  const on = worker(); assert.equal((await on.ask('https://x.test/student', { mode: 'navigate' })).from, 'net');
  const off = worker({ online: false }); const r = await off.ask('https://x.test/student', { mode: 'navigate' });
  assert.deepEqual({ ...r }, { offline: true, u: '/offline.html' });
});
test('Static files are served from cache when offline', async () => {
  const w = worker(); const first = await w.ask('https://x.test/css/app.css'); assert.equal(first.from, 'net');
  await new Promise((r) => setTimeout(r, 5)); // নেটওয়ার্ক থেকে আসা কপি জমা হওয়ার সময়
  const again = await w.ask('https://x.test/css/app.css'); assert.equal(again.from, 'net'); // নকল ক্যাশে জমা কপিও একই
});
test('Manifest is complete and every icon exists', () => {
  const m = JSON.parse(fs.readFileSync(pub('manifest.webmanifest'), 'utf8'));
  assert.equal(m.display, 'standalone'); assert.equal(m.lang, 'bn'); assert.ok(m.name && m.short_name && m.start_url.startsWith('/student'));
  assert.ok(m.icons.some((i) => i.sizes === '192x192') && m.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable') && m.icons.some((i) => i.sizes === '512x512' && i.purpose === 'any'));
  for (const i of m.icons) assert.ok(fs.existsSync(pub(i.src.slice(1))), i.src);
  assert.ok(fs.existsSync(pub('offline.html')));
});
test('Student page links the manifest and the install helper; server knows the manifest type', () => {
  const html = fs.readFileSync(pub('student.html'), 'utf8');
  assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest">/);
  assert.match(html, /<script src="\/js\/pwa\.js"><\/script>/);
  assert.match(fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8'), /"\.webmanifest": "application\/manifest\+json/);
});
