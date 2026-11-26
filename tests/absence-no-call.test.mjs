import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const start=source.indexOf('  if (p === "/api/admin/absence-call" && m === "POST")');
const end=source.indexOf('  if (p === "/api/admin/attendance"',start);
test('no-call persists separately by absence date, supports correction and clearing',async()=>{
 const c={p:'/api/admin/absence-call',m:'POST',req:{},res:{},db:{students:[{id:'s1',status:'active'}],absenceCalls:{}},str:(v,n)=>String(v??'').slice(0,n),saveDb:()=>{},send:(_r,status,body)=>({status,body})};
 c.readBody=async()=>c.body;vm.createContext(c);vm.runInContext('async function run(){'+source.slice(start,end)+'}',c);
 c.body={date:'2099-11-26',studentId:'s1',status:'nocall',followUp:'2099-11-27'};
 let r=await c.run();assert.equal(r.status,200);assert.equal(r.body.item.status,'nocall');assert.equal(r.body.item.followUp,'');assert.equal(c.db.students[0].status,'active');assert.equal(c.db.absenceCalls['2099-11-27|s1'],undefined);
 c.body.status='talked';await c.run();assert.equal(c.db.absenceCalls['2099-11-26|s1'].status,'talked');
 c.body.status='';r=await c.run();assert.equal(r.body.removed,true);assert.equal(c.db.absenceCalls['2099-11-26|s1'],undefined);
});
