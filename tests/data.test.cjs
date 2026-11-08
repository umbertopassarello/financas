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
      if (options) { writes.push(JSON.parse(options.body)); return []; }
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
