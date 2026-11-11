const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const nodes={};const c=vm.createContext({DATA:{currentYear:2026,currentMonth:10,years:{2026:{months:{nov:{transactions:[]},dez:{transactions:[]}}}},obligations:[],cardDueDays:{nubank:15},investSaldo:99999,metas:[{atual:500}]},MK:['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'],MONTHS:[],BANKS:{nubank:{l:'Nubank'}},document:{getElementById:id=>nodes[id]??={value:id==='cashHorizon'?'30':'',checked:false,style:{},addEventListener(){}}},saveData:async()=>true,confirm:()=>true,alert(){},brl:v=>String(v)});
 for(const file of ['transactions.js','planning.js','pages/agenda.js','pages/caixa.js'])vm.runInContext(fs.readFileSync('js/'+file,'utf8'),c);
 c.localDate=()=> '2026-11-10';const checkpoint=(value=100000)=>c.DATA.cashCheckpoint={balanceCents:value,settledCents:c.cashSettledCents(),date:'2026-11-10'};
 return {c,nodes,month:c.DATA.years[2026].months.nov,checkpoint};
}
const tx=(id,extra={})=>({id,tipo:'SAÍDA',desc:id,valor:100,data:'2026-11-15',formaPagamento:'boleto',status:'pendente',...extra});
test('cash requires explicit baseline and never mixes investments, goals or monthly opening balance',()=>{
 const {c,month,checkpoint}=setup();month.resumo={saldoAnterior:5000};assert.equal(c.buildCashProjection(c.DATA,30,false),null);checkpoint(0);assert.equal(c.buildCashProjection(c.DATA,30,false).opening,0);checkpoint(-100);assert.equal(c.buildCashProjection(c.DATA,30,false).firstNegative,'2026-11-10');
});
test('credit invoice is counted once alongside expected incomes and investment transfers',()=>{
 const {c,month,checkpoint}=setup();month.transactions=[tx('one',{formaPagamento:'credito',cartao:'nubank',valor:33.33}),tx('two',{formaPagamento:'credito',cartao:'nubank',valor:66.67}),tx('salary',{tipo:'ENTRADA',valor:500}),tx('invest',{tipo:'INVESTIMENTOS',valor:50}),tx('withdraw',{tipo:'RESGATE',valor:20})];checkpoint();const p=c.buildCashProjection(c.DATA,30,false);assert.equal(p.incoming,52000);assert.equal(p.outgoing,15000);assert.equal(p.final,137000);assert.equal(p.timeline.flatMap(d=>d.items).filter(i=>i.type==='invoice').length,1);
});
test('paying a pending invoice adjusts available cash without dropping its cost from the final balance',()=>{
 const {c,month,checkpoint}=setup();month.transactions=[tx('bill',{formaPagamento:'credito',cartao:'nubank'})];checkpoint();assert.equal(c.buildCashProjection(c.DATA,30,false).final,90000);month.transactions[0].status='pago';month.transactions[0].paidAt='2026-11-10';const p=c.buildCashProjection(c.DATA,30,false);assert.equal(p.realizedDelta,-10000);assert.equal(p.opening,90000);assert.equal(p.outgoing,0);assert.equal(p.final,90000);
});
test('partial receipts remain consistent with optional receivable scenario',()=>{
 const {c,month,checkpoint}=setup();c.DATA.obligations=[{id:'r',kind:'receivable',description:'Devolução',amount:100,due:'2026-11-12',payments:[]}];checkpoint();assert.equal(c.buildCashProjection(c.DATA,30,false).final,100000);assert.equal(c.buildCashProjection(c.DATA,30,true).final,110000);c.DATA.obligations[0].payments.push({amount:40});month.transactions.push(tx('received',{tipo:'ENTRADA',valor:40,status:'pago'}));const p=c.buildCashProjection(c.DATA,30,true);assert.equal(p.opening,104000);assert.equal(p.incoming,6000);assert.equal(p.final,110000);
});
test('undated commitments stay outside projection and overdue commitments move only in the scenario',()=>{
 const {c,month,checkpoint}=setup();month.transactions=[tx('old',{data:'2025-12-01'}),tx('no-date',{data:''}),tx('card',{formaPagamento:'credito',cartao:'unknown'}),tx('far',{data:'2027-01-01'})];checkpoint();const p=c.buildCashProjection(c.DATA,30,false);assert.equal(p.overdue.length,1);assert.equal(p.timeline[0].outgoing,10000);assert.equal(p.undated.length,2);assert.equal(p.outside.length,1);assert.equal(p.final,90000);assert.equal(month.transactions[0].data,'2025-12-01');
});
test('projection identifies first daily deficit and later recovery',()=>{
 const {c,month,checkpoint}=setup();month.transactions=[tx('rent',{valor:1200,data:'2026-11-11'}),tx('salary',{tipo:'ENTRADA',valor:500,data:'2026-11-12'})];checkpoint();const p=c.buildCashProjection(c.DATA,30,false);assert.equal(p.firstNegative,'2026-11-11');assert.equal(p.minimum,-20000);assert.equal(p.final,30000);
});
test('horizon includes its last date and crosses year boundaries',()=>{
 const {c,month,checkpoint}=setup();month.transactions=[tx('last',{data:'2027-01-01'}),tx('outside',{data:'2027-01-02'})];checkpoint();const p=c.buildCashProjection(c.DATA,3,false,'2026-12-30');assert.equal(p.timeline.at(-1).date,'2027-01-01');assert.equal(p.final,90000);assert.equal(p.outside.length,1);
});
test('new balance check resets realized adjustment and keeps prior check in history',async()=>{
 const {c,month,nodes,checkpoint}=setup();checkpoint();month.transactions.push(tx('paid',{status:'pago'}));assert.equal(c.buildCashProjection(c.DATA,30,false).opening,90000);nodes.cashBalance={value:'850'};await c.saveCashCheckpoint({preventDefault(){}});assert.equal(c.DATA.cashBalanceHistory[0].balanceCents,100000);assert.equal(c.buildCashProjection(c.DATA,30,false).opening,85000);assert.equal(c.buildCashProjection(c.DATA,30,false).realizedDelta,0);
});
test('failed or cancelled balance checks leave stored data unchanged',async()=>{
 const {c,nodes,checkpoint}=setup();checkpoint();const before=JSON.stringify(c.DATA);nodes.cashBalance={value:'0'};c.saveData=async()=>false;await c.saveCashCheckpoint({preventDefault(){}});assert.equal(JSON.stringify(c.DATA),before);assert.equal(nodes.cashBalance.value,'0');c.confirm=()=>false;await c.saveCashCheckpoint({preventDefault(){}});assert.equal(JSON.stringify(c.DATA),before);
});
test('legacy root records and reversal of a received payment adjust available cash',()=>{
 const {c}=setup();c.DATA={months:{nov:{transactions:[tx('received',{tipo:'ENTRADA',status:'pago',valor:50})]}}};c.DATA.cashCheckpoint={balanceCents:10000,settledCents:c.cashSettledCents(),date:'2026-11-10'};c.DATA.months.nov.transactions=[];assert.equal(c.buildCashProjection(c.DATA,30,false).opening,5000);
});
test('chart supports flat zero balances and detail descriptions are escaped',()=>{
 const {c,month,nodes,checkpoint}=setup();checkpoint(0);const chart=c.cashChart(c.buildCashProjection(c.DATA,30,false));assert.doesNotMatch(chart,/NaN|Infinity/);month.transactions=[tx('<script>',{valor:1})];c.renderCash();assert.match(nodes.cashDays.innerHTML,/&lt;script&gt;/);assert.match(nodes.cashAlert.textContent,/negativo/);
});
