/* Animations off. Motion should stop; nothing may disappear. */
const { RICH } = require('./rich.js');
module.exports = async ({ page, shot, wait, click, errors, log }) => {
  const ok = (l, p, d) => log((p ? 'PASS  ' : 'FAIL  ') + l + (d ? '  ' + d : ''));
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: 'light' },
    { name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' }); await wait(300);
  await shot('RM-onboard');
  ok('the mark is still drawn on onboarding',
     await page.evaluate(() => document.querySelectorAll('#obMark svg .patch').length) === 4);

  await page.evaluate(RICH);
  await page.reload({ waitUntil: 'networkidle0' }); await wait(400);
  for (const v of ['board', 'bookings', 'ledger', 'people']) {
    await page.evaluate(x => App.show(x), v); await wait(300); await shot('RM-' + v);
  }
  // the quilt must still have all fifteen patches, at full opacity and full size
  await page.evaluate(() => App.show('ledger')); await wait(350);   // measure it while it is on screen
  // measure the drawn rect inside each patch: an SVG <g> reports no box of its own here
  const q = await page.evaluate(() => {
    const svg = document.querySelector('#quiltBig svg');
    const ps = [...svg.querySelectorAll('.patch')];
    const boxes = ps.map(p => { const b = p.querySelector('rect').getBoundingClientRect();
      return { w: Math.round(b.width), h: Math.round(b.height), op: getComputedStyle(p).opacity }; });
    return { count: ps.length, boxes };
  });
  ok('every patch is present', q.count === 15, 'count=' + q.count);
  ok('no patch is collapsed or invisible',
     q.boxes.every(b => b.w > 8 && b.h > 8 && Number(b.op) === 1),
     JSON.stringify(q.boxes.slice(0, 3)) + ' ... last=' + JSON.stringify(q.boxes[q.boxes.length - 1]));
  ok('the newest patch is still turned',
     q.boxes[14].w > q.boxes[0].w * 1.1, JSON.stringify([q.boxes[0], q.boxes[14]]));
  const mini = await page.evaluate(() => document.querySelectorAll('#quiltMini .patch').length);
  ok('the header quilt still has its patches', mini === 15, 'mini=' + mini);
  // list items are visible, not stuck at the start of a settle animation
  await page.evaluate(() => App.show('board')); await wait(300);
  const rows = await page.evaluate(() => [...document.querySelectorAll('#boardList .entry')]
    .map(e => ({ op: getComputedStyle(e).opacity, y: Math.round(e.getBoundingClientRect().top) })));
  ok('every board row is fully visible', rows.length === 10 && rows.every(r => Number(r.op) === 1),
     rows.length + ' rows, opacities ' + [...new Set(rows.map(r => r.op))].join('/'));
  await click('#boardList .entry'); await wait(300);
  await shot('RM-sheet');
  ok('the sheet still opens', await page.evaluate(() =>
    document.querySelector('#sheet').hidden === false
    && Number(getComputedStyle(document.querySelector('#sheet-panel, .sheet-panel')).opacity) === 1));
  log('page errors: ' + errors.length);
  if (errors.length) throw new Error('page errored');
};
