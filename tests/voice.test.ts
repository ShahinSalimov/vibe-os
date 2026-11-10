/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVoice } from '../src/lib/voiceParse';

const TODAY = '2026-11-10';
const pick = (d: object, keys: string[]) => Object.fromEntries(keys.map((k) => [k, (d as any)[k]]));

const CASES: [string, Record<string, unknown>][] = [
  // ---- Azerbaijani ----
  ['15 dekabr Bakıda toy, 3000 manat, avans 1000',
    { kind: 'event', eventType: 'wedding', date: '2026-12-15', city: 'Bakı', amount: 3000, advance: 1000, currency: 'AZN' }],
  ['Sabah saat 20:00 Gəncədə korporativ, 5 min manat',
    { kind: 'event', eventType: 'corporate', date: '2026-11-11', time: '20:00', city: 'Gəncə', amount: 5000, currency: 'AZN' }],
  ['20-ci yanvar restoranda çıxış 800 dollar',
    { kind: 'event', eventType: 'restaurant', date: '2027-01-20', amount: 800, currency: 'USD' }],
  ['Rauf-dan 500 manat aldım',
    { kind: 'income', amount: 500, currency: 'AZN', counterparty: 'Rauf' }],
  ['Səs operatoru Elnurə 300 manat verdim',
    { kind: 'expense', amount: 300, currency: 'AZN' }],
  ['Bu gün axşam saat 8-də ad günü, beh 200, ümumi 1500',
    { kind: 'event', eventType: 'private', date: '2026-11-10', time: '20:00', advance: 200, amount: 1500 }],
  // ---- Russian ----
  ['Свадьба 15 декабря в Баку, 3000 манат, аванс 1000',
    { kind: 'event', eventType: 'wedding', date: '2026-12-15', city: 'Баку', amount: 3000, advance: 1000, currency: 'AZN' }],
  ['Корпоратив завтра в 19:30 в Москве, 200 тысяч рублей, организатор Игорь',
    { kind: 'event', eventType: 'corporate', date: '2026-11-11', time: '19:30', city: 'Москва', amount: 200000, currency: 'RUB', counterparty: 'Игорь' }],
  ['Получил 1500 манат от Рауфа',
    { kind: 'income', amount: 1500, currency: 'AZN', counterparty: 'Рауф' }],
  ['Заплатил звукорежиссёру 300 манат',
    { kind: 'expense', amount: 300, currency: 'AZN' }],
  ['Концерт 3 марта в 8 вечера, 2500 долларов',
    { kind: 'event', eventType: 'concert', date: '2027-03-03', time: '20:00', amount: 2500, currency: 'USD' }],
  // ---- English ----
  ['Wedding on December 15 in Baku, 3000 manat, deposit 1000',
    { kind: 'event', eventType: 'wedding', date: '2026-12-15', city: 'Baku', amount: 3000, advance: 1000, currency: 'AZN' }],
  ['Corporate gig tomorrow at 7 pm in Dubai, 4k dollars, organizer Sarah',
    { kind: 'event', eventType: 'corporate', date: '2026-11-11', time: '19:00', city: 'Dubai', amount: 4000, currency: 'USD', counterparty: 'Sarah' }],
  ['Received 700 euro from Mark',
    { kind: 'income', amount: 700, currency: 'EUR', counterparty: 'Mark' }],
  ['Paid the driver 50 manat',
    { kind: 'expense', amount: 50, currency: 'AZN' }],
];

for (const [phrase, expected] of CASES) {
  test(`voice: ${phrase}`, () => {
    const d = parseVoice(phrase, TODAY);
    assert.deepEqual(pick(d, Object.keys(expected)), expected);
  });
}

test('voice: past date rolls to next year, invalid date ignored', () => {
  assert.equal(parseVoice('5 mart konsert', TODAY).date, '2027-03-05');
  assert.equal(parseVoice('31 fevral konsert', TODAY).date, undefined);
});

test('voice: empty and nonsense input are safe', () => {
  assert.deepEqual(parseVoice('', TODAY), { kind: 'income', raw: '' });
  const d = parseVoice('salam necəsən', TODAY);
  assert.equal(d.amount, undefined);
  assert.equal(d.date, undefined);
});

import { ruGenitiveToNominative } from '../src/lib/voiceParse';
test('voice: Russian genitive names', () => {
  assert.equal(ruGenitiveToNominative('Рауфа'), 'Рауф');
  assert.equal(ruGenitiveToNominative('Игоря'), 'Игорь');
  assert.equal(ruGenitiveToNominative('Лейлы'), 'Лейла');
  assert.equal(ruGenitiveToNominative('Марии'), 'Мария');
  assert.equal(ruGenitiveToNominative('Ольги'), 'Ольга');
  assert.equal(parseVoice('Получил 200 долларов от Игоря', '2026-11-10').counterparty, 'Игорь');
});
