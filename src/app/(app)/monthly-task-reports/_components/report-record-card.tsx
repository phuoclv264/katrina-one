"use client"

import React, { useState } from "react"
import Image from "next/image"
import { format } from "date-fns"
import {
  Clock,
  User,
  Video,
  Trash2,
  Loader2,
  MessageSquareText,
  ImageIcon,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import { toast } from "@/components/ui/pro-toast"
import { dataStore } from "@/lib/data-store"
import type { TaskCompletionRecord } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface ReportRecordCardProps {
  record: TaskCompletionRecord
  reportedUser?: { userId: string; userName: string }
  isOffShift?: boolean
  shiftInfo?: {
    shiftLabel: string
    timeSlot: { start: string; end: string }
  }
  onDeleteSuccess?: () => void
  onOpenLightbox: (media: any[], index: number) => void
  showTaskName?: boolean
  setReportCardRef?: (key: string, el: HTMLDivElement | null) => void
}

export function ReportRecordCard({
  record,
  reportedUser,
  isOffShift,
  shiftInfo,
  onDeleteSuccess,
  onOpenLightbox,
  showTaskName = false,
  setReportCardRef
}: ReportRecordCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteReport = async () => {
    if (!record.completedBy) return
    setIsDeleting(true)
    try {
      await dataStore.deleteMonthlyTaskCompletion(record.taskId, record.completedBy.userId, record.assignedDate)
      toast.success("Đã xóa báo cáo thành công.")
      onDeleteSuccess?.()
    } catch (error) {
      console.error("Failed to delete report:", error)
      toast.error("Không thể xóa báo cáo.")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleMediaClick = (index: number) => {
    if (!record.media) return
    const slides = record.media.map((att) => {
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
    onOpenLightbox(slides, index)
  }

  const cardClassName = `relative group/card overflow-hidden border transition-all hover:shadow-md rounded-3xl ${
    isOffShift || !record.completedAt
      ? "bg-white/50 dark:bg-zinc-900/50 border-amber-200/50 dark:border-amber-900/30"
      : "bg-white/80 dark:bg-zinc-900/80 border-slate-200/60 dark:border-zinc-800/60 shadow-sm"
  }`

  const scrollId = record.completionId || `monthly-${record.taskId}-${record.assignedDate}-${reportedUser?.userId || 'unknown'}`

  return (
    <Card
      className={cardClassName}
      ref={(el) => {
        if (setReportCardRef) {
          setReportCardRef(scrollId, el)
          if (record.completionId) setReportCardRef(record.completionId, el)
        }
      }}
    >
      <CardContent className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5 flex-1 min-w-0">
            <div className={`h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors shadow-sm ${
              isOffShift || !record.completedAt
                ? "bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800"
                : "bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800"
            }`}>
              {showTaskName ? (
                <CheckCircle2 className={`h-5 w-5 ${
                  isOffShift || !record.completedAt ? "text-amber-500" : "text-emerald-500"
                }`} />
              ) : (
                <User className={`h-5 w-5 ${
                  isOffShift ? "text-amber-500" : "text-emerald-500"
                }`} />
              )}
            </div>
            <div className="min-w-0 flex-1 py-0.5">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-bold text-[15px] text-foreground">
                  {showTaskName ? record.taskName : (reportedUser?.userName || "Không xác định")}
                </span>
                {isOffShift && (
                  <span className="text-[10px] font-black text-amber-500 bg-amber-50 dark:bg-amber-900/50 px-2 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-800 uppercase tracking-tight shrink-0">
                    NGOÀI CA
                  </span>
                )}
              </div>
              <div className="text-[12px] font-semibold text-muted-foreground/60 flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>
                    {record.completedAt ? format(record.completedAt.toDate(), "HH:mm") : "N/A"}
                  </span>
                </div>
                {showTaskName && (
                  <>
                    <span className="opacity-30">•</span>
                    <span>{format(new Date(record.assignedDate), "dd/MM/yyyy")}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
            {!isOffShift && record.completedAt && (
              <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
            )}
            <AlertDialog parentDialogTag="root">
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl text-muted-foreground/30 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all"
                  disabled={isDeleting}
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-xl font-bold">Xác nhận xóa báo cáo?</AlertDialogTitle>
                  <AlertDialogDescription className="text-sm font-medium">
                    Hành động này sẽ xóa vĩnh viễn báo cáo và tất cả bằng chứng đính kèm khỏi hệ thống.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-3 sm:gap-0">
                  <AlertDialogCancel className="rounded-2xl border-slate-200 font-bold">Hủy</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteReport}
                    className="bg-rose-500 hover:bg-rose-600 rounded-2xl font-bold px-6"
                  >
                    {isDeleting ? "Đang xóa..." : "Xác nhận xóa"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {shiftInfo ? (
          <div className="flex items-center gap-2 p-2 bg-secondary/50 dark:bg-primary/10 rounded-lg text-xs">
            <span className="font-medium text-foreground">{shiftInfo.shiftLabel}</span>
            <span className="text-muted-foreground">{shiftInfo.timeSlot.start} - {shiftInfo.timeSlot.end}</span>
          </div>
        ) : isOffShift && (
          <div className="flex items-center gap-2 p-2 bg-amber-100/20 dark:bg-amber-900/10 rounded-lg text-xs text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-3 w-3" />
            <span>Không có ca làm việc trong ngày</span>
          </div>
        )}

        {record.note && (
          <div className="relative p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800/50 group/note transition-all">
            <div className="flex items-center gap-2 mb-2 text-muted-foreground/60">
              <MessageSquareText className="h-3.5 w-3.5" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Ghi chú</span>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed font-medium">
              {record.note}
            </p>
          </div>
        )}

        {record.media && record.media.length > 0 && (
          <div className="space-y-3 pt-1">
            <h4 className="text-[11px] font-black text-muted-foreground/50 uppercase tracking-widest flex items-center gap-2">
              <ImageIcon className="h-3.5 w-3.5" /> Bằng chứng ({record.media.length})
            </h4>
            <div className="grid grid-cols-3 gap-2.5">
              {record.media.map((item, index) => (
                <div
                  key={index}
                  className="relative aspect-square rounded-2xl overflow-hidden cursor-zoom-in group/media shadow-sm border border-slate-200/50 dark:border-zinc-800/50 hover:border-primary/30 transition-all"
                  onClick={() => handleMediaClick(index)}
                >
                   {item.type === "photo" ? (
                    <Image
                      src={item.url || "/placeholder.svg"}
                      alt={`Evidence ${index + 1}`}
                      fill
                      className="object-cover transition-transform duration-500 group-hover/media:scale-110"
                    />
                  ) : item.type === "video" ? (
                    <>
                      <video
                        src={`${item.url}#t=0.1`}
                        preload="metadata"
                        muted
                        playsInline
                        className="w-full h-full object-cover transition-transform duration-500 group-hover/media:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-80 group-hover/media:opacity-100 transition-opacity">
                        <Video className="h-5 w-5 text-white fill-white" />
                      </div>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  )
}
