(function () {
  'use strict';
  var L = window.FarahLogic, I = window.FarahI18n;
  var KEY = 'farah.v1';
  var $ = function (s) { return document.querySelector(s); };
  var mem = null, storageOk = true;
  var ui = { view: 'home', vendorCat: 'all', rsvp: 'all', q: '', showDone: false };
  var S;

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return { s: L.sanitize(JSON.parse(raw)), fresh: false };
    } catch (e) { if (e && e.name !== 'SyntaxError' && e.message !== 'bad file') storageOk = false; }
    return { s: L.emptyState(), fresh: true };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { storageOk = false; mem = S; }
  }
  var t = function (k) { return I[S.lang][k] || k; };
  var catName = function (id) { var c = L.CATS.filter(function (x) { return x.id === id; })[0] || L.CATS[12]; return S.lang === 'ar' ? c.ar : c.en; };
  var catColor = function (id) { var c = L.CATS.filter(function (x) { return x.id === id; })[0] || L.CATS[12]; return c.color; };
  var money = function (n) { return L.fmtMoney(n, S.lang); };
  var nf = function (n) { return new Intl.NumberFormat(S.lang === 'ar' ? 'ar-EG' : 'en-US').format(n); };
  function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso + 'T00:00:00Z').toLocaleDateString(S.lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  function toast(msg) {
    var el = $('#toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }
  function taskTitle(tk) {
    if (tk.key) { var d = L.DEFAULT_TASKS.filter(function (x) { return x[1] === tk.key; })[0]; return d ? (S.lang === 'ar' ? d[2] : d[3]) : tk.key; }
    return tk.title;
  }
  function coupleName() {
    var a = S.couple.a, b = S.couple.b;
    if (a && b) return a + ' ' + t('and') + ' ' + b;
    return a || b || '';
  }

  function coupleHTML() {
    var a = S.couple.a, b = S.couple.b;
    if (a && b) return '<bdi>' + esc(a) + '</bdi> ' + esc(t('and')) + ' <bdi>' + esc(b) + '</bdi>';
    return '<bdi>' + esc(a || b) + '</bdi>';
  }

  /* ---------- chrome ---------- */
  function chrome() {
    document.documentElement.lang = S.lang;
    document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
    document.title = S.lang === 'ar' ? 'فرح | مخطط الفرح' : 'Farah | Wedding planner';
    $('#brandName').textContent = t('appName'); $('#brandSub').textContent = t('sub');
    $('#langBtn').textContent = t('langBtn'); $('#setBtn').textContent = t('settings');
    var tabs = ['home', 'budget', 'tasks', 'vendors', 'guests'];
    var icons = {
      home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
      budget: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1.2 1.1-2 2.5-2s2.5.8 2.5 2-1.1 1.7-2.5 2-2.5.8-2.5 2 1.1 2 2.5 2 2.5-.8 2.5-2"/>',
      tasks: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/>',
      vendors: '<path d="M4 9l2-5h12l2 5M4 9v11h16V9M4 9h16M10 20v-6h4v6"/>',
      guests: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.2c3 0 5 2 5 5.3"/>'
    };
    $('#tabs').innerHTML = tabs.map(function (k) {
      return '<button type="button" data-tab="' + k + '"' + (ui.view === k ? ' class="on" aria-current="page"' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true">' + icons[k] + '</svg><span>' + esc(t(k)) + '</span></button>';
    }).join('');
  }

  /* ---------- components ---------- */
  function ring(pct, label, sub, color) {
    var p = Math.max(0, Math.min(100, pct)), r = 42, c = 2 * Math.PI * r;
    return '<div class="ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="' + r + '" class="rb"/><circle cx="50" cy="50" r="' + r + '" class="rf" style="stroke:' + color + ';stroke-dasharray:' + (c * p / 100).toFixed(1) + ' ' + c.toFixed(1) + '"/></svg><div><b>' + esc(label) + '</b><small>' + esc(sub) + '</small></div></div>';
  }
  function bar(pct, color, over) {
    return '<div class="bar"><i style="width:' + Math.min(100, pct) + '%;background:' + (over ? 'var(--bad)' : color) + '"></i></div>';
  }
  function empty(msg) { return '<p class="empty">' + esc(msg) + '</p>'; }

  /* ---------- views ---------- */
  function vHome() {
    var left = L.daysBetween(todayISO(), S.date);
    var b = L.budgetSummary(S), g = L.guestSummary(S), tp = L.taskProgress(S);
    var hero;
    if (left === null) hero = '<div class="hero"><p class="hero-k">' + esc(t('noDate')) + '</p><button class="btn gold" data-act="settings" type="button">' + esc(t('setDate')) + '</button></div>';
    else if (left < 0) hero = '<div class="hero"><p class="hero-k">' + esc(t('passed')) + '</p><p class="hero-s">' + esc(fmtDate(S.date)) + '</p></div>';
    else if (left === 0) hero = '<div class="hero"><p class="hero-n">' + esc(t('today')) + '</p></div>';
    else hero = '<div class="hero"><p class="hero-s">' + esc(coupleName() ? t('weddingOf') + ' ' + coupleName() : '') + '</p><p class="hero-big">' + esc(nf(left)) + '</p><p class="hero-k">' + esc(t('daysLeft')) + '</p><p class="hero-s">' + esc(fmtDate(S.date)) + '</p></div>';
    var next = L.taskView(S, todayISO()).filter(function (x) { return !x.done; }).slice(0, 4);
    return hero + '<div class="grid">' +
      '<section class="card"><h2>' + esc(t('budget')) + '</h2>' + ring(b.total ? b.pctPlanned : 0, b.total ? nf(b.pctPlanned) + '%' : '-', t('ofBudget'), b.over ? 'var(--bad)' : 'var(--gold)') +
      '<dl class="kv"><div><dt>' + esc(t('budgetTotal')) + '</dt><dd>' + esc(money(b.total)) + '</dd></div><div><dt>' + esc(t('paid')) + '</dt><dd>' + esc(money(b.paid)) + '</dd></div><div><dt>' + esc(b.over ? t('over') : t('left')) + '</dt><dd class="' + (b.over ? 'bad' : '') + '">' + esc(money(Math.abs(b.left))) + '</dd></div></dl></section>' +
      '<section class="card"><h2>' + esc(t('tasks')) + '</h2>' + ring(tp.pct, nf(tp.done) + '/' + nf(tp.total), t('tasksDone'), 'var(--teal)') +
      (next.length ? '<ul class="mini">' + next.map(function (x) { return '<li class="' + (x.overdue ? 'late' : '') + '"><span>' + esc(taskTitle(x)) + '</span>' + (x.due ? '<small>' + esc(fmtDate(x.due)) + '</small>' : '') + '</li>'; }).join('') + '</ul>' : (tp.total ? '<p class="empty">' + esc(t('allDone')) + '</p>' : '')) + '</section>' +
      '<section class="card"><h2>' + esc(t('guests')) + '</h2><p class="big">' + esc(nf(g.expected)) + '</p><p class="muted">' + esc(t('expected')) + '</p>' +
      '<dl class="kv"><div><dt>' + esc(t('confirmed')) + '</dt><dd>' + esc(nf(g.yes)) + '</dd></div><div><dt>' + esc(t('pending')) + '</dt><dd>' + esc(nf(g.pending)) + '</dd></div><div><dt>' + esc(t('declined')) + '</dt><dd>' + esc(nf(g.no)) + '</dd></div></dl>' +
      (g.perHead ? '<p class="note">' + esc(t('perHead')) + ': <b>' + esc(money(g.perHead)) + '</b></p>' : '') + '</section></div>';
  }

  function vBudget() {
    var b = L.budgetSummary(S);
    var cats = L.CATS.filter(function (c) { return b.byCat[c.id].count; });
    var head = '<section class="card sum"><div class="sum-row"><div><small>' + esc(t('budgetTotal')) + '</small><b>' + esc(money(b.total)) + '</b></div><div><small>' + esc(t('planned')) + '</small><b>' + esc(money(b.planned)) + '</b></div><div><small>' + esc(t('paid')) + '</small><b>' + esc(money(b.paid)) + '</b></div><div><small>' + esc(t('toPay')) + '</small><b>' + esc(money(b.toPay)) + '</b></div></div>' +
      bar(b.pctPlanned, 'var(--gold)', b.over) + '<p class="note ' + (b.over ? 'bad' : '') + '">' + esc(b.over ? t('over') + ' ' + money(-b.left) : t('left') + ': ' + money(b.left)) + '</p></section>';
    var list = cats.length ? cats.map(function (c) {
      var cb = b.byCat[c.id];
      var rows = S.expenses.filter(function (e) { return e.cat === c.id; }).map(function (e) {
        return '<li><button type="button" class="row" data-act="edit-expense" data-id="' + esc(e.id) + '"><span class="r-main">' + esc(e.name || catName(e.cat)) + '</span><span class="r-end"><b>' + esc(money(e.planned)) + '</b><small>' + esc(t('paid')) + ' ' + esc(money(e.paid)) + '</small></span></button></li>';
      }).join('');
      return '<section class="card cat"><h3><i style="background:' + c.color + '"></i>' + esc(catName(c.id)) + '<span>' + esc(money(cb.planned)) + '</span></h3>' + bar(cb.planned ? cb.paid / cb.planned * 100 : 0, c.color) + '<ul class="rows">' + rows + '</ul></section>';
    }).join('') : empty(t('noExpenses'));
    return head + '<div class="bar-head"><h2>' + esc(t('expenses')) + '</h2><button class="btn" type="button" data-act="add-expense">+ ' + esc(t('addExpense')) + '</button></div>' + list;
  }

  function vTasks() {
    var all = L.taskView(S, todayISO()), tp = L.taskProgress(S);
    var open = all.filter(function (x) { return !x.done; }), done = all.filter(function (x) { return x.done; });
    var li = function (x) {
      return '<li class="task' + (x.done ? ' done' : '') + (x.overdue ? ' late' : '') + '"><label><input type="checkbox" data-act="toggle-task" data-id="' + esc(x.id) + '"' + (x.done ? ' checked' : '') + '><span class="ck"></span><span class="tt">' + esc(taskTitle(x)) + '</span></label>' +
        '<span class="meta">' + (x.overdue ? '<em>' + esc(t('overdue')) + '</em> ' : '') + (x.due ? esc(fmtDate(x.due)) : '') + '</span><button type="button" class="ico" aria-label="' + esc(t('edit')) + '" data-act="edit-task" data-id="' + esc(x.id) + '">&#9998;</button></li>';
    };
    return '<section class="card sum"><div class="sum-row"><div><small>' + esc(t('tasksDone')) + '</small><b>' + esc(nf(tp.done) + '/' + nf(tp.total)) + '</b></div></div>' + bar(tp.pct, 'var(--teal)') + (S.date ? '' : '<p class="note">' + esc(t('noDue')) + '</p>') + '</section>' +
      '<div class="bar-head"><h2>' + esc(t('tasks')) + '</h2><button class="btn" type="button" data-act="add-task">+ ' + esc(t('addTask')) + '</button></div>' +
      '<ul class="tasks">' + (open.length ? open.map(li).join('') : '<li class="empty">' + esc(t('allDone')) + '</li>') + '</ul>' +
      (done.length ? '<button type="button" class="link" data-act="toggle-done" aria-expanded="' + ui.showDone + '">' + esc(t('showDone')) + ' (' + esc(nf(done.length)) + ')</button>' + (ui.showDone ? '<ul class="tasks">' + done.map(li).join('') + '</ul>' : '') : '');
  }

  function vVendors() {
    var chips = '<div class="chips" role="group"><button type="button" class="chip' + (ui.vendorCat === 'all' ? ' on' : '') + '" data-act="vcat" data-v="all">' + esc(t('all')) + '</button>' +
      L.CATS.filter(function (c) { return S.vendors.some(function (v) { return v.cat === c.id; }); }).map(function (c) { return '<button type="button" class="chip' + (ui.vendorCat === c.id ? ' on' : '') + '" data-act="vcat" data-v="' + c.id + '">' + esc(catName(c.id)) + '</button>'; }).join('') + '</div>';
    var vs = S.vendors.filter(function (v) { return ui.vendorCat === 'all' || v.cat === ui.vendorCat; });
    var cards = vs.map(function (v) {
      var tel = v.phone.replace(/[^\d+]/g, ''), wa = tel.replace(/^\+/, '').replace(/^00/, '').replace(/^0(\d{10})$/, '20$1');
      return '<article class="card vend"><div class="v-top"><div><h3>' + esc(v.name) + '</h3><span class="tag" style="--c:' + catColor(v.cat) + '">' + esc(catName(v.cat)) + '</span></div><span class="st st-' + v.status + '">' + esc(t('st_' + v.status)) + '</span></div>' +
        (v.price ? '<p class="price">' + esc(money(v.price)) + '</p>' : '') + (v.notes ? '<p class="muted">' + esc(v.notes) + '</p>' : '') +
        '<div class="v-act">' + (tel ? '<a class="btn small" href="tel:' + esc(tel) + '">' + esc(t('call')) + '</a><a class="btn small ghost" target="_blank" rel="noopener" href="https://wa.me/' + esc(wa) + '">' + esc(t('whatsapp')) + '</a>' : '') + '<button type="button" class="btn small ghost" data-act="edit-vendor" data-id="' + esc(v.id) + '">' + esc(t('edit')) + '</button></div></article>';
    }).join('');
    return '<div class="bar-head"><h2>' + esc(t('vendors')) + '</h2><button class="btn" type="button" data-act="add-vendor">+ ' + esc(t('addVendor')) + '</button></div>' + (S.vendors.length ? chips + '<div class="grid">' + cards + '</div>' : empty(t('noVendors')));
  }

  function vGuests() {
    var g = L.guestSummary(S), q = ui.q.trim().toLowerCase();
    var gs = S.guests.filter(function (x) { return (ui.rsvp === 'all' || x.rsvp === ui.rsvp) && (!q || (x.name + ' ' + x.group).toLowerCase().indexOf(q) >= 0); });
    var rows = gs.map(function (x) {
      return '<li><button type="button" class="row" data-act="edit-guest" data-id="' + esc(x.id) + '"><span class="r-main">' + esc(x.name) + '<small>' + esc(t('side_' + x.side)) + (x.group ? ' | ' + esc(x.group) : '') + '</small></span><span class="r-end"><b>' + esc(nf(x.count)) + '</b><small class="rs rs-' + x.rsvp + '">' + esc(t('rs_' + x.rsvp)) + '</small></span></button></li>';
    }).join('');
    return '<section class="card sum"><div class="sum-row"><div><small>' + esc(t('expected')) + '</small><b>' + esc(nf(g.expected)) + '</b></div><div><small>' + esc(t('confirmed')) + '</small><b>' + esc(nf(g.yes)) + '</b></div><div><small>' + esc(t('pending')) + '</small><b>' + esc(nf(g.pending)) + '</b></div><div><small>' + esc(t('declined')) + '</small><b>' + esc(nf(g.no)) + '</b></div></div>' +
      '<p class="note">' + esc(t('side_bride')) + ' ' + esc(nf(g.bride)) + ' | ' + esc(t('side_groom')) + ' ' + esc(nf(g.groom)) + ' | ' + esc(t('side_both')) + ' ' + esc(nf(g.both)) + '</p>' + (g.perHead ? '<p class="note">' + esc(t('perHead')) + ': <b>' + esc(money(g.perHead)) + '</b></p>' : '') + '</section>' +
      '<div class="bar-head"><h2>' + esc(t('guests')) + '</h2><button class="btn" type="button" data-act="add-guest">+ ' + esc(t('addGuest')) + '</button></div>' +
      '<div class="tools"><input type="search" id="gq" placeholder="' + esc(t('search')) + '" value="' + esc(ui.q) + '" aria-label="' + esc(t('search')) + '"><select id="grs" aria-label="' + esc(t('rsvp')) + '"><option value="all">' + esc(t('all')) + '</option>' + L.RSVPS.map(function (r) { return '<option value="' + r + '"' + (ui.rsvp === r ? ' selected' : '') + '>' + esc(t('rs_' + r)) + '</option>'; }).join('') + '</select></div>' +
      (S.guests.length ? '<ul class="rows card">' + (rows || '<li class="empty">-</li>') + '</ul><button type="button" class="link" data-act="csv">' + esc(t('exportCsv')) + '</button>' : empty(t('noGuests')));
  }

  function render() {
    chrome();
    var v = { home: vHome, budget: vBudget, tasks: vTasks, vendors: vVendors, guests: vGuests }[ui.view];
    var warn = storageOk ? '' : '<p class="warn">' + esc(t('warnStorage')) + '</p>';
    var focus = document.activeElement && document.activeElement.id;
    var pos = document.activeElement && document.activeElement.selectionStart;
    $('#app').innerHTML = warn + v();
    if (focus === 'gq') { var el = $('#gq'); el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) {} }
  }

  /* ---------- modal forms ---------- */
  function openModal(html) {
    var m = $('#modal'); m.hidden = false; m.innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' + html + '</div>';
    var f = m.querySelector('input,select,textarea,button'); if (f) f.focus();
  }
  function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }
  function field(f, val) {
    var id = 'f_' + f.k, lab = '<label for="' + id + '">' + esc(f.label) + '</label>';
    if (f.type === 'select') return lab + '<select id="' + id + '">' + f.opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(val) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
    if (f.type === 'textarea') return lab + '<textarea id="' + id + '" rows="3" maxlength="300">' + esc(val) + '</textarea>';
    return lab + '<input id="' + id + '" type="' + (f.type || 'text') + '"' + (f.type === 'number' ? ' min="0" inputmode="numeric"' : '') + (f.type === 'tel' ? ' inputmode="tel" dir="ltr"' : '') + ' value="' + esc(val) + '" autocomplete="off">';
  }
  function form(title, fields, vals, onSave, onDelete) {
    openModal('<form id="mf" novalidate><h2>' + esc(title) + '</h2>' + fields.map(function (f) { return '<div class="fld">' + field(f, vals[f.k]) + '</div>'; }).join('') + '<p class="err" id="ferr" role="alert"></p><div class="m-act"><button class="btn" type="submit">' + esc(t('save')) + '</button><button class="btn ghost" type="button" data-act="close">' + esc(t('cancel')) + '</button>' + (onDelete ? '<button class="btn danger" type="button" data-act="mdel">' + esc(t('del')) + '</button>' : '') + '</div></form>');
    var mf = $('#mf');
    mf.addEventListener('submit', function (e) {
      e.preventDefault();
      var out = {}; fields.forEach(function (f) { out[f.k] = $('#f_' + f.k).value; });
      var err = onSave(out);
      if (err) { $('#ferr').textContent = err; return; }
      save(); closeModal(); render(); toast(t('saved'));
    });
    if (onDelete) mf.querySelector('[data-act=mdel]').addEventListener('click', function () { onDelete(); save(); closeModal(); render(); toast(t('deleted')); });
  }
  function confirmBox(msg, label, fn) {
    openModal('<h2>' + esc(msg) + '</h2><div class="m-act"><button class="btn danger" type="button" id="cy">' + esc(label) + '</button><button class="btn ghost" type="button" data-act="close">' + esc(t('cancel')) + '</button></div>');
    $('#cy').addEventListener('click', function () { fn(); });
  }
  var catOpts = function () { return L.CATS.map(function (c) { return [c.id, catName(c.id)]; }); };
  var byId = function (arr, id) { return arr.filter(function (x) { return x.id === id; })[0]; };

  function editExpense(id) {
    var e = id ? byId(S.expenses, id) : { cat: 'venue', name: '', planned: '', paid: '' };
    form(t(id ? 'edit' : 'addExpense'), [
      { k: 'name', label: t('name') }, { k: 'cat', label: t('category'), type: 'select', opts: catOpts() },
      { k: 'planned', label: t('plannedAmt'), type: 'number' }, { k: 'paid', label: t('paidAmt'), type: 'number' }
    ], e, function (v) {
      var o = { name: L.str(v.name.trim(), 80), cat: v.cat, planned: L.num(v.planned, 1e10), paid: L.num(v.paid, 1e10) };
      if (!o.name) return t('required');
      if (id) Object.assign(e, o); else { o.id = L.uid(); S.expenses.push(o); }
    }, id ? function () { S.expenses = S.expenses.filter(function (x) { return x.id !== id; }); } : null);
  }
  function editTask(id) {
    var tk = id ? byId(S.tasks, id) : { title: '', days: 30 };
    var fs = tk.key ? [] : [{ k: 'title', label: t('taskTitle') }];
    fs.push({ k: 'days', label: t('daysBefore'), type: 'number' });
    var vals = { title: tk.title, days: tk.days };
    form(t(id ? 'edit' : 'addTask'), fs, vals, function (v) {
      if (!tk.key && !v.title.trim()) return t('required');
      var days = Math.min(3650, Math.round(L.num(v.days)));
      if (tk.key) { tk.days = days; return; }
      var o = { title: L.str(v.title.trim(), 120), days: days };
      if (id) Object.assign(tk, o); else S.tasks.push({ id: L.uid(), key: '', done: false, title: o.title, days: o.days });
    }, id ? function () { S.tasks = S.tasks.filter(function (x) { return x.id !== id; }); } : null);
  }
  function editVendor(id) {
    var v0 = id ? byId(S.vendors, id) : { cat: 'venue', name: '', phone: '', price: '', status: 'idea', notes: '' };
    form(t(id ? 'edit' : 'addVendor'), [
      { k: 'name', label: t('name') }, { k: 'cat', label: t('category'), type: 'select', opts: catOpts() },
      { k: 'phone', label: t('phone'), type: 'tel' }, { k: 'price', label: t('price'), type: 'number' },
      { k: 'status', label: t('status'), type: 'select', opts: L.STATUSES.map(function (s) { return [s, t('st_' + s)]; }) },
      { k: 'notes', label: t('notes'), type: 'textarea' }
    ], v0, function (v) {
      var o = { name: L.str(v.name.trim(), 80), cat: v.cat, phone: L.str(v.phone, 30).replace(/[^\d+\s-]/g, ''), price: L.num(v.price, 1e10), status: v.status, notes: L.str(v.notes, 300) };
      if (!o.name) return t('required');
      if (id) Object.assign(v0, o); else { o.id = L.uid(); S.vendors.push(o); }
    }, id ? function () { S.vendors = S.vendors.filter(function (x) { return x.id !== id; }); } : null);
  }
  function editGuest(id) {
    var g0 = id ? byId(S.guests, id) : { name: '', side: 'both', group: '', count: 1, rsvp: 'pending', phone: '' };
    form(t(id ? 'edit' : 'addGuest'), [
      { k: 'name', label: t('name') }, { k: 'side', label: t('side'), type: 'select', opts: L.SIDES.map(function (s) { return [s, t('side_' + s)]; }) },
      { k: 'group', label: t('group') }, { k: 'count', label: t('people'), type: 'number' },
      { k: 'rsvp', label: t('rsvp'), type: 'select', opts: L.RSVPS.map(function (s) { return [s, t('rs_' + s)]; }) },
      { k: 'phone', label: t('phone'), type: 'tel' }
    ], g0, function (v) {
      var o = { name: L.str(v.name.trim(), 80), side: v.side, group: L.str(v.group.trim(), 40), count: Math.max(1, Math.min(50, Math.round(L.num(v.count)) || 1)), rsvp: v.rsvp, phone: L.str(v.phone, 30).replace(/[^\d+\s-]/g, '') };
      if (!o.name) return t('required');
      if (id) Object.assign(g0, o); else { o.id = L.uid(); S.guests.push(o); }
    }, id ? function () { S.guests = S.guests.filter(function (x) { return x.id !== id; }); } : null);
  }
  function settings() {
    var vals = { a: S.couple.a, b: S.couple.b, date: S.date, budget: S.budget || '' };
    openModal('<form id="mf" novalidate><h2>' + esc(t('settings')) + '</h2>' +
      '<div class="fld">' + field({ k: 'a', label: t('brideName') }, vals.a) + '</div><div class="fld">' + field({ k: 'b', label: t('groomName') }, vals.b) + '</div>' +
      '<div class="fld">' + field({ k: 'date', label: t('weddingDate'), type: 'date' }, vals.date) + '</div><div class="fld">' + field({ k: 'budget', label: t('totalBudget'), type: 'number' }, vals.budget) + '</div>' +
      '<div class="m-act"><button class="btn" type="submit">' + esc(t('save')) + '</button><button class="btn ghost" type="button" data-act="close">' + esc(t('close')) + '</button></div>' +
      '<h3 class="sub">' + esc(t('backup')) + '</h3><p class="muted">' + esc(t('privacy')) + '</p>' +
      '<div class="m-act wrap"><button type="button" class="btn ghost" data-act="export">' + esc(t('exportJson')) + '</button><label class="btn ghost file">' + esc(t('importJson')) + '<input type="file" id="imp" accept="application/json,.json" hidden></label><button type="button" class="btn ghost" data-act="print">' + esc(t('print')) + '</button><button type="button" class="btn ghost" data-act="sample">' + esc(t('loadSample')) + '</button><button type="button" class="btn danger" data-act="reset">' + esc(t('reset')) + '</button></div></form>');
    $('#mf').addEventListener('submit', function (e) {
      e.preventDefault();
      S.couple = { a: L.str($('#f_a').value.trim(), 40), b: L.str($('#f_b').value.trim(), 40) };
      var d = $('#f_date').value; S.date = L.isoDate(d) ? d : '';
      S.budget = L.num($('#f_budget').value, 1e10);
      save(); closeModal(); render(); toast(t('saved'));
    });
    $('#imp').addEventListener('change', function (e) {
      var file = e.target.files[0]; if (!file) return;
      if (file.size > 2e6) { toast(t('importBad')); return; }
      var r = new FileReader();
      r.onload = function () {
        try { var lang = S.lang; S = L.sanitize(JSON.parse(r.result)); save(); closeModal(); render(); toast(t('importOk')); }
        catch (err) { toast(t('importBad')); }
      };
      r.readAsText(file);
    });
  }
  function download(name, mime, text) {
    var a = document.createElement('a'), u = URL.createObjectURL(new Blob([text], { type: mime }));
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 1000);
  }
  function welcome() {
    openModal('<div class="welcome"><img src="logo.svg" alt="" width="64" height="64"><h2>' + esc(I.ar.welcomeT) + ' | ' + esc(I.en.welcomeT) + '</h2><p>' + esc(t('welcomeP')) + '</p><div class="m-act wrap"><button class="btn" type="button" data-act="w-empty">' + esc(t('startEmpty')) + '</button><button class="btn ghost" type="button" data-act="w-sample">' + esc(t('trySample')) + '</button></div></div>');
  }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var tab = e.target.closest('[data-tab]');
    if (tab) { ui.view = tab.dataset.tab; render(); window.scrollTo(0, 0); return; }
    var a = e.target.closest('[data-act]'); if (!a) { if (e.target.id === 'modal') closeModal(); return; }
    var id = a.dataset.id;
    switch (a.dataset.act) {
      case 'close': closeModal(); break;
      case 'settings': settings(); break;
      case 'add-expense': editExpense(); break; case 'edit-expense': editExpense(id); break;
      case 'add-task': editTask(); break; case 'edit-task': editTask(id); break;
      case 'add-vendor': editVendor(); break; case 'edit-vendor': editVendor(id); break;
      case 'add-guest': editGuest(); break; case 'edit-guest': editGuest(id); break;
      case 'vcat': ui.vendorCat = a.dataset.v; render(); break;
      case 'toggle-done': ui.showDone = !ui.showDone; render(); break;
      case 'csv': download('farah-guests.csv', 'text/csv;charset=utf-8', L.guestsCSV(S)); break;
      case 'export': download('farah-backup.json', 'application/json', JSON.stringify(S, null, 2)); break;
      case 'print': closeModal(); window.print(); break;
      case 'sample': confirmBox(t('sampleAsk'), t('loadSample'), function () { var l = S.lang; S = L.sampleState(todayISO()); S.lang = l; save(); closeModal(); render(); }); break;
      case 'reset': confirmBox(t('resetAsk'), t('reset'), function () { var l = S.lang; S = L.emptyState(); S.lang = l; save(); closeModal(); ui.view = 'home'; render(); }); break;
      case 'w-empty': save(); closeModal(); break;
      case 'w-sample': S = L.sampleState(todayISO()); S.lang = 'ar'; save(); closeModal(); render(); break;
    }
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.act === 'toggle-task') { var tk = byId(S.tasks, el.dataset.id); if (tk) { tk.done = el.checked; save(); render(); } }
    if (el.id === 'grs') { ui.rsvp = el.value; render(); }
  });
  document.addEventListener('input', function (e) { if (e.target.id === 'gq') { ui.q = e.target.value; render(); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });
  $('#langBtn').addEventListener('click', function () { S.lang = S.lang === 'ar' ? 'en' : 'ar'; save(); render(); });
  $('#setBtn').addEventListener('click', settings);

  var ld = load(); S = ld.s; render();
  if (ld.fresh) welcome();
})();
