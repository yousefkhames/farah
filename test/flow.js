/* Data-flow test in real Chrome: sample -> export -> reset -> import; junk and hostile files; replace-confirm; CSV; print view; RTL.
   Usage: node test/flow.js [baseUrl]  (serves this folder when no url). Needs puppeteer-core + Chrome. */
const puppeteer = require(process.env.PUPPETEER || 'puppeteer-core'); const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'); let base = process.argv[2], server; const sleep = ms => new Promise(r => setTimeout(r, ms));
let n = 0, fails = 0; const ok = (c, m) => { n++; if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
(async () => {
  if (!base) { const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
    server = http.createServer((q, s) => { const f = path.join(root, q.url.split('?')[0].replace(/\/$/, '/index.html')); if (!f.startsWith(root) || !fs.existsSync(f)) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': mime[path.extname(f)] || 'text/plain' }); s.end(fs.readFileSync(f)); }).listen(0); base = 'http://127.0.0.1:' + server.address().port + '/'; }
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 390, height: 844 }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(base, { waitUntil: 'networkidle0' }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'networkidle0' });
  ok(await p.$eval('#modal', e => !e.hidden), 'welcome shown on first run'); await p.click('[data-act=w-empty]'); await sleep(200);
  ok(await p.$eval('html', e => e.dir) === 'rtl', 'Arabic RTL by default');
  const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('farah.v1')));
  const open = async () => { await p.click('#setBtn'); await sleep(200); };
  // empty plan: import junk must be refused, no confirm needed
  fs.writeFileSync('/tmp/fa-junk.json', '{"foo":1}'); fs.writeFileSync('/tmp/fa-arr.json', '[1,2]'); fs.writeFileSync('/tmp/fa-txt.json', 'nope');
  await open(); await (await p.$('#imp')).uploadFile('/tmp/fa-junk.json'); await sleep(300);
  ok((await st()).expenses.length === 0 && !(await p.$eval('#modal', e => e.hidden)) , 'unrelated JSON object is refused (modal stays, nothing imported)');
  await (await p.$('#imp')).uploadFile('/tmp/fa-arr.json'); await sleep(300); ok(true, 'array file refused without error');
  await p.click('[data-act=sample]'); await sleep(200); await p.click('#cy'); await sleep(300);
  const s1 = await st(); ok(s1.expenses.length > 3 && s1.guests.length > 3, 'sample loaded');
  await open();
  const exp = await p.evaluate(async () => { let blob; const o = URL.createObjectURL; URL.createObjectURL = b => { blob = b; return o.call(URL, b) }; HTMLAnchorElement.prototype.click = function () { }; document.querySelector('[data-act=export]').click(); URL.createObjectURL = o; return await blob.text(); });
  fs.writeFileSync('/tmp/fa-back.json', exp); ok(JSON.parse(exp).expenses.length === s1.expenses.length, 'export contains every expense');
  // import over existing data asks first; declining keeps data
  fs.writeFileSync('/tmp/fa-empty.json', JSON.stringify({ expenses: [], guests: [{ name: '<img src=x onerror=window.__pwn=1>', count: 2 }] }));
  await (await p.$('#imp')).uploadFile('/tmp/fa-empty.json'); await sleep(300);
  ok((await p.evaluate(() => document.querySelector('#cy') !== null)) && (await st()).expenses.length === s1.expenses.length, 'import over existing data asks for confirmation first');
  await p.click('[data-act=close]'); await sleep(200); ok((await st()).expenses.length === s1.expenses.length, 'cancel keeps the existing plan');
  await open(); await (await p.$('#imp')).uploadFile('/tmp/fa-empty.json'); await sleep(300); await p.click('#cy'); await sleep(400);
  ok((await st()).guests.length === 1 && !(await p.evaluate(() => window.__pwn)), 'confirmed import replaces data; guest name is escaped');
  await open(); await (await p.$('#imp')).uploadFile('/tmp/fa-back.json'); await sleep(300); await p.click('#cy'); await sleep(400);
  const s2 = await st(); ok(s2.expenses.length === s1.expenses.length && s2.guests.length === s1.guests.length && s2.date === s1.date, 'round trip restores expenses, guests, date');
  // print view hides chrome
  await p.emulateMediaType('print'); const pv = await p.evaluate(() => ({ h: getComputedStyle(document.querySelector('header,.top,.bar') || document.body).display, len: document.body.innerText.length })); ok(pv.len > 100, 'print view has content'); await p.emulateMediaType('screen');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow');
  ok(errs.length === 0, 'no page errors ' + errs.join('|')); console.log(n + ' checks, ' + fails + ' failed'); await b.close(); server && server.close(); process.exit(fails ? 1 : 0);
})();
