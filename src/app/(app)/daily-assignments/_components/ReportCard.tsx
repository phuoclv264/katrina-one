'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, User, CheckCircle2, MessageSquare, Clock, ShieldCheck } from 'lucide-react';
import type { DailyTaskReport, DailyTask } from '@/lib/types';
import MediaPreview from './MediaPreview';
import { Badge as UiBadge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

type ReportCardProps = {
  task: DailyTask;
  report: DailyTaskReport;
  isHighlighted?: boolean;
  managerNote?: string;
  setManagerNote?: (id: string, note: string) => void;
  onApprove?: (task: DailyTask, report: DailyTaskReport) => void;
  pendingReportId?: string | null;
  canApprove?: boolean;
};

export default function ReportCard({ task, report, isHighlighted, managerNote, setManagerNote, onApprove, pendingReportId, canApprove }: ReportCardProps) {
  const isApproved = report.status === 'manager_approved';

  return (
    <div className={cn(
      "relative rounded-xl border p-3 sm:p-4 transition-all",
      isHighlighted ? 'ring-2 ring-primary shadow-lg' : 'bg-background/50',
      isApproved ? 'border-green-200 bg-green-50/5' : 'border-border shadow-sm'
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-foreground">{report.reporter.userName}</span>
              <UiBadge 
                variant={isApproved ? 'default' : 'secondary'}
                className={cn(
                  "h-4 sm:h-5 px-1 sm:px-1.5 text-[8px] sm:text-[10px] font-bold uppercase",
                  isApproved && "bg-green-500"
                )}
              >
                {isApproved ? 'Duyệt' : 'Gửi'}
              </UiBadge>
            </div>
            <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-muted-foreground mt-0.5 opacity-80">
              <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              {report.assignedDate}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 sm:mt-3 relative">
        {report.content && (
          <div className="rounded-lg bg-muted/30 p-2.5 sm:p-3 italic text-xs sm:text-sm text-foreground/80 leading-relaxed border-l-2 border-primary/20">
            {report.content}
          </div>
        )}
        <div className="mt-2">
          <MediaPreview media={report.media} />
        </div>
      </div>

      {isApproved && report.managerNote && (
        <div className="mt-2 sm:mt-3 rounded-lg border border-green-100 bg-green-50/30 p-2.5 sm:p-3">
          <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-green-700 mb-1">
            <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            Giao: {report.reviewedBy?.userName || 'Quản lý'} feedback
          </div>
          <p className="text-xs sm:text-sm text-green-800/80">{report.managerNote}</p>
        </div>
      )}

      {canApprove && !isApproved && (
        <div className="mt-3 sm:mt-4 border-t pt-3 sm:pt-4 flex flex-col gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            Duyệt báo cáo
          </div>
          <Textarea
            placeholder="Phản hồi..."
            value={managerNote || ''}
            onChange={(e) => setManagerNote && setManagerNote(report.id, e.target.value)}
            className="text-xs sm:text-sm bg-background border-muted focus-visible:ring-primary/20 resize-none h-16 sm:h-20"
            rows={2}
          />
          <div className="flex justify-end mt-1">
            <Button
              size="sm"
              onClick={() => onApprove && onApprove(task, report)}
              disabled={pendingReportId === report.id}
              className="px-4 font-bold text-[10px] sm:text-xs h-8 sm:h-9 w-full sm:w-auto"
            >
              {pendingReportId === report.id ? <Loader2 className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              Duyệt hoàn tất
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

