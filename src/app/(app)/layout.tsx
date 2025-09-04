
'use client';

import { Suspense, useState } from 'react';
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/sidebar';
import { MobileHeader } from '@/components/mobile-header';
import { Button } from '@/components/ui/button';
import { PanelLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import PageTransitionIndicator from '@/components/page-transition-indicator';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [navKey, setNavKey] = useState(0);

  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas">
        <AppSidebar onNavigate={() => setNavKey(prev => prev + 1)} />
      </Sidebar>
      <SidebarInset key={navKey}>
        <Suspense>
          <PageTransitionIndicator />
        </Suspense>
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:px-6 md:hidden">
          <SidebarTrigger>
            <Button variant="outline" size="icon" className="shrink-0 md:hidden">
              <PanelLeft />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SidebarTrigger>
           <Suspense fallback={<Skeleton className="h-6 w-32" />}>
             <MobileHeader />
           </Suspense>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
