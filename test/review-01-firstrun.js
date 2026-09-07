/* Reviewer pass 1: first run, every screen, real data, reload, persistence. */
module.exports = async ({ page, shot, wait, text, click, type, errors, log }) => {
  const js = (f, ...a) => page.evaluate(f, ...a);
  const setv = async (sel, v) => page.evaluate((s, val) => {
    const el = document.querySelector(s); el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, sel, v);

  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(300);

  await shot('01-onboard-1');
  await click('#obNext'); await wait(250); await shot('02-onboard-2');
  await click('#obNext'); await wait(250); await shot('03-onboard-3');
  await click('#obNext'); await wait(250); await shot('04-onboard-4');
  await click('#obNext'); await wait(200);
  log('empty-name err:', await js(() => document.querySelector('#obNameErr').textContent));
  await type('#obName', 'Amaia');
  await type('#obNode', 'Lower Road');
  await click('#obNext'); await wait(400);
  await shot('05-board-empty');
  log('board sub:', await text('#boardSub'));

  // people
  await click('[data-view="people"]'); await wait(300);
  await shot('06-people-one');
  for (const [n, note] of [['Walter', 'Flat 3, mornings are best'], ['Ines', 'Has the good ladder'],
                           ['Tomas', ''], ['Ruth', 'Nights only']]) {
    await click('#addPerson'); await wait(250);
    await type('#pName', n); if (note) await type('#pNote', note);
    await click('#pSave'); await wait(320);
  }
  log('people:', await js(() => Store.people().map(p => p.name).join(', ')));
  await shot('07-people-five');

  // offers and asks on a few
  const ids = await js(() => Store.people().map(p => p.id));
  const addListing = async (pid, kind, text, cat) => {
    await js((id) => { App.show('people'); }, pid);
    await js((id) => { document.querySelector(`.person[data-person="${id}"]`).click(); }, pid);
    await wait(220);
    await click(kind === 'ask' ? '#addAsk' : '#addOffer'); await wait(220);
    await type('#lText', text);
    await setv('#lCat', cat);
    await click('#lSave'); await wait(300);
    await js(() => { const c = document.querySelector('#closeP'); if (c) c.click(); });
    await wait(150);
  };
  await addListing(ids[0], 'offer', 'Rewire a lamp or fit a shelf', 'repair');
  await addListing(ids[1], 'offer', 'Two hours of Spanish conversation', 'teach');
  await addListing(ids[2], 'offer', 'Prune fruit trees and lift potatoes', 'grow');
  await addListing(ids[3], 'offer', 'Sit with someone after a hospital visit', 'care');
  await addListing(ids[1], 'ask', 'Explain how the pension form works', 'admin');
  await addListing(ids[4], 'offer', 'Drive a van on a Saturday', 'move');

  await click('[data-view="board"]'); await wait(320);
  await shot('08-board-offers');
  await click('.seg[data-board="asks"]'); await wait(250);
  await shot('09-board-asks');
  await click('.seg[data-board="offers"]'); await wait(200);

  // search
  await type('#boardSearch', 'lamp'); await wait(250);
  await shot('10-board-search');
  log('search rows:', await js(() => document.querySelectorAll('#boardList .entry').length));
  await setv('#boardSearch', 'zzzz'); await wait(250);
  await shot('11-board-nomatch');
  await setv('#boardSearch', ''); await wait(200);

  // bookings: arrange several
  await click('[data-view="bookings"]'); await wait(300);
  await shot('12-bookings-empty');
  const today = await js(() => new Date().toISOString().slice(0, 10));
  const soon = await js(() => new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
  const past = await js(() => new Date(Date.now() - 9 * 86400000).toISOString().slice(0, 10));

  const arrange = async (gi, ri, what, hrs, on) => {
    await click('#newBookingTop'); await wait(280);
    await setv('#bGiver', ids[gi]); await wait(120);
    await setv('#bReceiver', ids[ri]); await wait(120);
    await type('#bWhat', what);
    await setv('#bHours', String(hrs));
    if (on) await setv('#bOn', on);
    await wait(150);
    await click('#bSave'); await wait(350);
  };
  await arrange(1, 0, 'Rewire the hallway lamp', 2, soon);
  await arrange(2, 3, 'Spanish before the trip', 1.5, today);
  await arrange(3, 4, 'Prune the apple tree', 3, past);
  await shot('13-bookings-three');
  log('bookings text:', (await text('#bookingList')).slice(0, 400));

  // confirm one side then the other
  const bids = await js(() => Store.openBookings().map(b => b.id));
  await js((id) => document.querySelector(`.card[data-b="${id}"] [data-ok="giver"]`).click(), bids[0]);
  await wait(400);
  await shot('14-booking-one-side');
  await js((id) => document.querySelector(`.card[data-b="${id}"] [data-ok="receiver"]`).click(), bids[0]);
  await wait(500);
  await shot('15-booking-done');
  log('entries:', await js(() => Store.entries().length));

  // second full exchange
  await js((id) => document.querySelector(`.card[data-b="${id}"] [data-ok="giver"]`).click(), bids[1]);
  await wait(300);
  await js((id) => document.querySelector(`.card[data-b="${id}"] [data-ok="receiver"]`).click(), bids[1]);
  await wait(400);
  await shot('16-bookings-mixed');

  // ledger
  await click('[data-view="ledger"]'); await wait(400);
  await shot('17-ledger');
  log('ledger sub:', await text('#ledgerSub'));
  log('balances:', await js(() => Store.balances().map(b => b.name + ' ' + b.hours).join(', ')));

  // person sheet
  await click('[data-view="people"]'); await wait(250);
  await js((id) => document.querySelector(`.person[data-person="${id}"]`).click(), ids[1]);
  await wait(320);
  await shot('18-person-sheet');
  await js(() => document.querySelector('#closeP').click()); await wait(200);

  // reload: persistence
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(500);
  log('after reload view:', await js(() => document.querySelector('#v-board').hidden ? 'not board' : 'board'));
  log('after reload people:', await js(() => Store.people().length),
      'entries:', await js(() => Store.entries().length),
      'bookings:', await js(() => Store.openBookings().length + Store.pastBookings().length));
  await shot('19-after-reload');
  await click('[data-view="ledger"]'); await wait(400);
  await shot('20-ledger-after-reload');

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
};
