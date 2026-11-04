import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
test('Student book ledger includes only their own sales and matches the admin due calculation',()=>{
  const sale={id:'own',studentId:'s1',saleNo:1001,date:'2026-10-01',name:'Private name',phone:'private phone',note:'private note',subtotal:600,discount:100,delivery:50,total:550,lines:[{bookId:'b1',title:'Test sheet',kind:'sheet',qty:2,price:300}],payments:[{id:'pay1',amount:200,date:'2026-10-01',method:'Cash',note:'private'}]};
  const ctx={num:v=>Number(v)||0,db:{bookSales:[sale,{...sale,id:'other',studentId:'s2'},{...sale,id:'outside',studentId:'',phone:'private phone'},{...sale,id:'free',saleNo:1002,studentId:'s1',free:true,total:0,subtotal:600,discount:600,payments:[]}]}};
  vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('const salePaid ='),source.indexOf('const nextNo =')),ctx);
  let account=ctx.studentBookAccount('s1');assert.equal(account.items.length,2);assert.equal(account.total,550);assert.equal(account.paid,200);assert.equal(account.balance,350);assert.equal(account.items[0].id,'free');
  for(const row of account.items){assert.equal(row.phone,undefined);assert.equal(row.name,undefined);assert.equal(row.note,undefined);for(const p of row.payments){assert.equal(p.id,undefined);assert.equal(p.note,undefined);}}
  sale.payments.push({amount:350,date:'2026-11-04',method:'Cash'});account=ctx.studentBookAccount('s1');assert.equal(account.balance,0);assert.equal(account.paid,550);
  ctx.db.bookSales=ctx.db.bookSales.filter(s=>s.id!=='own');assert.equal(ctx.studentBookAccount('s1').balance,0);assert.equal(ctx.studentBookAccount('missing').items.length,0);
});
