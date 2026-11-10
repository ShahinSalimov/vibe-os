const { chromium } = require('playwright');
const SHOTS = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ru-RU' });
  const errors = []; const calls = [];
  let mode = 'ok';
  await ctx.route('**/config.js', r => r.fulfill({ contentType: 'application/javascript', body: "window.VIBE_CONFIG={supabaseUrl:'https://demo.supabase.co',anonKey:'anon-test-key'};" }));
  await ctx.route('https://demo.supabase.co/**', async r => {
    const url = r.request().url(); const body = JSON.parse(r.request().postData() || '{}');
    calls.push({ url: url.split('/rpc/')[1], body, apikey: r.request().headers()['apikey'] });
    if (url.endsWith('get_public_profile')) {
      return r.fulfill({ json: body.p_slug === 'aysel' ? [{ stage_name: 'Aysel', artist_role: 'singer', genre: 'Pop', default_currency: 'AZN' }] : [] });
    }
    if (mode === 'rate') return r.fulfill({ status: 400, json: { message: 'rate_limited' } });
    return r.fulfill({ json: 'bk123' });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  // 1. unknown artist
  await p.goto('http://localhost:8098/?a=nobody'); await p.waitForTimeout(500);
  console.log('notfound visible:', await p.isVisible('#notfound'), '| text:', await p.textContent('#notfound h2'));
  // 2. real artist, Russian auto-detected
  await p.goto('http://localhost:8098/?a=aysel'); await p.waitForTimeout(500);
  console.log('lang auto:', await p.getAttribute('html', 'lang'), '| title:', await p.textContent('h2'));
  await p.screenshot({ path: `${SHOTS}/b1-ru.png`, fullPage: true });
  // switch to AZ
  await p.click('button[data-lang=az]');
  console.log('after switch:', await p.textContent('h2'), '| sub:', await p.textContent('#artistSub'));
  // 3. validation: empty submit
  await p.click('#submit'); console.log('err empty:', await p.textContent('#formError'));
  await p.fill('input[name=name]', 'Elvin Quliyev');
  await p.click('#submit'); console.log('err contact:', await p.textContent('#formError'));
  await p.fill('input[name=phone]', '050 123 45 67');
  await p.click('#submit'); console.log('err date:', await p.textContent('#formError'));
  const d = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  await p.fill('input[name=date]', d);
  await p.click('.types button:nth-child(3)'); // corporate
  await p.fill('input[name=guests]', '250'); await p.fill('input[name=city]', 'Bakı'); await p.fill('input[name=budget]', '5000');
  await p.fill('textarea[name=message]', 'kart 4111 1111 1111 1111');
  await p.click('#submit'); console.log('err card:', await p.textContent('#formError'), '| rpc calls so far:', calls.filter(c => c.url === 'submit_booking').length);
  await p.fill('textarea[name=message]', 'Şirkətin yeni il tədbiri');
  await p.screenshot({ path: `${SHOTS}/b2-az-filled.png`, fullPage: true });
  // 4. server rate-limit error
  mode = 'rate'; await p.click('#submit'); await p.waitForTimeout(300);
  console.log('err rate:', await p.textContent('#formError'));
  // 5. success
  mode = 'ok'; await p.click('#submit'); await p.waitForTimeout(400);
  console.log('done visible:', await p.isVisible('#done'), '|', await p.textContent('#sentBody'));
  await p.screenshot({ path: `${SHOTS}/b3-done.png` });
  const sub = calls.filter(c => c.url === 'submit_booking').pop();
  console.log('payload:', JSON.stringify(sub.body), '| apikey sent:', sub.apikey === 'anon-test-key');
  console.log('ERRORS:', JSON.stringify(errors));
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
