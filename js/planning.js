// Saldos e pendências: o controle de devoluções é independente do saldo investido.
function activeYear(){return Number(DATA.currentYear)||2026;}
function localDate(){
  const now=new Date();
  return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
}
function pendingPaid(item){return (item.payments||[]).reduce((sum,p)=>sum+Number(p.amount||0),0);}
function pendingRemaining(item){return Math.max(0,Math.round((Number(item.amount)-pendingPaid(item))*100)/100);}
function obligations(kind){return (DATA.obligations||[]).filter(item=>item.kind===kind);}
function validateSettlement(item,amount){
  if(!Number.isFinite(amount)||amount<=0)throw new Error('Informe um valor maior que zero.');
  if(Math.round(amount*100)>Math.round(pendingRemaining(item)*100))throw new Error('O valor supera o saldo pendente.');
}
function saveObligation(item){
  if(!DATA.obligations)DATA.obligations=[];
  if(item.sourceId&&DATA.obligations.some(other=>other.id!==item.id&&other.sourceId===item.sourceId&&other.sourceYear===item.sourceYear&&other.sourceMonth===item.sourceMonth&&other.kind===item.kind)){
    throw new Error('Este lançamento já possui uma pendência vinculada.');
  }
  const index=DATA.obligations.findIndex(other=>other.id===item.id);
  if(index<0)DATA.obligations.push(item);else DATA.obligations[index]=item;
}
function calendarDays(year,month,txs){
  const count=new Date(year,month+1,0).getDate();
  return Array.from({length:count},(_,i)=>{
    const date=`${year}-${String(month+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;
    const items=txs.filter(t=>t.tipo==='SAÍDA'&&t.data===date);
    return {date,day:i+1,items,total:items.reduce((sum,t)=>sum+(Number(t.valor)||0),0)};
  });
}
function registerSettlement(item,amount,date){
  validateSettlement(item,amount);
  const parsed=new Date(date+'T12:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)throw new Error('Informe uma data válida.');
  const year=Number(date.slice(0,4)),month=Number(date.slice(5,7))-1;
  const period=DATA.years?DATA.years[year]:(year===activeYear()?DATA:null);
  if(!period?.months?.[MK[month]])throw new Error('Escolha uma data em um ano já cadastrado no painel.');
  const payment={id:uuid(),amount:Math.round(amount*100)/100,date};
  const transaction={id:uuid(),tipo:item.kind==='receivable'?'ENTRADA':'INVESTIMENTOS',desc:(item.kind==='receivable'?'Devolução recebida: ':'Reposição de investimentos: ')+item.description,valor:payment.amount,data:date,categoria:item.kind==='receivable'?'Entrada':'Investimentos',tipoMov:'Variável',banco:'pago',formaPagamento:'nao_informado',status:'pago',obligationId:item.id};
  payment.transactionId=transaction.id;payment.year=year;payment.month=MK[month];
  period.months[MK[month]].transactions.unshift(transaction);
  if(!item.payments)item.payments=[];
  item.payments.push(payment);
  return payment;
}
function reverseSettlement(item,paymentId){
  const payment=(item.payments||[]).find(p=>p.id===paymentId);
  if(!payment)throw new Error('Registro não encontrado.');
  const period=DATA.years?DATA.years[payment.year]:DATA;
  const month=period?.months?.[payment.month];
  if(!month?.transactions.some(t=>t.id===payment.transactionId&&t.obligationId===item.id))throw new Error('O lançamento vinculado não foi encontrado. Confira o histórico antes de estornar.');
  month.transactions=month.transactions.filter(t=>t.id!==payment.transactionId);
  item.payments=item.payments.filter(p=>p.id!==paymentId);
}
let planningSaving=false;
async function persistPlanningChange(change){
  if(planningSaving)return false;
  planningSaving=true;
  const snapshot=JSON.stringify(DATA);
  try{
    change();
    if(await saveData()===false)throw new Error('Não foi possível salvar. A alteração foi desfeita; confira a conexão e tente novamente.');
    return true;
  }catch(error){DATA=JSON.parse(snapshot);alert(error.message);return false;}
  finally{planningSaving=false;}
}
