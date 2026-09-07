/* Upgrade from the shipped 1.0.0. The fixture was captured by running test/capture-100.js against
   the 1.0.0 code (git show 7a7edbf:web/js/store.js), so it is exactly what a real phone holds.
   Nothing in it may be lost or misread by this build. */
const fs = require('fs');
const RAW = fs.readFileSync(__dirname + '/fixture-1.0.0.json', 'utf8');
module.exports = async ({ page, shot, wait, text, click, errors, log }) => {
  const ok = (l, p, d) => log((p ? 'PASS  ' : 'FAIL  ') + l + (d ? '  ' + d : ''));
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);

  const before = JSON.parse(RAW);
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(r => localStorage.setItem('patchwork.v1', r), RAW);
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(500);

  ok('the app opens straight into the book, not onboarding',
     await page.evaluate(() => document.querySelector('#onboard').hidden === true
       && document.querySelector('#tabs').hidden === false));
  ok('nothing was repaired away', await page.evaluate(() => Store.repairedOnLoad()) === 0);

  const after = await page.evaluate(() => ({
    node: Store.settings().node, me: Store.settings().me, onboarded: Store.onboarded(),
    people: Store.people(), entries: Store.entries(),
    bookings: Store.settings().bookings, balances: Store.balances()
  }));
  ok('every person survived', after.people.length === before.people.length,
     after.people.length + ' of ' + before.people.length);
  ok('every name, note, offer and ask is byte-identical',
     JSON.stringify(after.people) === JSON.stringify(before.people));
  ok('every ledger line survived', JSON.stringify(after.entries) === JSON.stringify(before.entries),
     after.entries.length + ' of ' + before.entries.length);
  ok('every booking survived, including the half-confirmed one',
     JSON.stringify(after.bookings) === JSON.stringify(before.bookings),
     after.bookings.length + ' of ' + before.bookings.length
     + ', half-confirmed=' + after.bookings.filter(b => b.gaveOk !== b.gotOk).length);
  ok('the node name and the keeper survived', after.node === before.node && after.me === before.me);

  // balances computed by 1.0.0's own arithmetic, from the fixture
  const expect = {};
  for (const p of before.people) {
    let h = 2;
    for (const e of before.entries) { if (e.giverId === p.id) h += e.hours; if (e.receiverId === p.id) h -= e.hours; }
    expect[p.name] = Math.round(h * 4) / 4;
  }
  const got = {}; after.balances.forEach(b => { got[b.name] = b.hours; });
  ok('every balance is the number 1.0.0 showed', JSON.stringify(expect) === JSON.stringify(
     Object.fromEntries(Object.keys(expect).map(k => [k, got[k]]))), JSON.stringify(got));
  log('  balances: ' + JSON.stringify(got));

  for (const v of ['board', 'bookings', 'ledger', 'people']) {
    await page.evaluate(x => App.show(x), v); await wait(350); await shot('UP-' + v);
  }
  const led = await text('#v-ledger');
  ok('the ledger shows no NaN and no undefined', !/NaN|undefined/.test(led));

  // now write into the upgraded book and reload: the 1.0.0 rows are still there
  await page.evaluate(() => {
    const [a, b] = Store.people().map(p => p.id);
    Store.post(a, b, 0.75, 'Something new after the update', 'direct');
  });
  await page.reload({ waitUntil: 'networkidle0' }); await wait(400);
  const n = await page.evaluate(() => Store.entries().length);
  ok('a new line lands on top of the old book', n === before.entries.length + 1, n + ' entries');
  ok('the 1.0.0 lines are still identical after a write',
     await page.evaluate(k => JSON.stringify(Store.entries().slice(0, k)), before.entries.length)
     === JSON.stringify(before.entries));

  log('page errors: ' + errors.length);
  if (errors.length) throw new Error('page errored');
};
