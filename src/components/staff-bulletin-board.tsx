"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, endOfToday, startOfToday } from "date-fns";
import { vi } from "date-fns/locale";
import { Megaphone, Clock3, ClipboardList, ListChecks, AlertCircle, TimerReset, Zap, ChevronRight } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/pro-toast";
import { useAuth } from "@/hooks/use-auth";
import { useCheckInCardPlacement } from "@/hooks/useCheckInCardPlacement";
import { useAppNavigation } from "@/contexts/app-navigation-context";
import { dataStore } from "@/lib/data-store";
import { subscribeToActiveEvents } from "@/lib/events-store";
import type { AttendanceRecord, DailyTask, DailyTaskReport, Event, MediaItem, MonthlyTaskAssignment, SimpleUser, UserRole } from "@/lib/types";
import MonthlyTasksDialog from "@/components/staff-bulletin-board/MonthlyTasksDialog";
import DailyAssignmentsDialog from "@/components/staff-bulletin-board/DailyAssignmentsDialog";
import EventsDialog from "@/components/staff-bulletin-board/EventsDialog";
import { cn } from "@/lib/utils";

const todayKey = format(new Date(), "yyyy-MM-dd");

const StatusDot = ({ className }: { className?: string }) => (
  <span className={cn("absolute -top-1.5 -right-1.5 flex h-4 w-4 z-10", className)}>
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 border-2 border-white dark:border-zinc-950" />
  </span>
);

const isUserTargeted = (task: DailyTask, userId: string, userRoles: UserRole[]): boolean => {
  if (task.targetMode === "roles") {
    return (task.targetRoles || []).some((role) => userRoles.includes(role));
  }
  if (task.targetMode === "users") {
    return (task.targetUserIds || []).includes(userId);
  }
  return false;
};

const getMonthlyCompletionStatus = (assignment: MonthlyTaskAssignment, userId?: string) => {
  if (!userId) return { done: false, reported: false };
  const completion =
    assignment.completions.find((c) => c.completedBy?.userId === userId) ||
    assignment.otherCompletions.find((c) => c.completedBy?.userId === userId);

  const done = Boolean(completion?.completedAt);
  const reported = Boolean(completion?.note) || done;
  return { done, reported };
};

export type StaffBulletinBoardProps = {
  assignments: MonthlyTaskAssignment[];
};

export default function StaffBulletinBoard({ assignments }: StaffBulletinBoardProps) {
  const { user, users, isOnActiveShift, activeShifts } = useAuth();
  const nav = useAppNavigation();
  const { isCheckedIn } = useCheckInCardPlacement();

  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyTaskReport[]>([]);
  const [lateRecords, setLateRecords] = useState<AttendanceRecord[]>([]);
  const [monthlyListOpen, setMonthlyListOpen] = useState(false);
  const [dailyListOpen, setDailyListOpen] = useState(false);
  const [eventsListOpen, setEventsListOpen] = useState(false);
  const [activeEvents, setActiveEvents] = useState<Event[]>([]);
  const [joinedEventIds, setJoinedEventIds] = useState<Set<string>>(new Set());

  // Determine whether work-related items should be shown/subscribed to
  const showWorkStuff = isCheckedIn || user?.role === "Chủ nhà hàng";

  const userRoles = useMemo(() => {
    if (!user) return [] as UserRole[];
    return [user.role as UserRole, ...((user.secondaryRoles as UserRole[]) || [])];
  }, [user]);

  // Participation check for events
  useEffect(() => {
    if (!user || activeEvents.length === 0) {
      setJoinedEventIds(new Set());
      return;
    }

    const checkParticipation = async () => {
      const joined = new Set<string>();
      try {
        // We only check for the first few events to avoid too many requests
        // in a production app this would ideally be a single index query or baked into the user profile
        const relevantActive = activeEvents.slice(0, 5);
        for (const event of relevantActive) {
          const voteRef = doc(db, `events/${event.id}/votes`, user.uid);
          const snap = await getDoc(voteRef);
          if (snap.exists()) {
            joined.add(event.id);
          }
        }
        setJoinedEventIds(joined);
      } catch (err) {
        console.error("Failed to check event participation", err);
      }
    };

    checkParticipation();
  }, [activeEvents, user]);

  // Keep tasks/reports for today — only subscribe when user should see work items (checked in or owner)
  useEffect(() => {
    if (!user) {
      setDailyTasks([]);
      setDailyReports([]);
      setLateRecords([]);
      return;
    }

    if (!showWorkStuff) {
      // Clear state and avoid attaching listeners until user checks in (or is owner)
      setDailyTasks([]);
      setDailyReports([]);
      setLateRecords([]);
      return;
    }

    const unsubTasks = dataStore.subscribeToDailyTasksForDate(new Date(), setDailyTasks);
    const unsubReports = dataStore.subscribeToDailyTaskReportsForDate(new Date(), setDailyReports);

    const unsubAttendance = dataStore.subscribeToAttendanceRecordsForDateRange(
      { from: startOfToday(), to: endOfToday() },
      (records) => setLateRecords(records),
      false,
    );

    return () => {
      try { unsubTasks && unsubTasks(); } catch {}
      try { unsubReports && unsubReports(); } catch {}
      try { unsubAttendance && unsubAttendance(); } catch {}
    };
  }, [user, showWorkStuff]);

  // Keep active events relevant to the user
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToActiveEvents(user.role, Boolean(user.isTestAccount), setActiveEvents);
    return () => unsub();
  }, [user]);

  const managedUsersById = useMemo(() => {
    const map = new Map<string, { name: string; role?: UserRole }>();
    (users || []).forEach((u) => map.set(u.uid, { name: u.displayName, role: u.role }));
    return map;
  }, [users]);

  const visibleMonthlyAssignments = useMemo(() => {
    if (!user) return [] as MonthlyTaskAssignment[];

    const userIsOnActiveShift = Boolean(isOnActiveShift) || !!(activeShifts || []).some((s) => s.assignedUsers.some((u) => u.userId === user.uid));

    if (userIsOnActiveShift) {
      return assignments.filter(
        (a) =>
          a.responsibleUsersByShift.some((s) => s.users.some((u) => u.userId === user.uid)) ||
          a.completions.some((c) => c.completedBy?.userId === user.uid) ||
          a.otherCompletions.some((c) => c.completedBy?.userId === user.uid),
      );
    }

    const roles = [user.role, ...(user.secondaryRoles || [])];
    return assignments.filter(
      (a) =>
        a.completions.some((c) => c.completedBy?.userId === user.uid) ||
        a.otherCompletions.some((c) => c.completedBy?.userId === user.uid) ||
        a.appliesToRole === "Tất cả" ||
        (!!a.appliesToRole && roles.includes(a.appliesToRole as any)),
    );
  }, [assignments, user, activeShifts, isOnActiveShift]);

  const monthlyStats = useMemo(() => {
    if (!user) return { total: 0, done: 0, reported: 0 };
    const totals = visibleMonthlyAssignments.reduce(
      (acc, assignment) => {
        const status = getMonthlyCompletionStatus(assignment, user.uid);
        if (status.done) acc.done += 1;
        if (status.reported) acc.reported += 1;
        return acc;
      },
      { total: visibleMonthlyAssignments.length, done: 0, reported: 0 },
    );
    return totals;
  }, [visibleMonthlyAssignments, user]);

  const targetedDailyTasks = useMemo(() => {
    if (!user) return [] as DailyTask[];
    return dailyTasks.filter((task) => task.assignedDate === todayKey && isUserTargeted(task, user.uid, userRoles));
  }, [dailyTasks, user, userRoles]);

  const dailyReportsByTask = useMemo(() => {
    const map = new Map<string, DailyTaskReport[]>();
    dailyReports.forEach((r) => {
      const existing = map.get(r.taskId) || [];
      existing.push(r);
      map.set(r.taskId, existing);
    });
    return map;
  }, [dailyReports]);

  const dailyStats = useMemo(() => {
    const total = targetedDailyTasks.length;
    const done = targetedDailyTasks.filter((t) => t.status === "completed" || t.status === "in_review").length;
    return { total, done };
  }, [targetedDailyTasks]);

  const pendingLateRequests = useMemo(() => {
    return (lateRecords || [])
      .filter((r) => r.status === "pending_late")
      .sort((a, b) => {
        const aTime = typeof a.createdAt === "string" ? Date.parse(a.createdAt) : a.createdAt?.toDate().getTime() || 0;
        const bTime = typeof b.createdAt === "string" ? Date.parse(b.createdAt) : b.createdAt?.toDate().getTime() || 0;
        return bTime - aTime;
      })
      .map((r) => {
        const userInfo = managedUsersById.get(r.userId);
        return {
          id: r.id,
          userId: r.userId,
          name: userInfo?.name || "Nhân viên",
          role: userInfo?.role,
          minutes: r.estimatedLateMinutes,
          note: r.lateReason,
        };
      });
  }, [lateRecords, managedUsersById]);

  const relevantEvents = useMemo(() => {
    if (!user) return [] as Event[];
    return (activeEvents || [])
      .filter((event) => {
        const roleAllowed = (event.eligibleRoles || []).length === 0 || event.eligibleRoles.includes(user.role);
        const isTestOk = !event.isTest || Boolean(user.isTestAccount);
        return roleAllowed && isTestOk;
      })
  }, [activeEvents, user]);

  const pendingEventsCount = useMemo(() => {
    return relevantEvents.filter((e) => !joinedEventIds.has(e.id)).length;
  }, [relevantEvents, joinedEventIds]);

  const handleSubmitMedia = useCallback(
    async (assignment: MonthlyTaskAssignment, media: MediaItem[], note?: string) => {
      if (!user) throw new Error("Missing user");
      await dataStore.updateMonthlyTaskCompletionStatus(
        assignment.taskId,
        assignment.taskName,
        { userId: user.uid, userName: user.displayName || user.email || "Ẩn danh" } as SimpleUser,
        new Date(assignment.assignedDate),
        true,
        media,
        note,
      );
    },
    [user],
  );

  const handleSubmitNote = useCallback(
    async (assignment: MonthlyTaskAssignment, note: string, markCompleted: boolean) => {
      if (!user) throw new Error("Missing user");
      await dataStore.updateMonthlyTaskCompletionStatus(
        assignment.taskId,
        assignment.taskName,
        { userId: user.uid, userName: user.displayName || user.email || "Ẩn danh" } as SimpleUser,
        new Date(assignment.assignedDate),
        markCompleted,
        [],
        note,
      );
    },
    [user],
  );

  const handleDailyNavigate = useCallback(() => {
    nav.push("/daily-assignments");
  }, [nav]);

  return (
    <>
      <div className="space-y-3">
        <Card className="overflow-hidden border-zinc-200/60 bg-white/70 backdrop-blur-xl shadow-soft dark:border-zinc-800/60 dark:bg-zinc-950/70">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-md">
                <Megaphone className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-black tracking-tight leading-none">Bảng tin</CardTitle>
                <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1 opacity-70">
                  {format(new Date(), "dd/MM", { locale: vi })}
                </CardDescription>

                {showWorkStuff && pendingLateRequests.length > 0 && (
                  <div className="mt-2.5 space-y-1.5">
                    {pendingLateRequests.map((req) => (
                      <div
                        key={req.id}
                        className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-50/50 px-2.5 py-1.5 dark:bg-amber-500/10"
                      >
                        <AlertCircle className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400 animate-pulse" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] font-black text-amber-700 dark:text-amber-400">
                            {req.name} • xin đi trễ {req.minutes} phút
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-3 pt-2">
            <div className="flex flex-col gap-2">
              {/* Tile: Monthly Tasks */}
              {showWorkStuff && (
                <button
                  onClick={() => setMonthlyListOpen(true)}
                  disabled={visibleMonthlyAssignments.length === 0}
                  className="group relative flex items-center gap-3 p-3 rounded-2xl border border-primary/10 bg-primary/5 text-left transition-all hover:bg-primary/10 active:scale-[0.98] disabled:opacity-40 disabled:grayscale"
                >
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm shadow-primary/20">
                    <ClipboardList className="h-5 w-5" />
                    {monthlyStats.total > 0 && monthlyStats.done < monthlyStats.total && (
                      <StatusDot />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary/70">Hàng tháng</span>
                      <span className="text-[10px] font-black text-muted-foreground">{monthlyStats.done}/{monthlyStats.total}</span>
                    </div>
                    <h3 className="text-sm font-black leading-none pr-4">Công việc định kỳ</h3>
                    <Progress value={(monthlyStats.done / (monthlyStats.total || 1)) * 100} className="mt-2.5 h-1 bg-primary/10" />
                  </div>
                  
                  <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                </button>
              )}

              {/* Tile: Daily Tasks */}
              {showWorkStuff && (
                <button
                  onClick={() => setDailyListOpen(true)}
                  disabled={targetedDailyTasks.length === 0}
                  className="group relative flex items-center gap-3 p-3 rounded-2xl border border-blue-500/10 bg-blue-500/5 text-left transition-all hover:bg-blue-500/10 active:scale-[0.98] disabled:opacity-40 disabled:grayscale"
                >
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/20">
                    <ListChecks className="h-5 w-5" />
                    {dailyStats.total > 0 && dailyStats.done < dailyStats.total && (
                      <StatusDot />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-600/70">Phát sinh</span>
                      <span className="text-[10px] font-black text-muted-foreground">{dailyStats.done}/{dailyStats.total}</span>
                    </div>
                    <h3 className="text-sm font-black leading-none pr-4">Công việc cần làm</h3>
                    <Progress value={(dailyStats.done / (dailyStats.total || 1)) * 100} className="mt-2.5 h-1 bg-blue-500/10" />
                  </div>
                  
                  <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-blue-600 transition-colors shrink-0" />
                </button>
              )}

              {/* Tile: Events */}
              <button
                onClick={() => setEventsListOpen(true)}
                disabled={relevantEvents.length === 0}
                className="group relative flex items-center gap-3 p-3 rounded-2xl border border-emerald-500/10 bg-emerald-500/5 text-left transition-all hover:bg-emerald-500/10 active:scale-[0.98] disabled:opacity-40 disabled:grayscale"
              >
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/20">
                  <Zap className="h-5 w-5" />
                  {pendingEventsCount > 0 && (
                    <StatusDot />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600/70">Tương tác</span>
                    <span className="text-[10px] font-black text-muted-foreground">
                      {relevantEvents.length - pendingEventsCount}/{relevantEvents.length}
                    </span>
                  </div>
                  <h3 className="text-sm font-black leading-none pr-4 mb-2">Sự kiện & Bình chọn</h3>
                  
                  {pendingEventsCount > 0 ? (
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 animate-pulse">
                      <span className="text-[10px] font-black">{pendingEventsCount}</span>
                      <span className="text-[8px] font-black uppercase tracking-tighter">Cần làm</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700/50">
                      <span className="text-[10px] font-black">{relevantEvents.length}</span>
                      <span className="text-[8px] font-black uppercase tracking-tighter">Đã xong</span>
                    </div>
                  )}
                  <Progress 
                    value={((relevantEvents.length - pendingEventsCount) / (relevantEvents.length || 1)) * 100} 
                    className="mt-2.5 h-1 bg-emerald-500/10" 
                  />
                </div>
                
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-emerald-600 transition-colors shrink-0" />
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <MonthlyTasksDialog
        open={monthlyListOpen}
        onOpenChange={setMonthlyListOpen}
        assignments={visibleMonthlyAssignments}
        getStatus={(assignment: MonthlyTaskAssignment) => getMonthlyCompletionStatus(assignment, user?.uid)}
        onSubmitMedia={async (assignment, media, note) => {
          try {
            await handleSubmitMedia(assignment, media, note);
            toast.success("Đã báo cáo hình ảnh");
          } catch (error) {
            console.error("Error submitting media", error);
            toast.error("Báo cáo hình ảnh thất bại");
          }
        }}
        onSubmitNote={async (assignment, note, markCompleted) => {
          try {
            await handleSubmitNote(assignment, note, markCompleted);
            toast.success(markCompleted ? "Đã hoàn thành công việc" : "Đã lưu ghi chú");
          } catch (error) {
            console.error("Error submitting note", error);
            toast.error("Thất bại");
          }
        }}
      />

      <DailyAssignmentsDialog
        open={dailyListOpen}
        onOpenChange={setDailyListOpen}
        tasks={targetedDailyTasks}
        reportsByTask={dailyReportsByTask}
        onNavigate={handleDailyNavigate}
      />

      <EventsDialog
        open={eventsListOpen}
        onOpenChange={setEventsListOpen}
        events={relevantEvents}
        currentUser={user}
        joinedEventIds={joinedEventIds}
      />
    </>
  );
}
