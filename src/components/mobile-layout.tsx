'use client';

import React, { useMemo, useState, useEffect, act } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/use-auth';
import { BottomNav, NavTab } from '@/components/bottom-nav';
import {
  Home,
  CalendarDays,
  User,
  ClipboardList,
  ShieldCheck,
  FileText,
  Banknote,
  CalendarClock
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import UserMenuView from '@/components/user-menu-view';
import usePreserveScroll from '@/hooks/use-preserve-scroll';
import { cn } from '@/lib/utils';
import { useCheckInCardPlacement } from '@/hooks/useCheckInCardPlacement';
import { MobileNavigationProvider } from '@/contexts/mobile-navigation-context';
import { AppNavigationProvider } from '@/contexts/app-navigation-context';
import { LoadingPage } from '@/components/loading/LoadingPage';
import WorkShiftGuard from '@/components/work-shift-guard';
import { getActiveShiftKeys, DEFAULT_MAIN_SHIFT_TIMEFRAMES, type ShiftKey } from '@/lib/shift-utils';

// Lazy-load heavy screens to keep initial JS + compile work small.
// This file acts like an SPA shell (no routing), so we prefer client-only loading.
const ScheduleView = dynamic(() => import('@/app/(app)/schedule/_components/schedule-view'), {
  ssr: false,
  loading: () => <LoadingPage />,
});

const ServerHomeView = dynamic(
  () => import('@/components/views/server-home-view').then((m) => m.ServerHomeView),
  { ssr: false, loading: () => <LoadingPage /> },
);
const OwnerHomeView = dynamic(
  () => import('@/components/views/owner-home-view').then((m) => m.OwnerHomeView),
  { ssr: false, loading: () => <LoadingPage /> },
);
const BartenderHomeView = dynamic(
  () => import('@/components/views/bartender-home-view').then((m) => m.BartenderHomeView),
  { ssr: false, loading: () => <LoadingPage /> },
);
const ManagerHomeView = dynamic(
  () => import('@/components/views/manager-home-view').then((m) => m.ManagerHomeView),
  { ssr: false, loading: () => <LoadingPage /> },
);
const CashierHomeView = dynamic(
  () => import('@/components/views/cashier-home-view').then((m) => m.CashierHomeView),
  { ssr: false, loading: () => <LoadingPage /> },
);

const ChecklistView = dynamic(() => import('@/app/(app)/checklist/[shift]/_components/checklist-view'), {
  ssr: false,
  loading: () => <LoadingPage />,
});
const HygieneReportView = dynamic(
  () => import('@/app/(app)/bartender/hygiene-report/_components/hygiene-report-view'),
  { ssr: false, loading: () => <LoadingPage /> },
);
const ManagerReportView = dynamic(
  () => import('@/app/(app)/manager/comprehensive-report/_components/manager-report-view'),
  { ssr: false, loading: () => <LoadingPage /> },
);
const CashierReportsView = dynamic(
  () => import('@/app/(app)/reports/cashier/_components/cashier-reports-view'),
  { ssr: false, loading: () => <LoadingPage /> },
);
const ShiftManagementView = dynamic(
  () => import('@/app/(app)/shift-scheduling/_components/schedule-view'),
  { ssr: false, loading: () => <LoadingPage /> },
);

const ShiftsPage = dynamic(() => import('@/app/(app)/shifts/page'), { ssr: false, loading: () => <LoadingPage /> });
const BartenderPage = dynamic(() => import('@/app/(app)/bartender/page'), { ssr: false, loading: () => <LoadingPage /> });
const CashierPage = dynamic(() => import('@/app/(app)/cashier/page'), { ssr: false, loading: () => <LoadingPage /> });
const ManagerPage = dynamic(() => import('@/app/(app)/manager/page'), { ssr: false, loading: () => <LoadingPage /> });
const AdminPage = dynamic(() => import('@/app/(app)/admin/page'), { ssr: false, loading: () => <LoadingPage /> });
const AdminEventsPage = dynamic(() => import('@/app/(app)/admin/events/page'), { ssr: false, loading: () => <LoadingPage /> });
const ReportsPage = dynamic(() => import('@/app/(app)/reports/page'), { ssr: false, loading: () => <LoadingPage /> });
const FinancialReportPage = dynamic(() => import('@/app/(app)/financial-report/page'), { ssr: false, loading: () => <LoadingPage /> });
const ShiftSchedulingPage = dynamic(() => import('@/app/(app)/shift-scheduling/page'), { ssr: false, loading: () => <LoadingPage /> });
const MonthlyTasksPage = dynamic(() => import('@/app/(app)/monthly-tasks/page'), { ssr: false, loading: () => <LoadingPage /> });
const MonthlyTaskReportsPage = dynamic(() => import('@/app/(app)/monthly-task-reports/page'), { ssr: false, loading: () => <LoadingPage /> });
const DailyAssignmentsPage = dynamic(() => import('@/app/(app)/daily-assignments/page'), { ssr: false, loading: () => <LoadingPage /> });
const UsersPage = dynamic(() => import('@/app/(app)/users/page'), { ssr: false, loading: () => <LoadingPage /> });
const TaskListsPage = dynamic(() => import('@/app/(app)/task-lists/page'), { ssr: false, loading: () => <LoadingPage /> });
const BartenderTasksPage = dynamic(() => import('@/app/(app)/bartender-tasks/page'), { ssr: false, loading: () => <LoadingPage /> });
const ComprehensiveChecklistPage = dynamic(() => import('@/app/(app)/comprehensive-checklist/page'), { ssr: false, loading: () => <LoadingPage /> });
const InventoryManagementPage = dynamic(() => import('@/app/(app)/inventory-management/page'), { ssr: false, loading: () => <LoadingPage /> });
const ProductManagementPage = dynamic(() => import('@/app/(app)/product-management/page'), { ssr: false, loading: () => <LoadingPage /> });
const InventoryHistoryPage = dynamic(() => import('@/app/(app)/inventory-history/page'), { ssr: false, loading: () => <LoadingPage /> });
const ViolationsPage = dynamic(() => import('@/app/(app)/violations/page'), { ssr: false, loading: () => <LoadingPage /> });
const ReportsFeedPage = dynamic(() => import('@/app/(app)/reports-feed/page'), { ssr: false, loading: () => <LoadingPage /> });
const ReportsByShiftPage = dynamic(() => import('@/app/(app)/reports/by-shift/page'), { ssr: false, loading: () => <LoadingPage /> });
const ReportsComprehensivePage = dynamic(() => import('@/app/(app)/reports/comprehensive/page'), { ssr: false, loading: () => <LoadingPage /> });
const ReportsHygienePage = dynamic(() => import('@/app/(app)/reports/hygiene/page'), { ssr: false, loading: () => <LoadingPage /> });
const ReportsInventoryPage = dynamic(() => import('@/app/(app)/reports/inventory/page'), { ssr: false, loading: () => <LoadingPage /> });
const BartenderHygienePage = dynamic(() => import('@/app/(app)/bartender/hygiene-report/page'), { ssr: false, loading: () => <LoadingPage /> });
const BartenderInventoryPage = dynamic(() => import('@/app/(app)/bartender/inventory/page'), { ssr: false, loading: () => <LoadingPage /> });
const ManagerComprehensiveReportPage = dynamic(() => import('@/app/(app)/manager/comprehensive-report/page'), { ssr: false, loading: () => <LoadingPage /> });

const AttendancePageComponent = dynamic(
  () => import('@/app/(app)/attendance/_components/attendance-page-client'),
  { ssr: false, loading: () => <LoadingPage /> },
);
const ChecklistPageComponent = dynamic(
  () => import('@/app/(app)/checklist/[shift]/checklist-page-client'),
  { ssr: false, loading: () => <LoadingPage /> },
);

// Placeholder components
const HomeView = () => <div className="p-4">Home View Content</div>;

function buildTabs(user: any, isCheckedIn: boolean): NavTab[] {
  const commonUserTab: NavTab = {
    id: 'menu',
    label: 'Menu',
    icon: User,
  };

  if (!user) {
    return [{ id: 'home', label: 'Trang chủ', icon: Home }, commonUserTab];
  }

  if (user.role === 'Chủ nhà hàng') {
    return [
      { id: 'home', label: 'Trang chủ', icon: Home },
      { id: 'shift-scheduling', label: 'Xếp lịch', icon: CalendarClock },
      { id: 'cashier-reports', label: 'Thu ngân', icon: Banknote },
      commonUserTab,
    ];
  }

  if (user.role === 'Thu ngân') {
    return [
      { id: 'home', label: 'Trang chủ', icon: Home },
      { id: 'cashier', label: 'Thu ngân', icon: Banknote },
      { id: 'schedule', label: 'Lịch', icon: CalendarDays },
      commonUserTab,
    ];
  }

  let quickAccess: NavTab | null = null;
  switch (user.role) {
    case 'Phục vụ':
      if (isCheckedIn) quickAccess = { id: 'checklist', label: 'Checklist', icon: ClipboardList };
      break;
    case 'Pha chế':
      if (isCheckedIn) quickAccess = { id: 'hygiene', label: 'Vệ sinh', icon: ShieldCheck };
      break;
    case 'Quản lý':
      if (isCheckedIn) quickAccess = { id: 'comprehensive-reports', label: 'Báo cáo toàn diện', icon: FileText };
      break;
  }

  const tabs: NavTab[] = [{ id: 'home', label: 'Trang chủ', icon: Home }];
  if (quickAccess) tabs.push(quickAccess);
  tabs.push({ id: 'schedule', label: 'Lịch', icon: CalendarDays });
  tabs.push(commonUserTab);
  return tabs;
}

function getCurrentShift(): ShiftKey {

  // Use the shared shift-utils to determine which shifts are active.
  // - beforeHours=1 includes the 05:30 early-morning boundary used historically
  // - afterHours=0 keeps end bounds strict to the configured end hour
  const active = getActiveShiftKeys(DEFAULT_MAIN_SHIFT_TIMEFRAMES);

  if (active.length === 0) return 'sang'; // fallback to legacy default

  return active[active.length - 1];
}

const HOME_PATHS = ['/shifts', '/bartender', '/manager', '/admin'];

const TAB_HASH_PREFIX = '#tab=';
const PAGE_HASH_PREFIX = '#page=';

function getTabFromHash(hash: string): string | null {
  if (!hash?.startsWith(TAB_HASH_PREFIX)) return null;
  const raw = hash.slice(TAB_HASH_PREFIX.length);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function setTabHash(tabId: string, mode: 'push' | 'replace' = 'push') {
  if (typeof window === 'undefined') return;
  const nextHash = `${TAB_HASH_PREFIX}${encodeURIComponent(tabId)}`;
  // Avoid re-writing the same hash to prevent redundant history entries.
  if (window.location.hash === nextHash) return;

  const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
  if (mode === 'replace') window.history.replaceState(null, '', nextUrl);
  else window.history.pushState(null, '', nextUrl);
}

function getPageFromHash(hash: string): string | null {
  if (!hash?.startsWith(PAGE_HASH_PREFIX)) return null;
  const raw = hash.slice(PAGE_HASH_PREFIX.length);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function setPageHash(href: string, mode: 'push' | 'replace' = 'push') {
  if (typeof window === 'undefined') return;
  const nextHash = `${PAGE_HASH_PREFIX}${encodeURIComponent(href)}`;
  if (window.location.hash === nextHash) return;

  const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
  if (mode === 'replace') window.history.replaceState(null, '', nextUrl);
  else window.history.pushState(null, '', nextUrl);
}

// usePreserveScroll moved to src/hooks/use-preserve-scroll.ts

export function MobileLayout({ children }: { children: React.ReactNode }) {
  const { user, refreshTrigger } = useAuth();
  const { isCheckedIn } = useCheckInCardPlacement();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState('home');
  const [isTabContent, setIsTabContent] = useState(true);
  const [virtualHref, setVirtualHref] = useState<string | null>(null);
  const { restore: restoreScroll, persist: persistScroll } = usePreserveScroll();

  const tabs = useMemo(() => buildTabs(user, isCheckedIn), [user, isCheckedIn, refreshTrigger]);

  // Initialize active tab based on pathname.
  // Important: do NOT let this override hash-driven SPA navigation (#tab / #page),
  // otherwise switching from #page -> #tab causes a brief forced jump to 'home'.
  useEffect(() => {
    if (virtualHref) return;

    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash?.startsWith(TAB_HASH_PREFIX) || hash?.startsWith(PAGE_HASH_PREFIX)) return;
    }

    if (pathname.includes('/schedule')) {
      setActiveTab('schedule');
      setIsTabContent(true);
    } else if (pathname.includes('/checklist')) {
      setActiveTab('checklist');
      setIsTabContent(true);
    } else if (pathname.includes('/hygiene-report')) {
      setActiveTab('hygiene');
      setIsTabContent(true);
    } else if (pathname.includes('/comprehensive-report')) {
      setActiveTab('comprehensive-reports');
      setIsTabContent(true);
    } else if (pathname.includes('/shift-scheduling')) {
      setActiveTab('shift-scheduling');
      setIsTabContent(true);
    } else if (pathname.includes('/reports/cashier')) {
      setActiveTab('cashier-reports');
      setIsTabContent(true);
    } else if (pathname.includes('/cashier')) {
      setActiveTab('cashier');
      setIsTabContent(true);
    } else if (HOME_PATHS.some((path) => pathname === path || pathname === '/')) {
      setIsTabContent(true);
      setActiveTab('home');
    } else {
      setIsTabContent(false);
      setActiveTab('');
    }
  }, [pathname, virtualHref]);

  // When our virtual route changes (or the active tab/pathname changes), attempt to restore
  useEffect(() => {
    // call restore; hook will no-op on server
    try { restoreScroll(); } catch { }
  }, [virtualHref, activeTab, pathname, restoreScroll]);

  const mobileNavApi = useMemo(
    () => ({
      push: (href: string) => {
        try { persistScroll(); } catch { }
        setActiveTab((prev) => (prev === 'menu' ? 'home' : prev));
        setIsTabContent(true);
        setVirtualHref(href);
        setPageHash(href, 'push');
      },
      replace: (href: string) => {
        try { persistScroll(); } catch { }
        setActiveTab((prev) => (prev === 'menu' ? 'home' : prev));
        setIsTabContent(true);
        setVirtualHref(href);
        setPageHash(href, 'replace');
      },
      back: () => {
        // Optimistically clear virtual route state; popstate/hash listeners will sync the rest.
        try { persistScroll(); } catch { }
        setActiveTab('home');
        setIsTabContent(true);
        setVirtualHref(null);

        if (typeof window === 'undefined') return;

        const isHomePath = HOME_PATHS.some(p => window.location.pathname === p || window.location.pathname === '/');

        // If already on a dashboard/home pathname, mirror the tab into the hash (avoids changing pathname).
        if (isHomePath) {
          setTabHash('home', 'push');
          return;
        }

        // Otherwise, navigate the SPA to the homepage (no reload) and push a home tab state.
        const next = '/#tab=home';
        if (window.location.pathname + window.location.search + window.location.hash !== next) {
          window.history.pushState(null, '', next);
        }
      },
    }),
    [],
  );

  // Option B: keep tab navigation in-place, but mirror active tab into the URL hash.
  // This makes the device/browser back button switch tabs predictably.
  //
  // Rules:
  // - When user taps a tab, we push a new history entry with #tab=<id>
  // - When history changes (back/forward), we restore activeTab from the hash
  // - If the hash is missing/invalid, we don't override existing pathname-derived state
  useEffect(() => {
    if (!user) return;
    if (typeof window === 'undefined') return;

    const applyHashToTab = () => {
      const hashPage = getPageFromHash(window.location.hash);
      if (hashPage) {
        setIsTabContent(true);
        setVirtualHref(hashPage);
        return;
      }

      const hashTab = getTabFromHash(window.location.hash);
      if (!hashTab) {
        setVirtualHref(null);
        // If there's no hash, only default to Home when we're on a dashboard/home route.
        // Otherwise, allow rendering other routes via {children}.
        const isHomePath = HOME_PATHS.some(path => pathname === path || pathname === '/');
        if (isHomePath) {
          setIsTabContent(true);
          setActiveTab('home');
        } else {
          setIsTabContent(true);
          setActiveTab('home');
          setVirtualHref(null);
          // Replace current location with home to ensure we land on the dashboard
          if (typeof window !== 'undefined') {
            window.location.replace('/');
          }
        }
        return;
      }

      // Only allow switching to tabs that exist for the current user.
      const allowed = tabs.some(t => t.id === hashTab);
      if (!allowed) return;

      setIsTabContent(true);
      setVirtualHref(null);
      setActiveTab(hashTab);
    };

    const onHashChange = () => applyHashToTab();
    const onPopState = () => applyHashToTab();

    // Initial sync on mount.
    applyHashToTab();

    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onPopState);
    };
  }, [tabs, user, pathname]);

  // Ensure active tab remains valid as quick-access tabs appear/disappear when check-in status changes
  useEffect(() => {
    // Only run this sync when we have an authenticated user
    if (!user) return;

    // If the current active tab is a quick-access tab that is no longer present, reset to home
    const quickTabIds = ['checklist', 'hygiene', 'comprehensive-reports'];
    const currentIsQuick = quickTabIds.includes(activeTab);
    const quickTabVisible = tabs.some(t => quickTabIds.includes(t.id));

    if (currentIsQuick && !quickTabVisible) {
      // Move back to home and navigate to the role's home path if needed
      try { persistScroll(); } catch { }
      setActiveTab('home');
      setIsTabContent(true);
      setVirtualHref(null);
      setTabHash('home', 'push');
    }
  }, [tabs, activeTab, pathname, user]);

  // Don't render until auth is resolved
  if (!user) return null;

  const handleTabChange = (tabId: string) => {
    try { persistScroll(); } catch { }
    if (tabId === 'menu') {
      // Show the user menu page (mobile-friendly) instead of opening the drawer
      setActiveTab('menu');
      setIsTabContent(true);
      setVirtualHref(null);
      setTabHash('menu', 'push');
    } else {
      setActiveTab(tabId);
      setIsTabContent(true);
      setVirtualHref(null);
      setTabHash(tabId, 'push');
    }
  };

  const renderVirtualRoute = (href: string) => {
    let url: URL;
    try {
      url = new URL(href, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    } catch {
      url = new URL('http://localhost');
      url.pathname = href;
    }

    const path = url.pathname;

    const checklistMatch = path.match(/^\/checklist\/(sang|trua|toi)$/);
    if (checklistMatch) {
      const shift = checklistMatch[1];
      return (
        <WorkShiftGuard redirectPath="/shifts">
          <ChecklistPageComponent shift={shift} />
        </WorkShiftGuard>
      );
    }

    switch (path) {
      case '/':
        return <div key={`children-${refreshTrigger}`}>{children}</div>;
      case '/shifts':
        return <ShiftsPage />;
      case '/bartender':
        return <BartenderPage />;
      case '/cashier':
        return <CashierPage />;
      case '/manager':
        return <ManagerPage />;
      case '/admin':
        return <AdminPage />;
      case '/admin/events':
        return <AdminEventsPage />;
      case '/schedule':
        return <ScheduleView />;
      case '/reports':
        return <ReportsPage />;
      case '/reports-feed':
        return <ReportsFeedPage />;
      case '/reports/by-shift':
        return <ReportsByShiftPage />;
      case '/reports/comprehensive':
        return <ReportsComprehensivePage />;
      case '/reports/hygiene':
        return <ReportsHygienePage />;
      case '/reports/inventory':
        return <ReportsInventoryPage />;
      case '/reports/cashier':
        return <CashierReportsView isStandalone={false} />;
      case '/financial-report':
        return <FinancialReportPage />;
      case '/shift-scheduling':
        return <ShiftSchedulingPage />;
      case '/attendance':
        return <AttendancePageComponent />;
      case '/monthly-tasks':
        return <MonthlyTasksPage />;
      case '/monthly-task-reports':
        return <MonthlyTaskReportsPage />;
      case '/daily-assignments':
        return <DailyAssignmentsPage />;
      case '/users':
        return <UsersPage />;
      case '/task-lists':
        return <TaskListsPage />;
      case '/bartender-tasks':
        return <BartenderTasksPage />;
      case '/comprehensive-checklist':
        return <ComprehensiveChecklistPage />;
      case '/inventory-management':
        return <InventoryManagementPage />;
      case '/product-management':
        return <ProductManagementPage />;
      case '/inventory-history':
        return <InventoryHistoryPage />;
      case '/violations':
        return <ViolationsPage />;
      case '/bartender/hygiene-report':
        return <BartenderHygienePage />;
      case '/bartender/inventory':
        return <BartenderInventoryPage />;
      case '/manager/comprehensive-report':
        return <ManagerComprehensiveReportPage />;
      default:
        return <div key={`children-${refreshTrigger}`}>{children}</div>;
    }
  };

  const renderContent = () => {
    if (virtualHref) return renderVirtualRoute(virtualHref);
    if (!isTabContent) return <div key={`children-${refreshTrigger}`}>{children}</div>;

    switch (activeTab) {
      case 'menu':
        return (
          <UserMenuView
            onNavigateToHome={() => handleTabChange('home')}
            onNavigate={(href) => mobileNavApi.push(href)}
          />
        );
      case 'home':
        if (user.role === 'Phục vụ') return <ServerHomeView />;
        if (user.role === 'Chủ nhà hàng') return <OwnerHomeView isStandalone={false} />;
        if (user.role === 'Pha chế') return <BartenderHomeView />;
        if (user.role === 'Quản lý') return <ManagerHomeView />;
        return <HomeView />;
      case 'schedule':
        return <ScheduleView />;
      case 'checklist':
        return <ChecklistView shiftKey={getCurrentShift()} isStandalone={false} />;
      case 'hygiene':
        return <HygieneReportView isStandalone={false} />;
      case 'comprehensive-reports':
        return <ManagerReportView isStandalone={false} />;
      case 'shift-scheduling':
        return <ShiftManagementView />;
      case 'cashier-reports':
        return <CashierReportsView isStandalone={false} />;
      case 'cashier':
        return <CashierHomeView isStandalone={false} />;
      default:
        return <HomeView />;
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] md:hidden">
      <MobileNavigationProvider value={mobileNavApi}>
        <AppNavigationProvider>
          <div key={`tab-content-${activeTab}-${virtualHref ?? 'null'}-${refreshTrigger}`} className={cn("flex-1 pb-16", isTabContent && "p-4")}>
            {renderContent()}
          </div>
        </AppNavigationProvider>
      </MobileNavigationProvider>
      <BottomNav
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        watchValue={isCheckedIn}
      />
    </div>
  );
}
