// Compatibilidade com lançamentos antigos e regras compartilhadas de pagamento.
const PAYMENT_METHODS = {
  credito:'Cartão de crédito', debito:'Cartão de débito', pix:'PIX',
  dinheiro:'Dinheiro', boleto:'Boleto', transferencia:'Transferência',
  outro:'Outro', nao_informado:'Não informado',
};
function escapeHTML(value){
  return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function paymentInfo(t){
  const legacyCard=t.banco && t.banco!=='pago' ? t.banco : '';
  return {
    method:t.formaPagamento || (legacyCard?'credito':'nao_informado'),
    card:t.cartao || legacyCard,
    status:t.status || (legacyCard?'pendente':'pago'),
  };
}
function cardInfo(key){
  const custom=DATA.customBanks?.[key];
  return BANKS[key] || {l:typeof custom==='string'?custom:(custom?.l||custom?.nome||custom?.name||key||'Sem cartão'),c:''};
}
function paymentBadges(t){
  const p=paymentInfo(t),card=cardInfo(p.card);
  return `<span class="payment-label">${escapeHTML(PAYMENT_METHODS[p.method]||p.method)}</span>${p.card?`<span class="btag ${escapeHTML(card.c)}">${escapeHTML(card.l)}</span>`:''}<span class="payment-status ${p.status==='pago'?'is-paid':'is-pending'}">${p.status==='pago'?'Pago':'Pendente'}</span>`;
}
function transactionTotals(txs){
  const total=type=>txs.filter(t=>t.tipo===type).reduce((sum,t)=>sum+(Number(t.valor)||0),0);
  const entradas=total('ENTRADA'),gastos=total('SAÍDA'),investimentos=total('INVESTIMENTOS'),resgates=total('RESGATE');
  const pagos=txs.filter(t=>t.tipo==='SAÍDA'&&paymentInfo(t).status==='pago').reduce((s,t)=>s+(Number(t.valor)||0),0);
  return {entradas,gastos,investimentos,resgates,pagos,pendentes:gastos-pagos,saldo:entradas+resgates-gastos-investimentos};
}
function filterTransactions(txs,filters){
  const matches=(set,value)=>!set?.size||set.has(value);
  return txs.filter(t=>{
    const p=paymentInfo(t);
    return (!filters.search||String(t.desc||'').toLocaleLowerCase('pt-BR').includes(filters.search.toLocaleLowerCase('pt-BR')))
      &&(!filters.from||(t.data&&t.data>=filters.from))
      &&(!filters.to||(t.data&&t.data<=filters.to))
      &&matches(filters.tipo,t.tipo)&&matches(filters.categoria,t.categoria||'Sem categoria')
      &&matches(filters.cartao,p.card||'sem_cartao')&&matches(filters.forma,p.method)
      &&matches(filters.status,p.status)&&matches(filters.mov,t.tipoMov||'Sem movimentação');
  });
}
function markCardInvoicesPaid(txs,cards){
  let count=0;
  txs.forEach(t=>{
    const p=paymentInfo(t);
    if(t.tipo==='SAÍDA'&&p.method==='credito'&&p.status==='pendente'&&cards.includes(p.card)){
      t.formaPagamento=p.method;t.cartao=p.card;t.status='pago';count++;
    }
  });
  return count;
}
function sortTransactions(txs,key,direction='asc'){
  const value=t=>({desc:t.desc,tipo:t.tipo,categoria:t.categoria,mov:t.tipoMov,data:t.data,valor:Number(t.valor)||0,pagamento:(PAYMENT_METHODS[paymentInfo(t).method]||'')+' '+cardInfo(paymentInfo(t).card).l,status:paymentInfo(t).status})[key]??'';
  return [...txs].sort((a,b)=>{
    const x=value(a),y=value(b),comparison=key==='valor'?x-y:String(x).localeCompare(String(y),'pt-BR',{numeric:true,sensitivity:'base'});
    return direction==='desc'?-comparison:comparison;
  });
}
function canDeleteTransaction(t){
  return !t.obligationId&&!(DATA.obligations||[]).some(o=>o.sourceId===t.id&&o.sourceMonth===MK[DATA.currentMonth]&&o.sourceYear===(Number(DATA.currentYear)||2026));
}
