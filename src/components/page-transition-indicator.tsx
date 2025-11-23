'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PageTransitionIndicator() {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "bg-background/70 backdrop-blur-sm",
        "animate-fadeIn"
      )}
    >
      <div
        className={cn(
          "flex flex-col items-center gap-3",
          "p-6 rounded-2xl shadow-lg",
          "bg-card/80 backdrop-blur-md border border-border/40",
          "animate-scaleIn"
        )}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Đang chuyển trang...</span>
      </div>
    </div>
  );
}
