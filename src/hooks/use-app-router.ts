'use client';

import { usePageTransitionController } from '@/components/page-transition-provider';
import { useRouter as useNextRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';

/**
 * A custom router hook that wraps Next.js's useRouter to automatically
 * trigger page transitions on navigation.
 */
export function useAppRouter() {
  const router = useNextRouter();
  const pathname = usePathname();
  const { startTransition } = usePageTransitionController();

  const push = useCallback((href: string) => {
    // Don't trigger transition for same-page hash links
    if (href.startsWith('#') || href.startsWith(`${pathname}#`)) {
      router.push(href);
      return;
    }
    startTransition();
    router.push(href);
  }, [router, startTransition, pathname]);

  const back = useCallback(() => {
    startTransition();
    router.back();
  }, [router, startTransition]);

  return { ...router, push, back };
}
