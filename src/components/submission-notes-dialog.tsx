
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
import { Loader2, Send } from 'lucide-react';

type SubmissionNotesDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (notes: string) => void;
  isSubmitting: boolean;
};

const SubmissionNotesDialog = ({ isOpen, onClose, onSubmit, isSubmitting }: SubmissionNotesDialogProps) => {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNotes(''); // Reset notes when dialog opens
    }
  }, [isOpen]);

  const handleSubmit = () => {
    onSubmit(notes);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} dialogTag="submission-notes-dialog" parentDialogTag="root">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ghi chú cuối ca</DialogTitle>
          <DialogDescription>
            Báo cáo mọi sự cố hoặc sự kiện đáng chú ý trong ca của bạn trước khi gửi báo cáo.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Khách có phàn nàn gì không? Có bất cứ vấn đề gì muốn đề xuất thì cứ nói nhé! (Có thể bỏ trống)"
          rows={5}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Xác nhận & Gửi báo cáo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(SubmissionNotesDialog);
