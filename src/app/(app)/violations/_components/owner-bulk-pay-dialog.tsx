import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { cn, advancedSearch } from '@/lib/utils';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogHeader, 
  DialogDescription,
} from '@/components/ui/dialog';
import type { Violation, ManagedUser } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle2, Search, FilterX, DollarSign, Calendar, User, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Timestamp } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/user-avatar';

export interface UnpaidItem {
  key: string;
  violation: Violation;
  userId: string;
  userName: string;
  cost: number;
}

interface OwnerBulkPayDialogProps {
  open: boolean;
  onClose: () => void;
  unpaidItems: UnpaidItem[];
  allUsers: ManagedUser[];
  onSubmit: (items: UnpaidItem[]) => void;
  isProcessing: boolean;
  parentDialogTag: string;
}

export const OwnerBulkPayDialog: React.FC<OwnerBulkPayDialogProps> = ({ open, onClose, unpaidItems, allUsers, onSubmit, isProcessing, parentDialogTag }) => {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Clear selections when dialog is reopened
  React.useEffect(() => {
    if (open) {
      setSelectedKeys([]);
      setSearchQuery('');
    }
  }, [open]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return unpaidItems;
    return advancedSearch(unpaidItems, searchQuery, ['userName']);
  }, [unpaidItems, searchQuery]);

  const toggleSelect = (key: string) => {
    setSelectedKeys(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]);
  };

  const toggleSelectAll = () => {
    const visibleKeys = filteredItems.map(i => i.key);
    const areAllVisibleSelected = visibleKeys.every(k => selectedKeys.includes(k));
    
    if (areAllVisibleSelected) {
      setSelectedKeys(prev => prev.filter(k => !visibleKeys.includes(k)));
    } else {
      setSelectedKeys(prev => Array.from(new Set([...prev, ...visibleKeys])));
    }
  };

  const totalSelectedCost = useMemo(() => {
    return unpaidItems
      .filter(item => selectedKeys.includes(item.key))
      .reduce((sum, item) => sum + item.cost, 0);
  }, [unpaidItems, selectedKeys]);

  const handleSubmit = () => {
    if (selectedKeys.length === 0) return;
    const selectedItems = unpaidItems.filter(item => selectedKeys.includes(item.key));
    onSubmit(selectedItems);
  };

  const createdAtToDate = (createdAt: any): Date => {
    if (!createdAt) return new Date();
    if (typeof (createdAt as any)?.toDate === 'function') {
      try {
        return (createdAt as any).toDate();
      } catch (e) {}
    }
    if (typeof createdAt === 'string' || typeof createdAt === 'number') {
      return new Date(createdAt);
    }
    if (typeof (createdAt as any)?.seconds === 'number') {
      return new Date((createdAt as any).seconds * 1000);
    }
    return new Date(createdAt as any);
  };

  return (
    <Dialog open={open} onOpenChange={onClose} dialogTag="owner-bulk-pay-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-xl flex flex-col p-0 gap-0 overflow-hidden bg-zinc-50 rounded-[2.5rem]">
        <DialogHeader variant="premium" className="bg-white border-b shadow-sm relative" icon={<CheckCircle2 />}>
          <div className="flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl font-black text-zinc-900 leading-tight">
                Thanh toán nhanh
              </DialogTitle>
              <DialogDescription className="text-sm font-medium text-zinc-500 mt-1">
                Xác nhận các khoản phạt đã thu tiền
              </DialogDescription>
            </div>
          </div>
          
          <div className="mt-6 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
            <Input 
              placeholder="Tìm tên nhân viên"
              className="pl-11 h-12 bg-zinc-100/50 border-none focus-visible:ring-indigo-500/20 rounded-2xl font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </DialogHeader>

        <div className="flex items-center justify-between px-6 py-4 bg-zinc-50/80 backdrop-blur-sm sticky top-0 z-10 border-b border-zinc-200/50">
          <button 
            onClick={toggleSelectAll}
            className="text-xs font-black text-zinc-400 uppercase tracking-widest hover:text-indigo-600 transition-colors flex items-center gap-2"
          >
            <div className={cn(
               "w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all",
               filteredItems.length > 0 && filteredItems.every(i => selectedKeys.includes(i.key))
                 ? "bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                 : "border-zinc-300 bg-white"
            )}>
              {filteredItems.length > 0 && filteredItems.every(i => selectedKeys.includes(i.key)) && <Check className="w-3 h-3 stroke-[4px]" />}
            </div>
            Chọn tất cả ({filteredItems.length})
          </button>
          
          <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
            Chưa thu: {unpaidItems.length}
          </div>
        </div>

        <ScrollArea className="flex-grow min-h-0 px-4 py-2 overflow-y-auto">
          <div className="space-y-3 pb-8 pt-2">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                <div className="w-20 h-20 rounded-[2.5rem] bg-zinc-100 flex items-center justify-center mb-6">
                  {searchQuery ? <Search className="h-10 w-10 text-zinc-300" /> : <FilterX className="h-10 w-10 text-zinc-300" />}
                </div>
                <h3 className="text-zinc-900 font-bold mb-2">Không có kết quả</h3>
                <p className="text-sm text-zinc-500 max-w-[280px]">
                  {searchQuery ? `Không tìm thấy khoản phạt nào khớp với "${searchQuery}"` : "Hiện tại không có khoản phạt nào cần xác nhận thanh toán."}
                </p>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = selectedKeys.includes(item.key);
                const userObj = allUsers.find(u => u.uid === item.userId);
                
                return (
                  <button
                    key={item.key}
                    onClick={() => toggleSelect(item.key)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-[2rem] text-left transition-all duration-300 group relative overflow-hidden ring-1",
                      isSelected 
                        ? "bg-white ring-indigo-500/20 shadow-xl shadow-indigo-500/5 scale-[0.99]" 
                        : "bg-white ring-zinc-200/50 hover:ring-zinc-300 hover:shadow-lg shadow-zinc-500/5 hover:-translate-y-0.5"
                    )}
                  >
                    {/* Background decoration for selected state */}
                    {isSelected && <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-50 z-0" />}

                    <div className="relative z-10 flex-shrink-0">
                      <UserAvatar user={userObj} className="h-12 w-12 rounded-2xl shadow-sm" rounded="2xl" nameOverride={item.userName} />
                      <div className={cn(
                        "absolute -right-1 -bottom-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center transition-all duration-300 shadow-md",
                        isSelected ? "bg-indigo-500 text-white scale-110" : "bg-white text-zinc-300 scale-90"
                      )}>
                        <Check className={cn("w-3 h-3 stroke-[4px] transition-opacity", isSelected ? "opacity-100" : "opacity-0")} />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 relative z-10">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-black text-zinc-900 truncate">
                          {item.userName}
                        </span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                           <span className="text-base font-black text-indigo-600 tracking-tight">
                             {item.cost.toLocaleString('vi-VN')}
                           </span>
                           <span className="text-[10px] font-bold text-indigo-600/50">đ</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider">
                        <span className="bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <DollarSign className="w-2.5 h-2.5" />
                          {item.violation.categoryName}
                        </span>
                        <span className="text-zinc-300 flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          {format(createdAtToDate(item.violation.createdAt), 'dd/MM')}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>

        <div className="p-6 bg-white border-t border-zinc-100/80 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.05)]">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100">
               <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Đã chọn</div>
               <div className="text-xl font-black text-zinc-900">{selectedKeys.length} <span className="text-xs font-bold text-zinc-400">khoản</span></div>
            </div>
            <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/50">
               <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Tổng tiền</div>
               <div className="text-xl font-black text-indigo-950 tabular-nums">
                 {totalSelectedCost.toLocaleString('vi-VN')}
                 <span className="text-xs font-bold text-indigo-600/60 ml-1">đ</span>
               </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button 
                variant="ghost" 
                onClick={onClose} 
                disabled={isProcessing} 
                className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
            >
              Đóng
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={selectedKeys.length === 0 || isProcessing}
              className="flex-[2] h-14 bg-gradient-to-r from-indigo-700 to-indigo-800 hover:from-indigo-800 hover:to-indigo-900 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-500/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale disabled:scale-100 border-none"
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Đang xử lý...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                   <CheckCircle2 className="h-5 w-5" />
                   <span>Xác nhận thu tiền</span>
                </div>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

