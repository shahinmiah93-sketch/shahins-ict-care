import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REMOTE = 'https://github.com/shahinmiah93-sketch/shahins-ict-care.git';
const OWNER = 'shahinmiah93-sketch';
const QUIET_MS = 15000;
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const exists = p => fs.stat(p).then(() => true, () => false);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const safeError = e => String(e.stderr || e.message || e).replace(/gh[pousr]_[\w]+/g, '[redacted]').slice(-1800);

export async function resolveGit(env = process.env) {
  if(process.platform !== 'win32')return 'git';
  const candidates = [
    env.ICT_GIT_PATH,
    ...(env.Path || env.PATH || '').split(path.delimiter).filter(Boolean).map(p=>path.join(p.replace(/^"|"$/g,''),'git.exe')),
    path.join(env.ProgramFiles || 'C:\\Program Files','Git/cmd/git.exe'),
    path.join(env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)','Git/cmd/git.exe'),
    path.join(env.LOCALAPPDATA || path.join(os.homedir(),'AppData/Local'),'Programs/Git/cmd/git.exe'),
    path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git/cmd/git.exe')
  ].filter(Boolean);
  for(const candidate of candidates) {
    try { if((await fs.stat(candidate)).isFile())return candidate; }catch{}
  }
  throw new Error('Git was not found. Install Git for Windows, or set ICT_GIT_PATH to the full git.exe path.');
}

export function sourceAllowed(relative) {
  const p = relative.replaceAll('\\', '/');
  if (p.split('/').some(s => ['..', '.git', 'data', 'private-backups', 'node_modules', '.wrangler', 'dist', '.online-sync'].includes(s))) return false;
  if (/(^|\/)(?:\.env(?:\..*)?|\.dev\.vars.*|auth\.json|logins\.json|sms\.json|payment\.json|credentials[^/]*|secrets?[^/]*)$/i.test(p)) return false;
  if (/\.(?:tmp|part|log|zip|7z|key|pem|pfx|bak|swp)$/i.test(p)) return false;
  if (!p.includes('/')) return ['.gitignore', 'server.mjs', 'seed.mjs'].includes(p) || /\.(?:md|bat)$/i.test(p);
  if (p.startsWith('public/')) return true;
  if (/^(?:scripts|tests)\/.+\.mjs$/.test(p)) return true;
  if (/^cloudflare\/(?:src|scripts|tests)\/.+\.(?:mjs|js)$/.test(p)) return true;
  return /^cloudflare\/(?:package(?:-lock)?\.json|wrangler\.jsonc|\.gitignore|[^/]+\.md)$/.test(p) || p === 'deploy/setup-vps.sh';
}

export async function snapshot(root) {
  const result = {};
  async function walk(relative = '') {
    const entries = await fs.readdir(path.join(root, relative), { withFileTypes: true });
    for (const entry of entries) {
      const p = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isSymbolicLink()) {
        if (sourceAllowed(p)) throw new Error('Symbolic link is not published: ' + p);
        continue;
      }
      if (entry.isDirectory()) {
        if (['.git','data','private-backups','node_modules','.wrangler','dist','.online-sync'].includes(entry.name)) continue;
        if (['public', 'scripts', 'tests', 'cloudflare', 'deploy'].includes(p) || /^(?:public|scripts|tests)\//.test(p) || /^cloudflare\/(?:src|scripts|tests)(?:\/|$)/.test(p)) await walk(p);
      } else if (entry.isFile() && sourceAllowed(p)) {
        const body = await fs.readFile(path.join(root, p));
        if (body.length > 20 * 1024 * 1024) throw new Error('Source asset exceeds 20 MB: ' + p);
        result[p] = { hash: sha(body), bytes: body.length };
      }
    }
  }
  await walk();
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}
const hashes = snap => Object.fromEntries(Object.entries(snap).map(([p,v]) => [p,v.hash]));
export function changedFiles(previous, current) {
  return [...new Set([...Object.keys(previous), ...Object.keys(current)])].filter(p => previous[p]?.hash !== current[p]?.hash).sort();
}
function checkContent(p, body) {
  const text = body.toString('utf8');
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9_]{30,}|(?:CLOUDFLARE_API_TOKEN|GITHUB_TOKEN)\s*[:=]\s*["'][A-Za-z0-9_-]{25,}["']/.test(text)) throw new Error('Possible private credential; publishing stopped: ' + p);
}
async function command(cmd, args, cwd, extra = {}) {
  try {
    return await exec(cmd, args, { cwd, windowsHide: true, timeout: 180000, maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' }, ...extra });
  } catch (e) { throw new Error(cmd + ' failed: ' + safeError(e)); }
}
async function npmCommand(args, cwd) {
  if (process.platform !== 'win32') return command('npm', args, cwd);
  const found = await command('where.exe', ['npm.cmd'], cwd);
  const npm = found.stdout.trim().split(/\r?\n/)[0];
  const cli = path.join(path.dirname(npm), 'node_modules/npm/bin/npm-cli.js');
  if (!(await exists(cli))) throw new Error('Cannot locate npm CLI next to npm.cmd');
  return command(process.execPath, [cli, ...args], cwd);
}
export async function validateProject(job, changed) {
  for (const p of changed.filter(p => /\.(?:mjs|js)$/.test(p))) {
    if (await exists(path.join(job,p))) await command(process.execPath, ['--check', p], job);
  }
  const cf = path.join(job, 'cloudflare');
  await npmCommand(['ci', '--include=dev', '--no-fund', '--no-audit'], cf);
  await npmCommand(['run', 'build'], cf);
  await npmCommand(['test'], cf);
  if (await exists(path.join(job, 'tests/quiz-regression.mjs'))) await command(process.execPath, ['tests/quiz-regression.mjs'], job);
}

export class SyncEngine {
  constructor(root, { remote = REMOTE, validate = validateProject } = {}) {
    this.root = path.resolve(root);
    this.dir = path.join(this.root, '.online-sync');
    this.mirror = path.join(this.dir, 'mirror.git');
    this.remote = remote;
    this.validate = validate;
    this.stateFile = path.join(this.dir, 'state.json');
  }
  async git(args, cwd = this.root) { return command(await resolveGit(), args, cwd); }
  async readState() { try { return JSON.parse(await fs.readFile(this.stateFile, 'utf8')); } catch { return null; } }
  async writeState(state) {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(this.stateFile + '.tmp', JSON.stringify(state,null,2));
    await fs.rename(this.stateFile + '.tmp', this.stateFile);
  }
  async status(value) {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(path.join(this.dir, 'status.json'), JSON.stringify({ at: new Date().toISOString(), ...value }, null, 2));
  }
  async prepare() {
    await fs.mkdir(this.dir, { recursive: true });
    if (!(await exists(this.mirror))) await this.git(['-c','core.autocrlf=false','clone', '--bare', '--single-branch', '--branch', 'main', this.remote, this.mirror]);
    const configured = (await this.git(['config','--get','remote.origin.url'],this.mirror)).stdout.trim();
    if (configured !== this.remote) throw new Error('Unexpected sync repository; stopped');
    if (!(await this.readState())) {
      const job = await this.job();
      try { await this.writeState({ version:1, local:{}, remote:hashes(await snapshot(job)), lastCommit:null }); }
      finally { await this.removeJob(job); }
    }
  }
  async job() {
    const jobs = path.join(this.dir, 'jobs'); await fs.mkdir(jobs, { recursive:true });
    const job = await fs.mkdtemp(path.join(jobs, 'job-'));
    await this.git(['-c','core.autocrlf=false','clone', '--shared', this.mirror, job]);
    await this.git(['config','core.autocrlf','false'],job);
    await this.git(['remote', 'set-url', 'origin', this.remote], job);
    await this.git(['config','user.name',OWNER],job);
    await this.git(['config','user.email',OWNER+'@users.noreply.github.com'],job);
    return job;
  }
  async removeJob(job) {
    const resolved = path.resolve(job), parent = path.resolve(this.dir, 'jobs') + path.sep;
    if (!resolved.startsWith(parent) || !path.basename(resolved).startsWith('job-')) throw new Error('Unsafe temporary checkout path');
    await fs.rm(resolved, { recursive:true, force:true, maxRetries:3, retryDelay:200 });
  }
  async sync({ dryRun = false } = {}) {
    await this.prepare();
    const state = await this.readState(), local = await snapshot(this.root);
    const changed = changedFiles(state.local, local);
    if (!changed.length) return { changed:false, commit:state.lastCommit };
    await this.status({ phase:'checking', files:changed.length, message:'Checking saved source files before publishing' });
    await this.git(['fetch','origin','main'],this.mirror);
    const head = (await this.git(['rev-parse','FETCH_HEAD'],this.mirror)).stdout.trim();
    await this.git(['update-ref','refs/heads/main',head],this.mirror);
    const job = await this.job();
    try {
      const remote = hashes(await snapshot(job));
      for (const p of changed) {
        if (!sourceAllowed(p)) throw new Error('Private path rejected: ' + p);
        const previous = state.remote[p] || null, now = remote[p] || null, wanted = local[p]?.hash || null;
        if (now !== previous && now !== wanted) throw new Error('Both GitHub and this computer changed ' + p + '. Resolve the difference first.');
      }
      for (const p of changed) {
        const target = path.join(job,p);
        if (local[p]) {
          const data = await fs.readFile(path.join(this.root,p));
          if (sha(data) !== local[p].hash) throw new Error('Files are still being saved; will check again');
          checkContent(p,data);
          await fs.mkdir(path.dirname(target), { recursive:true }); await fs.writeFile(target,data);
        } else await fs.rm(target, { force:true });
      }
      await this.validate(job, changed);
      if (dryRun) {
        await this.status({ phase:'ready', files:changed.length, message:'Validation passed. No commit or push was made.' });
        return { changed:true, dryRun:true, files:changed };
      }
      if (await exists(path.join(this.dir,'stop-requested'))) throw new Error('Auto update stopped before publishing');
      await this.git(['add','-A','--',...changed],job);
      const staged = (await this.git(['diff','--cached','--name-only','-z'],job)).stdout.split('\0').filter(Boolean);
      if (staged.some(p => !sourceAllowed(p))) throw new Error('A private or generated path reached staging; stopped');
      if (staged.length) {
        const message = 'Auto update website (' + staged.length + ' files)';
        await this.git(['commit','-m',message],job);
        await this.status({ phase:'pushing', files:staged.length, message:'Sending validated source to GitHub' });
        // No force push: a concurrent GitHub update is rejected and reviewed next time.
        await this.git(['push','origin','HEAD:refs/heads/main'],job);
      }
      const commit = (await this.git(['rev-parse','HEAD'],job)).stdout.trim();
      state.local = local;
      for (const p of changed) state.remote[p] = local[p]?.hash || null;
      state.lastCommit = commit; state.lastPush = new Date().toISOString();
      await this.writeState(state);
      await this.status({ phase:staged.length?'github-updated':'up-to-date', commit, files:staged.length,
        message:staged.length?'GitHub updated. Cloudflare will build and deploy automatically.':'Source matches GitHub.' });
      return { changed:!!staged.length, commit, files:staged };
    } finally { await this.removeJob(job); }
  }
}

async function currentStatus(engine) {
  let s; try { s = JSON.parse(await fs.readFile(path.join(engine.dir,'status.json'),'utf8')); } catch { s={ message:'Auto update has not been set up yet.' }; }
  let running=false; try { const pid=Number(await fs.readFile(path.join(engine.dir,'watch.pid'),'utf8'));process.kill(pid,0);running=true; }catch{}
  console.log('Watcher:',running?'RUNNING':'STOPPED'); console.log(JSON.stringify(s,null,2));
  const state = await engine.readState();
  if (state?.lastCommit && engine.remote === REMOTE) {
    try {
      const u='https://api.github.com/repos/'+OWNER+'/shahins-ict-care/commits/'+state.lastCommit+'/check-runs';
      const r=await fetch(u,{headers:{accept:'application/vnd.github+json'}});const j=await r.json();
      const check=j.check_runs?.find(c=>c.name.includes('Workers Builds'));
      if(check) console.log('Cloudflare:',check.conclusion || check.status,check.details_url);
    }catch{console.log('Cloudflare status temporarily unavailable.');}
  }
}
async function start(engine) {
  await fs.mkdir(engine.dir,{recursive:true});
  if(!(await engine.readState())?.activated) throw new Error('Run Setup Auto Online Update.bat once to complete GitHub sign-in and activate publishing.');
  try { const pid=Number(await fs.readFile(path.join(engine.dir,'watch.pid'),'utf8'));process.kill(pid,0);console.log('Auto update is already running.');return; }catch{}
  await fs.rm(path.join(engine.dir,'stop-requested'),{force:true});
  const log=await fs.open(path.join(engine.dir,'watch.log'),'a');
  const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'watch'],{cwd:ROOT,detached:true,windowsHide:true,stdio:['ignore',log.fd,log.fd]});
  child.unref(); await log.close();
  console.log('Auto update started in the background.');
}
async function watch(engine) {
  await fs.mkdir(engine.dir,{recursive:true});
  const pidFile=path.join(engine.dir,'watch.pid');
  try {
    const handle=await fs.open(pidFile,'wx');await handle.writeFile(String(process.pid));await handle.close();
  }catch{
    try{process.kill(Number(await fs.readFile(pidFile,'utf8')),0);return;}catch{await fs.rm(pidFile,{force:true});return watch(engine);}
  }
  let signature='',stableSince=Date.now(),lastAttempt='',lastAttemptAt=0;
  try {
    await engine.prepare();
    console.log(new Date().toISOString(),'Watching',ROOT);
    while(!(await exists(path.join(engine.dir,'stop-requested')))) {
      try {
        const s=JSON.stringify(await snapshot(ROOT));
        if(s!==signature){signature=s;stableSince=Date.now();}
        if(Date.now()-stableSince>=QUIET_MS && (lastAttempt!==signature || Date.now()-lastAttemptAt>=120000)) {
          lastAttempt=signature;lastAttemptAt=Date.now();
          const result=await engine.sync();
          if(result.changed)console.log(new Date().toISOString(),'Pushed',result.commit);
        }
      }catch(e){await engine.status({phase:'error',message:safeError(e)});console.error(new Date().toISOString(),safeError(e));}
      await sleep(2500);
    }
    await engine.status({phase:'stopped',message:'Auto update stopped by owner.'});
  }catch(e){await engine.status({phase:'error',message:safeError(e)});throw e;}
  finally{await fs.rm(pidFile,{force:true});}
}
async function enableStartup() {
  if(process.platform!=='win32')return;
  const dir=path.join(process.env.APPDATA,'Microsoft/Windows/Start Menu/Programs/Startup');await fs.mkdir(dir,{recursive:true});
  const file=path.join(dir,'Shahins ICT Auto Online Update.cmd');
  const marker='rem Managed by Shahins ICT auto online update';
  if(await exists(file) && !(await fs.readFile(file,'utf8')).includes(marker))throw new Error('Startup shortcut already exists and is not owned by this tool');
  const text=`@echo off\r\n${marker}\r\n"${process.execPath}" "${fileURLToPath(import.meta.url)}" start\r\n`;
  if(await exists(file) && await fs.readFile(file,'utf8')===text)return;
  await fs.writeFile(file,text);
  console.log('Enabled auto update when you sign in to Windows.');
}
async function disableStartup() {
  if(process.platform!=='win32')return;
  const file=path.join(process.env.APPDATA,'Microsoft/Windows/Start Menu/Programs/Startup/Shahins ICT Auto Online Update.cmd');
  if(await exists(file) && (await fs.readFile(file,'utf8')).includes('rem Managed by Shahins ICT auto online update')) await fs.rm(file);
}
async function main() {
  const engine=new SyncEngine(ROOT), action=process.argv[2] || 'status';
  if(action==='prepare'){await engine.prepare();console.log('Sync checkout prepared. No files pushed.');}
  else if(action==='probe'){
    const git=await resolveGit();console.log('Git:',git);console.log((await command(git,['--version'],ROOT)).stdout.trim());
    console.log((await command(git,['credential-manager','--version'],ROOT)).stdout.trim());
  }
  else if(action==='check')console.log(await engine.sync({dryRun:true}));
  else if(action==='setup'){
    console.log('One-time GitHub sign-in for automatic Git pushes. Follow the official GitHub device login instructions below.');
    const child=spawn(await resolveGit(),['credential-manager','github','login','--device','--username',OWNER],{stdio:'inherit',windowsHide:true});
    await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',c=>c===0?resolve():reject(new Error('GitHub sign-in was not completed')));});
    await fs.rm(path.join(engine.dir,'stop-requested'),{force:true});
    console.log(await engine.sync());
    const state=await engine.readState();state.activated=true;await engine.writeState(state);
    await enableStartup(); await start(engine);
  }
  else if(action==='start'){
    if(!(await engine.readState())?.activated)throw new Error('Run Setup Auto Online Update.bat once first.');
    await enableStartup();await start(engine);
  }
  else if(action==='watch')await watch(engine);
  else if(action==='once')console.log(await engine.sync());
  else if(action==='stop'){await fs.mkdir(engine.dir,{recursive:true});await fs.writeFile(path.join(engine.dir,'stop-requested'),'stop');await disableStartup();console.log('Stop requested; Windows auto-start disabled. No new publish will start.');}
  else if(action==='status')await currentStatus(engine);
  else throw new Error('Unknown command');
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(safeError(e));process.exitCode=1;});
