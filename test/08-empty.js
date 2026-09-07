/* The first ten minutes: onboarding and every empty screen, in the theme that carries the brand. */
module.exports = async ({ page, shot, wait, click, type, errors, log }) => {
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' }); await wait(400);
  await shot('EMPTY-onboard-1');
  for (let i = 0; i < 3; i++) { await click('#obNext'); await wait(300); }
  await shot('EMPTY-onboard-4');
  await type('#obName', 'Amaia'); await type('#obNode', 'Lower Road');
  await click('#obNext'); await wait(500);
  await shot('EMPTY-board');
  for (const v of ['bookings', 'ledger', 'people']) {
    await page.evaluate(x => App.show(x), v); await wait(400); await shot('EMPTY-' + v);
  }
  // one person only: the board still has nothing on it
  await click('#addPerson'); await wait(300);
  await type('#pName', 'Walter'); await click('#pSave'); await wait(400);
  await page.evaluate(() => App.show('board')); await wait(400);
  await shot('EMPTY-board-no-offers');
  await click('.seg[data-board="asks"]'); await wait(350);
  await shot('EMPTY-board-no-asks');
  await page.evaluate(() => { const s = document.querySelector('#boardSearch');
    s.value = 'plumbing'; s.dispatchEvent(new Event('input')); });
  await wait(350); await shot('EMPTY-no-match');
  log('page errors: ' + errors.length);
  if (errors.length) throw new Error('page errored');
};
