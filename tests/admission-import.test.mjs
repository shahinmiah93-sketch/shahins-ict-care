import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const source = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const section = (start,end) => source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
function app() {
  let id=0, writes=0, backups=0, failSave=false;
  const ctx={
    db:{meta:{},sessions:[{name:'HSC-27',active:true}],batches:[{id:'b1',name:'27-A',session:'HSC-27',days:'শনি, সোম, বুধ',time:'সকাল ৭:০০',active:true}],courses:[{id:'c1',code:'01',name:'Regular',feeType:'monthly',fee:1000,active:true,chapters:[]},{id:'c2',code:'02',name:'Once',feeType:'once',fee:2000,active:true}],students:[],enrollments:[],payments:[],closures:[]},
    Date, crypto, today:()=> '2026-11-04', num:v=>Number(v)||0,str:(v,max=500)=>String(v??'').trim().slice(0,max),phoneOf:v=>String(v||'').replace(/^88/,''),enDigits:v=>String(v??'').replace(/[০-৯]/g,d=>'০১২৩৪৫৬৭৮৯'.indexOf(d)),pad2:v=>String(v).padStart(2,'0'),
    moduleFee:(c)=>c.fee,uid:prefix=>prefix+(++id),nextStudentId:()=>String(270001+ctx.db.students.length),nextSerial:()=>ctx.db.students.length+1,newPin:()=> '1234',nextReceiptNo:()=>1001+ctx.db.payments.length,rememberLists:()=>{},batchLabel:b=>b.name,
    readBody:async req=>req.body,send:(res,status,data)=>({status,data}),saveDb:()=>{if(failSave)throw new Error('fixture save failed');writes++},writeJsonAtomic:()=>{},DB_FILE:'fixture',BACKUPS:'backups',path:{join:(...s)=>s.join('/')},fs:{copyFileSync:()=>backups++}
  };
  vm.createContext(ctx);
  const studentsClean = section('  students: (b) => (','  enrollments: (b) => (');
  vm.runInContext(section('const STUDENT_KEYS =','const CLEAN =')+'\nconst CLEAN={'+studentsClean+'};\n'+section('function moduleFee(','// ব্যাচ বদলালেও আগের হাজিরা')+section('function validateEnrollment(','// ---------- মেয়াদ')+section('function createEnrollment(','// ---------- রাউটার ----------'),ctx);
  return {ctx,stats:()=>({writes,backups}),fail:()=>{failSave=true},call:body=>ctx.admissionImportAction({body},{})};
}
const defaults={session:'HSC-27',batchId:'b1',courseId:'c1',admissionDate:'2026-11-04',discount:'0',chapters:''};
test('Monthly fees are zero for the entire effective pause month and resume the next active month', () => {
  const {ctx} = app();
  ctx.today = () => '2026-12-10';
  const student = {id:'student', batchId:'b1', pauses:[{from:'2026-11-09', to:'2026-12-01'}]};
  const enrollment = {studentId:student.id, courseId:'c1', fee:1000, startDate:'2026-11-01'};
  const fee = ctx.enrollmentDue(enrollment, {student});
  assert.equal(fee.breakdown[0].fee, 0);
  assert.equal(fee.breakdown[1].fee, 1000);
});
test('Sparse rows accept missing phones and personal fields; admission date drives fee preview and saved ledger', async()=>{
  const a=app(),input={defaults,rows:[{row:2,name:'Sparse',admissionDate:'2026-08-15'},{row:3,nameEn:'English Only'}]};
  const before=JSON.stringify(a.ctx.db),p=await a.call(input);
  assert.equal(p.status,200);assert.equal(p.data.errors.length,0);assert.equal(JSON.stringify(a.ctx.db),before);
  assert.equal(p.data.rows[0].enrollment.startDate,'2026-08-15');assert.equal(p.data.rows[0].student.phone,'');assert.equal(p.data.rows[0].student.gender,'');
  assert(p.data.rows[0].fees.firstMonth<1000);assert.equal(p.data.rows[0].fees.months,4);assert.equal(p.data.rows[1].student.admissionDate,'2026-11-04');
  assert.equal(p.data.rows[1].fees.firstMonth,1000);
  const result=await a.call({...input,commit:true,previewToken:p.data.token});assert.equal(result.status,200);assert.equal(result.data.create,2);
  assert.deepEqual(a.stats(),{writes:1,backups:1});assert.equal(a.ctx.db.payments.length,0);
  assert.equal(a.ctx.feeSummary(a.ctx.db.students[0]).totalDue,p.data.rows[0].fees.totalDue);
  const repeat=await a.call({...input,commit:true,previewToken:p.data.token});assert.equal(repeat.data.alreadyImported,true);assert.equal(a.ctx.db.students.length,2);
});
test('Initial payment uses joining date; existing students are skipped and no other record overwritten',async()=>{
  const a=app(),input={defaults,rows:[{name:'Person',phone:'1700000001',guardianPhone:'',admissionDate:'2026-09-06',paid:'500',college:'College',fatherName:'Parent'}]};
  const p=await a.call(input);assert.equal(p.data.errors.length,0);assert.equal(p.data.rows[0].student.phone,'01700000001');assert.equal(p.data.rows[0].fees.firstMonth,1000);
  await a.call({...input,commit:true,previewToken:p.data.token});assert.equal(a.ctx.db.payments[0].date,'2026-09-06');assert.equal(a.ctx.db.students[0].college,'College');
  const next=await a.call({...input,rows:[{...input.rows[0],college:'Do not overwrite'}]});assert.equal(next.data.summary.skip,1);assert.equal(a.ctx.db.students[0].college,'College');
});
test('Invalid rows block entire commit; a stale fee preview and duplicate file rows cannot be committed',async()=>{
  const a=app(),input={defaults,rows:[{name:'Valid'},{name:'Invalid',admissionDate:'2026-02-30'}]};
  const p=await a.call(input);assert.equal(p.data.errors.length,1);assert.equal((await a.call({...input,commit:true,previewToken:p.data.token})).status,400);assert.equal(a.ctx.db.students.length,0);
  const good={defaults,rows:[{name:'Valid'}]},g=await a.call(good);a.ctx.db.courses[0].fee=1200;
  assert.equal((await a.call({...good,commit:true,previewToken:g.data.token})).status,409);
  assert.equal((await a.call({defaults,rows:[{name:'Same'},{name:'Same'}]})).data.errors.length,1);
  assert.equal((await a.call({defaults,rows:[{name:'Phone',phone:'bad'}]})).data.errors.length,1);
  assert.equal((await a.call({defaults,rows:[{name:'No optional values',phone:'',guardianPhone:'',dob:'',gender:'',paid:''}]})).data.errors.length,0);
});
test('Save failure restores all imported students, enrollments and payments',async()=>{
  const a=app(),input={defaults,rows:[{name:'Rollback',paid:100}]};const p=await a.call(input),before=JSON.stringify(a.ctx.db);a.fail();
  await assert.rejects(a.call({...input,commit:true,previewToken:p.data.token}),/fixture save failed/);assert.equal(JSON.stringify(a.ctx.db),before);
});
test('Module names and numeric codes, one-time fees, chapters, discounts and provided payment dates are retained',async()=>{
  const a=app();
  let p=await a.call({defaults,rows:[{name:'Code',course:'1'}]});assert.equal(p.data.errors.length,0);assert.equal(p.data.rows[0].courseId,'c1');
  p=await a.call({defaults,rows:[{name:'Once',course:'Once',discount:'200',paid:'1000',paymentDate:'2026-10-01'}]});
  assert.equal(p.data.errors.length,0);assert.equal(p.data.rows[0].fees.totalDue,1800);assert.equal(p.data.rows[0].paymentDate,'2026-10-01');
  a.ctx.db.courses.push({id:'ch',name:'Chapters',feeType:'chapter',fee:0,active:true,chapters:[{id:'1',fee:800},{id:'2',fee:900}]});
  p=await a.call({defaults,rows:[{name:'Chapters',course:'Chapters',chapters:'1, 2',discount:'100'}]});
  assert.equal(p.data.errors.length,0);assert.equal(p.data.rows[0].fees.totalDue,1600);
  assert.equal((await a.call({defaults,rows:[{name:'No chapter',course:'Chapters'}]})).data.errors.length,1);
});
test('October 12 joining date produces October 700 plus November 1000; reviewed correction preserves payments',async()=>{
  const a=app(),student={id:'280001',name:'Date fixture',session:'HSC-27',batchId:'b1',admissionDate:'2026-10-12'};
  a.ctx.db.students.push(student);
  const course=a.ctx.db.courses[0],e=a.ctx.createEnrollment(student.id,{course,chapters:[],fee:1000,discount:0},'2026-11-04','');
  assert.equal(a.ctx.feeSummary(student).totalDue,1000);
  a.ctx.db.payments.push({id:'existing-payment',studentId:student.id,enrollmentId:e.id,amount:300,date:'2026-11-04'});
  const input={id:e.id,startDate:'2026-10-12'},p=await a.ctx.enrollmentStartAction({body:input},{});
  assert.equal(p.status,200);assert.equal(p.data.proposed.firstMonth,700);assert.equal(p.data.proposed.due,1700);assert.equal(p.data.proposed.balance,1400);assert.equal(e.startDate,'2026-11-04');
  assert.equal((await a.ctx.enrollmentStartAction({body:{...input,commit:true,token:'stale'}},{})).status,409);
  const saved=await a.ctx.enrollmentStartAction({body:{...input,commit:true,token:p.data.token}},{});
  assert.equal(saved.status,200);assert.equal(saved.data.fees.totalDue,1700);assert.equal(e.startDate,'2026-10-12');assert.equal(e.admissionLinked,true);assert.equal(e.startDateHistory[0].from,'2026-11-04');
  assert.equal(a.ctx.db.payments.length,1);assert.equal(a.ctx.db.payments[0].amount,300);assert.equal(a.stats().backups,1);
  assert.equal((await a.ctx.enrollmentStartAction({body:{id:e.id,startDate:'2026-10-11'}},{})).status,400);
  assert.equal((await a.ctx.enrollmentStartAction({body:{id:e.id,startDate:'2026-11-05'}},{})).status,400);
});
test('Confirmed record repair is backed up, idempotent and leaves other enrollments and payments intact',()=>{
  const a=app(),s={id:'280001',admissionDate:'2026-10-12',batchId:'b1'};a.ctx.db.students.push(s);
  const e=a.ctx.createEnrollment(s.id,{course:a.ctx.db.courses[0],chapters:[],fee:1000,discount:0},'2026-11-04','');
  const later=a.ctx.createEnrollment(s.id,{course:a.ctx.db.courses[0],chapters:[],fee:1000,discount:0},'2026-11-04','');
  a.ctx.db.payments.push({studentId:s.id,enrollmentId:e.id,amount:300});
  assert.equal(a.ctx.repairConfirmedAdmissionStart(),true);assert.equal(e.startDate,'2026-10-12');assert.equal(later.startDate,'2026-11-04');
  assert.equal(a.ctx.enrollmentDue(e).due,1700);assert.equal(a.ctx.db.payments[0].amount,300);assert.equal(a.stats().backups,1);
  assert.equal(a.ctx.repairConfirmedAdmissionStart(),false);assert.equal(a.stats().backups,1);
  const b=app();b.ctx.db.students.push(s);const untouched=b.ctx.createEnrollment(s.id,{course:b.ctx.db.courses[0],chapters:[],fee:1000,discount:0},'2026-10-20','');
  assert.equal(b.ctx.repairConfirmedAdmissionStart(),false);assert.equal(untouched.startDate,'2026-10-20');
});
test('Monthly fee ranges apply to historical months, partial admission, discounts and December fallback',()=>{
  const a=app(),s={id:'schedule',batchId:'b1',admissionDate:'2026-09-30'};a.ctx.db.students.push(s);
  const c=a.ctx.db.courses[0];c.monthlyFees=a.ctx.cleanMonthlyFees([{from:'2026-08',to:'2026-11',fee:800}]);
  const e=a.ctx.createEnrollment(s.id,{course:c,chapters:[],fee:1000,discount:0},s.admissionDate,'');
  let due=a.ctx.enrollmentDue(e);assert.equal(due.firstNet,50);assert.equal(due.due,1650);
  assert.equal(due.breakdown.length,3);assert.equal(due.breakdown.reduce((sum,row)=>sum+row.fee,0),due.due);assert.equal(due.breakdown[0].fromDay,30);assert.equal(due.breakdown[0].monthlyRate,800);assert.equal(due.breakdown[1].late,false);
  a.ctx.today=()=> '2026-12-04';assert.equal(a.ctx.enrollmentDue(e).due,2650);
  assert.equal(a.ctx.monthlyFeeFor(c,e,'2026-07'),1000);assert.equal(a.ctx.monthlyFeeFor(c,e,'2026-08'),800);assert.equal(a.ctx.monthlyFeeFor(c,e,'2026-12'),1000);
  c.monthlyFees=a.ctx.cleanMonthlyFees([{from:'2026-08',to:'2026-11',fee:800},{from:'2026-12',to:'',fee:1000}]);
  assert.equal(c.monthlyFees[1].to,'');assert.equal(a.ctx.monthlyFeeFor(c,e,'2027-12'),1000);
  e.fee=1200;assert.equal(a.ctx.monthlyFeeFor(c,e,'2028-01'),1000);e.fee=1000;
  assert.throws(()=>a.ctx.cleanMonthlyFees([{from:'2026-12',to:'',fee:1000},{from:'2027-01',to:'2027-03',fee:900}]),/একই মাস/);
  e.discount=100;assert.equal(a.ctx.monthlyFeeFor(c,e,'2026-10'),700);assert.equal(a.ctx.monthlyFeeFor(c,e,'2026-12'),900);
  c.monthlyFees=[{from:'2026-08',to:'2026-11',fee:0}];assert.equal(a.ctx.monthlyFeeFor(c,e,'2026-11'),0);
  assert.throws(()=>a.ctx.cleanMonthlyFees([{from:'2026-08',to:'2026-11',fee:800},{from:'2026-11',to:'2026-12',fee:900}]),/একই মাস/);
  for(const r of [{from:'2026-13',to:'2026-14',fee:800},{from:'2026-11',to:'2026-08',fee:800},{from:'2026-08',to:'2026-11',fee:-1}]) assert.throws(()=>a.ctx.cleanMonthlyFees([r]));
});
test('Initial admission ignores a stale course-start field; a later module retains its own date',async()=>{
  const a=app();a.ctx.db.leads=[];a.ctx.db.applications=[];a.ctx.smsStudentLogin=async()=>({ok:false});
  const block=section('  if (p === "/api/admin/admit" && m === "POST") {','  // আগের শিক্ষার্থীকে আরেকটি মডিউলে ভর্তি');
  vm.runInContext('async function initialAdmission(req,res){const p="/api/admin/admit",m="POST";'+block+'}',a.ctx);
  const result=await a.ctx.initialAdmission({body:{student:{name:'Past joining date',batchId:'b1',admissionDate:'2026-10-12'},enrollment:{courseId:'c1',startDate:'2026-11-04'}}},{});
  assert.equal(result.status,200);assert.equal(result.data.enrollment.startDate,'2026-10-12');assert.equal(result.data.enrollment.admissionLinked,true);assert.equal(a.ctx.feeSummary(result.data.student).totalDue,1700);
  const later=a.ctx.createEnrollment(result.data.student.id,{course:a.ctx.db.courses[1],chapters:[],fee:2000,discount:0},'2026-11-03','');
  assert.equal(later.startDate,'2026-11-03');assert.equal(later.admissionLinked,undefined);
});
const browser={window:{},console};vm.createContext(browser);
vm.runInContext(fs.readFileSync(new URL('../public/vendor/xlsx-0.20.3.full.min.js',import.meta.url),'utf8'),browser);
vm.runInContext(fs.readFileSync(new URL('../public/js/admission-sheet.js',import.meta.url),'utf8'),browser);
const XLSX=browser.XLSX,parser=browser.window.SICAdmissionSheet;
function wb(data) { const w=XLSX.utils.book_new();XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet(data),'Students');return w; }
test('Real XLSX decoding preserves optional blanks, phones, dates, Unicode and detects formula/error rows',()=>{
  const w=wb([['Name','Number','Guardian Number','Joining Date','Gender','Subject 1','Subject 2'],['নাম',1700000001,'',46300,'','Physics','Chemistry'],['Sparse']]);
  const bytes=XLSX.write(w,{type:'buffer',bookType:'xlsx'});const reread=XLSX.read(bytes,{type:'buffer',cellDates:false,sheetRows:502});const p=parser.parseWorkbook(reread,'Students',XLSX);
  assert.equal(p.errors.length,0);assert.equal(p.rows.length,2);assert.equal(p.rows[1].phone,'');assert.equal(p.rows[0].subject1,'Physics');assert.match(p.rows[0].admissionDate,/^2026-/);
  w.Sheets.Students.B2={t:'n',v:100,f:'1+99'};assert.equal(parser.parseWorkbook(w,'Students',XLSX).errors.length,1);
  assert.throws(()=>parser.dateValue('31/02/2026',XLSX,false),/তারিখ/);
  assert.equal(parser.dateValue('',XLSX,false),'');
  const bengali=parser.parseWorkbook(wb([['নাম (বাংলা)','বিষয়-০১','বিষয়-০২'],['নাম','Physics','Chemistry']]),'Students',XLSX);assert.equal(bengali.rows[0].subject1,'Physics');assert.equal(bengali.rows[0].subject2,'Chemistry');
});
test('Downloadable demo has every admission column, phone text formats and no demo students to import accidentally',()=>{
  const data=fs.readFileSync(new URL('../public/templates/Admission-Import-Demo.xlsx',import.meta.url));const w=XLSX.read(data,{type:'buffer'});
  assert(w.SheetNames.includes('Students'));assert(w.SheetNames.includes('Guide'));
  assert.equal(w.Sheets.Students.A1.v,'Name');assert.equal(w.Sheets.Students.B1.v,'English Name');
  assert.equal(parser.FIELDS.length,54);
  assert.throws(()=>parser.parseWorkbook(w,'Students',XLSX),/শিরোনামের নিচে/);
});

 test('Import assigns new IDs in joining-date order even when spreadsheet rows are reversed',async()=>{
 const a=app(),input={defaults,rows:[{name:'Later',admissionDate:'2026-11-01'},{name:'Earlier',admissionDate:'2026-08-01'}]};
 const p=await a.call(input);const r=await a.call({...input,commit:true,previewToken:p.data.token});assert.equal(r.status,200);
 assert.equal(a.ctx.db.students[0].name,'Earlier');assert.equal(a.ctx.db.students[0].id,'270001');assert.equal(a.ctx.db.students[1].name,'Later');
 });
