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
  Setlist,
  Song,
  SongAsset,
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
  songs: Song[];
  /** Audio files: device-only. */
  assets: SongAsset[];
  setlists: Setlist[];

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

  saveSong: (s: Input<Song>) => string;
  /** Removes the song, its audio records and its place in setlists. Returns the removed asset URIs (files to delete). */
  deleteSong: (id: string) => string[];
  saveAsset: (a: Input<SongAsset>) => string;
  deleteAsset: (id: string) => string | null;
  saveSetlist: (s: Input<Setlist>) => string;
  deleteSetlist: (id: string) => void;

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
      songs: [],
      assets: [],
      setlists: [],

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
          setlists: s.setlists.map((l) => (l.eventId === id ? { ...l, eventId: undefined, updatedAt: now() } : l)),
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

      saveSong: (input) => {
        const [songs, id] = upsert(get().songs, input);
        set({ songs });
        return id;
      },
      deleteSong: (id) => {
        const s = get();
        const removed = s.assets.filter((a) => a.songId === id).map((a) => a.uri);
        set({
          songs: s.songs.filter((x) => x.id !== id),
          assets: s.assets.filter((a) => a.songId !== id),
          setlists: s.setlists.map((l) =>
            l.songIds.includes(id) ? { ...l, songIds: l.songIds.filter((x) => x !== id), updatedAt: now() } : l,
          ),
          tombstones: [...s.tombstones, tomb('songs', id)],
        });
        return removed;
      },
      saveAsset: (input) => {
        const [assets, id] = upsert(get().assets, input);
        set({ assets });
        return id;
      },
      deleteAsset: (id) => {
        const a = get().assets.find((x) => x.id === id);
        set((s) => ({ assets: s.assets.filter((x) => x.id !== id) }));
        return a?.uri ?? null;
      },
      saveSetlist: (input) => {
        const [setlists, id] = upsert(get().setlists, input);
        set({ setlists });
        return id;
      },
      deleteSetlist: (id) =>
        set((s) => ({
          setlists: s.setlists.filter((x) => x.id !== id),
          tombstones: [...s.tombstones, tomb('setlists', id)],
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
            case 'songs':
              return { songs: mergeRemote(s.songs, rows, mappers.songs.fromRow) };
            case 'setlists':
              return { setlists: mergeRemote(s.setlists, rows, mappers.setlists.fromRow) };
          }
        }),
      clearTombstones: (upTo) =>
        set((s) => {
          const left = s.tombstones.filter((t) => t.deletedAt > upTo);
          return left.length === s.tombstones.length ? {} : { tombstones: left };
        }),

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
          songs: [],
          assets: [],
          setlists: [],
        }),
    }),
    {
      name: 'vibe-os-store',
      version: 3,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ profile, settings, events, records, bookings, contacts, tombstones, cloud, songs, assets, setlists }) => ({
        songs,
        assets,
        setlists,
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
