import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
function app(){
  let writes=0,backups=0,fail=false,sequence=0;
  const c={Date,db:{students:[]},uid:()=>String(++sequence),today:()=> '2026-11-04',str:(v,n=500)=>String(v??'').trim().slice(0,n),phoneOf:v=>String(v??'').replace(/[০-৯]/g,d=>'০১২৩৪৫৬৭৮৯'.indexOf(d)).replace(/^\+?88/,''),readBody:async r=>r.body,send:(_,status,data)=>({status,data}),saveDb:()=>{if(fail)throw Error('save failed');writes++},DB_FILE:'db',BACKUPS:'backups',path:{join:(...p)=>p.join('/')},fs:{copyFileSync:()=>backups++},importValidDate:v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))};
  vm.createContext(c);vm.runInContext(source.slice(source.indexOf('const STUDENT_KEYS ='),source.indexOf('const CLEAN ='))+source.slice(source.indexOf('const PROFILE_REQUIRED ='),source.indexOf('async function studentPhotoRequest(')),c);
  return{c,stats:()=>({writes,backups}),fail:()=>fail=true};
}
const complete={name:'পরীক্ষা',nameEn:'Test Student',dob:'2010-01-01',gender:'F',phone:'01700000001',guardianName:'Guardian',guardianPhone:'01800000001',address:'Current address',permanentAddress:'Permanent address',college:'College',klass:'একাদশ',group:'বিজ্ঞান'};
test('Completeness identifies missing fields and same-address satisfies permanent address',()=>{
  const a=app();assert.equal(a.c.studentProfileCompletion({name:'Partial'}).complete,false);assert.equal(a.c.studentProfileCompletion(complete).complete,true);assert.equal(a.c.studentProfileCompletion({...complete,permanentAddress:'',sameAddress:true}).complete,true);
});
test('Student completion preserves roll, batch, joining date, PIN, fees and approval metadata',async()=>{
  const a=app(),student={id:'fixture',batchId:'b1',session:'HSC-28',admissionDate:'2026-10-12',pin:'1234',photo:true,pendingPhoto:{version:'pending'},name:'Partial',note:'private office note'};
  const result=await a.c.updateStudentProfile({body:{...complete,id:'other-student',batchId:'b2',session:'HSC-27',admissionDate:'2026-01-01',pin:'0000',photo:false,pendingPhoto:null,fee:0,note:'changed'}},{},student);
  assert.equal(result.status,200);assert.equal(student.nameEn,complete.nameEn);assert.equal(student.id,'fixture');assert.equal(student.batchId,'b1');assert.equal(student.session,'HSC-28');assert.equal(student.admissionDate,'2026-10-12');assert.equal(student.pin,'1234');assert.equal(student.photo,true);assert.equal(student.pendingPhoto.version,'pending');assert.equal(student.fee,undefined);assert.equal(student.note,'private office note');assert.equal(student.profileUpdatedBy,'student');assert.deepEqual(a.stats(),{writes:1,backups:1});
});
test('Invalid completion does not mutate records; failed saves restore all fields',async()=>{
  for(const bad of [{name:''},{phone:'abc'},{dob:'2027-01-01'},{gender:''},{sscGpa:'8'},{email:'bad'}]){const a=app(),student={id:'fixture',...complete},before=JSON.stringify(student);assert.equal((await a.c.updateStudentProfile({body:{...complete,...bad}},{},student)).status,400);assert.equal(JSON.stringify(student),before);assert.equal(a.stats().writes,0);}
  const a=app(),student={id:'fixture',...complete},before=JSON.stringify(student);a.fail();await assert.rejects(a.c.updateStudentProfile({body:{...complete,college:'New college'}},{},student),/save failed/);assert.equal(JSON.stringify(student),before);
});
test('Blank fields save immediately, existing phone needs review, approval and rejection preserve originals correctly',async()=>{
  const a=app(),student={id:'fixture',...complete};a.c.db.students.push(student);
  let result=await a.c.updateStudentProfile({body:{...complete,phone:'01900000001',fatherName:'New parent'}},{},student);
  assert.equal(result.status,200);assert.equal(student.phone,complete.phone);assert.equal(student.fatherName,'New parent');assert.equal(student.pendingProfile.changes.phone.to,'01900000001');assert.equal(student.pendingProfile.changes.fatherName,undefined);
  let version=student.pendingProfile.version;
  assert.equal((await a.c.reviewStudentProfile({body:{id:student.id,action:'approve',version}},{})).status,200);assert.equal(student.phone,'01900000001');assert.equal(student.profileReview.status,'approved');assert.equal(student.pendingProfile,undefined);
  await a.c.updateStudentProfile({body:{phone:'01600000001'}},{},student);version=student.pendingProfile.version;
  assert.equal((await a.c.reviewStudentProfile({body:{id:student.id,action:'reject',version}},{})).status,200);assert.equal(student.phone,'01900000001');assert.equal(student.profileReview.status,'rejected');assert.equal(student.profileChangeHistory.length,2);
});
test('Stale forms and approvals cannot overwrite newer admin edits; rejection can clear a stale request',async()=>{
  const a=app(),student={id:'fixture',...complete};a.c.db.students.push(student);const baseline=JSON.parse(JSON.stringify(student));student.college='Admin college';
  await a.c.updateStudentProfile({body:{...complete,phone:'01900000001',profileBase:baseline}},{},student);assert.equal(student.college,'Admin college');assert.equal(student.pendingProfile.changes.college,undefined);
  const old=student.pendingProfile.version;
  assert.equal((await a.c.updateStudentProfile({body:{...complete,phone:'01600000001',profileBase:baseline}},{},student)).status,409);
  student.phone='01500000001';assert.equal((await a.c.reviewStudentProfile({body:{id:student.id,action:'approve',version:old}},{})).status,409);assert.equal(student.phone,'01500000001');
  assert.equal((await a.c.reviewStudentProfile({body:{id:student.id,action:'reject',version:old}},{})).status,200);
});
test('Address linking is reviewed atomically; failed review restores pending request',async()=>{
  const a=app(),student={id:'fixture',...complete,sameAddress:false};a.c.db.students.push(student);
  await a.c.updateStudentProfile({body:{address:'New address',sameAddress:true}},{},student);assert.equal(student.address,complete.address);assert.equal(student.permanentAddress,complete.permanentAddress);assert.equal(student.sameAddress,false);assert(student.pendingProfile.changes.sameAddress);
  const version=student.pendingProfile.version;await a.c.reviewStudentProfile({body:{id:student.id,version,action:'approve'}},{});assert.equal(student.sameAddress,true);assert.equal(student.address,'New address');assert.equal(student.permanentAddress,'New address');
  await a.c.updateStudentProfile({body:{phone:'01900000001'}},{},student);const before=JSON.stringify(student);a.fail();await assert.rejects(a.c.reviewStudentProfile({body:{id:student.id,version:student.pendingProfile.version,action:'approve'}},{}),/save failed/);assert.equal(JSON.stringify(student),before);
});
