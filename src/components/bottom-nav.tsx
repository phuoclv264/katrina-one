'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

function useScrollDirection() {
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    // Ignore tiny scrolls/taps — make the nav less sensitive to small jitters
    const SCROLL_DELTA_PX = 8;

    const updateScrollDirection = () => {
      const scrollY = window.scrollY;
      // ignore small movements
      if (Math.abs(scrollY - lastScrollY) < SCROLL_DELTA_PX) return;
      const direction = scrollY > lastScrollY ? 'down' : 'up';
      // use functional update to avoid stale closure issues
      setScrollDirection((prev) => (prev === direction ? prev : direction));
      lastScrollY = scrollY > 0 ? scrollY : 0;
    };

    window.addEventListener('scroll', updateScrollDirection);
    return () => {
      window.removeEventListener('scroll', updateScrollDirection);
    };
  }, [scrollDirection]);

  return {scrollDirection, setScrollDirection};
}

export interface NavTab {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface BottomNavProps {
  tabs: NavTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  /** Optional value to watch; when it changes the nav will reveal briefly */
  watchValue?: unknown;
  /** Time (ms) of inactivity before auto-hide. Defaults to 4000 */
  autoHideMs?: number;
}

export function BottomNav({ tabs, activeTab, onTabChange, watchValue, autoHideMs = 4000 }: BottomNavProps) {
  const {scrollDirection, setScrollDirection} = useScrollDirection();
  const [isVisible, setIsVisible] = useState(true);
  const [isInteracting, setIsInteracting] = useState(false);
  // When true we force the nav visible (e.g., when at top of page or when content
  // is not scrollable so you "cannot scroll up" any further).
  const [alwaysVisibleAtTop, setAlwaysVisibleAtTop] = useState(false);

  useEffect(() => {
    // When pinned to top or page isn't scrollable, keep the nav visible.
    if (alwaysVisibleAtTop) {
      setIsVisible(true);
      return;
    }

    // Don't hide immediately on small/brief downward motion — wait briefly to
    // ensure the user intended to scroll down. This reduces accidental hides
    // when users tap/move slightly.
    let id: number | undefined;
    const HIDE_DELAY_MS = 150;

    if (scrollDirection === 'down') {
      id = window.setTimeout(() => {
        setIsVisible(false);
      }, HIDE_DELAY_MS);
    } else if (scrollDirection === 'up') {
      setIsVisible(true);
    }

    return () => {
      if (id) clearTimeout(id);
    };
  }, [scrollDirection, alwaysVisibleAtTop]);

  // Auto-hide timer when visible and not interacting
  // Don't auto-hide when we're pinned at the top / page isn't scrollable.
  useEffect(() => {
    if (!isVisible) return;
    if (isInteracting) return;
    if (alwaysVisibleAtTop) return;

    const id = setTimeout(() => {
      setIsVisible(false);
      setScrollDirection(null);
    }, autoHideMs);

    return () => clearTimeout(id);
  }, [isVisible, isInteracting, activeTab, autoHideMs, alwaysVisibleAtTop]);

  // Make sure the nav becomes visible whenever activeTab changes
  useEffect(() => {
    setIsVisible(true);
  }, [activeTab]);

  // Expose visibility to other components via a global class so floating
  // action buttons can adjust their position when the bottom nav is shown.
  useEffect(() => {
    try {
      if (isVisible) {
        document.documentElement.classList.add('bottom-nav-visible');
      } else {
        document.documentElement.classList.remove('bottom-nav-visible');
      }
    } catch (e) {
      // ignore (server-side rendering or restricted environments)
    }
    return () => {
      try { document.documentElement.classList.remove('bottom-nav-visible'); } catch (e) {}
    };
  }, [isVisible]);

  // Reveal the nav briefly whenever the visible tabs or a watched value (e.g. check-in state)
  // changes, so users immediately see updated tab content.
  useEffect(() => {
    setIsVisible(true);
    // ensure auto-hide will run by marking not-interacting
    setIsInteracting(false);
  }, [tabs, watchValue]);

  // Keep the nav visible when we're at the top of the page or when the document
  // isn't scrollable (so there's nowhere to scroll up to). This improves UX on
  // short pages and prevents surprising auto-hide behavior.
  useEffect(() => {
    const checkTopOrUnscrollable = () => {
      try {
        const doc = document.documentElement;
        const scrollTop = window.scrollY || doc.scrollTop || 0;
        const canScroll = doc.scrollHeight > window.innerHeight + 1; // small tolerance
        const atTop = scrollTop <= 0;
        const pinned = atTop || !canScroll;
        setAlwaysVisibleAtTop(pinned);
        if (pinned) setIsVisible(true);
      } catch (e) {
        // ignore (server environments, restricted contexts)
      }
    };

    checkTopOrUnscrollable();
    window.addEventListener('scroll', checkTopOrUnscrollable, { passive: true });
    window.addEventListener('resize', checkTopOrUnscrollable);
    return () => {
      window.removeEventListener('scroll', checkTopOrUnscrollable);
      window.removeEventListener('resize', checkTopOrUnscrollable);
    };
  }, []);

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 border-t bg-background transition-transform duration-300 md:hidden",
        !isVisible ? "translate-y-full" : "translate-y-0"
      )}
      // Pause auto-hide on interaction
      onMouseEnter={() => setIsInteracting(true)}
      onMouseLeave={() => setIsInteracting(false)}
      onTouchStart={() => { setIsInteracting(true); setIsVisible(true); }}
      onTouchMove={() => setIsInteracting(true)}
      onTouchCancel={() => setIsInteracting(false)}
      onTouchEnd={() => setIsInteracting(false)}
    >
      <nav className="flex h-16 items-center justify-around px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              onFocus={() => setIsInteracting(true)}
              onBlur={() => setIsInteracting(false)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-md px-3 py-2 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
