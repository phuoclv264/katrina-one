"use client"

import React, { useMemo, useState, useEffect } from "react"
import { format } from "date-fns"
import { vi as viLocale } from "date-fns/locale"
import { ClipboardCheck, User, TrendingUp, BarChart3, Star, ChevronLeft, ChevronRight, Calendar, AlertCircle, Clock } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogAction,
} from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ReportRecordCard } from "./report-record-card"
import type { TaskCompletionRecord } from "@/lib/types"

interface StaffReportsDialogProps {
  userName: string
  userId: string
  records: TaskCompletionRecord[]
  unreportedTasks?: { taskName: string; date: string; shiftLabel: string }[]
  isOpen: boolean
  onClose: () => void
  onOpenLightbox: (media: any[], index: number) => void
  setReportCardRef: (key: string, el: HTMLDivElement | null) => void
}

export function StaffReportsDialog({
  userName,
  userId,
  records,
  unreportedTasks = [],
  isOpen,
  onClose,
  onOpenLightbox,
  setReportCardRef
}: StaffReportsDialogProps) {
  const [selectedTaskName, setSelectedTaskName] = useState<string | null>(null)

  // Reset selected task when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedTaskName(null)
    }
  }, [isOpen])

  const groupedByTask = useMemo(() => {
    const map = new Map<string, TaskCompletionRecord[]>()
    records.forEach(rec => {
      const existing = map.get(rec.taskName) || []
      map.set(rec.taskName, [...existing, rec])
    })
    
    // Sort tasks by most recent record
    return Array.from(map.entries()).sort((a, b) => {
      const aLatest = Math.max(...a[1].map(r => new Date(r.assignedDate).getTime()))
      const bLatest = Math.max(...b[1].map(r => new Date(r.assignedDate).getTime()))
      return bLatest - aLatest
    })
  }, [records])

  const totalReportsCount = records.length
  const uniqueTasksCount = groupedByTask.length

  const selectedTaskRecords = useMemo(() => {
    if (!selectedTaskName) return []
    const group = groupedByTask.find(([name]) => name === selectedTaskName)
    return group ? group[1].sort((a, b) => new Date(b.assignedDate).getTime() - new Date(a.assignedDate).getTime()) : []
  }, [selectedTaskName, groupedByTask])

  return (
    <Dialog open={isOpen} onOpenChange={onClose} dialogTag="staff-reports-view" parentDialogTag="root">
      <DialogContent className="max-w-4xl p-0">
        <DialogHeader 
          iconkey={selectedTaskName ? undefined : "user"} 
          variant={selectedTaskName ? "premium" : "default"}
          icon={selectedTaskName ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-white/40 transition-all active:scale-95 shadow-sm"
              onClick={() => setSelectedTaskName(null)}
            >
              <ChevronLeft className="h-6 w-6 transition-transform group-hover:-translate-x-1" />
            </Button>
          ) : undefined}
        >
          <div className="flex flex-col items-start w-full">
            <div className="space-y-1">
              <DialogTitle className="flex items-center gap-2">
                {selectedTaskName ? selectedTaskName : `Báo cáo của ${userName}`}
              </DialogTitle>
              <DialogDescription>
                {selectedTaskName 
                  ? `Chi tiết tất cả báo cáo cho nhiệm vụ này của ${userName}`
                  : "Thống kê chi tiết hiệu suất công việc trong tháng"
                }
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="bg-slate-50/30 dark:bg-zinc-950/20 px-4 sm:px-8 py-0">
          <div className="space-y-8 py-8 min-h-full">
            {!selectedTaskName ? (
              <>
                {/* User Monthly Summary Stats */}
                {totalReportsCount > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card className="rounded-[2rem] border-none shadow-sm bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm border border-slate-100 dark:border-zinc-700">
                            <BarChart3 className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest mb-0.5">TỔNG BÁO CÁO</p>
                            <div className="flex items-baseline gap-1">
                              <span className="text-3xl font-black text-foreground leading-none">{totalReportsCount}</span>
                              <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-50">lần</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-[2rem] border-none shadow-sm bg-white dark:bg-zinc-900 overflow-hidden">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                            <ClipboardCheck className="h-6 w-6 text-amber-500" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-amber-600/60 uppercase tracking-widest mb-0.5">NHIỆM VỤ</p>
                            <div className="flex items-baseline gap-1">
                              <span className="text-3xl font-black text-foreground leading-none">{uniqueTasksCount}</span>
                              <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-50">loại</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-[2rem] border-none shadow-sm bg-white dark:bg-zinc-900 sm:col-span-2 lg:col-span-1">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                            <TrendingUp className="h-6 w-6 text-emerald-500" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest mb-0.5">XẾP HẠNG</p>
                            <div className="flex items-center gap-1.5 pt-0.5">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} className={`h-4 w-4 fill-emerald-500 text-emerald-500 ${i < Math.min(uniqueTasksCount, 5) ? "" : "opacity-20"}`} />
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Unreported Section */}
                {unreportedTasks.length > 0 && (
                  <div className="space-y-4">
                    <div className="px-2">
                      <h3 className="text-[11px] font-black text-amber-600 uppercase tracking-[0.2em]">Chưa hoàn thành ({unreportedTasks.length})</h3>
                    </div>
                    <Card className="rounded-[2.5rem] border-none bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10 shadow-none">
                      <CardContent className="p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {unreportedTasks.map((task, idx) => (
                            <div key={`${task.taskName}-${task.date}-${idx}`} className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-amber-200/50 dark:border-amber-900/10 shadow-sm transition-all hover:border-amber-300">
                              <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                                <AlertCircle className="h-4 w-4 text-amber-500" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-[13px] text-foreground leading-tight">{task.taskName}</p>
                                <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-tighter mt-1">
                                  {format(new Date(task.date), "dd/MM", { locale: viLocale })} • {task.shiftLabel}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="px-2">
                    <h3 className="text-[11px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">Danh sách nhiệm vụ</h3>
                  </div>
                  
                  {groupedByTask.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="p-4 rounded-full bg-slate-100 dark:bg-zinc-900 mb-4">
                        <ClipboardCheck className="h-8 w-8 text-muted-foreground/60" />
                      </div>
                      <p className="text-muted-foreground font-medium">Nhân viên này chưa có báo cáo nào trong tháng.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {groupedByTask.map(([taskName, taskRecords]) => (
                        <Card 
                          key={taskName}
                          className="group relative overflow-hidden rounded-[1.5rem] border-slate-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 hover:border-primary/30 transition-all cursor-pointer hover:shadow-md active:scale-[0.98]"
                          onClick={() => setSelectedTaskName(taskName)}
                        >
                          <CardContent className="p-5 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="h-11 w-11 rounded-[1rem] bg-slate-50 dark:bg-zinc-800 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                                <ClipboardCheck className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-[15px] text-foreground group-hover:text-primary transition-colors">
                                  {taskName}
                                </h4>
                                <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mt-0.5">
                                  {taskRecords.length} báo cáo
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedTaskRecords.map((record) => (
                    <ReportRecordCard
                      key={`${record.taskId}-${record.assignedDate}-${userId}`}
                      record={record}
                      showTaskName={true}
                      onOpenLightbox={onOpenLightbox}
                      setReportCardRef={setReportCardRef}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter variant="muted" className="border-t">
          <DialogAction variant="secondary" onClick={onClose} className="w-full sm:w-auto min-w-[120px] rounded-2xl font-bold">
            Đóng
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
