const { chromium } = require('playwright');
const SHOTS = process.argv[2];
const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const ts = '2026-11-01T00:00:00Z';
const ev = (id, title, type, date, time, venue, fee, advance) => ({ id, title, type, date, time, venue, city: 'Bakı', organizer: 'Rauf', organizerPhone: '', fee, advance, currency: 'AZN', notes: '', createdAt: ts, updatedAt: ts });
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto('http://localhost:8099/');
  await p.evaluate((x) => localStorage.setItem('vibe-os-store', JSON.stringify(x)), { version: 6, state: {
    profile: { stageName: 'Aysel', role: 'singer', genre: 'Pop', createdAt: ts },
    settings: { language: 'az', currency: 'AZN', appLock: false, theme: 'stage' },
    events: [
      ev('e-wed-0001', 'Toy · Fairmont', 'wedding', d(0), '19:30', 'Fairmont', 3000, 1000),
      ev('e-reh-0001', 'Məşq', 'rehearsal', d(0), '12:00', 'Studiya', 0, 0),
      ev('e-tmr-0001', 'Korporativ · SOCAR', 'corporate', d(1), '20:00', 'Hilton', 5000, 5000),
      ev('e-wk-00001', 'Konsert', 'concert', d(4), '21:00', 'Saray', 0, 0),
    ],
    records: [
      { id: 'r-late-001', kind: 'income', counterparty: 'Elvin', amount: 2000, paidAmount: 500, currency: 'AZN', date: d(-3), status: 'partial', category: '', note: '', createdAt: ts, updatedAt: ts },
    ],
    tasks: [
      { id: 't-today-01', title: 'Səs operatoruna zəng', note: '', assigneeId: '', due: d(0), done: false, createdAt: ts, updatedAt: ts },
      { id: 't-late-001', title: 'Rider-i göndər', note: '', assigneeId: '', due: d(-2), done: false, createdAt: ts, updatedAt: ts },
      { id: 't-later-01', title: 'Klip ssenarisi', note: '', assigneeId: '', due: d(10), done: false, createdAt: ts, updatedAt: ts },
    ],
    contracts: [{ id: 'c-today-01', title: 'SOCAR korporativ', template: 'corporate', language: 'az', counterparty: 'SOCAR', amount: 5000, currency: 'AZN', status: 'sent', deadline: d(0), body: 'x', createdAt: ts, updatedAt: ts }],
    bookings: [{ id: 'b-new-0001', source: 'link', organizerName: 'Nigar', phone: '', email: 'n@x.az', eventType: 'wedding', date: d(30), city: '', venue: '', guests: null, budget: null, currency: 'AZN', message: '', language: 'az', status: 'new', createdAt: ts, updatedAt: ts }],
    docs: [{ id: 'doc-pass-1', kind: 'passport', title: 'Pasport', country: 'AZ', expiry: d(20), note: '', createdAt: ts, updatedAt: ts }],
    contacts: [], tombstones: [], songs: [], assets: [], setlists: [], riders: [], reminders: false, members: [],
    cloud: { email: null, userId: null, workspaceId: null, slug: null, role: null, lastPushAt: null, pullCursors: {}, lastSyncAt: null, license: null } } });
  await p.reload(); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${SHOTS}/a1-agenda.png`, fullPage: false });
  const body = await p.locator('body').innerText();
  const order = ['12:00', 'Məşq', '19:30', 'Toy · Fairmont', 'Rider-i göndər', 'Ödəniş: Elvin', 'Səs operatoruna zəng', 'İmzala: SOCAR korporativ', 'Pasport'];
  const idx = order.map((x) => body.indexOf(x));
  console.log('all rows present:', idx.every((i) => i >= 0), '| missing:', order.filter((x, i) => idx[i] < 0));
  console.log('events in time order:', idx[0] < idx[2], '| events before late items:', idx[3] < idx[4] && idx[3] < idx[5]);
  console.log('balance shown:', body.includes('Qalıq: 2\u00a0000'), '| payment left:', body.includes('1\u00a0500') && body.includes('gecikib'));
  console.log('new booking line:', body.includes('1 yeni sifariş sorğusu'), '| passport:', body.includes('20 gün sonra bitir'));
  console.log('tomorrow:', body.includes('Sabah: 20:00 Korporativ · SOCAR'), '| week:', body.includes('Növbəti 7 gündə 1 tədbir'), '| later tasks:', body.includes('Sizə 1 tapşırıq'));
  const upcomingSection = body.slice(body.indexOf('QARŞIDAKI'));
  console.log('upcoming list starts tomorrow (no today dup):', !upcomingSection.includes('Toy · Fairmont'));
  // tick the overdue task right in the card
  await p.getByRole('checkbox').first().click(); await p.waitForTimeout(400);
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('vibe-os-store')).state.tasks);
  console.log('ticked from Home:', st.filter((t) => t.done).map((t) => t.title).join(','));
  // tap an event row -> opens it
  await p.getByText('Toy · Fairmont', { exact: true }).first().click(); await p.waitForTimeout(500);
  console.log('event opens:', (await p.locator('body').innerText()).includes('Tədbiri redaktə et'));
  console.log('ERRORS:', JSON.stringify(errors));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
