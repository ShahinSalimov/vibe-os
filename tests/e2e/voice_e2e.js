const { chromium } = require('playwright');
const SHOTS = process.argv[2];
const MOCK = `
  window.__VOICE = ''; window.__LANGS = [];
  if (!window.__NO_SPEECH) window.webkitSpeechRecognition = class extends EventTarget {
    start() { window.__LANGS.push(this.lang); setTimeout(() => {
      this.dispatchEvent(new Event('start'));
      const ev = new Event('result'); ev.resultIndex = 0;
      const res = [{ transcript: window.__VOICE, confidence: 0.92 }]; res.isFinal = true; ev.results = [res];
      this.dispatchEvent(ev); this.dispatchEvent(new Event('end'));
    }, 400); }
    stop() {} abort() {}
  };`;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(MOCK);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const val = async label => p.getByText(label, { exact: true }).locator('xpath=..').locator('input,textarea').first().inputValue();
  await p.goto('http://localhost:8099/');
  await p.evaluate(() => localStorage.setItem('vibe-os-store', JSON.stringify({ version: 2, state: {
    profile: { stageName: 'Aysel', role: 'singer', genre: 'Pop', createdAt: '2026-11-01T00:00:00Z' },
    settings: { language: 'az', currency: 'AZN', appLock: false }, events: [], records: [], bookings: [], contacts: [], tombstones: [],
    cloud: { email: null, workspaceId: null, slug: null, lastPushAt: null, pullCursors: {}, lastSyncAt: null } } })));
  await p.reload(); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${SHOTS}/v1-home.png` });

  // 1. AZ sentence -> event form
  await p.evaluate(() => (window.__VOICE = '15 dekabr Bakıda toy, 3000 manat, avans 1000, təşkilatçı Rauf'));
  await p.getByLabel('Səslə əlavə et').click(); await p.waitForTimeout(200);
  await p.screenshot({ path: `${SHOTS}/v2-listening.png` });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${SHOTS}/v3-event-prefilled.png` });
  console.log('1. title:', await val('Ad'), '| city:', await val('Şəhər'), '| organizer:', await val('Təşkilatçı'),
    '| fee:', await val('Qonorar (₼)'), '| advance:', await val('Alınan avans (₼)'), '| date shown:', (await p.locator('body').innerText()).includes('15 dekabr 2026'));
  console.log('   recognizer lang:', await p.evaluate(() => window.__LANGS.join(',')));

  // 2. dictate into notes field (append)
  await p.evaluate(() => (window.__VOICE = 'Səhnə 2 saatlıq proqram'));
  await p.getByLabel('Qeydlər: mic').click(); await p.waitForTimeout(1200);
  console.log('2. notes after dictation:', await p.locator('textarea').inputValue());
  await p.getByText('Yadda saxla', { exact: true }).click(); await p.waitForTimeout(700);
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('vibe-os-store')).state);
  console.log('   saved event:', st.events[0]?.title, st.events[0]?.date, st.events[0]?.fee, st.events[0]?.advance, '| income record:', st.records[0]?.amount, st.records[0]?.paidAmount, st.records[0]?.status);

  // 3. RU sentence -> income form
  await p.getByText('Digər', { exact: true }).click(); await p.getByText('Русский', { exact: true }).click();
  await p.getByText('Главная', { exact: true }).click(); await p.waitForTimeout(500);
  await p.evaluate(() => (window.__VOICE = 'Получил 1500 манат от Рауфа'));
  await p.getByLabel('Добавить голосом').click(); await p.waitForTimeout(1400);
  await p.screenshot({ path: `${SHOTS}/v4-income-ru.png` });
  console.log('3. RU kind income:', (await p.locator('body').innerText()).includes('Новый доход'), '| from:', await val('От кого'), '| amount:', await val('Сумма (₼)'),
    '| lang:', await p.evaluate(() => window.__LANGS.slice(-1)[0]));
  console.log('ERRORS:', JSON.stringify(errors));

  // 4. device without speech recognition
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx2.addInitScript('window.__NO_SPEECH = true; delete window.webkitSpeechRecognition; delete window.SpeechRecognition;' + MOCK);
  const p2 = await ctx2.newPage();
  await p2.goto('http://localhost:8099/');
  await p2.evaluate(() => localStorage.setItem('vibe-os-store', JSON.stringify({ version: 2, state: { profile: { stageName: 'A', role: 'singer', genre: '', createdAt: '' }, settings: { language: 'az', currency: 'AZN', appLock: false }, events: [], records: [], bookings: [], contacts: [], tombstones: [], cloud: { pullCursors: {} } } })));
  await p2.reload(); await p2.waitForTimeout(1500);
  await p2.getByLabel('Səslə əlavə et').click(); await p2.waitForTimeout(600);
  console.log('4. unavailable message:', (await p2.locator('body').innerText()).includes('Klaviaturadakı mikrofon'));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
