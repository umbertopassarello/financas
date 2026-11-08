// =====================================================================
// SYNC INDICATOR
// =====================================================================
function setSyncing(){const d=document.getElementById('syncDot'),m=document.getElementById('syncMsg');if(d){d.className='sync-dot saving';m.textContent='Salvando...';}}
function setSynced(){const d=document.getElementById('syncDot'),m=document.getElementById('syncMsg');if(d){d.className='sync-dot';m.textContent='Sincronizado';}}
function setSyncErr(){const d=document.getElementById('syncDot'),m=document.getElementById('syncMsg');if(d){d.className='sync-dot error';m.textContent='Erro ao salvar';}}

// =====================================================================
// APP INIT
// =====================================================================
document.body.classList.toggle('light', localStorage.getItem('finDash_theme') === 'light');
document.getElementById('themeIcon').textContent = document.body.classList.contains('light') ? '🌙' : '☀️';

window.addEventListener('load', async () => {
  const sess = localStorage.getItem('finDash_sess');
  if (sess) {
    try {
      CU = JSON.parse(sess);
      setLoading('Carregando dados...');
      await loadData();
      startApp();
    } catch(e) {
      localStorage.removeItem('finDash_sess');
      showLoginScreen();
    }
  } else {
    showLoginScreen();
  }
});

function setLoading(msg){ document.getElementById('loadingMsg').textContent = msg; }
function hideLoading(){ document.getElementById('appLoading').style.display = 'none'; }
function showLoginScreen(){ hideLoading(); document.getElementById('loginScreen').classList.add('show'); }
function startApp(){
  hideLoading();
  document.getElementById('loginScreen').classList.remove('show');
  document.getElementById('sidebar').style.display = 'flex';
  document.getElementById('mainArea').style.display = 'block';
  document.getElementById('topbar').style.removeProperty('display');
  document.getElementById('sideUser').textContent = CU.name;
  if(CU.role === 'admin') document.getElementById('adminNav').style.display = 'flex';
  const theme = localStorage.getItem('finDash_theme') || 'dark';
  if(theme === 'light'){ document.body.classList.add('light'); document.getElementById('themeIcon').textContent = '🌙'; }
  renderMonthBtns();
  navTo('dashboard');
}

