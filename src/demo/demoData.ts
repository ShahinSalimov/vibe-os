// Sample data for the sales demo. Dates are relative to "today" so the demo never looks stale.
// Pure: no React Native imports, unit-tested.
import type {
  ArtistEvent,
  BookingRequest,
  Contact,
  Contract,
  ISODate,
  Language,
  MoneyRecord,
  Profile,
  Rider,
  Setlist,
  Song,
  Task,
} from '../lib/types';
import { defaultRiderSections, RIDER_TITLES } from '../docs/riderDefaults';

export interface DemoData {
  profile: Omit<Profile, 'createdAt'>;
  events: ArtistEvent[];
  records: MoneyRecord[];
  bookings: BookingRequest[];
  contacts: Contact[];
  songs: Song[];
  setlists: Setlist[];
  contracts: Contract[];
  riders: Rider[];
  tasks: Task[];
}

type L = Record<Language, string>;
const tr = (lang: Language, x: L) => x[lang];

function addDays(iso: ISODate, n: number): ISODate {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function buildDemoData(lang: Language, today: ISODate, nowIso: string): DemoData {
  const ts = nowIso;
  const d = (n: number) => addDays(today, n);
  const id = (p: string) => `demo-${p}`;

  const city = tr(lang, { az: 'Bakı', ru: 'Баку', en: 'Baku' });
  const events: ArtistEvent[] = [
    {
      id: id('ev-rehearsal'), title: tr(lang, { az: 'Toy proqramının məşqi', ru: 'Репетиция свадебной программы', en: 'Wedding set rehearsal' }),
      type: 'rehearsal', date: d(0), time: '12:00', venue: tr(lang, { az: 'Studiya', ru: 'Студия', en: 'Studio' }), city,
      organizer: '', organizerPhone: '', fee: 0, advance: 0, currency: 'AZN', notes: '', createdAt: ts, updatedAt: ts,
    },
    {
      id: id('ev-wedding'), title: tr(lang, { az: 'Toy · Fairmont', ru: 'Свадьба · Fairmont', en: 'Wedding · Fairmont' }),
      type: 'wedding', date: d(0), time: '19:30', venue: 'Fairmont', city, organizer: 'Rauf Məmmədov',
      organizerPhone: '+994 50 123 45 67', fee: 3000, advance: 1000, currency: 'AZN',
      notes: tr(lang, { az: '2 saatlıq proqram, ilk rəqs 21:00-da', ru: 'Программа 2 часа, первый танец в 21:00', en: '2-hour set, first dance at 21:00' }),
      createdAt: ts, updatedAt: ts,
    },
    {
      id: id('ev-corporate'), title: tr(lang, { az: 'Korporativ · Hilton', ru: 'Корпоратив · Hilton', en: 'Corporate · Hilton' }),
      type: 'corporate', date: d(1), time: '20:00', venue: 'Hilton', city, organizer: 'Nigar Əliyeva',
      organizerPhone: '+994 55 765 43 21', fee: 5000, advance: 5000, currency: 'AZN', notes: '', createdAt: ts, updatedAt: ts,
    },
    {
      id: id('ev-restaurant'), title: tr(lang, { az: 'Restoran · Nargiz', ru: 'Ресторан · Nargiz', en: 'Restaurant · Nargiz' }),
      type: 'restaurant', date: d(4), time: '21:00', venue: 'Nargiz', city, organizer: '', organizerPhone: '',
      fee: 800, advance: 0, currency: 'AZN', notes: '', createdAt: ts, updatedAt: ts,
    },
    {
      id: id('ev-concert'), title: tr(lang, { az: 'Solo konsert', ru: 'Сольный концерт', en: 'Solo concert' }),
      type: 'concert', date: d(18), time: '19:00', venue: tr(lang, { az: 'Yaşıl Teatr', ru: 'Зелёный театр', en: 'Green Theatre' }), city,
      organizer: 'Elvin Quliyev', organizerPhone: '', fee: 12000, advance: 4000, currency: 'AZN', notes: '', createdAt: ts, updatedAt: ts,
    },
    {
      id: id('ev-moscow'), title: tr(lang, { az: 'Moskva turu', ru: 'Гастроли в Москве', en: 'Moscow show' }),
      type: 'concert', date: d(32), time: '20:00', venue: 'Crocus', city: tr(lang, { az: 'Moskva', ru: 'Москва', en: 'Moscow' }),
      organizer: 'Igor Petrov', organizerPhone: '', fee: 6000, advance: 2000, currency: 'USD', notes: '', createdAt: ts, updatedAt: ts,
    },
    {
      id: id('ev-past'), title: tr(lang, { az: 'Ad günü · Four Seasons', ru: 'День рождения · Four Seasons', en: 'Birthday · Four Seasons' }),
      type: 'private', date: d(-6), time: '20:00', venue: 'Four Seasons', city, organizer: 'Leyla', organizerPhone: '',
      fee: 2500, advance: 2500, currency: 'AZN', notes: '', createdAt: ts, updatedAt: ts,
    },
  ];

  const fee = tr(lang, { az: 'Çıxış qonorarı', ru: 'Гонорар', en: 'Performance fee' });
  const rec = (p: Partial<MoneyRecord> & Pick<MoneyRecord, 'id' | 'kind' | 'counterparty' | 'amount'>): MoneyRecord => ({
    paidAmount: 0, currency: 'AZN', date: today, status: 'planned', category: '', note: '', createdAt: ts, updatedAt: ts, ...p,
  });
  const records: MoneyRecord[] = [
    rec({ id: id('r-wedding'), kind: 'income', counterparty: 'Rauf Məmmədov', amount: 3000, paidAmount: 1000, status: 'partial', date: d(0), category: fee, eventId: id('ev-wedding') }),
    rec({ id: id('r-corp'), kind: 'income', counterparty: 'Nigar Əliyeva', amount: 5000, paidAmount: 5000, status: 'paid', date: d(-2), category: fee, eventId: id('ev-corporate') }),
    rec({ id: id('r-past'), kind: 'income', counterparty: 'Leyla', amount: 2500, paidAmount: 2500, status: 'paid', date: d(-6), category: fee, eventId: id('ev-past') }),
    rec({ id: id('r-late'), kind: 'income', counterparty: 'Elvin Quliyev', amount: 1500, paidAmount: 500, status: 'overdue', date: d(-4), category: fee }),
    rec({ id: id('r-concert'), kind: 'income', counterparty: 'Elvin Quliyev', amount: 12000, paidAmount: 4000, status: 'partial', date: d(18), category: fee, eventId: id('ev-concert') }),
    rec({ id: id('r-sound'), kind: 'expense', counterparty: tr(lang, { az: 'Səs operatoru', ru: 'Звукорежиссёр', en: 'Sound engineer' }), amount: 300, paidAmount: 300, status: 'paid', date: d(-6), category: tr(lang, { az: 'Komanda', ru: 'Команда', en: 'Crew' }) }),
    rec({ id: id('r-dress'), kind: 'expense', counterparty: 'Atelier', amount: 900, paidAmount: 900, status: 'paid', date: d(-3), category: tr(lang, { az: 'Səhnə geyimi', ru: 'Сценический костюм', en: 'Stage outfit' }) }),
    rec({ id: id('r-band'), kind: 'expense', counterparty: tr(lang, { az: 'Musiqiçilər', ru: 'Музыканты', en: 'Band' }), amount: 1200, paidAmount: 0, status: 'planned', date: d(1), category: tr(lang, { az: 'Komanda', ru: 'Команда', en: 'Crew' }) }),
  ];

  const bookings: BookingRequest[] = [
    {
      id: id('b-wedding'), source: 'link', organizerName: 'Kamran Hüseynov', phone: '+994 70 222 33 44', email: '',
      eventType: 'wedding', date: d(45), city, venue: 'Ritz-Carlton', guests: 300, budget: 4000, currency: 'AZN',
      message: tr(lang, { az: 'Salam! Qızımın toyu üçün 2 saatlıq proqram istəyirik.', ru: 'Здравствуйте! Нужна программа на 2 часа на свадьбу дочери.', en: 'Hello! We would like a 2-hour set for our daughter’s wedding.' }),
      language: lang, status: 'new', createdAt: ts, updatedAt: ts,
    },
    {
      id: id('b-corp'), source: 'link', organizerName: 'PASHA Holding', phone: '', email: 'events@example.az',
      eventType: 'corporate', date: d(60), city, venue: '', guests: 150, budget: null, currency: 'AZN',
      message: tr(lang, { az: 'Yeni il korporativi üçün qiymət təklifi göndərin.', ru: 'Пришлите предложение на новогодний корпоратив.', en: 'Please send a quote for our New Year party.' }),
      language: lang, status: 'negotiating', createdAt: ts, updatedAt: ts,
    },
  ];

  const contacts: Contact[] = [
    { id: id('c-rauf'), name: 'Rauf Məmmədov', kind: 'organizer', phone: '+994 50 123 45 67', email: '', note: '', createdAt: ts, updatedAt: ts },
    { id: id('c-nigar'), name: 'Nigar Əliyeva', kind: 'organizer', phone: '+994 55 765 43 21', email: '', note: '', createdAt: ts, updatedAt: ts },
    { id: id('c-sound'), name: 'Tural (səs)', kind: 'team', phone: '+994 51 111 22 33', email: '', note: '', createdAt: ts, updatedAt: ts },
  ];

  const song = (sid: string, title: string, stage: Song['stage'], key: string, bpm: number, sec: number): Song => ({
    id: id(sid), title, stage, musicalKey: key, bpm, durationSec: sec, lyrics: '', authors: '', notes: '', releaseDate: '', createdAt: ts, updatedAt: ts,
  });
  const songs: Song[] = [
    song('s-1', tr(lang, { az: 'Gecələr', ru: 'Ночи', en: 'Nights' }), 'released', 'Am', 96, 215),
    song('s-2', tr(lang, { az: 'Sevgilim', ru: 'Любимый', en: 'My love' }), 'released', 'Dm', 104, 250),
    song('s-3', tr(lang, { az: 'Bakı yağışı', ru: 'Бакинский дождь', en: 'Baku rain' }), 'arrangement', 'Em', 88, 230),
    { ...song('s-4', tr(lang, { az: 'Yeni mahnı (ideya)', ru: 'Новая песня (идея)', en: 'New song (idea)' }), 'idea', '', 0, 0), bpm: null, durationSec: null },
  ];

  const setlists: Setlist[] = [
    {
      id: id('sl-wedding'), title: tr(lang, { az: 'Toy proqramı', ru: 'Свадебная программа', en: 'Wedding set' }),
      eventId: id('ev-wedding'), songIds: [id('s-2'), id('s-1'), id('s-3')], createdAt: ts, updatedAt: ts,
    },
  ];

  const contracts: Contract[] = [
    {
      id: id('ct-concert'), title: tr(lang, { az: 'Solo konsert müqaviləsi', ru: 'Договор на сольный концерт', en: 'Solo concert agreement' }),
      template: 'performance', language: lang, eventId: id('ev-concert'), counterparty: 'Elvin Quliyev', amount: 12000,
      currency: 'AZN', status: 'sent', deadline: d(3), body: '', createdAt: ts, updatedAt: ts,
    },
  ];

  const riders: Rider[] = [
    { id: id('rd-tech'), kind: 'technical', title: RIDER_TITLES[lang].technical, language: lang, sections: defaultRiderSections('technical', lang), notes: '', createdAt: ts, updatedAt: ts },
  ];

  const tasks: Task[] = [
    { id: id('t-1'), title: tr(lang, { az: 'Səs operatoru ilə saundçek saatını dəqiqləşdir', ru: 'Согласовать саундчек со звукорежиссёром', en: 'Confirm soundcheck time with the engineer' }), note: '', assigneeId: '', due: d(0), done: false, createdAt: ts, updatedAt: ts },
    { id: id('t-2'), title: tr(lang, { az: 'Konsert afişasını təsdiqlə', ru: 'Утвердить афишу концерта', en: 'Approve the concert poster' }), note: '', assigneeId: '', due: d(2), done: false, createdAt: ts, updatedAt: ts },
    { id: id('t-3'), title: tr(lang, { az: 'Moskva üçün vizanı yoxla', ru: 'Проверить визу для Москвы', en: 'Check the visa for Moscow' }), note: '', assigneeId: '', due: d(-1), done: false, createdAt: ts, updatedAt: ts },
  ];

  return {
    profile: { stageName: tr(lang, { az: 'Aysel (demo)', ru: 'Айсель (демо)', en: 'Aysel (demo)' }), role: 'singer', genre: 'Pop' },
    events, records, bookings, contacts, songs, setlists, contracts, riders, tasks,
  };
}
