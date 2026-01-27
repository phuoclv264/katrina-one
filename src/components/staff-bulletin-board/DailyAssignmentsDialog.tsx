"use client";

import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    Info
} from "lucide-react";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { DailyTask, DailyTaskReport } from "@/lib/types";

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

export type DailyAssignmentsDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tasks: DailyTask[];
    reportsByTask: Map<string, DailyTaskReport[]>;
    onNavigate: () => void;
};

export default function DailyAssignmentsDialog({ open, onOpenChange, tasks, reportsByTask, onNavigate }: DailyAssignmentsDialogProps) {
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    const selectedTask = tasks.find(t => t.id === selectedTaskId);
    const selectedReports = selectedTaskId ? (reportsByTask.get(selectedTaskId) || []) : [];

    const handleBack = () => {
        setSelectedTaskId(null);
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            onOpenChange(val);
            if (!val) setSelectedTaskId(null);
        }} dialogTag="daily-list-dialog" parentDialogTag="root">
            <DialogContent className="max-w-lg p-0 overflow-hidden flex flex-col max-h-[90vh] bg-zinc-50 dark:bg-zinc-950">
                <DialogTitle className="sr-only">
                    {selectedTask ? selectedTask.title : "Giao việc hôm nay"}
                </DialogTitle>
                <DialogDescription className="sr-only">
                    Chi tiết các nhiệm vụ được giao trong ngày
                </DialogDescription>
                {!selectedTask ? (
                    <div className="flex flex-col h-full overflow-hidden">
                        <DialogHeader variant="premium" icon={<ListChecks className="h-6 w-6 text-blue-600 dark:bg-blue-900/30" />}>
                            <div>
                                <DialogTitle className="text-xl sm:text-2xl">Giao việc hôm nay</DialogTitle>
                                <DialogDescription className="font-medium opacity-80">
                                    {tasks.length} nhiệm vụ cần theo dõi
                                </DialogDescription>
                            </div>
                        </DialogHeader>

                        <DialogBody className="space-y-4 pt-6 pb-10">
                            {tasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <div className="h-20 w-20 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-4">
                                        <Clipboard className="h-10 w-10 text-zinc-300 dark:text-zinc-700" />
                                    </div>
                                    <p className="text-sm font-black text-zinc-400 uppercase tracking-widest">Không có nhiệm vụ</p>
                                    <p className="text-xs text-zinc-400 mt-1 italic">Tất cả đã hoàn tất hoặc chưa được giao</p>
                                </div>
                            ) : (
                                tasks.map((task) => {
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
                                                "w-full text-left rounded-[2rem] p-5 transition-all relative border overflow-hidden group",
                                                isCompleted 
                                                    ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 opacity-80" 
                                                    : "bg-white dark:bg-zinc-900 border-blue-100 dark:border-blue-900/30 shadow-sm hover:shadow-md"
                                            )}
                                        >
                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        {isCompleted ? (
                                                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                                        ) : isPending ? (
                                                            <Clock className="h-5 w-5 text-amber-500" />
                                                        ) : (
                                                            <AlertCircle className="h-5 w-5 text-blue-500" />
                                                        )}
                                                        <span className={cn(
                                                            "text-[11px] font-black uppercase tracking-widest",
                                                            isCompleted ? "text-emerald-600" : isPending ? "text-amber-600" : "text-blue-600"
                                                        )}>
                                                            {isCompleted ? "Đã hoàn tất" : isPending ? "Đang chờ duyệt" : "Cần thực hiện"}
                                                        </span>
                                                        {!isCompleted && !isPending && (
                                                            <Badge className="h-4 px-1.5 text-[8px] font-black bg-blue-500 text-white border-none uppercase tracking-tighter rounded-md animate-pulse">Cần làm</Badge>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-zinc-400 flex items-center gap-1 uppercase tracking-tight">
                                                        <TimerReset className="h-3 w-3" />
                                                        {task.assignedDate}
                                                    </span>
                                                </div>

                                                <div className="space-y-1">
                                                    <h4 className="text-base font-black leading-tight text-zinc-900 dark:text-zinc-100">
                                                        {task.title}
                                                    </h4>
                                                    <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                                                        {task.description}
                                                    </p>
                                                </div>

                                                {reports.length > 0 && (
                                                    <div className="flex items-center gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800/50 mt-1">
                                                        <div className="flex -space-x-2">
                                                            {reports.slice(0, 3).map((r, i) => (
                                                                <div key={i} className="h-6 w-6 rounded-full bg-zinc-100 dark:bg-zinc-800 border-2 border-white dark:border-zinc-900 flex items-center justify-center">
                                                                    <User className="h-3 w-3 text-zinc-400" />
                                                                </div>
                                                            ))}
                                                            {reports.length > 3 && (
                                                                <div className="h-6 w-6 rounded-full bg-zinc-200 dark:bg-zinc-800 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[8px] font-black">
                                                                    +{reports.length - 3}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                                            {reports.length} báo cáo
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300">
                                                <ChevronRight className="h-6 w-6 text-blue-500" />
                                            </div>
                                        </motion.button>
                                    );
                                })
                            )}
                        </DialogBody>

                        <DialogFooter className="p-6 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
                            <Button
                                variant="ghost"
                                className="w-full h-12 rounded-2xl font-black text-zinc-400 hover:text-blue-600 transition-colors uppercase tracking-[0.2em] text-[11px]"
                                onClick={() => onOpenChange(false)}
                            >
                                Đóng cửa sổ
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <div className="flex flex-col h-full overflow-hidden">
                        <div className="p-4 sm:p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleBack}
                                className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 shrink-0 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all"
                            >
                                <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
                            </Button>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-lg font-black">{selectedTask.title}</h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Chi tiết & Báo cáo</span>
                                </div>
                            </div>
                        </div>

                        <DialogBody className="space-y-8 pt-6 pb-20">
                            <section className="space-y-3">
                                <div className="flex items-center gap-2 px-1">
                                    <Info className="h-4 w-4 text-blue-500" />
                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Yêu cầu công việc</h4>
                                </div>
                                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] p-5 shadow-sm">
                                    <p className="text-sm font-medium leading-relaxed text-zinc-700 dark:text-zinc-300">
                                        {selectedTask.description}
                                    </p>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-2">
                                        <div className="h-4 w-1 bg-amber-500 rounded-full" />
                                        <h4 className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Hoạt động báo cáo</h4>
                                    </div>
                                    <Badge variant="outline" className="text-[9px] h-5 rounded-full px-2 border-zinc-200 font-bold">
                                        {selectedReports.length} báo cáo
                                    </Badge>
                                </div>

                                {selectedReports.length > 0 ? (
                                    <div className="space-y-4">
                                        {selectedReports.map((report, idx) => (
                                            <div key={idx} className="relative flex gap-3 group">
                                                {idx !== selectedReports.length - 1 && (
                                                    <div className="absolute left-4 top-8 bottom-0 w-[2px] bg-zinc-100 dark:bg-zinc-800" />
                                                )}
                                                <div className="h-8 w-8 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shrink-0 z-10 shadow-sm">
                                                    <User className="h-4 w-4 text-zinc-400" />
                                                </div>
                                                <div className="flex-1 space-y-2 pb-6">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex flex-col">
                                                            <span className="text-[13px] font-black text-zinc-900 dark:text-zinc-100">
                                                                {report.reporter?.userName || "Nhân viên"}
                                                            </span>
                                                            <span className="text-[10px] text-zinc-400 font-medium">
                                                                {formatReportTime(report.createdAt)}
                                                            </span>
                                                        </div>
                                                        {report.status && (
                                                            <Badge variant="outline" className={cn(
                                                                "text-[9px] h-5 font-black uppercase tracking-tighter",
                                                                report.status === "manager_approved" ? "border-emerald-500 text-emerald-600 bg-emerald-50/50" : "border-blue-500 text-blue-600 bg-blue-50/50"
                                                            )}>
                                                                {report.status === "manager_approved" ? "Đã duyệt" : "Đã gửi"}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {report.content && (
                                                        <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-3 rounded-2xl rounded-tl-none shadow-sm text-sm text-zinc-600 dark:text-zinc-400 italic">
                                                            "{report.content}"
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 bg-zinc-100/50 dark:bg-zinc-900/50 rounded-[2rem] border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                                        <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                                            <Clock className="h-5 w-5 text-zinc-300" />
                                        </div>
                                        <p className="text-xs text-zinc-400 font-black uppercase tracking-widest italic leading-relaxed">
                                            Chưa có báo cáo nào<br/>cho nhiệm vụ này
                                        </p>
                                    </div>
                                )}
                            </section>
                        </DialogBody>

                        <DialogFooter className="p-6 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 mt-auto">
                            <DialogAction
                                variant="pastel-blue"
                                className="w-full h-14 rounded-[1.5rem] shadow-md shadow-blue-500/10"
                                onClick={onNavigate}
                            >
                                Thực hiện báo cáo
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </DialogAction>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
