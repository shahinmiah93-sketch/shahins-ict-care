// ছবি ঠিক করার বাক্স (ফেসবুকের মতো): ছবি আঙুল/মাউস দিয়ে টেনে সরানো, স্লাইডার / স্ক্রল / দুই আঙুলে ছোট-বড় করা — গোল ফ্রেমের ভেতরে যেটুকু দেখাচ্ছে সেটুকুই প্রোফাইল ছবি হবে।
// result() দুটো ছবি দেয়: photo = ক্রপ করা বর্গাকার প্রোফাইল ছবি (≤৪০০ KB), original = ক্রপের আগের পুরো ছবি (বড় করে দেখা / সেভ করার জন্য, ≤১.৫ MB)।
//   SICPhotoCrop.create(rootEl) → { load(file), result(), destroy() }     SICPhotoCrop.dialog(file, { title }) → Promise<{photo, original} | null>
window.SICPhotoCrop = (function () {
  "use strict";
  const MAX_ZOOM = 4, OUT = 640;
  const toUrl = (canvas, qs, limit) => { for (const q of qs) { const u = canvas.toDataURL("image/jpeg", q); if (u.length <= limit) return u; } return null; };

  function create(root) {
    root.classList.add("pc-box");
    root.innerHTML = `<div class="pc-stage" tabindex="0" aria-label="ছবি টেনে সরান"><img class="pc-img" alt="" draggable="false"><div class="pc-ring" aria-hidden="true"></div></div>
      <div class="pc-ctrl"><button type="button" data-z="-" aria-label="ছোট করুন">−</button><input type="range" min="0" max="100" value="0" aria-label="ছোট-বড়"><button type="button" data-z="+" aria-label="বড় করুন">＋</button></div>
      <p class="pc-hint">ছবিটা টেনে সরান, স্লাইডার দিয়ে ছোট-বড় করুন — গোল ফ্রেমের ভেতরের অংশটাই প্রোফাইল ছবি হবে।</p>`;
    const stage = root.querySelector(".pc-stage"), img = root.querySelector(".pc-img"), range = root.querySelector("input[type=range]");
    let S = 0, nw = 0, nh = 0, min = 1, zoom = 1, x = 0, y = 0, source = null, url = "";
    const scale = () => min * zoom;
    const clamp = () => { const k = scale(); x = Math.min(0, Math.max(S - nw * k, x)); y = Math.min(0, Math.max(S - nh * k, y)); };
    const draw = () => { clamp(); const k = scale(); img.style.width = nw * k + "px"; img.style.height = nh * k + "px"; img.style.transform = `translate(${x}px,${y}px)`; range.value = String(Math.round(((zoom - 1) / (MAX_ZOOM - 1)) * 100)); };
    // মাঝের বিন্দু ঠিক রেখে জুম
    const setZoom = (z, cx = S / 2, cy = S / 2) => {
      z = Math.min(MAX_ZOOM, Math.max(1, z)); const k0 = scale(), px = (cx - x) / k0, py = (cy - y) / k0; zoom = z; const k1 = scale(); x = cx - px * k1; y = cy - py * k1; draw();
    };
    const pts = new Map(); let pinch = 0;
    stage.addEventListener("pointerdown", (e) => { stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinch = 0; stage.classList.add("grab"); });
    stage.addEventListener("pointermove", (e) => {
      const p = pts.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 1) { x += dx; y += dy; draw(); }
      else if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) setZoom(zoom * (d / pinch)); pinch = d; }
    });
    const up = (e) => { pts.delete(e.pointerId); pinch = 0; if (!pts.size) stage.classList.remove("grab"); };
    stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
    stage.addEventListener("wheel", (e) => { e.preventDefault(); const r = stage.getBoundingClientRect(); setZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    stage.addEventListener("keydown", (e) => { const s = 12; if (e.key === "ArrowLeft") x += s; else if (e.key === "ArrowRight") x -= s; else if (e.key === "ArrowUp") y += s; else if (e.key === "ArrowDown") y -= s; else return; e.preventDefault(); draw(); });
    range.addEventListener("input", () => setZoom(1 + (Number(range.value) / 100) * (MAX_ZOOM - 1)));
    root.querySelectorAll("[data-z]").forEach((b) => (b.onclick = () => setZoom(zoom * (b.dataset.z === "+" ? 1.2 : 1 / 1.2))));

    async function load(file) {
      root.hidden = false; // মাপ জানার জন্য আগে দেখাতে হয়
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(file);
      const image = new Image(); image.src = url;
      try { await image.decode(); } catch (e) { root.hidden = true; throw e; }
      source = image; nw = image.naturalWidth; nh = image.naturalHeight; S = stage.clientWidth || 260;
      min = Math.max(S / nw, S / nh); zoom = 1; x = (S - nw * min) / 2; y = (S - nh * min) / 2; img.src = url; draw();
    }
    function result() {
      if (!source) throw new Error("আগে ছবি বেছে নিন");
      const k = scale(), sx = -x / k, sy = -y / k, sw = S / k;
      const fill = (c) => { const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); return g; };
      const face = document.createElement("canvas"); face.width = face.height = OUT; fill(face).drawImage(source, sx, sy, sw, sw, 0, 0, OUT, OUT);
      let photo = toUrl(face, [0.85, 0.7, 0.55], 540000);
      if (!photo) { const small = document.createElement("canvas"); small.width = small.height = 480; fill(small).drawImage(source, sx, sy, sw, sw, 0, 0, 480, 480); photo = toUrl(small, [0.7, 0.5], 540000); }
      if (!photo) throw new Error("ছবিটা অনেক বড় হয়ে যাচ্ছে — আরেকটু ছোট করে নিন");
      // মূল ছবি: বড় দিক ১৬০০px পর্যন্ত
      let original = null;
      for (const [max, qs] of [[1600, [0.85, 0.72]], [1280, [0.7, 0.55]], [960, [0.6]]]) {
        const f = Math.min(1, max / Math.max(nw, nh)), c = document.createElement("canvas"); c.width = Math.max(1, Math.round(nw * f)); c.height = Math.max(1, Math.round(nh * f));
        fill(c).drawImage(source, 0, 0, c.width, c.height); original = toUrl(c, qs, 2000000); if (original) break;
      }
      return { photo, original };
    }
    function destroy() { if (url) URL.revokeObjectURL(url); url = ""; source = null; root.innerHTML = ""; }
    return { load, result, destroy };
  }

  // আলাদা ডায়ালগ (অ্যাডমিনের জন্য): ছবি ঠিক করে "সেভ" চাপলে ফল আসে, "বাতিল" দিলে null
  function dialog(file, { title = "ছবি ঠিক করুন", saveText = "সেভ করুন" } = {}) {
    return new Promise((resolve) => {
      const d = document.createElement("dialog"); d.className = "student-photo-dialog";
      d.innerHTML = `<h2>${title}</h2><div></div><p class="student-photo-error" role="alert"></p><div class="student-photo-actions"><button type="button" class="btn line" data-cancel>বাতিল</button><button type="button" class="btn gold" data-ok disabled>${saveText}</button></div>`;
      document.body.append(d);
      const c = create(d.querySelector("div")), ok = d.querySelector("[data-ok]"), err = d.querySelector('[role="alert"]');
      let out = null; d.addEventListener("close", () => { c.destroy(); d.remove(); resolve(out); });
      d.querySelector("[data-cancel]").onclick = () => d.close();
      ok.onclick = () => { try { out = c.result(); d.close(); } catch (e) { err.textContent = e.message; } };
      d.showModal();
      c.load(file).then(() => { ok.disabled = false; }).catch(() => { err.textContent = "ছবিটি খোলা যায়নি। অন্য ছবি দিন।"; });
    });
  }
  return { create, dialog };
})();
