let obligationKind='receivable';
let editingObligationId=null;
let settlingObligationId=null;
function renderObligations(kind){
  const items=obligations(kind),remaining=items.reduce((s,item)=>s+pendingRemaining(item),0);
  const paid=items.reduce((s,item)=>s+pendingPaid(item),0);
  const prefix=kind==='receivable'?'receivables':'replacements';
  document.getElementById(prefix+'Summary').innerHTML=[
    ['Pendente',remaining,'y'],[kind==='receivable'?'Recebido':'Reposto',paid,'g'],['Total registrado',remaining+paid,'a'],
  ].map(([label,value,color])=>`<div class="card"><div class="card-label">${label}</div><div class="card-val ${color}">${brl(value)}</div></div>`).join('');
  document.getElementById(prefix+'List').innerHTML=items.length?[...items].sort((a,b)=>(pendingRemaining(b)>0)-(pendingRemaining(a)>0)||(a.due||'9999').localeCompare(b.due||'9999')).map(item=>{
    const balance=pendingRemaining(item),overdue=balance>0&&item.due&&item.due<localDate();
    return `<article class="obligation-item"><div class="obligation-info"><h3>${escapeHTML(item.description)}</h3><p>${escapeHTML(item.person||'Reposição da carteira')} · ${escapeHTML(item.date)}${item.due?' · Previsto: '+escapeHTML(item.due):''}</p><span class="payment-status ${balance===0?'is-paid':'is-pending'}">${balance===0?'Concluído':overdue?'Em atraso':'Pendente'}</span><p>Total: ${brl(item.amount)} · ${kind==='receivable'?'Recebido':'Reposto'}: ${brl(pendingPaid(item))}</p>${item.sourceId?'<p>Vinculado a um lançamento existente.</p>':''}${(item.payments||[]).length?`<details class="settlement-history"><summary>Histórico (${item.payments.length})</summary>${item.payments.map(p=>`<p>${escapeHTML(p.date)} · ${brl(p.amount)} <button type="button" class="btn btn-g btn-sm" onclick="undoSettlement('${item.id}','${p.id}')">Estornar</button></p>`).join('')}</details>`:''}</div><div class="obligation-actions"><strong>${brl(balance)}</strong>${balance>0?`<button class="btn btn-p btn-sm" onclick="openSettlement('${item.id}')">${kind==='receivable'?'Registrar recebimento':'Registrar reposição'}</button>`:''}<button class="btn btn-g btn-sm" onclick="openObligation('${kind}','${item.id}')">Editar</button>${!(item.payments||[]).length?`<button class="btn btn-d btn-sm" onclick="deleteObligation('${item.id}')">Excluir</button>`:''}</div></article>`;
  }).join(''):'<p class="empty">Nenhuma pendência registrada.</p>';
}
function renderReceivables(){renderObligations('receivable');}
function openObligation(kind,id=null){
  obligationKind=kind;editingObligationId=id;
  const item=(DATA.obligations||[]).find(item=>item.id===id);
  document.getElementById('obligationTitle').textContent=kind==='receivable'?'Devolução a receber':'Resgate a repor';
  for(const [field,value] of Object.entries({oDescription:item?.description||'',oPerson:item?.person||'',oAmount:item?.amount||'',oDate:item?.date||localDate(),oDue:item?.due||''}))document.getElementById(field).value=value;
  document.getElementById('oPersonGroup').hidden=kind!=='receivable';
  document.getElementById('oSourcePicker').hidden=!!item;
  if(!item){
    const months=Object.entries(obligationSourceYears()).sort(([a],[b])=>Number(b)-Number(a))
      .flatMap(([year,period])=>MK.flatMap((month,index)=>period.months[month]
        ? [{key:year+':'+month,label:MONTHS[index]+' de '+year}]:[]).reverse());
    const period=document.getElementById('oSourcePeriod');
    period.innerHTML=obligationSourceOptions('Selecione o mês e o ano',months);
    period.value='';
    updateObligationSourceFilters();
  }
  document.getElementById('oSourceHelp').textContent=item?.sourceId?'O vínculo original será preservado.':(item?'':'Para registrar manualmente, deixe o lançamento de origem em branco.');
  openModal('moObligation');
}
function obligationSourceYears(){
  return DATA.years||{[activeYear()]:getYearData()};
}
function obligationSourcePeriod(){
  const [year,month]=document.getElementById('oSourcePeriod').value.split(':');
  return {year:Number(year),month};
}
function obligationSourceTransactions(){
  const {year,month}=obligationSourcePeriod();
  const type=obligationKind==='receivable'?'SAÍDA':'RESGATE';
  return (obligationSourceYears()[year]?.months[month]?.transactions||[])
    .filter(t=>t.tipo===type);
}
function obligationSourceOptions(placeholder,options){
  return `<option value="">${escapeHTML(placeholder)}</option>`+options.map(({key,label})=>
    `<option value="${escapeHTML(key)}">${escapeHTML(label)}</option>`).join('');
}
function updateObligationSourceFilters(){
  const transactions=obligationSourceTransactions();
  const category=document.getElementById('oSourceCategory');
  const method=document.getElementById('oSourceMethod');
  const categories=[...new Set(transactions.map(t=>t.categoria||'Sem categoria'))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const methods=[...new Set(transactions.map(t=>paymentInfo(t).method))];
  category.innerHTML=obligationSourceOptions('Todas as categorias',categories.map(key=>({key,label:key})));
  method.innerHTML=obligationSourceOptions('Todas as formas de pagamento',methods.map(key=>({key,label:PAYMENT_METHODS[key]||key})));
  category.value='';
  method.value='';
  document.getElementById('oSourceSearch').value='';
  document.getElementById('oSourceFilters').hidden=!transactions.length;
  document.getElementById('oSource').value='';
  renderObligationSources();
}
function renderObligationSources(){
  const category=document.getElementById('oSourceCategory').value;
  const method=document.getElementById('oSourceMethod').value;
  const search=document.getElementById('oSourceSearch').value.trim().toLocaleLowerCase('pt-BR');
  const period=document.getElementById('oSourcePeriod').value;
  const source=document.getElementById('oSource');
  const selected=source.value;
  const options=obligationSourceTransactions().filter(t=>
    (!category||(t.categoria||'Sem categoria')===category)
    &&(!method||paymentInfo(t).method===method)
    &&(!search||(t.desc||'').toLocaleLowerCase('pt-BR').includes(search)))
    .sort((a,b)=>(b.data||'').localeCompare(a.data||''))
    .map(t=>({key:t.id,label:[t.data,t.desc,brl(t.valor)].filter(Boolean).join(' · ')}));
  source.innerHTML=obligationSourceOptions(period?'Selecione um lançamento':'Selecione primeiro o mês e o ano',options);
  source.disabled=!options.length;
  source.value=options.some(({key})=>key===selected)?selected:'';
  const results=document.getElementById('oSourceResults');
  results.textContent=period&&!options.length?'Nenhum lançamento encontrado.':'';
  if(selected&&!source.value)results.textContent+=' Selecione novamente o lançamento para vincular.';
}
function selectedObligationSource(){
  const id=document.getElementById('oSource').value;
  return obligationSourceTransactions().find(t=>t.id===id);
}
function selectObligationSource(){
  const t=selectedObligationSource();
  if(!t)return;
  document.getElementById('oDescription').value=t.desc;
  document.getElementById('oAmount').value=t.valor;
  document.getElementById('oDate').value=t.data||localDate();
}
async function submitObligation(event){
  event.preventDefault();
  const old=(DATA.obligations||[]).find(item=>item.id===editingObligationId);
  const item={...old,id:old?.id||uuid(),kind:obligationKind,description:document.getElementById('oDescription').value.trim(),person:document.getElementById('oPerson').value.trim(),amount:Number(document.getElementById('oAmount').value),date:document.getElementById('oDate').value,due:document.getElementById('oDue').value,payments:old?.payments||[]};
  if(!item.description||!item.date||!Number.isFinite(item.amount)||item.amount<=0){alert('Informe descrição, data e valor maior que zero.');return;}
  if(item.kind==='receivable'&&!item.person){alert('Informe quem fará a devolução.');return;}
  if(item.amount<pendingPaid(item)){alert('O total não pode ser menor que o valor já devolvido.');return;}
  if(!old&&document.getElementById('oSource').value){
    const source=selectedObligationSource();
    if(!source){alert('Selecione um lançamento de origem válido.');return;}
    const {year,month}=obligationSourcePeriod();
    item.sourceId=source.id;item.sourceMonth=month;item.sourceYear=year;
  }
  if(!await persistPlanningChange(()=>saveObligation(item)))return;
  closeModal('moObligation');renderPage(curPage);
}
function openSettlement(id){
  const item=(DATA.obligations||[]).find(item=>item.id===id);if(!item)return;
  settlingObligationId=id;
  document.getElementById('settlementTitle').textContent=item.kind==='receivable'?'Registrar recebimento':'Registrar reposição';
  document.getElementById('sAmount').value=pendingRemaining(item);document.getElementById('sAmount').max=pendingRemaining(item);
  document.getElementById('sDate').value=localDate();
  document.getElementById('settlementHelp').textContent=item.kind==='receivable'?'Será criada uma entrada na data informada. O gasto original permanece no histórico.':'Será criado um lançamento de investimentos na data informada. O saldo manual da carteira permanece como informado.';
  openModal('moSettlement');
}
async function submitSettlement(event){
  event.preventDefault();
  const item=(DATA.obligations||[]).find(item=>item.id===settlingObligationId);if(!item)return;
  const submit=event.submitter;if(submit)submit.disabled=true;
  try{
    if(!await persistPlanningChange(()=>registerSettlement(item,Number(document.getElementById('sAmount').value),document.getElementById('sDate').value)))return;
    closeModal('moSettlement');renderPage(curPage);
  }finally{if(submit)submit.disabled=false;}
}
async function deleteObligation(id){
  const item=(DATA.obligations||[]).find(item=>item.id===id);
  if(!item||(item.payments||[]).length||!confirm('Excluir esta pendência? O lançamento original será mantido.'))return;
  if(await persistPlanningChange(()=>{DATA.obligations=DATA.obligations.filter(item=>item.id!==id);}))renderPage(curPage);
}
async function undoSettlement(id,paymentId){
  const item=(DATA.obligations||[]).find(item=>item.id===id);
  if(!item||!confirm('Estornar esta devolução? O lançamento gerado será removido e o valor voltará a ficar pendente.'))return;
  if(await persistPlanningChange(()=>reverseSettlement(item,paymentId)))renderPage(curPage);
}
