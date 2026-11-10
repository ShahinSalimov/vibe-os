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
};

export type TabParamList = {
  Home: undefined;
  Events: undefined;
  Bookings: undefined;
  Money: undefined;
  More: undefined;
};

export type RootProps<K extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, K>;
