import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, type Locale } from 'date-fns';
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

/**
 * Return initials for a given display name.
 * Behavior:
 *  - Single name: return first N chars (maxChars)
 *  - Multi-part name: take the first letters from the last up-to-N name parts
 * Examples:
 *  - "Phan Ngọc Huy" -> "NH" (default max 2)
 *  - "Nguyen Van A" -> "VA"
 *  - "Alice" -> "A"
 */
export function getInitials(displayName: string | undefined | null, maxChars = 2): string {
  if (!displayName) return '';
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].substring(0, maxChars).toUpperCase();
  // Use initials from the last `maxChars` name parts (e.g., last + given name)
  const start = Math.max(0, parts.length - maxChars);
  const initials = parts.slice(start).map(p => p[0]).join('').toUpperCase();
  return initials.substring(0, maxChars);
}

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

/**
 * Convert a Date/number/string/Firestore Timestamp-like object to a formatted string.
 * Returns 'N/A' when the value is missing or invalid.
 *
 * @param value - Date | number | string | Firestore Timestamp-like
 * @param formatStr - date-fns format string (default: 'dd/MM/yy HH:mm')
 * @param locale - optional date-fns Locale (e.g., vi)
 */
export function timestampToString(value?: unknown, formatStr: string = 'dd/MM/yy HH:mm', locale?: Locale): string {
  if (!value) return 'N/A';
  const d = toDateSafe(value);
  if (!d || Number.isNaN(d.getTime())) return 'N/A';
  try {
    return format(d, formatStr, locale ? { locale } : undefined);
  } catch (e) {
    return 'N/A';
  }
}

/**
 * Return a string formatted for `input[type="datetime-local"]`.
 * - Produces `yyyy-MM-dd'T'HH:mm` or the empty string when value is invalid.
 * - Accepts Date | number | ISO string | Firestore Timestamp-like.
 */
export function toDatetimeLocalInput(value?: unknown): string {
  if (!value) return '';
  const d = toDateSafe(value);
  if (!d || Number.isNaN(d.getTime())) return '';
  try {
    return format(d, "yyyy-MM-dd'T'HH:mm");
  } catch (e) {
    return '';
  }
}

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

/**
 * Advanced search function that filters and sorts items based on a query string.
 *
 * Features:
 * - Case-insensitive and accent-insensitive (handles Vietnamese tones).
 * - Multi-field search support.
 * - Token-based matching: Query is split into words; all words must be present in the item.
 * - Relevance sorting:
 *    1. Exact match on a field
 *    2. Field starts with query
 *    3. Phrase match (consecutive tokens)
 *    4. General token match
 *
 * @param items - The array of objects to search.
 * @param query - The search query string.
 * @param keys - Array of keys (strings) or accessor functions to retrieve searchable text from an item.
 * @returns The filtered and sorted array of items.
 */
export function advancedSearch<T>(
  items: T[],
  query: string,
  keys: (keyof T | ((item: T) => string | undefined | null))[]
): T[] {
  if (!query || !query.trim()) {
    return items;
  }

  const normalizedQuery = normalizeSearchString(query);
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

  if (queryTokens.length === 0) {
    return items;
  }

  // Helper to get normalized values from item
  const getItemValues = (item: T): string[] => {
    return keys.map((key) => {
      let value: string | undefined | null = '';
      if (typeof key === 'function') {
        value = key(item);
      } else {
        const v = item[key];
        // Handle various types safely
        if (typeof v === 'string') value = v;
        else if (typeof v === 'number') value = String(v);
        else if (v && typeof v === 'object' && 'toString' in v) value = String(v);
      }
      return value ? normalizeSearchString(value) : '';
    });
  };

  const scoredItems = items.map((item) => {
    const fieldValues = getItemValues(item);
    const combinedItemText = fieldValues.join(' ');

    // 1. Check if ALL tokens are present (AND logic)
    const allTokensMatch = queryTokens.every((token) => combinedItemText.includes(token));

    if (!allTokensMatch) {
      return { item, score: -1 };
    }

    // 2. Calculate Score for sorting
    let score = 0;

    // Priority 1: Exact match on any field
    if (fieldValues.some((val) => val === normalizedQuery)) {
      score += 100;
    }
    // Priority 2: Starts with query on any field
    else if (fieldValues.some((val) => val.startsWith(normalizedQuery))) {
      score += 50;
    }
    // Priority 3: Combined text contains the full phrase
    else if (combinedItemText.includes(normalizedQuery)) {
      score += 20;
    }
    // Priority 4: Default token match (already verified)
    else {
        score += 10;
    }

    return { item, score };
  });

  return scoredItems
    .filter((entry) => entry.score !== -1)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}
