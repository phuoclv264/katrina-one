
'use client';

import { Suspense, useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/sidebar';
import { MobileHeader } from '@/components/mobile-header';
import { Button } from '@/components/ui/button';
import { PanelLeft } from 'lucide-react';
import PageTransitionIndicator from '@/components/page-transition-indicator';
import { LightboxProvider } from '@/contexts/lightbox-context';
import { BackButtonHandler } from '@/components/back-button-handler';
import { PageTransitionProvider, usePageTransitionController } from '@/components/page-transition-provider';
import { Skeleton } from '@/components/ui/skeleton';

function PageTransitionIndicatorWrapper() {
  const { isTransitioning } = usePageTransitionController();
  return isTransitioning ? <PageTransitionIndicator /> : null;
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {

  return (
    <LightboxProvider>
      <SidebarProvider>
        <PageTransitionProvider>
          <PageTransitionIndicatorWrapper />
          <Sidebar collapsible="icon">
            <AppSidebar />
          </Sidebar>
        </PageTransitionProvider>
        <BackButtonHandler />
        <SidebarInset>
          <header className="safe-top sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:px-6">
            <div>
              <SidebarTrigger>
                <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                  <PanelLeft />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SidebarTrigger>
            </div>
            <Suspense fallback={<Skeleton className="h-6 w-32" />}>
              <MobileHeader />
            </Suspense>
          </header>
          <PageTransitionProvider>
            <PageTransitionIndicatorWrapper />
            {children}
          </PageTransitionProvider>
        </SidebarInset>
      </SidebarProvider>
    </LightboxProvider>
  )
}
