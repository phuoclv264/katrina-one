
"use client"
import { useState, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Camera, Video, CheckCircle, Loader2, AlertCircle, Plus, ChevronDown, Eye, PlayCircle, ClipboardCheck, User } from "lucide-react"
import type { MonthlyTaskAssignment, MediaItem, MediaAttachment, TaskCompletionRecord } from "@/lib/types"
import { dataStore } from "@/lib/data-store"
import { toast } from "react-hot-toast"
import CameraDialog from "@/components/camera-dialog"
import Image from "next/image"
import { useAuth } from "@/hooks/use-auth"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogHeader,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useLightbox } from "@/contexts/lightbox-context"
import { useDataRefresher } from "@/hooks/useDataRefresher"
import { format } from "date-fns"

function IndividualTask({ assignment, shiftTemplates }: { assignment: MonthlyTaskAssignment, shiftTemplates: any[] }) {
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { openLightbox } = useLightbox()
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false)
  const [noteContent, setNoteContent] = useState("")
  const [expandedCompletions, setExpandedCompletions] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleDataRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1)
  }, [])

  useDataRefresher(handleDataRefresh)

  const handleMediaSubmit = async (media: MediaItem[]) => {
    if (media.length === 0) return
    setIsSubmitting(true)
    if (!user) return
    try {
      await dataStore.updateMonthlyTaskCompletionStatus(
        assignment.taskId,
        assignment.taskName,
        { userId: user.uid, userName: user.displayName },
        new Date(assignment.assignedDate),
        true,
        media,
      )
      toast.success(`Đã báo cáo hoàn thành công việc: "${assignment.taskName}"`)
    } catch (error) {
      console.error("Failed to report task completion:", error)
      toast.error("Không thể báo cáo hoàn thành công việc.")
    } finally {
      setIsSubmitting(false)
      setIsCameraOpen(false)
    }
  }

  const handleNoteSubmit = async () => {
    if (!noteContent.trim() || !user) {
      toast.error("Vui lòng nhập nội dung báo cáo.")
      return
    }
    setIsSubmitting(true)
    try {
      await dataStore.updateMonthlyTaskCompletionStatus(
        assignment.taskId,
        assignment.taskName,
        { userId: user.uid, userName: user.displayName },
        new Date(assignment.assignedDate),
        !!currentUserCompletion?.completedAt,
        [],
        noteContent,
      )
      toast.success("Đã gửi báo cáo sự cố.")
      setIsNoteDialogOpen(false)
    } catch (error) {
      toast.error("Không thể gửi báo cáo sự cố.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const createLightboxSlides = (media: MediaAttachment[]) =>
    media.map((att) => {
      if (att.type === "video") {
        return {
          type: "video" as const,
          sources: [
            { src: att.url, type: "video/mp4" },
            { src: att.url, type: "video/webm" },
          ],
        }
      }
      return { src: att.url }
    })

  const handleOpenLightbox = (media: MediaAttachment[], index: number) => {
    openLightbox(createLightboxSlides(media), index)
  }

  const currentUserCompletion =
    assignment.completions.find((c) => c.completedBy?.userId === user?.uid) ||
    assignment.otherCompletions.find((c) => c.completedBy?.userId === user?.uid)

  const isCompleted = !!currentUserCompletion?.completedAt;

  const parseTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(":").map(Number)
    return hours + minutes / 60
  }

  const completionsByShift = useMemo(() => {
    const assignedCompletions = new Map<string, TaskCompletionRecord>()

    assignment.completions.forEach((completion) => {
      if (!completion.completedAt || assignedCompletions.has(completion.completedBy!.userId)) {
        return
      }

      const completionHour = completion.completedAt.toDate().getHours()
      let bestShiftId: string | null = null
      let minDistance = Number.POSITIVE_INFINITY

      assignment.responsibleUsersByShift.forEach((shift) => {
        if (shift.users.some((u) => u.userId === completion.completedBy?.userId)) {
          const templateId = shift.shiftId.split("_").slice(2).join("_")
          const template = shiftTemplates.find((t) => t.id === templateId)

          if (template && template.timeSlot) {
            const startHour = parseTime(template.timeSlot.start)
            const endHour = parseTime(template.timeSlot.end)

            if (completionHour >= startHour && completionHour < endHour) {
              minDistance = 0
              bestShiftId = shift.shiftId
            } else {
              const shiftMidpoint = (startHour + endHour) / 2
              const distance = Math.abs(completionHour - shiftMidpoint)
              if (distance < minDistance) {
                minDistance = distance
                bestShiftId = shift.shiftId
              }
            }
          }
        }
      })
      if (bestShiftId) {
        assignedCompletions.set(`${bestShiftId}-${completion.completedBy!.userId}`, completion)
      }
    })
    return assignedCompletions
  }, [assignment.completions, assignment.responsibleUsersByShift, shiftTemplates, refreshKey])

  return (
    <>
      <div className="group bg-surface-light dark:bg-surface-dark p-3.5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800 transition-colors cursor-pointer flex items-center gap-3">
        <button
            onClick={() => setIsCameraOpen(true)}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center group-hover:border-primary transition-colors flex-shrink-0 ${isCompleted ? 'bg-primary border-primary' : 'border-gray-300 dark:border-gray-600'}`}
        >
            {isCompleted && <CheckCircle className="w-4 h-4 text-white" />}
        </button>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm leading-snug">{assignment.taskName}</h3>
          {assignment.description && <p className="text-[11px] text-text-sub dark:text-gray-400 mt-0.5">{assignment.description}</p>}
        </div>
        <button
            onClick={() => setExpandedCompletions(!expandedCompletions)}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors p-1.5 hover:bg-muted rounded"
            title="Show all completions"
          >
            <span className="flex items-center">
              {expandedCompletions ? "Thu gọn" : "Chi tiết"} <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${expandedCompletions ? "rotate-180" : ""}`} />
            </span>
          </button>
      </div>
      {expandedCompletions && (
          <div className="border-t border-gray-200 dark:border-slate-800 px-4 py-3 bg-gray-50 dark:bg-slate-900/50 space-y-3 text-xs max-h-96 overflow-y-auto">
            {assignment.responsibleUsersByShift.map(({ shiftId, shiftLabel, users }) => (
              <div key={shiftId}>
                <p className="font-semibold text-muted-foreground text-xs uppercase mb-2">{shiftLabel}</p>
                <div className="space-y-2 pl-2 border-l border-gray-300 dark:border-slate-700">
                  {users.map((responsibleUser) => {
                    const completion = completionsByShift.get(`${shiftId}-${responsibleUser.userId}`)
                    return (
                      <div key={responsibleUser.userId} className="text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{responsibleUser.userName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {completion?.media && completion.media.length > 0 && (
                              <button
                                onClick={() => handleOpenLightbox(completion.media!, 0)}
                                className="text-muted-foreground hover:text-primary"
                                title="Xem bằng chứng"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {completion?.completedAt ? (
                              <span className="text-emerald-600 font-medium w-4 text-center">✓</span>
                            ) : completion?.note ? (
                              <span className="text-amber-600 w-4 text-center">⚠</span>
                            ) : (
                              <span className="text-muted-foreground w-4 text-center">—</span>
                            )}
                          </div>
                        </div>
                        {completion?.completedAt && (
                          <div className="text-muted-foreground mt-0.5 ml-4">
                            {format(completion.completedAt.toDate(), "HH:mm")}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {assignment.otherCompletions.length > 0 && (
              <div>
                <p className="font-semibold text-muted-foreground text-xs uppercase mb-2">Khác</p>
                <div className="space-y-1 pl-2 border-l border-dashed border-gray-300 dark:border-slate-700">
                  {assignment.otherCompletions.map((completion) => (
                    <div
                      key={completion.completedBy?.userId || "unknown"}
                      className="text-xs flex items-center justify-between"
                    >
                      <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{completion.completedBy?.userName || "Unknown"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {completion.media && completion.media.length > 0 && (
                          <button onClick={() => handleOpenLightbox(completion.media!, 0)} className="text-muted-foreground hover:text-primary" title="Xem bằng chứng">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {completion.completedAt ? (
                          <span className="text-emerald-600 font-medium w-4 text-center">✓</span>
                        ) : (
                          <span className="text-amber-600 w-4 text-center">⚠</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      <CameraDialog isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onSubmit={handleMediaSubmit} />
      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={isSubmitting} className="text-xs h-8 bg-transparent">
            <AlertCircle className="mr-1 h-3 w-3" />
            Báo cáo
            </Button>
        </DialogTrigger>
        <DialogContent>
            <DialogHeader>
            <DialogTitle>Báo cáo</DialogTitle>
            <DialogDescription>Báo cáo lý do không thực hiện công việc</DialogDescription>
            </DialogHeader>
            <Textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Describe the issue..."
            rows={3}
            className="text-sm"
            />
            <DialogFooter>
            <DialogClose asChild>
                <Button variant="outline" size="sm">
                Cancel
                </Button>
            </DialogClose>
            <Button size="sm" onClick={handleNoteSubmit} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Submit Report
            </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

type TodaysTasksCardProps = {
  assignments: MonthlyTaskAssignment[]
  shiftTemplates: any[]
}

export default function TodaysTasksCard({ assignments, shiftTemplates }: TodaysTasksCardProps) {
    const { user } = useAuth()

    const completedCount = useMemo(() => {
        if (!user) return 0;
        return assignments.filter(a =>
            a.completions.some(c => c.completedBy?.userId === user.uid && c.completedAt) ||
            a.otherCompletions.some(c => c.completedBy?.userId === user.uid && c.completedAt)
        ).length;
    }, [assignments, user]);

    const progress = assignments.length > 0 ? (completedCount / assignments.length) * 100 : 0;

  if (assignments.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-5 shadow-soft border border-blue-100 dark:border-blue-900/50 relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-full z-0"></div>
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 p-2.5 rounded-xl">
                            <ClipboardCheck className="text-2xl" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Checklist Công Việc</h2>
                            <p className="text-xs text-text-sub dark:text-gray-400">Ưu tiên hôm nay</p>
                        </div>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {completedCount}
                            <span className="text-gray-300 dark:text-gray-600 text-base font-medium">/{assignments.length}</span>
                        </span>
                    </div>
                </div>
                <div className="space-y-3">
                    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                        <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{width: `${progress}%`}}></div>
                    </div>
                    <Button className="w-full bg-primary hover:bg-primary-dark text-white py-3.5 px-4 rounded-xl font-bold shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]">
                        <PlayCircle />
                        Bắt đầu thực hiện
                    </Button>
                </div>
            </div>
        </div>
        <div>
            <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-sm font-semibold text-text-sub dark:text-gray-400 uppercase tracking-wide text-[11px]">Danh sách công việc</h3>
                <button className="text-primary text-xs font-bold hover:underline">Xem tất cả</button>
            </div>
            <div className="space-y-2">
                {assignments.map((assignment) => (
                    <IndividualTask key={assignment.taskId} assignment={assignment} shiftTemplates={shiftTemplates} />
                ))}
            </div>
        </div>
    </div>
  )
}
