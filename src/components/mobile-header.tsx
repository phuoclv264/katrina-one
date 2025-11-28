
'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { NotificationBell } from './notification-bell';

const pathToTitleMap: { [key: string]: string } = {
    '/shifts': 'Chọn ca làm việc',
    '/bartender': 'Danh mục Báo cáo Pha chế',
    '/bartender/hygiene-report': 'Báo cáo Vệ sinh quầy',
    '/bartender/inventory': 'Kiểm kê Tồn kho',
    '/cashier': 'Báo cáo Thu ngân',
    '/manager': 'Bảng điều khiển Quản lý',
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
    '/attendance': 'Quản lý Chấm công', // Added this line
};

export function MobileHeader() {
    const pathname = usePathname();

    const title = useMemo(() => {
        if (pathname.startsWith('/checklist')) {
            return 'Checklist công việc';
        }
        return pathToTitleMap[pathname] || 'Katrina One';
    }, [pathname]);

    return (
        <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-primary truncate">
                {title}
            </h1>
            <NotificationBell />
        </div>
    );
}
