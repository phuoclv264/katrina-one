

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
import { CheckSquare, ClipboardList, LogOut, FileText, User, Building, ListTodo, Sun, Moon, Sunset, Loader2, UserCog, Coffee, Archive, ShieldAlert, FileSearch, Settings, Package, ListChecks, UtensilsCrossed, Users2, ShieldX, CalendarDays, Bell, Banknote, History, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

export function AppSidebar() {
  const { user, logout, loading } = useAuth();
  const { setOpenMobile, state: sidebarState } = useSidebar();
  const pathname = usePathname();
  
  const handleLinkClick = () => {
    setOpenMobile(false);
  }

  const getMenuItems = () => {
      if (!user) return { primaryItems: [], secondaryItems: [] };
      const canManageViolations = user.role === 'Quản lý' || user.role === 'Chủ nhà hàng';
      const violationLabel = canManageViolations ? 'Ghi nhận Vi phạm' : 'Danh sách Vi phạm';

      const commonViolationMenu = { href: '/violations', label: violationLabel, icon: ShieldX };
      const commonScheduleMenu = { href: '/schedule', label: 'Lịch làm việc', icon: CalendarDays };

      let primaryItems: any[] = [];
      let secondaryItems: { role: string; item: any }[] = [];

      // Primary role menus
      switch(user?.role) {
          case 'Phục vụ': primaryItems.push(
            { href: '/shifts', label: 'Checklist Công việc', icon: CheckSquare },
            commonScheduleMenu,
            commonViolationMenu
          );
          break;
          case 'Pha chế': primaryItems.push(
            { href: '/bartender', label: 'Bảng điều khiển', icon: Coffee },
            commonScheduleMenu,
            commonViolationMenu
          );
          break;
           case 'Thu ngân': primaryItems.push(
            { href: '/cashier', label: 'Báo cáo Thu ngân', icon: Banknote },
            commonViolationMenu
          );
          break;
          case 'Quản lý': primaryItems.push(
            { href: '/manager', label: 'Bảng điều khiển', icon: UserCog },
            { href: '/manager/comprehensive-report', label: 'Kiểm tra toàn diện', icon: FileSearch },
            { href: '/reports', label: 'Xem báo cáo', icon: FileText },
            commonScheduleMenu,
            { href: '/shift-scheduling', label: 'Xếp lịch', icon: CalendarDays },
            commonViolationMenu
          );
          break;
          case 'Chủ nhà hàng': primaryItems.push(
            { href: '/reports', label: 'Xem Báo cáo', icon: FileText },
            { href: '/reports/cashier', label: 'Báo cáo Thu ngân', icon: DollarSign },
            { href: '/shift-scheduling', label: 'Xếp lịch & Phê duyệt', icon: CalendarDays },
            { href: '/users', label: 'QL Người dùng', icon: Users2 },
            { href: '/task-lists', label: 'QL Công việc Phục vụ', icon: ClipboardList },
            { href: '/bartender-tasks', label: 'QL Công việc Pha chế', icon: UtensilsCrossed },
            { href: '/comprehensive-checklist', label: 'QL Kiểm tra Toàn diện', icon: ListChecks },
            { href: '/inventory-management', label: 'QL Hàng tồn kho', icon: Package },
            { href: '/inventory-history', label: 'Lịch sử Kho', icon: History },
            commonViolationMenu,
            { href: '/reports/error-log', label: 'Giám sát Lỗi', icon: ShieldAlert }
          );
          break;
      }
      
      const primaryHrefs = new Set(primaryItems.map(item => item.href));

      // Secondary role menus
      if(user?.secondaryRoles?.includes('Phục vụ') && !primaryHrefs.has('/shifts')) {
          secondaryItems.push({ role: 'Phục vụ', item: { href: '/shifts', label: 'Checklist Công việc', icon: CheckSquare } });
      }
      if(user?.secondaryRoles?.includes('Pha chế')) {
          if (!primaryHrefs.has('/bartender/hygiene-report')) {
              secondaryItems.push({ role: 'Pha chế', item: { href: '/bartender/hygiene-report', label: 'Báo cáo Vệ sinh', icon: ClipboardList } });
          }
          if (!primaryHrefs.has('/bartender/inventory')) {
              secondaryItems.push({ role: 'Pha chế', item: { href: '/bartender/inventory', label: 'Kiểm kê Tồn kho', icon: Archive } });
          }
      }
      if(user?.secondaryRoles?.includes('Quản lý') && !primaryHrefs.has('/manager/comprehensive-report')) {
          secondaryItems.push({ role: 'Quản lý', item: { href: '/manager/comprehensive-report', label: 'Kiểm tra toàn diện', icon: FileSearch } });
      }
       if(user?.secondaryRoles?.includes('Thu ngân') && !primaryHrefs.has('/cashier')) {
          secondaryItems.push({ role: 'Thu ngân', item: { href: '/cashier', label: 'Báo cáo Thu ngân', icon: Banknote } });
      }


      return { primaryItems, secondaryItems };
  }

  const getHomeLink = () => {
    switch(user?.role) {
        case 'Phục vụ': return '/shifts';
        case 'Pha chế': return '/bartender';
        case 'Thu ngân': return '/cashier';
        case 'Quản lý': return '/manager';
        case 'Chủ nhà hàng': return '/reports';
        default: return '/';
    }
  }

  const { primaryItems, secondaryItems } = getMenuItems();
  const homeLink = getHomeLink();
  const displayName = user?.displayName ?? 'Đang tải...';
  const displayRole = user?.role ?? '';
  
  const getRoleIcon = () => {
    if (loading) return <Loader2 className="animate-spin"/>;
    switch(user?.role) {
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
            <div className="w-full group-data-[collapsible=icon]:hidden">
                <Link href={homeLink} className="flex justify-center" onClick={handleLinkClick}>
                  <Image src="https://firebasestorage.googleapis.com/v0/b/katrinaone.firebasestorage.app/o/logo_coffee.png?alt=media&token=d32a3b76-55ff-41f4-984f-a2c2742b6532" alt="Katrina One Logo" width={1419} height={304} className="h-auto w-32" />
                </Link>
            </div>
             <div className="w-full hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                 <Link href={homeLink} className="flex justify-center" onClick={handleLinkClick}>
                    <Image src="https://firebasestorage.googleapis.com/v0/b/katrinaone.firebasestorage.app/o/logo_coffee.png?alt=media&token=d32a3b76-55ff-41f4-984f-a2c2742b6532" alt="Katrina One Logo" width={1419} height={304} className="h-auto w-10" />
                 </Link>
            </div>
         </div>
        <div className="flex items-center gap-3 p-2 rounded-md bg-muted group-data-[collapsible=icon]:hidden">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                {getRoleIcon()}
            </div>
            <div className="flex flex-col overflow-hidden">
                <span className="font-semibold truncate">{displayName}</span>
                <span className="text-xs text-muted-foreground capitalize">{displayRole}</span>
            </div>
            <SidebarMenuButton
              variant="ghost"
              size="icon"
              className="ml-auto h-8 w-8 shrink-0"
              onClick={logout}
              tooltip="Đăng xuất"
              disabled={loading}
            >
              <LogOut />
            </SidebarMenuButton>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent className="flex-1">
        <SidebarMenu>
          {primaryItems.map((item) => (
            <SidebarMenuItem key={item.href} className="group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                tooltip={item.label}
              >
                <Link href={item.href} onClick={handleLinkClick}>
                  <div className="flex items-center gap-2">
                    <item.icon />
                    <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          
          {Object.entries(groupedSecondaryItems).length > 0 && (
              <SidebarSeparator className="my-2"/>
          )}

          {Object.entries(groupedSecondaryItems).map(([role, items]) => (
            <React.Fragment key={role}>
              <SidebarMenuItem className="px-3 py-2 group-data-[collapsible=icon]:hidden">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Phụ: {role}</span>
              </SidebarMenuItem>
              {(items as any[]).map((item: any) => (
                <SidebarMenuItem key={item.href} className="group-data-[collapsible=icon]:justify-center">
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.label}
                  >
                    <Link href={item.href} onClick={handleLinkClick}>
                      <div className="flex items-center gap-2">
                        <item.icon />
                        <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                      </div>
                    </Link>
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
            <SidebarMenuItem className="justify-end group-data-[collapsible=icon]:justify-center">
                <SidebarTrigger tooltip={sidebarState === 'expanded' ? "Thu gọn" : "Mở rộng"} />
            </SidebarMenuItem>
         </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
