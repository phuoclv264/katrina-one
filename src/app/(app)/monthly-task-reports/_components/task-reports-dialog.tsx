"use client"

import React, { useMemo, useState, useEffect } from "react"
import { format } from "date-fns"
import { vi as viLocale } from "date-fns/locale"
import { Calendar, Users, AlertCircle, ChevronLeft, BarChart3, CheckCircle2, ChevronRight, Clock } from "lucide-react"
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
import { ReportRecordCard } from "./report-record-card"
import type { TaskCompletionRecord, AssignedUser } from "@/lib/types"
import { Button } from "@/components/ui/button"

type DailyAssignment = {
  date: string
  assignedUsers: AssignedUser[]
  assignedUsersByShift: {
    shiftId: string
    shiftLabel: string
    timeSlot: { start: string; end: string }
    users: AssignedUser[]
  }[]
  completions: TaskCompletionRecord[]
}

interface TaskReportsDialogProps {
  taskName: string
  dailyAssignments: DailyAssignment[]
  isOpen: boolean
  onClose: () => void
  onOpenLightbox: (media: any[], index: number) => void
  setReportCardRef: (key: string, el: HTMLDivElement | null) => void
}

export function TaskReportsDialog({
  taskName,
  dailyAssignments,
  isOpen,
  onClose,
  onOpenLightbox,
  setReportCardRef
}: TaskReportsDialogProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Reset selected date when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedDate(null)
    }
  }, [isOpen])

  const sortedAssignments = useMemo(() => {
    return [...dailyAssignments].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [dailyAssignments])

  const selectedAssignment = useMemo(() => {
    return sortedAssignments.find(a => a.date === selectedDate)
  }, [selectedDate, sortedAssignments])

  const totalReportsCount = useMemo(() => {
    return dailyAssignments.reduce((acc, curr) => acc + curr.completions.length, 0)
  }, [dailyAssignments])

  const activeDaysCount = dailyAssignments.filter(a => a.completions.length > 0).length

  return (
    <Dialog open={isOpen} onOpenChange={onClose} dialogTag="task-reports-view" parentDialogTag="root">
      <DialogContent className="max-w-4xl p-0">
        <DialogHeader 
          iconkey={selectedDate ? undefined : "check"} 
          variant={selectedDate ? "premium" : "default"}
          icon={selectedDate ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-white/40 transition-all active:scale-95 shadow-sm"
              onClick={() => setSelectedDate(null)}
            >
              <ChevronLeft className="h-6 w-6 transition-transform group-hover:-translate-x-1" />
            </Button>
          ) : undefined}
        >
          <div className="flex flex-col items-start w-full">
            <div className="space-y-1">
              <DialogTitle className="flex items-center gap-2">
                {selectedDate 
                  ? format(new Date(selectedDate), "EEEE, dd/MM/yyyy", { locale: viLocale })
                  : taskName
                }
              </DialogTitle>
              <DialogDescription>
                {selectedDate 
                  ? `Danh sách báo cáo hoàn thành nhiệm vụ "${taskName}"`
                  : "Thống kê chi tiết các lượt hoàn thành theo ngày"
                }
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="bg-slate-50/30 dark:bg-zinc-950/20 px-4 sm:px-8 py-0">
          <div className="space-y-8 py-8 min-h-full">
            {!selectedDate ? (
              <>
                {/* Task Summary Dashboard */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card className="rounded-[2rem] border-none shadow-sm bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm border border-slate-100 dark:border-zinc-700">
                          <BarChart3 className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest mb-0.5">TỔNG LƯỢT LÀM</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-foreground leading-none">{totalReportsCount}</span>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-50">báo cáo</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-[2rem] border-none shadow-sm bg-white dark:bg-zinc-900 overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                          <Clock className="h-6 w-6 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-blue-600/60 uppercase tracking-widest mb-0.5">NGÀY HOẠT ĐỘNG</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-foreground leading-none">{activeDaysCount}</span>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-50">ngày</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-[2rem] border-none shadow-sm bg-white dark:bg-zinc-900 sm:col-span-2 lg:col-span-1">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest mb-0.5">TRẠNG THÁI</p>
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <span className="text-xs font-bold text-emerald-600 uppercase">Đang triển khai</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* History List */}
                <div className="space-y-4">
                  <div className="px-2">
                    <h3 className="text-[11px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">Lịch sử theo ngày</h3>
                  </div>

                  {sortedAssignments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="p-4 rounded-full bg-slate-100 dark:bg-zinc-900 mb-4">
                        <Calendar className="h-8 w-8 text-muted-foreground/60" />
                      </div>
                      <p className="text-muted-foreground font-medium italic opacity-60">Chưa có dữ liệu báo cáo.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {sortedAssignments.map((assignment) => {
                        const { date, assignedUsers, completions: records } = assignment
                        const totalCompletions = records.length
                        const completionPercentage = assignedUsers.length > 0 
                          ? Math.round((totalCompletions / assignedUsers.length) * 100) 
                          : 0

                        return (
                          <Card 
                            key={date}
                            className="group relative overflow-hidden rounded-[1.5rem] border-slate-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 hover:border-primary/30 transition-all cursor-pointer hover:shadow-md active:scale-[0.98]"
                            onClick={() => setSelectedDate(date)}
                          >
                            <CardContent className="p-5 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-4 min-w-0">
                                <div className="h-11 w-11 rounded-[1.1rem] bg-slate-50 dark:bg-zinc-800 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                                  <Calendar className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="font-bold text-[15px] text-foreground group-hover:text-primary transition-colors capitalize">
                                    {format(new Date(date), "EEEE, dd/MM", { locale: viLocale })}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-tighter">
                                      {totalCompletions}/{assignedUsers.length} nhân viên làm
                                    </span>
                                    <div className="h-1 w-1 rounded-full bg-muted-foreground/20" />
                                    <span className={`text-[10px] font-black uppercase tracking-tighter ${
                                      completionPercentage === 100 ? "text-emerald-500" : completionPercentage >= 50 ? "text-amber-500" : "text-rose-500"
                                    }`}>
                                      {completionPercentage}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-8">
                {selectedAssignment && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedAssignment.completions.map((record) => {
                      const assignedUser = selectedAssignment.assignedUsers.find((u) => u.userId === record.completedBy?.userId)
                      const shiftInfo = selectedAssignment.assignedUsersByShift.find(
                        (s) => assignedUser && s.users.some((u) => u.userId === assignedUser.userId)
                      )
                      return (
                        <ReportRecordCard
                          key={record.completionId}
                          record={record}
                          reportedUser={(assignedUser || record.completedBy) as any}
                          isOffShift={!assignedUser}
                          shiftInfo={shiftInfo}
                          onOpenLightbox={onOpenLightbox}
                          setReportCardRef={setReportCardRef}
                        />
                      )
                    })}

                    {/* Unreported Staff Section */}
                    {(() => {
                      const unreported = selectedAssignment.assignedUsers.filter(u => 
                        !selectedAssignment.completions.some(r => r.completedBy?.userId === u.userId)
                      )
                      if (unreported.length === 0) return null
                      
                      return (
                        <Card className="md:col-span-2 relative overflow-hidden border-none bg-slate-100/50 dark:bg-zinc-900/50 rounded-[2rem] shadow-none mt-4">
                          <CardContent className="p-8">
                            <div className="flex items-center gap-4 mb-6">
                              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                <AlertCircle className="h-5 w-5 text-amber-500" />
                              </div>
                              <div>
                                <h4 className="font-black text-lg text-foreground tracking-tight">Chưa gửi báo cáo</h4>
                                <p className="text-xs font-bold text-muted-foreground uppercase opacity-60 tracking-widest">
                                  {unreported.length} nhân sự vắng mặt
                                </p>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                              {unreported.map((user) => {
                                const shift = selectedAssignment.assignedUsersByShift.find(s => 
                                  s.users.some(u => u.userId === user.userId)
                                )
                                return (
                                  <div key={user.userId} className="flex items-center gap-3 p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/60 shadow-sm">
                                    <div className="h-10 w-10 rounded-2xl bg-slate-50 dark:bg-zinc-800 flex items-center justify-center border border-slate-100 dark:border-zinc-700 shrink-0 font-black text-xs text-muted-foreground">
                                      {user.userName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-bold text-sm text-foreground">{user.userName}</p>
                                      {shift && (
                                        <p className="text-[10px] font-black text-primary/60 uppercase tracking-tighter">
                                          {shift.shiftLabel} • {shift.timeSlot.start}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })()}
                  </div>
                )}
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
