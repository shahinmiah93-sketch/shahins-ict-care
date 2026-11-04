// Student directories use enrollment type; quiz participation never moves a student.
(() => {
  const phone = v => String(v || '').replace(/[০-৯]/g,d=>'০১২৩৪৫৬৭৮৯'.indexOf(d)).replace(/\D/g,'').replace(/^88/,'');
  const mode = course => course?.mode === 'online' ? 'online' : 'offline';
  function ids(db, type) {
    return new Set((db.students || []).filter(s => {
      const enrollments=(db.enrollments || []).filter(e=>e.studentId===s.id);
      if(!enrollments.length) return type==='offline';
      return enrollments.some(e=>mode((db.courses || []).find(c=>c.id===e.courseId))===type);
    }).map(s=>s.id));
  }
  function legacyOnline(db) {
    return (db.learners || []).filter(l=>(db.ocEnrolls || []).some(e=>e.learnerId===l.id));
  }
  function quizParticipants(db) {
    const admittedPhones=new Set((db.students || []).map(s=>phone(s.phone)).filter(Boolean));
    for(const l of legacyOnline(db))if(phone(l.phone))admittedPhones.add(phone(l.phone));
    const participantIds=new Set((db.quizzes || []).flatMap(q=>Object.entries(q.attempts || {}).filter(([,a])=>a?.length).map(([id])=>id)));
    for(const lead of db.leads || [])for(const source of lead.sources || [])if(source.type==='quiz'&&source.ref)participantIds.add(source.ref);
    return (db.quizGuests || []).filter(g=>participantIds.has(g.id)&&!admittedPhones.has(phone(g.phone))&&!(db.students || []).some(s=>s.id===g.studentId));
  }
  function header(db, selected) {
    const entries=[['offline','অফলাইন শিক্ষার্থীর তালিকা','ক্লাসরুমের মডিউল ও ব্যাচ',ids(db,'offline').size,'M4 20V4h16v16M8 8h8M8 12h8M9 20v-4h6v4'],['online','অনলাইন শিক্ষার্থীর তালিকা','অনলাইন কোর্সে ভর্তি শিক্ষার্থী',ids(db,'online').size+legacyOnline(db).length,'M3 4h18v13H3zM8 21h8M12 17v4M10 8l5 3-5 3z'],['quiz','অনলাইন কুইজের শিক্ষার্থী','ব্যাচ বেছে অংশগ্রহণকারী দেখুন',quizParticipants(db).length,'M9 3h6v3H9zM6 5H4v16h16V5h-2M8 11h8M8 15h5'],['talent','ট্যালেন্ট হান্টের শিক্ষার্থী','আয়োজন বেছে তালিকা দেখুন',(db.thRegs || []).length,'M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v3a4 4 0 0 0 4 4M16 5h4v3a4 4 0 0 1-4 4M12 13v5M7 21h10M9 18h6']];
    return `<nav class="student-directory-cards" aria-label="শিক্ষার্থীর তালিকার ধরন">${entries.map(([key,title,sub,count,icon])=>`<a href="#students/${key}" class="sd-card sd-${key}${key===selected?' selected':''}"${key===selected?' aria-current="page"':''}><span class="sd-card-top"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="${icon}"/></svg><b>${U.bn(count)} জন</b></span><strong>${title}</strong><small>${sub}</small><span class="sd-card-state">${key===selected?'<span aria-hidden="true">✓</span> নির্বাচিত':'<span aria-hidden="true">↗</span> খুলুন'}</span></a>`).join('')}</nav>`;
  }
  function audience(container,type,db) {
    const {esc,bn}=U, isQuiz=type==='quiz';
    const all=isQuiz?quizParticipants(db):(db.thRegs || []);
    const cohorts=[...new Set(all.map(g=>g.hsc || '__none'))].sort();
    const hunts=[...(db.talentHunts || [])].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    container.innerHTML=`<section class="card sd-audience"><div class="sd-audience-head"><div><h2>${isQuiz?'অনলাইন কুইজের শিক্ষার্থী':'ট্যালেন্ট হান্টের শিক্ষার্থী'}</h2><p>${isQuiz?'কুইজের জন্য নিবন্ধিত বাইরের শিক্ষার্থীরা। কোর্সে ভর্তি শিক্ষার্থীদের এখানে পুনরায় দেখানো হয় না।':'প্রথমে কোন ট্যালেন্ট হান্টের তালিকা দেখতে চান, সেটি বেছে নিন।'}</p></div><a class="btn line" href="#${isQuiz?'quiz':'talent'}">${isQuiz?'কুইজ পরিচালনা':'ট্যালেন্ট হান্ট পরিচালনা'} →</a></div><div class="toolbar"><label class="grow">${isQuiz?'এইচএসসি ব্যাচ':'ট্যালেন্ট হান্ট'}<select id="sdAudienceSelect"><option value="">${isQuiz?'ব্যাচ বেছে নিন':'আয়োজন বেছে নিন'}</option>${(isQuiz?cohorts.map(h=>[h,h==='__none'?'ব্যাচ উল্লেখ নেই':h]):hunts.map(h=>[h.id,h.title+(h.code?' · '+h.code:'')])).map(([v,t])=>`<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select></label><label class="grow">নাম, রোল বা মোবাইল<input id="sdAudienceSearch" placeholder="খুঁজুন"></label><button type="button" class="btn line" id="sdAudienceExport" disabled>↓ Excel</button></div><div id="sdAudienceResults"><p class="empty">${isQuiz?'ব্যাচ':'ট্যালেন্ট হান্ট'} বেছে নিলে শিক্ষার্থীর তালিকা দেখাবে।</p></div></section>`;
    let visible=[];
    const draw=()=>{
      const selected=document.querySelector('#sdAudienceSelect').value,q=document.querySelector('#sdAudienceSearch').value.trim().toLowerCase();
      document.querySelector('#sdAudienceExport').disabled=!selected;
      if(!selected){visible=[];document.querySelector('#sdAudienceResults').innerHTML=`<p class="empty">আগে ${isQuiz?'ব্যাচ':'ট্যালেন্ট হান্ট'} বেছে নিন।</p>`;return;}
      visible=all.filter(g=>(isQuiz?(g.hsc || '__none')===selected:g.huntId===selected)&&(!q||[g.id,g.roll,g.name,g.phone,g.college].join(' ').toLowerCase().includes(q)));
      document.querySelector('#sdAudienceResults').innerHTML=`<p class="muted">${bn(visible.length)} জন</p><div class="tbl-wrap"><table><thead><tr><th>${isQuiz?'আইডি':'রোল'}</th><th>নাম</th><th>মোবাইল</th><th>${isQuiz?'ব্যাচ / গ্রুপ':'শ্রেণি'}</th><th>কলেজ</th><th>${isQuiz?'কুইজে অংশগ্রহণ':'রেজিস্ট্রেশন'}</th></tr></thead><tbody>${visible.map(g=>{
        const played=isQuiz?(db.quizzes || []).filter(q=>(q.attempts?.[g.id] || []).length):[];
        return `<tr><td><b>${esc(isQuiz?g.id:g.roll)}</b></td><td><b>${esc(g.name)}</b></td><td>${esc(g.phone || '—')}</td><td>${esc(isQuiz?[g.hsc,g.group].filter(Boolean).join(' · '):g.klass || '—')}</td><td>${esc(g.college || '—')}</td><td>${isQuiz?played.map(q=>`<small>${esc(q.title)}</small>`).join(''):U.date((g.createdAt || '').slice(0,10))}</td></tr>`;
      }).join('') || '<tr><td colspan="6" class="empty">কোনো শিক্ষার্থী পাওয়া যায়নি</td></tr>'}</tbody></table></div>`;
    };
    document.querySelector('#sdAudienceSelect').onchange=draw;document.querySelector('#sdAudienceSearch').oninput=draw;
    document.querySelector('#sdAudienceExport').onclick=()=>U.xlsx(`students-${type}-${U.today()}.xlsx`,[isQuiz?'আইডি':'রোল','নাম','মোবাইল',isQuiz?'এইচএসসি ব্যাচ':'শ্রেণি','কলেজ'],visible.map(g=>[isQuiz?g.id:g.roll,g.name,g.phone,isQuiz?g.hsc:g.klass,g.college]));
  }
  function legacyTable(container,db,filters) {
    const {esc,bn}=U,rows=legacyOnline(db).filter(l=>(!filters.q||[l.name,l.phone,l.klass,l.college].join(' ').toLowerCase().includes(filters.q))&&(!filters.session||l.klass===filters.session));
    const scoped=rows.map(l=>({l,enrollments:(db.ocEnrolls || []).filter(e=>e.learnerId===l.id&&(!filters.module||filters.module==='legacy:'+e.courseId)&&(!filters.status||e.status===filters.status))})).filter(x=>x.enrollments.length);
    if(!legacyOnline(db).length){container.innerHTML='';return;}
    container.innerHTML=`<section class="card" style="margin-top:18px"><h3>অনলাইন কোর্সের শিক্ষার্থী <small>(${bn(scoped.length)} জন)</small></h3><div class="tbl-wrap"><table><thead><tr><th>আইডি</th><th>নাম</th><th>মোবাইল</th><th>অনলাইন কোর্স</th><th>অবস্থা</th></tr></thead><tbody>${scoped.map(({l,enrollments})=>`<tr><td>${esc(l.id)}</td><td><b>${esc(l.name)}</b><small>${esc(l.college || '')}</small></td><td>${esc(l.phone)}</td><td>${enrollments.map(e=>`<small>${esc((db.onlineCourses || []).find(c=>c.id===e.courseId)?.title || 'অনলাইন কোর্স')}</small>`).join('')}</td><td>${enrollments.some(e=>e.status==='active')?'চালু':'অপেক্ষায়'}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">কোনো শিক্ষার্থী পাওয়া যায়নি</td></tr>'}</tbody></table></div></section>`;
    container.insertAdjacentHTML('beforeend','<p><button type="button" class="btn line" id="sdLegacyExport">↓ এই অনলাইন কোর্সের তালিকা Excel</button></p>');
    document.querySelector('#sdLegacyExport').onclick=()=>U.xlsx(`online-course-students-${U.today()}.xlsx`,['আইডি','নাম','মোবাইল','কলেজ','অনলাইন কোর্স','অবস্থা'],scoped.map(({l,enrollments})=>[l.id,l.name,l.phone,l.college,enrollments.map(e=>(db.onlineCourses || []).find(c=>c.id===e.courseId)?.title || 'অনলাইন কোর্স').join(', '),enrollments.some(e=>e.status==='active')?'চালু':'অপেক্ষায়']));
    return scoped.length;
  }
  window.SICStudentDirectory={mode,ids,legacyOnline,quizParticipants,header,audience,legacyTable};
})();
