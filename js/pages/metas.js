// =====================================================================
// METAS
// =====================================================================
function openNewMeta(){editingMetaId=null;document.getElementById('moMetaTitle').textContent='Nova Meta';['mDesc','mObj','mAtual','mAporteVal'].forEach(id=>document.getElementById(id).value='');document.getElementById('mAporteData').value=new Date().toISOString().substr(0,10);openModal('moMeta');}
function renderMetas(){
  const cols=['#7c6af7','#3ecf8e','#f5c842','#f47c3c','#FF6B9D','#93c5fd'];
  document.getElementById('metasGrid').innerHTML=DATA.metas.map((m,i)=>{const p=Math.min(100,(m.atual/(m.objetivo||1)*100)),c=cols[i%cols.length];return`<div class="card"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><div class="card-label">${m.descricao}</div><button class="btn btn-g btn-sm" onclick="openEditMeta('${m.id}')">✎</button></div><div class="card-val" style="color:${c}">${brl(m.atual)}</div><div class="card-sub">Meta: ${brl(m.objetivo)}</div><div class="prog"><div class="prog-fill" style="width:${p.toFixed(1)}%;background:${c}"></div></div><div style="display:flex;justify-content:space-between;margin-top:4px"><span style="font-size:10px;color:var(--text3)">${p.toFixed(1)}%</span><span style="font-size:10px;color:var(--text3)">Falta ${brl(m.objetivo-m.atual)}</span></div></div>`;}).join('');
  const ap=DATA.metas.flatMap(m=>(m.aportes||[]).map(a=>({...a,mn:m.descricao}))).sort((a,b)=>new Date(b.data)-new Date(a.data));
  document.getElementById('metaAportesTbody').innerHTML=ap.length?ap.map(a=>`<tr><td><span class="ttag tt-fixo">${a.mn}</span></td><td class="td-desc">${a.desc||'Aporte'}</td><td class="td-sm">${a.data||'—'}</td><td class="td-val g" style="text-align:right">+ ${brl(a.valor)}</td></tr>`).join(''):`<tr><td colspan="4" class="empty">Nenhum aporte</td></tr>`;
  document.getElementById('metaAportesMobile').innerHTML=ap.length?ap.map(a=>`<div class="mobile-item"><div class="mobile-item-icon" style="background:rgba(62,207,142,.1)">🎯</div><div class="mobile-item-body"><div class="mobile-item-desc">${a.desc||'Aporte'}</div><div class="mobile-item-sub"><span>${a.mn}</span><span>${a.data||'—'}</span></div></div><div class="mobile-item-val" style="color:var(--green)">+ ${brl(a.valor)}</div></div>`).join(''):`<div class="empty">Nenhum aporte</div>`;
}
function openEditMeta(id){const m=DATA.metas.find(x=>x.id===id);if(!m)return;editingMetaId=id;document.getElementById('moMetaTitle').textContent='Editar Meta';document.getElementById('mDesc').value=m.descricao;document.getElementById('mObj').value=m.objetivo;document.getElementById('mAtual').value=m.atual;document.getElementById('mAporteVal').value='';document.getElementById('mAporteData').value=new Date().toISOString().substr(0,10);openModal('moMeta');}
let savingMeta=false;
async function salvarMeta(){
  if(savingMeta)return;
  const value=id=>document.getElementById(id).value.trim();
  const desc=value('mDesc'),obj=Number(value('mObj')),atual=Number(value('mAtual')),av=Number(value('mAporteVal')),ad=value('mAporteData');
  if(!desc){alert('Informe a descrição.');return;}
  if([obj,atual,av].some(v=>!Number.isFinite(v)||v<0)){alert('Informe valores válidos, maiores ou iguais a zero.');return;}
  if(av>0&&!ad){alert('Informe a data do aporte.');return;}
  const previous=JSON.parse(JSON.stringify(DATA.metas));
  const m=editingMetaId?DATA.metas.find(x=>x.id===editingMetaId):{id:uuid(),aportes:[]};
  if(!m)return;
  m.descricao=desc;m.objetivo=obj;m.atual=atual;
  if(av>0){m.aportes=m.aportes||[];m.aportes.push({data:ad,valor:av,desc:editingMetaId?'Aporte':'Aporte inicial'});m.atual=Math.round((m.atual+av)*100)/100;}
  if(!editingMetaId)DATA.metas.push(m);
  savingMeta=true;
  let saved=false;
  try{
    saved=await saveData();
    if(!saved)throw saveData.lastError||new Error('O servidor não confirmou a gravação.');
  }catch(e){
    DATA.metas=previous;
    console.error('Erro ao salvar meta:',e);
    const detail=e?.message||e?.details||'Verifique sua conexão e tente novamente.';
    alert('Não foi possível salvar a meta. Os dados anteriores foram mantidos.\n'+detail);
    return;
  }finally{savingMeta=false;}
  editingMetaId=null;closeModal('moMeta');
  try{renderMetas();}
  catch(e){
    console.error('Erro ao atualizar metas:',e);
    alert('A meta foi salva, mas houve um erro ao atualizar a tela. Recarregue a página.');
  }
}