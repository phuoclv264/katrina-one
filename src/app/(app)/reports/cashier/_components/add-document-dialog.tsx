'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Calendar as CalendarIcon, TrendingUp, Receipt, AlertTriangle, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from '@/components/ui/pro-toast';

interface AddDocumentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (date: Date, action: 'revenue' | 'expense' | 'incident' | 'handover') => void;
  parentDialogTag: string;
}

const DOCUMENT_TYPES = [
  {
    id: 'revenue',
    label: 'Doanh thu',
    description: 'Báo cáo tổng kết doanh thu cuối ca.',
    icon: TrendingUp,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
  {
    id: 'expense',
    label: 'Phiếu chi',
    description: 'Ghi nhận các khoản chi phí phát sinh.',
    icon: Receipt,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  {
    id: 'incident',
    label: 'Sự cố',
    description: 'Báo cáo hỏng hóc hoặc sự cố tại quán.',
    icon: AlertTriangle,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50 dark:bg-rose-900/20',
    borderColor: 'border-rose-200 dark:border-rose-800',
  },
  {
    id: 'handover',
    label: 'Bàn giao',
    description: 'Biên bản bàn giao tiền mặt và tài sản.',
    icon: ClipboardCheck,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
] as const;

export default function AddDocumentDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  parentDialogTag,
}: AddDocumentDialogProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [action, setAction] = useState<'revenue' | 'expense' | 'incident' | 'handover'>('revenue');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const handleConfirm = () => {
    if (date) {
      onConfirm(date, action);
      // Note: We don't close the dialog here because the caller (CashierReportsView) 
      // will handle opening the next dialog in the sequence. 
      // The parentDialogTag="add-document-dialog" link depends on this remaining open.
    } else {
      toast.error("Vui lòng chọn một ngày.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange} dialogTag="add-document-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-md bg-white dark:bg-card overflow-hidden p-0 gap-0">
        <DialogHeader iconkey="layout">
          <DialogTitle className="text-xl font-bold font-headline">Bổ sung chứng từ</DialogTitle>
          <DialogDescription>Chọn ngày và loại chứng từ bạn muốn thêm vào hệ thống.</DialogDescription>
        </DialogHeader>

        <DialogBody className="p-6 space-y-6">
          <div className="space-y-3">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <CalendarIcon className="h-3.5 w-3.5" /> Ngày chứng từ
            </Label>
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-between text-left font-medium h-12 px-4 border-muted transition-all hover:border-primary/50",
                    !date && "text-muted-foreground"
                  )}
                >
                  <span className="flex items-center">
                    {date ? format(date, "EEEE, dd 'tháng' MM, yyyy", { locale: vi }) : "Chọn ngày"}
                  </span>
                  <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(selectedDate) => {
                    setDate(selectedDate);
                    setIsCalendarOpen(false);
                  }}
                  initialFocus
                  className="rounded-md border p-3 shadow-none"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-3">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Loại chứng từ</Label>
            <RadioGroup 
              value={action} 
              onValueChange={(value) => setAction(value as any)} 
              className="grid grid-cols-1 gap-3"
            >
              {DOCUMENT_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = action === type.id;
                
                return (
                  <Label
                    key={type.id}
                    htmlFor={`action-${type.id}`}
                    className={cn(
                      "flex items-center gap-4 rounded-2xl border-2 p-4 cursor-pointer transition-all relative overflow-hidden",
                      isSelected 
                        ? cn("border-primary bg-primary/[0.03] ring-1 ring-primary", type.borderColor)
                        : "border-muted hover:border-muted-foreground/20 hover:bg-muted/50"
                    )}
                  >
                    <div className={cn("p-3 rounded-xl transition-colors", isSelected ? type.bgColor : "bg-muted")}>
                      <Icon className={cn("h-6 w-6", isSelected ? type.color : "text-muted-foreground")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold">{type.label}</div>
                      <div className="text-[11px] text-muted-foreground leading-relaxed">{type.description}</div>
                    </div>
                    <RadioGroupItem value={type.id} id={`action-${type.id}`} className="sr-only" />
                    {isSelected && (
                      <div className="absolute top-3 right-3">
                        <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center ring-4 ring-white dark:ring-card">
                           <div className="h-2 w-2 rounded-full bg-white" />
                        </div>
                      </div>
                    )}
                  </Label>
                );
              })}
            </RadioGroup>
          </div>
        </DialogBody>

        <DialogFooter className="p-6 pt-2 flex flex-row gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1 h-12 font-bold text-muted-foreground uppercase tracking-widest text-[11px]">Hủy</Button>
          <Button onClick={handleConfirm} disabled={!date} className="flex-1 h-12 font-bold uppercase tracking-widest text-[11px] shadow-lg shadow-primary/20">Xác nhận</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
