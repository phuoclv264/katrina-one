
'use client';

import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/use-auth';
import { useSidebar } from '@/components/ui/sidebar';
import { CheckSquare, ClipboardList, LogOut, FileText, User, Building, ListTodo, Sun, Moon, Sunset, Loader2, UserCog, Coffee, Archive, ShieldAlert, FileSearch, Settings, Package, ListChecks, UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AppSidebar() {
  const { user, logout, loading } = useAuth();
  const { setOpenMobile } = useSidebar();
  const pathname = usePathname();

  const staffMenu = [
    { href: '/shifts', label: 'Ca làm việc', icon: CheckSquare },
  ];
  
  const bartenderMenu = [
    { href: '/bartender', label: 'Bảng điều khiển', icon: Coffee },
    { href: '/bartender/hygiene-report', label: 'Báo cáo Vệ sinh quầy', icon: ClipboardList },
    { href: '/bartender/inventory', label: 'Kiểm kê Tồn kho', icon: Archive },
  ];

  const managerMenu = [
    { href: '/manager', label: 'Bảng điều khiển', icon: UserCog },
    { href: '/manager/comprehensive-report', label: 'Kiểm tra toàn diện', icon: FileSearch },
  ];
  
  const ownerMenu = [
    { href: '/reports', label: 'Xem Báo cáo', icon: FileText },
    { href: '/task-lists', label: 'QL Công việc Phục vụ', icon: ClipboardList },
    { href: '/bartender-tasks', label: 'QL Công việc Pha chế', icon: UtensilsCrossed },
    { href: '/comprehensive-checklist', label: 'QL Kiểm tra Toàn diện', icon: ListChecks },
    { href: '/inventory-management', label: 'QL Hàng tồn kho', icon: Package },
    { href: '/reports/error-log', label: 'Giám sát Lỗi', icon: ShieldAlert },
  ]
  
  const getMenuItems = () => {
      switch(user?.role) {
          case 'Phục vụ': return staffMenu;
          case 'Pha chế': return bartenderMenu;
          case 'Quản lý': return managerMenu;
          case 'Chủ nhà hàng': return ownerMenu;
          default: return [];
      }
  }

  const menuItems = getMenuItems();
  const displayName = user?.displayName ?? 'Đang tải...';
  const displayRole = user?.role ?? '';
  
  const getRoleIcon = () => {
    if (loading) return <Loader2 className="animate-spin"/>;
    switch(user?.role) {
      case 'Phục vụ': return <User />;
      case 'Pha chế': return <Coffee />;
      case 'Quản lý': return <UserCog />;
      case 'Chủ nhà hàng': return <Building />;
      default: return <User />;
    }
  }


  return (
    <>
      <SidebarHeader className="p-4">
        <h1 className="text-2xl font-bold text-primary font-headline">Katrina One</h1>
      </SidebarHeader>
      <SidebarFooter className="p-2">
        <div className="flex items-center gap-3 p-2 rounded-md bg-muted">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
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
      </SidebarFooter>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href} onClick={() => setOpenMobile(false)}>
              <Link href={item.href}>
                <SidebarMenuButton
                  isActive={pathname === item.href}
                  tooltip={item.label}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </>
  );
}
