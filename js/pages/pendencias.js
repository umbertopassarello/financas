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
  const period=getYearData(),options=[];
  MK.forEach(mk=>(period.months[mk]?.transactions||[]).filter(t=>t.tipo===(kind==='receivable'?'SAÍDA':'RESGATE')).forEach(t=>options.push({key:mk+':'+t.id,mk,t})));
  document.getElementById('oSource').innerHTML='<option value="">Sem vínculo (registro manual)</option>'+options.map(({key,mk,t})=>`<option value="${escapeHTML(key)}">${escapeHTML(MONTHS[MK.indexOf(mk)]+' · '+t.desc+' · '+brl(t.valor))}</option>`).join('');
  const source=document.getElementById('oSource');
  source.value=item?.sourceId&&item.sourceYear===activeYear()?item.sourceMonth+':'+item.sourceId:'';
  source.disabled=!!item;
  document.getElementById('oSourceHelp').textContent=item?.sourceId?'O vínculo original será preservado.':'Vincular não cria outra saída nem outro resgate. Sem vínculo, informe um valor já gasto ou resgatado.';
  openModal('moObligation');
}
function selectObligationSource(){
  const [mk,id]=document.getElementById('oSource').value.split(':');
  const t=getYearData().months[mk]?.transactions.find(t=>t.id===id);
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
  if(!old&&document.getElementById('oSource').value){const [mk,id]=document.getElementById('oSource').value.split(':');item.sourceId=id;item.sourceMonth=mk;item.sourceYear=activeYear();}
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
