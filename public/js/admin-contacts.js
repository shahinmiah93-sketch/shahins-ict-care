// কল তালিকা (অনুপস্থিতি ও বকেয়া) — "কাকে কল করবেন": অভিভাবক · বাবা · মা · শিক্ষার্থী নিজে।
// শিক্ষার্থীর যে যে নম্বর আছে সবগুলো আলাদা পিলে দেখায় (একই নম্বর একবার, যেমন "অভিভাবক · বাবা");
// যেটা বাছা, তার নম্বরেই 📞 কল, 🟢 WhatsApp আর ✉ SMS যায়। বাছাই মনে থাকে, তালিকা আবার আঁকা হলেও।
window.SICContacts = (function () {
  "use strict";
  const { esc, bn } = U;
  const enNum = (s) => String(s || "").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d));
  const cleanPhone = (s) => enNum(s).replace(/\D/g, "").replace(/^88/, "");
  // [নাম, নম্বরের ঘর, ব্যক্তির নামের ঘর] — ক্রম: অভিভাবক, বাবা, মা, শিক্ষার্থী
  const ROLES = [["অভিভাবক", "guardianPhone", "guardianName"], ["বাবা", "fatherPhone", "fatherName"], ["মা", "motherPhone", "motherName"], ["শিক্ষার্থী", "phone", "name"]];
  const picked = new Map(); // সারি → কোন নম্বর বাছা

  // নম্বরের তালিকা (একই নম্বর একবার; লেবেল জোড়া: "অভিভাবক · বাবা")
  function list(s) {
    const out = [];
    for (const [label, pk, nk] of ROLES) {
      const p = cleanPhone(s[pk]); if (!/^01\d{9}$/.test(p)) continue;
      const hit = out.find((o) => o.p === p);
      if (hit) { hit.labels.push(label); if (!hit.name && s[nk]) hit.name = s[nk]; }
      else out.push({ p, labels: [label], name: s[nk] || "" });
    }
    return out.map((o) => ({ p: o.p, label: o.labels.join(" · "), name: o.name }));
  }
  function current(s, key) { const l = list(s); return l.length ? l[Math.min(picked.get(key) || 0, l.length - 1)] : null; }
  function pick(key, i) { picked.set(key, i); }

  // extra = নম্বরের পাশে বাড়তি বাটন (যেমন "💵 পেমেন্ট নিন")
  function html(s, key, msg, extra = "") {
    const l = list(s), idx = l.length ? Math.min(picked.get(key) || 0, l.length - 1) : -1, now = idx >= 0 ? l[idx] : null;
    if (!now) return `<div class="ab-guard"><span class="ab-warn">কোনো মোবাইল নম্বর নেই — শিক্ষার্থীর প্রোফাইলে নম্বর যোগ করুন</span>${extra ? `<div class="ab-call-row">${extra}</div>` : ""}</div>`;
    return `<div class="ab-guard">
      ${l.length > 1 ? `<div class="ab-who" role="group" aria-label="কাকে কল করবেন">${l.map((o, i) => `<button type="button" class="${i === idx ? "on" : ""}" data-who="${i}" title="${esc(o.name || "")}"><b>${esc(o.label)}</b><small>${bn(o.p)}</small></button>`).join("")}</div>` : ""}
      <div class="ab-call-row">
        <div><small>${esc(now.label)}${now.name ? ` · ${esc(now.name)}` : ""}</small><br><a class="ab-num" href="tel:${now.p}">${bn(now.p)}</a></div>
        <a class="ab-btn call" href="tel:${now.p}">📞 কল</a>
        <a class="ab-btn wa" target="_blank" rel="noopener" href="https://wa.me/88${now.p}?text=${encodeURIComponent(msg)}">🟢 WhatsApp</a>
        <button type="button" class="ab-btn" data-sms data-phone="${now.p}" title="${esc(now.label)}-এর মোবাইলে সরাসরি SMS পাঠান">✉ SMS পাঠান</button>
        ${extra}
      </div>
    </div>`;
  }
  return { list, current, pick, html };
})();
