// =====================================================================
// AUTH
// =====================================================================
async function doLogin(){
  const login = document.getElementById('lUser').value.trim().toLowerCase();
  const pass = document.getElementById('lPass').value;
  const errEl = document.getElementById('loginErr');
  errEl.style.display = 'none';
  if(!login || !pass){ errEl.textContent = 'Preencha usuário e senha.'; errEl.style.display = 'block'; return; }
  try {
    setLoading('Autenticando...');
    document.getElementById('appLoading').style.display = 'flex';
    document.getElementById('loginScreen').classList.remove('show');
    const users = await sb(`users?login=eq.${login}&pass=eq.${pass}&select=*`);
    if(!users.length){
      document.getElementById('appLoading').style.display = 'none';
      document.getElementById('loginScreen').classList.add('show');
      errEl.textContent = 'Usuário ou senha incorretos.';
      errEl.style.display = 'block';
      return;
    }
    CU = users[0];
    localStorage.setItem('finDash_sess', JSON.stringify(CU));
    setLoading('Carregando dados...');
    await loadData();
    startApp();
  } catch(e) {
    document.getElementById('appLoading').style.display = 'none';
    document.getElementById('loginScreen').classList.add('show');
    errEl.textContent = e.code === 'INVALID_FINANCIAL_DATA'
      ? 'Seus dados foram encontrados, mas estão em um formato incompatível. Consulte o console para diagnóstico.'
      : 'Não foi possível concluir o acesso. Consulte o console para identificar o erro.';
    errEl.style.display = 'block';
    console.error(e);
  }
}
document.getElementById('lPass').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
document.getElementById('lUser').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });

function doLogout(){
  localStorage.removeItem('finDash_sess');
  location.reload();
}

