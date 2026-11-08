// কল তালিকা (অনুপস্থিতি ও বকেয়া) — "কাকে কল করবেন": অভিভাবক · মা · শিক্ষার্থী নিজে (বাবার আলাদা নম্বর থাকলে বাবাও)।
// অভিভাবক, মা, শিক্ষার্থী — এই তিনটা ঘর সবসময় থাকে; নম্বর না থাকলে ঘরটা ফাঁকা (ধূসর, চাপা যায় না), নম্বর থাকলে নম্বর দেখায়।
// যেটা বাছা, তার নম্বরেই 📞 কল, 🟢 WhatsApp আর ✉ SMS যায়। বাছাই মনে থাকে, তালিকা আবার আঁকা হলেও।
window.SICContacts = (function () {
  "use strict";
  const { esc, bn } = U;
  const enNum = (s) => String(s || "").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d));
  const cleanPhone = (s) => enNum(s).replace(/\D/g, "").replace(/^88/, "");
  const valid = (p) => (/^01\d{9}$/.test(p) ? p : "");
  const picked = new Map(); // সারি → কোন ঘর বাছা

  // ঘরের তালিকা: [অভিভাবক, (বাবা — আলাদা নম্বর থাকলে), মা, শিক্ষার্থী]; নম্বর না থাকলে p = ""
  function slots(s) {
    const g = valid(cleanPhone(s.guardianPhone)), f = valid(cleanPhone(s.fatherPhone)), m = valid(cleanPhone(s.motherPhone)), st = valid(cleanPhone(s.phone));
    const out = [{ label: "অভিভাবক", p: g, name: s.guardianName || (f && f === g ? s.fatherName : "") || "" }];
    if (f && f !== g) out.push({ label: "বাবা", p: f, name: s.fatherName || "" });
    out.push({ label: "মা", p: m, name: s.motherName || "" }, { label: "শিক্ষার্থী", p: st, name: s.name || "" });
    return out;
  }
  function pick(key, i) { picked.set(key, i); }

  // extra = নম্বরের পাশে বাড়তি বাটন (যেমন "💵 পেমেন্ট নিন")
  function html(s, key, msg, extra = "") {
    const sl = slots(s), first = sl.findIndex((o) => o.p);
    if (first < 0) return `<div class="ab-guard ab-card"><span class="ab-warn">কোনো মোবাইল নম্বর নেই — শিক্ষার্থীর প্রোফাইলে নম্বর যোগ করুন</span>${extra ? `<div class="ab-call-row">${extra}</div>` : ""}</div>`;
    let idx = picked.get(key); if (idx == null || !sl[idx] || !sl[idx].p) idx = first;
    const now = sl[idx];
    // নকশা: ওপরে "কাকে কল করবেন" বাছার সুইচ (তিনটা ঘর সবসময়) → মাঝে তিনটা বড় বাটন (কল / WhatsApp / SMS) → নিচে সবুজ পট্টিতে যাকে বাছা তার নাম ও নম্বর
    const icon = { "অভিভাবক": "👤", "বাবা": "👨", "মা": "👩", "শিক্ষার্থী": "🎓" }[now.label] || "📱";
    const pill = (o, i) => o.p
      ? `<button type="button" class="${i === idx ? "on" : ""}" data-who="${i}" title="${esc(o.name || "")}"><b>${esc(o.label)}</b><small>${bn(o.p)}</small></button>`
      : `<button type="button" class="empty" disabled aria-disabled="true" title="${esc(o.label)}-এর নম্বর দেওয়া নেই"><b>${esc(o.label)}</b><small>&nbsp;</small></button>`;
    return `<div class="ab-guard ab-card">
      <div class="ab-who" role="group" aria-label="কাকে কল করবেন">${sl.map(pill).join("")}</div>
      <div class="ab-actions">
        <a class="ab-btn call" href="tel:${now.p}">📞 কল</a>
        <a class="ab-btn wa" target="_blank" rel="noopener" href="https://wa.me/88${now.p}?text=${encodeURIComponent(msg)}">🟢 WhatsApp</a>
        <button type="button" class="ab-btn" data-sms data-phone="${now.p}" title="${esc(now.label)}-এর মোবাইলে সরাসরি SMS পাঠান">✉ SMS পাঠান</button>
        ${extra}
      </div>
      <div class="ab-ident"><i class="ab-av">${icon}</i><div><small>${esc(now.label)}${now.name ? ` · ${esc(now.name)}` : ""}</small><a class="ab-num" href="tel:${now.p}">${bn(now.p)}</a></div></div>
    </div>`;
  }
  return { slots, pick, html };
})();
