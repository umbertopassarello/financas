const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function setup(){
  const context=vm.createContext({DATA:{},BANKS:{nubank:{l:'Nubank',c:'b-nubank'}}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/transactions.js'),'utf8'),context);
  return context;
}
const expense=(id,valor,card,status='pendente')=>({id,tipo:'SAÍDA',valor,desc:'Compra',categoria:'Casa',data:'2026-11-08',formaPagamento:'credito',cartao:card,status});

test('multiple cards match with OR; status, category and dates combine with AND',()=>{
  const c=setup();
  c.txs=[expense('a',100,'nubank'),expense('b',200,'inter'),expense('c',300,'nubank','pago'),expense('d',400,'santander')];
  c.filters={cartao:new Set(['nubank','inter']),status:new Set(['pendente']),categoria:new Set(['Casa']),from:'2026-11-01',to:'2026-11-30'};
  assert.equal(JSON.stringify(c.filterTransactions(c.txs,c.filters).map(t=>t.id)),JSON.stringify(['a','b']));
  c.filters.from='2026-11-09';
  assert.equal(c.filterTransactions(c.txs,c.filters).length,0);
});

test('filtered totals retain paid purchases on the selected card and handle zero results',()=>{
  const c=setup();
  const txs=[expense('a',100,'nubank'),expense('b',50,'nubank','pago'),expense('c',200,'inter')];
  const filtered=c.filterTransactions(txs,{cartao:new Set(['nubank'])});
  const total=c.transactionTotals(filtered);
  assert.equal(total.gastos,150);assert.equal(total.pagos,50);assert.equal(total.pendentes,100);assert.equal(total.saldo,-150);
  assert.equal(c.transactionTotals(txs).gastos,350);
  assert.equal(c.transactionTotals([]).gastos,0);
});

test('totals include income, withdrawals and investments with numeric string values',()=>{
  const c=setup();
  const total=c.transactionTotals([{tipo:'ENTRADA',valor:'1000'},{tipo:'RESGATE',valor:100},{tipo:'INVESTIMENTOS',valor:200},expense('a',300,'nubank')]);
  assert.equal(total.saldo,600);assert.equal(total.investimentos,200);assert.equal(total.resgates,100);
});

test('legacy payment inference does not modify existing records',()=>{
  const c=setup();
  const old={banco:'nubank'},paid={banco:'pago'};
  assert.equal(c.paymentInfo(old).method,'credito');assert.equal(c.paymentInfo(old).status,'pendente');
  assert.equal(c.paymentInfo(paid).method,'nao_informado');assert.equal(c.paymentInfo(paid).status,'pago');
  assert.deepEqual(old,{banco:'nubank'});assert.deepEqual(paid,{banco:'pago'});
});

test('bulk payment preserves cards, skips other methods and is idempotent',()=>{
  const c=setup();
  const txs=[{id:'legacy',tipo:'SAÍDA',banco:'nubank',valor:10},expense('paid',50,'nubank','pago'),expense('other',60,'inter'),{...expense('debit',20,'nubank'),formaPagamento:'debito'}, {...expense('income',30,'nubank'),tipo:'ENTRADA'}];
  assert.equal(c.markCardInvoicesPaid(txs,['nubank']),1);
  assert.equal(txs[0].banco,'nubank');assert.equal(txs[0].cartao,'nubank');assert.equal(txs[0].status,'pago');
  assert.equal(txs[2].status,'pendente');assert.equal(txs[3].status,'pendente');assert.equal(txs[4].status,'pendente');
  assert.equal(c.markCardInvoicesPaid(txs,['nubank']),0);
  assert.equal(c.filterTransactions(txs,{cartao:new Set(['nubank']),status:new Set(['pago'])}).length,2);
});

test('payment badges support unknown cards and escape custom labels',()=>{
  const c=setup();c.DATA.customBanks={custom:'<Custom>'};
  assert.match(c.paymentBadges(expense('a',1,'custom')), /&lt;Custom&gt;/);
  assert.match(c.paymentBadges(expense('b',1,'unknown')), /unknown/);
});

test('editing a legacy expense to paid keeps its card and additional saved fields',async()=>{
  const c=setup();
  const existing={id:'legacy',tipo:'SAÍDA',valor:75,banco:'nubank',notes:'Keep this',desc:'Compra',categoria:'Casa'};
  const month={transactions:[existing],resumo:{saldoAnterior:20}};
  const values={lTipo:'SAÍDA',lDesc:'Compra',lValor:'75',lCat:'Casa',lMov:'Fixo',lForma:'credito',lBanco:'nubank',lStatus:'pago',lData:'2026-11-08',fSearch:'',fDe:'',fAte:''};
  const nodes=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{value}]));
  c.document={addEventListener(){},querySelectorAll:()=>[],getElementById:id=>nodes[id]||(nodes[id]={innerHTML:'',textContent:''})};
  c.DATA.currentMonth=10;c.DATA.investSaldo=0;c.MK=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  c.MONTHS=Array(12).fill('Novembro');c.editingLancId='legacy';
  c.getYearData=()=>({months:{nov:month}});c.closeModal=()=>{};
  c.brl=value=>'R$ '+Number(value).toFixed(2);
  let saved;
  c.saveData=async()=>{saved=JSON.parse(JSON.stringify(month));};
  c.alert=message=>{throw Error(message);};
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/pages/lancamentos.js'),'utf8'),c);
  // The fake DOM skips only construction of the checkbox dropdowns.
  c.renderLancFilters=()=>{};
  await c.salvarLanc();
  assert.equal(saved.transactions[0].status,'pago');
  assert.equal(saved.transactions[0].cartao,'nubank');
  assert.equal(saved.transactions[0].banco,'nubank');
  assert.equal(saved.transactions[0].notes,'Keep this');
  assert.match(nodes.lancSummary.innerHTML,/R\$ -55.00/);
  assert.match(nodes.lancFilteredSummary.innerHTML,/R\$ -75.00/);
  assert.match(nodes.lancPaymentSummary.textContent,/Gastos pagos: R\$ 75.00/);
});
