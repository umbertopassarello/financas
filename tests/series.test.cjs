const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const nodes={},handlers={};const c=vm.createContext({DATA:{currentYear:2026,currentMonth:0,months:{jan:{transactions:[{id:'old',valor:1}]}},casa:{jan:[{id:'house'}]},metas:[],investSaldo:300},MK:['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'],document:{addEventListener(){},getElementById:id=>nodes[id]??=( {value:'',addEventListener:(event,fn)=>handlers[id+event]=fn})},saveData:async()=>true,uuid:(()=>{let i=0;return()=> 'id'+(++i)})(),alert(){},confirm:()=>true,closeModal(){},renderLanc(){},renderMonthBtns(){}});
 for(const file of ['transactions.js','planning.js','series.js','data.js'])vm.runInContext(fs.readFileSync('js/'+file,'utf8'),c);
 c.saveData=async()=>true;c.brl=v=>String(v);return {c,nodes,handlers};
}
const input={kind:'installments',desc:'Notebook',amount:100,count:3,date:'2026-01-31',category:'Outros',method:'credito',card:'nubank'};
test('duplicating a linked installment pre-fills a new transaction and saves it in the chosen month',async()=>{
 const {c,nodes}=setup();
 c.commitSeries(c.planSeries(input),'purchase');
 const source=c.DATA.months.jan.transactions.find(t=>t.seriesId==='purchase');
 source.obligationId='linked';
 source.paidAt='2026-01-31';
 const before=JSON.stringify(source);
 c.CATS=['Outros'];c.BANKS={nubank:{l:'Nubank'}};
 nodes.lForma={options:[{value:'credito'}]};
 nodes.lData={focus(){}};
 nodes.seriesEditGroup={style:{}};
 nodes.bancoGrp={style:{}};
 let modal;
 c.openModal=id=>{modal=id;};
 vm.runInContext(fs.readFileSync('js/pages/lancamentos.js','utf8'),c);
 c.renderLanc=()=>{};
 c.duplicateLanc(source.id);
 assert.equal(modal,'moLanc');
 assert.equal(c.editingLancId,null);
 assert.equal(nodes.lDesc.value,'Notebook');
 assert.equal(nodes.lValor.value,33.34);
 assert.equal(nodes.lData.value,'2026-01-31');
 nodes.lData.value='2027-02-10';
 await c.salvarLanc();
 const [copy]=c.DATA.years[2027].months.fev.transactions;
 assert.equal(copy.data,'2027-02-10');
 assert.equal(copy.cartao,'nubank');
 assert.notEqual(copy.id,source.id);
 for(const field of ['seriesId','obligationId','paidAt'])assert.equal(copy[field],undefined);
 assert.equal(JSON.stringify(source),before);
});
test('per-installment mode uses the amount on every installment and validates the total',()=>{
 const {c}=setup();
 const plan=c.planSeries({...input,amount:33.33,amountMode:'perInstallment'});
 assert.deepEqual(Array.from(plan,t=>t.valor),[33.33,33.33,33.33]);
 assert.throws(()=>c.planSeries({...input,amount:5e13,amountMode:'perInstallment'}));
});
test('open recurrence extends across years once, keeps month-end alignment and can be ended',()=>{
 const {c}=setup();
 c.localDate=()=> '2026-01-01';
 c.commitSeries(c.planSeries({...input,kind:'recurring',count:'',unlimited:true}),'open');
 const occurrences=()=>c.seriesEntries().filter(({t})=>t.seriesId==='open').map(({t})=>t);
 assert.equal(occurrences().length,13);
 c.extendOpenRecurrences('2026-03-01');
 c.extendOpenRecurrences('2026-03-01');
 assert.equal(occurrences().length,15);
 assert.equal(occurrences().at(-2).data,'2027-02-28');
 assert.equal(occurrences().at(-1).data,'2027-03-31');
 occurrences().at(-1).status='pago';
 c.endOpenRecurrence('open',1);
 c.extendOpenRecurrences('2027-06-01');
 assert.deepEqual(Array.from(occurrences(),t=>t.seriesIndex),[0,1,14]);
});
test('future edits update the open recurrence rule without changing single edits into a new rule',()=>{
 const {c}=setup();
 c.localDate=()=> '2026-01-01';
 c.commitSeries(c.planSeries({...input,kind:'recurring',unlimited:true}),'open');
 const first=c.seriesEntries().find(({t})=>t.seriesId==='open').t;
 c.updateSeriesFrom(first,{...first,valor:125,data:'2026-01-20'});
 c.extendOpenRecurrences('2026-02-01');
 const next=c.seriesEntries().find(({t})=>t.seriesId==='open'&&t.seriesIndex===13).t;
 assert.equal(next.valor,125);
 assert.equal(next.data,'2027-02-20');
 assert.equal(next.status,'pendente');
});
test('advancing installments moves the same pending charges across years without changing totals',()=>{
 const {c}=setup();
 c.commitSeries(c.planSeries({...input,date:'2026-12-31'}),'purchase');
 const [first,second,third]=c.seriesEntries().filter(({t})=>t.seriesId==='purchase').map(({t})=>t);
 c.advancePurchaseInstallments(first.id,new Set([second.id,third.id]),'2026-12-31');
 const entries=c.purchaseInstallments(first.id);
 assert.equal(entries.length,3);
 assert.equal(entries.reduce((sum,{t})=>sum+Math.round(t.valor*100),0),10000);
 assert.ok(entries.every(({year,month,t})=>year===2026&&month==='dez'&&t.cartao==='nubank'&&t.status==='pendente'));
 assert.equal(entries[1].t.id,second.id);
 assert.equal(entries[1].t.installmentOriginalDate,'2027-01-31');
 assert.equal(entries[2].t.installmentOriginalDate,'2027-02-28');
 assert.throws(()=>c.advancePurchaseInstallments(first.id,new Set([second.id]),'2026-12-31'));
});
test('advance rejects a mixed selection containing a paid or linked installment before moving any charge',()=>{
 const {c}=setup();
 c.commitSeries(c.planSeries(input),'purchase');
 const [first,second,third]=c.seriesEntries().filter(({t})=>t.seriesId==='purchase').map(({t})=>t);
 third.status='pago';
 const advance=()=>c.advancePurchaseInstallments(first.id,new Set([second.id,third.id]),'2026-01-31');
 const before=JSON.stringify(c.DATA);
 assert.throws(advance);
 assert.equal(JSON.stringify(c.DATA),before);
 third.status='pendente';
 c.DATA.obligations=[{sourceId:third.id,sourceYear:2026,sourceMonth:'mar'}];
 const linked=JSON.stringify(c.DATA);
 assert.throws(advance);
 assert.equal(JSON.stringify(c.DATA),linked);
});
test('installments preserve exact total, unique link and end-of-month date',()=>{
 const {c}=setup(),plan=c.planSeries(input);assert.deepEqual(Array.from(plan,t=>t.valor),[33.34,33.33,33.33]);assert.deepEqual(Array.from(plan,t=>t.data),['2026-01-31','2026-02-28','2026-03-31']);c.commitSeries(plan,'purchase');const tx=c.seriesEntries().filter(({t})=>t.seriesId==='purchase');assert.equal(tx.length,3);assert.equal(new Set(tx.map(({t})=>t.id)).size,3);assert.ok(tx.every(({t})=>t.status==='pendente'));assert.throws(()=>c.commitSeries(plan,'purchase'),/já foi gerada/);
});
test('recurrences repeat full monthly value with leap-year clamping',()=>{
 const {c}=setup(),plan=c.planSeries({...input,kind:'recurring',date:'2028-01-31',amount:75});assert.deepEqual(Array.from(plan,t=>t.valor),[75,75,75]);assert.equal(plan[1].data,'2028-02-29');
});
test('cross-year creation preserves legacy fields and fills navigable months',()=>{
 const {c}=setup();c.commitSeries(c.planSeries({...input,date:'2026-12-31'}),'s');assert.equal(c.DATA.years[2026].months.jan.transactions[0].id,'old');assert.equal(c.DATA.years[2026].casa.jan[0].id,'house');assert.equal(c.DATA.investSaldo,300);assert.equal(Object.keys(c.DATA.years[2027].months).length,12);assert.equal(c.DATA.currentYear,2026);assert.equal(c.DATA.years[2027].months.fev.transactions[0].data,'2027-02-28');
});
test('invalid dates, counts and tiny totals cannot create a partial plan',()=>{
 const {c}=setup();for(const change of [{date:'2026-02-30'},{count:1},{count:121},{count:2.5},{amount:0},{amount:-1},{amount:.01},{card:''},{amount:'invalid'}])assert.throws(()=>c.planSeries({...input,...change}));assert.equal(c.seriesEntries().length,1);
});
test('future edit skips later paid occurrences and preserves earlier occurrences',()=>{
 const {c}=setup();c.commitSeries(c.planSeries({...input,count:5}),'s');const tx=c.seriesEntries().filter(({t})=>t.seriesId==='s').map(e=>e.t);tx[3].status='pago';c.updateSeriesFrom(tx[1],{...tx[1],desc:'Alterada',valor:50,data:'2026-02-15',status:'pago'});const updated=c.seriesEntries().filter(({t})=>t.seriesId==='s').map(e=>e.t).sort((a,b)=>a.seriesIndex-b.seriesIndex);assert.equal(updated[0].desc,'Notebook');assert.equal(updated[1].valor,50);assert.equal(updated[1].status,'pago');assert.equal(updated[2].data,'2026-03-15');assert.equal(updated[3].desc,'Notebook');assert.equal(updated[3].status,'pago');assert.equal(updated[4].valor,50);assert.equal(new Set(updated.map(t=>t.id)).size,5);
});
test('future edit refuses linked occurrences before applying any changes',()=>{
 const {c}=setup();c.commitSeries(c.planSeries(input),'s');const tx=c.seriesEntries().filter(({t})=>t.seriesId==='s').map(e=>e.t);c.DATA.obligations=[{sourceId:tx[2].id,sourceYear:2026,sourceMonth:'mar'}];const before=JSON.stringify(c.DATA);assert.throws(()=>c.updateSeriesFrom(tx[0],{...tx[0],valor:40}),/pendência/);assert.equal(JSON.stringify(c.DATA),before);
});
test('failed save rolls back all generated occurrences and new years',async()=>{
 const {c}=setup(),before=JSON.stringify(c.DATA);c.saveData=async()=>false;const ok=await c.persistPlanningChange(()=>c.commitSeries(c.planSeries({...input,date:'2026-12-01'}),'s'));assert.equal(ok,false);assert.equal(JSON.stringify(c.DATA),before);
});
test('single occurrence edit changes only the selected transaction',async()=>{
 const {c,nodes}=setup();c.commitSeries(c.planSeries(input),'s');const tx=c.seriesEntries().filter(({t})=>t.seriesId==='s').map(e=>e.t);c.editingLancId=tx[0].id;
 const values={lTipo:'SAÍDA',lDesc:'Só esta',lValor:'50',lCat:'Outros',lMov:'Parcelado',lForma:'credito',lBanco:'nubank',lStatus:'pendente',lData:'2026-02-10',seriesEditScope:'one'};for(const [id,value] of Object.entries(values))nodes[id]={value};
 vm.runInContext(fs.readFileSync('js/pages/lancamentos.js','utf8'),c);c.renderLanc=()=>{};await c.salvarLanc();const updated=c.seriesEntries().filter(({t})=>t.seriesId==='s');assert.equal(updated.length,3);assert.equal(updated.find(({t})=>t.id===tx[0].id).month,'fev');assert.equal(updated.find(({t})=>t.id===tx[1].id).t.valor,33.33);
});

test('saving a changed installment redistributes the balance in cents and preserves paid installments',async()=>{
 const {c,nodes}=setup();
 c.commitSeries(c.planSeries({...input,amount:400,count:4}),'purchase');
 const entries=()=>c.seriesEntries().filter(({t})=>t.seriesId==='purchase').map(({t})=>t);
 const [first,paid]=entries();
 paid.status='pago';
 c.editingLancId=first.id;
 const values={lTipo:'SAÍDA',lDesc:'Notebook',lValor:'180.01',lCat:'Outros',lMov:'Parcelado',lForma:'credito',lBanco:'nubank',lStatus:'pago',lData:first.data,seriesEditScope:'redistribute'};
 for(const [id,value] of Object.entries(values))nodes[id]={value};
 vm.runInContext(fs.readFileSync('js/pages/lancamentos.js','utf8'),c);
 c.renderLanc=()=>{};
 const before=JSON.stringify(c.DATA);
 c.saveData=async()=>false;
 await c.salvarLanc();
 assert.equal(JSON.stringify(c.DATA),before);
 c.saveData=async()=>true;
 await c.salvarLanc();
 assert.deepEqual(Array.from(entries(),t=>t.valor),[180.01,100,60,59.99]);
 assert.equal(entries()[1].status,'pago');
});

test('series form prevents double submission and preserves form after failed save',async()=>{
 const {c,nodes}=setup();const values={sKind:'recurring',sDesc:'Academia',rsAmount:'100',sCount:'3',rsDate:'2026-01-01',sCategory:'Saúde',sMethod:'boleto',sCard:''};for(const [id,value] of Object.entries(values))nodes[id]={value};
 let finish,writes=0;c.saveData=()=>{writes++;return new Promise(resolve=>finish=resolve)};
 const first=c.saveSeries({preventDefault(){}});await c.saveSeries({preventDefault(){}});assert.equal(writes,1);finish(false);await first;assert.equal(c.seriesEntries().length,1);assert.equal(nodes.sDesc.value,'Academia');
});
test('future editing can move occurrences across years, keeping their IDs',()=>{
 const {c}=setup();c.commitSeries(c.planSeries(input),'s');const entries=c.seriesEntries().filter(({t})=>t.seriesId==='s'),original=entries[0].t,ids=entries.map(({t})=>t.id).sort();c.updateSeriesFrom(original,{...original,data:'2026-12-31'});const updated=c.seriesEntries().filter(({t})=>t.seriesId==='s');assert.deepEqual(updated.map(({t})=>t.id).sort(),ids);assert.equal(updated.filter(e=>e.year===2027).length,2);assert.equal(c.DATA.years[2027].months.fev.transactions[0].data,'2027-02-28');
});
