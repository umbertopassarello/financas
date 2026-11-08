// =====================================================================
// LANÇAMENTOS
// =====================================================================
const lancFilters = {tipo:new Set(),categoria:new Set(),cartao:new Set(),forma:new Set(),status:new Set(),mov:new Set()};
let lancSort={key:'data',direction:'desc'};
let selectedLancIds=new Set();
let visibleLancIds=[];
function setLancSort(key){
  lancSort.direction=lancSort.key===key?(lancSort.direction==='asc'?'desc':'asc'):(key==='valor'||key==='data'?'desc':'asc');
  lancSort.key=key;renderLanc();
}
function reverseLancSort(){lancSort.direction=lancSort.direction==='asc'?'desc':'asc';renderLanc();}
function selectLanc(input){
  if(input.checked)selectedLancIds.add(input.dataset.id);else selectedLancIds.delete(input.dataset.id);
  updateLancSelection();
}
function updateLancSelection(){
  document.querySelectorAll('.lCheck').forEach(input=>input.checked=selectedLancIds.has(input.dataset.id));
  const all=document.getElementById('checkAll');
  all.checked=visibleLancIds.length>0&&selectedLancIds.size===visibleLancIds.length;
  all.indeterminate=selectedLancIds.size>0&&!all.checked;
  document.getElementById('selectedLancCount').textContent=selectedLancIds.size+' selecionado(s)';
  document.getElementById('deleteSelectedLanc').disabled=selectedLancIds.size===0;
}
async function deleteSelectedLanc(){
  const month=getYearData().months[MK[DATA.currentMonth]];
  const ids=new Set(month.transactions.filter(t=>selectedLancIds.has(t.id)&&visibleLancIds.includes(t.id)&&canDeleteTransaction(t)).map(t=>t.id));
  if(!ids.size||!confirm(`Excluir ${ids.size} lançamento(s) selecionado(s)? Esta ação não pode ser desfeita.`))return;
  if(!await persistPlanningChange(()=>{month.transactions=month.transactions.filter(t=>!ids.has(t.id));}))return;
  selectedLancIds.clear();renderLanc();
}
function renderLancFilters(txs){
  const unique=values=>[...new Set(values)].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const options={
    tipo:['ENTRADA','SAÍDA','INVESTIMENTOS','RESGATE'].map(v=>[v,v]),
    categoria:unique(txs.map(t=>t.categoria||'Sem categoria')).map(v=>[v,v]),
    cartao:unique(txs.map(t=>paymentInfo(t).card||'sem_cartao')).map(v=>[v,v==='sem_cartao'?'Sem cartão':cardInfo(v).l]),
    forma:Object.entries(PAYMENT_METHODS),status:[['pago','Pago'],['pendente','Pendente']],
    mov:unique(txs.map(t=>t.tipoMov||'Sem movimentação')).map(v=>[v,v]),
  };
  const labels={tipo:'Tipos',categoria:'Categorias',cartao:'Cartões / Faturas',forma:'Formas de pagamento',status:'Status',mov:'Movimentação'};
  const host=document.getElementById('lancFilters');
  for(const [key,items] of Object.entries(options)){
    let details=document.getElementById('filter-'+key);
    if(!details){
      details=document.createElement('details');details.id='filter-'+key;details.className='multi-filter';
      details.innerHTML='<summary></summary><div class="multi-filter-panel"></div>';host.append(details);
    }
    details.querySelector('summary').textContent=labels[key]+(lancFilters[key].size?' ('+lancFilters[key].size+')':' · Todos');
    const panel=details.querySelector('.multi-filter-panel');
    const signature=JSON.stringify(items);
    if(panel.dataset.options!==signature){
      panel.innerHTML=`<button type="button" class="btn btn-g btn-sm" onclick="clearLancFilter('${key}')">Limpar seleção</button>`+items.map(([value,label])=>'<label class="filter-option"><input type="checkbox" data-filter="'+key+'" value="'+escapeHTML(value)+'" onchange="changeLancFilter(this)"><span>'+escapeHTML(label)+'</span></label>').join('');
      panel.dataset.options=signature;
    }
    panel.querySelectorAll('input').forEach(input=>input.checked=lancFilters[key].has(input.value));
  }
}
function changeLancFilter(input){
  const selected=lancFilters[input.dataset.filter];
  if(input.checked)selected.add(input.value);else selected.delete(input.value);
  renderLanc();
}
function clearLancFilter(key){lancFilters[key].clear();renderLanc();}
document.addEventListener('click',event=>{
  document.querySelectorAll('.multi-filter[open]').forEach(details=>{if(!details.contains(event.target))details.open=false;});
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape')document.querySelectorAll('.multi-filter[open]').forEach(details=>{details.open=false;});
});
function summaryCards(total,previous,filtered){
  const balance=total.saldo+(filtered?0:previous);
  const cards=[
    ['Entradas',total.entradas,'g','Receitas lançadas'],
    ['Gastos',total.gastos,'r','Pagos e pendentes'],
    ['Investimentos',total.investimentos,'a','Resgates: '+brl(total.resgates)],
    [filtered?'Resultado filtrado':'Saldo atual',balance,balance>=0?'g':'r',filtered?'Entradas + resgates − gastos − investimentos':'Saldo anterior: '+brl(previous)],
  ];
  if(!filtered)cards.splice(2,0,['Saldo mensal',total.entradas-total.gastos,total.entradas-total.gastos>=0?'g':'r','Entradas − gastos, sem saldo anterior']);
  return cards.map(([label,value,color,note])=>'<div class="card"><div class="card-label">'+label+'</div><div class="card-val '+color+'">'+brl(value)+'</div><div class="card-sub">'+note+'</div></div>').join('');
}
function renderLanc(){
  const month=getYearData().months[MK[DATA.currentMonth]];
  const all=month.transactions;
  document.getElementById('lancMes').textContent=MONTHS[DATA.currentMonth];
  document.getElementById('lancResumoMes').textContent='· '+MONTHS[DATA.currentMonth];
  renderLancFilters(all);
  const txs=sortTransactions(filterTransactions(all,{
    ...lancFilters,search:document.getElementById('fSearch').value.trim(),
    from:document.getElementById('fDe').value,to:document.getElementById('fAte').value,
  }),lancSort.key,lancSort.direction);
  visibleLancIds=txs.filter(t=>canDeleteTransaction(t)).map(t=>t.id);
  selectedLancIds=new Set([...selectedLancIds].filter(id=>visibleLancIds.includes(id)));
  document.getElementById('sortLanc').value=lancSort.key;
  document.getElementById('sortLancDirection').textContent=lancSort.direction==='asc'?'Crescente / A–Z ↑':'Decrescente / Z–A ↓';
  document.querySelectorAll('th[data-sort]').forEach(th=>th.setAttribute('aria-sort',th.dataset.sort===lancSort.key?(lancSort.direction==='asc'?'ascending':'descending'):'none'));
  const total=transactionTotals(txs);
  document.getElementById('lancSummary').innerHTML=summaryCards(transactionTotals(all),Number(month.resumo?.saldoAnterior)||0,false);
  document.getElementById('lancFilteredSummary').innerHTML=summaryCards(total,0,true);
  document.getElementById('lancResultCount').textContent=txs.length+' de '+all.length+' lançamentos';
  document.getElementById('lancPaymentSummary').textContent='Gastos pagos: '+brl(total.pagos)+' · Gastos pendentes: '+brl(total.pendentes);
  document.getElementById('checkAll').checked=false;
  document.getElementById('lancTbody').innerHTML=txs.length?txs.map(t=>lancRow(t)).join(''):'<tr><td colspan="9" class="empty">Nenhum lançamento encontrado</td></tr>';
  document.getElementById('lancMobile').innerHTML=txs.length?txs.map(t=>mobileItemTx(t,true)).join(''):'<div class="empty">Nenhum lançamento encontrado</div>';
  updateLancSelection();
}
function lancRow(t){
  const vc=t.tipo==='ENTRADA'?'g':t.tipo==='INVESTIMENTOS'?'a':t.tipo==='RESGATE'?'p':'r';
  const sg=t.tipo==='ENTRADA'||t.tipo==='RESGATE'?'+':t.tipo==='INVESTIMENTOS'?'◈':'-';
  const mc={'ENTRADA':'mb-e','SAÍDA':'mb-s','INVESTIMENTOS':'mb-i','RESGATE':'mb-r'}[t.tipo]||'mb-s';
  const mm={'Fixo':'tt-fixo','Parcelado':'tt-parc','Variável':'tt-var'}[t.tipoMov]||'';
  return`<tr><td><input type="checkbox" class="lCheck" data-id="${t.id}" onchange="selectLanc(this)" ${canDeleteTransaction(t)?'':'disabled'} aria-label="Selecionar transacao" title="Lancamentos vinculados a pendencias devem ser corrigidos na aba correspondente"></td><td><span class="mbadge ${mc}">${t.tipo}</span></td><td class="td-desc">${t.desc}</td><td class="td-val ${vc}">${sg} ${brl(t.valor)}</td><td class="td-sm">${t.data||'—'}</td><td class="td-sm">${t.categoria||'—'}</td><td>${t.tipoMov?`<span class="ttag ${mm}">${t.tipoMov}</span>`:''}</td><td><span class="payment-badges">${paymentBadges(t)}</span></td><td style="display:flex;gap:4px"><button class="btn btn-g btn-sm" onclick="editLanc('${t.id}')">✎</button><button class="btn btn-d btn-sm" onclick="delLanc('${t.id}')">✕</button></td></tr>`;
}
function mobileItemTx(t, showActs=false){
  const vc=t.tipo==='ENTRADA'?'var(--green)':t.tipo==='INVESTIMENTOS'?'var(--accent2)':t.tipo==='RESGATE'?'var(--purple)':'var(--red)';
  const sg=t.tipo==='ENTRADA'||t.tipo==='RESGATE'?'+':t.tipo==='INVESTIMENTOS'?'◈':'-';
  const ico={'ENTRADA':'💰','SAÍDA':'💸','INVESTIMENTOS':'📈','RESGATE':'💎'}[t.tipo]||'💸';
  const bg={'ENTRADA':'rgba(62,207,142,.1)','SAÍDA':'rgba(244,100,95,.1)','INVESTIMENTOS':'rgba(124,106,247,.1)','RESGATE':'rgba(199,125,255,.1)'}[t.tipo]||'rgba(244,100,95,.1)';
  return`<div class="mobile-item">${showActs?`<input type="checkbox" class="lCheck" data-id="${t.id}" onchange="selectLanc(this)" ${canDeleteTransaction(t)?'':'disabled'} aria-label="Selecionar transacao">`:''}<div class="mobile-item-icon" style="background:${bg}">${ico}</div><div class="mobile-item-body"><div class="mobile-item-desc">${t.desc}</div><div class="mobile-item-sub"><span>${t.data||'—'}</span><span>${t.categoria||'—'}</span><span class="payment-badges">${paymentBadges(t)}</span></div></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px"><span class="mobile-item-val" style="color:${vc}">${sg} ${brl(t.valor)}</span>${showActs?`<div style="display:flex;gap:3px"><button class="btn btn-g btn-sm" style="padding:3px 7px" onclick="editLanc('${t.id}')">✎</button><button class="btn btn-d btn-sm" style="padding:3px 7px" onclick="delLanc('${t.id}')">✕</button></div>`:''}</div></div>`;
}
function clearFilters(){['fSearch','fDe','fAte'].forEach(id=>document.getElementById(id).value='');Object.values(lancFilters).forEach(set=>set.clear());renderLanc();}
function toggleAll(cb){selectedLancIds=cb.checked?new Set(visibleLancIds):new Set();updateLancSelection();}
function openAddLanc(){
  editingLancId=null;document.getElementById('moLancTitle').textContent='Novo Lançamento';
  ['lTipo','lMov','lDesc','lValor','lCat'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('lTipo').value='SAÍDA';
  populatePaymentFields({});
  const now=new Date();
  document.getElementById('lData').value=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  onTipoChg();openModal('moLanc');
}
function editLanc(id){
  const mk=MK[DATA.currentMonth],t=getYearData().months[mk].transactions.find(x=>x.id===id);if(!t)return;
  if(t.obligationId){alert('Este lançamento foi gerado por uma devolução ou reposição. Para corrigir, estorne o registro no histórico da pendência e registre novamente.');return;}
  editingLancId=id;document.getElementById('moLancTitle').textContent='Editar Lançamento';
  document.getElementById('lTipo').value=t.tipo;document.getElementById('lMov').value=t.tipoMov||'';
  document.getElementById('lDesc').value=t.desc;document.getElementById('lValor').value=t.valor;
  document.getElementById('lCat').value=t.categoria||'';
  if(t.categoria && !document.getElementById('lCat').value){
    const option=document.createElement('option');option.value=t.categoria;option.textContent=t.categoria;
    document.getElementById('lCat').append(option);document.getElementById('lCat').value=t.categoria;
  }
  populatePaymentFields(t);
  document.getElementById('lData').value=t.data||'';onTipoChg();openModal('moLanc');
}
function populatePaymentFields(t){
  const p=paymentInfo(t);
  const keys=[...new Set([...Object.keys(BANKS),...Object.keys(DATA.customBanks||{}),p.card].filter(k=>k&&k!=='pago'))];
  document.getElementById('lBanco').innerHTML='<option value="">Selecione o cartão</option>'+keys.map(k=>`<option value="${escapeHTML(k)}">${escapeHTML(cardInfo(k).l)}</option>`).join('');
  const method=document.getElementById('lForma');
  if(![...method.options].some(option=>option.value===p.method)){
    const option=document.createElement('option');option.value=p.method;option.textContent=p.method;method.append(option);
  }
  method.value=p.method;document.getElementById('lBanco').value=p.card;
  document.getElementById('lStatus').value=p.status;
  onPaymentMethodChange();
}
function onPaymentMethodChange(){
  const method=document.getElementById('lForma').value;
  document.getElementById('bancoGrp').style.display=['credito','debito'].includes(method)?'flex':'none';
}
function onTipoChg(){onPaymentMethodChange();}
async function salvarLanc(){
  const mk=MK[DATA.currentMonth];
  const previous=getYearData().months[mk].transactions.find(t=>t.id===editingLancId);
  const method=document.getElementById('lForma').value;
  const card=['credito','debito'].includes(method)?document.getElementById('lBanco').value:'';
  const t={...previous,id:editingLancId||uuid(),tipo:document.getElementById('lTipo').value,desc:document.getElementById('lDesc').value.trim(),valor:parseFloat(document.getElementById('lValor').value),categoria:document.getElementById('lCat').value,tipoMov:document.getElementById('lMov').value,formaPagamento:method,cartao:card,status:document.getElementById('lStatus').value,banco:card||'pago',data:document.getElementById('lData').value};
  if(!t.desc||!Number.isFinite(t.valor)||t.valor<=0){alert('Preencha a descrição e um valor maior que zero.');return;}
  if(['credito','debito'].includes(method)&&!card){alert('Selecione o cartão utilizado.');return;}
  if(!editingLancId){
    getYearData().months[mk].transactions.unshift(t);
  } else {
    const idx=getYearData().months[mk].transactions.findIndex(x=>x.id===editingLancId);
    if(idx>=0) getYearData().months[mk].transactions[idx]=t;
  }
  editingLancId=null;closeModal('moLanc');await saveData();renderLanc();
}
async function delLanc(id){
  if(!confirm('Remover lançamento?'))return;
  const mk=MK[DATA.currentMonth];
  const t=getYearData().months[mk].transactions.find(x=>x.id===id);
  if(t&&!canDeleteTransaction(t)){alert('Este lançamento está ligado a uma pendência. Remova ou estorne o vínculo na aba correspondente antes de excluir.');return;}
  if(t?.obligationId){alert('Estorne este registro no histórico da pendência correspondente para manter os valores consistentes.');return;}
  getYearData().months[mk].transactions=getYearData().months[mk].transactions.filter(x=>x.id!==id);
  await saveData();renderLanc();
}
function openQuitarFatura(){
  const mk=MK[DATA.currentMonth];
  const bancos=[...new Set(getYearData().months[mk].transactions.filter(t=>{const p=paymentInfo(t);return t.tipo==='SAÍDA'&&p.method==='credito'&&p.status==='pendente'&&p.card;}).map(t=>paymentInfo(t).card))];
  document.getElementById('qBancos').innerHTML=bancos.map(b=>{const info=cardInfo(b);return`<label class="cb-item"><input type="checkbox" value="${escapeHTML(b)}"><span class="btag ${escapeHTML(info.c)}" style="margin-left:4px">${escapeHTML(info.l)}</span></label>`;}).join('')||'<span style="color:var(--text3);font-size:13px">Nenhuma fatura em aberto.</span>';
  openModal('moQuitar');
}
async function quitarFaturas(){
  const checked=[...document.querySelectorAll('#qBancos input:checked')].map(c=>c.value);
  if(!checked.length){alert('Selecione pelo menos uma fatura.');return;}
  const mk=MK[DATA.currentMonth];
  const count=markCardInvoicesPaid(getYearData().months[mk].transactions,checked);
  closeModal('moQuitar');await saveData();renderLanc();
  alert(`✅ ${count} lançamento(s) marcado(s) como pago!`);
}

