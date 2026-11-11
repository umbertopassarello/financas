function cashTransactions(data=DATA){
  return Object.values(data.years||{legacy:data}).flatMap(period=>Object.values(period.months||{}).flatMap(month=>month.transactions||[]));
}
function cashSignedCents(t){
  const cents=Math.round(Number(t.valor)*100);
  if(!Number.isSafeInteger(cents)||cents<0)return 0;
  return ['ENTRADA','RESGATE'].includes(t.tipo)?cents:['SAÍDA','INVESTIMENTOS'].includes(t.tipo)?-cents:0;
}
function cashSettledCents(data=DATA){
  return cashTransactions(data).filter(t=>paymentInfo(t).status==='pago').reduce((sum,t)=>sum+cashSignedCents(t),0);
}
function cashMovements(data=DATA){
  const items=agendaItems(data).map(item=>({...item,signedCents:item.type==='receivable'?item.cents:-item.cents}));
  for(const t of cashTransactions(data)){
    if(!['ENTRADA','RESGATE','INVESTIMENTOS'].includes(t.tipo)||paymentInfo(t).status==='pago')continue;
    const signedCents=cashSignedCents(t);if(!signedCents)continue;
    items.push({type:t.tipo==='INVESTIMENTOS'?'investment':'income',title:t.desc,due:agendaValidDate(t.dueDate||t.data),signedCents});
  }
  return items;
}
function buildCashProjection(data,days,includeReceivables,today=localDate()){
  const checkpoint=data.cashCheckpoint;
  if(!checkpoint||!Number.isSafeInteger(checkpoint.balanceCents)||!Number.isSafeInteger(checkpoint.settledCents))return null;
  if(!Number.isInteger(days)||days<1||days>180||!agendaValidDate(today))throw new Error('Período de projeção inválido.');
  const realizedDelta=cashSettledCents(data)-checkpoint.settledCents;
  const opening=checkpoint.balanceCents+realizedDelta;
  const movements=cashMovements(data),included=movements.filter(item=>includeReceivables||item.type!=='receivable');
  const undated=included.filter(item=>!item.due),dated=included.filter(item=>item.due);
  let balance=opening,minimum=opening,firstNegative=opening<0?today:'';
  const timeline=Array.from({length:days},(_,index)=>{
    const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+index);const date=d.toISOString().slice(0,10);
    const items=dated.filter(item=>(item.due<today?today:item.due)===date);
    const incoming=items.filter(i=>i.signedCents>0).reduce((s,i)=>s+i.signedCents,0);
    const outgoing=-items.filter(i=>i.signedCents<0).reduce((s,i)=>s+i.signedCents,0);
    balance+=incoming-outgoing;minimum=Math.min(minimum,balance);if(balance<0&&!firstNegative)firstNegative=date;
    return {date,items,incoming,outgoing,balance};
  });
  return {opening,realizedDelta,timeline,minimum,firstNegative,final:balance,undated,
    overdue:dated.filter(i=>i.due<today),outside:dated.filter(i=>i.due>timeline.at(-1).date),
    incoming:timeline.reduce((s,d)=>s+d.incoming,0),outgoing:timeline.reduce((s,d)=>s+d.outgoing,0),
    excludedReceivables:includeReceivables?0:movements.filter(i=>i.type==='receivable').reduce((s,i)=>s+i.signedCents,0)};
}
function cashChart(projection){
  const values=[projection.opening,...projection.timeline.map(day=>day.balance)],low=Math.min(0,...values),high=Math.max(0,...values),range=high-low||100;
  const x=i=>65+i/(values.length-1)*615,y=value=>20+(high-value)/range*170;
  const points=values.map((value,i)=>x(i).toFixed(2)+','+y(value).toFixed(2)).join(' ');
  return '<svg viewBox="0 0 700 235" role="img" aria-labelledby="cashChartTitle cashChartDescription"><title id="cashChartTitle">Evolução do saldo projetado</title><desc id="cashChartDescription">Saldo disponível inicial '+brl(projection.opening/100)+', saldo final '+brl(projection.final/100)+'. Consulte os valores e compromissos por dia abaixo.</desc><line x1="65" x2="680" y1="'+y(0)+'" y2="'+y(0)+'" stroke="var(--text3)" stroke-dasharray="4 4"/><polyline points="'+points+'" fill="none" stroke="var(--accent2)" stroke-width="3"/><text x="4" y="18" fill="var(--text2)" font-size="12">'+brl(high/100)+'</text><text x="4" y="205" fill="var(--text2)" font-size="12">'+brl(low/100)+'</text><text x="65" y="228" fill="var(--text2)" font-size="12">'+projection.timeline[0].date.split('-').reverse().join('/')+'</text><text x="680" y="228" text-anchor="end" fill="var(--text2)" font-size="12">'+projection.timeline.at(-1).date.split('-').reverse().join('/')+'</text></svg>';
}
function renderCash(){
  const checkpoint=DATA.cashCheckpoint;
  document.getElementById('cashBalance').value=checkpoint?(checkpoint.balanceCents/100).toFixed(2):'';
  document.getElementById('cashCheckpointNote').textContent=checkpoint?'Última conferência: '+checkpoint.date.split('-').reverse().join('/')+' · '+brl(checkpoint.balanceCents/100)+'.':'Informe o saldo disponível real de hoje para iniciar. Não use o saldo de investimentos.';
  const projection=buildCashProjection(DATA,Number(document.getElementById('cashHorizon').value),document.getElementById('cashReceivables').checked);
  for(const id of ['cashSummary','cashChart','cashDays','cashWarnings'])document.getElementById(id).innerHTML='';
  document.getElementById('cashAlert').textContent='';
  document.getElementById('cashChart').hidden=!projection;
  document.getElementById('cashWarnings').hidden=!projection;
  if(!projection)return;
  const p=projection;
  document.getElementById('cashBalance').value=(p.opening/100).toFixed(2);
  document.getElementById('cashSummary').innerHTML=[['Disponível estimado agora',p.opening],['Entradas previstas',p.incoming],['Saídas previstas',-p.outgoing],['Saldo ao fim do período',p.final]].map(([label,cents])=>'<div class="card"><div class="card-label">'+label+'</div><div class="card-val '+(cents>=0?'g':'r')+'">'+brl(cents/100)+'</div></div>').join('');
  document.getElementById('cashAlert').textContent=(p.firstNegative?'Atenção: saldo negativo a partir de '+p.firstNegative.split('-').reverse().join('/')+'. ':'Nenhum saldo negativo previsto neste período. ')+'Menor saldo, incluindo o inicial: '+brl(p.minimum/100)+'.';
  document.getElementById('cashAlert').style.color=p.firstNegative?'var(--red)':'var(--green)';
  document.getElementById('cashChart').innerHTML=cashChart(p);
  document.getElementById('cashDays').innerHTML=p.timeline.filter((d,i)=>d.items.length||i===0||i===p.timeline.length-1).map(day=>'<details class="card" style="margin-bottom:10px"><summary>'+day.date.split('-').reverse().join('/')+' · Entradas '+brl(day.incoming/100)+' · Saídas '+brl(day.outgoing/100)+' · Saldo '+brl(day.balance/100)+'</summary>'+day.items.map(item=>'<p class="field-help">'+escapeHTML(item.title)+' · '+(item.signedCents>=0?'+':'−')+brl(Math.abs(item.signedCents)/100)+(item.due<localDate()?' · Vencido em '+item.due.split('-').reverse().join('/'):'')+'</p>').join('')+'</details>').join('');
  const warnings=[
    'Movimentação líquida registrada como paga/recebida desde a conferência: '+brl(p.realizedDelta/100)+'. Correções e exclusões de registros antigos também alteram esse ajuste; nesses casos, confira o saldo novamente.',
    p.overdue.length+' compromisso(s) vencido(s) posicionado(s) em hoje como hipótese de pagamento/recebimento, sem alterar suas datas originais.',
    p.outside.length+' compromisso(s) com data após o período selecionado, fora desta projeção.',
    p.excludedReceivables?'Devoluções previstas excluídas do cenário: '+brl(p.excludedReceivables/100)+'.':'Devoluções previstas incluídas: o recebimento não é garantido.',
  ];
  if(!document.getElementById('cashReceivables').checked&&!p.excludedReceivables)warnings[warnings.length-1]='Nenhuma devolução prevista incluída neste cenário.';
  document.getElementById('cashWarnings').innerHTML=warnings.map(text=>'<p class="field-help">'+escapeHTML(text)+'</p>').join('')+(p.undated.length?'<details><summary>'+p.undated.length+' compromisso(s) sem vencimento, fora da projeção</summary>'+p.undated.map(item=>'<p class="field-help">'+escapeHTML(item.title)+' · '+brl(Math.abs(item.signedCents)/100)+'</p>').join('')+'</details>':'');
}
async function saveCashCheckpoint(event){
  event.preventDefault();
  const raw=document.getElementById('cashBalance').value,cents=Math.round((Number(raw)+Number.EPSILON)*100);
  if(!raw.trim()||!Number.isSafeInteger(cents)){alert('Informe um saldo válido. Zero e saldo negativo são permitidos.');return;}
  if(!confirm('Conferir o saldo disponível de hoje em '+brl(cents/100)+'? Ele deve incluir entradas já recebidas e descontar pagamentos já feitos.'))return;
  if(!await persistPlanningChange(()=>{
    const settledCents=cashSettledCents();if(!Number.isSafeInteger(settledCents))throw new Error('Os valores registrados ultrapassam o limite de cálculo.');
    if(DATA.cashCheckpoint){DATA.cashBalanceHistory??=[];DATA.cashBalanceHistory.push({...DATA.cashCheckpoint});}
    DATA.cashCheckpoint={balanceCents:cents,settledCents,date:localDate(),recordedAt:new Date().toISOString()};
  }))return;
  renderCash();
}
document.getElementById('cashBalanceForm').addEventListener('submit',saveCashCheckpoint);
