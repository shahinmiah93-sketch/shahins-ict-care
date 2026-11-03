// তারিখ বাছাইয়ের ক্যালেন্ডার (বাংলায়) — উপরে বাছাই করা তারিখ বড় করে, মাস / বছর বদলানো, শুক্রবার আলাদা রঙে, আজ গোল দাগে।
// আসল <input type="date"> ফর্মেই থাকে (লুকানো), তাই ফর্ম জমা আর .value পড়া আগের মতোই কাজ করে।
// যে পাতায় দরকার সেখানে এই ফাইলটা জুড়লেই পাতার সব তারিখের ঘর এই ক্যালেন্ডারে খোলে।
// মাসের ঘর (<input type="month">) একই ক্যালেন্ডারে খোলে, শুধু মাসের তালিকা দেখায়।
(() => {
  "use strict";
  const SEL = 'input[type="date"],input[type="month"]';
  const VALUE = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  const bn = (v) => String(v).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
  const MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
  const DAYS = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"], WD = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
  const pad = (n) => String(n).padStart(2, "0"), iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const todayIso = () => { const t = new Date(); return iso(t.getFullYear(), t.getMonth(), t.getDate()); };
  const parse = (v) => { const m = String(v || "").match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/); return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] || 1 } : null; };
  const nice = (v, isMonth) => { const p = parse(v); return !p ? "" : isMonth ? `${MONTHS[p.m]} ${bn(p.y)}` : `${bn(p.d)} ${MONTHS[p.m]} ${bn(p.y)}, ${WD[new Date(p.y, p.m, p.d).getDay()]}`; };

  const dlg = document.createElement("dialog"); dlg.className = "sdp"; document.body.append(dlg);
  let input = null, view = "days", vy = 0, vm = 0, sel = "";
  const isMonth = () => !!input && input.type === "month";
  const head = () => { const p = parse(sel); if (isMonth()) return `<header class="sdp-head"><small>${input.dataset.dpTitle || "মাস বেছে নিন"}</small><b>${p ? MONTHS[p.m] : input.dataset.dpEmpty || "—"}</b><span>${p ? bn(p.y) : "কোনো মাস বাছাই নেই"}</span></header>`; return `<header class="sdp-head"><small>${input && input.dataset.dpTitle || "তারিখ বেছে নিন"}</small><b>${p ? `${bn(p.d)} ${MONTHS[p.m]}` : "—"}</b><span>${p ? `${WD[new Date(p.y, p.m, p.d).getDay()]} · ${bn(p.y)}` : "এখনো বাছাই হয়নি"}</span></header>`; };
  function body() {
    const min = input && input.min || "", max = input && input.max || "", t = todayIso(), now = new Date();
    if (view === "years") {
      const start = vy - 7; let h = "";
      for (let y = start; y < start + 16; y++) h += `<button type="button" class="sdp-y${y === vy ? " on" : ""}${y === now.getFullYear() ? " now" : ""}" data-y="${y}">${bn(y)}</button>`;
      return `<div class="sdp-nav"><button type="button" data-step="-16" aria-label="আগের">‹</button><button type="button" class="sdp-title" data-view="${isMonth() ? "months" : "days"}">${bn(start)} – ${bn(start + 15)}</button><button type="button" data-step="16" aria-label="পরের">›</button></div><div class="sdp-grid y">${h}</div>`;
    }
    if (view === "months") {
      const p = parse(sel);
      return `<div class="sdp-nav"><button type="button" data-step="-12" aria-label="আগের বছর">‹</button><button type="button" class="sdp-title" data-view="years">${bn(vy)}</button><button type="button" data-step="12" aria-label="পরের বছর">›</button></div><div class="sdp-grid m">${MONTHS.map((n, i) => `<button type="button" class="sdp-m${p && p.y === vy && p.m === i ? " on" : ""}${vy === now.getFullYear() && i === now.getMonth() ? " now" : ""}" data-m="${i}">${n}</button>`).join("")}</div>`;
    }
    const first = new Date(vy, vm, 1).getDay(), days = new Date(vy, vm + 1, 0).getDate(), prev = new Date(vy, vm, 0).getDate();
    let cells = DAYS.map((d) => `<span class="sdp-wd">${d}</span>`).join("");
    for (let i = first - 1; i >= 0; i--) cells += `<span class="sdp-d out">${bn(prev - i)}</span>`;
    for (let d = 1; d <= days; d++) {
      const v = iso(vy, vm, d), off = (min && v < min) || (max && v > max);
      cells += `<button type="button" class="sdp-d${v === sel ? " on" : ""}${v === t ? " today" : ""}${new Date(vy, vm, d).getDay() === 5 ? " fri" : ""}" data-d="${v}"${off ? " disabled" : ""}>${bn(d)}</button>`;
    }
    const tail = (7 - ((first + days) % 7)) % 7; for (let d = 1; d <= tail; d++) cells += `<span class="sdp-d out">${bn(d)}</span>`;
    return `<div class="sdp-nav"><button type="button" data-step="-1" aria-label="আগের মাস">‹</button><button type="button" class="sdp-title" data-view="months">${MONTHS[vm]} ${bn(vy)} <i>▾</i></button><button type="button" data-step="1" aria-label="পরের মাস">›</button></div><div class="sdp-grid d">${cells}</div>`;
  }
  const draw = (anim) => { dlg.innerHTML = `${head()}<div class="sdp-body${anim ? " " + anim : ""}">${body()}</div><footer class="sdp-foot"><button type="button" class="sdp-today" data-today>${isMonth() ? "এই মাস" : "আজ"}</button>${input && !input.required ? '<button type="button" class="sdp-clear" data-clear>মুছুন</button>' : ""}<span></span><button type="button" class="sdp-close" data-close>বন্ধ</button></footer>`; };
  function close() { dlg.classList.add("closing"); setTimeout(() => { dlg.classList.remove("closing"); if (dlg.open) dlg.close(); if (input && input._dpBtn) input._dpBtn.focus(); input = null; }, 160); }
  function choose(v) {
    if (!input) return;
    const inp = input; sel = v; draw();
    setTimeout(() => { close(); inp.value = v; if (inp._dpSync) inp._dpSync(); inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true })); }, 140);
  }
  function open(inp) { input = inp; sel = inp.value || ""; const p = parse(sel) || parse(todayIso()); vy = p.y; vm = p.m; view = isMonth() ? "months" : "days"; draw(); dlg.showModal(); }
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) return close();
    const t = e.target.closest("button"); if (!t || t.disabled) return;
    if (t.dataset.d) return choose(t.dataset.d);
    if (t.dataset.step) { const n = +t.dataset.step; if (view === "days") { const d = new Date(vy, vm + n, 1); vy = d.getFullYear(); vm = d.getMonth(); } else vy += view === "months" ? Math.sign(n) : n; return draw(n < 0 ? "slide-r" : "slide-l"); }
    if (t.dataset.view) { view = t.dataset.view; return draw("zoom"); }
    if (t.dataset.m && isMonth()) return choose(`${vy}-${pad(+t.dataset.m + 1)}`);
    if (t.dataset.m) { vm = +t.dataset.m; view = "days"; return draw("zoom"); }
    if (t.dataset.y) { vy = +t.dataset.y; view = "months"; return draw("zoom"); }
    if (t.hasAttribute("data-today")) return choose(isMonth() ? todayIso().slice(0, 7) : todayIso());
    if (t.hasAttribute("data-clear")) return choose("");
    if (t.hasAttribute("data-close")) return close();
  });
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
  dlg.addEventListener("keydown", (e) => {
    if (view !== "days" || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter"].includes(e.key)) return;
    e.preventDefault(); const p = parse(sel) || parse(todayIso()), d = new Date(p.y, p.m, p.d);
    if (e.key === "Enter") return choose(iso(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setDate(d.getDate() + { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]); sel = iso(d.getFullYear(), d.getMonth(), d.getDate()); vy = d.getFullYear(); vm = d.getMonth(); draw();
  });
  // তারিখের ঘরের জায়গায় একটা বোতাম — তাতে বাছাই করা তারিখ বাংলায়
  function attach(inp) {
    if (!inp || inp.dataset.sdp) return; inp.dataset.sdp = "1";
    const wrap = document.createElement("span"); wrap.className = "sdp-field"; inp.insertAdjacentElement("beforebegin", wrap); wrap.append(inp);
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "sdp-trigger"; wrap.prepend(btn); inp._dpBtn = btn;
    const mo = inp.type === "month";
    const sync = () => { btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg><span>${inp.value ? (inp.closest("td") ? nice(inp.value, mo).split(",")[0] : nice(inp.value, mo)) : inp.dataset.dpEmpty || (mo ? "মাস বেছে নিন" : "তারিখ বেছে নিন")}</span>`; btn.classList.toggle("empty", !inp.value); btn.disabled = inp.disabled; };
    sync(); inp._dpSync = sync; btn.title = inp.title || "";
    // কোড থেকে .value বদলালেও বোতামের লেখা বদলায়
    Object.defineProperty(inp, "value", { configurable: true, get() { return VALUE.get.call(this); }, set(v) { VALUE.set.call(this, v); sync(); } });
    inp.addEventListener("change", () => setTimeout(sync));
    btn.addEventListener("click", () => open(inp));
  }
  const scan = (root) => root.querySelectorAll(SEL).forEach(attach);
  scan(document);
  new MutationObserver((list) => { for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.matches && n.matches(SEL)) attach(n); else scan(n); } }).observe(document.body, { childList: true, subtree: true });
})();
