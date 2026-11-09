// বই ও শিট (/books) — অনলাইনে অর্ডার: বই কার্টে নেওয়া, তারপর নাম, মোবাইল, বিভাগ → জেলা, ঠিকানা দিয়ে অর্ডার।
// টাকা পণ্য হাতে পেয়ে (ক্যাশ অন ডেলিভারি); ডেলিভারি চার্জ জেলা অনুযায়ী (অফিস থেকে নিলে ০)। নিচে অর্ডার নম্বর + মোবাইল দিয়ে অবস্থা দেখা।
(async () => {
  const $ = (s, r = document) => r.querySelector(s);
  const { esc, bn, money } = U;
  const main = $("#bks");
  $("#year").textContent = bn(new Date().getFullYear());
  const KEY = "sic-book-cart";
  const KIND = { book: "বই", sheet: "লেকচার শিট" };
  let D, cart = {}, form = { name: "", phone: "", studentId: "", pickup: false, division: "", district: "", area: "", address: "", note: "" }, busy = false;
  try { cart = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { cart = {}; }
  const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch {} };

  try { D = await U.api("/api/books"); }
  catch { main.innerHTML = '<p class="bks-load">লোড করা যায়নি — একটু পরে আবার চেষ্টা করুন।</p>'; return; }
  if (D.phone) { $("#navPhone").href = "tel:" + D.phone; $("#navPhone span").textContent = D.phone; } else $("#navPhone").hidden = true;
  // কার্টে শুধু এখনো পাওয়া যায় এমন বই
  for (const id of Object.keys(cart)) { const b = D.items.find((x) => x.id === id); if (!b || !b.inStock || !(cart[id] > 0)) delete cart[id]; }
  keep();

  const byId = (id) => D.items.find((b) => b.id === id);
  const lines = () => Object.entries(cart).map(([id, qty]) => ({ b: byId(id), qty })).filter((l) => l.b);
  const ship = () => (form.pickup && D.ship.pickup ? 0 : !form.district ? null : form.district === D.ship.home ? D.ship.inside : D.ship.outside);

  function card(b) {
    const q = cart[b.id] || 0;
    return `<article class="bk-card${b.inStock ? "" : " out"}">
      <div class="bk-cv" data-open="${b.id}" role="button" tabindex="0" aria-label="${esc(b.title)} — বিস্তারিত দেখুন">${b.cover ? `<img src="${esc(b.cover)}" alt="" loading="lazy">` : `<div class="bk-cv-ph"><span>${b.kind === "sheet" ? "📄" : "📘"}</span><b>${esc(b.title)}</b></div>`}<span class="bk-kind">${KIND[b.kind] || "বই"}</span>${b.oldPrice > b.price ? `<span class="bk-off">${bn(Math.round((1 - b.price / b.oldPrice) * 100))}% ছাড়</span>` : ""}</div>
      <div class="bk-cb"><h3 data-open="${b.id}">${esc(b.title)}</h3>${b.author ? `<small>${esc(b.author)}</small>` : ""}${b.short ? `<button type="button" class="bk-more" data-open="${b.id}">বিবরণ দেখুন →</button>` : ""}
        <div class="bk-price"><b>${b.price ? money(b.price) : "ফ্রি"}</b>${b.oldPrice > b.price ? `<s>${money(b.oldPrice)}</s>` : ""}${b.left ? `<em>মাত্র ${bn(b.left)}টি বাকি</em>` : ""}</div>
        ${!b.inStock ? '<span class="bk-none">স্টক শেষ</span>' : q ? `<div class="bk-step"><button type="button" data-dec="${b.id}" aria-label="কম">−</button><b>${bn(q)}</b><button type="button" data-inc="${b.id}" aria-label="বেশি">+</button></div>` : `<button type="button" class="btn gold bk-add" data-inc="${b.id}">কার্টে যোগ করুন</button>`}</div></article>`;
  }

  // বইয়ের বিবরণের পপআপ: বড় ছবি, নাম, লেখক, দাম, ছোট বিবরণ, কার্টে যোগ করার বোতাম
  function openBook(id) {
    const b = byId(id); if (!b) return;
    const d = document.createElement("dialog"); d.className = "bk-dlg";
    const desc = String(b.short || "").split(/\n{2,}|\r?\n/).map((x) => x.trim()).filter(Boolean).map((x) => `<p>${esc(x)}</p>`).join("");
    d.innerHTML = `<button type="button" class="bk-dx" aria-label="বন্ধ করুন">✕</button>
      <div class="bk-dcv">${b.cover ? `<img src="${esc(b.cover)}" alt="${esc(b.title)}">` : `<div class="bk-cv-ph"><span>${b.kind === "sheet" ? "📄" : "📘"}</span></div>`}</div>
      <div class="bk-dbody"><span class="bk-kind2">${KIND[b.kind] || "বই"}</span><h3>${esc(b.title)}</h3>${b.author ? `<small>${esc(b.author)}</small>` : ""}
        <div class="bk-price"><b>${b.price ? money(b.price) : "ফ্রি"}</b>${b.oldPrice > b.price ? `<s>${money(b.oldPrice)}</s><span class="bk-off2">${bn(Math.round((1 - b.price / b.oldPrice) * 100))}% ছাড়</span>` : ""}${b.left ? `<em>মাত্র ${bn(b.left)}টি বাকি</em>` : ""}</div>
        ${desc ? `<div class="bk-ddesc">${desc}</div>` : ""}
        ${!b.inStock ? '<span class="bk-none">স্টক শেষ</span>' : `<button type="button" class="btn gold bk-dadd">কার্টে যোগ করুন</button>`}</div>`;
    document.body.append(d);
    d.addEventListener("close", () => d.remove());
    d.addEventListener("click", (e) => {
      if (e.target === d || e.target.closest(".bk-dx")) return d.close();
      if (e.target.closest(".bk-dadd")) { cart[id] = Math.min(20, (cart[id] || 0) + 1); keep(); reCard(id); reCart(); d.close(); }
    });
    d.showModal();
  }

  function cartHtml() {
    const L = lines(), sub = L.reduce((a, l) => a + l.qty * l.b.price, 0), sh = ship();
    if (!L.length) return `<aside class="bk-cart empty" id="cart"><h2>🛒 আপনার কার্ট</h2><p>কার্ট খালি — উপর থেকে বই বা শিট বেছে "কার্টে যোগ করুন" চাপুন।</p></aside>`;
    const geo = D.geo, dists = form.division ? geo[form.division] || [] : [];
    return `<aside class="bk-cart" id="cart"><h2>🛒 আপনার কার্ট <small>${bn(L.reduce((a, l) => a + l.qty, 0))}টি</small></h2>
      <ul class="bk-lines">${L.map((l) => `<li><span>${esc(l.b.title)} <small>× ${bn(l.qty)}</small></span><b>${money(l.qty * l.b.price)}</b><button type="button" data-rm="${l.b.id}" aria-label="বাদ দিন">✕</button></li>`).join("")}</ul>
      <form class="bk-form" id="orderForm" novalidate>
        <h3>ডেলিভারির তথ্য</h3>
        <label>আপনার নাম *<input name="name" value="${esc(form.name)}" autocomplete="name" required></label>
        <label>মোবাইল নম্বর *<input name="phone" value="${esc(form.phone)}" inputmode="tel" autocomplete="tel" placeholder="01XXXXXXXXX" required></label>
        <label>শিক্ষার্থী আইডি <small>(আমাদের শিক্ষার্থী হলে — ঐচ্ছিক)</small><input name="studentId" value="${esc(form.studentId)}" placeholder="যেমন: 270001"></label>
        ${D.ship.pickup ? `<div class="bk-how"><label class="${!form.pickup ? "on" : ""}"><input type="radio" name="pickup" value="0"${!form.pickup ? " checked" : ""}> 🚚 হোম ডেলিভারি</label><label class="${form.pickup ? "on" : ""}"><input type="radio" name="pickup" value="1"${form.pickup ? " checked" : ""}> 🏢 অফিস থেকে নেব (ফ্রি)</label></div>` : ""}
        ${form.pickup && D.ship.pickup ? "" : `<div class="bk-two"><label>বিভাগ *<select name="division" required><option value="">— বিভাগ —</option>${Object.keys(geo).map((d) => `<option${d === form.division ? " selected" : ""}>${esc(d)}</option>`).join("")}</select></label>
          <label>জেলা *<select name="district" required${form.division ? "" : " disabled"}><option value="">${form.division ? "— জেলা —" : "আগে বিভাগ"}</option>${dists.map((d) => `<option${d === form.district ? " selected" : ""}>${esc(d)}</option>`).join("")}</select></label></div>
          <label>থানা / উপজেলা / এলাকা<input name="area" value="${esc(form.area)}" placeholder="যেমন: মিরপুর"></label>
          <label>পূর্ণ ঠিকানা *<textarea name="address" rows="2" placeholder="গ্রাম / রাস্তা, বাড়ি নম্বর, কাছের পরিচিত জায়গা" required>${esc(form.address)}</textarea></label>`}
        <label>নোট <small>(ঐচ্ছিক)</small><input name="note" value="${esc(form.note)}" placeholder="যেমন: বিকালে ফোন দেবেন"></label>
        <input name="website" class="bk-trap" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div class="bk-total"><span>বই / শিট <b>${money(sub)}</b></span><span>ডেলিভারি চার্জ <b>${sh === null ? "জেলা বাছলে দেখাবে" : sh ? money(sh) : "ফ্রি"}</b></span><span class="grand">মোট <b>${money(sub + (sh || 0))}</b></span></div>
        <p class="bk-cod">💵 টাকা পণ্য হাতে পেয়ে দেবেন (ক্যাশ অন ডেলিভারি)।${D.ship.note ? " " + esc(D.ship.note) : ""}</p>
        <p class="bk-err" id="orderErr"></p>
        <button class="btn gold bk-go" type="submit"${busy ? " disabled" : ""}>${busy ? "অর্ডার হচ্ছে…" : "✓ অর্ডার নিশ্চিত করুন"}</button>
      </form></aside>`;
  }

  function trackHtml(r) {
    return `<section class="bk-track" id="track"><h2>অর্ডারের অবস্থা দেখুন</h2>
      <form class="bk-tf" id="trackForm"><input name="no" placeholder="অর্ডার নম্বর (যেমন 1001)" inputmode="numeric" required><input name="phone" placeholder="যে মোবাইলে অর্ডার করেছেন" inputmode="tel" required><button class="btn gold" type="submit">দেখুন</button></form>
      <div id="trackOut">${r || ""}</div></section>`;
  }

  function render() {
    const scroll = scrollY;
    main.innerHTML = `<section class="dl-hero bks-hero"><div class="wrap"><span class="dl-free">🚚 সারা দেশে হোম ডেলিভারি · টাকা পণ্য হাতে পেয়ে</span>
        <h1>বই ও লেকচার শিট <small>Books &amp; Sheets</small></h1><p>Shahin Sir-এর বই আর লেকচার শিট ঘরে বসে অর্ডার করুন।</p></div></section>
      <div class="wrap bks-wrap"><div class="bk-grid">${D.items.map(card).join("") || '<p class="bks-load">এখন অনলাইনে অর্ডারের মতো কোনো বই নেই — শিগগিরই আসছে।</p>'}</div>${cartHtml()}</div>
      <div class="wrap">${trackHtml()}</div>`;
    scrollTo(0, scroll);
    if (location.hash === "#track") $("#track").scrollIntoView();
  }
  const reCart = () => { const c = $("#cart"); if (c) c.outerHTML = cartHtml(); };
  const reCard = (id) => { const el = $(`[data-inc="${id}"],[data-dec="${id}"]`); const art = el && el.closest(".bk-card"); if (art) art.outerHTML = card(byId(id)); };

  main.addEventListener("click", (e) => {
    const t = (s) => e.target.closest(s); let el;
    if ((el = t("[data-open]"))) return openBook(el.dataset.open);
    if ((el = t("[data-inc]"))) { const id = el.dataset.inc; cart[id] = Math.min(20, (cart[id] || 0) + 1); keep(); reCard(id); return reCart(); }
    if ((el = t("[data-dec]"))) { const id = el.dataset.dec; cart[id] = (cart[id] || 0) - 1; if (cart[id] <= 0) delete cart[id]; keep(); reCard(id); return reCart(); }
    if ((el = t("[data-rm]"))) { const id = el.dataset.rm; delete cart[id]; keep(); reCard(id); return reCart(); }
  });
  main.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches(".bk-cv[data-open]")) { e.preventDefault(); openBook(e.target.dataset.open); } });
  main.addEventListener("input", (e) => { const f = e.target.form; if (f && f.id === "orderForm" && e.target.name in form && e.target.type !== "radio" && e.target.tagName !== "SELECT") form[e.target.name] = e.target.value; });
  main.addEventListener("change", (e) => {
    const n = e.target.name; if (!e.target.form || e.target.form.id !== "orderForm") return;
    if (n === "pickup") { form.pickup = e.target.value === "1"; return reCart(); }
    if (n === "division") { form.division = e.target.value; form.district = ""; return reCart(); }
    if (n === "district") { form.district = e.target.value; return reCart(); }
  });
  main.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.id === "trackForm") {
      const out = $("#trackOut");
      try {
        const r = await U.api(`/api/books/track?${new URLSearchParams({ no: f.no.value, phone: f.phone.value })}`);
        out.innerHTML = `<div class="bk-tr"><b>অর্ডার #${bn(r.orderNo)}</b> <span class="bk-st st-${esc(r.status)}">${esc(r.statusName)}</span><ul>${r.lines.map((l) => `<li>${esc(l.title)} × ${bn(l.qty)} <span>${money(l.qty * l.price)}</span></li>`).join("")}<li>ডেলিভারি <span>${money(r.delivery)}</span></li><li class="g">মোট <span>${money(r.total)}</span></li></ul></div>`;
      } catch (er) { out.innerHTML = `<p class="bk-err">${esc(er.message)}</p>`; }
      return;
    }
    if (f.id !== "orderForm" || busy) return;
    const err = $("#orderErr"); err.textContent = "";
    const body = { ...form, phone: form.phone.trim(), items: lines().map((l) => ({ id: l.b.id, qty: l.qty })), website: f.website.value };
    if (form.name.trim().length < 2) return (err.textContent = "আপনার নাম লিখুন");
    if (!/^01\d{9}$/.test(body.phone.replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d)).replace(/\D/g, "").replace(/^88/, ""))) return (err.textContent = "সঠিক মোবাইল নম্বর দিন (০১ দিয়ে শুরু, ১১ সংখ্যা)");
    if (!(form.pickup && D.ship.pickup)) {
      if (!form.division) return (err.textContent = "বিভাগ বেছে নিন");
      if (!form.district) return (err.textContent = "জেলা বেছে নিন");
      if (form.address.trim().length < 5) return (err.textContent = "পূর্ণ ঠিকানা লিখুন");
    }
    busy = true; f.querySelector(".bk-go").disabled = true; f.querySelector(".bk-go").textContent = "অর্ডার হচ্ছে…";
    try {
      const r = await U.api("/api/books/order", { body });
      cart = {}; keep(); busy = false;
      D = await U.api("/api/books").catch(() => D);
      render();
      $("#cart").outerHTML = `<aside class="bk-cart done" id="cart"><div class="bk-ok">✓</div><h2>অর্ডার হয়েছে!</h2>
        <p>আপনার অর্ডার নম্বর <b class="bk-no">#${bn(r.orderNo)}</b></p><p>মোট ${money(r.total)}${r.delivery ? ` (ডেলিভারি ${money(r.delivery)} সহ)` : ""} — পণ্য হাতে পেয়ে দেবেন।</p>
        <p>আমরা শিগগিরই ${esc(body.phone)} নম্বরে ফোন করে নিশ্চিত করব। নম্বরটা লিখে রাখুন — নিচে "অর্ডারের অবস্থা" থেকে দেখতে পারবেন।</p>
        <button type="button" class="btn ghost" onclick="location.reload()">আরও অর্ডার করুন</button></aside>`;
      $("#cart").scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (er) {
      busy = false; err.textContent = er.message;
      const b = f.querySelector(".bk-go"); b.disabled = false; b.textContent = "✓ অর্ডার নিশ্চিত করুন";
    }
  });

  render();
})();
