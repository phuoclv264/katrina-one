"use client"

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react"
import Image from "next/image"
import { useRouter } from "nextjs-toploader/app"
import { useSearchParams } from "next/navigation"
import { format, subMonths, addMonths } from "date-fns"
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
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
import { toast } from "react-hot-toast"
import { useAuth } from "@/hooks/use-auth"
import { dataStore } from "@/lib/data-store"
import type { MediaAttachment, MonthlyTask, TaskCompletionRecord, Schedule, AssignedUser } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { LoadingPage } from "@/components/loading/LoadingPage"
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
import { useDataRefresher } from "@/hooks/useDataRefresher"
import { useLightbox } from "@/contexts/lightbox-context"
import { getAssignmentsForMonth } from "@/lib/schedule-utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { vi } from "date-fns/locale"
import { getQueryParamWithMobileHashFallback } from "@/lib/url-params"
import { useIsMobile } from "@/hooks/use-mobile"

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
  const [openTasks, setOpenTasks] = useState<string[]>([])
  const [openUsers, setOpenUsers] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<"tasks" | "staffs">("tasks")

  const { openLightbox } = useLightbox()
  const [isDeleting, setIsDeleting] = useState(false)

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

      setTimeout(() => {
        setIsLoading(false)
      }, 500)

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
    return entries.sort((a, b) => {
      const aLatest = Math.max(
        0,
        ...a[1].map((d) => new Date(d.date).getTime()),
      )
      const bLatest = Math.max(
        0,
        ...b[1].map((d) => new Date(d.date).getTime()),
      )
      return bLatest - aLatest
    })
  }, [assignmentsByTask])

  const hasAnyData = useMemo(() => {
    return Object.values(assignmentsByTask).some((assignments: any) => assignments.length > 0)
  }, [assignmentsByTask])

  const userRanking = useMemo(() => {
    const map = new Map<string, { userId: string; userName: string; count: number }>()
    completions.forEach((rec) => {
      if (!rec.completedBy) return
      const { userId, userName } = rec.completedBy
      const existing = map.get(userId)
      if (existing) {
        existing.count += 1
      } else {
        map.set(userId, { userId, userName, count: 1 })
      }
    })
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [completions])

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

  const handleOpenLightbox = (media: NonNullable<TaskCompletionRecord["media"]>, index: number) => {
    openLightbox(createLightboxSlides(media), index)
  }

  const handleDeleteReport = async (record: TaskCompletionRecord) => {
    if (!record.completedBy) return
    setIsDeleting(true)
    try {
      await dataStore.deleteMonthlyTaskCompletion(record.taskId, record.completedBy.userId, record.assignedDate)
      toast.success("Đã xóa báo cáo thành công.")
    } catch (error) {
      console.error("Failed to delete report:", error)
      toast.error("Không thể xóa báo cáo.")
    } finally {
      setIsDeleting(false)
    }
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
      setOpenTasks((prev) => (prev.includes(matchedRecord.taskName) ? prev : [...prev, matchedRecord.taskName]))
    } else {
      const uid = matchedRecord.completedBy?.userId
      if (uid) setOpenUsers((prev) => (prev.includes(uid) ? prev : [...prev, uid]))
    }

    setPendingScrollKey(anchor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, completions, viewMode, window.location.hash])

  if (authLoading) {
    return <LoadingPage />
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5">
        <div className="container mx-auto max-w-6xl px-4 py-8 sm:px-6 md:px-8">
          <div className="mb-8">
            <div className="mb-6">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
                Báo cáo Công việc Định kỳ
              </h1>
              <p className="text-muted-foreground text-lg">
                Theo dõi và quản lý báo cáo hoàn thành công việc của nhân viên
              </p>
            </div>
          </div>

          <Card className="border-0 shadow-lg bg-white dark:bg-card mb-8">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-2xl font-bold flex items-center gap-2">
                    <CalendarCheck className="h-6 w-6 text-primary" />
                    Tháng {format(currentMonth, "MM/yyyy")}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    className="hover:bg-primary/10 hover:text-primary"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    className="hover:bg-primary/10 hover:text-primary"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              <div className="mt-4">
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="tasks">Xem theo nhiệm vụ</TabsTrigger>
                    <TabsTrigger value="staffs">Xem theo nhân viên</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-6">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="space-y-4 rounded-xl border p-4">
                      <Skeleton className="h-8 w-1/3 rounded-lg" />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Skeleton className="h-56 w-full rounded-lg" />
                        <Skeleton className="h-56 w-full rounded-lg" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                viewMode === "tasks"
                  ? (
                    hasAnyData ? (
                      <Accordion type="multiple" value={openTasks} onValueChange={setOpenTasks} className="w-full space-y-4">
                        {taskEntries.map(([taskName, dailyAssignments]) => {
                          const task = monthlyTasks.find((t) => t.name === taskName)
                          if (!task || (dailyAssignments as DailyAssignment[]).length === 0) return null
                          return (
                            <AccordionItem key={task.id} value={task.name} className="border rounded-xl overflow-hidden border-primary/10 hover:border-primary/30 transition-colors">
                              <AccordionTrigger className="p-0 text-lg font-semibold hover:no-underline">
                                <div className="p-5 rounded-xl w-full text-left bg-gradient-to-r from-primary/5 to-transparent hover:from-primary/10 transition-colors flex items-center justify-between">
                                  <span className="font-semibold text-foreground">{task.name}</span>
                                  <span className="text-sm text-muted-foreground font-normal">{(dailyAssignments as DailyAssignment[]).reduce((sum, a) => sum + a.completions.length, 0)} báo cáo</span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="pt-6 px-5 pb-6">
                                <div className="space-y-6">
                                  {(dailyAssignments as DailyAssignment[])
                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                    .map((assignment) => {
                                      const { date, assignedUsers, completions: records } = assignment
                                      const totalCompletions = records.length
                                      const completionPercentage = assignedUsers.length > 0 ? Math.round((totalCompletions / assignedUsers.length) * 100) : 0

                                      const reportedUsersWithRecords = records.map((record) => {
                                        const assignedUser = assignedUsers.find((u) => u.userId === record.completedBy?.userId)
                                        return {
                                          user: assignedUser || record.completedBy,
                                          record,
                                          isOffShift: !assignedUser
                                        }
                                      })

                                      const unreportedUsers = assignedUsers.filter((user) => !records.some((r) => r.completedBy?.userId === user.userId))
                                      return (
                                        <div key={date} className="space-y-4">
                                          <div className="flex items-center justify-between gap-3 pb-3 border-b border-primary/10">
                                            <div>
                                              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">📅 {format(new Date(date), "dd/MM/yyyy")}</h3>
                                              <p className="text-sm text-muted-foreground mt-1">{totalCompletions}/{assignedUsers.length} nhân viên đã báo cáo</p>
                                            </div>
                                            <div className="flex flex-col items-end">
                                              <div className={`text-2xl font-bold ${completionPercentage === 100 ? "text-emerald-600 dark:text-emerald-400" : completionPercentage >= 50 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}`}>{completionPercentage}%</div>
                                              <div className="w-24 h-1.5 bg-secondary rounded-full mt-2 overflow-hidden"><div className={`h-full transition-all ${completionPercentage === 100 ? "bg-emerald-500" : completionPercentage >= 50 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${completionPercentage}%` }} /></div>
                                            </div>
                                          </div>
                                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {reportedUsersWithRecords.map(({ user: reportedUser, record, isOffShift }) => {
                                              const shiftInfo = assignment.assignedUsersByShift.find((s) => s.users.some((u) => u.userId === reportedUser?.userId))
                                              return (
                                                <Card key={reportedUser?.userId || record.completionId} className={`relative group/card overflow-hidden border transition-all hover:shadow-md ${isOffShift ? "bg-amber-50/30 dark:bg-amber-900/5 border-amber-200/50 dark:border-amber-900/30" : "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/50 dark:border-emerald-900/50"}`} ref={(el) => {
                                                  setReportCardRef(`monthly-${record.taskId}-${record.assignedDate}`, el)
                                                  if (record.completionId) {
                                                    setReportCardRef(record.completionId, el)
                                                  }
                                                }}>
                                                  <CardContent className="p-5 space-y-4">
                                                    <div className="flex items-start justify-between gap-2">
                                                      <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <div className={`p-2 rounded-lg flex-shrink-0 ${isOffShift ? "bg-amber-100 dark:bg-amber-900" : "bg-emerald-100 dark:bg-emerald-900"}`}><User className={`h-4 w-4 ${isOffShift ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`} /></div>
                                                        <div className="min-w-0 flex-1">
                                                          <p className="font-semibold text-sm truncate text-foreground flex items-center gap-2">
                                                            {reportedUser?.userName || "Unknown"}
                                                            {isOffShift && <span className="text-[10px] font-normal text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-100 dark:border-amber-800">Ngoài ca</span>}
                                                          </p>
                                                          {record.completedAt && (<p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Clock className="h-3 w-3" />{format(record.completedAt.toDate(), "HH:mm")}</p>)}
                                                        </div>
                                                      </div>
                                                      <div className="flex-shrink-0"><CheckCircle2 className={`h-5 w-5 ${isOffShift ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`} /></div>
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
                                                    <>
                                                      {record.note && (<Alert variant="default" className="border-0 bg-amber-100/30 dark:bg-amber-900/20 p-3"><div className="flex items-start gap-2"><MessageSquareText className="h-4 w-4 mt-0.5 text-amber-700 dark:text-amber-400 flex-shrink-0" /><AlertDescription className="text-amber-800 dark:text-amber-300 text-xs">{record.note}</AlertDescription></div></Alert>)}
                                                      {record.media && record.media.length > 0 && (
                                                        <div>
                                                          <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> BẰNG CHỨNG ({record.media.length})</h4>
                                                          <div className="flex flex-wrap gap-2">
                                                            {record.media.map((att, index) => (
                                                              <button key={index} onClick={() => handleOpenLightbox(record.media!, index)} className="relative w-20 h-20 rounded-lg overflow-hidden group bg-secondary hover:ring-2 ring-primary/50 transition-all">
                                                                {att.type === "photo" ? (<Image src={att.url || "/placeholder.svg"} alt={`Bằng chứng ${index + 1}`} fill className="object-cover transition-transform duration-200 group-hover:scale-110" />) : att.type === "video" ? (<><video src={`${att.url}#t=0.1`} preload="metadata" muted playsInline className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110" /><div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-75 group-hover:opacity-100 transition-opacity"><Video className="h-6 w-6 text-white" /></div></>) : null}
                                                              </button>
                                                            ))}
                                                          </div>
                                                        </div>
                                                      )}
                                                      <div className="pt-2 border-t border-primary/10">
                                                        <AlertDialog parentDialogTag="root">
                                                          <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 h-8 text-xs" disabled={isDeleting}>{isDeleting ? (<Loader2 className="h-3 w-3 animate-spin mr-2" />) : (<Trash2 className="h-3 w-3 mr-2" />)}Xóa báo cáo</Button>
                                                          </AlertDialogTrigger>
                                                          <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                              <AlertDialogTitle>Xác nhận xóa báo cáo?</AlertDialogTitle>
                                                              <AlertDialogDescription>Hành động này sẽ xóa vĩnh viễn báo cáo và tất cả bằng chứng đính kèm.</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                              <AlertDialogAction onClick={() => handleDeleteReport(record)} isLoading={isDeleting} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isDeleting ? 'Đang xóa...' : 'Xóa'}</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                          </AlertDialogContent>
                                                        </AlertDialog>
                                                      </div>
                                                    </>
                                                  </CardContent>
                                                </Card>
                                              )
                                            })}
                                            {unreportedUsers.length > 0 && (
                                              <Card className="relative group/card overflow-hidden border transition-all hover:shadow-md bg-white/50 dark:bg-secondary/50 border-primary/10">
                                                <CardContent className="p-5">
                                                  <div className="flex items-center gap-3 mb-4"><div className="p-2 rounded-lg flex-shrink-0 bg-secondary"><AlertCircle className="h-4 w-4 text-amber-500" /></div><div><p className="font-semibold text-sm text-foreground">Chưa báo cáo</p><p className="text-xs text-muted-foreground">{unreportedUsers.length} nhân viên</p></div></div>
                                                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                                    {unreportedUsers.map((unreportedUser) => {
                                                      const shiftInfo = assignment.assignedUsersByShift.find((s) => s.users.some((u) => u.userId === unreportedUser.userId))
                                                      return (<div key={unreportedUser.userId} className="flex items-center gap-2 text-sm text-muted-foreground"><User className="h-3.5 w-3.5 flex-shrink-0" /><div className="min-w-0 flex-1"><span className="truncate block">{unreportedUser.userName}</span>{shiftInfo && (<span className="text-xs text-muted-foreground/70">{shiftInfo.shiftLabel} · {shiftInfo.timeSlot.start} - {shiftInfo.timeSlot.end}</span>)}</div></div>)
                                                    })}
                                                  </div>
                                                </CardContent>
                                              </Card>
                                            )}
                                          </div>
                                        </div>
                                      )
                                    })}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          )
                        })}
                      </Accordion>
                    ) : (
                      <div className="text-center py-16 px-8"><div className="inline-block p-4 rounded-full bg-primary/10 mb-4"><CalendarCheck className="h-12 w-12 text-primary" /></div><h3 className="text-xl font-bold text-foreground">Không có báo cáo</h3><p className="mt-2 text-muted-foreground">Không có báo cáo công việc nào được gửi trong tháng này.</p></div>
                    )
                  )
                  : (
                    <div className="space-y-4">
                      {userRanking.length === 0 ? (
                        <div className="text-center py-16 px-8"><div className="inline-block p-4 rounded-full bg-primary/10 mb-4"><CalendarCheck className="h-12 w-12 text-primary" /></div><h3 className="text-xl font-bold text-foreground">Không có báo cáo</h3><p className="mt-2 text-muted-foreground">Chưa có nhân viên nào hoàn thành công việc trong tháng này.</p></div>
                      ) : (
                        <Accordion type="multiple" value={openUsers} onValueChange={setOpenUsers} className="w-full space-y-4">
                          {userRanking.map((entry, idx) => {
                            const userRecords = completionsByUser.get(entry.userId)?.records || []
                            return (
                              <AccordionItem key={entry.userId} value={entry.userId} className="border rounded-xl overflow-hidden border-primary/10 hover:border-primary/30 transition-colors">
                                <AccordionTrigger className="p-0 text-lg font-semibold hover:no-underline">
                                  <div className="p-5 rounded-xl w-full text-left bg-gradient-to-r from-primary/5 to-transparent hover:from-primary/10 transition-colors flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="p-2 rounded-lg bg-primary/10"><User className="h-4 w-4 text-primary" /></div>
                                      <div>
                                        <p className="font-semibold text-sm text-foreground">{entry.userName}</p>
                                        <p className="text-xs text-muted-foreground">Xếp hạng #{idx + 1}</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-2xl font-bold text-foreground">{entry.count}</div>
                                      <div className="text-xs text-muted-foreground">báo cáo trong tháng</div>
                                    </div>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-6 px-5 pb-6">
                                  {userRecords.length === 0 ? (
                                    <div className="text-center text-sm text-muted-foreground">Không có báo cáo chi tiết.</div>
                                  ) : (
                                    <div className="space-y-4">
                                      {userRecords.map((record) => (
                                        <Card
                                          key={record.completionId || `${record.taskId}-${record.assignedDate}-${entry.userId}`}
                                          className="relative group/card overflow-hidden border transition-all hover:shadow-md bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/50 dark:border-emerald-900/50"
                                          ref={(el) =>
                                            setReportCardRef(
                                              record.completionId || `${record.taskId}-${record.assignedDate}-${entry.userId}`,
                                              el,
                                            )
                                          }
                                        >
                                          <CardContent className="p-5 space-y-4">
                                            <div className="flex items-start justify-between gap-2">
                                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="p-2 rounded-lg flex-shrink-0 bg-emerald-100 dark:bg-emerald-900"><CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /></div>
                                                <div className="min-w-0 flex-1">
                                                  <p className="font-semibold text-sm truncate text-foreground">{record.taskName}</p>
                                                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Clock className="h-3 w-3" />{format(new Date(record.assignedDate), "dd/MM/yyyy")}{record.completedAt && ` · ${format(record.completedAt.toDate(), "HH:mm")}`}</p>
                                                </div>
                                              </div>
                                            </div>
                                            {record.note && (
                                              <Alert variant="default" className="border-0 bg-amber-100/30 dark:bg-amber-900/20 p-3">
                                                <div className="flex items-start gap-2">
                                                  <MessageSquareText className="h-4 w-4 mt-0.5 text-amber-700 dark:text-amber-400 flex-shrink-0" />
                                                  <AlertDescription className="text-amber-800 dark:text-amber-300 text-xs">{record.note}</AlertDescription>
                                                </div>
                                              </Alert>
                                            )}
                                            {record.media && record.media.length > 0 && (
                                              <div>
                                                <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> BẰNG CHỨNG ({record.media.length})</h4>
                                                <div className="flex flex-wrap gap-2">
                                                  {record.media.map((att, index) => (
                                                    <button key={index} onClick={() => handleOpenLightbox(record.media!, index)} className="relative w-20 h-20 rounded-lg overflow-hidden group bg-secondary hover:ring-2 ring-primary/50 transition-all">
                                                      {att.type === "photo" ? (
                                                        <Image src={att.url || "/placeholder.svg"} alt={`Bằng chứng ${index + 1}`} fill className="object-cover transition-transform duration-200 group-hover:scale-110" />
                                                      ) : att.type === "video" ? (
                                                        <>
                                                          <video src={`${att.url}#t=0.1`} preload="metadata" muted playsInline className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110" />
                                                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-75 group-hover:opacity-100 transition-opacity"><Video className="h-6 w-6 text-white" /></div>
                                                        </>
                                                      ) : null}
                                                    </button>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </CardContent>
                                        </Card>
                                      ))}
                                    </div>
                                  )}
                                </AccordionContent>
                              </AccordionItem>
                            )
                          })}
                        </Accordion>
                      )}
                    </div>
                  )
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

export default function MonthlyTaskReportsPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <MonthlyTaskReportsView />
    </Suspense>
  )
}
