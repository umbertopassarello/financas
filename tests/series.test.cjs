const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const nodes={},handlers={};const c=vm.createContext({DATA:{currentYear:2026,currentMonth:0,months:{jan:{transactions:[{id:'old',valor:1}]}},casa:{jan:[{id:'house'}]},metas:[],investSaldo:300},MK:['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'],document:{addEventListener(){},getElementById:id=>nodes[id]??=( {value:'',addEventListener:(event,fn)=>handlers[id+event]=fn})},saveData:async()=>true,uuid:(()=>{let i=0;return()=> 'id'+(++i)})(),alert(){},confirm:()=>true,closeModal(){},renderLanc(){},renderMonthBtns(){}});
 for(const file of ['transactions.js','planning.js','series.js','data.js'])vm.runInContext(fs.readFileSync('js/'+file,'utf8'),c);
 c.saveData=async()=>true;c.brl=v=>String(v);return {c,nodes,handlers};
}
const input={kind:'installments',desc:'Notebook',amount:100,count:3,date:'2026-01-31',category:'Outros',method:'credito',card:'nubank'};
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

test('series form prevents double submission and preserves form after failed save',async()=>{
 const {c,nodes}=setup();const values={sKind:'recurring',sDesc:'Academia',rsAmount:'100',sCount:'3',rsDate:'2026-01-01',sCategory:'Saúde',sMethod:'boleto',sCard:''};for(const [id,value] of Object.entries(values))nodes[id]={value};
 let finish,writes=0;c.saveData=()=>{writes++;return new Promise(resolve=>finish=resolve)};
 const first=c.saveSeries({preventDefault(){}});await c.saveSeries({preventDefault(){}});assert.equal(writes,1);finish(false);await first;assert.equal(c.seriesEntries().length,1);assert.equal(nodes.sDesc.value,'Academia');
});
test('future editing can move occurrences across years, keeping their IDs',()=>{
 const {c}=setup();c.commitSeries(c.planSeries(input),'s');const entries=c.seriesEntries().filter(({t})=>t.seriesId==='s'),original=entries[0].t,ids=entries.map(({t})=>t.id).sort();c.updateSeriesFrom(original,{...original,data:'2026-12-31'});const updated=c.seriesEntries().filter(({t})=>t.seriesId==='s');assert.deepEqual(updated.map(({t})=>t.id).sort(),ids);assert.equal(updated.filter(e=>e.year===2027).length,2);assert.equal(c.DATA.years[2027].months.fev.transactions[0].data,'2027-02-28');
});
