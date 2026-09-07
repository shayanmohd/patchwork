/* Shared seed for the drive scripts. Store.addPerson returns the person object, not an id. */
module.exports.SEED = function () {
  localStorage.clear();
  Store.settings({ node: 'Lower Road' });
  const a = Store.addPerson('Amaia', 'Flat 2, evenings').id;
  const w = Store.addPerson('Walter', 'Flat 3, mornings are best').id;
  const r = Store.addPerson('Rosa', 'Two doors down').id;
  Store.settings({ me: a });
  Store.addListing(w, 'offer', 'repair', 'Fix a dripping tap');
  Store.addListing(w, 'offer', 'teach', 'Show you what a fuse box does');
  Store.addListing(a, 'offer', 'make', 'Draw a sign for your window');
  Store.addListing(r, 'ask', 'admin', 'Explain how the pension form works');
  Store.addListing(a, 'ask', 'grow', 'Someone to water the pots for a week');
  Store.post(w, a, 1, 'Rewired the hallway lamp', 'booking');
  Store.post(a, r, 1.5, 'Drew the poster for the meeting', 'booking');
  Store.addBooking(r, w, 'Sit with the cat on Thursday', 2, '2026-09-12');
  Store.onboarded(true);
  return { a, w, r };
};
