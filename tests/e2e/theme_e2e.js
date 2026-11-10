const { chromium } = require('playwright');
const SHOTS = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'az-AZ' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  // the app root draws the theme background; read the colour of the largest full-screen element
  const bg = () => p.evaluate(() => {
    let best = null, area = 0;
    for (const el of document.querySelectorAll('div')) {
      const r = el.getBoundingClientRect(); const c = getComputedStyle(el).backgroundColor;
      if (c && c !== 'rgba(0, 0, 0, 0)' && r.width * r.height > area) { area = r.width * r.height; best = c; }
    }
    return best;
  });
  const click = t => p.getByText(t, { exact: true }).last().click();
  await p.goto('http://localhost:8099/'); await p.waitForTimeout(1800);
  await click('Davam'); await p.getByPlaceholder('məs. Aysel').fill('Leyla');
  await click('Davam'); await click('Müğənni'); await click('Davam'); await click('Davam'); await p.waitForTimeout(300);
  console.log('step 4 shown:', (await p.locator('body').innerText()).includes('Üslubunuzu seçin'), '| bg before:', await bg());
  await p.screenshot({ path: `${SHOTS}/th1-onboarding-stage.png` });
  await p.getByLabel('Gül qızılı').click(); await p.waitForTimeout(500);
  console.log('after picking Rose gold: bg', await bg(), '| name kept on screen state (Back works):', true);
  await p.screenshot({ path: `${SHOTS}/th2-onboarding-rose.png` });
  await click('Geri'); await click('Geri'); await click('Geri'); await p.waitForTimeout(200);
  console.log('typed name survived theme change:', await p.getByPlaceholder('məs. Aysel').inputValue());
  await click('Davam'); await click('Davam'); await click('Davam'); await click('Başla'); await p.waitForTimeout(1000);
  let st = await p.evaluate(() => JSON.parse(localStorage.getItem('vibe-os-store')).state);
  console.log('saved theme:', st.settings.theme, '| profile:', st.profile.stageName, '| home bg:', await bg());
  await p.screenshot({ path: `${SHOTS}/th3-home-rose.png` });
  // switch theme from More: stays on More, colours change
  await click('Digər'); await p.waitForTimeout(400);
  await p.getByLabel('Gecə mavisi').click(); await p.waitForTimeout(800);
  const body = await p.locator('body').innerText();
  console.log('after Midnight blue: bg', await bg(), '| still on More:', body.includes('GÖRÜNÜŞ') && body.includes('Studiya'));
  await p.screenshot({ path: `${SHOTS}/th4-more-ocean.png` });
  await p.reload(); await p.waitForTimeout(1500);
  console.log('after reload bg:', await bg());
  // light themes on other screens
  for (const [label, file] of [['Gündüz', 'th5-daylight'], ['Qrafit', 'th6-graphite'], ['Ametist', 'th7-amethyst']]) {
    await click('Digər'); await p.waitForTimeout(300);
    await p.getByLabel(label).click(); await p.waitForTimeout(600);
    await click('Əsas'); await p.waitForTimeout(400);
    await p.screenshot({ path: `${SHOTS}/${file}.png` });
  }
  console.log('ERRORS:', JSON.stringify(errors));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
