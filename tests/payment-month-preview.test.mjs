import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../public/js/admin.js',import.meta.url),'utf8');
function fixture(){
 const it={enrollmentId:'e',courseId:'c',monthly:true,status:'active',net:1000,startDate:'2026-11-01',due:400,adjust:[{month:'2026-11',fee:400}],breakdown:[{month:'2026-11',fee:400,monthlyRate:800}]};
 const student={id:'s',status:'active',fees:{items:[it],totalDue:400,paid:600,balance:-200}};
 const c={DB:{enrollments:[{id:'e',fee:800}],payments:[{studentId:'s',enrollmentId:'e',amount:600}]},thisMonth:()=> '2026-11',courseById:()=>({}),U:{monthlyFeeFor:(_c,e,m)=>m==='2027-01'?900:e.fee}};vm.createContext(c);
 vm.runInContext(src.slice(src.indexOf('  function paymentMonthStudent('),src.indexOf('  function paymentForm('))+src.slice(src.indexOf('  function monthDues('),src.indexOf('  function fees(c, tab)')),c);
 return {c,student};
}
test('December preview includes scheduled fee, applies advance, leaves current totals untouched',()=>{
 const {c,student:s}=fixture(),p=c.paymentMonthStudent(s,'2026-12');assert.equal(p.fees.balance,600);assert.equal(p.fees.totalDue,1200);assert.equal(s.fees.balance,-200);assert.equal(s.fees.items[0].adjust.length,1);
 const dues=c.monthDues(p,p.fees.items[0],'2026-12');assert.equal(dues['2026-11'],0);assert.equal(dues['2026-12'],600);assert.equal(p.fees.items[0].adjust.at(-1).fee,800);
 assert.equal(c.paymentMonthStudent(s,'2027-01').fees.balance,1500);assert.equal(c.paymentMonthStudent(s,'2026-11'),s);
});
test('inactive, stopped and ended enrollments do not gain future fees',()=>{
 for(const kind of ['inactive','pause','ended']){const {c,student:s}=fixture();if(kind==='inactive')s.status='inactive';if(kind==='pause')s.pauses=[{from:'2026-12-01',to:''}];if(kind==='ended'){s.fees.items[0].status='ended';c.DB.enrollments[0].endDate='2026-11-26';}assert.equal(c.paymentMonthStudent(s,'2026-12').fees.balance,-200);}
});

test('selecting the next month settles the current month without mutating it',()=>{const {c,student:s}=fixture();s.fees.items[0].due=800;s.fees.totalDue=800;s.fees.balance=200;const row={month:'2026-11',fee:800,currentMonth:true,settlementFee:50,settlementRule:'classes',monthlyRate:800};s.fees.items[0].breakdown=[row];s.fees.items[0].adjust=[row];const p=c.paymentMonthStudent(s,'2026-12');assert.equal(p.fees.totalDue,850);assert.equal(p.fees.balance,250);assert.equal(p.fees.items[0].adjust[0].fee,50);assert.equal(c.monthDues(p,p.fees.items[0],'2026-12')['2026-12'],250);assert.equal(s.fees.items[0].breakdown[0].fee,800);});
