// MS Word-এর মতো লেখার বাক্স: বোল্ড, ইটালিক, আন্ডারলাইন, লেখার রং, হাইলাইট, শিরোনাম, তালিকা, সাজানো (বাঁ/মাঝ/ডান/জাস্টিফাই), লেখার মাপ।
// ব্যবহার: SICRich.html(id, html) দিয়ে বাক্সের মার্কআপ বসান, তারপর SICRich.init(root, id); মান পেতে SICRich.value(root, id)।
// পুরোনো (শুধু টেক্সট) লেখা খুললে SICRich.fromPlain(text) দিয়ে HTML বানিয়ে নিন। সার্ভার সেভের সময় আবার পরিষ্কার করে (শুধু নিরাপদ ট্যাগ/স্টাইল থাকে)।
window.SICRich = (function () {
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const COLORS = ["#ffffff", "#f3c55d", "#ff9f43", "#ff6b6b", "#ff7eb6", "#b794f6", "#63b3ff", "#4fd1c5", "#68d391", "#a0aec0"];
  const SIZES = [["14px", "ছোট"], ["17px", "সাধারণ"], ["21px", "বড়"], ["26px", "অনেক বড়"]];
  const btn = (cmd, label, title, extra = "") => `<button type="button" class="rt-b" data-cmd="${cmd}" title="${title}" ${extra}>${label}</button>`;

  // পুরোনো টেক্সট (নতুন লাইন, **মোটা**, "- " তালিকা) থেকে HTML
  function fromPlain(text) {
    const inline = (t) => esc(t).replace(/\*\*([^*\r\n]+?)\*\*/g, "<b>$1</b>");
    const out = []; let list = false;
    for (const raw of String(text || "").split(/\r?\n/)) {
      const line = raw.trim(), li = line.match(/^[-•]\s+(.*)$/);
      if (li) { if (!list) { out.push("<ul>"); list = true; } out.push(`<li>${inline(li[1])}</li>`); continue; }
      if (list) { out.push("</ul>"); list = false; }
      if (line) out.push(`<p>${inline(line)}</p>`);
    }
    if (list) out.push("</ul>");
    return out.join("");
  }

  function html(id, value, hint) {
    return `<div class="rt wide" id="${id}-wrap"><div class="rt-label">${hint || "বিস্তারিত"}</div>
      <div class="rt-bar" role="toolbar" aria-label="লেখা সাজানোর টুলবার">
        <select class="rt-sel" data-fmt title="লেখার ধরন"><option value="p">সাধারণ লেখা</option><option value="h2">বড় শিরোনাম</option><option value="h3">ছোট শিরোনাম</option></select>
        <select class="rt-sel" data-size title="লেখার মাপ"><option value="">মাপ</option>${SIZES.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select>
        <span class="rt-sep"></span>
        ${btn("bold", "<b>B</b>", "মোটা (Ctrl+B)")}${btn("italic", "<i>I</i>", "বাঁকা (Ctrl+I)")}${btn("underline", "<u>U</u>", "দাগ (Ctrl+U)")}${btn("strikeThrough", "<s>S</s>", "কাটা")}
        <span class="rt-sep"></span>
        <span class="rt-pal" title="লেখার রং"><i class="rt-lab">A</i>${COLORS.map((c) => `<button type="button" class="rt-sw" data-color="${c}" style="background:${c}" title="রং ${c}"></button>`).join("")}<input type="color" class="rt-pick" data-color-pick value="#f3c55d" title="অন্য রং বাছুন"></span>
        <span class="rt-pal" title="হাইলাইট"><i class="rt-lab hl">▮</i>${["#fff3a3", "#ffd6a5", "#b8f2c9", "#bfe3ff", "#ffc9de"].map((c) => `<button type="button" class="rt-sw" data-hl="${c}" style="background:${c}" title="হাইলাইট"></button>`).join("")}<button type="button" class="rt-sw none" data-hl="transparent" title="হাইলাইট তুলুন">✕</button></span>
        <span class="rt-sep"></span>
        ${btn("insertUnorderedList", "• তালিকা", "বুলেট তালিকা")}${btn("insertOrderedList", "১. তালিকা", "নম্বর তালিকা")}
        <span class="rt-sep"></span>
        ${btn("justifyLeft", "⯇", "বাঁয়ে")}${btn("justifyCenter", "≡", "মাঝে")}${btn("justifyRight", "⯈", "ডানে")}${btn("justifyFull", "☰", "জাস্টিফাই")}
        <span class="rt-sep"></span>
        ${btn("insertHorizontalRule", "―", "আলাদা দাগ")}${btn("removeFormat", "✕ সাজ তুলুন", "নির্বাচিত লেখার সাজ তুলে ফেলুন")}
      </div>
      <div class="rt-area" id="${id}" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="false" data-ph="এখানে লিখুন — উপরের বোতাম দিয়ে MS Word-এর মতোই সাজান">${value || ""}</div>
      <small class="rt-note">এই বাক্সের রংটা ওয়েবসাইটের কালো জমিনের মতো — যা এখানে দেখছেন, পোস্টে ঠিক তেমনই দেখাবে।</small></div>`;
  }

  function init(root, id) {
    const wrap = root.querySelector(`#${id}-wrap`), area = wrap.querySelector(`#${id}`), bar = wrap.querySelector(".rt-bar");
    const run = (cmd, val) => { area.focus(); try { document.execCommand("styleWithCSS", false, true); } catch {} document.execCommand(cmd, false, val); sync(); };
    // বোতামে চাপলে লেখার বাছাই যেন হারিয়ে না যায়
    bar.addEventListener("mousedown", (e) => { if (!e.target.closest("select,input")) e.preventDefault(); });
    bar.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.cmd) run(b.dataset.cmd);
      else if (b.dataset.color) run("foreColor", b.dataset.color);
      else if (b.dataset.hl) run("hiliteColor", b.dataset.hl);
    });
    bar.querySelector("[data-color-pick]").addEventListener("input", (e) => run("foreColor", e.target.value));
    bar.querySelector("[data-fmt]").addEventListener("change", (e) => { run("formatBlock", e.target.value); });
    bar.querySelector("[data-size]").addEventListener("change", (e) => {
      const v = e.target.value; if (!v) return;
      area.focus(); document.execCommand("styleWithCSS", false, true); document.execCommand("fontSize", false, "7"); // ৭ = পরে নিজের মাপ বসাব
      area.querySelectorAll('font[size="7"],span[style*="xxx-large"],span[style*="-webkit-xxx-large"]').forEach((n) => { n.removeAttribute("size"); n.style.fontSize = v; });
      e.target.value = ""; sync();
    });
    // পেস্ট করলে বাইরের সাজ-সজ্জা (অন্য সাইটের রং/ফন্ট) না এনে শুধু লেখা বসবে; তবে নিজের এডিটর থেকে কপি করা সাজ থাকবে না — সাধারণ লেখাই
    area.addEventListener("paste", (e) => {
      e.preventDefault(); const t = (e.clipboardData || window.clipboardData).getData("text/plain");
      document.execCommand("insertText", false, t);
    });
    // টুলবারে এখন কোনটা চালু তা দেখানো
    const state = () => {
      ["bold", "italic", "underline", "strikeThrough", "insertUnorderedList", "insertOrderedList", "justifyLeft", "justifyCenter", "justifyRight", "justifyFull"].forEach((c) => {
        const b = bar.querySelector(`[data-cmd="${c}"]`); let on = false; try { on = document.queryCommandState(c); } catch {} if (b) b.classList.toggle("on", !!on);
      });
      let f = "p"; try { f = (document.queryCommandValue("formatBlock") || "p").toLowerCase().replace(/[<>]/g, ""); } catch {} bar.querySelector("[data-fmt]").value = ["h2", "h3"].includes(f) ? f : "p";
    };
    const sync = () => { area.classList.toggle("empty", !area.textContent.trim() && !area.querySelector("hr,ul,ol")); state(); };
    document.addEventListener("selectionchange", () => { if (document.activeElement === area) state(); });
    area.addEventListener("input", sync); sync();
    try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch {}
  }
  const value = (root, id) => { const a = root.querySelector(`#${id}`); return a ? a.innerHTML.trim() : ""; };
  const isEmpty = (root, id) => { const a = root.querySelector(`#${id}`); return !a || (!a.textContent.trim() && !a.querySelector("hr")); };
  return { html, init, value, isEmpty, fromPlain };
})();
