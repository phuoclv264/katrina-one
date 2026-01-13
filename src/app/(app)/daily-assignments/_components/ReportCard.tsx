'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import type { DailyTaskReport, DailyTask } from '@/lib/types';
import MediaPreview from './MediaPreview';
import { Badge as UiBadge } from '@/components/ui/badge';

type ReportCardProps = {
  task: DailyTask;
  report: DailyTaskReport;
  isHighlighted?: boolean;
  managerNote?: string;
  setManagerNote?: (id: string, note: string) => void;
  onApprove?: (task: DailyTask, report: DailyTaskReport) => void;
  pendingReportId?: string | null;
  userRole?: string | undefined;
};

export default function ReportCard({ task, report, isHighlighted, managerNote, setManagerNote, onApprove, pendingReportId, userRole }: ReportCardProps) {
  return (
    <div className={`rounded-lg border p-3 ${isHighlighted ? 'ring-2 ring-primary' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <UiBadge variant="outline">{report.reporter.userName}</UiBadge>
        <UiBadge variant={report.status === 'manager_approved' ? 'default' : 'secondary'}>
          {report.status === 'manager_approved' ? 'Đã duyệt' : report.status === 'rejected' ? 'Từ chối' : 'Đã gửi'}
        </UiBadge>
        <span className="text-xs text-muted-foreground">{report.assignedDate}</span>
      </div>
      {report.content && <p className="mt-2 text-sm text-muted-foreground">{report.content}</p>}

      <MediaPreview media={report.media} />

      {userRole && (userRole === 'Quản lý' || userRole === 'Chủ nhà hàng') && report.status !== 'manager_approved' && (
        <div className="mt-3 flex flex-col gap-2">
          <Textarea
            placeholder="Ghi chú khi duyệt (tuỳ chọn)"
            value={managerNote || ''}
            onChange={(e) => setManagerNote && setManagerNote(report.id, e.target.value)}
            className="text-sm"
            rows={2}
          />
          <div>
            <Button
              size="sm"
              onClick={() => onApprove && onApprove(task, report)}
              disabled={pendingReportId === report.id}
              className="self-start"
            >
              {pendingReportId === report.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Đánh dấu hoàn tất
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
