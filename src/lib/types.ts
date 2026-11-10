export type Language = 'az' | 'ru' | 'en';
export type Currency = 'AZN' | 'USD' | 'EUR' | 'RUB' | 'TRY';

export const LANGUAGES: Language[] = ['az', 'ru', 'en'];
export const CURRENCIES: Currency[] = ['AZN', 'USD', 'EUR', 'RUB', 'TRY'];

export type ArtistRole = 'singer' | 'musician' | 'dj' | 'producer' | 'band' | 'manager';
export const ARTIST_ROLES: ArtistRole[] = ['singer', 'musician', 'dj', 'producer', 'band', 'manager'];

export type EventType =
  | 'concert'
  | 'wedding'
  | 'corporate'
  | 'private'
  | 'restaurant'
  | 'tv'
  | 'festival'
  | 'rehearsal'
  | 'studio';
export const EVENT_TYPES: EventType[] = [
  'wedding',
  'concert',
  'corporate',
  'restaurant',
  'private',
  'tv',
  'festival',
  'rehearsal',
  'studio',
];

export interface Profile {
  stageName: string;
  role: ArtistRole;
  genre: string;
  createdAt: string;
}

export interface Settings {
  language: Language;
  currency: Currency;
  appLock: boolean;
}

/** ISO date "YYYY-MM-DD" */
export type ISODate = string;

export interface ArtistEvent {
  id: string;
  title: string;
  type: EventType;
  date: ISODate;
  time: string; // "HH:MM" or ""
  venue: string;
  city: string;
  organizer: string;
  organizerPhone: string;
  fee: number;
  advance: number;
  currency: Currency;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type TxKind = 'income' | 'expense';
export type TxStatus = 'planned' | 'partial' | 'paid' | 'overdue';
export const TX_STATUSES: TxStatus[] = ['planned', 'partial', 'paid', 'overdue'];

/**
 * A money RECORD. VIBE OS never moves money: this is bookkeeping only
 * (who -> whom, how much, when, status). No card / bank data is stored.
 */
export interface MoneyRecord {
  id: string;
  kind: TxKind;
  counterparty: string;
  amount: number;
  paidAmount: number;
  currency: Currency;
  date: ISODate;
  status: TxStatus;
  category: string;
  note: string;
  eventId?: string;
  createdAt: string;
  updatedAt: string;
}

export type BookingStatus = 'new' | 'negotiating' | 'confirmed' | 'declined';
export const BOOKING_STATUSES: BookingStatus[] = ['new', 'negotiating', 'confirmed', 'declined'];

/** A booking request from an organizer (public link) or entered manually. */
export interface BookingRequest {
  id: string;
  source: 'link' | 'manual';
  organizerName: string;
  phone: string;
  email: string;
  eventType: EventType;
  date: ISODate;
  city: string;
  venue: string;
  guests: number | null;
  budget: number | null;
  currency: Currency;
  message: string;
  language: Language;
  status: BookingStatus;
  eventId?: string;
  createdAt: string;
  updatedAt: string;
}

export type ContactKind = 'organizer' | 'venue' | 'sponsor' | 'team' | 'media' | 'other';
export const CONTACT_KINDS: ContactKind[] = ['organizer', 'venue', 'sponsor', 'team', 'media', 'other'];

export interface Contact {
  id: string;
  name: string;
  kind: ContactKind;
  phone: string;
  email: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

/** Entities that sync with the cloud. */
export type SyncTable = 'events' | 'money_records' | 'booking_requests' | 'contacts';

export interface Tombstone {
  table: SyncTable;
  id: string;
  deletedAt: string;
}
