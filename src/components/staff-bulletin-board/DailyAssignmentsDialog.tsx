"use client";

import { useMemo, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogBody,
    DialogAction
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    ListChecks,
    TimerReset,
    ChevronLeft,
    ArrowRight,
    User,
    Clock,
    Clipboard,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    Info,
    Camera,
    Send,
    ShieldCheck
} from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/pro-toast";
import CameraDialog from "@/components/camera-dialog";
import MediaPreview from "@/app/(app)/daily-assignments/_components/MediaPreview";
import CreateTaskDialog from "@/app/(app)/daily-assignments/_components/CreateTaskDialog";
import type { DailyTask, DailyTaskReport, DailyTaskTargetMode, ManagedUser, MediaItem, UserRole } from "@/lib/types";
import { dataStore } from "@/lib/data-store";
import { useAuth } from "@/hooks/use-auth";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

// Helper to handle Firestore dates
const formatReportTime = (date: any) => {
    if (!date) return "Chưa rõ thời gian";
    try {
        if (typeof date.toDate === "function") {
            return format(date.toDate(), "HH:mm, dd/MM");
        }
        if (date instanceof Date) {
            return format(date, "HH:mm, dd/MM");
        }
        return "Lỗi định dạng";
    } catch (e) {
        return "Lỗi hiển thị";
    }
};

const ROLES: UserRole[] = ["Phục vụ", "Pha chế", "Quản lý"];

const formatDateInput = (date: Date) => format(date, "yyyy-MM-dd");

const isUserTargeted = (task: DailyTask, userId: string, userRoles: UserRole[]): boolean => {
    if (task.targetMode === "roles") {
        return (task.targetRoles || []).some((role) => userRoles.includes(role));
    }
    if (task.targetMode === "users") {
        return (task.targetUserIds || []).includes(userId);
    }
    return false;
};

export type DailyAssignmentsDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tasks: DailyTask[];
    reportsByTask: Map<string, DailyTaskReport[]>;
    onNavigate: () => void;
    canManageDaily: boolean;
    allUsers: ManagedUser[];
};

export default function DailyAssignmentsDialog({ open, onOpenChange, tasks, reportsByTask, onNavigate, canManageDaily, allUsers }: DailyAssignmentsDialogProps) {
    const { user } = useAuth();
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [pendingReportNotes, setPendingReportNotes] = useState<Record<string, string>>({});
    const [pendingReportMedia, setPendingReportMedia] = useState<Record<string, MediaItem[]>>({});
    const [activeTaskForProof, setActiveTaskForProof] = useState<string | null>(null);
    const [pendingActionId, setPendingActionId] = useState<string | null>(null);
    const [managerNotes, setManagerNotes] = useState<Record<string, string>>({});

    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isInstructionCameraOpen, setInstructionCameraOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newTask, setNewTask] = useState({
        title: "",
        description: "",
        assignedDate: formatDateInput(new Date()),
        targetMode: "roles" as DailyTaskTargetMode,
        targetRoles: ["Phục vụ" as UserRole],
        targetUserIds: [] as string[],
        media: [] as MediaItem[],
    });

    const selectedTask = tasks.find(t => t.id === selectedTaskId);
    const selectedReports = selectedTaskId ? (reportsByTask.get(selectedTaskId) || []) : [];

    const userRoles = useMemo(() => {
        if (!user) return [] as UserRole[];
        return [user.role as UserRole, ...((user.secondaryRoles as UserRole[]) || [])];
    }, [user]);

    const handleBack = () => {
        setSelectedTaskId(null);
    };

    const handleAddProofMedia = (taskId: string, media: MediaItem[]) => {
        setPendingReportMedia((prev) => ({ ...prev, [taskId]: [...(prev[taskId] || []), ...media] }));
        setActiveTaskForProof(null);
    };

    const handleSubmitReport = async (task: DailyTask) => {
        if (!user) {
            toast.error("Bạn cần đăng nhập để gửi báo cáo.");
            return;
        }
        const note = pendingReportNotes[task.id] || "";
        const media = pendingReportMedia[task.id] || [];
        if (!note.trim() && media.length === 0) {
            toast.error("Thêm nội dung hoặc hình ảnh trước khi gửi.");
            return;
        }
        setPendingActionId(task.id);
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
            setPendingActionId(null);
        }
    };

    const handleApproveReport = async (task: DailyTask, report: DailyTaskReport) => {
        if (!user) {
            toast.error("Bạn cần đăng nhập.");
            return;
        }
        setPendingActionId(report.id);
        try {
            await dataStore.approveDailyTaskReport({
                task,
                report,
                manager: { userId: user.uid, userName: user.displayName },
                managerNote: managerNotes[report.id],
            });
            toast.success("Đã duyệt báo cáo hoàn tất.");
            setManagerNotes((prev) => ({ ...prev, [report.id]: "" }));
        } catch (error) {
            console.error("Failed to approve report", error);
            toast.error("Không thể duyệt báo cáo.");
        } finally {
            setPendingActionId(null);
        }
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
            toast.error("Chọn nhân viên nhận việc.");
            return;
        }

        setIsCreating(true);
        try {
            await dataStore.createDailyTask({
                title: newTask.title,
                description: newTask.description,
                assignedDate: newTask.assignedDate || formatDateInput(new Date()),
                targetMode: newTask.targetMode,
                targetRoles: newTask.targetMode === "roles" ? newTask.targetRoles : [],
                targetUserIds: newTask.targetMode === "users" ? newTask.targetUserIds : [],
                media: newTask.media,
                createdBy: { userId: user.uid, userName: user.displayName },
                createdByRole: user.role as UserRole,
            });
            toast.success("Đã tạo nhiệm vụ trong ngày.");
            setNewTask({
                title: "",
                description: "",
                assignedDate: formatDateInput(new Date()),
                targetMode: "roles",
                targetRoles: ["Phục vụ"],
                targetUserIds: [],
                media: [],
            });
            setIsCreateDialogOpen(false);
        } catch (error) {
            console.error("Failed to create task", error);
            toast.error("Không thể tạo nhiệm vụ.");
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            onOpenChange(val);
            if (!val) setSelectedTaskId(null);
        }} dialogTag="daily-list-dialog" parentDialogTag="root">
            <DialogContent className="max-w-lg p-0 overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] bg-zinc-50 dark:bg-zinc-950 rounded-[2.5rem] border-none">
                <DialogTitle className="sr-only">
                    {selectedTask ? selectedTask.title : "Giao việc hôm nay"}
                </DialogTitle>
                <DialogDescription className="sr-only">
                    Chi tiết các nhiệm vụ được giao trong ngày
                </DialogDescription>

                {!selectedTask ? (
                    <div className="flex flex-col h-full overflow-hidden">
                        <DialogHeader variant="premium" icon={<ListChecks className="h-6 w-6 text-primary" />}>
                            <div className="space-y-0.5">
                                <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight">Giao việc hôm nay</DialogTitle>
                                <DialogDescription className="font-bold opacity-70 text-[10px] sm:text-xs uppercase tracking-widest flex items-center gap-2">
                                    <span className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                                    {tasks.length} nhiệm vụ cần theo dõi
                                </DialogDescription>
                            </div>
                        </DialogHeader>

                        <DialogBody className="space-y-5 pt-6 pb-20 sm:pb-10 custom-scrollbar px-4 sm:px-6">
                            {canManageDaily && (
                                <div className="p-4 rounded-[2rem] border border-primary/10 bg-primary/5 dark:bg-primary/10 flex items-center justify-between gap-4 shadow-sm">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">Quản lý giao việc</p>
                                        <p className="text-[11px] text-zinc-500 font-medium leading-tight">Tạo nhiệm vụ mới cho nhân viên ngay.</p>
                                    </div>
                                    <Button
                                        size="sm"
                                        className="rounded-2xl h-10 px-4 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 shrink-0"
                                        onClick={() => setIsCreateDialogOpen(true)}
                                    >
                                        <ShieldCheck className="h-3.5 w-3.5 mr-2" />
                                        Giao việc
                                    </Button>
                                </div>
                            )}

                            {tasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 text-center">
                                    <div className="h-24 w-24 rounded-[2.5rem] bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6 ring-8 ring-zinc-50 dark:ring-zinc-900/50">
                                        <Clipboard className="h-10 w-10 text-zinc-300 dark:text-zinc-800" />
                                    </div>
                                    <p className="text-xs font-black text-zinc-400 uppercase tracking-[0.3em]">Trống nhiệm vụ</p>
                                    <p className="text-[11px] text-zinc-400 mt-2 font-medium italic opacity-60 max-w-[200px]">Tất cả đã hoàn tất hoặc chưa có nhiệm vụ mới</p>
                                </div>
                            ) : (
                                <div className="space-y-3 pb-4">
                                    {tasks.map((task) => {
                                        const reports = reportsByTask.get(task.id) || [];
                                        const isCompleted = task.status === "completed";
                                        const isPending = task.status === "in_review";

                                        return (
                                            <motion.button
                                                key={task.id}
                                                whileHover={{ scale: 1.01 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => setSelectedTaskId(task.id)}
                                                className={cn(
                                                    "w-full text-left rounded-[2rem] p-5 transition-all relative border overflow-hidden group shadow-sm",
                                                    isCompleted
                                                        ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 opacity-60 grayscale-[0.5]"
                                                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:ring-2 hover:ring-primary/20",
                                                    isPending && "bg-amber-50/20 dark:bg-amber-900/10 border-amber-200/40 dark:border-amber-900/30"
                                                )}
                                            >
                                                <div className="flex flex-col gap-3.5">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            {isCompleted ? (
                                                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                            ) : isPending ? (
                                                                <Clock className="h-4 w-4 text-amber-500" />
                                                            ) : (
                                                                <AlertCircle className="h-4 w-4 text-primary" />
                                                            )}
                                                            <span className={cn(
                                                                "text-[9px] font-black uppercase tracking-[0.15em]",
                                                                isCompleted ? "text-emerald-600" : isPending ? "text-amber-600" : "text-primary"
                                                            )}>
                                                                {isCompleted ? "Hoàn tất" : isPending ? "Chờ duyệt" : "Mới"}
                                                            </span>
                                                            {!isCompleted && !isPending && (
                                                                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                                                            )}
                                                        </div>
                                                        <span className="text-[9px] font-bold text-zinc-400 flex items-center gap-1.5 uppercase tracking-wider">
                                                            <TimerReset className="h-3 w-3 opacity-60" />
                                                            {task.assignedDate}
                                                        </span>
                                                    </div>

                                                    <div className="space-y-1.5 pr-6">
                                                        <h4 className="text-base font-black leading-tight text-zinc-900 dark:text-zinc-100">
                                                            {task.title}
                                                        </h4>
                                                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed font-medium">
                                                            {task.description}
                                                        </p>
                                                    </div>

                                                    {reports.length > 0 && (
                                                        <div className="flex items-center gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 mt-0.5">
                                                            <div className="flex -space-x-1.5">
                                                                {reports.slice(0, 3).map((r, i) => (
                                                                    <div key={i} className="h-6 w-6 rounded-full bg-zinc-100 dark:bg-zinc-800 border-2 border-white dark:border-zinc-900 flex items-center justify-center shadow-sm">
                                                                        <User className="h-2.5 w-2.5 text-zinc-400" />
                                                                    </div>
                                                                ))}
                                                                {reports.length > 3 && (
                                                                    <div className="h-6 w-6 rounded-full bg-zinc-200 dark:bg-zinc-800 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[8px] font-black shadow-sm">
                                                                        +{reports.length - 3}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                                                                {reports.length} báo cáo
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="absolute right-5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300 text-primary">
                                                    <ChevronRight className="h-5 w-5" strokeWidth={3} />
                                                </div>
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            )}
                        </DialogBody>

                        <DialogFooter className="p-6 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 rounded-b-[2.5rem]">
                            <DialogAction
                                variant="outline"
                                className="w-full h-14 rounded-2xl font-black text-zinc-400 hover:text-primary transition-all uppercase tracking-[0.2em] text-[10px] border-zinc-200 dark:border-zinc-800"
                                onClick={() => onOpenChange(false)}
                            >
                                Đóng cửa sổ
                            </DialogAction>
                        </DialogFooter>
                    </div>
                ) : (
                    <div className="flex flex-col h-full overflow-hidden">
                        <DialogHeader variant="premium" className="p-3 pr-16" icon={<Button variant="ghost" size="icon" onClick={handleBack} className="h-10 w-10 rounded-2xl bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 shadow-sm"><ChevronLeft className="h-5 w-5" strokeWidth={3} /></Button>}>
                            <div className="min-w-0 flex flex-col">
                                <DialogTitle className="pb-1 pr-4 text-lg font-black truncate">{selectedTask.title}</DialogTitle>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button className="flex items-center outline-none group cursor-pointer -ml-0.5">
                                            <DialogDescription className="text-primary font-bold opacity-70 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] group-hover:opacity-100 transition-opacity">
                                                <Info className="h-3 w-3" />
                                                Chi tiết & Báo cáo
                                                <span className="h-1 w-1 rounded-full bg-primary animate-pulse ml-0.5" />
                                            </DialogDescription>
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[calc(100vw-4rem)] sm:max-w-xs p-5 rounded-[2rem] border-none shadow-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/10 dark:ring-zinc-800/10 z-[100]" align="start" sideOffset={8}>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <div className="h-4 w-1 bg-primary rounded-full" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tiêu đề đầy đủ</span>
                                            </div>
                                            <p className="text-sm font-black leading-relaxed text-zinc-900 dark:text-zinc-100">
                                                {selectedTask.title}
                                            </p>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </DialogHeader>

                        <DialogBody className="space-y-6 pt-6 pb-4 sm:pb-6 custom-scrollbar px-4 sm:px-6">
                            {/* Requirement Card */}
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-5 shadow-sm space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="h-5 w-1 bg-primary rounded-full" />
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">Nội dung nhiệm vụ</h4>
                                </div>
                                <p className="text-[13px] sm:text-sm font-medium leading-relaxed text-zinc-700 dark:text-zinc-300">
                                    {selectedTask.description}
                                </p>

                                {selectedTask.media && selectedTask.media.length > 0 && (
                                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest whitespace-nowrap">Hướng dẫn mẫu</span>
                                            <div className="h-px bg-zinc-100 dark:bg-zinc-800 flex-1" />
                                        </div>
                                        <MediaPreview media={selectedTask.media} />
                                    </div>
                                )}
                            </div>

                            {/* Reports Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-2">
                                    <div className="flex items-center gap-2">
                                        <div className="h-5 w-1 bg-amber-500 rounded-full" />
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">Hoạt động ({selectedReports.length})</h4>
                                    </div>
                                    <Clock className="h-3.5 w-3.5 text-zinc-300 animate-spin-slow" />
                                </div>

                                <div className="space-y-4 px-2">
                                    {selectedReports.length > 0 ? (
                                        selectedReports.map((report, idx) => {
                                            const isApproved = report.status === "manager_approved";
                                            const canApprove = user && selectedTask && (
                                                user.role === "Chủ nhà hàng" ||
                                                (user.role === "Quản lý" && selectedTask.createdBy?.userId === user.uid && report.reporter.userId !== user.uid)
                                            );

                                            return (
                                                <div key={idx} className="relative flex gap-4">
                                                    {idx !== selectedReports.length - 1 && (
                                                        <div className="absolute left-4 top-8 bottom-0 w-[1.5px] bg-zinc-100 dark:bg-zinc-800" />
                                                    )}
                                                    <div className="h-8 w-8 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shrink-0 z-10 shadow-sm ring-4 ring-zinc-50 dark:ring-zinc-950">
                                                        <User className="h-3.5 w-3.5 text-zinc-400" />
                                                    </div>
                                                    <div className="flex-1 space-y-3 pb-8">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex flex-col">
                                                                <span className="text-[13px] font-black text-zinc-900 dark:text-zinc-100">
                                                                    {report.reporter?.userName || "Nhân viên"}
                                                                </span>
                                                                <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5">
                                                                    {formatReportTime(report.createdAt)}
                                                                </span>
                                                            </div>
                                                            <Badge variant="outline" className={cn(
                                                                "text-[8px] h-5 font-black uppercase tracking-widest px-2 rounded-full",
                                                                isApproved ? "border-emerald-500/30 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/10" : "border-primary/30 text-primary bg-primary/5 shadow-sm shadow-primary/5"
                                                            )}>
                                                                {isApproved ? "Đã duyệt" : "Đã gửi"}
                                                            </Badge>
                                                        </div>

                                                        {report.content && (
                                                            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-4 rounded-[1.5rem] rounded-tl-none shadow-sm text-[13px] text-zinc-600 dark:text-zinc-400 italic font-medium leading-relaxed">
                                                                "{report.content}"
                                                            </div>
                                                        )}

                                                        {report.media && report.media.length > 0 && (
                                                            <div className="rounded-2xl overflow-hidden mt-2">
                                                                <MediaPreview media={report.media} />
                                                            </div>
                                                        )}

                                                        {isApproved && report.managerNote && (
                                                            <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/20 dark:border-emerald-900/30 dark:bg-emerald-900/10 p-4 ring-1 ring-emerald-500/5">
                                                                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-400 mb-1.5">
                                                                    <ShieldCheck className="h-3 w-3" />
                                                                    Phản hồi từ {report.reviewedBy?.userName || "Quản lý"}
                                                                </div>
                                                                <p className="text-[12px] text-emerald-800/80 dark:text-emerald-200/80 font-medium leading-normal">{report.managerNote}</p>
                                                            </div>
                                                        )}

                                                        {canApprove && !isApproved && (
                                                            <div className="mt-4 border-t border-zinc-100 dark:border-zinc-800 pt-4 space-y-3">
                                                                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-400">
                                                                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                                                    Duyệt nhanh báo cáo
                                                                </div>
                                                                <Textarea
                                                                    placeholder="Ghi chú phản hồi (tùy chọn)..."
                                                                    value={managerNotes[report.id] || ""}
                                                                    onChange={(e) => setManagerNotes((prev) => ({ ...prev, [report.id]: e.target.value }))}
                                                                    className="text-xs bg-muted/20 border-zinc-200 dark:border-zinc-800 focus-visible:ring-primary/20 resize-none h-18 rounded-2xl p-4 font-medium"
                                                                    rows={2}
                                                                />
                                                                <div className="flex justify-end pt-1">
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() => selectedTask && handleApproveReport(selectedTask, report)}
                                                                        disabled={pendingActionId === report.id}
                                                                        className="px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest h-10 shadow-lg shadow-primary/10"
                                                                    >
                                                                        {pendingActionId === report.id ? (
                                                                            <>
                                                                                <TimerReset className="mr-2 h-3 w-3 animate-spin" />
                                                                                Xử lý...
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                                                                                Duyệt hoàn tất
                                                                            </>
                                                                        )}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="text-center py-10 bg-zinc-100/30 dark:bg-zinc-900/30 rounded-[2rem] border-2 border-dashed border-zinc-200/50 dark:border-zinc-800/50 flex flex-col items-center">
                                            <Clock className="h-6 w-6 text-zinc-200 mb-3 opacity-50" />
                                            <p className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em] italic max-w-[160px] leading-relaxed">
                                                Nhiệm vụ chưa có báo cáo nào mới
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Fast Submission for Staff */}
                            {selectedTask && isUserTargeted(selectedTask, user?.uid || "", userRoles) && selectedTask.status !== "completed" && (
                                <div className="space-y-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                    <div className="flex items-center gap-2 px-2">
                                        <div className="bg-primary shadow-sm shadow-primary/20 p-1.5 rounded-xl">
                                            <Send className="h-3.5 w-3.5 text-white" />
                                        </div>
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Báo cáo của bạn</h4>
                                    </div>

                                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-5 space-y-4 shadow-sm ring-1 ring-primary/5">
                                        <Textarea
                                            placeholder="Ghi chú kết quả hoặc khó khăn thực hiện..."
                                            value={pendingReportNotes[selectedTask.id] || ""}
                                            onChange={(e) => setPendingReportNotes((prev) => ({ ...prev, [selectedTask.id]: e.target.value }))}
                                            className="bg-zinc-50 dark:bg-zinc-950 border-none min-h-[100px] text-[13px] rounded-2xl p-4 focus-visible:ring-1 focus-visible:ring-primary/20 font-medium"
                                        />

                                        <div className="flex items-center justify-between gap-3">
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                className="rounded-2xl h-11 px-4 text-[10px] font-black uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800 border-none hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all shrink-0"
                                                onClick={() => setActiveTaskForProof(selectedTask.id)}
                                            >
                                                <Camera className="h-4 w-4 mr-2" />
                                                {(pendingReportMedia[selectedTask.id] || []).length > 0
                                                    ? `${(pendingReportMedia[selectedTask.id] || []).length} Tệp`
                                                    : "Đính kèm"}
                                            </Button>

                                            <Button
                                                type="button"
                                                size="sm"
                                                className="rounded-2xl h-11 px-6 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 flex-1 max-w-[150px]"
                                                disabled={pendingActionId === selectedTask.id || (!pendingReportNotes[selectedTask.id]?.trim() && (pendingReportMedia[selectedTask.id] || []).length === 0)}
                                                onClick={() => handleSubmitReport(selectedTask)}
                                            >
                                                {pendingActionId === selectedTask.id ? (
                                                    <TimerReset className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    "Gửi báo cáo"
                                                )}
                                            </Button>
                                        </div>

                                        {(pendingReportMedia[selectedTask.id] || []).length > 0 && (
                                            <div className="rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50/50 dark:bg-zinc-950/50">
                                                <MediaPreview
                                                    media={(pendingReportMedia[selectedTask.id] || []).map((item) => ({
                                                        url: item.url || item.id || "/placeholder.svg",
                                                        type: item.type,
                                                    }))}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </DialogBody>

                        <DialogFooter className="p-6 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 mt-auto rounded-b-[2.5rem]">
                            <DialogAction
                                variant="secondary"
                                className="w-full h-14 rounded-2xl font-black text-zinc-400 hover:text-primary transition-all uppercase tracking-[0.2em] text-[10px] border-zinc-200 dark:border-zinc-800"
                                onClick={handleBack}
                            >
                                Quay lại
                            </DialogAction>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>

            <CameraDialog
                isOpen={!!activeTaskForProof}
                onClose={() => setActiveTaskForProof(null)}
                onSubmit={(items: MediaItem[]) => {
                    if (activeTaskForProof) handleAddProofMedia(activeTaskForProof, items);
                }}
                captureMode="both"
                parentDialogTag="daily-list-dialog"
            />

            <CameraDialog
                isOpen={isInstructionCameraOpen}
                onClose={() => setInstructionCameraOpen(false)}
                onSubmit={(items: MediaItem[]) => {
                    setNewTask((prev) => ({ ...prev, media: [...prev.media, ...items] }));
                    setInstructionCameraOpen(false);
                }}
                captureMode="both"
                parentDialogTag="daily-list-dialog"
            />

            {canManageDaily && (
                <CreateTaskDialog
                    isOpen={isCreateDialogOpen}
                    onOpenChange={(open) => {
                        setIsCreateDialogOpen(open);
                        if (!open) {
                            setNewTask({
                                title: "",
                                description: "",
                                assignedDate: formatDateInput(new Date()),
                                targetMode: "roles",
                                targetRoles: ["Phục vụ"],
                                targetUserIds: [],
                                media: [],
                            });
                        }
                    }}
                    newTask={newTask}
                    setNewTask={setNewTask}
                    onCreate={handleCreateTask}
                    isCreating={isCreating}
                    setInstructionCameraOpen={setInstructionCameraOpen}
                    allUsers={allUsers}
                    roles={ROLES}
                    parentDialogTag="daily-list-dialog"
                />
            )}
        </Dialog>
    );
}
