
'use client';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus } from 'lucide-react';
import { format } from 'date-fns';
import type { TimeSlot } from '@/lib/types';
import { defaultTimeSlots } from '@/lib/data';

type AvailabilityDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (date: Date, slots: TimeSlot[]) => void;
  selectedDate: Date | null;
  existingAvailability: TimeSlot[];
};

export default function AvailabilityDialog({ isOpen, onClose, onSave, selectedDate, existingAvailability }: AvailabilityDialogProps) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);

  useEffect(() => {
    if (isOpen) {
      setSlots(existingAvailability.length > 0 ? existingAvailability : []);
    }
  }, [isOpen, existingAvailability]);

  const handleSlotChange = (index: number, field: 'start' | 'end', value: string) => {
    const newSlots = [...slots];
    newSlots[index][field] = value;
    setSlots(newSlots);
  };

  const addSlot = (slot: TimeSlot) => {
      // Check if the slot already exists
    if (!slots.some(s => s.start === slot.start && s.end === slot.end)) {
        const newSlots = [...slots, slot];
        newSlots.sort((a,b) => a.start.localeCompare(b.start));
        setSlots(newSlots);
    }
  };
  
  const addNewCustomSlot = () => {
    setSlots([...slots, { start: '08:00', end: '12:00' }]);
  }

  const removeSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (selectedDate) {
      onSave(selectedDate, slots);
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
                <Label className="text-sm font-medium">Chọn nhanh</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                    {defaultTimeSlots.map(slot => (
                        <Button 
                            key={`${slot.start}-${slot.end}`} 
                            variant="outline"
                            onClick={() => addSlot(slot)}
                            disabled={slots.some(s => s.start === slot.start && s.end === slot.end)}
                        >
                            {slot.start} - {slot.end}
                        </Button>
                    ))}
                </div>
            </div>
            
            <div className="space-y-2">
                <Label className="text-sm font-medium">Khung giờ đã chọn</Label>
                {slots.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Chưa chọn khung giờ nào.</p>
                ) : (
                    slots.map((slot, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <Input
                            type="time"
                            value={slot.start}
                            onChange={(e) => handleSlotChange(index, 'start', e.target.value)}
                        />
                        <span>-</span>
                        <Input
                            type="time"
                            value={slot.end}
                            onChange={(e) => handleSlotChange(index, 'end', e.target.value)}
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeSlot(index)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                    ))
                )}
            </div>
             <Button variant="outline" size="sm" onClick={addNewCustomSlot}>
                <Plus className="mr-2 h-4 w-4"/>
                Thêm giờ tùy chỉnh
            </Button>
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
