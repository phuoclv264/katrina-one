'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import CheckInCard from '@/app/(app)/_components/check-in-card';
import { useCheckInCardPlacement } from '@/hooks/useCheckInCardPlacement';
import UtilitiesCard from '@/components/utilities-card';
import { DashboardActionCard } from '@/components/dashboard-action-card';
import { useAuth } from '@/hooks/use-auth';
import { useAppNavigation } from '@/contexts/app-navigation-context';
import { getUserAccessLinks } from '@/lib/user-access-links';

export interface DashboardLayoutProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  top?: React.ReactNode; // optional content rendered above the main card (e.g. todays tasks)
  children?: React.ReactNode; // actions/content inside the card
  className?: string;
} 

export default function DashboardLayout({ title, description, top, children, className }: DashboardLayoutProps) {
  const { showCheckInCardOnTop, isCheckedIn } = useCheckInCardPlacement();

  // Hooks must be top-level — compute primary actions here and render in JSX below.
  const { user, activeShifts, isOnActiveShift } = useAuth();
  const nav = useAppNavigation();
  const access = user ? getUserAccessLinks({ user, isCheckedIn, activeShifts: activeShifts || [], isOnActiveShift }) : { primary: [] } as any;
  const primaryActions = (access.primary || []).filter((a: any) => (a.order ?? 100) < 70);

  return (
    <div className="container mx-auto flex min-h-full items-center justify-center p-4 sm:p-6 md:p-8">
      <div className={`w-full max-w-md space-y-6 ${className || ''}`}>
        {showCheckInCardOnTop && <CheckInCard />}

        {top}

        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
          <CardContent className="grid gap-4">
            {/* Role-specific primary actions (derived from centralized access rules).
                Render only high-priority primary links (orders < 70) so we show
                dashboard-like actions (checklists, hygiene, cashier, manager tools).
            */}
            {primaryActions.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {primaryActions.map((a: any) => (
                  <DashboardActionCard
                    key={a.href}
                    label={a.label}
                    subLabel={a.subLabel}
                    icon={a.icon}
                    onClick={() => nav.push(a.href)}
                    color={(a.color as any) || 'blue'}
                    variant="primary"
                  />
                ))}
              </div>
            )}

            {children}
          </CardContent>
        </Card>

        {isCheckedIn && <UtilitiesCard />}

        {!showCheckInCardOnTop && <CheckInCard />}
      </div>
    </div>
  );
}
