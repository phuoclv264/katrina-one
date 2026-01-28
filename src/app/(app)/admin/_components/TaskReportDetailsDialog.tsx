'use client'

import { format } from "date-fns"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogCancel } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import Image from "@/components/ui/image"
import { useLightbox } from "@/contexts/lightbox-context"
import { Info, User, Clock, Video, CheckCircle } from "lucide-react"
import type { TaskCompletionRecord } from "@/lib/types"

type StaffStatus = {
  userId: string
  userName: string
  shiftLabels: string[]
  status: "completed" | "reported" | "pending"
  completion?: TaskCompletionRecord
}

type TaskSummaryLike = {
  taskId: string
  taskName: string
  description: string
  totalAssigned: number
  completed: number
  reported: number
  pending: number
  staffStatuses: StaffStatus[]
  additionalReports: TaskCompletionRecord[]
}

type TaskReportDetailsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: TaskSummaryLike | null
}

export default function TaskReportDetailsDialog({ open, onOpenChange, task }: TaskReportDetailsDialogProps) {
  const { openLightbox } = useLightbox()

  const handleLightboxOpen = (media: any[] | undefined, index = 0) => {
    if (!media || media.length === 0) return
    const slides = media.map((attachment) =>
      attachment.type === "video"
        ? {
            type: "video" as const,
            sources: [
              { src: attachment.url, type: "video/mp4" },
              { src: attachment.url, type: "video/webm" },
            ],
          }
        : { src: attachment.url },
    )
    openLightbox(slides, index)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dialogTag="admin-task-report-details" parentDialogTag="monthly-list-dialog">
      <DialogContent className="max-w-[720px] p-0 overflow-hidden border-none shadow-2xl bg-card">
        {!task ? (
          <>
            <DialogHeader>
              <DialogTitle>Chi tiết công việc</DialogTitle>
              <DialogDescription>Không tìm thấy dữ liệu</DialogDescription>
            </DialogHeader>
            <DialogBody className="p-6">
              <p className="text-sm text-muted-foreground">Vui lòng thử lại.</p>
            </DialogBody>
            <DialogFooter className="p-4">
              <DialogCancel className="rounded-xl font-bold">Đóng</DialogCancel>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader iconkey="history">
              <div className="flex flex-col items-center justify-center w-full gap-1 pr-6 sm:pr-8">
                <div className="flex items-center justify-center gap-2 text-center">
                  <DialogTitle className="font-black text-base leading-none text-center">{task.taskName}</DialogTitle>
                  {task.description && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors shrink-0">
                          <Info className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 rounded-2xl p-4 shadow-xl border-border bg-popover/95 backdrop-blur-sm z-[110]">
                        <p className="text-sm font-medium leading-relaxed">{task.description}</p>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
                <DialogDescription className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1 font-bold text-center">
                  Chi tiết báo cáo
                </DialogDescription>
              </div>
            </DialogHeader>

            <DialogBody className="p-6 space-y-8">
              

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-[2rem] p-4 text-center border border-emerald-100/50 shadow-sm transition-all">
                  <p className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest mb-1">Đã xong</p>
                  <p className="text-2xl font-black text-emerald-700">{task.completed}</p>
                </div>
                <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-[2rem] p-4 text-center border border-amber-100/50 shadow-sm transition-all">
                  <p className="text-[10px] font-black text-amber-600/60 uppercase tracking-widest mb-1">Đang chờ</p>
                  <p className="text-2xl font-black text-amber-700">{task.pending}</p>
                </div>
                <div className="bg-primary/5 rounded-[2rem] p-4 text-center border border-primary/10 shadow-sm transition-all">
                  <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest mb-1">Chỉ tiêu</p>
                  <p className="text-2xl font-black text-primary">{task.totalAssigned}</p>
                </div>
              </div>

              {(() => {
                const allCompletions = [
                  ...task.staffStatuses
                    .filter((s) => s.status === "completed" || s.status === "reported")
                    .map((s) => ({
                      ...s.completion,
                      completedBy: { userId: s.userId, userName: s.userName },
                      completedAt: s.completion?.completedAt,
                      note: s.completion?.note,
                      media: s.completion?.media,
                      noteCreatedAt: s.completion?.noteCreatedAt,
                    } as any)),
                  ...task.additionalReports,
                ].sort((a, b) => {
                  const timeA = (a.completedAt?.toDate?.().getTime() || a.noteCreatedAt?.toDate?.().getTime() || 0)
                  const timeB = (b.completedAt?.toDate?.().getTime() || b.noteCreatedAt?.toDate?.().getTime() || 0)
                  return timeB - timeA
                })

                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-1 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                        <h4 className="text-sm font-black uppercase tracking-widest text-foreground/70">Lịch sử hoàn thành</h4>
                      </div>
                      <Badge variant="outline" className="font-black rounded-lg bg-background">
                        {allCompletions.length} báo cáo
                      </Badge>
                    </div>

                    <div className="bg-background rounded-[2rem] border shadow-sm overflow-hidden divide-y divide-muted/10">
                      {allCompletions.length > 0 ? (
                        <div className="divide-y divide-muted/10">
                          {allCompletions.map((completion, idx) => (
                            <div key={idx} className="p-5 hover:bg-muted/5 transition-colors group">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center overflow-hidden shrink-0 border border-border/50 group-hover:scale-105 transition-transform">
                                    <User className="h-6 w-6 text-muted-foreground/40" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-black text-base text-foreground break-words">
                                        {completion.completedBy?.userName || "Ẩn danh"}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      {(() => {
                                        const staff = task.staffStatuses.find((s) => s.userId === completion.completedBy?.userId)
                                        if (staff && staff.shiftLabels.length > 0) {
                                          return (
                                            <Badge variant="outline" className="text-[9px] h-4 font-black border-primary/20 bg-primary/5 text-primary px-2 py-0 uppercase shrink-0">
                                              CA {staff.shiftLabels.join(", ")}
                                            </Badge>
                                          )
                                        }
                                        return null
                                      })()}
                                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                                        <Clock className="w-3 h-3" />
                                        {completion.completedAt
                                          ? format(completion.completedAt.toDate ? completion.completedAt.toDate() : new Date(completion.completedAt), "HH:mm, dd/MM")
                                          : completion.noteCreatedAt
                                          ? format(completion.noteCreatedAt.toDate ? completion.noteCreatedAt.toDate() : new Date(completion.noteCreatedAt), "HH:mm, dd/MM")
                                          : "Chưa rõ thời gian"}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {completion.media && completion.media.length > 0 && (
                                <div className="flex flex-wrap gap-2.5 mb-4 px-1">
                                  {completion.media.map((att: any, mIdx: number) => (
                                    <button key={mIdx} onClick={() => handleLightboxOpen(completion.media!, mIdx)} className="relative w-14 h-14 rounded-2xl overflow-hidden border-2 border-muted shadow-sm group/thumb">
                                      {att.type === "video" ? (
                                        <div className="bg-slate-900 w-full h-full flex items-center justify-center">
                                          <Video className="w-5 h-5 text-white" />
                                        </div>
                                      ) : (
                                        <Image src={att.url || "/placeholder.svg"} fill className="object-cover group-hover/thumb:scale-110 transition-transform" alt="" />
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}

                              {completion.note && (
                                <div className="bg-muted/20 rounded-2xl p-4 border border-border/50">
                                  <p className="text-sm text-foreground font-medium leading-relaxed italic">"{completion.note}"</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-16 flex flex-col items-center text-center gap-4">
                          <div className="w-20 h-20 rounded-full bg-muted/20 flex items-center justify-center">
                            <Clock className="w-10 h-10 text-muted-foreground/20" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-base font-black text-muted-foreground/60">Chưa có báo cáo</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}

              {(() => {
                const notDoneUsers = task.staffStatuses.filter((s) => s.status === "pending")
                return (
                  <div className="space-y-4 pb-2">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-6 w-1 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(var(--amber-500),0.5)]" />
                      <h4 className="text-sm font-black uppercase tracking-widest text-foreground/70">Chưa hoàn thành</h4>
                    </div>
                    {notDoneUsers.length > 0 ? (
                      <div className="bg-background rounded-[2rem] border shadow-sm p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {notDoneUsers.map((u, idx) => (
                            <div key={idx} className="bg-muted/10 border border-border/50 rounded-2xl p-4 flex items-center gap-4 hover:bg-muted/20 transition-all hover:scale-[1.02]">
                              <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center shrink-0 shadow-sm">
                                <User className="h-5 w-5 text-muted-foreground/30" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-black text-sm text-foreground break-words leading-tight">{u.userName}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge className="text-[9px] font-black bg-amber-500/10 text-amber-600 border-none h-4 px-1.5 uppercase tracking-tighter shrink-0">
                                    CA {u.shiftLabels.join(", ")}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground/60 font-black uppercase whitespace-nowrap">Đang chờ...</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-emerald-500/5 rounded-[2rem] p-8 border-2 border-dashed border-emerald-500/20 flex flex-col items-center gap-4 text-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                          <CheckCircle className="w-10 h-10 text-emerald-500" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-lg font-black text-emerald-700">Mục tiêu hoàn thành!</p>
                          <p className="text-xs font-bold text-emerald-600/60 uppercase tracking-widest">Tất cả nhân sự đã gửi báo cáo công việc.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </DialogBody>

            <DialogFooter className="p-4">
              <DialogCancel className="rounded-xl font-bold">Đóng</DialogCancel>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
