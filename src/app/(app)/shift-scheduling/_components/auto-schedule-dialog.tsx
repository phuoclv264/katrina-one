'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { UserMultiSelect } from '@/components/user-multi-select';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  schedule: Schedule | null;
  allUsers: ManagedUser[];
  availability: Availability[];
  constraints: ScheduleCondition[];
  onApplyAssignments: (assignments: { shiftId: string; userId: string }[], strategy: 'merge' | 'replace') => void;
  shiftTemplates: ShiftTemplate[];
};

type EditableAssignment = { shiftId: string; userId: string; selected: boolean };

export default function AutoScheduleDialog({ isOpen, onClose, schedule, allUsers, availability, constraints, onApplyAssignments, shiftTemplates }: Props) {
  const [editableConstraints, setEditableConstraints] = useState<ScheduleCondition[]>(constraints || []);
  const [result, setResult] = useState<ScheduleRunResult | null>(null);
  const [editableAssignments, setEditableAssignments] = useState<EditableAssignment[]>([]);
  const [strategy, setStrategy] = useState<'merge' | 'replace'>('merge');
  const [newPriorityTemplateId, setNewPriorityTemplateId] = useState<string>('');
  const [newPriorityUserId, setNewPriorityUserId] = useState<string>('');
  const [newPriorityWeight, setNewPriorityWeight] = useState<number>(1);
  const [newPriorityMandatory, setNewPriorityMandatory] = useState<boolean>(false);
  const [linksForm, setLinksForm] = useState<{ templateId?: string; userId?: string; link?: 'force' | 'ban' }>({ link: 'force' });
  const undoStack = useRef<ScheduleCondition[][]>([]);
  const [priorityScrollTop, setPriorityScrollTop] = useState(0);
  const [linksScrollTop, setLinksScrollTop] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setEditableConstraints(constraints || []);
      setResult(null);
      setEditableAssignments([]);
      setStrategy('merge');
    }
  }, [isOpen, constraints]);

  const shifts = useMemo(() => schedule?.shifts || [], [schedule]);

  const validationErrors = useMemo(() => validateConstraints(editableConstraints), [editableConstraints]);

  const globalWorkload = useMemo(() => {
    const c = editableConstraints.find(c => c.type === 'WorkloadLimit' && (c as any).scope === 'global') as any;
    return c || null;
  }, [editableConstraints]);

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


  const getRoleClasses = (role?: string) => {
    switch (role as any) {
      case 'Phục vụ': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700';
      case 'Pha chế': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700';
      case 'Thu ngân': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700';
      case 'Quản lý': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-700';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600';
    }
  };

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
    undoStack.current.push(prev);
  }, []);

  const handleUndo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (prev) {
      setEditableConstraints(prev);
      toast.success('Đã hoàn tác thay đổi.');
    } else {
      toast.info('Không có hành động để hoàn tác.', { icon: 'ℹ️' });
    }
  }, []);

  const handleSaveConstraints = async () => {
    try {
      await updateStructuredConstraints(editableConstraints);
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
      toast.error(validationErrors[0]);
      return;
    }
    const r = runSchedule(shifts, allUsers, availability, editableConstraints, strategy === 'replace' ? 'replace' : 'merge');
    setResult(r);
    setEditableAssignments(r.assignments.map(a => ({ shiftId: a.shiftId, userId: a.userId, selected: true })));
    if (r.warnings.length) {
      toast.info('Có cảnh báo trong kết quả xếp lịch.', { icon: '⚠️' });
    }
  };

  const handleToggleAssignment = (shiftId: string, userId: string) => {
    setEditableAssignments(prev => prev.map(a => (a.shiftId === shiftId && a.userId === userId) ? { ...a, selected: !a.selected } : a));
  };

  const handleApply = () => {
    const selected = editableAssignments.filter(a => a.selected).map(a => ({ shiftId: a.shiftId, userId: a.userId }));
    if (selected.length === 0) {
      toast.error('Không có phân công nào được chọn để áp dụng.');
      return;
    }
    onApplyAssignments(selected, strategy);
    onClose();
  };

  

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="tracking-tight">Xếp lịch tự động</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">Thiết lập điều kiện và xem trước kết quả. Áp dụng phân công trực tiếp từ phần xem trước.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" onClick={handleSaveConstraints} aria-label="Lưu điều kiện">Lưu tất cả điều kiện</Button>
                </TooltipTrigger>
                <TooltipContent>Lưu các điều kiện xếp lịch hiện tại</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button variant="ghost" onClick={handleUndo} aria-label="Hoàn tác">Hoàn tác</Button>
          </div>
          <div className="flex items-center gap-3" />
        </div>
        <Tabs defaultValue="workload">
          <TabsList className="grid grid-cols-6">
            <TabsTrigger value="workload">Định mức</TabsTrigger>
            <TabsTrigger value="staffing">Nhu cầu ca</TabsTrigger>
            <TabsTrigger value="priority">Ưu tiên</TabsTrigger>
            <TabsTrigger value="links">Ràng buộc</TabsTrigger>
            <TabsTrigger value="availability">Thời gian rảnh</TabsTrigger>
            <TabsTrigger value="preview">Xem trước</TabsTrigger>
          </TabsList>
          <TabsContent value="workload" className="py-4 space-y-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <Label className="font-semibold">Giải thích chiến lược</Label>
                <p className="text-sm text-muted-foreground">Phân bổ tỉ lệ thuận với thời gian rảnh. Giới hạn Min/Max Ca và Giờ. Ưu tiên giới hạn riêng của nhân viên hơn giới hạn toàn cục.</p>
              </CardContent>
            </Card>
            {/* Global Workload */}
            <Card>
              <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Min Ca/tuần (Toàn cục)</Label>
                  <Input type="number" min={0} autoComplete="off" value={globalWorkload?.minShiftsPerWeek ?? ''} onChange={(e) => {
                    const val = parseInt(e.target.value || '0', 10);
                    setEditableConstraints(prev => {
                      const next = [...prev];
                      const idx = next.findIndex(c => c.type === 'WorkloadLimit' && (c as any).scope === 'global');
                      if (idx >= 0) (next[idx] as any).minShiftsPerWeek = val; else next.push({ id: 'wl_global', enabled: true, type: 'WorkloadLimit', scope: 'global', minShiftsPerWeek: val } as any);
                      return next;
                    });
                  }} />
                </div>
                <div>
                  <Label>Max Ca/tuần (Toàn cục)</Label>
                  <Input type="number" min={0} autoComplete="off" value={globalWorkload?.maxShiftsPerWeek ?? ''} onChange={(e) => {
                    const val = parseInt(e.target.value || '0', 10);
                    setEditableConstraints(prev => {
                      const next = [...prev];
                      const idx = next.findIndex(c => c.type === 'WorkloadLimit' && (c as any).scope === 'global');
                      if (idx >= 0) (next[idx] as any).maxShiftsPerWeek = val; else next.push({ id: 'wl_global', enabled: true, type: 'WorkloadLimit', scope: 'global', maxShiftsPerWeek: val } as any);
                      return next;
                    });
                  }} />
                </div>
                <div>
                  <Label>Min Giờ/tuần (Toàn cục)</Label>
                  <Input type="number" min={0} autoComplete="off" value={globalWorkload?.minHoursPerWeek ?? ''} onChange={(e) => {
                    const val = parseInt(e.target.value || '0', 10);
                    setEditableConstraints(prev => {
                      const next = [...prev];
                      const idx = next.findIndex(c => c.type === 'WorkloadLimit' && (c as any).scope === 'global');
                      if (idx >= 0) (next[idx] as any).minHoursPerWeek = val; else next.push({ id: 'wl_global', enabled: true, type: 'WorkloadLimit', scope: 'global', minHoursPerWeek: val } as any);
                      return next;
                    });
                  }} />
                </div>
                <div>
                  <Label>Max Giờ/tuần (Toàn cục)</Label>
                  <Input type="number" min={0} autoComplete="off" value={globalWorkload?.maxHoursPerWeek ?? ''} onChange={(e) => {
                    const val = parseInt(e.target.value || '0', 10);
                    setEditableConstraints(prev => {
                      const next = [...prev];
                      const idx = next.findIndex(c => c.type === 'WorkloadLimit' && (c as any).scope === 'global');
                      if (idx >= 0) (next[idx] as any).maxHoursPerWeek = val; else next.push({ id: 'wl_global', enabled: true, type: 'WorkloadLimit', scope: 'global', maxHoursPerWeek: val } as any);
                      return next;
                    });
                  }} />
                </div>
              </CardContent>
            </Card>
            {/* Specific Workload per user */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <Label className="font-semibold">Giới hạn theo nhân viên (Ưu tiên hơn toàn cục)</Label>
                <div className="flex items-center gap-2">
                  <UserMultiSelect
                    selectionMode="single"
                    users={allUsers.filter(u => !editableConstraints.some(c => c.type === 'WorkloadLimit' && (c as any).scope === 'user' && (c as any).userId === u.uid))}
                    selectedUsers={[]}
                    onChange={(users) => {
                      if (users.length === 0) return;
                      const uid = users[0].uid;
                      setEditableConstraints(prev => {
                        const exists = prev.some(c => c.type === 'WorkloadLimit' && (c as any).scope === 'user' && (c as any).userId === uid);
                        if (exists) return prev;
                        return [...prev, { id: `wl_${uid}`, enabled: true, type: 'WorkloadLimit', scope: 'user', userId: uid } as any];
                      });
                    }}
                  />
                  <Button variant="secondary">Thêm điều kiện</Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {editableConstraints.filter(c => c.type === 'WorkloadLimit' && (c as any).scope === 'user').map((c: any) => {
                    const u = allUsers.find(x => x.uid === c.userId);
                    if (!u) return null;
                    return (
                      <motion.div key={`wl_edit_${u.uid}`} className="border rounded-md p-3" layout initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold">{u.displayName}</p>
                          <Button variant="ghost" className="text-destructive" onClick={() => {
                            const prev = [...editableConstraints];
                            pushUndo(prev);
                            setEditableConstraints(prev => prev.filter(x => !(x.type === 'WorkloadLimit' && (x as any).scope === 'user' && (x as any).userId === u.uid)));
                          }}>Xóa điều kiện</Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="Min Ca" type="number" min={0} autoComplete="off" value={c.minShiftsPerWeek ?? ''} onChange={(e) => {
                            const val = parseInt(e.target.value || '0', 10);
                            setEditableConstraints(prev => prev.map(x => (x === c ? { ...c, minShiftsPerWeek: val } : x)));
                          }} />
                          <Input placeholder="Max Ca" type="number" min={0} autoComplete="off" value={c.maxShiftsPerWeek ?? ''} onChange={(e) => {
                            const val = parseInt(e.target.value || '0', 10);
                            setEditableConstraints(prev => prev.map(x => (x === c ? { ...c, maxShiftsPerWeek: val } : x)));
                          }} />
                          <Input placeholder="Min Giờ" type="number" min={0} autoComplete="off" value={c.minHoursPerWeek ?? ''} onChange={(e) => {
                            const val = parseInt(e.target.value || '0', 10);
                            setEditableConstraints(prev => prev.map(x => (x === c ? { ...c, minHoursPerWeek: val } : x)));
                          }} />
                          <Input placeholder="Max Giờ" type="number" min={0} autoComplete="off" value={c.maxHoursPerWeek ?? ''} onChange={(e) => {
                            const val = parseInt(e.target.value || '0', 10);
                            setEditableConstraints(prev => prev.map(x => (x === c ? { ...c, maxHoursPerWeek: val } : x)));
                          }} />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">Nếu không đặt điều kiện riêng cho một nhân viên, nhân viên đó chỉ áp dụng điều kiện toàn cục.</p>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="staffing" className="py-4 space-y-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <Label className="font-semibold">Nhu cầu theo ca</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {shiftTemplates.map(template => {
                    const entries = editableConstraints.filter(c => c.type === 'ShiftStaffing' && (c as any).templateId === template.id) as any[];
                    return (
                      <motion.div key={template.id} className="border rounded-md p-3" layout aria-label={`Khu vực ưu tiên cho ${template.label}`}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold">{template.label} ({template.timeSlot.start}-{template.timeSlot.end})</p>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              const newId = `ss_${template.id}_${Date.now()}`;
                              setEditableConstraints(prev => ([...prev, { id: newId, enabled: true, type: 'ShiftStaffing', templateId: template.id, role: 'Bất kỳ', count: 1 } as any]));
                            }}
                          >Thêm vai trò</Button>
                        </div>
                        {entries.length === 0 && (
                          <p className="text-xs text-muted-foreground mb-2">Chưa đặt nhu cầu vai trò. Sẽ dùng số tối thiểu từ mẫu ca.</p>
                        )}
                        <div className="space-y-2">
                          <AnimatePresence initial={false}>
                          {entries.map(entry => (
                            <motion.div key={entry.id} className="grid grid-cols-[1fr_120px_auto_auto] gap-2 items-center" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}>
                              <Select value={entry.role} onValueChange={(val) => {
                                setEditableConstraints(prev => prev.map(c => (c as any).id === entry.id ? { ...entry, role: val as UserRole | 'Bất kỳ' } : c));
                              }}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Bất kỳ">Bất kỳ</SelectItem>
                                  <SelectItem value="Phục vụ">Phục vụ</SelectItem>
                                  <SelectItem value="Pha chế">Pha chế</SelectItem>
                                  <SelectItem value="Thu ngân">Thu ngân</SelectItem>
                                  <SelectItem value="Quản lý">Quản lý</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input type="number" min={0} autoComplete="off" value={entry.count ?? 0} onChange={(e) => {
                                const val = parseInt(e.target.value || '0', 10);
                                setEditableConstraints(prev => prev.map(c => (c as any).id === entry.id ? { ...entry, count: val } : c));
                              }} />
                              <div className="flex items-center gap-2">
                                <Checkbox id={`mandatory_${entry.id}`} checked={!!entry.mandatory} onCheckedChange={(checked) => {
                                  setEditableConstraints(prev => prev.map(c => (c as any).id === entry.id ? { ...entry, mandatory: !!checked } : c));
                                }} />
                                <label htmlFor={`mandatory_${entry.id}`} className="text-xs">Bắt buộc</label>
                              </div>
                              <Button variant="ghost" className="justify-self-end" onClick={() => {
                                const prev = [...editableConstraints];
                                pushUndo(prev);
                                setEditableConstraints(prev => prev.filter(c => (c as any).id !== entry.id));
                              }}>Xóa</Button>
                            </motion.div>
                          ))}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="priority" className="py-4 space-y-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <Label className="font-semibold">Ưu tiên nhân viên cho ca</Label>
                
                <div className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_1fr_auto] gap-2 items-end">
                  <div>
                    <Label className="text-xs">Chọn mẫu ca</Label>
                    <Select value={newPriorityTemplateId} onValueChange={setNewPriorityTemplateId}>
                      <SelectTrigger><SelectValue placeholder="Chọn mẫu ca" /></SelectTrigger>
                      <SelectContent>
                        {shiftTemplates.map(t => (
                          <SelectItem key={`pr_t_${t.id}`} value={t.id}>{t.label} ({t.timeSlot.start}-{t.timeSlot.end})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Chọn nhân viên</Label>
                    <UserMultiSelect
                      selectionMode="single"
                      users={allUsers}
                      selectedUsers={newPriorityUserId ? allUsers.filter(u => u.uid === newPriorityUserId) : []}
                      onChange={(users) => {
                        if (users.length > 0) {
                          setNewPriorityUserId(users[0].uid);
                        } else {
                          setNewPriorityUserId('');
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Trọng số</Label>
                    <Select value={String(newPriorityWeight)} onValueChange={(v) => setNewPriorityWeight(parseInt(v, 10))}>
                      <SelectTrigger><SelectValue placeholder="Chọn trọng số" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0</SelectItem>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                        <SelectItem value="4">4</SelectItem>
                        <SelectItem value="5">5</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="priorityMandatory" checked={newPriorityMandatory} onCheckedChange={(checked) => setNewPriorityMandatory(!!checked)} />
                    <label htmlFor="priorityMandatory" className="text-xs">Bắt buộc</label>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (!newPriorityTemplateId || !newPriorityUserId) return;
                      const arr = [...editableConstraints];
                      const idx = arr.findIndex(c => c.type === 'StaffPriority' && (c as any).templateId === newPriorityTemplateId && (c as any).userId === newPriorityUserId);
                      const prev = [...editableConstraints];
                      if (idx >= 0) {
                        (arr[idx] as any).weight = newPriorityWeight;
                        (arr[idx] as any).mandatory = newPriorityMandatory;
                      } else {
                        arr.push({ id: `sp_${newPriorityTemplateId}_${newPriorityUserId}`, enabled: true, type: 'StaffPriority', templateId: newPriorityTemplateId, userId: newPriorityUserId, weight: newPriorityWeight, mandatory: newPriorityMandatory } as any);
                      }
                      pushUndo(prev);
                      setEditableConstraints(arr);
                      setNewPriorityWeight(1);
                      setNewPriorityMandatory(false);
                    }}
                  >Thêm ưu tiên</Button>
                </div>
                <div className="mt-3 space-y-2">
                  <Label className="text-xs">Các ưu tiên hiện tại</Label>
                  <ScrollArea className="h-[240px]" onScrollCapture={(e) => setPriorityScrollTop((e.target as HTMLDivElement).scrollTop)}>
                    <div className="grid grid-cols-1 gap-2">
                      <AnimatePresence initial={false}>
                        {(() => {
                          const items = editableConstraints.filter(c => c.type === 'StaffPriority') as any[];
                          const total = items.length;
                          const start = Math.max(0, Math.floor(priorityScrollTop / 56) - 2);
                          const visibleCount = Math.ceil(240 / 56) + 4;
                          const end = Math.min(total, start + visibleCount);
                          const topSpacer = start * 56;
                          const bottomSpacer = Math.max(0, (total - end) * 56);
                          const slice = items.slice(start, end);
                          return (
                            <>
                              <div style={{ height: topSpacer }} />
                              {slice.map((c: any) => {
                                const t = shiftTemplates.find(t => t.id === c.templateId);
                                const u = allUsers.find(u => u.uid === c.userId);
                                return (
                                  <motion.div key={`pr_row_${c.id}`} className="flex items-center justify-between border rounded-md p-2" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}>
                                    <div className="text-sm">
                                      <span className="font-semibold">{u?.displayName || c.userId}</span>
                                      <span className="mx-2">→</span>
                                      <span>{t?.label || c.templateId}</span>
                                      <span className="ml-2 text-muted-foreground">w={c.weight ?? 0}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Select value={String(c.weight ?? 0)} onValueChange={(v) => {
                                        const next = editableConstraints.map(x => x === c ? { ...c, weight: parseInt(v, 10) } as any : x);
                                        setEditableConstraints(next);
                                      }}>
                                        <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="0">0</SelectItem>
                                          <SelectItem value="1">1</SelectItem>
                                          <SelectItem value="2">2</SelectItem>
                                          <SelectItem value="3">3</SelectItem>
                                          <SelectItem value="4">4</SelectItem>
                                          <SelectItem value="5">5</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <div className="flex items-center gap-2">
                                        <Checkbox id={`pr_mand_${c.id}`} checked={!!c.mandatory} onCheckedChange={(checked) => {
                                          const next = editableConstraints.map(x => x === c ? { ...c, mandatory: !!checked } as any : x);
                                          setEditableConstraints(next);
                                        }} />
                                        <label htmlFor={`pr_mand_${c.id}`} className="text-xs">Bắt buộc</label>
                                      </div>
                                      <Button variant="ghost" onClick={() => {
                                        const prev = [...editableConstraints];
                                        const next = editableConstraints.filter(x => x !== c);
                                        pushUndo(prev);
                                        setEditableConstraints(next);
                                      }}>Xóa</Button>
                                    </div>
                                  </motion.div>
                                );
                              })}
                              <div style={{ height: bottomSpacer }} />
                            </>
                          );
                        })()}
                        {editableConstraints.filter(c => c.type === 'StaffPriority').length === 0 && (
                          <p className="text-xs text-muted-foreground">Chưa có ưu tiên nào.</p>
                        )}
                      </AnimatePresence>
                    </div>
                  </ScrollArea>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!newPriorityTemplateId || !newPriorityUserId) return;
                      const next = editableConstraints.filter(c => !(c.type === 'StaffPriority' && (c as any).templateId === newPriorityTemplateId && (c as any).userId === newPriorityUserId));
                      setEditableConstraints(next);
                    }}
                  >Xóa ưu tiên</Button>
                  <p className="text-xs text-muted-foreground">Dùng chọn Mẫu ca + Nhân viên để thêm hoặc xóa ưu tiên.</p>
                  
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="links" className="py-4 space-y-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <Label className="font-semibold">Ràng buộc nhân viên↔mẫu ca</Label>
                
                <div className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_1fr_auto] gap-2 items-end">
                  <div>
                    <Label className="text-xs">Chọn mẫu ca</Label>
                    <Select value={(linksForm.templateId ?? '') as string} onValueChange={(v) => setLinksForm(prev => ({ ...prev, templateId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Chọn mẫu ca" /></SelectTrigger>
                      <SelectContent>
                        {shiftTemplates.map(t => (
                          <SelectItem key={`ln_t_${t.id}`} value={t.id}>{t.label} ({t.timeSlot.start}-{t.timeSlot.end})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Chọn nhân viên</Label>
                    <UserMultiSelect
                      selectionMode="single"
                      users={allUsers}
                      selectedUsers={linksForm.userId ? allUsers.filter(u => u.uid === linksForm.userId) : []}
                      onChange={(users) => {
                        if (users.length > 0) {
                          setLinksForm(prev => ({ ...prev, userId: users[0].uid }));
                        } else {
                          setLinksForm(prev => ({ ...prev, userId: undefined }));
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Loại ràng buộc</Label>
                    <Select value={(linksForm.link ?? 'force') as string} onValueChange={(v) => setLinksForm(prev => ({ ...prev, link: v as any }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="force">Bắt buộc</SelectItem>
                        <SelectItem value="ban">Cấm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (!linksForm.templateId || !linksForm.userId) return;
                      const prev = [...editableConstraints];
                      const arr = editableConstraints.filter(c => !(c.type === 'StaffShiftLink' && (c as any).templateId === linksForm.templateId && (c as any).userId === linksForm.userId));
                      arr.push({ id: `ln_${linksForm.templateId}_${linksForm.userId}`, enabled: true, type: 'StaffShiftLink', templateId: linksForm.templateId, userId: linksForm.userId, link: (linksForm.link ?? 'force') } as any);
                      pushUndo(prev);
                      setEditableConstraints(arr);
                    }}
                  >Thêm ràng buộc</Button>
                </div>
                <div className="mt-3 space-y-2">
                  <Label className="text-xs">Các ràng buộc hiện tại</Label>
                  <ScrollArea className="h-[240px]" onScrollCapture={(e) => setLinksScrollTop((e.target as HTMLDivElement).scrollTop)}>
                    <div className="grid grid-cols-1 gap-2">
                      <AnimatePresence initial={false}>
                        {(() => {
                          const items = editableConstraints.filter(c => c.type === 'StaffShiftLink') as any[];
                          const total = items.length;
                          const start = Math.max(0, Math.floor(linksScrollTop / 56) - 2);
                          const visibleCount = Math.ceil(240 / 56) + 4;
                          const end = Math.min(total, start + visibleCount);
                          const topSpacer = start * 56;
                          const bottomSpacer = Math.max(0, (total - end) * 56);
                          const slice = items.slice(start, end);
                          return (
                            <>
                              <div style={{ height: topSpacer }} />
                              {slice.map((c: any) => {
                                const t = shiftTemplates.find(t => t.id === c.templateId);
                                const u = allUsers.find(u => u.uid === c.userId);
                                return (
                                  <motion.div key={`ln_row_${c.id}`} className="flex items-center justify-between border rounded-md p-2" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}>
                                    <div className="text-sm">
                                      <span className="font-semibold">{u?.displayName || c.userId}</span>
                                      <span className="mx-2">↔</span>
                                      <span>{t?.label || c.templateId}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Select value={c.link} onValueChange={(v) => {
                                        const next = editableConstraints.map(x => x === c ? { ...c, link: v as any } as any : x);
                                        setEditableConstraints(next);
                                      }}>
                                        <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="force">Bắt buộc</SelectItem>
                                          <SelectItem value="ban">Cấm</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Button variant="ghost" onClick={() => {
                                        const prev = [...editableConstraints];
                                        const next = editableConstraints.filter(x => x !== c);
                                        pushUndo(prev);
                                        setEditableConstraints(next);
                                      }}>Xóa</Button>
                                    </div>
                                  </motion.div>
                                );
                              })}
                              <div style={{ height: bottomSpacer }} />
                            </>
                          );
                        })()}
                        {editableConstraints.filter(c => c.type === 'StaffShiftLink').length === 0 && (
                          <p className="text-xs text-muted-foreground">Chưa có ràng buộc nào.</p>
                        )}
                      </AnimatePresence>
                    </div>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
            
          </TabsContent>
          <TabsContent value="availability" className="py-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground mb-2">Đọc từ đăng ký của nhân viên (chỉ xem).</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[35%] text-center">Ngày</TableHead>
                      <TableHead className="text-center">Khung giờ rảnh</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(groupAvailabilityByDate(availability)).map(([dateKey, list]) => (
                      <TableRow key={dateKey}>
                        <TableCell className="font-semibold text-center">{format(new Date(dateKey), 'eeee, dd/MM', { locale: vi })}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-wrap gap-2 justify-center">
                            {list.map(rec => (
                              <Badge key={rec.userId} variant="outline">{rec.userName}: {rec.availableSlots.map(s => `${s.start}-${s.end}`).join(', ') || '—'}</Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="preview" className="py-4 space-y-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={handleRun}>Run Auto Schedule</Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label>Chiến lược áp dụng</Label>
                    <Select value={strategy} onValueChange={(v) => setStrategy(v as 'merge' | 'replace')}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="merge">Merge</SelectItem>
                        <SelectItem value="replace">Replace All</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {result ? (
                  <div className="space-y-3">
                    {result.warnings.length > 0 && (
                      <div className="text-sm text-yellow-600 dark:text-yellow-400">{result.warnings.join(' • ')}</div>
                    )}
                    {validationErrors.length > 0 && (
                      <div className="text-sm text-destructive">{validationErrors.join(' • ')}</div>
                    )}
                    {/* Summary stats */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">Đề xuất: {editableAssignments.filter(a => a.selected).length}</Badge>
                      <Badge variant="outline">Unfilled: {result.unfilled.reduce((acc, u) => acc + (u.remaining || 0), 0)}</Badge>
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
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[20%] whitespace-nowrap">Ngày</TableHead>
                          <TableHead>Ca</TableHead>
                          <TableHead>Phân công đề xuất</TableHead>
                          <TableHead>Thiếu</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <AnimatePresence initial={false}>
                        {shifts.map((shift, idx) => {
                          const dayAssignments = editableAssignments.filter(a => a.shiftId === shift.id);
                          const unfilled = result.unfilled.find(u => u.shiftId === shift.id)?.remaining || 0;
                          const dateKey = format(new Date(shift.date), 'yyyy-MM-dd');
                          const isFirstOfDay = idx === 0 || format(new Date(shifts[idx - 1].date), 'yyyy-MM-dd') !== dateKey;
                          const isLastOfDay = idx === shifts.length - 1 || format(new Date(shifts[idx + 1]?.date || shift.date), 'yyyy-MM-dd') !== dateKey;
                          return (
                            <React.Fragment key={`grp_${shift.id}`}>
                            <motion.tr key={shift.id} className={cn(unfilled > 0 && 'bg-destructive/10')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                              {isFirstOfDay && (
                                <TableCell rowSpan={dateRowSpanMap[dateKey]} className="font-semibold whitespace-nowrap w-[20%] border-l-4 border-primary bg-muted/20">
                                  {format(new Date(shift.date), 'eee, dd/MM', { locale: vi })}
                                </TableCell>
                              )}
                              <TableCell>{shift.label} ({shift.timeSlot.start}-{shift.timeSlot.end})</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-2">
                                  {dayAssignments.length === 0 ? <span className="text-muted-foreground">—</span> : dayAssignments.map(a => {
                                    const userName = allUsers.find(u => u.uid === a.userId)?.displayName || a.userId;
                                    const role = roleByUserId.get(a.userId);
                                    const roleCls = getRoleClasses(role);
                                    const availSlots = availabilityMap.get(`${a.userId}:${dateKey}`) || [];
                                    const dayCount = dayUserShiftCounts.get(`${a.userId}:${dateKey}`) || 0;
                                    return (
                                      <TooltipProvider key={`tt_${a.shiftId}_${a.userId}`}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <motion.button onClick={() => handleToggleAssignment(a.shiftId, a.userId)} className={cn('rounded-md px-2 py-1 text-xs font-medium border', roleCls, a.selected ? 'ring-2 ring-primary' : 'opacity-90')} initial={{ scale: 0.98 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} aria-pressed={a.selected} aria-label={`Chọn ${userName}`}>
                                              {userName}
                                              {dayCount >= 2 && (
                                                <span className="ml-1 text-[10px] font-semibold text-yellow-600 dark:text-yellow-400">×{dayCount}</span>
                                              )}
                                            </motion.button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <div className="space-y-1">
                                              <div className="text-xs">Vai trò: {role || 'Bất kỳ'}</div>
                                              <div className="text-xs">Rảnh: {availSlots.length ? availSlots.join(', ') : 'Không có'}</div>
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    );
                                  })}
                                </div>
                              </TableCell>
                              <TableCell>{unfilled > 0 ? unfilled : '0'}</TableCell>
                            </motion.tr>
                            {isLastOfDay && (
                              <TableRow key={`sep_${dateKey}_${idx}`}>
                                <TableCell colSpan={4} className="p-0">
                                  <div className="h-[6px] bg-muted rounded-md" />
                                </TableCell>
                              </TableRow>
                            )}
                            </React.Fragment>
                          )
                        })}
                        </AnimatePresence>
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Chạy xếp lịch để xem đề xuất.</p>
                )}
              </CardContent>
            </Card>
            {result && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <Label className="font-semibold">Tổng kết giờ làm theo tuần</Label>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nhân viên</TableHead>
                        <TableHead className="text-center">Giờ dự kiến</TableHead>
                        <TableHead className="text-center">Giờ rảnh khai báo</TableHead>
                        <TableHead className="text-center">Chênh lệch</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...scheduledHoursByUser.keys()].sort().map(uid => {
                        const u = allUsers.find(x => x.uid === uid);
                        const sched = scheduledHoursByUser.get(uid) || 0;
                        const avail = availableHoursByUser.get(uid) || 0;
                        const diff = sched - avail;
                        const exceed = diff > 0.0001;
                        return (
                          <TableRow key={`sum_${uid}`} className={cn(exceed && 'bg-destructive/10')}> 
                            <TableCell className="font-medium">{u?.displayName || uid}</TableCell>
                            <TableCell className="text-center">{sched.toFixed(1)}h</TableCell>
                            <TableCell className="text-center">{avail.toFixed(1)}h</TableCell>
                            <TableCell className={cn('text-center', exceed ? 'text-destructive font-semibold' : 'text-muted-foreground')}>{(diff >= 0 ? '+' : '') + diff.toFixed(1)}h</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <div className="text-xs text-muted-foreground">Tô màu đỏ khi giờ dự kiến vượt quá giờ rảnh khai báo.</div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Đóng</Button>
          <Button onClick={handleApply} disabled={!result}>Apply Assignments</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function groupAvailabilityByDate(availability: Availability[]): Record<string, Availability[]> {
  const grouped: Record<string, Availability[]> = {};
  for (const a of availability) {
    const dateKey = typeof a.date === 'string' ? a.date : format(a.date.toDate(), 'yyyy-MM-dd');
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(a);
  }
  return grouped;
}

function validateConstraints(constraints: ScheduleCondition[]): string[] {
  const errors: string[] = [];
  // min <= max checks for workload
  const workloads = constraints.filter(c => c.type === 'WorkloadLimit');
  for (const wl of workloads as any[]) {
    const minS = wl.minShiftsPerWeek ?? 0;
    const maxS = wl.maxShiftsPerWeek ?? Number.POSITIVE_INFINITY;
    const minH = wl.minHoursPerWeek ?? 0;
    const maxH = wl.maxHoursPerWeek ?? Number.POSITIVE_INFINITY;
    if (minS > maxS) errors.push(`Giới hạn ca không hợp lệ: Min(${minS}) > Max(${maxS}).`);
    if (minH > maxH) errors.push(`Giới hạn giờ không hợp lệ: Min(${minH}) > Max(${maxH}).`);
  }
  // conflicting links
  const links = constraints.filter(c => c.type === 'StaffShiftLink') as any[];
  const seen = new Map<string, string>();
  for (const ln of links) {
    const key = `${ln.userId}:${ln.templateId}`;
    const prev = seen.get(key);
    if (prev && prev !== ln.link) {
      errors.push(`Xung đột ràng buộc cho nhân viên ${ln.userId} và mẫu ca ${ln.templateId}.`);
    } else {
      seen.set(key, ln.link);
    }
  }
  return errors;
}
