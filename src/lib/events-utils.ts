import type { EventStatus } from './types';
import { Timestamp } from 'firebase/firestore';

export function getStatusConfig(status: EventStatus | string) {
  switch (status) {
    case 'active': 
      return { color: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/20', text: 'text-emerald-700 dark:text-emerald-400', label: 'Đang diễn ra' };
    case 'expired':
      return { color: 'bg-slate-500', bg: 'bg-slate-50 dark:bg-slate-950/20', text: 'text-slate-700 dark:text-slate-400', label: 'Đã hết hạn' };
    case 'closed': 
      return { color: 'bg-rose-500', bg: 'bg-rose-50 dark:bg-rose-950/20', text: 'text-rose-700 dark:text-rose-400', label: 'Đã kết thúc' };
    case 'draft': 
      return { color: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-700 dark:text-amber-400', label: 'Bản nháp' };
    default: 
      return { color: 'bg-gray-500', bg: 'bg-gray-50', text: 'text-gray-700', label: status };
  }
}

export function isExpired(endAt?: Timestamp | Date | string) {
  if (!endAt) return false;
  const date = (endAt as Timestamp).toDate ? (endAt as Timestamp).toDate() : new Date(endAt as string);
  return date.getTime() < Date.now();
}

export function getEffectiveStatus(status: EventStatus | string, endAt?: Timestamp | Date | string) {
  if (status !== 'closed' && isExpired(endAt)) return 'expired';
  return status;
}
