'use client';

import type { MediaAttachment, ShiftBusyEvidence, ManagedUser, UserRole } from '@/lib/types';

export const getRoleColor = (role: UserRole | 'Bất kỳ'): string => {
  switch (role) {
    case 'Phục vụ':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700';
    case 'Pha chế':
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700';
    case 'Thu ngân':
      return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700';
    case 'Quản lý':
      return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-700';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600';
  }
};

export const userMatchesRole = (user: ManagedUser, role: UserRole | 'Bất kỳ') => {
  if (role === 'Bất kỳ') {
    return user.role !== 'Chủ nhà hàng';
  }
  return user.role === role || (user.secondaryRoles || []).includes(role);
};

export const toDate = (value: ShiftBusyEvidence['submittedAt']) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const maybeTimestamp = value as { toDate?: () => Date } | null;
  if (maybeTimestamp?.toDate) {
    try {
      return maybeTimestamp.toDate();
    } catch (error) {
      console.warn('Failed to convert timestamp to date', error);
      return null;
    }
  }
  return null;
};

export const buildSlides = (media: MediaAttachment[]) =>
  media.map((attachment) => {
    if (attachment.type === 'video') {
      return {
        type: 'video' as const,
        sources: [
          { src: attachment.url, type: 'video/mp4' },
          { src: attachment.url, type: 'video/webm' },
        ],
      };
    }
    return { src: attachment.url };
  });
