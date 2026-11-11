const BACKUP_VERSION=1;
function buildBackup(data,simulation,login,exportedAt=new Date().toISOString()){
  if(!data||typeof data!=='object'||(!data.months&&!data.years))throw new Error('Não há dados financeiros válidos para exportar.');
  return {application:'financas',version:BACKUP_VERSION,exportedAt,owner:{login},financial:JSON.parse(JSON.stringify(data)),simulation:simulation==null?null:JSON.parse(JSON.stringify(simulation))};
}
function csvCell(value,numeric=false){
  let text=String(value??'');
  // Impede que descrições sejam executadas como fórmulas em planilhas.
  if(!numeric&&/^[\s]*[=+\-@\t\r]/.test(text))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}
function transactionsCSV(data){
  const rows=[['Ano','Mês','Data','Tipo','Descrição','Valor (R$)','Categoria','Movimentação','Forma de pagamento','Cartão','Status']];
  const years=data.years||{[Number(data.currentYear)||2026]:data};
  Object.entries(years).sort(([a],[b])=>Number(a)-Number(b)).forEach(([year,period])=>{
    MK.forEach((month,index)=>(period.months?.[month]?.transactions||[]).forEach(t=>{
      const payment=paymentInfo(t);
      rows.push([year,MONTHS[index],t.data||'',t.tipo,t.desc,(Number(t.valor)||0).toFixed(2).replace('.',','),t.categoria,t.tipoMov,PAYMENT_METHODS[payment.method]||payment.method,payment.card?cardInfo(payment.card).l:'',payment.status==='pago'?'Pago':'Pendente']);
    }));
  });
  return '\uFEFF'+rows.map((row,index)=>row.map((cell,column)=>csvCell(cell,index>0&&column===5)).join(';')).join('\r\n');
}
function downloadBackupFile(content,name,type){
  const url=URL.createObjectURL(new Blob([content],{type}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=name;
  document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function openBackup(){document.getElementById('backupResult').textContent='';openModal('moBackup');}
let backupExporting=false;
async function exportBackup(){
  if(backupExporting)return;
  const result=document.getElementById('backupResult');
  const button=document.getElementById('exportBackupButton');
  backupExporting=true;button.disabled=true;result.textContent='Preparando o backup…';
  try{
    // Busca a simulação completa, inclusive quando sua tela não foi aberta.
    const rows=await sb(`simulation_data?user_login=eq.${encodeURIComponent(CU.login)}&select=data`);
    const backup=buildBackup(DATA,rows?.[0]?.data??null,CU.login);
    downloadBackupFile(JSON.stringify(backup,null,2),'financas-backup-'+localDate()+'.json','application/json;charset=utf-8');
    result.textContent='Arquivo de backup preparado para download. Guarde-o em um local privado: ele contém seus dados financeiros.';
  }catch(error){
    result.textContent='Não foi possível gerar o backup completo. Confira a conexão e tente novamente.';
    console.error('Falha ao exportar backup:',error);
  }finally{backupExporting=false;button.disabled=false;}
}
function exportTransactionsCSV(){
  try{
    getYearData();
    downloadBackupFile(transactionsCSV(DATA),'financas-lancamentos-'+localDate()+'.csv','text/csv;charset=utf-8');
    document.getElementById('backupResult').textContent='CSV de todos os anos preparado para download. O CSV não substitui o backup JSON.';
  }catch(error){document.getElementById('backupResult').textContent='Não foi possível exportar os lançamentos.';}
}
