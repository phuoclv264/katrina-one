
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
import { ThemeSync } from '@/components/theme-sync';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <LightboxProvider>
      <SidebarProvider>
        <ThemeSync />
        <Sidebar collapsible="icon">
          <AppSidebar />
        </Sidebar>
        <BackButtonHandler />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:px-6">
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
          <NextTopLoader speed={1000} />
          {children}
        </SidebarInset>
      </SidebarProvider>
    </LightboxProvider>
  )
}
