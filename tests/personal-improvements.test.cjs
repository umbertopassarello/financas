const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const nodes={}; for(const id of ['mDesc','mObj','mAtual','mAporteVal','mAporteData','simSal','simExtra','simAnt','simInv','simNotes','simTbody','srAnt','srEnt','srInv','srGas','srMes','srFinal'])nodes[id]={value:'',style:{}};
 const alerts=[]; const c=vm.createContext({DATA:{metas:[{id:'m',descricao:'Reserva',objetivo:100,atual:50,aportes:[]}]},editingMetaId:'m',simRows:[],CU:{login:'test'},CATS:[],document:{getElementById:id=>nodes[id]},alert:m=>alerts.push(m),saveData:async()=>true,closeModal(){},uuid:()=> 'new',brl:v=>String(v),rememberRecord(){},setSyncing(){},setSynced(){},setSyncErr(){}});
 for(const file of ['pages/metas.js','pages/simulacao.js'])vm.runInContext(fs.readFileSync('js/'+file,'utf8'),c);
 c.renderMetas=()=>{}; nodes.mDesc.value='Reserva';nodes.mObj.value='100';nodes.mAtual.value='0';return {c,nodes,alerts};
}
test('meta accepts zero and restores previous data on failure while retaining edit',async()=>{
 const {c,nodes,alerts}=setup();await c.salvarMeta();assert.equal(c.DATA.metas[0].atual,0);
 c.editingMetaId='m';nodes.mAtual.value='25';c.saveData=async()=>false;await c.salvarMeta();assert.equal(c.DATA.metas[0].atual,0);assert.equal(c.editingMetaId,'m');assert.equal(nodes.mAtual.value,'25');assert.match(alerts[0],/Não foi possível/);
});
test('new meta respects initial balance and rejects invalid amounts',async()=>{
 const {c,nodes}=setup();c.editingMetaId=null;nodes.mAtual.value='12';await c.salvarMeta();assert.equal(c.DATA.metas[1].atual,12);
 c.editingMetaId='m';nodes.mObj.value='-1';await c.salvarMeta();assert.equal(c.DATA.metas[0].objetivo,100);
});
test('simulation preserves saved zero salary and shows negative balance',async()=>{
 const {c,nodes}=setup();c.sb=async()=>[{data:{sal:0,ant:-10,rows:[{desc:'Conta',cat:'Outros',valor:20}]}}];await c.loadSimUI();assert.equal(nodes.simSal.value,0);assert.equal(nodes.srFinal.textContent,'-30');
});
test('simulation only announces success after confirmed save',async()=>{
 const {c,alerts}=setup();c.saveSim=async()=>false;await c.salvarSim();assert.match(alerts.pop(),/Não foi possível/);c.saveSim=async()=>true;await c.salvarSim();assert.match(alerts.pop(),/✅/);
});
test('simulation persistence returns explicit success and failure',async()=>{
 const {c}=setup();vm.runInContext(fs.readFileSync('js/data.js','utf8'),c);c.sb=async()=>[{updated_at:new Date().toISOString()}];assert.equal(await c.saveSim(),true);c.sb=async()=>{throw Error('offline')};assert.equal(await c.saveSim(),false);
});

test('render failure after saving keeps committed values and reports display error',async()=>{
 const {c,nodes,alerts}=setup();nodes.mAtual.value='25';c.renderMetas=()=>{throw Error('render failed')};await c.salvarMeta();assert.equal(c.DATA.metas[0].atual,25);assert.equal(c.editingMetaId,null);assert.match(alerts[0],/A meta foi salva/);
});
test('save failure exposes server detail and preserves the previous meta',async()=>{
 const {c,nodes,alerts}=setup();nodes.mAtual.value='25';c.saveData=async()=>false;c.saveData.lastError={message:'Connection unavailable'};await c.salvarMeta();assert.equal(c.DATA.metas[0].atual,50);assert.match(alerts[0],/Connection unavailable/);
});
test('legacy meta without contribution history renders after saving',async()=>{
 const {c,nodes,alerts}=setup();delete c.DATA.metas[0].aportes;
 for(const id of ['metasGrid','metaAportesTbody','metaAportesMobile'])nodes[id]={};
 vm.runInContext(fs.readFileSync('js/pages/metas.js','utf8').split('let savingMeta=false;')[0],c);
 await c.salvarMeta();assert.equal(alerts.length,0);assert.match(nodes.metaAportesTbody.innerHTML,/Nenhum aporte/);
});
