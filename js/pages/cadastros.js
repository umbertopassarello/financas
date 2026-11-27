function renderRegistrations(){
  const lists={
    registeredCards:registeredCardKeys().map(key=>cardInfo(key).l),
    registeredCategories:registeredCategories(),
  };
  for(const [id,names] of Object.entries(lists)){
    const sorted=names.sort((a,b)=>a.localeCompare(b,'pt-BR'));
    document.getElementById(id).innerHTML=sorted.map(name=>`<li>${escapeHTML(name)}</li>`).join('');
  }
}

async function saveRegistration(event){
  event.preventDefault();
  const form=event.currentTarget;
  const input=form.querySelector('input');
  const status=form.querySelector('[role="status"]');
  const name=input.value.trim().replace(/\s+/g,' ');
  const isCard=form.dataset.registration==='card';
  const names=isCard?registeredCardKeys().map(key=>cardInfo(key).l):registeredCategories();
  if(!name){
    status.textContent='Informe um nome.';
    input.focus();
    return;
  }
  if(names.some(existing=>existing.localeCompare(name,'pt-BR',{sensitivity:'base'})===0)){
    status.textContent='Esse nome já está cadastrado.';
    input.focus();
    return;
  }

  const button=form.querySelector('button');
  button.disabled=true;
  status.textContent='';
  try{
    const saved=await persistPlanningChange(()=>{
      if(isCard){
        DATA.customBanks??={};
        DATA.customBanks[uuid()]=name;
      }else{
        DATA.customCats??=[];
        DATA.customCats.push(name);
      }
    });
    if(!saved){
      status.textContent='Cadastro não salvo. Tente novamente.';
      return;
    }
    if(input.value.trim().replace(/\s+/g,' ')===name)form.reset();
    renderRegistrations();
    status.textContent=isCard?'Cartão cadastrado.':'Categoria cadastrada.';
  }finally{
    button.disabled=false;
  }
}

document.querySelectorAll('[data-registration]').forEach(form=>form.addEventListener('submit',saveRegistration));
