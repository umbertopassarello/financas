const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const nodes=Object.fromEntries(Object.entries({lTipo:'SAÍDA',lDesc:'Compra editada',lValor:'25',lCat:'Outros',lMov:'Variável',lForma:'credito',lBanco:'nubank',lStatus:'pendente',lData:'2026-11-10'}).map(([id,value])=>[id,{value}]));
 const alerts=[],closed=[];
 const c=vm.createContext({DATA:{currentMonth:10,months:{nov:{transactions:[{id:'old',desc:'Compra',tipo:'SAÍDA',valor:10,banco:'nubank'}]}}},MK:Array(10).fill('').concat('nov'),editingLancId:'old',uuid:()=> 'new',document:{addEventListener(){},getElementById:id=>nodes[id],querySelectorAll:()=>[{value:'nubank'}]},confirm:()=>true,alert:m=>alerts.push(m),closeModal:id=>closed.push(id),saveData:async()=>false});
 for(const file of ['transactions.js','planning.js','pages/lancamentos.js'])vm.runInContext(fs.readFileSync('js/'+file,'utf8'),c);
 c.getYearData=()=>c.DATA;c.renderLanc=()=>{};c.renderMonthBtns=()=>{};return {c,nodes,alerts,closed};
}
for(const action of ['create','edit','delete','pay'])test(action+' rolls back after failed save',async()=>{
 const {c,alerts,closed,nodes}=setup(),before=JSON.stringify(c.DATA);
 if(action==='create')c.editingLancId=null;
 if(action==='create'||action==='edit')await c.salvarLanc();
 if(action==='delete')await c.delLanc('old');
 if(action==='pay')await c.quitarFaturas();
 assert.equal(JSON.stringify(c.DATA),before);assert.equal(closed.length,0);assert.equal(alerts.length,1);assert.match(alerts[0],/desfeita/);assert.equal(nodes.lDesc.value,'Compra editada');
 if(action==='edit')assert.equal(c.editingLancId,'old');
});
test('repeated clicks during pending save create just one transaction',async()=>{
 const {c,closed}=setup();c.editingLancId=null;let finish,writes=0;c.saveData=()=>{writes++;return new Promise(resolve=>finish=resolve)};
 const first=c.salvarLanc();await c.salvarLanc();assert.equal(writes,1);finish(true);await first;assert.equal(c.DATA.months.nov.transactions.length,2);assert.deepEqual(closed,['moLanc']);
});
test('invoice success preserves card and confirms only after saving',async()=>{
 const {c,alerts,closed}=setup();c.saveData=async()=>true;await c.quitarFaturas();assert.equal(c.DATA.months.nov.transactions[0].status,'pago');assert.equal(c.DATA.months.nov.transactions[0].cartao,'nubank');assert.deepEqual(closed,['moQuitar']);assert.match(alerts[0],/✅ 1/);
});
