// =====================================================================
// MODALS
// =====================================================================
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('.mo').forEach(el=>el.addEventListener('click',e=>{if(e.target===el)el.classList.remove('open');}));
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.mo.open').forEach(el=>el.classList.remove('open'));});
