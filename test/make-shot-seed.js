/* Builds the store-screenshot book once through the real Store API and saves the raw record,
   because shots.js seeds run before the app's scripts exist. */
const { RICH } = require('./rich.js');
const fs = require('fs');
module.exports = async ({ page, wait, log }) => {
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await page.evaluate(RICH);
  const raw = await page.evaluate(() => localStorage.getItem('patchwork.v1'));
  fs.writeFileSync(__dirname + '/shot-book.json', raw);
  log('shot book: ' + raw.length + ' bytes, ' + JSON.parse(raw).entries.length + ' entries');
};
