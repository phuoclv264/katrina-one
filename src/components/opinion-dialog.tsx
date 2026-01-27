
'use client';
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
  DialogAction,
  DialogCancel
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquarePlus } from 'lucide-react';

type OpinionDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (opinionText: string) => void;
  taskText: string;
  initialValue?: string;
  parentDialogTag: string;
};

const OpinionDialog = ({ isOpen, onClose, onSubmit, taskText, initialValue = '', parentDialogTag }: OpinionDialogProps) => {
  const [opinionText, setOpinionText] = useState(initialValue);

  // Reset text when dialog is opened for a new task
  useEffect(() => {
    if (isOpen) {
      setOpinionText(initialValue);
    }
  }, [isOpen, initialValue]);

  const handleSubmit = () => {
    onSubmit(opinionText);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} dialogTag="opinion-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent>
        <DialogHeader variant="premium" iconkey="message" className="pb-10">
          <div className="flex items-center gap-4 relative z-10">
            <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl">
              <MessageSquarePlus className="h-6 w-6 text-zinc-400" />
            </div>
            <div>
              <DialogTitle className="mb-1">
                Ghi nhận ý kiến
              </DialogTitle>
              <DialogDescription className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] line-clamp-1 max-w-[200px]">
                {taskText}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4 pt-2">
            <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100">
               <p className="text-[13px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Đang ghi nhận cho:</p>
               <p className="text-sm font-semibold text-zinc-900 italic">"{taskText}"</p>
            </div>

            <Textarea
              placeholder="Nhập ý kiến, đánh giá của bạn ở đây..."
              className="min-h-[160px] rounded-2xl border-zinc-200 bg-white p-4 text-base focus-visible:ring-zinc-900 transition-all resize-none shadow-sm"
              value={opinionText}
              onChange={(e) => setOpinionText(e.target.value)}
              autoFocus
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <DialogCancel onClick={onClose}>Hủy</DialogCancel>
          <DialogAction onClick={handleSubmit}>Lưu ý kiến</DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(OpinionDialog);
