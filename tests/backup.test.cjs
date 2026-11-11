const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(extra={}){
  const c=vm.createContext({DATA:{},BANKS:{},MK:['jan','fev'],MONTHS:['Janeiro','Fevereiro'],...extra});
  for(const file of ['transactions.js','backup.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),c);
  return c;
}
test('backup includes all financial fields and saved simulation as independent copies',()=>{
  const c=setup(),data={years:{2025:{months:{}},2026:{months:{}}},obligations:[{amount:100}],investSaldo:10},simulation={notes:'Teste',rows:[]};
  const backup=c.buildBackup(data,simulation,'me','2026-11-10T12:00:00Z');
  assert.equal(backup.version,1);assert.equal(backup.owner.login,'me');
  assert.deepEqual(JSON.parse(JSON.stringify(backup.financial)),data);
  backup.financial.obligations[0].amount=0;backup.simulation.notes='Changed';
  assert.equal(data.obligations[0].amount,100);assert.equal(simulation.notes,'Teste');
  assert.equal('pass' in backup.owner,false);assert.equal('session' in backup,false);
});
test('CSV covers all years and safely quotes separators and spreadsheet formulas',()=>{
  const c=setup(),csv=c.transactionsCSV({years:{2025:{months:{jan:{transactions:[{tipo:'SAÍDA',desc:'=1+1',valor:12.5}]}}},2026:{months:{fev:{transactions:[{tipo:'ENTRADA',desc:'Água; "teste"',valor:20}]}}}}});
  assert.ok(csv.startsWith('\uFEFF'));assert.match(csv,/2025/);assert.match(csv,/2026/);
  assert.ok(csv.includes('"\'=1+1"'));assert.ok(csv.includes('"Água; ""teste"""'));assert.ok(csv.includes('"12,50"'));
});
test('failed simulation fetch does not download an incomplete backup',async()=>{
  const nodes={backupResult:{textContent:''},exportBackupButton:{disabled:false}};
  const c=setup({document:{getElementById:id=>nodes[id]},CU:{login:'me'},sb:async()=>{throw Error('offline');},console:{error(){}}});
  let downloads=0;c.downloadBackupFile=()=>downloads++;
  await c.exportBackup();assert.equal(downloads,0);assert.equal(nodes.exportBackupButton.disabled,false);assert.match(nodes.backupResult.textContent,/Não foi possível/);
});
test('complete export fetches saved simulation without writing to the server',async()=>{
  const nodes={backupResult:{textContent:''},exportBackupButton:{disabled:false}};
  const c=setup({DATA:{months:{}},document:{getElementById:id=>nodes[id]},CU:{login:'me',pass:'secret'},localDate:()=> '2026-11-10',sb:async(route,options)=>{assert.equal(options,undefined);return [{data:{rows:[],notes:'saved'}}];}});
  let exported;c.downloadBackupFile=content=>exported=JSON.parse(content);
  await c.exportBackup();assert.equal(exported.simulation.notes,'saved');assert.equal(JSON.stringify(exported).includes('secret'),false);
});
