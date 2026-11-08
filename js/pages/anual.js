// =====================================================================
// RESUMO ANUAL
// =====================================================================
function toggleCatAnual(){showCatAnual=!showCatAnual;document.getElementById('anualCatPanel').style.display=showCatAnual?'block':'none';document.getElementById('btnCat').textContent=showCatAnual?'📊 Ocultar':'📊 Ver por categoria';if(showCatAnual)renderAnualCat();}
function renderAnual(){
  let ac=0;
  const rows=MK.map((k,i)=>{const txs=getYearData().months[k].transactions;const e=txs.filter(t=>t.tipo==='ENTRADA').reduce((s,t)=>s+t.valor,0);const g=txs.filter(t=>t.tipo==='SAÍDA').reduce((s,t)=>s+t.valor,0);const iv=txs.filter(t=>t.tipo==='INVESTIMENTOS').reduce((s,t)=>s+t.valor,0);const re=txs.filter(t=>t.tipo==='RESGATE').reduce((s,t)=>s+t.valor,0);const s=e+re-g-iv;ac+=s;return{m:MONTHS[i],e,g,iv,s,ac,ok:txs.length>0};});
  const te=rows.reduce((s,r)=>s+r.e,0),tg=rows.reduce((s,r)=>s+r.g,0),ti=rows.reduce((s,r)=>s+r.iv,0);
  document.getElementById('anualCards').innerHTML=[{l:'Total Entradas',v:brl(te),c:'g'},{l:'Total Gastos',v:brl(tg),c:'r'},{l:'Total Investido',v:brl(ti),c:'a'}].map(c=>`<div class="card"><div class="card-label">${c.l}</div><div class="card-val ${c.c}">${c.v}</div></div>`).join('');
  const mv=Math.max(...rows.map(r=>Math.max(r.e,r.g)),1);
  document.getElementById('anualBars').innerHTML=rows.map((r,i)=>{const hE=Math.max(3,Math.round(r.e/mv*140)),hG=Math.max(3,Math.round(r.g/mv*140)),hI=Math.max(2,Math.round(r.iv/mv*140));return`<div style="flex:1;display:flex;flex-direction:column;align-items:center;height:100%"><div style="flex:1;display:flex;align-items:flex-end;gap:1px;width:100%"><div style="flex:1;background:rgba(62,207,142,${r.ok?.65:.12});border-radius:2px 2px 0 0;height:${hE}px" title="${r.m} entradas: ${brl(r.e)}"></div><div style="flex:1;background:rgba(244,100,95,${r.ok?.65:.12});border-radius:2px 2px 0 0;height:${hG}px" title="${r.m} gastos: ${brl(r.g)}"></div><div style="flex:1;background:rgba(124,106,247,${r.iv>0?.7:.12});border-radius:2px 2px 0 0;height:${hI}px"></div></div><div style="font-size:9px;color:${i===DATA.currentMonth?'var(--accent2)':'var(--text3)'};margin-top:3px;font-family:'DM Mono',monospace">${MONTHS[i].substr(0,3)}</div></div>`;}).join('');
  document.getElementById('anualTbody').innerHTML=rows.map(r=>`<tr style="${!r.ok?'opacity:.4':''}"><td style="font-weight:500">${r.m}</td><td class="td-val g" style="text-align:right">${r.e?brl(r.e):'—'}</td><td class="td-val r" style="text-align:right">${r.g?brl(r.g):'—'}</td><td class="td-val a" style="text-align:right">${r.iv?brl(r.iv):'—'}</td><td class="td-val ${r.s>=0?'g':'r'}" style="text-align:right">${r.e||r.g?brlS(r.s):'—'}</td><td class="td-val ${r.ac>=0?'g':'r'}" style="text-align:right;font-weight:600">${r.e||r.g?brlS(r.ac):'—'}</td></tr>`).join('');
  if(showCatAnual)renderAnualCat();
}
function renderAnualCat(){
  const cm={};MK.forEach(k=>{getYearData().months[k].transactions.filter(t=>t.tipo==='SAÍDA').forEach(t=>{const c=t.categoria||'Outros';cm[c]=(cm[c]||0)+t.valor;});});
  const sorted=Object.entries(cm).sort((a,b)=>b[1]-a[1]);const total=sorted.reduce((s,[,v])=>s+v,0),mx=sorted[0]?.[1]||1;
  document.getElementById('anualCatChart').innerHTML=sorted.map(([cat,val],i)=>`<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;margin-bottom:2px"><span style="font-size:12.5px;color:var(--text2)">${cat}</span><span style="font-size:12px;font-family:'DM Mono',monospace;color:var(--text3)">${brl(val)} <span style="color:${CCOLORS[i%CCOLORS.length]};font-weight:600">${total>0?(val/total*100).toFixed(1):0}%</span></span></div><div class="prog" style="height:8px"><div class="prog-fill" style="width:${(val/mx*100).toFixed(1)}%;background:${CCOLORS[i%CCOLORS.length]}"></div></div></div>`).join('')||'<span style="color:var(--text3)">Sem dados</span>';
}

