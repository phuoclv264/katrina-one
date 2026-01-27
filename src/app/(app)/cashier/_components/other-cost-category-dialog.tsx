
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
  DialogCancel,
  DialogAction,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Edit, Loader2, Check } from 'lucide-react';
import type { OtherCostCategory } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { toast } from '@/components/ui/pro-toast';
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


export default function OtherCostCategoryDialog({ open, onOpenChange, parentDialogTag }: { open: boolean, onOpenChange: (open: boolean) => void, parentDialogTag: string }) {
  const [categories, setCategories] = useState<OtherCostCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<OtherCostCategory | null>(null);

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
    if (newCategoryName.trim() === '') return;
    if (categories.some(c => c.name.toLowerCase() === newCategoryName.trim().toLowerCase())) {
      toast.error('Loại chi phí này đã tồn tại.');
      return;
    }
    const newCategory: OtherCostCategory = { id: uuidv4(), name: newCategoryName.trim() };
    const newList = [...categories, newCategory].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    handleSave(newList);
    setNewCategoryName('');
  };

  const handleUpdate = () => {
    if (!editingCategory || !editingCategory.name.trim()) {
      setEditingCategory(null);
      return;
    }
    const newList = categories.map(c => c.id === editingCategory.id ? { ...c, name: editingCategory.name.trim() } : c);
    handleSave(newList);
    setEditingCategory(null);
  };

  const handleDelete = (categoryToDeleteId: string) => {
    const newList = categories.filter(c => c.id !== categoryToDeleteId);
    handleSave(newList);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dialogTag="other-cost-category-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-md">
        <DialogHeader variant="premium" iconkey="calculator">
          <DialogTitle>Loại chi phí khác</DialogTitle>
          <DialogDescription>
            Quản lý các danh mục chi phí phát sinh cho ca làm việc.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="bg-zinc-50/50">
          <div className="flex flex-col gap-6 py-2">
            <div className="flex gap-2 p-1 bg-white rounded-2xl shadow-sm ring-1 ring-zinc-200 focus-within:ring-zinc-900 transition-all">
              <Input
                placeholder="Tên loại chi phí mới..."
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                className="border-none focus-visible:ring-0 shadow-none h-11 text-sm bg-transparent"
              />
              <DialogAction onClick={handleAdd} className="text-white px-4 rounded-xl flex items-center justify-center transition-colors active:scale-95 shrink-0">
                <Plus className="h-4 w-4 mr-2" />
                <span className="text-xs font-bold uppercase tracking-wider">Thêm</span>
              </DialogAction>
            </div>

            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 px-1">
                Danh sách hiện tại ({categories.length})
              </h3>
              
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-300">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : categories.length > 0 ? (
                  categories.map(cat => (
                    <div key={cat.id} className="group flex items-center gap-3 p-3 rounded-2xl bg-white ring-1 ring-zinc-200 hover:ring-zinc-900 transition-all shadow-sm">
                      <div className="w-8 h-8 rounded-xl bg-zinc-50 flex items-center justify-center shrink-0">
                        <Check className="h-4 w-4 text-zinc-400" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        {editingCategory && editingCategory.id === cat.id ? (
                          <Input
                            value={editingCategory.name}
                            onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })}
                            onKeyDown={e => e.key === 'Enter' && handleUpdate()}
                            onBlur={handleUpdate}
                            autoFocus
                            className="h-8 text-sm font-bold border-zinc-200 focus-visible:ring-zinc-900 rounded-lg"
                          />
                        ) : (
                          <p className="font-bold text-zinc-900 text-sm">{cat.name}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100" 
                          onClick={() => setEditingCategory(cat)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog parentDialogTag="other-cost-category-dialog">
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50" 
                              disabled={cat.name === 'Khác'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-[2rem]">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-xl font-bold">Xóa hạng mục?</AlertDialogTitle>
                              <AlertDialogDescription className="text-sm">
                                Bạn có chắc muốn xóa "{cat.name}"? Dữ liệu đã lưu sẽ không bị ảnh hưởng nhưng bạn sẽ không thể chọn hạng mục này nữa.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-2">
                              <AlertDialogCancel className="h-12 rounded-2xl font-bold border-none bg-zinc-100">Hủy</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDelete(cat.id)}
                                className="h-12 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold border-none"
                              >
                                Xác nhận xóa
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 bg-white rounded-3xl border border-dashed border-zinc-200">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Chưa có dữ liệu</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="bg-white border-t border-zinc-100">
          <DialogCancel onClick={() => onOpenChange(false)} className="w-full">Đóng</DialogCancel>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
