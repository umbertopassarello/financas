const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'../js/',file),'utf8');
function setup(){
  let id=0;
  const MK=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const months=()=>Object.fromEntries(MK.map(m=>[m,{transactions:[]} ]));
  const DATA={currentYear:2026,currentMonth:10,investSaldo:900,years:{2025:{months:months()},2026:{months:months()}},customCats:['Preservar'],obligations:[]};
  const context=vm.createContext({DATA,MK,uuid:()=>String(++id),saveData:async()=>true,alert(){}});
  vm.runInContext(read('planning.js'),context);
  return context;
}
test('partial receipts create one income in its date and preserve the original year and investment balance',()=>{
  const c=setup();
  const item={id:'r',kind:'receivable',description:'Empresa',amount:200,payments:[]};
  c.DATA.years[2025].months.dez.transactions.push({id:'expense',tipo:'SAÍDA',valor:200});
  c.registerSettlement(item,75,'2026-11-08');
  assert.equal(c.pendingRemaining(item),125);
  assert.equal(c.DATA.years[2026].months.nov.transactions.length,1);
  assert.equal(c.DATA.years[2026].months.nov.transactions[0].tipo,'ENTRADA');
  assert.equal(c.DATA.years[2025].months.dez.transactions[0].valor,200);
  assert.equal(c.DATA.investSaldo,900);
  c.registerSettlement(item,125,'2026-12-01');assert.equal(c.pendingRemaining(item),0);
  assert.throws(()=>c.registerSettlement(item,1,'2026-12-01'),/supera/);
});
test('investment replacements and reversals preserve manual balance and remove only generated transactions',()=>{
  const c=setup(),item={id:'i',kind:'investment',description:'Emergência',amount:100,payments:[]};
  const payment=c.registerSettlement(item,30,'2026-11-08');
  c.DATA.years[2026].months.nov.transactions.push({id:'unrelated'});
  assert.equal(c.DATA.years[2026].months.nov.transactions[0].tipo,'INVESTIMENTOS');
  assert.equal(c.pendingRemaining(item),70);
  c.reverseSettlement(item,payment.id);
  assert.equal(c.pendingRemaining(item),100);
  assert.equal(c.DATA.years[2026].months.nov.transactions[0].id,'unrelated');
  assert.equal(c.DATA.investSaldo,900);
});
test('invalid dates, missing years and excess or negative payments do not alter any data',()=>{
  const c=setup(),item={id:'r',kind:'receivable',amount:100,payments:[]},before=JSON.stringify(c.DATA);
  for(const [amount,date] of [[101,'2026-11-08'],[-1,'2026-11-08'],[0,'2026-11-08'],[10,'2026-02-30'],[10,'2027-01-01']]){
    assert.throws(()=>c.registerSettlement(item,amount,date));
  }
  assert.equal(JSON.stringify(c.DATA),before);assert.equal(item.payments.length,0);
});
test('source links cannot be registered twice',()=>{
  const c=setup();
  c.saveObligation({id:'a',kind:'receivable',sourceId:'t',sourceMonth:'nov',sourceYear:2026});
  assert.throws(()=>c.saveObligation({id:'b',kind:'receivable',sourceId:'t',sourceMonth:'nov',sourceYear:2026}),/já possui/);
  assert.equal(c.DATA.obligations.length,1);
});
test('calendar respects leap years and excludes other months and transaction types',()=>{
  const c=setup();
  const days=c.calendarDays(2024,1,[{tipo:'SAÍDA',valor:10,data:'2024-02-29'},{tipo:'SAÍDA',valor:20,data:'2024-03-01'},{tipo:'ENTRADA',valor:30,data:'2024-02-29'}]);
  assert.equal(days.length,29);assert.equal(days[28].total,10);assert.equal(days[28].items.length,1);
  assert.equal(c.calendarDays(2025,1,[]).length,28);
});
test('failed persistence rolls back a receipt and its linked transaction',async()=>{
  const c=setup();
  c.DATA.obligations.push({id:'r',kind:'receivable',amount:100,payments:[]});
  const before=JSON.stringify(c.DATA);c.saveData=async()=>false;
  const success=await c.persistPlanningChange(()=>c.registerSettlement(c.DATA.obligations[0],50,'2026-11-08'));
  assert.equal(success,false);assert.equal(JSON.stringify(c.DATA),before);
});
test('request options keep authentication headers and allow empty write responses',async()=>{
  let request;
  const c=vm.createContext({fetch:async(url,opts)=>{request=opts;return {ok:true,text:async()=>''};}});
  vm.runInContext(read('config.js'),c);
  await vm.runInContext("sb('financial_data',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'}})",c);
  assert.ok(request.headers.apikey);assert.ok(request.headers.Authorization);
  assert.equal(request.headers['Content-Type'],'application/json');
  assert.equal(request.headers.Prefer,'resolution=merge-duplicates');
});

test('manual balance can reset to zero without clearing history, years or obligations',async()=>{
  const c=setup();
  c.DATA.obligations=[{id:'keep',kind:'investment',amount:200}];
  const years=JSON.stringify(c.DATA.years);
  c.document={getElementById:()=>({value:'0'})};c.closeModal=()=>{};
  vm.runInContext(read('pages/investimentos.js'),c);c.renderInvest=()=>{};
  await c.submitInvestmentBalance({preventDefault(){}});
  assert.equal(c.DATA.investSaldo,0);
  assert.equal(c.DATA.investBalanceHistory[0].previous,900);
  assert.equal(c.DATA.obligations[0].amount,200);
  assert.equal(JSON.stringify(c.DATA.years),years);
});

test('creating, editing and deleting investment transactions leave the manual balance intact',async()=>{
  const c=setup();
  const values={lTipo:'INVESTIMENTOS',lDesc:'Aporte',lValor:'100',lCat:'Investimentos',lMov:'Variável',lForma:'nao_informado',lBanco:'',lStatus:'pago',lData:'2026-11-08'};
  c.document={addEventListener(){},getElementById:id=>({value:values[id]})};
  c.editingLancId=null;c.getYearData=()=>c.DATA.years[2026];c.closeModal=()=>{};c.confirm=()=>true;
  vm.runInContext(read('transactions.js'),c);
  vm.runInContext(read('pages/lancamentos.js'),c);c.renderLanc=()=>{};
  await c.salvarLanc();
  const tx=c.DATA.years[2026].months.nov.transactions[0];
  assert.equal(c.DATA.investSaldo,900);
  c.editingLancId=tx.id;values.lTipo='RESGATE';values.lValor='50';
  await c.salvarLanc();assert.equal(c.DATA.investSaldo,900);
  await c.delLanc(tx.id);assert.equal(c.DATA.investSaldo,900);
  assert.equal(c.DATA.years[2026].months.nov.transactions.length,0);
});
