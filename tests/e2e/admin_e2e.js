const { chromium } = require('playwright');
const SHOTS = process.argv[2];
const day = 864e5;
(async () => {
  const b = await chromium.launch();
  const errors = [], calls = [];
  const db = {
    admin: true,
    artists: [
      { workspace_id: 'w1', stage_name: 'Aysel', slug: 'aysel', owner_email: 'aysel@x.az', status: 'active', trial_ends_at: new Date(Date.now() - 9 * day).toISOString(), activated_at: new Date().toISOString(), code: 'ABCDEFGH2345', members: 3, created_at: new Date(Date.now() - 12 * day).toISOString() },
      { workspace_id: 'w2', stage_name: 'Rauf <b>x</b>', slug: 'rauf', owner_email: 'rauf@x.az', status: 'trial', trial_ends_at: new Date(Date.now() + 2 * day).toISOString(), activated_at: null, code: null, members: 1, created_at: new Date(Date.now() - day).toISOString() },
      { workspace_id: 'w3', stage_name: 'Nigar', slug: 'nigar', owner_email: 'nigar@x.az', status: 'trial', trial_ends_at: new Date(Date.now() - day).toISOString(), activated_at: null, code: null, members: 1, created_at: new Date(Date.now() - 4 * day).toISOString() },
    ],
    codes: [{ code: 'ABCDEFGH2345', note: 'Aysel · 150 AZN', created_at: new Date().toISOString(), redeemed_workspace: 'w1', redeemed_at: new Date().toISOString(), revoked: false }],
  };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.route('**/config.js', r => r.fulfill({ contentType: 'application/javascript', body: "window.VIBE_CONFIG={supabaseUrl:'https://demo.supabase.co',anonKey:'anon'};" }));
  await ctx.route('https://demo.supabase.co/**', async (r) => {
    const url = r.request().url(), body = JSON.parse(r.request().postData() || '{}'), auth = r.request().headers()['authorization'];
    const name = url.split('/rpc/')[1] || url.split('/auth/v1/')[1];
    calls.push({ name, auth: !!auth, body });
    if (url.includes('/auth/v1/otp')) return r.fulfill({ json: {} });
    if (url.includes('/auth/v1/verify')) return body.token === '123456' ? r.fulfill({ json: { access_token: 'tok', refresh_token: 'ref', expires_in: 3600 } }) : r.fulfill({ status: 400, json: { msg: 'Token has expired or is invalid' } });
    if (!auth) return r.fulfill({ status: 401, json: { message: 'no auth' } });
    if (name === 'is_platform_admin') return r.fulfill({ json: db.admin });
    if (name === 'admin_overview') return r.fulfill({ json: db.artists });
    if (name === 'admin_codes') return r.fulfill({ json: db.codes });
    if (name === 'admin_create_code') { const c = 'NEWC0DE23456'.replace('0', 'Q'); db.codes.unshift({ code: c, note: body.p_note, created_at: new Date().toISOString(), redeemed_workspace: null, redeemed_at: null, revoked: false }); return r.fulfill({ json: c }); }
    if (name === 'admin_extend_trial') { const a = db.artists.find(x => x.workspace_id === body.p_workspace); a.trial_ends_at = new Date(Date.now() + 3 * day).toISOString(); return r.fulfill({ json: null }); }
    if (name === 'admin_set_license') { db.artists.find(x => x.workspace_id === body.p_workspace).status = body.p_status; return r.fulfill({ json: null }); }
    if (name === 'admin_revoke_code') { db.codes.find(x => x.code === body.p_code).revoked = true; return r.fulfill({ json: null }); }
    r.fulfill({ status: 404, json: {} });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => d.type() === 'prompt' ? d.dismiss() : d.accept());
  await p.goto('http://localhost:8096/'); await p.waitForTimeout(400);
  await p.fill('#email', 'seller@x.az'); await p.click('#sendCode'); await p.waitForTimeout(300);
  await p.fill('#otp', '000000'); await p.click('#verify'); await p.waitForTimeout(300);
  console.log('wrong code message:', await p.textContent('#err'));
  await p.fill('#otp', '123456'); await p.click('#verify'); await p.waitForTimeout(600);
  console.log('stats total/active/trial/expired:', await p.textContent('#sTotal'), await p.textContent('#sActive'), await p.textContent('#sTrial'), await p.textContent('#sExpired'));
  console.log('html escaped (no injected <b>):', (await p.locator('#artistRows b').allTextContents()).includes('Rauf <b>x</b>'));
  await p.screenshot({ path: `${SHOTS}/ad1-dashboard.png`, fullPage: true });
  // create a code
  await p.fill('#note', 'Nigar · @nigar · 150 AZN'); await p.click('#create'); await p.waitForTimeout(500);
  console.log('new code:', await p.textContent('#newCode'), '| message has code:', (await p.textContent('#msgAz')).includes(await p.textContent('#newCode')));
  // extend expired trial for Nigar, then suspend Rauf
  await p.locator('tr', { hasText: 'Nigar' }).first().getByText('+3 gün').click(); await p.waitForTimeout(500);
  console.log('after extend: expired count', await p.textContent('#sExpired'), '| trial count', await p.textContent('#sTrial'));
  await p.locator('tr', { hasText: 'rauf@x.az' }).getByText('Dayandır').click(); await p.waitForTimeout(500);
  console.log('rauf suspended:', (await p.locator('tr', { hasText: 'rauf@x.az' }).innerText()).includes('Dayandırılıb'));
  // codes tab: revoke the open one
  await p.click('#tabCodes'); await p.waitForTimeout(200);
  await p.locator('#codeRows tr', { hasText: 'Nigar' }).getByText('Ləğv et').click(); await p.waitForTimeout(500);
  console.log('code revoked:', (await p.locator('#codeRows tr', { hasText: 'Nigar' }).innerText()).includes('Ləğv edilib'), '| used code shows owner:', (await p.locator('#codeRows').innerText()).includes('İstifadə olunub'));
  await p.screenshot({ path: `${SHOTS}/ad2-codes.png`, fullPage: true });
  console.log('all admin calls were authenticated:', calls.filter(c => c.name && !c.name.startsWith('otp') && !c.name.startsWith('verify')).every(c => c.auth));
  // non-admin account
  db.admin = false;
  const p2 = await ctx.newPage(); p2.on('pageerror', e => errors.push(e.message));
  await p2.goto('http://localhost:8096/'); await p2.fill('#email', 'x@x.az'); await p2.click('#sendCode'); await p2.waitForTimeout(200);
  await p2.fill('#otp', '123456'); await p2.click('#verify'); await p2.waitForTimeout(500);
  console.log('non-admin blocked:', (await p2.textContent('#err')).includes('admin deyil'), '| dashboard hidden:', await p2.isHidden('#app'));
  console.log('ERRORS:', JSON.stringify(errors));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
