import type { UserRole } from '@/lib/types';

export function getHomePathForRole(role: UserRole | undefined | null): string {
  switch (role) {
    case 'Phục vụ':
      return '/shifts';
    case 'Pha chế':
      return '/bartender';
    case 'Thu ngân':
      return '/cashier';
    case 'Quản lý':
      return '/manager';
    case 'Chủ nhà hàng':
      return '/reports';
    default:
      return '/';
  }
}
