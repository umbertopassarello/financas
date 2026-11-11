const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const nodes={},handlers={};const c=vm.createContext({DATA:{currentYear:2026,currentMonth:10,years:{2025:{months:{dez:{transactions:[]}}},2026:{months:{nov:{transactions:[]},dez:{transactions:[]}}}},obligations:[],cardDueDays:{nubank:15}},MK:['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'],MONTHS:['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],BANKS:{nubank:{l:'Nubank'}},document:{getElementById:id=>nodes[id]??={value:id==='agendaPeriod'||id==='agendaType'?'all':'',addEventListener:(event,fn)=>handlers[id+event]=fn}},saveData:async()=>true,alert(){},confirm:()=>true,brl:v=>String(v)});
 for(const file of ['transactions.js','planning.js','pages/agenda.js'])vm.runInContext(fs.readFileSync('js/'+file,'utf8'),c);
 c.localDate=()=> '2026-11-10';return {c,nodes,handlers,month:c.DATA.years[2026].months.nov};
}
const expense=(id,extra={})=>({id,tipo:'SAÍDA',desc:id,valor:10,data:'2026-11-10',formaPagamento:'boleto',status:'pendente',...extra});
test('agenda groups credit invoices once and excludes paid transactions across years',()=>{
 const {c,month}=setup();month.transactions=[expense('one',{formaPagamento:'credito',cartao:'nubank',valor:'33.33'}),expense('two',{banco:'nubank',formaPagamento:undefined,status:undefined,valor:46.67}),expense('paid',{formaPagamento:'credito',cartao:'nubank',status:'pago'}),expense('bill'),expense('income',{tipo:'ENTRADA'})];c.DATA.years[2025].months.dez.transactions=[expense('old')];
 const before=JSON.stringify(c.DATA),items=c.agendaItems(),invoice=items.find(i=>i.type==='invoice');assert.equal(items.length,3);assert.equal(invoice.cents,8000);assert.equal(invoice.refs.length,2);assert.equal(invoice.due,'2026-11-15');assert.equal(JSON.stringify(c.DATA),before);
});
test('missing or invalid due dates remain undated and invoice day clamps to month end',()=>{
 const {c,month}=setup();delete c.DATA.cardDueDays;month.transactions=[expense('card',{formaPagamento:'credito',cartao:'nubank'}),expense('missing',{data:''}),expense('invalid',{dueDate:'2026-02-30'}),expense('explicit',{dueDate:'2026-12-01'})];const items=c.agendaItems();assert.equal(items.filter(i=>!i.due).length,3);assert.equal(items.find(i=>i.title==='explicit').due,'2026-12-01');assert.equal(c.agendaInvoiceDate(2028,1,31),'2028-02-29');assert.equal(c.agendaInvoiceDate(2026,1,31),'2026-02-28');assert.equal(c.agendaInvoiceDate(2026,1,0),'');
});
test('receivables show remaining balance and exclude settled items and investment replacements',()=>{
 const {c}=setup();c.DATA.obligations=[{id:'r',kind:'receivable',description:'Empréstimo',amount:100,due:'2026-11-09',payments:[{amount:40}]},{id:'done',kind:'receivable',amount:10,payments:[{amount:10}]},{id:'invest',kind:'investment',amount:500}];const items=c.agendaItems();assert.equal(items.length,1);assert.equal(items[0].cents,6000);assert.equal(items[0].due,'2026-11-09');
});
test('filters distinguish overdue, today, next seven days, active month and undated',()=>{
 const {c}=setup();const items=[{type:'expense',due:'2026-11-09'},{type:'invoice',due:'2026-11-10'},{type:'expense',due:'2026-11-17'},{type:'receivable',due:'2026-11-18'},{type:'expense',due:''},{type:'invoice',due:'2025-11-12'}];assert.equal(c.filterAgenda(items,'overdue','all').length,2);assert.equal(c.filterAgenda(items,'week','all').length,2);assert.equal(c.filterAgenda(items,'month','all').length,4);assert.equal(c.filterAgenda(items,'undated','all').length,1);assert.equal(c.filterAgenda(items,'all','invoice').length,2);
});
test('invoice payment keeps cards, adds paid date and never creates a duplicate outflow',async()=>{
 const {c,month}=setup();month.transactions=[expense('one',{banco:'nubank',formaPagamento:undefined}),expense('two',{formaPagamento:'credito',cartao:'nubank'}),expense('other')];const invoice=c.agendaItems().find(i=>i.type==='invoice');await c.payAgendaItem(invoice);assert.equal(month.transactions.length,3);assert.equal(month.transactions[0].cartao,'nubank');assert.equal(month.transactions[0].status,'pago');assert.equal(month.transactions[0].paidAt,'2026-11-10');assert.equal(month.transactions[2].status,'pendente');assert.equal(c.agendaItems().filter(i=>i.type==='invoice').length,0);
});
test('failed payment restores data and cancelled payment does not write',async()=>{
 const {c,month}=setup();month.transactions=[expense('bill')];const item=c.agendaItems()[0],before=JSON.stringify(c.DATA);c.saveData=async()=>false;await c.payAgendaItem(item);assert.equal(JSON.stringify(c.DATA),before);c.confirm=()=>false;c.saveData=async()=>{throw Error('must not save')};await c.payAgendaItem(item);assert.equal(JSON.stringify(c.DATA),before);
});
test('receivable action opens existing partial settlement flow without writing',async()=>{
 const {c}=setup();let id;c.openSettlement=value=>id=value;c.saveData=async()=>{throw Error('must not save')};await c.payAgendaItem({type:'receivable',obligationId:'r'});assert.equal(id,'r');
});
test('agenda escapes descriptions and supports legacy root months',()=>{
 const {c,month,nodes}=setup();month.transactions=[expense('<script>')];c.renderAgenda();assert.match(nodes.agendaList.innerHTML,/&lt;script&gt;/);c.DATA={months:{nov:month}};assert.equal(c.agendaItems().length,1);
});
test('card due-day saves persist safely and reject invalid input',async()=>{
 const {c,nodes}=setup();c.renderAgenda();nodes.agendaCard.value='nubank';nodes.agendaDueDay.value='31';await c.saveAgendaCard({preventDefault(){}});assert.equal(c.DATA.cardDueDays.nubank,31);nodes.agendaDueDay.value='5';c.saveData=async()=>false;await c.saveAgendaCard({preventDefault(){}});assert.equal(c.DATA.cardDueDays.nubank,31);nodes.agendaDueDay.value='32';await c.saveAgendaCard({preventDefault(){}});assert.equal(c.DATA.cardDueDays.nubank,31);
});
test('all HTML ids are unique so series and settlement forms cannot overwrite each other',()=>{
 const html=fs.readFileSync('index.html','utf8'),ids=Array.from(html.matchAll(/\bid="([^"]+)"/g),m=>m[1]);assert.equal(ids.length,new Set(ids).size);
});

test('opening an invoice selects its year/month and replaces stale transaction filters',()=>{
 const {c,month,handlers}=setup();month.transactions=[expense('one',{formaPagamento:'credito',cartao:'nubank'})];
 c.lancFilters=Object.fromEntries(['tipo','forma','cartao','status','categoria','mov'].map(k=>[k,new Set(['stale'])]));let page;c.navTo=p=>page=p;c.renderMonthBtns=()=>{};c.renderAgenda();
 handlers.agendaListclick({target:{closest:()=>({dataset:{agendaOpen:'0'}})}});
 assert.equal(page,'lancamentos');assert.equal(c.DATA.currentMonth,10);assert.deepEqual([...c.lancFilters.cartao],['nubank']);assert.deepEqual([...c.lancFilters.status],['pendente']);assert.equal(c.lancFilters.categoria.size,0);
});
