import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
test('Q&A source merges by phone, retains existing fields, and is idempotent',()=>{
 const ctx={db:{leads:[]},uid:()=> 'lead1',str:(v,n)=>String(v||'').slice(0,n),phoneOf:v=>String(v||'').replace(/^88/,''),Date};vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('const LEAD_STATUS ='),source.indexOf('// আগে থেকে জমা থাকা কুইজের')),ctx);
 ctx.upsertLead({name:'Original',phone:'01700000001'},{type:'enquiry',ref:'E1'});
 ctx.upsertLead({name:'New name',phone:'8801700000001',institution:'College'},{type:'qna',ref:'G1'});
 ctx.upsertLead({phone:'01700000001'},{type:'qna',ref:'G1'});
 assert.equal(ctx.db.leads.length,1);assert.equal(ctx.db.leads[0].name,'Original');assert.equal(ctx.db.leads[0].institution,'College');assert.equal(ctx.db.leads[0].sources.length,2);assert.equal(ctx.db.leads[0].sources[1].type,'qna');
});
