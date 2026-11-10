const { chromium } = require('playwright');
const SHOTS = process.argv[2], FACE = process.argv[3];
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'az-AZ', permissions: ['microphone'] });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  p.on('dialog', d => d.accept());
  const click = t => p.getByText(t, { exact: true }).first().click();
  const fill = async (label, v) => p.getByText(label, { exact: true }).locator('xpath=..').locator('input,textarea').first().fill(v);
  const store = () => p.evaluate(() => JSON.parse(localStorage.getItem('vibe-os-store')).state);

  // 1. onboarding with photo
  await p.goto('http://localhost:8099/'); await p.waitForTimeout(2000);
  await click('Davam');
  const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.getByLabel('Profil şəkli').click()]);
  await chooser.setFiles(FACE); await p.waitForTimeout(800);
  await p.getByPlaceholder('məs. Aysel').fill('Aysel');
  await p.screenshot({ path: `${SHOTS}/s1-onboarding-photo.png` });
  await click('Davam'); await click('Davam'); await click('Davam'); await click('Başla'); await p.waitForTimeout(800);
  let st = await store();
  console.log('1. photo saved in profile:', !!st.profile.photoUri, '| store version:', (await p.evaluate(() => JSON.parse(localStorage.getItem('vibe-os-store')).version)));
  await p.screenshot({ path: `${SHOTS}/s2-home-photo.png` });

  // 2. studio: song + recorded idea
  await click('Digər'); await p.waitForTimeout(400); await click('Studiya'); await p.waitForTimeout(500);
  await p.screenshot({ path: `${SHOTS}/s3-studio-empty.png` });
  await click('Yeni mahnı'); await p.waitForTimeout(500);
  await fill('Mahnının adı', 'Gecələr');
  await click('Aranjiman');
  await fill('Tonallıq', 'Am'); await fill('BPM', '96'); await fill('Müddət', '3:75');
  await click('Yadda saxla'); await p.waitForTimeout(300);
  console.log('2. bad duration rejected:', (await p.locator('body').innerText()).includes('Dəqiqə:saniyə'));
  await fill('Müddət', '3:35');
  await click('İdeya yaz'); await p.waitForTimeout(2600);
  await p.screenshot({ path: `${SHOTS}/s4-recording.png` });
  await click('Dayandır və saxla'); await p.waitForTimeout(1200);
  st = await store();
  console.log('   song auto-saved before recording:', st.songs.length === 1, '| assets:', st.assets.length, st.assets[0]?.kind, st.assets[0]?.label, 'sec=', st.assets[0]?.durationSec);
  await p.getByLabel('Dinlə').first().click(); await p.waitForTimeout(800);
  await p.screenshot({ path: `${SHOTS}/s5-song.png`, fullPage: false });
  await click('Yadda saxla'); await p.waitForTimeout(500);

  // 3. second song
  await p.getByLabel('Yeni mahnı').click(); await p.waitForTimeout(400);
  await fill('Mahnının adı', 'Sevgilim'); await fill('Müddət', '4:10'); await click('Yadda saxla'); await p.waitForTimeout(400);
  await p.screenshot({ path: `${SHOTS}/s6-songs.png` });

  // 4. setlist
  await click('Setlistlər · 0'); await p.waitForTimeout(300);
  await click('Yeni setlist'); await p.waitForTimeout(400);
  await fill('Ad', 'Toy proqramı');
  await click('Gecələr'); await click('Sevgilim'); await p.waitForTimeout(200);
  await p.getByLabel('Aşağı').first().click(); await p.waitForTimeout(200);
  const body = await p.locator('body').innerText();
  console.log('4. total shown:', body.includes('Cəmi 7:45'), '| 2 songs:', body.includes('2 mahnı'));
  await p.screenshot({ path: `${SHOTS}/s7-setlist.png` });
  await click('Səhnə rejimi'); await p.waitForTimeout(700);
  await p.screenshot({ path: `${SHOTS}/s8-stage.png` });
  const stageText = await p.locator('body').innerText();
  console.log('   stage first song (after reorder):', stageText.includes('Sevgilim') && stageText.includes('1 / 2'));
  await p.getByLabel('Növbəti').last().click(); await p.waitForTimeout(300);
  console.log('   stage next ->', (await p.locator('body').innerText()).includes('2 / 2'));
  await p.getByLabel('Çıx', { exact: true }).click(); await p.waitForTimeout(400);
  await p.getByText('Yadda saxla', { exact: true }).last().click(); await p.waitForTimeout(400);
  st = await store();
  console.log('   setlists after stage mode + save (must be 1):', st.setlists.length, '| order:', st.setlists[0].songIds.map(id => st.songs.find(s => s.id === id).title).join(' > '));

  // 5. delete song -> removed from setlist and its audio gone
  await p.goto('http://localhost:8099/'); await p.waitForTimeout(1200);
  await click('Digər'); await click('Studiya'); await p.waitForTimeout(400);
  await click('Gecələr'); await p.waitForTimeout(400);
  await p.getByText('Sil', { exact: true }).last().click(); await p.waitForTimeout(400);
  await p.getByRole('button', { name: 'Sil' }).last().click(); await p.waitForTimeout(600); // in-app confirm dialog
  st = await store();
  console.log('5. after delete: songs', st.songs.length, '| assets', st.assets.length, '| setlist songs', st.setlists[0].songIds.length, '| tombstone', st.tombstones.some(t => t.table === 'songs'));
  console.log('ERRORS:', JSON.stringify(errors.filter(e => !e.includes('requestPermissionsAsync')), null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
