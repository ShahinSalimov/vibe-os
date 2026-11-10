import React from 'react';
import { useTranslation } from 'react-i18next';
import { Banner } from '../components/ui';
import { useAppStore } from '../store/useAppStore';
import { DemoBanner } from './DemoBanner';

/** On cloud-related screens: explains that the demo works offline only. */
export function DemoCloudOff() {
  const { t } = useTranslation();
  const demo = useAppStore((s) => !!s.settings.demo);
  if (!demo) return null;
  return (
    <>
      <Banner icon="cloud-offline" tone="warning" text={t('demo.cloudOff')} />
      <DemoBanner />
    </>
  );
}
