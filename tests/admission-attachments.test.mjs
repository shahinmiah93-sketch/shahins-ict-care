import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const source=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const helper=source.slice(source.indexOf('async function admissionAttachmentAction('),source.indexOf('function readRaw(req, limit)'));
function fixture(){
 const files=new Map(); let seq=0;
 const c={Buffer,Date,path,ADMISSION_FILES:'/private',db:{students:[{id:'s1'},{id:'s2'}]},str:(v,n)=>String(v||'').slice(0,n),uid:()=>`f${++seq}`,saveDb(){},send:(_,status,data)=>({status,data}),readRaw:async req=>{if(req.large)throw Error();return req.body;},fs:{writeFileSync:(p,b)=>files.set(p,b),existsSync:p=>files.has(p),unlinkSync:p=>files.delete(p),createReadStream:p=>({pipe:r=>{r.bytes=files.get(p);return r;}})}};
 vm.createContext(c);vm.runInContext(helper,c);
 return {c,files,call:(method='GET',sid='s1',fileId,body=Buffer.from('%PDF-1.7'),name='form.pdf',res={})=>c.admissionAttachmentAction({method,body},res,new URL('https://test/?name='+encodeURIComponent(name)),sid,fileId)};
}
test('multiple private attachments persist and are isolated by student',async()=>{
 const f=fixture();assert.equal((await f.call('POST')).status,200);assert.equal((await f.call('POST')).status,200);
 assert.equal((await f.call()).data.items.length,2);assert.equal((await f.call('GET','s2')).data.items.length,0);
 assert.equal((await f.call('GET','s2','f1')).status,404);assert.equal((await f.call('POST','missing')).status,404);
 const r={writeHead(code,headers){this.code=code;this.headers=headers;}};
 await f.call('GET','s1','f1',undefined,undefined,r);assert.equal(r.code,200);assert.equal(r.headers['Cache-Control'],'no-store');assert.equal(r.bytes.toString(),'%PDF-1.7');
});
test('rejects unsafe types, fake images and oversized files',async()=>{
 const f=fixture();assert.equal((await f.call('POST','s1',undefined,Buffer.from('bad'),'file.html')).status,400);
 assert.equal((await f.call('POST','s1',undefined,Buffer.from('bad'),'file.png')).status,400);
 const r=await f.c.admissionAttachmentAction({method:'POST',large:true},{},new URL('https://test/?name=form.pdf'),'s1');assert.equal(r.status,413);assert.equal(f.files.size,0);
});
test('failed metadata save rolls back uploaded file',async()=>{
 const f=fixture();f.c.saveDb=()=>{throw Error('disk');};assert.equal((await f.call('POST')).status,500);assert.equal(f.files.size,0);assert.equal(f.c.db.admissionAttachments.length,0);
});
test('attachment routes are behind admin authentication',()=>{
 assert.ok(source.indexOf('const admissionFileRoute =')>source.indexOf('if (ADMIN_LOCK && !getLogin(req, "admin", res))'));
 const html=fs.readFileSync(new URL('../public/admin.html',import.meta.url),'utf8');assert.ok(html.indexOf('/js/admin-admission-files.js')<html.indexOf('/js/admin.js?'));
});
