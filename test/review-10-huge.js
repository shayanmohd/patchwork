/* Reviewer pass 9: a book past what the quilt can hold, and past 30 done bookings. */
module.exports = async ({ page, shot, wait, text, click, errors, log }) => {
  const js = (f, ...a) => page.evaluate(f, ...a);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' }); await wait(250);
  await js(() => {
    Store.settings({ node: 'Lower Road' });
    const ids = ['Amaia','Walter','Rosa','Deepa','Tomas','Nell','Bo','Ines'].map(n => Store.addPerson(n, '').id);
    Store.settings({ me: ids[0] });
    Store.addListing(ids[0], 'offer', 'make', 'Take up a hem');
    for (let i = 0; i < 220; i++) Store.post(ids[i % 8], ids[(i + 1) % 8], 0.25, 'Exchange ' + i, 'direct');
    for (let i = 0; i < 45; i++) {
      const b = Store.addBooking(ids[i % 8], ids[(i + 2) % 8], 'Done ' + i, 0.25, null);
      Store.confirm(b.id, 'giver'); Store.confirm(b.id, 'receiver');
    }
    Store.onboarded(true);
  });
  await page.reload({ waitUntil: 'networkidle0' }); await wait(700);
  await js(() => App.show('ledger')); await wait(600);
  log('entries:', await js(() => Store.entries().length));
  log('caption:', (await text('.quilt-cap')).replace(/\n/g, ' | '));
  log('patches drawn:', await js(() => document.querySelectorAll('#quiltBig .patch').length));
  log('quilt svg height px:', await js(() => Math.round(document.querySelector('.quilt-big').getBoundingClientRect().height)));
  await shot('99-huge-ledger');
  await js(() => App.show('bookings')); await wait(600);
  log('past bookings:', await js(() => Store.pastBookings().length),
      'cards:', await js(() => document.querySelectorAll('#bookingList .card').length));
  log('tail note:', (await text('#bookingList')).split('\n').filter(Boolean).slice(-1)[0]);
  await shot('99-huge-bookings');
  await js(() => App.show('board')); await wait(500);
  await shot('99-huge-board');
  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
};
