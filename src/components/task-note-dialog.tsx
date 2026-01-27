
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
  DialogCancel,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquareText, FileText } from 'lucide-react';

type TaskNoteDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (noteText: string) => void;
  taskText: string;
  initialValue?: string;
  parentDialogTag: string;
};

const TaskNoteDialog = ({ isOpen, onClose, onSubmit, taskText, initialValue = '', parentDialogTag }: TaskNoteDialogProps) => {
  const [noteText, setNoteText] = useState(initialValue);

  // Reset text when dialog is opened for a new task
  useEffect(() => {
    if (isOpen) {
      setNoteText(initialValue);
    }
  }, [isOpen, initialValue]);

  const handleSubmit = () => {
    onSubmit(noteText);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} dialogTag="task-note-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent>
        <DialogHeader variant="premium" icon={<MessageSquareText />}>
          <div>
            <DialogTitle className="mb-1">Báo cáo & Ghi chú</DialogTitle>
            <DialogDescription className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em]">Cập nhật thông tin chi tiết</DialogDescription>
          </div>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4 pt-2">
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
               <div className="flex items-center gap-2 text-amber-600 mb-1">
                 <FileText className="h-3 w-3" />
                 <span className="text-[10px] font-black uppercase tracking-wider">Nội dung công việc</span>
               </div>
               <p className="text-sm font-semibold text-amber-900 italic leading-snug">"{taskText}"</p>
            </div>

            <Textarea
              placeholder="Nhập lý do không thể thực hiện, sự cố phát sinh hoặc ghi chú bàn giao..."
              className="min-h-[160px] rounded-2xl border-zinc-200 bg-white p-4 text-base focus-visible:ring-zinc-900 transition-all resize-none shadow-sm"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              autoFocus
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <DialogCancel onClick={onClose}>Hủy</DialogCancel>
          <DialogAction onClick={handleSubmit}>Lưu báo cáo</DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(TaskNoteDialog);
