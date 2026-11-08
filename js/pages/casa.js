let editingCasaId=null;
function houseItems(){return getYearData().casa?.[casaMes]||[];}
function payerText(item){return (item.payer==='eu'?'Você':item.payer==='outro'?(item.payerName||'Outra pessoa'):'Não informado')+' · '+(item.paymentStatus==='pago'?'Pago: '+brl(item.paidAmount??item.valor):'Vai pagar / pendente');}
function renderCasa(){
  document.getElementById('casaTabs').innerHTML=MK.map((k,i)=>`<button class="tab${k===casaMes?' active':''}" onclick="setCasaMes('${k}')">${MONTHS[i].slice(0,3)}</button>`).join('');
  const items=houseItems(),totals=houseTotals(items);
  const actions=item=>`<button class="btn btn-g btn-sm" onclick="openCasa('${item.id}')">Editar</button><button class="btn btn-d btn-sm" onclick="delCasa('${item.id}')" aria-label="Excluir item">✕</button>`;
  document.getElementById('casaTbody').innerHTML=items.length?items.map(item=>`<tr><td>${escapeHTML(item.desc)}</td><td>÷${item.divisao}</td><td class="td-val">${brl(item.valor)}</td><td class="td-val">${brl(item.valor/item.divisao)}</td><td class="td-sm">${escapeHTML(payerText(item))}</td><td><div class="tbl-acts">${actions(item)}</div></td></tr>`).join(''):'<tr><td colspan="6" class="empty">Nenhum item</td></tr>';
  document.getElementById('casaMobile').innerHTML=items.length?items.map(item=>`<div class="mobile-item"><div class="mobile-item-body"><div class="mobile-item-desc">${escapeHTML(item.desc)}</div><div class="mobile-item-sub">${escapeHTML(payerText(item))} · Total: ${brl(item.valor)} ÷ ${item.divisao}</div><div class="tbl-acts">${actions(item)}</div></div><span class="mobile-item-val">${brl(item.valor/item.divisao)}</span></div>`).join(''):'<p class="empty">Nenhum item</p>';
  const share=division=>items.filter(item=>Number(item.divisao)===division).reduce((s,item)=>s+Number(item.valor)/division,0);
  const values={casaTotal:totals.total,casaSuaParte:share(3),casaPorDois:share(2),casaSoVoce:share(1),casaShare:totals.share,casaPaid:totals.paid,casaDebt:totals.debt,casaCredit:totals.credit};
  Object.entries(values).forEach(([id,value])=>document.getElementById(id).textContent=brl(value));
  document.getElementById('casaHist').innerHTML=MK.filter(k=>getYearData().casa?.[k]?.length).map(k=>{const t=houseTotals(getYearData().casa[k]);return `<div class="summ-row"><span class="summ-k">${MONTHS[MK.indexOf(k)]}</span><span class="summ-v">${t.credit?'Crédito: '+brl(t.credit):'Devedor: '+brl(t.debt)}</span></div>`;}).join('')||'<p class="empty">Nenhum histórico</p>';
}
function setCasaMes(k){casaMes=k;renderCasa();}
function openCasa(id=null){
  editingCasaId=id;const item=houseItems().find(item=>item.id===id);
  document.getElementById('casaModalTitle').textContent=item?'Editar item — Casa':'Novo item — Casa';
  const fields={cDesc:item?.desc||'',cValor:item?.valor??'',cDiv:item?.divisao||3,cPayer:item?.payer||'nao_informado',cPerson:item?.payerName||'',cStatus:item?.paymentStatus||'pendente',cPaidAmount:item?.paidAmount??''};
  Object.entries(fields).forEach(([id,value])=>document.getElementById(id).value=value);openModal('moCasa');
}
async function salvarCasa(){
  const old=houseItems().find(item=>item.id===editingCasaId),value=id=>document.getElementById(id).value;
  const item={...old,id:old?.id||uuid(),desc:value('cDesc').trim(),valor:Number(value('cValor')),divisao:Number(value('cDiv')),payer:value('cPayer'),payerName:value('cPerson').trim(),paymentStatus:value('cStatus')};
  item.paidAmount=item.paymentStatus==='pago'?(value('cPaidAmount')===''?item.valor:Number(value('cPaidAmount'))):0;
  if(!item.desc||!Number.isFinite(item.valor)||item.valor<=0||![1,2,3].includes(item.divisao)){alert('Informe descrição, valor positivo e divisão válida.');return;}
  if(!Number.isFinite(item.paidAmount)||item.paidAmount<0||item.paidAmount>item.valor){alert('O valor pago deve ficar entre zero e o total da despesa.');return;}
  if(!await persistPlanningChange(()=>{
    const year=getYearData();if(!year.casa)year.casa={};if(!year.casa[casaMes])year.casa[casaMes]=[];
    const index=year.casa[casaMes].findIndex(other=>other.id===item.id);
    if(index<0)year.casa[casaMes].push(item);else year.casa[casaMes][index]=item;
  }))return;
  closeModal('moCasa');renderCasa();
}
async function delCasa(id){
  if(!confirm('Excluir este item das contas de casa?'))return;
  if(await persistPlanningChange(()=>{getYearData().casa[casaMes]=houseItems().filter(item=>item.id!==id);}))renderCasa();
}
function openCopyCasa(){
  const target=activeYear()*12+MK.indexOf(casaMes),years=DATA.years||{[activeYear()]:DATA},options=[];
  Object.entries(years).forEach(([year,period])=>MK.forEach((mk,index)=>{if(Number(year)*12+index<target&&period.casa?.[mk]?.length)options.push({year:Number(year),mk,index,count:period.casa[mk].length});}));
  options.sort((a,b)=>b.year-a.year||b.index-a.index);
  document.getElementById('copyCasaSource').innerHTML=options.map(o=>`<option value="${o.year}:${o.mk}">${MONTHS[o.index]} / ${o.year} (${o.count} itens)</option>`).join('');
  document.getElementById('copyCasaHelp').textContent='Destino: '+MONTHS[MK.indexOf(casaMes)]+' / '+activeYear()+'.'+(!options.length?' Não há meses anteriores com itens.':'');
  openModal('moCopyCasa');
}
async function copyCasaMonth(){
  const source=document.getElementById('copyCasaSource').value;if(!source){alert('Selecione um mês de origem.');return;}
  const [year,mk]=source.split(':'),period=DATA.years?DATA.years[year]:DATA;
  const items=period.casa?.[mk]||[];if(!items.length)return;
  if(!confirm(`Acrescentar ${items.length} item(ns) a ${MONTHS[MK.indexOf(casaMes)]}? Os itens existentes serão mantidos.`))return;
  if(!await persistPlanningChange(()=>{const target=getYearData();if(!target.casa)target.casa={};target.casa[casaMes]=[...houseItems(),...copyHouseItems(items)];}))return;
  closeModal('moCopyCasa');renderCasa();
}
