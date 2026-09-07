/* Reviewer pass 11: every empty state drawn, on the screen it belongs to. */
module.exports = async ({ page, shot, wait, text, click, errors, log }) => {
  const js = (f, ...a) => page.evaluate(f, ...a);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' }); await wait(250);
  await js(() => { Store.settings({ node: 'Lower Road' }); Store.onboarded(true); });
  await page.reload({ waitUntil: 'networkidle0' }); await wait(500);
  await js(() => App.show('board')); await wait(400); await shot('B0-board-empty');
  log('board:', (await text('#boardEmpty')).replace(/\n+/g, ' / '));
  await js(() => App.show('bookings')); await wait(400); await shot('B1-bookings-empty');
  log('bookings:', (await text('#bookingEmpty')).replace(/\n+/g, ' / '));
  await js(() => App.show('ledger')); await wait(400); await shot('B2-ledger-empty');
  log('ledger:', (await text('#ledgerEmpty')).replace(/\n+/g, ' / '));
  await js(() => App.show('people')); await wait(400); await shot('B3-people-empty');
  log('people:', (await text('#peopleEmpty')).replace(/\n+/g, ' / '));
  // the asks tab with people but no asks
  await js(() => { Store.addPerson('Amaia', ''); Store.addPerson('Walter', '');
    Store.addListing(Store.people()[0].id, 'offer', 'repair', 'Rewire a lamp'); App.show('board'); });
  await wait(300);
  await js(() => document.querySelector('.seg[data-board="asks"]').click()); await wait(400);
  await shot('B4-asks-empty');
  log('asks:', (await text('#boardEmpty')).replace(/\n+/g, ' / '));
  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
};
