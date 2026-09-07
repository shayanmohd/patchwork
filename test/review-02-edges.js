/* Reviewer pass 2: every input edge, rapid taps, the floor, import, and a corrupt book. */
module.exports = async ({ page, shot, wait, text, click, type, errors, log }) => {
  const js = (f, ...a) => page.evaluate(f, ...a);
  const setv = async (sel, v) => page.evaluate((s, val) => {
    const el = document.querySelector(s); el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, sel, v);

  // --- seed a small book straight through the store
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(250);
  await js(() => {
    Store.settings({ node: 'Lower Road' });
    const a = Store.addPerson('Amaia', ''); Store.settings({ me: a.id });
    Store.addPerson('Walter', ''); Store.addPerson('Ines', '');
    Store.onboarded(true);
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(400);
  const ids = await js(() => Store.people().map(p => p.id));

  // --- 1. rapid double tap on Add person
  await click('[data-view="people"]'); await wait(250);
  await click('#addPerson'); await wait(250);
  await type('#pName', 'Bo');
  await js(() => { const b = document.querySelector('#pSave'); b.click(); b.click(); b.click(); });
  await wait(500);
  log('rapid add person -> count of Bo:', await js(() => Store.people().filter(p => p.name === 'Bo').length));

  // --- 2. duplicate name warning, then let through
  await click('#addPerson'); await wait(250);
  await type('#pName', 'Bo');
  await click('#pSave'); await wait(250);
  log('dup warn:', await js(() => document.querySelector('#pNameErr').textContent));
  await shot('40-dup-name');
  await click('#pSave'); await wait(350);
  log('after second tap, Bo count:', await js(() => Store.people().filter(p => p.name === 'Bo').length));

  // --- 3. empty name
  await click('#addPerson'); await wait(250);
  await click('#pSave'); await wait(200);
  log('empty name err:', await js(() => document.querySelector('#pNameErr').textContent));
  await js(() => document.querySelector('#pCancel').click()); await wait(200);

  // --- 4. very long strings
  await click('#addPerson'); await wait(250);
  await type('#pName', 'Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  await click('#pSave'); await wait(350);
  const longId = await js(() => Store.people()[Store.people().length - 1].id);
  await js((id) => { App.show('people'); document.querySelector(`.person[data-person="${id}"]`).click(); }, longId);
  await wait(250);
  await click('#addOffer'); await wait(250);
  await type('#lText', 'Supercalifragilisticexpialidociousssssssssssssssssssssssssssssssssssssssssssss');
  await click('#lSave'); await wait(350);
  await js(() => document.querySelector('#closeP').click()); await wait(200);
  await click('[data-view="board"]'); await wait(350);
  await shot('41-long-words');
  log('board overflow?', await js(() => {
    const s = document.querySelector('.scroller');
    return document.documentElement.scrollWidth + '/' + document.documentElement.clientWidth
      + ' scroller ' + s.scrollWidth + '/' + s.clientWidth;
  }));

  // --- 5. hours edges in the booking sheet
  await click('[data-view="bookings"]'); await wait(250);
  await click('#newBookingTop'); await wait(300);
  const hoursCase = async (v) => {
    await setv('#bHours', v); await wait(120);
    return await js(() => ({ v: document.querySelector('#bHours').value,
      err: document.querySelector('#bHoursErr').hidden ? '' : document.querySelector('#bHoursErr').textContent,
      floor: document.querySelector('#bFloorErr').hidden ? '' : document.querySelector('#bFloorErr').textContent,
      disabled: document.querySelector('#bSave').disabled }));
  };
  for (const v of ['', '0', '-4', '999', '0.1', '2.5', 'abc', '12', '12.25']) {
    log('hours "' + v + '":', JSON.stringify(await hoursCase(v)));
  }
  await setv('#bHours', '2');
  await shot('42-booking-sheet');

  // receiver selection must survive an hours change
  await setv('#bReceiver', ids[2]); await wait(100);
  await setv('#bHours', '3'); await wait(150);
  log('receiver kept after hours change:', await js(() => document.querySelector('#bReceiver').value) === ids[2]);
  await setv('#bOn', '2020-01-05'); await wait(150);
  log('past date note:', await text('#bWhen'));
  // empty "what"
  await click('#bSave'); await wait(250);
  log('empty what err:', await js(() => document.querySelector('#bWhatErr').textContent));
  await type('#bWhat', 'A very old booking');
  await js(() => { const b = document.querySelector('#bSave'); b.click(); b.click(); });
  await wait(500);
  log('rapid arrange -> bookings:', await js(() => Store.openBookings().length));
  await shot('43-old-booking');
  log('old booking card:', (await text('#bookingList')).replace(/\n+/g, ' / ').slice(0, 300));

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
};
