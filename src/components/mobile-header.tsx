

'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

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
    '/reports/error-log': 'Nhật ký lỗi',
    '/reports/cashier': 'Báo cáo Thu ngân',
    '/reports/cashier/details': 'Chi tiết Báo cáo Thu ngân',
    '/users': 'Quản lý Người dùng',
    '/task-lists': 'QL Công việc Phục vụ',
    '/bartender-tasks': 'QL Công việc Pha chế',
    '/comprehensive-checklist': 'QL Kiểm tra Toàn diện',
    '/inventory-management': 'QL Hàng tồn kho',
    '/inventory-history': 'Lịch sử Kho',
    '/violations': 'Danh sách Vi phạm',
    '/schedule': 'Lịch làm việc',
    '/shift-scheduling': 'Xếp lịch &amp; Phê duyệt',
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
        <h1 className="text-lg font-semibold text-primary truncate">
            {title}
        </h1>
    );
}
