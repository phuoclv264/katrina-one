'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon, ChevronRight } from 'lucide-react';

interface DashboardActionCardProps {
  label: string;
  subLabel?: string;
  icon: LucideIcon | React.ElementType;
  onClick: () => void;
  color?: 'emerald' | 'purple' | 'blue' | 'orange' | 'rose' | 'indigo' | 'sky' | 'amber';
  className?: string;
  variant?: 'default' | 'primary';
}

export function DashboardActionCard({
  label,
  subLabel,
  icon: Icon,
  onClick,
  color = 'blue',
  className,
  variant = 'default',
}: DashboardActionCardProps) {
  const isPrimary = variant === 'primary';

  // Styles for Primary Variant (More colorful background, solid icon color)
  const primaryStyles = {
    emerald: "bg-emerald-50/60 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/30",
    purple: "bg-purple-50/60 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800/30 hover:bg-purple-100/80 dark:hover:bg-purple-900/30",
    blue: "bg-blue-50/60 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30 hover:bg-blue-100/80 dark:hover:bg-blue-900/30",
    orange: "bg-orange-50/60 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800/30 hover:bg-orange-100/80 dark:hover:bg-orange-900/30",
    rose: "bg-rose-50/60 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800/30 hover:bg-rose-100/80 dark:hover:bg-rose-900/30",
    indigo: "bg-indigo-50/60 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/30 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/30",
    sky: "bg-sky-50/60 dark:bg-sky-900/20 border-sky-100 dark:border-sky-800/30 hover:bg-sky-100/80 dark:hover:bg-sky-900/30",
    amber: "bg-amber-50/60 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/30 hover:bg-amber-100/80 dark:hover:bg-amber-900/30",
  };

  // Icon Styles for Primary Variant (Solid background)
  const primaryIconStyles = {
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
    purple: "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400",
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
    orange: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400",
    rose: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400",
    indigo: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400",
    sky: "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
  };

  // Icon Styles for Default Variant (Hover effect)
  const defaultIconStyles = {
    emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white",
    purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 group-hover:bg-purple-500 group-hover:text-white",
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500 group-hover:text-white",
    orange: "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 group-hover:bg-orange-500 group-hover:text-white",
    rose: "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 group-hover:bg-rose-500 group-hover:text-white",
    indigo: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white",
    sky: "bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 group-hover:bg-sky-500 group-hover:text-white",
    amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex transition-all duration-200 group text-left w-full active:scale-[0.98] rounded-2xl",
        isPrimary 
          ? cn("flex-row items-center p-5 min-h-[100px] shadow-sm hover:shadow-md border col-span-full gap-5", primaryStyles[color])
          : "flex-col items-start p-4 bg-card border border-border hover:shadow-md min-h-[100px] h-full shadow-sm justify-between",
        className
      )}
    >
      <div
        className={cn(
          "rounded-xl transition-colors duration-300 flex items-center justify-center shrink-0",
          isPrimary ? "p-2 shadow-sm" : "p-2 mb-3 w-10 h-10 flex items-center justify-center",
          isPrimary ? primaryIconStyles[color] : defaultIconStyles[color]
        )}
      >
        <Icon className={cn(isPrimary ? "w-8 h-8" : "w-6 h-6")} />
      </div>
      <div className="flex flex-col flex-1">
        <span className={cn("font-bold text-foreground", isPrimary ? "text-lg" : "text-sm line-clamp-2")}>{label}</span>
        {subLabel && <span className={cn("text-muted-foreground mt-1", isPrimary ? "text-sm" : "text-[10px] line-clamp-1")}>{subLabel}</span>}
      </div>
      {isPrimary && (
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:translate-x-1 shrink-0",
          primaryIconStyles[color],
          "bg-opacity-50"
        )}>
          <ChevronRight className="w-6 h-6" />
        </div>
      )}
    </button>
  );
}
