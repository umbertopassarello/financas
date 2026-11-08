const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'../js',file),'utf8');
function setup(){let id=0;const c=vm.createContext({DATA:{currentYear:2026,currentMonth:10,obligations:[]},MK:['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'],BANKS:{},uuid:()=>String(++id)});vm.runInContext(read('transactions.js')+read('household.js')+read('charts.js'),c);return c;}
test('numeric and alphabetical sorting do not mutate the original transactions',()=>{
  const c=setup(),txs=[{desc:'Zebra',valor:20},{desc:'Água',valor:'100'},{desc:'Banco',valor:3}];
  assert.equal(c.sortTransactions(txs,'valor','desc')[0].valor,'100');
  assert.equal(c.sortTransactions(txs,'desc','asc')[0].desc,'Água');
  assert.equal(c.sortTransactions(txs,'valor','asc')[0].valor,3);
  assert.equal(txs[0].desc,'Zebra');
});
test('a 500 share minus 100 paid personally results in 400 debt',()=>{
  const c=setup();
  const totals=c.houseTotals([{valor:100,divisao:3,payer:'eu',paymentStatus:'pago',paidAmount:100},{valor:1400,divisao:3,payer:'outro',paymentStatus:'pendente'}]);
  assert.equal(totals.share,500);assert.equal(totals.debt,400);assert.equal(totals.credit,0);
});
test('planned payments and other people payments do not count as personal advances',()=>{
  const c=setup(),totals=c.houseTotals([{valor:300,divisao:3,payer:'eu',paymentStatus:'pendente',paidAmount:300},{valor:300,divisao:3,payer:'outro',paymentStatus:'pago',paidAmount:300}]);
  assert.equal(totals.debt,200);assert.equal(totals.paid,0);
});
test('partial payments and overpayments produce an accurate credit',()=>{
  const c=setup(),totals=c.houseTotals([{valor:300,divisao:3,payer:'eu',paymentStatus:'pago',paidAmount:150}]);
  assert.equal(totals.debt,0);assert.equal(totals.credit,50);
});
test('copy resets payments, assigns distinct IDs and leaves original records untouched',()=>{
  const c=setup(),source=[{id:'old',valor:300,payer:'eu',paymentStatus:'pago',paidAmount:300}],copy=c.copyHouseItems(source);
  assert.notEqual(copy[0].id,'old');assert.equal(copy[0].paymentStatus,'pendente');assert.equal(copy[0].paidAmount,0);
  assert.equal(source[0].paymentStatus,'pago');assert.equal(c.houseTotals(copy).paid,0);
});
test('category series includes all categories and numeric values',()=>{
  const c=setup(),txs=Array.from({length:12},(_,i)=>({tipo:'SAÍDA',categoria:'C'+i,valor:'10'}));
  txs.push({tipo:'ENTRADA',categoria:'Entrada',valor:1000});
  const series=c.categorySeries(txs);assert.equal(series.length,12);assert.equal(series.reduce((s,[,v])=>s+v,0),120);
});
test('bulk deletion affects only selected visible and unlinked records',async()=>{
  const c=setup(),month={transactions:[{id:'a'},{id:'hidden'},{id:'generated',obligationId:'x'},{id:'source'}]};
  c.DATA.obligations=[{sourceId:'source',sourceYear:2026,sourceMonth:'nov'}];
  c.document={addEventListener(){}};c.confirm=()=>true;c.getYearData=()=>({months:{nov:month}});
  c.persistPlanningChange=async change=>{change();return true;};
  vm.runInContext(read('pages/lancamentos.js'),c);c.renderLanc=()=>{};
  vm.runInContext("visibleLancIds=['a','generated','source'];selectedLancIds=new Set(['a','hidden','generated','source']);",c);
  await c.deleteSelectedLanc();
  assert.deepEqual(month.transactions.map(t=>t.id),['hidden','generated','source']);
});
