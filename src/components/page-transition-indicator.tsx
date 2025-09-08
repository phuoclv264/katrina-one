
'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PageTransitionIndicator() {
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in-0 duration-300'
      )}
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
