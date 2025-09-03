

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
import { CheckSquare, ClipboardList, LogOut, FileText, User, Building, ListTodo, Sun, Moon, Sunset, Loader2, UserCog, Coffee } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AppSidebar() {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();

  const staffMenu = [
    { href: '/shifts', label: 'Ca làm việc của tôi', icon: CheckSquare },
  ];

  const managerMenu = [
    { href: '/reports', label: 'Báo cáo ca', icon: FileText },
    { href: '/task-lists', label: 'Danh sách công việc', icon: ClipboardList },
  ];

  const menuItems = (user?.role === 'Phục vụ' || user?.role === 'Pha chế') ? staffMenu : managerMenu;
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
      <SidebarSeparator />
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href}>
                <SidebarMenuButton
                  isActive={pathname.startsWith(item.href)}
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
      <SidebarSeparator />
      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3">
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
    </>
  );
}

    