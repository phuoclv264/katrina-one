"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertCircle } from "lucide-react"
import type { MonthlyTaskAssignment, MediaItem } from "@/lib/types"
import { useAuth } from "@/hooks/use-auth"
import { format } from "date-fns"
import { TaskReportingDialog } from "./task-reporting-dialog"
import { dataStore } from "@/lib/data-store"
import { toast } from "react-hot-toast"

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

  return null
}

type TodaysTasksCardProps = {
  assignments: MonthlyTaskAssignment[];
  shiftTemplates: any[];
};

export default function TodaysTasksCard({ assignments, shiftTemplates }: TodaysTasksCardProps) {
  const { user, todaysShifts, activeShifts, isOnActiveShift } = useAuth();
  const [selectedAssignment, setSelectedAssignment] = useState<MonthlyTaskAssignment | null>(null);

  const visibleAssignments = useMemo(() => {
    if (!user) return [] as MonthlyTaskAssignment[];

    const userIsOnActiveShift = Boolean(isOnActiveShift) || !!(activeShifts || []).some(s => s.assignedUsers.some(u => u.userId === user.uid));

    if (userIsOnActiveShift) {
      return assignments.filter(a =>
        a.responsibleUsersByShift.some(s => s.users.some(u => u.userId === user.uid)) ||
        a.completions.some(c => c.completedBy?.userId === user.uid) ||
        a.otherCompletions.some(c => c.completedBy?.userId === user.uid)
      );
    }

    const userRoles = [user.role, ...(user.secondaryRoles || [])];
    return assignments.filter(a =>
      a.completions.some(c => c.completedBy?.userId === user.uid) ||
      a.otherCompletions.some(c => c.completedBy?.userId === user.uid) ||
      (a.appliesToRole === 'Tất cả') ||
      (!!a.appliesToRole && userRoles.includes(a.appliesToRole as any))
    );
  }, [assignments, user, todaysShifts, activeShifts, isOnActiveShift]);

  if (visibleAssignments.length === 0) {
    return null
  }

  const handleSubmitMedia = async (assignment: MonthlyTaskAssignment, media: MediaItem[], note?: string) => {
    if (!user) throw new Error("Missing user")
    await dataStore.updateMonthlyTaskCompletionStatus(
      assignment.taskId,
      assignment.taskName,
      { userId: user.uid, userName: user.displayName || user.email || "Ẩn danh" },
      new Date(assignment.assignedDate),
      true,
      media,
      note,
    )
  }

  const handleSubmitNote = async (assignment: MonthlyTaskAssignment, note: string, markCompleted: boolean) => {
    if (!user) throw new Error("Missing user")
    await dataStore.updateMonthlyTaskCompletionStatus(
      assignment.taskId,
      assignment.taskName,
      { userId: user.uid, userName: user.displayName || user.email || "Ẩn danh" },
      new Date(assignment.assignedDate),
      markCompleted,
      [],
      note,
    )
  }

  const getStatusItemClasses = (assignment: MonthlyTaskAssignment) => {
    if (!user) return "border-slate-100 dark:border-slate-800";

    const completion =
      assignment.completions.find((c) => c.completedBy?.userId === user.uid) ||
      assignment.otherCompletions.find((c) => c.completedBy?.userId === user.uid);

    if (completion?.completedAt) return "border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/20 dark:bg-emerald-950/5 shadow-sm shadow-emerald-100/50";
    if (completion?.note) return "border-amber-100 dark:border-amber-900/30 bg-amber-50/20 dark:bg-amber-950/5 shadow-sm shadow-amber-100/50";
    return "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50";
  };

  return (
    <>
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100">CÔNG VIỆC HÀNG NGÀY</CardTitle>
              <CardDescription className="font-medium text-slate-500">
                Bạn có <span className="text-primary font-bold">{visibleAssignments.length}</span> đầu việc trong hôm nay
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-1 gap-3">
            {visibleAssignments.map((assignment) => (
              <div
                key={assignment.taskId}
                onClick={() => setSelectedAssignment(assignment)}
                className={`flex flex-col gap-3 p-4 border rounded-[28px] cursor-pointer transition-all active:scale-[0.98] hover:shadow-lg dark:hover:shadow-none hover:-translate-y-1 ${getStatusItemClasses(assignment)}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-sm leading-snug text-slate-800 dark:text-slate-100 line-clamp-2">
                      {assignment.taskName}
                    </span>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1 uppercase tracking-tight">Nhấn để xem chi tiết & báo cáo</p>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    <TaskStatus assignment={assignment} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {selectedAssignment && (
        <TaskReportingDialog
          assignment={selectedAssignment}
          onSubmitMedia={async (assignment, media, note) => {
            try {
              await handleSubmitMedia(assignment, media, note)
              toast.success("Đã gửi ảnh/video")
              setSelectedAssignment(null)
            } catch (error) {
              console.error("Error submitting media", error)
              toast.error("Gửi ảnh/video thất bại")
            }
          }}
          onSubmitNote={async (assignment, note, markCompleted) => {
            try {
              await handleSubmitNote(assignment, note, markCompleted)
              toast.success(markCompleted ? "Đã hoàn thành" : "Đã gửi ghi chú")
              if (markCompleted) {
                setSelectedAssignment(null)
              }
            } catch (error) {
              console.error("Error submitting note", error)
              toast.error("Gửi ghi chú thất bại")
            }
          }}
          isOpen={!!selectedAssignment}
          onOpenChange={(open) => !open && setSelectedAssignment(null)}
        />
      )}
    </>
  )
}
