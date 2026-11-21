// Shared student search. Reference contacts are deliberately excluded.
window.SICStudentSearch = (() => {
  const text = value => String(value ?? '').normalize('NFKC').replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d)).trim().toLowerCase().replace(/\s+/g, ' ');
  const digits = value => text(value).replace(/\D/g, '').replace(/^(?:0088|88)(?=01)/, '');
  const phones = student => ['phone', 'phone2', 'whatsapp', 'guardianPhone', 'fatherPhone', 'motherPhone'].map(key => digits(student?.[key])).filter(Boolean);
  const match = (student, query, extra = []) => {
    if (!student) return false;
    const q = text(query); if (!q) return true;
    if ([student.id, student.studentId, student.roll, student.appNo, student.leadNo, student.name, student.nameEn, ...extra].some(value => text(value).includes(q))) return true;
    const number = /^[+\d\s().-]+$/.test(q) ? digits(q) : '';
    return !!number && phones(student).some(phone => phone.includes(number));
  };
  return { text, digits, phones, match };
})();
