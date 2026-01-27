'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Send } from 'lucide-react';

type Props = {
  isReadonly: boolean;
  isBottomNavVisible: boolean;
  isSubmitting: boolean;
  hasUnsubmittedChanges: boolean;
  onSubmit: () => void;
};

export default function SubmitFab({ isReadonly, isBottomNavVisible, isSubmitting, hasUnsubmittedChanges, onSubmit }: Props) {
  if (isReadonly) return null;

  return (
    <div className={`fixed right-4 z-[20] ${isBottomNavVisible ? 'bottom-20' : 'bottom-5'}`}>
      <Button
        aria-label="Gửi báo cáo"
        className="w-14 h-14 rounded-full font-black shadow-2xl shadow-primary/30 bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center relative transition-all active:scale-95 p-0 focus:outline-none focus:ring-2 focus:ring-primary/30"
        onClick={onSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <Send className="h-6 w-6" />
        )}

        {hasUnsubmittedChanges && (
          <span className="absolute top-0 right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white"></span>
          </span>
        )}
      </Button>
    </div>
  );
}
