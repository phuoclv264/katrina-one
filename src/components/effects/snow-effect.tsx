'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

export function SnowEffect() {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Check if theme is 'noel' or any variant
  const isNoel = theme?.startsWith('noel') || resolvedTheme?.startsWith('noel');

  if (!isNoel) return null;

  // We use fixed 8 snowflakes (reduced from 15) to keep it subtle
  return (
    <div className="snow-container fixed inset-0 pointer-events-none z-[9999]" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="snowflake text-white/80">
          ❄
        </div>
      ))}
    </div>
  );
}
