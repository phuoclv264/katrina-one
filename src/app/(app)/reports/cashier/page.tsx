'use client';

import React, { Suspense } from 'react';
import CashierReportsView from './_components/cashier-reports-view';
import { LoadingPage } from '@/components/loading/LoadingPage';

export default function CashierReportsPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <CashierReportsView />
    </Suspense>
  );
}
