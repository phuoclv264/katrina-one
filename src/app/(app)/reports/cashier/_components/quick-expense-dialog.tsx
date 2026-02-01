'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO, addMonths, subMonths, startOfMonth } from 'date-fns';
import { vi } from 'date-fns/locale';
import { 
  Zap, 
  Droplet, 
  Home, 
  Plus, 
  Trash2, 
  Check, 
  CreditCard, 
  Banknote,
  AlertCircle,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogAction,
  DialogCancel
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/pro-toast';
import { Combobox } from '@/components/combobox';
import type { OtherCostCategory, ExpenseSlip, PaymentMethod, SimpleUser } from '@/lib/types';
import { dataStore } from '@/lib/data-store';

interface QuickExpenseDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  otherCostCategories: OtherCostCategory[];
  user: any; // Using any for auth user to keep it simple
  dateForNewEntry: string | null;
  onSuccess?: () => void;
  parentDialogTag: string;
  initialMonth?: Date;
}

const STORAGE_KEY_CATEGORIES = 'quick_expense_selected_categories';
const STORAGE_KEY_AMOUNTS = 'quick_expense_last_amounts';
const STORAGE_KEY_PAYMENT_METHOD = 'quick_expense_last_payment_method';

export default function QuickExpenseDialog({
  isOpen,
  onOpenChange,
  otherCostCategories,
  user,
  dateForNewEntry,
  onSuccess,
  parentDialogTag,
  initialMonth,
}: QuickExpenseDialogProps) {
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
    try {
      return dateForNewEntry ? startOfMonth(parseISO(dateForNewEntry)) : startOfMonth(new Date());
    } catch (e) {
      return startOfMonth(new Date());
    }
  });
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [isProcessing, setIsProcessing] = useState(false);

  const STORAGE_KEY_MONTH = 'quick_expense_selected_month';

  // Load state from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const savedCats = localStorage.getItem(STORAGE_KEY_CATEGORIES);
    const savedAmounts = localStorage.getItem(STORAGE_KEY_AMOUNTS);
    const savedPM = localStorage.getItem(STORAGE_KEY_PAYMENT_METHOD);
    const savedMonth = localStorage.getItem(STORAGE_KEY_MONTH);

    if (savedCats) {
      try {
        const parsed = JSON.parse(savedCats);
        if (Array.isArray(parsed)) setSelectedCategoryIds(parsed);
      } catch (e) {
        console.error("Failed to parse saved quick expense categories", e);
      }
    } else {
      // Default selection: find categories names Điện, Nước, Mặt bằng
      const defaults = otherCostCategories
        .filter(c => ['Điện', 'Nước', 'Mặt bằng', 'Thuê nhà'].some(name => c.name.toLowerCase().includes(name.toLowerCase())))
        .map(c => c.id);
      setSelectedCategoryIds(defaults);
    }

    if (savedAmounts) {
      try {
        setAmounts(JSON.parse(savedAmounts));
      } catch (e) {
        console.error("Failed to parse saved quick expense amounts", e);
      }
    }

    if (savedPM) {
      setPaymentMethod(savedPM as PaymentMethod);
    }

    if (savedMonth) {
      try {
        const parsed = parseISO(savedMonth);
        setSelectedMonth(startOfMonth(parsed));
      } catch (e) {
        // ignore
      }
    }
  }, [otherCostCategories]);

    // When the dialog opens, set the selectedMonth to the parent's current month if provided.
    useEffect(() => {
      if (!isOpen) return;
      if (initialMonth) {
        setSelectedMonth(startOfMonth(initialMonth));
      } else if (dateForNewEntry) {
        try { setSelectedMonth(startOfMonth(parseISO(dateForNewEntry))); } catch (e) { /* ignore */ }
      }
    }, [isOpen, initialMonth, dateForNewEntry]);

  // Save state to localStorage when it changes
  useEffect(() => {
    if (typeof window === 'undefined' || !isOpen) return;
    localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(selectedCategoryIds));
    localStorage.setItem(STORAGE_KEY_AMOUNTS, JSON.stringify(amounts));
    localStorage.setItem(STORAGE_KEY_PAYMENT_METHOD, paymentMethod);
    localStorage.setItem(STORAGE_KEY_MONTH, format(selectedMonth, 'yyyy-MM-dd'));
  }, [selectedCategoryIds, amounts, paymentMethod, isOpen]);

  const handleAmountChange = (categoryId: string, value: string) => {
    const num = parseInt(value.replace(/[^0-9]/g, '')) || 0;
    setAmounts(prev => ({ ...prev, [categoryId]: num }));
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategoryIds(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId) 
        : [...prev, categoryId]
    );
  };

  const handleCreateSlips = async () => {
    if (!user) return;
    
    const activeCategories = selectedCategoryIds
      .map(id => ({ 
        id, 
        name: otherCostCategories.find(c => c.id === id)?.name || 'N/A',
        amount: amounts[id] || 0 
      }))
      .filter(c => c.amount > 0);

    if (activeCategories.length === 0) {
      toast.error("Vui lòng nhập số tiền cho ít nhất một loại chi phí.");
      return;
    }

    setIsProcessing(true);
    try {
      // date written as 2nd day of selected month
      const targetDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 2);
      const slipDate = format(targetDate, 'yyyy-MM-dd');
      const createdBy: SimpleUser = { userId: user.uid, userName: user.displayName || user.email || 'User' };

      // Check existing slips for that date to avoid duplicates. If a slip exists for the same
      // other_cost category, update it when the amount changed; otherwise create a new slip.
      const existingSlips = (await (dataStore as any).getDailyExpenseSlips(slipDate)) || [];

      let createdCount = 0;
      let updatedCount = 0;
      let unchangedCount = 0;

      for (const cat of activeCategories) {
        const existing = existingSlips.find((s: any) => s.expenseType === 'other_cost' && Array.isArray(s.items) && s.items.some((it: any) => it.otherCostCategoryId === cat.id));

        if (existing) {
          const existingItem = existing.items.find((it: any) => it.otherCostCategoryId === cat.id);
          const existingAmount = existingItem ? (existingItem.unitPrice || 0) : existing.totalAmount || 0;
          if (existingAmount !== cat.amount) {
            // Update existing slip: replace the matching item and totals
            const updatedItems = existing.items.map((it: any) => it.otherCostCategoryId === cat.id ? ({
              ...it,
              name: cat.name,
              otherCostCategoryId: cat.id,
              quantity: 1,
              unitPrice: cat.amount,
              unit: it.unit || 'lần',
            }) : it);

            const updateData: any = {
              items: updatedItems,
              totalAmount: updatedItems.reduce((sum: number, it: any) => sum + (it.quantity * it.unitPrice), 0),
              actualPaidAmount: paymentMethod === 'cash' ? (existing.actualPaidAmount ? cat.amount : cat.amount) : undefined,
              notes: `Cập nhật nhanh chi phí ${cat.name}`,
              lastModifiedBy: createdBy,
            };

            await (dataStore as any).addOrUpdateExpenseSlip(updateData, existing.id);
            updatedCount += 1;
          } else {
            unchangedCount += 1;
          }
        } else {
          const slipData = {
            expenseType: 'other_cost' as const,
            date: slipDate,
            paymentMethod,
            items: [{
              itemId: 'other_cost',
              name: cat.name,
              otherCostCategoryId: cat.id,
              description: `Chi phí cố định: ${cat.name}`,
              supplier: 'N/A',
              quantity: 1,
              unitPrice: cat.amount,
              unit: 'lần',
            }],
            totalAmount: cat.amount,
            actualPaidAmount: paymentMethod === 'cash' ? cat.amount : undefined,
            notes: `Bổ sung nhanh chi phí ${cat.name}`,
            createdBy,
            createdAt: new Date().toISOString(),
          };

          await (dataStore as any).addOrUpdateExpenseSlip(slipData);
          createdCount += 1;
        }
      }

      let summary = [];
      if (createdCount) summary.push(`${createdCount} tạo mới`);
      if (updatedCount) summary.push(`${updatedCount} cập nhật`);
      if (!createdCount && !updatedCount) summary.push(`Không có thay đổi`);
      toast.success(`Hoàn tất: ${summary.join(', ')}.`);
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create quick expenses", error);
      toast.error("Lỗi khi tạo phiếu chi nhanh.");
    } finally {
      setIsProcessing(false);
    }
  };

  const availableCategories = otherCostCategories.filter(c => !selectedCategoryIds.includes(c.id));

  const getIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('tiền điện')) return <Zap className="h-4 w-4 text-amber-500" />;
    if (n.includes('tiền nước')) return <Droplet className="h-4 w-4 text-blue-500" />;
    if (n.includes('thuê mặt bằng')) return <Home className="h-4 w-4 text-emerald-500" />;
    return <Calculator className="h-4 w-4 text-slate-500" />;
  };

  const handlePrevMonth = () => setSelectedMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setSelectedMonth(prev => addMonths(prev, 1));

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange} dialogTag="quick-expense-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-md bg-white dark:bg-card overflow-hidden p-0 gap-0">
        <DialogHeader iconkey="wallet">
          <DialogTitle className="text-xl font-bold font-headline">Chi phí nhanh</DialogTitle>
          <DialogDescription>Tạo nhanh nhiều phiếu chi cố định cho ngày {dateForNewEntry ? format(parseISO(dateForNewEntry), 'dd/MM/yyyy') : 'hôm nay'}.</DialogDescription>
        </DialogHeader>

        <DialogBody className="p-0">
          <div className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-muted p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground leading-none">Tháng</span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[110px] text-center">
                <span className="text-base font-black tracking-tight uppercase">{format(selectedMonth, 'MMMM yyyy', { locale: vi })}</span>
              </div>
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                <span>Các loại chi phí cố định</span>
                <span className="normal-case font-medium">{selectedCategoryIds.length} đã chọn</span>
              </Label>
              
              <div className="space-y-3">
                {selectedCategoryIds.length === 0 && (
                  <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-muted rounded-3xl text-center">
                    <AlertCircle className="h-8 w-8 text-muted-foreground mb-2 opacity-20" />
                    <p className="text-xs text-muted-foreground">Chưa có loại chi phí nào được chọn.</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Chọn từ danh sách bên dưới để bắt đầu.</p>
                  </div>
                )}
                
                {selectedCategoryIds.map(id => {
                  const cat = otherCostCategories.find(c => c.id === id);
                  if (!cat) return null;
                  return (
                    <div key={id} className="group relative flex items-center gap-4 bg-muted/30 hover:bg-muted/50 p-4 rounded-2xl transition-all border border-transparent hover:border-muted-foreground/10">
                      <div className="p-2.5 bg-white dark:bg-card rounded-xl shadow-sm">
                        {getIcon(cat.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{cat.name}</p>
                        <div className="relative mt-1">
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="Số tiền (đ)..."
                            value={amounts[id]?.toLocaleString('vi-VN') || ''}
                            onChange={(e) => handleAmountChange(id, e.target.value)}
                            className="h-10 border-none bg-transparent p-0 font-black text-lg text-primary focus-visible:ring-0 placeholder:font-medium placeholder:text-muted-foreground/40 placeholder:text-sm"
                            onFocus={(e) => e.target.select()}
                          />
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest pointer-events-none">VND</div>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => toggleCategory(id)}
                        className="h-8 w-8 rounded-full text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Thêm loại chi phí khác</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Combobox
                    options={availableCategories.map(c => ({ value: c.id, label: c.name }))}
                    placeholder="Tìm chi phí..."
                    onChange={(val) => val && toggleCategory(val)}
                    value=""
                    className="h-11 rounded-2xl"
                    searchable
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Hình thức thanh toán chung</Label>
              <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="flex gap-3">
                <Label
                  htmlFor="quick-pm-transfer"
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 h-11 rounded-2xl border-2 transition-all cursor-pointer font-bold text-xs uppercase tracking-wider",
                    paymentMethod === 'bank_transfer' ? "border-primary bg-primary/5 text-primary" : "border-muted text-muted-foreground hover:bg-muted/30"
                  )}
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Chuyển khoản</span>
                  <RadioGroupItem value="bank_transfer" id="quick-pm-transfer" className="sr-only" />
                </Label>
                <Label
                  htmlFor="quick-pm-cash"
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 h-11 rounded-2xl border-2 transition-all cursor-pointer font-bold text-xs uppercase tracking-wider",
                    paymentMethod === 'cash' ? "border-primary bg-primary/5 text-primary" : "border-muted text-muted-foreground hover:bg-muted/30"
                  )}
                >
                  <Banknote className="h-4 w-4" />
                  <span>Tiền mặt</span>
                  <RadioGroupItem value="cash" id="quick-pm-cash" className="sr-only" />
                </Label>
              </RadioGroup>
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="p-6 bg-muted/20 border-t border-muted/50 rounded-b-[2.5rem]">
          <DialogCancel disabled={isProcessing} className="flex-1 h-12 rounded-2xl font-bold uppercase tracking-widest text-[11px] border-none bg-transparent hover:bg-muted hov:text-foreground">Hủy</DialogCancel>
          <DialogAction
            onClick={handleCreateSlips}
            isLoading={isProcessing}
            disabled={selectedCategoryIds.length === 0}
            className="flex-1 h-12 rounded-2xl font-bold uppercase tracking-widest text-[11px] shadow-lg shadow-primary/25"
          >
            Tạo phiếu ({selectedCategoryIds.filter(id => (amounts[id] || 0) > 0).length})
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
