
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
import { Trash2, Plus, Edit, Check } from 'lucide-react';
import type { Suppliers } from '@/lib/types';
import { toast } from '@/components/ui/pro-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

type SupplierManagementDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  initialSuppliers: Suppliers;
  onSave: (updatedSuppliers: Suppliers) => void;
};

export default function SupplierManagementDialog({ isOpen, onClose, initialSuppliers, onSave }: SupplierManagementDialogProps) {
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
    <Dialog open={isOpen} onOpenChange={onClose} dialogTag="supplier-management-dialog" parentDialogTag="root">
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quản lý Nhà Cung Cấp</DialogTitle>
          <DialogDescription>Thêm, sửa, hoặc xóa các nhà cung cấp trong danh sách của bạn.</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Tên nhà cung cấp mới..."
              value={newSupplierName}
              onChange={e => setNewSupplierName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <Button onClick={handleAdd}><Plus className="mr-2 h-4 w-4" /> Thêm</Button>
          </div>
          <ScrollArea className="h-64 border rounded-md">
            <div className="p-2 space-y-2">
              {suppliers.map(supplier => (
                <div key={supplier} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted">
                  {editingSupplier && editingSupplier.oldName === supplier ? (
                    <Input
                      value={editingSupplier.newName}
                      onChange={e => setEditingSupplier({ ...editingSupplier, newName: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && handleUpdate()}
                      onBlur={handleUpdate}
                      autoFocus
                      className="h-8"
                    />
                  ) : (
                    <p className="flex-1">{supplier}</p>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingSupplier({ oldName: supplier, newName: supplier })}>
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
                        <AlertDialogTitle>Xóa "{supplier}"?</AlertDialogTitle>
                        <AlertDialogDescription>Hành động này không thể được hoàn tác.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(supplier)}>Xóa</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleSaveChanges}>Lưu thay đổi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
