
'use client';

import { Suspense } from 'react';
import { ServerHomeView } from '@/components/views/server-home-view';
import { LoadingPage } from '@/components/loading/LoadingPage';

// MIGRATED: Added Suspense boundary for Cache Components
// This component uses new Date() and other dynamic values that need to be
// deferred during prerendering
export default function ShiftsPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <ServerHomeView />
    </Suspense>
  );
}
