
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
import { X, Loader2 } from 'lucide-react';

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Đăng ký thời gian rảnh</DialogTitle>
          <DialogDescription>
            Chọn các khung giờ bạn có thể làm việc trong ngày {format(selectedDate, 'dd/MM/yyyy')}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <div>
                <Label className="text-sm font-medium">Chọn nhanh theo ca</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                    {quickSelectSlots.special.map((slot, index) => {
                         const isSelected = selectedSlots.some(s => isEqual(s, slot));
                         return (
                            <Button 
                                key={`special-${index}`} 
                                variant={isSelected ? "default" : "outline"}
                                className={cn("border-2 border-transparent", !isSelected && "border-blue-500/80")}
                                onClick={() => handleToggleSlot(slot)}
                            >
                                {slot.start} - {slot.end}
                            </Button>
                         )
                    })}
                    {quickSelectSlots.regular.map((slot, index) => {
                        const isSelected = selectedSlots.some(s => isEqual(s, slot));
                        return (
                            <Button 
                                key={index} 
                                variant={isSelected ? "default" : "outline"}
                                onClick={() => handleToggleSlot(slot)}
                            >
                                {slot.start} - {slot.end}
                            </Button>
                        )
                    })}
                </div>
            </div>
            
            <div className="space-y-2">
                <Label className="text-sm font-medium">Khung giờ đã chọn</Label>
                {selectedSlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Chưa chọn khung giờ nào.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                    {selectedSlots.map((slot, index) => (
                        <Badge key={index} variant="secondary" className="text-base h-auto py-1 pl-3 pr-1">
                             <span>{slot.start} - {slot.end}</span>
                             <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-5 w-5 ml-1"
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
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Hủy
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
