'use client';

import { useState, useEffect } from 'react';

function getVisibility() {
  if (typeof document === 'undefined') {
    return 'visible';
  }
  return document.visibilityState;
}

/**
 * A custom React Hook to track page visibility.
 * @returns {boolean} Whether the page is currently visible.
 */
export function usePageVisibility() {
  const [isVisible, setIsVisible] = useState(getVisibility() === 'visible');

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return isVisible;
}
