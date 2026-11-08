// =====================================================================
// DASHBOARD
// =====================================================================
function renderDash(){
  const mk=MK[DATA.currentMonth], txs=getYearData().months[mk].transactions, mName=MONTHS[DATA.currentMonth];
  const h=new Date().getHours();
  const greet=h<12?'Bom dia':h<18?'Boa tarde':'Boa noite';
  document.getElementById('greetH').innerHTML=`${greet}, <em>${CU.name}</em>! ${h<12?'☀️':h<18?'👋':'🌙'}`;
  document.getElementById('greetSub').textContent=`Resumo financeiro de ${mName}.`;
  document.getElementById('lancMes').textContent=mName;
  const e=txs.filter(t=>t.tipo==='ENTRADA').reduce((s,t)=>s+t.valor,0);
  const g=txs.filter(t=>t.tipo==='SAÍDA').reduce((s,t)=>s+t.valor,0);
  const iv=txs.filter(t=>t.tipo==='INVESTIMENTOS').reduce((s,t)=>s+t.valor,0);
  const re=txs.filter(t=>t.tipo==='RESGATE').reduce((s,t)=>s+t.valor,0);
  const ant=getYearData().months[mk].resumo?.saldoAnterior||0;
  const mes=e+re-g-iv, atual=ant+mes;
  const pill=document.getElementById('saldoAntPill');
  if(ant!==0){pill.style.display='inline-flex';document.getElementById('saldoAntVal').textContent=brl(Math.abs(ant));document.getElementById('saldoAntVal').style.color=ant>=0?'var(--green)':'var(--red)';}
  else pill.style.display='none';
  document.getElementById('dashCards').innerHTML=[
    {l:'Entradas',v:brl(e),c:'g',s:`${txs.filter(t=>t.tipo==='ENTRADA').length} lançamentos`},
    {l:'Gastos',v:brl(g),c:'r',s:`${txs.filter(t=>t.tipo==='SAÍDA').length} lançamentos`},
    {l:'Saldo mensal',v:brl(e-g),c:e-g>=0?'g':'r',s:'Entradas − gastos, sem saldo anterior'},
    {l:'Investimentos',v:brl(iv),c:'a',s:iv>0?`${(iv/(e||1)*100).toFixed(0)}% da renda`:'Sem aporte'},
    {l:'Saldo Atual',v:brl(atual),c:atual>=0?'g':'r',s:`Mês: ${brlS(mes)}`},
  ].map(c=>`<div class="card"><div class="card-label">${c.l}</div><div class="card-val ${c.c}">${c.v}</div><div class="card-sub">${c.s}</div></div>`).join('');
  renderCategoryChart(txs);
  renderMonthlyChart();
  // Recent tx desktop
  document.getElementById('dashTx').innerHTML=txs.slice(0,6).map(t=>{const vc=t.tipo==='ENTRADA'?'g':t.tipo==='INVESTIMENTOS'?'a':t.tipo==='RESGATE'?'p':'r';const sg=t.tipo==='ENTRADA'||t.tipo==='RESGATE'?'+':t.tipo==='INVESTIMENTOS'?'◈':'-';return`<tr><td class="td-desc">${t.desc}</td><td class="td-val ${vc}">${sg} ${brl(t.valor)}</td><td class="td-sm">${t.categoria||'—'}</td><td><span class="payment-badges">${paymentBadges(t)}</span></td></tr>`;}).join('')||`<tr><td colspan="4" class="empty">Nenhuma transação</td></tr>`;
  // Recent tx mobile
  document.getElementById('dashTxMobile').innerHTML=txs.slice(0,6).map(t=>mobileItemTx(t)).join('')||`<div class="empty">Nenhuma transação</div>`;
}

