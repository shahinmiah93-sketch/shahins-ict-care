window.SICAdmissionImport = function (X) {
  "use strict";
  const { $, esc, bn, money, api } = U, DB = X.DB;
  let parsed = null, workbook = null, preview = null, payload = null, busy = false, loading;
  X.openModal({ title: "Excel থেকে ভর্তি", body: '<div id="admissionImportRoot"></div>', wide: true, noFoot: true });
  const root = $("#admissionImportRoot"), q = s => $(s, root);
  root.innerHTML = `<p>ভর্তি ফর্মের তথ্য একসঙ্গে যোগ করুন। Name বা English Name ছাড়া ব্যক্তিগত তথ্যের ঘর খালি রাখা যায়। Excel-এর ব্যাচ, মডিউল ও ভর্তির তারিখ খালি হলে নিচের বিকল্প ব্যবহার হবে।</p>
    <div class="fgrid">
      <label>বিকল্প সেশন<select data-ai-session>${X.opt([["", "বেছে নিন"], ...DB.sessions.filter(s => s.active !== false).map(s => [s.name, s.name])], "")}</select></label>
      <label>বিকল্প ব্যাচ<select data-ai-batch><option value="">আগে সেশন বাছুন</option></select></label>
      <label>বিকল্প মডিউল<select data-ai-course>${X.opt([["", "বেছে নিন"], ...DB.courses.filter(c => c.active !== false).map(c => [c.id, `${c.code || ""} — ${c.name}`])], "")}</select></label>
      <label>বিকল্প ভর্তির তারিখ<input type="date" data-ai-date value="${U.today()}" max="${U.today()}"></label>
      <label>বিকল্প ডিসকাউন্ট (৳)<input type="number" min="0" step="0.01" data-ai-discount value="0"></label>
      <label>বিকল্প অধ্যায়ের আইডি <small>(অধ্যায়ভিত্তিক মডিউলের জন্য)</small><input data-ai-chapters placeholder="যেমন: 1, 2"></label>
    </div>
    <p class="muted">বেতন Joining Date থেকে হিসাব হবে। বর্তমান নিয়ম: মাসিক মডিউলে ১–৬ তারিখে ভর্তি হলে পুরো মাস, পরে হলে অবশিষ্ট ক্লাস অনুযায়ী প্রথম মাসের ফি। পরের মাসগুলো স্বাভাবিক ফি; ব্যাচ বন্ধের নিয়মও প্রযোজ্য।</p>
    <div class="toolbar"><a class="btn line" href="/templates/Admission-Import-Demo.xlsx" download>নমুনা Excel ডাউনলোড</a><label class="btn gold">Excel বাছুন<input type="file" accept=".xlsx,.xls,.csv" data-ai-file hidden></label><span data-ai-filename></span></div>
    <label data-ai-sheet-wrap hidden>কোন শিট আমদানি করবেন?<select data-ai-sheet></select></label>
    <p class="muted">Students শিটে লিখুন। সর্বোচ্চ ৫০০ শিক্ষার্থী / ৫ MB। অপ্রয়োজনীয় কলাম মুছে ফেলতে বা খালি রাখতে পারেন। তারিখ: YYYY-MM-DD অথবা DD/MM/YYYY। মোবাইল নম্বরের ঘর Text রাখুন। কোনো SMS পাঠানো হবে না। ছবি পরে প্রোফাইলে যোগ করা যাবে।</p>
    <div class="toolbar"><button type="button" class="btn gold" data-ai-check disabled>প্রিভিউ ও বেতন যাচাই</button><button type="button" class="btn line" data-ai-close>বন্ধ করুন</button></div>
    <p class="err" data-ai-error role="alert"></p><div data-ai-preview></div>`;
  function error(message) { const el = q("[data-ai-error]"); if (el) el.textContent = message || ""; }
  function invalidate() { preview = payload = null; q("[data-ai-preview]").innerHTML = ""; error(""); }
  function lock(value) {
    busy = value;
    root.querySelectorAll("input,select,button").forEach(el => { el.disabled = value; });
    if (!value) {
      const check = q("[data-ai-check]"); if (check) check.disabled = !parsed || parsed.errors.length > 0;
      const commit = q("[data-ai-commit]"); if (commit) commit.disabled = !q("[data-ai-confirm]").checked;
    }
  }
  function excel() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!loading) loading = new Promise((resolve, reject) => {
      const script = document.createElement("script"); script.src = "/vendor/xlsx-0.20.3.full.min.js";
      script.onload = () => resolve(window.XLSX);
      script.onerror = () => { loading = null; script.remove(); reject(new Error("Excel পড়ার টুল লোড হয়নি। আবার চেষ্টা করুন")); };
      document.head.append(script);
    });
    return loading;
  }
  function parse() {
    invalidate(); parsed = null; q("[data-ai-check]").disabled = true;
    try {
      parsed = window.SICAdmissionSheet.parseWorkbook(workbook, q("[data-ai-sheet]").value, window.XLSX);
      if (parsed.errors.length) q("[data-ai-preview]").innerHTML = `<h3>সারির ভুলগুলো ঠিক করুন</h3><ul class="err">${parsed.errors.map(e => `<li>সারি ${bn(e.row)}: ${esc(e.error)}</li>`).join("")}</ul><p>Excel ঠিক করে আবার বাছুন। এখন কোনো তথ্য যোগ হয়নি।</p>`;
      else q("[data-ai-check]").disabled = false;
    } catch (e) { error(e.message); }
  }
  function renderPreview() {
    const p = preview;
    q("[data-ai-preview]").innerHTML = `<h3>সংরক্ষণের আগে যাচাই করুন</h3><p>নতুন শিক্ষার্থী: <b>${bn(p.summary.create)}</b> · আগে আছে, বাদ যাবে: <b>${bn(p.summary.skip)}</b> · আজ পর্যন্ত মোট ফি: <b>${money(p.summary.due)}</b> · ফাইলের জমা: <b>${money(p.summary.paid)}</b></p>
      ${p.errors.length ? `<ul class="err">${p.errors.map(e => `<li>সারি ${bn(e.row)}: ${esc(e.error)}</li>`).join("")}</ul><p>সব ভুল ঠিক করে ফাইল আবার বাছুন। ভুল থাকলে কোনো সারি আমদানি হবে না।</p>` : ""}
      <div class="tbl-wrap" style="max-height:390px;overflow:auto"><table style="min-width:1050px"><thead><tr><th>সারি / নাম</th><th>ব্যাচ / মডিউল</th><th>ভর্তির তারিখ</th><th>প্রথম মাস / এককালীন ফি</th><th>আজ পর্যন্ত ফি</th><th>জমা</th><th>বাকি</th><th>অবস্থা</th></tr></thead><tbody>${p.rows.map(r => `<tr><td>${bn(r.row)}. <b>${esc(r.student.name)}</b><small>${esc(r.student.phone || r.student.guardianPhone || "নম্বর খালি")}</small><details><summary>সব তথ্য</summary><dl>${window.SICAdmissionSheet.FIELDS.filter(([, f]) => r.student[f] !== undefined && r.student[f] !== "" && r.student[f] !== false).map(([, f, label]) => `<dt>${esc(label)}</dt><dd>${esc(r.student[f] === true ? "হ্যাঁ" : r.student[f])}</dd>`).join("")}</dl>${r.paid > 0 ? `<p>জমার তারিখ: ${esc(r.paymentDate)} · ${esc(r.method)}</p>` : ""}</details></td><td>${esc(r.batchLabel)}<small>${esc(r.courseName)}</small></td><td>${esc(r.student.admissionDate)}</td><td>${money(r.fees.firstMonth)}${r.fees.monthly ? `<small>${bn(r.fees.months)} মাস</small>` : ""}</td><td>${money(r.fees.totalDue)}</td><td>${money(r.paid)}</td><td>${money(r.fees.balance)}</td><td>${r.existingId ? `আগে আছে (${esc(r.existingId)}) — বাদ` : "নতুন"}</td></tr>`).join("")}</tbody></table></div>
      <p>আগে থাকা শিক্ষার্থীর তথ্য বা টাকা বদলাবে না। Paid Amount খালি হলে পেমেন্ট তৈরি হবে না; Payment Date খালি হলে Joining Date ব্যবহার হবে। সংরক্ষণের আগে ব্যাকআপ হবে।</p>
      ${!p.errors.length && p.summary.create ? `<label class="check"><input type="checkbox" data-ai-confirm> তথ্য, ভর্তির তারিখ ও বেতন যাচাই করেছি</label><div class="toolbar"><button type="button" class="btn gold" data-ai-commit disabled>${bn(p.summary.create)} জন শিক্ষার্থী আমদানি করুন</button></div>` : ""}`;
  }
  root.oninput = e => { if (e.target.matches("[data-ai-date],[data-ai-discount],[data-ai-chapters]")) invalidate(); };
  root.onchange = async e => {
    const el = e.target;
    if (el.matches("[data-ai-confirm]")) { q("[data-ai-commit]").disabled = !el.checked || busy; return; }
    if (busy) return;
    if (el.matches("[data-ai-session]")) q("[data-ai-batch]").innerHTML = X.opt([["", "ব্যাচ বাছুন"], ...DB.batches.filter(b => b.active !== false && b.session === el.value).map(b => [b.id, U.batchLabel(b)])], "");
    if (el.matches("[data-ai-sheet]")) return parse();
    if (!el.matches("[data-ai-file]")) return invalidate();
    invalidate(); parsed = workbook = null; q("[data-ai-sheet-wrap]").hidden = true; q("[data-ai-filename]").textContent = "";
    const file = el.files[0]; q("[data-ai-check]").disabled = true; if (!file) return;
    if (file.size > 5 * 1024 * 1024 || !/\.(xlsx|xls|csv)$/i.test(file.name)) { el.value = ""; return error("৫ MB-এর মধ্যে .xlsx, .xls বা .csv দিন"); }
    lock(true);
    try {
      const XLSX = await excel(); workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false, sheetRows: 502 });
      q("[data-ai-filename]").textContent = file.name;
      const selected = workbook.SheetNames.includes("Students") ? "Students" : workbook.SheetNames[0];
      q("[data-ai-sheet]").innerHTML = X.opt(workbook.SheetNames.map(s => [s, s]), selected);
      q("[data-ai-sheet-wrap]").hidden = workbook.SheetNames.length <= 1; parse();
    } catch (e) { error(e.message); } finally { el.value = ""; lock(false); }
  };
  root.onclick = async e => {
    const button = e.target.closest("button"); if (!button || busy) return;
    if (button.matches("[data-ai-close]")) return X.closeModal();
    if (button.matches("[data-ai-check]")) {
      if (!parsed || parsed.errors.length) return;
      lock(true); error("");
      try {
        payload = { defaults: { session: q("[data-ai-session]").value, batchId: q("[data-ai-batch]").value, courseId: q("[data-ai-course]").value, admissionDate: q("[data-ai-date]").value, discount: q("[data-ai-discount]").value, chapters: q("[data-ai-chapters]").value }, rows: parsed.rows };
        preview = await api("/api/admin/admission-import", { body: payload }); renderPreview();
      } catch (e) { preview = null; q("[data-ai-preview]").innerHTML = ""; error(e.message); } finally { lock(false); }
    }
    if (button.matches("[data-ai-commit]")) {
      if (!preview || preview.errors.length || !q("[data-ai-confirm]").checked) return;
      lock(true); error("");
      try {
        const result = await api("/api/admin/admission-import", { body: { ...payload, commit: true, previewToken: preview.token } });
        root.innerHTML = `<h3>আমদানি সম্পন্ন</h3><p>${bn(result.create)} জন শিক্ষার্থী যোগ হয়েছে। ${bn(result.skip)} জন আগে থাকায় বাদ গেছে। কোনো SMS পাঠানো হয়নি।</p><p>ভর্তির তারিখ থেকে বেতন হিসাব চালু হয়েছে। প্রোফাইল থেকে বাকি তথ্য ও ছবি যোগ করতে পারবেন।</p><button type="button" class="btn gold" data-ai-done>শিক্ষার্থীর তালিকায় যান</button>`;
        q("[data-ai-done]").onclick = async () => { X.closeModal(); await X.load(); location.hash = "students"; X.route(); };
        await X.load().catch(() => {});
      } catch (e) { error(e.message + "। উত্তর না পেলেও একই প্রিভিউ দিয়ে আবার চেষ্টা করলে দ্বিগুণ যোগ হবে না।"); } finally { lock(false); }
    }
  };
};
