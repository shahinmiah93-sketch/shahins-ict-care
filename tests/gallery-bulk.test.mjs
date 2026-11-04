import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function ui({fail=false, confirm=true}={}) {
  const db={gallery:[{id:'g1',album:'A',active:true},{id:'g2',album:'A',active:false},{id:'g3',album:'B',active:true}]},calls=[],elements=new Map(),C={innerHTML:''};
  const el=k=>{if(!elements.has(k))elements.set(k,{});return elements.get(k)};
  const context={window:{},confirm:()=>confirm,U:{$:s=>el(s),$$:()=>[],esc:String,bn:String,today:()=> '2026-11-04',date:String,toast:()=>{},api:async(route,options)=>{calls.push({route,options});if(fail)throw new Error('fixture request failed');const ids=options.body.ids;const deleted=db.gallery.filter(g=>ids.includes(g.id)).length;db.gallery=db.gallery.filter(g=>!ids.includes(g.id));return {deleted}}},URL:{revokeObjectURL:()=>{}}};
  vm.runInNewContext(fs.readFileSync(new URL('../public/js/admin-gallery.js',import.meta.url),'utf8'),context);
  context.window.SICGallery({get DB(){return db},load:async()=>{},save:async()=>{},remove:()=>{}})(C);
  return {db,calls,el,C,click:selector=>C.onclick({target:{closest:s=>s===selector?{}:null}}),select:(id,checked)=>C.onchange({target:{matches:s=>s==='[data-gl-select]',dataset:{glSelect:id},checked}}),all:checked=>C.onchange({target:{matches:s=>s==='[data-gl-all]',checked}}),filter:album=>C.onclick({target:{closest:s=>s==='[data-gl-filter]'?{dataset:{glFilter:album}}:null}})};
}
test('Gallery multi-select supports filtered select-all, clearing and confirmed deletion of exactly selected IDs',async()=>{
  const a=ui();assert(a.C.innerHTML.includes('data-gl-select="g1"'));
  a.select('g3',true);assert.equal(a.el('[data-gl-count]').textContent,'1টি ছবি নির্বাচিত');
  a.filter('A');assert.equal(a.el('[data-gl-count]').textContent,'0টি ছবি নির্বাচিত');
  a.all(true);assert.equal(a.el('[data-gl-count]').textContent,'2টি ছবি নির্বাচিত');assert.equal(a.el('[data-gl-all]').checked,true);
  await a.click('[data-gl-delete-selected]');assert.equal(a.calls.length,1);assert.deepEqual(Array.from(a.calls[0].options.body.ids),['g1','g2']);
  assert.deepEqual(a.db.gallery.map(g=>g.id),['g3']);assert.equal(a.el('[data-gl-count]').textContent,'0টি ছবি নির্বাচিত');
});
test('Cancel sends no deletion; server failure preserves selection for retry',async()=>{
  const a=ui({confirm:false});a.select('g1',true);await a.click('[data-gl-delete-selected]');assert.equal(a.calls.length,0);
  const b=ui({fail:true});b.select('g1',true);await b.click('[data-gl-delete-selected]');assert.equal(b.db.gallery.length,3);assert.equal(b.el('[data-gl-count]').textContent,'1টি ছবি নির্বাচিত');assert.equal(b.el('[data-gl-delete-selected]').disabled,false);
  b.click('[data-gl-unselect]');assert.equal(b.el('[data-gl-count]').textContent,'0টি ছবি নির্বাচিত');
});
function backend({failCopy=false,failSave=false}={}) {
  const files=new Map([['gallery/g1.jpg','one'],['gallery/g2.jpg','two'],['gallery/g3.jpg','three']]);let saves=0;
  const ctx={db:{gallery:['g1','g2','g3'].map(id=>({id,image:{ext:'.jpg'}}))},readBody:async r=>r.body,send:(res,status,data)=>({status,data}),uid:()=> 'backup-test',imgFile:(col,g)=>'gallery/'+g.id+'.jpg',BACKUPS:'backups',DB_FILE:'db.json',path:{join:(...p)=>p.join('/')},Date,
    fs:{existsSync:p=>files.has(p),copyFileSync:(from,to)=>{if(failCopy)throw new Error('copy failed');files.set(to,files.get(from))}},writeJsonAtomic:(p,v)=>files.set(p,JSON.stringify(v)),saveDb:()=>{if(failSave)throw new Error('save failed');saves++},dropImg:(col,g)=>files.delete('gallery/'+g.id+'.jpg')};
  const source=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8'),start=source.indexOf('async function galleryDeleteAction('),end=source.indexOf('// ---------- রাউটার ----------',start);
  vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
  return {ctx,files,saves:()=>saves,call:body=>ctx.galleryDeleteAction({body},{})};
}
test('Bulk API archives original images and records, saves once, tolerates retries and rejects invalid IDs',async()=>{
  const a=backend();assert.equal((await a.call({ids:['../bad']})).status,400);
  const result=await a.call({ids:['g1','g2','g1']});assert.equal(result.data.deleted,2);assert.equal(a.saves(),1);
  assert.deepEqual(a.ctx.db.gallery.map(g=>g.id),['g3']);assert.equal(a.files.get('gallery/g3.jpg'),'three');assert(!a.files.has('gallery/g1.jpg'));
  assert.equal(a.files.get('backups/backup-test-g1.jpg'),'one');assert.equal(JSON.parse(a.files.get('backups/backup-test.json')).items.length,2);
  assert.equal((await a.call({ids:['g1','g2']})).data.deleted,0);assert.equal(a.saves(),1);
});
test('Backup or save failure keeps all photos and original gallery records',async()=>{
  for(const options of [{failCopy:true},{failSave:true}]){
    const a=backend(options);await assert.rejects(a.call({ids:['g1','g2']}),/failed/);assert.equal(a.ctx.db.gallery.length,3);assert(a.files.has('gallery/g1.jpg'));assert(a.files.has('gallery/g2.jpg'));
  }
});
