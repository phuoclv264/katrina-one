'use client';

import { useOTAUpdater } from '@/hooks/useOTAUpdater';

export const OTAUpdaterBootstrap = () => {
  useOTAUpdater();
  return null;
};
