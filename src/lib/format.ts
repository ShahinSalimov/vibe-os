import type { Currency, ISODate, Language } from './types';

// Deterministic formatting (does not depend on the device's Intl support).

const SYMBOL: Record<Currency, string> = {
  AZN: '₼',
  USD: '$',
  EUR: '€',
  RUB: '₽',
  TRY: '₺',
};

export function currencySymbol(c: Currency): string {
  return SYMBOL[c];
}

function groupInt(n: number, sep: string): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

export function formatNumber(value: number, lang: Language): string {
  const negative = value < 0;
  const abs = Math.abs(Math.round(value * 100) / 100);
  const int = Math.floor(abs);
  const frac = Math.round((abs - int) * 100);
  const thousands = lang === 'en' ? ',' : ' ';
  const decimal = lang === 'en' ? '.' : ',';
  let out = groupInt(int, thousands);
  if (frac > 0) out += decimal + String(frac).padStart(2, '0');
  return (negative ? '−' : '') + out;
}

export function formatMoney(value: number, currency: Currency, lang: Language): string {
  const num = formatNumber(value, lang);
  const sym = SYMBOL[currency];
  if (lang === 'en') {
    return num.startsWith('−') ? `−${sym}${num.slice(1)}` : `${sym}${num}`;
  }
  return `${num} ${sym}`;
}

/** Parses user-typed amounts like "1 250,50", "1,250.50", "3000". */
export function parseAmount(input: string): number | null {
  const s = input.replace(/[\s ₼$€₽₺]/g, '');
  if (!s) return null;
  let normalized = s;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // the later separator is the decimal one
    normalized =
      lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    const decimals = s.length - lastComma - 1;
    normalized = decimals === 3 && s.indexOf(',') === lastComma ? s.replace(',', '') : s.replace(',', '.');
  }
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export const MONTHS: Record<Language, { nom: string[]; gen: string[]; short: string[] }> = {
  az: {
    nom: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'],
    gen: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'],
    short: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avq', 'sen', 'okt', 'noy', 'dek'],
  },
  ru: {
    nom: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
    gen: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    short: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  },
  en: {
    nom: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    gen: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },
};

/** Monday-first short weekday names. */
export const WEEKDAYS: Record<Language, string[]> = {
  az: ['B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş', 'B'],
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
};

export function parseISODate(d: ISODate): { y: number; m: number; day: number } {
  const [y, m, day] = d.split('-').map(Number);
  return { y, m: m - 1, day };
}

export function toISODate(date: Date): ISODate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDate(d: ISODate, lang: Language, withYear = true): string {
  const { y, m, day } = parseISODate(d);
  const months = MONTHS[lang];
  if (lang === 'en') return withYear ? `${months.short[m]} ${day}, ${y}` : `${months.short[m]} ${day}`;
  return withYear ? `${day} ${months.gen[m]} ${y}` : `${day} ${months.gen[m]}`;
}

/** Days from `from` to `to` (both ISO), calendar-day based. */
export function daysBetween(from: ISODate, to: ISODate): number {
  const a = parseISODate(from);
  const b = parseISODate(to);
  const ua = Date.UTC(a.y, a.m, a.day);
  const ub = Date.UTC(b.y, b.m, b.day);
  return Math.round((ub - ua) / 86400000);
}

export function isValidTime(t: string): boolean {
  return t === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}
