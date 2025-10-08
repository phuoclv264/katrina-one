
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
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
import type { ViolationCategory } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { toast } from 'react-hot-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export default function ViolationCategoryManagementDialog({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [categories, setCategories] = useState<ViolationCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [currentEditingValues, setCurrentEditingValues] = useState<Omit<ViolationCategory, 'id'>>({ name: '', severity: 'low', calculationType: 'fixed', fineAmount: 0, finePerUnit: 0, unitLabel: 'phút' });
  
  const [newCategoryName, setNewCategoryName] = useState('');
  const itemRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // Effect to subscribe to data source
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      const unsub = dataStore.subscribeToViolationCategories((cats) => {
        setCategories(cats.sort((a,b) => (a?.name || '').localeCompare(b?.name || '', 'vi')));
        setIsLoading(false);
      });
      return () => unsub();
    } else {
        // Reset state when dialog closes
        setEditingCategoryId(null);
    }
  }, [isOpen]);
  
  const handleAddNewCategory = async () => {
    if (newCategoryName.trim() === '') return;
    if (categories.some(c => c.name.toLowerCase() === newCategoryName.trim().toLowerCase())) {
        toast.error('Loại vi phạm này đã tồn tại.');
        return;
    }

    try {
        const newCategory: ViolationCategory = { 
            id: uuidv4(), 
            name: newCategoryName.trim(), 
            severity: 'low', 
            calculationType: 'fixed', 
            fineAmount: 0, 
            finePerUnit: 0,
            unitLabel: 'phút',
        };
        const newList = [...categories, newCategory];
        await dataStore.updateViolationCategories(newList);
        
        toast.success(`Đã thêm loại vi phạm mới.`);
        setNewCategoryName('');

        setTimeout(() => {
            const newItemRef = itemRefs.current.get(newCategory.id);
            newItemRef?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setEditingCategoryId(newCategory.id);
            setCurrentEditingValues(newCategory);
        }, 100);
    } catch (error) {
        toast.error('Lỗi: Không thể thêm loại vi phạm mới.');
        console.error(error);
    }
  };

  const handleEditingValueChange = (field: keyof Omit<ViolationCategory, 'id'>, value: string | number) => {
    setCurrentEditingValues(prev => ({ ...prev, [field]: value }));
  }

  const handleSaveCategory = async () => {
    if (!editingCategoryId) return;
    if (!currentEditingValues.name.trim()) {
      toast.error('Tên loại vi phạm không được để trống.');
      return;
    }

    try {
        const dataToSave: Partial<Omit<ViolationCategory, 'id'>> = { ...currentEditingValues };

        // Sanitize data before saving
        if (dataToSave.calculationType === 'fixed') {
            dataToSave.finePerUnit = 0;
            dataToSave.unitLabel = null;
        } else { // calculationType === 'perUnit'
            dataToSave.fineAmount = 0;
        }

        const newList = categories.map(c => 
            c.id === editingCategoryId 
                ? { id: editingCategoryId, ...dataToSave } 
                : c
        ) as ViolationCategory[];
        
        await dataStore.updateViolationCategories(newList);
        toast.success(`Đã cập nhật "${currentEditingValues.name}".`);
        setEditingCategoryId(null);
    } catch(error) {
        toast.error('Lỗi: Không thể lưu thay đổi.');
        console.error(error);
    }
  };
  
  const handleDeleteCategory = async (categoryId: string) => {
    try {
        const newList = categories.filter(c => c.id !== categoryId);
        await dataStore.updateViolationCategories(newList);
        toast.success('Đã xóa loại vi phạm.');
    } catch(error) {
        toast.error('Lỗi: Không thể xóa.');
        console.error(error);
    }
  };

  const getSeverityBadgeClass = (severity: ViolationCategory['severity']) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700';
      case 'medium': return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700';
      case 'low':
      default:
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700';
    }
  };
  

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl bg-white dark:bg-card">
        <DialogHeader>
          <DialogTitle>Quản lý Loại Vi phạm</DialogTitle>
          <DialogDescription>
            Thêm, sửa, hoặc xóa các danh mục vi phạm và mức phạt tương ứng.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Tên loại vi phạm mới..."
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddNewCategory()}
            />
            <Button onClick={handleAddNewCategory}><Plus className="mr-2 h-4 w-4" /> Thêm</Button>
          </div>
          <ScrollArea className="h-72 border rounded-md">
            <div className="p-2 space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : categories.length > 0 ? (
                categories.map(category => (
                  <div
                    key={category.id}
                    ref={(el) => itemRefs.current.set(category.id, el)}
                    className={cn(
                      "p-3 space-y-3 border rounded-lg",
                       editingCategoryId === category.id ? "bg-muted border-primary" : "bg-card"
                    )}
                  >
                    {editingCategoryId === category.id ? (
                      // EDITING VIEW
                      <div className="w-full space-y-4">
                         <div className="space-y-4">
                            <Input
                                value={currentEditingValues.name}
                                onChange={(e) => handleEditingValueChange('name', e.target.value)}
                                placeholder="Tên vi phạm"
                            />
                            <div className="space-y-2">
                                <Label className="text-xs">Mức độ</Label>
                                <Select value={currentEditingValues.severity} onValueChange={(val) => handleEditingValueChange('severity', val)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem key="low" value="low">Nhẹ</SelectItem>
                                        <SelectItem key="medium" value="medium">Trung bình</SelectItem>
                                        <SelectItem key="high" value="high">Nghiêm trọng</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                               <Label className="text-xs">Kiểu tính phạt</Label>
                                <RadioGroup 
                                  value={currentEditingValues.calculationType} 
                                  onValueChange={(val) => handleEditingValueChange('calculationType', val)}
                                  className="flex gap-4"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="fixed" id={`calc-fixed-${category.id}`} />
                                        <Label htmlFor={`calc-fixed-${category.id}`}>Cố định</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="perUnit" id={`calc-unit-${category.id}`} />
                                        <Label htmlFor={`calc-unit-${category.id}`}>Theo đơn vị</Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {currentEditingValues.calculationType === 'perUnit' ? (
                                <div className="grid grid-cols-2 gap-4">
                                     <div className="space-y-2">
                                        <Label className="text-xs">Tiền phạt/đơn vị</Label>
                                        <Input type="number" value={currentEditingValues.finePerUnit ?? 0} onChange={(e) => handleEditingValueChange('finePerUnit', parseInt(e.target.value, 10) || 0)} onFocus={(e) => e.target.select()} />
                                    </div>
                                     <div className="space-y-2">
                                        <Label className="text-xs">Tên đơn vị</Label>
                                        <Input value={currentEditingValues.unitLabel ?? 'phút'} onChange={(e) => handleEditingValueChange('unitLabel', e.target.value)} />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label className="text-xs">Mức phạt (VNĐ)</Label>
                                    <Input type="number" value={currentEditingValues.fineAmount} onChange={(e) => handleEditingValueChange('fineAmount', parseInt(e.target.value, 10) || 0)} onFocus={(e) => e.target.select()} />
                                </div>
                            )}

                         </div>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditingCategoryId(null)}>Hủy</Button>
                          <Button size="sm" onClick={handleSaveCategory}><Check className="mr-2 h-4 w-4"/>Lưu</Button>
                        </div>
                      </div>
                    ) : (
                      // DISPLAY VIEW
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <p className="font-semibold">{category.name}</p>
                          <div className="flex items-center gap-2 text-sm mt-1">
                            <Badge className={getSeverityBadgeClass(category.severity)}>{category.severity}</Badge>
                            {category.calculationType === 'perUnit' ? (
                                <span className="text-muted-foreground">{(category.finePerUnit ?? 0).toLocaleString('vi-VN')}đ / {category.unitLabel || 'đơn vị'}</span>
                            ) : (
                                <span className="text-muted-foreground">{(category.fineAmount ?? 0).toLocaleString('vi-VN')}đ</span>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { 
                            setEditingCategoryId(category.id); 
                            setCurrentEditingValues({ 
                                name: category.name, 
                                severity: category.severity, 
                                calculationType: category.calculationType || 'fixed', 
                                fineAmount: category.fineAmount || 0,
                                finePerUnit: category.finePerUnit || 0,
                                unitLabel: category.unitLabel || 'phút',
                            }); 
                        }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Xóa "{category.name}"?</AlertDialogTitle>
                              <AlertDialogDescription>Hành động này không thể được hoàn tác.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteCategory(category.id)}>Xóa</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-center text-sm text-muted-foreground py-4">Chưa có loại vi phạm nào.</p>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
