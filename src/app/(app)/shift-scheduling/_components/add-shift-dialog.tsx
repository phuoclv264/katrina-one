
'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import type { ShiftTemplate } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

type AddShiftDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (templateId: string) => void;
  templates: ShiftTemplate[];
  date: Date | null;
};

export default function AddShiftDialog({ isOpen, onClose, onSave, templates, date }: AddShiftDialogProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  if (!date) return null;

  const handleSave = () => {
    if (selectedTemplateId) {
      onSave(selectedTemplateId);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm ca làm việc</DialogTitle>
          <DialogDescription>
            Chọn một ca làm việc mẫu để thêm vào ngày {format(date, 'dd/MM/yyyy')}.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[50vh] pr-4">
          <RadioGroup 
            onValueChange={setSelectedTemplateId}
            value={selectedTemplateId || ''}
            className="space-y-2"
          >
            {templates.length > 0 ? templates.map(template => (
              <Label 
                key={template.id} 
                htmlFor={template.id}
                className="flex items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
              >
                 <div>
                    <p className="font-semibold">{template.label}</p>
                     <p className="text-sm text-muted-foreground">{template.role} | {template.timeSlot.start} - {template.timeSlot.end}</p>
                 </div>
                <RadioGroupItem value={template.id} id={template.id} />
              </Label>
            )) : (
                <p className="text-center text-sm text-muted-foreground py-8">Chủ nhà hàng chưa tạo ca làm việc mẫu nào.</p>
            )}
          </RadioGroup>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleSave} disabled={!selectedTemplateId}>Thêm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
