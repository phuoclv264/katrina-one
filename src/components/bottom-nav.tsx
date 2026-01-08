'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

function useScrollDirection() {
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const updateScrollDirection = () => {
      const scrollY = window.scrollY;
      const direction = scrollY > lastScrollY ? 'down' : 'up';
      if (direction !== scrollDirection && Math.abs(scrollY - lastScrollY) > 0) {
        setScrollDirection(direction);
      }
      lastScrollY = scrollY > 0 ? scrollY : 0;
    };

    window.addEventListener('scroll', updateScrollDirection);
    return () => {
      window.removeEventListener('scroll', updateScrollDirection);
    };
  }, [scrollDirection]);

  return scrollDirection;
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
  const scrollDirection = useScrollDirection();
  const [isVisible, setIsVisible] = useState(true);
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    if (scrollDirection === 'down') {
      setIsVisible(false);
    } else if (scrollDirection === 'up') {
      setIsVisible(true);
    }
  }, [scrollDirection]);

  // Auto-hide timer when visible and not interacting
  useEffect(() => {
    if (!isVisible) return;
    if (isInteracting) return;

    const id = setTimeout(() => {
      setIsVisible(false);
    }, autoHideMs);

    return () => clearTimeout(id);
  }, [isVisible, isInteracting, activeTab, autoHideMs]);

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
