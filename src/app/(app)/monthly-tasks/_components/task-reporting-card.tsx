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
import { Badge } from "@/components/ui/badge"

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
      <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 whitespace-nowrap">
        Chưa làm
      </Badge>
    )
  }

  if (currentUserCompletion.completedAt) {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 whitespace-nowrap">
        <CheckCircle className="w-3 h-3 mr-1" />
        {format(currentUserCompletion.completedAt.toDate(), "HH:mm")}
      </Badge>
    )
  }

  if (currentUserCompletion.note) {
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800 whitespace-nowrap">
        <AlertCircle className="w-3 h-3 mr-1" />
        Đã báo cáo
      </Badge>
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
      <div className="bg-transparent">
        {assignment.description && (
          <div className="px-4 py-3 border-b border-dashed border-gray-200 dark:border-slate-800">
            <p className="text-sm text-muted-foreground leading-relaxed">{assignment.description}</p>
          </div>
        )}

        {currentUserCompletion?.media && currentUserCompletion.media.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-muted-foreground mb-2">BẰNG CHỨNG ĐÃ GỬI</p>
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {currentUserCompletion.media.map((att, index) => (
                <button
                  key={index}
                  onClick={() => handleOpenLightbox(currentUserCompletion.media!, index)}
                  className="relative w-16 h-16 rounded-lg overflow-hidden group flex-shrink-0 ring-1 ring-border hover:ring-primary transition-all"
                >
                  {att.type === "photo" ? (
                    <Image
                      src={att.url || "/placeholder.svg"}
                      alt={`Evidence ${index + 1}`}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <>
                      <video
                        src={`${att.url}#t=0.1`}
                        preload="metadata"
                        muted
                        playsInline
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <Video className="h-6 w-6 text-white drop-shadow-md" />
                      </div>
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-4 py-4 flex flex-wrap items-center gap-3">
          {currentUserCompletion ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsCameraOpen(true)}
              disabled={isSubmitting}
              className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-medium transition-all active:scale-95"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Thêm ảnh/video
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                onClick={() => setIsCameraOpen(true)}
                disabled={isSubmitting}
                className="h-10 flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md shadow-emerald-100 dark:shadow-none font-semibold transition-all active:scale-95"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                Chụp ảnh báo cáo
              </Button>
              <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    disabled={isSubmitting} 
                    className="h-10 border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-900 dark:text-amber-500 dark:hover:bg-amber-900/20 rounded-xl font-medium transition-all active:scale-95"
                  >
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Báo cáo sự cố
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Báo cáo sự cố</DialogTitle>
                    <DialogDescription>Vui lòng cho biết lý do không thể thực hiện công việc này</DialogDescription>
                  </DialogHeader>
                  <Textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Nhập nội dung báo cáo..."
                    rows={3}
                    className="text-sm"
                  />
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline" size="sm">
                        Hủy
                      </Button>
                    </DialogClose>
                    <Button size="sm" onClick={handleNoteSubmit} disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      Gửi báo cáo
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}

          <div className="ml-auto">
             <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedCompletions(!expandedCompletions)}
                className="text-xs text-muted-foreground h-8"
              >
                {expandedCompletions ? "Thu gọn" : "Lịch sử"} 
                <ChevronDown className={`ml-1 h-3 w-3 transition-transform ${expandedCompletions ? "rotate-180" : ""}`} />
              </Button>
          </div>
        </div>

        {expandedCompletions && (
          <div className="border-t border-gray-100 dark:border-slate-800 px-4 py-3 bg-gray-50/50 dark:bg-slate-900/30 space-y-4 text-xs animate-in slide-in-from-top-2 duration-200">
            {assignment.responsibleUsersByShift.map(({ shiftId, shiftLabel, users }) => (
              <div key={shiftId}>
                <p className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider mb-2">{shiftLabel}</p>
                <div className="space-y-2 pl-2 border-l-2 border-gray-200 dark:border-slate-700">
                  {users.map((responsibleUser) => {
                    const completion = completionsByShift.get(`${shiftId}-${responsibleUser.userId}`)
                    return (
                      <div key={responsibleUser.userId} className="text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center">
                                <User className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <span className="font-medium">{responsibleUser.userName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {completion?.media && completion.media.length > 0 && (
                              <button
                                onClick={() => handleOpenLightbox(completion.media!, 0)}
                                className="text-muted-foreground hover:text-primary p-1 hover:bg-muted rounded-full transition-colors"
                                title="Xem bằng chứng"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {completion?.completedAt ? (
                              <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-emerald-200 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400">
                                {format(completion.completedAt.toDate(), "HH:mm")}
                              </Badge>
                            ) : completion?.note ? (
                              <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-amber-200 text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400">
                                Báo cáo
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-[10px] italic">Chưa làm</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {assignment.otherCompletions.length > 0 && (
              <div>
                <p className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider mb-2">Khác</p>
                <div className="space-y-2 pl-2 border-l-2 border-dashed border-gray-200 dark:border-slate-700">
                  {assignment.otherCompletions.map((completion, idx) => (
                    <div
                      key={completion.completionId || `${completion.completedBy?.userId || 'unknown'}-${idx}`}
                      className="text-xs flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center">
                            <User className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <span className="font-medium">{completion.completedBy?.userName || "Unknown"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {completion.media && completion.media.length > 0 && (
                          <button onClick={() => handleOpenLightbox(completion.media!, 0)} className="text-muted-foreground hover:text-primary p-1 hover:bg-muted rounded-full transition-colors" title="Xem bằng chứng">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {completion.completedAt ? (
                           <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-emerald-200 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400">
                                {format(completion.completedAt.toDate(), "HH:mm")}
                           </Badge>
                        ) : (
                           <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-amber-200 text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400">
                                Báo cáo
                           </Badge>
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
  const { user } = useAuth();

  if (assignments.length === 0) {
    return null
  }

  const getStatusClasses = (assignment: MonthlyTaskAssignment) => {
    if (!user) return "border-l-slate-200 dark:border-l-slate-800";
    
    const completion = 
      assignment.completions.find((c) => c.completedBy?.userId === user.uid) ||
      assignment.otherCompletions.find((c) => c.completedBy?.userId === user.uid);

    if (completion?.completedAt) return "border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10";
    if (completion?.note) return "border-l-amber-500 bg-amber-50/50 dark:bg-amber-900/10";
    return "border-l-slate-300 dark:border-l-slate-700";
  };

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
              className={`border rounded-lg bg-card shadow-sm overflow-hidden border-l-4 ${getStatusClasses(assignment)}`}
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between w-full gap-3 pr-2">
                  <span className="font-semibold text-left text-sm flex-1 leading-snug">{assignment.taskName}</span>
                  <TaskStatus assignment={assignment} />
                </div>
              </AccordionTrigger>
              <AccordionContent className="border-t bg-white dark:bg-slate-950 p-0">
                <IndividualTask assignment={assignment} shiftTemplates={shiftTemplates} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  )
}
