
'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogAction,
  DialogCancel,
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
  parentDialogTag: string;
};

export default function AvailabilityDialog({ isOpen, onClose, onSave, selectedDate, existingAvailability, shiftTemplates, parentDialogTag }: AvailabilityDialogProps) {
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
    <Dialog open={isOpen} onOpenChange={onClose} dialogTag="availability-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="w-[92vw] sm:max-w-md">
        <DialogHeader variant="premium" iconkey="calendar">
          <DialogTitle>Đăng ký rảnh</DialogTitle>
          <DialogDescription className="font-bold text-[10px] uppercase tracking-[0.2em] mt-1.5 opacity-80">
            {format(selectedDate, 'eeee, dd/MM/yyyy', { locale: vi })}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6 pt-6">
          {/* Quick Select Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Chọn nhanh theo ca</Label>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {quickSelectSlots.special.map((slot, index) => {
                const isSelected = selectedSlots.some(s => isEqual(s, slot));
                return (
                  <Button
                    key={`special-${index}`}
                    variant="outline"
                    className={cn(
                      "h-12 rounded-[20px] font-bold text-[11px] sm:text-xs transition-all border-2",
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/10 scale-[0.98]"
                        : "bg-muted/5 border-muted-foreground/10 text-muted-foreground hover:border-primary/20 hover:bg-primary/5"
                    )}
                    onClick={() => handleToggleSlot(slot)}
                  >
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
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
                      "h-12 rounded-[20px] font-bold text-[11px] sm:text-xs transition-all border-2",
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/10 scale-[0.98]"
                        : "bg-muted/5 border-muted-foreground/10 text-muted-foreground hover:border-primary/20 hover:bg-primary/5"
                    )}
                    onClick={() => handleToggleSlot(slot)}
                  >
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                    {slot.start} - {slot.end}
                  </Button>
                )
              })}
            </div>
          </div>

          {/* Selection List Section */}
          <div className="space-y-4 p-5 bg-muted/30 rounded-[32px] border border-muted-foreground/5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Khung giờ đã chọn</Label>
            </div>

            {selectedSlots.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                  <Clock className="w-6 h-6 text-muted-foreground/30" />
                </div>
                <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Chưa chọn khung giờ</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedSlots.map((slot, index) => (
                  <Badge 
                    key={index} 
                    variant="secondary" 
                    className="bg-background border border-muted-foreground/10 text-foreground text-[11px] font-bold h-10 px-3 pl-4 rounded-[14px] flex items-center gap-2 group transition-all hover:border-primary/20"
                  >
                    <span>{slot.start} - {slot.end}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                      onClick={() => handleRemoveSlot(slot)}
                    >
                      <X className="h-3.5 h-3.5" />
                      <span className="sr-only">Xóa</span>
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter variant="muted" className="p-6 pt-4">
          <DialogCancel onClick={onClose} disabled={isSaving} className="rounded-2xl h-12 flex-1 sm:flex-none">
            HỦY
          </DialogCancel>
          <DialogAction
            onClick={handleSave}
            disabled={isSaving}
            isLoading={isSaving}
            className="flex-1 sm:flex-none"
          >
            Lưu thay đổi
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
