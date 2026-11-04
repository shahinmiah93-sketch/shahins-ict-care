import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx={window:{},U:{bn:String}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(new URL('../public/js/admin-student-directory.js',import.meta.url),'utf8'),ctx);
const directory=ctx.window.SICStudentDirectory;
function fixture(){return {students:[{id:'offline',phone:'01700000001'},{id:'online',phone:'01700000002'},{id:'both',phone:'01700000003'},{id:'partial',phone:''}],courses:[{id:'off',name:'Offline regular'},{id:'on',name:'Online course',mode:'online'}],enrollments:[{studentId:'offline',courseId:'off'},{studentId:'online',courseId:'on'},{studentId:'both',courseId:'off'},{studentId:'both',courseId:'on'}],learners:[{id:'legacy',phone:'01700000004'},{id:'not-enrolled',phone:'01700000005'}],ocEnrolls:[{learnerId:'legacy',courseId:'legacy-course'}],quizGuests:[{id:'G1',phone:'01700000006',hsc:'HSC-27'},{id:'G2',phone:'8801700000001',hsc:'HSC-27'},{id:'G3',phone:'01700000004',hsc:'HSC-28'},{id:'G4',phone:'01700000007',hsc:'HSC-28'},{id:'G5',phone:'01700000002',hsc:'HSC-27'}],quizzes:[{id:'q',attempts:{offline:[{submittedAt:1}],G1:[{submittedAt:1}],G2:[{submittedAt:1}],G3:[{submittedAt:1}],G5:[{submittedAt:1}]}}],thRegs:[]};}
test('Offline and online are classified by enrollments, including mixed and sparse admissions',()=>{
  const db=fixture(),before=JSON.stringify(db);
  assert.deepEqual([...directory.ids(db,'offline')],['offline','both','partial']);assert.deepEqual([...directory.ids(db,'online')],['online','both']);assert.deepEqual(directory.legacyOnline(db).map(l=>l.id),['legacy']);assert.equal(JSON.stringify(db),before);
});
test('Quiz directory contains only external quiz participants; admitted students can still take quizzes',()=>{
  const db=fixture(),before=JSON.stringify(db);assert.deepEqual(directory.quizParticipants(db).map(g=>g.id),['G1']);assert.equal(JSON.stringify(db),before);assert.equal(db.quizzes[0].attempts.offline.length,1);
});
test('Four directory buttons have distinct destinations and retain the selected category',()=>{
  const html=directory.header(fixture(),'online');for(const key of ['offline','online','quiz','talent'])assert(html.includes('href="#students/'+key+'"'));assert.equal((html.match(/aria-current="page"/g)||[]).length,1);assert(html.includes('sd-online selected'));
});
