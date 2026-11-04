// Existing students complete their admission details without creating a second admission.
window.SICStudentProfile = function ({ profile, onSaved }) {
  const required = new Set(['name','nameEn','dob','gender','phone','guardianName','guardianPhone','address','permanentAddress','college','klass','group']);
  const groups = [
    ['শিক্ষার্থীর তথ্য', [['name','নাম (বাংলা)'],['nameEn','নাম (ইংরেজি)'],['dob','জন্ম তারিখ','date'],['gender','লিঙ্গ',['ছেলে|M','মেয়ে|F','অন্যান্য|O']],['bloodGroup','রক্তের গ্রুপ',U.BLOOD_GROUPS],['religion','ধর্ম',U.RELIGIONS],['nationality','জাতীয়তা'],['phone','শিক্ষার্থীর মোবাইল','tel'],['phone2','অতিরিক্ত মোবাইল','tel'],['whatsapp','হোয়াটসঅ্যাপ','tel'],['email','ইমেইল','email']]],
    ['অভিভাবক ও ঠিকানা', [['fatherName','বাবার নাম'],['fatherOccupation','বাবার পেশা'],['fatherPhone','বাবার মোবাইল','tel'],['motherName','মায়ের নাম'],['motherOccupation','মায়ের পেশা'],['motherPhone','মায়ের মোবাইল','tel'],['guardianName','অভিভাবকের নাম'],['guardianRelation','অভিভাবকের সাথে সম্পর্ক'],['guardianOccupation','অভিভাবকের পেশা'],['guardianPhone','অভিভাবকের মোবাইল','tel'],['address','বর্তমান ঠিকানা','textarea'],['sameAddress','বর্তমান ঠিকানাই স্থায়ী ঠিকানা','checkbox'],['permanentAddress','স্থায়ী ঠিকানা','textarea']]],
    ['শিক্ষাগত যোগ্যতা', [['sscExam','পরীক্ষা'],['sscSchool','SSC প্রতিষ্ঠান'],['sscBoard','SSC বোর্ড'],['sscGroup','SSC বিভাগ'],['sscYear','SSC পাসের সাল'],['sscGpa','SSC GPA'],['sscRoll','SSC রোল']]],
    ['একাডেমিক তথ্য', [['college','কলেজ'],['collegeRoll','কলেজ রোল'],['klass','শ্রেণি',['একাদশ','দ্বাদশ','সেকেন্ড টাইমার']],['group','বিভাগ',['বিজ্ঞান','মানবিক','ব্যবসায় শিক্ষা']],['subject1','বিষয়–১'],['subject2','বিষয়–২'],['subject3','বিষয়–৩'],['subject4','৪র্থ বিষয়'],['groupSubjects','অন্যান্য গ্রুপ বিষয়'],['fourthSubject','৪র্থ বিষয়ের অতিরিক্ত তথ্য']]],
    ['ভর্তির উৎস ও রেফারেন্স', [['source','আমাদের সম্পর্কে কোথা থেকে জেনেছো?'],['refName','রেফারেন্সকারীর নাম'],['refPhone','রেফারেন্সকারীর মোবাইল','tel'],['refOccupation','রেফারেন্সকারীর পেশা']]]
  ];
  const esc = U.esc;
  const field = ([key,label,type]) => {
    const value = profile[key] ?? '', req = required.has(key) ? ' required' : '';
    if (type === 'checkbox') return `<label class="sp-check"><input type="checkbox" name="${key}"${value ? ' checked' : ''}>${label}</label>`;
    let input;
    if (Array.isArray(type)) {
      const options = type.map(x=>{const [text,val]=x.split('|');return [val||text,text];});
      if (value && !options.some(([v])=>v===value)) options.push([value,value]);
      input = `<select name="${key}"${req}><option value="">বেছে নিন</option>${options.map(([v,t])=>`<option value="${esc(v)}"${v===value?' selected':''}>${esc(t)}</option>`).join('')}</select>`;
    } else if(type==='textarea') input=`<textarea name="${key}" rows="2" maxlength="300"${req}>${esc(value)}</textarea>`;
    else input=`<input name="${key}" type="${type||'text'}" value="${esc(value)}" maxlength="${/phone|whatsapp/i.test(key)?16:300}"${type==='date'?` max="${U.today()}"`:''}${req}>`;
    return `<label>${esc(label)}${required.has(key)?' <em>*</em>':' <small>ঐচ্ছিক</small>'}${input}</label>`;
  };
  const dialog=document.createElement('dialog'); dialog.className='student-profile-dialog';
  dialog.innerHTML=`<form><header><div><small>রোল ${esc(profile.id)}</small><h2>ভর্তি ফর্ম সম্পূর্ণ করুন</h2></div><button type="button" class="sp-close" aria-label="ফর্ম বন্ধ করুন">×</button></header><p class="sp-help">আগের তথ্য দেওয়া আছে। <b>*</b> চিহ্নের ঘরগুলো পূরণ করুন; অন্য তথ্য প্রযোজ্য হলে দিন।</p>${groups.map(([title,fields],i)=>`<section><h3><span>${U.bn(i+1)}</span>${title}</h3><div class="sp-grid">${fields.map(field).join('')}</div></section>`).join('')}<p class="sp-error" role="alert"></p><footer><button type="button" class="btn line" data-cancel>পরে পূরণ করব</button><button type="submit" class="btn gold">তথ্য সংরক্ষণ করুন</button></footer></form>`;
  document.body.append(dialog);const form=dialog.querySelector('form'),error=dialog.querySelector('.sp-error'),save=form.querySelector('[type=submit]');let busy=false;
  const close=()=>{if(!busy)dialog.close();};dialog.querySelector('.sp-close').onclick=close;dialog.querySelector('[data-cancel]').onclick=close;dialog.oncancel=e=>{if(busy)e.preventDefault();};dialog.onclose=()=>dialog.remove();
  const same=form.elements.namedItem('sameAddress'),address=form.elements.namedItem('address'),permanent=form.elements.namedItem('permanentAddress');
  const syncAddress=()=>{permanent.readOnly=same.checked;if(same.checked)permanent.value=address.value;};same.onchange=syncAddress;address.oninput=syncAddress;syncAddress();
  form.onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;save.disabled=true;error.textContent='';try{const data=Object.fromEntries(new FormData(form));data.sameAddress=same.checked;for(const key of ['phone','phone2','whatsapp','fatherPhone','motherPhone','guardianPhone','refPhone','sscYear','sscGpa','sscRoll','collegeRoll'])data[key]=String(data[key]||'').replace(/[০-৯]/g,d=>'০১২৩৪৫৬৭৮৯'.indexOf(d));await U.api('/api/student/profile',{body:data});await onSaved();dialog.close();}catch(er){error.textContent=er.message;error.scrollIntoView({block:'nearest'});}finally{busy=false;save.disabled=false;}};
  dialog.showModal();
};
