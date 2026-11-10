import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { IconName } from '../components/ui';
import AccountScreen from '../screens/AccountScreen';
import BookingDetailScreen from '../screens/BookingDetailScreen';
import BookingFormScreen from '../screens/BookingFormScreen';
import BookingsScreen from '../screens/BookingsScreen';
import { ContactFormScreen, ContactsScreen } from '../screens/ContactsScreens';
import ContractScreen from '../screens/docs/ContractScreen';
import DocumentsScreen from '../screens/docs/DocumentsScreen';
import PersonalDocScreen from '../screens/docs/PersonalDocScreen';
import RiderScreen from '../screens/docs/RiderScreen';
import EventFormScreen from '../screens/EventFormScreen';
import EventsScreen from '../screens/EventsScreen';
import HomeScreen from '../screens/HomeScreen';
import MoneyScreen from '../screens/MoneyScreen';
import MoreScreen from '../screens/MoreScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import RecordFormScreen from '../screens/RecordFormScreen';
import SetlistScreen from '../screens/studio/SetlistScreen';
import SongScreen from '../screens/studio/SongScreen';
import StageModeScreen from '../screens/studio/StageModeScreen';
import StudioScreen from '../screens/studio/StudioScreen';
import { useAppStore } from '../store/useAppStore';
import { colors } from '../theme/tokens';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const theme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.gold,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.gold,
  },
};

const TAB_ICONS: Record<keyof TabParamList, [IconName, IconName]> = {
  Home: ['home', 'home-outline'],
  Events: ['calendar', 'calendar-outline'],
  Bookings: ['mail-unread', 'mail-unread-outline'],
  Money: ['wallet', 'wallet-outline'],
  More: ['grid', 'grid-outline'],
};

function Tabs() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const newBookings = useAppStore((s) => s.bookings.filter((b) => b.status === 'new').length);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          // explicit height so labels never clip; respects the iPhone home indicator / Android nav bar
          height: 72 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 10),
        },
        tabBarLabelStyle: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
        tabBarBadgeStyle: { backgroundColor: colors.gold, color: colors.onGold, fontWeight: '700' },
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={TAB_ICONS[route.name][focused ? 0 : 1]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t('tabs.home') }} />
      <Tab.Screen name="Events" component={EventsScreen} options={{ title: t('tabs.events') }} />
      <Tab.Screen
        name="Bookings"
        component={BookingsScreen}
        options={{ title: t('tabs.bookings'), tabBarBadge: newBookings || undefined }}
      />
      <Tab.Screen name="Money" component={MoneyScreen} options={{ title: t('tabs.money') }} />
      <Tab.Screen name="More" component={MoreScreen} options={{ title: t('tabs.more') }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const hasProfile = useAppStore((s) => !!s.profile);
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        {!hasProfile ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen name="EventForm" component={EventFormScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="RecordForm" component={RecordFormScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
            <Stack.Screen name="BookingForm" component={BookingFormScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Contacts" component={ContactsScreen} />
            <Stack.Screen name="ContactForm" component={ContactFormScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Account" component={AccountScreen} />
            <Stack.Screen name="Studio" component={StudioScreen} />
            <Stack.Screen name="Documents" component={DocumentsScreen} />
            <Stack.Screen name="Contract" component={ContractScreen} />
            <Stack.Screen name="Rider" component={RiderScreen} />
            <Stack.Screen name="PersonalDoc" component={PersonalDocScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Song" component={SongScreen} />
            <Stack.Screen name="Setlist" component={SetlistScreen} />
            <Stack.Screen
              name="StageMode"
              component={StageModeScreen}
              options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
