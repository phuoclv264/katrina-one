'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Edit2, X, AlertCircle, Info, Calendar, User, Clock, Calculator, LayoutGrid, Check, Trophy, Lock, AlertTriangle, Link2, UserMinus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { ScheduleCondition, ShiftTemplate, ManagedUser } from '@/lib/types';
import { format } from 'date-fns';

type Props = {
  constraints: ScheduleCondition[];
  shiftTemplates: ShiftTemplate[];
  allUsers: ManagedUser[];
  filterTab?: string | string[];
  /** Optional employee UID to filter conditions by */
  employeeFilterUserId?: string | null;
  /** Called when the component's clear filter UI is clicked (optional) */
  onClearEmployeeFilter?: () => void;
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

const typeIcons: Record<string, React.ReactNode> = {
  WorkloadLimit: <Calculator className="h-3.5 w-3.5" />,
  DailyShiftLimit: <Clock className="h-3.5 w-3.5" />,
  ShiftStaffing: <User className="h-3.5 w-3.5" />,
  StaffPriority: <Trophy className="h-3.5 w-3.5" />,
  StaffShiftLink: <Link2 className="h-3.5 w-3.5" />,
  StaffExclusion: <UserMinus className="h-3.5 w-3.5" />,
  AvailabilityStrictness: <Calendar className="h-3.5 w-3.5" />,
};

export default function ConditionSummary({
  constraints,
  shiftTemplates,
  allUsers,
  filterTab,
  employeeFilterUserId,
  onClearEmployeeFilter,
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

    if (employeeFilterUserId) {
      const uid = employeeFilterUserId;
      items = items.filter(c => conditionReferencesUser(c, uid));
    }

    return items;
  }, [constraints, filterTab, employeeFilterUserId]);

  function conditionReferencesUser(c: ScheduleCondition, uid: string) {
    const c_ = c as any;
    switch (c.type) {
      case 'WorkloadLimit':
        return c_.scope !== 'global' && c_.userId === uid;
      case 'DailyShiftLimit':
        return !!c_.userId && c_.userId === uid;
      case 'StaffPriority':
        return c_.userId === uid;
      case 'StaffShiftLink':
        return c_.userId === uid;
      case 'StaffExclusion':
        return c_.userId === uid || (c_.blockedUserIds || []).includes(uid);
      default:
        return false;
    }
  }

  const groupedByType = useMemo(() => {
    const groups: Record<string, ScheduleCondition[]> = {};
    for (const c of filtered) {
      if (!groups[c.type]) groups[c.type] = [];
      groups[c.type].push(c);
    }
    return groups;
  }, [filtered]);

  return (
    <div className="flex flex-col gap-6 p-0 sm:p-1">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div className="flex flex-col">
          <h3 className="font-black text-sm uppercase tracking-tighter text-muted-foreground/80 flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 shrink-0" />
            <span className="break-words">Điều kiện đang áp dụng</span>
          </h3>
          <p className="text-[10px] text-muted-foreground font-medium">Tìm thấy {filtered.length} ràng buộc phù hợp</p>
        </div>
        
        {employeeFilterUserId && (
          <div className="flex items-center gap-1.5 bg-primary/5 pl-3 pr-1 py-1 rounded-2xl border border-primary/10 w-fit max-w-full">
            <span className="text-[10px] font-black text-primary uppercase max-w-[120px] sm:max-w-[200px]">
              {allUsers.find(u => u.uid === employeeFilterUserId)?.displayName || '—'}
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 rounded-xl hover:bg-primary/10 text-primary shrink-0" 
              onClick={onClearEmployeeFilter}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <div className="space-y-6">
          <AnimatePresence initial={false}>
            {Object.entries(groupedByType).length === 0 ? (
              <div className="text-center py-12 sm:py-16 bg-muted/20 rounded-[2rem] sm:rounded-[2.5rem] border-2 border-dashed border-primary/5 px-4">
                 <div className="w-10 h-10 sm:w-12 sm:h-12 bg-background rounded-2xl border border-primary/5 flex items-center justify-center mx-auto mb-3 opacity-20">
                   <AlertCircle className="h-5 w-5 sm:h-6 w-6" />
                 </div>
                 <p className="text-muted-foreground font-bold text-xs sm:text-sm">Chưa có điều kiện nào</p>
                 <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1 opacity-50">Vui lòng thêm điều kiện mới</p>
              </div>
            ) : (
              Object.entries(groupedByType).map(([type, items]) => (
                <motion.div
                  key={`group_${type}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2 px-1">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
                    <span className="text-[11px] font-black text-primary uppercase tracking-widest bg-background px-4 py-1 rounded-full border border-primary/10">
                      {typeLabels[type] || type}
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
                  </div>

                  <div className="grid gap-2">
                    {items.map(c => (
                      <motion.div
                        key={c.id}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={cn(
                          'group relative bg-background border rounded-2xl p-3 sm:p-4 transition-all duration-300 hover:shadow-md hover:border-primary/20',
                          !c.enabled ? 'grayscale opacity-60 bg-muted/10 border-dashed' : 'border-primary/10'
                        )}
                      >
                        <div className="flex items-start gap-3 sm:gap-4">
                          <div className="pt-1.5 shrink-0">
                            <Checkbox
                              checked={c.enabled}
                              onCheckedChange={() => onToggleEnabled(c.id)}
                              className="h-5 w-5 rounded-lg border-2 border-primary/20 bg-background data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground transition-all"
                            />
                          </div>

                          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className={cn(
                                "flex items-center flex-wrap gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tight",
                                c.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                              )}>
                                {typeIcons[type] || <Info className="h-3.5 w-3.5 shrink-0" />}
                                <span className="break-words line-clamp-2 md:line-clamp-none">
                                  {getConditionLabel(c, shiftTemplates, allUsers)}
                                </span>
                              </div>

                              {c.mandatory && (
                                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none px-2 py-0.5 rounded-lg text-[10px] font-black uppercase shadow-none shrink-0">
                                  Bắt buộc
                                </Badge>
                              )}
                            </div>

                            <div className="text-[12px] font-medium text-muted-foreground leading-snug break-words">
                              {getConditionDetails(c, shiftTemplates, allUsers)}
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-0.5 sm:gap-1">
                            {onEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 sm:h-10 sm:w-10 p-0 rounded-xl hover:bg-primary/5 text-muted-foreground hover:text-primary transition-colors"
                                onClick={() => onEdit(c)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 sm:h-10 sm:w-10 p-0 rounded-xl hover:bg-destructive/5 text-muted-foreground hover:text-destructive transition-colors"
                              onClick={() => onDelete(c.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {!c.enabled && (
                          <div className="absolute inset-0 bg-background/20 backdrop-grayscale pointer-events-none rounded-2xl" />
                        )}
                      </motion.div>
                    ))}
                  </div>
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
