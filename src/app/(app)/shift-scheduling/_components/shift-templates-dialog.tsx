
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

  const handleRequiredRoleChange = (index: number, key: 'role' | 'count' | 'gender', value: any) => {
    setCurrentTemplate(prev => ({
      ...prev,
      requiredRoles: (prev.requiredRoles || []).map((r, i) => i === index ? { ...r, [key]: key === 'count' ? Number(value) : (key === 'gender' && value === 'Bất kỳ' ? undefined : value) } : r)
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
      <DialogContent className="max-w-2xl lg:max-w-2xl">
        <DialogHeader variant="premium" iconkey="layout">
          <DialogTitle>Mẫu ca làm việc</DialogTitle>
          <DialogDescription className="text-muted-foreground/60 text-[10px] font-black uppercase tracking-[0.2em]">
            Thiết lập các ca chuẩn để tối ưu hóa quy trình xếp lịch hàng tuần.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="px-2 sm:px-6 space-y-4 sm:space-y-6 pt-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-150 animate-pulse" />
                <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-black uppercase tracking-[0.3em] text-primary animate-pulse">Đang đồng bộ dữ liệu</p>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-50">Vui lòng đợi trong giây lát...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              <AnimatePresence initial={false} mode="popLayout">
                {templates.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-16 bg-primary/[0.02] border-2 border-dashed border-primary/10 rounded-[2.5rem] space-y-4 overflow-hidden relative"
                  >
                    <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
                    
                    <div className="w-16 h-16 bg-background rounded-2xl flex items-center justify-center border border-primary/10 shadow-xl mx-auto relative z-10">
                      <LayoutGrid className="h-8 w-8 text-primary/40" />
                    </div>
                    <div className="relative z-10">
                      <p className="font-black text-sm text-foreground uppercase tracking-widest">Hệ thống chưa có ca mẫu</p>
                      <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-[0.15em] mt-1 px-8">
                        Bắt đầu bằng cách thêm một ca làm việc chuẩn để tiết kiệm thời gian xếp lịch sau này.
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={handleAddNew}
                      className="rounded-xl font-black uppercase tracking-widest text-[10px] h-9 border-primary/20 hover:bg-primary hover:text-primary-foreground transition-all relative z-10"
                    >
                      <Plus className="mr-2 h-3 w-3" /> Tạo ca mẫu đầu tiên
                    </Button>
                  </motion.div>
                ) : (
                  templates.map(template => {
                    const isCurrentEditing = isEditing === template.id;
                    const item = isCurrentEditing ? currentTemplate : template;
                    
                    return (
                      <motion.div
                        key={template.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={cn(
                          "relative transition-all duration-500 overflow-hidden",
                          isCurrentEditing 
                            ? "bg-background border-2 border-primary/30 shadow-2xl rounded-[2rem] p-4 sm:p-7 ring-8 ring-primary/5 my-4 z-20" 
                            : "bg-primary/[0.04] border border-primary/10 hover:border-primary/20 rounded-[1.8rem] p-4 sm:p-5 hover:shadow-xl hover:bg-background group active:scale-[0.99] transition-transform"
                        )}
                      >
                        {isCurrentEditing ? (
                          <div className="space-y-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                                  <Edit className="h-5 w-5 text-primary" />
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Chế độ chỉnh sửa</p>
                                  <h4 className="font-bold text-sm tracking-tight">{item.label || "Tên ca chưa đặt"}</h4>
                                </div>
                              </div>
                              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-destructive/10 text-destructive/60 hover:text-destructive" onClick={handleCancelEdit}>
                                <X className="h-5 w-5" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/60 ml-2 flex items-center gap-2">
                                  <div className="w-1 h-1 rounded-full bg-primary" /> Tên ca làm việc
                                </Label>
                                <div className="relative">
                                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground/30">
                                    <Clock className="h-4 w-4" />
                                  </div>
                                  <Input 
                                    value={item.label} 
                                    onChange={(e) => handleFieldChange('label', e.target.value)} 
                                    placeholder="Ví dụ: Ca Sáng, Ca Gãy..." 
                                    className="h-12 rounded-2xl bg-muted/30 border-none focus-visible:ring-primary/20 pl-11 pr-4 font-bold text-sm"
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/60 ml-2 flex items-center gap-2">
                                  <div className="w-1 h-1 rounded-full bg-primary" /> Vai trò chính
                                </Label>
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
                                  className="h-12 rounded-2xl"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/60 ml-2 flex items-center gap-2">
                                  <div className="w-1 h-1 rounded-full bg-primary" /> Khung giờ (Bắt đầu - Kết thúc)
                                </Label>
                                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                  <Input 
                                    type="time" 
                                    value={item.timeSlot?.start} 
                                    onChange={(e) => handleTimeChange('start', e.target.value)} 
                                    className="h-12 rounded-2xl bg-muted/30 border-none focus-visible:ring-primary/20 px-4 text-center font-black text-sm"
                                  />
                                  <div className="w-6 h-px bg-primary/20" />
                                  <Input 
                                    type="time" 
                                    value={item.timeSlot?.end} 
                                    onChange={(e) => handleTimeChange('end', e.target.value)} 
                                    className="h-12 rounded-2xl bg-muted/30 border-none focus-visible:ring-primary/20 px-4 text-center font-black text-sm"
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/60 ml-2 flex items-center gap-2">
                                  <div className="w-1 h-1 rounded-full bg-primary" /> Tổng nhân sự yêu cầu
                                </Label>
                                <div className="relative">
                                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground/30">
                                    <Users className="h-4 w-4" />
                                  </div>
                                  <Input 
                                    type="number" 
                                    value={item.minUsers ?? 0} 
                                    onChange={(e) => handleFieldChange('minUsers', parseInt(e.target.value, 10) || 0)} 
                                    min="0" 
                                    className="h-12 rounded-2xl bg-muted/30 border-none focus-visible:ring-primary/20 pl-11 pr-4 font-black text-sm"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3 bg-muted/20 p-4 sm:p-5 rounded-[1.8rem] border border-muted-foreground/5">
                              <Label className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/60 ml-2 flex items-center gap-2 mb-2">
                                <Calendar className="h-3.5 w-3.5" /> Ngày áp dụng trong tuần
                              </Label>
                              <ToggleGroup
                                type="multiple"
                                variant="outline"
                                className="flex flex-wrap justify-between gap-1.5"
                                value={item.applicableDays?.map(String) || []}
                                onValueChange={handleApplicableDaysChange}
                              >
                                {weekDays.map(day => (
                                  <ToggleGroupItem 
                                    key={day.value} 
                                    value={String(day.value)} 
                                    className="h-10 sm:h-12 flex-1 min-w-[42px] max-w-[60px] rounded-xl border-dashed border-muted-foreground/20 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-solid data-[state=on]:shadow-lg data-[state=on]:shadow-primary/25 font-black text-[11px] sm:text-xs transition-all duration-300"
                                  >
                                    {day.label}
                                  </ToggleGroupItem>
                                ))}
                              </ToggleGroup>
                            </div>

                            <div className="space-y-4">
                              <div className="flex items-center justify-between px-2">
                                <div className="space-y-0.5">
                                  <Label className="text-[10px] uppercase font-black tracking-[0.2em] text-primary">Ràng buộc nhân sự</Label>
                                  <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">Yêu cầu cụ thể theo giới tính & vai trò</p>
                                </div>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={handleAddRequiredRole}
                                  className="h-9 rounded-xl border-primary/20 text-primary hover:bg-primary/5 text-[10px] font-black uppercase tracking-widest px-4 shadow-sm"
                                >
                                  <Plus className="mr-2 h-3.5 w-3.5" /> Thêm yêu cầu
                                </Button>
                              </div>
                              
                              <div className="space-y-2.5">
                                {(item.requiredRoles || []).map((req, idx) => (
                                  <motion.div 
                                    key={idx} 
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] items-center gap-2 p-2 sm:p-2 bg-background rounded-2xl border border-primary/10 shadow-sm"
                                  >
                                    <Combobox
                                      value={req.role}
                                      onChange={(val) => handleRequiredRoleChange(idx, 'role', val)}
                                      options={[
                                        { value: 'Phục vụ', label: 'Phục vụ' },
                                        { value: 'Pha chế', label: 'Pha chế' },
                                        { value: 'Quản lý', label: 'Quản lý' },
                                      ]}
                                      compact
                                      searchable={false}
                                      className="h-10 border-none bg-muted/30 rounded-xl w-full"
                                    />

                                    {/* gender + count grouped so they remain inline on small screens */}
                                    <div className="flex items-center gap-2">
                                      <Combobox
                                        value={req.gender ?? 'Bất kỳ'}
                                        onChange={(val) => handleRequiredRoleChange(idx, 'gender', val)}
                                        options={[
                                          { value: 'Bất kỳ', label: 'Bất kỳ' },
                                          { value: 'Nam', label: 'Nam' },
                                          { value: 'Nữ', label: 'Nữ' },
                                          { value: 'Khác', label: 'Khác' },
                                        ]}
                                        compact
                                        searchable={false}
                                        className="h-10 border-none bg-muted/30 rounded-xl w-24 sm:w-28"
                                      />

                                      <div className="relative">
                                         <Input 
                                           type="number" 
                                           min={0} 
                                           value={req.count} 
                                           onChange={(e) => handleRequiredRoleChange(idx, 'count', e.target.value)} 
                                           inputMode="numeric"
                                           pattern="[0-9]*"
                                           aria-label={`Số lượng ${req.role}`}
                                           title="Số lượng"
                                           className="h-10 w-16 rounded-xl bg-muted/30 border-none pl-9 pr-2 font-black text-center text-xs"
                                         />
                                         <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/30" />
                                      </div>
                                    </div>

                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="h-10 w-10 text-destructive/40 hover:text-destructive hover:bg-destructive/5 rounded-xl transition-all" 
                                      onClick={() => handleRemoveRequiredRole(idx)}
                                      aria-label="Xóa yêu cầu"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </motion.div>
                                ))}
                                {(!item.requiredRoles || item.requiredRoles.length === 0) && (
                                  <div className="text-center py-6 border-2 border-dashed border-muted/20 rounded-2xl">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Chưa đặt yêu cầu nhân sự cụ thể</p>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-3">
                              <Button 
                                variant="ghost" 
                                className="h-12 rounded-2xl font-black uppercase tracking-widest text-[11px] text-muted-foreground hover:bg-muted/50" 
                                onClick={handleCancelEdit}
                              >
                                Hủy bỏ
                              </Button>
                              <Button 
                                className="h-12 rounded-2xl font-black uppercase tracking-widest text-[11px] bg-primary text-primary-foreground hover:shadow-xl hover:shadow-primary/20 transition-all transform active:scale-95" 
                                onClick={handleSave}
                              >
                                <Check className="mr-2 h-4 w-4" /> Lưu ca mẫu
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                            <div className="flex-1 min-w-0 space-y-4">
                              <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-black text-base uppercase tracking-tight text-foreground">{template.label}</h4>
                                    <Badge className="bg-primary/10 text-primary border-none text-[9px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-full">
                                      {template.role}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-3 text-[11px] font-bold text-muted-foreground">
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-background rounded-lg border border-primary/5">
                                      <Clock className="h-3 w-3 text-primary/50" />
                                      <span className="text-foreground/80">{template.timeSlot.start} — {template.timeSlot.end}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-background rounded-lg border border-primary/5">
                                      <Users className="h-3 w-3 text-primary/50" />
                                      <span className="font-black text-foreground/80">{template.minUsers ?? 0}</span>
                                      <span className="opacity-40">nhân sự</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-1.5 sm:hidden">
                                  <Button 
                                    size="icon" 
                                    variant="secondary"
                                    className="h-10 w-10 rounded-xl"
                                    onClick={() => { setIsEditing(template.id); setCurrentTemplate(template); }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    size="icon" 
                                    variant="ghost"
                                    className="h-10 w-10 rounded-xl text-destructive/40"
                                    onClick={() => handleDelete(template.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5">
                                {weekDays.map(day => (
                                  <div 
                                    key={day.value} 
                                    className={cn(
                                      "h-7 w-7 rounded-lg flex items-center justify-center text-[9px] font-black tracking-tighter transition-all duration-300",
                                      (template.applicableDays || []).includes(day.value) 
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105" 
                                        : "bg-muted/50 text-muted-foreground/30 border border-transparent"
                                    )}
                                  >
                                    {day.label}
                                  </div>
                                ))}
                              </div>

                              {template.requiredRoles && template.requiredRoles.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-2 border-t border-primary/5">
                                  {template.requiredRoles.map((r, i) => (
                                    <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-background border border-primary/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 shadow-sm">
                                      <Briefcase className="h-3 w-3 text-primary/40" />
                                      <span className="text-primary">{r.count}</span>
                                      <div className="w-1 h-1 rounded-full bg-muted-foreground/20" />
                                      <span>{r.role}</span>
                                      {r.gender && (
                                        <>
                                          <div className="w-1 h-1 rounded-full bg-muted-foreground/20" />
                                          <span className="text-primary/70">{r.gender === 'Nam' ? '♂' : r.gender === 'Nữ' ? '♀' : '⚥'} {r.gender}</span>
                                        </>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="hidden sm:flex flex-col gap-2 shrink-0 border-l border-primary/10 pl-5 min-h-[100px] justify-center">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-10 w-10 sm:w-28 sm:justify-start sm:px-3 rounded-xl hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all font-black uppercase tracking-widest text-[9px]" 
                                onClick={() => { setIsEditing(template.id); setCurrentTemplate(template); }}
                              >
                                <Edit className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Chỉnh sửa</span>
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-10 w-10 sm:w-28 sm:justify-start sm:px-3 rounded-xl hover:bg-destructive/5 text-muted-foreground/60 hover:text-destructive transition-all font-black uppercase tracking-widest text-[9px]" 
                                onClick={() => handleDelete(template.id)}
                              >
                                <Trash2 className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Xóa bỏ</span>
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

        <DialogFooter className="border-t border-primary/5 p-4 sm:p-6 bg-muted/10">
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Button 
              variant="outline" 
              className="flex-1 rounded-[1.2rem] h-14 px-6 font-black border-primary/20 hover:bg-primary/5 text-primary uppercase tracking-[0.2em] text-[11px] shadow-sm active:scale-[0.98]" 
              onClick={handleAddNew}
              disabled={!!isEditing}
            >
              <Plus className="mr-3 h-5 w-5" />
              Tạo ca mẫu mới
            </Button>
            <DialogAction onClick={onClose} >
              Hoàn tất thiết lập
            </DialogAction>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
