import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
test('dues no-call saves, clears reminders, preserves debt, can be changed and cleared',async()=>{
 const a=source.indexOf('  if (p === "/api/admin/due-call" && m === "POST")'),b=source.indexOf('  // বকেয়া SMS তালিকা',a);assert.ok(a>0&&b>a);
 const c={p:'/api/admin/due-call',m:'POST',req:{},res:{},db:{students:[{id:'s1',fees:{balance:800}}],dueCalls:{}},str:(v,n)=>String(v??'').slice(0,n),saveDb:()=>{},send:(_r,status,body)=>({status,body})};c.readBody=async()=>c.body;vm.createContext(c);vm.runInContext('async function run(){'+source.slice(a,b)+'}',c);
 c.body={studentId:'s1',status:'nocall',followUp:'2026-12-01',promiseDate:'2026-12-01'};
 let r=await c.run();assert.equal(r.status,200);assert.equal(r.body.item.status,'nocall');assert.equal(r.body.item.followUp,'');assert.equal(r.body.item.promiseDate,'');assert.equal(c.db.students[0].fees.balance,800);
 const ui=fs.readFileSync(new URL('../public/js/admin-dues.js',import.meta.url),'utf8');c.calls=()=>c.db.dueCalls;c.today=()=> '2026-11-26';vm.runInContext(ui.slice(ui.indexOf('  const priority ='),ui.indexOf('  const inScope ='))+';globalThis.rank=priority;',c);assert.equal(c.rank('s1'),6);
 c.body.status='later';await c.run();assert.equal(c.db.dueCalls.s1.status,'later');c.body.status='';r=await c.run();assert.equal(r.body.removed,true);assert.equal(c.db.dueCalls.s1,undefined);
});
