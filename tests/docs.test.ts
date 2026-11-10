/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contractTitle, renderContract, type ContractData } from '../src/docs/contractTemplates';
import { contractHtml, escapeHtml, riderHtml } from '../src/docs/html';
import { defaultRiderSections, RIDER_TITLES } from '../src/docs/riderDefaults';
import { daysUntil, planReminders, MAX_REMINDERS } from '../src/notify/plan';
import { CONTRACT_TEMPLATES, LANGUAGES } from '../src/lib/types';

const data: ContractData = {
  artist: 'Aysel', organizer: 'Rauf Məmmədov', eventType: 'Toy', date: '15 dekabr 2026', time: '19:30',
  venue: 'Fairmont', city: 'Bakı', fee: '3 000 ₼', advance: '1 000 ₼', balance: '2 000 ₼', today: '10 noyabr 2026',
};

test('contracts: every template x language renders with no leftover placeholders', () => {
  for (const tpl of CONTRACT_TEMPLATES) for (const lang of LANGUAGES) {
    const text = renderContract(tpl, lang, data);
    assert.ok(!/\{\{|\}\}/.test(text), `${tpl}/${lang} has placeholders`);
    assert.ok(text.startsWith(contractTitle(tpl, lang)), `${tpl}/${lang} title first`);
    assert.ok(text.includes('Aysel') && text.includes('Rauf Məmmədov'), `${tpl}/${lang} parties`);
  }
});

test('contracts: performance includes all event and money details', () => {
  const t = renderContract('wedding', 'az', data);
  for (const s of ['15 dekabr 2026', '19:30', 'Fairmont, Bakı', '3 000 ₼', '1 000 ₼', '2 000 ₼']) assert.ok(t.includes(s), s);
  assert.ok(renderContract('performance', 'ru', data).includes('(Toy)'));
});

test('contracts: empty fields become blanks to fill by hand; no bank data words', () => {
  const t = renderContract('performance', 'en', { ...data, venue: '', time: ' ', fee: '' });
  assert.ok(t.includes('Start time: ________'));
  assert.ok(t.includes('Venue: ________, Bakı'));
  for (const tpl of CONTRACT_TEMPLATES) for (const lang of LANGUAGES) {
    assert.ok(!/IBAN|SWIFT|card number|kart nömrəsi|номер карты/i.test(renderContract(tpl, lang, data)));
  }
});

test('html: user text is escaped (no script injection)', () => {
  assert.equal(escapeHtml(`<script>alert("x")</script> & 'y'`), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;');
  const html = contractHtml('Title <b>\n\n1. Subject\nText <img src=x onerror=alert(1)>', 'az');
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('<h1>Title &lt;b&gt;</h1>'));
  assert.ok(html.includes('<p class="h">1. Subject</p>'));
  const r = riderHtml({ title: 'Rider', artist: '<x>', sections: [{ key: 'a', title: 'S', items: ['ok', ' ', '<i>'] }, { key: 'b', title: 'Empty', items: [''] }], notes: '', lang: 'en' });
  assert.ok(r.includes('&lt;x&gt;') && r.includes('<li>&lt;i&gt;</li>'));
  assert.ok(!r.includes('Empty'), 'empty sections are skipped');
  assert.equal((r.match(/<li>/g) ?? []).length, 2, 'blank items skipped');
});

test('riders: defaults exist for both kinds in all languages with same structure', () => {
  for (const kind of ['technical', 'hospitality'] as const) {
    const keys = defaultRiderSections(kind, 'en').map((s) => s.key).join();
    for (const lang of LANGUAGES) {
      const secs = defaultRiderSections(kind, lang);
      assert.equal(secs.map((s) => s.key).join(), keys);
      assert.ok(secs.every((s) => s.items.length > 0));
      assert.ok(RIDER_TITLES[lang][kind]);
    }
  }
  const a = defaultRiderSections('technical', 'az');
  a[0].items.push('changed');
  assert.ok(!defaultRiderSections('technical', 'az')[0].items.includes('changed'), 'defaults are copied, not shared');
});

const NOW = new Date(2026, 10, 10, 12, 0); // 10 Nov 2026 12:00 local
const ev = (p: object) => ({ id: 'e1', title: 'Toy', type: 'wedding', date: '2026-12-15', time: '', venue: '', city: '', organizer: '', organizerPhone: '', fee: 0, advance: 0, currency: 'AZN', notes: '', createdAt: '', updatedAt: '', ...p }) as any;

test('reminders: events (day before + 2h before), past ones skipped', () => {
  const r = planReminders({ events: [ev({ time: '19:30' }), ev({ id: 'old', date: '2026-11-01' })], records: [], contracts: [], docs: [] }, NOW);
  assert.deepEqual(r.map((x) => [x.id, x.at]), [['ev-e1-1d', '2026-12-14T10:00'], ['ev-e1-2h', '2026-12-15T17:30']]);
  const early = planReminders({ events: [ev({ time: '01:00' })], records: [], contracts: [], docs: [] }, NOW);
  assert.equal(early.find((x) => x.id.endsWith('2h'))!.at, '2026-12-14T23:00', '2h before crosses midnight');
});

test('reminders: unpaid income, unsigned contracts, document expiry', () => {
  const r = planReminders({
    events: [],
    records: [
      { id: 'r1', kind: 'income', counterparty: 'Rauf', amount: 3000, paidAmount: 1000, status: 'partial', date: '2026-12-15' } as any,
      { id: 'r2', kind: 'income', counterparty: 'X', amount: 100, paidAmount: 100, status: 'paid', date: '2026-12-15' } as any,
      { id: 'r3', kind: 'expense', counterparty: 'Y', amount: 100, paidAmount: 0, status: 'planned', date: '2026-12-15' } as any,
    ],
    contracts: [
      { id: 'c1', title: 'Toy', status: 'sent', deadline: '2026-12-01' } as any,
      { id: 'c2', title: 'Done', status: 'signed', deadline: '2026-12-01' } as any,
    ],
    docs: [{ id: 'p1', title: 'Pasport', expiry: '2027-03-01' } as any, { id: 'p2', title: 'No date', expiry: '' } as any],
  }, NOW);
  const ids = r.map((x) => x.id);
  assert.ok(ids.includes('pay-r1') && !ids.includes('pay-r2') && !ids.includes('pay-r3'));
  assert.ok(ids.includes('ct-c1-2d') && ids.includes('ct-c1-0d') && !ids.some((i) => i.startsWith('ct-c2')));
  assert.deepEqual(r.filter((x) => x.kind === 'document').map((x) => x.at), ['2026-12-31T10:00', '2027-01-30T10:00', '2027-02-22T10:00']);
  assert.deepEqual(r.map((x) => x.at), [...r.map((x) => x.at)].sort(), 'sorted');
});

test('reminders: capped at the OS limit, nearest kept', () => {
  const events = Array.from({ length: 100 }, (_, i) => ev({ id: `e${i}`, date: `2027-0${1 + (i % 9)}-${String(10 + (i % 18)).padStart(2, '0')}` }));
  const r = planReminders({ events, records: [], contracts: [], docs: [] }, NOW);
  assert.equal(r.length, MAX_REMINDERS);
  assert.equal(daysUntil('2026-12-15', '2026-11-10'), 35);
  assert.equal(daysUntil('2026-11-01', '2026-11-10'), -9);
});
