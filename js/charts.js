function categorySeries(txs){
  const values=new Map();
  txs.filter(t=>t.tipo==='SAÍDA').forEach(t=>{const key=t.categoria||'Outros';values.set(key,(values.get(key)||0)+(Number(t.valor)||0));});
  return [...values.entries()].filter(([,value])=>value>0).sort((a,b)=>b[1]-a[1]);
}
function setCategoryChart(mode){localStorage.setItem('finDash_categoryChart',mode);renderCategoryChart(getYearData().months[MK[DATA.currentMonth]].transactions);}
function renderCategoryChart(txs){
  const series=categorySeries(txs),total=series.reduce((s,[,value])=>s+value,0),mode=localStorage.getItem('finDash_categoryChart')||'bars';
  document.getElementById('categoryBars').setAttribute('aria-pressed',mode==='bars');
  document.getElementById('categoryPie').setAttribute('aria-pressed',mode==='pie');
  const host=document.getElementById('catChart');
  if(!total){host.innerHTML='<p class="empty">Nenhum gasto no mês.</p>';return;}
  const legend=series.map(([label,value],i)=>`<div class="chart-legend-item"><span class="chart-dot" style="background:${CCOLORS[i%CCOLORS.length]}"></span><span>${escapeHTML(label)}</span><strong>${brl(value)} · ${(value/total*100).toFixed(1)}%</strong></div>`).join('');
  if(mode==='pie'){
    let angle=0;
    const stops=series.map(([,value],i)=>{const start=angle;angle+=value/total*360;return `${CCOLORS[i%CCOLORS.length]} ${start}deg ${angle}deg`;});
    host.innerHTML=`<div class="category-pie" role="img" aria-label="Distribuição dos gastos por categoria; valores na legenda" style="background:conic-gradient(${stops.join(',')})"></div><div class="chart-legend">${legend}</div>`;
  }else{
    host.innerHTML=series.map(([label,value],i)=>`<div class="category-bar-row"><div class="chart-legend-item"><span>${escapeHTML(label)}</span><strong>${brl(value)} · ${(value/total*100).toFixed(1)}%</strong></div><div class="prog"><div class="prog-fill" style="width:${value/series[0][1]*100}%;background:${CCOLORS[i%CCOLORS.length]}"></div></div></div>`).join('');
  }
}
function renderMonthlyChart(){
  const months=[];
  for(let index=Math.max(0,DATA.currentMonth-4);index<=Math.min(11,DATA.currentMonth+1);index++){
    months.push({index,label:MONTHS[index],...transactionTotals(getYearData().months[MK[index]]?.transactions||[])});
  }
  const max=Math.max(1,...months.flatMap(m=>[m.entradas,m.gastos,m.investimentos]));
  document.getElementById('monthlyChart').innerHTML='<div class="monthly-bars">'+months.map(m=>`<div class="monthly-group"><div class="monthly-columns">${[['entradas','Entradas','var(--green)'],['gastos','Gastos','var(--red)'],['investimentos','Investimentos','var(--accent)']].map(([key,label,color])=>`<button type="button" class="monthly-bar" style="height:${Math.max(3,m[key]/max*130)}px;background:${color}" title="${escapeHTML(m.label+' · '+label+': '+brl(m[key]))}" aria-label="${escapeHTML(m.label+' · '+label+': '+brl(m[key]))}" data-tip="${escapeHTML(label+': '+brl(m[key]))}"><span class="chart-tooltip">${escapeHTML(m.label)}<br>${label}: ${brl(m[key])}</span></button>`).join('')}</div><span class="monthly-month ${m.index===DATA.currentMonth?'current':''}">${m.label.slice(0,3)}</span></div>`).join('')+'</div>';
}
