/* Patchwork. Four screens, one sheet component, and the rule that a ledger line is only
   written when both people say the hour happened. */
const App = (() => {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const N = window.Native || null;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let view = 'board';
  let boardKind = 'offers';

  const hours = n => (n === 1 ? '1 hour' : (Math.round(n * 4) / 4) + ' hours');
  const dateLabel = s => {
    if (!s) return 'no date yet';
    const d = new Date(s + 'T12:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  };

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2600);
  }
  function tap(ms = 10, amp = 80) { try { N ? N.vibrate(ms, amp) : navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }

  function download(name, mime, text) {
    if (N && N.saveFile) {
      const uri = N.saveFile(name, mime, btoa(unescape(encodeURIComponent(text))));
      toast(uri ? 'Saved to Downloads' : 'Could not save the file');
      if (uri && N.shareUri) N.shareUri(uri, mime);
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: mime }));
    a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Exported');
  }

  /* ---------- sheet ---------- */
  function openSheet(title, sub, bodyHtml, wire) {
    $('#sheetPanel').innerHTML = `<h2>${esc(title)}</h2>${sub ? `<p class="sheet-sub">${esc(sub)}</p>` : ''}${bodyHtml}`;
    $('#sheet').hidden = false;
    if (wire) wire($('#sheetPanel'));
  }
  const closeSheet = () => { $('#sheet').hidden = true; };

  const peopleOptions = (selected, exclude) => Store.people()
    .filter(p => p.id !== exclude)
    .map(p => `<option value="${p.id}"${p.id === selected ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
  const catOptions = sel => Store.CATEGORIES
    .map(c => `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${esc(c.name)}</option>`).join('');

  /* ---------- board ---------- */
  function renderBoard() {
    const db = Store.settings();
    $('#nodeName').textContent = db.node || 'The node';
    const n = Store.people().length;
    $('#boardSub').textContent = n === 0 ? 'Nobody in the book yet.'
      : `${n} ${n === 1 ? 'person' : 'people'}, ${Store.entries().length} exchanges written down.`;
    $$('.seg').forEach(s => s.classList.toggle('is-on', s.dataset.board === boardKind));

    const rows = Store.board(boardKind, $('#boardSearch').value);
    $('#boardEmpty').hidden = rows.length > 0;
    $('#boardEmpty').textContent = Store.people().length === 0
      ? 'Add the people who already meet, then write down what each of them could do for an hour.'
      : (boardKind === 'offers'
          ? 'No offers yet. Open a person and add what they could do for an hour.'
          : 'No asks yet. An ask is the fastest way for someone to spend an hour they have earned.');
    $('#boardList').innerHTML = rows.map(r => `
      <button class="entry" data-person="${r.person.id}">
        <span class="swatch" style="background: var(--c-${r.listing.cat})"></span>
        <span class="body">
          <p class="what">${esc(r.listing.text)}</p>
          <p class="who">${esc(r.person.name)}</p>
        </span>
        <span class="bal">${r.hours >= 0 ? '+' : ''}${r.hours}</span>
      </button>`).join('');
    $$('#boardList .entry').forEach(b => { b.onclick = () => openPerson(b.dataset.person); });
  }

  /* ---------- people ---------- */
  function renderPeople() {
    const list = Store.people();
    $('#peopleSub').textContent = list.length ? `${list.length} in the book` : 'Nobody yet';
    $('#peopleList').innerHTML = list.map(p => {
      const b = Store.balance(p.id);
      const off = p.offers.map(o => o.text).join(', ');
      return `<div class="person" data-person="${p.id}">
        <span class="swatch" style="background: var(--c-${(p.offers[0] || {}).cat || 'other'}); height: 34px"></span>
        <span class="body">
          <p class="nm">${esc(p.name)}</p>
          <p class="off">${esc(off || 'nothing offered yet')}</p>
        </span>
        <span class="bal">${b >= 0 ? '+' : ''}${b}</span>
      </div>`;
    }).join('') || '<p class="empty">Add the people who already meet. A time bank is a book kept for a group, not a way to meet strangers.</p>';
    $$('#peopleList .person').forEach(el => { el.onclick = () => openPerson(el.dataset.person); });
  }

  function openPerson(id) {
    const p = Store.person(id); if (!p) return;
    const bal = Store.balance(id);
    const listing = (kind) => (kind === 'ask' ? p.asks : p.offers).map(l => `
      <div class="entry" style="cursor:default">
        <span class="swatch" style="background: var(--c-${l.cat})"></span>
        <span class="body"><p class="what">${esc(l.text)}</p></span>
        <button class="btn small ghost" data-del="${kind}:${l.id}">Remove</button>
      </div>`).join('') || `<p class="help">Nothing listed.</p>`;

    openSheet(p.name, `${bal >= 0 ? '+' : ''}${bal} hours. ${bal < 0 ? 'The node has them covered.' : 'Earned and unspent.'}`, `
      ${p.note ? `<p class="help" style="margin-bottom:14px">${esc(p.note)}</p>` : ''}
      <h2 class="h2">Can do for an hour</h2>${listing('offer')}
      <div class="btnrow"><button class="btn small" id="addOffer">Add an offer</button></div>
      <h2 class="h2">Could use an hour of</h2>${listing('ask')}
      <div class="btnrow"><button class="btn small" id="addAsk">Add an ask</button></div>
      <hr class="rule">
      <div class="btnrow">
        <button class="btn small primary" id="bookWith">Arrange an hour</button>
        <button class="btn small ghost" id="closeP">Close</button>
        <button class="btn small danger" id="delP">Remove from the book</button>
      </div>
      <p class="help">Removing someone leaves every hour they gave or received in the book. The ledger is
        never rewritten.</p>`, (panel) => {
      panel.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
        const [kind, lid] = b.dataset.del.split(':');
        Store.removeListing(id, kind, lid); openPerson(id); renderBoard(); renderPeople();
      });
      panel.querySelector('#addOffer').onclick = () => listingSheet(id, 'offer');
      panel.querySelector('#addAsk').onclick = () => listingSheet(id, 'ask');
      panel.querySelector('#bookWith').onclick = () => bookingSheet(id);
      panel.querySelector('#closeP').onclick = closeSheet;
      panel.querySelector('#delP').onclick = () => {
        if (panel.querySelector('#delP').dataset.armed) { Store.removePerson(id); closeSheet(); renderAll(); toast('Removed from the roster'); }
        else { panel.querySelector('#delP').dataset.armed = '1'; panel.querySelector('#delP').textContent = 'Tap again to remove'; }
      };
    });
  }

  function listingSheet(personId, kind) {
    openSheet(kind === 'ask' ? 'Add an ask' : 'Add an offer',
      kind === 'ask' ? 'One thing an hour of someone else could solve.' : 'One thing they could do for an hour.', `
      <div class="field"><label for="lText">In a few words</label>
        <input id="lText" type="text" placeholder="${kind === 'ask' ? 'Explain how the pension form works' : 'Fix a dripping tap'}"></div>
      <div class="field"><label for="lCat">Kind of thing</label><select id="lCat">${catOptions('other')}</select></div>
      <div class="btnrow"><button class="btn primary" id="lSave">Add it</button>
        <button class="btn ghost" id="lCancel">Cancel</button></div>`, (panel) => {
      panel.querySelector('#lCancel').onclick = () => openPerson(personId);
      panel.querySelector('#lSave').onclick = () => {
        const t = panel.querySelector('#lText').value;
        if (!t.trim()) { toast('Write it in a few words first'); return; }
        Store.addListing(personId, kind, panel.querySelector('#lCat').value, t);
        tap(); openPerson(personId); renderBoard(); renderPeople();
      };
      setTimeout(() => panel.querySelector('#lText').focus(), 40);
    });
  }

  function personSheet() {
    openSheet('Add a person', 'Someone the group already knows.', `
      <div class="field"><label for="pName">Name</label><input id="pName" type="text" placeholder="Walter"></div>
      <div class="field"><label for="pNote">Anything worth remembering</label>
        <input id="pNote" type="text" placeholder="Flat 3, mornings are best"></div>
      <p class="help">They start at ${Store.START} hours, like everyone.</p>
      <div class="btnrow"><button class="btn primary" id="pSave">Add</button>
        <button class="btn ghost" id="pCancel">Cancel</button></div>`, (panel) => {
      panel.querySelector('#pCancel').onclick = closeSheet;
      panel.querySelector('#pSave').onclick = () => {
        const p = Store.addPerson(panel.querySelector('#pName').value, panel.querySelector('#pNote').value);
        if (!p) { toast('A name is needed'); return; }
        tap(); closeSheet(); renderAll(); toast(p.name + ' is in the book');
      };
      setTimeout(() => panel.querySelector('#pName').focus(), 40);
    });
  }

  /* ---------- bookings ---------- */
  function bookingSheet(giverId) {
    if (Store.people().length < 2) { toast('Two people are needed to arrange an hour'); return; }
    const g = giverId || Store.people()[0].id;
    openSheet('Arrange an hour', 'One person gives the hour, the other receives it.', `
      <div class="field"><label for="bGiver">Who is giving the hour</label>
        <select id="bGiver">${peopleOptions(g)}</select></div>
      <div class="field"><label for="bReceiver">Who is receiving it</label>
        <select id="bReceiver">${peopleOptions(null, g)}</select></div>
      <div class="field"><label for="bWhat">What is it</label>
        <input id="bWhat" type="text" placeholder="Rewire the hallway lamp"></div>
      <div class="field"><label for="bHours">How long</label>
        <input id="bHours" type="number" min="0.25" max="12" step="0.25" value="1"></div>
      <div class="field"><label for="bOn">When</label><input id="bOn" type="date"></div>
      <p class="help" id="bWarn"></p>
      <div class="btnrow"><button class="btn primary" id="bSave">Arrange it</button>
        <button class="btn ghost" id="bCancel">Cancel</button></div>`, (panel) => {
      const sync = () => {
        const gv = panel.querySelector('#bGiver').value;
        panel.querySelector('#bReceiver').innerHTML = peopleOptions(null, gv);
        const rc = panel.querySelector('#bReceiver').value;
        const h = Number(panel.querySelector('#bHours').value) || 0;
        const ok = Store.canReceive(rc, h);
        panel.querySelector('#bWarn').textContent = ok ? ''
          : `${Store.nameOf(rc)} would fall past ${Store.FLOOR} hours. The node carries people to ${Store.FLOOR}, not further, so this one waits until they give an hour.`;
        panel.querySelector('#bSave').disabled = !ok;
      };
      panel.querySelector('#bGiver').onchange = sync;
      panel.querySelector('#bReceiver').onchange = sync;
      panel.querySelector('#bHours').oninput = sync;
      sync();
      panel.querySelector('#bCancel').onclick = closeSheet;
      panel.querySelector('#bSave').onclick = () => {
        const what = panel.querySelector('#bWhat').value;
        if (!what.trim()) { toast('Say what the hour is for'); return; }
        Store.addBooking(panel.querySelector('#bGiver').value, panel.querySelector('#bReceiver').value,
          what, panel.querySelector('#bHours').value, panel.querySelector('#bOn').value);
        tap(); closeSheet(); show('bookings'); toast('Arranged');
      };
    });
  }

  function renderBookings() {
    const open = Store.openBookings(), past = Store.pastBookings();
    $('#bookingEmpty').hidden = open.length + past.length > 0;
    const card = (b, done) => {
      const waiting = [];
      if (!b.gaveOk) waiting.push(Store.nameOf(b.giverId));
      if (!b.gotOk) waiting.push(Store.nameOf(b.receiverId));
      return `<div class="card" data-b="${b.id}">
        <h3>${esc(b.what || 'An hour')}</h3>
        <p class="meta">${esc(Store.nameOf(b.giverId))} gives ${hours(b.hours)} to ${esc(Store.nameOf(b.receiverId))} &middot; ${dateLabel(b.on)}</p>
        ${done ? '<span class="pill done">In the book</span>'
               : `<span class="pill wait">Waiting on ${esc(waiting.join(' and '))}</span>
                  <div class="btnrow">
                    <button class="btn small" data-ok="giver">${esc(Store.nameOf(b.giverId))} gave it</button>
                    <button class="btn small" data-ok="receiver">${esc(Store.nameOf(b.receiverId))} got it</button>
                    <button class="btn small ghost" data-cancel="1">Cancel</button>
                  </div>`}
      </div>`;
    };
    $('#bookingList').innerHTML =
      (open.length ? '<h2 class="h2">Arranged</h2>' + open.map(b => card(b, false)).join('') : '') +
      (past.length ? '<h2 class="h2">Done</h2>' + past.slice(0, 30).map(b => card(b, true)).join('') : '');
    $$('#bookingList .card').forEach(c => {
      const id = c.dataset.b;
      c.querySelectorAll('[data-ok]').forEach(btn => btn.onclick = () => {
        const b = Store.confirm(id, btn.dataset.ok);
        tap(14, 120);
        renderAll();
        if (b && b.state === 'done') toast('Both agreed. It is in the book.');
        else toast('Noted. Waiting on the other side.');
      });
      const cancel = c.querySelector('[data-cancel]');
      if (cancel) cancel.onclick = () => { Store.cancelBooking(id); renderBookings(); toast('Cancelled'); };
    });
  }

  /* ---------- ledger ---------- */
  function renderLedger() {
    const bal = Store.balances();
    const total = Store.entries().reduce((s, e) => s + e.hours, 0);
    $('#ledgerSub').textContent = total ? hours(Math.round(total * 4) / 4) + ' have changed hands' : 'Nothing given yet';
    $('#balances').innerHTML = bal.map(b => `
      <div class="bal-card${b.hours < 0 ? ' over' : ''}">
        <p class="n">${b.hours >= 0 ? '+' : ''}${b.hours}</p>
        <p class="who">${esc(b.name)}</p>
        ${b.hours < 0 ? '<p class="note">The node has them covered.</p>' : ''}
      </div>`).join('') || '<p class="help">Balances appear once there are people in the book.</p>';

    const es = Store.entries().slice().reverse();
    $('#ledgerEmpty').hidden = es.length > 0;
    $('#ledgerList').innerHTML = es.map(e => `
      <div class="line">
        <p>${esc(Store.nameOf(e.giverId))} gave ${hours(e.hours)} to ${esc(Store.nameOf(e.receiverId))}${e.what ? ', ' + esc(e.what) : ''}.</p>
        <p class="when">${new Date(e.at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>`).join('');
  }

  /* ---------- navigation ---------- */
  function renderAll() { renderBoard(); renderBookings(); renderLedger(); renderPeople(); }
  function show(v) {
    view = v;
    $$('.view').forEach(el => { el.hidden = el.id !== 'v-' + v; });
    $$('.tab').forEach(t => t.classList.toggle('is-on', t.dataset.view === v));
    if (v === 'board') renderBoard();
    if (v === 'bookings') renderBookings();
    if (v === 'ledger') renderLedger();
    if (v === 'people') renderPeople();
  }

  /* ---------- onboarding ---------- */
  let obStep = 0;
  function renderOb() {
    const cards = $$('#obTrack .ob-card');
    cards.forEach((c, i) => c.classList.toggle('is-on', i === obStep));
    $('#obDots').innerHTML = cards.map((_, i) => `<i class="${i === obStep ? 'is-on' : ''}"></i>`).join('');
    $('#obNext').textContent = obStep === cards.length - 1 ? 'Open the book' : 'Next';
  }
  function obNext() {
    const cards = $$('#obTrack .ob-card');
    if (obStep < cards.length - 1) { obStep++; renderOb(); return; }
    const me = $('#obName').value.trim();
    const node = $('#obNode').value.trim();
    if (!me) { toast('Your name goes in the book too'); return; }
    Store.settings({ node: node || 'The node' });
    const p = Store.addPerson(me, '');
    Store.settings({ me: p ? p.id : null });
    Store.onboarded(true);
    startApp();
  }

  function startApp() {
    $('#onboard').hidden = true;
    $('#tabs').hidden = false;
    document.body.classList.add('has-tabs');
    show('board');
  }

  function bind() {
    $('#obNext').onclick = obNext;
    $$('.tab').forEach(t => { t.onclick = () => show(t.dataset.view); });
    $$('.seg').forEach(s => { s.onclick = () => { boardKind = s.dataset.board; renderBoard(); }; });
    $('#boardSearch').addEventListener('input', renderBoard);
    $('#addPerson').onclick = personSheet;
    $('#addPersonTop').onclick = personSheet;
    $('#newBookingTop').onclick = () => bookingSheet(null);
    $('#sheet').onclick = e => { if (e.target.id === 'sheet') closeSheet(); };

    $('#exportJson').onclick = () => download('patchwork-book.json', 'application/json', Store.exportJson());
    $('#ledgerExport').onclick = () => download('patchwork-book.json', 'application/json', Store.exportJson());
    $('#exportCsv').onclick = () => download('patchwork-ledger.csv', 'text/csv', Store.exportCsv());
    $('#importFile').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        const res = Store.importJson(String(r.result));
        $('#ioNote').textContent = res.ok
          ? `Merged: ${res.people} people, ${res.entries} ledger lines, ${res.bookings} bookings.`
          : res.why;
        renderAll();
      };
      r.readAsText(f); e.target.value = '';
    };
    $('#eraseBtn').onclick = () => {
      const b = $('#eraseBtn');
      if (b.dataset.armed) { Store.erase(); location.reload(); }
      else { b.dataset.armed = '1'; b.textContent = 'Tap again to erase everything';
             setTimeout(() => { delete b.dataset.armed; b.textContent = 'Erase everything'; }, 4000); }
    };
  }

  function init() {
    bind();
    if (Store.onboarded()) startApp();
    else { $('#onboard').hidden = false; renderOb(); }
  }

  /* Called by the Android shell. */
  function back() {
    if (!$('#sheet').hidden) { closeSheet(); return true; }
    if (view !== 'board' && !$('#tabs').hidden) { show('board'); return true; }
    return false;
  }
  function onResume() { if (Store.onboarded()) renderAll(); }

  document.addEventListener('DOMContentLoaded', init);
  return { back, onResume, show, toast };
})();

// A top-level const does not become a window property in a classic script, and the shell needs this.
window.App = App;
