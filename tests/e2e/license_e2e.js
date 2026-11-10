const { chromium } = require('playwright');
const SHOTS = process.argv[2];
const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const state = (createdAt, license) => ({ version: 6, state: {
  profile: { stageName: 'Aysel', role: 'singer', genre: 'Pop', createdAt },
  settings: { language: 'az', currency: 'AZN', appLock: false },
  events: [{ id: 'ev-1-000000', title: 'Toy · Fairmont', type: 'wedding', date: '2026-12-20', time: '19:30', venue: 'Fairmont', city: 'Bakı', organizer: 'Rauf', organizerPhone: '', fee: 3000, advance: 1000, currency: 'AZN', notes: '', createdAt: ago(10), updatedAt: ago(10) }],
  records: [], bookings: [], contacts: [], tombstones: [], songs: [], assets: [], setlists: [], contracts: [], riders: [], docs: [], reminders: false, tasks: [], members: [],
  cloud: { email: null, userId: null, workspaceId: null, slug: null, role: null, lastPushAt: null, pullCursors: {}, lastSyncAt: null, license } } });
(async () => {
  const b = await chromium.launch();
  const errors = [];
  const open = async (st) => {
    const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
    p.on('pageerror', e => errors.push(e.message));
    await p.goto('http://localhost:8097/');
    await p.evaluate((x) => localStorage.setItem('vibe-os-store', JSON.stringify(x)), st);
    await p.reload(); await p.waitForTimeout(1500);
    return p;
  };
  // 1. trial, day 2 of 3 (local, before sign-in)
  let p = await open(state(ago(30), null));
  let body = await p.locator('body').innerText();
  console.log('1. trial strip:', body.includes('Pulsuz sınaq: 2 gün qalıb'), '| can add (voice btn):', body.includes('Səslə əlavə et'));
  await p.screenshot({ path: `${SHOTS}/l1-trial-home.png` });
  // 2. trial expired (local clock)
  p = await open(state(ago(80), null));
  body = await p.locator('body').innerText();
  console.log('2. expired strip:', body.includes('Pulsuz sınaq müddəti bitdi'), '| voice hidden:', !body.includes('Səslə əlavə et'), '| quick add hidden:', !body.includes('Gəlir\n'));
  await p.screenshot({ path: `${SHOTS}/l2-expired-home.png` });
  await p.getByText('Tədbirlər', { exact: true }).last().click(); await p.waitForTimeout(300);
  console.log('   events + hidden:', (await p.getByLabel('Yeni tədbir').count()) === 0);
  await p.getByText('Toy · Fairmont', { exact: true }).last().click(); await p.waitForTimeout(500);
  body = await p.locator('body').innerText();
  console.log('   event form locked with licence message:', body.includes('Pulsuz sınaq bitdi: yalnız baxış'), '| activate button:', body.includes('Aktivləşdir'), '| save hidden:', !body.includes('Yadda saxla'), '| input locked:', !(await p.locator('input').first().isEditable()));
  await p.screenshot({ path: `${SHOTS}/l3-expired-event.png` });
  await p.getByText('Aktivləşdir', { exact: true }).last().click(); await p.waitForTimeout(500);
  body = await p.locator('body').innerText();
  console.log('   licence screen: title:', body.includes('Pulsuz sınaq müddəti bitdi'), '| sign-in hint:', body.includes('Əvvəlcə hesaba daxil olun'), '| seller button:', body.includes('Satıcı ilə əlaqə'));
  await p.screenshot({ path: `${SHOTS}/l4-licence-screen.png` });
  // 3. server says trial still running although local clock says expired -> server wins
  p = await open(state(ago(200), { status: 'trial', trialEndsAt: new Date(Date.now() + 5 * 3600e3).toISOString(), activatedAt: null }));
  body = await p.locator('body').innerText();
  console.log('3. server trial (hours):', /Pulsuz sınaq: [56] saat qalıb/.test(body));
  // 4. active licence
  p = await open(state(ago(500), { status: 'active', trialEndsAt: ago(400), activatedAt: ago(300) }));
  body = await p.locator('body').innerText();
  console.log('4. active: no strip:', !body.includes('Pulsuz sınaq'), '| can add:', body.includes('Səslə əlavə et'));
  await p.getByText('Digər', { exact: true }).last().click(); await p.getByText('Lisenziya', { exact: true }).click(); await p.waitForTimeout(400);
  body = await p.locator('body').innerText();
  console.log('   licence screen active:', body.includes('VIBE OS aktivləşdirilib'), '| no code field:', !body.includes('Aktivasiya kodu'));
  await p.screenshot({ path: `${SHOTS}/l5-active.png` });
  // 5. suspended
  p = await open(state(ago(500), { status: 'suspended', trialEndsAt: ago(400), activatedAt: ago(300) }));
  body = await p.locator('body').innerText();
  console.log('5. suspended strip:', body.includes('Lisenziya dayandırılıb'), '| voice hidden:', !body.includes('Səslə əlavə et'));
  console.log('ERRORS:', JSON.stringify(errors));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
