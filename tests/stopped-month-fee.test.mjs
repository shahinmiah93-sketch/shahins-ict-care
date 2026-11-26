import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
function setup(stop = '2026-11-19', dates = []) {
  const student = {id:'s1',batchId:'b1',status:'inactive',pauses:[{from:stop,to:''}]};
  const enrollment = {studentId:'s1',courseId:'c1',fee:800,discount:0,startDate:'2026-11-01'};
  const db = {students:[student],enrollments:[enrollment],payments:[],courses:[{id:'c1',feeType:'monthly'}],batches:[{id:'b1',days:'শনি, সোম, বুধ'}],closures:[],attendance:Object.fromEntries(dates.map(day=>[`2026-11-${String(day).padStart(2,'0')}|b1`,{s1:'P'}]))};
  const ctx={db,Date,num:v=>Number(v)||0,today:()=> '2026-12-10',saveDb(){}};
  vm.createContext(ctx);
  vm.runInContext(source.slice(source.indexOf('function moduleFee('),source.indexOf('// ব্যাচ বদলালেও আগের হাজিরা')),ctx);
  return {ctx,student,enrollment, row:()=>ctx.enrollmentDue(enrollment).breakdown[0]};
}
test('0 through 3 present days are free; four days are proportional to scheduled classes',()=>{
  for(const days of [[],[2],[2,4],[2,4,7]])assert.equal(setup('2026-11-19',days).row().fee,0);
  const row=setup('2026-11-19',[2,4,7,9]).row();assert.equal(row.total,13);assert.equal(row.fee,246);assert.equal(row.pauseRule,'attendance');
});
test('half rule includes the 13th and 20th and overrides low attendance',()=>{
  assert.equal(setup('2026-11-20',[13]).row().fee,400);
  assert.equal(setup('2026-11-19',[13]).row().fee,0);
  assert.equal(setup('2026-11-20',[12]).row().fee,0);
});
test('full rule is strictly after the 25th and 22nd, overrides half',()=>{
  assert.equal(setup('2026-11-26',[23]).row().fee,800);
  assert.equal(setup('2026-11-25',[23]).row().fee,400);
  assert.equal(setup('2026-11-26',[22]).row().fee,400);
});
test('duplicate dates count once, absent and leave days do not count, later attendance is excluded',()=>{
  const f=setup('2026-11-19',[2,4,7]);
  Object.assign(f.ctx.db.attendance,{'2026-11-02|old':{s1:'P'},'2026-11-09|b1':{s1:'A'},'2026-11-11|b1':{s1:'L'},'2026-11-21|b1':{s1:'P'}});
  assert.equal(f.row().got,3);assert.equal(f.row().fee,0);
});
test('monthly discount is applied before the half rule; following stopped months stay zero',()=>{
  const f=setup('2026-11-20',[13]);f.enrollment.discountPct=25;
  const result=f.ctx.enrollmentDue(f.enrollment);assert.equal(result.breakdown[0].fee,300);assert.equal(result.breakdown[1].fee,0);
  f.ctx.db.payments.push({studentId:'s1',amount:100,discount:0});assert.equal(f.ctx.feeSummary(f.student).balance,200);
});
test('inactive future pauses keep normal fees; active students use attendance fees',()=>{
  const f=setup('2026-11-26',[23]);f.student.pauses[0].startPending=true;assert.equal(f.row().fee,800);
  f.student.pauses=[];f.student.status='active';assert.equal(f.row().fee,50);
});

test('active monthly fee boundaries and effective month',()=>{
 for(const day of [15,16,30]) for(let count=0;count<=6;count++){
  const f=setup();const dates=Array.from({length:count},(_,i)=>'2026-11-'+String(i+1).padStart(2,'0'));
  const r=f.ctx.activeMonthFee(1200,dates,'2026-11-'+day,12);
  assert.equal(r.fee,count===0?0:count<=3?count*100:day===15||count===4?600:1200);
 }
 const f=setup('2026-11-19',[2,4]);f.student.status='active';f.student.pauses=[];f.enrollment.startDate='2026-10-01';
 const rows=f.ctx.enrollmentDue(f.enrollment).breakdown;assert.equal(rows[0].fee,800);assert.equal(rows[1].fee,150);assert.equal(rows[2].fee,0);
 f.ctx.db.attendance['2026-11-02|other']={s1:'P'};f.ctx.db.attendance['2026-11-09|b1']={s1:'A'};assert.equal(f.ctx.enrollmentDue(f.enrollment).breakdown[1].got,2);
 f.enrollment.discountPct=25;assert.equal(f.ctx.enrollmentDue(f.enrollment).breakdown[1].fee,100);
});

test('active per-class fees use twelve classes and round the total to nearest fifty',()=>{const f=setup();for(const [count,fee] of [[1,50],[2,150],[3,200]]){const dates=Array.from({length:count},(_,i)=>'2026-11-'+String(i+1).padStart(2,'0'));for(const scheduled of [12,13,14]){const r=f.ctx.activeMonthFee(800,dates,'2026-11-26',scheduled);assert.equal(r.fee,fee);assert.equal(r.total,12);}}});
