
'use client';

import { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';

export default function PageTransitionIndicator() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Start the progress bar animation immediately upon component mount
    const timer = setTimeout(() => setProgress(90), 10);
    
    // Finish the progress bar after a short delay
    const finishTimer = setTimeout(() => {
      setProgress(100);
    }, 500); // Adjust duration as needed

    return () => {
      clearTimeout(timer);
      clearTimeout(finishTimer);
    };
  }, []); // Empty dependency array means this runs once on mount

  return (
    <div className="fixed top-0 left-0 w-full z-50 h-1">
        <Progress 
            value={progress} 
            className="h-1 w-full transition-all duration-500 ease-in-out [&>div]:bg-primary"
        />
    </div>
  );
}
