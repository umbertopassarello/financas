function agendaValidDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return '';
  const date=new Date(value+'T12:00:00Z');
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value?value:'';
}
function agendaInvoiceDate(year,month,day){
  if(!Number.isInteger(day)||day<1||day>31||!Number.isInteger(month)||month<0||month>11)return '';
  const last=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  return year+'-'+String(month+1).padStart(2,'0')+'-'+String(Math.min(day,last)).padStart(2,'0');
}
function agendaItems(data=DATA){
  const items=[],invoices=new Map(),years=data.years||{[Number(data.currentYear)||2026]:data};
  for(const [year,period] of Object.entries(years))for(const [month,value] of Object.entries(period.months||{})){
    for(const t of value.transactions||[]){
      if(t.tipo!=='SAÍDA'||paymentInfo(t).status==='pago')continue;
      const cents=Math.round(Number(t.valor)*100);if(!Number.isSafeInteger(cents)||cents<=0)continue;
      const p=paymentInfo(t),ref={year:Number(year),month,id:t.id};
      if(p.method==='credito'&&p.card){
        const key=JSON.stringify([Number(year),month,p.card]);
        if(!invoices.has(key))invoices.set(key,{key:'invoice:'+key,type:'invoice',title:'Fatura '+cardInfo(p.card).l,card:p.card,year:Number(year),month,due:agendaInvoiceDate(Number(year),MK.indexOf(month),Number(data.cardDueDays?.[p.card])),cents:0,refs:[]});
        const invoice=invoices.get(key);invoice.cents+=cents;invoice.refs.push(ref);
      }else items.push({key:'expense:'+JSON.stringify(ref),type:'expense',title:t.desc,due:agendaValidDate(t.dueDate||t.data),cents,refs:[ref],year:Number(year),month});
    }
  }
  items.push(...invoices.values());
  for(const item of data.obligations||[]){
    if(item.kind!=='receivable')continue;
    const cents=Math.round(pendingRemaining(item)*100);if(cents<=0)continue;
    items.push({key:'receivable:'+item.id,type:'receivable',title:item.description,person:item.person,due:agendaValidDate(item.due),cents,obligationId:item.id});
  }
  return items.sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||String(a.title).localeCompare(String(b.title),'pt-BR'));
}
function agendaWeekEnd(today){const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+7);return d.toISOString().slice(0,10);}
function filterAgenda(items,period,type,today=localDate()){
  const end=agendaWeekEnd(today),month=activeYear()+'-'+String(DATA.currentMonth+1).padStart(2,'0');
  return items.filter(item=>(type==='all'||item.type===type)&&(period==='all'||period==='overdue'&&item.due&&item.due<today||period==='week'&&item.due>=today&&item.due<=end||period==='month'&&item.due.startsWith(month+'-')||period==='undated'&&!item.due));
}
let agendaVisible=[];
function renderAgenda(){
  const today=localDate(),items=agendaItems();
  agendaVisible=filterAgenda(items,document.getElementById('agendaPeriod').value,document.getElementById('agendaType').value,today);
  const sum=list=>list.reduce((total,item)=>total+item.cents,0)/100;
  const outgoing=items.filter(i=>i.type!=='receivable'),incoming=items.filter(i=>i.type==='receivable');
  document.getElementById('agendaSummary').innerHTML=[['A pagar (todos os anos)',sum(outgoing),'r'],['Pagamentos vencidos',sum(outgoing.filter(i=>i.due&&i.due<today)),'r'],['A receber (todos os anos)',sum(incoming),'g'],['Pagamentos até 7 dias',sum(outgoing.filter(i=>i.due>=today&&i.due<=agendaWeekEnd(today))),'a']].map(([title,value,color])=>'<div class="card"><div class="card-label">'+title+'</div><div class="card-val '+color+'">'+brl(value)+'</div></div>').join('');
  document.getElementById('agendaCount').textContent=agendaVisible.length+' de '+items.length+' compromisso(s). Resumo acima considera todas as pendências, sem filtros.';
  const labels={expense:'Conta',invoice:'Fatura',receivable:'Devolução a receber'};
  document.getElementById('agendaList').innerHTML=agendaVisible.length?agendaVisible.map((item,index)=>{
    const status=!item.due?'Sem vencimento':item.due<today?'Vencido':item.due===today?'Vence hoje':'A vencer';
    const meta=item.type==='receivable'?item.person:MONTHS[MK.indexOf(item.month)]+' / '+item.year+(item.type==='invoice'?' · '+item.refs.length+' compra(s) pendente(s)':'');
    return '<article class="obligation-item"><div class="obligation-info"><h3>'+escapeHTML(item.title)+'</h3><p>'+labels[item.type]+' · '+escapeHTML(meta||'')+'</p><span class="payment-status '+(item.due&&item.due<today?'is-overdue':'is-pending')+'">'+status+'</span><p>'+(item.due?'Vencimento: '+item.due.split('-').reverse().join('/'):'Informe uma data para acompanhar o vencimento.')+'</p></div><div class="obligation-actions"><strong>'+brl(item.cents/100)+'</strong><button class="btn btn-p btn-sm" data-agenda-pay="'+index+'">'+(item.type==='receivable'?'Registrar recebimento':'Marcar pago hoje')+'</button><button class="btn btn-g btn-sm" data-agenda-open="'+index+'">'+(item.type==='receivable'?'Editar previsão':'Ver lançamentos')+'</button></div></article>';
  }).join(''):'<p class="empty">Nenhum compromisso neste filtro.</p>';
  const cards=[...new Set([...Object.keys(BANKS),...Object.keys(DATA.customBanks||{}),...items.filter(i=>i.type==='invoice').map(i=>i.card),...Object.keys(DATA.cardDueDays||{})])].filter(k=>k!=='pago');
  const select=document.getElementById('agendaCard'),chosen=select.value;
  select.innerHTML=cards.map(card=>'<option value="'+escapeHTML(card)+'">'+escapeHTML(cardInfo(card).l)+'</option>').join('');
  if(cards.includes(chosen))select.value=chosen;
  agendaCardChange();
}
function agendaCardChange(){document.getElementById('agendaDueDay').value=DATA.cardDueDays?.[document.getElementById('agendaCard').value]??'';}
async function saveAgendaCard(event){
  event.preventDefault();
  const card=document.getElementById('agendaCard').value,raw=document.getElementById('agendaDueDay').value,day=Number(raw);
  if(!card||!Number.isInteger(day)||day<1||day>31){alert('Selecione o cartão e um dia entre 1 e 31.');return;}
  if(!confirm('Definir vencimento no dia '+day+' para '+cardInfo(card).l+'? Isso atualiza a previsão de todas as faturas pendentes desse cartão, inclusive antigas.'))return;
  if(await persistPlanningChange(()=>{DATA.cardDueDays??={};DATA.cardDueDays[card]=day;}))renderAgenda();
}
async function payAgendaItem(item){
  if(item.type==='receivable'){openSettlement(item.obligationId);return;}
  if(!confirm('Marcar '+item.title+' como pago hoje ('+localDate()+')? Não será criado outro lançamento.'))return;
  if(await persistPlanningChange(()=>{
    let count=0;
    for(const ref of item.refs){
      const period=DATA.years?DATA.years[ref.year]:ref.year===activeYear()?DATA:null;
      const t=period?.months?.[ref.month]?.transactions.find(t=>t.id===ref.id);
      if(!t||t.tipo!=='SAÍDA'||paymentInfo(t).status==='pago')continue;
      const p=paymentInfo(t);t.formaPagamento=p.method;t.cartao=p.card;t.status='pago';t.paidAt=localDate();count++;
    }
    if(!count)throw new Error('Este compromisso já foi baixado ou não está mais disponível. Atualize a agenda.');
  }))renderAgenda();
}
document.getElementById('agendaCardForm').addEventListener('submit',saveAgendaCard);
document.getElementById('agendaList').addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  const pay=button.dataset.agendaPay!==undefined,index=Number(pay?button.dataset.agendaPay:button.dataset.agendaOpen);
  if(!Number.isInteger(index))return;const item=agendaVisible[index];if(!item)return;
  if(pay){payAgendaItem(item);return;}
  if(item.type==='receivable'){openObligation('receivable',item.obligationId);return;}
  Object.values(lancFilters).forEach(selected=>selected.clear());
  for(const id of ['fSearch','fDe','fAte'])document.getElementById(id).value='';
  if(item.type==='invoice'){
    lancFilters.tipo.add('SAÍDA');lancFilters.forma.add('credito');
    lancFilters.cartao.add(item.card);lancFilters.status.add('pendente');
  }
  DATA.currentYear=item.year;DATA.currentMonth=MK.indexOf(item.month);renderMonthBtns();navTo('lancamentos');
  if(item.type==='expense')editLanc(item.refs[0].id);
});
