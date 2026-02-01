'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogAction, DialogCancel } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ManagedUser, UserRole } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Coins, UserCircle, Banknote, Search, X } from 'lucide-react';

export default function BulkSalaryDialog({
  isOpen,
  onClose,
  users,
  onSave,
  isSaving,
  parentDialogTag,
}: {
  isOpen: boolean;
  onClose: () => void;
  users: ManagedUser[];
  onSave: (rates: { [userId: string]: number }) => Promise<void>;
  isSaving: boolean;
  parentDialogTag: string;
}) {
  const [rates, setRates] = useState<{ [userId: string]: number }>({});
  const [filterText, setFilterText] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');

  useEffect(() => {
    if (isOpen) {
      const initialRates = users.reduce((acc, user) => {
        acc[user.uid] = user.hourlyRate || 0;
        return acc;
      }, {} as { [userId: string]: number });
      setRates(initialRates);
      setFilterText('');
      setRoleFilter('');
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

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const roleComparison = (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99);
      if (roleComparison !== 0) return roleComparison;
      return a.displayName.localeCompare(b.displayName, 'vi');
    });
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return sortedUsers.filter(u => {
      const matchesName = !q || u.displayName.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
      const matchesRole = !roleFilter || u.role === roleFilter;
      return matchesName && matchesRole;
    });
  }, [sortedUsers, filterText, roleFilter]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose} dialogTag="bulk-salary-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-md">
        <DialogHeader variant="premium" icon={<Coins className="w-6 h-6" />} className="text-left">
          <div className="flex flex-col">
            <DialogTitle className="mb-0">Cấu hình lương</DialogTitle>
            <DialogDescription className="text-zinc-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-2">Thiết lập đơn giá theo giờ cho đội ngũ</DialogDescription>
          </div>
        </DialogHeader>

        <DialogBody className="p-0 bg-transparent">
          <div className="px-6 pt-6 pb-4">
            <div className="flex gap-3 items-center">
              <div className="relative flex-1">
                <Input
                  aria-label="Tìm kiếm nhân viên"
                  placeholder="Tìm tên hoặc email..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="pl-10 h-10 rounded-xl bg-white/80 border border-zinc-100 text-sm"
                />
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                {filterText ? (
                  <button
                    aria-label="Xoá tìm kiếm"
                    onClick={() => setFilterText('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : null}
              </div>

              <div className="w-40">
                <label className="sr-only">Lọc theo vai trò</label>
                <select
                  aria-label="Lọc theo vai trò"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
                  className="h-10 w-full bg-white rounded-xl border border-zinc-100 text-sm pl-3"
                >
                  <option value="">Tất cả vai trò</option>
                  <option value="Chủ nhà hàng">Chủ nhà hàng</option>
                  <option value="Quản lý">Quản lý</option>
                  <option value="Pha chế">Pha chế</option>
                  <option value="Phục vụ">Phục vụ</option>
                </select>
              </div>
            </div>
          </div>

          <ScrollArea className="bg-zinc-50/30">
            <div className="p-8 space-y-3">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-zinc-400">
                  Không tìm thấy nhân viên phù hợp.
                </div>
              ) : (
                filteredUsers.map(user => (
                  <div key={user.uid} className="bg-white p-4 rounded-3xl border border-zinc-100 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <UserCircle className="w-3.5 h-3.5 text-zinc-400" />
                        <Label htmlFor={`rate-${user.uid}`} className="text-[11px] font-black uppercase tracking-wider text-zinc-900">
                          {user.displayName}
                        </Label>
                      </div>
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest italic ml-5">{user.role}</p>
                    </div>

                    <div className="w-32 relative">
                      <Input
                        id={`rate-${user.uid}`}
                        type="number"
                        value={rates[user.uid] || ''}
                        onChange={(e) => handleRateChange(user.uid, e.target.value)}
                        className="h-10 rounded-xl bg-zinc-50 border-none font-black text-xs pr-8 text-right focus-visible:ring-emerald-500/20"
                        placeholder="0"
                        onFocus={(e) => e.target.select()}
                      />
                      <Banknote className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-300 pointer-events-none" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogBody>

        <DialogFooter variant="muted">
          <DialogCancel onClick={onClose} disabled={isSaving}>Hủy</DialogCancel>
          <DialogAction
            onClick={handleSave}
            disabled={isSaving}
            isLoading={isSaving}
          >
            Lưu thay đổi
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}