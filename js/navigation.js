// =====================================================================
// NAVIGATION & MONTH
// =====================================================================
function navTo(p){
  document.querySelectorAll('.page').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active'));
  document.getElementById('page-'+p).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(el=>{if(el.getAttribute('onclick')===`navTo('${p}')`)el.classList.add('active');});
  curPage=p;closeSidebar();
  renderPage(p);
}
function renderPage(p){
  if(p==='dashboard') renderDash();
  else if(p==='lancamentos') renderLanc();
  else if(p==='investimentos') renderInvest();
  else if(p==='receivables') renderReceivables();
  else if(p==='calendario') renderCalendar();
  else if(p==='metas') renderMetas();
  else if(p==='casa') renderCasa();
  else if(p==='simulacao') loadSimUI();
  else if(p==='anual') renderAnual();
  else if(p==='admin') renderAdmin();
}
function renderMonthBtns(){
  const a=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  document.getElementById('monthBtns').innerHTML=a.map((m,i)=>`<button class="mbtn${DATA.currentMonth===i?' active':''}" onclick="setMonth(${i})">${m}</button>`).join('');
}
function setMonth(i){DATA.currentMonth=i;scheduleSave();renderMonthBtns();renderPage(curPage);}
function toggleTheme(){const l=document.body.classList.toggle('light');document.getElementById('themeIcon').textContent=l?'🌙':'☀️';localStorage.setItem('finDash_theme',l?'light':'dark');}
function openSidebar(){
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('open');
  document.getElementById('menuToggle').setAttribute('aria-expanded','true');
  if(window.matchMedia('(max-width:768px)').matches) document.body.style.overflow='hidden';
  document.querySelector('#sidebar .nav-item.active')?.focus();
}
function closeSidebar(){
  const sidebar=document.getElementById('sidebar');
  const wasOpen=sidebar.classList.contains('open');
  sidebar.classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
  document.getElementById('menuToggle').setAttribute('aria-expanded','false');
  document.body.style.removeProperty('overflow');
  if(wasOpen) document.getElementById('menuToggle').focus();
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSidebar();});
window.matchMedia('(max-width:768px)').addEventListener('change',()=>closeSidebar());

