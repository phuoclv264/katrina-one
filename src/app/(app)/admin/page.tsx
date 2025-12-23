'use client';

import { Suspense } from 'react';
import { OwnerHomeView } from '@/components/views/owner-home-view';
import { LoadingPage } from '@/components/loading/LoadingPage';

// MIGRATED: Added Suspense boundary for Cache Components
// This component uses new Date() and other dynamic values that need to be
// deferred during prerendering
export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <OwnerHomeView isStandalone={true} />
    </Suspense>
  );
}
