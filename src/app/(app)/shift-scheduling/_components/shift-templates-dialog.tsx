
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
import { Trash2, Plus, Edit, Loader2, Check } from 'lucide-react';
import type { ShiftTemplate, UserRole } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      const unsub = dataStore.subscribeToShiftTemplates((data) => {
        setTemplates(data);
        setIsLoading(false);
      });
      return () => unsub();
    }
  }, [isOpen]);

  const handleAddNew = () => {
    const newTemplate = {
      id: `template_${Date.now()}`,
      label: 'Ca làm việc mới',
      role: 'Bất kỳ' as const,
      timeSlot: { start: '08:00', end: '12:00' },
      applicableDays: [1,2,3,4,5,6,0], // Default to all days
    };
    setIsEditing(newTemplate.id);
    setCurrentTemplate(newTemplate);
    setTemplates(prev => [...prev, newTemplate]);
  };
  
  const handleSave = async () => {
      if (!currentTemplate.id) return;

      const finalTemplates = templates.map(t => t.id === currentTemplate.id ? currentTemplate as ShiftTemplate : t);

      try {
        await dataStore.updateShiftTemplates(finalTemplates);
        toast({ title: 'Đã lưu', description: 'Đã cập nhật danh sách ca mẫu.' });
        setIsEditing(null);
        setCurrentTemplate({});
      } catch (error) {
        toast({ title: 'Lỗi', description: 'Không thể lưu ca mẫu.', variant: 'destructive'});
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
        toast({ title: 'Đã xóa', description: 'Đã xóa ca làm việc mẫu.'});
    } catch (error) {
        toast({ title: 'Lỗi', description: 'Không thể xóa ca mẫu.', variant: 'destructive'});
    }
  }

  const handleFieldChange = (field: keyof ShiftTemplate, value: any) => {
      setCurrentTemplate(prev => ({...prev, [field]: value}));
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
                 <div key={template.id} className="flex items-center gap-2 p-4 border rounded-md">
                    {isCurrentEditing ? (
                        <div className="w-full space-y-4">
                           <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor={`label-${item.id}`}>Tên ca</Label>
                                    <Input id={`label-${item.id}`} value={item.label} onChange={(e) => handleFieldChange('label', e.target.value)} placeholder="Tên ca" />
                                </div>
                                <div className="space-y-2">
                                     <Label htmlFor={`role-${item.id}`}>Vai trò</Label>
                                    <Select value={item.role} onValueChange={(val) => handleFieldChange('role', val as UserRole | 'Bất kỳ')}>
                                        <SelectTrigger id={`role-${item.id}`}><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Bất kỳ">Bất kỳ</SelectItem>
                                            <SelectItem value="Phục vụ">Phục vụ</SelectItem>
                                            <SelectItem value="Pha chế">Pha chế</SelectItem>
                                            <SelectItem value="Quản lý">Quản lý</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                           </div>
                           <div className="space-y-2">
                               <Label>Khung giờ</Label>
                                <div className="flex items-center gap-2">
                                     <Input type="time" value={item.timeSlot?.start} onChange={(e) => handleTimeChange('start', e.target.value)} />
                                     <span>-</span>
                                     <Input type="time" value={item.timeSlot?.end} onChange={(e) => handleTimeChange('end', e.target.value)} />
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
                           <div className="flex justify-end gap-2 pt-2">
                                <Button size="sm" variant="ghost" onClick={handleCancelEdit}>Hủy</Button>
                                <Button size="sm" onClick={handleSave}><Check className="mr-2 h-4 w-4"/>Lưu</Button>
                           </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex-1">
                                <p className="font-semibold">{template.label}</p>
                                <p className="text-sm text-muted-foreground">{template.role} | {template.timeSlot.start} - {template.timeSlot.end}</p>
                                <div className="flex gap-1 mt-1">
                                    {weekDays.map(day => (
                                        <Badge key={day.value} variant={template.applicableDays.includes(day.value) ? 'default' : 'outline'}>{day.label}</Badge>
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
