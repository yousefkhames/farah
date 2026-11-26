const assert = require('assert');
const L = require('../logic.js');
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('daysBetween and addDays', () => {
  assert.strictEqual(L.daysBetween('2026-11-26', '2027-01-01'), 36);
  assert.strictEqual(L.daysBetween('2026-11-26', 'x'), null);
  assert.strictEqual(L.addDays('2026-12-30', 3), '2027-01-02');
  assert.strictEqual(L.addDays('2028-02-28', 1), '2028-02-29');
  assert.strictEqual(L.isoDate('2026-02-31'), false); assert.strictEqual(L.isoDate('2028-02-29'), true); assert.strictEqual(L.isoDate('2026-13-01'), false);
});
t('dueISO', () => {
  assert.strictEqual(L.dueISO('2027-06-01', 30), '2027-05-02');
  assert.strictEqual(L.dueISO('', 30), null);
});
t('budget math', () => {
  const s = L.emptyState(); s.budget = 1000;
  s.expenses = [{ cat: 'venue', planned: 600, paid: 200 }, { cat: 'photo', planned: 500, paid: 500 }, { cat: 'zzz', planned: 10, paid: 0 }];
  const b = L.budgetSummary(s);
  assert.strictEqual(b.planned, 1110); assert.strictEqual(b.paid, 700); assert.strictEqual(b.toPay, 410);
  assert.strictEqual(b.left, -110); assert.strictEqual(b.over, true); assert.strictEqual(b.byCat.other.planned, 10);
  assert.strictEqual(b.pctPlanned, 111);
});
t('budget with no total is never over', () => {
  const s = L.emptyState(); s.expenses = [{ cat: 'venue', planned: 5, paid: 0 }];
  assert.strictEqual(L.budgetSummary(s).over, false); assert.strictEqual(L.budgetSummary(s).pctPlanned, 0);
});
t('guest summary and per head', () => {
  const s = L.emptyState();
  s.expenses = [{ cat: 'venue', planned: 100000, paid: 0 }, { cat: 'catering', planned: 50000, paid: 0 }, { cat: 'photo', planned: 9999, paid: 0 }];
  s.guests = [{ count: 10, rsvp: 'yes', side: 'bride' }, { count: 5, rsvp: 'pending', side: 'groom' }, { count: 4, rsvp: 'no', side: 'both' }];
  const g = L.guestSummary(s);
  assert.deepStrictEqual([g.yes, g.pending, g.no, g.expected, g.people], [10, 5, 4, 15, 19]);
  assert.strictEqual(g.bride, 10); assert.strictEqual(g.groom, 5); assert.strictEqual(g.both, 0);
  assert.strictEqual(g.perHead, 10000);
});
t('tasks: due dates, overdue, order', () => {
  const s = L.emptyState(); s.date = '2027-01-01';
  const v = L.taskView(s, '2026-06-01');
  const venue = v.find(x => x.key === 't_venue');
  assert.strictEqual(venue.due, '2026-02-05'); assert.strictEqual(venue.overdue, true);
  assert.ok(v[0].due <= v[v.length - 1].due);
  s.tasks.find(x => x.key === 't_venue').done = true;
  assert.strictEqual(L.taskView(s, '2026-06-01').find(x => x.key === 't_venue').overdue, false);
  const p = L.taskProgress(s); assert.strictEqual(p.done, 1); assert.strictEqual(p.total, L.DEFAULT_TASKS.length);
});
t('tasks without date have no due', () => {
  const v = L.taskView(L.emptyState(), '2026-06-01'); assert.ok(v.every(x => x.due === null && !x.overdue));
});
t('money format', () => {
  assert.strictEqual(L.fmtMoney(1500, 'en'), 'EGP 1,500');
  assert.ok(/ج\.م$/.test(L.fmtMoney(1500, 'ar'))); assert.ok(/[٠-٩]/.test(L.fmtMoney(1500, 'ar')));
});
t('csv escapes and blocks formulas', () => {
  const s = L.emptyState(); s.guests = [{ name: '=HYPERLINK("x")', side: 'both', group: 'a,b', count: 2, rsvp: 'yes', phone: '+20 1' }, { name: 'Say "hi"', side: 'bride', group: '', count: 1, rsvp: 'no', phone: '' }];
  const c = L.guestsCSV(s);
  assert.ok(c.includes('"\'=HYPERLINK(""x"")"')); assert.ok(c.includes('"a,b"')); assert.ok(c.includes('"Say ""hi"""'));
  assert.ok(c.startsWith('\ufeff'));
});
t('sanitize rejects junk and clamps', () => {
  assert.throws(() => L.sanitize(null)); assert.throws(() => L.sanitize([]));
  const s = L.sanitize({ lang: 'fr', date: 'nope', budget: -5, expenses: [{ cat: 'bad', planned: -1, paid: 'x', name: '<img src=x>' }, null],
    guests: [{ name: 'A', count: 999, rsvp: 'maybe', side: 'x' }], vendors: [{ name: 'V', phone: 'abc+2 0-1', status: 'zz', price: 'q' }] });
  assert.strictEqual(s.lang, 'ar'); assert.strictEqual(s.date, ''); assert.strictEqual(s.budget, 0);
  assert.strictEqual(s.expenses.length, 1); assert.strictEqual(s.expenses[0].cat, 'other'); assert.strictEqual(s.expenses[0].planned, 0);
  assert.strictEqual(s.expenses[0].name, '<img src=x>'); // stored raw, escaped at render
  assert.strictEqual(s.guests[0].count, 50); assert.strictEqual(s.guests[0].rsvp, 'pending'); assert.strictEqual(s.guests[0].side, 'both');
  assert.strictEqual(s.vendors[0].phone, '+2 0-1'); assert.strictEqual(s.vendors[0].status, 'idea');
  assert.strictEqual(s.tasks.length, L.DEFAULT_TASKS.length);
});
t('sanitize keeps custom tasks and done flags, drops empty ones', () => {
  const s = L.sanitize({ tasks: [{ key: 't_venue', done: true }, { key: '', title: 'Buy shoes', days: 20 }, { key: '', title: '' }, { key: 'fake', title: '' }] });
  assert.strictEqual(s.tasks.length, 2); assert.strictEqual(s.tasks[0].done, true); assert.strictEqual(s.tasks[1].title, 'Buy shoes');
});
t('round trip of sample state', () => {
  const a = L.sampleState('2026-11-26'), b = L.sanitize(JSON.parse(JSON.stringify(a)));
  assert.deepStrictEqual(b, a);
  assert.strictEqual(a.date, '2027-05-23');
  assert.strictEqual(L.budgetSummary(a).over, false);
});
t('every default task has both languages and unique keys', () => {
  const keys = new Set(L.DEFAULT_TASKS.map(x => x[1])); assert.strictEqual(keys.size, L.DEFAULT_TASKS.length);
  L.DEFAULT_TASKS.forEach(x => { assert.ok(x[2] && x[3]); });
});
t('i18n has same keys in both languages', () => {
  global.self = global; require('../i18n.js');
  const D = global.FarahI18n; global.FarahLogic = L;
  const a = Object.keys(D.ar).sort(), b = Object.keys(D.en).sort();
  assert.deepStrictEqual(a, b);
});
console.log(n + ' tests passed');
