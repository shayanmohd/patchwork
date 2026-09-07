/* Reviewer pass 7: a removed person, the repair toast on a second launch, erase, and the
   done-booking copy. */
module.exports = async ({ page, shot, wait, text, click, type, errors, log }) => {
  const js = (f, ...a) => page.evaluate(f, ...a);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(250);
  await js(() => {
    Store.settings({ node: 'Lower Road' });
    const a = Store.addPerson('Amaia', ''); Store.settings({ me: a.id });
    const w = Store.addPerson('Walter', ''); const i = Store.addPerson('Ines', '');
    const n = Store.addPerson('Nils', '');
    Store.addListing(a.id, 'offer', 'repair', 'Rewire a lamp');
    const b = Store.addBooking(n.id, a.id, 'Painted the door', 1, '2026-08-01');
    Store.confirm(b.id, 'giver'); Store.confirm(b.id, 'receiver');
    const b2 = Store.addBooking(w.id, i.id, 'Spanish', 1.5, '2026-09-01');
    Store.confirm(b2.id, 'giver'); Store.confirm(b2.id, 'receiver');
    Store.onboarded(true);
  });
  await page.reload({ waitUntil: 'networkidle0' }); await wait(400);
  await js(() => App.show('ledger')); await wait(350);
  log('ledger before removal:', (await text('#ledgerList')).replace(/\n+/g, ' / '));
  await shot('90-before-removal');
  const nils = await js(() => Store.people().find(p => p.name === 'Nils').id);
  await js((id) => Store.removePerson(id), nils);
  await js(() => { App.show('ledger'); }); await wait(350);
  log('ledger after removal:', (await text('#ledgerList')).replace(/\n+/g, ' / '));
  log('balances after removal:', await js(() => Store.balances().map(b => b.name + '=' + b.hours).join(' ')));
  await shot('91-after-removal');
  await js(() => App.show('bookings')); await wait(300);
  log('bookings after removal:', (await text('#bookingList')).replace(/\n+/g, ' / '));
  await shot('92-bookings-after-removal');

  // --- repair toast on a SECOND launch: does the bad line stay in storage?
  await js(() => {
    const d = JSON.parse(localStorage.getItem('patchwork.v1'));
    d.entries.push({ id: 'bad9', at: Date.now(), giverId: d.people[0].id,
                     receiverId: d.people[1].id, hours: 'lots', what: 'x', source: 'direct' });
    localStorage.setItem('patchwork.v1', JSON.stringify(d));
  });
  await page.reload({ waitUntil: 'networkidle0' }); await wait(500);
  log('launch 1 repaired:', await js(() => Store.repairedOnLoad()), 'toast:', await text('#toast'));
  await page.reload({ waitUntil: 'networkidle0' }); await wait(500);
  log('launch 2 repaired:', await js(() => Store.repairedOnLoad()), 'toast:', await text('#toast'));
  await page.reload({ waitUntil: 'networkidle0' }); await wait(500);
  log('launch 3 repaired:', await js(() => Store.repairedOnLoad()), 'toast:', await text('#toast'));
  log('bad line still in storage:', await js(() =>
    JSON.parse(localStorage.getItem('patchwork.v1')).entries.some(e => e.id === 'bad9')));

  // --- erase
  await js(() => { App.show('people'); });
  await wait(250);
  await js(() => document.querySelector('#eraseBtn').click()); await wait(150);
  log('erase armed:', await text('#eraseBtn'));
  await shot('93-erase-armed');

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
};
