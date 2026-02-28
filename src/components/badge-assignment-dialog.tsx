'use client';

import React, { useState } from 'react';
import { 
  Plus, 
  Trophy, 
  Zap, 
  Heart, 
  Star, 
  Award,
  Sparkles,
  Target,
  Rocket,
  Sun,
  Flame,
  UserCheck,
  ShieldCheck,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  ListChecks,
  TimerOff,
  Ban,
  XCircle
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogBody,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ManagedUser } from '@/lib/types';
import { cn } from '@/lib/utils';

interface BadgeAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUser: ManagedUser | null;
  onGrantBadge: (u: ManagedUser, label: string, color?: string) => Promise<void>;
  parentDialogTag?: string;
}

// const EXTENDED_SUGGESTED_BADGES = [
//   { label: 'Nhân viên xuất sắc', icon: Trophy, color: 'bg-yellow-500 shadow-yellow-200' },
//   { label: 'Nhân viên năng nổ', icon: Zap, color: 'bg-orange-500 shadow-orange-200' },
//   { label: 'Tương trợ đồng đội', icon: Heart, color: 'bg-rose-500 shadow-rose-200' },
//   { label: 'Thái độ tích cực', icon: Star, color: 'bg-sky-500 shadow-sky-200' },
//   { label: 'Làm việc hiệu quả', icon: Target, color: 'bg-emerald-500 shadow-emerald-200' },
//   { label: 'Cải tiến bứt phá', icon: Rocket, color: 'bg-indigo-500 shadow-indigo-200' },
//   { label: 'Năng lượng tích cực', icon: Sun, color: 'bg-amber-400 shadow-amber-200' },
//   { label: 'Nhiệt huyết cháy bỏng', icon: Flame, color: 'bg-red-500 shadow-red-200' },
//   { label: 'Dịch vụ hoàn hảo', icon: UserCheck, color: 'bg-teal-500 shadow-teal-200' },
//   { label: 'Sáng tạo đổi mới', icon: Sparkles, color: 'bg-violet-500 shadow-violet-200' },
// ];

const EXTENDED_SUGGESTED_BADGES = [
  // ===== THÀNH TÍCH =====
  { label: 'Nhân viên xuất sắc', icon: Trophy, color: 'bg-yellow-500 shadow-yellow-200' },
  { label: 'Nhân viên năng nổ', icon: Zap, color: 'bg-orange-500 shadow-orange-200' },
  { label: 'Tương trợ đồng đội', icon: Heart, color: 'bg-rose-500 shadow-rose-200' },
  { label: 'Thái độ tích cực', icon: Star, color: 'bg-sky-500 shadow-sky-200' },
  { label: 'Làm việc hiệu quả', icon: Target, color: 'bg-emerald-500 shadow-emerald-200' },
  { label: 'Nhiệt huyết cháy bỏng', icon: Flame, color: 'bg-red-500 shadow-red-200' },

  // ===== CẢNH BÁO NHẸ =====
  { label: 'Cần cải thiện đúng giờ', icon: Clock, color: 'bg-amber-500 shadow-amber-200' },
  { label: 'Cần cải thiện thái độ', icon: AlertCircle, color: 'bg-orange-500 shadow-orange-200' },
  { label: 'Chưa hoàn thành checklist', icon: ListChecks, color: 'bg-yellow-600 shadow-yellow-200' },

  // ===== VI PHẠM =====
  { label: 'Đi trễ nhiều lần', icon: TimerOff, color: 'bg-red-500 shadow-red-200' },
  { label: 'Bỏ ca không phép', icon: XCircle, color: 'bg-rose-600 shadow-rose-200' },
  { label: 'Không tuân thủ quy trình', icon: Ban, color: 'bg-slate-700 shadow-slate-300' },
];

export function BadgeAssignmentDialog({ 
  open, 
  onOpenChange, 
  selectedUser, 
  onGrantBadge,
  parentDialogTag = 'root'
}: BadgeAssignmentDialogProps) {
  const [customBadgeLabel, setCustomBadgeLabel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!selectedUser) return null;

  const handleSelectBadge = async (label: string, color?: string) => {
    try {
      setIsSubmitting(true);
      await onGrantBadge(selectedUser, label, color);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dialogTag="badge-assignment-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="rounded-[2.5rem] max-w-[28rem] p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader variant="premium" icon={<Award />} className="text-left">
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">Đánh giá nhân sự</span>
              <div className="h-px w-8 bg-white/20" />
            </div>
            <DialogTitle className="text-3xl font-black tracking-tighter leading-none mb-2">
              Trao <span className="text-primary italic">Huy hiệu</span>
            </DialogTitle>
            <DialogDescription className="text-xs font-bold leading-tight">
              Ghi nhận đóng góp của <span className="text-primary font-black">{selectedUser.displayName}</span> trong công việc.
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogBody className="p-6 md:p-8 space-y-8 bg-zinc-50/50">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                <Sparkles className="w-3 h-3" />
                Đề xuất
              </Label>
              <div className="px-2 py-0.5 rounded-full bg-zinc-100 text-[9px] font-black text-zinc-400 uppercase">10 huy hiệu</div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {EXTENDED_SUGGESTED_BADGES.map((badge) => {
                const Icon = badge.icon;
                return (
                  <Button
                    key={badge.label}
                    variant="outline"
                    className="group relative flex flex-col items-center justify-center gap-2.5 h-28 rounded-3xl border-zinc-200/60 bg-white hover:border-primary hover:bg-zinc-50 transition-all duration-300 shadow-sm hover:shadow-md disabled:opacity-50"
                    onClick={() => handleSelectBadge(badge.label, badge.color)}
                    disabled={isSubmitting}
                  >
                    <div className={cn(
                      "p-3 rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform duration-300", 
                      badge.color
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black text-zinc-600 group-hover:text-primary tracking-tight px-1 text-center">
                      {badge.label}
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-zinc-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-zinc-50 px-3 text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Hoặc</span>
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Huy hiệu tùy chỉnh</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="Nhập tên vinh danh mới..."
                  value={customBadgeLabel}
                  onChange={(e) => setCustomBadgeLabel(e.target.value)}
                  className="h-14 rounded-2xl border-zinc-200 bg-white font-bold px-5 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                />
                {!customBadgeLabel && (
                   <Award className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300 pointer-events-none" />
                )}
              </div>
              <Button 
                disabled={!customBadgeLabel.trim() || isSubmitting}
                onClick={() => {
                  if (customBadgeLabel.trim()) {
                    handleSelectBadge(customBadgeLabel.trim());
                    setCustomBadgeLabel('');
                  }
                }}
                className="h-14 w-14 rounded-2xl bg-zinc-900 hover:bg-black text-white p-0 flex items-center justify-center transition-all shadow-lg active:scale-95 shrink-0"
              >
                <Plus className="w-6 h-6" />
              </Button>
            </div>
            <p className="text-[9px] text-zinc-400 font-bold italic ml-1 leading-relaxed">
              * Tên huy hiệu sẽ được hiển thị ngay trên thẻ nhân viên của hệ thống.
            </p>
          </div>
        </DialogBody>

        <DialogFooter className="p-4 bg-white border-t border-zinc-100 flex justify-center sm:justify-center">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="text-[11px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
