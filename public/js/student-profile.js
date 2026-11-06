// Existing students complete their admission details without creating a second admission.
window.SICStudentProfile = function ({ profile, onSaved }) {
  const changes = profile.pendingProfile?.changes || {};
  const values = { ...profile, ...Object.fromEntries(Object.entries(changes).map(([key,change])=>[key,change.to])) };
  const required = new Set(['name','nameEn','dob','gender','phone','guardianName','guardianPhone','address','permanentAddress','college','klass','group']);
  const groups = [
    ['শিক্ষার্থীর তথ্য', [['name','নাম (বাংলা)'],['nameEn','নাম (ইংরেজি)'],['dob','জন্ম তারিখ','date'],['gender','লিঙ্গ',['ছেলে|M','মেয়ে|F','অন্যান্য|O']],['bloodGroup','রক্তের গ্রুপ',U.BLOOD_GROUPS],['religion','ধর্ম',U.RELIGIONS],['nationality','জাতীয়তা'],['phone','শিক্ষার্থীর মোবাইল','tel'],['phone2','অতিরিক্ত মোবাইল','tel'],['whatsapp','হোয়াটসঅ্যাপ','tel'],['email','ইমেইল','email']]],
    ['অভিভাবক ও ঠিকানা', [['fatherName','বাবার নাম'],['fatherOccupation','বাবার পেশা',U.OCCUPATIONS],['fatherPhone','বাবার মোবাইল','tel'],['motherName','মায়ের নাম'],['motherOccupation','মায়ের পেশা',U.OCCUPATIONS],['motherPhone','মায়ের মোবাইল','tel'],['guardianName','অভিভাবকের নাম'],['guardianRelation','অভিভাবকের সাথে সম্পর্ক',U.RELATIONS],['guardianOccupation','অভিভাবকের পেশা',U.OCCUPATIONS],['guardianPhone','অভিভাবকের মোবাইল','tel'],['address','বর্তমান ঠিকানা','textarea'],['sameAddress','বর্তমান ঠিকানাই স্থায়ী ঠিকানা','checkbox'],['permanentAddress','স্থায়ী ঠিকানা','textarea']]],
    ['শিক্ষাগত যোগ্যতা', [['sscExam','পরীক্ষা',U.EXAMS],['sscSchool','SSC প্রতিষ্ঠান'],['sscBoard','SSC বোর্ড',[]],['sscGroup','বিভাগ',[]],['sscYear','SSC পাসের সাল'],['sscGpa','SSC GPA'],['sscRoll','SSC রোল']]],
    ['একাডেমিক তথ্য', [['college','কলেজ'],['collegeRoll','কলেজ রোল'],['klass','শ্রেণি',['একাদশ','দ্বাদশ','সেকেন্ড টাইমার']],['group','বিভাগ',['বিজ্ঞান','মানবিক','ব্যবসায় শিক্ষা']],['subject1','বিষয়–১',[]],['subject2','বিষয়–২',[]],['subject3','বিষয়–৩',[]],['subject4','৪র্থ বিষয়',[]],['groupSubjects','অন্যান্য গ্রুপ বিষয়'],['fourthSubject','৪র্থ বিষয়ের অতিরিক্ত তথ্য']]],
    ['ভর্তির উৎস ও রেফারেন্স', [['source','আমাদের সম্পর্কে কোথা থেকে জেনেছো?',U.SOURCES],['refName','রেফারেন্সকারীর নাম'],['refPhone','রেফারেন্সকারীর মোবাইল','tel'],['refOccupation','রেফারেন্সকারীর পেশা',U.OCCUPATIONS]]]
  ];
  const esc = U.esc;
  // Madaripur institutions from the Dhaka Board XI and Madrasah Board Alim admission lists.
  const madaripurInstitutions = [
    "Abck Syed Abul Hossain College",
    "Asmot Ali Khan Public School And College",
    "Baheratola Adarsha Mahabidyalaya Shibchar",
    "Beer Muktijoddha Shajahan Khan College",
    "Charmugria College",
    "D.K. Ideal Sayed Atahar Ali Academy And College",
    "Dr. Md. Mozammel Haque Khan College",
    "Elias Ahmed Chowdhury College",
    "Govt. Barhamganj College",
    "Govt. Chilarchar Balikandi Sheikh Fazilatunnesa Mujib College",
    "Govt. Rajoir College",
    "Govt. Rajoir Gopalgonj K. J. S. Pilot Model Institution & College",
    "Govt. Shaikh Hasina Academy & Women College",
    "Kabirajpur Saifuddin College",
    "Kadambari Union Mahabidyalaya",
    "Kalkini Pilot Girls School And College",
    "Kalkini Syed Abul Hossain College",
    "Khasherhat Sayed Abul Hossain School & College",
    "Madaripur Govt. College",
    "Madaripur Govt. Sufia Mohila College",
    "Madra High School And College",
    "Nurul Amin College Shibchar",
    "Rizia Begum Mohila College",
    "Shahebrampur Kabi Nazrul Islam College",
    "Shahid Sardar Sajahan Girls School And College",
    "Shahid Smriti College Shashikar",
    "Sheikh Rasel Govt. College",
    "Shireen Jahan Memorial School & College",
    "Syed Abul Hossain College",
    "Takerhat Popular High School And College",
    "Al Bitul Mamur Alim Madrasah",
    "Anderchar Fazil Madrasah",
    "Bahadurpur Sariatia Kamil Madrasah",
    "Barail Bari Sultania Alim Madrasah",
    "Char Gobindopur Senior Alim Madrasah",
    "Char Nachna Fazil Madrasah",
    "Dakkhin Para Nesa. Alim Madrasah",
    "Dhoji Hamidia Fazil Madrasah",
    "Dicrir Char Fazil Madrasah",
    "Dorir Char Laxmipur Fazil Madrasah",
    "Hazrat Shah Madar Dargah Sharif Alim Madrasah",
    "Kalkini Fazil Madrasah",
    "Kashimpur Hossainia Alim Madrasah",
    "Kathalbari Senior Alim Madrasah",
    "Khamarbari Nesa. Fazil Madrasah",
    "Krokir Char Islamia Mohila Alim Madrasah",
    "Madaripur Ahammadia Kamil Madrasah",
    "Mirjar Char Alim Madrasah",
    "Mollarhat Darus Sunnat Fazil Madrasah",
    "Munshi Kadirpur Alim Madrasah",
    "Pashchim Math Islamia Alim Madrasah",
    "Shiruail Alim Madrasah",
    "Sikar Mongal Rashidia Alim Madrasah",
    "Snan Ghata Islamia Fazil Madrasah",
    "Swarmongal Tekerhat Rashidia Fazil Madrasah",
    "Uttar Romjanpur Fazil Madrasah",
  ];
  const field = ([key,label,type]) => {
    const value = values[key] ?? '', req = required.has(key) ? ' required' : '';
    if (type === 'checkbox') return `<label class="sp-check"><input type="checkbox" name="${key}"${value ? ' checked' : ''}>${label}</label>`;
    let input;
    if (key === 'college') {
      input = `<input name="college" list="sp-colleges" value="${esc(value)}" maxlength="300" placeholder="তালিকা থেকে বেছে নাও বা নাম লেখো"${req}><datalist id="sp-colleges">${madaripurInstitutions.map(name => `<option value="${esc(name)}"></option>`).join('')}</datalist><small>তালিকায় নাম না থাকলে নিজে লিখতে পারবে।</small>`;
    } else if (Array.isArray(type)) {
      const options = type.map(x=>{const [text,val]=x.split('|');return [val||text,text];});
      if (value && !options.some(([v])=>v===value)) options.push([value,value]);
      input = `<select name="${key}"${req}><option value="">বেছে নিন</option>${options.map(([v,t])=>`<option value="${esc(v)}"${v===value?' selected':''}>${esc(t)}</option>`).join('')}</select>`;
    } else if(type==='textarea') input=`<textarea name="${key}" rows="2" maxlength="300"${req}>${esc(value)}</textarea>`;
    else input=`<input name="${key}" type="${type||'text'}" value="${esc(value)}" maxlength="${/phone|whatsapp/i.test(key)?16:300}"${type==='date'?` max="${U.today()}"`:''}${req}>`;
    return `<label>${esc(label)}${required.has(key)?' <em>*</em>':' <small>ঐচ্ছিক</small>'}${input}${changes[key] ? `<small class="sp-pending">অনুমোদনের অপেক্ষায় · আগে: ${esc(String(changes[key].from || 'খালি'))}</small>` : ''}</label>`;
  };
  const dialog=document.createElement('dialog'); dialog.className='student-profile-dialog';
  dialog.innerHTML=`<form><header><div><small>রোল ${esc(profile.id)}</small><h2>ভর্তি ফর্ম সম্পূর্ণ করুন</h2></div><button type="button" class="sp-close" aria-label="ফর্ম বন্ধ করুন">×</button></header><p class="sp-help">আগের তথ্য দেওয়া আছে। <b>*</b> চিহ্নের ঘরগুলো পূরণ করুন; অন্য তথ্য প্রযোজ্য হলে দিন।</p>${groups.map(([title,fields],i)=>`<section><h3><span>${U.bn(i+1)}</span>${title}</h3><div class="sp-grid">${fields.map(field).join('')}</div></section>`).join('')}<p class="sp-error" role="alert"></p><footer><button type="button" class="btn line" data-cancel>পরে পূরণ করব</button><button type="submit" class="btn gold">তথ্য সংরক্ষণ করুন</button></footer></form>`;
  document.body.append(dialog);const form=dialog.querySelector('form'),error=dialog.querySelector('.sp-error'),save=form.querySelector('[type=submit]');let busy=false;
  dialog.querySelector('h2').textContent = profile.pendingProfile ? 'পাঠানো সংশোধন দেখুন' : profile.profileCompletedAt ? 'ভর্তির তথ্য সংশোধন' : 'ভর্তি ফর্ম সম্পূর্ণ করুন';
  dialog.querySelector('.sp-help').innerHTML = `খালি ঘরের নতুন তথ্য সরাসরি সংরক্ষণ হবে। আগে দেওয়া তথ্য বদলালে অ্যাডমিনের অনুমোদন লাগবে। <b>*</b> চিহ্নের ঘরগুলো পূরণ করুন।${profile.pendingProfile ? '<strong class="sp-pending-banner">আপনার সংশোধন অনুমোদনের অপেক্ষায় আছে। নিচে পাঠানো নতুন তথ্য দেখানো হচ্ছে।</strong>' : profile.profileReview?.status === 'rejected' ? '<strong class="sp-pending-banner">আগের সংশোধন অনুমোদিত হয়নি। সঠিক তথ্য দিয়ে আবার পাঠাতে পারেন।</strong>' : ''}`;
  save.textContent = 'সংরক্ষণ / সংশোধন পাঠান';
  const close=()=>{if(!busy)dialog.close();};dialog.querySelector('.sp-close').onclick=close;dialog.querySelector('[data-cancel]').onclick=close;dialog.oncancel=e=>{if(busy)e.preventDefault();};dialog.onclose=()=>dialog.remove();
  const same=form.elements.namedItem('sameAddress'),address=form.elements.namedItem('address'),permanent=form.elements.namedItem('permanentAddress');
  const syncAddress=()=>{permanent.readOnly=same.checked;if(same.checked)permanent.value=address.value;};same.onchange=syncAddress;address.oninput=syncAddress;syncAddress();
  const previousExam = form.elements.namedItem('sscExam'), previousGroup = form.elements.namedItem('sscGroup');
  const examGroups = {
    ssc: ['বিজ্ঞান', 'মানবিক', 'ব্যবসায় শিক্ষা', 'অন্যান্য'],
    'দাখিল': ['সাধারণ', 'বিজ্ঞান', 'মুজাবিদ', 'হিফজুল কুরআন'],
    'ssc (ভোকেশনাল)': ['ভোকেশনাল'],
    'o level': [],
    'অন্যান্য': ['অন্যান্য'],
  };
  const previousBoard = form.elements.namedItem('sscBoard');
  const examBoards = {
    ssc: ['ঢাকা', 'রাজশাহী', 'চট্টগ্রাম', 'যশোর', 'কুমিল্লা', 'সিলেট', 'বরিশাল', 'দিনাজপুর', 'ময়মনসিংহ'],
    'দাখিল': ['মাদ্রাসা'],
    'ssc (ভোকেশনাল)': ['কারিগরি'],
    'o level': ['Cambridge', 'Pearson Edexcel', 'অন্যান্য'],
    'অন্যান্য': ['অন্যান্য'],
  };
  function fillPreviousExamOptions(keepSaved) {
    const exam = previousExam.value.trim().toLowerCase();
    const key = exam === 'dakhil' ? 'দাখিল' : exam;
    const fill = (select, catalog, label) => {
      const options = Object.hasOwn(catalog, key) ? [...catalog[key]] : [];
      const current = select.value;
      if (keepSaved && current && !options.includes(current)) options.push(current);
      const placeholder = !exam ? 'আগে পরীক্ষা বেছে নিন' : options.length ? label : 'প্রযোজ্য নয়';
      select.replaceChildren(new Option(placeholder, ''));
      options.forEach(value => select.add(new Option(value, value)));
      select.value = options.includes(current) ? current : '';
    };
    fill(previousGroup, examGroups, 'বিভাগ বেছে নিন');
    fill(previousBoard, examBoards, 'বোর্ড বেছে নিন');
  }
  previousExam.addEventListener('change', () => fillPreviousExamOptions(false));
  fillPreviousExamOptions(true);
  const group = form.elements.namedItem('group');
  const subjects = ['subject1', 'subject2', 'subject3', 'subject4'].map(key => form.elements.namedItem(key));
  function fillSubjects(keepSaved) {
    const catalog = U.HSC_SUBJECTS[group.value];
    subjects.forEach((select, index) => {
      const current = keepSaved ? values[select.name] : select.value;
      const options = [...(catalog?.[index === 3 ? 'fourth' : 'main'] || [])];
      if (keepSaved && current && !options.includes(current)) options.push(current);
      select.replaceChildren(new Option(group.value ? 'বিষয় নির্বাচন করুন' : 'আগে বিভাগ বেছে নিন', ''));
      options.forEach(subject => select.add(new Option(subject, subject)));
      select.value = options.includes(current) ? current : '';
    });
  }
  group.addEventListener('change', () => fillSubjects(false));
  fillSubjects(true);
  form.onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;save.disabled=true;error.textContent='';try{const data=Object.fromEntries(new FormData(form));data.sameAddress=same.checked;data.profileBase=profile;for(const key of ['phone','phone2','whatsapp','fatherPhone','motherPhone','guardianPhone','refPhone','sscYear','sscGpa','sscRoll','collegeRoll'])data[key]=String(data[key]||'').replace(/[০-৯]/g,d=>'০১২৩৪৫৬৭৮৯'.indexOf(d));await U.api('/api/student/profile',{body:data});await onSaved();dialog.close();}catch(er){error.textContent=er.message;error.scrollIntoView({block:'nearest'});}finally{busy=false;save.disabled=false;}};
  dialog.showModal();
};
