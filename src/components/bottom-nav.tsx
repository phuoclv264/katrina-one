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
}

export function BottomNav({ tabs, activeTab, onTabChange }: BottomNavProps) {
  const scrollDirection = useScrollDirection();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (scrollDirection === 'down') {
      setIsVisible(false);
    } else if (scrollDirection === 'up') {
      setIsVisible(true);
    }
  }, [scrollDirection]);

  return (
    <div 
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 border-t bg-background transition-transform duration-300 md:hidden",
        !isVisible ? "translate-y-full" : "translate-y-0"
      )}
    >
      <nav className="flex h-16 items-center justify-around px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
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
