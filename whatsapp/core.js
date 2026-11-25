import { randomUUID } from 'node:crypto';

const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const money = n => Number(n).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
export function period(data, date) {
  if (!/^\d{4}-\d{2}$/.test(date) || +date.slice(5) < 1 || +date.slice(5) > 12) throw Error('Informe o mês no formato AAAA-MM.');
  const year = +date.slice(0,4), key = months[+date.slice(5)-1];
  const p = data.years ? data.years[year] : year === (Number(data.currentYear) || 2026) ? data : null;
  if (!p?.months?.[key] || !Array.isArray(p.months[key].transactions)) throw Error('Esse mês/ano ainda não existe no aplicativo.');
  return { list:p.months[key].transactions, year, key };
}
export function parse(text, today) {
  const parts = text.trim().split('|').map(s=>s.trim());
  const command = parts[0].toLocaleLowerCase('pt-BR');
  if (command === 'ajuda') return { type:'help' };
  if (command === 'cancelar') return { type:'cancel' };
  if (command === 'confirmar' && parts.length === 1) return { type:'confirm' };
  if (command === 'relatorio' || command === 'relatório' || command === 'listar') return { type:command === 'listar'?'list':'report', month:parts[1] || today.slice(0,7) };
  if (command === 'remover') {
    if (!parts[1] || !parts[2]) throw Error('Use: remover | AAAA-MM | ID');
    return {type:'delete',month:parts[1],id:parts[2]};
  }
  if (command === 'gasto' || command === 'entrada') {
    const raw = parts[1] || '';
    if (!/^\d+(?:[,.]\d{1,2})?$/.test(raw)) throw Error('Informe um valor positivo, por exemplo 45,90.');
    const cents = Math.round(Number(raw.replace(',','.'))*100);
    const date = parts[4] || today;
    if (!Number.isSafeInteger(cents) || cents <= 0 || !parts[2] || !parts[3] || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date+'T12:00:00Z')) || new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date) throw Error('Informe valor, descrição, categoria e data válida.');
    return {type:'add', month:date.slice(0,7), transaction:{id:randomUUID(),tipo:command==='gasto'?'SAÍDA':'ENTRADA',valor:cents/100,desc:parts[2],categoria:parts[3],data:date,tipoMov:'Variável',banco:'pago',formaPagamento:'nao_informado',status:'pago'}};
  }
  throw Error('Comando não reconhecido. Envie ajuda.');
}
export const help = `Comandos (separe os campos com |):
gasto | 45,90 | Mercado | Alimentação | 2026-11-24
entrada | 1000 | Salário | Entrada | 2026-11-24
listar | 2026-11
relatório | 2026-11
remover | 2026-11 | ID
confirmar
cancelar
A data e o mês são opcionais nos comandos de inclusão e consulta. Inclusões são registradas como pagas, com forma de pagamento não informada.`;
export function describe(data, action) {
  const {list,year,key} = period(data, action.month);
  if (action.type === 'add') { const t=action.transaction; return `Adicionar ${t.tipo}: ${t.desc}, ${money(t.valor)}, ${t.categoria}, ${t.data}?`; }
  if (action.type === 'delete') {
    const t=list.find(x=>x.id===action.id);
    if (!t) throw Error('Lançamento não encontrado. Consulte listar.');
    if (t.obligationId || (data.obligations||[]).some(o=>o.sourceId===t.id && o.sourceYear===year && o.sourceMonth===key)) throw Error('Lançamento vinculado a pendência: faça a correção pelo aplicativo.');
    return `Remover ${t.desc}, ${money(t.valor)}, ${t.data || 'sem data'} (ID ${t.id})?`;
  }
  if (action.type === 'list') return list.length ? list.map(t=>`${t.id} | ${t.data||'sem data'} | ${t.tipo} | ${t.desc} | ${money(t.valor)}`).join('\n') : 'Nenhum lançamento neste mês.';
  const total = tipo => list.filter(t=>t.tipo===tipo).reduce((s,t)=>s+Math.round((Number(t.valor)||0)*100),0)/100;
  const e=total('ENTRADA'), s=total('SAÍDA'), i=total('INVESTIMENTOS'), r=total('RESGATE');
  return `Relatório ${action.month}\nEntradas: ${money(e)}\nSaídas: ${money(s)}\nInvestimentos: ${money(i)}\nResgates: ${money(r)}\nResultado: ${money(e+r-s-i)}\nInclui lançamentos pagos e pendentes; não inclui saldo anterior.`;
}
export function apply(data, action, messageId) {
  data.whatsappProcessed ||= [];
  if (data.whatsappProcessed.includes(messageId)) return false;
  const {list}=period(data,action.month);
  if (action.type==='add') list.push(action.transaction);
  else if (action.type==='delete') { describe(data,action); list.splice(list.findIndex(t=>t.id===action.id),1); }
  else throw Error('Operação inválida.');
  data.whatsappProcessed.push(messageId);
  data.whatsappProcessed=data.whatsappProcessed.slice(-500);
  return true;
}
