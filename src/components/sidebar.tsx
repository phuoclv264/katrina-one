'use client';

import * as React from "react"
import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/use-auth';
import { useSidebar } from '@/components/ui/sidebar';
import { CheckSquare, ClipboardList, LogOut, FileText, User, Building, ListTodo, Sun, Moon, Sunset, Loader2, UserCog, Coffee, Archive, ShieldAlert, FileSearch, Settings, Package, ListChecks, UtensilsCrossed, Users2, ShieldX, CalendarDays, Bell, Banknote, History, DollarSign, FileSignature, MessageSquare, Edit2, RotateCw, UserCheck, BarChart3, CalendarClock } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Image from '@/components/ui/image';
import { useAppNavigation } from '@/contexts/app-navigation-context';
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { getInitials } from '@/lib/utils';
import { ProfileDialog } from "./profile-dialog";
import { useState } from "react";

export function AppSidebar() {
  const { user, logout, loading, isOnActiveShift } = useAuth();
  const { setOpenMobile, state: sidebarState } = useSidebar();
  const pathname = usePathname();
  const nav = useAppNavigation();
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLinkClick = () => {
    setOpenMobile(false);
  }

  const navigate = (href: string) => {
    nav.push(href);
    handleLinkClick();
  }

  const getMenuItems = () => {
    if (!user) return { primaryItems: [], secondaryItems: [] };

    const canManageViolations = user.role === 'Quản lý' || user.role === 'Chủ nhà hàng';
    const violationLabel = canManageViolations ? 'Ghi nhận Vi phạm' : 'Danh sách Vi phạm';

    const commonViolationMenu = { href: '/violations', label: violationLabel, icon: ShieldX };
    const commonScheduleMenu = { href: '/schedule', label: 'Lịch làm việc', icon: CalendarDays };
    const commonReportsFeedMenu = { href: '/reports-feed', label: 'Tố cáo', icon: MessageSquare };


    let primaryItems: any[] = [];
    let secondaryItems: { role: string; item: any }[] = [];

    // Primary role menus
    switch (user?.role) {
      case 'Phục vụ': primaryItems.push(
        { href: '/shifts', label: 'Bảng điều khiển', icon: CheckSquare },
        commonScheduleMenu,
        { href: '/daily-assignments', label: 'Giao việc trong ngày', icon: ListChecks },
        commonViolationMenu,
        commonReportsFeedMenu,
      );
        break;
      case 'Pha chế': primaryItems.push(
        { href: '/bartender', label: 'Bảng điều khiển', icon: Coffee },
        commonScheduleMenu,
        { href: '/daily-assignments', label: 'Giao việc trong ngày', icon: ListChecks },
        commonViolationMenu,
        commonReportsFeedMenu,
      );
        break;
      case 'Thu ngân': primaryItems.push(
        { href: '/cashier', label: 'Bảng điều khiển', icon: Banknote },
        commonScheduleMenu,
        { href: '/daily-assignments', label: 'Giao việc trong ngày', icon: ListChecks },
        commonViolationMenu,
        commonReportsFeedMenu,
      );
        break;
      case 'Quản lý': primaryItems.push(
        { href: '/manager', label: 'Bảng điều khiển', icon: UserCog },
        { href: '/reports', label: 'Xem báo cáo', icon: FileText },
        commonScheduleMenu,
        { href: '/daily-assignments', label: 'Giao việc trong ngày', icon: ListChecks },

        commonViolationMenu,
        commonReportsFeedMenu
      );
        break;
      case 'Chủ nhà hàng': primaryItems.push(
        { href: '/admin', label: 'Tổng quan', icon: BarChart3 },
        { href: '/reports', label: 'Xem Báo cáo', icon: FileText },
        { href: '/financial-report', label: 'Báo cáo Tài chính', icon: DollarSign },
        { href: '/reports/cashier', label: 'Báo cáo Thu ngân', icon: Banknote },
        { href: '/shift-scheduling', label: 'Xếp lịch & Phê duyệt', icon: CalendarDays },
        { href: '/attendance', label: 'Quản lý Chấm công', icon: UserCheck },
        { href: '/monthly-tasks', label: 'Công việc Định kỳ', icon: CalendarClock },
        { href: '/daily-assignments', label: 'Giao việc trong ngày', icon: ListChecks },
        commonReportsFeedMenu,
        { href: '/users', label: 'QL Người dùng', icon: Users2 },
        { href: '/task-lists', label: 'QL Công việc Phục vụ', icon: ClipboardList },
        { href: '/bartender-tasks', label: 'QL Công việc Pha chế', icon: UtensilsCrossed },
        { href: '/comprehensive-checklist', label: 'QL Kiểm tra Toàn diện', icon: ListChecks },
        { href: '/inventory-management', label: 'QL Hàng tồn kho', icon: Package },
        { href: '/product-management', label: 'QL Mặt hàng & Công thức', icon: FileSignature },
        { href: '/inventory-history', label: 'Lịch sử Kho', icon: History },
        commonViolationMenu
      );
        break;
    }

    const primaryHrefs = new Set(primaryItems.map(item => item.href));

    if (isOnActiveShift) { // Non-owners only see secondary roles if on shift
      if (user?.secondaryRoles?.includes('Phục vụ') && !primaryHrefs.has('/shifts')) {
        secondaryItems.push({ role: 'Phục vụ', item: { href: '/shifts', label: 'Checklist Công việc', icon: CheckSquare } });
      }
      if (user?.secondaryRoles?.includes('Pha chế') && !primaryHrefs.has('/bartender')) {
        secondaryItems.push({ role: 'Pha chế', item: { href: '/bartender/hygiene-report', label: 'Báo cáo Vệ sinh quầy', icon: ClipboardList } });
        secondaryItems.push({ role: 'Pha chế', item: { href: '/bartender/inventory', label: 'Kiểm kê Tồn kho', icon: Archive } });
      }
      if (user?.secondaryRoles?.includes('Quản lý') && !primaryHrefs.has('/manager')) {
        secondaryItems.push({ role: 'Quản lý', item: { href: '/manager/comprehensive-report', label: 'Phiếu kiểm tra toàn diện', icon: FileSearch } });
      }
      if (user?.secondaryRoles?.includes('Thu ngân') && !primaryHrefs.has('/cashier')) {
        secondaryItems.push({ role: 'Thu ngân', item: { href: '/cashier', label: 'Báo cáo Thu ngân', icon: Banknote } });
      }
    }

    return { primaryItems, secondaryItems };
  }

  const navigateHome = () => {
    nav.push(getHomeLink());
    handleLinkClick();
  }

  const getHomeLink = () => {
    switch (user?.role) {
      case 'Phục vụ': return '/shifts';
      case 'Pha chế': return '/bartender';
      case 'Thu ngân': return '/cashier';
      case 'Quản lý': return '/manager';
      case 'Chủ nhà hàng': return '/admin';
      default: return '/';
    }
  }

  const { primaryItems, secondaryItems } = getMenuItems();
  const displayName = user?.displayName ?? 'Đang tải...';
  const displayRole = user?.role ?? '';
  const getRoleIcon = () => {
    if (loading) return <Loader2 className="animate-spin" />;
    switch (user?.role) {
      case 'Phục vụ': return <User />;
      case 'Pha chế': return <Coffee />;
      case 'Thu ngân': return <Banknote />;
      case 'Quản lý': return <UserCog />;
      case 'Chủ nhà hàng': return <Building />;
      default: return <User />;
    }
  }

  // Group secondary items by role
  const groupedSecondaryItems = secondaryItems.reduce((acc, { role, item }) => {
    if (!acc[role]) {
      acc[role] = [];
    }
    acc[role].push(item);
    return acc;
  }, {} as Record<string, any[]>);


  return (
    <>
      <SidebarHeader className="flex flex-col gap-2 p-2">
        <div className="p-2 flex items-center justify-center gap-2">
          <div className="w-full group-data-[collapsible=icon]:hidden cursor-pointer">
            <div onClick={navigateHome} className="flex justify-center">
              <Image src="https://firebasestorage.googleapis.com/v0/b/katrinaone.firebasestorage.app/o/logo_coffee.png?alt=media&token=c4832ac1-b277-425e-9d35-8108cd2c3fe6" alt="Katrina One Logo" width={1419} height={304} loading="lazy" className="h-auto w-32" />
            </div>
          </div>
          <div className="w-full hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center cursor-pointer">
            <div onClick={navigateHome} className="flex justify-center">
              <Image src="https://firebasestorage.googleapis.com/v0/b/katrinaone.firebasestorage.app/o/logo_coffee.png?alt=media&token=c4832ac1-b277-425e-9d35-8108cd2c3fe6" alt="Katrina One Logo" width={1419} height={304} loading="lazy" className="h-auto w-10" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-2 group-data-[collapsible=icon]:hidden">
          <div
            className="relative group/avatar cursor-pointer shrink-0"
            onClick={() => setProfileOpen(true)}
          >
            <Avatar className="h-10 w-10 border border-border shadow-sm group-hover/avatar:brightness-75 transition-all">
              <AvatarImage src={user?.photoURL || ''} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
              <Edit2 className="h-4 w-4 text-white drop-shadow-md" />
            </div>
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="font-semibold truncate">{displayName}</span>
            <span className="text-xs text-muted-foreground capitalize truncate">{displayRole}</span>
          </div>
        </div>
        <div className="hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center p-2">
          <div
            className="relative group/avatar cursor-pointer"
            onClick={() => setProfileOpen(true)}
          >
            <Avatar className="h-8 w-8 border border-border shadow-sm group-hover/avatar:brightness-75 transition-all">
              <AvatarImage src={user?.photoURL || ''} />
              <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
              <Edit2 className="h-3 w-3 text-white drop-shadow-md" />
            </div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} parentDialogTag="root" />
      <SidebarContent className="flex-1">
        <SidebarMenu>
          {primaryItems.map((item) => (
            <SidebarMenuItem key={item.href} className="group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                isActive={pathname === item.href}
                tooltip={item.label}
                onClick={() => navigate(item.href)}
              >
                <div className="flex items-center gap-2">
                  <item.icon />
                  <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}

          {Object.entries(groupedSecondaryItems).length > 0 && (
            <SidebarSeparator className="my-2" />
          )}

          {Object.entries(groupedSecondaryItems).map(([role, items]) => (
            <React.Fragment key={role}>
              <SidebarMenuItem className="px-3 py-2 group-data-[collapsible=icon]:hidden">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Phụ: {role}</span>
              </SidebarMenuItem>
              {(items as any[]).map((item: any) => (
                <SidebarMenuItem key={item.href} className="group-data-[collapsible=icon]:justify-center">
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    tooltip={item.label}
                    onClick={() => navigate(item.href)}
                  >
                    <div className="flex items-center gap-2">
                      <item.icon />
                      <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </React.Fragment>
          ))}

        </SidebarMenu>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem className="group-data-[collapsible=icon]:justify-center">
            <SidebarMenuButton
              onClick={() => logout()}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              tooltip="Đăng xuất"
            >
              <LogOut className="h-4 w-4" />
              <span className="group-data-[collapsible=icon]:hidden">Đăng xuất</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="justify-end group-data-[collapsible=icon]:justify-center">
            <SidebarTrigger tooltip={sidebarState === 'expanded' ? "Thu gọn" : "Mở rộng"} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
