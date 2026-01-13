'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useAppNavigation } from '@/contexts/app-navigation-context';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  LogOut, User, CalendarDays, CheckSquare, Coffee, Banknote, UserCog, 
  BarChart3, FileText, DollarSign, CalendarClock, Users2, ClipboardList, 
  UtensilsCrossed, ListChecks, Package, FileSignature, History, ShieldX, 
  MessageSquare, ChevronRight, Sparkles, UserCircle
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { ProfileDialog } from './profile-dialog';

interface UserMenuViewProps {
  onNavigateToHome?: () => void;
  onNavigate?: (href: string) => void;
}

export default function UserMenuView({ onNavigateToHome, onNavigate }: UserMenuViewProps) {
  const { user, logout, loading, isOnActiveShift } = useAuth();
  const nav = useAppNavigation();
  const [profileOpen, setProfileOpen] = useState(false);

  if (!user) return null;

  const getMenuItems = () => {
    const canManageViolations = user.role === 'Quản lý' || user.role === 'Chủ nhà hàng';
    const violationLabel = canManageViolations ? 'Ghi nhận Vi phạm' : 'Danh sách Vi phạm';

    const commonViolationMenu = { href: '/violations', label: violationLabel, icon: ShieldX };
    const commonScheduleMenu = { href: '/schedule', label: 'Lịch làm việc', icon: CalendarDays };
    const commonReportsFeedMenu = { href: '/reports-feed', label: 'Tố cáo', icon: MessageSquare };

    let primaryItems: any[] = [];
    let secondaryItems: { role: string; item: any }[] = [];

    switch(user?.role) {
      case 'Phục vụ': primaryItems.push(
        { href: '/shifts', label: 'Bảng điều khiển', icon: CheckSquare },
        commonScheduleMenu,
        { href: '/daily-assignments', label: 'Giao việc trong ngày', icon: ClipboardList },
        commonViolationMenu,
        commonReportsFeedMenu,
      ); break;
      case 'Pha chế': primaryItems.push(
        { href: '/bartender', label: 'Bảng điều khiển', icon: Coffee },
        { href: '/daily-assignments', label: 'Giao việc trong ngày', icon: ClipboardList },
        commonScheduleMenu,
        commonViolationMenu,
        commonReportsFeedMenu,
      ); break;
      case 'Thu ngân': primaryItems.push(
        { href: '/cashier', label: 'Bảng điều khiển', icon: Banknote },
        { href: '/daily-assignments', label: 'Giao việc trong ngày', icon: ClipboardList },
        commonScheduleMenu,
        commonViolationMenu,
        commonReportsFeedMenu,
      ); break;
      case 'Quản lý': primaryItems.push(
        { href: '/manager', label: 'Bảng điều khiển', icon: UserCog },
        { href: '/daily-assignments', label: 'Giao việc trong ngày', icon: ClipboardList },
        { href: '/reports', label: 'Xem báo cáo', icon: FileText },
        commonScheduleMenu,
        commonViolationMenu,
        commonReportsFeedMenu,
      ); break;
      case 'Chủ nhà hàng': primaryItems.push(
        { href: '/admin', label: 'Tổng quan', icon: BarChart3 },
        { href: '/daily-assignments', label: 'Giao việc trong ngày', icon: ClipboardList },
        { href: '/reports', label: 'Xem Báo cáo', icon: FileText },
        { href: '/financial-report', label: 'Báo cáo Tài chính', icon: DollarSign },
        { href: '/reports/cashier', label: 'Báo cáo Thu ngân', icon: Banknote },
        { href: '/shift-scheduling', label: 'Xếp lịch & Phê duyệt', icon: CalendarDays },
        { href: '/attendance', label: 'Quản lý Chấm công', icon: User },
        { href: '/monthly-tasks', label: 'Công việc Định kỳ', icon: CalendarClock },
        commonReportsFeedMenu,
        { href: '/users', label: 'QL Người dùng', icon: Users2 },
        { href: '/task-lists', label: 'QL Công việc Phục vụ', icon: ClipboardList },
        { href: '/bartender-tasks', label: 'QL Công việc Pha chế', icon: UtensilsCrossed },
        { href: '/comprehensive-checklist', label: 'QL Kiểm tra Toàn diện', icon: ListChecks },
        { href: '/inventory-management', label: 'QL Hàng tồn kho', icon: Package },
        { href: '/product-management', label: 'QL Mặt hàng & Công thức', icon: FileSignature },
        { href: '/inventory-history', label: 'Lịch sử Kho', icon: History },
        commonViolationMenu,
      ); break;
    }

    const primaryHrefs = new Set(primaryItems.map(item => item.href));

    if (isOnActiveShift) {
      if(user?.secondaryRoles?.includes('Phục vụ') && !primaryHrefs.has('/shifts')) {
        secondaryItems.push({ role: 'Phục vụ', item: { href: '/shifts', label: 'Checklist Công việc', icon: CheckSquare } });
      }
      if(user?.secondaryRoles?.includes('Pha chế') && !primaryHrefs.has('/bartender')) {
         secondaryItems.push({ role: 'Pha chế', item: { href: '/bartender/hygiene-report', label: 'Báo cáo Vệ sinh quầy', icon: ClipboardList } });
         secondaryItems.push({ role: 'Pha chế', item: { href: '/bartender/inventory', label: 'Kiểm kê Tồn kho', icon: History } });
      }
      if(user?.secondaryRoles?.includes('Quản lý') && !primaryHrefs.has('/manager')) {
          secondaryItems.push({ role: 'Quản lý', item: { href: '/manager/comprehensive-report', label: 'Phiếu kiểm tra toàn diện', icon: FileText } });
      }
      if(user?.secondaryRoles?.includes('Thu ngân') && !primaryHrefs.has('/cashier')) {
          secondaryItems.push({ role: 'Thu ngân', item: { href: '/cashier', label: 'Báo cáo Thu ngân', icon: Banknote } });
      }
    }

    return { primaryItems, secondaryItems };
  }

  const { primaryItems, secondaryItems } = getMenuItems();

  const handleNavigate = (href: string) => {
    // Check if this is a "Home" link (Dashboard/Overview)
    const isHomeLink = ['/shifts', '/bartender', '/manager', '/admin'].includes(href);
    
    if (isHomeLink && onNavigateToHome) {
      onNavigateToHome();
    } else if (onNavigate) {
      onNavigate(href);
    } else {
      nav.push(href);
    }
  }

  return (
    <div className="flex flex-col h-full bg-background/50">
      {/* Header Profile Section */}
      <div className="p-6 pb-2">
        <div className="flex items-start justify-between mb-6">
           <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold tracking-tight">Xin chào,</h2>
              <h3 className="text-xl font-semibold text-primary">{user.displayName}</h3>
           </div>
           <Avatar className="h-16 w-16 border-2 border-background shadow-lg">
              <AvatarImage src={user.photoURL || ''} />
              <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                {getInitials(user.displayName || 'User')}
              </AvatarFallback>
           </Avatar>
        </div>
        
        <div className="flex items-center justify-between gap-2 mb-2">
           <Badge variant="secondary" className="px-3 py-1 text-sm font-medium capitalize shadow-sm">
              {user.role}
           </Badge>
           <div className="flex gap-1">
             <Button
                variant="ghost"
                size="sm"
                onClick={() => setProfileOpen(true)}
                className="text-muted-foreground hover:text-primary hover:bg-primary/10"
              >
                <UserCircle className="w-4 h-4 mr-2" />
                Hồ sơ
              </Button>
             <Button 
              variant="ghost" 
              size="sm" 
              onClick={logout} 
              disabled={loading}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Đăng xuất
            </Button>
           </div>
        </div>
      </div>

      <Separator className="mb-4" />
      
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />

      {/* Menu Items */}
      <ScrollArea className="flex-1 px-4 pb-6">
        <div className="space-y-3">
          {primaryItems.map((item, index) => (
            <button
              key={item.href}
              onClick={() => handleNavigate(item.href)}
              className="group relative flex items-center w-full p-3 overflow-hidden transition-all bg-card border rounded-xl shadow-sm hover:shadow-md hover:border-primary/50 active:scale-[0.98]"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <item.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 ml-4 text-left">
                <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                  {item.label}
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
            </button>
          ))}

          {secondaryItems.length > 0 && (
            <div className="pt-4 mt-2">
              <div className="flex items-center gap-2 mb-4 px-1">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Vai trò phụ
                </span>
              </div>
              
              <div className="space-y-3">
                {secondaryItems.map(({ role, item }, idx) => (
                  <div key={`${role}-${idx}`} className="relative">
                    <div className="absolute -top-2 left-4 px-2 bg-background text-[10px] font-bold text-muted-foreground uppercase z-10">
                      {role}
                    </div>
                    <button
                      onClick={() => handleNavigate(item.href)}
                      className="group flex items-center w-full p-3 mt-1 transition-all bg-muted/30 border border-dashed rounded-xl hover:bg-card hover:border-solid hover:border-amber-500/50 hover:shadow-sm active:scale-[0.98]"
                    >
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted text-muted-foreground group-hover:bg-amber-100 group-hover:text-amber-600 transition-colors">
                        <item.icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 ml-4 text-left">
                        <span className="text-sm font-medium text-foreground/80 group-hover:text-amber-700 transition-colors">
                          {item.label}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-amber-500 transition-colors" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="h-6" /> {/* Bottom spacer */}
      </ScrollArea>
    </div>
  );
}
