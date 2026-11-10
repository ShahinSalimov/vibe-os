const { chromium } = require('playwright');
const SHOTS = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'az-AZ' });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  p.on('dialog', d => d.accept());
  const click = t => p.getByText(t, { exact: true }).first().click();
  const fill = async (label, val) => p.getByText(label, { exact: true }).locator('xpath=..').locator('input').first().fill(val);

  // ---- A. Phase 1 data (store v1) must survive the upgrade ----
  await p.goto('http://localhost:8099/');
  await p.evaluate(() => localStorage.setItem('vibe-os-store', JSON.stringify({ version: 1, state: {
    profile: { stageName: 'Aysel', role: 'singer', genre: 'Pop', createdAt: '2026-11-01T00:00:00Z' },
    settings: { language: 'az', currency: 'AZN', appLock: false },
    events: [{ id: 'old-event-1', title: 'Köhnə konsert', type: 'concert', date: '2026-12-20', time: '20:00', venue: 'Heydər Əliyev Sarayı', city: 'Bakı', organizer: 'Rauf', organizerPhone: '', fee: 4000, advance: 2000, currency: 'AZN', notes: '', createdAt: '2026-11-01T00:00:00Z' }],
    records: [] } })));
  await p.reload(); await p.waitForTimeout(2000);
  const body1 = await p.locator('body').innerText();
  console.log('A. migrated v1 event visible:', body1.includes('Köhnə konsert'));
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('vibe-os-store')));
  console.log('A. store version now:', stored.version, '| updatedAt filled:', !!stored.state.events[0].updatedAt, '| bookings array:', Array.isArray(stored.state.bookings));

  // ---- B. Bookings tab: empty state + link card (no cloud in this build) ----
  await click('Sifarişlər'); await p.waitForTimeout(600);
  await p.screenshot({ path: `${SHOTS}/p2-1-bookings-empty.png` });
  console.log('B. link card says not connected:', (await p.locator('body').innerText()).includes('hələ qoşulmayıb'));

  // ---- C. Add manual booking (from a phone call) ----
  await p.getByLabel('Yeni sorğu').first().click(); await p.waitForTimeout(600);
  await fill('Təşkilatçının adı', 'Elvin Quliyev');
  await fill('Telefon', '4111 1111 1111 1111');  // card in phone field -> must be rejected
  await click('Yadda saxla'); await p.waitForTimeout(300);
  console.log('C. card-as-phone rejected:', (await p.locator('body').innerText()).includes('Telefon nömrəsini yoxlayın'));
  await fill('Telefon', '050 123 45 67');
  await click('Korporativ');
  await fill('Şəhər', 'Bakı');
  await fill('Qonaq sayı', '250');
  await fill('Büdcə (₼)', '5000');
  await p.locator('textarea').fill('Yeni il korporativi, 2 saatlıq proqram');
  await p.screenshot({ path: `${SHOTS}/p2-2-booking-form.png` });
  await click('Yadda saxla'); await p.waitForTimeout(800);
  await p.screenshot({ path: `${SHOTS}/p2-3-booking-detail.png` });
  const det = await p.locator('body').innerText();
  console.log('C. detail shows call/whatsapp:', det.includes('Zəng et') && det.includes('WhatsApp'));
  const wa = await p.getByLabel('WhatsApp').getAttribute('href').catch(() => null);

  // ---- D. Confirm -> event + income + contact ----
  await click('Təsdiqlə və tədbir yarat'); await p.waitForTimeout(900);
  await p.screenshot({ path: `${SHOTS}/p2-4-event-from-booking.png` });
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('vibe-os-store')).state);
  const bk = st.bookings[0]; const ev = st.events.find(e => e.id === bk.eventId); const inc = st.records.find(r => r.eventId === bk.eventId);
  console.log('D. booking status:', bk.status, '| event:', ev && ev.title, ev && ev.fee, '| income:', inc && inc.amount, inc && inc.status, '| contact:', st.contacts.map(c => c.name + ' ' + c.phone).join(','));
  await p.goBack?.(); 
  await p.goto('http://localhost:8099/'); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${SHOTS}/p2-5-home.png` });

  // ---- E. A second booking stays "new" -> badge + briefing ----
  await click('Sifarişlər'); await p.waitForTimeout(500);
  await p.getByLabel('Yeni sorğu').first().click(); await p.waitForTimeout(500);
  await fill('Təşkilatçının adı', 'Nigar');
  await fill('E-poçt', 'nigar@example.az');
  await click('Yadda saxla'); await p.waitForTimeout(600);
  await p.goto('http://localhost:8099/'); await p.waitForTimeout(1500);
  const home = await p.locator('body').innerText();
  console.log('E. home briefing new booking:', home.includes('1 yeni sifariş sorğusu'));
  await click('Sifarişlər'); await p.waitForTimeout(500);
  await p.screenshot({ path: `${SHOTS}/p2-6-bookings-list.png` });

  // ---- F. More -> Contacts, Account ----
  await click('Digər'); await p.waitForTimeout(500);
  await p.screenshot({ path: `${SHOTS}/p2-7-more.png` });
  await click('Kontaktlar'); await p.waitForTimeout(500);
  await p.screenshot({ path: `${SHOTS}/p2-8-contacts.png` });
  console.log('F. contacts shows Elvin:', (await p.locator('body').innerText()).includes('Elvin Quliyev'));
  await p.goto('http://localhost:8099/'); await p.waitForTimeout(1200);
  await click('Digər'); await p.waitForTimeout(400);
  await click('Hesab və bulud'); await p.waitForTimeout(500);
  console.log('F. account not-configured message:', (await p.locator('body').innerText()).includes('Bulud yedəkləməsi bu versiyada'));

  // ---- G. Russian ----
  await p.goto('http://localhost:8099/'); await p.waitForTimeout(1200);
  await click('Digər'); await click('Русский'); await click('Заказы'); await p.waitForTimeout(500);
  await p.screenshot({ path: `${SHOTS}/p2-9-bookings-ru.png` });
  console.log('ERRORS:', JSON.stringify(errors, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
