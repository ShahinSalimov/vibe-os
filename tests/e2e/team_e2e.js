const { chromium } = require('playwright');
const SHOTS = process.argv[2];
const ME = '00000000-0000-0000-0000-00000000000e';
const base = (role) => ({ version: 5, state: {
  profile: { stageName: role === 'owner' ? 'Aysel' : 'Elnur', role: 'musician', genre: '', createdAt: '' },
  settings: { language: 'az', currency: 'AZN', appLock: false },
  events: [{ id: 'ev-1-000000', title: 'Toy · Fairmont', type: 'wedding', date: '2026-12-20', time: '19:30', venue: 'Fairmont', city: 'Bakı', organizer: 'Rauf', organizerPhone: '', fee: 3000, advance: 1000, currency: 'AZN', notes: '', createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z' }],
  records: [{ id: 'rec-1-00000', kind: 'income', counterparty: 'Rauf', amount: 3000, paidAmount: 1000, currency: 'AZN', date: '2026-11-05', status: 'partial', category: '', note: '', createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z' }],
  bookings: [], contacts: [], tombstones: [], songs: [], assets: [], setlists: [], contracts: [], riders: [], docs: [], reminders: false,
  tasks: [
    { id: 'task-mine-01', title: 'Məşq notlarını hazırla', note: '', assigneeId: ME, due: '2026-12-18', done: false, createdAt: '2026-11-02T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z' },
    { id: 'task-other-1', title: 'Nəqliyyatı sifariş et', note: '', assigneeId: 'other-user', due: '', done: false, createdAt: '2026-11-02T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z' },
  ],
  members: [
    { userId: 'owner-user', role: 'owner', displayName: 'Aysel', email: 'aysel@x.az', joinedAt: '' },
    { userId: ME, role: role, displayName: 'Elnur', email: 'elnur@x.az', joinedAt: '' },
    { userId: 'other-user', role: 'manager', displayName: 'Rəşad', email: 'r@x.az', joinedAt: '' },
  ],
  cloud: { email: 'elnur@x.az', userId: ME, workspaceId: 'ws-1', slug: 'aysel', role, lastPushAt: null, pullCursors: {}, lastSyncAt: null } } });

(async () => {
  const b = await chromium.launch();
  const errors = [];
  async function asRole(role) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(role + ': ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errors.push(role + ' console: ' + m.text()); });
    await p.goto('http://localhost:8099/');
    await p.evaluate((st) => localStorage.setItem('vibe-os-store', JSON.stringify(st)), base(role));
    await p.reload(); await p.waitForTimeout(1500);
    return p;
  }
  const tabs = async (p) => (await p.getByRole('tab').allInnerTexts()).map(s => s.replace(/\d/g, '').trim()).join(',');

  // ---- musician (member) ----
  let p = await asRole('member');
  const home = await p.locator('body').innerText();
  console.log('member tabs:', await tabs(p));
  console.log('  home: money card hidden:', !home.includes('BU AY'), '| voice hidden:', !home.includes('Səslə əlavə et'), '| quick add hidden:', !home.includes('Gəlir'), '| tasks line:', home.includes('Sizə 1 tapşırıq'));
  await p.screenshot({ path: `${SHOTS}/t1-member-home.png` });
  await p.getByText('Toy · Fairmont', { exact: true }).last().click(); await p.waitForTimeout(500);
  const ev = await p.locator('body').innerText();
  console.log('  event form: read-only banner:', ev.includes('Yalnız baxış'), '| save hidden:', !ev.includes('Yadda saxla'), '| delete hidden:', !ev.includes('Sil\n') && (await p.getByText('Sil', { exact: true }).count()) === 0, '| contract link hidden:', !ev.includes('Müqavilə'));
  console.log('  inputs locked:', await p.locator('input').first().isEditable() === false, '| mic hidden:', (await p.getByLabel('Ad: mic').count()) === 0, '| type chip disabled:', await p.getByRole('radio', { name: 'Konsert' }).getAttribute('aria-disabled'));
  await p.screenshot({ path: `${SHOTS}/t2-member-event.png` });
  await p.goto('http://localhost:8099/'); await p.waitForTimeout(1200);
  await p.getByText('Sizə 1 tapşırıq', { exact: true }).click(); await p.waitForTimeout(500);
  const boxes = p.getByRole('checkbox');
  console.log('  tasks (Mine tab):', await boxes.count(), 'item(s)');
  await boxes.first().click(); await p.waitForTimeout(300);
  let st = await p.evaluate(() => JSON.parse(localStorage.getItem('vibe-os-store')).state);
  console.log('  ticked own task:', st.tasks.find(x => x.id === 'task-mine-01').done);
  await p.getByText('Açıq', { exact: true }).click(); await p.waitForTimeout(300);
  const other = p.getByRole('checkbox').first();
  console.log("  other person's task checkbox disabled:", await other.getAttribute('aria-disabled'));
  await other.click({ force: true }); await p.waitForTimeout(300);
  st = await p.evaluate(() => JSON.parse(localStorage.getItem('vibe-os-store')).state);
  console.log("  other task unchanged:", st.tasks.find(x => x.id === 'task-other-1').done === false, '| no + button:', (await p.getByLabel('Yeni tapşırıq').count()) === 0);
  await p.screenshot({ path: `${SHOTS}/t3-member-tasks.png` });
  await p.goto('http://localhost:8099/'); await p.waitForTimeout(1000);
  await p.getByText('Digər', { exact: true }).last().click(); await p.getByText('Sənədlər', { exact: true }).click(); await p.waitForTimeout(400);
  console.log('  documents tabs:', (await p.getByRole('tab').allInnerTexts()).join(','));

  // ---- accountant ----
  p = await asRole('accountant');
  console.log('accountant tabs:', await tabs(p));
  const ah = await p.locator('body').innerText();
  console.log('  money card visible:', ah.includes('BU AY'), '| voice hidden:', !ah.includes('Səslə əlavə et'));

  // ---- owner (local, no team) ----
  p = await asRole('owner');
  await p.evaluate(() => { const k = 'vibe-os-store'; const s = JSON.parse(localStorage.getItem(k)); s.state.cloud = { email: null, userId: null, workspaceId: null, slug: null, role: null, lastPushAt: null, pullCursors: {}, lastSyncAt: null }; s.state.members = []; localStorage.setItem(k, JSON.stringify(s)); });
  await p.reload(); await p.waitForTimeout(1500);
  console.log('local owner tabs:', await tabs(p));
  await p.getByText('Digər', { exact: true }).last().click(); await p.waitForTimeout(300);
  await p.getByText('Tapşırıqlar', { exact: true }).click(); await p.waitForTimeout(400);
  await p.getByLabel('Yeni tapşırıq').click(); await p.waitForTimeout(400);
  await p.getByText('Tapşırıq', { exact: true }).locator('xpath=..').locator('input').first().fill('Səhnə planını göndər');
  await p.getByText('Yadda saxla', { exact: true }).last().click(); await p.waitForTimeout(400);
  st = await p.evaluate(() => JSON.parse(localStorage.getItem('vibe-os-store')).state);
  console.log('  personal task created:', st.tasks.some(x => x.title === 'Səhnə planını göndər'));
  await p.screenshot({ path: `${SHOTS}/t4-owner-tasks.png` });
  await p.goBack?.();
  await p.goto('http://localhost:8099/'); await p.waitForTimeout(1000);
  await p.getByText('Digər', { exact: true }).last().click(); await p.getByText('Komanda', { exact: true }).click(); await p.waitForTimeout(400);
  console.log('  team screen (no cloud) message:', (await p.locator('body').innerText()).includes('Bulud yedəkləməsi'));
  await p.screenshot({ path: `${SHOTS}/t5-team-nocloud.png` });
  console.log('ERRORS:', JSON.stringify(errors, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
