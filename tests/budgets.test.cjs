const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const nodes={},handlers={};for(const id of ['budgetForm','budgetList','budgetPeriod','budgetCategory','budgetLimit','budgetMessage','budgetScope','copyPreviousBudgets'])nodes[id]={value:'',addEventListener:(type,fn)=>handlers[id+type]=fn};
 const c=vm.createContext({DATA:{currentMonth:0,currentYear:2026,years:{2026:{months:{jan:{transactions:[]}}}}},MK:['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'],MONTHS:['Janeiro'],CATS:['Alimentação'],document:{getElementById:id=>nodes[id]},alert(){},confirm:()=>true,saveData:async()=>true});
 for(const file of ['transactions.js','planning.js','pages/orcamentos.js'])vm.runInContext(fs.readFileSync('js/'+file,'utf8'),c);
 c.getYearData=()=>c.DATA.years[c.DATA.currentYear];c.brl=v=>String(v);return {c,nodes,handlers,month:c.DATA.years[2026].months.jan};
}
test('budget counts paid and pending expenses only, rounding each amount to cents',()=>{
 const {c,month}=setup();month.budgets=[{category:'Alimentação',limitCents:10000}];month.transactions=[{tipo:'SAÍDA',categoria:'Alimentação',valor:'33.33',status:'pago'},{tipo:'SAÍDA',categoria:'Alimentação',valor:46.67,status:'pendente'},{tipo:'ENTRADA',categoria:'Alimentação',valor:500},{tipo:'SAÍDA',categoria:'Outra',valor:90}];
 const b=c.budgetSummary(month)[0];assert.equal(b.consumed,8000);assert.equal(b.remaining,2000);assert.equal(b.status,'warning');
 for(const [amount,status] of [[10,'ok'],[100,'reached'],[100.01,'exceeded']]){month.transactions=[{tipo:'SAÍDA',categoria:'Alimentação',valor:amount}];assert.equal(c.budgetSummary(month)[0].status,status);}
});
test('zero limit allows no spending, with no division by zero',()=>{
 const {c,month}=setup();month.budgets=[{category:'Alimentação',limitCents:0}];assert.equal(c.budgetSummary(month)[0].status,'ok');month.transactions=[{tipo:'SAÍDA',categoria:'Alimentação',valor:.01}];assert.equal(c.budgetSummary(month)[0].status,'exceeded');
});
test('save updates one category, isolates years and rolls back failed writes',async()=>{
 const {c,nodes,month}=setup();c.DATA.years[2025]={months:{jan:{transactions:[],budgets:[{category:'Alimentação',limitCents:50}]}}};
 nodes.budgetCategory.value='Alimentação';nodes.budgetLimit.value='100.01';await c.saveBudget({preventDefault(){}});assert.equal(month.budgets[0].limitCents,10001);assert.equal(c.DATA.years[2025].months.jan.budgets[0].limitCents,50);
 nodes.budgetCategory.value='Alimentação';nodes.budgetLimit.value='200';c.saveData=async()=>false;await c.saveBudget({preventDefault(){}});assert.equal(c.getYearData().months.jan.budgets[0].limitCents,10001);assert.equal(nodes.budgetLimit.value,'200');
});
test('custom and historical categories remain available and text is escaped',()=>{
 const {c,nodes,month}=setup();c.DATA.customCats=['Personalizada'];month.budgets=[{category:'<Antiga>',limitCents:100}];c.renderBudgets();assert.match(nodes.budgetCategory.innerHTML,/Personalizada/);assert.match(nodes.budgetCategory.innerHTML,/&lt;Antiga&gt;/);assert.match(nodes.budgetList.innerHTML,/&lt;Antiga&gt;/);assert.equal(month.transactions.length,0);
});
test('remove limit preserves transactions and other budgets',async()=>{
 const {c,handlers,month}=setup();month.budgets=[{category:'Alimentação',limitCents:100},{category:'Outra',limitCents:200}];month.transactions=[{tipo:'SAÍDA',categoria:'Alimentação',valor:1}];await handlers.budgetListclick({target:{closest:()=>({dataset:{budgetRemove:'Alimentação'}})}});assert.equal(month.budgets.length,1);assert.equal(month.transactions.length,1);
});

test('defaults are inherited, monthly overrides win including zero and exclusions',()=>{
 const {c,month}=setup();c.DATA.defaultBudgets=[{category:'Alimentação',limitCents:10000},{category:'Outra',limitCents:500}];month.budgets=[{category:'Alimentação',limitCents:0},{category:'Outra',disabled:true}];
 const limits=c.effectiveBudgets(month);assert.equal(limits.length,1);assert.equal(limits[0].limitCents,0);assert.equal(limits[0].source,'month');assert.equal(c.effectiveBudgets({transactions:[]})[0].source,'default');
});
test('changing defaults preserves month exceptions and old saved budgets',async()=>{
 const {c,nodes,month}=setup();month.budgets=[{category:'Alimentação',limitCents:500}];nodes.budgetCategory.value='Alimentação';nodes.budgetLimit.value='200';nodes.budgetScope.value='default';await c.saveBudget({preventDefault(){}});assert.equal(c.DATA.defaultBudgets[0].limitCents,20000);assert.equal(c.effectiveBudgets(month)[0].limitCents,500);assert.equal(c.effectiveBudgets({transactions:[]})[0].limitCents,20000);
});
test('copy across December and January takes effective limits without copying transactions',async()=>{
 const {c,month}=setup();c.DATA.defaultBudgets=[{category:'Padrão',limitCents:123}];c.DATA.years[2025]={months:{dez:{transactions:[{id:'old'}],budgets:[{category:'Alimentação',limitCents:500}]}}};month.budgets=[{category:'Alimentação',limitCents:100},{category:'Especial',limitCents:222}];await c.copyPreviousBudgets();assert.equal(month.budgets.length,3);assert.equal(month.budgets.find(b=>b.category==='Alimentação').limitCents,500);assert.equal(month.transactions.length,0);month.budgets[0].limitCents=999;assert.equal(c.DATA.years[2025].months.dez.budgets[0].limitCents,500);
});
test('monthly removal suppresses inherited budget and reset restores default',async()=>{
 const {c,month,handlers}=setup();c.DATA.defaultBudgets=[{category:'Alimentação',limitCents:100}];
 const click=dataset=>handlers.budgetListclick({target:{closest:()=>({dataset})}});
 await click({budgetRemove:'Alimentação'});assert.equal(c.effectiveBudgets(month).length,0);assert.equal(c.DATA.defaultBudgets.length,1);await click({budgetReset:'Alimentação'});assert.equal(c.effectiveBudgets(month)[0].limitCents,100);
});
test('failed copy and default save restore all prior limits',async()=>{
 const {c,nodes}=setup();c.DATA.years[2025]={months:{dez:{transactions:[],budgets:[{category:'Alimentação',limitCents:500}]}}};c.saveData=async()=>false;const before=JSON.stringify(c.DATA);await c.copyPreviousBudgets();assert.equal(JSON.stringify(c.DATA),before);nodes.budgetCategory.value='Alimentação';nodes.budgetLimit.value='300';nodes.budgetScope.value='default';await c.saveBudget({preventDefault(){}});assert.equal(JSON.stringify(c.DATA),before);
});
test('copy with missing prior year or canceled confirmation changes nothing',async()=>{
 const {c}=setup();const before=JSON.stringify(c.DATA);await c.copyPreviousBudgets();assert.equal(JSON.stringify(c.DATA),before);c.DATA.years[2025]={months:{dez:{transactions:[],budgets:[{category:'Alimentação',limitCents:1}]}}};c.confirm=()=>false;await c.copyPreviousBudgets();assert.equal(c.DATA.years[2026].months.jan.budgets,undefined);
});
