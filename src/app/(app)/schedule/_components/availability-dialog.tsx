
'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import type { TimeSlot, ShiftTemplate } from '@/lib/types';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from '@/lib/utils';
import isEqual from 'lodash.isequal';
import { Badge } from '@/components/ui/badge';
import { X, Loader2, CalendarCheck2, Clock, CheckCircle2 } from 'lucide-react';
import { vi } from 'date-fns/locale';

type AvailabilityDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (date: Date, slots: TimeSlot[]) => Promise<void>;
  selectedDate: Date | null;
  existingAvailability: TimeSlot[];
  shiftTemplates: ShiftTemplate[];
};

export default function AvailabilityDialog({ isOpen, onClose, onSave, selectedDate, existingAvailability, shiftTemplates }: AvailabilityDialogProps) {
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const quickSelectSlots = useMemo(() => {
    // Add the two special full-day slots
    const specialSlots: TimeSlot[] = [
        { start: '06:00', end: '17:00' },
        { start: '06:00', end: '22:30' },
    ];
    
    const uniqueSlots: TimeSlot[] = [];
    const seen = new Set<string>();

    shiftTemplates.forEach(template => {
      const key = `${template.timeSlot.start}-${template.timeSlot.end}`;
      if (!seen.has(key)) {
        uniqueSlots.push(template.timeSlot);
        seen.add(key);
      }
    });
    
    // Sort the slots by start time
    uniqueSlots.sort((a, b) => a.start.localeCompare(b.start));

    // Prepend the special slots
    return {
        special: specialSlots,
        regular: uniqueSlots
    };

  }, [shiftTemplates]);

  useEffect(() => {
    if (isOpen) {
        // Deep copy to prevent mutation issues
      setSelectedSlots(JSON.parse(JSON.stringify(existingAvailability || [])));
    }
  }, [isOpen, existingAvailability]);

  const handleToggleSlot = (slot: TimeSlot) => {
    const mergedSlots: TimeSlot[] = [];

    // Sort slots by start time
    const sortedSlots = [...selectedSlots, slot].sort((a, b) => a.start.localeCompare(b.start));

    let currentMergedSlot = { ...sortedSlots[0] };

    for (let i = 1; i < sortedSlots.length; i++) {
        const nextSlot = sortedSlots[i];

        // Convert times to a comparable format (e.g., minutes from midnight)
        const currentEndMinutes = parseInt(currentMergedSlot.end.split(':')[0]) * 60 + parseInt(currentMergedSlot.end.split(':')[1]);
        const nextStartMinutes = parseInt(nextSlot.start.split(':')[0]) * 60 + parseInt(nextSlot.start.split(':')[1]);
        const nextEndMinutes = parseInt(nextSlot.end.split(':')[0]) * 60 + parseInt(nextSlot.end.split(':')[1]);

        // Check for overlap or adjacency (within a few minutes tolerance)
        // If next slot starts before or at the current merged slot's end, they overlap or are adjacent
        if (nextStartMinutes <= currentEndMinutes) {
            // Merge by extending the end time if the next slot's end is later
            if (nextEndMinutes > currentEndMinutes) {
                currentMergedSlot.end = nextSlot.end;
            }
        } else {
            // No overlap, push the current merged slot and start a new one
            mergedSlots.push(currentMergedSlot);
            currentMergedSlot = { ...nextSlot };
        }
    }
    mergedSlots.push(currentMergedSlot); // Push the last merged slot

    setSelectedSlots(mergedSlots);
  };

  const handleRemoveSlot = (slotToRemove: TimeSlot) => {
    setSelectedSlots(prevSelected => prevSelected.filter(s => !isEqual(s, slotToRemove)));
  };

  const handleSave = async () => {
    if (selectedDate) {
      setIsSaving(true);
      try {
        await onSave(selectedDate, selectedSlots);
      } finally {
        // No need to call onClose here as the parent component does it.
        setIsSaving(false);
      }
    }
  };

  if (!selectedDate) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[92vw] sm:max-w-md p-0 overflow-hidden rounded-[38px] sm:rounded-[40px] border-none shadow-3xl bg-white dark:bg-slate-950">
        <div className="p-5 sm:p-6 pb-0">
          <DialogHeader className="space-y-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="h-12 w-12 sm:h-14 sm:w-14 bg-green-500/10 rounded-[18px] sm:rounded-[20px] flex items-center justify-center shrink-0">
                <CalendarCheck2 className="h-6 w-6 sm:h-7 sm:w-7 text-green-500" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50 leading-tight">
                  Đăng ký rảnh
                </DialogTitle>
                <DialogDescription className="text-[12px] sm:text-sm font-bold text-slate-500 dark:text-slate-400 mt-0.5 uppercase tracking-wide">
                  {format(selectedDate, 'eeee, dd/MM/yyyy', { locale: vi })}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <Label className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400">Chọn nhanh theo ca</Label>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                    {quickSelectSlots.special.map((slot, index) => {
                         const isSelected = selectedSlots.some(s => isEqual(s, slot));
                         return (
                            <Button 
                                key={`special-${index}`} 
                                variant="outline"
                                className={cn(
                                    "h-11 sm:h-12 rounded-2xl font-black text-[11px] sm:text-xs transition-all border-2",
                                    isSelected 
                                        ? "bg-green-500 border-green-500 text-white shadow-lg shadow-green-500/20" 
                                        : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 hover:border-green-500/30 hover:bg-green-50/50"
                                )}
                                onClick={() => handleToggleSlot(slot)}
                            >
                                {isSelected && <CheckCircle2 className="w-3 h-3 mr-1.5" />}
                                {slot.start} - {slot.end}
                            </Button>
                         )
                    })}
                    {quickSelectSlots.regular.map((slot, index) => {
                        const isSelected = selectedSlots.some(s => isEqual(s, slot));
                        return (
                            <Button 
                                key={index} 
                                variant="outline"
                                className={cn(
                                    "h-11 sm:h-12 rounded-2xl font-black text-[11px] sm:text-xs transition-all border-2",
                                    isSelected 
                                        ? "bg-green-500 border-green-500 text-white shadow-lg shadow-green-500/20" 
                                        : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 hover:border-green-500/30 hover:bg-green-50/50"
                                )}
                                onClick={() => handleToggleSlot(slot)}
                            >
                                {isSelected && <CheckCircle2 className="w-3 h-3 mr-1.5" />}
                                {slot.start} - {slot.end}
                            </Button>
                        )
                    })}
                </div>
            </div>
            
            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-[28px] sm:rounded-[32px] border border-slate-100 dark:border-slate-800">
                <Label className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400 px-1">Khung giờ đã chọn</Label>
                {selectedSlots.length === 0 ? (
                    <div className="py-6 flex flex-col items-center justify-center text-center">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2">
                             <Clock className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chưa chọn khung giờ</p>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                    {selectedSlots.map((slot, index) => (
                        <Badge key={index} variant="secondary" className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-[11px] sm:text-xs h-9 sm:h-10 px-3 pl-4 rounded-xl flex items-center gap-2 font-black tracking-tight">
                             <span>{slot.start} - {slot.end}</span>
                             <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors"
                                onClick={() => handleRemoveSlot(slot)}
                             >
                                <X className="h-3 w-3" />
                                <span className="sr-only">Xóa</span>
                             </Button>
                        </Badge>
                    ))}
                    </div>
                )}
            </div>
        </div>

        <DialogFooter className="p-5 sm:p-6 pt-0 flex flex-row items-center gap-3 sm:gap-4">
          <Button variant="ghost" className="flex-1 h-11 sm:h-12 rounded-xl sm:rounded-2xl font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all text-[11px] sm:text-xs uppercase tracking-widest" onClick={onClose} disabled={isSaving}>
            HỦY
          </Button>
          <Button 
            className="flex-[2] h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 font-black text-[11px] sm:text-xs uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-slate-200 dark:shadow-none translate-y-0"
            onClick={handleSave} 
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
