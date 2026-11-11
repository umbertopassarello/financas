const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup(data) {
  const writes = [];
  const context = vm.createContext({
    DATA: data, CU: { login: 'test' }, simRows: [],
    setSyncing() {}, setSynced() {}, setSyncErr() {}, console,
    async sb(route, options) {
      if (options) { writes.push(JSON.parse(options.body)); return [{updated_at: JSON.parse(options.body).updated_at}]; }
      return route.startsWith('financial_data') ? [{ data }] : [];
    },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8'), context);
  return { context, writes };
}

test('loads yearly data and saves edits without changing other years or custom fields', async () => {
  const data = {
    currentYear: 2026, currentMonth: 10, customCats: ['Test'], customBanks: { test: {} },
    metas: [], investSaldo: 100,
    years: {
      2024: { months: { jan: { transactions: [{ id: 'old' }] } }, casa: {} },
      2025: { months: {}, casa: {} },
      2026: { months: { nov: { transactions: [{ id: 'current' }] } }, casa: { nov: [{ id: 'house' }] } },
    },
  };
  const { context, writes } = setup(data);
  const expected = JSON.parse(JSON.stringify(data));
  await vm.runInContext('loadData()', context);
  assert.equal(writes.length, 0);
  assert.deepEqual(data, expected);
  vm.runInContext("getYearData().months.nov.transactions = []; getYearData().casa.nov = [];", context);
  await vm.runInContext('saveData()', context);
  expected.years[2026].months.nov.transactions = [];
  expected.years[2026].casa.nov = [];
  assert.deepEqual(writes[0].data, expected);
  assert.equal(Object.hasOwn(writes[0].data, 'months'), false);
  assert.equal(Object.hasOwn(writes[0].data, 'casa'), false);
  data.currentYear = 2024;
  assert.equal(vm.runInContext('getYearData().months.jan.transactions[0].id', context), 'old');
});

test('keeps compatibility with records containing months and casa at the root', async () => {
  const data = { currentMonth: 10, months: { nov: { transactions: [] } }, casa: {} };
  const { context, writes } = setup(data);
  await vm.runInContext('loadData();', context);
  assert.equal(vm.runInContext('getYearData()', context), data);
  await vm.runInContext('saveData()', context);
  assert.deepEqual(writes[0].data, data);
});

test('rejects an unavailable selected year without writing to storage', async () => {
  const { context, writes } = setup({ currentYear: 2026, years: { 2025: { months: {} } } });
  await assert.rejects(vm.runInContext('loadData()', context), { code: 'INVALID_FINANCIAL_DATA' });
  assert.equal(writes.length, 0);
});

for(const table of ['financial_data','simulation_data'])test(table+' rejects stale writes atomically and accepts reload',async()=>{
 const {context:c}=setup({months:{}});c.document={getElementById:()=>({value:'0'})};
 let server={updated_at:'2026-11-10T10:00:00+00:00'},calls=[];
 c.sb=async(route,options)=>{
  calls.push({route,options});
  if(!options)return [{data:{months:{}},...server}];
  const expected='updated_at=eq.'+encodeURIComponent(server.updated_at);
  if(!route.includes(expected))return [];
  server={updated_at:JSON.parse(options.body).updated_at};return [server];
 };
 c.rememberRecord(table,[server]);server={updated_at:'2026-11-10T10:01:00+00:00'};
 const save=table==='financial_data'?c.saveData:c.saveSim;
 assert.equal(await save(),false);assert.equal(save.lastError.code,'SAVE_CONFLICT');assert.equal(server.updated_at,'2026-11-10T10:01:00+00:00');
 c.rememberRecord(table,[server]);assert.equal(await save(),true);assert.equal(await save(),true);
 assert.equal(calls[0].options.method,'PATCH');assert.match(calls[0].route,/user_login=eq.test/);
});
test('concurrent creation never overwrites an existing financial document',async()=>{
 const {context:c}=setup({months:{}});let method;
 c.sb=async(route,options)=>{method=options.method;throw {code:'23505'};};
 assert.equal(await c.saveData(),false);assert.equal(method,'POST');assert.equal(c.saveData.lastError.code,'SAVE_CONFLICT');
});
test('legacy null timestamp uses atomic null filter and learns returned version',async()=>{
 const {context:c}=setup({months:{}});c.rememberRecord('financial_data',[{updated_at:null}]);let route;
 c.sb=async(r,options)=>{route=r;return [{updated_at:JSON.parse(options.body).updated_at}];};
 assert.equal(await c.saveData(),true);assert.match(route,/updated_at=is.null/);
 assert.equal(await c.saveData(),true);assert.match(route,/updated_at=eq./);
});
test('pending saves cannot overlap for the same document',async()=>{
 const {context:c}=setup({months:{}});let finish,writes=0;
 c.sb=async()=>{writes++;return await new Promise(resolve=>finish=resolve);};
 const first=c.saveData();assert.equal(await c.saveData(),false);assert.equal(writes,1);finish([{updated_at:'2026-11-10T11:00:00Z'}]);assert.equal(await first,true);
});
