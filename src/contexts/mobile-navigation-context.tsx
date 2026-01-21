'use client';

import React, { createContext, useContext } from 'react';

export type MobileNavigationApi = {
  push: (href: string) => void;
  replace: (href: string) => void;
  /** Navigate back in the mobile navigation stack (history.go equivalent). */
  back?: (delta?: number) => void;
};

const MobileNavigationContext = createContext<MobileNavigationApi | null>(null);

export function MobileNavigationProvider({
  value,
  children,
}: {
  value: MobileNavigationApi;
  children: React.ReactNode;
}) {
  return <MobileNavigationContext.Provider value={value}>{children}</MobileNavigationContext.Provider>;
}

export function useMobileNavigation() {
  return useContext(MobileNavigationContext);
}
