/* Reviewer pass 4: window.App.back() on every screen, onPause/onResume, the Native bridge,
   safe areas, and the repair toast on a second launch. */
module.exports = async ({ page, shot, wait, text, click, type, errors, log }) => {
  const js = (f, ...a) => page.evaluate(f, ...a);

  await page.evaluateOnNewDocument(() => {
    window.__saved = [];
    window.__shared = [];
    window.Native = {
      isNative: () => true,
      vibrate: () => {},
      saveFile: (n, m, b) => { window.__saved.push({ n, m, len: b.length }); return 'content://demo/' + n; },
      shareUri: (u, m) => { window.__shared.push({ u, m }); }
    };
  });
  await page.goto(page.url(), { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(300);

  // --- back() through onboarding
  log('onboard, step 0 back:', await js(() => App.back()));
  await click('#obNext'); await wait(200);
  log('step 1 back returns:', await js(() => App.back()), '-> step now',
      await js(() => document.querySelectorAll('#obTrack .ob-card.is-on').length));
  await click('#obNext'); await click('#obNext'); await click('#obNext'); await wait(250);
  log('at last card, back:', await js(() => App.back()));
  log('back again:', await js(() => App.back()));
  log('back again:', await js(() => App.back()));
  log('back at root of onboarding:', await js(() => App.back()));

  // finish onboarding
  await click('#obNext'); await click('#obNext'); await click('#obNext'); await wait(200);
  await type('#obName', 'Amaia'); await type('#obNode', 'Lower Road');
  await click('#obNext'); await wait(400);

  // --- back() on every nested screen
  for (const v of ['bookings', 'ledger', 'people']) {
    await click(`[data-view="${v}"]`); await wait(250);
    log(v + ' back ->', await js(() => App.back()), 'now on',
        await js(() => document.querySelector('#v-board').hidden ? 'other' : 'board'));
  }
  log('root board back ->', await js(() => App.back()));

  // --- back() with a sheet open, including a nested sheet
  await click('[data-view="people"]'); await wait(250);
  await click('#addPerson'); await wait(250);
  log('person sheet back ->', await js(() => App.back()), 'sheet hidden now:',
      await js(() => document.querySelector('#sheet').hidden));
  await click('#addPerson'); await wait(250);
  await type('#pName', 'Walter'); await click('#pSave'); await wait(350);
  const ids = await js(() => Store.people().map(p => p.id));
  await js((id) => document.querySelector(`.person[data-person="${id}"]`).click(), ids[0]);
  await wait(250);
  await click('#addOffer'); await wait(250);
  log('listing sheet open, back ->', await js(() => App.back()),
      '| back should land on the person sheet:', await js(() => document.querySelector('#sheetPanel h2').textContent));
  log('person sheet, back ->', await js(() => App.back()), 'sheet hidden:',
      await js(() => document.querySelector('#sheet').hidden));
  await click('[data-view="board"]'); await wait(200);

  // --- booking sheet back
  await click('[data-view="bookings"]'); await wait(200);
  await click('#newBookingTop'); await wait(280);
  log('booking sheet back ->', await js(() => App.back()), 'hidden:', await js(() => document.querySelector('#sheet').hidden));
  log('still on bookings, back ->', await js(() => App.back()));

  // --- onPause / onResume do not throw, and disarm
  await click('[data-view="people"]'); await wait(250);
  await js((id) => document.querySelector(`.person[data-person="${id}"]`).click(), ids[0]);
  await wait(250);
  await js(() => document.querySelector('#delP').click());  // arm the destructive button
  await wait(150);
  log('armed label:', await js(() => document.querySelector('#delP').textContent));
  log('onPause threw:', await js(() => { try { App.onPause(); return false; } catch (e) { return e.message; } }));
  log('after pause, still armed:', await js(() => !!document.querySelector('#delP').dataset.armed),
      '| label:', await js(() => document.querySelector('#delP').textContent));
  log('onResume threw:', await js(() => { try { App.onResume(); return false; } catch (e) { return e.message; } }));
  await shot('60-after-resume');
  await js(() => { const c = document.querySelector('#closeP'); if (c) c.click(); });
  await wait(200);
  // erase button armed then paused
  await js(() => document.querySelector('#eraseBtn').click()); await wait(150);
  log('erase armed label:', await js(() => document.querySelector('#eraseBtn').textContent));
  await js(() => App.onPause());
  log('after pause, erase label:', await js(() => document.querySelector('#eraseBtn').textContent),
      '| armed:', await js(() => !!document.querySelector('#eraseBtn').dataset.armed));
  // pause with no toast, twice
  await js(() => { App.onPause(); App.onPause(); App.onResume(); App.onResume(); });
  log('double pause/resume survived');

  // --- Native export
  await js(() => document.querySelector('#exportJson').click()); await wait(300);
  await js(() => document.querySelector('#exportCsv').click()); await wait(300);
  log('Native.saveFile calls:', await js(() => JSON.stringify(window.__saved)));
  log('Native.shareUri calls:', await js(() => JSON.stringify(window.__shared)));
  log('toast:', await text('#toast'));

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
};
