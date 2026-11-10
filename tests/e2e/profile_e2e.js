const { chromium } = require('playwright');
const SHOTS = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto('http://localhost:8099/');
  await p.evaluate(() => localStorage.setItem('vibe-os-store', JSON.stringify({ version: 6, state: {
    profile: { stageName: 'Aysel', role: 'singer', genre: 'Pop', createdAt: new Date().toISOString() },
    settings: { language: 'az', currency: 'AZN', appLock: false, theme: 'rose' } } })));
  await p.reload(); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${SHOTS}/p1-home-header.png`, clip: { x: 0, y: 0, width: 390, height: 120 } });
  // avatar (left) -> Profile
  await p.getByLabel('Profil', { exact: true }).first().click(); await p.waitForTimeout(500);
  let body = await p.locator('body').innerText();
  console.log('avatar opens Profile:', body.includes('Səhnə adınız nədir?') && body.includes('Şəkil əlavə et'));
  await p.screenshot({ path: `${SHOTS}/p2-profile.png` });
  await p.getByText('Səhnə adınız nədir?', { exact: true }).locator('xpath=..').locator('input').fill('Aysel Rəhimova');
  await p.getByText('DJ', { exact: true }).click();
  await p.getByText('Yadda saxla', { exact: true }).click(); await p.waitForTimeout(500);
  body = await p.locator('body').innerText();
  console.log('saved name on Home:', body.includes('Aysel Rəhimova'));
  // gear (right) -> More/settings
  await p.getByLabel('Parametrlər').click(); await p.waitForTimeout(500);
  body = await p.locator('body').innerText();
  console.log('gear opens More:', body.includes('GÖRÜNÜŞ') && body.includes('Studiya'), '| card shows DJ:', body.includes('DJ · Pop'));
  // More profile card -> Profile
  await p.getByLabel('Profil', { exact: true }).last().click(); await p.waitForTimeout(500);
  console.log('More card opens Profile:', (await p.locator('body').innerText()).includes('Səhnə adınız nədir?'));
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('vibe-os-store')).state.profile);
  console.log('stored profile:', st.stageName, st.role, st.genre);
  console.log('ERRORS:', JSON.stringify(errors));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
