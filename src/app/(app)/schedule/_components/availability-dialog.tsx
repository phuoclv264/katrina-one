
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

type AvailabilityDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (date: Date, slots: TimeSlot[]) => void;
  selectedDate: Date | null;
  existingAvailability: TimeSlot[];
  shiftTemplates: ShiftTemplate[];
};

export default function AvailabilityDialog({ isOpen, onClose, onSave, selectedDate, existingAvailability, shiftTemplates }: AvailabilityDialogProps) {
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);

  const quickSelectSlots = useMemo(() => {
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

    return uniqueSlots;
  }, [shiftTemplates]);

  useEffect(() => {
    if (isOpen) {
        // Deep copy to prevent mutation issues
      setSelectedSlots(JSON.parse(JSON.stringify(existingAvailability || [])));
    }
  }, [isOpen, existingAvailability]);

  const handleToggleSlot = (slot: TimeSlot) => {
    setSelectedSlots(prevSelected => {
      const isAlreadySelected = prevSelected.some(s => isEqual(s, slot));
      if (isAlreadySelected) {
        return prevSelected.filter(s => !isEqual(s, slot));
      } else {
        const newSlots = [...prevSelected, slot];
        newSlots.sort((a,b) => a.start.localeCompare(b.start));
        return newSlots;
      }
    });
  };

  const handleSave = () => {
    if (selectedDate) {
      onSave(selectedDate, selectedSlots);
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
                    {quickSelectSlots.map((slot, index) => {
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
                        <Badge key={index} variant="secondary" className="text-base">
                             {slot.start} - {slot.end}
                        </Badge>
                    ))}
                    </div>
                )}
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={handleSave}>Lưu thay đổi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
