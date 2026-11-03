// প্রথমবার চালালে (বা পুরনো কাঠামো থেকে আপডেট হলে) এই তথ্য দিয়ে ডেটাবেজ তৈরি হয়।
// কাঠামো: সেশন (HSC-27) → ক্লাস ব্যাচ (27-B) ; মডিউল (০১–০৫) ; শিক্ষার্থী → এক বা একাধিক মডিউলে ভর্তি (enrollment)
// [নমুনা] লেখা জিনিসগুলো অ্যাডমিন প্যানেল থেকে বদলে নিন / মুছে ফেলুন।

export const DB_VERSION = 2;

const d = (offset) => {
  const t = new Date();
  t.setDate(t.getDate() + offset);
  return t.toLocaleDateString("en-CA");
};
const monthStart = (back) => {
  const t = new Date();
  t.setMonth(t.getMonth() - back, 1);
  return t.toLocaleDateString("en-CA");
};

// HSC ICT-র অধ্যায় ও অধ্যায়ভিত্তিক ব্যাচের ফি (কোর্স প্ল্যানের ছবি অনুযায়ী)
export const CHAPTERS = [
  { id: "1", name: "অধ্যায় ১: তথ্য ও যোগাযোগ প্রযুক্তি — বিশ্ব ও বাংলাদেশ প্রেক্ষিত", fee: 800 },
  { id: "2", name: "অধ্যায় ২: কমিউনিকেশন সিস্টেম ও নেটওয়ার্কিং", fee: 1200 },
  { id: "3.1", name: "অধ্যায় ৩.১: সংখ্যা পদ্ধতি", fee: 800 },
  { id: "3.2", name: "অধ্যায় ৩.২: ডিজিটাল ডিভাইস (লজিক গেট)", fee: 1000 },
  { id: "4", name: "অধ্যায় ৪: ওয়েব ডিজাইন ও HTML", fee: 1200 },
  { id: "5", name: "অধ্যায় ৫: প্রোগ্রামিং ভাষা (C)", fee: 1500 },
  { id: "6", name: "অধ্যায় ৬: ডেটাবেজ ম্যানেজমেন্ট সিস্টেম", fee: 800 },
];

export const MODULES = [
  {
    id: "mod01", code: "01", icon: "০১", name: "রেগুলার ব্যাচ", feeType: "monthly", fee: 1000, duration: "যতদিন প্রয়োজন",
    short: "মাসিক ফি-তে যতদিন প্রয়োজন ততদিন স্বাধীনভাবে পড়তে পারবে",
    desc: "নিয়মিত ক্লাস, সাপ্তাহিক পরীক্ষা আর হাতে-কলমে প্র্যাকটিক্যাল। মাসে যে কয়টা ক্লাসই হোক, ফি একই।",
    features: ["নিয়মিত ক্লাস", "সাপ্তাহিক পরীক্ষা", "প্র্যাকটিক্যাল", "যতদিন ইচ্ছা পড়া"], popular: true, active: true, chapters: [],
  },
  {
    id: "mod02", code: "02", icon: "০২", name: "অধ্যায়ভিত্তিক ব্যাচ", feeType: "chapter", fee: 0, duration: "অধ্যায় অনুযায়ী",
    short: "প্রয়োজন অনুযায়ী যেকোনো অধ্যায়ের কোর্সে যুক্ত হতে পারবে",
    desc: "যে অধ্যায়ে দুর্বল, শুধু সেই অধ্যায়টাই পড়ো। প্রতিটি অধ্যায়ের ফি আলাদা।",
    features: ["পছন্দের অধ্যায় বাছাই", "অধ্যায় শেষে পরীক্ষা", "অধ্যায়ভিত্তিক ফি"], popular: false, active: true, chapters: CHAPTERS,
  },
  {
    id: "mod03", code: "03", icon: "০৩", name: "আইসিটি ফুল কোর্স", feeType: "once", fee: 5000, duration: "পুরো সিলেবাস",
    short: "১ম থেকে ৬ষ্ঠ অধ্যায় পর্যন্ত একদম বিস্তারিত",
    desc: "আইসিটি বইয়ের ১ম থেকে ৬ষ্ঠ অধ্যায় পর্যন্ত একদম বিস্তারিত এবং নির্ভুলভাবে শেখানো হবে। আইসিটিতে পূর্ণাঙ্গ প্রস্তুতির জন্য বিশেষভাবে সাজানো।",
    features: ["৬টি অধ্যায় বিস্তারিত", "এককালীন ফি", "পূর্ণাঙ্গ প্রস্তুতি"], popular: false, active: true, chapters: [],
  },
  {
    id: "mod04", code: "04", icon: "০৪", name: "আইসিটি ক্র্যাশ কোর্স", feeType: "once", fee: 3000, duration: "সংক্ষিপ্ত",
    short: "পুরো সিলেবাস সংক্ষিপ্ত আকারে",
    desc: "পুরো আইসিটি সিলেবাসকে কিছুটা সংক্ষিপ্ত আকারে পড়ানো হবে। পরীক্ষার আগে দ্রুত প্রস্তুতির জন্য।",
    features: ["পুরো সিলেবাস সংক্ষেপে", "এককালীন ফি", "দ্রুত প্রস্তুতি"], popular: false, active: true, chapters: [],
  },
  {
    id: "mod05", code: "05", icon: "০৫", name: "আইসিটি মডেল টেস্ট", feeType: "once", fee: 1000, duration: "১৫টি পরীক্ষা",
    short: "বিষয়, অধ্যায় ও MCQ মিলিয়ে মোট ১৫টি পরীক্ষা",
    desc: "সম্পূর্ণ আইসিটি বইয়ের উপর বিষয়ভিত্তিক, অধ্যায়ভিত্তিক, এমসিকিউ টেস্ট ও ফাইনাল মডেল টেস্ট মিলিয়ে মোট ১৫টি পরীক্ষা।",
    features: ["১৫টি পরীক্ষা", "MCQ ও সৃজনশীল", "ফাইনাল মডেল টেস্ট"], popular: false, active: true, chapters: [],
  },
];

// নমুনা সময় — অ্যাডমিন → মডিউল ও ব্যাচ থেকে বদলান
const SLOTS = [
  ["শনি, সোম, বুধ", "সকাল ৭:০০"], ["শনি, সোম, বুধ", "সকাল ৮:০০"], ["শনি, সোম, বুধ", "বিকাল ৪:০০"],
  ["রবি, মঙ্গল, বৃহস্পতি", "সকাল ৭:০০"], ["রবি, মঙ্গল, বৃহস্পতি", "সকাল ৮:০০"], ["রবি, মঙ্গল, বৃহস্পতি", "বিকাল ৪:০০"],
  ["শুক্রবার", "সকাল ১০:০০"],
];
export function makeBatches(session) {
  const yy = session.replace(/\D/g, "").slice(-2);
  return SLOTS.map(([days, time], i) => {
    const letter = "ABCDEFG"[i];
    return { id: `bat_${yy}${letter.toLowerCase()}`, session, name: `${yy}-${letter}`, days, time, capacity: 15 };
  });
}

export function seedDatabase(keep = {}) {
  const sessions = [
    { id: "HSC-27", name: "HSC-27", note: "", active: true },
    { id: "HSC-28", name: "HSC-28", note: "", active: true },
  ];
  const batches = [...makeBatches("HSC-27"), ...makeBatches("HSC-28")];
  const sample = [
    // নাম, লিঙ্গ, সেশন, ব্যাচ, মডিউল, অধ্যায়, কত মাস আগে, PIN
    ["নমুনা শিক্ষার্থী ১", "M", "HSC-27", "bat_27b", "mod01", [], 2, "1111"],
    ["নমুনা শিক্ষার্থী ২", "F", "HSC-27", "bat_27b", "mod01", [], 1, "2222"],
    ["নমুনা শিক্ষার্থী ৩", "M", "HSC-27", "bat_27b", "mod03", [], 1, "3333"],
    ["নমুনা শিক্ষার্থী ৪", "F", "HSC-28", "bat_28a", "mod02", ["3.1", "4"], 0, "4444"],
    ["নমুনা শিক্ষার্থী ৫", "M", "HSC-28", "bat_28a", "mod05", [], 0, "5555"],
  ];
  const counters = {};
  const students = [], enrollments = [], payments = [];
  let receipt = 1001;
  sample.forEach(([name, gender, session, batchId, courseId, chapters, back, pin], i) => {
    const yy = session.slice(-2);
    counters[yy] = (counters[yy] || 0) + 1;
    const id = `${yy}${String(counters[yy]).padStart(4, "0")}`; // HSC-27 → 270001
    const date = monthStart(back);
    students.push({
      id, serial: 1001 + i, name, gender, phone: "0170000000" + (i + 1), guardianName: "নমুনা অভিভাবক", guardianPhone: "0180000000" + (i + 1),
      college: "নমুনা কলেজ", address: "", session, batchId, admissionDate: date, status: "active", note: "", pin, photo: false,
      createdAt: new Date().toISOString(),
    });
    const mod = MODULES.find((m) => m.id === courseId);
    const fee = mod.feeType === "chapter" ? CHAPTERS.filter((c) => chapters.includes(c.id)).reduce((t, c) => t + c.fee, 0) : mod.fee;
    const enr = { id: `enr_s${i}`, studentId: id, courseId, chapters, fee, discount: i === 2 ? 500 : 0, startDate: date, endDate: "", status: "active", createdAt: new Date().toISOString() };
    enrollments.push(enr);
    const first = mod.feeType === "monthly" ? fee : Math.min(fee - enr.discount, 2000);
    payments.push({ id: `pay_s${i}`, studentId: id, enrollmentId: enr.id, amount: first, month: date.slice(0, 7), method: "নগদ", note: "ভর্তির সময় জমা", date, receiptNo: receipt++ });
  });
  const attendance = {};
  for (let back = 1; back <= 12; back++) {
    const date = d(-back);
    if (new Date(date + "T00:00:00").getDay() === 5) continue;
    for (const b of ["bat_27b", "bat_28a"]) {
      const marks = {};
      students.filter((s) => s.batchId === b).forEach((s, i) => (marks[s.id] = (back + i) % 6 === 0 ? "A" : (back + i) % 9 === 0 ? "L" : "P"));
      attendance[`${date}|${b}`] = marks;
    }
  }
  const s27 = students.filter((s) => s.batchId === "bat_27b");
  const exams = [
    { id: "exm_1", batchId: "bat_27b", title: "সাপ্তাহিক পরীক্ষা — অধ্যায় ৩.১ (সংখ্যা পদ্ধতি)", date: d(-9), fullMarks: 50, marks: { [s27[0].id]: 41, [s27[1].id]: 46, [s27[2].id]: 35 } },
    { id: "exm_2", batchId: "bat_27b", title: "সাপ্তাহিক পরীক্ষা — অধ্যায় ৪ (HTML)", date: d(-2), fullMarks: 50, marks: { [s27[0].id]: 44, [s27[1].id]: 48, [s27[2].id]: 39 } },
  ];

  return {
    meta: { version: DB_VERSION, created: new Date().toISOString() },
    settings: {
      name: "Shahin's ICT Care", shortName: "শাহিন'স", tagline: "ICT এখন আর ভয়ের বিষয় না", taglineAccent: "বুঝে শিখি, হাতে-কলমে করি",
      intro: "HSC ICT-র রেগুলার ব্যাচ, অধ্যায়ভিত্তিক ব্যাচ, ফুল কোর্স, ক্র্যাশ কোর্স আর মডেল টেস্ট। ছোট ব্যাচ, প্রতিটি ক্লাসে প্র্যাকটিক্যাল, নিয়মিত পরীক্ষা আর অভিভাবকের সাথে যোগাযোগ।",
      location: "মাস্টার কলোনি, মাদারীপুর", phone: "01749105902", phone2: "", whatsapp: "8801749105902",
      email: "", address: "মাস্টার কলোনি, মাদারীপুর", facebook: "", mapUrl: "",
      hours: "শনি – বৃহস্পতি, সকাল ৭টা – রাত ৯টা", motto: "Learn · Practice · Succeed",
      ...keep,
    },
    sessions, batches, courses: MODULES, students, enrollments, payments, exams, attendance,
    enquiries: [], applications: [],
    notices: [
      { id: "not_1", title: "HSC-28-এ ভর্তি চলছে", body: "HSC-28 সেশনের সব ক্লাস ব্যাচে ভর্তি চলছে। সিট সীমিত।", date: d(0), until: "", public: true, important: true },
      { id: "not_2", title: "শুক্রবার শুধু 27-G ও 28-G ব্যাচ", body: "শুক্রবার শুধু G ব্যাচের ক্লাস হবে।", date: d(-3), until: "", public: false, important: false },
    ],
    teachers: [
      { id: "tch_1", name: "শাহিন [নমুনা]", subject: "ICT — প্রতিষ্ঠাতা ও প্রধান শিক্ষক", bio: "HSC ICT পড়াচ্ছি বহু বছর ধরে। ICT মুখস্থের না, বোঝার বিষয়।", photo: "" },
    ],
  };
}
