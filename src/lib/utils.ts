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
