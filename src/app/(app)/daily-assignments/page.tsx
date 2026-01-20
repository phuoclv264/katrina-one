"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, addDays, subMonths, addMonths } from "date-fns";
import { vi } from "date-fns/locale";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  AlertCircle,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardList,
  ImageIcon,
  Loader2,
  Send,
  ShieldCheck,
  Users,
  Video,
  MessageSquare,
} from "lucide-react";
import { toast } from "@/components/ui/pro-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { useAuth } from "@/hooks/use-auth";
import { dataStore } from "@/lib/data-store";
import { cn } from "@/lib/utils";
import type {
  DailyTask,
  DailyTaskReport,
  DailyTaskTargetMode,
  ManagedUser,
  MediaAttachment,
  MediaItem,
  UserRole,
} from "@/lib/types";
import CameraDialog from "@/components/camera-dialog";
import { LoadingPage } from '@/components/loading/LoadingPage';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { useLightbox } from '@/contexts/lightbox-context';

import MediaPreview from './_components/MediaPreview';
import ReportCard from './_components/ReportCard';
import TaskCard from './_components/TaskCard';
import { DateStrip } from './_components/DateStrip';
import CreateTaskDialog from './_components/CreateTaskDialog';
import { motion, AnimatePresence } from "framer-motion";
const ROLES: UserRole[] = ["Phục vụ", "Pha chế", "Quản lý", "Thu ngân"];

const formatDateInput = (date: Date) => format(date, "yyyy-MM-dd");

const isUserTargeted = (task: DailyTask, userId: string, userRoles: UserRole[]) => {
  if (task.targetMode === "roles") {
    return (task.targetRoles || []).some((role) => userRoles.includes(role));
  }
  if (task.targetMode === "users") {
    return (task.targetUserIds || []).includes(userId);
  }
  return false;
};

import { Suspense } from 'react';

function DailyAssignmentsPageContent() {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [reports, setReports] = useState<DailyTaskReport[]>([]);
  const [monthTasks, setMonthTasks] = useState<DailyTask[]>([]);
  const [monthReports, setMonthReports] = useState<DailyTaskReport[]>([]);
  const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isInstructionCameraOpen, setInstructionCameraOpen] = useState(false);
  const [activeTaskForProof, setActiveTaskForProof] = useState<string | null>(null);
  const [pendingReportMedia, setPendingReportMedia] = useState<Record<string, MediaItem[]>>({});
  const [pendingReportNotes, setPendingReportNotes] = useState<Record<string, string>>({});
  const [managerNotes, setManagerNotes] = useState<Record<string, string>>({});
  const [pendingReportId, setPendingReportId] = useState<string | null>(null);

  // Tracks whether reports for a given task are expanded
  const [expandedReports, setExpandedReports] = useState<Record<string, boolean>>({});

  const toggleReportsForTask = (taskId: string) => {
    setExpandedReports((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const regenerateTask = async (taskId: string) => {
    if (!user) {
      toast.error('Bạn cần đăng nhập.');
      return;
    }

    const original = [...tasks, ...monthTasks].find((t) => t.id === taskId);
    if (!original) {
      toast.error('Không tìm thấy nhiệm vụ để giao lại.');
      return;
    }

    try {
      await dataStore.createDailyTask({
        title: original.title,
        description: original.description,
        assignedDate: formatDateInput(new Date()),
        targetMode: original.targetMode,
        targetRoles: original.targetMode === 'roles' ? original.targetRoles : [],
        targetUserIds: original.targetMode === 'users' ? original.targetUserIds : [],
        existingMedia: original.media || [],
        createdBy: { userId: user.uid, userName: user.displayName },
        createdByRole: user.role as UserRole,
      });

      toast.success('Đã giao lại nhiệm vụ cho hôm nay.');
    } catch (error) {
      console.error('Failed to regenerate task', error);
      toast.error('Không thể giao lại nhiệm vụ.');
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!user) {
      toast.error('Bạn cần đăng nhập.');
      return;
    }

    try {
      await dataStore.deleteDailyTask(taskId);
      toast.success('Đã xóa nhiệm vụ.');
    } catch (error) {
      console.error('Failed to delete task', error);
      toast.error('Không thể xóa nhiệm vụ.');
    }
  };

  const handleEditTask = (taskId: string) => {
    const original = [...tasks, ...monthTasks].find((t) => t.id === taskId);
    if (!original) {
      toast.error('Không tìm thấy nhiệm vụ để chỉnh sửa.');
      return;
    }

    setEditingTaskId(taskId);
    setNewTask({
      title: original.title,
      description: original.description,
      assignedDate: original.assignedDate,
      targetMode: original.targetMode,
      targetRoles: original.targetMode === 'roles' ? (original.targetRoles || []) : [],
      targetUserIds: original.targetMode === 'users' ? (original.targetUserIds || []) : [],
      media: (original.media || []).map((m: any) => ({ id: m.url || m.id, type: m.type })),
    });

    setIsCreateDialogOpen(true);
  };

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    assignedDate: formatDateInput(new Date()),
    targetMode: "roles" as DailyTaskTargetMode,
    targetRoles: ["Phục vụ" as UserRole],
    targetUserIds: [] as string[],
    media: [] as MediaItem[],
  });

  const highlightedReportId = searchParams?.get("highlight") || null;
  const highlightRef = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // used when owner clicks "Xem" on the monthly timeline to jump to that day
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewDate = useCallback((dKey?: string) => {
    if (!dKey) return;
    const d = new Date(dKey);
    if (Number.isNaN(d.getTime())) return;
    setSelectedDate(d);
    setCurrentMonth(d);
    // give React a moment to update and then scroll the container into view
    setTimeout(() => containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }, [setCurrentMonth, setSelectedDate]);

  const { openLightbox } = useLightbox();

  const userRoles = useMemo(() => {
    if (!user) return [] as UserRole[];
    return [user.role as UserRole, ...((user.secondaryRoles as UserRole[]) || [])];
  }, [user]);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubTasks = dataStore.subscribeToDailyTasksForDate(selectedDate, setTasks);
    const unsubReports = dataStore.subscribeToDailyTaskReportsForDate(selectedDate, setReports);
    const unsubUsers = dataStore.subscribeToUsers(setAllUsers);
    return () => {
      unsubTasks();
      unsubReports();
      unsubUsers();
    };
  }, [selectedDate, user]);

  useEffect(() => {
    if (!user || user.role !== "Chủ nhà hàng") return;
    const unsubMonthTasks = dataStore.subscribeToDailyTasksForMonth(currentMonth, setMonthTasks);
    const unsubMonthReports = dataStore.subscribeToDailyTaskReportsForMonth(currentMonth, setMonthReports);
    return () => {
      unsubMonthTasks();
      unsubMonthReports();
    };
  }, [currentMonth, user]);

  useEffect(() => {
    if (!highlightedReportId || reports.length === 0) return;
    const el = highlightRef.current.get(highlightedReportId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 1800);
    }
  }, [highlightedReportId, reports]);

  const reportsByTask = useMemo(() => {
    const map = new Map<string, DailyTaskReport[]>();
    reports.forEach((r) => {
      const list = map.get(r.taskId) || [];
      list.push(r);
      map.set(r.taskId, list);
    });
    return map;
  }, [reports]);

  // Local helpers for passing down to components
  const setManagerNote = (id: string, note: string) => {
    setManagerNotes((prev) => ({ ...prev, [id]: note }));
  };

  const openReportLightbox = (slides: any[], index: number) => {
    openLightbox(slides, index);
  };


  const targetedTasks = useMemo(() => {
    if (!user) return [] as DailyTask[];
    return tasks.filter((task) => isUserTargeted(task, user.uid, userRoles));
  }, [tasks, user, userRoles]);

  const ownerSummary = useMemo(() => {
    if (!user || user.role !== "Chủ nhà hàng") return null;
    const totalTasks = monthTasks.length;
    const completedTasks = monthTasks.filter((t) => t.status === "completed").length;
    const reportCount = monthReports.length;
    const approvedReports = monthReports.filter((r) => r.status === "manager_approved").length;

    const grouped = new Map<string, { tasks: DailyTask[]; reports: DailyTaskReport[] }>();
    monthTasks.forEach((t) => {
      const bucket = grouped.get(t.assignedDate) || { tasks: [], reports: [] };
      bucket.tasks.push(t);
      grouped.set(t.assignedDate, bucket);
    });
    monthReports.forEach((r) => {
      const bucket = grouped.get(r.assignedDate) || { tasks: [], reports: [] };
      bucket.reports.push(r);
      grouped.set(r.assignedDate, bucket);
    });

    const timeline = Array.from(grouped.entries()).sort((a, b) => b[0].localeCompare(a[0]));

    return { totalTasks, completedTasks, reportCount, approvedReports, timeline };
  }, [user, monthTasks, monthReports]);

  const addInstructionMedia = (items: MediaItem[]) => {
    setNewTask((prev) => ({ ...prev, media: [...prev.media, ...items] }));
    setInstructionCameraOpen(false);
  };

  const handleCreateTask = async () => {
    if (!user) {
      toast.error("Bạn cần đăng nhập.");
      return;
    }
    if (!newTask.title.trim() || !newTask.description.trim()) {
      toast.error("Vui lòng nhập tiêu đề và mô tả.");
      return;
    }
    if (newTask.targetMode === "roles" && (!newTask.targetRoles || newTask.targetRoles.length === 0)) {
      toast.error("Chọn ít nhất một vai trò.");
      return;
    }
    if (newTask.targetMode === "users" && newTask.targetUserIds.length === 0) {
      toast.error("Chọn nhân viên cần giao việc.");
      return;
    }

    setIsCreating(true);
    try {
      if (editingTaskId) {
        await dataStore.updateDailyTask(editingTaskId, {
          title: newTask.title,
          description: newTask.description,
          assignedDate: newTask.assignedDate || formatDateInput(selectedDate),
          targetMode: newTask.targetMode,
          targetRoles: newTask.targetMode === "roles" ? newTask.targetRoles : [],
          targetUserIds: newTask.targetMode === "users" ? newTask.targetUserIds : [],
          media: newTask.media,
        });
        toast.success("Đã cập nhật nhiệm vụ.");
        setEditingTaskId(null);
      } else {
        await dataStore.createDailyTask({
          title: newTask.title,
          description: newTask.description,
          assignedDate: newTask.assignedDate || formatDateInput(selectedDate),
          targetMode: newTask.targetMode,
          targetRoles: newTask.targetMode === "roles" ? newTask.targetRoles : [],
          targetUserIds: newTask.targetMode === "users" ? newTask.targetUserIds : [],
          media: newTask.media,
          createdBy: { userId: user.uid, userName: user.displayName },
          createdByRole: user.role as UserRole,
        });
        toast.success("Đã tạo việc trong ngày.");
      }

      setNewTask({
        title: "",
        description: "",
        assignedDate: formatDateInput(selectedDate),
        targetMode: "roles",
        targetRoles: ["Phục vụ"],
        targetUserIds: [],
        media: [],
      });
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error("Failed to create task", error);
      toast.error(editingTaskId ? "Không thể cập nhật nhiệm vụ." : "Không thể tạo việc.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddProofMedia = (taskId: string, media: MediaItem[]) => {
    setPendingReportMedia((prev) => ({ ...prev, [taskId]: [...(prev[taskId] || []), ...media] }));
    setActiveTaskForProof(null);
  };

  const handleSubmitReport = async (task: DailyTask) => {
    if (!user) return;
    const note = pendingReportNotes[task.id] || "";
    const media = pendingReportMedia[task.id] || [];
    if (!note.trim() && media.length === 0) {
      toast.error("Thêm nội dung hoặc bằng chứng trước khi gửi.");
      return;
    }
    setPendingReportId(task.id);
    try {
      await dataStore.submitDailyTaskReport({
        task,
        reporter: { userId: user.uid, userName: user.displayName },
        content: note,
        media,
      });
      toast.success("Đã gửi báo cáo.");
      setPendingReportNotes((prev) => ({ ...prev, [task.id]: "" }));
      setPendingReportMedia((prev) => ({ ...prev, [task.id]: [] }));
    } catch (error) {
      console.error("Failed to submit report", error);
      toast.error("Không thể gửi báo cáo.");
    } finally {
      setPendingReportId(null);
    }
  };

  const handleApproveReport = async (task: DailyTask, report: DailyTaskReport) => {
    if (!user) return;
    setPendingReportId(report.id);
    try {
      await dataStore.approveDailyTaskReport({
        task,
        report,
        manager: { userId: user.uid, userName: user.displayName },
        managerNote: managerNotes[report.id],
      });
      toast.success("Đã đánh dấu hoàn thành và gửi chủ.");
    } catch (error) {
      console.error("Failed to approve report", error);
      toast.error("Không thể duyệt báo cáo.");
    } finally {
      setPendingReportId(null);
    }
  };

  const renderReport = (task: DailyTask, report: DailyTaskReport, idx: number) => {
    const isHighlighted = highlightedReportId === report.id;
    const safeKey = report.id || `report-${task.id || 'unknown'}-${idx}`;
    return (
      <div key={safeKey} ref={(el) => {
        if (el) highlightRef.current.set(safeKey, el);
        else highlightRef.current.delete(safeKey);
      }}>
        <ReportCard
          task={task}
          report={report}
          isHighlighted={isHighlighted}
          managerNote={managerNotes[report.id]}
          setManagerNote={setManagerNote}
          onApprove={handleApproveReport}
          pendingReportId={pendingReportId}
          canApprove={!!user && (user.role === 'Chủ nhà hàng' || (user.role === 'Quản lý' && task.createdBy?.userId === user.uid && report.reporter.userId !== user.uid))}
        />
      </div>
    );
  };


  const renderTaskCard = (task: DailyTask, isMine: boolean, idx: number = 0) => {
    const taskReports = reportsByTask.get(task.id) || [];
    const pendingMedia = pendingReportMedia[task.id] || [];
    const pendingNote = pendingReportNotes[task.id] || "";
    const canSubmit = user && isMine;
    const isExpanded = !!expandedReports[task.id];

    const safeKey = task.id || `task-${task.assignedDate || 'unknown'}-${idx}`;
    return (
      <div key={safeKey}>
        <TaskCard
          task={task}
          reports={taskReports}
          canSubmit={!!canSubmit}
          pendingMedia={pendingMedia}
          pendingNote={pendingNote}
          onSetPendingNote={(taskId, note) => setPendingReportNotes((prev) => ({ ...prev, [taskId]: note }))}
          onAddProofMedia={handleAddProofMedia}
          onSubmitReport={handleSubmitReport}
          onSetActiveTaskForProof={(id) => setActiveTaskForProof(id)}
          pendingReportId={pendingReportId}
          reportsExpanded={isExpanded}
          onToggleReports={toggleReportsForTask}
          onRegenerate={user?.role === 'Chủ nhà hàng' ? regenerateTask : undefined}
          onDelete={user?.role === 'Chủ nhà hàng' ? deleteTask : undefined}
          onEdit={user?.role === 'Chủ nhà hàng' ? () => handleEditTask(task.id) : (user?.role === 'Quản lý' && task.createdBy?.userId === user.uid) ? () => handleEditTask(task.id) : undefined}
        />

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 mt-3"
            >
              {taskReports.map((r, i) => renderReport(task, r, i))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  if (loading) {
    return <LoadingPage />;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Alert className="max-w-md border-red-100 bg-red-50/50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-700">Phiên đăng nhập hết hạn</AlertTitle>
            <AlertDescription className="text-red-600/80">Vui lòng đăng nhập lại để xem công việc của mình.</AlertDescription>
          </Alert>
        </motion.div>
      </div>
    );
  }

  const completionStats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    inReview: tasks.filter(t => t.status === 'in_review').length,
    mineCount: targetedTasks.length
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 pb-20">
      <div className="container mx-auto max-w-5xl px-3 sm:px-4 pt-4 sm:pt-6 space-y-6 sm:space-y-8">
        {/* Header Section */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-6 w-1 sm:h-8 sm:w-1 bg-primary rounded-full" />
              <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-4xl">Giao việc</h1>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium italic sm:not-italic">Quản lý và theo dõi nhiệm vụ phát sinh hằng ngày</p>
          </div>

          {(user.role === "Quản lý" || user.role === "Chủ nhà hàng") && (
            <>
              <Button onClick={() => setIsCreateDialogOpen(true)} className="h-10 sm:h-11 px-4 sm:px-6 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 font-black uppercase tracking-wider text-[11px] sm:text-xs">
                <ClipboardList className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                Tạo nhiệm vụ mới
              </Button>

              <CreateTaskDialog
                isOpen={isCreateDialogOpen}
                onOpenChange={(open) => {
                  setIsCreateDialogOpen(open);
                  if (!open) {
                    setNewTask({
                      title: "",
                      description: "",
                      assignedDate: formatDateInput(selectedDate),
                      targetMode: "roles",
                      targetRoles: ["Phục vụ"],
                      targetUserIds: [],
                      media: [],
                    });
                    setEditingTaskId(null);
                  }
                }}
                newTask={newTask}
                setNewTask={setNewTask}
                onCreate={handleCreateTask}
                isCreating={isCreating}
                isEditing={!!editingTaskId}
                setInstructionCameraOpen={setInstructionCameraOpen}
                allUsers={allUsers}
                roles={ROLES}
                parentDialogTag="root"
              />
            </>
          )}
        </div>

        {/* Date Selection Strip - Sticky on Mobile, Centered, Below Global Header */}
        {(user.role === "Chủ nhà hàng") && (
          <div className="sticky top-[3.5rem] z-20 flex justify-center">
            <div className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl flex justify-center">
              <DateStrip selectedDate={selectedDate} onDateChange={(date) => {
                setSelectedDate(date);
                setNewTask(prev => ({ ...prev, assignedDate: formatDateInput(date) }));
              }} />
            </div>
          </div>
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border bg-background p-3 sm:p-4 shadow-sm">
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tổng việc</p>
            <p className="mt-0.5 sm:mt-1 text-xl sm:text-2xl font-black">{completionStats.total}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-xl border bg-background p-3 sm:p-4 shadow-sm border-green-100">
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-green-600">Hoàn tất</p>
            <p className="mt-0.5 sm:mt-1 text-xl sm:text-2xl font-black text-green-700">{completionStats.completed}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-xl border bg-background p-3 sm:p-4 shadow-sm border-amber-100">
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-amber-600">Đang duyệt</p>
            <p className="mt-0.5 sm:mt-1 text-xl sm:text-2xl font-black text-amber-700">{completionStats.inReview}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="rounded-xl border bg-background p-3 sm:p-4 shadow-sm border-primary/20">
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-primary">Việc tôi</p>
            <p className="mt-0.5 sm:mt-1 text-xl sm:text-2xl font-black text-primary">{completionStats.mineCount}</p>
          </motion.div>
        </div>

        {/* Role-based view: managers and owners see all tasks; other staff see only their assigned tasks. Tabs are removed per design. */}
        {(user.role === "Quản lý" || user.role === "Chủ nhà hàng") ? (
          <motion.div
            key="all-content"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4 mt-0"
          >
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 border-2 border-dashed rounded-3xl bg-muted/5">
                <div className="h-16 w-16 rounded-full bg-muted/20 flex items-center justify-center text-muted-foreground">
                  <AlertCircle className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold">Chưa có nhiệm vụ nào được tạo</h3>
                  <p className="text-muted-foreground max-w-xs">Hãy chọn ngày khác hoặc tạo nhiệm vụ mới nếu bạn là quản lý.</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
                {tasks.map((task, idx) => renderTaskCard(task, isUserTargeted(task, user.uid, userRoles), idx))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="mine-content"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4 mt-0"
          >
            {targetedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 border-2 border-dashed rounded-3xl bg-muted/5">
                <div className="h-16 w-16 rounded-full bg-muted/20 flex items-center justify-center text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold">Tuyệt vời, bạn không có nhiệm vụ nào!</h3>
                  <p className="text-muted-foreground max-w-xs">Hoặc quản lý chưa giao việc riêng cho bạn trong hôm nay.</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
                {targetedTasks.map((task, idx) => renderTaskCard(task, true, idx))}
              </div>
            )}
          </motion.div>
        )}

        {ownerSummary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="overflow-hidden border-none shadow-xl shadow-slate-200/50 bg-white/80 backdrop-blur-md">
              <CardHeader className="flex flex-col gap-4 p-4 sm:p-6 md:flex-row md:items-center md:justify-between border-b bg-slate-50/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-primary/10 p-1.5 sm:p-2 text-primary">
                      <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <CardTitle className="text-lg sm:text-xl font-black">Tổng quan tháng {format(currentMonth, "MM/yyyy")}</CardTitle>
                  </div>
                  <CardDescription className="text-xs sm:text-sm font-medium">Phân tích hiệu suất giao việc của hệ thống</CardDescription>
                </div>
                <div className="flex bg-muted p-1 rounded-xl w-full sm:w-auto">
                  <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="flex-1 sm:flex-none h-8 px-3 text-xs font-bold">
                    Tháng trước
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="flex-1 sm:flex-none h-8 px-3 text-xs font-bold">
                    Tháng sau
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-6 sm:space-y-8">
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                  {[
                    { label: "Nhiệm vụ", value: ownerSummary!.totalTasks, color: "text-slate-900", bg: "bg-slate-100/50" },
                    { label: "Hoàn tất", value: ownerSummary!.completedTasks, color: "text-green-600", bg: "bg-green-50" },
                    { label: "Báo cáo", value: ownerSummary!.reportCount, color: "text-blue-600", bg: "bg-blue-50" },
                    { label: "Đã duyệt", value: ownerSummary!.approvedReports, color: "text-primary", bg: "bg-primary/5" },
                  ].map((stat, i) => (
                    <div key={i} className={cn("rounded-xl border border-transparent p-3 sm:p-5 transition-all", stat.bg)}>
                      <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-70">{stat.label}</p>
                      <p className={cn("mt-0.5 text-xl sm:text-3xl font-black", stat.color)}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <div className="h-px flex-1 bg-border" />
                    Hoạt động
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  {ownerSummary!.timeline.length === 0 ? (
                    <div className="py-10 text-center text-[10px] text-muted-foreground font-medium italic">Không có dữ liệu tháng này.</div>
                  ) : (
                    <div className="grid gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {ownerSummary!.timeline.map(([dateKey, bucket], i) => {
                        const safeDateKey = dateKey || `day-${i}`;
                        const completionRate = (bucket.tasks.filter((t) => t.status === "completed").length / (bucket.tasks.length || 1)) * 100;
                        
                        return (
                          <div 
                            key={safeDateKey} 
                            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-card p-4 transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 hover:border-primary/30"
                          >
                            {/* Decorative background accent */}
                            <div 
                              className="absolute top-0 right-0 -mr-4 -mt-4 h-20 w-20 rounded-full bg-primary/5 transition-transform duration-700 group-hover:scale-150 group-hover:bg-primary/10" 
                            />
                            
                            <div className="relative">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                                    {format(new Date(dateKey), "EEEE", { locale: vi })}
                                  </span>
                                  <span className="text-sm font-black text-slate-800">
                                    {format(new Date(dateKey), "dd/MM/yyyy")}
                                  </span>
                                </div>
                                <Badge 
                                  variant="secondary" 
                                  className="bg-primary/10 text-primary border-none px-2.5 py-0.5 text-[10px] font-black ring-1 ring-primary/20"
                                >
                                  {bucket.tasks.length} VIỆC
                                </Badge>
                              </div>

                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-tighter">
                                    <span className="text-muted-foreground/70">Tiến độ hoàn thành</span>
                                    <span className="text-primary">{Math.round(completionRate)}%</span>
                                  </div>
                                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${completionRate}%` }}
                                      transition={{ duration: 1.2, ease: "circOut" }}
                                      className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.3)] transition-all"
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm">
                                      <MessageSquare className="h-3.5 w-3.5" />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[11px] font-black text-slate-700 leading-none">{bucket.reports.length}</span>
                                      <span className="text-[8px] font-bold text-muted-foreground uppercase">Báo cáo</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-green-50 text-green-600 shadow-sm">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[11px] font-black text-slate-700 leading-none">
                                        {bucket.tasks.filter((t) => t.status === "completed").length}
                                      </span>
                                      <span className="text-[8px] font-bold text-muted-foreground uppercase">Xong</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => viewDate(dateKey)}
                              className="mt-5 w-full h-10 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-primary hover:text-white hover:border-primary transition-all duration-300 text-[11px] font-black uppercase tracking-wider shadow-sm hover:shadow-md hover:shadow-primary/20"
                            >
                              Xem chi tiết
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      <CameraDialog
        isOpen={isInstructionCameraOpen}
        onClose={() => setInstructionCameraOpen(false)}
        onSubmit={addInstructionMedia}
        parentDialogTag="create-task-dialog"
        captureMode="both"
      />

      <CameraDialog
        isOpen={!!activeTaskForProof}
        onClose={() => setActiveTaskForProof(null)}
        onSubmit={(media: MediaItem[]) => {
          if (activeTaskForProof) {
            handleAddProofMedia(activeTaskForProof, media);
          }
        }}
        captureMode="both"
        parentDialogTag="root"
      />
    </div>
  );
}

export default function DailyAssignmentsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DailyAssignmentsPageContent />
    </Suspense>
  );
}
