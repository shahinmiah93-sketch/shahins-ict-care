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
  const field = ([key,label,type]) => {
    const value = values[key] ?? '', req = required.has(key) ? ' required' : '';
    if (type === 'checkbox') return `<label class="sp-check"><input type="checkbox" name="${key}"${value ? ' checked' : ''}>${label}</label>`;
    let input;
    if (key === 'college') {
      input = `<input name="college" list="sp-colleges" value="${esc(value)}" maxlength="300" placeholder="তালিকা থেকে বেছে নাও বা নাম লেখো"${req}><datalist id="sp-colleges">${(U.MADARIPUR_INSTITUTIONS || []).map(name => `<option value="${esc(name)}"></option>`).join('')}</datalist><small>তালিকায় নাম না থাকলে নিজে লিখতে পারবে।</small>`;
    } else if (Array.isArray(type)) {
      const options = type.map(x=>{const [text,val]=x.split('|');return [val||text,text];});
      if (value && !options.some(([v])=>v===value)) options.push([value,value]);
      input = `<select name="${key}"${req}><option value="">বেছে নিন</option>${options.map(([v,t])=>`<option value="${esc(v)}"${v===value?' selected':''}>${esc(t)}</option>`).join('')}</select>`;
    } else if (key === 'dob') {
      input = `<input name="dob" type="hidden" value="${esc(value)}"><button type="button" class="sp-date-toggle" aria-label="জন্মতারিখের ক্যালেন্ডার খুলুন" aria-expanded="false"></button>`;
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
  const dob = form.elements.namedItem('dob'), dateToggle = form.querySelector('.sp-date-toggle');
  function updateDateLabel() {
    const [year, month, day] = dob.value.split('-');
    dateToggle.textContent = day ? `${day} / ${month} / ${year}` : 'জন্মতারিখ বেছে নিন';
    dateToggle.setAttribute('aria-label', `জন্ম তারিখ · ${dateToggle.textContent}`);
  }
  updateDateLabel();
  const calendar = document.createElement('div');
  calendar.className = 'sp-calendar';
  calendar.hidden = true;
  dateToggle.closest('label').after(calendar);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const today = U.today(), [currentYear, currentMonth] = today.split('-').map(Number);
  const firstYear = Math.min(1900, Number(dob.value.slice(0, 4)) || 1900);
  let year, month;
  function hideCalendar() {
    calendar.hidden = true;
    dateToggle.setAttribute('aria-expanded', 'false');
  }
  function drawCalendar(focus) {
    const lastMonth = year === currentYear ? currentMonth : 12;
    const firstDay = new Date(year, month - 1, 1).getDay();
    const days = new Date(year, month, 0).getDate();
    const prefix = `${year}-${String(month).padStart(2, '0')}-`;
    calendar.innerHTML = `<div class="sp-calendar-nav">
      <button type="button" data-move="-1" aria-label="আগের মাস"${year === firstYear && month === 1 ? ' disabled' : ''}>‹</button>
      <select aria-label="মাস" data-month>${months.map((name, i) => `<option value="${i + 1}"${month === i + 1 ? ' selected' : ''}${i >= lastMonth ? ' disabled' : ''}>${name} (${i + 1})</option>`).join('')}</select>
      <select aria-label="বছর" data-year>${Array.from({length: currentYear - firstYear + 1}, (_, i) => currentYear - i).map(y => `<option${year === y ? ' selected' : ''}>${y}</option>`).join('')}</select>
      <button type="button" data-move="1" aria-label="পরের মাস"${year === currentYear && month === currentMonth ? ' disabled' : ''}>›</button></div>
      <div class="sp-calendar-days">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => `<small>${day}</small>`).join('')}
      ${'<span></span>'.repeat(firstDay)}${Array.from({length: days}, (_, i) => {
        const date = prefix + String(i + 1).padStart(2, '0');
        return `<button type="button" data-date="${date}" aria-pressed="${date === dob.value}"${date > today ? ' disabled' : ''}>${i + 1}</button>`;
      }).join('')}</div>
      <button type="button" data-clear>মুছুন</button>`;
    if (focus) (calendar.querySelector(focus + ':not(:disabled)') || calendar.querySelector('[data-month]')).focus();
  }
  dateToggle.onclick = () => {
    if (!calendar.hidden) return hideCalendar();
    [year, month] = (dob.value && dob.value <= today ? dob.value : today).split('-').map(Number);
    calendar.hidden = false;
    dateToggle.setAttribute('aria-expanded', 'true');
    drawCalendar('[data-month]');
  };
  calendar.onchange = (event) => {
    if (event.target.matches('[data-year]')) {
      year = Number(event.target.value);
      if (year === currentYear) month = Math.min(month, currentMonth);
      drawCalendar('[data-year]');
    } else {
      month = Number(event.target.value);
      drawCalendar('[data-month]');
    }
  };
  calendar.onclick = (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.move) {
      const next = new Date(year, month - 1 + Number(button.dataset.move), 1);
      year = next.getFullYear();
      month = next.getMonth() + 1;
      drawCalendar(`[data-move="${button.dataset.move}"]`);
    } else {
      dob.value = button.dataset.date || '';
      updateDateLabel();
      hideCalendar();
      dateToggle.focus();
    }
  };
  calendar.onkeydown = (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    hideCalendar();
    dateToggle.focus();
  };
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
  form.onsubmit=async e=>{e.preventDefault();if(busy)return;if(!dob.value || dob.value > today){error.textContent='সঠিক জন্মতারিখ বেছে নিন।';dateToggle.focus();return;}busy=true;save.disabled=true;error.textContent='';try{const data=Object.fromEntries(new FormData(form));data.sameAddress=same.checked;data.profileBase=profile;for(const key of ['phone','phone2','whatsapp','fatherPhone','motherPhone','guardianPhone','refPhone','sscYear','sscGpa','sscRoll','collegeRoll'])data[key]=String(data[key]||'').replace(/[০-৯]/g,d=>'০১২৩৪৫৬৭৮৯'.indexOf(d));await U.api('/api/student/profile',{body:data});await onSaved();dialog.close();}catch(er){error.textContent=er.message;error.scrollIntoView({block:'nearest'});}finally{busy=false;save.disabled=false;}};
  dialog.showModal();
};
