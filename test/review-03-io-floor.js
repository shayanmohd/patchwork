/* Reviewer pass 3: the floor when the line is written, import validation, a corrupt book,
   export through a mocked Native and through the browser path. */
const fs = require('fs');
module.exports = async ({ page, shot, wait, text, click, type, errors, log }) => {
  const js = (f, ...a) => page.evaluate(f, ...a);

  // ---------- the floor, checked at confirm time ----------
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(250);
  await js(() => {
    Store.settings({ node: 'Lower Road' });
    const a = Store.addPerson('Amaia', ''); Store.settings({ me: a.id });
    Store.addPerson('Walter', '');
    Store.onboarded(true);
  });
  await page.reload({ waitUntil: 'networkidle0' }); await wait(400);
  const ids = await js(() => Store.people().map(p => p.id));
  // three bookings that each fit on their own: Walter is at +2, floor -3, headroom 5
  await js((i) => {
    Store.addBooking(i[0], i[1], 'One', 4, null);
    Store.addBooking(i[0], i[1], 'Two', 4, null);
    Store.addBooking(i[0], i[1], 'Three', 4, null);
  }, ids);
  await click('[data-view="bookings"]'); await wait(350);
  const bids = await js(() => Store.openBookings().map(b => b.id));
  for (const b of bids) {
    await js((id) => { const c = document.querySelector(`.card[data-b="${id}"]`);
      c.querySelector('[data-ok="giver"]').click(); }, b);
    await wait(250);
    await js((id) => { const c = document.querySelector(`.card[data-b="${id}"]`);
      const r = c && c.querySelector('[data-ok="receiver"]'); if (r) r.click(); }, b);
    await wait(350);
    log('after confirming', b, 'Walter =', await js((i) => Store.balance(i[1]), ids),
        'entries =', await js(() => Store.entries().length));
  }
  log('toast:', await text('#toast'));
  await shot('50-floor-blocked');
  log('floor held (>= -3):', await js((i) => Store.balance(i[1]) >= -3, ids));

  // ---------- import: adversarial payloads ----------
  const cases = {
    'not json': 'hello',
    'json array': '[]',
    'wrong app': JSON.stringify({ app: 'other', people: [] }),
    'people is a string': JSON.stringify({ app: 'patchwork', people: 'Walter', entries: [], bookings: [] }),
    'entry hours "lots"': JSON.stringify({ app: 'patchwork', people: [], bookings: [],
      entries: [{ id: 'x1', at: 1, giverId: 'a', receiverId: 'b', hours: 'lots', what: 'hm' }] }),
    'entry no id': JSON.stringify({ app: 'patchwork', people: [], bookings: [],
      entries: [{ at: 1, giverId: 'a', receiverId: 'b', hours: 1 }] }),
    'giver == receiver': JSON.stringify({ app: 'patchwork', people: [], bookings: [],
      entries: [{ id: 'x2', at: 1, giverId: 'a', receiverId: 'a', hours: 1 }] }),
    'hours Infinity': JSON.stringify({ app: 'patchwork', people: [], bookings: [],
      entries: [{ id: 'x3', at: 1, giverId: 'a', receiverId: 'b', hours: 1e999 }] }),
    'person id is an object': JSON.stringify({ app: 'patchwork', bookings: [], entries: [],
      people: [{ id: { a: 1 }, name: 'Nope' }] }),
    'prototype pollution': JSON.stringify({ app: 'patchwork', bookings: [], entries: [],
      people: [{ id: 'pp', name: 'Poll', __proto__: { polluted: 1 } }] }),
    'nested giant': JSON.stringify({ app: 'patchwork', bookings: [], entries: [],
      people: [{ id: 'pg', name: 'X'.repeat(5000), note: 'Y'.repeat(5000), offers: [{ id: 'l1', cat: 'nope', text: 'Z'.repeat(5000) }] }] })
  };
  for (const [k, v] of Object.entries(cases)) {
    const r = await js((raw) => JSON.stringify(Store.importJson(raw)), v);
    log('import ' + k + ' ->', r, '| entries now', await js(() => Store.entries().length),
        '| people now', await js(() => Store.people().length));
  }
  log('balance still a number:', await js((i) => Number.isFinite(Store.balance(i[1])), ids));
  log('name length capped:', await js(() => (Store.person('pg') || {}).name?.length));
  await js(() => App.show('board'));
  await wait(300); await shot('51-after-imports');

  // ---------- a book already carrying a bad line: repair on load ----------
  await js(() => {
    const d = JSON.parse(localStorage.getItem('patchwork.v1'));
    d.entries.push({ id: 'bad1', at: Date.now(), giverId: d.people[0].id,
                     receiverId: d.people[1].id, hours: 'lots', what: 'unreadable', source: 'direct' });
    localStorage.setItem('patchwork.v1', JSON.stringify(d));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(600);
  log('repaired on load:', await js(() => Store.repairedOnLoad()));
  log('balances finite:', await js(() => Store.balances().every(b => Number.isFinite(b.hours))));
  log('toast after repair:', await text('#toast'));
  await shot('52-repaired');

  // ---------- export: browser path and mocked Native ----------
  const j = await js(() => Store.exportJson());
  fs.writeFileSync('/tmp/patchwork-review-export.json', j);
  log('export round trip:', await js((raw) => {
    const before = Store.entries().length;
    const r = Store.importJson(raw);
    return JSON.stringify(r) + ' entries before ' + before + ' after ' + Store.entries().length;
  }, j));

  await page.evaluate(() => {
    window.__saved = null;
    window.Native = { saveFile: (n, m, b) => { window.__saved = { n, m, len: b.length }; return 'content://x/' + n; },
                      shareUri: () => {}, vibrate: () => {} };
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    window.__saved = null;
    window.Native = { saveFile: (n, m, b) => { window.__saved = { n, m, len: b.length }; return 'content://x/' + n; },
                      shareUri: () => {}, vibrate: () => {} };
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(400);
  log('note: Native must be present before app.js runs to be picked up');

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
};
