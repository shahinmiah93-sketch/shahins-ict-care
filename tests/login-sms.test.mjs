import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
function sms(responses) {
  const calls=[],logs=[];let serial=0;
  const ctx={db:{smsLog:logs,settings:{name:'Fixture School'}},smsCfg:{apiKey:'fixture-api-key',senderId:'fixture-sender'},smsOn:()=>true,SMS_BASE:'https://sms.fixture.invalid/api',URLSearchParams,AbortSignal,Date,
    uid:()=> 's'+(++serial),today:()=> '2026-11-04',str:(v,max=500)=>String(v??'').trim().slice(0,max),phoneOf:v=>String(v||'').replace(/\D/g,''),setTimeout:fn=>{fn();return 0},
    fetch:async(url,options)=>{calls.push({url,options});const response=responses.shift();if(response instanceof Error)throw response;return {ok:response.httpOK!==false,json:async()=>{if(response.badJson)throw new Error('Bad JSON');return response.body}}}
  };
  vm.createContext(ctx);
  vm.runInContext(source.slice(source.indexOf('const SMS_CODES ='),source.indexOf('// OTP:'))+'\n'+source.slice(source.indexOf('const smsBrand ='),source.indexOf('// ফলাফলের SMS:'))+'\nthis.smsStudentLogin = smsStudentLogin;',ctx);
  return {ctx,calls,logs,student:()=>({id:'270001',pin:'1234',phone:'01700000001',guardianPhone:''})};
}
test('First admission submits once by uncached POST, returns submitted status and never puts credentials in URL/logs',async()=>{
  const a=sms([{body:{response_code:202,message_id:'fixture-reference'}}]);const student=a.student(),result=await a.ctx.smsStudentLogin(student);
  assert.equal(result.ok,true);assert.equal(result.status,'submitted');assert.equal(result.attempts,1);assert.equal(result.messageId,'fixture-reference');assert.equal(a.calls.length,1);
  const {url,options}=a.calls[0];assert.equal(url,'https://sms.fixture.invalid/api/smsapi');assert.equal(options.method,'POST');assert.equal(options.cache,'no-store');
  const body=new URLSearchParams(options.body);assert.equal(body.get('api_key'),'fixture-api-key');assert.equal(body.get('number'),'8801700000001');assert(body.get('message').includes('PIN: 1234'));
  assert(!JSON.stringify(a.logs).includes('1234'));assert(!JSON.stringify(a.logs).includes('fixture-api-key'));
});
test('Explicit temporary rejection retries once before returning admission SMS result',async()=>{
  const a=sms([{body:{response_code:1005}},{body:{response_code:'202'}}]);const result=await a.ctx.smsStudentLogin(a.student());
  assert.equal(result.ok,true);assert.equal(result.attempts,2);assert.equal(a.calls.length,2);assert.equal(a.logs[0].status,'rejected');assert.equal(a.logs[1].status,'submitted');
});
test('Accepted SMS, invalid credentials, balance errors, ambiguous network errors and invalid responses are never blindly resent',async()=>{
  for(const response of [{body:{response_code:202}},{body:{response_code:1011}},{body:{response_code:1007}},new Error('Network timeout'),{badJson:true},{body:{response_code:202},httpOK:false}]){
    const a=sms([response]);const result=await a.ctx.smsStudentLogin(a.student());assert.equal(a.calls.length,1);
    if(response.body?.response_code!==202 || response.httpOK===false)assert.equal(result.ok,false);
    if(response instanceof Error || response.badJson || response.httpOK===false)assert.equal(result.status,'unknown');
  }
});
test('Both rejected attempts are recorded and no third request is issued; missing number does not call provider',async()=>{
  const a=sms([{body:{response_code:1005}},{body:{response_code:1005}}]);assert.equal((await a.ctx.smsStudentLogin(a.student())).ok,false);assert.equal(a.calls.length,2);
  const b=sms([]);const student=b.student();student.phone='';assert.equal((await b.ctx.smsStudentLogin(student)).ok,false);assert.equal(b.calls.length,0);
});
test('Concurrent login SMS requests share the same in-flight submission',async()=>{
  const a=sms([{body:{response_code:202}}]);const s=a.student();const [first,second]=await Promise.all([a.ctx.smsStudentLogin(s),a.ctx.smsStudentLogin(s)]);
  assert.equal(a.calls.length,1);assert.equal(first.status,'submitted');assert.equal(second.status,'submitted');
});
test('OTP logs still mask verification codes',async()=>{
  const a=sms([{body:{response_code:202}}]);await a.ctx.sendSms('01700000001','Your code is 765432.');assert(!JSON.stringify(a.logs).includes('765432'));
});
test('Admission screen reports submission accurately and guards concurrent resend clicks',async()=>{
  const admin=fs.readFileSync(new URL('../public/js/admin.js',import.meta.url),'utf8');let finish,calls=0;
  const button={disabled:false,textContent:'আবার SMS পাঠান'},note={textContent:''};
  const ctx={$$:()=>[button],toast:()=>{},api:()=>{calls++;return new Promise(resolve=>{finish=resolve})}};vm.createContext(ctx);
  vm.runInContext(admin.slice(admin.indexOf('  function loginSmsNote('),admin.indexOf('  const formExtra =')),ctx);
  const student={id:'fixture'};const first=ctx.resendLogin(student,note),second=ctx.resendLogin(student,note);
  assert.equal(calls,1);assert.equal(button.disabled,true);finish({loginSms:{ok:true,status:'submitted',phone:'fixture-number'}});await Promise.all([first,second]);
  assert.equal(button.disabled,false);assert(note.textContent.includes('গেটওয়ে গ্রহণ করেছে'));assert(!note.textContent.includes('SMS-এ গেছে'));
});
