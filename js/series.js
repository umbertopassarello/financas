// Séries mensais finitas: cada ocorrência é um lançamento normal, com vínculo.
function seriesDate(date,offset){
  const parsed=new Date(date+'T12:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)throw new Error('Informe uma data válida.');
  const year=Number(date.slice(0,4)),month=Number(date.slice(5,7))-1,day=Number(date.slice(8,10));
  const target=new Date(Date.UTC(year,month+offset,1,12));
  const last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
  target.setUTCDate(Math.min(day,last));
  return target.toISOString().slice(0,10);
}
function planSeries(input){
  const unlimited=input.kind==='recurring'&&input.unlimited;
  const count=unlimited?1:Number(input.count),cents=Math.round((Number(input.amount)+Number.EPSILON)*100);
  if(!['recurring','installments'].includes(input.kind)||!Number.isInteger(count)||(!unlimited&&(count<2||count>120)))throw new Error('Informe de 2 a 120 ocorrências.');
  if(!input.desc.trim()||!Number.isSafeInteger(cents)||cents<=0)throw new Error('Informe a descrição e um valor válido maior que zero.');
  const splitTotal=input.kind==='installments'&&input.amountMode!=='perInstallment';
  if(splitTotal&&cents<count)throw new Error('O total deve permitir pelo menos um centavo por parcela.');
  if(!splitTotal&&!Number.isSafeInteger(cents*count))throw new Error('O total ultrapassa o limite de cálculo.');
  if(['credito','debito'].includes(input.method)&&!input.card)throw new Error('Selecione o cartão.');
  const base=splitTotal?Math.floor(cents/count):cents;
  return Array.from({length:count},(_,index)=>({
    tipo:'SAÍDA',desc:input.desc.trim(),valor:(base+(splitTotal&&index<cents%count?1:0))/100,
    data:seriesDate(input.date,index),categoria:input.category||'Outros',tipoMov:input.kind==='installments'?'Parcelado':'Fixo',
    formaPagamento:input.method,cartao:input.card||'',banco:input.card||'pago',status:'pendente',
    seriesKind:input.kind,seriesIndex:index,seriesCount:unlimited?null:count,
  }));
}
function seriesEntries(){
  const years=DATA.years||{[activeYear()]:DATA};
  return Object.entries(years).flatMap(([year,period])=>Object.entries(period.months||{}).flatMap(([month,value])=>(value.transactions||[]).map(t=>({year:Number(year),month,t}))));
}
function seriesMonth(date){
  const year=Number(date.slice(0,4)),key=MK[Number(date.slice(5,7))-1];
  if(!DATA.years&&year!==activeYear()){
    const {months,casa}=DATA;
    DATA.years={[activeYear()]:{months,...(casa?{casa}:{})}};
    DATA.currentYear=activeYear();delete DATA.months;delete DATA.casa;
  }
  const period=DATA.years?(DATA.years[year]??={months:{},casa:{}}):DATA;
  for(const mk of MK)if(!period.months[mk])period.months[mk]={resumo:{saldoAnterior:0},transactions:[]};
  return period.months[key];
}
function commitSeries(plan,id){
  if(seriesEntries().some(({t})=>t.seriesId===id))throw new Error('Esta série já foi gerada.');
  for(const item of plan)seriesMonth(item.data).transactions.push({...item,id:uuid(),seriesId:id});
  if(plan[0].seriesCount===null){
    DATA.openRecurrences??={};
    DATA.openRecurrences[id]={template:plan[0],nextIndex:1};
    extendOpenRecurrences(localDate());
  }
}
function recurrenceHorizon(today){
  return seriesDate(today,12).slice(0,7);
}
function recurrenceDate(rule,index){
  return seriesDate(rule.template.data,index-rule.template.seriesIndex);
}
function extendOpenRecurrences(today){
  const horizon=recurrenceHorizon(today);
  for(const [id,rule] of Object.entries(DATA.openRecurrences||{})){
    let date=recurrenceDate(rule,rule.nextIndex);
    while(date.slice(0,7)<=horizon){
      const {template,nextIndex}=rule;
      const offset=nextIndex-template.seriesIndex;
      seriesMonth(date).transactions.push({...template,id:uuid(),seriesId:id,seriesIndex:nextIndex,data:date,
        dueDate:template.dueDate?seriesDate(template.dueDate,offset):'',status:'pendente'});
      rule.nextIndex++;
      date=recurrenceDate(rule,rule.nextIndex);
    }
  }
}
async function refreshOpenRecurrences(){
  const today=localDate();
  const needsExtension=Object.values(DATA.openRecurrences||{}).some(rule=>recurrenceDate(rule,rule.nextIndex).slice(0,7)<=recurrenceHorizon(today));
  if(needsExtension)await persistPlanningChange(()=>extendOpenRecurrences(today));
}
function linkedSeriesEntry({t,year,month}){
  return t.obligationId||(DATA.obligations||[]).some(o=>o.sourceId===t.id&&o.sourceYear===year&&o.sourceMonth===month);
}
function endOpenRecurrence(id,lastIndex){
  if(!DATA.openRecurrences?.[id])return;
  const entries=seriesEntries().filter(({t})=>t.seriesId===id&&t.seriesIndex>lastIndex&&paymentInfo(t).status!=='pago');
  if(entries.some(linkedSeriesEntry))throw new Error('Há lançamentos futuros vinculados a pendências. Resolva os vínculos antes de encerrar a recorrência.');
  for(const {t,year,month} of entries){
    const source=(DATA.years?DATA.years[year]:DATA).months[month];
    source.transactions=source.transactions.filter(item=>item.id!==t.id);
  }
  delete DATA.openRecurrences[id];
}
async function confirmEndRecurrence(id){
  const occurrence=seriesEntries().find(({t})=>t.id===id)?.t;
  if(!occurrence||!DATA.openRecurrences?.[occurrence.seriesId])return;
  if(!confirm('Encerrar a recorrência após '+occurrence.data+'? Os lançamentos pendentes posteriores serão removidos e os pagos serão mantidos.'))return;
  if(await persistPlanningChange(()=>endOpenRecurrence(occurrence.seriesId,occurrence.seriesIndex)))renderLanc();
}
function updateSeriesFrom(original,edited){
  const entries=seriesEntries().filter(({t})=>t.seriesId===original.seriesId&&t.seriesIndex>=original.seriesIndex&&(t.id===original.id||(!t.installmentOriginalDate&&paymentInfo(t).status!=='pago')));
  if(entries.some(linkedSeriesEntry))throw new Error('Há uma ocorrência vinculada a uma pendência. Edite cada ocorrência separadamente.');
  const updates=entries.map(entry=>({entry,next:{...entry.t,desc:edited.desc,valor:edited.valor,categoria:edited.categoria,formaPagamento:edited.formaPagamento,cartao:edited.cartao,banco:edited.banco,
    data:seriesDate(edited.data,entry.t.seriesIndex-original.seriesIndex),dueDate:edited.dueDate?seriesDate(edited.dueDate,entry.t.seriesIndex-original.seriesIndex):'',status:entry.t.id===original.id?edited.status:entry.t.status}}));
  for(const {entry,next} of updates){
    const period=DATA.years?DATA.years[entry.year]:DATA;
    period.months[entry.month].transactions=period.months[entry.month].transactions.filter(t=>t.id!==entry.t.id);
    seriesMonth(next.data).transactions.push(next);
  }
  const rule=DATA.openRecurrences?.[original.seriesId];
  if(rule){
    rule.template={...updates.find(({next})=>next.id===original.id).next};
    extendOpenRecurrences(localDate());
  }
}
function seriesBadge(t){
  if(!t.seriesId)return '';
  if(t.seriesCount===null){
    const end=DATA.openRecurrences?.[t.seriesId]
      ? ` <button type="button" class="btn btn-g btn-sm" data-occurrence-id="${escapeHTML(t.id)}" onclick="confirmEndRecurrence(this.dataset.occurrenceId)">Encerrar após esta ocorrência</button>`
      : '';
    return ' <span class="ttag tt-parc">Recorrência sem prazo</span>'+end;
  }
  const position=escapeHTML((t.seriesIndex+1)+'/'+t.seriesCount);
  if(t.seriesKind==='installments'){
    return ` <button type="button" class="btn btn-g btn-sm" data-installment-id="${escapeHTML(t.id)}" onclick="openInstallmentDetails(this.dataset.installmentId)" aria-label="Ver compra parcelada, parcela ${position}">Parcela ${position}</button>`;
  }
  return ` <span class="ttag tt-parc">Recorrência ${position}</span>`;
}

function purchaseInstallments(id){
  const entries=seriesEntries();
  const selected=entries.find(({t})=>t.id===id&&t.seriesId&&t.seriesKind==='installments');
  if(!selected)return [];
  return entries.filter(({t})=>t.seriesId===selected.t.seriesId&&t.seriesKind==='installments')
    .sort((a,b)=>a.t.seriesIndex-b.t.seriesIndex);
}

function redistributeInstallmentBalance(original,edited){
  const before=Math.round(Number(original.valor)*100);
  const after=Math.round(Number(edited.valor)*100);
  if(!Number.isSafeInteger(after)||after<1)throw new Error('Informe um valor de parcela válido, com pelo menos um centavo.');
  edited.valor=after/100;
  if(before===after)return;

  const remaining=purchaseInstallments(original.id).filter(entry=>{
    const {t}=entry;
    return t.seriesIndex>original.seriesIndex&&paymentInfo(t).status==='pendente'
      &&!t.installmentOriginalDate&&!linkedSeriesEntry(entry);
  });
  if(!remaining.length)throw new Error('Não há próximas parcelas disponíveis para recalcular. Para alterar o total da compra, use “Somente esta ocorrência”.');

  const balance=remaining.reduce((total,{t})=>total+Math.round(Number(t.valor)*100),before-after);
  if(!Number.isSafeInteger(balance)||balance<remaining.length){
    throw new Error('Esse valor deixa menos de um centavo para cada próxima parcela. Informe um valor menor.');
  }
  const base=Math.floor(balance/remaining.length),extra=balance%remaining.length;
  remaining.forEach(({t},index)=>{t.valor=(base+(index<extra?1:0))/100;});
}

function eligibleInstallment({t,year,month},date){
  const period=year+'-'+String(MK.indexOf(month)+1).padStart(2,'0');
  return date.slice(0,7)<period&&paymentInfo(t).status==='pendente'&&!linkedSeriesEntry({t,year,month});
}

function advancePurchaseInstallments(id,ids,date){
  seriesDate(date,0);
  const entries=purchaseInstallments(id).filter(({t})=>ids.has(t.id));
  if(!ids.size||entries.length!==ids.size||entries.some(entry=>!eligibleInstallment(entry,date))){
    throw new Error('Selecione apenas parcelas pendentes de meses posteriores que estejam disponíveis para antecipação.');
  }
  const destination=seriesMonth(date);
  for(const {t,year,month} of entries){
    const source=(DATA.years?DATA.years[year]:DATA).months[month];
    source.transactions=source.transactions.filter(item=>item.id!==t.id);
    destination.transactions.push({...t,data:date,dueDate:date,installmentOriginalDate:t.installmentOriginalDate||t.data});
  }
}

let displayedInstallmentId=null;
let advancingInstallments=false;
function openInstallmentDetails(id){
  if(advancingInstallments)return;
  displayedInstallmentId=id;
  document.getElementById('installmentsDate').value=localDate();
  document.getElementById('installmentsFeedback').textContent='';
  renderInstallmentDetails();
  openModal('moInstallments');
  document.getElementById('installmentsDate').focus();
}
function renderInstallmentDetails(){
  const entries=purchaseInstallments(displayedInstallmentId);
  const selected=entries.find(({t})=>t.id===displayedInstallmentId)?.t;
  const date=document.getElementById('installmentsDate').value;
  const total=entries.reduce((sum,{t})=>sum+Math.round(Number(t.valor)*100),0)/100;
  document.getElementById('installmentsDescription').textContent=selected?.desc||'Compra indisponível';
  document.getElementById('installmentsSummary').textContent=selected
    ? `Total registrado ${brl(total)} · Parcela atual ${selected.seriesIndex+1}/${selected.seriesCount} (${brl(selected.valor)})`
    : '';
  document.getElementById('installmentsList').innerHTML=entries.map(entry=>{
    const {t}=entry;
    const status=paymentInfo(t).status==='pago'?'Paga':'Pendente';
    const original=t.installmentOriginalDate?' · Antecipada de '+escapeHTML(t.installmentOriginalDate):'';
    const details=`Parcela ${escapeHTML(t.seriesIndex+1)} · ${escapeHTML(t.data)} · ${brl(t.valor)} · ${status}${original}`;
    if(!date||!eligibleInstallment(entry,date))return `<div class="cb-item">${details}</div>`;
    return `<label class="cb-item"><input type="checkbox" name="advanceInstallment" value="${escapeHTML(t.id)}" onchange="updateInstallmentAdvanceButton()"> ${details}</label>`;
  }).join('');
  updateInstallmentAdvanceButton();
}
function updateInstallmentAdvanceButton(){
  const form=document.getElementById('installmentsForm');
  document.getElementById('advanceInstallments').disabled=advancingInstallments||!form.querySelector('[name="advanceInstallment"]:checked');
}
async function saveInstallmentAdvance(event){
  event.preventDefault();
  if(advancingInstallments)return;
  const ids=new Set([...event.currentTarget.querySelectorAll('[name="advanceInstallment"]:checked')].map(input=>input.value));
  const date=document.getElementById('installmentsDate').value;
  if(!ids.size||!confirm(`Transferir ${ids.size} parcela(s) para ${date}? Elas continuarão pendentes.`))return;
  advancingInstallments=true;
  const feedback=document.getElementById('installmentsFeedback');
  feedback.textContent='';
  updateInstallmentAdvanceButton();
  try{
    if(!await persistPlanningChange(()=>advancePurchaseInstallments(displayedInstallmentId,ids,date)))return;
    renderInstallmentDetails();
    feedback.textContent='Antecipação registrada.';
    renderMonthBtns();
    renderLanc();
  }finally{
    advancingInstallments=false;
    updateInstallmentAdvanceButton();
  }
}
function openSeries(){
  const categories=registeredCategories();
  document.getElementById('sCategory').innerHTML=categories.map(c=>'<option>'+escapeHTML(c)+'</option>').join('');
  const cards=registeredCardKeys();
  document.getElementById('sCard').innerHTML='<option value="">Sem cartão</option>'+cards.map(k=>'<option value="'+escapeHTML(k)+'">'+escapeHTML(cardInfo(k).l)+'</option>').join('');
  document.getElementById('seriesForm').reset();
  document.getElementById('rsDate').value=activeYear()+'-'+String(DATA.currentMonth+1).padStart(2,'0')+'-01';
  updateSeriesForm();
  openModal('moSeries');
}
function readSeriesForm(){
  const value=id=>document.getElementById(id).value;
  const kind=value('sKind'),method=value('sMethod');
  return {kind,method,desc:value('sDesc'),amount:value('rsAmount'),count:value('sCount'),date:value('rsDate'),
    category:value('sCategory'),card:['credito','debito'].includes(method)?value('sCard'):'',
    amountMode:value('sAmountMode'),unlimited:kind==='recurring'&&value('sDuration')==='unlimited'};
}
function updateSeriesForm(){
  const input=readSeriesForm(),installments=input.kind==='installments';
  document.getElementById('sDurationGroup').hidden=installments;
  document.getElementById('sAmountModeGroup').hidden=!installments;
  document.getElementById('sCountGroup').hidden=input.unlimited;
  document.getElementById('sCount').disabled=input.unlimited;
  document.getElementById('sCountLabel').textContent=installments?'Quantidade de parcelas':'Quantidade de meses';
  document.getElementById('sAmountLabel').textContent=installments
    ? (input.amountMode==='perInstallment'?'Valor de cada parcela (R$)':'Total da compra (R$)')
    : 'Valor mensal (R$)';
  previewSeries(input,true);
}
function previewSeries(input=readSeriesForm(),quiet=false){
  const preview=document.getElementById('seriesPreview');
  if(quiet&&(!input.desc.trim()||!input.amount||!input.date)){
    preview.textContent='';
    return null;
  }
  try{
    const plan=planSeries(input);
    const first=plan[0],last=plan.at(-1);
    if(input.unlimited){
      preview.textContent=`${brl(first.valor)} por mês a partir de ${first.data}, sem data de término. O app mantém até 12 meses futuros gerados e atualiza a lista ao abrir.`;
    }else{
      const total=plan.reduce((sum,t)=>sum+Math.round(t.valor*100),0)/100;
      const amounts=first.valor===last.valor?brl(first.valor):`${brl(last.valor)} a ${brl(first.valor)}`;
      preview.textContent=`${plan.length} × ${amounts} · Total ${brl(total)}\n${first.data} a ${last.data}`;
    }
    return plan;
  }catch(e){preview.textContent=e.message;return null;}
}
let generatingSeries=false;
async function saveSeries(event){
  event.preventDefault();if(generatingSeries)return;
  const plan=previewSeries();if(!plan)return;
  const total=plan.reduce((sum,t)=>sum+Math.round(t.valor*100),0)/100;
  const question=plan[0].seriesCount===null
    ? `Criar uma recorrência sem data de término de ${brl(plan[0].valor)} por mês, a partir de ${plan[0].data}?`
    : `Gerar ${plan.length} lançamentos pendentes de ${plan[0].data} até ${plan.at(-1).data}, somando ${brl(total)}?`;
  if(!confirm(question))return;
  generatingSeries=true;
  try{
    if(!await persistPlanningChange(()=>commitSeries(plan,uuid())))return;
    closeModal('moSeries');renderMonthBtns();renderLanc();
  }finally{generatingSeries=false;}
}
document.getElementById('seriesForm').addEventListener('submit',saveSeries);
document.getElementById('seriesForm').addEventListener('input',updateSeriesForm);
