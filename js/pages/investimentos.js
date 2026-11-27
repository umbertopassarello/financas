function renderInvest(){
  const all=[];
  MK.forEach((mk,i)=>(getYearData().months[mk]?.transactions||[]).filter(t=>['INVESTIMENTOS','RESGATE'].includes(t.tipo)).forEach(t=>all.push({...t,mes:MONTHS[i]})));
  const sum=type=>all.filter(t=>t.tipo===type).reduce((s,t)=>s+(Number(t.valor)||0),0);
  document.getElementById('investCards').innerHTML=[
    ['Saldo da carteira',Number(DATA.investSaldo)||0,'a'],
    ['Aportes lançados no ano',sum('INVESTIMENTOS'),'g'],
    ['Resgates lançados no ano',sum('RESGATE'),'p'],
  ].map(([label,value,color])=>`<div class="card"><div class="card-label">${label}</div><div class="card-val ${color}">${brl(value)}</div></div>`).join('');
  document.getElementById('investmentBalanceNote').textContent=(DATA.investBalanceCheckedAt?'Última conferência manual em '+DATA.investBalanceCheckedAt+'. ':'Use “Conferir saldo” para informar o valor atual da carteira. ')+'O saldo reflete a última conferência e as movimentações confirmadas desde então.';
  renderInvestmentReviews();
  const rev=all.reverse();
  document.getElementById('investTbody').innerHTML=rev.length?rev.map(t=>`<tr><td><span class="mbadge ${t.tipo==='INVESTIMENTOS'?'mb-i':'mb-r'}">${escapeHTML(t.tipo)}</span></td><td class="td-sm">${t.mes}</td><td>${escapeHTML(t.desc)}</td><td class="td-val">${brl(t.valor)}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">Nenhum lançamento no ano selecionado.</td></tr>';
  document.getElementById('investMobile').innerHTML=rev.length?rev.map(t=>`<div class="mobile-item"><div class="mobile-item-body"><div class="mobile-item-desc">${escapeHTML(t.desc)}</div><div class="mobile-item-sub">${escapeHTML(t.tipo)} · ${t.mes}</div></div><span class="mobile-item-val">${brl(t.valor)}</span></div>`).join(''):'<p class="empty">Nenhum lançamento no ano selecionado.</p>';
  renderObligations('investment');
}
function pendingInvestmentReviews(){
  return seriesEntries().filter(({t})=>isInvestmentTransaction(t)&&t.investmentReview==='pending');
}
function investmentReplacement({t,year,month}){
  return obligations('investment').find(item=>item.sourceId===t.id&&item.sourceYear===year&&item.sourceMonth===month);
}
function renderInvestmentReviews(){
  const entries=pendingInvestmentReviews().sort((a,b)=>(b.t.data||'').localeCompare(a.t.data||''));
  document.getElementById('investmentReviewList').innerHTML=entries.map(entry=>{
    const {t}=entry,withdrawal=t.tipo==='RESGATE';
    const replacement=withdrawal&&investmentReplacement(entry);
    const button=(action,label,primary=false)=>`<button type="button" class="btn ${primary?'btn-p':'btn-g'} btn-sm" data-review-id="${escapeHTML(t.id)}" onclick="confirmInvestmentReview(this.dataset.reviewId,'${action}')">${label}</button>`;
    return `<article class="obligation-item"><div class="obligation-info"><h3>${escapeHTML(t.desc)}</h3><p>${withdrawal?'Resgate':'Aporte'} · ${escapeHTML(t.data||'')} · ${brl(t.valor)}</p>${replacement?'<p>Reposição já registrada.</p>':''}</div><div class="obligation-actions">${withdrawal&&!replacement
      ?button('replace','Descontar e registrar reposição',true)+button('apply','Descontar sem reposição')
      :button('apply',withdrawal?'Descontar do saldo':'Somar ao saldo',true)}${button('skip','Manter saldo')}</div></article>`;
  }).join('')||'<p class="feature-note">Nenhuma movimentação aguardando revisão.</p>';
}
function reviewInvestmentTransaction(id,action){
  const entry=pendingInvestmentReviews().find(({t})=>t.id===id);
  if(!entry)throw new Error('Esta movimentação já foi revisada ou foi removida.');
  const {t,year,month}=entry;
  const withdrawal=t.tipo==='RESGATE';
  if(!['apply','skip','replace'].includes(action)||(action==='replace'&&!withdrawal))throw new Error('Escolha uma ação válida para a movimentação.');
  if(action==='skip'){
    t.investmentReview='skipped';
    return;
  }
  const previous=Math.round((Number(DATA.investSaldo)||0)*100);
  const amount=Math.round(Number(t.valor)*100);
  const next=previous+(withdrawal?-amount:amount);
  if(!Number.isSafeInteger(amount)||amount<=0||!Number.isSafeInteger(next))throw new Error('O valor da movimentação é inválido.');
  if(next<0)throw new Error('O resgate é maior que o saldo da carteira. Confira o saldo antes de descontar ou escolha “Manter saldo” se ele já estiver incluído.');
  if(action==='replace'&&!investmentReplacement(entry)){
    saveObligation({id:uuid(),kind:'investment',description:t.desc,person:'',amount:amount/100,date:t.data||localDate(),
      due:'',sourceId:t.id,sourceYear:year,sourceMonth:month,payments:[]});
  }
  DATA.investSaldo=next/100;
  DATA.investBalanceHistory??=[];
  DATA.investBalanceHistory.push({previous:previous/100,value:DATA.investSaldo,date:localDate(),transactionId:t.id});
  t.investmentReview='applied';
}
async function confirmInvestmentReview(id,action){
  if(await persistPlanningChange(()=>reviewInvestmentTransaction(id,action)))renderInvest();
}
function openInvestmentBalance(){document.getElementById('investmentBalance').value=Number(DATA.investSaldo)||0;openModal('moInvestmentBalance');}
async function submitInvestmentBalance(event){
  event.preventDefault();
  const value=Number(document.getElementById('investmentBalance').value);
  if(!Number.isFinite(value)||value<0){alert('Informe um saldo igual ou maior que zero.');return;}
  if(!await persistPlanningChange(()=>{
    if(!DATA.investBalanceHistory)DATA.investBalanceHistory=[];
    DATA.investBalanceHistory.push({previous:Number(DATA.investSaldo)||0,value,date:localDate()});
    DATA.investSaldo=value;DATA.investBalanceCheckedAt=localDate();
  }))return;
  closeModal('moInvestmentBalance');renderInvest();
}
