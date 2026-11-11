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
  const count=Number(input.count),cents=Math.round((Number(input.amount)+Number.EPSILON)*100);
  if(!['recurring','installments'].includes(input.kind)||!Number.isInteger(count)||count<2||count>120)throw new Error('Informe de 2 a 120 ocorrências.');
  if(!input.desc.trim()||!Number.isSafeInteger(cents)||cents<=0)throw new Error('Informe a descrição e um valor válido maior que zero.');
  if(input.kind==='installments'&&cents<count)throw new Error('O total deve permitir pelo menos um centavo por parcela.');
  if(['credito','debito'].includes(input.method)&&!input.card)throw new Error('Selecione o cartão.');
  const base=input.kind==='installments'?Math.floor(cents/count):cents;
  return Array.from({length:count},(_,index)=>({
    tipo:'SAÍDA',desc:input.desc.trim(),valor:(base+(input.kind==='installments'&&index<cents%count?1:0))/100,
    data:seriesDate(input.date,index),categoria:input.category||'Outros',tipoMov:input.kind==='installments'?'Parcelado':'Fixo',
    formaPagamento:input.method,cartao:input.card||'',banco:input.card||'pago',status:'pendente',
    seriesKind:input.kind,seriesIndex:index,seriesCount:count,
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
}
function updateSeriesFrom(original,edited){
  const entries=seriesEntries().filter(({t})=>t.seriesId===original.seriesId&&t.seriesIndex>=original.seriesIndex&&(t.id===original.id||paymentInfo(t).status!=='pago'));
  if(entries.some(({t,year,month})=>t.obligationId||(DATA.obligations||[]).some(o=>o.sourceId===t.id&&o.sourceYear===year&&o.sourceMonth===month)))throw new Error('Há uma ocorrência vinculada a uma pendência. Edite cada ocorrência separadamente.');
  const updates=entries.map(entry=>({entry,next:{...entry.t,desc:edited.desc,valor:edited.valor,categoria:edited.categoria,formaPagamento:edited.formaPagamento,cartao:edited.cartao,banco:edited.banco,
    data:seriesDate(edited.data,entry.t.seriesIndex-original.seriesIndex),dueDate:edited.dueDate?seriesDate(edited.dueDate,entry.t.seriesIndex-original.seriesIndex):'',status:entry.t.id===original.id?edited.status:entry.t.status}}));
  for(const {entry,next} of updates){
    const period=DATA.years?DATA.years[entry.year]:DATA;
    period.months[entry.month].transactions=period.months[entry.month].transactions.filter(t=>t.id!==entry.t.id);
    seriesMonth(next.data).transactions.push(next);
  }
}
function seriesBadge(t){return t.seriesId?' <span class="ttag tt-parc">'+(t.seriesKind==='installments'?'Parcela ':'Recorrência ')+(t.seriesIndex+1)+'/'+t.seriesCount+'</span>':'';}
function openSeries(){
  const categories=[...new Set([...CATS,...(DATA.customCats||[])])];
  document.getElementById('sCategory').innerHTML=categories.map(c=>'<option>'+escapeHTML(c)+'</option>').join('');
  const cards=[...new Set([...Object.keys(BANKS),...Object.keys(DATA.customBanks||{})])].filter(k=>k!=='pago');
  document.getElementById('sCard').innerHTML='<option value="">Sem cartão</option>'+cards.map(k=>'<option value="'+escapeHTML(k)+'">'+escapeHTML(cardInfo(k).l)+'</option>').join('');
  document.getElementById('seriesForm').reset();
  document.getElementById('rsDate').value=activeYear()+'-'+String(DATA.currentMonth+1).padStart(2,'0')+'-01';
  document.getElementById('seriesPreview').textContent='';openModal('moSeries');
}
function readSeriesForm(){return {kind:document.getElementById('sKind').value,desc:document.getElementById('sDesc').value,amount:document.getElementById('rsAmount').value,count:document.getElementById('sCount').value,date:document.getElementById('rsDate').value,category:document.getElementById('sCategory').value,method:document.getElementById('sMethod').value,card:['credito','debito'].includes(document.getElementById('sMethod').value)?document.getElementById('sCard').value:''};}
function previewSeries(){
  try{
    const plan=planSeries(readSeriesForm());
    document.getElementById('seriesPreview').textContent=plan.map((t,i)=>(i+1)+'/'+plan.length+' · '+t.data+' · '+brl(t.valor)).join('\n');
    return plan;
  }catch(e){document.getElementById('seriesPreview').textContent=e.message;return null;}
}
let generatingSeries=false;
async function saveSeries(event){
  event.preventDefault();if(generatingSeries)return;
  const plan=previewSeries();if(!plan)return;
  const total=plan.reduce((sum,t)=>sum+Math.round(t.valor*100),0)/100;
  if(!confirm('Gerar '+plan.length+' lançamentos pendentes de '+plan[0].data+' até '+plan.at(-1).data+', somando '+brl(total)+'? Confira a prévia. Os lançamentos entrarão nos totais de cada mês.'))return;
  generatingSeries=true;
  try{
    if(!await persistPlanningChange(()=>commitSeries(plan,uuid())))return;
    closeModal('moSeries');renderMonthBtns();renderLanc();
  }finally{generatingSeries=false;}
}
document.getElementById('seriesForm').addEventListener('submit',saveSeries);
document.getElementById('seriesForm').addEventListener('input',previewSeries);
