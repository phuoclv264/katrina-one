'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { ScheduleCondition, ShiftTemplate, ManagedUser } from '@/lib/types';
import { format } from 'date-fns';

type Props = {
  constraints: ScheduleCondition[];
  shiftTemplates: ShiftTemplate[];
  allUsers: ManagedUser[];
  filterTab?: string | string[];
  onToggleEnabled: (constraintId: string) => void;
  onDelete: (constraintId: string) => void;
  onEdit?: (constraint: ScheduleCondition) => void;
};

const typeLabels: Record<string, string> = {
  WorkloadLimit: 'Định mức',
  DailyShiftLimit: 'Max Ca/Ngày',
  ShiftStaffing: 'Nhu cầu ca',
  StaffPriority: 'Ưu tiên',
  StaffShiftLink: 'Ràng buộc',
  StaffExclusion: 'Không ghép chung',
  AvailabilityStrictness: 'Thời gian rảnh',
};

export default function ConditionSummary({
  constraints,
  shiftTemplates,
  allUsers,
  filterTab,
  onToggleEnabled,
  onDelete,
  onEdit,
}: Props) {
  const filtered = useMemo(() => {
    let items = constraints;
    
    if (filterTab) {
      const filters = Array.isArray(filterTab) ? filterTab : [filterTab];
      items = items.filter(c => filters.includes(c.type));
    }
    
    return items;
  }, [constraints, filterTab]);

  const groupedByType = useMemo(() => {
    const groups: Record<string, ScheduleCondition[]> = {};
    for (const c of filtered) {
      if (!groups[c.type]) groups[c.type] = [];
      groups[c.type].push(c);
    }
    return groups;
  }, [filtered]);

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Tổng hợp điều kiện ({filtered.length})</h3>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <div className="space-y-3 pr-4 pb-4">
          <AnimatePresence initial={false}>
            {Object.entries(groupedByType).length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-8">
                Chưa có điều kiện nào
              </div>
            ) : (
              Object.entries(groupedByType).map(([type, items]) => (
                <motion.div
                  key={`group_${type}`}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="space-y-1"
                >
                  <div className="text-xs font-semibold text-muted-foreground">
                    {typeLabels[type] || type} ({items.length})
                  </div>
                  {items.map(c => (
                    <motion.div
                      key={c.id}
                      layout
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      className={cn(
                        'border rounded-md p-2.5 text-xs overflow-hidden',
                        !c.enabled && 'opacity-50 bg-muted'
                      )}
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={c.enabled}
                            onCheckedChange={() => onToggleEnabled(c.id)}
                            className="h-3 w-3"
                            aria-label={`Enable condition ${c.id}`}
                          />

                          <span className="font-medium text-[11px] min-w-0 truncate">
                            {getConditionLabel(c, shiftTemplates, allUsers)}
                          </span>

                          {c.mandatory && (
                            <Badge variant="secondary" className="text-[10px] h-5">
                              Bắt buộc
                            </Badge>
                          )}

                          <div className="ml-auto flex items-center gap-1">
                            {onEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => onEdit(c)}
                                aria-label="Edit condition"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              onClick={() => onDelete(c.id)}
                              aria-label="Delete condition"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        <div className="text-[11px] text-muted-foreground pl-5 min-w-0 truncate mt-0.5">
                          {getConditionDetails(c, shiftTemplates, allUsers)}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function getConditionLabel(
  c: ScheduleCondition,
  templates: ShiftTemplate[],
  users: ManagedUser[]
): string {
  const c_ = c as any;
  switch (c.type) {
    case 'WorkloadLimit':
      if (c_.scope === 'global') return 'Định mức toàn cục';
      const user = users.find(u => u.uid === c_.userId);
      return `Định mức: ${user?.displayName || c_.userId}`;
    case 'DailyShiftLimit':
      if (!c_.userId) return 'Max Ca/Ngày (toàn cục)';
      const user2 = users.find(u => u.uid === c_.userId);
      return `Max Ca/Ngày: ${user2?.displayName || c_.userId}`;
    case 'ShiftStaffing':
      const template = templates.find(t => t.id === c_.templateId);
      return `Nhu cầu ${template?.label || c_.templateId}: ${c_.count} người`;
    case 'StaffPriority':
      const t = templates.find(tm => tm.id === c_.templateId);
      const u = users.find(us => us.uid === c_.userId);
      return `Ưu tiên: ${u?.displayName || c_.userId} → ${t?.label || c_.templateId}`;
    case 'StaffShiftLink':
      const tpl = templates.find(tm => tm.id === c_.templateId);
      const usr = users.find(us => us.uid === c_.userId);
      return `${c_.link === 'force' ? 'Bắt buộc' : 'Cấm'}: ${usr?.displayName || c_.userId} ↔ ${tpl?.label || c_.templateId}`;
    case 'StaffExclusion':
      const baseUser = users.find(us => us.uid === c_.userId);
      return `Không ghép: ${baseUser?.displayName || c_.userId}`;
    case 'AvailabilityStrictness':
      return c_.strict ? 'Thời gian rảnh: Bắt buộc' : 'Thời gian rảnh: Mềm';
    default:
      return 'Điều kiện';
  }
}

function getConditionDetails(
  c: ScheduleCondition,
  templates: ShiftTemplate[],
  users: ManagedUser[]
): string {
  const c_ = c as any;
  switch (c.type) {
    case 'WorkloadLimit':
      const parts: string[] = [];
      if (c_.minShiftsPerWeek != null) parts.push(`Min ${c_.minShiftsPerWeek} ca`);
      if (c_.maxShiftsPerWeek != null) parts.push(`Max ${c_.maxShiftsPerWeek} ca`);
      if (c_.minHoursPerWeek != null) parts.push(`Min ${c_.minHoursPerWeek}h`);
      if (c_.maxHoursPerWeek != null) parts.push(`Max ${c_.maxHoursPerWeek}h`);
      return parts.join(' • ') || 'Không có giới hạn';
    case 'DailyShiftLimit':
      return `Max ${c_.maxPerDay} ca/ngày`;
    case 'ShiftStaffing':
      return `Vai trò: ${c_.role}, ${c_.mandatory ? 'Bắt buộc' : 'Tùy chọn'}`;
    case 'StaffPriority':
      return `Trọng số: ${c_.weight}`;
    case 'StaffShiftLink':
      return '';
    case 'StaffExclusion':
      const blocked = (c_.blockedUserIds || []).map((id: string) => users.find(u => u.uid === id)?.displayName || id);
      const tplEx = c_.templateId ? templates.find(tm => tm.id === c_.templateId) : null;
      const scopeText = tplEx ? ` • Chỉ áp dụng cho ${tplEx.label}` : ' • Áp dụng mọi ca';
      return `Tránh ghép với: ${blocked.join(', ') || '—'}${scopeText}`;
    case 'AvailabilityStrictness':
      return '';
    default:
      return '';
  }
}
