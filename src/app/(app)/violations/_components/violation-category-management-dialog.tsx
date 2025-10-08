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
import type { ViolationCategory } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { toast } from 'react-hot-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { v4 as uuidv4 } from 'uuid';

export default function ViolationCategoryManagementDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [categories, setCategories] = useState<ViolationCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<ViolationCategory | null>(null);

  useEffect(() => {
    if (isOpen) {
      const unsub = dataStore.subscribeToViolationCategories((cats) => {
        setCategories(cats);
        setIsLoading(false);
      });
      return () => unsub();
    }
  }, [isOpen]);

  const handleUpdateCategory = (id: string, field: keyof ViolationCategory, value: any) => {
    if (!editingCategory) return;
    setEditingCategory({ ...editingCategory, [field]: value });
  };
  
  const handleSaveCategory = async (id: string) => {
    if (!editingCategory || editingCategory.id !== id) return;
    
    const newCategories = categories.map(c => (c.id === id ? editingCategory : c));

    try {
        await dataStore.updateViolationCategories(newCategories);
        toast.success(`Đã cập nhật "${editingCategory.name}".`);
        setEditingCategory(null);
    } catch (error) {
        toast.error("Lỗi khi cập nhật.");
    }
  };

  const handleAddNewCategory = async () => {
    const newCategory: ViolationCategory = {
      id: uuidv4(),
      name: "Loại vi phạm mới",
      severity: 'low',
      fineAmount: 0
    };
    await dataStore.updateViolationCategories([...categories, newCategory]);
    setEditingCategory(newCategory);
  };

  const handleDeleteCategory = async (id: string) => {
    const newCategories = categories.filter(c => c.id !== id);
    await dataStore.updateViolationCategories(newCategories);
    toast.success("Đã xóa loại vi phạm.");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Quản lý Loại vi phạm</DialogTitle>
          <DialogDescription>Thêm, sửa, xóa các loại vi phạm và mức phạt tương ứng.</DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[60vh] overflow-y-auto pr-4">
          {isLoading ? (
            <Loader2 className="animate-spin" />
          ) : (
            <div className="space-y-4">
              {categories.map(category => (
                <div key={category.id} className="flex items-start gap-2 p-4 border rounded-lg">
                  {editingCategory?.id === category.id ? (
                    <div className="w-full space-y-4">
                        <Input
                            value={editingCategory.name}
                            onChange={(e) => handleUpdateCategory(category.id, 'name', e.target.value)}
                            placeholder="Tên vi phạm"
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <Select
                            value={editingCategory.severity}
                            onValueChange={(value) => handleUpdateCategory(category.id, 'severity', value)}
                            >
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="low">Nhẹ</SelectItem>
                                <SelectItem value="medium">Trung bình</SelectItem>
                                <SelectItem value="high">Nghiêm trọng</SelectItem>
                            </SelectContent>
                            </Select>
                            <Input
                            type="number"
                            value={editingCategory.fineAmount}
                            onChange={(e) => handleUpdateCategory(category.id, 'fineAmount', Number(e.target.value))}
                            placeholder="Số tiền phạt"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setEditingCategory(null)}>Hủy</Button>
                            <Button size="sm" onClick={() => handleSaveCategory(category.id)}>Lưu</Button>
                        </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center w-full">
                      <div>
                        <p className="font-semibold">{category.name}</p>
                        <div className="text-sm text-muted-foreground">
                          <span>Mức độ: {category.severity}</span> | <span>Phạt: {category.fineAmount.toLocaleString('vi-VN')}đ</span>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <Button variant="ghost" size="icon" onClick={() => setEditingCategory(category)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {category.name !== 'Khác' && (
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Xóa "{category.name}"?</AlertDialogTitle></AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteCategory(category.id)}>Xóa</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <Button variant="outline" className="w-full" onClick={handleAddNewCategory}>
                <Plus className="mr-2 h-4 w-4" /> Thêm loại vi phạm mới
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
