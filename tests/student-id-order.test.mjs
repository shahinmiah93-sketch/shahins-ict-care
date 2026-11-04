import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
function fixture(fail=false){
 const db={students:[{id:'280001',session:'HSC-28',admissionDate:'2026-11-01',name:'Later',pin:'1111'},{id:'280002',session:'HSC-28',admissionDate:'2026-08-01',name:'Earlier',pin:'2222'}],enrollments:[{studentId:'280001',fee:1000}],payments:[{studentId:'280002',amount:300}],exams:[{studentIds:['280001','280002'],marks:{'280001':[{x:10}],'280002':[{x:20}]}}],quizzes:[{attempts:{'280001':[{score:5}],G1:[{score:9}]}}],homework:[{checks:{'280002':'done'}}],attendance:{day:{'280001':'P','280002':'A'}},leads:[{studentId:'280001',sources:[{type:'qna',ref:'280001'}]}],qna:[{studentId:'280002'}],notices:[{studentIds:['280002']}],bookSales:[{studentId:'280001',total:500}],absentSent:{day:['280001']},monthlySent:{month:['280002']},feeSent:{month:['280001']},meta:{admissionImports:[{ids:['280001','280002']}]}};
 const files=new Map([['photos/s-280001.jpg',Buffer.from('later-photo')],['photos/p-280002.jpg',Buffer.from('earlier-pending')]]);
 const ctx={db,Date,logins:new Map([['student-token',{role:'student',sid:'280001'}],['admin-token',{role:'admin'}]]),sessionYY:s=>s.slice(-2),photoFile:(k,id)=>`photos/${k}-${id}.jpg`,DB_FILE:'database.json',BACKUPS:'backups',path:{join:(...x)=>x.join('/'),basename:x=>x.split('/').pop()},console:{info:()=>{}},saveLogins:()=>{},writeJsonAtomic:()=>{},saveDb:()=>{if(fail)throw Error('write failed')},fs:{copyFileSync:()=>{},existsSync:f=>files.has(f),readFileSync:f=>files.get(f),writeFileSync:(f,v)=>files.set(f,v),unlinkSync:f=>files.delete(f)}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function renumberStudentsByAdmission()'),source.indexOf('// ---------- রাউটার ----------',source.indexOf('function renumberStudentsByAdmission()'))),ctx);
 return {ctx,files};
}
test('Renumbering swaps IDs, references and photos safely, keeps PINs, invalidates sessions and runs once',()=>{
 const {ctx:c,files}=fixture();assert.equal(c.renumberStudentsByAdmission(),true);
 assert.equal(c.db.students[0].name,'Earlier');assert.equal(c.db.students[0].id,'280001');assert.equal(c.db.students[0].pin,'2222');
 assert.equal(c.db.enrollments[0].studentId,'280002');assert.equal(c.db.payments[0].studentId,'280001');assert.equal(c.db.exams[0].marks['280002'][0].x,10);assert.equal(c.db.quizzes[0].attempts.G1[0].score,9);assert.equal(c.db.quizzes[0].attempts['280002'][0].score,5);
 assert.equal(c.db.homework[0].checks['280001'],'done');assert.equal(c.db.attendance.day['280002'],'P');assert.equal(c.db.leads[0].sources[0].ref,'280002');assert.equal(c.db.qna[0].studentId,'280001');assert.equal(c.db.notices[0].studentIds[0],'280001');assert.equal(c.db.bookSales[0].studentId,'280002');assert.equal(c.db.feeSent.month[0],'280002');
 assert.equal(files.get('photos/s-280002.jpg').toString(),'later-photo');assert(!files.has('photos/s-280001.jpg'));assert.equal(files.get('photos/p-280001.jpg').toString(),'earlier-pending');assert(!files.has('photos/p-280002.jpg'));
 assert(!c.logins.has('student-token'));assert(c.logins.has('admin-token'));const before=JSON.stringify(c.db);assert.equal(c.renumberStudentsByAdmission(),false);assert.equal(JSON.stringify(c.db),before);
});
test('Renumbering rolls back records, photos and sessions if saving fails',()=>{
 const {ctx:c,files}=fixture(true),before=JSON.stringify(c.db);assert.throws(()=>c.renumberStudentsByAdmission(),/write failed/);assert.equal(JSON.stringify(c.db),before);assert.equal(files.get('photos/s-280001.jpg').toString(),'later-photo');assert(!files.has('photos/s-280002.jpg'));assert(c.logins.has('student-token'));
});
