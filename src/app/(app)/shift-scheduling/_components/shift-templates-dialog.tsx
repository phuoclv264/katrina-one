
'use client';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
  DialogAction,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, Edit, Loader2, Check, Users, Clock, Calendar, Briefcase, UserPlus, X, LayoutGrid } from 'lucide-react';
import type { ShiftTemplate, UserRole } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { toast } from '@/components/ui/pro-toast';
import { Combobox } from '@/components/combobox';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const weekDays = [
  { label: 'T2', value: 1 }, { label: 'T3', value: 2 }, { label: 'T4', value: 3 },
  { label: 'T5', value: 4 }, { label: 'T6', value: 5 }, { label: 'T7', value: 6 },
  { label: 'CN', value: 0 }
];

export default function ShiftTemplatesDialog({ isOpen, onClose, parentDialogTag }: { isOpen: boolean, onClose: () => void, parentDialogTag: string }) {
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [currentTemplate, setCurrentTemplate] = useState<Partial<ShiftTemplate>>({});

  useEffect(() => {
    if (isOpen) {
      const unsub = dataStore.subscribeToShiftTemplates((data) => {
        const sortedData = data.sort((a, b) => a.timeSlot.start.localeCompare(b.timeSlot.start));
        setTemplates(sortedData);
        setIsLoading(false);
      });
      return () => unsub();
    }
  }, [isOpen]);

  const handleAddNew = () => {
    const newTemplate: ShiftTemplate = {
      id: `template_${Date.now()}`,
      label: 'Ca làm việc mới',
      role: 'Bất kỳ' as const,
      timeSlot: { start: '08:00', end: '12:00' },
      applicableDays: [1, 2, 3, 4, 5, 6, 0], // Default to all days
      minUsers: 0,
    };
    setIsEditing(newTemplate.id);
    setCurrentTemplate(newTemplate);
    setTemplates(prev => {
      // Avoid duplicates if clicked multiple times fast
      if (prev.find(t => t.id === newTemplate.id)) return prev;
      return [...prev, newTemplate].sort((a, b) => a.timeSlot.start.localeCompare(b.timeSlot.start));
    });
  };

  const handleSave = async () => {
    if (!currentTemplate.id) return;

    // Basic validation
    if (!currentTemplate.label || !currentTemplate.timeSlot?.start || !currentTemplate.timeSlot?.end) {
      toast.error('Vui lòng nhập đầy đủ thông tin ca mẫu.');
      return;
    }

    const finalTemplates = templates.map(t => t.id === currentTemplate.id ? currentTemplate as ShiftTemplate : t);

    try {
      await dataStore.updateShiftTemplates(finalTemplates);
      toast.success('Đã cập nhật danh sách ca mẫu.');
      setIsEditing(null);
      setCurrentTemplate({});
    } catch (error) {
      toast.error('Không thể lưu ca mẫu.');
    }
  }

  const handleCancelEdit = () => {
    // If it was a new unsaved template (label is default and ID is not in DB-like state), remove it
    // More robust check: check if label is 'Ca làm việc mới' AND it's not present in the original list from DB
    // But since we sort and update local state, let's just check if it's the one we just added
    if (currentTemplate.label === 'Ca làm việc mới') {
      setTemplates(prev => prev.filter(t => t.id !== currentTemplate.id));
    }
    setIsEditing(null);
    setCurrentTemplate({});
  }

  const handleDelete = async (id: string) => {
    const finalTemplates = templates.filter(t => t.id !== id);
    try {
      await dataStore.updateShiftTemplates(finalTemplates);
      toast.success('Đã xóa ca làm việc mẫu.');
    } catch (error) {
      toast.error('Không thể xóa ca mẫu.');
    }
  }

  const handleFieldChange = (field: keyof ShiftTemplate, value: any) => {
    setCurrentTemplate(prev => ({ ...prev, [field]: value }));
  }

  const handleAddRequiredRole = () => {
    setCurrentTemplate(prev => ({
      ...prev,
      requiredRoles: [...(prev.requiredRoles || []), { role: 'Phục vụ' as UserRole, count: 1 }]
    }));
  }

  const handleRemoveRequiredRole = (index: number) => {
    setCurrentTemplate(prev => ({
      ...prev,
      requiredRoles: (prev.requiredRoles || []).filter((_, i) => i !== index)
    }));
  }

  const handleRequiredRoleChange = (index: number, key: 'role' | 'count', value: any) => {
    setCurrentTemplate(prev => ({
      ...prev,
      requiredRoles: (prev.requiredRoles || []).map((r, i) => i === index ? { ...r, [key]: key === 'count' ? Number(value) : value } : r)
    }));
  }

  const handleTimeChange = (field: 'start' | 'end', value: string) => {
    setCurrentTemplate(prev => ({
      ...prev,
      timeSlot: {
        ...(prev.timeSlot || { start: '', end: '' }),
        [field]: value
      }
    }));
  }

  const handleApplicableDaysChange = (days: string[]) => {
    handleFieldChange('applicableDays', days.map(Number));
  }


  return (
    <Dialog open={isOpen} onOpenChange={onClose} dialogTag="shift-templates-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-2xl">
        <DialogHeader iconkey="layout">
          <DialogTitle>Mẫu ca làm việc</DialogTitle>
          <DialogDescription>
            Thiết lập các ca chuẩn để tối ưu hóa quy trình xếp lịch hàng tuần.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="px-4 sm:px-6 space-y-4 sm:space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-150 animate-pulse" />
                <Loader2 className="h-10 w-10 animate-spin text-primary relative z-10" />
              </div>
              <p className="text-sm font-black uppercase tracking-widest text-primary animate-pulse">Đang tải dữ liệu...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {templates.length === 0 ? (
                  <div className="text-center py-12 bg-muted/20 border-2 border-dashed border-primary/5 rounded-[2.5rem] space-y-3">
                    <div className="w-12 h-12 bg-background rounded-2xl flex items-center justify-center border border-primary/10 shadow-sm mx-auto opacity-40">
                      <LayoutGrid className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-muted-foreground uppercase tracking-tight">Chưa có ca mẫu nào</p>
                      <p className="text-[10px] text-muted-foreground/60 font-black uppercase tracking-widest mt-1">Vui lòng thêm ca làm việc mẫu đầu tiên</p>
                    </div>
                  </div>
                ) : (
                  templates.map(template => {
                    const isCurrentEditing = isEditing === template.id;
                    const item = isCurrentEditing ? currentTemplate : template;
                    
                    return (
                      <motion.div
                        key={template.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "relative transition-all duration-300 rounded-[1.5rem] sm:rounded-[2rem]",
                          isCurrentEditing 
                            ? "bg-background border-2 border-primary/20 shadow-xl p-4 sm:p-6 ring-4 ring-primary/5" 
                            : "bg-primary/[0.03] border border-primary/5 hover:border-primary/10 p-3 sm:p-4 hover:shadow-md"
                        )}
                      >
                        {isCurrentEditing ? (
                          <div className="space-y-4 sm:space-y-5">
                            <div className="flex items-center justify-between mb-1">
                              <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-none px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                Đang chỉnh sửa
                              </Badge>
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-destructive/10 text-destructive" onClick={handleCancelEdit}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                              <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-3">Tên ca làm việc</Label>
                                <Input 
                                  value={item.label} 
                                  onChange={(e) => handleFieldChange('label', e.target.value)} 
                                  placeholder="Ví dụ: Ca Sáng, Ca Gãy..." 
                                  className="h-10 sm:h-11 rounded-xl sm:rounded-2xl bg-muted/30 border-none focus-visible:ring-primary/20 px-4 font-medium"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-3">Vai trò áp dụng</Label>
                                <Combobox
                                  value={item.role}
                                  onChange={(val) => handleFieldChange('role', val as UserRole | 'Bất kỳ')}
                                  options={[
                                    { value: "Bất kỳ", label: "Bất kỳ" },
                                    { value: "Phục vụ", label: "Phục vụ" },
                                    { value: "Pha chế", label: "Pha chế" },
                                    { value: "Quản lý", label: "Quản lý" },
                                  ]}
                                  compact
                                  searchable={false}
                                  className="w-full"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 border-t border-primary/5 pt-4">
                              <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-3">Khung giờ hoạt động</Label>
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                  <Input 
                                    type="time" 
                                    value={item.timeSlot?.start} 
                                    onChange={(e) => handleTimeChange('start', e.target.value)} 
                                    className="h-10 sm:h-11 rounded-xl sm:rounded-2xl bg-muted/30 border-none focus-visible:ring-primary/20 px-2 sm:px-4 text-center font-bold text-xs sm:text-sm"
                                  />
                                  <span className="text-muted-foreground font-black text-xs">→</span>
                                  <Input 
                                    type="time" 
                                    value={item.timeSlot?.end} 
                                    onChange={(e) => handleTimeChange('end', e.target.value)} 
                                    className="h-10 sm:h-11 rounded-xl sm:rounded-2xl bg-muted/30 border-none focus-visible:ring-primary/20 px-2 sm:px-4 text-center font-bold text-xs sm:text-sm"
                                  />
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-3">Nhân sự tối thiểu</Label>
                                <div className="relative">
                                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground/50" />
                                  <Input 
                                    type="number" 
                                    value={item.minUsers ?? 0} 
                                    onChange={(e) => handleFieldChange('minUsers', parseInt(e.target.value, 10) || 0)} 
                                    min="0" 
                                    className="h-10 sm:h-11 rounded-xl sm:rounded-2xl bg-muted/30 border-none focus-visible:ring-primary/20 pl-11 pr-4 font-bold"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2.5 border-t border-primary/5 pt-4">
                              <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-3">Ngày áp dụng trong tuần</Label>
                              <ToggleGroup
                                type="multiple"
                                variant="outline"
                                className="flex flex-wrap gap-1.5 sm:gap-2"
                                value={item.applicableDays?.map(String) || []}
                                onValueChange={handleApplicableDaysChange}
                              >
                                {weekDays.map(day => (
                                  <ToggleGroupItem 
                                    key={day.value} 
                                    value={String(day.value)} 
                                    className="h-9 w-9 sm:h-11 sm:w-11 rounded-lg sm:rounded-xl border-primary/5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground font-black text-[10px] sm:text-xs transition-all"
                                  >
                                    {day.label}
                                  </ToggleGroupItem>
                                ))}
                              </ToggleGroup>
                            </div>

                            <div className="space-y-3 border-t border-primary/5 pt-4">
                              <div className="flex items-center justify-between ml-2">
                                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Yêu cầu nhân sự cụ thể</Label>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={handleAddRequiredRole}
                                  className="h-7 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 rounded-lg"
                                >
                                  <Plus className="mr-1 h-3 w-3" /> Thêm vai trò
                                </Button>
                              </div>
                              
                              <div className="space-y-2">
                                {(item.requiredRoles || []).map((req, idx) => (
                                  <motion.div 
                                    key={idx} 
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-muted/20 rounded-xl sm:rounded-2xl border border-primary/5"
                                  >
                                    <Combobox
                                      value={req.role}
                                      onChange={(val) => handleRequiredRoleChange(idx, 'role', val)}
                                      options={[
                                        { value: 'Phục vụ', label: 'Phục vụ' },
                                        { value: 'Pha chế', label: 'Pha chế' },
                                        { value: 'Thu ngân', label: 'Thu ngân' },
                                        { value: 'Quản lý', label: 'Quản lý' },
                                      ]}
                                      compact
                                      searchable={false}
                                      className="flex-1 min-w-[100px]"
                                    />
                                    <div className="relative w-16 sm:w-20">
                                       <Input 
                                         type="number" 
                                         min={0} 
                                         value={req.count} 
                                         onChange={(e) => handleRequiredRoleChange(idx, 'count', e.target.value)} 
                                         className="h-9 rounded-lg sm:h-10 sm:rounded-xl bg-background border-primary/10 pr-1 pl-6 sm:pl-7 font-bold text-center text-xs"
                                       />
                                       <UserPlus className="absolute left-1.5 sm:left-2 top-1/2 -translate-y-1/2 h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground/40" />
                                    </div>
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="h-9 w-9 sm:h-10 sm:w-10 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/5 rounded-lg sm:rounded-xl transition-colors" 
                                      onClick={() => handleRemoveRequiredRole(idx)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </motion.div>
                                ))}
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-primary/5">
                              <Button variant="ghost" className="h-11 sm:h-12 rounded-xl sm:rounded-2xl font-bold text-muted-foreground hover:bg-muted/50 order-2 sm:order-1" onClick={handleCancelEdit}>Hủy bỏ</Button>
                              <Button className="h-11 sm:h-12 rounded-xl sm:rounded-2xl font-bold bg-primary text-primary-foreground hover:shadow-lg hover:shadow-primary/20 transition-all order-1 sm:order-2" onClick={handleSave}>
                                <Check className="mr-2 h-4 w-4" /> Lưu ca mẫu
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h4 className="font-black text-sm uppercase tracking-tight text-foreground">{template.label}</h4>
                                <Badge className="bg-primary/5 text-primary border-none text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg">
                                  {template.role}
                                </Badge>
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-medium text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="h-3.5 w-3.5 text-primary/40" />
                                  <span className="font-bold text-foreground/80">{template.timeSlot.start} — {template.timeSlot.end}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Users className="h-3.5 w-3.5 text-primary/40" />
                                  <span>Tối thiểu: <span className="font-bold text-foreground/80">{template.minUsers ?? 0}</span></span>
                                </div>
                              </div>

                              {template.requiredRoles && template.requiredRoles.length > 0 && (
                                <div className="mt-2.5 flex flex-wrap gap-1.5">
                                  {template.requiredRoles.map((r, i) => (
                                    <div key={i} className="flex items-center gap-1 px-2 py-0.5 bg-background border border-primary/5 rounded-lg text-[9px] font-bold text-muted-foreground">
                                      <Briefcase className="h-2.5 w-2.5" />
                                      {r.count}× {r.role}
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="flex items-center gap-1 mt-3">
                                {weekDays.map(day => (
                                  <div 
                                    key={day.value} 
                                    className={cn(
                                      "h-6 w-6 rounded-lg flex items-center justify-center text-[9px] font-black tracking-tighter transition-all",
                                      (template.applicableDays || []).includes(day.value) 
                                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" 
                                        : "bg-muted/50 text-muted-foreground/40 border border-transparent"
                                    )}
                                  >
                                    {day.label}
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="flex sm:flex-col gap-2 shrink-0 border-t sm:border-t-0 sm:border-l border-primary/5 pt-3 sm:pt-0 sm:pl-4">
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-10 w-10 rounded-xl hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all active:scale-95" 
                                onClick={() => { setIsEditing(template.id); setCurrentTemplate(template); }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-10 w-10 rounded-xl hover:bg-destructive/5 text-muted-foreground hover:text-destructive transition-all active:scale-95" 
                                onClick={() => handleDelete(template.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          )}
        </DialogBody>

        <DialogFooter className="border-t border-primary/5 flex-col sm:flex-row gap-2 sm:gap-3">
          <Button 
            variant="outline" 
            className="rounded-xl sm:rounded-2xl h-11 sm:h-12 px-4 sm:px-6 font-bold border-primary/10 hover:bg-primary/5 text-primary w-full sm:w-auto uppercase tracking-widest text-[10px] sm:text-[11px]" 
            onClick={handleAddNew}
            disabled={!!isEditing}
          >
            <Plus className="mr-1.5 sm:mr-2 h-3.5 sm:h-4 w-3.5 sm:w-4" />
            Thêm ca mẫu
          </Button>
          <DialogAction onClick={onClose} className="w-full sm:w-auto uppercase tracking-widest text-[10px] sm:text-[11px] h-11 sm:h-12">
            Hoàn tất
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
