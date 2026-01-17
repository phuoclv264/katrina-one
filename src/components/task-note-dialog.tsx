
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
import { MessageSquareText, FileText, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';

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
      <DialogContent className="max-w-[95vw] sm:max-w-md p-0 overflow-hidden border-none shadow-2xl rounded-[24px] sm:rounded-[32px] bg-slate-50/95 backdrop-blur-xl">
        {/* Modern Header */}
        <div className="relative bg-gradient-to-br from-amber-500 to-orange-600 pt-6 pb-8 px-5 sm:px-6 text-white overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-24 h-24 bg-orange-400/20 rounded-full blur-xl pointer-events-none" />
          
          <div className="relative flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-sm">
              <MessageSquareText className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl font-black text-white leading-tight">
                Báo cáo & Ghi chú
              </DialogTitle>
              <p className="text-orange-100 text-[11px] font-bold uppercase tracking-wider mt-0.5 opacity-90 truncate">
                Cập nhật thông tin chi tiết
              </p>
            </div>
          </div>
        </div>

        <div className="relative -mt-4 rounded-t-[24px] bg-white p-5 sm:p-6 shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-400">
                <FileText className="h-3.5 w-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Nội dung công việc</span>
              </div>
              <p className="text-[13px] font-bold text-slate-700 leading-snug bg-slate-50 p-3 rounded-xl border border-slate-100/50 italic">
                "{taskText}"
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <Textarea
                placeholder="Nhập lý do không thể thực hiện, sự cố phát sinh hoặc ghi chú bàn giao cho đồng nghiệp..."
                className="min-h-[140px] text-[14px] font-medium p-4 bg-slate-50 border-2 border-slate-100 focus:border-amber-500/30 focus:bg-white focus:ring-4 focus:ring-amber-500/5 rounded-2xl transition-all duration-300 resize-none leading-relaxed placeholder:text-slate-400 shadow-inner"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                autoFocus
              />
            </div>
          </div>
        </div>

        <DialogFooter className="p-5 bg-white border-t border-slate-50 flex-row gap-3 sm:justify-end">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="flex-1 sm:flex-none h-11 rounded-xl font-bold text-slate-500 hover:bg-slate-50 active:scale-95 transition-all"
          >
            Hủy
          </Button>
          <Button 
            onClick={handleSubmit}
            className="flex-1 sm:flex-none h-11 px-8 rounded-xl font-black bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/20 active:scale-95 transition-all gap-2"
          >
            <Send className="h-4 w-4" />
            Lưu báo cáo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(TaskNoteDialog);
