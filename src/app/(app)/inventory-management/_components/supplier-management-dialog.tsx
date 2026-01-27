
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
  DialogCancel,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Edit, Check, LayoutGrid } from 'lucide-react';
import type { Suppliers } from '@/lib/types';
import { toast } from '@/components/ui/pro-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

type SupplierManagementDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  initialSuppliers: Suppliers;
  onSave: (updatedSuppliers: Suppliers) => void;
  parentDialogTag: string;
};

export default function SupplierManagementDialog({ isOpen, onClose, initialSuppliers, onSave, parentDialogTag }: SupplierManagementDialogProps) {
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [editingSupplier, setEditingSupplier] = useState<{ oldName: string; newName: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSuppliers([...initialSuppliers].sort((a, b) => a.localeCompare(b, 'vi')));
    }
  }, [isOpen, initialSuppliers]);

  const handleAdd = () => {
    if (newSupplierName.trim() === '') return;
    if (suppliers.some(s => s.toLowerCase() === newSupplierName.trim().toLowerCase())) {
      toast.error('Nhà cung cấp này đã tồn tại.');
      return;
    }
    const newList = [...suppliers, newSupplierName.trim()].sort((a, b) => a.localeCompare(b, 'vi'));
    setSuppliers(newList);
    setNewSupplierName('');
  };

  const handleUpdate = () => {
    if (!editingSupplier || !editingSupplier.newName.trim()) {
      setEditingSupplier(null);
      return;
    }
    const newList = suppliers.map(s => s === editingSupplier.oldName ? editingSupplier.newName.trim() : s).sort((a, b) => a.localeCompare(b, 'vi'));
    setSuppliers(newList);
    setEditingSupplier(null);
  };

  const handleDelete = (supplierToDelete: string) => {
    const newList = suppliers.filter(s => s !== supplierToDelete);
    setSuppliers(newList);
  };

  const handleSaveChanges = () => {
    onSave(suppliers);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} dialogTag="supplier-management-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader iconkey="layout">
          <DialogTitle>Quản lý Nhà Cung Cấp</DialogTitle>
          <DialogDescription>Thêm, sửa, hoặc xóa các nhà cung cấp trong danh sách của bạn.</DialogDescription>
        </DialogHeader>

        <DialogBody className="p-6 space-y-6">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1 group">
              <Input
                placeholder="Nhập tên nhà cung cấp mới..."
                value={newSupplierName}
                onChange={e => setNewSupplierName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                className="h-11 pl-4 rounded-xl border-muted-foreground/20 focus:border-primary/50 transition-all bg-muted/5 group-hover:bg-muted/10"
              />
            </div>
            <Button
              onClick={handleAdd}
              className="h-11 px-5 rounded-xl shadow-sm hover:scale-[1.02] transition-transform active:scale-[0.98]"
            >
              <Plus className="mr-2 h-4 w-4" /> Thêm
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
              Danh sách hiện tại ({suppliers.length})
            </h4>
            <ScrollArea className="h-72 w-full rounded-2xl border bg-muted/5 overflow-hidden">
              <div className="p-3 space-y-1.5">
                {suppliers.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-muted-foreground/60 space-y-2">
                    <LayoutGrid className="h-8 w-8 opacity-20" />
                    <p className="text-sm font-medium italic">Chưa có nhà cung cấp nào</p>
                  </div>
                ) : (
                  suppliers.map(supplier => (
                    <div
                      key={supplier}
                      className="flex items-center gap-2 p-2.5 rounded-xl hover:bg-white dark:hover:bg-slate-900 border border-transparent hover:border-border/50 transition-all group shadow-none hover:shadow-sm"
                    >
                      {editingSupplier && editingSupplier.oldName === supplier ? (
                        <div className="flex-1 flex gap-2">
                          <Input
                            value={editingSupplier.newName}
                            onChange={e =>
                              setEditingSupplier({ ...editingSupplier, newName: e.target.value })
                            }
                            onKeyDown={e => e.key === 'Enter' && handleUpdate()}
                            onBlur={handleUpdate}
                            autoFocus
                            className="h-9 rounded-lg px-3 focus-visible:ring-1"
                          />
                          <Button size="icon" className="h-9 w-9 shrink-0 rounded-lg" onClick={handleUpdate}>
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="h-2 w-2 rounded-full bg-primary/30 mr-1" />
                          <p className="flex-1 text-sm font-medium text-foreground/90 truncate">
                            {supplier}
                          </p>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg hover:bg-muted"
                              onClick={() =>
                                setEditingSupplier({ oldName: supplier, newName: supplier })
                              }
                            >
                              <Edit className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors" />
                            </Button>
                            <AlertDialog 
                              parentDialogTag="supplier-management-dialog" 
                              variant="destructive"
                              dialogTag={`delete-supplier-${supplier}`}
                            >
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-lg hover:bg-destructive/10 text-destructive/70 hover:text-destructive transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Xóa nhà cung cấp?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tên "{supplier}" sẽ bị gỡ khỏi danh sách. Hành động này không thể hoàn tác.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Bỏ qua</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(supplier)}>
                                    Xác nhận xóa
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogBody>

        <DialogFooter className="bg-muted/5 border-t">
          <DialogCancel onClick={onClose} className="flex-1 sm:flex-none">
            Hủy bỏ
          </DialogCancel>
          <DialogAction onClick={handleSaveChanges} className="flex-1 sm:flex-none shadow-primary/20">
            Lưu danh sách
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
