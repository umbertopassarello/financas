// =====================================================================
// DATA LOAD / SAVE
// =====================================================================
function getYearData(data = DATA){
  // Registros antigos guardam months/casa na raiz; os atuais usam years.
  const period = data?.years ? data.years[data.currentYear] : data;
  if(!period || typeof period !== 'object' || !period.months || typeof period.months !== 'object'){
    const error = new Error('Os dados salvos não possuem os meses do ano selecionado.');
    error.code = 'INVALID_FINANCIAL_DATA';
    throw error;
  }
  return period;
}

// A versão vem da leitura; nunca buscar uma versão nova para salvar dados antigos.
const recordVersions={financial_data:null,simulation_data:null};
const recordBusy=new Set();
function rememberRecord(table,rows){recordVersions[table]=rows.length?{stamp:rows[0].updated_at??null}:null;}
function conflictError(){const e=new Error('Os dados foram alterados em outra aba ou dispositivo. Recarregue a página antes de tentar novamente.');e.code='SAVE_CONFLICT';return e;}
async function writeRecord(table,data){
  if(recordBusy.has(table))throw new Error('Já existe um salvamento em andamento. Aguarde e tente novamente.');
  recordBusy.add(table);
  try{
    const version=recordVersions[table];
    const stamp=new Date(Math.max(Date.now(),Date.parse(version?.stamp||'')+1||0)).toISOString();
    const payload={data,updated_at:stamp};
    let rows;
    if(version){
      const filter=version.stamp===null?'is.null':'eq.'+encodeURIComponent(version.stamp);
      rows=await sb(table+'?user_login=eq.'+encodeURIComponent(CU.login)+'&updated_at='+filter,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
      if(!rows?.length)throw conflictError();
    }else{
      try{rows=await sb(table,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_login:CU.login,...payload})});}
      catch(e){if(e.code==='23505')throw conflictError();throw e;}
      if(!rows?.length)throw new Error('O servidor não confirmou a gravação. Recarregue a página para conferir os dados.');
    }
    recordVersions[table]={stamp:rows[0].updated_at??stamp};
  }finally{recordBusy.delete(table);}
}
async function loadData(){
  const rows=await sb('financial_data?user_login=eq.'+encodeURIComponent(CU.login)+'&select=data,updated_at');
  rememberRecord('financial_data',rows);
  if(rows.length){DATA=rows[0].data;getYearData();}
  else{DATA=buildInitialData();if(!await saveData())throw saveData.lastError;}
  const simulation=await sb('simulation_data?user_login=eq.'+encodeURIComponent(CU.login)+'&select=data,updated_at');
  rememberRecord('simulation_data',simulation);
  simRows=simulation.length?simulation[0].data.rows||[]:[];
}
async function saveData(){
  saveData.lastError=null;setSyncing();
  try{getYearData();await writeRecord('financial_data',DATA);setSynced();return true;}
  catch(e){saveData.lastError=e;setSyncErr(e.code==='SAVE_CONFLICT'?'Conflito: recarregue a página':undefined);console.error(e);return false;}
}
async function saveSim(){
  saveSim.lastError=null;setSyncing();
  try{
    await writeRecord('simulation_data',{rows:simRows,notes:document.getElementById('simNotes')?.value||'',sal:document.getElementById('simSal')?.value,extra:document.getElementById('simExtra')?.value,ant:document.getElementById('simAnt')?.value,inv:document.getElementById('simInv')?.value});
    setSynced();return true;
  }catch(e){saveSim.lastError=e;setSyncErr(e.code==='SAVE_CONFLICT'?'Conflito: recarregue a página':undefined);return false;}
}

function scheduleSave(){ clearTimeout(saveTimeout); saveTimeout = setTimeout(saveData, 1200); }

// =====================================================================
// INITIAL DATA
// =====================================================================
function buildInitialData(){
  const em = () => ({resumo:{saldoAnterior:0}, transactions:[]});
  return {
    currentMonth: 2,
    months: {
      jan:{resumo:{saldoAnterior:-654.61},transactions:defaultTx('jan')},
      fev:{resumo:{saldoAnterior:-1595.60},transactions:defaultTx('fev')},
      mar:{resumo:{saldoAnterior:-466.84},transactions:defaultTx('mar')},
      abr:{resumo:{saldoAnterior:-115.88},transactions:defaultTx('abr')},
      mai:{resumo:{saldoAnterior:0},transactions:defaultTx('mai')},
      jun:{resumo:{saldoAnterior:0},transactions:defaultTx('jun')},
      jul:{resumo:{saldoAnterior:0},transactions:defaultTx('jul')},
      ago:em(),set:em(),out:em(),nov:em(),dez:em()
    },
    metas:[
      {id:uuid(),descricao:'Reserva Financeira',objetivo:11000,atual:1300,aportes:[{data:'2025-12-31',valor:1300,desc:'Saldo 2025'}]},
      {id:uuid(),descricao:'Odonto',objetivo:300,atual:0,aportes:[]},
      {id:uuid(),descricao:'Paraquedas',objetivo:1100,atual:0,aportes:[]},
      {id:uuid(),descricao:'Viagem Final de Ano',objetivo:3000,atual:0,aportes:[]},
    ],
    casa:{jan:casaDef('jan'),fev:casaDef('fev'),mar:casaDef('mar'),abr:[],mai:[],jun:[],jul:[],ago:[],set:[],out:[],nov:[],dez:[]},
    investSaldo: 1300,
  };
}
function defaultTx(mk){
  const d={
    jan:[{id:uuid(),tipo:'ENTRADA',desc:'Salário',valor:2300,categoria:'Entrada',tipoMov:'Fixo',banco:'pago',data:'2026-01-01'},{id:uuid(),tipo:'ENTRADA',desc:'Freelas Dezembro',valor:2010,categoria:'Entrada',tipoMov:'Variável',banco:'pago',data:'2026-01-01'},{id:uuid(),tipo:'SAÍDA',desc:'Moto 4/12',valor:515.86,categoria:'Moto',tipoMov:'Parcelado',banco:'nubank',data:'2026-01-01'},{id:uuid(),tipo:'SAÍDA',desc:'Casa',valor:630.66,categoria:'Casa / Necessários',tipoMov:'Fixo',banco:'pago',data:'2026-01-01'},{id:uuid(),tipo:'SAÍDA',desc:'MEI',valor:80.90,categoria:'Casa / Necessários',tipoMov:'Fixo',banco:'pago',data:'2026-01-01'},{id:uuid(),tipo:'SAÍDA',desc:'Plano Celular e NU+',valor:39,categoria:'Casa / Necessários',tipoMov:'Fixo',banco:'nubank',data:'2026-01-01'},{id:uuid(),tipo:'SAÍDA',desc:'Youtube',valor:16.90,categoria:'Assinaturas',tipoMov:'Fixo',banco:'nubank',data:'2026-01-01'},{id:uuid(),tipo:'SAÍDA',desc:'Capacete 4/9',valor:62.96,categoria:'Moto',tipoMov:'Parcelado',banco:'nubank',data:'2026-01-01'},{id:uuid(),tipo:'SAÍDA',desc:'Mercado',valor:46.93,categoria:'Alimentação',tipoMov:'Variável',banco:'pago',data:'2026-01-03'},{id:uuid(),tipo:'SAÍDA',desc:'Pizza Dois Córregos',valor:110,categoria:'Comida / Besteira',tipoMov:'Variável',banco:'pago',data:'2026-01-03'}],
    fev:[{id:uuid(),tipo:'ENTRADA',desc:'Salário',valor:2800,categoria:'Entrada',tipoMov:'Fixo',banco:'pago',data:'2026-02-01'},{id:uuid(),tipo:'ENTRADA',desc:'Colação + Baile',valor:990,categoria:'Entrada',tipoMov:'Variável',banco:'pago',data:'2026-02-01'},{id:uuid(),tipo:'INVESTIMENTOS',desc:'Investimentos 15%',valor:0,categoria:'Investimentos',tipoMov:'Fixo',banco:'pago',data:'2026-02-01'},{id:uuid(),tipo:'SAÍDA',desc:'Moto 5/12',valor:515.86,categoria:'Moto',tipoMov:'Parcelado',banco:'nubank',data:'2026-02-01'},{id:uuid(),tipo:'SAÍDA',desc:'Casa',valor:588.56,categoria:'Casa / Necessários',tipoMov:'Fixo',banco:'pago',data:'2026-02-01'},{id:uuid(),tipo:'SAÍDA',desc:'Show Harry Styles 1/5',valor:99.76,categoria:'Lazer / Saídas',tipoMov:'Parcelado',banco:'nubank',data:'2026-02-01'},{id:uuid(),tipo:'SAÍDA',desc:'Veterinário Belo 3/6',valor:55,categoria:'Saúde',tipoMov:'Parcelado',banco:'nubank',data:'2026-02-01'}],
    mar:[{id:uuid(),tipo:'ENTRADA',desc:'Salário',valor:2800,categoria:'Entrada',tipoMov:'Fixo',banco:'pago',data:'2026-03-01'},{id:uuid(),tipo:'INVESTIMENTOS',desc:'Investimentos 25%',valor:0,categoria:'Investimentos',tipoMov:'Fixo',banco:'pago',data:'2026-03-01'},{id:uuid(),tipo:'SAÍDA',desc:'Moto 6/12',valor:515.86,categoria:'Moto',tipoMov:'Parcelado',banco:'nubank',data:'2026-03-01'},{id:uuid(),tipo:'SAÍDA',desc:'Casa',valor:703.88,categoria:'Casa / Necessários',tipoMov:'Fixo',banco:'pago',data:'2026-03-01'},{id:uuid(),tipo:'SAÍDA',desc:'MEI',valor:86.15,categoria:'Casa / Necessários',tipoMov:'Fixo',banco:'pago',data:'2026-03-01'},{id:uuid(),tipo:'SAÍDA',desc:'Academia',valor:75,categoria:'Casa / Necessários',tipoMov:'Fixo',banco:'pago',data:'2026-03-01'},{id:uuid(),tipo:'SAÍDA',desc:'Show Harry Styles 2/5',valor:99.76,categoria:'Lazer / Saídas',tipoMov:'Parcelado',banco:'nubank',data:'2026-03-01'},{id:uuid(),tipo:'SAÍDA',desc:'Ingresso Caju 1/2',valor:45,categoria:'Lazer / Saídas',tipoMov:'Parcelado',banco:'nubank',data:'2026-03-01'},{id:uuid(),tipo:'SAÍDA',desc:'Pedágio',valor:7,categoria:'Gasolina / Transporte',tipoMov:'Variável',banco:'pago',data:'2026-03-07'},{id:uuid(),tipo:'SAÍDA',desc:'Pizza Exagerada',valor:63.99,categoria:'Comida / Besteira',tipoMov:'Variável',banco:'pago',data:'2026-03-15'}],
    abr:[{id:uuid(),tipo:'ENTRADA',desc:'Salário',valor:2800,categoria:'Entrada',tipoMov:'Fixo',banco:'pago',data:'2026-04-01'},{id:uuid(),tipo:'INVESTIMENTOS',desc:'Investimentos 20%',valor:0,categoria:'Investimentos',tipoMov:'Fixo',banco:'pago',data:'2026-04-01'},{id:uuid(),tipo:'SAÍDA',desc:'Moto 7/12',valor:515.80,categoria:'Moto',tipoMov:'Fixo',banco:'nubank',data:'2026-04-01'},{id:uuid(),tipo:'SAÍDA',desc:'Casa',valor:750,categoria:'Casa / Necessários',tipoMov:'Fixo',banco:'pago',data:'2026-04-01'},{id:uuid(),tipo:'SAÍDA',desc:'3 Anos Namoro',valor:300,categoria:'Lazer / Saídas',tipoMov:'Variável',banco:'pago',data:'2026-04-01'}],
    mai:[{id:uuid(),tipo:'ENTRADA',desc:'Salário',valor:2800,categoria:'Entrada',tipoMov:'Fixo',banco:'pago',data:'2026-05-01'},{id:uuid(),tipo:'INVESTIMENTOS',desc:'Investimentos 20%',valor:560,categoria:'Investimentos',tipoMov:'Fixo',banco:'pago',data:'2026-05-01'},{id:uuid(),tipo:'SAÍDA',desc:'Moto 8/12',valor:515.80,categoria:'Moto',tipoMov:'Fixo',banco:'nubank',data:'2026-05-01'},{id:uuid(),tipo:'SAÍDA',desc:'Casa',valor:750,categoria:'Casa / Necessários',tipoMov:'Fixo',banco:'pago',data:'2026-05-01'}],
    jun:[{id:uuid(),tipo:'ENTRADA',desc:'Salário',valor:2800,categoria:'Entrada',tipoMov:'Fixo',banco:'pago',data:'2026-06-01'},{id:uuid(),tipo:'INVESTIMENTOS',desc:'Investimentos 20%',valor:560,categoria:'Investimentos',tipoMov:'Fixo',banco:'pago',data:'2026-06-01'},{id:uuid(),tipo:'SAÍDA',desc:'Moto 9/12',valor:515.80,categoria:'Moto',tipoMov:'Fixo',banco:'nubank',data:'2026-06-01'}],
    jul:[{id:uuid(),tipo:'ENTRADA',desc:'Salário',valor:2800,categoria:'Entrada',tipoMov:'Fixo',banco:'pago',data:'2026-07-01'},{id:uuid(),tipo:'INVESTIMENTOS',desc:'Investimentos 20%',valor:560,categoria:'Investimentos',tipoMov:'Fixo',banco:'pago',data:'2026-07-01'},{id:uuid(),tipo:'SAÍDA',desc:'Moto 10/12',valor:515.80,categoria:'Moto',tipoMov:'Fixo',banco:'nubank',data:'2026-07-01'}],
  };
  return d[mk]||[];
}
function casaDef(mk){
  const d={
    jan:[{id:uuid(),desc:'Água',valor:67.34,divisao:3},{id:uuid(),desc:'Luto',valor:62.5,divisao:3},{id:uuid(),desc:'Energia',valor:249.19,divisao:3},{id:uuid(),desc:'IPTU',valor:62.28,divisao:3},{id:uuid(),desc:'Ração',valor:100,divisao:3},{id:uuid(),desc:'Mercado (1)',valor:237,divisao:3},{id:uuid(),desc:'Mercado (2)',valor:684.67,divisao:3},{id:uuid(),desc:'Internet',valor:119.99,divisao:2},{id:uuid(),desc:'Belo 2/6',valor:55,divisao:1}],
    fev:[{id:uuid(),desc:'Água',valor:66.09,divisao:3},{id:uuid(),desc:'Luto',valor:62.5,divisao:3},{id:uuid(),desc:'Energia',valor:210.44,divisao:3},{id:uuid(),desc:'IPTU',valor:89.65,divisao:3},{id:uuid(),desc:'Ração',valor:157,divisao:3},{id:uuid(),desc:'Mercado (1)',valor:151,divisao:3},{id:uuid(),desc:'Mercado (2)',valor:375,divisao:3},{id:uuid(),desc:'Mercado (3)',valor:474,divisao:3},{id:uuid(),desc:'Internet',valor:119.99,divisao:2},{id:uuid(),desc:'Belo 3/6',valor:55,divisao:1}],
    mar:[{id:uuid(),desc:'Água',valor:68.31,divisao:3},{id:uuid(),desc:'Luto',valor:62.5,divisao:3},{id:uuid(),desc:'Energia',valor:217.76,divisao:3},{id:uuid(),desc:'IPTU',valor:89.65,divisao:3},{id:uuid(),desc:'Gás',valor:110,divisao:3},{id:uuid(),desc:'Mercado (1)',valor:599.36,divisao:3},{id:uuid(),desc:'Mercado (2)',valor:237.71,divisao:3},{id:uuid(),desc:'Máquina de Lavar',valor:250.7,divisao:3},{id:uuid(),desc:'Internet',valor:119.99,divisao:2},{id:uuid(),desc:'Belo 4/6',valor:55,divisao:1}],
  };
  return d[mk]||[];
}

