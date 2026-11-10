import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TxKind } from '../lib/types';

export type RootStackParamList = {
  Onboarding: undefined;
  Tabs: undefined;
  EventForm: { id?: string } | undefined;
  RecordForm: { id?: string; kind?: TxKind } | undefined;
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
