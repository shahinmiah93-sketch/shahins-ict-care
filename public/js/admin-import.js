window.SICStudentImport = function (X) {
  "use strict";
  const { $, esc, bn, money, api } = U;
  const DB = X.DB, root = document.createElement("div");
  let workbook = null, parsed = null, preview = null, payload = null, busy = false;
  const sheets = window.SICStudentSheet;
  X.openModal({ title: "Excel থেকে শিক্ষার্থী আমদানি", body: '<div id="studentImportRoot"></div>', wide: true, noFoot: true });
  $("#studentImportRoot").append(root);
  root.innerHTML = `<p>Name, Number, Guardian Number, Joining Date এবং মাসের কলামসহ Excel দিন। বাকি ব্যক্তিগত তথ্য পরে যোগ করা যাবে।</p>
    <div class="fgrid">
      <label>সেশন<select data-im-session>${X.opt([["", "সেশন বাছুন"], ...DB.sessions.filter(s => s.active !== false).map(s => [s.name, s.name])], "")}</select></label>
      <label>ব্যাচ<select data-im-batch><option value="">আগে সেশন বাছুন</option></select></label>
      <label>মাসিক মডিউল<select data-im-course>${X.opt([["", "মডিউল বাছুন"], ...DB.courses.filter(c => c.active !== false && c.feeType === "monthly").map(c => [c.id, `${c.name} — ${money(c.fee)}/মাস`])], "")}</select></label>
      <label>প্রতি মাসে ছাড় (টাকা)<input type="number" min="0" step="0.01" value="0" data-im-discount></label>
      <label>মাসের কলামগুলোর বছর<input type="number" min="2000" max="2100" value="${new Date().getFullYear()}" data-im-year></label>
      <label>মাসের ঘরের অর্থ<select data-im-mode><option value="">অবশ্যই বেছে নিন</option><option value="paid">জমা দেওয়া টাকার পরিমাণ</option><option value="due">বকেয়া টাকার পরিমাণ</option><option value="status">Paid / Unpaid</option></select></label>
    </div>
    <p class="muted">খালি মাসের ঘর থেকে পেমেন্ট তৈরি হবে না। বকেয়ায় 0 মানে পুরো ফি পরিশোধিত; জমার ঘরে 0 মানে কিছু জমা হয়নি। ভর্তির আগের মাস খালি রাখুন। Paid/বকেয়ার ক্ষেত্রে নির্ধারিত ফি, ছাড় ও ভর্তির মাসের নিয়ম ধরে জমা হিসাব হবে।</p>
    <div class="toolbar"><button type="button" class="btn line" data-im-template>নমুনা Excel ডাউনলোড</button><label class="btn gold">Excel বাছুন<input type="file" accept=".xlsx,.xls,.csv" data-im-file hidden></label><span data-im-filename></span></div>
    <label hidden data-im-sheet-label>ফাইলের শিট<select data-im-sheet></select></label>
    <p class="muted">সর্বোচ্চ ৫০০ শিক্ষার্থী / ৫ MB। Joining Date: YYYY-MM-DD অথবা DD/MM/YYYY। একই শিক্ষার্থী আগে থাকলে বাদ যাবে; পুরোনো তথ্য বা টাকা বদলাবে না। কোনো SMS পাঠানো হবে না।</p>
    <div class="toolbar"><button type="button" class="btn gold" data-im-check disabled>প্রিভিউ ও হিসাব যাচাই</button><button type="button" class="btn line" data-im-close>বন্ধ করুন</button></div>
    <p class="err" data-im-error role="alert"></p><div data-im-preview></div>`;
  const q = s => $(s, root);
  function error(message) { q("[data-im-error]").textContent = message || ""; }
  function invalidate() { preview = payload = null; q("[data-im-preview]").innerHTML = ""; error(""); }
  let loading;
  function excel() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!loading) loading = new Promise((resolve, reject) => {
      const script = document.createElement("script"); script.src = "/vendor/xlsx-0.20.3.full.min.js";
      script.onload = () => resolve(window.XLSX); script.onerror = () => { loading = null; script.remove(); reject(new Error("Excel পড়ার টুল লোড হয়নি। আবার চেষ্টা করুন")); }; document.head.append(script);
    });
    return loading;
  }
  function showParsed() {
    invalidate(); parsed = null; q("[data-im-check]").disabled = true;
    try {
      parsed = sheets.parseWorkbook(workbook, q("[data-im-sheet]").value, window.XLSX);
      if (parsed.errors.length) {
        q("[data-im-preview]").innerHTML = `<h3>ফাইলে ভুল আছে</h3><ul>${parsed.errors.map(e => `<li>সারি ${bn(e.row)}: ${esc(e.error)}</li>`).join("")}</ul><p>ফাইল ঠিক করে আবার বাছুন। এখন কোনো তথ্য আমদানি করা হয়নি।</p>`;
      } else q("[data-im-check]").disabled = false;
    } catch (e) { error(e.message); }
  }
  function renderPreview() {
    const p = preview;
    q("[data-im-preview]").innerHTML = `<h3>আমদানির আগে যাচাই করুন</h3><p>নতুন শিক্ষার্থী: <b>${bn(p.summary.create)}</b> · আগে আছে, বাদ যাবে: <b>${bn(p.summary.skip)}</b> · পেমেন্ট রেকর্ড: <b>${bn(p.summary.payments)}</b> · মোট আগের জমা: <b>${money(p.summary.paid)}</b></p>
      ${p.errors.length ? `<ul class="err">${p.errors.map(e => `<li>সারি ${bn(e.row)}: ${esc(e.error)}</li>`).join("")}</ul><p>সব ভুল ঠিক করে আবার ফাইল বাছুন।</p>` : ""}
      <div class="tbl-wrap" style="max-height:360px;overflow:auto"><table><thead><tr><th>সারি</th><th>Name</th><th>Number</th><th>Guardian Number</th><th>Joining Date</th><th>মাসভিত্তিক জমা</th><th>অবস্থা</th></tr></thead><tbody>${p.rows.map(r => `<tr><td>${bn(r.row)}</td><td>${esc(r.name)}</td><td>${esc(r.phone)}</td><td>${esc(r.guardianPhone)}</td><td>${esc(r.admissionDate)}</td><td>${r.entries.map(e => `${esc(e.month)}: ${money(e.amount)}`).join("<br>") || "—"}</td><td>${r.existingId ? `আগে আছে (${esc(r.existingId)}) — বাদ` : "নতুন"}</td></tr>`).join("")}</tbody></table></div>
      <p>মাসের জমা আগের হিসাব হিসেবে যোগ হবে; প্রকৃত লেনদেনের দিন ফাইলে না থাকায় রেকর্ড তৈরির তারিখ আজকের থাকবে। মাসভিত্তিক আদায়ের রিপোর্ট সংশ্লিষ্ট মাসেই দেখাবে। সংরক্ষণের আগে ব্যাকআপ হবে।</p>
      <label class="check"><input type="checkbox" data-im-confirm> সেশন, ব্যাচ, মডিউল, বছর এবং উপরের টাকার হিসাব যাচাই করেছি</label><div class="toolbar"><button type="button" class="btn gold" data-im-commit disabled${p.errors.length || !p.summary.create ? ' hidden' : ''}>${bn(p.summary.create)} জন শিক্ষার্থী আমদানি করুন</button></div>`;
  }
  root.onchange = async e => {
    const el = e.target;
    if (el.matches("[data-im-confirm]")) { q("[data-im-commit]").disabled = !el.checked || busy; return; }
    if (busy) return;
    if (el.matches("[data-im-session]")) q("[data-im-batch]").innerHTML = X.opt([["", "ব্যাচ বাছুন"], ...DB.batches.filter(b => b.session === el.value && b.active !== false).map(b => [b.id, U.batchLabel(b)])], "");
    if (el.matches("[data-im-file]")) {
      invalidate(); parsed = workbook = null; q("[data-im-check]").disabled = true;
      q("[data-im-sheet-label]").hidden = true; q("[data-im-filename]").textContent = "";
      const file = el.files[0]; if (!file) return;
      if (file.size > 5 * 1024 * 1024 || !/\.(xlsx|xls|csv)$/i.test(file.name)) return error("৫ MB-এর মধ্যে .xlsx, .xls বা .csv ফাইল দিন");
      busy = true;
      try {
        const XLSX = await excel(); workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false, sheetRows: 502 });
        q("[data-im-filename]").textContent = file.name;
        q("[data-im-sheet]").innerHTML = X.opt(workbook.SheetNames.map(s => [s, s]), workbook.SheetNames[0]);
        q("[data-im-sheet-label]").hidden = workbook.SheetNames.length <= 1; showParsed();
      } catch (e) { error(e.message); } finally { busy = false; el.value = ""; }
      return;
    }
    if (el.matches("[data-im-sheet]")) return showParsed();
    invalidate();
  };
  root.oninput = e => { if (e.target.matches("[data-im-year],[data-im-discount]")) invalidate(); };
  root.onclick = async e => {
    const button = e.target.closest("button"); if (!button || busy) return;
    if (button.matches("[data-im-close]")) return X.closeModal();
    if (button.matches("[data-im-template]")) {
      busy = true;
      try {
        const XLSX = await excel(), wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([["Name", "Number", "Guardian Number", "Joining Date", "August", "September", "October", "November"]]);
        ws["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, ...Array.from({ length: 4 }, () => ({ wch: 16 }))];
        XLSX.utils.book_append_sheet(wb, ws, "Students"); XLSX.writeFile(wb, "Student-Import-Template.xlsx");
      } catch (e) { error(e.message); } finally { busy = false; }
      return;
    }
    if (button.matches("[data-im-check]")) {
      if (!parsed || parsed.errors.length) return;
      busy = true; button.disabled = true; error("");
      try {
        payload = { batchId: q("[data-im-batch]").value, courseId: q("[data-im-course]").value, year: q("[data-im-year]").value, monthMode: q("[data-im-mode]").value, discount: q("[data-im-discount]").value, rows: parsed.rows };
        preview = await api("/api/admin/student-import", { method: "POST", body: JSON.stringify(payload) }); renderPreview();
      } catch (e) { error(e.message); } finally { busy = false; button.disabled = false; }
    }
    if (button.matches("[data-im-commit]")) {
      if (!preview || preview.errors.length || !q("[data-im-confirm]").checked) return;
      busy = true; button.disabled = true; error("");
      try {
        const result = await api("/api/admin/student-import", { method: "POST", body: JSON.stringify({ ...payload, commit: true, previewToken: preview.token }) });
        root.innerHTML = `<h3>আমদানি সম্পন্ন</h3><p>${bn(result.create)} জন শিক্ষার্থী ও ${bn(result.payments)}টি আগের জমার রেকর্ড যোগ হয়েছে। ${bn(result.skip)} জন আগে থাকায় বাদ গেছে।</p><p>শিক্ষার্থীর প্রোফাইল থেকে বাকি তথ্য ও PIN দেখতে পারবেন। কোনো SMS পাঠানো হয়নি।</p><button type="button" class="btn gold" data-im-done>শিক্ষার্থীর তালিকায় যান</button>`;
        q("[data-im-done]").onclick = async () => { X.closeModal(); await X.load(); location.hash = "students"; X.route(); };
        await X.load();
      } catch (e) { error(e.message + "। সংরক্ষণ সম্পন্ন হয়ে থাকলে একই প্রিভিউ দিয়ে আবার চেষ্টা করলেও দ্বিগুণ যোগ হবে না।"); } finally { busy = false; button.disabled = false; }
    }
  };
};
