'use client';

import React, { useEffect, useRef, useState } from 'react';
import { format, addDays, subDays, isSameDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

type DateStripProps = {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
};

export function DateStrip({ selectedDate, onDateChange }: DateStripProps) {
  const [visibleDays, setVisibleDays] = useState<number>(31);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const dateRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Adapt number of visible days to viewport width
  useEffect(() => {
    const calc = () => {
      const w = typeof window !== 'undefined' ? window.innerWidth : 1024;
      if (w < 640) return 15; // small screens
      if (w < 1024) return 21; // medium
      return 31; // large
    };

    const onResize = () => setVisibleDays(calc());
    setVisibleDays(calc());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Generate a range centered on selectedDate for better UX
  const dates = React.useMemo(() => {
    const half = Math.floor(visibleDays / 2);
    return Array.from({ length: visibleDays }, (_, i) => addDays(subDays(selectedDate, half), i));
  }, [selectedDate, visibleDays]);

  // Auto-scroll selected date into view when it changes
  useEffect(() => {
    const key = selectedDate.toDateString();
    const el = dateRefs.current.get(key);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      el.focus({ preventScroll: true });
    }
  }, [selectedDate, visibleDays]);

  const handleKeyDownOnButton = (e: React.KeyboardEvent, date: Date) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onDateChange(addDays(date, -1));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onDateChange(addDays(date, 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onDateChange(dates[0]);
    } else if (e.key === 'End') {
      e.preventDefault();
      onDateChange(dates[dates.length - 1]);
    }
  };

  return (
    <div className="relative">
      <ScrollArea className="w-full max-w-[80vw] whitespace-nowrap rounded-xl border bg-background/50 backdrop-blur-sm p-2 shadow-sm">
        <div
          ref={contentRef}
          role="list"
          className="flex w-max space-x-2 p-1 items-center"
        >
          {dates.map((date) => {
            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, new Date());

            return (
              <button
                key={date.toISOString()}
                ref={(el) => {
                  if (el) dateRefs.current.set(date.toDateString(), el);
                  else dateRefs.current.delete(date.toDateString());
                }}
                onClick={() => onDateChange(date)}
                onKeyDown={(e) => handleKeyDownOnButton(e, date)}
                aria-pressed={isSelected}
                aria-current={isToday ? 'date' : undefined}
                aria-label={format(date, 'EEEE, dd MMMM yyyy', { locale: vi })}
                role="listitem"
                className={cn(
                  'flex min-w-[48px] sm:min-w-[56px] h-14 sm:h-16 flex-col items-center justify-center rounded-lg transition-all duration-150 px-2',
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-md scale-105 ring-1 ring-primary/30'
                    : 'bg-transparent hover:bg-muted text-foreground'
                )}
              >
                <span className="text-[10px] font-medium uppercase opacity-80">
                  {format(date, 'EEE', { locale: vi })}
                </span>
                <span className="text-lg sm:text-xl font-bold leading-none">
                  {format(date, 'd')}
                </span>
                <span className="text-[10px] font-medium opacity-80 hidden sm:inline">
                  Th {format(date, 'M')}
                </span>
                {isToday && !isSelected && (
                  <div className="mt-1 h-1 w-1 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
