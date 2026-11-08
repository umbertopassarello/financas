// =====================================================================
// ADMIN
// =====================================================================
async function renderAdmin(){
  if(CU.role!=='admin')return;
  const users=await sb('users?select=*&order=created_at.asc');
  document.getElementById('adminTbody').innerHTML=users.map(u=>`<tr><td style="font-family:'DM Mono',monospace;font-size:12.5px">${u.login}</td><td>${u.name}</td><td><span class="${u.role==='admin'?'admin-badge':'user-badge'}">${u.role==='admin'?'Admin':'Usuário'}</span></td><td style="display:flex;gap:5px"><button class="btn btn-g btn-sm" onclick="openEditUser('${u.login}','${u.name}','${u.role}')">✎</button>${u.login!==CU.login?`<button class="btn btn-d btn-sm" onclick="delUser('${u.id}','${u.login}')">✕</button>`:''}</td></tr>`).join('');
}
function openNovoUser(){editingUserId=null;document.getElementById('moUserTitle').textContent='Novo Usuário';['uLogin','uName','uPass'].forEach(id=>document.getElementById(id).value='');document.getElementById('uRole').value='user';openModal('moUser');}
function openEditUser(login,name,role){editingUserId=login;document.getElementById('moUserTitle').textContent='Editar Usuário';document.getElementById('uLogin').value=login;document.getElementById('uName').value=name;document.getElementById('uPass').value='';document.getElementById('uRole').value=role;openModal('moUser');}
async function salvarUsuario(){
  const login=document.getElementById('uLogin').value.trim().toLowerCase(),name=document.getElementById('uName').value.trim(),pass=document.getElementById('uPass').value,role=document.getElementById('uRole').value;
  if(!login||!name){alert('Preencha login e nome.');return;}
  try{
    if(editingUserId){
      const upd={name,role};if(pass)upd.pass=pass;
      await sb(`users?login=eq.${editingUserId}`,{method:'PATCH',body:JSON.stringify(upd)});
    } else {
      if(!pass){alert('Defina uma senha.');return;}
      await sb('users',{method:'POST',body:JSON.stringify({login,name,pass,role})});
    }
    closeModal('moUser');renderAdmin();
  } catch(e){alert('Erro: '+(e.message||JSON.stringify(e)));}
}
async function delUser(id,login){
  if(!confirm(`Remover usuário "${login}"?`))return;
  await sb(`users?id=eq.${id}`,{method:'DELETE'});
  await sb(`financial_data?user_login=eq.${login}`,{method:'DELETE'});
  await sb(`simulation_data?user_login=eq.${login}`,{method:'DELETE'});
  renderAdmin();
}

