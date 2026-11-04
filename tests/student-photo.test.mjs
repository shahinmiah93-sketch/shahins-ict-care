import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
function fixture(){
  const files=new Map([['db',Buffer.from('{}')]]),student={id:'fixture',photo:true},original=Buffer.from('previous approved photo');files.set('s-fixture',original);
  let sequence=0,fail=false;
  const c={Buffer,Date,db:{students:[student]},readBody:async req=>req.body,send:(_,status,data)=>({status,data}),str:v=>String(v||''),uid:()=>String(++sequence),photoFile:(kind,id)=>kind+'-'+id,DB_FILE:'db',BACKUPS:'backups',path:{join:(...s)=>s.join('/')},saveDb:()=>{if(fail)throw Error('save failed')},removePhoto:(kind,id)=>files.delete(kind+'-'+id),fs:{existsSync:p=>files.has(p),readFileSync:p=>files.get(p),writeFileSync:(p,b)=>files.set(p,Buffer.from(b)),copyFileSync:(a,b)=>{if(!files.has(a))throw Error('missing');files.set(b,Buffer.from(files.get(a)))}}};
  vm.createContext(c);vm.runInContext(source.slice(source.indexOf('async function studentPhotoRequest('),source.indexOf('async function api(')),c);
  const image=Buffer.alloc(150,7);image[0]=255;image[1]=216;image[2]=255;
  return{c,files,student,original,photo:'data:image/jpeg;base64,'+image.toString('base64'),fail:()=>fail=true};
}
test('Student submission remains pending; stale approval cannot replace approved photo',async()=>{
  const f=fixture(),r=await f.c.studentPhotoRequest({body:{photo:f.photo}},{},f.student);assert.equal(r.status,200);assert.deepEqual(f.files.get('s-fixture'),f.original);
  const old=f.student.pendingPhoto.version;await f.c.studentPhotoRequest({body:{photo:f.photo}},{},f.student);
  assert.equal((await f.c.reviewStudentPhoto({body:{id:'fixture',action:'approve',version:old}},{})).status,409);
  const result=await f.c.reviewStudentPhoto({body:{id:'fixture',action:'approve',version:f.student.pendingPhoto.version}},{});
  assert.equal(result.status,200);assert.equal(f.student.photoReview.status,'approved');assert.equal(f.student.pendingPhoto,undefined);assert.equal(f.files.has('p-fixture'),false);assert.notDeepEqual(f.files.get('s-fixture'),f.original);assert([...f.files.keys()].some(k=>k.endsWith('-previous.jpg')));
});
test('Rejection preserves old photo; save failures roll back photo and metadata',async()=>{
  const f=fixture();await f.c.studentPhotoRequest({body:{photo:f.photo}},{},f.student);
  await f.c.reviewStudentPhoto({body:{id:'fixture',action:'reject',version:f.student.pendingPhoto.version}},{});assert.deepEqual(f.files.get('s-fixture'),f.original);assert.equal(f.student.photoReview.status,'rejected');
  await f.c.studentPhotoRequest({body:{photo:f.photo}},{},f.student);const before=JSON.stringify(f.student);f.fail();
  await assert.rejects(f.c.reviewStudentPhoto({body:{id:'fixture',action:'approve',version:f.student.pendingPhoto.version}},{}),/save failed/);assert.equal(JSON.stringify(f.student),before);assert.deepEqual(f.files.get('s-fixture'),f.original);assert(f.files.has('p-fixture'));
});
test('Invalid image payloads never create a pending record',async()=>{
  for(const photo of ['data:image/svg+xml;base64,PHN2Zz4=', 'data:image/jpeg;base64,'+Buffer.alloc(150).toString('base64')]){const f=fixture();assert.equal((await f.c.studentPhotoRequest({body:{photo}},{},f.student)).status,400);assert.equal(f.student.pendingPhoto,undefined);}
});
