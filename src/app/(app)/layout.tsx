
'use client';

import { Suspense, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
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
  const [isNavigating, setIsNavigating] = useState(false);
  const pathname = usePathname();

  // Reset navigation state when the path changes (i.e., navigation is complete)
  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <AppSidebar onNavigate={() => setIsNavigating(true)} />
      </Sidebar>
      <SidebarInset>
         {isNavigating && <PageTransitionIndicator />}
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:px-6">
          <SidebarTrigger>
            <Button variant="outline" size="icon" className="shrink-0">
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
