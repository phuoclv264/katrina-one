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
import type { OtherCostCategory } from '@/lib/types';
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
} from "@/components/ui/alert-dialog"

export default function OtherCostCategoryDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [categories, setCategories] = useState<OtherCostCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newCategory, setNewCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState<{ oldName: string; newName: string } | null>(null);

  useEffect(() => {
    if (open) {
      setIsLoading(true);
      const unsub = dataStore.subscribeToOtherCostCategories((cats) => {
        setCategories(cats);
        setIsLoading(false);
      });
      return () => unsub();
    }
  }, [open]);

  const handleSave = async (newCategoryList: OtherCostCategory[]) => {
    try {
      await dataStore.updateOtherCostCategories(newCategoryList);
      toast.success('Đã cập nhật danh sách.');
    } catch (error) {
      toast.error('Lỗi: Không thể lưu thay đổi.');
      console.error(error);
    }
  };

  const handleAdd = () => {
    if (newCategory.trim() === '') return;
    if (categories.includes(newCategory.trim())) {
      toast.error('Loại chi phí này đã tồn tại.');
      return;
    }
    const newList = [...categories, newCategory.trim()].sort((a, b) => a.localeCompare(b, 'vi'));
    handleSave(newList);
    setNewCategory('');
  };

  const handleUpdate = () => {
    if (!editingCategory || !editingCategory.newName.trim()) {
      setEditingCategory(null);
      return;
    }
    const newList = categories.map(c => c === editingCategory.oldName ? editingCategory.newName.trim() : c);
    handleSave(newList);
    setEditingCategory(null);
  };

  const handleDelete = (categoryToDelete: string) => {
    const newList = categories.filter(c => c !== categoryToDelete);
    handleSave(newList);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quản lý Loại chi phí khác</DialogTitle>
          <DialogDescription>
            Thêm, sửa, hoặc xóa các danh mục chi phí cho thu ngân lựa chọn.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Tên loại chi phí mới..."
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <Button onClick={handleAdd}><Plus className="mr-2 h-4 w-4" /> Thêm</Button>
          </div>
          <ScrollArea className="h-64 border rounded-md">
            <div className="p-2 space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : categories.length > 0 ? (
                categories.map(cat => (
                  <div key={cat} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted">
                    {editingCategory?.oldName === cat ? (
                      <Input
                        value={editingCategory.newName}
                        onChange={e => setEditingCategory({ ...editingCategory, newName: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && handleUpdate()}
                        onBlur={handleUpdate}
                        autoFocus
                        className="h-8"
                      />
                    ) : (
                      <p className="flex-1">{cat}</p>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingCategory({ oldName: cat, newName: cat })}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                       <AlertDialogTrigger asChild>
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" disabled={cat === 'Khác'}>
                            <Trash2 className="h-4 w-4" />
                           </Button>
                       </AlertDialogTrigger>
                       <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Xóa "{cat}"?</AlertDialogTitle>
                                <AlertDialogDescription>Hành động này không thể được hoàn tác.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(cat)}>Xóa</AlertDialogAction>
                            </AlertDialogFooter>
                       </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))
              ) : (
                <p className="text-center text-sm text-muted-foreground py-4">Chưa có loại chi phí nào.</p>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
