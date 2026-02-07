
'use client';

import { lazy, Suspense } from 'react';
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import NextTopLoader from 'nextjs-toploader';
import { AppSidebar } from '@/components/sidebar';
import { MobileHeader } from '@/components/mobile-header';
import { Button } from '@/components/ui/button';
import { PanelLeft } from 'lucide-react';
import { LightboxProvider } from '@/contexts/lightbox-context';
import { BackButtonHandler } from '@/components/back-button-handler';
import { Skeleton } from '@/components/ui/skeleton';
import { MobileLayout } from '@/components/mobile-layout';
import { useIsMobile } from '@/hooks/use-mobile';
import { AppNavigationProvider } from '@/contexts/app-navigation-context';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const isMobile = useIsMobile();

  return (
    <LightboxProvider>
      <SidebarProvider defaultOpen={false}>
        <Sidebar collapsible="offcanvas">
          <AppSidebar />
        </Sidebar>
        <BackButtonHandler />
        <SidebarInset className="pb-0">
          <header className="sticky top-0 z-50 flex h-14 items-center border-b bg-background/80 backdrop-blur-md px-4 sm:px-6">
            <Suspense fallback={<Skeleton className="h-6 w-32" />}>
              <MobileHeader />
            </Suspense>
          </header>
          <NextTopLoader speed={1000} />
          
          {/* Render only the view for the current device to avoid mounting both views */}
          {isMobile ? (
            <MobileLayout>{children}</MobileLayout>
          ) : (
            <div className="hidden md:block">
              <AppNavigationProvider>{children}</AppNavigationProvider>
            </div>
          )}
          
        </SidebarInset>
      </SidebarProvider>
    </LightboxProvider>
  )
}
