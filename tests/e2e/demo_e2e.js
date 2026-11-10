const { chromium } = require('playwright');
const SHOTS = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const errors = [];
  // ---- 1. demo in Russian (no-cloud build) ----
  let p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('dialog', (dlg) => dlg.accept());
  const click = (t) => p.getByText(t, { exact: true }).last().click();
  await p.goto('http://localhost:8099/'); await p.waitForTimeout(1800);
  await click('Русский'); await p.waitForTimeout(200);
  await p.screenshot({ path: `${SHOTS}/d1-welcome.png` });
  await click('Открыть демо'); await p.waitForTimeout(1200);
  let body = await p.locator('body').innerText();
  console.log('demo home: banner', body.includes('Демо-режим'), '| profile', body.includes('Айсель (демо)'), '| agenda wedding', body.includes('Свадьба · Fairmont'), '| rehearsal 12:00', body.includes('12:00'));
  await p.screenshot({ path: `${SHOTS}/d2-demo-home.png` });
  await click('Финансы'); await p.waitForTimeout(400);
  body = await p.locator('body').innerText();
  console.log('money has records:', body.includes('Rauf Məmmədov') && body.includes('Elvin Quliyev'));
  await p.screenshot({ path: `${SHOTS}/d3-demo-money.png` });
  await click('Заказы'); await p.waitForTimeout(400);
  console.log('bookings:', (await p.locator('body').innerText()).includes('Kamran Hüseynov'));
  await click('Ещё'); await p.waitForTimeout(300); await click('Студия'); await p.waitForTimeout(400);
  console.log('songs:', (await p.locator('body').innerText()).includes('Ночи'));
  let st = await p.evaluate(() => JSON.parse(localStorage.getItem('vibe-os-store')).state);
  console.log('stored: demo flag', st.settings.demo, '| lang', st.settings.language, '| events', st.events.length, '| no cloud', st.cloud.workspaceId === null);
  // exit demo -> onboarding, data gone
  await p.goto('http://localhost:8099/'); await p.waitForTimeout(1500);
  await p.getByLabel('Начать со своими данными').first().click(); await p.waitForTimeout(800);
  st = await p.evaluate(() => JSON.parse(localStorage.getItem('vibe-os-store')).state);
  body = await p.locator('body').innerText();
  console.log('after exit: onboarding', body.includes('Открыть демо'), '| data cleared', st.events.length === 0 && st.records.length === 0 && !st.profile);

  // ---- 2. demo on a cloud-connected build: no trial strip, no server traffic ----
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'az-AZ' });
  const hits = [];
  await ctx.route('https://demo-test.supabase.co/**', (r) => { hits.push(r.request().url()); r.abort(); });
  p = await ctx.newPage();
  p.on('pageerror', e => errors.push('cloud: ' + e.message));
  await p.goto('http://localhost:8097/'); await p.waitForTimeout(1800);
  await p.getByText('Demonu aç', { exact: true }).click(); await p.waitForTimeout(1500);
  body = await p.locator('body').innerText();
  console.log('cloud build demo: no trial strip', !body.includes('Pulsuz sınaq'), '| can add', body.includes('Səslə əlavə et'));
  await p.getByText('Digər', { exact: true }).last().click(); await p.getByText('Hesab və bulud', { exact: true }).click(); await p.waitForTimeout(600);
  console.log('account shows cloud-off note:', (await p.locator('body').innerText()).includes('Demo rejimində bulud'));
  await p.waitForTimeout(4000);
  console.log('requests to the cloud during demo:', hits.filter(u => !u.includes('/auth/v1/user')).length, hits.slice(0, 3));
  console.log('ERRORS:', JSON.stringify(errors));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
