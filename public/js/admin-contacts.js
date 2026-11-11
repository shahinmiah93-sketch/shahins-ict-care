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

  // টানা অনুপস্থিতি: শেষ হাজিরার দিন থেকে পেছনে পরপর কতগুলো ক্লাসে অনুপস্থিত (ছুটি বাদ; একই দিনে কোথাও উপস্থিত থাকলে উপস্থিত)।
  // ফেরত: { n: টানা কয়টা, last: সর্বশেষ হাজিরার তারিখ }
  function streak(attendance, sid, date) {
    const byDate = {};
    for (const [key, marks] of Object.entries(attendance || {})) {
      const st = marks[sid]; if (st !== "P" && st !== "A") continue;
      const d = key.split("|")[0]; if (d <= date && byDate[d] !== "P") byDate[d] = st;
    }
    const days = Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0]));
    let n = 0; for (const [, st] of days) { if (st !== "A") break; n++; }
    return { n, last: days.length ? days[0][0] : "" };
  }

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
  function callDrafts(keyOf, statusSelector, statusKey) {
    const drafts = new Map(), pending = new Set();
    const fields = [".ab-reason", ".ab-note", ".ab-fu", ".ab-pd"];
    const paint = (row, draft) => {
      if (draft) {
        for (const [selector, value] of Object.entries(draft.fields)) {
          const input = row.querySelector(selector);
          if (input) input.value = value;
        }
        row.querySelectorAll(statusSelector).forEach((button) => {
          const selected = button.dataset[statusKey] === draft.status;
          button.classList.toggle("on", selected);
          button.setAttribute("aria-pressed", String(selected));
        });
        const followUp = row.querySelector(".ab-fu-wrap:not(.ab-pd-wrap)");
        const promise = row.querySelector(".ab-pd-wrap");
        if (followUp) followUp.hidden = draft.status !== "later";
        if (promise) promise.hidden = draft.status !== "promised";
      }
      row.querySelector("[data-call-save]").disabled = pending.has(keyOf(row));
      row.querySelector(".ab-save-status").textContent = draft ? "পরিবর্তন সেভ হয়নি" : "";
    };
    const remember = (row, status) => {
      const draft = { status, fields: {} };
      for (const selector of fields) {
        const input = row.querySelector(selector);
        if (input) draft.fields[selector] = input.value;
      }
      drafts.set(keyOf(row), draft);
      paint(row, draft);
    };
    const get = (row) => drafts.get(keyOf(row));
    const restore = (host) => host.querySelectorAll(".ab-row").forEach((row) => paint(row, get(row)));
    const save = async (row, persist, toast) => {
      const key = keyOf(row), draft = get(row);
      if (!draft || pending.has(key)) return;
      if (!draft.status && !row.dataset.savedStatus) return toast("আগে কলের অবস্থা বেছে নিন", true);
      pending.add(key);
      paint(row, draft);
      try {
        await persist(row, draft.status);
        if (get(row) === draft) drafts.delete(key);
        return true;
      } catch (error) { toast(error.message, true); }
      finally { pending.delete(key); paint(row, get(row)); }
    };
    return { get, remember, restore, save };
  }
  return { slots, pick, html, streak, callDrafts };
})();
