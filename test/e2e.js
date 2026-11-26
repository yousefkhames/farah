// Real-browser click-through. Usage: node test/e2e.js [baseUrl] [--shots dir]
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
let base = args.find(a => a.startsWith('http'));
const shotsDir = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
let server;
async function main() {
  if (!base) {
    server = http.createServer((q, s) => {
      let f = path.join(root, q.url.split('?')[0].replace(/\/$/, '/index.html'));
      if (!f.startsWith(root) || !fs.existsSync(f)) { s.writeHead(404); return s.end('nf'); }
      s.writeHead(200, { 'content-type': mime[path.extname(f)] || 'text/plain' }); s.end(fs.readFileSync(f));
    }).listen(0); base = 'http://127.0.0.1:' + server.address().port + '/';
  }
  const port = 9300 + Math.floor(Math.random() * 500);
  const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=' + port, '--user-data-dir=/tmp/cr-' + port, 'about:blank'], { stdio: 'ignore' });
  let ws, list;
  for (let i = 0; i < 50; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (list.find(t => t.type === 'page')) break; } catch (e) {} await sleep(200); }
  ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {}; const errors = [];
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.text + ' ' + (d.params.exceptionDetails.exception || {}).description);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('console.error ' + JSON.stringify(d.params.args.map(a => a.value)));
  };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails.exception)); return r.result.result.value; };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  const go = async (u) => { await send('Page.navigate', { url: u }); await sleep(700); };
  const rect = async (sel) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height}})()`);
  const click = async (sel) => {
    const r = await rect(sel); if (!r || !r.w) throw new Error('not clickable: ' + sel); await sleep(60);
    const r2 = await rect(sel);
    for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: r2.x, y: r2.y, button: 'left', clickCount: 1 });
    await sleep(120);
  };
  const type = async (sel, text) => { await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});e.focus();e.select&&e.select()})()`); await send('Input.insertText', { text }); await sleep(60); };
  const setSel = async (sel, v) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  const text = async () => ev('document.body.innerText');
  const shot = async (name) => { if (!shotsDir) return; fs.mkdirSync(shotsDir, { recursive: true }); const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(shotsDir, name + '.png'), Buffer.from(r.result.data, 'base64')); };
  let n = 0; const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); n++; console.log('ok -', m); };
  const tab = async k => click(`[data-tab=${k}]`);

  try {
    await go(base); await ev('localStorage.clear()'); await go(base);
    ok(await ev("!document.querySelector('#modal').hidden"), 'welcome sheet shows on first visit');
    ok(await ev("document.documentElement.dir") === 'rtl', 'default language is Arabic RTL');
    await click('[data-act=w-empty]');
    ok(await ev("document.querySelector('#modal').hidden"), 'start empty closes welcome');
    ok((await text()).includes('حددوا ميعاد الفرح'), 'home asks for a wedding date');

    // settings
    await click('#setBtn');
    await type('#f_a', 'Layla'); await type('#f_b', 'Omar');
    const fut = await ev("(()=>{const d=new Date();d.setDate(d.getDate()+100);return d.toISOString().slice(0,10)})()");
    await ev(`document.querySelector('#f_date').value='${fut}'`);
    await type('#f_budget', '300000');
    await click('#mf button[type=submit]');
    ok(/١٠٠|100/.test(await ev("document.querySelector('.hero-big').textContent")), 'countdown shows 100 days');
    ok((await text()).includes('Layla'), 'couple names show on home');

    // budget
    await tab('budget'); await click('[data-act=add-expense]');
    await click('#mf button[type=submit]');
    ok((await ev("document.querySelector('#ferr').textContent")).length > 0, 'expense form rejects empty name');
    await type('#f_name', 'Hall deposit'); await setSel('#f_cat', 'venue'); await type('#f_planned', '120000'); await type('#f_paid', '50000');
    await click('#mf button[type=submit]');
    let tx = await text();
    ok(await ev("document.querySelectorAll('.cat .row').length") === 1, 'one expense row exists');
    ok(/١٢٠[,٬]٠٠٠|120,000/.test(tx), 'planned total formatted');
    await click('.cat .row'); await type('#f_planned', '400000'); await click('#mf button[type=submit]');
    ok((await text()).includes('فوق الميزانية'), 'over budget warning appears when plan exceeds total');
    await click('.cat .row'); await click('[data-act=mdel]');
    ok(await ev("document.querySelectorAll('.cat .row').length") === 0, 'expense deleted');

    // tasks
    await tab('tasks');
    const total = await ev("document.querySelectorAll('.task').length");
    ok(total === 19, 'default checklist has 19 tasks');
    await click('.task label'); ok(await ev("document.querySelectorAll('.task').length") === 18 && await ev("document.querySelectorAll('.task.done').length") === 0, 'done tasks move into the collapsed list');
    ok((await text()).match(/\(١\)|\(1\)/) !== null, 'completed count shown');
    await click('[data-act=toggle-done]'); ok(await ev("document.querySelectorAll('.task.done').length") === 1, 'completed list expands');
    await click('[data-act=add-task]'); await type('#f_title', 'Book the zaffa drummer'); await type('#f_days', '20'); await click('#mf button[type=submit]');
    ok((await text()).includes('Book the zaffa drummer'), 'custom task added');
    ok(await ev("document.querySelectorAll('.task.late').length") >= 1, 'tasks past due are flagged overdue');

    // vendors
    await tab('vendors'); await click('[data-act=add-vendor]');
    await type('#f_name', 'Nile Palace Hall'); await setSel('#f_cat', 'venue'); await type('#f_phone', '01012345678'); await type('#f_price', '90000'); await setSel('#f_status', 'booked'); await type('#f_notes', 'Deposit paid');
    await click('#mf button[type=submit]');
    ok(await ev("document.querySelector('a[href^=\"tel:\"]').getAttribute('href')") === 'tel:01012345678', 'call link uses the phone number');
    ok((await ev("document.querySelector('a[href*=\"wa.me\"]').getAttribute('href')")) === 'https://wa.me/201012345678', 'WhatsApp link converts local number to +20');
    await click('[data-act=add-vendor]'); await type('#f_name', 'Lens Studio'); await setSel('#f_cat', 'photo'); await click('#mf button[type=submit]');
    ok(await ev("document.querySelectorAll('.vend').length") === 2, 'two vendors');
    await click('[data-act=vcat][data-v=photo]'); ok(await ev("document.querySelectorAll('.vend').length") === 1, 'category filter works');

    // guests
    await tab('guests'); await click('[data-act=add-guest]');
    await type('#f_name', 'Hassan family'); await setSel('#f_side', 'bride'); await type('#f_group', 'Family'); await type('#f_count', '5'); await setSel('#f_rsvp', 'yes');
    await click('#mf button[type=submit]');
    await click('[data-act=add-guest]'); await type('#f_name', 'Office friends'); await type('#f_count', '12'); await click('#mf button[type=submit]');
    await click('[data-act=add-guest]'); await type('#f_name', 'Cousins abroad'); await type('#f_count', '3'); await setSel('#f_rsvp', 'no'); await click('#mf button[type=submit]');
    ok(await ev("document.querySelectorAll('.rows .row').length") === 3, 'three guest entries');
    ok(/١٧|17/.test(await ev("document.querySelector('.sum-row b').textContent")), 'expected guests = 17 (declined excluded)');
    await type('#gq', 'office'); ok(await ev("document.querySelectorAll('.rows .row').length") === 1, 'search narrows the list');
    ok(await ev("document.activeElement.id") === 'gq', 'search keeps focus while typing');
    await type('#gq', ''); await setSel('#grs', 'no'); ok(await ev("document.querySelectorAll('.rows .row').length") === 1, 'RSVP filter works');
    await setSel('#grs', 'all');

    // XSS
    await click('[data-act=add-guest]'); await type('#f_name', '<img src=x onerror="window.__pwn=1">'); await click('#mf button[type=submit]');
    await sleep(300);
    ok(await ev('window.__pwn') === undefined, 'HTML in names is escaped, no script ran');
    ok((await text()).includes('<img src=x'), 'the raw text is shown as text');

    // language + persistence
    await click('#langBtn'); ok(await ev("document.documentElement.dir") === 'ltr' && (await text()).includes('Guests'), 'switch to English flips direction');
    await go(base);
    ok(await ev("document.querySelector('#modal').hidden"), 'no welcome on return visit');
    ok(await ev("document.documentElement.lang") === 'en', 'language persists after reload');
    await tab('guests'); ok(await ev("document.querySelectorAll('.rows .row').length") === 4, 'guests persist after reload');
    ok(await ev("JSON.parse(localStorage.getItem('farah.v1')).vendors.length") === 2, 'vendors persist in localStorage');

    // corrupt storage is survived
    await ev("localStorage.setItem('farah.v1','{not json')"); await go(base);
    ok(await ev("!document.querySelector('#modal').hidden"), 'corrupt storage falls back to a fresh start');

    // sample + reset
    await click('[data-act=w-sample]');
    ok((await text()).includes('Layla'), 'sample data loads');
    // keyboard: Escape closes a sheet
    await tab('budget'); await click('[data-act=add-expense]');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    ok(await ev("document.querySelector('#modal').hidden"), 'Escape closes the form sheet');

    await click('#setBtn'); await click('[data-act=reset]'); await click('#cy');
    ok((await ev("JSON.parse(localStorage.getItem('farah.v1')).guests.length")) === 0, 'reset erases data');
    await click('#setBtn'); await click('[data-act=sample]'); await click('#cy');
    ok(await ev("JSON.parse(localStorage.getItem('farah.v1')).guests.length") === 7, 'sample can be loaded from settings');
    await ev("document.querySelector('#modal').hidden=true");
    ok(await ev("document.documentElement.scrollWidth <= window.innerWidth + 1"), 'no horizontal overflow on mobile');

    if (shotsDir) {
      const S = async (name, view, lang) => { if (lang && (await ev('document.documentElement.lang')) !== lang) await click('#langBtn'); await tab(view); await ev('window.scrollTo(0,0)'); await sleep(250); await shot(name); };
      await S('home-en', 'home', 'en'); await S('budget-en', 'budget'); await S('checklist-en', 'tasks'); await S('vendors-en', 'vendors'); await S('guests-en', 'guests');
      await S('home-ar', 'home', 'ar'); await S('budget-ar', 'budget');
      await click('#langBtn'); await tab('home'); await click('[data-act=toggle-done]').catch(() => {});
      await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 800, deviceScaleFactor: 1, mobile: false }); await sleep(300); await shot('home-desktop-en');
    }
    ok(errors.length === 0, 'no console errors or exceptions' + (errors.length ? ': ' + errors.join(' | ') : ''));
    console.log(n + ' e2e checks passed');
  } catch (e) { console.error(e.message, errors); process.exitCode = 1; }
  ws.close(); chrome.kill(); if (server) server.close();
}
main();
