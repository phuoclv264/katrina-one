'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Availability, ManagedUser, Schedule, ScheduleCondition, ScheduleRunResult, UserRole, ShiftTemplate } from '@/lib/types';
import { schedule as runSchedule } from '@/lib/scheduler';
import { format, getDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from '@/components/ui/pro-toast';
import { cn } from '@/lib/utils';
import { updateStructuredConstraints } from '@/lib/schedule-store';
import { useAuth } from '@/hooks/use-auth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { Undo2, Redo2, Plus } from 'lucide-react';
import ConditionSummary from './condition-summary';
import AddConditionSheet from './add-condition-sheet';
import { UserMultiSelect } from '@/components/user-multi-select';

type TabConfig = { value: string; label: string; types?: string[] };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  schedule: Schedule | null;
  allUsers: ManagedUser[];
  availability: Availability[];
  constraints: ScheduleCondition[];
  onApplyAssignments: (assignments: { shiftId: string; userId: string; userName?: string; assignedRole?: UserRole | 'Bất kỳ' }[], strategy: 'merge' | 'replace') => void;
  shiftTemplates: ShiftTemplate[];
};

type EditableAssignment = { shiftId: string; userId: string; selected: boolean; assignedRole?: UserRole | 'Bất kỳ' };
type UndoRedoEntry = {
  constraints: ScheduleCondition[];
  timestamp: number;
};

const TABS: TabConfig[] = [
  { value: 'workload', label: 'Định mức', types: ['WorkloadLimit'] },
  { value: 'staffing', label: 'Nhu cầu ca', types: ['ShiftStaffing'] },
  { value: 'priority', label: 'Ưu tiên', types: ['StaffPriority'] },
  { value: 'links', label: 'Ràng buộc', types: ['StaffShiftLink', 'StaffExclusion'] },
  { value: 'availability', label: 'Thời gian rảnh', types: ['AvailabilityStrictness'] },
  { value: 'preview', label: 'Xem trước' },
];

export default function AutoScheduleDialog({
  isOpen,
  onClose,
  schedule,
  allUsers,
  availability,
  constraints,
  onApplyAssignments,
  shiftTemplates,
}: Props) {
  const [editableConstraints, setEditableConstraints] = useState<ScheduleCondition[]>(constraints || []);
  const [result, setResult] = useState<ScheduleRunResult | null>(null);
  const [editableAssignments, setEditableAssignments] = useState<EditableAssignment[]>([]);
  const [activeTab, setActiveTab] = useState('preview');
  const [filterTab, setFilterTab] = useState<string | string[]>('');
  const [showAddCondition, setShowAddCondition] = useState(false);
  const [savedTimestamp, setSavedTimestamp] = useState<number | null>(null);
  const [lastSaveTime, setLastSaveTime] = useState<string>('');

  const undoStack = useRef<UndoRedoEntry[]>([]);
  const redoStack = useRef<UndoRedoEntry[]>([]);

  useEffect(() => {
    if (isOpen) {
      setEditableConstraints(constraints || []);
      setResult(null);
      setEditableAssignments([]);
      undoStack.current = [];
      redoStack.current = [];
      setFilterTab('');
      setLastSaveTime('');
    }
  }, [isOpen, constraints]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          handleUndo();
        } else if (e.key === 'y') {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const shifts = useMemo(() => schedule?.shifts || [], [schedule]);
  const validationErrors = useMemo(() => validateConstraints(editableConstraints), [editableConstraints]);
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(editableConstraints) !== JSON.stringify(constraints);
  }, [editableConstraints, constraints]);

  const { user } = useAuth();
  const canSaveStructuredConstraints = user?.role === 'Chủ nhà hàng';

  const roleByUserId = useMemo(() => {
    const m = new Map<string, string | undefined>();
    for (const u of allUsers) m.set(u.uid, (u as any).role);
    return m;
  }, [allUsers]);

  const availabilityMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const a of availability) {
      const dateKey = typeof a.date === 'string' ? a.date : format(a.date.toDate(), 'yyyy-MM-dd');
      const key = `${a.userId}:${dateKey}`;
      const slots = a.availableSlots?.map(s => `${s.start}-${s.end}`) || [];
      m.set(key, slots);
    }
    return m;
  }, [availability]);

  const dateRowSpanMap = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of shifts) {
      const key = format(new Date(s.date), 'yyyy-MM-dd');
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [shifts]);

  const conditionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of editableConstraints) {
      counts[c.type] = (counts[c.type] || 0) + 1;
    }
    return counts;
  }, [editableConstraints]);

  const shiftById = useMemo(() => {
    const m = new Map<string, typeof shifts[number]>();
    for (const s of shifts) m.set(s.id, s as any);
    return m;
  }, [shifts]);

  const dayUserShiftCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of editableAssignments.filter(x => x.selected)) {
      const s = shiftById.get(a.shiftId);
      if (!s) continue;
      const dateKey = format(new Date(s.date), 'yyyy-MM-dd');
      const key = `${a.userId}:${dateKey}`;
      m.set(key, (m.get(key) || 0) + 1);
    }
    return m;
  }, [editableAssignments, shiftById]);

  const parseHM = (hm: string) => {
    const [H, M] = hm.split(':').map(x => parseInt(x, 10));
    return H * 60 + (M || 0);
  };

  const scheduledHoursByUser = useMemo(() => {
    const totals = new Map<string, number>();
    for (const a of editableAssignments.filter(x => x.selected)) {
      const s = shiftById.get(a.shiftId);
      if (!s) continue;
      const start = parseHM(s.timeSlot.start);
      const end = parseHM(s.timeSlot.end);
      const hours = Math.max(0, (end - start) / 60);
      totals.set(a.userId, (totals.get(a.userId) || 0) + hours);
    }
    return totals;
  }, [editableAssignments, shiftById]);

  const scheduleDateKeys = useMemo(() => {
    const set = new Set<string>();
    for (const s of shifts) set.add(format(new Date(s.date), 'yyyy-MM-dd'));
    return set;
  }, [shifts]);

  const availableHoursByUser = useMemo(() => {
    const totals = new Map<string, number>();
    for (const a of availability) {
      const dateKey = typeof a.date === 'string' ? a.date : format(a.date.toDate(), 'yyyy-MM-dd');
      if (!scheduleDateKeys.has(dateKey)) continue;
      const sum = (a.availableSlots || []).reduce((acc, s) => acc + Math.max(0, (parseHM(s.end) - parseHM(s.start)) / 60), 0);
      totals.set(a.userId, (totals.get(a.userId) || 0) + sum);
    }
    return totals;
  }, [availability, scheduleDateKeys]);

  const pushUndo = useCallback((prev: ScheduleCondition[]) => {
    undoStack.current.push({ constraints: prev, timestamp: Date.now() });
    redoStack.current = [];
  }, []);

  const handleUndo = useCallback(() => {
    const entry = undoStack.current.pop();
    if (entry) {
      redoStack.current.push({ constraints: editableConstraints, timestamp: Date.now() });
      setEditableConstraints(entry.constraints);
      toast.success('Đã hoàn tác thay đổi.');
    } else {
      toast.info('Không có hành động để hoàn tác.', { icon: 'ℹ️' });
    }
  }, [editableConstraints]);

  const handleRedo = useCallback(() => {
    const entry = redoStack.current.pop();
    if (entry) {
      undoStack.current.push({ constraints: editableConstraints, timestamp: Date.now() });
      setEditableConstraints(entry.constraints);
      toast.success('Đã làm lại thay đổi.');
    } else {
      toast.info('Không có hành động để làm lại.', { icon: 'ℹ️' });
    }
  }, [editableConstraints]);

  const handleAddCondition = (condition: ScheduleCondition) => {
    const prev = [...editableConstraints];
    pushUndo(prev);
    setEditableConstraints([...editableConstraints, condition]);
    toast.success('Đã thêm điều kiện mới.');
  };

  const handleDeleteCondition = (id: string) => {
    const prev = [...editableConstraints];
    pushUndo(prev);
    setEditableConstraints(prev.filter(c => c.id !== id));
    toast.success('Đã xóa điều kiện.');
  };

  const handleToggleCondition = (id: string) => {
    const prev = [...editableConstraints];
    pushUndo(prev);
    setEditableConstraints(prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c));
  };

  const handleSaveConstraints = async () => {
    try {
      await updateStructuredConstraints(editableConstraints);
      setSavedTimestamp(Date.now());
      setLastSaveTime(format(new Date(), 'HH:mm'));
      undoStack.current = [];
      redoStack.current = [];
      toast.success('Đã lưu điều kiện xếp lịch có cấu trúc.');
    } catch (e: any) {
      toast.error(e?.message || 'Không thể lưu điều kiện.');
    }
  };

  const handleRun = () => {
    if (!schedule) {
      toast.error('Chưa có lịch tuần để chạy.');
      return;
    }
    if (validationErrors.length > 0) {
      toast.error(`Không thể chạy do lỗi: ${validationErrors[0]}`);
      return;
    }
    const r = runSchedule(shifts, allUsers, availability, editableConstraints);
    setResult(r);
    setEditableAssignments(r.assignments.map(a => ({ shiftId: a.shiftId, userId: a.userId, selected: true, assignedRole: a.role ?? 'Bất kỳ' })));
    if (r.warnings.length) {
      toast.info('Có cảnh báo trong kết quả xếp lịch.', { icon: '⚠️' });
    }
  };

  const handleToggleAssignment = (shiftId: string, userId: string) => {
    setEditableAssignments(prev => prev.map(a => (a.shiftId === shiftId && a.userId === userId) ? { ...a, selected: !a.selected } : a));
  };

  const handleApply = () => {
    const selected = editableAssignments
      .filter(a => a.selected)
      .map(a => {
        const user = allUsers.find(u => u.uid === a.userId);
        return {
          shiftId: a.shiftId,
          userId: a.userId,
          userName: user?.displayName || a.userId,
          // Prefer the role assigned by the scheduler (stored on the editable assignment),
          // otherwise fall back to the user's profile role.
          assignedRole: a.assignedRole ?? (roleByUserId.get(a.userId) as UserRole | 'Bất kỳ') ?? 'Bất kỳ',
        };
      });
    if (selected.length === 0) {
      toast.error('Không có phân công nào được chọn để áp dụng.');
      return;
    }
    onApplyAssignments(selected, 'replace');
    onClose();
  };

  const getRoleClasses = (role?: string) => {
    switch (role as any) {
      case 'Phục vụ': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700';
      case 'Pha chế': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700';
      case 'Thu ngân': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700';
      case 'Quản lý': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-700';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-4 border-b">
          <DialogTitle className="tracking-tight">Xếp lịch tự động</DialogTitle>

          {/* Status bar */}
          {hasUnsavedChanges || lastSaveTime || validationErrors.length > 0 || undoStack.current.length > 0 || redoStack.current.length > 0 ? (
            <div className="flex items-center justify-between mt-3 pt-3 border-t">
              <div className="flex items-center gap-4 text-xs">
                {hasUnsavedChanges && (
                  <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-500">
                    <div className="w-2 h-2 rounded-full bg-yellow-600 dark:bg-yellow-500" />
                    <span>Có thay đổi chưa gửi</span>
                  </div>
                )}
                {lastSaveTime && (
                  <div className="text-muted-foreground">
                    Lần lưu cuối: {lastSaveTime}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {undoStack.current.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleUndo}
                    aria-label="Hoàn tác (Ctrl+Z)"
                    title="Ctrl+Z"
                  >
                    <Undo2 className="h-4 w-4 mr-1" />
                    Hoàn tác
                  </Button>
                )}

                {redoStack.current.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRedo}
                    aria-label="Làm lại (Ctrl+Y)"
                    title="Ctrl+Y"
                  >
                    <Redo2 className="h-4 w-4 mr-1" />
                    Làm lại
                  </Button>
                )}

                {validationErrors.length > 0 && (
                  <div className="flex items-center gap-1 text-destructive text-xs">
                    <span>⚠️</span>
                    <span>{validationErrors.length} lỗi</span>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Single column: Tabs and controls with inline condition summary */}
          <div className="flex flex-col overflow-hidden h-full">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid grid-cols-3 lg:grid-cols-6 m-4 mb-0 justify-start gap-1 h-auto bg-transparent p-0">
                {TABS.map(tab => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="relative text-xs px-3 py-1.5 data-[state=active]:bg-muted"
                  >
                    {tab.label}
                    {tab.types && tab.types.length > 0 && tab.types.reduce((acc, t) => acc + (conditionCounts[t] || 0), 0) > 0 && (
                      <Badge
                        variant="secondary"
                        className="ml-1 h-5 px-1.5 text-[10px] cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          const totalTypes = tab.types || [];
                          const isSame = Array.isArray(filterTab)
                            ? totalTypes.length === filterTab.length && totalTypes.every(t => filterTab.includes(t))
                            : totalTypes.length === 1 && filterTab === totalTypes[0];
                          setFilterTab(isSame ? '' : totalTypes);
                        }}
                      >
                        {tab.types.reduce((acc, t) => acc + (conditionCounts[t] || 0), 0)}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              <ScrollArea className="flex-1 min-h-0">
                <div className="p-4 space-y-4">
                  <TabsContent value="workload" className="m-0 space-y-4">
                    <WorkloadTab
                      constraints={editableConstraints}
                      setConstraints={setEditableConstraints}
                      pushUndo={pushUndo}
                      allUsers={allUsers}
                      shiftTemplates={shiftTemplates}
                      onToggleEnabled={handleToggleCondition}
                      onDelete={handleDeleteCondition}
                    />
                  </TabsContent>

                  <TabsContent value="staffing" className="m-0 space-y-4">
                    <StaffingTab
                      constraints={editableConstraints}
                      setConstraints={setEditableConstraints}
                      shiftTemplates={shiftTemplates}
                      pushUndo={pushUndo}
                      allUsers={allUsers}
                      onToggleEnabled={handleToggleCondition}
                      onDelete={handleDeleteCondition}
                    />
                  </TabsContent>

                  <TabsContent value="priority" className="m-0 space-y-4">
                    <PriorityTab
                      constraints={editableConstraints}
                      shiftTemplates={shiftTemplates}
                      allUsers={allUsers}
                      onToggleEnabled={handleToggleCondition}
                      onDelete={handleDeleteCondition}
                    />
                  </TabsContent>

                  <TabsContent value="links" className="m-0 space-y-4">
                    <LinksTab
                      constraints={editableConstraints}
                      shiftTemplates={shiftTemplates}
                      allUsers={allUsers}
                      onToggleEnabled={handleToggleCondition}
                      onDelete={handleDeleteCondition}
                    />
                  </TabsContent>

                  <TabsContent value="availability" className="m-0 space-y-4">
                    <AvailabilityTab
                      constraints={editableConstraints}
                      setConstraints={setEditableConstraints}
                      shiftTemplates={shiftTemplates}
                      allUsers={allUsers}
                      onToggleEnabled={handleToggleCondition}
                      onDelete={handleDeleteCondition}
                    />
                  </TabsContent>

                  <TabsContent value="preview" className="m-0 space-y-4">
                    <PreviewTab
                      result={result}
                      editableAssignments={editableAssignments}
                      handleToggleAssignment={handleToggleAssignment}
                      handleRun={handleRun}
                      validationErrors={validationErrors}
                      shifts={shifts}
                      allUsers={allUsers}
                      roleByUserId={roleByUserId}
                      getRoleClasses={getRoleClasses}
                      dateRowSpanMap={dateRowSpanMap}
                      availabilityMap={availabilityMap}
                      dayUserShiftCounts={dayUserShiftCounts}
                      scheduledHoursByUser={scheduledHoursByUser}
                      availableHoursByUser={availableHoursByUser}
                    />
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </div>
        </div>

        {/* Footer: Action buttons */}
        <div className="border-t px-4 py-3 bg-muted/30 flex flex-col sm:flex-row gap-2 text-xs">
          <div className="flex flex-wrap items-stretch gap-2 w-full sm:w-auto">
            <div className="w-px h-5 bg-border hidden sm:block" />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowAddCondition(true)}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-1" />
              Thêm điều kiện
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-stretch mt-2 sm:mt-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="w-full sm:w-auto"
            >
              Đóng
            </Button>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveConstraints}
                    disabled={!canSaveStructuredConstraints || !hasUnsavedChanges}
                    className="w-full sm:w-auto"
                  >
                    Lưu
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {canSaveStructuredConstraints ? 'Lưu các điều kiện xếp lịch' : 'Chỉ Chủ nhà hàng có thể lưu các điều kiện cấu trúc'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              onClick={handleApply}
              disabled={!result || validationErrors.length > 0}
              size="sm"
              className="w-full sm:w-auto"
            >
              Áp dụng phân công
            </Button>
          </div>
        </div>
      </DialogContent>

      <AddConditionSheet
        isOpen={showAddCondition}
        onClose={() => setShowAddCondition(false)}
        shiftTemplates={shiftTemplates}
        allUsers={allUsers}
        onAddCondition={handleAddCondition}
      />
    </Dialog>
  );
}

function WorkloadTab({ constraints, setConstraints, pushUndo, allUsers, shiftTemplates, onToggleEnabled, onDelete }: any) {
  const globalWorkload = constraints.find((c: ScheduleCondition) => c.type === 'WorkloadLimit' && (c as any).scope === 'global') as any;
  const globalDailyLimit = constraints.find((c: ScheduleCondition) => c.type === 'DailyShiftLimit' && !(c as any).userId) as any;
  const strictAvailability = constraints.find((c: ScheduleCondition) => c.type === 'AvailabilityStrictness') as any;

  return (
    <div className="space-y-3 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:space-y-0 min-h-0">
      <div className="space-y-3">
        <Card>
          <CardContent className="p-3 space-y-2">
            <Label className="text-xs font-semibold">Giải thích chiến lược</Label>
            <p className="text-xs text-muted-foreground">Phân bổ tỉ lệ thuận với thời gian rảnh. Giới hạn Min/Max Ca và Giờ. Ưu tiên giới hạn riêng của nhân viên hơn giới hạn toàn cục.</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 space-y-2">
            <Label className="text-xs font-semibold">Giới hạn toàn cục</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Min Ca</Label>
                <Input
                  type="number"
                  min={0}
                  value={globalWorkload?.minShiftsPerWeek ?? ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value || '0', 10);
                    setConstraints((prev: any) => {
                      const next = [...prev];
                      const idx = next.findIndex(c => c.type === 'WorkloadLimit' && c.scope === 'global');
                      if (idx >= 0) next[idx] = { ...next[idx], minShiftsPerWeek: val };
                      else next.push({ id: `wl_global_${Date.now()}`, enabled: true, type: 'WorkloadLimit', scope: 'global', minShiftsPerWeek: val });
                      return next;
                    });
                  }}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Max Ca</Label>
                <Input
                  type="number"
                  min={0}
                  value={globalWorkload?.maxShiftsPerWeek ?? ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value || '0', 10);
                    setConstraints((prev: any) => {
                      const next = [...prev];
                      const idx = next.findIndex(c => c.type === 'WorkloadLimit' && c.scope === 'global');
                      if (idx >= 0) next[idx] = { ...next[idx], maxShiftsPerWeek: val };
                      else next.push({ id: `wl_global_${Date.now()}`, enabled: true, type: 'WorkloadLimit', scope: 'global', maxShiftsPerWeek: val });
                      return next;
                    });
                  }}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Min Giờ</Label>
                <Input
                  type="number"
                  min={0}
                  value={globalWorkload?.minHoursPerWeek ?? ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value || '0', 10);
                    setConstraints((prev: any) => {
                      const next = [...prev];
                      const idx = next.findIndex(c => c.type === 'WorkloadLimit' && c.scope === 'global');
                      if (idx >= 0) next[idx] = { ...next[idx], minHoursPerWeek: val };
                      else next.push({ id: `wl_global_${Date.now()}`, enabled: true, type: 'WorkloadLimit', scope: 'global', minHoursPerWeek: val });
                      return next;
                    });
                  }}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Max Giờ</Label>
                <Input
                  type="number"
                  min={0}
                  value={globalWorkload?.maxHoursPerWeek ?? ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value || '0', 10);
                    setConstraints((prev: any) => {
                      const next = [...prev];
                      const idx = next.findIndex(c => c.type === 'WorkloadLimit' && c.scope === 'global');
                      if (idx >= 0) next[idx] = { ...next[idx], maxHoursPerWeek: val };
                      else next.push({ id: `wl_global_${Date.now()}`, enabled: true, type: 'WorkloadLimit', scope: 'global', maxHoursPerWeek: val });
                      return next;
                    });
                  }}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="pt-2 border-t">
              <Label className="text-xs">Max Ca/Ngày (Toàn cục)</Label>
              <Input
                type="number"
                min={1}
                value={globalDailyLimit?.maxPerDay ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                  setConstraints((prev: any) => {
                    const next = [...prev];
                    const idx = next.findIndex(c => c.type === 'DailyShiftLimit' && !c.userId);
                    if (val === undefined) {
                      if (idx >= 0) next.splice(idx, 1);
                    } else {
                      if (idx >= 0) next[idx] = { ...next[idx], maxPerDay: val };
                      else next.push({ id: `dl_global_${Date.now()}`, enabled: true, type: 'DailyShiftLimit', maxPerDay: val });
                    }
                    return next;
                  });
                }}
                className="h-8 text-xs"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="strict-availability"
                checked={strictAvailability?.strict ?? false}
                onCheckedChange={(checked) => {
                  setConstraints((prev: any) => {
                    const next = [...prev];
                    const idx = next.findIndex(c => c.type === 'AvailabilityStrictness');
                    if (idx >= 0) next[idx] = { ...next[idx], strict: checked };
                    else next.push({ id: `as_${Date.now()}`, enabled: true, type: 'AvailabilityStrictness', strict: checked });
                    return next;
                  });
                }}
                className="h-3 w-3"
              />
              <Label htmlFor="strict-availability" className="text-xs font-medium">Buộc tuân thủ thời gian rảnh</Label>
            </div>
            <p className="text-[11px] text-muted-foreground">Nếu bật, phân công bắt buộc sẽ bị bỏ qua nếu nhân viên không rảnh.</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 h-full overflow-hidden">
            <ConditionSummary
              constraints={constraints}
              shiftTemplates={shiftTemplates}
              allUsers={allUsers}
              filterTab="WorkloadLimit"
              onToggleEnabled={onToggleEnabled}
              onDelete={onDelete}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StaffingTab({ constraints, setConstraints, shiftTemplates, pushUndo, allUsers, onToggleEnabled, onDelete }: {
  constraints: ScheduleCondition[];
  setConstraints: React.Dispatch<React.SetStateAction<ScheduleCondition[]>>;
  shiftTemplates: ShiftTemplate[];
  pushUndo: (prev: ScheduleCondition[]) => void;
  allUsers: ManagedUser[];
  onToggleEnabled: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-3 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:space-y-0">
      <div className="space-y-3">
        <Card>
          <CardContent className="p-3 space-y-2">
            <Label className="text-xs font-semibold">Nhu cầu theo ca</Label>
            <p className="text-xs text-muted-foreground">Sử dụng nút "Thêm điều kiện" để thêm nhu cầu ca mới.</p>
          </CardContent>
        </Card>
      </div>

      {/* Condition Summary Column */}
      <div className="lg:sticky lg:top-0">
        <Card className="h-full">
          <CardContent className="p-3 h-full overflow-hidden">
            <ConditionSummary
              constraints={constraints}
              shiftTemplates={shiftTemplates}
              allUsers={allUsers}
              filterTab="ShiftStaffing"
              onToggleEnabled={onToggleEnabled}
              onDelete={onDelete}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PriorityTab({
  constraints,
  shiftTemplates,
  allUsers,
  onToggleEnabled,
  onDelete,
}: {
  constraints: ScheduleCondition[];
  shiftTemplates: ShiftTemplate[];
  allUsers: ManagedUser[];
  onToggleEnabled: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-3 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:space-y-0">
      <div className="space-y-3">
        <Card>
          <CardContent className="p-3 space-y-2">
            <Label className="text-xs font-semibold">Ưu tiên nhân viên cho ca</Label>
            <p className="text-xs text-muted-foreground">Sử dụng nút "Thêm điều kiện" để thêm ưu tiên mới.</p>
          </CardContent>
        </Card>
      </div>

      {/* Condition Summary Column */}
      <div className="lg:sticky lg:top-0">
        <Card className="h-full">
          <CardContent className="p-3 h-full overflow-hidden">
            <ConditionSummary
              constraints={constraints}
              shiftTemplates={shiftTemplates}
              allUsers={allUsers}
              filterTab="StaffPriority"
              onToggleEnabled={onToggleEnabled}
              onDelete={onDelete}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LinksTab({
  constraints,
  shiftTemplates,
  allUsers,
  onToggleEnabled,
  onDelete,
}: {
  constraints: ScheduleCondition[];
  shiftTemplates: ShiftTemplate[];
  allUsers: ManagedUser[];
  onToggleEnabled: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-3 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:space-y-0">
      <div className="space-y-3">
        <Card>
          <CardContent className="p-3 space-y-2">
            <Label className="text-xs font-semibold">Ràng buộc nhân viên và ca</Label>
            <p className="text-xs text-muted-foreground">Sử dụng nút "Thêm điều kiện" để thêm ràng buộc mới (bắt buộc hoặc cấm).</p>
          </CardContent>
        </Card>
      </div>

      {/* Condition Summary Column */}
      <div className="lg:sticky lg:top-0">
        <Card className="h-full">
          <CardContent className="p-3 h-full overflow-hidden">
            <ConditionSummary
              constraints={constraints}
              shiftTemplates={shiftTemplates}
              allUsers={allUsers}
              filterTab={["StaffShiftLink", "StaffExclusion"]}
              onToggleEnabled={onToggleEnabled}
              onDelete={onDelete}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AvailabilityTab({
  constraints,
  setConstraints,
  shiftTemplates,
  allUsers,
  onToggleEnabled,
  onDelete,
}: {
  constraints: ScheduleCondition[];
  setConstraints: React.Dispatch<React.SetStateAction<ScheduleCondition[]>>;
  shiftTemplates: ShiftTemplate[];
  allUsers: ManagedUser[];
  onToggleEnabled: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const availability = constraints.find(c => c.type === 'AvailabilityStrictness') as any;
  return (
    <div className="space-y-3 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:space-y-0">
      <div className="space-y-3">
        <Card>
          <CardContent className="p-3 space-y-2">
            <Label className="text-xs">Tính năng xem thời gian rảnh sẽ được hiển thị ở phần Xem trước.</Label>
          </CardContent>
        </Card>
      </div>

      {/* Condition Summary Column */}
      <div className="lg:sticky lg:top-0">
        <Card className="h-full">
          <CardContent className="p-3 h-full overflow-hidden">
            <ConditionSummary
              constraints={constraints}
              shiftTemplates={shiftTemplates}
              allUsers={allUsers}
              filterTab="AvailabilityStrictness"
              onToggleEnabled={onToggleEnabled}
              onDelete={onDelete}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PreviewTab({
  result,
  editableAssignments,
  handleToggleAssignment,
  handleRun,
  validationErrors,
  shifts,
  allUsers,
  roleByUserId,
  getRoleClasses,
  dateRowSpanMap,
  availabilityMap,
  dayUserShiftCounts,
  scheduledHoursByUser,
  availableHoursByUser,
}: {
  result: ScheduleRunResult | null;
  editableAssignments: EditableAssignment[];
  handleToggleAssignment: (shiftId: string, userId: string) => void;
  handleRun: () => void;
  validationErrors: string[];
  shifts: any[];
  allUsers: ManagedUser[];
  roleByUserId: Map<string, string | undefined>;
  getRoleClasses: (role?: string) => string;
  dateRowSpanMap: Record<string, number>;
  availabilityMap: Map<string, string[]>;
  dayUserShiftCounts: Map<string, number>;
  scheduledHoursByUser: Map<string, number>;
  availableHoursByUser: Map<string, number>;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRun}
            disabled={validationErrors.length > 0}
            className="w-full"
          >
            Chạy xếp lịch tự động
          </Button>
          {validationErrors.length > 0 && (
            <div className="text-xs text-destructive mt-2">
              {validationErrors[0]}
            </div>
          )}
        </CardContent>
      </Card>

      {result ? (
        <>
          {result.warnings.length > 0 && (
            <div className="text-xs text-yellow-600 dark:text-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 p-2 rounded">
              {result.warnings.join(' • ')}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Đề xuất: {editableAssignments.filter(a => a.selected).length}</Badge>
            <Badge variant="outline">Chưa điền: {result.unfilled.reduce((acc: number, u: any) => acc + (u.remaining || 0), 0)}</Badge>
            {(() => {
              const counts: Record<string, number> = {};
              for (const a of editableAssignments.filter(x => x.selected)) {
                const r = roleByUserId.get(a.userId) || 'Bất kỳ';
                counts[r] = (counts[r] || 0) + 1;
              }
              return Object.entries(counts).map(([r, n]) => (
                <Badge key={`role_count_${r}`} className={getRoleClasses(r)}>{r}: {n}</Badge>
              ));
            })()}
          </div>

          <div className="border rounded-md overflow-hidden">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[15%] p-2">Ngày</TableHead>
                  <TableHead className="w-[20%] p-2">Ca</TableHead>
                  <TableHead className="p-2">Phân công</TableHead>
                  <TableHead className="w-[10%] p-2">Thiếu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift: any, idx: number) => {
                  const dayAssignments = editableAssignments.filter((a: any) => a.shiftId === shift.id);
                  const unfilled = result.unfilled.find((u: any) => u.shiftId === shift.id)?.remaining || 0;
                  const dateKey = format(new Date(shift.date), 'yyyy-MM-dd');
                  const isFirstOfDay = idx === 0 || format(new Date(shifts[idx - 1].date), 'yyyy-MM-dd') !== dateKey;

                  return (
                    <TableRow key={shift.id} className={cn(unfilled > 0 && 'bg-destructive/5')}>
                      {isFirstOfDay && (
                        <TableCell rowSpan={dateRowSpanMap[dateKey]} className="font-semibold whitespace-nowrap p-2">
                          {format(new Date(shift.date), 'eee, dd/MM', { locale: vi })}
                        </TableCell>
                      )}
                      <TableCell className="p-2 whitespace-nowrap">{shift.label}</TableCell>
                      <TableCell className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {dayAssignments.map((a: any) => {
                            const userName = allUsers.find((u: any) => u.uid === a.userId)?.displayName || a.userId;
                            const role = roleByUserId.get(a.userId);
                            const roleCls = getRoleClasses(role);
                            const dayCount = dayUserShiftCounts.get(`${a.userId}:${dateKey}`) || 0;
                            return (
                              <TooltipProvider key={`${a.shiftId}_${a.userId}`}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <motion.button
                                      onClick={() => handleToggleAssignment(a.shiftId, a.userId)}
                                      className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium border', roleCls, a.selected ? 'ring-2 ring-primary' : 'opacity-60')}
                                      initial={{ scale: 0.98 }}
                                      animate={{ scale: 1 }}
                                      aria-pressed={a.selected}
                                    >
                                      {userName}
                                      {dayCount >= 2 && <span className="ml-0.5 text-[9px] font-bold">×{dayCount}</span>}
                                    </motion.button>
                                  </TooltipTrigger>
                                  <TooltipContent className="text-xs">
                                    <div>Vai trò: {role || 'Bất kỳ'}</div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="p-2">{unfilled > 0 ? unfilled : '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <Card>
            <CardContent className="p-3">
              <Label className="text-xs font-semibold block mb-2">Tổng kết giờ làm</Label>
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="p-1">Nhân viên</TableHead>
                    <TableHead className="text-right p-1">Giờ dự kiến</TableHead>
                    <TableHead className="text-right p-1">Giờ rảnh</TableHead>
                    <TableHead className="text-right p-1">Chênh lệch</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...scheduledHoursByUser.keys()].sort().map((uid: string) => {
                    const u = allUsers.find((x: any) => x.uid === uid);
                    const sched = scheduledHoursByUser.get(uid) || 0;
                    const avail = availableHoursByUser.get(uid) || 0;
                    const diff = sched - avail;
                    const exceed = diff > 0.0001;
                    return (
                      <TableRow key={`sum_${uid}`} className={cn(exceed && 'bg-destructive/5')}>
                        <TableCell className="p-1 font-medium">{u?.displayName || uid}</TableCell>
                        <TableCell className="text-right p-1">{sched.toFixed(1)}h</TableCell>
                        <TableCell className="text-right p-1">{avail.toFixed(1)}h</TableCell>
                        <TableCell className={cn('text-right p-1', exceed ? 'text-destructive font-semibold' : 'text-muted-foreground')}>
                          {(diff >= 0 ? '+' : '') + diff.toFixed(1)}h
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="text-xs text-muted-foreground text-center py-8">
          Chạy xếp lịch để xem đề xuất.
        </div>
      )}
    </div>
  );
}

function validateConstraints(constraints: ScheduleCondition[]): string[] {
  const errors: string[] = [];
  const makePairKey = (a: string, b: string) => [a, b].sort().join('|');
  const workloads = constraints.filter(c => c.type === 'WorkloadLimit');
  for (const wl of workloads as any[]) {
    const minS = wl.minShiftsPerWeek ?? 0;
    const maxS = wl.maxShiftsPerWeek ?? Number.POSITIVE_INFINITY;
    const minH = wl.minHoursPerWeek ?? 0;
    const maxH = wl.maxHoursPerWeek ?? Number.POSITIVE_INFINITY;
    if (minS > maxS) errors.push(`Giới hạn ca không hợp lệ: Min(${minS}) > Max(${maxS}).`);
    if (minH > maxH) errors.push(`Giới hạn giờ không hợp lệ: Min(${minH}) > Max(${maxH}).`);
  }
  const links = constraints.filter(c => c.type === 'StaffShiftLink') as any[];
  const seen = new Map<string, string>();
  for (const ln of links) {
    const key = `${ln.userId}:${ln.templateId}`;
    const prev = seen.get(key);
    if (prev && prev !== ln.link) {
      errors.push(`Xung đột ràng buộc cho nhân viên ${ln.userId} và ca ${ln.templateId}.`);
    } else {
      seen.set(key, ln.link);
    }
  }
  const exclusions = constraints.filter(c => c.type === 'StaffExclusion') as any[];
  const exclusionSeen = new Map<string, Set<string>>();
  for (const ex of exclusions) {
    if (!ex.blockedUserIds || ex.blockedUserIds.length === 0) {
      errors.push('Điều kiện không ghép chung cần chọn ít nhất 1 nhân viên bị chặn.');
      continue;
    }
    const scope = ex.templateId || 'ALL';
    const set = exclusionSeen.get(scope) || new Set<string>();
    for (const blocked of ex.blockedUserIds) {
      if (blocked === ex.userId) {
        errors.push('Không thể cấm nhân viên làm chung với chính họ.');
        continue;
      }
      const key = makePairKey(ex.userId, blocked);
      if (set.has(key)) {
        errors.push(`Điều kiện không ghép chung bị trùng giữa ${ex.userId} và ${blocked}${ex.templateId ? ` (ca ${ex.templateId})` : ''}.`);
      } else {
        set.add(key);
      }
    }
    exclusionSeen.set(scope, set);
  }
  const dailyLimits = constraints.filter(c => c.type === 'DailyShiftLimit') as any[];
  for (const dl of dailyLimits) {
    if (dl.maxPerDay != null && (typeof dl.maxPerDay !== 'number' || isNaN(dl.maxPerDay) || dl.maxPerDay < 1)) {
      errors.push(`Giới hạn ca mỗi ngày không hợp lệ.`);
    }
  }
  return errors;
}
