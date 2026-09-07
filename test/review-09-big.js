/* Reviewer pass 8: a big book. Does the quilt still tell the truth, do the lists hold up? */
module.exports = async ({ page, shot, wait, text, click, errors, log }) => {
  const js = (f, ...a) => page.evaluate(f, ...a);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(250);
  await js(() => {
    Store.settings({ node: 'Lower Road' });
    const names = ['Amaia', 'Walter', 'Rosa', 'Deepa', 'Tomas', 'Nell', 'Bo', 'Ines', 'Nils', 'Ada'];
    const ids = names.map(n => Store.addPerson(n, '').id);
    Store.settings({ me: ids[0] });
    for (let i = 0; i < 10; i++) Store.addListing(ids[i], 'offer', 'other', 'Offer number ' + (i + 1));
    // 60 ledger lines that keep everyone inside the floor
    for (let i = 0; i < 60; i++) {
      const g = ids[i % 10], r = ids[(i + 1) % 10];
      Store.post(g, r, 0.25, 'Exchange ' + (i + 1), 'direct');
    }
    // 40 done bookings and 12 open ones
    for (let i = 0; i < 40; i++) {
      const b = Store.addBooking(ids[i % 10], ids[(i + 3) % 10], 'Done booking ' + i, 0.25, null);
      Store.confirm(b.id, 'giver'); Store.confirm(b.id, 'receiver');
    }
    for (let i = 0; i < 12; i++) Store.addBooking(ids[i % 10], ids[(i + 5) % 10], 'Open booking ' + i, 1,
      new Date(Date.now() + i * 86400000).toISOString().slice(0, 10));
    Store.onboarded(true);
  });
  await page.reload({ waitUntil: 'networkidle0' }); await wait(600);
  log('entries:', await js(() => Store.entries().length));
  log('board sub:', await text('#boardSub'));
  await shot('95-big-board');
  log('mini quilt patches drawn:', await js(() => document.querySelectorAll('#quiltMini .patch').length),
      'ghosts:', await js(() => document.querySelectorAll('#quiltMini rect[stroke-dasharray]').length
        - document.querySelectorAll('#quiltMini .patch rect[stroke-dasharray]').length));
  await js(() => App.show('ledger')); await wait(500);
  log('ledger sub:', await text('#ledgerSub'));
  log('quilt caption:', await text('.quilt-cap'));
  log('big quilt patches drawn:', await js(() => document.querySelectorAll('#quiltBig .patch').length));
  log('ledger lines rendered:', await js(() => document.querySelectorAll('#ledgerList .line').length));
  await shot('96-big-ledger');
  await js(() => App.show('bookings')); await wait(500);
  log('booking cards rendered:', await js(() => document.querySelectorAll('#bookingList .card').length),
      '(open', await js(() => Store.openBookings().length), 'past', await js(() => Store.pastBookings().length) + ')');
  log('bookings sub:', await text('#bookingSub'));
  await shot('97-big-bookings');
  await js(() => App.show('people')); await wait(400);
  await shot('98-big-people');
  log('balances:', await js(() => Store.balances().map(b => b.name + '=' + b.hours).join(' ')));
  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
};
