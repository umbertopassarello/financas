// =====================================================================
// SIMULAÇÃO
// =====================================================================
async function loadSimUI(){
  const rows=await sb(`simulation_data?user_login=eq.${CU.login}&select=data`);
  if(rows.length){const sd=rows[0].data;simRows=sd.rows||[];if(document.getElementById('simSal'))document.getElementById('simSal').value=sd.sal||2800;if(document.getElementById('simExtra'))document.getElementById('simExtra').value=sd.extra||0;if(document.getElementById('simAnt'))document.getElementById('simAnt').value=sd.ant||0;if(document.getElementById('simInv'))document.getElementById('simInv').value=sd.inv||0;if(document.getElementById('simNotes'))document.getElementById('simNotes').value=sd.notes||'';}
  renderSimTbody();calcSim();
}
function addSimRow(){simRows.push({desc:'',cat:'Outros',tipo:'Variável',valor:0});renderSimTbody();}
function renderSimTbody(){
  document.getElementById('simTbody').innerHTML=simRows.length?simRows.map((r,i)=>`<tr><td><input class="inp" style="min-width:140px" value="${r.desc}" oninput="simRows[${i}].desc=this.value"></td><td><select class="inp" style="min-width:120px" onchange="simRows[${i}].cat=this.value">${CATS.map(c=>`<option${c===r.cat?' selected':''}>${c}</option>`).join('')}</select></td><td><select class="inp" onchange="simRows[${i}].tipo=this.value"><option${r.tipo==='Fixo'?' selected':''}>Fixo</option><option${r.tipo==='Parcelado'?' selected':''}>Parcelado</option><option${r.tipo==='Variável'?' selected':''}>Variável</option></select></td><td><input class="inp" type="number" style="min-width:90px;text-align:right" value="${r.valor}" oninput="simRows[${i}].valor=parseFloat(this.value)||0;calcSim()"></td><td><button class="btn btn-d btn-sm" onclick="simRows.splice(${i},1);renderSimTbody();calcSim()">✕</button></td></tr>`).join(''):`<tr><td colspan="5" class="empty">Clique em "+ Adicionar"</td></tr>`;
}
function calcSim(){
  const s=parseFloat(document.getElementById('simSal')?.value)||0,ex=parseFloat(document.getElementById('simExtra')?.value)||0,ant=parseFloat(document.getElementById('simAnt')?.value)||0,inv=parseFloat(document.getElementById('simInv')?.value)||0,g=simRows.reduce((s,r)=>s+r.valor,0),mes=s+ex-g-inv,fin=ant+mes;
  const se=(id,v,col)=>{const e=document.getElementById(id);if(!e)return;e.textContent=brl(Math.abs(v));if(col)e.style.color=v>=0?'var(--green)':'var(--red)';};
  se('srAnt',ant,true);se('srEnt',s+ex);se('srInv',inv);se('srGas',g);se('srMes',mes,true);se('srFinal',fin,true);
}
function copiarMesSim(){const mk=MK[DATA.currentMonth],txs=getYearData().months[mk].transactions;const en=txs.find(t=>t.tipo==='ENTRADA'&&t.desc.toLowerCase().includes('salário'));const iv=txs.filter(t=>t.tipo==='INVESTIMENTOS').reduce((s,t)=>s+t.valor,0);if(document.getElementById('simSal'))document.getElementById('simSal').value=en?.valor||2800;if(document.getElementById('simInv'))document.getElementById('simInv').value=iv;if(document.getElementById('simAnt'))document.getElementById('simAnt').value=getYearData().months[mk].resumo?.saldoAnterior||0;simRows=txs.filter(t=>t.tipo==='SAÍDA').map(t=>({desc:t.desc,cat:t.categoria||'Outros',tipo:t.tipoMov||'Variável',valor:t.valor}));renderSimTbody();calcSim();}
async function salvarSim(){await saveSim();alert('✅ Simulação salva!');}
function limparSim(){if(!confirm('Limpar simulação?'))return;simRows=[];renderSimTbody();calcSim();}

