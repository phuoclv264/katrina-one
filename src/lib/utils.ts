import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from 'date-fns';
import { RevenueStats } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateShortName(displayName: string) {
  if (!displayName) return '';
  const nameParts = displayName.trim().split(/\s+/);
  if (nameParts.length <= 1) {
    return displayName;
  }
  const lastName = nameParts[nameParts.length - 1];
  const initials = nameParts
    .slice(0, nameParts.length - 1)
    .map(part => part.charAt(0).toUpperCase())
    .join('.');
  return `${initials}.${lastName}`;
};

export function getReportLink(date: string, key: string): string {
  // Checklist reports for servers have keys like 'sang', 'trua', 'toi'
  const checklistKeys = ['sang', 'trua', 'toi'];
  if (checklistKeys.includes(key)) {
    return `/reports/by-shift?date=${date}&shiftKey=${key}`;
  }

  // Handle other specific report types
  switch (key) {
    case 'bartender_hygiene':
      return `/reports/hygiene?date=${date}`;
    case 'manager_comprehensive':
      return `/reports/comprehensive?date=${date}`;
    default:
      return `/reports`; // Fallback to the main reports page
  }
}

export function removeVietnameseTones(str: string) {
  return str
    .normalize("NFD")               // Tách ký tự gốc và dấu
    .replace(/[\u0300-\u036f]/g, "") // Loại bỏ dấu
    .replace(/đ/g, "d")             // Thay thế ký tự đặc biệt
    .replace(/Đ/g, "D")
    .replace(/[^\w\s]/g, "")        // Loại bỏ ký tự đặc biệt (tùy chọn)
    .replace(/\s+/g, " ")           // Gom nhiều khoảng trắng thành 1
    .trim();
}

export function normalizeSearchString(str: string) {
  return removeVietnameseTones(str).toLowerCase().trim();
}

/**
 * Safely format a time-like value to 'HH:mm'. Accepts Date, number (ms), string (ISO),
 * or Firestore Timestamp-like objects with a toDate() method. Returns null if value is invalid.
 */
export function formatTime(value?: unknown, formatStr: string = 'HH:mm'): string | null {
  if (!value) return null;
  try {
    let d: Date | null = null;
    if (value instanceof Date) d = value as Date;
    else if (typeof value === 'number') d = new Date(value as number);
    else if (typeof value === 'string') d = new Date(value as string);
    else if (typeof (value as any)?.toDate === 'function') d = (value as any).toDate();
    if (!d || Number.isNaN(d.getTime())) return null;
    return format(d, formatStr);
  } catch (e) {
    return null;
  }
}

export function toDateSafe(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object' && typeof v.toDate === 'function') return v.toDate();
  return new Date(String(v));
};

function revenueStatTimestampMs(stat: RevenueStats): number {
  const createdAt = toDateSafe(stat.createdAt);
  if (createdAt && !Number.isNaN(createdAt.getTime())) return createdAt.getTime();
  const reportAt = toDateSafe(stat.reportTimestamp);
  if (reportAt && !Number.isNaN(reportAt.getTime())) return reportAt.getTime();
  return 0;
}

export function selectLatestRevenueStats(stats: RevenueStats[]): RevenueStats[] {
  if (!stats || stats.length <= 1) return stats || [];

  const dateKeys = new Set<string>();
  for (const stat of stats) {
    const key = stat.date || stat.id;
    if (key) dateKeys.add(key);
  }

  // If all stats are for a single day, keep only the latest one.
  if (dateKeys.size <= 1) {
    let latest: RevenueStats | null = null;
    let latestMs = -1;
    for (const stat of stats) {
      const ms = revenueStatTimestampMs(stat);
      if (!latest || ms > latestMs) {
        latest = stat;
        latestMs = ms;
      }
    }
    return latest ? [latest] : [];
  }

  // If stats span multiple days, keep the latest stat for each day.
  const latestByDate = new Map<string, { stat: RevenueStats; ms: number }>();
  for (const stat of stats) {
    const key = stat.date || stat.id;
    if (!key) continue;
    const ms = revenueStatTimestampMs(stat);
    const current = latestByDate.get(key);
    if (!current || ms > current.ms) {
      latestByDate.set(key, { stat, ms });
    }
  }

  return Array.from(latestByDate.values())
    .map((v) => v.stat)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}