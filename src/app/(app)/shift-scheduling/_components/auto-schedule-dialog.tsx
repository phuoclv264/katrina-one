'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogAction,
  DialogCancel
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Undo2, Redo2, Plus, AlertTriangle, User, Clock, Calculator, LayoutGrid, Check } from 'lucide-react';
import ConditionSummary from './condition-summary';
import AddConditionSheet from './add-condition-sheet';
import { Combobox } from '@/components/combobox';

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
  parentDialogTag: string;
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
  { value: 'all', label: 'Tất cả điều kiện' },
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
  parentDialogTag
}: Props) {
  const [editableConstraints, setEditableConstraints] = useState<ScheduleCondition[]>(constraints || []);
  const [result, setResult] = useState<ScheduleRunResult | null>(null);
  const [editableAssignments, setEditableAssignments] = useState<EditableAssignment[]>([]);
  const [activeTab, setActiveTab] = useState('preview');
  const [filterTab, setFilterTab] = useState<string | string[]>('');
  const [showAddCondition, setShowAddCondition] = useState(false);
  const [editCondition, setEditCondition] = useState<ScheduleCondition | null>(null);
  const [savedTimestamp, setSavedTimestamp] = useState<number | null>(null);
  const [lastSaveTime, setLastSaveTime] = useState<string>('');

  // Employee filter for "Tất cả điều kiện" tab (single selection)
  const [employeeFilter, setEmployeeFilter] = useState<ManagedUser[]>([]);

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

  const handleStartEditCondition = (condition: ScheduleCondition) => {
    if (!canSaveStructuredConstraints) return;
    setEditCondition(condition);
    setShowAddCondition(true);
  };

  const handleSaveCondition = (condition: ScheduleCondition) => {
    const prev = [...editableConstraints];
    pushUndo(prev);
    setEditableConstraints(prev.map(c => c.id === condition.id ? condition : c));
    toast.success('Đã cập nhật điều kiện.');
    setEditCondition(null);
    setShowAddCondition(false);
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
    <Dialog open={isOpen} onOpenChange={onClose} dialogTag="auto-schedule-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-6xl h-[95vh] sm:h-[90vh]">
        <DialogHeader iconkey="calculator">
          <DialogTitle>Xếp lịch tự động</DialogTitle>
          <DialogDescription>
            Tối ưu hóa bảng lương và phân công ca làm việc dựa trên các điều kiện ràng buộc và thời gian rảnh.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="p-0 flex flex-col overflow-hidden">
          {/* Status bar & Undo/Redo tools */}
          {(hasUnsavedChanges || lastSaveTime || validationErrors.length > 0 || undoStack.current.length > 0 || redoStack.current.length > 0) && (
            <div className="px-6 py-2 bg-primary/[0.03] border-b border-primary/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4 text-[10px] sm:text-xs">
                {hasUnsavedChanges && (
                  <div className="flex items-center gap-1.5 text-amber-600 font-bold">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="hidden sm:inline">Có thay đổi chưa lưu</span>
                    <span className="sm:hidden">Chưa lưu</span>
                  </div>
                )}
                {lastSaveTime && (
                  <div className="text-muted-foreground font-medium hidden sm:block">
                    Lưu lần cuối: {lastSaveTime}
                  </div>
                )}
                {validationErrors.length > 0 && (
                  <div className="flex items-center gap-1.5 text-destructive font-bold">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>{validationErrors.length} lỗi</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                {undoStack.current.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleUndo}
                    className="h-8 px-2 text-xs font-bold rounded-lg hover:bg-background"
                    title="Hoàn tác (Ctrl+Z)"
                  >
                    <Undo2 className="h-4 w-4 mr-1 text-primary" />
                    <span className="hidden sm:inline">Hoàn tác</span>
                  </Button>
                )}

                {redoStack.current.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRedo}
                    className="h-8 px-2 text-xs font-bold rounded-lg hover:bg-background"
                    title="Làm lại (Ctrl+Y)"
                  >
                    <Redo2 className="h-4 w-4 mr-1 text-primary" />
                    <span className="hidden sm:inline">Làm lại</span>
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 flex flex-col overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              {/* Mobile Navigation */}
              <div className="px-4 py-3 sm:hidden border-b border-primary/5 bg-muted/20">
                <div className="flex items-center gap-2">
                  <Combobox
                    value={activeTab}
                    onChange={(val) => setActiveTab(val as string)}
                    options={TABS.map(tab => ({ value: tab.value, label: tab.label }))}
                    compact
                    searchable={false}
                    className="flex-1 bg-background rounded-xl border-primary/10"
                  />
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    onClick={() => setShowAddCondition(true)} 
                    className="shrink-0 rounded-xl bg-primary/10 text-primary hover:bg-primary/20"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveConstraints}
                    disabled={!canSaveStructuredConstraints || !hasUnsavedChanges}
                    className="shrink-0 h-10 px-4 rounded-xl border-primary/20 text-primary font-bold"
                  >
                    Lưu
                  </Button>
                </div>
              </div>

              {/* Desktop Tabs */}
              <div className="hidden sm:block px-6 pt-4 border-b border-primary/5 bg-primary/[0.01]">
                <TabsList className="flex items-center justify-start gap-1 h-auto bg-transparent p-0 mb-[-1px]">
                  {TABS.map(tab => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="relative text-xs font-bold px-4 py-2.5 rounded-t-xl rounded-b-none border border-transparent data-[state=active]:bg-background data-[state=active]:border-primary/10 data-[state=active]:border-b-background transition-all"
                    >
                      {tab.label}
                      {tab.types && tab.types.length > 0 && tab.types.reduce((acc, t) => acc + (conditionCounts[t] || 0), 0) > 0 && (
                        <div className="ml-2 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-black">
                          {tab.types.reduce((acc, t) => acc + (conditionCounts[t] || 0), 0)}
                        </div>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="flex-1 relative overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-4 sm:p-6 space-y-6">
                    <TabsContent value="workload" className="m-0 focus-visible:outline-none">
                      <WorkloadTab
                        constraints={editableConstraints}
                        setConstraints={setEditableConstraints}
                        pushUndo={pushUndo}
                        allUsers={allUsers}
                        shiftTemplates={shiftTemplates}
                        onToggleEnabled={handleToggleCondition}
                        onDelete={handleDeleteCondition}
                        onEdit={handleStartEditCondition}
                        canSave={canSaveStructuredConstraints}
                      />
                    </TabsContent>

                    <TabsContent value="staffing" className="m-0 focus-visible:outline-none">
                      <StaffingTab
                        constraints={editableConstraints}
                        setConstraints={setEditableConstraints}
                        shiftTemplates={shiftTemplates}
                        pushUndo={pushUndo}
                        allUsers={allUsers}
                        onToggleEnabled={handleToggleCondition}
                        onDelete={handleDeleteCondition}
                        onEdit={handleStartEditCondition}
                        canSave={canSaveStructuredConstraints}
                      />
                    </TabsContent>

                    <TabsContent value="priority" className="m-0 focus-visible:outline-none">
                      <PriorityTab
                        constraints={editableConstraints}
                        shiftTemplates={shiftTemplates}
                        allUsers={allUsers}
                        onToggleEnabled={handleToggleCondition}
                        onDelete={handleDeleteCondition}
                        onEdit={handleStartEditCondition}
                        canSave={canSaveStructuredConstraints}
                      />
                    </TabsContent>

                    <TabsContent value="links" className="m-0 focus-visible:outline-none">
                      <LinksTab
                        constraints={editableConstraints}
                        shiftTemplates={shiftTemplates}
                        allUsers={allUsers}
                        onToggleEnabled={handleToggleCondition}
                        onDelete={handleDeleteCondition}
                        onEdit={handleStartEditCondition}
                        canSave={canSaveStructuredConstraints}
                      />
                    </TabsContent>

                    <TabsContent value="availability" className="m-0 focus-visible:outline-none">
                      <AvailabilityTab
                        constraints={editableConstraints}
                        setConstraints={setEditableConstraints}
                        shiftTemplates={shiftTemplates}
                        allUsers={allUsers}
                        onToggleEnabled={handleToggleCondition}
                        onDelete={handleDeleteCondition}
                        onEdit={handleStartEditCondition}
                        canSave={canSaveStructuredConstraints}
                      />
                    </TabsContent>

                    <TabsContent value="all" className="m-0 space-y-4 focus-visible:outline-none">
                      <div className="grid gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 p-4 rounded-3xl border border-primary/5">
                          <div className="flex items-center gap-2">
                             <div className="p-2 rounded-xl bg-background border border-primary/10">
                               <User className="h-4 w-4 text-primary" />
                             </div>
                             <div>
                               <h4 className="text-sm font-bold">Lọc theo nhân viên</h4>
                               <p className="text-[10px] text-muted-foreground font-medium">Xem các điều kiện liên quan đến một nhân sự cụ thể</p>
                             </div>
                          </div>
                          <div className="w-full sm:w-64">
                            <Combobox
                              options={allUsers
                                .filter(u => u.role !== 'Chủ nhà hàng')
                                .map(u => ({ value: u.uid, label: u.displayName }))}
                              value={employeeFilter[0]?.uid ?? ''}
                              onChange={(next) => {
                                const nextId = typeof next === 'string' ? next : '';
                                const selected = allUsers.find(u => u.uid === nextId);
                                setEmployeeFilter(selected ? [selected] : []);
                              }}
                              placeholder="Tất cả nhân viên"
                              className="bg-background rounded-2xl border-primary/10"
                            />
                          </div>
                        </div>

                        <div className="bg-background border border-primary/10 rounded-2xl overflow-hidden shadow-sm">
                          <ConditionSummary
                            constraints={editableConstraints}
                            shiftTemplates={shiftTemplates}
                            allUsers={allUsers}
                            onToggleEnabled={handleToggleCondition}
                            onDelete={handleDeleteCondition}
                            onEdit={canSaveStructuredConstraints ? handleStartEditCondition : undefined}
                            employeeFilterUserId={employeeFilter[0]?.uid}
                            onClearEmployeeFilter={() => setEmployeeFilter([])}
                          />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="preview" className="m-0 focus-visible:outline-none">
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
              </div>
            </Tabs>
          </div>
        </DialogBody>

        <DialogFooter className="px-6 py-4 bg-muted/20 border-t border-primary/5 sm:flex-row sm:justify-between items-center">
          <div className="hidden sm:flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddCondition(true)}
              className="h-10 px-4 rounded-xl border-primary/20 hover:bg-primary/5 text-primary font-bold shadow-none"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Thêm điều kiện
            </Button>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveConstraints}
                    disabled={!canSaveStructuredConstraints || !hasUnsavedChanges}
                    className="h-10 px-4 rounded-xl border-primary/20 hover:bg-primary/5 text-primary font-bold shadow-none"
                  >
                    Lưu cấu trúc
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {canSaveStructuredConstraints ? 'Lưu vĩnh viễn các điều kiện này' : 'Chỉ Chủ nhà hàng có quyền lưu cấu trúc'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <DialogCancel className="flex-1 sm:flex-none h-11 px-6 rounded-2xl">
              Đóng
            </DialogCancel>

            {activeTab === 'preview' && result && (
              <DialogAction
                onClick={handleApply}
                disabled={validationErrors.length > 0}
                className="flex-1 sm:flex-none h-11 px-8 rounded-2xl"
              >
                Áp dụng
              </DialogAction>
            )}
          </div>
        </DialogFooter>
      </DialogContent>

      <AddConditionSheet
        isOpen={showAddCondition}
        onClose={() => {
          setShowAddCondition(false);
          setEditCondition(null);
        }}
        shiftTemplates={shiftTemplates}
        allUsers={allUsers}
        onAddCondition={handleAddCondition}
        onSaveCondition={handleSaveCondition}
        conditionToEdit={editCondition}
      />
    </Dialog>
  );
}

function WorkloadTab({ constraints, setConstraints, pushUndo, allUsers, shiftTemplates, onToggleEnabled, onDelete, onEdit, canSave }: any) {
  return (
    <div className="space-y-6">
      <div className="bg-primary/[0.03] p-6 rounded-[2rem] border border-primary/5">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-background border border-primary/10">
            <LayoutGrid className="h-4 w-4 text-primary" />
          </div>
          <h4 className="font-bold text-sm">Chiến lược định mức công việc</h4>
        </div>
        <p className="text-xs text-muted-foreground font-medium leading-relaxed">
          Tự động phân bổ số ca làm việc tỉ lệ thuận với thời gian rảnh của nhân viên. 
          Giới hạn Min/Max Ca và Giờ sẽ được ưu tiên theo thứ tự: Nhân viên cụ thể {">"} Toàn cục.
        </p>
      </div>

      <div className="bg-background border border-primary/10 rounded-2xl overflow-hidden shadow-sm">
        <ConditionSummary
          constraints={constraints}
          shiftTemplates={shiftTemplates}
          allUsers={allUsers}
          filterTab="WorkloadLimit"
          onToggleEnabled={onToggleEnabled}
          onDelete={onDelete}
          onEdit={canSave ? onEdit : undefined}
        />
      </div>
    </div>
  );
}

function StaffingTab({ constraints, setConstraints, shiftTemplates, pushUndo, allUsers, onToggleEnabled, onDelete, onEdit, canSave }: {
  constraints: ScheduleCondition[];
  setConstraints: React.Dispatch<React.SetStateAction<ScheduleCondition[]>>;
  shiftTemplates: ShiftTemplate[];
  pushUndo: (prev: ScheduleCondition[]) => void;
  allUsers: ManagedUser[];
  onToggleEnabled: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (c: ScheduleCondition) => void;
  canSave?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-primary/[0.03] p-6 rounded-[2rem] border border-primary/5">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-background border border-primary/10">
            <User className="h-4 w-4 text-primary" />
          </div>
          <h4 className="font-bold text-sm">Nhu cầu nhân sự theo ca</h4>
        </div>
        <p className="text-xs text-muted-foreground font-medium leading-relaxed">
          Thiết lập số lượng nhân sự tối thiểu (Min) và tối đa (Max) cho từng loại ca làm việc trong tuần.
        </p>
      </div>

      <div className="bg-background border border-primary/10 rounded-2xl overflow-hidden shadow-sm">
        <ConditionSummary
          constraints={constraints}
          shiftTemplates={shiftTemplates}
          allUsers={allUsers}
          filterTab="ShiftStaffing"
          onToggleEnabled={onToggleEnabled}
          onDelete={onDelete}
          onEdit={canSave ? onEdit : undefined}
        />
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
  onEdit,
  canSave,
}: {
  constraints: ScheduleCondition[];
  shiftTemplates: ShiftTemplate[];
  allUsers: ManagedUser[];
  onToggleEnabled: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (c: ScheduleCondition) => void;
  canSave?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-primary/[0.03] p-6 rounded-[2rem] border border-primary/5">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-background border border-primary/10">
            <Plus className="h-4 w-4 text-primary" />
          </div>
          <h4 className="font-bold text-sm">Ưu tiên nhân viên</h4>
        </div>
        <p className="text-xs text-muted-foreground font-medium leading-relaxed">
          Đánh dấu những nhân viên được ưu tiên xếp vào các ca làm việc cụ thể.
        </p>
      </div>

      <div className="bg-background border border-primary/10 rounded-2xl overflow-hidden shadow-sm">
        <ConditionSummary
          constraints={constraints}
          shiftTemplates={shiftTemplates}
          allUsers={allUsers}
          filterTab="StaffPriority"
          onToggleEnabled={onToggleEnabled}
          onDelete={onDelete}
          onEdit={canSave ? onEdit : undefined}
        />
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
  onEdit,
  canSave,
}: {
  constraints: ScheduleCondition[];
  shiftTemplates: ShiftTemplate[];
  allUsers: ManagedUser[];
  onToggleEnabled: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (c: ScheduleCondition) => void;
  canSave?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-primary/[0.03] p-6 rounded-[2rem] border border-primary/5">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-background border border-primary/10">
            <Check className="h-4 w-4 text-primary" />
          </div>
          <h4 className="font-bold text-sm">Ràng buộc & Loại trừ</h4>
        </div>
        <p className="text-xs text-muted-foreground font-medium leading-relaxed">
          Thiết lập các ca làm việc bắt buộc hoặc cấm đối với nhân viên, cũng như các cặp nhân viên không được làm chung ca.
        </p>
      </div>

      <div className="bg-background border border-primary/10 rounded-2xl overflow-hidden shadow-sm">
        <ConditionSummary
          constraints={constraints}
          shiftTemplates={shiftTemplates}
          allUsers={allUsers}
          filterTab={["StaffShiftLink", "StaffExclusion"]}
          onToggleEnabled={onToggleEnabled}
          onDelete={onDelete}
          onEdit={canSave ? onEdit : undefined}
        />
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
  onEdit,
  canSave,
}: {
  constraints: ScheduleCondition[];
  setConstraints: React.Dispatch<React.SetStateAction<ScheduleCondition[]>>;
  shiftTemplates: ShiftTemplate[];
  allUsers: ManagedUser[];
  onToggleEnabled: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (c: ScheduleCondition) => void;
  canSave?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-primary/[0.03] p-6 rounded-[2rem] border border-primary/5">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-background border border-primary/10">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <h4 className="font-bold text-sm">Độ nghiêm ngặt thời gian rảnh</h4>
        </div>
        <p className="text-xs text-muted-foreground font-medium leading-relaxed">
          Cấu hình cách thuật toán xử lý khi nhân viên không có thời gian rảnh trùng khớp với ca làm việc.
        </p>
      </div>

      <div className="bg-background border border-primary/10 rounded-2xl overflow-hidden shadow-sm">
        <ConditionSummary
          constraints={constraints}
          shiftTemplates={shiftTemplates}
          allUsers={allUsers}
          filterTab="AvailabilityStrictness"
          onToggleEnabled={onToggleEnabled}
          onDelete={onDelete}
          onEdit={canSave ? onEdit : undefined}
        />
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
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent p-6 rounded-[2rem] border border-primary/10 shadow-sm transition-all hover:shadow-md">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="shrink-0 p-4 rounded-2xl bg-background shadow-sm border border-primary/5 flex items-center justify-center">
            <Calculator className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h4 className="text-lg font-bold">Trình xếp lịch AI</h4>
            <p className="text-xs text-muted-foreground font-medium">Bấm để bắt đầu tính toán phân bổ ca tối ưu</p>
          </div>
          <Button
            size="lg"
            onClick={handleRun}
            disabled={validationErrors.length > 0}
            className="w-full sm:w-auto h-14 px-8 rounded-2xl font-black text-base shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Chạy Xếp Lịch
          </Button>
        </div>
        {validationErrors.length > 0 && (
          <div className="mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-2 text-xs text-destructive font-bold">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Vui lòng sửa các lỗi cấu trúc trước khi chạy xếp lịch.</span>
          </div>
        )}
      </div>

      {result ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {result.warnings.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {result.warnings.map((w: string, i: number) => (
                  <span key={i}>• {w}</span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
             <div className="bg-background border border-primary/10 p-4 rounded-2xl shadow-sm text-center">
                <span className="block text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-1">Đã phân công</span>
                <span className="text-2xl font-black text-primary">{editableAssignments.filter((a: EditableAssignment) => a.selected).length}</span>
             </div>
             <div className="bg-background border border-primary/10 p-4 rounded-2xl shadow-sm text-center">
                <span className="block text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-1">Còn trống</span>
                <span className="text-2xl font-black text-destructive">{result.unfilled.reduce((acc: number, u: any) => acc + (u.remaining || 0), 0)}</span>
             </div>
             <div className="col-span-2 bg-background border border-primary/10 p-4 rounded-2xl shadow-sm flex flex-wrap items-center justify-center gap-2">
               {(() => {
                  const counts: Record<string, number> = {};
                  for (const a of editableAssignments.filter((x: EditableAssignment) => x.selected)) {
                    const r = roleByUserId.get(a.userId) || 'Bất kỳ';
                    counts[r] = (counts[r] || 0) + 1;
                  }
                  return Object.entries(counts).map(([r, n]) => (
                    <Badge key={`role_count_${r}`} className={cn(getRoleClasses(r), "h-7 px-3 rounded-lg font-bold border-none shadow-none text-[11px]")}>{r}: {n}</Badge>
                  ));
                })()}
             </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h5 className="text-sm font-black uppercase tracking-tighter text-muted-foreground/80 flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                Chi tiết đề xuất
              </h5>
              <p className="text-[10px] font-bold text-muted-foreground">Click vào tên để bật/tắt phân công</p>
            </div>

            <div className="bg-background border border-primary/10 rounded-[2rem] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <Table className="text-xs">
                  <TableHeader className="bg-primary/[0.02]">
                    <TableRow className="border-primary/5 hover:bg-transparent">
                      <TableHead className="w-[120px] font-black text-primary/80 uppercase text-[10px] px-6 py-4">Ngày</TableHead>
                      <TableHead className="w-[150px] font-black text-primary/80 uppercase text-[10px] px-4 py-4">Ca làm việc</TableHead>
                      <TableHead className="font-black text-primary/80 uppercase text-[10px] px-4 py-4">Nhân sự đề xuất</TableHead>
                      <TableHead className="w-[80px] font-black text-primary/80 uppercase text-[10px] px-4 py-4 text-center">Trống</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shifts.map((shift: any, idx: number) => {
                      const dayAssignments = editableAssignments.filter((a: any) => a.shiftId === shift.id);
                      const unfilled = result.unfilled.find((u: any) => u.shiftId === shift.id)?.remaining || 0;
                      const dateKey = format(new Date(shift.date), 'yyyy-MM-dd');
                      const isFirstOfDay = idx === 0 || format(new Date(shifts[idx - 1].date), 'yyyy-MM-dd') !== dateKey;

                      return (
                        <TableRow key={shift.id} className={cn("border-primary/5 transition-colors", unfilled > 0 && 'bg-destructive/[0.02] hover:bg-destructive/[0.04]')}>
                          {isFirstOfDay && (
                            <TableCell rowSpan={dateRowSpanMap[dateKey]} className="font-black whitespace-nowrap px-6 py-4 align-top border-r border-primary/5">
                              <div className="flex flex-col items-start gap-0.5">
                                <span className="text-primary text-[10px] uppercase font-black">{format(new Date(shift.date), 'eeee', { locale: vi })}</span>
                                <span className="text-lg leading-none">{format(new Date(shift.date), 'dd/MM')}</span>
                              </div>
                            </TableCell>
                          )}
                          <TableCell className="px-4 py-4 font-bold text-foreground/80">
                            {shift.label}
                            <div className="text-[10px] text-muted-foreground font-medium">{shift.timeSlot.start} - {shift.timeSlot.end}</div>
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <div className="flex flex-wrap gap-1.5 min-h-[32px]">
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
                                          className={cn(
                                            'rounded-xl px-2.5 py-1 text-[11px] font-bold border-2 transition-all', 
                                            roleCls, 
                                            a.selected 
                                              ? 'border-primary shadow-sm scale-1 target:border-primary' 
                                              : 'opacity-40 grayscale-[0.5] border-transparent scale-[0.95]'
                                          )}
                                          initial={{ scale: 0.98 }}
                                          whileHover={{ scale: 1.05 }}
                                          whileTap={{ scale: 0.95 }}
                                          aria-pressed={a.selected}
                                        >
                                          {userName}
                                          {dayCount >= 2 && <span className="ml-1 text-[10px] opacity-80">×{dayCount}</span>}
                                        </motion.button>
                                      </TooltipTrigger>
                                      <TooltipContent className="text-xs font-bold rounded-xl border-primary/10 shadow-lg">
                                        <div className="flex flex-col gap-0.5">
                                          <span>Vai trò: {role || 'Bất kỳ'}</span>
                                          <span className="text-[10px] opacity-70">Nhân viên này làm {dayCount} ca trong ngày này</span>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                );
                              })}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-4 text-center">
                            {unfilled > 0 ? (
                              <Badge variant="destructive" className="h-6 w-6 rounded-lg p-0 flex items-center justify-center font-black shadow-sm">
                                {unfilled}
                              </Badge>
                            ) : (
                              <div className="p-1 rounded-lg bg-emerald-50 text-emerald-600 inline-flex">
                                <Check className="h-4 w-4" />
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <div className="space-y-4">
             <div className="px-2">
                <h5 className="text-sm font-black uppercase tracking-tighter text-muted-foreground/80 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Cân bằng giờ làm
                </h5>
             </div>

             <div className="bg-background border border-primary/10 rounded-[2rem] overflow-hidden shadow-sm">
                <Table className="text-xs">
                  <TableHeader className="bg-primary/[0.02]">
                    <TableRow className="border-primary/5 hover:bg-transparent">
                      <TableHead className="px-6 py-4 font-black text-primary/80 uppercase text-[10px]">Nhân viên</TableHead>
                      <TableHead className="px-4 py-4 font-black text-primary/80 uppercase text-[10px] text-right">Dự kiến</TableHead>
                      <TableHead className="px-4 py-4 font-black text-primary/80 uppercase text-[10px] text-right">Rảnh</TableHead>
                      <TableHead className="px-6 py-4 font-black text-primary/80 uppercase text-[10px] text-right">Chênh lệch</TableHead>
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
                        <TableRow key={`sum_${uid}`} className={cn("border-primary/5 transition-colors", exceed && 'bg-destructive/[0.02] hover:bg-destructive/[0.04]')}>
                          <TableCell className="px-6 py-4 font-bold text-foreground/80">{u?.displayName || uid}</TableCell>
                          <TableCell className="px-4 py-4 text-right font-black text-primary">{sched.toFixed(1)}h</TableCell>
                          <TableCell className="px-4 py-4 text-right font-bold text-muted-foreground">{avail.toFixed(1)}h</TableCell>
                          <TableCell className={cn('px-6 py-4 text-right font-black', exceed ? 'text-destructive' : 'text-emerald-600')}>
                            {(diff >= 0 ? '+' : '') + diff.toFixed(1)}h
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
             </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 bg-muted/20 rounded-[3rem] border-2 border-dashed border-primary/10">
          <div className="w-16 h-16 bg-background rounded-2xl border border-primary/5 shadow-sm flex items-center justify-center mx-auto mb-4">
            <Calculator className="h-8 w-8 text-primary/30" />
          </div>
          <p className="text-muted-foreground font-bold">Chưa có kết quả xếp lịch</p>
          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1">Vui lòng bấm nút Chạy Xếp Lịch bên trên</p>
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
