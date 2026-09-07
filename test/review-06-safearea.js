/* Reviewer pass 5: --sat 48 / --sab 34 on every screen, plus a measurement that nothing
   interactive or textual sits under either bar. */
module.exports = async ({ page, shot, wait, text, click, type, errors, log }) => {
  const js = (f, ...a) => page.evaluate(f, ...a);
  // The Android shell injects these two on the root element. Inject them the same way, at
  // document-start, guarding for the moment before <html> has a style object.
  await page.evaluateOnNewDocument(() => {
    const set = () => {
      const r = document.documentElement;
      if (!r || !r.style) return false;
      r.style.setProperty('--sat', '48px');
      r.style.setProperty('--sab', '34px');
      return true;
    };
    if (!set()) document.addEventListener('readystatechange', set);
  });
  await page.goto(page.url(), { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(350);
  log('sat/sab in effect:', await js(() => getComputedStyle(document.documentElement).getPropertyValue('--sat')
      + ' / ' + getComputedStyle(document.documentElement).getPropertyValue('--sab')));

  const audit = async (name) => {
    const bad = await js(() => {
      const SAT = 48, SAB = 34, H = window.innerHeight;
      const out = [];
      const sel = 'h1,h2,h3,p,button,input,select,label,a,span.bal,.pill,.confirmed,.tab,.seg,.entry,.person,.card,.line';
      document.querySelectorAll(sel).forEach(el => {
        if (!el.offsetParent && el.tagName !== 'BODY') return;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        const t = (el.textContent || '').trim().slice(0, 26);
        if (r.top < SAT && r.bottom > 0) out.push('TOP ' + el.className + ' "' + t + '" top=' + Math.round(r.top));
        if (r.bottom > H - SAB && r.top < H) out.push('BOTTOM ' + el.className + ' "' + t + '" bottom=' + Math.round(r.bottom));
      });
      return out;
    });
    log(name + ':', bad.length ? bad.slice(0, 6).join(' || ') : 'clear of both bars');
    await shot(name);
  };

  await audit('70-onboard-safe');
  await click('#obNext'); await click('#obNext'); await click('#obNext'); await wait(250);
  await audit('71-onboard-last-safe');
  await type('#obName', 'Amaia'); await type('#obNode', 'Lower Road');
  await click('#obNext'); await wait(400);
  await js(() => {
    const a = Store.people()[0];
    const w = Store.addPerson('Walter', 'Flat 3'); const i = Store.addPerson('Ines', '');
    Store.addListing(a.id, 'offer', 'repair', 'Rewire a lamp or fit a shelf');
    Store.addListing(w.id, 'offer', 'teach', 'Two hours of Spanish conversation');
    Store.addListing(i.id, 'ask', 'admin', 'Explain how the pension form works');
    const b = Store.addBooking(w.id, a.id, 'Rewire the hallway lamp', 2, new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
    const b2 = Store.addBooking(i.id, w.id, 'Spanish before the trip', 1.5, null);
    Store.confirm(b2.id, 'giver'); Store.confirm(b2.id, 'receiver');
    App.show('board');
  });
  await wait(400);
  await audit('72-board-safe');
  await click('[data-view="bookings"]'); await wait(350); await audit('73-bookings-safe');
  await click('[data-view="ledger"]'); await wait(400); await audit('74-ledger-safe');
  await click('[data-view="people"]'); await wait(350); await audit('75-people-safe');
  await click('#addPerson'); await wait(300); await audit('76-sheet-safe');
  await js(() => document.querySelector('#pCancel').click()); await wait(200);
  await click('[data-view="bookings"]'); await wait(200);
  await click('#newBookingTop'); await wait(300);
  await js(() => document.querySelector('#sheetPanel').scrollTop = 9999); await wait(200);
  await audit('77-booking-sheet-safe');
  // toast position
  await js(() => App.toast('A toast that must clear the navigation bar'));
  await wait(250);
  log('toast rect:', await js(() => { const r = document.querySelector('#toast').getBoundingClientRect();
    return 'bottom=' + Math.round(r.bottom) + ' innerH=' + window.innerHeight; }));
  await shot('78-toast-safe');

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
};
