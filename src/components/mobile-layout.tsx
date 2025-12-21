'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useSidebar } from '@/components/ui/sidebar';
import { BottomNav, NavTab } from '@/components/bottom-nav';
import { 
  Home, 
  CalendarDays, 
  Menu, 
  ClipboardList, 
  ShieldCheck, 
  FileText, 
  Banknote, 
  CalendarClock 
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import ScheduleView from '@/app/(app)/schedule/_components/schedule-view';
import { ServerHomeView } from '@/components/views/server-home-view';
import { OwnerHomeView } from '@/components/views/owner-home-view';
import { BartenderHomeView } from '@/components/views/bartender-home-view';
import { ManagerHomeView } from '@/components/views/manager-home-view';
import { CashierHomeView } from '@/components/views/cashier-home-view';
import ChecklistView from '@/app/(app)/checklist/[shift]/_components/checklist-view';
import HygieneReportView from '@/app/(app)/bartender/hygiene-report/_components/hygiene-report-view';
import ManagerReportView from '@/app/(app)/manager/comprehensive-report/_components/manager-report-view';
import { format } from 'date-fns';

// Placeholder components
const HomeView = () => <div className="p-4">Home View Content</div>;
const QuickAccessView = ({ type }: { type: string }) => <div className="p-4">Quick Access: {type}</div>;
const CashierReportView = () => <div className="p-4">Cashier Report Content</div>;
const ShiftSchedulingView = () => <div className="p-4">Shift Scheduling Content</div>;

function getCurrentShift(): string {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const time = hour * 60 + minute;

  if (time >= 5 * 60 + 30 && time < 12 * 60) return 'sang';
  if (time >= 12 * 60 && time < 17 * 60) return 'trua';
  if (time >= 17 * 60 && time < 22 * 60 + 30) return 'toi';
  return 'sang'; // Default or closed
}

export function MobileLayout() {
  const { user } = useAuth();
  const { setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState('home');

  // Initialize active tab based on pathname
  useEffect(() => {
    if (pathname.includes('/schedule')) setActiveTab('schedule');
    else if (pathname.includes('/checklist')) setActiveTab('checklist');
    else if (pathname.includes('/hygiene-report')) setActiveTab('hygiene');
    else if (pathname.includes('/comprehensive-report')) setActiveTab('reports');
    else if (pathname.includes('/shift-scheduling')) setActiveTab('shift-scheduling');
    else if (pathname.includes('/reports/cashier')) setActiveTab('cashier-reports');
    else setActiveTab('home');
  }, []); // Run only once on mount

  if (!user) return null;

  const getTabs = (): NavTab[] => {
    const commonUserTab = {
      id: 'menu',
      label: 'Menu',
      icon: Menu,
    };

    if (user.role === 'Chủ nhà hàng') {
      return [
        { id: 'home', label: 'Trang chủ', icon: Home },
        { id: 'shift-scheduling', label: 'Xếp lịch', icon: CalendarClock },
        { id: 'cashier-reports', label: 'Thu ngân', icon: Banknote },
        commonUserTab
      ];
    }

    let quickAccess: NavTab | null = null;
    switch (user.role) {
      case 'Phục vụ':
        quickAccess = { id: 'checklist', label: 'Checklist', icon: ClipboardList };
        break;
      case 'Pha chế':
        quickAccess = { id: 'hygiene', label: 'Vệ sinh', icon: ShieldCheck };
        break;
      case 'Quản lý':
        quickAccess = { id: 'reports', label: 'Báo cáo', icon: FileText };
        break;
    }

    const tabs: NavTab[] = [{ id: 'home', label: 'Trang chủ', icon: Home }];
    if (quickAccess) tabs.push(quickAccess);
    tabs.push({ id: 'schedule', label: 'Lịch', icon: CalendarDays });
    tabs.push(commonUserTab);

    return tabs;
  };

  const tabs = getTabs();

  const handleTabChange = (tabId: string) => {
    if (tabId === 'menu') {
      setOpenMobile(true);
    } else {
      setActiveTab(tabId);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        if (user.role === 'Phục vụ') return <ServerHomeView />;
        if (user.role === 'Chủ nhà hàng') return <OwnerHomeView isStandalone={false} />;
        if (user.role === 'Pha chế') return <BartenderHomeView />;
        if (user.role === 'Quản lý') return <ManagerHomeView />;
        if (user.role === 'Thu ngân') return <CashierHomeView isStandalone={false} />;
        return <HomeView />; 
      case 'schedule':
        return <ScheduleView />;
      case 'checklist':
        return <ChecklistView shiftKey={getCurrentShift()} isStandalone={false} />;
      case 'hygiene':
        return <HygieneReportView isStandalone={false} />;
      case 'reports':
        return <ManagerReportView isStandalone={false} />;
      case 'shift-scheduling':
        return <ShiftSchedulingView />;
      case 'cashier-reports':
        return <CashierHomeView isStandalone={false} />;
      default:
        return <HomeView />;
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] md:hidden">
      <div className="flex-1 pb-16">
        {renderContent()}
      </div>
      <BottomNav 
        tabs={tabs} 
        activeTab={activeTab} 
        onTabChange={handleTabChange} 
      />
    </div>
  );
}
