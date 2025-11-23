'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';

type PageTransitionContextType = {
  isTransitioning: boolean;
  startTransition: () => void;
  stopTransition: () => void;
};

const PageTransitionContext = createContext<PageTransitionContextType | null>(null);

export function PageTransitionProvider({ children }: { children: ReactNode }) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const pathname = usePathname();

  // Manual controls
  const startTransition = () => setIsTransitioning(true);
  const stopTransition = () => setIsTransitioning(false);

  // --- AUTO HIDE AFTER ROUTE CHANGE ---
  useEffect(() => {
    // If a transition is active, hide it after route changes
    if (isTransitioning) {
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 150); // smooth fade

      return () => clearTimeout(timer);
    }
  }, [pathname]); // <-- this runs AFTER route navigation completes

  return (
    <PageTransitionContext.Provider
      value={{ isTransitioning, startTransition, stopTransition }}
    >
      {children}
    </PageTransitionContext.Provider>
  );
}

export function usePageTransitionController() {
  const ctx = useContext(PageTransitionContext);
  if (!ctx) {
    throw new Error(
      'usePageTransitionController must be used inside <PageTransitionProvider>'
    );
  }
  return ctx;
}
