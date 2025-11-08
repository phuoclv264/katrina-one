import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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
  console.log(key);
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