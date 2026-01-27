import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Banknote,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  DollarSign,
  FileSignature,
  FileText,
  History,
  ListChecks,
  MessageSquare,
  Moon,
  Package,
  ShieldX,
  Sparkles,
  Sun,
  Sunset,
  User,
  UserCog,
  Users2,
  UtensilsCrossed,
} from 'lucide-react';
import type { AuthUser, UserRole } from '@/hooks/use-auth';
import type { AssignedShift } from '@/lib/types';
import { DEFAULT_MAIN_SHIFT_TIMEFRAMES, getActiveShiftKeys, type ShiftKey } from './shift-utils';

export type AccessLinkColor =
  | 'emerald'
  | 'purple'
  | 'blue'
  | 'orange'
  | 'rose'
  | 'indigo'
  | 'sky'
  | 'amber';

export type AccessLink = {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  category: 'primary' | 'secondary';
  color?: AccessLinkColor;
  subLabel?: string;
  roleTag?: UserRole;
  /** Optional grouping label for UI (e.g. "Quản lý công việc") */
  group?: string;
  order: number;
};

export interface UserAccessContext {
  user: AuthUser | null;
  isCheckedIn: boolean;
  activeShifts?: AssignedShift[];
  isOnActiveShift?: boolean;
}

type AccessGrant = {
  role?: UserRole;
  via: 'primary' | 'secondary' | 'assigned' | 'common';
};

type AccessRule = {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: UserRole[];
  requiresCheckIn?: boolean;
  restrictShiftKeys?: ShiftKey[];
  color?: AccessLinkColor;
  subLabel?: string;
  /** Optional grouping label for UI (e.g. "Quản lý công việc") */
  group?: string;
  /** When false, this rule must NOT be satisfied by a user's secondary role — only primary/assigned/common */
  allowSecondary?: boolean;
  needMainRole?: boolean;
  order?: number;
  dynamicLabel?: (ctx: BuildContext, grant: AccessGrant) => string;
};

type BuildContext = {
  user: AuthUser;
  isCheckedIn: boolean;
  isOnActiveShift: boolean;
  activeShiftKeys: ShiftKey[];
  assignedRoles: UserRole[];
};

const ACCESS_RULES: AccessRule[] = [
  // Phuc vu
  { key: 'server-checklist-sang', href: '/checklist/sang', label: 'Báo cáo ca sáng', icon: Sun, roles: ['Phục vụ'], requiresCheckIn: true, restrictShiftKeys: ['sang'], color: 'blue', subLabel: 'Phục vụ', order: 11 },
  { key: 'server-checklist-trua', href: '/checklist/trua', label: 'Báo cáo ca trưa', icon: Sunset, roles: ['Phục vụ'], requiresCheckIn: true, restrictShiftKeys: ['trua'], color: 'blue', subLabel: 'Phục vụ', order: 12 },
  { key: 'server-checklist-toi', href: '/checklist/toi', label: 'Báo cáo ca tối', icon: Moon, roles: ['Phục vụ'], requiresCheckIn: true, restrictShiftKeys: ['toi'], color: 'blue', subLabel: 'Phục vụ', order: 13 },

  // Pha che
  { key: 'bartender-hygiene', href: '/bartender/hygiene-report', label: 'Vệ sinh quầy', icon: ClipboardList, roles: ['Pha chế'], requiresCheckIn: true, color: 'emerald', subLabel: 'Pha chế', order: 21 },
  { key: 'bartender-inventory', href: '/bartender/inventory', label: 'Kiểm kê kho', icon: Package, roles: ['Pha chế'], requiresCheckIn: true, color: 'purple', subLabel: 'Pha chế', order: 22 },

  // Thu ngan
  { key: 'cashier', href: '/cashier', label: 'Báo cáo Thu ngân', icon: Banknote, roles: ['Thu ngân'], requiresCheckIn: true, color: 'blue', subLabel: 'Thu ngân', order: 31 },

  // Quan ly
  { key: 'manager-comprehensive', href: '/manager/comprehensive-report', label: 'Phiếu kiểm tra toàn diện', icon: FileText, roles: ['Quản lý'], requiresCheckIn: true, color: 'orange', subLabel: 'Quản lý', order: 41 },
  { key: 'manager-reports', href: '/reports', label: 'Xem báo cáo', icon: FileText, roles: ['Quản lý', 'Chủ nhà hàng'], requiresCheckIn: true, color: 'indigo', subLabel: 'Quản lý', allowSecondary: false, needMainRole: true, order: 43 },

  // Chu nha hang
  { key: 'owner-daily-assignments', href: '/daily-assignments', label: 'Giao việc trong ngày', icon: ListChecks, roles: ['Chủ nhà hàng'], requiresCheckIn: false, color: 'amber', subLabel: 'Chủ nhà hàng', group: 'Quản lý công việc', order: 51 },
  { key: 'owner-reports', href: '/reports', label: 'Xem Báo cáo', icon: FileText, roles: ['Chủ nhà hàng'], requiresCheckIn: false, color: 'indigo', subLabel: 'Chủ nhà hàng', order: 52 },
  { key: 'owner-financial', href: '/financial-report', label: 'Báo cáo Tài chính', icon: DollarSign, roles: ['Chủ nhà hàng'], requiresCheckIn: false, color: 'blue', subLabel: 'Chủ nhà hàng', group: 'Quản lý công việc', order: 53 },
  { key: 'owner-cashier-reports', href: '/reports/cashier', label: 'Báo cáo Thu ngân', icon: Banknote, roles: ['Chủ nhà hàng'], requiresCheckIn: false, color: 'blue', subLabel: 'Chủ nhà hàng', group: 'Quản lý công việc', order: 54 },
  { key: 'owner-shift-scheduling', href: '/shift-scheduling', label: 'Xếp lịch & Phê duyệt', icon: CalendarDays, roles: ['Chủ nhà hàng'], requiresCheckIn: false, color: 'blue', subLabel: 'Chủ nhà hàng', group: 'Quản lý công việc', order: 55 },
  { key: 'owner-attendance', href: '/attendance', label: 'Quản lý Chấm công', icon: User, roles: ['Chủ nhà hàng'], requiresCheckIn: false, color: 'blue', subLabel: 'Chủ nhà hàng', order: 56 },
  { key: 'owner-monthly-tasks', href: '/monthly-tasks', label: 'Công việc Định kỳ', icon: CalendarClock, roles: ['Chủ nhà hàng'], requiresCheckIn: false, color: 'blue', subLabel: 'Chủ nhà hàng', group: 'Quản lý công việc', order: 57 },
  { key: 'owner-users', href: '/users', label: 'QL Người dùng', icon: Users2, roles: ['Chủ nhà hàng'], requiresCheckIn: false, color: 'blue', subLabel: 'Chủ nhà hàng', group: 'Quản lý công việc', order: 58 },
  { key: 'owner-task-lists', href: '/task-lists', label: 'QL Công việc Phục vụ', icon: ClipboardList, roles: ['Chủ nhà hàng'], requiresCheckIn: false, color: 'blue', subLabel: 'Chủ nhà hàng', group: 'Quản lý công việc', order: 59 },
  { key: 'owner-bartender-tasks', href: '/bartender-tasks', label: 'QL Công việc Pha chế', icon: UtensilsCrossed, roles: ['Chủ nhà hàng'], requiresCheckIn: false, color: 'blue', subLabel: 'Chủ nhà hàng', group: 'Quản lý công việc', order: 60 },
  { key: 'owner-comprehensive-checklist', href: '/comprehensive-checklist', label: 'QL Kiểm tra Toàn diện', icon: ListChecks, roles: ['Chủ nhà hàng'], requiresCheckIn: false, color: 'blue', subLabel: 'Chủ nhà hàng', group: 'Quản lý công việc', order: 61 },
  { key: 'owner-inventory-management', href: '/inventory-management', label: 'QL Hàng tồn kho', icon: Package, roles: ['Chủ nhà hàng'], requiresCheckIn: false, color: 'blue', subLabel: 'Chủ nhà hàng', group: 'Quản lý công việc', order: 62 },
  { key: 'owner-product-management', href: '/product-management', label: 'QL Mặt hàng & Công thức', icon: FileSignature, roles: ['Chủ nhà hàng'], requiresCheckIn: false, color: 'blue', subLabel: 'Chủ nhà hàng', group: 'Quản lý công việc', order: 63 },
  { key: 'owner-inventory-history', href: '/inventory-history', label: 'Lịch sử Kho', icon: History, roles: ['Chủ nhà hàng'], requiresCheckIn: false, color: 'blue', subLabel: 'Chủ nhà hàng', group: 'Quản lý công việc', order: 64 },

  // Common
  {
    key: 'schedule',
    href: '/schedule',
    label: 'Lịch làm việc',
    icon: CalendarDays,
    roles: ['Phục vụ', 'Pha chế', 'Quản lý', 'Thu ngân'],
    requiresCheckIn: false,
    order: 90,
  },
  {
    key: 'violations',
    href: '/violations',
    label: 'Vi phạm',
    icon: ShieldX,
    requiresCheckIn: false,
    order: 91,
    dynamicLabel: (ctx) => (ctx.user.role === 'Quản lý' || ctx.user.role === 'Chủ nhà hàng' ? 'Ghi nhận Vi phạm' : 'Danh sách Vi phạm'),
  },
  {
    key: 'reports-feed',
    href: '/reports-feed',
    label: 'Tố cáo',
    icon: MessageSquare,
    requiresCheckIn: false,
    order: 92,
  },
];

export function getUserAccessLinks(context: UserAccessContext) {
  const { user, isCheckedIn, activeShifts = [], isOnActiveShift = false } = context;

  if (!user) {
    return { primary: [] as AccessLink[], secondary: [] as AccessLink[], meta: { assignedRoles: [] as UserRole[], activeShiftKeys: [] as ShiftKey[] } };
  }

  const activeShiftKeys = getActiveShiftKeys(DEFAULT_MAIN_SHIFT_TIMEFRAMES);
  const assignedRoles = getAssignedRoles(user.uid, activeShifts);

  const buildContext: BuildContext = {
    user,
    isCheckedIn,
    isOnActiveShift,
    activeShiftKeys,
    assignedRoles,
  };

  const links: AccessLink[] = [];

  for (const rule of ACCESS_RULES) {
    const grant = resolveGrant(rule.roles, buildContext);
    if (!grant) continue;

    // Respect rule-level prohibition of secondary-role grants
    if (grant.via === 'secondary' && rule.allowSecondary === false) continue;

    if (rule.needMainRole && grant.via === 'assigned' && rule.roles && !rule.roles.includes(user.role)) continue;

    if (rule.requiresCheckIn && !isCheckedIn && user.role !== 'Chủ nhà hàng') continue;

    if (rule.restrictShiftKeys && rule.restrictShiftKeys.length > 0) {
      const overlaps = rule.restrictShiftKeys.some((k) => activeShiftKeys.includes(k));
      if (!overlaps) continue;
    }

    const label = rule.dynamicLabel ? rule.dynamicLabel(buildContext, grant) : rule.label;
    // IMPORTANT: assigned role grants should behave like primary (main) navigation —
    // they are not "secondary" shortcuts. Only grants that originate from a user's
    // secondary role should be categorized as 'secondary'.
    const category: AccessLink['category'] = grant.via === 'secondary' ? 'secondary' : 'primary';

    links.push({
      key: rule.key,
      href: rule.href,
      label,
      icon: rule.icon,
      category,
      color: rule.color,
      subLabel: rule.subLabel ?? grant.role,
      roleTag: grant.role,
      group: rule.group,
      order: rule.order ?? 100,
    });
  }

  const sorted = dedupeAndSort(links);

  return {
    primary: sorted.filter((link) => link.category === 'primary'),
    secondary: sorted.filter((link) => link.category === 'secondary'),
    meta: {
      assignedRoles,
      activeShiftKeys,
    },
  };
}

function resolveGrant(roles: UserRole[] | undefined, ctx: BuildContext): AccessGrant | null {
  // Common rules (no role restriction)
  if (!roles || roles.length === 0) {
    return { via: 'common' };
  }

  const hasAssigned = Array.isArray(ctx.assignedRoles) && ctx.assignedRoles.length > 0;

  // If the user has assigned role(s), prefer those exclusively (unless an explicit exception applies).
  if (hasAssigned) {
    const assignedMatch = ctx.assignedRoles.find((r) => roles.includes(r));
    if (assignedMatch) return { role: assignedMatch, via: 'assigned' };

    // Exception: user is assigned as `Pha chế` but also has `Thu ngân` as a secondary role —
    // allow them to see `Thu ngân` links when the rule requests `Thu ngân`.
    if ((ctx.assignedRoles.includes('Pha chế') || ctx.assignedRoles.includes('Quản lý')) && (ctx.user.secondaryRoles || []).includes('Thu ngân') && roles.includes('Thu ngân')) {
      return { role: 'Thu ngân', via: 'secondary' };
    }

    // Do not fall back to main/secondary roles when an assigned role exists.
    return null;
  }

  // No assigned role: fall back to main role first, then secondary roles.
  if (roles.includes(ctx.user.role)) {
    return { role: ctx.user.role, via: 'primary' };
  }

  const secondaryMatch = (ctx.user.secondaryRoles || []).find((r) => roles.includes(r));
  if (secondaryMatch) {
    return { role: secondaryMatch, via: 'secondary' };
  }

  return null;
}

function getAssignedRoles(userId: string, activeShifts: AssignedShift[]): UserRole[] {
  const roles = new Set<UserRole>();

  for (const shift of activeShifts) {
    const assigned = shift.assignedUsers?.find((u) => u.userId === userId)?.assignedRole;
    if (assigned) roles.add(assigned as UserRole);

    if (!assigned && shift.assignedUsersWithRole) {
      const withRole = shift.assignedUsersWithRole.find((u) => u.userId === userId);
      if (withRole && withRole.assignedRole !== 'Bất kỳ') {
        roles.add(withRole.assignedRole as UserRole);
      }
    }
  }

  return Array.from(roles);
}

function dedupeAndSort(list: AccessLink[]): AccessLink[] {
  const map = new Map<string, AccessLink>();
  for (const link of list) {
    const key = `${link.category}:${link.href}`;
    if (!map.has(key)) {
      map.set(key, link);
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.label.localeCompare(b.label);
  });
}
