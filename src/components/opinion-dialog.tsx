
'use client';
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type OpinionDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (opinionText: string) => void;
  taskText: string;
};

const OpinionDialog = ({ isOpen, onClose, onSubmit, taskText }: OpinionDialogProps) => {
  const [opinionText, setOpinionText] = useState('');

  // Reset text when dialog is opened for a new task
  useEffect(() => {
    if (isOpen) {
      setOpinionText('');
    }
  }, [isOpen]);
  
  // --- Back button handling ---
  useEffect(() => {
    const handler = (e: PopStateEvent) => {
      if (isOpen) {
        e.preventDefault();
        onClose();
      }
    };

    if (isOpen) {
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handler);
    }

    return () => {
      window.removeEventListener('popstate', handler);
    };
  }, [isOpen, onClose]);


  const handleSubmit = () => {
    onSubmit(opinionText);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ghi nhận ý kiến cho:</DialogTitle>
          <DialogDescription className="font-semibold text-foreground">
            "{taskText}"
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Nhập ý kiến, đánh giá của bạn ở đây... (có thể bỏ trống)"
          rows={4}
          value={opinionText}
          onChange={(e) => setOpinionText(e.target.value)}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={handleSubmit}>Lưu ý kiến</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(OpinionDialog);
