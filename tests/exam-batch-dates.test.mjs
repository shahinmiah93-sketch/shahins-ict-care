import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const admin=fs.readFileSync(new URL('../public/js/admin-exams.js',import.meta.url),'utf8');
function fixture(){
 const c={db:{students:[{id:'s1',batchId:'a',session:'28'},{id:'s2',batchId:'b',session:'28'}],batches:[{id:'a'},{id:'b'}],exams:[],docs:[]},str:(v,n)=>String(v??'').slice(0,n),num:v=>Number(v)||0,isPublishedFor:()=>false};vm.createContext(c);
 vm.runInContext(fs.readFileSync(new URL('../public/js/examcalc.js',import.meta.url),'utf8'),c);c.EC=c.ExamCalc;
 vm.runInContext(server.slice(server.indexOf('function cleanMarks('),server.indexOf('const youtubeId')),c);
 const a=server.indexOf('  exams: (b) => {',server.indexOf('const CLEAN =')),b=server.indexOf('\n  //',a);vm.runInContext('var clean={'+server.slice(a,b)+'};',c);
 vm.runInContext(server.slice(server.indexOf('function scheduleFor('),server.indexOf('const routineForStudent')),c);
 vm.runInContext(server.slice(server.indexOf('function resultsFor('),server.indexOf('\n}',server.indexOf('function resultsFor('))+2),c);
 return c;
}
function exam(c){const e={id:'ex1',title:'Class Assessment-01',type:'class',mode:'both',session:'28',date:'2026-11-29',subjects:[{name:'ICT',cq:20,mcq:15}],studentIds:['s1','s2'],batchIds:['a','b'],batchDates:{a:'2026-11-29',b:'2026-11-30'}};const parts=c.EC.parts(e);e.marks={s1:[Object.fromEntries(parts.map(p=>[p.key,10]))]};return e;}
test('adding a batch preserves previous marks and saves both dates',()=>{const c=fixture(),e=exam(c),clean=c.clean.exams(e);assert.equal(clean.batchDates.b,'2026-11-30');assert.equal(JSON.stringify(clean.marks),JSON.stringify(e.marks));assert.equal(clean.studentIds.length,2);});
test('student routine and result use own batch date, legacy uses default',()=>{const c=fixture(),e=exam(c);c.db.exams=[e];for(const [s,date] of [[c.db.students[0],'2026-11-29'],[c.db.students[1],'2026-11-30']]){assert.equal(c.scheduleFor(s)[0].date,date);assert.equal(c.resultsFor(s)[0].date,date);}delete e.batchDates;assert.equal(c.scheduleFor(c.db.students[1])[0].date,'2026-11-29');});
test('admin calendar has distinct dates; batch filter shows only its date',()=>{const c=fixture(),e=exam(c);Object.assign(c,{S:{f:{batch:''}},exams:()=>[e],today:()=> '2026-11-24',X:{batchName:id=>id}});vm.runInContext(admin.slice(admin.indexOf('  const dateOf ='),admin.indexOf('  const docsOf =')),c);assert.equal(c.items().length,2);assert.equal(c.items()[1].date,'2026-11-30');c.S.f.batch='b';assert.equal(c.items().length,1);assert.equal(c.items()[0].date,'2026-11-30');});
test('chapter later attempts remain unchanged',()=>{const c=fixture(),e=exam(c);e.type='chapter';e.attemptDates=['2026-11-29','2026-12-05','2026-12-12'];c.db.exams=[e];assert.equal(c.scheduleFor(c.db.students[1]).map(x=>x.date).join(','),'2026-11-30,2026-12-05,2026-12-12');});
test('batch times persist and each student sees their own time',()=>{const c=fixture(),e=exam(c);e.time='10:00';e.batchTimes={a:'সকাল ৭:০০',b:'বিকাল ৩:০০',unknown:'bad'};const clean=c.clean.exams(e);assert.equal(clean.batchTimes.a,'সকাল ৭:০০');assert.equal(clean.batchTimes.unknown,undefined);c.db.exams=[{...e,...clean}];assert.equal(c.scheduleFor(c.db.students[0])[0].time,'সকাল ৭:০০');assert.equal(c.resultsFor(c.db.students[1])[0].time,'বিকাল ৩:০০');delete c.db.exams[0].batchTimes;assert.equal(c.scheduleFor(c.db.students[0])[0].time,'10:00');});
test('batch roster adds later admissions, respects exclusions and retains recorded marks',()=>{const c=fixture();vm.runInContext(server.slice(server.indexOf('function syncExamParticipants()'),server.indexOf('function saveDb()')),c);const e=exam(c);e.participantMode='batch';e.excludedStudentIds=['s2'];e.studentIds=['s1'];c.db.exams=[e];c.db.students.push({id:'later',batchId:'b',session:'28',status:'active'},{id:'other',batchId:'outside',session:'28',status:'active'});c.syncExamParticipants();assert.equal(e.studentIds.includes('later'),true);assert.equal(e.studentIds.includes('s2'),false);assert.equal(e.studentIds.includes('other'),false);c.db.students[0].batchId='outside';c.syncExamParticipants();assert.equal(e.studentIds.includes('s1'),true);assert.equal(Object.keys(e.marks).length,1);});

test('routine marks follow exam mode and sum across subjects',()=>{const c=fixture(),e=exam(c);e.subjects.push({name:'Other',cq:10,mcq:5});c.db.exams=[e];for(const [mode,cq,mcq] of [['both',30,20],['cq',30,0],['mcq',0,20]]){e.mode=mode;const row=c.scheduleFor(c.db.students[0])[0];assert.equal(row.cq,cq);assert.equal(row.mcq,mcq);assert.equal(row.full,cq+mcq);}});
