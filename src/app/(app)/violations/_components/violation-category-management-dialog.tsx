
'use client';
import { useState, useEffect, useRef } from 'react';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  const newlyAddedId = useRef<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      const unsub = dataStore.subscribeToViolationCategories((cats) => {
        // Only update from Firestore if not currently editing to prevent overwriting user input
        if (!editingCategory) {
            setCategories(cats.sort((a,b) => (a?.name || '').localeCompare(b?.name || '', 'vi')));
        }
        setIsLoading(false);
      });
      return () => unsub();
    }
  }, [isOpen, editingCategory]);
  
    // Auto-scroll to newly added item
    useEffect(() => {
        if (newlyAddedId.current) {
            const element = document.getElementById(newlyAddedId.current);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            newlyAddedId.current = null; // Reset after scroll
        }
    }, [categories]);

  const handleUpdateCategory = (id: string, field: keyof ViolationCategory, value: any) => {
    if (!editingCategory || editingCategory.id !== id) return;
    setEditingCategory({ ...editingCategory, [field]: value });
  };
  
  const handleSaveCategory = async () => {
    if (!editingCategory) return;
    
    // Prevent duplicate names
    const isDuplicate = categories.some(
      c => (c.name || '').toLowerCase() === (editingCategory.name || '').trim().toLowerCase() && c.id !== editingCategory.id
    );

    if (isDuplicate) {
        toast.error(`Tên "${editingCategory.name}" đã tồn tại.`);
        return;
    }

    const newCategories = categories.map(c => (c.id === editingCategory.id ? editingCategory : c));

    try {
        await dataStore.updateViolationCategories(newCategories);
        toast.success(`Đã cập nhật "${editingCategory.name}".`);
        setEditingCategory(null);
    } catch (error) {
        console.error("Error updating category:", error);
        toast.error("Lỗi khi cập nhật.");
    }
  };

  const handleAddNewCategory = async () => {
    const newId = uuidv4();
    const newCategory: ViolationCategory = {
      id: newId,
      name: "Loại vi phạm mới",
      severity: 'low',
      fineAmount: 0
    };
    
    const newCategories = [...categories, newCategory];

    try {
        await dataStore.updateViolationCategories(newCategories);
        setCategories(newCategories.sort((a,b) => (a?.name || '').localeCompare(b?.name || '', 'vi')));
        setEditingCategory(newCategory);
        newlyAddedId.current = newId; // Set the ID to scroll to
    } catch (error) {
        console.error("Error adding new category:", error);
        toast.error("Không thể thêm loại vi phạm mới.");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const newCategories = categories.filter(c => c.id !== id);
    try {
        await dataStore.updateViolationCategories(newCategories);
        toast.success("Đã xóa loại vi phạm.");
    } catch (error) {
        console.error("Error deleting category:", error);
        toast.error("Không thể xóa loại vi phạm.");
    }
  };

  const handleCancelEdit = () => {
    const originalItem = categories.find(c => c.id === editingCategory?.id);
    // If the item wasn't saved (i.e., it was a 'new' item placeholder), remove it from the list
    if (!originalItem || originalItem.name === "Loại vi phạm mới") {
       setCategories(prev => prev.filter(c => c.id !== editingCategory?.id));
    }
    setEditingCategory(null);
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Quản lý Loại vi phạm</DialogTitle>
          <DialogDescription>Thêm, sửa, xóa các loại vi phạm và mức phạt tương ứng.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <ScrollArea className="max-h-[60vh] pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                  <Loader2 className="animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {categories.map(category => {
                    const isCurrentEditing = editingCategory && editingCategory.id === category.id;
                    const item = isCurrentEditing ? editingCategory : category;
                  return (
                    <div id={category.id} key={category.id} className={cn("flex items-start gap-2 p-4 border rounded-lg transition-all", isCurrentEditing && "border-primary ring-2 ring-primary/50")}>
                      {isCurrentEditing ? (
                         <div className="w-full space-y-4">
                          <Input
                              value={item.name}
                              onChange={(e) => handleUpdateCategory(category.id, 'name', e.target.value)}
                              placeholder="Tên vi phạm"
                          />
                          <div className="grid grid-cols-2 gap-4">
                              <Select
                              value={item.severity}
                              onValueChange={(value) => handleUpdateCategory(category.id, 'severity', value)}
                              >
                              <SelectTrigger><SelectValue/></SelectTrigger>
                              <SelectContent>
                                  <SelectItem key="low" value="low">Nhẹ</SelectItem>
                                  <SelectItem key="medium" value="medium">Trung bình</SelectItem>
                                  <SelectItem key="high" value="high">Nghiêm trọng</SelectItem>
                              </SelectContent>
                              </Select>
                              <Input
                              type="number"
                              value={item.fineAmount}
                              onChange={(e) => handleUpdateCategory(category.id, 'fineAmount', Number(e.target.value))}
                              placeholder="Số tiền phạt"
                              />
                          </div>
                          <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={handleCancelEdit}>Hủy</Button>
                              <Button size="sm" onClick={handleSaveCategory}><Check className="mr-2 h-4 w-4"/>Lưu</Button>
                          </div>
                      </div>
                      ) : (
                        <div className="flex justify-between items-center w-full">
                          <div>
                            <p className="font-semibold">{category.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <Badge className={cn("font-normal", getSeverityBadgeClass(category.severity))}>{category.severity}</Badge>
                              <span>Phạt: {(category.fineAmount ?? 0).toLocaleString('vi-VN')}đ</span>
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
                  );
                })}
                <Button variant="outline" className="w-full mt-4" onClick={handleAddNewCategory}>
                  <Plus className="mr-2 h-4 w-4" /> Thêm loại vi phạm mới
                </Button>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
