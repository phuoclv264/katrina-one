import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from 'date-fns';

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