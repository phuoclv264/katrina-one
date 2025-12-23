
'use client';

import { Suspense, useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import NextTopLoader from 'nextjs-toploader';
import { AppSidebar } from '@/components/sidebar';
import { MobileHeader } from '@/components/mobile-header';
import { Button } from '@/components/ui/button';
import { PanelLeft } from 'lucide-react';
import { LightboxProvider } from '@/contexts/lightbox-context';
import { BackButtonHandler } from '@/components/back-button-handler';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBar, Style } from '@capacitor/status-bar';
import NotificationHandler from '@/components/notification-handler';
import { MobileLayout } from '@/components/mobile-layout';
import { useIsMobile } from '@/hooks/use-mobile';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    (async () => {
      try {
        // await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setOverlaysWebView({ overlay: true });
        // await StatusBar.setBackgroundColor({ color: '#00000000' }); // transparent
      } catch (err) {
        console.warn('StatusBar not available', err);
      }
    })();
  }, []);

  return (
    <LightboxProvider>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <AppSidebar />
        </Sidebar>
        <BackButtonHandler />
        <NotificationHandler />
        <SidebarInset className="pb-0">
          <header className="safe-top sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:px-6">
            <div>
              <SidebarTrigger className="hidden" />
            </div>
            <Suspense fallback={<Skeleton className="h-6 w-32" />}>
              <MobileHeader />
            </Suspense>
          </header>
          <NextTopLoader speed={1000} />
          
          {/* Render only the view for the current device to avoid mounting both views */}
          {useIsMobile() ? (
            <MobileLayout>{children}</MobileLayout>
          ) : (
            <div className="hidden md:block">{children}</div>
          )}
          
        </SidebarInset>
      </SidebarProvider>
    </LightboxProvider>
  )
}
