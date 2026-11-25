import makeWASocket, { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { parse, describe, apply, help } from './core.js';
import { interpret, findDelete, feedback } from './ai.js';

const { SUPABASE_URL, SUPABASE_KEY, FINANCAS_LOGIN, WHATSAPP_JID } = process.env;
if (!SUPABASE_URL || !SUPABASE_KEY || !FINANCAS_LOGIN || !WHATSAPP_JID || !/^\d+@(s\.whatsapp\.net|lid)$/.test(WHATSAPP_JID)) {
  console.error('Configure SUPABASE_URL, SUPABASE_KEY, FINANCAS_LOGIN e WHATSAPP_JID no arquivo .env.'); process.exit(1);
}
const base = new URL('/rest/v1/financial_data', SUPABASE_URL);
if (base.protocol !== 'https:') throw Error('SUPABASE_URL deve usar HTTPS.');
const headers = { apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}`, 'Content-Type':'application/json', Prefer:'return=representation' };
async function request(url, options={}) {
  const res=await fetch(url,{...options,headers});
  if (!res.ok) throw Error(`Falha no Supabase (${res.status}).`);
  return res.json();
}
function recordUrl(stamp) {
  const url=new URL(base); url.searchParams.set('user_login','eq.'+FINANCAS_LOGIN);
  if (stamp !== undefined) url.searchParams.set('updated_at',stamp===null?'is.null':'eq.'+stamp);
  return url;
}
async function load() {
  const url=recordUrl(); url.searchParams.set('select','data,updated_at');
  const rows=await request(url);
  if (rows.length!==1) throw Error('Registro financeiro não encontrado ou duplicado.');
  return rows[0];
}
async function save(record, action, messageId) {
  if (!apply(record.data,action,messageId)) return false;
  const stamp=new Date(Math.max(Date.now(),(Date.parse(record.updated_at)||0)+1)).toISOString();
  const rows=await request(recordUrl(record.updated_at),{method:'PATCH',body:JSON.stringify({data:record.data,updated_at:stamp})});
  if (rows.length!==1) throw Error('Os dados mudaram em outro dispositivo. Consulte novamente e repita a operação.');
  return true;
}
let pending=null, queue=Promise.resolve(), startedAt=Math.floor(Date.now()/1000);
async function connect() {
  const {state,saveCreds}=await useMultiFileAuthState('auth');
  const {version}=await fetchLatestBaileysVersion();
  const sock=makeWASocket({auth:state,version,printQRInTerminal:false});
  sock.ev.on('creds.update',saveCreds);
  sock.ev.on('connection.update',({connection,lastDisconnect,qr})=>{
    if(qr) qrcode.generate(qr,{small:true});
    if(connection==='open') console.log('WhatsApp conectado.');
    if(connection==='close') {
      pending=null;
      if(lastDisconnect?.error?.output?.statusCode===DisconnectReason.loggedOut) console.error('Sessão desconectada. Remova a pasta auth manualmente e conecte novamente.');
      else setTimeout(()=>connect().catch(console.error),5000);
    }
  });
  sock.ev.on('messages.upsert',({messages,type})=>{
    if(type!=='notify') return;
    for(const msg of messages) {
      if(process.env.WHATSAPP_SHOW_JIDS==='1' && !msg.key.fromMe && msg.key.remoteJid && !msg.key.remoteJid.endsWith('@g.us')) console.log('Identificador de contato recebido:',msg.key.remoteJid);
      if(msg.key.fromMe || msg.key.remoteJid!==WHATSAPP_JID || !msg.key.id || Number(msg.messageTimestamp)<startedAt) continue;
      const body=msg.message?.conversation || msg.message?.extendedTextMessage?.text;
      if(!body) continue;
      queue=queue.then(async()=>{
        let reply;
        try {
          const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
          let action;
          try { action=parse(body,today); }
          catch { action=await interpret(body,today,{key:process.env.GEMINI_API_KEY,model:process.env.GEMINI_MODEL||'gemini-3.1-flash-lite'}); }
          if(action.type==='help') reply=help;
          else if(action.type==='answer') reply=action.text;
          else if(action.type==='cancel') {pending=null; reply='Operação cancelada.';}
          else if(action.type==='confirm') {
            if(!pending || Date.now()>pending.expires) { pending=null; throw Error('Não há operação aguardando confirmação ou ela expirou. Solicite a operação novamente.'); }
            const current=pending; pending=null;
            const record=await load();
            if(describe(record.data,current.action)!==current.preview) throw Error('O lançamento mudou. Consulte e solicite a operação novamente.');
            reply=await save(record,current.action,current.messageId)?'Operação concluída.':'Operação já processada.';
          } else {
            const record=await load();
            if(action.type==='findDelete') action=findDelete(record.data,action);
            const preview=describe(record.data,action);
            if(action.type==='add'||action.type==='delete') {
              pending={action,preview,messageId:msg.key.id,expires:Date.now()+5*60*1000};
              reply=preview+'\nResponda confirmar em até 5 minutos, ou cancelar.';
            } else if(action.type==='report' && action.aiQuestion) {
              try { reply=await feedback(record.data,action,{key:process.env.GEMINI_API_KEY,model:process.env.GEMINI_MODEL||'gemini-3.1-flash-lite'}); }
              catch(e) { reply='Não consegui preparar uma resposta agora. Aqui estão os números:\n\n'+preview; }
            } else reply=preview;
          }
        } catch(e) { reply='Não foi possível concluir: '+e.message; }
        await sock.sendMessage(WHATSAPP_JID,{text:reply});
      }).catch(e=>console.error('Erro ao processar mensagem:',e.message));
    }
  });
}
connect().catch(e=>{console.error(e.message);process.exitCode=1;});
