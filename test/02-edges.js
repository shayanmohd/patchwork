/* Every edge the recipe asks for, re-run against the new build. */
const { SEED } = require('./seed.js');
module.exports = async ({ page, shot, wait, text, click, type, errors, log }) => {
  const seed = async () => {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.evaluate(SEED);
    await page.reload({ waitUntil: 'networkidle0' }); await wait(300);
  };
  const ok = (label, pass, detail) => log((pass ? 'PASS  ' : 'FAIL  ') + label + (detail ? '  ' + detail : ''));

  // --- A. rapid taps on every primary button
  await seed();
  await page.evaluate(() => App.show('people')); await wait(200);
  await click('#addPerson'); await wait(250);
  await type('#pName', 'Deepa');
  await page.evaluate(() => { const b = document.querySelector('#pSave'); b.click(); b.click(); b.click(); });
  await wait(400);
  let names = await page.evaluate(() => Store.people().map(p => p.name));
  ok('A1 triple tap Add person adds one', names.filter(n => n === 'Deepa').length === 1, names.join(','));

  await seed();
  await page.evaluate(() => App.show('bookings')); await wait(200);
  await click('#newBookingTop'); await wait(300);
  await type('#bWhat', 'A thing');
  await page.evaluate(() => { const b = document.querySelector('#bSave'); b.click(); b.click(); b.click(); });
  await wait(400);
  ok('A2 triple tap Arrange adds one', await page.evaluate(() => Store.openBookings().length) === 2,
     'open=' + await page.evaluate(() => Store.openBookings().length) + ' (1 seeded + 1)');

  await seed();
  const ids = await page.evaluate(() => Store.people().map(p => p.id));
  await page.evaluate(i => App.show('people'), 0); await wait(200);
  await click(`.person[data-person="${ids[1]}"]`); await wait(300);
  await click('#addOffer'); await wait(250);
  await type('#lText', 'Sharpen your knives');
  await page.evaluate(() => { const b = document.querySelector('#lSave'); b.click(); b.click(); });
  await wait(400);
  ok('A3 double tap Add offer adds one',
     await page.evaluate(i => Store.person(i).offers.filter(o => o.text === 'Sharpen your knives').length, ids[1]) === 1);

  // --- B. the receiver stays chosen while the rest of the form changes
  await seed();
  await page.evaluate(() => App.show('bookings')); await wait(200);
  await click('#newBookingTop'); await wait(300);
  const b = await page.evaluate(() => {
    const r = document.querySelector('#bReceiver');
    r.value = r.options[r.options.length - 1].value; r.dispatchEvent(new Event('change'));
    const picked = r.options[r.selectedIndex].textContent;
    const h = document.querySelector('#bHours'); h.value = '2'; h.dispatchEvent(new Event('input'));
    const afterHours = r.options[r.selectedIndex].textContent;
    const d = document.querySelector('#bOn'); d.value = '2026-10-01'; d.dispatchEvent(new Event('change'));
    return { picked, afterHours, afterDate: r.options[r.selectedIndex].textContent };
  });
  ok('B receiver survives editing hours and date', b.picked === b.afterHours && b.picked === b.afterDate,
     JSON.stringify(b));
  await page.evaluate(() => App.back()); await wait(200);

  // --- C. the floor holds when the line is written, not only when it is arranged
  await seed();
  const floor = await page.evaluate(() => {
    const [a, w, r] = Store.people().map(p => p.id);
    const made = [];
    for (let i = 0; i < 8; i++) { const b = Store.addBooking(w, r, 'thing ' + i, 1, null); if (b) made.push(b.id); }
    let blocked = 0;
    made.forEach(id => { Store.confirm(id, 'giver'); const res = Store.confirm(id, 'receiver'); if (res.blocked) blocked++; });
    return { balance: Store.balance(r), blocked, arranged: made.length };
  });
  ok('C floor holds at confirm time', floor.balance >= -3, JSON.stringify(floor));
  await page.evaluate(() => App.show('bookings')); await wait(400);
  await shot('C-floor-blocked');

  // --- D. bad numbers are refused with a reason, not clamped in silence
  await seed();
  await page.evaluate(() => App.show('bookings')); await wait(200);
  await click('#newBookingTop'); await wait(300);
  await type('#bWhat', 'test');
  const d = await page.evaluate(() => {
    const out = {};
    const h = document.querySelector('#bHours'), s = document.querySelector('#bSave');
    for (const v of ['-4', '0', '999', 'abc', '']) {
      h.value = v; h.dispatchEvent(new Event('input'));
      out[v || '(empty)'] = { disabled: s.disabled, err: document.querySelector('#bHoursErr').hidden ? '' : 'shown' };
    }
    return out;
  });
  ok('D bad hours disable the button', Object.values(d).every(x => x.disabled), JSON.stringify(d));
  await page.evaluate(() => App.back()); await wait(200);

  // --- E. empty inputs give an inline error, never an alert
  await seed();
  await page.evaluate(() => App.show('people')); await wait(200);
  await click('#addPerson'); await wait(250);
  await click('#pSave'); await wait(300);
  await shot('E-inline-error');
  ok('E empty name errors inline', await page.evaluate(() =>
    !document.querySelector('#pNameErr').hidden && Store.people().length === 3));
  await page.evaluate(() => App.back()); await wait(200);

  // --- F. very long strings do not overflow or clip
  await seed();
  await page.evaluate(() => {
    const w = Store.people()[1].id;
    Store.addListing(w, 'offer', 'repair', 'Fixingthetapandtheboilerandtheshelf'.repeat(4));
    Store.addPerson('Bartholomewswithoutanyspacesatallwhatsoever'.repeat(2), 'x'.repeat(190));
  });
  for (const v of ['board', 'people', 'ledger']) { await page.evaluate(x => App.show(x), v); await wait(300); await shot('F-long-' + v); }
  ok('F no horizontal overflow', !await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth));

  // --- G. back()
  await seed();
  ok('G1 back at root is false', await page.evaluate(() => App.back()) === false);
  await page.evaluate(() => App.show('ledger')); await wait(150);
  ok('G2 back from a tab is true', await page.evaluate(() => App.back()) === true);
  await page.evaluate(() => App.show('people')); await wait(150);
  await click('#addPerson'); await wait(250);
  ok('G3 back closes the sheet', await page.evaluate(() => App.back()) === true
     && await page.evaluate(() => document.querySelector('#sheet').hidden));
  // a nested sheet goes back to the one that opened it
  await page.evaluate(() => App.show('people')); await wait(250);
  const ids2 = await page.evaluate(() => Store.people().map(p => p.id));
  await click(`.person[data-person="${ids2[1]}"]`); await wait(300);
  await click('#addOffer'); await wait(300);
  const backed = await page.evaluate(() => { App.back(); return document.querySelector('#sheetPanel h2').textContent; });
  ok('G4 back from a nested sheet returns to the person', backed === 'Walter', backed);
  await page.evaluate(() => App.back()); await wait(150);
  // onboarding
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' }); await wait(300);
  await click('#obNext'); await wait(200); await click('#obNext'); await wait(200);
  const g5 = await page.evaluate(() => { const r = App.back();
    return { r, card: [...document.querySelectorAll('#obTrack .ob-card')].findIndex(c => c.classList.contains('is-on')) }; });
  ok('G5 back pages onboarding instead of leaving', g5.r === true && g5.card === 1, JSON.stringify(g5));
  const g6 = await page.evaluate(() => { App.back(); return App.back(); });
  ok('G6 back at the first card leaves the app', g6 === false);

  // --- H. the shell contract
  await seed();
  ok('H1 onPause exists and does not throw', await page.evaluate(() => {
    try { App.onPause(); return typeof App.onPause === 'function'; } catch (e) { return 'threw: ' + e.message; } }) === true);
  ok('H2 onResume does not throw', await page.evaluate(() => {
    try { App.onResume(); return true; } catch (e) { return 'threw: ' + e.message; } }) === true);
  ok('H3 window.App is assigned', await page.evaluate(() => typeof window.App === 'object'));

  // --- I. duplicate names are flagged once, then allowed
  await seed();
  await page.evaluate(() => App.show('people')); await wait(200);
  await click('#addPerson'); await wait(250);
  await type('#pName', 'Walter');
  await click('#pSave'); await wait(300);
  const warned = await page.evaluate(() => !document.querySelector('#pNameErr').hidden);
  await shot('I-duplicate-warned');
  await click('#pSave'); await wait(350);
  ok('I duplicate name warns then allows', warned && await page.evaluate(() =>
    Store.people().filter(p => p.name === 'Walter').length) === 2);

  // --- J. a past date says so
  await seed();
  await page.evaluate(() => { const [a, w] = Store.people().map(p => p.id);
    Store.addBooking(w, a, 'Overdue thing', 1, '2020-01-05'); });
  await page.evaluate(() => App.show('bookings')); await wait(350);
  await shot('J-past-date');
  const meta = await text('#bookingList');
  ok('J a past date shows its year and that it has gone', meta.includes('2020') && /long past/.test(meta),
     meta.split('\n').slice(0, 4).join(' | '));

  log('page errors: ' + errors.length);
  if (errors.length) throw new Error('page errored');
};
