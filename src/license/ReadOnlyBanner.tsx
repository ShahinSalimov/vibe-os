import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Banner, Button } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { useLicense } from './useLicense';

/** Explains why a form is view-only: an ended trial (with an Activate button) or the user's role. */
export function ReadOnlyBanner() {
  const { t } = useTranslation();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { canWrite } = useLicense();
  if (canWrite) return <Banner icon="eye" text={t('readOnly')} />;
  return (
    <View style={{ gap: 8 }}>
      <Banner icon="lock-closed" tone="warning" text={t('license.locked')} />
      <Button label={t('license.activate')} icon="key" onPress={() => nav.navigate('License')} />
    </View>
  );
}
