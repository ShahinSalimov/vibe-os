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
  /** Local file URI of the profile photo (device only in this version). */
  photoUri?: string;
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
export type SyncTable = 'events' | 'money_records' | 'booking_requests' | 'contacts' | 'songs' | 'setlists' | 'contracts' | 'riders' | 'tasks';

export interface Tombstone {
  table: SyncTable;
  id: string;
  deletedAt: string;
}

// ---------- Studio ----------

export type SongStage = 'idea' | 'writing' | 'demo' | 'arrangement' | 'recording' | 'mixing' | 'mastering' | 'released';
export const SONG_STAGES: SongStage[] = ['idea', 'writing', 'demo', 'arrangement', 'recording', 'mixing', 'mastering', 'released'];

export interface Song {
  id: string;
  title: string;
  stage: SongStage;
  musicalKey: string;
  bpm: number | null;
  durationSec: number | null;
  lyrics: string;
  authors: string;
  notes: string;
  releaseDate: ISODate | '';
  createdAt: string;
  updatedAt: string;
}

export type AssetKind = 'idea' | 'demo' | 'final' | 'other';
export const ASSET_KINDS: AssetKind[] = ['idea', 'demo', 'final', 'other'];

/** An audio file of a song. Stored on this device only (not synced in this version). */
export interface SongAsset {
  id: string;
  songId: string;
  kind: AssetKind;
  label: string;
  uri: string;
  durationSec: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Setlist {
  id: string;
  title: string;
  eventId?: string;
  songIds: string[];
  createdAt: string;
  updatedAt: string;
}

// ---------- Contracts, riders, documents ----------

export type ContractTemplate = 'performance' | 'wedding' | 'corporate' | 'collaboration' | 'sponsorship' | 'custom';
export const CONTRACT_TEMPLATES: ContractTemplate[] = ['performance', 'wedding', 'corporate', 'collaboration', 'sponsorship', 'custom'];
export type ContractStatus = 'draft' | 'sent' | 'signed' | 'cancelled';
export const CONTRACT_STATUSES: ContractStatus[] = ['draft', 'sent', 'signed', 'cancelled'];

export interface Contract {
  id: string;
  title: string;
  template: ContractTemplate;
  /** Language of the contract text (independent of the app language). */
  language: Language;
  eventId?: string;
  counterparty: string;
  amount: number;
  currency: Currency;
  status: ContractStatus;
  /** Sign-by date, "" if none. */
  deadline: ISODate | '';
  body: string;
  /** Photo/scan of the signed copy (device only). */
  signedFileUri?: string;
  createdAt: string;
  updatedAt: string;
}

export type RiderKind = 'technical' | 'hospitality';
export interface RiderSection {
  key: string;
  title: string;
  items: string[];
}
export interface Rider {
  id: string;
  kind: RiderKind;
  title: string;
  language: Language;
  sections: RiderSection[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type PersonalDocKind = 'passport' | 'id' | 'visa' | 'license' | 'other';
export const PERSONAL_DOC_KINDS: PersonalDocKind[] = ['passport', 'visa', 'id', 'license', 'other'];

/** Personal document reminder. Device only: never synced. No document numbers are stored. */
export interface PersonalDoc {
  id: string;
  kind: PersonalDocKind;
  title: string;
  country: string;
  expiry: ISODate | '';
  note: string;
  fileUri?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Team ----------

export interface Task {
  id: string;
  title: string;
  note: string;
  /** Cloud user id of the assignee; empty when not assigned. */
  assigneeId: string;
  due: ISODate | '';
  eventId?: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  userId: string;
  role: 'owner' | 'manager' | 'member' | 'accountant' | 'viewer';
  displayName: string;
  email: string;
  joinedAt: string;
}
