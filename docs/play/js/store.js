/* Patchwork. One localStorage record: the people, the board, the bookings and the book.
   Balances are never stored, only derived from the ledger, so the book is the single truth. */
const Store = (() => {
  const KEY = 'patchwork.v1';
  const START = 2;        // the node fronts everyone two hours
  const FLOOR = -3;       // and carries them to minus three

  const CATEGORIES = [
    { id: 'repair', name: 'Repair and fix' },
    { id: 'teach', name: 'Teach and explain' },
    { id: 'grow', name: 'Garden and grow' },
    { id: 'care', name: 'Care and company' },
    { id: 'make', name: 'Make and mend' },
    { id: 'move', name: 'Lift and move' },
    { id: 'admin', name: 'Forms and admin' },
    { id: 'other', name: 'Something else' }
  ];

  const blank = () => ({
    v: 1, onboarded: false, node: '', me: null,
    people: [],      // { id, name, note, offers:[{id,cat,text}], asks:[{id,cat,text}] }
    bookings: [],    // { id, giverId, receiverId, what, hours, on, state, gaveOk, gotOk, note }
    entries: []      // { id, at, giverId, receiverId, hours, what, source }
  });

  let db = load();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      return Object.assign(blank(), JSON.parse(raw));
    } catch (e) { return blank(); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }

  const uid = (p) => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const person = id => db.people.find(p => p.id === id) || null;
  const nameOf = id => (person(id) || {}).name || 'someone who left';

  /* ---------- people ---------- */
  function addPerson(name, note) {
    const p = { id: uid('p'), name: String(name).trim().slice(0, 60), note: String(note || '').trim().slice(0, 200),
                offers: [], asks: [] };
    if (!p.name) return null;
    db.people.push(p); save(); return p;
  }
  function updatePerson(id, patch) { const p = person(id); if (p) { Object.assign(p, patch); save(); } return p; }
  function removePerson(id) {
    // the book is not rewritten: past hours stay, the person simply leaves the roster
    db.people = db.people.filter(p => p.id !== id);
    db.bookings = db.bookings.filter(b => b.giverId !== id && b.receiverId !== id || b.state === 'done');
    save();
  }
  function addListing(personId, kind, cat, text) {
    const p = person(personId); if (!p) return null;
    const item = { id: uid('l'), cat, text: String(text).trim().slice(0, 120) };
    if (!item.text) return null;
    (kind === 'ask' ? p.asks : p.offers).push(item); save(); return item;
  }
  function removeListing(personId, kind, listingId) {
    const p = person(personId); if (!p) return;
    const key = kind === 'ask' ? 'asks' : 'offers';
    p[key] = p[key].filter(l => l.id !== listingId); save();
  }

  /* ---------- the book ---------- */
  function balance(id) {
    let h = START;
    for (const e of db.entries) {
      if (e.giverId === id) h += e.hours;
      if (e.receiverId === id) h -= e.hours;
    }
    return Math.round(h * 4) / 4;
  }
  const balances = () => db.people.map(p => ({ id: p.id, name: p.name, hours: balance(p.id) }))
    .sort((a, b) => b.hours - a.hours);

  /** Can this person receive `hours` without falling through the floor? */
  function canReceive(id, hours) { return balance(id) - hours >= FLOOR; }

  function post(giverId, receiverId, hours, what, source) {
    if (!giverId || !receiverId || giverId === receiverId) return null;
    const h = Math.max(0.25, Math.min(12, Math.round(Number(hours) * 4) / 4));
    const e = { id: uid('e'), at: Date.now(), giverId, receiverId, hours: h,
                what: String(what || '').trim().slice(0, 140), source: source || 'direct' };
    db.entries.push(e); save(); return e;
  }

  /* ---------- bookings ---------- */
  function addBooking(giverId, receiverId, what, hours, on) {
    if (!giverId || !receiverId || giverId === receiverId) return null;
    const b = { id: uid('b'), giverId, receiverId, what: String(what).trim().slice(0, 140),
                hours: Math.max(0.25, Math.min(12, Math.round(Number(hours) * 4) / 4)),
                on: on || null, state: 'arranged', gaveOk: false, gotOk: false };
    db.bookings.push(b); save(); return b;
  }
  /** Either side confirms; the ledger line is written only when both have. */
  function confirm(bookingId, side) {
    const b = db.bookings.find(x => x.id === bookingId); if (!b || b.state === 'done') return b;
    if (side === 'giver') b.gaveOk = true; else b.gotOk = true;
    if (b.gaveOk && b.gotOk) {
      b.state = 'done';
      post(b.giverId, b.receiverId, b.hours, b.what, 'booking');
    }
    save(); return b;
  }
  function cancelBooking(id) { db.bookings = db.bookings.filter(b => b.id !== id); save(); }
  const openBookings = () => db.bookings.filter(b => b.state !== 'done')
    .sort((a, b) => (a.on || '9999').localeCompare(b.on || '9999'));
  const pastBookings = () => db.bookings.filter(b => b.state === 'done').reverse();

  /* ---------- the board ---------- */
  function board(kind, q) {
    const needle = (q || '').trim().toLowerCase();
    const out = [];
    for (const p of db.people) {
      for (const l of (kind === 'asks' ? p.asks : p.offers)) {
        if (needle && !(l.text + ' ' + p.name).toLowerCase().includes(needle)) continue;
        out.push({ person: p, listing: l, hours: balance(p.id) });
      }
    }
    return out;
  }

  /* ---------- settings and io ---------- */
  function settings(patch) { if (patch) { Object.assign(db, patch); save(); } return db; }
  function onboarded(v) { if (v !== undefined) { db.onboarded = !!v; save(); } return db.onboarded; }

  function exportJson() { return JSON.stringify({ app: 'patchwork', version: 1, node: db.node,
    people: db.people, bookings: db.bookings, entries: db.entries }, null, 2); }

  function exportCsv() {
    const esc = s => `"${String(s).replace(/"/g, '""')}"`;
    const rows = db.entries.map(e => [new Date(e.at).toISOString().slice(0, 10),
      esc(nameOf(e.giverId)), esc(nameOf(e.receiverId)), e.hours, esc(e.what)].join(','));
    return 'date,gave,received,hours,what\n' + rows.join('\n') + '\n';
  }

  /** Merges another keeper's book. Entries and people are matched by id, so a merge is safe to repeat. */
  function importJson(raw) {
    let d; try { d = JSON.parse(raw); } catch (e) { return { ok: false, why: 'That file is not a book.' }; }
    if (d.app !== 'patchwork') return { ok: false, why: 'That file was not written by Patchwork.' };
    let people = 0, entries = 0, bookings = 0;
    for (const p of d.people || []) if (!db.people.some(x => x.id === p.id)) { db.people.push(p); people++; }
    for (const e of d.entries || []) if (!db.entries.some(x => x.id === e.id)) { db.entries.push(e); entries++; }
    for (const b of d.bookings || []) if (!db.bookings.some(x => x.id === b.id)) { db.bookings.push(b); bookings++; }
    db.entries.sort((a, b) => a.at - b.at);
    save();
    return { ok: true, people, entries, bookings };
  }

  function erase() { db = blank(); localStorage.removeItem(KEY); }

  return { CATEGORIES, START, FLOOR, people: () => db.people, person, nameOf,
           addPerson, updatePerson, removePerson, addListing, removeListing,
           balance, balances, canReceive, post, entries: () => db.entries,
           addBooking, confirm, cancelBooking, openBookings, pastBookings,
           board, settings, onboarded, exportJson, exportCsv, importJson, erase };
})();
