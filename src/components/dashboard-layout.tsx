'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import CheckInCard from '@/app/(app)/_components/check-in-card';
import { useCheckInCardPlacement } from '@/hooks/useCheckInCardPlacement';
import UtilitiesCard from '@/components/utilities-card';
import QuickEventsCard from './events/QuickEventsCard';

export interface DashboardLayoutProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  top?: React.ReactNode; // optional content rendered above the main card (e.g. todays tasks)
  children?: React.ReactNode; // actions/content inside the card
  className?: string;
}

export default function DashboardLayout({ title, description, top, children, className }: DashboardLayoutProps) {
  const { showCheckInCardOnTop, isCheckedIn } = useCheckInCardPlacement();

  return (
    <div className="container mx-auto flex min-h-full items-center justify-center p-4 sm:p-6 md:p-8">
      <div className={`w-full max-w-md space-y-6 ${className || ''}`}>
        {showCheckInCardOnTop && <CheckInCard />}

        {top}
        <QuickEventsCard />

        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
          <CardContent className="grid gap-4">{children}</CardContent>
        </Card>

        {isCheckedIn && <UtilitiesCard />}

        {!showCheckInCardOnTop && <CheckInCard />}
      </div>
    </div>
  );
}
