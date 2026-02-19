'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { getOTAUpdater } from '@/lib/otaUpdater';

export const useOTAUpdater = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const updater = getOTAUpdater();
    void updater.start();

    return () => {
      void updater.stop();
    };
  }, []);
};
