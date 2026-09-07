/* Export and import both ways, corrupt files, and safe areas. */
const { SEED } = require('./seed.js');
module.exports = async ({ page, shot, wait, text, click, type, errors, log }) => {
  const ok = (l, p, d) => log((p ? 'PASS  ' : 'FAIL  ') + l + (d ? '  ' + d : ''));
  await page.evaluateOnNewDocument(() => {
    window.__saved = null; window.__shared = null;
    window.Native = { isNative: () => true, vibrate() {}, hasAmplitudeControl: () => true,
      saveFile(n, m, b64) { window.__saved = { n, m, b64 }; return 'content://downloads/1'; },
      shareUri(u) { window.__shared = u; } };
  });
  const seed = async () => {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.evaluate(SEED);
    await page.reload({ waitUntil: 'networkidle0' }); await wait(300);
  };
  await seed();

  // --- export through Native.saveFile
  await page.evaluate(() => App.show('people')); await wait(250);
  await click('#exportJson'); await wait(400);
  const meta = await page.evaluate(() => window.__saved && { n: window.__saved.n, m: window.__saved.m });
  ok('export goes through Native.saveFile and is shared',
     meta && meta.n === 'patchwork-book.json' && meta.m === 'application/json'
     && await page.evaluate(() => window.__shared) === 'content://downloads/1', JSON.stringify(meta));
  const json = await page.evaluate(() => decodeURIComponent(escape(atob(window.__saved.b64))));
  ok('exported book parses', (() => { try { JSON.parse(json); return true; } catch (e) { return false; } })(),
     json.length + ' bytes');
  await click('#exportCsv'); await wait(400);
  const csv = await page.evaluate(() => decodeURIComponent(escape(atob(window.__saved.b64))));
  ok('CSV names both sides', csv.includes('"Walter","Amaia"') && csv.includes('"Amaia","Rosa"'));
  log('  ' + csv.split('\n').slice(0, 3).join(' / '));

  // --- browser download path, with no Native at all
  await page.evaluate(() => { window.__noNative = 1; });
  await page.evaluateOnNewDocument(() => { delete window.Native; window.__clicked = null;
    HTMLAnchorElement.prototype.click = function () { window.__clicked = { href: this.href, dl: this.download }; }; });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await page.evaluate(SEED);
  await page.reload({ waitUntil: 'networkidle0' }); await wait(300);
  await page.evaluate(() => App.show('people')); await wait(250);
  await click('#exportJson'); await wait(350);
  const dl = await page.evaluate(() => window.__clicked);
  ok('browser download path fires an object-URL download',
     !!dl && dl.dl === 'patchwork-book.json' && dl.href.startsWith('blob:'), JSON.stringify(dl));
  ok('  and it toasted', await page.evaluate(() => document.querySelector('#toast').textContent) === 'Exported');

  // --- merge round trip
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' }); await wait(250);
  const r1 = await page.evaluate(j => Store.importJson(j), json);
  const r2 = await page.evaluate(j => Store.importJson(j), json);
  ok('merging into an empty book brings everything', r1.ok && r1.people === 3 && r1.entries === 2 && r1.bookings === 1, JSON.stringify(r1));
  ok('merging the same book twice changes nothing', r2.people === 0 && r2.entries === 0 && r2.bookings === 0, JSON.stringify(r2));
  ok('offers and asks survive the round trip',
     await page.evaluate(() => Store.people().reduce((n, p) => n + p.offers.length + p.asks.length, 0)) === 5);
  ok('balances survive the round trip',
     await page.evaluate(() => JSON.stringify(Store.balances().map(b => b.name + b.hours)))
     === JSON.stringify(['Walter3', 'Amaia2.5', 'Rosa0.5']),
     await page.evaluate(() => JSON.stringify(Store.balances())));

  // --- files that are not books, and books with rot in them
  ok('junk is refused', !(await page.evaluate(() => Store.importJson('not json'))).ok);
  ok('another app is refused', !(await page.evaluate(() => Store.importJson('{"app":"other"}'))).ok);
  ok('an array is refused', !(await page.evaluate(() => Store.importJson('[1,2,3]'))).ok);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' }); await wait(200);
  const hostile = await page.evaluate(() => Store.importJson(JSON.stringify({ app: 'patchwork',
    people: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c' }, 'nope', null],
    entries: [{ id: 'z', hours: 'lots', giverId: 'a', receiverId: 'b' },
              { id: 'y', hours: 1e9, giverId: 'a', receiverId: 'b' },
              { id: 'x', hours: 2, giverId: 'a', receiverId: 'a' },
              { hours: 1, giverId: 'a', receiverId: 'b' },
              { id: 'w', hours: 1.5, giverId: 'a', receiverId: 'b', what: 'real' }],
    bookings: 'nope' })));
  ok('a book with rot keeps only the readable rows', hostile.ok && hostile.people === 2 && hostile.entries === 1,
     JSON.stringify(hostile));
  const bal = await page.evaluate(() => Store.balances());
  ok('and no balance is NaN', bal.every(b => isFinite(b.hours)), JSON.stringify(bal));
  await page.evaluate(() => App.show('ledger')); await wait(350);
  await shot('IO-after-rotten-merge');
  ok('the ledger renders no NaN', !(await text('#v-ledger')).includes('NaN'));

  // --- a 1.0.0 book that already carries a poisoned line still opens
  await page.evaluate(() => {
    localStorage.setItem('patchwork.v1', JSON.stringify({ v: 1, onboarded: true, node: 'Old', me: 'a',
      people: [{ id: 'a', name: 'A', note: '', offers: [], asks: [] }, { id: 'b', name: 'B', note: '', offers: [], asks: [] }],
      bookings: [], entries: [{ id: 'e1', at: 1, giverId: 'a', receiverId: 'b', hours: 1, what: 'good' },
                              { id: 'e2', at: 2, giverId: 'a', receiverId: 'b', hours: 'lots', what: 'rot' }] }));
  });
  await page.reload({ waitUntil: 'networkidle0' }); await wait(400);
  await shot('IO-poisoned-1.0.0-book');
  ok('a poisoned 1.0.0 book is repaired on load and says so',
     await page.evaluate(() => Store.repairedOnLoad()) === 1
     && await page.evaluate(() => Store.entries().length) === 1
     && await page.evaluate(() => Store.balance('a')) === 3,
     'toast: ' + await page.evaluate(() => document.querySelector('#toast').textContent));

  // --- safe areas on every screen
  await seed();
  await page.evaluate(() => { document.documentElement.style.setProperty('--sat', '48px');
    document.documentElement.style.setProperty('--sab', '34px'); });
  for (const v of ['board', 'bookings', 'ledger', 'people']) {
    await page.evaluate(x => App.show(x), v); await wait(320); await shot('SA-' + v);
  }
  await click('#addPerson'); await wait(320); await shot('SA-sheet');
  await page.evaluate(() => App.back()); await wait(200);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' }); await wait(300);
  await page.evaluate(() => { document.documentElement.style.setProperty('--sat', '48px');
    document.documentElement.style.setProperty('--sab', '34px'); });
  await wait(200); await shot('SA-onboard');
  const under = await page.evaluate(() => {
    const r = document.querySelector('#onboard .ob-foot').getBoundingClientRect();
    return { footBottom: Math.round(innerHeight - r.bottom), inset: 34 };
  });
  ok('the onboarding footer clears the navigation bar', under.footBottom >= 0, JSON.stringify(under));

  log('page errors: ' + errors.length);
  if (errors.length) throw new Error('page errored');
};
