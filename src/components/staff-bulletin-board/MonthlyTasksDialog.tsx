"use client";

import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import type { MediaItem, MonthlyTaskAssignment } from "@/lib/types";
import { TaskReportingView } from "@/components/task-reporting-view";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";

export type MonthlyTasksDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignments: MonthlyTaskAssignment[];
  getStatus: (assignment: MonthlyTaskAssignment) => { done: boolean; reported: boolean };
  onSubmitMedia: (assignment: MonthlyTaskAssignment, media: MediaItem[], note?: string) => Promise<void>;
  onSubmitNote: (assignment: MonthlyTaskAssignment, note: string, markCompleted: boolean) => Promise<void>;
};

function TaskStatus({ assignment }: { assignment: MonthlyTaskAssignment }) {
  const { user } = useAuth();

  const currentUserCompletion = useMemo(() => {
    if (!user) return null;
    return (
      assignment.completions.find((c) => c.completedBy?.userId === user.uid) ||
      assignment.otherCompletions.find((c) => c.completedBy?.userId === user.uid)
    );
  }, [assignment.completions, assignment.otherCompletions, user]);

  if (!currentUserCompletion) {
    return (
      <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900/50 dark:text-slate-400 dark:border-slate-800 font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap">
        Chưa làm
      </Badge>
    )
  }

  if (currentUserCompletion.completedAt) {
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50 font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap shadow-sm shadow-emerald-100/50 dark:shadow-none">
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          {format(currentUserCompletion.completedAt.toDate(), "HH:mm")}
        </span>
      </Badge>
    )
  }

  if (currentUserCompletion.note) {
    return (
      <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50 font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap shadow-sm shadow-amber-100/50 dark:shadow-none">
        <AlertCircle className="w-3.5 h-3.5 mr-1.5 fill-amber-50 transition-colors" />
        Đã báo cáo
      </Badge>
    )
  }

  return (
    <Badge 
      variant="outline" 
      className="bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 transition-all font-black px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm shadow-primary/5 uppercase tracking-tighter text-[9px] animate-pulse"
    >
      Cần làm
    </Badge>
  )
}

export default function MonthlyTasksDialog({ open, onOpenChange, assignments, getStatus, onSubmitMedia, onSubmitNote }: MonthlyTasksDialogProps) {
  const { user } = useAuth();
  const [selectedAssignment, setSelectedAssignment] = useState<MonthlyTaskAssignment | null>(null);

  // Update selectedAssignment when assignments change to keep dialog data fresh
  useEffect(() => {
    if (selectedAssignment) {
      const updatedAssignment = assignments.find(a => a.taskId === selectedAssignment.taskId);
      if (updatedAssignment) {
        setSelectedAssignment(updatedAssignment);
      }
    }
  }, [assignments, selectedAssignment]);

  const handleBack = () => {
    setSelectedAssignment(null);
  };

  const getStatusItemClasses = (assignment: MonthlyTaskAssignment) => {
    if (!user) return "border-slate-100 dark:border-slate-800";

    const completion =
      assignment.completions.find((c) => c.completedBy?.userId === user.uid) ||
      assignment.otherCompletions.find((c) => c.completedBy?.userId === user.uid);

    if (completion?.completedAt) return "border-emerald-200/50 dark:border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-500/5 shadow-sm shadow-emerald-100/20";
    if (completion?.note) return "border-amber-200/50 dark:border-amber-500/20 bg-amber-50/30 dark:bg-amber-500/5 shadow-sm shadow-amber-100/20";
    return "border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/50";
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (!val) setSelectedAssignment(null);
    }} dialogTag="monthly-list-dialog" parentDialogTag="root">
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogTitle className="sr-only">
          {selectedAssignment ? selectedAssignment.taskName : "Công việc hàng ngày"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Chi tiết nhiệm vụ và báo cáo hàng ngày
        </DialogDescription>
        {!selectedAssignment ? (
          <div className="flex flex-col h-full overflow-hidden">
            <DialogHeader variant="premium" icon={<ClipboardList className="h-5 w-5" strokeWidth={2.5} />}>
              <DialogTitle className="flex items-center gap-3">
                <div>
                  <div className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none">Công việc hàng ngày</div>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                    {assignments.length} đầu việc chờ xử lý
                  </div>
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="px-4 py-4 flex-1 overflow-y-auto space-y-3 min-h-[300px] max-h-[70vh]">
              {assignments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-10 italic">Không có nhiệm vụ nào cho bạn hôm nay.</p>
              )}
              {assignments.map((assignment) => (
                <div
                  key={assignment.taskId}
                  onClick={() => setSelectedAssignment(assignment)}
                  className={`group relative flex flex-col gap-3 p-4 border rounded-[32px] cursor-pointer transition-all duration-300 active:scale-[0.97] hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1.5 ${getStatusItemClasses(assignment)}`}
                >
                  {/* Header: Meta & Status Badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-1.5 h-6 rounded-full bg-primary/20 group-hover:bg-primary transition-colors duration-300" />
                      <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">
                        Nhiệm vụ
                      </span>
                    </div>
                    <div className="transform group-hover:scale-110 transition-transform duration-300">
                      <TaskStatus assignment={assignment} />
                    </div>
                  </div>

                  {/* Body: Full Task Name */}
                  <div className="flex-1 py-1">
                    <h3 className="text-lg font-extrabold leading-tight text-slate-900 dark:text-white group-hover:text-primary transition-colors duration-300 break-words">
                      {assignment.taskName}
                    </h3>
                  </div>

                  {/* Footer: Interaction Hint */}
                  <div className="flex items-center justify-between border-t border-slate-100/50 dark:border-slate-800/30 pt-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-primary transition-colors" />
                      </div>
                      <p className="text-[12px] text-slate-400 dark:text-slate-500 font-bold italic tracking-tight">
                        Nhấn để báo cáo kết quả
                      </p>
                    </div>
                  </div>

                  {/* Subtle outer glow on hover */}
                  <div className="absolute inset-0 rounded-[32px] border-2 border-primary/0 group-hover:border-primary/5 transition-colors pointer-events-none" />
                </div>
              ))}
            </div>
            <DialogFooter className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
              <Button 
                variant="ghost" 
                className="w-full rounded-[20px] font-black text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors uppercase tracking-widest text-[11px]"
                onClick={() => onOpenChange(false)}
              >
                Đóng cửa sổ
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <TaskReportingView
            assignment={selectedAssignment}
            onBack={handleBack}
            onClose={() => onOpenChange(false)}
            onSubmitMedia={onSubmitMedia}
            onSubmitNote={onSubmitNote}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
