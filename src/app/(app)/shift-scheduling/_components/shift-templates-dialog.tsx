
'use client';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, Edit, Loader2, Check, Users } from 'lucide-react';
import type { ShiftTemplate, UserRole } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { toast } from '@/components/ui/pro-toast';
import { Combobox } from '@/components/combobox';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';

const weekDays = [
    { label: 'T2', value: 1 }, { label: 'T3', value: 2 }, { label: 'T4', value: 3 },
    { label: 'T5', value: 4 }, { label: 'T6', value: 5 }, { label: 'T7', value: 6 },
    { label: 'CN', value: 0 }
];

export default function ShiftTemplatesDialog({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
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
      applicableDays: [1,2,3,4,5,6,0], // Default to all days
      minUsers: 0,
    };
    setIsEditing(newTemplate.id);
    setCurrentTemplate(newTemplate);
    setTemplates(prev => [...prev, newTemplate].sort((a,b) => a.timeSlot.start.localeCompare(b.timeSlot.start)));
  };
  
  const handleSave = async () => {
      if (!currentTemplate.id) return;

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
    // If it was a new unsaved template, remove it
    if (!templates.find(t => t.id === currentTemplate.id && t.label !== 'Ca làm việc mới')) {
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
      setCurrentTemplate(prev => ({...prev, [field]: value}));
  }

  const handleAddRequiredRole = () => {
    setCurrentTemplate(prev => ({
      ...prev,
      requiredRoles: [ ...(prev.requiredRoles || []), { role: 'Phục vụ' as UserRole, count: 1 } ]
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
            ...(prev.timeSlot || {start: '', end: ''}),
            [field]: value
        }
    }));
  }

  const handleApplicableDaysChange = (days: string[]) => {
      handleFieldChange('applicableDays', days.map(Number));
  }


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Quản lý Mẫu ca làm việc</DialogTitle>
          <DialogDescription>
            Tạo các ca làm việc chuẩn và lịch áp dụng để tự động thêm vào lịch xếp hàng tuần.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-4">
            {isLoading ? <Loader2 className="animate-spin" /> : templates.map(template => {
                const isCurrentEditing = isEditing === template.id;
                const item = isCurrentEditing ? currentTemplate : template;
                return (
                 <div key={template.id} className="flex items-start gap-2 p-4 border rounded-md">
                    {isCurrentEditing ? (
                        <div className="w-full space-y-4">
                           <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor={`label-${item.id}`}>Tên ca</Label>
                                    <Input id={`label-${item.id}`} value={item.label} onChange={(e) => handleFieldChange('label', e.target.value)} placeholder="Tên ca" />
                                </div>
                                <div className="space-y-2">
                                     <Label htmlFor={`role-${item.id}`}>Vai trò</Label>
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
                           <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                               <Label>Khung giờ</Label>
                                <div className="flex items-center gap-2">
                                     <Input type="time" value={item.timeSlot?.start} onChange={(e) => handleTimeChange('start', e.target.value)} />
                                     <span>-</span>
                                     <Input type="time" value={item.timeSlot?.end} onChange={(e) => handleTimeChange('end', e.target.value)} />
                                </div>
                           </div>
                             <div className="space-y-2">
                                <Label htmlFor={`minUsers-${item.id}`}>Số người tối thiểu</Label>
                                <Input id={`minUsers-${item.id}`} type="number" value={item.minUsers ?? 0} onChange={(e) => handleFieldChange('minUsers', parseInt(e.target.value, 10) || 0)} min="0" />
                            </div>
                           </div>
                           <div className="space-y-2">
                               <Label>Ngày áp dụng</Label>
                                <ToggleGroup 
                                    type="multiple" 
                                    variant="outline" 
                                    className="justify-start flex-wrap"
                                    value={item.applicableDays?.map(String) || []}
                                    onValueChange={handleApplicableDaysChange}
                                >
                                    {weekDays.map(day => (
                                        <ToggleGroupItem key={day.value} value={String(day.value)} aria-label={day.label}>
                                            {day.label}
                                        </ToggleGroupItem>
                                    ))}
                                </ToggleGroup>
                           </div>
                           <div className="space-y-2">
                               <Label>Yêu cầu nhân sự</Label>
                               <div className="space-y-2">
                                 {(item.requiredRoles || []).map((req, idx) => (
                                   <div key={idx} className="flex items-center gap-2">
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
                                       className="w-36"
                                     />
                                     <Input type="number" min={0} value={req.count} onChange={(e) => handleRequiredRoleChange(idx, 'count', e.target.value)} className="w-20" />
                                     <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleRemoveRequiredRole(idx)}><Trash2 className="h-4 w-4"/></Button>
                                   </div>
                                 ))}
                                 <div>
                                   <Button size="sm" variant="outline" onClick={handleAddRequiredRole}><Plus className="mr-2 h-4 w-4"/>Thêm yêu cầu</Button>
                                 </div>
                               </div>
                           </div>
                           <div className="flex justify-end gap-2 pt-2">
                                <Button size="sm" variant="ghost" onClick={handleCancelEdit}>Hủy</Button>
                                <Button size="sm" onClick={handleSave}><Check className="mr-2 h-4 w-4"/>Lưu</Button>
                           </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex-1">
                                <p className="font-semibold">{template.label}</p>
                                <div className="text-sm text-muted-foreground flex items-center gap-4">
                                  <span>{template.role} | {template.timeSlot.start} - {template.timeSlot.end}</span>
                                  <span className="flex items-center gap-1"><Users className="h-3 w-3"/> Tối thiểu: {template.minUsers ?? 0}</span>
                                </div>
                                {template.requiredRoles && template.requiredRoles.length > 0 && (
                                  <div className="mt-2 text-sm text-muted-foreground">
                                    Yêu cầu: {template.requiredRoles.map(r => `${r.count}× ${r.role}`).join(', ')}
                                  </div>
                                )}
                                <div className="flex gap-1 mt-2">
                                    {weekDays.map(day => (
                                        <Badge key={day.value} variant={(template.applicableDays || []).includes(day.value) ? 'default' : 'outline'}>{day.label}</Badge>
                                    ))}
                                </div>
                            </div>
                            <Button size="icon" variant="ghost" onClick={() => {setIsEditing(template.id); setCurrentTemplate(template);}}><Edit className="h-4 w-4"/></Button>
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(template.id)}><Trash2 className="h-4 w-4"/></Button>
                        </>
                    )}
                 </div>
                )
            })}
        </div>
        <DialogFooter>
            <Button variant="secondary" onClick={handleAddNew}>
                <Plus className="mr-2 h-4 w-4"/>
                Thêm ca mẫu mới
            </Button>
            <Button onClick={onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
