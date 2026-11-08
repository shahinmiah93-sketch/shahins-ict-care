// অ্যাডমিন → ফি ও পেমেন্ট → "✉ বকেয়া SMS তালিকা"
// যাদের ফি বকেয়া আছে (পড়া বন্ধ হলেও), তাদের তালিকা থেকে বেছে বেছে বা সবাইকে নিজের লেখা বার্তায় হাতে SMS পাঠানো।
// বার্তার ছাঁচে {নাম} {আইডি} {বকেয়া} {ব্যাচ} বসে; কাকে পাঠাবেন: অভিভাবক / শিক্ষার্থী / দুজনেই। পাঠানোর আগে মোট কত নম্বর, আনুমানিক কত SMS দেখিয়ে জিজ্ঞেস করে।
window.SICDueSms = function (X) {
  "use strict";
  const { $, $$, esc, bn, api, toast } = U;
  const DB = () => X.DB;
  const today = () => U.today();
  const enNum = (s) => String(s || "").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d));
  const cleanPhone = (s) => enNum(s).replace(/\D/g, "").replace(/^88/, "");
  const okPhone = (v) => /^01\d{9}$/.test(v);
  const DEFAULT_TPL = "সম্মানিত অভিভাবক, {নাম}-এর বেতন বাবদ মোট {বকেয়া} টাকা বকেয়া রয়েছে। অনুগ্রহ করে পরিশোধ করবেন। — Shahin Sir";
  const savedTpl = () => { try { return localStorage.getItem("sic-due-sms-tpl") || ""; } catch (e) { return ""; } };
  // ফি পাতা আবার আঁকা হলেও ফিল্টার, বার্তা আর বাছাই থেকে যায়
  const S = (window.__sicDueSmsState ||= { session: "", batch: "", q: "", min: 0, to: "guardian", inactive: true, again: false, tpl: savedTpl() || DEFAULT_TPL, sel: new Set(), running: false, stop: false });

  const batchOf = (id) => DB().batches.find((b) => b.id === id);
  // কাকে পাঠাবেন: অভিভাবক (অভিভাবক → বাবা → মা, প্রথম নম্বর) | বাবা | মা | শিক্ষার্থী নিজে | অভিভাবক + শিক্ষার্থী — না থাকলে খালি
  const targets = (s) => {
    const one = (v) => (okPhone(cleanPhone(v)) ? cleanPhone(v) : "");
    const g = [s.guardianPhone, s.fatherPhone, s.motherPhone].map(cleanPhone).find(okPhone) || "", own = one(s.phone);
    return [...new Set(({ student: [own], both: [g, own], father: [one(s.fatherPhone)], mother: [one(s.motherPhone)], guardian: [g] }[S.to] || [g]).filter(Boolean))];
  };
  const WHO = { guardian: "অভিভাবকের", student: "শিক্ষার্থীর", father: "বাবার", mother: "মায়ের", both: "অভিভাবক বা শিক্ষার্থীর" };
  const inScope = (s) => {
    const b = batchOf(s.batchId), q = S.q.trim().toLowerCase();
    return (S.inactive || s.status !== "inactive") && (!S.session || (b && b.session === S.session)) && (!S.batch || s.batchId === S.batch)
      && (!q || (s.id + " " + s.name).toLowerCase().includes(q)) && s.fees.balance >= (Number(S.min) || 0);
  };
  const rows = () => DB().students.filter((s) => s.fees && s.fees.balance > 0 && inScope(s)).sort((a, b) => b.fees.balance - a.fees.balance || String(a.id).localeCompare(String(b.id)));
  const fill = (tpl, s) => tpl.replaceAll("{নাম}", s.name).replaceAll("{আইডি}", s.id).replaceAll("{বকেয়া}", Math.round(s.fees.balance).toLocaleString("bn-BD")).replaceAll("{ব্যাচ}", (batchOf(s.batchId) || {}).name || "");
  // SMS-এ বাংলা (Unicode) অক্ষর থাকলে প্রতি অংশে ৭০ (একাধিক হলে ৬৭), ইংরেজিতে ১৬০ (১৫৩)
  const parts = (text) => { const n = [...text].length; return /[^\x00-\x7F]/.test(text) ? (n <= 70 ? 1 : Math.ceil(n / 67)) : (n <= 160 ? 1 : Math.ceil(n / 153)); };
  // কার শেষ বকেয়ার SMS কবে গেছে (স্বয়ংক্রিয় ১ তারিখের, কল তালিকার, বা এই তালিকার) — SMS খাতা (smsLog) একবার ঘুরে
  const logMap = () => {
    const last = {}, todaySent = new Set(), t = today();
    for (const l of DB().smsLog || []) {
      if (!l.ok || !["Fee", "CallDue", "DueManual"].includes(l.filter)) continue;
      const id = ((String(l.text || "").match(/— ([^\s,]+)/) || [])[1]); if (!id) continue;
      if (!last[id] || l.date > last[id]) last[id] = l.date;
      if (l.filter === "DueManual" && l.date === t) todaySent.add(id);
    }
    return { last, todaySent };
  };

  function render(host) {
    const sessions = DB().sessions.filter((x) => x.active !== false);
    host.innerHTML = `<div class="card ab-ctl ab-ctl-dues ab-ctl-sms">
        <label>সেশন<select id="dsSe"><option value="">সব সেশন</option>${sessions.map((x) => `<option value="${esc(x.name)}"${x.name === S.session ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
        <label>ব্যাচ<select id="dsBa"></select></label>
        <label>কাকে পাঠাবেন<select id="dsTo"><option value="guardian"${S.to === "guardian" ? " selected" : ""}>অভিভাবক</option><option value="father"${S.to === "father" ? " selected" : ""}>বাবা</option><option value="mother"${S.to === "mother" ? " selected" : ""}>মা</option><option value="student"${S.to === "student" ? " selected" : ""}>শিক্ষার্থী</option><option value="both"${S.to === "both" ? " selected" : ""}>অভিভাবক + শিক্ষার্থী</option></select></label>
        <label>খুঁজুন<input id="dsQ" class="dc-q" placeholder="নাম বা আইডি" value="${esc(S.q)}"></label>
        <label>সর্বনিম্ন বকেয়া (৳)<input id="dsMin" class="dc-q" type="number" min="0" step="100" value="${S.min || ""}" placeholder="যেকোনো"></label>
        <label class="ab-switch"><input type="checkbox" id="dsInact"${S.inactive ? " checked" : ""}><i class="ab-sw"></i><span>পড়া বন্ধ শিক্ষার্থীও</span></label>
        <label class="ab-switch" title="আজ যাদের এই তালিকা থেকে আগেই SMS গেছে, তাদের আবার পাঠানো হবে"><input type="checkbox" id="dsAgain"${S.again ? " checked" : ""}><i class="ab-sw"></i><span>আজ আগে গেছে তাদেরও আবার</span></label>
      </div>
      <div class="card ds-msg">
        <div class="ds-msg-head"><b>✉ বার্তা</b><span class="ds-ph"><small>বসান:</small>${["{নাম}", "{আইডি}", "{বকেয়া}", "{ব্যাচ}"].map((p) => `<button type="button" class="ab-btn" data-ph="${p}">${p}</button>`).join("")}<button type="button" class="ab-btn" data-tpl-reset title="আগের ডিফল্ট বার্তা ফিরিয়ে আনুন">↺ ডিফল্ট</button></span></div>
        <textarea id="dsTpl" rows="3" maxlength="500" aria-label="বার্তা">${esc(S.tpl)}</textarea>
        <div class="ds-pv"><small>নমুনা (<span id="dsPvWho"></span>)</small><div class="ds-bubble" id="dsPv"></div><small id="dsPvInfo"></small></div>
      </div>
      <div class="ab-sum" id="dsSum"></div>
      <div class="ds-bar" id="dsBar"></div>
      <div id="dsList"></div>`;
    const batchOpts = () => DB().batches.filter((b) => b.active !== false && (!S.session || b.session === S.session));
    const fillBatches = () => { $("#dsBa").innerHTML = `<option value="">সব ব্যাচ</option>` + batchOpts().map((b) => `<option value="${esc(b.id)}"${b.id === S.batch ? " selected" : ""}>${esc(U.batchLabel(b))}</option>`).join(""); };

    const visibleSel = () => rows().filter((s) => S.sel.has(s.id) && targets(s).length);
    const draw = () => {
      const list = rows(), { last, todaySent } = logMap(), sel = visibleSel();
      const nums = sel.reduce((n, s) => n + targets(s).length, 0), first = sel[0] || list.find((s) => targets(s).length) || list[0];
      const pv = first ? fill(S.tpl, first) : "";
      const each = parts(pv || S.tpl), total = list.reduce((t, s) => t + s.fees.balance, 0);
      const box = (tx, v, cls, raw) => `<article class="${cls || ""}"><small>${tx}</small><b>${raw ? v : bn(v)}</b></article>`;
      $("#dsSum").innerHTML = box("বকেয়া আছে (দেখা যাচ্ছে)", list.length) + box("মোট বকেয়া", U.money(total), total ? "bad" : "", true) + box("বাছা শিক্ষার্থী", sel.length, sel.length ? "ok" : "") + box("মোট নম্বর", nums) + box("আনুমানিক SMS", nums * each, nums ? "warn" : "");
      $("#dsPvWho").textContent = first ? first.name : "—"; $("#dsPv").textContent = pv || "বার্তা লিখুন";
      $("#dsPvInfo").textContent = pv ? `${bn([...pv].length)} অক্ষর · প্রতি নম্বরে ${bn(each)}টি SMS ধরা হয় (বাংলা অক্ষরে ৭০ অক্ষরে ১টি)` : "";
      const allOn = list.length && list.filter((s) => targets(s).length).every((s) => S.sel.has(s.id));
      $("#dsBar").innerHTML = S.running ? `<div class="ds-prog"><div class="ds-prog-t"><b id="dsProgT">পাঠানো হচ্ছে…</b><button type="button" class="ab-btn" data-stop>⏹ থামান</button></div><div class="ds-track"><i id="dsProgBar" style="width:0%"></i></div></div>`
        : `<div class="ds-actions"><button type="button" class="ab-btn call" data-send${sel.length ? "" : " disabled"}>✉ ${sel.length ? bn(sel.length) + " জনকে SMS পাঠান" : "SMS পাঠান (আগে বাছুন)"}</button><button type="button" class="ab-btn" data-all>${allOn ? "☐ কাউকে না" : "☑ সবাইকে বাছুন"}</button><span class="ds-hint">${list.length ? "দেখা যাচ্ছে এমন সবাইকে বাছতে \"সবাইকে বাছুন\"; নম্বর নেই যাদের তাদের বাছা যায় না।" : ""}</span></div>`;
      $("#dsList").innerHTML = list.map((s) => {
        const tg = targets(s), b = batchOf(s.batchId), lastSms = last[s.id];
        return `<label class="ds-row${tg.length ? "" : " off"}${S.sel.has(s.id) && tg.length ? " on" : ""}"><input type="checkbox" data-sid="${esc(s.id)}"${S.sel.has(s.id) && tg.length ? " checked" : ""}${tg.length ? "" : " disabled"}>
          <div class="ds-info"><b>${esc(s.name)}</b><small>${esc(s.id)} · ${esc(b ? b.name : "ব্যাচ নেই")}${s.status === "inactive" ? ` · <span class="chip warn">পড়া বন্ধ</span>` : ""}</small>
            <small>${tg.length ? tg.map((p) => `<span class="chip">${bn(p)}</span>`).join(" ") : `<span class="chip bad">${WHO[S.to] || "অভিভাবকের"} নম্বর নেই</span>`}${lastSms ? ` <span class="chip ${lastSms === today() ? "ok" : ""}" title="শেষ বকেয়ার SMS">শেষ SMS ${esc(U.date(lastSms))}</span>` : ""}${todaySent.has(s.id) ? ` <span class="chip ok">✉ আজ গেছে</span>` : ""}</small></div>
          <div class="ds-due"><small>বকেয়া</small><b>${U.money(s.fees.balance)}</b></div></label>`;
      }).join("") || `<div class="card empty">${DB().students.some((s) => s.fees && s.fees.balance > 0) ? "এই ফিল্টারে কোনো শিক্ষার্থী নেই" : "কোনো বকেয়া নেই 🎉"}</div>`;
    };
    fillBatches(); draw();

    $("#dsSe").onchange = (e) => { S.session = e.target.value; S.batch = ""; fillBatches(); draw(); };
    $("#dsBa").onchange = (e) => { S.batch = e.target.value; draw(); };
    $("#dsQ").oninput = (e) => { S.q = e.target.value; draw(); };
    $("#dsMin").oninput = (e) => { S.min = Number(e.target.value) || 0; draw(); };
    $("#dsTo").onchange = (e) => { S.to = e.target.value; draw(); };
    $("#dsInact").onchange = (e) => { S.inactive = e.target.checked; draw(); };
    $("#dsAgain").onchange = (e) => { S.again = e.target.checked; draw(); };
    $("#dsTpl").oninput = (e) => { S.tpl = e.target.value; try { localStorage.setItem("sic-due-sms-tpl", S.tpl); } catch (er) { /* ঠিক আছে */ } draw(); };

    const insertAt = (txt) => { const ta = $("#dsTpl"), a = ta.selectionStart, b = ta.selectionEnd; ta.value = ta.value.slice(0, a) + txt + ta.value.slice(b); ta.focus(); ta.setSelectionRange(a + txt.length, a + txt.length); ta.dispatchEvent(new Event("input")); };
    async function sendAll() {
      if (S.running) return;
      const sel = visibleSel(); if (!sel.length) return toast("আগে শিক্ষার্থী বাছুন", true);
      if (!S.tpl.trim()) return toast("বার্তা লিখুন", true);
      const nums = sel.reduce((n, s) => n + targets(s).length, 0), each = parts(fill(S.tpl, sel[0]));
      if (!confirm(`${bn(sel.length)} জন শিক্ষার্থীর ${bn(nums)}টি নম্বরে SMS পাঠাবেন?\n\nআনুমানিক ${bn(nums * each)}টি SMS-এর ব্যালেন্স কাটবে।\n\nবার্তার নমুনা (${sel[0].name}):\n${fill(S.tpl, sel[0])}`)) return;
      S.running = true; S.stop = false; draw();
      let ok = 0, sentNums = 0, skipped = 0, failed = [], bad = 0, i = 0;
      for (const s of sel) {
        if (S.stop) break;
        $("#dsProgT") && ($("#dsProgT").textContent = `পাঠানো হচ্ছে… ${bn(i)} / ${bn(sel.length)} — ${s.name}`);
        $("#dsProgBar") && ($("#dsProgBar").style.width = Math.round((i / sel.length) * 100) + "%");
        try {
          const r = await api("/api/admin/due-sms", { body: { studentId: s.id, template: S.tpl, to: S.to, force: S.again } });
          ok++; sentNums += r.sent || 0; bad = 0; if (r.error) failed.push(`${s.name}: একটা নম্বরে যায়নি (${r.error})`);
        } catch (er) {
          if (/আগেই/.test(er.message)) skipped++;
          else { failed.push(`${s.name}: ${er.message}`); if (++bad >= 3) { toast("পরপর ৩ জনের SMS যায়নি, তাই থেমে গেলাম — ব্যালেন্স / SMS সেটআপ দেখুন", true); break; } }
        }
        i++;
      }
      const stopped = S.stop;
      S.running = false; S.stop = false;
      try { await X.load(); } catch (er) { /* ঠিক আছে */ }
      draw();
      $("#dsBar").insertAdjacentHTML("beforeend", `<div class="ds-report ${failed.length ? "bad" : "ok"}"><b>${stopped ? "থামানো হয়েছে" : "শেষ"}: ${bn(ok)} জনকে (${bn(sentNums)}টি নম্বরে) পাঠানো হয়েছে${skipped ? `, ${bn(skipped)} জন বাদ (আজ আগেই গেছে)` : ""}${failed.length ? `, ${bn(failed.length)} জনের সমস্যা` : ""}।</b>${failed.length ? `<ul>${failed.slice(0, 10).map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}</div>`);
      toast(`${bn(sentNums)}টি নম্বরে SMS পাঠানো হয়েছে`, failed.length > 0);
    }
    host.onclick = (e) => {
      const ph = e.target.closest("[data-ph]"); if (ph) return insertAt(ph.dataset.ph);
      if (e.target.closest("[data-tpl-reset]")) { $("#dsTpl").value = DEFAULT_TPL; $("#dsTpl").dispatchEvent(new Event("input")); return; }
      if (e.target.closest("[data-send]")) return sendAll();
      if (e.target.closest("[data-stop]")) { S.stop = true; return; }
      if (e.target.closest("[data-all]")) { const list = rows().filter((s) => targets(s).length), on = list.every((s) => S.sel.has(s.id)); list.forEach((s) => (on ? S.sel.delete(s.id) : S.sel.add(s.id))); draw(); }
    };
    host.onchange = (e) => { const c = e.target.closest("[data-sid]"); if (!c) return; if (c.checked) S.sel.add(c.dataset.sid); else S.sel.delete(c.dataset.sid); draw(); };
  }
  return render;
};
