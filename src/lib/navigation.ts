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
      return '/admin';
    default:
      return '/';
  }
}

/**
 * Return true when the provided pathname or hash corresponds to a "home"
 * dashboard for the app shell. Accepts either a real pathname (e.g. '/shifts')
 * or a hash value (e.g. '#tab=home' or '#page=/bartender').
 *
 * The function is role-aware when a `role` is provided — the role's home
 * path (from `getHomePathForRole`) is treated as a valid home route.
 */
export const DEFAULT_HOME_PATHS = ['/shifts', '/bartender', '/manager', '/admin'];

export function isHomeRoute(
  pathname?: string | null,
  hash?: string | null,
  role?: UserRole | null,
): boolean {
  // Build a canonical set of home paths (deduplicated).
  const homeSet = new Set();
  if (role) homeSet.add(getHomePathForRole(role));
  else DEFAULT_HOME_PATHS.forEach(p => homeSet.add(p));
  const homePaths = Array.from(homeSet);

  const normalize = (p: string) => {
    const noQuery = p.split('?')[0] || '/';
    if (noQuery.length > 1 && noQuery.endsWith('/')) return noQuery.slice(0, -1);
    return noQuery;
  };

  if (typeof hash === 'string') {
    if (hash.startsWith('#tab=home')) return true;
    else if (hash.startsWith('#tab=')) return false;

    if (hash.startsWith('#page=')) {
      const raw = hash.slice('#page='.length);
      try {
        const p = normalize(decodeURIComponent(raw));
        return homePaths.some(h => p === h || p.startsWith(h + '/'));
      } catch {
        const p = normalize(raw);
        return homePaths.some(h => p === h || p.startsWith(h + '/'));
      }
    }
  }

  if (typeof pathname === 'string') {
    const p = normalize(pathname);
    return homePaths.some(h => p === h || p.startsWith(h + '/'));
  }

  return false;
}
