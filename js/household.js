function houseTotals(items){
  const total=items.reduce((s,i)=>s+Number(i.valor||0),0);
  const share=items.reduce((s,i)=>s+Number(i.valor||0)/Math.max(1,Number(i.divisao)||1),0);
  const paid=items.filter(i=>i.payer==='eu'&&i.paymentStatus==='pago').reduce((s,i)=>s+Math.min(Number(i.valor)||0,Number(i.paidAmount??i.valor)||0),0);
  return {total,share,paid,net:Math.round((share-paid)*100)/100,debt:Math.max(0,Math.round((share-paid)*100)/100),credit:Math.max(0,Math.round((paid-share)*100)/100)};
}
function copyHouseItems(items){
  return items.map(item=>({...item,id:uuid(),paymentStatus:'pendente',paidAmount:0}));
}
