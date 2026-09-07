/* Reviewer pass 10: the real file picker, and a merged book that puts somebody past the floor. */
const fs = require('fs');
const path = '/tmp/patchwork-merge.json';
module.exports = async ({ page, shot, wait, text, click, errors, log }) => {
  const js = (f, ...a) => page.evaluate(f, ...a);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' }); await wait(250);
  await js(() => {
    Store.settings({ node: 'Lower Road' });
    const a = Store.addPerson('Amaia', ''); Store.settings({ me: a.id });
    Store.addPerson('Walter', '');
    Store.onboarded(true);
  });
  await page.reload({ waitUntil: 'networkidle0' }); await wait(400);
  const ids = await js(() => Store.people().map(p => p.id));

  // another keeper's book: the same two people, and lines that carry Walter well past the floor
  const other = {
    app: 'patchwork', version: 1, node: 'Upper Road',
    people: [{ id: ids[0], name: 'Amaia', note: '', offers: [], asks: [] },
             { id: ids[1], name: 'Walter', note: '', offers: [], asks: [] },
             { id: 'pnew1', name: 'Ines', note: 'from the other book', offers: [], asks: [] }],
    bookings: [],
    entries: [
      { id: 'em1', at: Date.now() - 400000, giverId: ids[0], receiverId: ids[1], hours: 5, what: 'Long day', source: 'direct' },
      { id: 'em2', at: Date.now() - 300000, giverId: 'pnew1', receiverId: ids[1], hours: 4, what: 'Another', source: 'direct' },
      { id: 'em3', at: Date.now() - 200000, giverId: ids[1], receiverId: 'pnew1', hours: 1, what: 'Back a bit', source: 'direct' },
      { id: 'bad', at: Date.now(), giverId: ids[0], receiverId: ids[1], hours: 'lots', what: 'unreadable', source: 'direct' }
    ]
  };
  fs.writeFileSync(path, JSON.stringify(other, null, 2));

  await js(() => App.show('people')); await wait(300);
  const input = await page.$('#importFile');
  await input.uploadFile(path);
  await wait(700);
  log('ioNote:', await text('#ioNote'));
  log('balances:', await js(() => Store.balances().map(b => b.name + '=' + b.hours).join(' ')));
  await shot('A0-after-merge');
  // merge the same file again: nothing should change
  const input2 = await page.$('#importFile');
  await input2.uploadFile(path);
  await wait(700);
  log('second merge note:', await text('#ioNote'));
  log('balances after repeat:', await js(() => Store.balances().map(b => b.name + '=' + b.hours).join(' ')));

  // now open the booking sheet with the person who is past the floor as receiver
  await js(() => App.show('bookings')); await wait(250);
  await js(() => document.querySelector('#newBookingTop').click()); await wait(400);
  await page.evaluate((rid) => { const r = document.querySelector('#bReceiver');
    r.value = rid; r.dispatchEvent(new Event('change', { bubbles: true })); }, ids[1]);
  await wait(300);
  log('receiver:', await js(() => document.querySelector('#bReceiver').selectedOptions[0].textContent));
  log('room note:', await text('#bRoom'));
  log('floor note:', await text('#bFloorErr'));
  log('save disabled:', await js(() => document.querySelector('#bSave').disabled));
  log('headroom raw:', await js((i) => Store.headroom(i[1]), ids));
  await shot('A1-past-floor-sheet');

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
};
