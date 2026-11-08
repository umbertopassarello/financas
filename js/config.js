// =====================================================================
// SUPABASE CONFIG
// =====================================================================
const SB_URL = 'https://gnzgupoqzlgrgawtneew.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imduemd1cG9xemxncmdhd3RuZWV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjM4NDYsImV4cCI6MjA5MDIzOTg0Nn0.-hBeQzfQq69eZ3qhD2nbv4m8uTR93oqPnHaec9ojpvA';
const sb = (path, opts={}) => fetch(`${SB_URL}/rest/v1/${path}`, {
  ...opts,
  headers: {'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation', ...opts.headers},
}).then(async r => {
  const body=await r.text();
  const data=body?JSON.parse(body):null;
  if(!r.ok)throw data||new Error(`Erro ao acessar os dados (${r.status}).`);
  return data;
});

// =====================================================================
// CONSTANTS
// =====================================================================
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MK = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const CATS = ['Alimentação','Assinaturas','Beleza / Cuidados','Casa / Necessários','Comida / Besteira','Compras Gerais','Entrada','Gasolina / Transporte','Investimentos','Lazer / Saídas','Moda / Perfumes','Moto','Outros','Presentes','Saúde','Viagem'];
const BANKS = {pago:{l:'Pago',c:'b-pago'},nubank:{l:'Nubank',c:'b-nubank'},nupj:{l:'Nubank PJ',c:'b-nupj'},santander:{l:'Santander',c:'b-santander'},santpj:{l:'Sant. PJ',c:'b-santpj'},ml:{l:'Mercado Livre',c:'b-ml'},inter:{l:'Inter',c:'b-inter'},picpay:{l:'PicPay',c:'b-picpay'}};
const CCOLORS = ['#7c6af7','#3ecf8e','#f4645f','#f5c842','#f47c3c','#FF6B9D','#93c5fd','#a3e635','#c77dff','#34d399','#fb923c','#e879f9'];
const uuid = () => Math.random().toString(36).substr(2,9);
const brl = v => 'R$ ' + Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const brlS = v => (v>=0?'+':'-') + brl(Math.abs(v));

