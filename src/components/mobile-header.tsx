
'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';
import { NotificationBell } from './notification-bell';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import { useAppNavigation } from '@/contexts/app-navigation-context';
import { isHomeRoute } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';

const pathToTitleMap: { [key: string]: string } = {
    '/shifts': 'Báo cáo Phục vụ',
    '/bartender': 'Báo cáo Pha chế',
    '/bartender/hygiene-report': 'Báo cáo Vệ sinh quầy',
    '/bartender/inventory': 'Kiểm kê Tồn kho',
    '/cashier': 'Báo cáo Thu ngân',
    '/manager': 'Báo cáo Quản lý',
    '/manager/comprehensive-report': 'Phiếu kiểm tra toàn diện',
    '/manager/hygiene-report': 'Xem Báo cáo Vệ sinh',
    '/manager/inventory-report': 'Xem Báo cáo Tồn kho',
    '/reports': 'Xem Báo cáo',
    '/reports/by-shift': 'Chi tiết Báo cáo',
    '/reports/hygiene': 'Báo cáo Vệ sinh',
    '/reports/inventory': 'Báo cáo Tồn kho',
    '/reports/comprehensive': 'Báo cáo Toàn diện',
    '/reports/cashier': 'Báo cáo Thu ngân',
    '/financial-report': 'Báo cáo Tài chính',
    '/users': 'Quản lý Người dùng',
    '/task-lists': 'QL Công việc Phục vụ',
    '/bartender-tasks': 'QL Công việc Pha chế',
    '/comprehensive-checklist': 'QL Kiểm tra Toàn diện',
    '/inventory-management': 'QL Hàng tồn kho',
    '/product-management': 'QL Mặt hàng & Công thức',
    '/inventory-history': 'Lịch sử Kho',
    '/violations': 'Danh sách Vi phạm',
    '/schedule': 'Lịch làm việc',
    '/shift-scheduling': 'Xếp lịch & Phê duyệt',
    '/reports-feed': 'Tố cáo',
    '/attendance': 'Quản lý Chấm công',
    '/admin/events': 'Sự kiện & Thông báo',
    '/monthly-tasks': 'Công việc tháng',
    '/monthly-task-reports': 'Báo cáo CV tháng',
    '/daily-assignments': 'Phân công ngày',
};

const tabToTitleMap: { [key: string]: string } = {
    'home': 'Trang chủ',
    'schedule': 'Lịch làm việc',
    'checklist': 'Checklist công việc',
    'hygiene': 'Báo cáo Vệ sinh',
    'comprehensive-reports': 'Báo cáo Toàn diện',
    'shift-scheduling': 'Xếp lịch & Phê duyệt',
    'cashier-reports': 'Báo cáo Thu ngân',
    'cashier': 'Báo cáo Thu ngân',
    'menu': 'Tài khoản',
};

function getPageFromHash(hash: string): string | null {
    const prefix = '#page=';
    if (!hash?.startsWith(prefix)) return null;
    const raw = hash.slice(prefix.length);
    if (!raw) return null;
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
}

function getTabFromHash(hash: string): string | null {
    const prefix = '#tab=';
    if (!hash?.startsWith(prefix)) return null;
    const raw = hash.slice(prefix.length);
    if (!raw) return null;
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
}

export function MobileHeader() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const navigation = useAppNavigation();
    const { user } = useAuth();
    // Start with an empty hash so server and initial client render match (avoids hydration mismatch).
    const [hash, setHash] = useState('');

    useEffect(() => {
        const updateHash = () => {
            if (typeof window !== 'undefined') {
                setHash(window.location.hash);
            }
        };

        // Immediate update
        updateHash();
    }, [pathname, searchParams]);

    const virtualPage = useMemo(() => getPageFromHash(hash), [hash]);
    const activeTab = useMemo(() => getTabFromHash(hash), [hash]);
    const displayPath = virtualPage || pathname;

    const showBackButton = useMemo(() => {
        return !isHomeRoute(pathname, hash, user?.role);
    }, [pathname, hash, user?.role]);

    const title = useMemo(() => {
        // 1. Check if we are on a tab
        if (activeTab && tabToTitleMap[activeTab]) {
            if (activeTab === 'home' && user?.role) {
                // For home tab, show role specific title if possible
                return pathToTitleMap[displayPath] || 'Trang chủ';
            }
            return tabToTitleMap[activeTab];
        }

        // 2. Check for dynamic routes like checklist
        if (displayPath.startsWith('/checklist')) {
            return 'Checklist công việc';
        }
        return pathToTitleMap[displayPath] || 'Katrina One';
    }, [displayPath, activeTab, user]);

    const handleBack = () => {
        navigation?.back();
    };

    return (
        <div className="flex items-center justify-between w-full h-full gap-2 px-1">
            <div className="flex items-center flex-1 min-w-0">
                <div className="flex items-center w-10 shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "h-10 w-10 relative flex items-center justify-center transition-all duration-300",
                            "rounded-2xl active:scale-90",
                            "bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm",
                            showBackButton ? "hover:bg-zinc-100 dark:hover:bg-zinc-800" : "cursor-default"
                        )}
                        onClick={handleBack}
                    >
                        <div className="relative h-6 w-6 flex items-center justify-center">
                            <ChevronLeft className={cn(
                                "h-6 w-6 stroke-[2.5px] text-zinc-900 dark:text-zinc-50 transition-all duration-500 absolute",
                                showBackButton ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-50 -rotate-90"
                            )} />
                            <UserAvatar 
                                user={user}
                                className={cn(
                                    "transition-all duration-500 absolute",
                                    !showBackButton ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-50 rotate-90"
                                )}
                            />
                        </div>
                    </Button>
                </div>
                
                <div className="flex flex-col min-w-0 ml-3 transition-all duration-300">
                   <h1 className="text-[18px] font-black text-zinc-900 dark:text-zinc-50 truncate leading-none tracking-tight">
                        {title}
                    </h1>
                    <span className={cn(
                        "text-[9px] uppercase font-black tracking-[0.14em] mt-0.5 transition-all duration-300",
                        showBackButton ? "text-primary/80 dark:text-primary/60" : "text-zinc-400 dark:text-zinc-500"
                    )}>
                        {showBackButton ? "Quay lại" : "Katrina Coffee"}
                    </span>
                </div>
            </div>

            <div className="flex items-center shrink-0">
                <NotificationBell />
            </div>
        </div>
    );
}
