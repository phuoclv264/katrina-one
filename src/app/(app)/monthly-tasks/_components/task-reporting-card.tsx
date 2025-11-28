"use client"
import { useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Camera, Video, CheckCircle, Loader2, User, AlertCircle, Plus, ChevronDown, Eye } from "lucide-react"
import type { MonthlyTaskAssignment, MediaItem, MediaAttachment, TaskCompletionRecord } from "@/lib/types"
import { dataStore } from "@/lib/data-store"
import { toast } from "react-hot-toast"
import CameraDialog from "@/components/camera-dialog"
import Image from "next/image"
import { useAuth } from "@/hooks/use-auth"
import { format } from "date-fns"
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Textarea } from "@/components/ui/textarea"
import { useLightbox } from "@/contexts/lightbox-context"
import { useDataRefresher } from "@/hooks/useDataRefresher"

type TaskReportingCardProps = {
  assignment: MonthlyTaskAssignment
  shiftTemplates: any[]
}

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
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
        <span>Pending</span>
      </div>
    )
  }

  if (currentUserCompletion.completedAt) {
    return (
      <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 uppercase tracking-wide">
        <CheckCircle className="h-3.5 w-3.5" />
        <span>Completed {format(currentUserCompletion.completedAt.toDate(), "HH:mm")}</span>
      </div>
    )
  }

  if (currentUserCompletion.note) {
    return (
      <div className="flex items-center gap-2 text-xs font-medium text-amber-600 uppercase tracking-wide">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>Reported</span>
      </div>
    )
  }

  return null
}

export function IndividualTask({ assignment, shiftTemplates }: TaskReportingCardProps) {
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
      <div className="bg-white dark:bg-slate-950 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 transition-colors">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-800 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {assignment.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{assignment.description}</p>
            )}
          </div>
        </div>

        {currentUserCompletion?.media && currentUserCompletion.media.length > 0 && (
          <div className="px-4 py-2 border-b border-gray-200 dark:border-slate-800 flex items-center gap-2">
            {currentUserCompletion.media.map((att, index) => (
              <button
                key={index}
                onClick={() => handleOpenLightbox(currentUserCompletion.media!, index)}
                className="relative w-12 h-12 rounded-md overflow-hidden group flex-shrink-0 hover:ring-2 ring-offset-2 ring-blue-400 transition-all"
              >
                {att.type === "photo" ? (
                  <Image
                    src={att.url || "/placeholder.svg"}
                    alt={`Evidence ${index + 1}`}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <>
                    <video
                      src={`${att.url}#t=0.1`}
                      preload="metadata"
                      muted
                      playsInline
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Video className="h-5 w-5 text-white" />
                    </div>
                  </>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="px-4 py-3 flex items-center gap-2">
          {currentUserCompletion ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsCameraOpen(true)}
              disabled={isSubmitting}
              className="text-xs h-8"
            >
              {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
              Thêm bằng chứng
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                onClick={() => setIsCameraOpen(true)}
                disabled={isSubmitting}
                className="text-xs h-8 flex-1"
              >
                {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="mr-1 h-3 w-3" />}
                Bằng chứng
              </Button>
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
          )}

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
      </div>

      <CameraDialog isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onSubmit={handleMediaSubmit} />
    </>
  )
}

type TodaysTasksCardProps = {
  assignments: MonthlyTaskAssignment[]
  shiftTemplates: any[]
}

export default function TodaysTasksCard({ assignments, shiftTemplates }: TodaysTasksCardProps) {
  if (assignments.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Công việc định kỳ hôm nay</CardTitle>
        <CardDescription>Bạn có {assignments.length} công việc cần hoàn thành.</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full space-y-3">
          {assignments.map((assignment) => (
            <AccordionItem
              key={assignment.taskId}
              value={assignment.taskId}
              className="border rounded-lg data-[state=open]:shadow-md"
            >
              <AccordionTrigger className="px-4 font-bold text-base hover:no-underline">
                <span className="flex-1 text-left">{assignment.taskName} <TaskStatus assignment={assignment} /></span>
              </AccordionTrigger>
              <AccordionContent className="border-t">
                <IndividualTask assignment={assignment} shiftTemplates={shiftTemplates} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  )
}
