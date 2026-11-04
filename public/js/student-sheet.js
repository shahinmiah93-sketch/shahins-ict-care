// Excel decoding stays in the admin browser; only the reviewed rows go to the server.
(function () {
  "use strict";
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const digits = v => String(v ?? "").replace(/[০-৯]/g, d => "০১২৩৪৫৬৭৮৯".indexOf(d));
  const key = v => String(v ?? "").trim().toLowerCase().replace(/[\s_.-]+/g, "");
  const phone = v => {
    let s = digits(v).trim().replace(/[\s()+-]/g, "");
    if (/^8801\d{9}$/.test(s)) s = s.slice(2);
    if (/^1\d{9}$/.test(s)) s = "0" + s;
    if (s && !/^01\d{9}$/.test(s)) throw new Error("মোবাইল নম্বর ১১ সংখ্যার হতে হবে (01…)");
    return s;
  };
  function dateValue(v, XLSX, date1904) {
    let parts;
    if (typeof v === "number") {
      const d = XLSX.SSF.parse_date_code(v, { date1904 });
      if (d) parts = [d.y, d.m, d.d];
    } else {
      const text = digits(v).trim();
      let m = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
      if (m) parts = m.slice(1).map(Number);
      else if ((m = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/))) parts = [Number(m[3]), Number(m[2]), Number(m[1])];
    }
    if (!parts) throw new Error("Joining Date দিন YYYY-MM-DD বা DD/MM/YYYY আকারে");
    const [y, m, d] = parts, dt = new Date(Date.UTC(y, m - 1, d));
    if (y < 2000 || y > 2100 || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) throw new Error("Joining Date সঠিক তারিখ নয়");
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  function parseWorkbook(workbook, sheetName, XLSX) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet["!ref"]) throw new Error("এই শিটে কোনো তথ্য নেই");
    const range = XLSX.utils.decode_range(sheet["!fullref"] || sheet["!ref"]);
    if (range.e.r > 500 || range.e.c > 31) throw new Error("একবারে সর্বোচ্চ ৫০০ শিক্ষার্থী ও ৩২টি কলাম দিন");
    const aliases = { name: "name", number: "phone", guardiannumber: "guardianPhone", joiningdate: "admissionDate" };
    const columns = [], used = new Set();
    for (let c = 0; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: 0, c })];
      const header = String(cell?.v ?? "").trim();
      if (!header) {
        for (let r = 1; r <= range.e.r; r++) if (sheet[XLSX.utils.encode_cell({ r, c })]?.v != null) throw new Error(`কলাম ${c + 1}-এর শিরোনাম নেই`);
        continue;
      }
      const month = MONTHS.findIndex(m => key(m) === key(header));
      const field = aliases[key(header)] || (month >= 0 ? `month:${month + 1}` : "");
      if (!field) throw new Error(`অপরিচিত কলাম: ${header}। নমুনা ফাইলের শিরোনাম ব্যবহার করুন`);
      if (used.has(field)) throw new Error(`একই কলাম দুবার আছে: ${header}`);
      if (cell.f) throw new Error("কলামের শিরোনামে Formula ব্যবহার করবেন না");
      used.add(field); columns.push({ c, field, header });
    }
    for (const [header, field] of Object.entries(aliases)) if (!used.has(field)) throw new Error(`কলাম পাওয়া যায়নি: ${{ name: "Name", number: "Number", guardiannumber: "Guardian Number", joiningdate: "Joining Date" }[header]}`);
    const rows = [], errors = [];
    for (let r = 1; r <= range.e.r; r++) {
      if (!columns.some(({ c }) => { const v = sheet[XLSX.utils.encode_cell({ r, c })]?.v; return v != null && String(v).trim() !== ""; })) continue;
      const row = { row: r + 1, months: {} };
      try {
        for (const { c, field, header } of columns) {
          const cell = sheet[XLSX.utils.encode_cell({ r, c })];
          if (cell?.f || cell?.t === "e") throw new Error(`${header}: Formula বা Excel error সরিয়ে শুধু মান দিন`);
          const v = cell?.v ?? "";
          if (field.startsWith("month:")) row.months[field.slice(6)] = digits(v).trim();
          else if (field === "phone" || field === "guardianPhone") row[field] = phone(v);
          else if (field === "admissionDate") row[field] = dateValue(v, XLSX, !!workbook.Workbook?.WBProps?.date1904);
          else row[field] = String(v).trim();
        }
        if (!row.name || row.name.length > 120) throw new Error("Name দিন (সর্বোচ্চ ১২০ অক্ষর)");
        if (!row.phone && !row.guardianPhone) throw new Error("শিক্ষার্থী বা অভিভাবকের অন্তত একটি নম্বর দিন");
        rows.push(row);
      } catch (e) { errors.push({ row: r + 1, error: e.message }); }
    }
    if (!rows.length && !errors.length) throw new Error("শিরোনামের নিচে শিক্ষার্থীর তথ্য দিন");
    return { rows, errors, months: columns.filter(c => c.field.startsWith("month:")).map(c => ({ month: Number(c.field.slice(6)), name: c.header })) };
  }
  window.SICStudentSheet = { MONTHS, phone, dateValue, parseWorkbook };
})();
