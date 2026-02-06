
'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
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
import { X, Loader2, CalendarCheck2, Clock, CheckCircle2, Lock } from 'lucide-react';
import { vi } from 'date-fns/locale';

type AvailabilityDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (date: Date, slots: TimeSlot[]) => Promise<void>;
  selectedDate: Date | null;
  existingAvailability: TimeSlot[];
  shiftTemplates: ShiftTemplate[];
  parentDialogTag: string;
  /** When true, slots that already existed when the dialog opened cannot be removed */
  lockExistingSlots?: boolean;
};

export default function AvailabilityDialog({ isOpen, onClose, onSave, selectedDate, existingAvailability, shiftTemplates, parentDialogTag, lockExistingSlots }: AvailabilityDialogProps) {
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const quickSelectSlots = useMemo(() => {
    // Add the two special full-day slots
    const timeSlot: TimeSlot[] = [
      // { start: '06:00', end: '17:00' },
      // { start: '06:00', end: '22:30' },
      { start: '06:00', end: '12:00' },
      { start: '12:00', end: '17:00' },
      { start: '17:00', end: '22:30' },
    ];

    // Prepend the special slots
    return {
      special: timeSlot
    };

  }, [shiftTemplates]);

  const originalSlotsRef = useRef<TimeSlot[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Deep copy to prevent mutation issues
      const copied = JSON.parse(JSON.stringify(existingAvailability || []));
      setSelectedSlots(copied);
      // Keep a snapshot of original slots so we can prevent their removal if locked
      originalSlotsRef.current = copied;
    }
  }, [isOpen, existingAvailability]);

  const handleToggleSlot = (slot: TimeSlot) => {
    // Determine whether the clicked slot is covered by any original (pre-existing) slot
    const isCoveredByOriginal = originalSlotsRef.current.some(o => o.start <= slot.start && o.end >= slot.end);

    // Exact match present?
    const isExactSelected = selectedSlots.some(s => isEqual(s, slot));

    // Is there a selected slot that fully covers this one (needs splitting on unselect)
    const coveringIndex = selectedSlots.findIndex(s => s.start <= slot.start && s.end >= slot.end);

    // If exact selected -> attempt to remove exact entry
    if (isExactSelected) {
      if ((lockExistingSlots || false) && isCoveredByOriginal) {
        // Locked: cannot remove
        return;
      }
      setSelectedSlots(prev => prev.filter(s => !isEqual(s, slot)));
      return;
    }

    // If covered by a larger selected slot -> split it when unselecting; here we treat click as 'unselect'
    if (coveringIndex !== -1) {
      if ((lockExistingSlots || false) && isCoveredByOriginal) {
        return;
      }
      const covering = selectedSlots[coveringIndex];
      const newSlots: TimeSlot[] = [];
      // left piece
      if (covering.start < slot.start) newSlots.push({ start: covering.start, end: slot.start });
      // right piece
      if (slot.end < covering.end) newSlots.push({ start: slot.end, end: covering.end });
      setSelectedSlots(prev => [...prev.slice(0, coveringIndex), ...newSlots, ...prev.slice(coveringIndex + 1)]);
      return;
    }

    // Otherwise add the exact slot (toggle on)
    setSelectedSlots(prev => {
      if (prev.some(s => isEqual(s, slot))) return prev;
      return [...prev, slot];
    });
  };

  const handleRemoveSlot = (slotToRemove: TimeSlot) => {
    const isOriginal = originalSlotsRef.current.some(s => isEqual(s, slotToRemove));
    if ((lockExistingSlots || false) && isOriginal) {
      // When locked (schedule published), do not allow removing original slots
      return;
    }
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
                // Determine if this specific quick-select slot is covered by an original entry
                const isCoveredByOriginal = originalSlotsRef.current.some(o => o.start <= slot.start && o.end >= slot.end);
                const isCurrentlySelected = selectedSlots.some(s => s.start <= slot.start && s.end >= slot.end);
                const isSelected = isCurrentlySelected || isCoveredByOriginal;
                const isLocked = lockExistingSlots && isCoveredByOriginal;

                return (
                  <Button
                    key={`special-${index}`}
                    variant="outline"
                    className={cn(
                      "h-12 rounded-3xl font-bold text-[11px] sm:text-xs transition-all border-2 relative overflow-hidden min-w-[92px] sm:min-w-[140px] px-2",
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/10 scale-[0.98]"
                        : "bg-muted/5 border-muted-foreground/10 text-muted-foreground hover:border-primary/20 hover:bg-primary/5",
                      isLocked && "cursor-default opacity-95 active:scale-100" // No click feedback for locked slots
                    )}
                    onClick={() => handleToggleSlot(slot)}
                  >
                    <div className="flex flex-col items-center justify-center gap-1">
                      {isLocked ? (
                        <Lock className="w-3.5 h-3.5 animate-in fade-in zoom-in duration-300" />
                      ) : isSelected ? (
                        <CheckCircle2 className="w-3.5 h-3.5 animate-in fade-in zoom-in duration-300" />
                      ) : null}
                      <span className="tabular-nums whitespace-normal text-center break-words leading-tight">{slot.start} - {slot.end}</span>
                    </div>
                  </Button>
                )
              })}
            </div>

            {lockExistingSlots && (
              <div className="mt-4 p-4 rounded-[20px] bg-orange-500/5 border border-orange-500/10 flex items-start gap-3 animate-in slide-in-from-bottom-2 duration-500">
                <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-500 shrink-0">
                  <Lock className="h-3.5 w-3.5" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest">Lịch đã công bố</p>
                  <p className="text-[11px] text-orange-600/70 dark:text-orange-400/70 font-bold leading-relaxed">
                    Bạn chỉ có thể đăng ký thêm khung giờ mới, không thể xóa khung giờ đã được lưu trước đó.
                  </p>
                </div>
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
