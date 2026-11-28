import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/js/admin-absence.js',import.meta.url),'utf8');
function setup(records,attendance=[]){
 const c={calls:()=>records,history:()=>attendance,isDone:s=>s==='talked'||s==='nocall'};
 vm.createContext(c);
 vm.runInContext(source.slice(source.indexOf('  const previousContact ='),source.indexOf('  const pendingCount ='))+';this.lookup=previousContact;',c);
 return ()=>c.lookup({s:{id:'280008'},date:'2026-11-28',key:'2026-11-28|280008'});
}
test('resolved previous call stays separate through continuous absence and retains notes',()=>{
 for(const status of ['talked','nocall']){
 const result=setup({'2026-11-25|280008':{status,note:'Returning soon'}},[['2026-11-28','A'],['2026-11-25','A']])();
 assert.equal(result.status,status);assert.equal(result.date,'2026-11-25');assert.equal(result.note,'Returning soon');
 }
});
test('returning to class starts a new call cycle',()=>assert.equal(setup({'2026-11-25|280008':{status:'talked'}},[['2026-11-26','P'],['2026-11-28','A']])(),null));
test('current explicit status and latest unanswered/follow-up take precedence',()=>{
 for(const status of ['talked','nocall','noanswer','later']) assert.equal(setup({'2026-11-25|280008':{status:'talked'},'2026-11-28|280008':{status}})(),null);
 for(const status of ['noanswer','later']) assert.equal(setup({'2026-11-24|280008':{status:'talked'},'2026-11-25|280008':{status}})(),null);
});
test('other students and future calls cannot classify this student',()=>assert.equal(setup({'2026-11-25|280009':{status:'talked'},'2026-11-29|280008':{status:'talked'}})(),null));
