/* Measure what is actually painted rather than trusting the palette on paper: every text node
   on every screen and sheet, against the colour really behind it, in both themes. */
const { RICH } = require('./rich.js');

const AUDIT = () => {
  window.__audit = () => {
    const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const parse = s => (s.match(/[\d.]+/g) || []).slice(0, 4).map(Number);
    const over = (fg, bg) => { const a = fg[3] === undefined ? 1 : fg[3];
      return [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a)); };
    function bgOf(el) {
      let n = el;
      while (n && n !== document.documentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c.length >= 3 && (c[3] === undefined || c[3] > 0.6)) return c.slice(0, 3);
        n = n.parentElement;
      }
      return parse(getComputedStyle(document.body).backgroundColor).slice(0, 3);
    }
    const out = [];
    document.querySelectorAll('.screen:not([hidden]) *, #tabs:not([hidden]) *, #sheet:not([hidden]) *')
      .forEach(el => {
        const t = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim())
          .map(n => n.textContent.trim()).join(' ');
        if (!t) return;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.9) return;
        if (!el.getClientRects().length) return;
        const bg = bgOf(el);
        const fg = over(parse(cs.color), bg);
        const L1 = lum(fg), L2 = lum(bg);
        const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        const px = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
        const need = (px >= 24 || (px >= 18.66 && bold)) ? 3 : 4.5;
        if (ratio < need) out.push({ t: t.slice(0, 44), ratio: +ratio.toFixed(2), need, px,
          cls: String(el.className).slice(0, 30) });
      });
    return out;
  };
};

module.exports = async ({ page, wait, log, errors }) => {
  await page.evaluateOnNewDocument(AUDIT);
  const run = async (scheme) => {
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    const bad = [];
    const take = async (where) => {
      (await page.evaluate(() => window.__audit())).forEach(x => bad.push({ where, ...x }));
    };
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.evaluate(RICH);
    await page.reload({ waitUntil: 'networkidle0' }); await wait(400);

    for (const v of ['board', 'bookings', 'ledger', 'people']) {
      await page.evaluate(x => App.show(x), v); await wait(300); await take(v);
    }
    await page.evaluate(() => App.show('board')); await wait(200);
    await page.evaluate(() => document.querySelector('.seg[data-board="asks"]').click()); await wait(250);
    await take('board asks');

    await page.evaluate(() => App.show('people')); await wait(200);
    await page.evaluate(() => document.querySelector('#addPerson').click()); await wait(300);
    await page.evaluate(() => document.querySelector('#pSave').click()); await wait(300);
    await take('add person sheet, with its error');
    await page.evaluate(() => App.back()); await wait(200);

    await page.evaluate(() => App.show('bookings')); await wait(200);
    await page.evaluate(() => document.querySelector('#newBookingTop').click()); await wait(300);
    await page.evaluate(() => { const h = document.querySelector('#bHours'); h.value = '99'; h.dispatchEvent(new Event('input')); });
    await wait(250); await take('arrange sheet, with its error');
    await page.evaluate(() => App.back()); await wait(200);

    await page.evaluate(() => App.show('board')); await wait(200);
    await page.evaluate(() => document.querySelector('#boardList .entry').click()); await wait(320);
    await take('person sheet');
    await page.evaluate(() => App.back()); await wait(200);

    // the empty screens, which are mostly faint text over a drawing
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' }); await wait(300);
    for (let i = 0; i < 4; i++) { await page.evaluate(() => document.querySelector('#obNext').click()); await wait(220); }
    await take('onboarding, last card with its error');
    await page.evaluate(() => { document.querySelector('#obName').value = 'Amaia';
      document.querySelector('#obNext').click(); }); await wait(400);
    for (const v of ['board', 'bookings', 'ledger', 'people']) {
      await page.evaluate(x => App.show(x), v); await wait(300); await take('empty ' + v);
    }

    log(scheme + ': ' + (bad.length ? bad.length + ' BELOW AA' : 'every text node passes AA'));
    bad.slice(0, 14).forEach(b => log('   ' + JSON.stringify(b)));
    return bad.length;
  };
  const n = (await run('light')) + (await run('dark'));
  log('total below AA: ' + n);
  log('page errors: ' + errors.length);
  if (errors.length) throw new Error('page errored');
};
