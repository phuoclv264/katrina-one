'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Camera, ImageIcon, Send, CalendarDays, Users, Loader2 } from 'lucide-react';
import MediaPreview from './MediaPreview';
import type { DailyTask, DailyTaskReport, MediaItem } from '@/lib/types';

type TaskCardProps = {
  task: DailyTask;
  reports: DailyTaskReport[];
  canSubmit: boolean;
  pendingMedia: MediaItem[];
  pendingNote: string;
  onSetPendingNote: (taskId: string, note: string) => void;
  onAddProofMedia: (taskId: string, media: MediaItem[]) => void;
  onSubmitReport: (task: DailyTask) => void;
  onSetActiveTaskForProof: (taskId: string | null) => void;
  pendingReportId?: string | null;
};

export default function TaskCard({ task, reports, canSubmit, pendingMedia, pendingNote, onSetPendingNote, onAddProofMedia, onSubmitReport, onSetActiveTaskForProof, pendingReportId }: TaskCardProps) {
  return (
    <Card key={task.id} className="border shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              {task.title}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {task.assignedDate}
            </CardDescription>
          </div>
          <Badge variant={task.status === 'completed' ? 'default' : task.status === 'in_review' ? 'secondary' : 'outline'}>
            {task.status === 'completed' ? 'Đã hoàn tất' : task.status === 'in_review' ? 'Đang duyệt' : 'Mới'}
          </Badge>
        </div>
        <p className="text-sm leading-relaxed text-foreground/80">{task.description}</p>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {task.targetMode === 'roles' ? `Vai trò: ${(task.targetRoles || []).join(', ')}` : `Chỉ định: ${(task.targetUserIds || []).length} người`}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {task.assignedDate}
          </Badge>
        </div>
        <MediaPreview media={task.media} />
      </CardHeader>
      <CardContent className="space-y-4">
        {reports.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm font-semibold text-muted-foreground">Báo cáo đã nhận</div>
            <div className="space-y-3">
              {/* Parent will render ReportCard instances */}
            </div>
          </div>
        )}

        {canSubmit && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Camera className="h-4 w-4" />
              Gửi báo cáo hoàn thành
            </div>
            <Textarea
              placeholder="Mô tả công việc đã làm..."
              value={pendingNote}
              onChange={(e) => onSetPendingNote(task.id, e.target.value)}
              rows={3}
            />
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Button size="sm" variant="outline" onClick={() => onSetActiveTaskForProof(task.id)}>
                <ImageIcon className="mr-2 h-4 w-4" />Thêm ảnh/video
              </Button>
              {pendingMedia.length > 0 && <span>Đã thêm {pendingMedia.length} tệp</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => onSubmitReport(task)}
                disabled={pendingReportId === task.id}
                className="bg-primary text-white hover:bg-primary/90"
              >
                {pendingReportId === task.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Gửi báo cáo
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
