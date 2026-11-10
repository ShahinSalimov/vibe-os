import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TxKind } from '../lib/types';
import type { VoiceDraft } from '../lib/voiceParse';

export type RootStackParamList = {
  Onboarding: undefined;
  Tabs: undefined;
  EventForm: { id?: string; draft?: VoiceDraft } | undefined;
  RecordForm: { id?: string; kind?: TxKind; draft?: VoiceDraft } | undefined;
  BookingDetail: { id: string };
  BookingForm: { id?: string } | undefined;
  Contacts: undefined;
  ContactForm: { id?: string } | undefined;
  Account: undefined;
  Studio: { tab?: 'songs' | 'setlists' } | undefined;
  Song: { id?: string } | undefined;
  Setlist: { id?: string; eventId?: string } | undefined;
  StageMode: { id: string };
  Documents: { tab?: 'contracts' | 'riders' | 'personal' } | undefined;
  Contract: { id?: string; eventId?: string } | undefined;
  Rider: { kind: 'technical' | 'hospitality' };
  PersonalDoc: { id?: string } | undefined;
};

export type TabParamList = {
  Home: undefined;
  Events: undefined;
  Bookings: undefined;
  Money: undefined;
  More: undefined;
};

export type RootProps<K extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, K>;
