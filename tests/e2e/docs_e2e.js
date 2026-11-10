const { chromium } = require('playwright');
const SHOTS = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  p.on('dialog', d => d.accept());
  const click = t => p.getByText(t, { exact: true }).locator('visible=true').first().click();
  const fieldOf = label => p.getByText(label, { exact: true }).locator('xpath=..').locator('input,textarea').first();
  const store = () => p.evaluate(() => JSON.parse(localStorage.getItem('vibe-os-store')).state);
  const d = n => { const x = new Date(Date.now() + n * 864e5); return x.toISOString().slice(0, 10); };

  await p.goto('http://localhost:8099/');
  // v3 store (studio era) with one event -> must migrate to v4
  await p.evaluate(({ evDate }) => localStorage.setItem('vibe-os-store', JSON.stringify({ version: 3, state: {
    profile: { stageName: 'Aysel', role: 'singer', genre: 'Pop', createdAt: '' },
    settings: { language: 'az', currency: 'AZN', appLock: false },
    events: [{ id: 'ev-wedding-01', title: 'Toy · Fairmont', type: 'wedding', date: evDate, time: '19:30', venue: 'Fairmont', city: 'Bakı',
      organizer: 'Rauf Məmmədov', organizerPhone: '', fee: 3000, advance: 1000, currency: 'AZN', notes: '', createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z' }],
    records: [], bookings: [], contacts: [], tombstones: [], songs: [], assets: [], setlists: [],
    cloud: { email: null, workspaceId: null, slug: null, lastPushAt: null, pullCursors: {}, lastSyncAt: null } } })), { evDate: d(20) });
  await p.reload(); await p.waitForTimeout(1500);
  let st = await store();
  console.log('0. migrated to v4:', (await p.evaluate(() => JSON.parse(localStorage.getItem('vibe-os-store')).version)), Array.isArray(st.contracts), Array.isArray(st.docs), st.reminders === false);

  // 1. contract from the event
  await click('Tədbirlər'); await p.waitForTimeout(300);
  await p.getByText('Toy · Fairmont', { exact: true }).last().click(); await p.waitForTimeout(500);
  await click('Müqavilə +'); await p.waitForTimeout(600);
  console.log('1. prefilled: counterparty=', await fieldOf('Qarşı tərəf').inputValue(), '| amount=', await fieldOf('Məbləğ (₼)').inputValue(),
    '| template Toy selected:', await p.getByRole('radio', { name: 'Toy' }).getAttribute('aria-checked').catch(() => '?'));
  await click('İmza son tarixi əlavə et'); await p.waitForTimeout(200);
  await click('Şablondan doldur'); await p.waitForTimeout(400);
  const body = await fieldOf('Müqavilənin mətni').inputValue();
  console.log('   body has details:', ['Toy mərasimində', 'Aysel', 'Rauf Məmmədov', '19:30', 'Fairmont, Bakı', '3\u00A0000', '1\u00A0000', '2\u00A0000'].map(x => body.includes(JSON.parse('"' + x + '"')) ? 'ok' : 'MISSING:' + x).join(' '));
  
  // Russian contract while app stays Azerbaijani
  await click('Русский'); await click('Şablondan doldur'); await p.waitForTimeout(400);
  const ru = await fieldOf('Müqavilənin mətni').inputValue();
  console.log('   RU text:', ru.startsWith('Договор на выступление на свадьбе'), ru.includes('Свадьба') || ru.includes('свадьбе'));
  await click('Azərbaycanca'); await click('Şablondan doldur'); await p.waitForTimeout(300);
  await click('Göndərilib');
  await p.screenshot({ path: `${SHOTS}/d1-contract.png` });
  await click('PDF paylaş'); await p.waitForTimeout(800);
  st = await store();
  console.log('   saved (must be exactly 1 after PDF + save):', st.contracts.length, 'title=', st.contracts[0]?.title, st.contracts[0]?.status, 'deadline=', st.contracts[0]?.deadline, 'event linked=', st.contracts[0]?.eventId === 'ev-wedding-01');
  // card number in contract text must be blocked
  await fieldOf('Müqavilənin mətni').fill(body + '\nKart: 4111 1111 1111 1111');
  await click('Yadda saxla'); await p.waitForTimeout(300);
  st = await store();
  console.log('   card blocked (text unchanged in store):', !st.contracts[0].body.includes('4111'));
  await fieldOf('Müqavilənin mətni').fill(body);
  await click('Yadda saxla'); await p.waitForTimeout(400);
  st = await store(); console.log('   still one contract after PDF + 2 saves:', st.contracts.length === 1);

  // 2. rider
  await p.goto('http://localhost:8099/'); await p.waitForTimeout(1200);
  await click('Digər'); await click('Sənədlər'); await p.waitForTimeout(400);
  await click('Rider'); await p.waitForTimeout(300);
  await click('Yarat'); await p.waitForTimeout(500);
  await p.getByPlaceholder('Yeni tələb').first().fill('x').catch(() => {});
  await p.getByText('Sətir əlavə et', { exact: true }).first().click();
  await p.getByPlaceholder('Yeni tələb').last().fill('Səhnədə ventilyator');
  await click('Bölmə əlavə et');
  await p.getByPlaceholder('Bölmənin adı').last().fill('Video');
  await p.getByPlaceholder('Yeni tələb').last().fill('LED ekran 3×2 m');
  await p.screenshot({ path: `${SHOTS}/d2-rider.png` });
  await click('Yadda saxla'); await p.waitForTimeout(500);
  st = await store();
  const r = st.riders[0];
  console.log('2. rider saved:', r?.kind, r?.title, '| sections:', r?.sections.length, '| stage items:', r?.sections[0].items.join(' | '), '| video:', JSON.stringify(r?.sections.at(-1)));

  // 3. passport expiring in ~45 days
  await click('Şəxsi'); await p.waitForTimeout(300);
  await p.getByLabel('Yeni sənəd').click(); await p.waitForTimeout(500);
  await click('Bitmə tarixi əlavə et'); await p.waitForTimeout(200);
  await p.evaluate(() => 0);
  await click('Yadda saxla'); await p.waitForTimeout(400);
  // set expiry to +45 days directly through the store to avoid calendar clicking
  await p.evaluate((exp) => { const k = 'vibe-os-store'; const s = JSON.parse(localStorage.getItem(k)); s.state.docs[0].expiry = exp; localStorage.setItem(k, JSON.stringify(s)); }, d(45));
  await p.reload(); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${SHOTS}/d3-home.png` });
  const home = await p.locator('body').innerText();
  console.log('3. home briefing: contract line:', home.includes('İmzala: Toy mərasimində'), '| doc line:', home.includes('1 sənədin vaxtı 60 gün içində bitir'));
  await click('1 sənədin vaxtı 60 gün içində bitir'); await p.waitForTimeout(600);
  await p.screenshot({ path: `${SHOTS}/d4-personal.png` });
  console.log('   personal tab shows countdown:', /gün sonra bitir/.test(await p.locator('body').innerText()));
  await click('Müqavilələr'); await p.waitForTimeout(300);
  await p.screenshot({ path: `${SHOTS}/d5-contracts.png` });

  // 4. delete event -> contract unlinked, not deleted
  await p.goto('http://localhost:8099/'); await p.waitForTimeout(1200);
  await click('Tədbirlər'); await p.getByText('Toy · Fairmont', { exact: true }).last().click(); await p.waitForTimeout(400);
  await p.getByText('Sil', { exact: true }).last().click(); await p.waitForTimeout(500);
  st = await store();
  console.log('4. after event delete: contracts', st.contracts.length, '| eventId', st.contracts[0].eventId ?? 'none');
  console.log('ERRORS:', JSON.stringify(errors, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
