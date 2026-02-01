"use client"

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react"
import { useRouter } from "nextjs-toploader/app"
import { useSearchParams } from "next/navigation"
import { format, subMonths, addMonths } from "date-fns"
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { dataStore } from "@/lib/data-store"
import type { MonthlyTask, TaskCompletionRecord, Schedule, AssignedUser } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingPage } from "@/components/loading/LoadingPage"
import { useDataRefresher } from "@/hooks/useDataRefresher"
import { useLightbox } from "@/contexts/lightbox-context"
import { getAssignmentsForMonth } from "@/lib/schedule-utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getQueryParamWithMobileHashFallback } from "@/lib/url-params"
import { useIsMobile } from "@/hooks/use-mobile"

// New components
import { TaskItemCard, StaffItemCard } from "./_components/list-item-cards"
import { TaskReportsDialog } from "./_components/task-reports-dialog"
import { StaffReportsDialog } from "./_components/staff-reports-dialog"

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

function MonthlyTaskReportsView() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const routerRef = useRef(router)
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [completions, setCompletions] = useState<TaskCompletionRecord[]>([])
  const [monthlyTasks, setMonthlyTasks] = useState<MonthlyTask[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Selected states for dialogs
  const [selectedTaskName, setSelectedTaskName] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const [viewMode, setViewMode] = useState<"tasks" | "staffs">("tasks")

  const { openLightbox } = useLightbox()

  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const handleDataRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1)
  }, [])

  useEffect(() => {
    routerRef.current = router
  }, [router])

  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== "Chủ nhà hàng") {
        router.replace("/")
      }
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      setIsLoading(true)
      const unsubCompletions = dataStore.subscribeToMonthlyTaskCompletionsForMonth(currentMonth, (data) => {
        setCompletions(data)
        setIsLoading(false)
      })
      const unsubTasks = dataStore.subscribeToMonthlyTasks((tasks) => {
        setMonthlyTasks(tasks)
      })
      const unsubSchedules = dataStore.subscribeToSchedulesForMonth(currentMonth, (schedules) => {
        setSchedules(schedules)
      })
      const unsubUsers = dataStore.subscribeToUsers((users) => {
        setAllUsers(users)
      })

      return () => {
        unsubCompletions()
        unsubTasks()
        unsubSchedules()
        unsubUsers()
      }
    }
  }, [user, currentMonth, refreshTrigger])

  useDataRefresher(handleDataRefresh)

  const assignmentsByTask = useMemo(() => {
    if (isLoading || monthlyTasks.length === 0 || schedules.length === 0 || allUsers.length === 0) {
      return {}
    }
    return getAssignmentsForMonth(currentMonth, monthlyTasks, schedules, allUsers, completions)
  }, [isLoading, currentMonth, monthlyTasks, schedules, allUsers, completions])

  const taskEntries = useMemo(() => {
    const entries = Object.entries(assignmentsByTask) as [string, DailyAssignment[]][]
    return entries.sort((a, b) => a[0].localeCompare(b[0], 'vi'))
  }, [assignmentsByTask])

  const hasAnyData = useMemo(() => {
    return Object.values(assignmentsByTask).some((assignments: any) => assignments.length > 0)
  }, [assignmentsByTask])

  const userRanking = useMemo(() => {
    const map = new Map<string, { userId: string; userName: string; count: number; role?: string }>()
    completions.forEach((rec) => {
      if (!rec.completedBy) return
      const { userId, userName } = rec.completedBy
      const existing = map.get(userId)
      if (existing) {
        existing.count += 1
      } else {
        const fullUser = allUsers.find(u => u.uid === userId)
        map.set(userId, { userId, userName, count: 1, role: fullUser?.role })
      }
    })
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [completions, allUsers])

  const roleOrder = ["Phục vụ", "Pha chế", "Quản lý", "Tất cả"]

  const groupedTasks = useMemo(() => {
    const groups: Record<string, typeof taskEntries> = {}
    taskEntries.forEach(entry => {
      const taskObj = monthlyTasks.find(t => t.name === entry[0])
      const role = taskObj?.appliesToRole || "Tất cả"
      if (!groups[role]) groups[role] = []
      groups[role].push(entry)
    })
    return roleOrder
      .filter(role => groups[role])
      .map(role => ({ role, entries: groups[role] }))
  }, [taskEntries, monthlyTasks])

  const groupedStaff = useMemo(() => {
    const groups: Record<string, typeof userRanking> = {}
    userRanking.forEach(entry => {
      const role = entry.role || "Chủ nhà hàng"
      if (!groups[role]) groups[role] = []
      groups[role].push(entry)
    })
    return roleOrder
      .filter(role => groups[role])
      .map(role => ({ role, entries: groups[role] }))
  }, [userRanking])

  const completionsByUser = useMemo(() => {
    const map = new Map<string, { userId: string; userName: string; records: TaskCompletionRecord[] }>()
    completions.forEach((rec) => {
      if (!rec.completedBy) return
      const { userId, userName } = rec.completedBy
      const existing = map.get(userId)
      if (existing) {
        existing.records.push(rec)
      } else {
        map.set(userId, { userId, userName, records: [rec] })
      }
    })
    // sort each user's records by assignedDate desc, then completedAt desc
    map.forEach((val) => {
      val.records.sort((a, b) => {
        const ad = new Date(a.assignedDate).getTime()
        const bd = new Date(b.assignedDate).getTime()
        if (bd !== ad) return bd - ad
        const at = a.completedAt ? a.completedAt.toDate().getTime() : 0
        const bt = b.completedAt ? b.completedAt.toDate().getTime() : 0
        return bt - at
      })
    })
    return map
  }, [completions])

  const selectedUserUnreportedTasks = useMemo(() => {
    if (!selectedUserId || !assignmentsByTask) return []
    const unreported: { taskName: string; date: string; shiftLabel: string }[] = []
    
    Object.entries(assignmentsByTask).forEach(([taskName, days]) => {
      days.forEach(day => {
        const isAssigned = day.assignedUsers.some(u => u.userId === selectedUserId)
        if (isAssigned) {
          const hasReported = day.completions.some(c => c.completedBy?.userId === selectedUserId)
          if (!hasReported) {
            const shift = day.assignedUsersByShift.find(s => s.users.some(u => u.userId === selectedUserId))
            unreported.push({
              taskName,
              date: day.date,
              shiftLabel: shift?.shiftLabel || "Ka làm"
            })
          }
        }
      })
    })

    return unreported.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [selectedUserId, assignmentsByTask])

  const handleOpenLightbox = (slides: any[], index: number) => {
    openLightbox(slides, index)
  }

  // Initialize month and scroll to a specific report via URL params
  useEffect(() => {
    const monthParam = getQueryParamWithMobileHashFallback({
      param: "month",
      searchParams,
      hash: typeof window !== "undefined" ? window.location.hash : "",
    })
    if (monthParam) {
      const [y, m] = monthParam.split("-").map((v) => Number(v))
      if (!Number.isNaN(y) && !Number.isNaN(m)) {
        const newDate = new Date(y, m - 1, 1)
        if (
          newDate.getFullYear() !== currentMonth.getFullYear() ||
          newDate.getMonth() !== currentMonth.getMonth()
        ) {
          setCurrentMonth(newDate)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reportCardRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const [pendingScrollKey, setPendingScrollKey] = useState<string | null>(null)

  const setReportCardRef = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) {
      reportCardRefs.current.set(key, el)
    } else {
      reportCardRefs.current.delete(key)
    }
  }, [])

  useEffect(() => {
    if (!pendingScrollKey) return

    const scroll = () => {
      const el = reportCardRefs.current.get(pendingScrollKey)
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "center" })
          el.classList.add("ring-2", "ring-primary")
          setTimeout(() => {
            el.classList.remove("ring-2", "ring-primary")
          }, 2000)

          if (!isMobile) {
            const url = new URL(window.location.href)
            url.searchParams.delete("highlight")
            window.history.replaceState({}, "", url.toString())
          }
        }, 600)
        setPendingScrollKey(null)
        return true
      }
      return false
    }

    if (!scroll()) {
      const interval = setInterval(() => {
        if (scroll()) clearInterval(interval)
      }, 100)
      const timeout = setTimeout(() => clearInterval(interval), 3000)
      return () => {
        clearInterval(interval)
        clearTimeout(timeout)
      }
    }
  }, [pendingScrollKey, isMobile])

  useEffect(() => {
    const anchor = getQueryParamWithMobileHashFallback({
      param: "highlight",
      searchParams,
      hash: typeof window !== "undefined" ? window.location.hash : "",
    })
    if (!anchor || completions.length === 0) return

    const matchedRecord = completions.find((rec) =>
      rec.completionId === anchor ||
      (rec.completionId && anchor && rec.completionId.startsWith(anchor + "_"))
    )
    if (!matchedRecord) return

    if (viewMode === "tasks") {
      setSelectedTaskName(matchedRecord.taskName)
    } else {
      const uid = matchedRecord.completedBy?.userId
      if (uid) setSelectedUserId(uid)
    }

    setPendingScrollKey(anchor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, completions, viewMode])

  if (authLoading) {
    return <LoadingPage />
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50/50 dark:bg-zinc-950 pb-20 relative overflow-hidden">
        {/* Background Decorative Blobs */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -translate-y-1/2 pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] translate-y-1/2 pointer-events-none" />

        <div className="container mx-auto max-w-6xl px-4 py-8 sm:px-6 md:px-8 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div className="space-y-3">
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1]">
                Báo cáo <br />
                <span className="text-primary italic">Định kỳ</span>
              </h1>
              <p className="text-slate-500 dark:text-zinc-400 text-base max-w-md font-medium leading-relaxed">
                Hệ thống truy xuất dữ liệu hoàn thành công việc theo phân ca hàng ngày.
              </p>
            </div>

            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-2 bg-white dark:bg-zinc-900/80 backdrop-blur-xl p-1.5 rounded-3xl border border-slate-200/60 dark:border-zinc-800/60 shadow-xl shadow-slate-200/40 dark:shadow-none">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="h-10 w-10 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all text-slate-600 dark:text-zinc-400"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <div className="px-4 text-center min-w-[140px]">
                  <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-0.5">Tháng công tác</p>
                  <span className="text-xl font-black text-slate-900 dark:text-white tracking-tighter">
                    {format(currentMonth, "MM")} / {format(currentMonth, "yyyy")}
                  </span>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="h-10 w-10 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all text-slate-600 dark:text-zinc-400"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={() => setCurrentMonth(new Date())}
                className="rounded-full px-6 h-8 border-slate-200/60 dark:border-zinc-800/60 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md text-[10px] font-black uppercase tracking-[0.1em] hover:bg-primary hover:text-white hover:border-primary transition-all duration-300"
              >
                Về hiện tại
              </Button>
            </div>
          </div>

          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-full space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 dark:border-zinc-800/60 pb-6">
              <TabsList className="flex h-12 p-1 bg-slate-200/30 dark:bg-zinc-900/50 rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 w-full sm:w-auto">
                <TabsTrigger 
                  value="tasks" 
                  className="px-8 rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-primary data-[state=active]:shadow-lg shadow-slate-200/50 transition-all duration-300 flex-1 sm:flex-none"
                >
                  Nhiệm vụ
                </TabsTrigger>
                <TabsTrigger 
                  value="staffs" 
                  className="px-8 rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-primary data-[state=active]:shadow-lg shadow-slate-200/50 transition-all duration-300 flex-1 sm:flex-none"
                >
                  Nhân sự
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="min-h-[400px]">
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-32 w-full rounded-2xl bg-slate-100 dark:bg-zinc-900/50 animate-pulse border border-slate-200/50 dark:border-zinc-800/50" />
                  ))}
                </div>
              ) : (
                viewMode === "tasks" ? (
                  groupedTasks.length > 0 ? (
                    <div className="space-y-12">
                      {groupedTasks.map(({ role, entries }) => (
                        <div key={role} className="space-y-6">
                          <div className="flex items-center gap-4">
                            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-primary whitespace-nowrap">
                              Vai trò: {role}
                            </h2>
                            <div className="h-px w-full bg-slate-200 dark:bg-zinc-800/60" />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {entries.map(([taskName, dailyAssignments]) => {
                              const totalReports = dailyAssignments.reduce((sum, a) => sum + a.completions.length, 0)
                              return (
                                <TaskItemCard
                                  key={taskName}
                                  name={taskName}
                                  reportCount={totalReports}
                                  onClick={() => setSelectedTaskName(taskName)}
                                />
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState message="Không có báo cáo công việc nào được gửi trong tháng này." />
                  )
                ) : (
                  groupedStaff.length === 0 ? (
                    <EmptyState message="Chưa có nhân viên nào gửi báo cáo trong tháng này." />
                  ) : (
                    <div className="space-y-12">
                      {groupedStaff.map(({ role, entries }) => (
                        <div key={role} className="space-y-6">
                          <div className="flex items-center gap-4">
                            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-primary whitespace-nowrap">
                              Bộ phận: {role}
                            </h2>
                            <div className="h-px w-full bg-slate-200 dark:bg-zinc-800/60" />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {entries.map((entry, idx) => (
                              <StaffItemCard
                                key={entry.userId}
                                userName={entry.userName}
                                rank={userRanking.findIndex(r => r.userId === entry.userId) + 1}
                                reportCount={entry.count}
                                onClick={() => setSelectedUserId(entry.userId)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )
              )}
            </div>
          </Tabs>
        </div>
      </div>

      {/* Dialogs */}
      <TaskReportsDialog
        isOpen={!!selectedTaskName}
        onClose={() => setSelectedTaskName(null)}
        taskName={selectedTaskName || ""}
        dailyAssignments={selectedTaskName ? (assignmentsByTask[selectedTaskName] || []) : []}
        onOpenLightbox={handleOpenLightbox}
        setReportCardRef={setReportCardRef}
      />

      <StaffReportsDialog
        isOpen={!!selectedUserId}
        onClose={() => setSelectedUserId(null)}
        userId={selectedUserId || ""}
        userName={selectedUserId ? (completionsByUser.get(selectedUserId)?.userName || "") : ""}
        records={selectedUserId ? (completionsByUser.get(selectedUserId)?.records || []) : []}
        unreportedTasks={selectedUserUnreportedTasks}
        onOpenLightbox={handleOpenLightbox}
        setReportCardRef={setReportCardRef}
      />
    </>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 px-8 text-center bg-white/40 dark:bg-zinc-900/20 backdrop-blur-md rounded-[3rem] border border-dashed border-slate-300 dark:border-zinc-800">
      <div className="p-8 rounded-[2.5rem] bg-slate-50 dark:bg-zinc-900/50 text-slate-300 dark:text-zinc-700 mb-8 border border-slate-100 dark:border-zinc-800/50 shadow-inner">
        <CalendarCheck className="h-20 w-20" />
      </div>
      <h3 className="text-2xl font-black text-slate-800 dark:text-zinc-200 mb-3 tracking-tight">Không tìm thấy dữ liệu</h3>
      <p className="text-slate-500 dark:text-zinc-400 font-medium text-lg leading-relaxed max-w-sm">
        {message}
      </p>
    </div>
  )
}

export default function MonthlyTaskReportsPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <MonthlyTaskReportsView />
    </Suspense>
  )
}
