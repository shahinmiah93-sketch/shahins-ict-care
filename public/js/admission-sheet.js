(function () {
  "use strict";
  // Header, stored field, Bangla label. Extra personal columns may be omitted entirely.
  const FIELDS = [
    ["Name", "name", "নাম (বাংলা)"], ["English Name", "nameEn", "নাম (ENGLISH)"],
    ["Number", "phone", "শিক্ষার্থীর মোবাইল নাম্বার-১"], ["Guardian Number", "guardianPhone", "অভিভাবকের নাম্বার"],
    ["Joining Date", "admissionDate", "ভর্তির তারিখ"], ["Session", "session", "সেশন"], ["Batch", "batch", "ব্যাচ"], ["Module", "course", "মডিউল"],
    ["Discount", "discount", "ডিসকাউন্ট (৳)"], ["Paid Amount", "paid", "ভর্তির সময় জমা (৳)"], ["Payment Method", "method", "পেমেন্ট পদ্ধতি"], ["Payment Date", "paymentDate", "জমার তারিখ"],
    ["Chapters", "chapters", "অধ্যায়ের আইডি"], ["Course End Date", "planEnd", "কোর্স শেষ হওয়ার তারিখ"],
    ["Date of Birth", "dob", "জন্ম তারিখ"], ["Gender", "gender", "লিঙ্গ"], ["Blood Group", "bloodGroup", "রক্তের গ্রুপ"], ["Religion", "religion", "ধর্ম"], ["Nationality", "nationality", "জাতীয়তা"],
    ["Number 2", "phone2", "শিক্ষার্থীর মোবাইল নাম্বার-২"], ["WhatsApp", "whatsapp", "শিক্ষার্থীর হোয়াটসঅ্যাপ"], ["Email", "email", "ইমেইল"],
    ["Father Name", "fatherName", "বাবার নাম"], ["Father Occupation", "fatherOccupation", "বাবার পেশা"], ["Father Number", "fatherPhone", "বাবার মোবাইল নাম্বার"],
    ["Mother Name", "motherName", "মায়ের নাম"], ["Mother Occupation", "motherOccupation", "মায়ের পেশা"], ["Mother Number", "motherPhone", "মায়ের মোবাইল নাম্বার"],
    ["Guardian Name", "guardianName", "অভিভাবকের নাম"], ["Guardian Occupation", "guardianOccupation", "অভিভাবকের পেশা"], ["Guardian Relation", "guardianRelation", "অভিভাবকের সাথে সম্পর্ক"],
    ["Address", "address", "বর্তমান ঠিকানা"], ["Permanent Address", "permanentAddress", "স্থায়ী ঠিকানা"], ["Same Address", "sameAddress", "বর্তমান ও স্থায়ী ঠিকানা একই"],
    ["SSC Exam", "sscExam", "পরীক্ষা"], ["SSC School", "sscSchool", "SSC প্রতিষ্ঠান"], ["SSC Board", "sscBoard", "SSC বোর্ড"], ["SSC Group", "sscGroup", "SSC গ্রুপ"], ["SSC Year", "sscYear", "SSC সাল"], ["SSC GPA", "sscGpa", "SSC GPA"], ["SSC Roll", "sscRoll", "SSC রোল"],
    ["College", "college", "কলেজ"], ["College Roll", "collegeRoll", "কলেজ রোল"], ["Class", "klass", "শ্রেণি"], ["Group", "group", "বিভাগ"],
    ["Subject 1", "subject1", "বিষয়-০১"], ["Subject 2", "subject2", "বিষয়-০২"], ["Subject 3", "subject3", "বিষয়-০৩"], ["Subject 4", "subject4", "৪র্থ বিষয়"],
    ["Source", "source", "আমাদের ব্যাপারে কিভাবে জেনেছো?"], ["Reference Name", "refName", "রেফারেন্সকারীর নাম"], ["Reference Number", "refPhone", "রেফারেন্সকারীর মোবাইল নাম্বার"], ["Reference Occupation", "refOccupation", "রেফারেন্সকারীর পেশা"], ["Note", "note", "নোট"]
  ];
  const digits = v => String(v ?? "").replace(/[০-৯]/g, d => "০১২৩৪৫৬৭৮৯".indexOf(d));
  const key = v => digits(v).trim().toLowerCase().replace(/[\s_.()*\-]+/g, "");
  function dateValue(v, XLSX, date1904) {
    if (v === "" || v == null) return "";
    let parts;
    if (typeof v === "number") { const d = XLSX.SSF.parse_date_code(v, { date1904 }); if (d) parts = [d.y, d.m, d.d]; }
    else {
      const text = digits(v).trim(); let m = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
      if (m) parts = m.slice(1).map(Number);
      else if ((m = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/))) parts = [Number(m[3]), Number(m[2]), Number(m[1])];
      else if ((m = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/))) {
        const year = Number(m[3]) + (m[3].length === 2 ? 2000 : 0);
        parts = [year, Number(m[2]), Number(m[1])];
      }
    }
    if (!parts) throw new Error("তারিখ DD.MM.YY, YYYY-MM-DD অথবা DD/MM/YYYY আকারে দিন");
    const [y, m, d] = parts, dt = new Date(Date.UTC(y, m - 1, d));
    if (y < 1900 || y > 2100 || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) throw new Error("সঠিক তারিখ দিন");
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  function parseWorkbook(workbook, sheetName, XLSX) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet?.["!ref"]) throw new Error("এই শিটে তথ্য নেই");
    const range = XLSX.utils.decode_range(sheet["!fullref"] || sheet["!ref"]);
    if (range.e.r > 500 || range.e.c > 79) throw new Error("একবারে সর্বোচ্চ ৫০০ শিক্ষার্থী ও ৮০ কলাম দিন");
    const aliases = new Map();
    FIELDS.forEach(([h, f, bn]) => [h, f, bn].forEach(k => aliases.set(key(k), f)));
    [["Admission Date", "admissionDate"], ["Phone", "phone"], ["Guardian Phone", "guardianPhone"], ["Batch Name", "batch"], ["Course", "course"]].forEach(([h, f]) => aliases.set(key(h), f));
    const columns = [], used = new Set();
    for (let c = 0; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: 0, c })], header = String(cell?.v ?? "").trim();
      if (!header) {
        for (let r = 1; r <= range.e.r; r++) if (String(sheet[XLSX.utils.encode_cell({ r, c })]?.v ?? "").trim()) throw new Error(`কলাম ${c + 1}-এর শিরোনাম নেই`);
        continue;
      }
      const field = aliases.get(key(header));
      if (!field) throw new Error(`অপরিচিত কলাম: ${header}। নমুনার শিরোনাম ব্যবহার করুন`);
      if (used.has(field) || cell.f) throw new Error(`ডুপ্লিকেট বা Formula শিরোনাম: ${header}`);
      used.add(field); columns.push({ c, field, header });
    }
    if (!used.has("name") && !used.has("nameEn")) throw new Error("Name বা English Name কলাম দিন");
    const rows = [], errors = [];
    for (let r = 1; r <= range.e.r; r++) {
      if (!columns.some(({ c }) => String(sheet[XLSX.utils.encode_cell({ r, c })]?.v ?? "").trim())) continue;
      const row = { row: r + 1 };
      try {
        for (const { c, field, header } of columns) {
          const cell = sheet[XLSX.utils.encode_cell({ r, c })];
          if (cell?.f || cell?.t === "e") throw new Error(`${header}: Formula বা Excel error বাদ দিয়ে শুধু মান দিন`);
          row[field] = ["admissionDate", "dob", "planEnd", "paymentDate"].includes(field) ? dateValue(cell?.v, XLSX, !!workbook.Workbook?.WBProps?.date1904) : String(cell?.v ?? "").trim();
        }
        if (!row.name && !row.nameEn) throw new Error("অন্তত একটি নাম দিন; অন্য ঘরগুলো খালি থাকতে পারে");
        rows.push(row);
      } catch (e) { errors.push({ row: r + 1, error: e.message }); }
    }
    if (!rows.length && !errors.length) throw new Error("প্রথম সারির শিরোনামের নিচে শিক্ষার্থীর তথ্য লিখুন");
    return { rows, errors };
  }
  window.SICAdmissionSheet = { FIELDS, dateValue, parseWorkbook };
})();
