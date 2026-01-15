'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ManagedUser, UserRole } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';

export default function BulkSalaryDialog({
  isOpen,
  onClose,
  users,
  onSave,
  isSaving,
}: {
  isOpen: boolean;
  onClose: () => void;
  users: ManagedUser[];
  onSave: (rates: { [userId: string]: number }) => Promise<void>;
  isSaving: boolean;
}) {
  const [rates, setRates] = useState<{ [userId: string]: number }>({});

  useEffect(() => {
    if (isOpen) {
      const initialRates = users.reduce((acc, user) => {
        acc[user.uid] = user.hourlyRate || 0;
        return acc;
      }, {} as { [userId: string]: number });
      setRates(initialRates);
    }
  }, [isOpen, users]);

  const handleRateChange = (userId: string, value: string) => {
    const newRate = Number(value);
    if (!isNaN(newRate)) {
      setRates(prev => ({ ...prev, [userId]: newRate }));
    }
  };

  const handleSave = async () => {
    await onSave(rates);
    onClose();
  };

  const roleOrder: Record<UserRole, number> = {
    'Chủ nhà hàng': 1,
    'Quản lý': 2,
    'Thu ngân': 3,
    'Pha chế': 4,
    'Phục vụ': 5,
  };

  const sortedUsers = [...users].sort((a, b) => {
    const roleComparison = (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99);
    if (roleComparison !== 0) return roleComparison;
    return a.displayName.localeCompare(b.displayName, 'vi');
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose} dialogTag="bulk-salary-dialog" parentDialogTag="root">
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quản lý Lương nhân viên</DialogTitle>
          <DialogDescription>
            Cập nhật mức lương theo giờ cho tất cả nhân viên.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="py-4 space-y-4">
            {sortedUsers.map(user => (
              <div key={user.uid} className="grid grid-cols-3 items-center gap-4 py-1 break-words">
                <div className="col-span-1">
                  <Label htmlFor={`rate-${user.uid}`} className="font-semibold">{user.displayName}</Label>
                  <p className="text-xs text-muted-foreground">{user.role}</p>
                </div>
                <Input
                  id={`rate-${user.uid}`}
                  type="number"
                  value={rates[user.uid] || ''}
                  onChange={(e) => handleRateChange(user.uid, e.target.value)}
                  className="col-span-2"
                  placeholder="Nhập mức lương..."
                  onFocus={(e) => e.target.select()}
                />
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Hủy</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}