/* A book with a real year in it, for looking at the design under load. */
module.exports.RICH = function () {
  localStorage.clear();
  Store.settings({ node: 'Lower Road' });
  const P = {};
  for (const [n, note] of [['Amaia', 'Flat 2, evenings are best'], ['Walter', 'Flat 3, mornings only'],
    ['Rosa', 'Two doors down, has the ladder'], ['Deepa', 'Runs the Saturday table at the library'],
    ['Tomas', 'Ground floor, back'], ['Nell', 'Corner shop, closes at six']]) P[n] = Store.addPerson(n, note).id;
  Store.settings({ me: P.Amaia });
  const off = [
    ['Walter', 'repair', 'Fix a dripping tap or a dead socket'],
    ['Walter', 'teach', 'Show you what the fuse box actually does'],
    ['Amaia', 'make', 'Draw a sign for your window or your stall'],
    ['Amaia', 'teach', 'An hour of Basque conversation'],
    ['Rosa', 'grow', 'Cut back anything that has got out of hand'],
    ['Rosa', 'move', 'Carry the heavy end of it'],
    ['Deepa', 'admin', 'Sit with you and fill in the forms'],
    ['Tomas', 'care', 'Sit with your dog for an afternoon'],
    ['Nell', 'make', 'Take up a hem or put a zip back in'],
    ['Nell', 'grow', 'Start your tomatoes off on my windowsill']];
  for (const [n, c, t] of off) Store.addListing(P[n], 'offer', c, t);
  const asks = [
    ['Rosa', 'admin', 'Explain how the pension form works'],
    ['Amaia', 'grow', 'Someone to water the pots for a week'],
    ['Walter', 'move', 'Two people to shift a wardrobe'],
    ['Tomas', 'teach', 'Show me how to put photos on a computer'],
    ['Deepa', 'repair', 'The library trolley wheel has gone']];
  for (const [n, c, t] of asks) Store.addListing(P[n], 'ask', c, t);
  const book = [
    ['Walter', 'Amaia', 1, 'Rewired the hallway lamp'],
    ['Amaia', 'Rosa', 1.5, 'Drew the poster for the meeting'],
    ['Rosa', 'Walter', 2, 'Cut the hedge back off the path'],
    ['Deepa', 'Tomas', 1, 'Filled in the housing form together'],
    ['Nell', 'Deepa', 0.5, 'Took up the curtains'],
    ['Tomas', 'Nell', 3, 'Sat with the shop while she was at the hospital'],
    ['Walter', 'Deepa', 1, 'New washer on the library tap'],
    ['Amaia', 'Nell', 1, 'Painted the new price board'],
    ['Rosa', 'Tomas', 2, 'Moved the wardrobe upstairs'],
    ['Deepa', 'Amaia', 1, 'Read through the tenancy letter'],
    ['Nell', 'Walter', 1.5, 'Mended two shirts and a coat'],
    ['Tomas', 'Rosa', 1, 'Walked the dog while she was away'],
    ['Walter', 'Nell', 0.75, 'Put the shop shelf back up'],
    ['Amaia', 'Deepa', 2, 'Made the signs for the Saturday table'],
    ['Rosa', 'Nell', 1, 'Brought the tomato plants on']];
  for (const [g, r, h, w] of book) Store.post(P[g], P[r], h, w, 'booking');
  Store.addBooking(P.Rosa, P.Walter, 'Sit with the cat on Thursday', 2, '2026-09-12');
  const b2 = Store.addBooking(P.Deepa, P.Amaia, 'Go through the grant form', 1.5, '2026-09-09');
  Store.confirm(b2.id, 'giver');
  Store.addBooking(P.Nell, P.Tomas, 'Take the jacket in at the shoulders', 1, '2026-08-30');
  Store.onboarded(true);
  return P;
};
