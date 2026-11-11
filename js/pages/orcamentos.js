// Limites pertencem ao mês/ano; o consumo usa saídas pagas e pendentes.
function budgetCents(value){return Math.round((Number(value)+Number.EPSILON)*100);}
function effectiveBudgets(month){
  const limits=new Map((DATA.defaultBudgets||[]).map(b=>[b.category,{...b,source:'default'}]));
  for(const b of month.budgets||[]){
    if(b.disabled)limits.delete(b.category);
    else limits.set(b.category,{...b,source:'month'});
  }
  return [...limits.values()];
}
function previousBudgetMonth(){
  const index=DATA.currentMonth===0?11:DATA.currentMonth-1;
  const year=activeYear()-(DATA.currentMonth===0?1:0);
  const period=DATA.years?DATA.years[year]:year===activeYear()?DATA:null;
  return period?.months?.[MK[index]];
}
function budgetSummary(month){
  return effectiveBudgets(month).map(b=>{
    const consumed=month.transactions.filter(t=>t.tipo==='SAÍDA'&&(t.categoria||'Sem categoria')===b.category)
      .reduce((sum,t)=>sum+budgetCents(t.valor),0);
    const remaining=b.limitCents-consumed;
    const status=remaining<0?'exceeded':remaining===0&&consumed>0?'reached':consumed>=b.limitCents*.8&&consumed>0?'warning':'ok';
    return {...b,consumed,remaining,status};
  });
}
function budgetCategories(month){
  return [...new Set([...CATS,...(DATA.customCats||[]),...month.transactions.map(t=>t.categoria||'Sem categoria'),...(month.budgets||[]).map(b=>b.category),...(DATA.defaultBudgets||[]).map(b=>b.category)])].sort((a,b)=>a.localeCompare(b,'pt-BR'));
}
function renderBudgets(){
  const month=getYearData().months[MK[DATA.currentMonth]],rows=budgetSummary(month);
  document.getElementById('budgetPeriod').textContent=MONTHS[DATA.currentMonth]+' / '+activeYear();
  document.getElementById('budgetCategory').innerHTML=budgetCategories(month).map(c=>'<option>'+escapeHTML(c)+'</option>').join('');
  document.getElementById('budgetLimit').value='';
  document.getElementById('budgetScope').value='month';
  document.getElementById('budgetMessage').textContent='';
  const labels={ok:'Dentro do limite',warning:'Atenção: 80% ou mais',reached:'Limite atingido',exceeded:'Limite ultrapassado'};
  const defaultActions=category=>(DATA.defaultBudgets||[]).some(b=>b.category===category)?'<button class="btn btn-g btn-sm" data-budget-default="'+escapeHTML(category)+'">Editar padrão</button>':'';
  document.getElementById('budgetList').innerHTML=(rows.length?rows.map(b=>{
    const color=b.status==='exceeded'?'var(--red)':b.status==='ok'?'var(--green)':'var(--yellow, #f5c842)';
    const percent=b.limitCents>0?Math.min(100,b.consumed/b.limitCents*100):b.consumed>0?100:0;
    return '<article class="card"><div class="card-label">'+escapeHTML(b.category)+'</div><div class="card-val">'+brl(b.consumed/100)+'</div><div class="card-sub">Limite: '+brl(b.limitCents/100)+' · '+(b.source==='default'?'Padrão':'Ajuste deste mês')+'</div><div class="prog"><div class="prog-fill" style="width:'+percent+'%;background:'+color+'"></div></div><p style="color:'+color+'">'+labels[b.status]+' · '+(b.remaining<0?'Excedido: ':'Restante: ')+brl(Math.abs(b.remaining)/100)+'</p><div class="page-actions"><button class="btn btn-g btn-sm" data-budget-edit="'+escapeHTML(b.category)+'">Ajustar neste mês</button>'+defaultActions(b.category)+(b.source==='month'?'<button class="btn btn-g btn-sm" data-budget-reset="'+escapeHTML(b.category)+'">Voltar ao padrão</button>':'')+'<button class="btn btn-d btn-sm" data-budget-remove="'+escapeHTML(b.category)+'">Remover deste mês</button></div></article>';
  }).join(''):'<p class="feature-note">Nenhum limite definido neste mês. Escolha uma categoria para começar.</p>')+(month.budgets||[]).filter(b=>b.disabled).map(b=>'<article class="card"><div class="card-label">'+escapeHTML(b.category)+'</div><p>Sem limite neste mês</p><button class="btn btn-g btn-sm" data-budget-reset="'+escapeHTML(b.category)+'">Voltar ao padrão</button>'+defaultActions(b.category)+'</article>').join('');
}
async function saveBudget(event){
  event.preventDefault();
  const category=document.getElementById('budgetCategory').value,raw=document.getElementById('budgetLimit').value;
  const limitCents=budgetCents(raw);
  const scope=document.getElementById('budgetScope').value;
  if(!category||!raw.trim()||Number(raw)<0||!Number.isSafeInteger(limitCents)||limitCents<0){alert('Escolha uma categoria e informe um limite válido, maior ou igual a zero.');return;}
  if(scope==='default'&&!confirm('Salvar o padrão de '+category+' para todos os meses e anos? Meses com ajustes próprios serão preservados. Meses anteriores sem ajuste também usarão este padrão.'))return;
  if(!await persistPlanningChange(()=>{
    if(scope==='default'){
      DATA.defaultBudgets=(DATA.defaultBudgets||[]).filter(b=>b.category!==category);
      DATA.defaultBudgets.push({category,limitCents});return;
    }
    const month=getYearData().months[MK[DATA.currentMonth]];
    month.budgets=(month.budgets||[]).filter(b=>b.category!==category);
    month.budgets.push({category,limitCents});
  }))return;
  renderBudgets();document.getElementById('budgetMessage').textContent='Limite salvo.';
}
document.getElementById('budgetForm').addEventListener('submit',saveBudget);
async function copyPreviousBudgets(){
  const previous=previousBudgetMonth();
  if(!previous){alert('O mês anterior não está cadastrado.');return;}
  const limits=effectiveBudgets(previous);
  if(!limits.length){alert('O mês anterior não possui limites para copiar.');return;}
  if(!confirm('Copiar '+limits.length+' limite(s) do mês anterior? As mesmas categorias serão substituídas neste mês; as demais serão mantidas.'))return;
  if(!await persistPlanningChange(()=>{
    const month=getYearData().months[MK[DATA.currentMonth]],categories=new Set(limits.map(b=>b.category));
    month.budgets=(month.budgets||[]).filter(b=>!categories.has(b.category));
    month.budgets.push(...limits.map(b=>({category:b.category,limitCents:b.limitCents})));
  }))return;
  renderBudgets();document.getElementById('budgetMessage').textContent='Limites do mês anterior copiados.';
}
document.getElementById('copyPreviousBudgets').addEventListener('click',copyPreviousBudgets);
document.getElementById('budgetList').addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;
  const month=getYearData().months[MK[DATA.currentMonth]];
  if(button.dataset.budgetEdit!==undefined){
    const b=effectiveBudgets(month).find(b=>b.category===button.dataset.budgetEdit);if(!b)return;
    document.getElementById('budgetScope').value='month';
    document.getElementById('budgetCategory').value=b.category;
    document.getElementById('budgetLimit').value=(b.limitCents/100).toFixed(2);
    document.getElementById('budgetLimit').focus();
  }else if(button.dataset.budgetDefault!==undefined){
    const b=(DATA.defaultBudgets||[]).find(b=>b.category===button.dataset.budgetDefault);if(!b)return;
    document.getElementById('budgetScope').value='default';
    document.getElementById('budgetCategory').value=b.category;
    document.getElementById('budgetLimit').value=(b.limitCents/100).toFixed(2);
    document.getElementById('budgetLimit').focus();
  }else if(button.dataset.budgetReset!==undefined){
    const category=button.dataset.budgetReset;
    if(!confirm('Remover o ajuste de '+category+' e usar o padrão neste mês? Sem padrão cadastrado, a categoria ficará sem limite.'))return;
    if(await persistPlanningChange(()=>{month.budgets=(month.budgets||[]).filter(b=>b.category!==category);}))renderBudgets();
  }else if(button.dataset.budgetRemove!==undefined){
    const category=button.dataset.budgetRemove;
    if(!confirm('Remover o limite de '+category+' neste mês? Os lançamentos serão mantidos.'))return;
    if(await persistPlanningChange(()=>{
      month.budgets=(month.budgets||[]).filter(b=>b.category!==category);
      if((DATA.defaultBudgets||[]).some(b=>b.category===category))month.budgets.push({category,disabled:true});
    }))renderBudgets();
  }
});
