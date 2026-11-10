/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectSensitive, detectSensitiveIn, ibanValid, luhnValid } from '../src/lib/sensitive';
import { formatDate, formatMoney, parseAmount, daysBetween, isValidTime } from '../src/lib/format';
import { balancesByCounterparty, deriveStatus, outstanding, summarize } from '../src/lib/finance';
import type { MoneyRecord } from '../src/lib/types';
import az from '../src/i18n/locales/az';
import en from '../src/i18n/locales/en';
import ru from '../src/i18n/locales/ru';

// ---------- payment-data guard ----------
test('Luhn: valid test card numbers', () => {
  assert.equal(luhnValid('4111111111111111'), true);
  assert.equal(luhnValid('5500000000000004'), true);
  assert.equal(luhnValid('4111111111111112'), false);
});

test('detects card numbers in free text, with spaces or dashes', () => {
  assert.equal(detectSensitive('karta at: 4111 1111 1111 1111'), 'card');
  assert.equal(detectSensitive('4111-1111-1111-1111'), 'card');
  assert.equal(detectSensitive('5500000000000004'), 'card');
});

test('detects valid IBANs (AZ and DE examples)', () => {
  assert.equal(ibanValid('DE89370400440532013000'), true);
  assert.equal(ibanValid('GB82 WEST 1234 5698 7654 32'), true);
  assert.equal(ibanValid('DE89370400440532013001'), false);
  assert.equal(detectSensitive('hesab: DE89 3704 0044 0532 0130 00'), 'iban');
});

test('does not flag normal text, phones, amounts, dates', () => {
  for (const s of [
    'Wedding at Fairmont, 3000 AZN',
    '+994 50 123 45 67',
    '+7 (912) 345-67-89',
    '2026-12-15 20:00',
    'Toy Bakıda, avans 1000',
    '1234567890123', // 13 digits, fails Luhn
    '',
  ]) {
    assert.equal(detectSensitive(s), null, s);
  }
  assert.equal(detectSensitiveIn(['ok', 'also ok']), null);
  assert.equal(detectSensitiveIn(['ok', '4111111111111111']), 'card');
});

// ---------- formatting ----------
test('money formatting per language', () => {
  assert.equal(formatMoney(1250.5, 'AZN', 'en'), '₼1,250.50');
  assert.equal(formatMoney(1250.5, 'AZN', 'az'), '1 250,50 ₼');
  assert.equal(formatMoney(3000, 'RUB', 'ru'), '3 000 ₽');
  assert.equal(formatMoney(-200, 'USD', 'en'), '−$200');
  assert.equal(formatMoney(0, 'EUR', 'en'), '€0');
});

test('parseAmount accepts common input styles', () => {
  assert.equal(parseAmount('3000'), 3000);
  assert.equal(parseAmount('1 250,50'), 1250.5);
  assert.equal(parseAmount('1,250.50'), 1250.5);
  assert.equal(parseAmount('1.250,50'), 1250.5);
  assert.equal(parseAmount('1,250'), 1250);
  assert.equal(parseAmount('12,5'), 12.5);
  assert.equal(parseAmount('3000 ₼'), 3000);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount(''), null);
});

test('dates per language', () => {
  assert.equal(formatDate('2026-12-15', 'az'), '15 dekabr 2026');
  assert.equal(formatDate('2026-12-15', 'ru'), '15 декабря 2026');
  assert.equal(formatDate('2026-12-15', 'en'), 'Dec 15, 2026');
  assert.equal(daysBetween('2026-12-30', '2027-01-02'), 3);
  assert.equal(isValidTime('20:00'), true);
  assert.equal(isValidTime('24:00'), false);
  assert.equal(isValidTime(''), true);
});

// ---------- finance ----------
const rec = (p: Partial<MoneyRecord>): MoneyRecord => ({
  id: Math.random().toString(),
  kind: 'income',
  counterparty: 'Organizer',
  amount: 0,
  paidAmount: 0,
  currency: 'AZN',
  date: '2026-11-05',
  status: 'planned',
  category: '',
  note: '',
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
  ...p,
});

test('deriveStatus', () => {
  assert.equal(deriveStatus(3000, 3000, 'planned'), 'paid');
  assert.equal(deriveStatus(3000, 1000, 'planned'), 'partial');
  assert.equal(deriveStatus(3000, 0, 'planned'), 'planned');
  assert.equal(deriveStatus(3000, 1000, 'overdue'), 'overdue');
  assert.equal(deriveStatus(3000, 0, 'paid'), 'paid');
});

test('summary: settled money in range, all-time balances, single currency', () => {
  const records = [
    rec({ amount: 3000, paidAmount: 1000, status: 'partial' }), // wedding: 1000 in, 2000 owed
    rec({ amount: 500, status: 'paid' }),
    rec({ kind: 'expense', counterparty: 'Sound', amount: 300, status: 'paid' }),
    rec({ kind: 'expense', counterparty: 'Band', amount: 400, status: 'planned' }),
    rec({ amount: 999, status: 'paid', currency: 'USD' }), // other currency ignored
    rec({ amount: 700, status: 'paid', date: '2026-10-01' }), // outside month
  ];
  const s = summarize(records, 'AZN', { from: '2026-11-01', to: '2026-11-31' });
  assert.deepEqual(s, { income: 1500, expense: 300, net: 1200, owedToYou: 2000, youOwe: 400 });
  assert.equal(outstanding(records[0]), 2000);
});

test('who owes whom groups by counterparty + currency', () => {
  const b = balancesByCounterparty([
    rec({ counterparty: 'Elvin', amount: 3000, paidAmount: 1000, status: 'partial' }),
    rec({ counterparty: 'elvin ', amount: 500, status: 'planned' }),
    rec({ kind: 'expense', counterparty: 'Band', amount: 400, status: 'planned' }),
    rec({ counterparty: 'Paid guy', amount: 100, status: 'paid' }),
  ]);
  assert.equal(b.length, 2);
  assert.equal(b[0].name, 'Elvin');
  assert.equal(b[0].owedToYou, 2500);
  assert.equal(b[1].youOwe, 400);
});

// ---------- i18n completeness ----------
function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

test('AZ and RU contain every English key, with no empty strings', () => {
  const base = keys(en);
  for (const [name, dict] of [['az', az], ['ru', ru]] as const) {
    const have = new Set(keys(dict));
    const missing = base.filter((k) => !have.has(k));
    assert.deepEqual(missing, [], `${name} missing keys`);
    for (const k of have) {
      const v = k.split('.').reduce<any>((o, p) => o[p], dict);
      assert.ok(typeof v === 'string' && v.trim().length > 0, `${name}.${k} empty`);
    }
  }
});

test('Russian has full plural forms for every pluralized key', () => {
  const plural = keys(en).filter((k) => k.endsWith('_one')).map((k) => k.slice(0, -4));
  const have = new Set(keys(ru));
  for (const base of plural) {
    for (const form of ['one', 'few', 'many', 'other']) {
      assert.ok(have.has(`${base}_${form}`), `ru ${base}_${form}`);
    }
  }
});

test('interpolation placeholders match across languages', () => {
  const ph = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort().join(',');
  for (const k of keys(en)) {
    const get = (d: object) => k.split('.').reduce<any>((o, p) => o?.[p], d);
    for (const [name, dict] of [['az', az], ['ru', ru]] as const) {
      assert.equal(ph(get(dict)), ph(get(en)), `${name}.${k}`);
    }
  }
});
