/* Upgrade: seed a real 1.0.0 record, load the 1.0.1 build, prove nothing is lost or misread. */
const fs = require('fs');
const RAW = fs.readFileSync('/Users/sherry/Documents/DEVPROJECTS/patchwork/test/review-fixture-1.0.0.json', 'utf8');
module.exports = async ({ page, shot, wait, text, click, errors, log }) => {
  const js = (f, ...a) => page.evaluate(f, ...a);
  await page.evaluate(r => { localStorage.clear(); localStorage.setItem('patchwork.v1', r); }, RAW);
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(600);

  const before = JSON.parse(RAW);
  const after = await js(() => JSON.parse(localStorage.getItem('patchwork.v1')));
  log('stored record untouched on load:', JSON.stringify(after) === JSON.stringify(before));

  log('onboarded:', await js(() => Store.onboarded()));
  log('node:', await js(() => Store.settings().node), '| me:', await js(() => Store.settings().me));
  log('people:', await js(() => Store.people().map(p => p.name).join(', ')));
  log('offers+asks:', await js(() => Store.people().map(p => p.name + ':' + p.offers.length + '/' + p.asks.length).join(' ')));
  log('entries:', await js(() => Store.entries().length), 'repaired:', await js(() => Store.repairedOnLoad()));
  log('bookings open/past:', await js(() => Store.openBookings().length + '/' + Store.pastBookings().length));
  log('balances 1.0.1:', await js(() => Store.balances().map(b => b.name + '=' + b.hours).join(' ')));
  log('ledger 1.0.1:', await js(() => Store.entries().map(e =>
    Store.nameOf(e.giverId) + '>' + Store.nameOf(e.receiverId) + ':' + e.hours).join(' | ')));

  await shot('30-upgrade-board');
  await click('[data-view="bookings"]'); await wait(350); await shot('31-upgrade-bookings');
  log('bookings screen:', (await text('#bookingList')).replace(/\n+/g, ' / ').slice(0, 700));
  await click('[data-view="ledger"]'); await wait(400); await shot('32-upgrade-ledger');
  await click('[data-view="people"]'); await wait(350); await shot('33-upgrade-people');

  // export must round-trip
  const out = await js(() => Store.exportJson());
  log('export parses:', (() => { try { const d = JSON.parse(out); return d.app === 'patchwork' && d.people.length; } catch (e) { return 'NO'; } })());
  log('csv head:', (await js(() => Store.exportCsv())).split('\n').slice(0, 3).join(' // '));

  // now write something and check the record still holds everything
  await js(() => { const p = Store.people(); Store.post(p[1].id, p[2].id, 0.25, 'A quarter hour', 'direct'); });
  const after2 = await js(() => JSON.parse(localStorage.getItem('patchwork.v1')));
  log('after a write, people kept:', after2.people.length, 'entries:', after2.entries.length,
      'bookings:', after2.bookings.length, 'node:', after2.node, 'me kept:', after2.me === before.me);
  log('booking `on` values kept:', JSON.stringify(after2.bookings.map(b => b.on)));
  log('every 1.0.0 entry id still present:',
      before.entries.every(e => after2.entries.some(x => x.id === e.id)));
  log('every 1.0.0 booking id still present:',
      before.bookings.every(b => after2.bookings.some(x => x.id === b.id)));
  log('every 1.0.0 person id still present:',
      before.people.every(p => after2.people.some(x => x.id === p.id)));
  log('every 1.0.0 listing id still present:', before.people.every(p =>
      [...p.offers, ...p.asks].every(l => after2.people.some(x => x.id === p.id &&
        [...x.offers, ...x.asks].some(y => y.id === l.id)))));

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
};
