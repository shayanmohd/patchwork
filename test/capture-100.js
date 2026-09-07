/* Runs against the shipped 1.0.0 code and writes the exact localStorage payload it produces. */
const { SEED } = require('./seed.js');
const fs = require('fs');
module.exports = async ({ page, wait, log }) => {
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await page.evaluate(SEED);
  // and a booking half confirmed, plus an overdrafted person, so every field is exercised
  await page.evaluate(() => {
    const [a, w, r] = Store.people().map(p => p.id);
    const b = Store.addBooking(a, r, 'Two hours of sanding', 2, '2026-09-20');
    Store.confirm(b.id, 'giver');
    Store.post(r, a, 3, 'Long day clearing the yard', 'direct');
    Store.updatePerson(w, { note: 'Flat 3, mornings are best' });
  });
  const raw = await page.evaluate(() => localStorage.getItem('patchwork.v1'));
  fs.writeFileSync(__dirname + '/fixture-1.0.0.json', raw);
  log('wrote fixture, ' + raw.length + ' bytes');
  log(JSON.stringify(JSON.parse(raw), null, 1).slice(0, 900));
};
