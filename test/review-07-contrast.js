/* Reviewer pass 6: measure every rendered text/background pair against WCAG AA. */
module.exports = async ({ page, shot, wait, text, click, type, errors, log }) => {
  const js = (f, ...a) => page.evaluate(f, ...a);
  if (process.env.SCHEME) await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: process.env.SCHEME }]);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(250);
  await js(() => {
    Store.settings({ node: 'Lower Road' });
    const a = Store.addPerson('Amaia', 'Keeps the book'); Store.settings({ me: a.id });
    const w = Store.addPerson('Walter', 'Flat 3, mornings are best');
    const i = Store.addPerson('Ines', '');
    Store.addListing(a.id, 'offer', 'repair', 'Rewire a lamp or fit a shelf');
    Store.addListing(w.id, 'offer', 'teach', 'Two hours of Spanish conversation');
    Store.addListing(i.id, 'ask', 'admin', 'Explain how the pension form works');
    const b1 = Store.addBooking(w.id, a.id, 'Rewire the hallway lamp', 2,
      new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
    const b2 = Store.addBooking(i.id, w.id, 'Spanish before the trip', 1.5,
      new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10));
    Store.confirm(b2.id, 'giver'); Store.confirm(b2.id, 'receiver');
    const b3 = Store.addBooking(a.id, i.id, 'Overdue one', 1, '2020-01-05');
    const b4 = Store.addBooking(a.id, w.id, 'Half confirmed', 1, null);
    Store.confirm(b4.id, 'giver');
    // push someone negative so the .neg / .over colours render
    Store.post(w.id, i.id, 4, 'A long favour', 'direct');
    Store.onboarded(true);
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(400);

  const measure = async (label) => {
    const rows = await js(() => {
      const lum = (c) => { const s = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
        return .2126 * s[0] + .7152 * s[1] + .0722 * s[2]; };
      const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null;
        const p = m[1].split(',').map(x => parseFloat(x)); return { c: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 }; };
      const over = (fg, bg) => fg.c.map((v, i) => v * fg.a + bg[i] * (1 - fg.a));
      const bgOf = (el) => {
        let n = el, acc = null;
        while (n && n !== document.documentElement) {
          const cs = getComputedStyle(n); const p = parse(cs.backgroundColor);
          if (p && p.a > 0) { acc = acc === null ? (p.a === 1 ? p.c : null) : acc;
            if (p.a === 1) return p.c; }
          n = n.parentElement;
        }
        const p = parse(getComputedStyle(document.body).backgroundColor);
        return p ? p.c : [255, 255, 255];
      };
      const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b);
        return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); };
      const out = [];
      const seen = new Set();
      document.querySelectorAll('*').forEach(el => {
        if (!el.offsetParent) return;
        const t = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (!t) return;
        const cs = getComputedStyle(el);
        const fg = parse(cs.color); if (!fg) return;
        const bg = bgOf(el);
        const eff = over(fg, bg);
        const px = parseFloat(cs.fontSize);
        const bold = parseInt(cs.fontWeight, 10) >= 700 || cs.fontWeight === 'bold';
        const large = px >= 24 || (px >= 18.66 && bold);
        const need = large ? 3 : 4.5;
        const r = ratio(eff, bg);
        const key = el.className + '|' + cs.color + '|' + Math.round(px);
        if (seen.has(key)) return; seen.add(key);
        out.push({ sel: el.tagName.toLowerCase() + '.' + (el.className || ''), t: t.slice(0, 24),
                   px: Math.round(px * 10) / 10, r: Math.round(r * 100) / 100, need, pass: r >= need });
      });
      return out;
    });
    const fails = rows.filter(r => !r.pass);
    log(label + ': ' + rows.length + ' text nodes, ' + fails.length + ' below AA');
    fails.forEach(f => log('   FAIL ' + f.r + ' (need ' + f.need + ') ' + f.sel + ' "' + f.t + '" ' + f.px + 'px'));
    const low = rows.slice().sort((a, b) => a.r - b.r).slice(0, 5);
    low.forEach(f => log('   lowest ' + f.r + ' (need ' + f.need + ') ' + f.sel + ' "' + f.t + '" ' + f.px + 'px'));
  };

  for (const v of ['board', 'bookings', 'ledger', 'people']) {
    await js((x) => App.show(x), v); await wait(350);
    await measure(v);
    await shot('80-' + v);
  }
  // sheets
  await js(() => { App.show('people'); document.querySelector('#addPerson').click(); });
  await wait(300); await measure('add-person sheet'); await shot('81-sheet-person');
  await js(() => document.querySelector('#pCancel').click()); await wait(150);
  await js(() => { App.show('bookings'); document.querySelector('#newBookingTop').click(); });
  await wait(300); await measure('booking sheet'); await shot('82-sheet-booking');
  // disabled + error state
  await js(() => { const h = document.querySelector('#bHours'); h.value = '99';
    h.dispatchEvent(new Event('input', { bubbles: true })); });
  await wait(200); await measure('booking sheet, error'); await shot('83-sheet-error');
  // toast
  await js(() => { document.querySelector('#bCancel').click(); App.toast('Both agreed. It is in the book.'); });
  await wait(250); await measure('toast'); await shot('84-toast');

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
};
