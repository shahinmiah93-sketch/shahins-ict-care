// কোর্স মডিউলের বিস্তারিত পাতা (/module?c=<id>) — বিস্তারিত, বৈশিষ্ট্য, অধ্যায় ও ফি, ইন্সট্রাক্টর, ক্লাসের রুটিন; পাশে কভার, ফি আর "কোর্সটি কিনুন"
(async function () {
  const { $, esc, bn, money } = U;
  const main = $("#mdMain"), side = $("#mdSide");
  // ছোট সবুজ আইকন (অংশের শিরোনামের পাশে)
  const ICON = {
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="18" r="1.2"/>',
    fee: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
    user: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="10" r="3"/><path d="M7 18c1-2.5 3-3.5 5-3.5s4 1 5 3.5"/>',
    clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
  };
  const ic = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
  const block = (k, title, body) => `<section class="md-sec"><h2>${ic(k)}${title}</h2>${body}</section>`;
  const check = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.7 2.7L16.5 9.5"/></svg>';

  let D;
  try { D = await U.api("/api/public"); } catch { main.innerHTML = '<p class="sub">সার্ভার চালু নেই। কিছুক্ষণ পরে চেষ্টা করুন।</p>'; return; }
  const S = D.settings || {};
  document.querySelectorAll("[data-s=name]").forEach((el) => (el.textContent = S.name || ""));
  $("#year").textContent = bn(new Date().getFullYear());
  $("#footAddr").textContent = [S.address, S.phone].filter(Boolean).join(" · ");
  if (S.phone) { $("#navPhone").href = "tel:" + S.phone; $("#navPhone span").textContent = S.phone; } else $("#navPhone").hidden = true;

  const id = new URLSearchParams(location.search).get("c");
  const i = D.courses.findIndex((x) => x.id === id), c = D.courses[i];
  if (!c) {
    $("#mdTitle").textContent = "মডিউল পাওয়া যায়নি";
    main.innerHTML = '<p class="sub">এই মডিউল এখন চালু নেই।</p><a class="btn gold" href="/#programs">সব কোর্স দেখুন →</a>';
    return;
  }
  const online = c.mode === "online";
  document.title = `${c.name} — ${S.name || "Shahin's ICT Care"}`;
  $("#mdEye").textContent = `${online ? "অনলাইন" : "অফলাইন"} কোর্স মডিউল${c.code ? " · Module - " + c.code : ""}`;
  $("#mdTitle").textContent = c.name;
  $("#mdLead").textContent = c.short || "";
  $("#mdMeta").innerHTML = [online ? "💻 অনলাইনে ক্লাস" : "🏫 কোচিংয়ে সরাসরি ক্লাস", c.duration && "⏳ " + c.duration, c.popular && "⭐ জনপ্রিয়"]
    .filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join("");

  const price = c.feeType === "monthly" ? `<b>${money(c.fee)}</b><small> / মাস</small>`
    : c.feeType === "chapter" ? ((c.chapters || []).length ? `<small>অধ্যায় প্রতি </small><b>${money(Math.min(...c.chapters.map((x) => x.fee)))}</b><small> থেকে</small>` : "")
    : `<b>${money(c.fee)}</b><small> এককালীন</small>`;
  const buy = `${online ? "/online-apply" : "/apply"}?c=${encodeURIComponent(c.id)}`;

  // ইন্সট্রাক্টর: অ্যাডমিনে বাছা শিক্ষক, না বাছলে প্রথম শিক্ষক
  const t = (D.teachers || []).find((x) => x.id === c.teacherId) || (D.teachers || [])[0];
  // রুটিন: PDF থাকলে বোতাম; অফলাইন মডিউলে সাথে চলতি ব্যাচের দিন-সময়
  const sessions = (D.sessions || []).map((s) => s.name).filter((n) => D.batches.some((b) => b.session === n));
  const batchTable = !online && sessions.length ? sessions.map((sn) => `<div class="md-sess"><span class="md-sname">${esc(sn)}</span>
      <div class="md-batches">${D.batches.filter((b) => b.session === sn).map((b) => `<div class="md-bt"><b>${esc(b.name)}</b><span>${esc(b.days || "—")}</span><span>${esc(b.time || "—")}</span><small class="${b.seatsLeft ? "" : "full"}">${b.seatsLeft ? bn(b.seatsLeft) + "টি সিট খালি" : "সিট পূর্ণ"}</small></div>`).join("")}</div></div>`).join("") : "";
  const routine = (c.routine ? `<a class="md-routine" href="/api/module/${encodeURIComponent(c.id)}/routine?v=${c.routine.v}" target="_blank" rel="noopener">ক্লাসের রুটিন দেখুন</a>` : "") + batchTable;

  // ভিডিও ক্লাসের তালিকা (শুধু নাম) — অধ্যায়ভিত্তিক হলে অধ্যায় ধরে, পাশে সেই অধ্যায়ের ফি; ভর্তি হলে শুধু কেনা অধ্যায়ের ক্লাস খোলে
  const LL = c.lessonList || [], chapOf = (id) => LL.filter((l) => l.chapter === id);
  const lesUl = (list) => `<ol class="md-les">${list.map((l) => `<li><span>▶</span>${esc(l.title)}</li>`).join("")}</ol>`;
  const curriculum = online && LL.length && block("list", "ভিডিও ক্লাসের তালিকা", c.feeType === "chapter" && (c.chapters || []).length
    ? `<p class="md-les-note">যে অধ্যায়গুলো কিনবেন, শুধু সেগুলোর ক্লাস আপনার প্যানেলে খুলবে।</p>${chapOf("").length ? `<div class="md-ch"><div class="md-ch-h"><b>সব অধ্যায়ের জন্য</b><small>${bn(chapOf("").length)}টি ক্লাস · যেকোনো অধ্যায় কিনলেই</small></div>${lesUl(chapOf(""))}</div>` : ""}
      ${c.chapters.map((x) => `<div class="md-ch"><div class="md-ch-h"><b>অধ্যায় ${esc(bn(x.id))} — ${esc(x.name)}</b><small>${bn(chapOf(x.id).length)}টি ক্লাস · ${money(x.fee)}</small></div>${chapOf(x.id).length ? lesUl(chapOf(x.id)) : '<p class="md-les-none">ক্লাস শীঘ্রই যোগ হবে</p>'}</div>`).join("")}`
    : lesUl(LL));
  main.innerHTML = [
    c.desc && block("book", "কোর্সের বিস্তারিত", `<p class="md-desc">${esc(c.desc)}</p>`),
    (c.features || []).length && block("list", "কোর্সের বৈশিষ্ট্য", `<ul class="md-feat">${c.features.map((f) => `<li>${check}<span>${esc(f)}</span></li>`).join("")}</ul>`),
    c.feeType === "chapter" && (c.chapters || []).length && block("fee", "অধ্যায় ও কোর্স ফি", `<table class="md-fees"><thead><tr><th>অধ্যায়</th><th>কোর্স ফি</th></tr></thead><tbody>${c.chapters.map((x) => `<tr><td><b>${esc(bn(x.id))}</b> ${esc(x.name.replace(/^অধ্যায়\s*[\d.০-৯]+:\s*/, ""))}</td><td>${money(x.fee)}</td></tr>`).join("")}</tbody></table>`),
    curriculum,
    t && block("user", "কোর্স ইন্সট্রাক্টর", `<div class="md-teacher">${t.photo ? `<span class="md-tph"><img src="${esc(t.photo)}" alt="${esc(t.name)}" loading="lazy"></span>` : ""}<div><b>${esc(t.name)}</b>${t.subject ? `<span>${esc(t.subject)}</span>` : ""}${t.bio ? `<p>${esc(t.bio)}</p>` : ""}</div></div>`),
    routine && block("clock", "ক্লাসের রুটিন", routine),
  ].filter(Boolean).join("") || '<p class="sub">এই মডিউলের বিস্তারিত শীঘ্রই যোগ হবে।</p>';

  side.hidden = false;
  side.innerHTML = `<div class="md-cover">${U.modCover(c, i)}</div>
    <p class="md-price">${price}</p>${c.duration ? `<p class="md-dur">⏳ ${esc(c.duration)}</p>` : ""}
    <div class="md-btns"><a class="md-buy" href="${buy}">কোর্সটি কিনুন</a>${S.phone ? `<a class="md-call" href="tel:${esc(S.phone)}">📞 ফোনে জানুন</a>` : ""}</div>`;
})();
