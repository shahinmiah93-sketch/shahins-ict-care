import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { SyncEngine, snapshot, sourceAllowed, changedFiles } from '../scripts/online-sync.mjs';
const exec=promisify(execFile);
const git=async(args,cwd)=>(await exec('git',args,{cwd,windowsHide:true})).stdout.trim();

async function fixture() {
  const parent=await fs.mkdtemp(path.join(os.tmpdir(),'ict-sync-test-'));
  const root=path.join(parent,'Source with spaces'),seed=path.join(parent,'seed'),remote=path.join(parent,'upstream.git');
  await fs.mkdir(root);await fs.mkdir(seed);
  await git(['init','--initial-branch=main',seed],parent);
  await git(['config','user.name','Fixture'],seed);await git(['config','user.email','fixture@example.invalid'],seed);await git(['config','core.autocrlf','false'],seed);
  await fs.writeFile(path.join(seed,'server.mjs'),'export const value = 1;\n');
  await git(['add','server.mjs'],seed);await git(['commit','-m','Initial'],seed);
  await git(['clone','--bare',seed,remote],parent);
  await fs.writeFile(path.join(root,'server.mjs'),'export const value = 1;\n');
  const validate=async(job,changed)=>{for(const file of changed.filter(p=>p.endsWith('.mjs'))){try{await fs.access(path.join(job,file));}catch{continue;}await exec(process.execPath,['--check',file],{cwd:job,windowsHide:true});}};
  const engine=new SyncEngine(root,{remote,validate});
  const clean=async()=>{const absolute=path.resolve(parent);assert.ok(absolute.startsWith(path.resolve(os.tmpdir())+path.sep));assert.ok(path.basename(absolute).startsWith('ict-sync-test-'));await fs.rm(absolute,{recursive:true,force:true,maxRetries:3,retryDelay:100});};
  return{parent,root,seed,remote,engine,clean};
}

test('Source allowlist excludes live data, secrets, backups, generated bundles and installed dependencies',()=>{
  for(const p of ['data/database.json','data/photos/s-1.jpg','private-backups/private.zip','.online-sync/state.json','cloudflare/.wrangler/state.json','cloudflare/node_modules/a.js','cloudflare/dist/worker.mjs','public/.env','public/auth.json','public/private.key','public/data/students.json'])assert.equal(sourceAllowed(p),false,p);
  for(const p of ['public/index.html','public/images/logo.png','server.mjs','seed.mjs','scripts/online-sync.mjs','cloudflare/src/worker.mjs','cloudflare/wrangler.jsonc','cloudflare/package-lock.json'])assert.equal(sourceAllowed(p),true,p);
  assert.deepEqual(changedFiles({a:{hash:'old'},deleted:{hash:'yes'}},{a:{hash:'new'},added:{hash:'yes'}}),['a','added','deleted']);
});
test('Saved code is committed/pushed, deletions are published and local private data is never included',async()=>{
  const f=await fixture();try{
    await fs.mkdir(path.join(f.root,'data'));await fs.writeFile(path.join(f.root,'data/database.json'),'PRIVATE RECORDS');
    await fs.mkdir(path.join(f.root,'public'));await fs.writeFile(path.join(f.root,'public/test.css'),'body{color:green}');
    const first=await f.engine.sync();assert.equal(first.changed,true);
    const listing=await git(['ls-tree','-r','--name-only','main'],f.remote);
    assert.ok(listing.includes('public/test.css'));assert.ok(!listing.includes('data/'));
    await fs.writeFile(path.join(f.root,'server.mjs'),'export const value = 2;\n');
    await fs.rm(path.join(f.root,'public/test.css'));
    const second=await f.engine.sync();assert.equal(second.changed,true);
    assert.equal(await git(['show','main:server.mjs'],f.remote),'export const value = 2;');
    assert.ok(!(await git(['ls-tree','-r','--name-only','main'],f.remote)).includes('public/test.css'));
    assert.equal((await f.engine.sync()).changed,false);
  }finally{await f.clean();}
});
test('Syntax errors stop publication without changing GitHub main',async()=>{
  const f=await fixture();try{
    await f.engine.sync();const before=await git(['rev-parse','main'],f.remote);
    await fs.writeFile(path.join(f.root,'server.mjs'),'export const broken = ;');
    await assert.rejects(()=>f.engine.sync());
    assert.equal(await git(['rev-parse','main'],f.remote),before);
  }finally{await f.clean();}
});
test('Concurrent remote edits are preserved instead of overwritten by local changes',async()=>{
  const f=await fixture();try{
    await f.engine.sync();
    const other=path.join(f.parent,'another checkout');await git(['clone',f.remote,other],f.parent);
    await git(['config','user.name','Other'],other);await git(['config','user.email','other@example.invalid'],other);
    await fs.writeFile(path.join(other,'server.mjs'),'export const value = 50;\n');await git(['add','server.mjs'],other);await git(['commit','-m','Remote change'],other);await git(['push','origin','main'],other);
    await fs.writeFile(path.join(f.root,'server.mjs'),'export const value = 99;\n');
    await assert.rejects(()=>f.engine.sync(),/Both GitHub and this computer changed/);
    assert.equal(await git(['show','main:server.mjs'],f.remote),'export const value = 50;');
  }finally{await f.clean();}
});
test('Credential detection prevents accidentally publishing a private key',async()=>{
  const f=await fixture();try{
    await f.engine.sync();const before=await git(['rev-parse','main'],f.remote);
    await fs.mkdir(path.join(f.root,'public'));await fs.writeFile(path.join(f.root,'public/accident.txt'),'-----BEGIN ' + 'PRIVATE KEY-----\nprivate');
    // Keys in a public text asset must also be rejected, regardless of extension.
    await assert.rejects(()=>f.engine.sync(),/private credential/);
    assert.equal(await git(['rev-parse','main'],f.remote),before);
  }finally{await f.clean();}
});
test('Dry-run validates a real snapshot but makes no remote commit',async()=>{
  const f=await fixture();try{
    const before=await git(['rev-parse','main'],f.remote);await fs.writeFile(path.join(f.root,'server.mjs'),'export const value = 3;\n');
    const result=await f.engine.sync({dryRun:true});assert.equal(result.dryRun,true);assert.equal(await git(['rev-parse','main'],f.remote),before);
  }finally{await f.clean();}
});
