import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, describe, apply } from './core.js';
import { interpret, findDelete, aggregate, feedback } from './ai.js';
const fresh=()=>({currentYear:2026,months:{nov:{transactions:[]}},obligations:[]});
test('inclusão e relatório com centavos e prevenção de repetição',()=>{
  const d=fresh(), a=parse('gasto | 45,90 | Mercado | Alimentação | 2026-11-24','2026-11-24');
  assert.equal(apply(d,a,'msg1'),true); assert.equal(apply(d,a,'msg1'),false);
  assert.match(describe(d,{type:'report',month:'2026-11'}),/45,90/);
});
test('remoção protege lançamento vinculado',()=>{
  const d=fresh(), a=parse('entrada | 10 | Teste | Entrada','2026-11-24'); apply(d,a,'msg1');
  d.obligations.push({sourceId:a.transaction.id,sourceYear:2026,sourceMonth:'nov'});
  assert.throws(()=>describe(d,{type:'delete',month:'2026-11',id:a.transaction.id}),/vinculado/);
});
test('rejeita data inválida e mês inexistente',()=>{
  assert.throws(()=>parse('gasto | 1 | x | Outros | 2026-02-30','2026-11-24'));
  assert.throws(()=>describe(fresh(),{type:'list',month:'2027-01'}),/não existe/);
});
test('confirmação simples não depende de código',()=>{
  assert.deepEqual(parse('confirmar','2026-11-24'),{type:'confirm'});
  assert.deepEqual(parse('  CONFIRMAR  ','2026-11-24'),{type:'confirm'});
});
test('IA interpreta inclusão sem gravar e confirmação continua necessária',async()=>{
  const fetcher=async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({intent:'add',kind:'gasto',amount:'50',description:'Gasolina',category:'Moto',date:'2026-11-24',month:'',query:'',question:''})}]}}]})});
  const action=await interpret('gastei 50 de gasolina','2026-11-24',{key:'teste',fetcher});
  assert.equal(action.type,'add'); assert.equal(action.transaction.valor,50);
});
test('remoção por descrição exige correspondência única',()=>{
  const d=fresh(); d.months.nov.transactions.push({id:'1',desc:'Mercado'},{id:'2',desc:'Mercado bairro'});
  assert.throws(()=>findDelete(d,{month:'2026-11',query:'mercado'}),/mais de um/);
  assert.equal(findDelete(d,{month:'2026-11',query:'1'}).id,'1');
});
test('agregação envia totais em centavos sem descrições',()=>{
  const d=fresh(); d.months.nov.transactions.push({tipo:'SAÍDA',valor:1.23,categoria:'Moto',desc:'privado'});
  const result=aggregate(d,'2026-11'); assert.equal(result.categories.Moto,123); assert.doesNotMatch(JSON.stringify(result),/privado/);
});
test('análise recebe valores calculados em reais e inclui investimentos e resgates no resultado',async()=>{
  const d=fresh(); d.months.nov.transactions.push({tipo:'ENTRADA',valor:100},{tipo:'SAÍDA',valor:70,categoria:'Moto'},{tipo:'INVESTIMENTOS',valor:20},{tipo:'RESGATE',valor:5});
  let prompt=''; const fetcher=async(_url,options)=>{prompt=JSON.parse(options.body).contents[0].parts[0].text;return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Você gastou R$ 70,00.'}]}}]})};};
  assert.equal(await feedback(d,{month:'2026-11',aiQuestion:'Quanto gastei?'},{key:'teste',fetcher}),'Você gastou R$ 70,00.');
  assert.match(prompt,/resultadoMensal/); assert.match(prompt,/15,00/); assert.match(prompt,/70,00/);
});
