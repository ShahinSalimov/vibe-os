// Turns a spoken sentence (AZ / RU / EN) into a draft record.
// Rule-based and on-device: no AI cost, no data leaves the phone, fully testable.
// The result only PRE-FILLS a form; the user always reviews and saves.
import type { Currency, EventType, ISODate, Language } from './types';

export interface VoiceDraft {
  kind: 'event' | 'income' | 'expense';
  eventType?: EventType;
  date?: ISODate;
  time?: string;
  city?: string;
  amount?: number;
  advance?: number;
  currency?: Currency;
  counterparty?: string;
  raw: string;
}

// ---------- vocabulary ----------

const MONTHS: string[][] = [
  ['yanvar', 'январ', 'january', 'jan'],
  ['fevral', 'феврал', 'february', 'feb'],
  ['mart', 'март', 'march', 'mar'],
  ['aprel', 'апрел', 'april', 'apr'],
  ['may', 'мая', 'май', 'мае', 'may'],
  ['iyun', 'июн', 'june', 'jun'],
  ['iyul', 'июл', 'july', 'jul'],
  ['avqust', 'август', 'august', 'aug'],
  ['sentyabr', 'сентябр', 'september', 'sep', 'sept'],
  ['oktyabr', 'октябр', 'october', 'oct'],
  ['noyabr', 'ноябр', 'november', 'nov'],
  ['dekabr', 'декабр', 'december', 'dec'],
];
// stems that must match the whole word (too short / ambiguous as prefixes)
const EXACT_MONTH = new Set(['may', 'мая', 'май', 'мае', 'mar', 'jan', 'feb', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec']);

const EVENT_TYPES: [EventType, string[]][] = [
  ['wedding', ['toy', 'nişan', 'свадьб', 'wedding', 'помолвк', 'engagement']],
  ['corporate', ['korporativ', 'корпоратив', 'corporate']],
  ['festival', ['festival', 'фестивал']],
  ['concert', ['konsert', 'концерт', 'concert', 'gig']],
  ['rehearsal', ['məşq', 'репетиц', 'rehearsal']],
  ['studio', ['studiya', 'студи', 'studio']],
  ['tv', ['televiziya', 'телевиден', 'эфир', 'efir', 'radio', 'радио', 'television']],
  ['restaurant', ['restoran', 'ресторан', 'restaurant', 'klub', 'клуб', 'club']],
  ['private', ['yubiley', 'юбилей', 'birthday', 'вечеринк', 'party', 'məclis']],
];
const PHRASE_TYPES: [EventType, RegExp][] = [
  ['private', /ad\s+gün|день\s+рожд/u],
  ['tv', /(?<!\p{L})tv(?!\p{L})|(?<!\p{L})тв(?!\p{L})/u],
];

const CURRENCIES: [Currency, string[]][] = [
  ['AZN', ['manat', 'манат', 'azn', '₼']],
  ['USD', ['dollar', 'dolar', 'доллар', 'бакс', 'usd', '$']],
  ['EUR', ['avro', 'euro', 'евро', 'eur', '€']],
  ['RUB', ['rubl', 'рубл', 'руб', 'rub', '₽']],
  ['TRY', ['lira', 'лир', 'try', '₺']],
];

export const CITIES: { az: string; ru: string; en: string; stems: string[] }[] = [
  { az: 'Bakı', ru: 'Баку', en: 'Baku', stems: ['bakı', 'baki', 'баку', 'baku'] },
  { az: 'Gəncə', ru: 'Гянджа', en: 'Ganja', stems: ['gəncə', 'gence', 'гяндж', 'ganja'] },
  { az: 'Sumqayıt', ru: 'Сумгаит', en: 'Sumgait', stems: ['sumqayıt', 'sumqayit', 'сумгаит', 'сумгайыт', 'sumgait'] },
  { az: 'Şəki', ru: 'Шеки', en: 'Sheki', stems: ['şəki', 'шеки', 'sheki'] },
  { az: 'Lənkəran', ru: 'Ленкорань', en: 'Lankaran', stems: ['lənkəran', 'ленкоран', 'lankaran'] },
  { az: 'Quba', ru: 'Губа', en: 'Guba', stems: ['quba', 'guba'] },
  { az: 'Qəbələ', ru: 'Габала', en: 'Gabala', stems: ['qəbələ', 'габал', 'gabala'] },
  { az: 'Mingəçevir', ru: 'Мингечевир', en: 'Mingachevir', stems: ['mingəçevir', 'мингечевир', 'mingachevir'] },
  { az: 'Naxçıvan', ru: 'Нахчыван', en: 'Nakhchivan', stems: ['naxçıvan', 'нахчыван', 'нахичеван', 'nakhchivan'] },
  { az: 'Şamaxı', ru: 'Шамахы', en: 'Shamakhi', stems: ['şamaxı', 'шамах', 'shamakhi'] },
  { az: 'Xırdalan', ru: 'Хырдалан', en: 'Khirdalan', stems: ['xırdalan', 'хырдалан', 'khirdalan'] },
  { az: 'Moskva', ru: 'Москва', en: 'Moscow', stems: ['moskva', 'москв', 'moscow'] },
  { az: 'İstanbul', ru: 'Стамбул', en: 'Istanbul', stems: ['istanbul', 'стамбул'] },
  { az: 'Dubay', ru: 'Дубай', en: 'Dubai', stems: ['dubay', 'дубай', 'dubai'] },
  { az: 'Tbilisi', ru: 'Тбилиси', en: 'Tbilisi', stems: ['tbilisi', 'тбилиси'] },
];

const ADVANCE_WORDS = ['avans', 'beh', 'аванс', 'предоплат', 'задаток', 'advance', 'deposit', 'prepay'];
const EXPENSE_WORDS = ['xərc', 'ödədim', 'verdim', 'ödəmişəm', 'расход', 'заплатил', 'потратил', 'отдал', 'оплатил', 'expense', 'paid', 'spent', 'gave'];
const INCOME_WORDS = ['gəlir', 'aldım', 'verdi', 'ödədi', 'köçürdü', 'доход', 'получил', 'перевел', 'перевёл', 'income', 'received', 'earned', 'got'];
const EVENING_WORDS = ['axşam', 'вечер', 'evening', 'night', 'gecə', 'ночи', 'pm'];
const MORNING_WORDS = ['səhər', 'утра', 'утром', 'morning', 'am'];
const THOUSAND = ['min', 'тысяч', 'тыс', 'thousand', 'k'];
const ORGANIZER_WORDS = ['təşkilatçı', 'sifarişçi', 'организатор', 'заказчик', 'organizer', 'organiser', 'client'];

// ---------- helpers ----------

const NOT_LETTER = '(?<![\\p{L}\\d])';
const END = '(?![\\p{L}])';

function lower(s: string): string {
  return s.replace(/İ/g, 'i').toLowerCase();
}

/** Words with original casing preserved alongside their lowercase form. */
function words(text: string): { orig: string; low: string }[] {
  return (text.match(/[\p{L}\d₼$€₽₺'’-]+/gu) ?? []).map((w) => ({ orig: w.replace(/['’-]+$/, ''), low: lower(w) }));
}

const startsWithAny = (w: string, stems: string[]) => stems.some((s) => w.startsWith(s));

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function isoFromParts(y: number, m: number, d: number): ISODate | null {
  const dt = new Date(Date.UTC(y, m, d));
  if (dt.getUTCMonth() !== m || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function addDays(iso: ISODate, n: number): ISODate {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

function monthIndex(word: string): number {
  for (let i = 0; i < MONTHS.length; i++) {
    for (const stem of MONTHS[i]) {
      if (EXACT_MONTH.has(stem) ? word === stem : word.startsWith(stem)) return i;
    }
  }
  return -1;
}

/** Number with optional "thousand" multiplier. "3", "3 000", "3,5 min", "3 тысячи", "3k". */
function readNumber(s: string): number | null {
  const m = s.match(/^(\d+(?:[  ]\d{3})*(?:[.,]\d+)?)\s*(\p{L}+|k)?/u);
  if (!m) return null;
  let n = Number(m[1].replace(/[  ]/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  if (m[2] && THOUSAND.some((t) => lower(m[2]!).startsWith(t))) n *= 1000;
  return n;
}

// ---------- main ----------

export function parseVoice(text: string, today: ISODate): VoiceDraft {
  const raw = text.trim();
  const draft: VoiceDraft = { kind: 'income', raw };
  if (!raw) return draft;
  let rest = ` ${lower(raw)} `;
  const ws = words(raw);
  const consume = (re: RegExp) => {
    rest = rest.replace(re, ' ');
  };

  // --- relative dates (longest first) ---
  const rel: [RegExp, number][] = [
    [/day after tomorrow|послезавтра|birigün|biri\s*gün|o\s+biri\s+gün/u, 2],
    [/tomorrow|завтра|sabah/u, 1],
    [/today|сегодня|bu\s*gün/u, 0],
  ];
  for (const [re, n] of rel) {
    if (re.test(rest)) {
      draft.date = addDays(today, n);
      consume(re);
      break;
    }
  }

  // --- absolute dates: "15 dekabr", "15-ci dekabr", "15 декабря", "December 15", "15 December" ---
  if (!draft.date) {
    const dayFirst = new RegExp(`${NOT_LETTER}(\\d{1,2})(?:-?(?:ci|cı|cu|cü|nci|ncı|ncu|ncü|ün|in|st|nd|rd|th|го|е|ое))?\\s+(\\p{L}+)`, 'gu');
    const monthFirst = new RegExp(`${NOT_LETTER}(\\p{L}+)\\s+(\\d{1,2})(?:st|nd|rd|th)?${END}`, 'gu');
    let found: { d: number; m: number; match: string } | null = null;
    for (const m of rest.matchAll(dayFirst)) {
      const mi = monthIndex(m[2]);
      if (mi >= 0) {
        found = { d: Number(m[1]), m: mi, match: m[0] };
        break;
      }
    }
    if (!found) {
      for (const m of rest.matchAll(monthFirst)) {
        const mi = monthIndex(m[1]);
        if (mi >= 0) {
          found = { d: Number(m[2]), m: mi, match: m[0] };
          break;
        }
      }
    }
    if (found) {
      const ty = Number(today.slice(0, 4));
      let iso = isoFromParts(ty, found.m, found.d);
      if (iso && iso < today) iso = isoFromParts(ty + 1, found.m, found.d);
      if (iso) {
        draft.date = iso;
        rest = rest.replace(found.match, ' ');
      }
    }
  }

  // --- time ---
  const evening = EVENING_WORDS.some((w) => new RegExp(`${NOT_LETTER}${w}`, 'u').test(rest));
  const morning = MORNING_WORDS.some((w) => new RegExp(`${NOT_LETTER}${w}${END}`, 'u').test(rest));
  const timeRes: RegExp[] = [
    /(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?!\d)/u,
    /saat\s*(\d{1,2})(?:[:.](\d{2}))?(?:\s*-?\s*(?:da|də|də|a|ə|dan|dən))?/u,
    /(?<!\p{L})в\s+(\d{1,2})(?:[:.](\d{2}))?\s*(?:час\p{L}*|ч(?!\p{L})|вечера|утра)/u,
    /(?<!\p{L})at\s+(\d{1,2})(?::(\d{2}))?\s*(?=am|pm|o'?clock|in the evening)/u,
  ];
  for (const re of timeRes) {
    const m = rest.match(re);
    if (m) {
      let h = Number(m[1]);
      const min = m[2] ? Number(m[2]) : 0;
      if (h <= 23 && min <= 59) {
        if (evening && h < 12) h += 12;
        if (morning && h === 12) h = 0;
        draft.time = `${pad(h)}:${pad(min)}`;
        consume(re);
        break;
      }
    }
  }

  // --- event type ---
  for (const [type, re] of PHRASE_TYPES) {
    if (re.test(rest)) {
      draft.eventType = type;
      break;
    }
  }
  if (!draft.eventType) {
    outer: for (const w of words(rest)) {
      for (const [type, stems] of EVENT_TYPES) {
        if (startsWithAny(w.low, stems)) {
          draft.eventType = type;
          break outer;
        }
      }
    }
  }

  // --- city ---
  const lang: Language = /[а-яё]/i.test(raw) ? 'ru' : /[əğışçöü]/i.test(raw) ? 'az' : 'en';
  for (const w of ws) {
    const c = CITIES.find((city) => startsWithAny(w.low, city.stems));
    if (c) {
      draft.city = c[lang];
      break;
    }
  }

  // --- currency ---
  for (const [cur, stems] of CURRENCIES) {
    if (stems.some((s) => (s.length === 1 ? rest.includes(s) : new RegExp(`${NOT_LETTER}${s}`, 'u').test(rest)))) {
      draft.currency = cur;
      break;
    }
  }

  // --- advance: keyword followed (or preceded) by a number ---
  for (const kw of ADVANCE_WORDS) {
    const after = new RegExp(`${NOT_LETTER}${kw}\\p{L}*\\s*(?:\\p{L}+\\s+){0,2}?(\\d[\\d \\u00A0.,]*\\s*(?:\\p{L}+)?)`, 'u');
    const before = new RegExp(`(\\d[\\d \\u00A0.,]*\\s*(?:min|тысяч\\p{L}*|тыс|thousand|k)?)\\s*(?:\\p{L}+\\s+)?${kw}`, 'u');
    const m = rest.match(after) ?? rest.match(before);
    if (m) {
      const n = readNumber(m[1].trim());
      if (n !== null) {
        draft.advance = n;
        rest = rest.replace(m[0], ' ');
        break;
      }
    }
  }

  // --- main amount: prefer a number next to a currency word, else the largest remaining number ---
  const numbers: { n: number; withCurrency: boolean }[] = [];
  const numRe = /(?<![\d:])(\d+(?:[  ]\d{3})*(?:[.,]\d+)?)\s*((?:\p{L}+|k|[₼$€₽₺])?)/gu;
  for (const m of rest.matchAll(numRe)) {
    const n = readNumber(`${m[1]} ${m[2] ?? ''}`.trim());
    if (n === null) continue;
    const next = lower(m[2] ?? '');
    const following = rest.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 12);
    const withCurrency = CURRENCIES.some(([, stems]) => stems.some((s) => next.startsWith(s) || lower(following).trimStart().startsWith(s)));
    numbers.push({ n, withCurrency });
  }
  const cur = numbers.filter((x) => x.withCurrency);
  const pick = cur.length ? cur[0] : numbers.filter((x) => x.n >= 10).sort((a, b) => b.n - a.n)[0];
  if (pick) draft.amount = pick.n;

  // --- kind ---
  const hasWord = (list: string[]) => ws.some((w) => list.some((k) => w.low === k || w.low.startsWith(k)));
  const hasExact = (list: string[]) => ws.some((w) => list.includes(w.low));
  if (draft.eventType) draft.kind = 'event';
  else if (hasExact(EXPENSE_WORDS) || hasWord(['xərc', 'расход', 'expense', 'потратил', 'заплатил', 'оплатил'])) draft.kind = 'expense';
  else if (hasWord(INCOME_WORDS)) draft.kind = 'income';
  else if (draft.date || draft.time || draft.city) draft.kind = 'event';

  // --- counterparty / organizer ---
  draft.counterparty = findName(raw, ws, lang);

  return draft;
}

function isVocabulary(low: string): boolean {
  return (
    monthIndex(low) >= 0 ||
    CITIES.some((c) => startsWithAny(low, c.stems)) ||
    EVENT_TYPES.some(([, s]) => startsWithAny(low, s)) ||
    CURRENCIES.some(([, s]) => startsWithAny(low, s.filter((x) => x.length > 2))) ||
    [...ADVANCE_WORDS, ...EXPENSE_WORDS, ...INCOME_WORDS, ...ORGANIZER_WORDS, ...EVENING_WORDS, ...MORNING_WORDS].some((k) =>
      low.startsWith(k),
    ) ||
    ['bu', 'sabah', 'saat', 'today', 'tomorrow', 'сегодня', 'завтра', 'from', 'to', 'for', 'от', 'для', 'в', 'и', 'and', 'at'].includes(low)
  );
}

/** Organizer / counterparty name from explicit markers, then from capitalised words. */
function findName(raw: string, ws: { orig: string; low: string }[], lang: Language): string | undefined {
  const marker = new RegExp(
    `(?:${ORGANIZER_WORDS.join('|')}|(?<!\\p{L})(?:from|to|for|от|для)(?!\\p{L}))\\s*[:-]?\\s+(\\p{Lu}[\\p{L}'’-]*)`,
    'iu',
  );
  const m = raw.match(marker);
  if (m && !isVocabulary(lower(m[1]))) {
    // Russian "от Рауфа / от Игоря / от Лейлы" is genitive -> back to the base name
    if (lang === 'ru' && /(?:^|\s)от\s/iu.test(m[0])) return ruGenitiveToNominative(m[1]);
    return cleanName(m[1], lang);
  }

  // Azerbaijani ablative: "Rauf-dan", "Elvindən", "Ramildən"
  if (lang === 'az') {
    const abl = raw.match(/(\p{Lu}[\p{L}]+?)['’-]?(?:dan|dən)(?!\p{L})/u);
    if (abl && !isVocabulary(lower(abl[1]))) return abl[1];
  }
  const cap = ws.find((w) => /^\p{Lu}/u.test(w.orig) && w.orig.length > 1 && !isVocabulary(w.low) && !/\d/.test(w.orig));
  return cap ? cleanName(cap.orig, lang) : undefined;
}

function cleanName(name: string, lang: Language): string {
  let n = name.replace(/['’-]+$/, '');
  if (lang === 'az') n = n.replace(/['’-](?:dan|dən|ya|yə|a|ə|un|ün|in|ın)$/u, '');
  return n;
}

/** Common Russian genitive endings for first names: Рауфа->Рауф, Игоря->Игорь, Лейлы->Лейла, Марии->Мария. */
export function ruGenitiveToNominative(name: string): string {
  if (name.length < 4) return name;
  if (/ии$/u.test(name)) return name.slice(0, -1) + 'я';
  if (/ы$/u.test(name)) return name.slice(0, -1) + 'а';
  if (/[гкх]и$/u.test(name)) return name.slice(0, -1) + 'а';
  if (/я$/u.test(name)) return name.slice(0, -1) + 'ь';
  if (/[бвгджзклмнпрстфхцчшщ]а$/u.test(name)) return name.slice(0, -1);
  return name;
}
