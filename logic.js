(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FarahLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CATS = [
    { id: 'venue', ar: 'القاعة', en: 'Venue', color: '#7a2350' },
    { id: 'catering', ar: 'البوفيه والضيافة', en: 'Catering', color: '#c9792a' },
    { id: 'photo', ar: 'التصوير', en: 'Photo & video', color: '#2c6f77' },
    { id: 'attire', ar: 'الفستان والبدلة', en: 'Attire', color: '#b8325a' },
    { id: 'music', ar: 'الزفة والموسيقى', en: 'Zaffa & music', color: '#d9a32e' },
    { id: 'beauty', ar: 'الكوافير والمكياج', en: 'Hair & makeup', color: '#9b5fa8' },
    { id: 'decor', ar: 'الديكور والورد', en: 'Decor & flowers', color: '#4f8a52' },
    { id: 'invites', ar: 'كروت الدعوة', en: 'Invitations', color: '#6b6f2a' },
    { id: 'gold', ar: 'الشبكة والدبل', en: 'Shabka & rings', color: '#a8741a' },
    { id: 'home', ar: 'تجهيز العش', en: 'Home setup', color: '#3d5a9a' },
    { id: 'honeymoon', ar: 'شهر العسل', en: 'Honeymoon', color: '#d1563f' },
    { id: 'transport', ar: 'المواصلات', en: 'Transport', color: '#5b6770' },
    { id: 'other', ar: 'أخرى', en: 'Other', color: '#8a7a6a' }
  ];
  var CAT_IDS = CATS.map(function (c) { return c.id; });
  var STATUSES = ['idea', 'contacted', 'quoted', 'booked', 'paid'];
  var RSVPS = ['pending', 'yes', 'no'];
  var SIDES = ['bride', 'groom', 'both'];

  // [daysBefore, key, ar, en]
  var DEFAULT_TASKS = [
    [365, 't_budget', 'اتفقوا على الميزانية وعدد المعازيم التقريبي', 'Agree on a budget and a rough guest count'],
    [330, 't_venue', 'احجزوا القاعة أو المكان', 'Book the venue'],
    [300, 't_photo', 'اختاروا المصور واتفقوا معاه', 'Choose and book a photographer'],
    [270, 't_attire', 'ابدأوا تدوير على الفستان والبدلة', 'Start looking for the dress and suit'],
    [270, 't_music', 'احجزوا الزفة والفرقة أو الدي جي', 'Book the zaffa and band or DJ'],
    [240, 't_catering', 'اتفقوا على المنيو والبوفيه', 'Settle the menu and catering'],
    [180, 't_invites', 'صمموا كروت الدعوة', 'Design the invitations'],
    [180, 't_gold', 'اشتروا الشبكة والدبل', 'Buy the shabka and rings'],
    [150, 't_beauty', 'احجزوا الكوافير وجربوا المكياج', 'Book hair and makeup, do a trial'],
    [120, 't_honeymoon', 'احجزوا شهر العسل', 'Book the honeymoon'],
    [90, 't_send', 'ابعتوا الدعوات للمعازيم', 'Send the invitations'],
    [90, 't_decor', 'اتفقوا على الديكور والورد', 'Confirm decor and flowers'],
    [60, 't_contract', 'رتبوا ميعاد كتب الكتاب والورق المطلوب', 'Arrange the katb el-ketab date and paperwork'],
    [45, 't_fitting', 'آخر بروفة للفستان والبدلة', 'Final fitting for dress and suit'],
    [30, 't_guests', 'راجعوا قايمة المعازيم وترتيب الترابيزات', 'Confirm the guest list and seating'],
    [21, 't_confirm', 'أكدوا مع كل الموردين', 'Confirm with every vendor'],
    [14, 't_balances', 'جهزوا باقي المدفوعات للموردين', 'Prepare the remaining vendor payments'],
    [7, 't_pack', 'جهزوا شنطة السفر', 'Pack for the trip'],
    [2, 't_tips', 'جهزوا الإكراميات في مظاريف', 'Put tips in envelopes for the vendors']
  ];

  function num(v, max) {
    var n = Number(v);
    if (!isFinite(n) || n < 0) n = 0;
    if (max && n > max) n = max;
    return n;
  }
  function str(v, len) { return String(v == null ? '' : v).slice(0, len || 200); }
  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

  function isoDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
    var d = new Date(s + 'T00:00:00Z');
    return !isNaN(d) && toISO(d) === s;
  }
  function toISO(d) { return d.toISOString().slice(0, 10); }
  function daysBetween(fromISO, toISOs) {
    if (!isoDate(fromISO) || !isoDate(toISOs)) return null;
    return Math.round((Date.parse(toISOs + 'T00:00:00Z') - Date.parse(fromISO + 'T00:00:00Z')) / 86400000);
  }
  function addDays(iso, n) {
    var d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return toISO(d);
  }
  function dueISO(weddingISO, daysBefore) {
    return isoDate(weddingISO) ? addDays(weddingISO, -daysBefore) : null;
  }

  function emptyState() {
    return {
      v: 1, lang: 'ar', couple: { a: '', b: '' }, date: '', budget: 0,
      expenses: [], tasks: defaultTasks(), vendors: [], guests: []
    };
  }
  function defaultTasks() {
    return DEFAULT_TASKS.map(function (t) {
      return { id: t[1], key: t[1], days: t[0], done: false, title: '' };
    });
  }

  function budgetSummary(s) {
    var planned = 0, paid = 0, byCat = {};
    CAT_IDS.forEach(function (id) { byCat[id] = { planned: 0, paid: 0, count: 0 }; });
    s.expenses.forEach(function (e) {
      var c = byCat[e.cat] || byCat.other;
      c.planned += e.planned; c.paid += e.paid; c.count++;
      planned += e.planned; paid += e.paid;
    });
    return {
      total: s.budget, planned: planned, paid: paid,
      toPay: Math.max(0, planned - paid),
      left: s.budget - planned,
      over: s.budget > 0 && planned > s.budget,
      pctPlanned: s.budget > 0 ? Math.round(planned / s.budget * 100) : 0,
      pctPaid: planned > 0 ? Math.round(paid / planned * 100) : 0,
      byCat: byCat
    };
  }

  function guestSummary(s) {
    var r = { yes: 0, no: 0, pending: 0, people: 0, expected: 0, entries: s.guests.length, bride: 0, groom: 0, both: 0 };
    s.guests.forEach(function (g) {
      r[g.rsvp] += g.count;
      if (g.rsvp !== 'no') { r.expected += g.count; r[g.side] += g.count; }
      r.people += g.count;
    });
    var fixed = 0;
    s.expenses.forEach(function (e) { if (e.cat === 'venue' || e.cat === 'catering') fixed += e.planned; });
    r.perHead = r.expected > 0 && fixed > 0 ? Math.round(fixed / r.expected) : 0;
    return r;
  }

  function taskView(s, todayISO) {
    return s.tasks.map(function (t) {
      var due = dueISO(s.date, t.days);
      return {
        id: t.id, key: t.key, title: t.title, days: t.days, done: t.done, due: due,
        overdue: !!(due && !t.done && todayISO && due < todayISO)
      };
    }).sort(function (a, b) {
      if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
      return b.days - a.days;
    });
  }
  function taskProgress(s) {
    var d = s.tasks.filter(function (t) { return t.done; }).length;
    return { done: d, total: s.tasks.length, pct: s.tasks.length ? Math.round(d / s.tasks.length * 100) : 0 };
  }

  function fmtMoney(n, lang) {
    var loc = lang === 'ar' ? 'ar-EG' : 'en-US';
    var v = new Intl.NumberFormat(loc, { maximumFractionDigits: 0 }).format(Math.round(n));
    return lang === 'ar' ? v + ' ج.م' : 'EGP ' + v;
  }

  function csvCell(v) {
    var t = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
    return '"' + t.replace(/"/g, '""') + '"';
  }
  function guestsCSV(s) {
    var rows = [['name', 'side', 'group', 'people', 'rsvp', 'phone']];
    s.guests.forEach(function (g) { rows.push([g.name, g.side, g.group, g.count, g.rsvp, g.phone]); });
    return '\ufeff' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
  }

  // Normalise untrusted data (import or storage) into a safe state.
  function sanitize(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('bad file');
    var s = emptyState();
    s.lang = o.lang === 'en' ? 'en' : 'ar';
    s.couple = { a: str(o.couple && o.couple.a, 40), b: str(o.couple && o.couple.b, 40) };
    s.date = isoDate(o.date) ? o.date : '';
    s.budget = num(o.budget, 1e10);
    var arr = function (x) { return Array.isArray(x) ? x.slice(0, 1000) : []; };
    s.expenses = arr(o.expenses).filter(function (e) { return e && typeof e === 'object'; }).map(function (e) {
      return { id: str(e.id, 20) || uid(), cat: CAT_IDS.indexOf(e.cat) >= 0 ? e.cat : 'other',
        name: str(e.name, 80), planned: num(e.planned, 1e10), paid: num(e.paid, 1e10) };
    });
    if (Array.isArray(o.tasks)) {
      var known = {};
      DEFAULT_TASKS.forEach(function (t) { known[t[1]] = t; });
      s.tasks = arr(o.tasks).filter(function (t) { return t && typeof t === 'object'; }).map(function (t) {
        var k = known[t.key] ? t.key : '';
        return { id: str(t.id, 20) || uid(), key: k, days: k ? known[k][0] : Math.min(num(t.days), 3650),
          done: t.done === true, title: k ? '' : str(t.title, 120) };
      }).filter(function (t) { return t.key || t.title; });
    }
    s.vendors = arr(o.vendors).filter(function (v) { return v && typeof v === 'object'; }).map(function (v) {
      return { id: str(v.id, 20) || uid(), cat: CAT_IDS.indexOf(v.cat) >= 0 ? v.cat : 'other',
        name: str(v.name, 80), phone: str(v.phone, 30).replace(/[^\d+\s-]/g, ''),
        price: num(v.price, 1e10), status: STATUSES.indexOf(v.status) >= 0 ? v.status : 'idea', notes: str(v.notes, 300) };
    });
    s.guests = arr(o.guests).filter(function (g) { return g && typeof g === 'object'; }).map(function (g) {
      return { id: str(g.id, 20) || uid(), name: str(g.name, 80), side: SIDES.indexOf(g.side) >= 0 ? g.side : 'both',
        group: str(g.group, 40), count: Math.max(1, Math.min(50, Math.round(num(g.count)) || 1)),
        rsvp: RSVPS.indexOf(g.rsvp) >= 0 ? g.rsvp : 'pending', phone: str(g.phone, 30).replace(/[^\d+\s-]/g, '') };
    });
    return s;
  }

  function sampleState(todayISO) {
    var s = emptyState();
    s.lang = 'en';
    s.couple = { a: 'Layla', b: 'Omar' };
    s.date = addDays(todayISO, 178);
    s.budget = 450000;
    var E = function (cat, name, planned, paid) { s.expenses.push({ id: uid(), cat: cat, name: name, planned: planned, paid: paid }); };
    E('venue', 'Nile-view hall, deposit and balance', 120000, 60000);
    E('catering', 'Buffet for 300', 105000, 30000);
    E('photo', 'Photo and video package', 28000, 10000);
    E('attire', 'Dress and suit', 45000, 20000);
    E('music', 'Zaffa and live band', 22000, 5000);
    E('beauty', 'Hair and makeup', 9000, 0);
    E('decor', 'Kosha and flowers', 30000, 0);
    E('invites', 'Printed invitations', 6000, 6000);
    E('gold', 'Shabka and rings', 60000, 60000);
    s.tasks.forEach(function (t) { if (t.days >= 180) t.done = true; });
    s.tasks.push({ id: uid(), key: '', days: 100, done: false, title: 'Pick the first-dance song' });
    var V = function (cat, name, phone, price, status, notes) { s.vendors.push({ id: uid(), cat: cat, name: name, phone: phone, price: price, status: status, notes: notes }); };
    V('venue', 'Nile Palace Hall', '+20 100 555 0101', 120000, 'booked', 'Deposit paid. Final headcount due 14 days before.');
    V('photo', 'Lens & Lace Studio', '+20 100 555 0102', 28000, 'booked', 'Includes a short film and 2 albums.');
    V('music', 'Cairo Sunset Band', '+20 100 555 0103', 22000, 'quoted', 'Asked about a drummer for the zaffa.');
    V('beauty', 'Nada Beauty Lounge', '+20 100 555 0104', 9000, 'contacted', 'Trial run suggested in 2 months.');
    var G = function (name, side, group, count, rsvp) { s.guests.push({ id: uid(), name: name, side: side, group: group, count: count, rsvp: rsvp, phone: '' }); };
    G('Amr family', 'groom', 'Family', 6, 'yes');
    G('Hassan family', 'bride', 'Family', 5, 'yes');
    G('Office friends', 'groom', 'Work', 12, 'pending');
    G('Nour and Salma', 'bride', 'Friends', 2, 'yes');
    G('Uncle Tarek', 'bride', 'Family', 4, 'pending');
    G('College group', 'both', 'Friends', 15, 'yes');
    G('Cousins abroad', 'groom', 'Family', 3, 'no');
    return s;
  }

  return {
    CATS: CATS, CAT_IDS: CAT_IDS, STATUSES: STATUSES, RSVPS: RSVPS, SIDES: SIDES, DEFAULT_TASKS: DEFAULT_TASKS,
    num: num, str: str, uid: uid, isoDate: isoDate, daysBetween: daysBetween, addDays: addDays, dueISO: dueISO,
    emptyState: emptyState, budgetSummary: budgetSummary, guestSummary: guestSummary, taskView: taskView,
    taskProgress: taskProgress, fmtMoney: fmtMoney, guestsCSV: guestsCSV, csvCell: csvCell, sanitize: sanitize,
    sampleState: sampleState
  };
});
