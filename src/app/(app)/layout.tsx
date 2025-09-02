
'use client';

import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/sidebar';
import { Button } from '@/components/ui/button';
import { PanelLeft } from 'lucide-react';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas">
        <AppSidebar />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:px-6 md:hidden">
          <SidebarTrigger>
            <Button variant="outline" size="icon" className="shrink-0 md:hidden">
              <PanelLeft />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SidebarTrigger>
          <h1 className="text-lg font-semibold text-primary">Katrina One</h1>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
