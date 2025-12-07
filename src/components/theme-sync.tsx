'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/use-auth';
import { dataStore } from '@/lib/data-store';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AppSettings, ManagedUser } from '@/lib/types';

export function ThemeSync() {
  const { setTheme, theme } = useTheme();
  const { user } = useAuth();
  const [globalDefault, setGlobalDefault] = useState<'default' | 'dark' | 'noel'>('default');
  const [noelVariant, setNoelVariant] = useState<'noel-1' | 'noel-2' | 'noel-3'>('noel-1');
  const [userPreference, setUserPreference] = useState<'default' | 'dark' | 'noel' | undefined>(undefined);

  // Subscribe to global settings
  useEffect(() => {
    const unsubscribe = dataStore.subscribeToAppSettings((settings) => {
      setGlobalDefault(settings.defaultTheme || 'default');
      setNoelVariant(settings.noelThemeVariant || 'noel-1');
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to user preference
  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data() as ManagedUser;
        setUserPreference(userData.themePreference);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Sync logic
  useEffect(() => {
    let targetTheme = 'system';
    let intent = 'default';

    // 1. User Preference
    if (userPreference && userPreference !== 'default') {
      intent = userPreference;
    } 
    // 2. Global Default (Owner Set)
    else if (globalDefault && globalDefault !== 'default') {
      intent = globalDefault;
    } 

    if (intent === 'dark') {
      targetTheme = 'dark';
    } else if (intent === 'noel') {
      targetTheme = noelVariant; // Map 'noel' intent to specific variant
    } else {
      targetTheme = 'system';
    }

    // Only update if different to avoid loops (though next-themes handles this well)
    // Note: next-themes' 'system' means it listens to media query.
    if (theme !== targetTheme) {
      setTheme(targetTheme);
    }
  }, [userPreference, globalDefault, noelVariant, setTheme, theme]);

  return null;
}
