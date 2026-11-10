import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { newId } from '../lib/id';
import { emptyCloud, migrateStore } from './migrate';
import { mergeRemote, mappers } from '../lib/sync';
import type {
  ArtistEvent,
  BookingRequest,
  Contact,
  MoneyRecord,
  Profile,
  Settings,
  SyncTable,
  Tombstone,
} from '../lib/types';

// Local-first store. Everything works offline; when the user signs in, the sync
// engine (src/cloud/sync.ts) pushes local changes and pulls remote ones.

export type { CloudState } from './migrate';
import type { CloudState } from './migrate';

type Input<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

interface AppState {
  hydrated: boolean;
  profile: Profile | null;
  settings: Settings;
  events: ArtistEvent[];
  records: MoneyRecord[];
  bookings: BookingRequest[];
  contacts: Contact[];
  tombstones: Tombstone[];
  cloud: CloudState;

  completeOnboarding: (profile: Omit<Profile, 'createdAt'>, settings: Settings) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  updateProfile: (patch: Partial<Profile>) => void;

  saveEvent: (e: Input<ArtistEvent>) => string;
  deleteEvent: (id: string) => void;
  saveRecord: (r: Input<MoneyRecord>) => string;
  deleteRecord: (id: string) => void;
  saveBooking: (b: Input<BookingRequest>) => string;
  deleteBooking: (id: string) => void;
  setBookingStatus: (id: string, status: BookingRequest['status']) => void;
  confirmBooking: (id: string, eventTitle: string) => string | null;
  saveContact: (c: Input<Contact>) => string;
  deleteContact: (id: string) => void;

  // cloud
  setCloud: (patch: Partial<CloudState>) => void;
  applyRemote: (table: SyncTable, rows: Record<string, unknown>[]) => void;
  clearTombstones: (upTo: string) => void;

  resetAll: () => void;
}

const defaultSettings: Settings = { language: 'az', currency: 'AZN', appLock: false };

const now = () => new Date().toISOString();

function upsert<T extends { id: string; createdAt: string; updatedAt: string }>(list: T[], input: Input<T>): [T[], string] {
  const id = input.id ?? newId();
  const existing = list.find((x) => x.id === id);
  const item = { ...input, id, createdAt: existing?.createdAt ?? now(), updatedAt: now() } as T;
  return [existing ? list.map((x) => (x.id === id ? item : x)) : [...list, item], id];
}

const tomb = (table: SyncTable, id: string): Tombstone => ({ table, id, deletedAt: now() });

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      profile: null,
      settings: defaultSettings,
      events: [],
      records: [],
      bookings: [],
      contacts: [],
      tombstones: [],
      cloud: emptyCloud,

      completeOnboarding: (profile, settings) => set({ profile: { ...profile, createdAt: now() }, settings }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      updateProfile: (patch) => set((s) => (s.profile ? { profile: { ...s.profile, ...patch } } : {})),

      saveEvent: (input) => {
        const [events, id] = upsert(get().events, input);
        set({ events });
        return id;
      },
      deleteEvent: (id) =>
        set((s) => ({
          events: s.events.filter((e) => e.id !== id),
          // keep linked money records and bookings, just unlink them
          records: s.records.map((r) => (r.eventId === id ? { ...r, eventId: undefined, updatedAt: now() } : r)),
          bookings: s.bookings.map((b) => (b.eventId === id ? { ...b, eventId: undefined, updatedAt: now() } : b)),
          tombstones: [...s.tombstones, tomb('events', id)],
        })),

      saveRecord: (input) => {
        const [records, id] = upsert(get().records, input);
        set({ records });
        return id;
      },
      deleteRecord: (id) =>
        set((s) => ({
          records: s.records.filter((r) => r.id !== id),
          tombstones: [...s.tombstones, tomb('money_records', id)],
        })),

      saveBooking: (input) => {
        const [bookings, id] = upsert(get().bookings, input);
        set({ bookings });
        return id;
      },
      deleteBooking: (id) =>
        set((s) => ({
          bookings: s.bookings.filter((b) => b.id !== id),
          tombstones: [...s.tombstones, tomb('booking_requests', id)],
        })),
      setBookingStatus: (id, status) =>
        set((s) => ({ bookings: s.bookings.map((b) => (b.id === id ? { ...b, status, updatedAt: now() } : b)) })),

      // Booking -> event (+ expected income + organizer contact), in one step.
      confirmBooking: (id, eventTitle) => {
        const s = get();
        const b = s.bookings.find((x) => x.id === id);
        if (!b) return null;
        if (b.eventId && s.events.some((e) => e.id === b.eventId)) return b.eventId;

        const fee = b.budget ?? 0;
        const [events, eventId] = upsert(s.events, {
          title: eventTitle,
          type: b.eventType,
          date: b.date,
          time: '',
          venue: b.venue,
          city: b.city,
          organizer: b.organizerName,
          organizerPhone: b.phone,
          fee,
          advance: 0,
          currency: b.currency,
          notes: b.message,
        });
        let records = s.records;
        if (fee > 0) {
          [records] = upsert(records, {
            kind: 'income',
            counterparty: b.organizerName,
            amount: fee,
            paidAmount: 0,
            currency: b.currency,
            date: b.date,
            status: 'planned',
            category: '',
            note: '',
            eventId,
          });
        }
        let contacts = s.contacts;
        const known = contacts.some(
          (c) => c.name.trim().toLowerCase() === b.organizerName.trim().toLowerCase() || (b.phone && c.phone === b.phone),
        );
        if (!known) {
          [contacts] = upsert(contacts, {
            name: b.organizerName,
            kind: 'organizer',
            phone: b.phone,
            email: b.email,
            note: '',
          });
        }
        const bookings = s.bookings.map((x) =>
          x.id === id ? { ...x, status: 'confirmed' as const, eventId, updatedAt: now() } : x,
        );
        set({ events, records, contacts, bookings });
        return eventId;
      },

      saveContact: (input) => {
        const [contacts, id] = upsert(get().contacts, input);
        set({ contacts });
        return id;
      },
      deleteContact: (id) =>
        set((s) => ({
          contacts: s.contacts.filter((c) => c.id !== id),
          tombstones: [...s.tombstones, tomb('contacts', id)],
        })),

      setCloud: (patch) => set((s) => ({ cloud: { ...s.cloud, ...patch } })),

      applyRemote: (table, rows) =>
        set((s) => {
          switch (table) {
            case 'events':
              return { events: mergeRemote(s.events, rows, mappers.events.fromRow) };
            case 'money_records':
              return { records: mergeRemote(s.records, rows, mappers.money_records.fromRow) };
            case 'booking_requests':
              return { bookings: mergeRemote(s.bookings, rows, mappers.booking_requests.fromRow) };
            case 'contacts':
              return { contacts: mergeRemote(s.contacts, rows, mappers.contacts.fromRow) };
          }
        }),
      clearTombstones: (upTo) => set((s) => ({ tombstones: s.tombstones.filter((t) => t.deletedAt > upTo) })),

      resetAll: () =>
        set({
          profile: null,
          settings: defaultSettings,
          events: [],
          records: [],
          bookings: [],
          contacts: [],
          tombstones: [],
          cloud: emptyCloud,
        }),
    }),
    {
      name: 'vibe-os-store',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ profile, settings, events, records, bookings, contacts, tombstones, cloud }) => ({
        profile,
        settings,
        events,
        records,
        bookings,
        contacts,
        tombstones,
        cloud,
      }),
      migrate: (persisted, version) => migrateStore(persisted as Record<string, unknown>, version),
      // runs on success AND on error, so the app never hangs on the splash
      onRehydrateStorage: () => () => useAppStore.setState({ hydrated: true }),
    },
  ),
);
