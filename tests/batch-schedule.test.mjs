import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const root = new URL('../', import.meta.url);
for (const file of ['server.mjs', 'public/js/common.js']) {
  const source = fs.readFileSync(new URL(file, root), 'utf8');
  const begin = source.indexOf('function parseBatchTime(');
  const end = source.indexOf('\n}', source.indexOf('function compareBatchSchedule(', begin)) + 2;
  const context = vm.createContext({});
  vm.runInContext(source.slice(begin, end), context);
  test(`${file}: Bengali times sort chronologically across day groups and preserve batch identities`, () => {
    const entries = [
      ['27-J','শনি, সোম, বুধ','দুপুর ১:০০'], ['27-D','','বিকাল ৪:০০'],
      ['27-F','','দুপুর ১২:০০'], ['27-C','','সকাল ১১:০০'],
      ['27-B','','সকাল ৯:০০'], ['27-A','','সকাল ৭:০০'],
      ['27-E','','সকাল ৮:০০'], ['27-G','','দুপুর ১:০০'], ['27-H','','দুপুর ২:০০'],
      ['27-X','',''], ['27-N','','রাত ৯:৩০']
    ].map(([name,days,time]) => ({id:name,session:'HSC-27',name,days,time}));
    const sorted = [...entries].sort(context.compareBatchSchedule);
    assert.deepEqual(sorted.map(b=>b.name), ['27-A','27-E','27-B','27-C','27-F','27-G','27-J','27-H','27-D','27-N','27-X']);
    assert.equal(context.parseBatchTime('সকাল ৭:৩০').minutes,450);
    assert.equal(context.parseBatchTime('দুপুর ১২:০০').minutes,720);
    assert.equal(context.parseBatchTime('রাত ১২:০০').minutes,0);
    assert.equal(context.parseBatchTime('বিকেল ৪:১৫').minutes,975);
    assert.equal(context.parseBatchTime('16:15').minutes,975);
    assert.equal(context.parseBatchTime('সময় পরে জানানো হবে'),null);
    assert.equal(context.parseBatchTime('সকাল ৭:৯৯'),null);
    assert.equal(entries[0].name,'27-J');
  });
}
test('Batch form preselects old time, saves chosen time and retains legacy schedules', async () => {
  const common = fs.readFileSync(new URL('public/js/common.js',root),'utf8');
  const helper = common.slice(common.indexOf('function parseBatchTime('),common.indexOf('function compareBatchSchedule('));
  const source=fs.readFileSync(new URL('public/js/admin.js',root),'utf8');
  const form=source.slice(source.indexOf('  function batchForm('),source.indexOf('  function sessionForm('));
  let config, saved;
  const ctx=vm.createContext({U:{},DB:{batches:[]},bn:v=>String(v).replace(/\d/g,d=>'০১২৩৪৫৬৭৮৯'[d]),sessionOptions:()=>[],openForm:c=>{config=c},save:async(type,data,id)=>{saved={type,data,id}},load:async()=>{},route:()=>{},toast:()=>{}});
  vm.runInContext(helper+'U.parseBatchTime=parseBatchTime;'+form,ctx);
  ctx.batchForm({id:'b1',session:'HSC-27',name:'27-J',time:'দুপুর ১:০০',active:true});
  assert.equal(config.values.timePeriod,'দুপুর');assert.equal(config.values.timeHour,'1');
  const base={session:'HSC-27',name:'27-J',days:'শনি, সোম, বুধ',capacity:15,timePeriod:'সকাল',timeHour:'8',timeMinute:'30'};
  await config.onSave(base);
  assert.equal(saved.data.time,'সকাল ৮:৩০');assert.equal(saved.id,'b1');assert.equal(saved.data.name,'27-J');
  assert(!('timePeriod' in saved.data));
  await assert.rejects(config.onSave({...base,timeHour:''}),/ঘণ্টা/);
  await assert.rejects(config.onSave({...base,timePeriod:''}),/বাছুন/);
  ctx.batchForm({id:'old',name:'27-K',time:'পরে জানানো হবে'});
  assert.equal(config.values.timePeriod,'__legacy');
  await config.onSave({...base,timePeriod:'__legacy'});
  assert.equal(saved.data.time,'পরে জানানো হবে');
});
