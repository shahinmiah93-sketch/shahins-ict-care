import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('Field history does not replace photo selection or group change handlers',()=>{
 const container={innerHTML:'',querySelectorAll:()=>[]},history=new Map();
 const ctx={window:{scrollTo:()=>{}},URL:{createObjectURL:()=> 'blob:test-image',revokeObjectURL:()=>{}},localStorage:{getItem:k=>history.get(k),setItem:(k,v)=>history.set(k,v)},U:{$:()=>null,$$:()=>[],esc:v=>String(v??''),bn:String,api:()=>{},toast:()=>{}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(new URL('../public/js/admin-achievers.js',import.meta.url),'utf8'),ctx);
 const page=ctx.window.SICAchievers({DB:{achievers:[],settings:{}}});page(container);
 container.onclick({target:{closest:s=>s==='[data-ac-new]'?{dataset:{acNew:'university'}}:null}});
 container.onchange({target:{matches:s=>s==='input[data-k]',dataset:{k:'detail'},value:'Test University'}});
 assert(history.get('sic-achiever-field-history-v1').includes('Test University'));
 container.onchange({target:{matches:s=>s==='[data-ac-file]',files:[{type:'image/png',size:100}]}});
 assert(container.innerHTML.includes('src="blob:test-image"'));
 assert.equal(typeof container.onchange,'function');
});
