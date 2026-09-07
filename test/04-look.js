/* Look at every screen with a real book in it. */
const { RICH } = require('./rich.js');
module.exports = async ({ page, shot, wait, click, errors, log, text }) => {
  // headless shell defaults to dark; the drive flag adds --dark, so ask for light explicitly here
  if (!process.env.SHOTTAG) await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await page.evaluate(RICH);
  await page.reload({ waitUntil: 'networkidle0' }); await wait(600);
  const tag = process.env.SHOTTAG || '';
  for (const v of ['board', 'bookings', 'ledger', 'people']) {
    await page.evaluate(x => App.show(x), v); await wait(500);
    await shot(tag + 'L-' + v);
  }
  await page.evaluate(() => App.show('board')); await wait(300);
  await click('.seg[data-board="asks"]'); await wait(400); await shot(tag + 'L-asks');
  await click('.seg[data-board="offers"]'); await wait(300);
  await click('#boardList .entry'); await wait(450); await shot(tag + 'L-person');
  await click('#bookWith'); await wait(450); await shot(tag + 'L-arrange');
  await page.evaluate(() => App.back()); await wait(300);
  await page.evaluate(() => App.back()); await wait(300);
  await page.evaluate(() => { document.querySelector('#boardSearch').value = 'form';
    document.querySelector('#boardSearch').dispatchEvent(new Event('input')); });
  await wait(400); await shot(tag + 'L-search');
  log('errors: ' + errors.length);
};
