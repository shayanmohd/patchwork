/* Happy path: onboard, add people, listings, a booking, mutual confirm, ledger, export. */
module.exports = async ({ page, shot, wait, text, click, type, errors, log }) => {
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(300);

  await shot('01-onboard-1');
  await click('#obNext'); await wait(300); await shot('01-onboard-2');
  await click('#obNext'); await wait(300);
  await click('#obNext'); await wait(300); await shot('01-onboard-4');
  await type('#obName', 'Amaia');
  await type('#obNode', 'Lower Road');
  await click('#obNext'); await wait(400);
  await shot('02-board-empty');

  // add two more people
  await click('.tab[data-view="people"]'); await wait(250);
  for (const [n, note] of [['Walter', 'Flat 3, mornings are best'], ['Rosa', 'Two doors down']]) {
    await click('#addPerson'); await wait(250);
    await type('#pName', n); await type('#pNote', note);
    await click('#pSave'); await wait(350);
  }
  await shot('03-people-added');

  // open Walter, add an offer and an ask
  await click('.tab[data-view="people"]'); await wait(250);
  const ids = await page.evaluate(() => Store.people().map(p => ({ id: p.id, name: p.name })));
  log(JSON.stringify(ids));
  const walter = ids.find(p => p.name === 'Walter').id;
  await click(`.person[data-person="${walter}"]`); await wait(300);
  await shot('04-person-sheet');
  await click('#addOffer'); await wait(250);
  await type('#lText', 'Fix a dripping tap');
  await page.select('#lCat', 'repair');
  await click('#lSave'); await wait(350);
  await click('#addAsk'); await wait(250);
  await type('#lText', 'Explain how the pension form works');
  await page.select('#lCat', 'admin');
  await click('#lSave'); await wait(350);
  await shot('05-person-with-listings');

  // arrange an hour from this sheet
  await click('#bookWith'); await wait(300);
  await type('#bWhat', 'Rewire the hallway lamp');
  await page.evaluate(() => { document.querySelector('#bOn').value = '2026-09-12'; });
  await click('#bSave'); await wait(400);
  await shot('06-bookings');

  // confirm both sides
  await click('#bookingList [data-ok="giver"]'); await wait(350);
  await shot('07-waiting-one-side');
  await click('#bookingList [data-ok="receiver"]'); await wait(400);
  await shot('08-booking-done');

  await click('.tab[data-view="ledger"]'); await wait(350);
  await shot('09-ledger');

  await click('.tab[data-view="board"]'); await wait(300);
  await shot('10-board-offers');
  await click('.seg[data-board="asks"]'); await wait(300);
  await shot('11-board-asks');

  // persistence
  await page.reload({ waitUntil: 'networkidle0' }); await wait(500);
  await shot('12-after-reload');
  log('entries after reload: ' + await page.evaluate(() => Store.entries().length));
  log('balances: ' + await page.evaluate(() => JSON.stringify(Store.balances())));

  if (errors.length) throw new Error('page errored');
};
