function renderInvest(){
  const all=[];
  MK.forEach((mk,i)=>(getYearData().months[mk]?.transactions||[]).filter(t=>['INVESTIMENTOS','RESGATE'].includes(t.tipo)).forEach(t=>all.push({...t,mes:MONTHS[i]})));
  const sum=type=>all.filter(t=>t.tipo===type).reduce((s,t)=>s+(Number(t.valor)||0),0);
  document.getElementById('investCards').innerHTML=[
    ['Saldo manual conferido',Number(DATA.investSaldo)||0,'a'],
    ['Aportes lançados no ano',sum('INVESTIMENTOS'),'g'],
    ['Resgates lançados no ano',sum('RESGATE'),'p'],
  ].map(([label,value,color])=>`<div class="card"><div class="card-label">${label}</div><div class="card-val ${color}">${brl(value)}</div></div>`).join('');
  document.getElementById('investmentBalanceNote').textContent=(DATA.investBalanceCheckedAt?'Saldo conferido em '+DATA.investBalanceCheckedAt+'. ':'O saldo anterior ainda não foi conferido. Use “Conferir saldo” para informar o valor real ou zerar. ')+'Lançamentos, metas e reposições não alteram o saldo manual automaticamente.';
  const rev=all.reverse();
  document.getElementById('investTbody').innerHTML=rev.length?rev.map(t=>`<tr><td><span class="mbadge ${t.tipo==='INVESTIMENTOS'?'mb-i':'mb-r'}">${escapeHTML(t.tipo)}</span></td><td class="td-sm">${t.mes}</td><td>${escapeHTML(t.desc)}</td><td class="td-val">${brl(t.valor)}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">Nenhum lançamento no ano selecionado.</td></tr>';
  document.getElementById('investMobile').innerHTML=rev.length?rev.map(t=>`<div class="mobile-item"><div class="mobile-item-body"><div class="mobile-item-desc">${escapeHTML(t.desc)}</div><div class="mobile-item-sub">${escapeHTML(t.tipo)} · ${t.mes}</div></div><span class="mobile-item-val">${brl(t.valor)}</span></div>`).join(''):'<p class="empty">Nenhum lançamento no ano selecionado.</p>';
  renderObligations('investment');
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
