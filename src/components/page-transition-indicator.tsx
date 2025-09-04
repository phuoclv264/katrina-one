
'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Progress } from '@/components/ui/progress';

export default function PageTransitionIndicator() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Don't show indicator on initial load
    if (pathname) {
      setIsVisible(true);
      setProgress(0);
      
      const timer = setTimeout(() => setProgress(90), 10); // Start the progress
      
      // This will clear the progress bar after navigation seems complete.
      // This is a simulation, as we can't truly know when the next page has finished rendering.
      const finishTimer = setTimeout(() => {
        setProgress(100);
        setTimeout(() => {
            setIsVisible(false);
        }, 300);
      }, 500); // Adjust this duration as needed

      return () => {
        clearTimeout(timer);
        clearTimeout(finishTimer);
      };
    }
  }, [pathname]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 w-full z-50 h-1">
        <Progress 
            value={progress} 
            className="h-1 w-full transition-all duration-300 ease-in-out [&>div]:bg-primary"
        />
    </div>
  );
}
