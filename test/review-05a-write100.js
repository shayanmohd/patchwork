/* Drives the SHIPPED 1.0.0 build and dumps exactly what it wrote to localStorage.
   Run against a server rooted at a `git archive 7a7edbf web` checkout. */
const fs = require('fs');
module.exports = async ({ page, shot, wait, click, type, errors, log }) => {
  const js = (f, ...a) => page.evaluate(f, ...a);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(300);

  // onboarding, through the real 1.0.0 UI
  await click('#obNext'); await wait(150);
  await click('#obNext'); await wait(150);
  await click('#obNext'); await wait(150);
  await type('#obName', 'Amaia');
  await type('#obNode', 'Lower Road');
  await click('#obNext'); await wait(400);
  await shot('100-board');

  // everything else through the 1.0.0 Store, which is what its UI called
  await js(() => {
    const cats = ['repair', 'teach', 'grow', 'care', 'move', 'admin'];
    const names = [['Walter', 'Flat 3, mornings are best'], ['Ines', 'Has the good ladder'],
                   ['Tomas', ''], ['Ruth', 'Nights only'], ['Bo', 'Two doors down']];
    const ids = [Store.people()[0].id];
    for (const [n, note] of names) ids.push(Store.addPerson(n, note).id);
    Store.addListing(ids[0], 'offer', 'repair', 'Rewire a lamp or fit a shelf');
    Store.addListing(ids[1], 'offer', 'teach', 'Two hours of Spanish conversation');
    Store.addListing(ids[2], 'offer', 'grow', 'Prune fruit trees and lift potatoes');
    Store.addListing(ids[3], 'offer', 'care', 'Sit with someone after a hospital visit');
    Store.addListing(ids[4], 'offer', 'move', 'Drive a van on a Saturday');
    Store.addListing(ids[5], 'ask', 'admin', 'Explain how the pension form works');
    Store.addListing(ids[1], 'ask', 'other', 'Somebody to hold the other end of the sofa');

    const day = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    // two bookings that were confirmed on both sides, so 1.0.0 wrote ledger lines
    const b1 = Store.addBooking(ids[2], ids[3], 'Spanish before the trip', 1.5, day(-6));
    Store.confirm(b1.id, 'giver'); Store.confirm(b1.id, 'receiver');
    const b2 = Store.addBooking(ids[3], ids[5], 'Prune the apple tree', 3, day(-2));
    Store.confirm(b2.id, 'giver'); Store.confirm(b2.id, 'receiver');
    const b3 = Store.addBooking(ids[4], ids[0], 'Move the piano', 2.25, day(-40));
    Store.confirm(b3.id, 'giver'); Store.confirm(b3.id, 'receiver');
    // one half-confirmed, one plain, one with no date at all (1.0.0 stored null)
    const b4 = Store.addBooking(ids[1], ids[0], 'Rewire the hallway lamp', 2, day(3));
    Store.confirm(b4.id, 'giver');
    Store.addBooking(ids[5], ids[2], 'Sofa across the landing', 0.75, day(1));
    Store.addBooking(ids[0], ids[4], 'Sit in on the appointment', 1, '');
    // a direct ledger line with no booking behind it, which 1.0.0's post() allowed
    Store.post(ids[3], ids[1], 0.5, 'Lent an hour at the fete', 'direct');
    // a person who then leaves the roster: their patches stay in the book
    const gone = Store.addPerson('Nils', 'moved away');
    Store.post(gone.id, ids[0], 1, 'Painted the door before he left', 'direct');
    Store.removePerson(gone.id);
  });
  const raw = await js(() => localStorage.getItem('patchwork.v1'));
  fs.writeFileSync('/Users/sherry/Documents/DEVPROJECTS/patchwork/test/review-fixture-1.0.0.json', raw);
  log('fixture bytes:', raw.length);
  const d = JSON.parse(raw);
  log('people', d.people.length, 'bookings', d.bookings.length, 'entries', d.entries.length);
  log('keys on a person:', Object.keys(d.people[0]).join(','));
  log('keys on a booking:', Object.keys(d.bookings[0]).join(','));
  log('keys on an entry:', Object.keys(d.entries[0]).join(','));
  log('top-level keys:', Object.keys(d).join(','));
  log('balances 1.0.0:', await js(() => Store.balances().map(b => b.name + '=' + b.hours).join(' ')));
  log('ledger lines 1.0.0:', await js(() => Store.entries().map(e =>
    Store.nameOf(e.giverId) + '>' + Store.nameOf(e.receiverId) + ':' + e.hours).join(' | ')));
  await js(() => App.show('ledger'));
  await wait(300); await shot('101-ledger-100');
  if (errors.length) throw new Error('1.0.0 page errors: ' + errors.join(' | '));
};
