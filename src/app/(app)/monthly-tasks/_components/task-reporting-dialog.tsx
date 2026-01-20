"use client"

import { useState, useMemo } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
    User,
    Clock,
    CheckCircle,
    Video,
    AlertCircle,
    XCircle,
    Camera,
    Plus,
    Loader2,
    Info
} from "lucide-react"
import { format } from "date-fns"
import Image from "next/image"
import type { MonthlyTaskAssignment, TaskCompletionRecord, MediaAttachment, MediaItem } from "@/lib/types"
import { useLightbox } from "@/contexts/lightbox-context"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "react-hot-toast"
import CameraDialog from "@/components/camera-dialog"
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover"

type TaskReportingDialogProps = {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    assignment: MonthlyTaskAssignment
    onSubmitMedia: (assignment: MonthlyTaskAssignment, media: MediaItem[], note?: string) => Promise<void>
    onSubmitNote: (assignment: MonthlyTaskAssignment, note: string, markCompleted: boolean) => Promise<void>
}

export function TaskReportingDialog({
    isOpen,
    onOpenChange,
    assignment,
    onSubmitMedia,
    onSubmitNote,
}: TaskReportingDialogProps) {
    const { user } = useAuth()
    const { openLightbox } = useLightbox()
    const [isCameraOpen, setIsCameraOpen] = useState(false)
    const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false)
    const [noteContent, setNoteContent] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const allCompletions = useMemo(
        () => [...assignment.completions, ...assignment.otherCompletions]
            .filter(c => !!c.completedAt || !!c.note)
            .sort((a, b) => {
                const timeA = (a.completedAt?.toDate().getTime() || a.noteCreatedAt?.toDate().getTime() || 0)
                const timeB = (b.completedAt?.toDate().getTime() || b.noteCreatedAt?.toDate().getTime() || 0)
                return timeB - timeA
            }),
        [assignment.completions, assignment.otherCompletions]
    );

    const currentUserCompletion = useMemo(
        () => allCompletions.find((c) => c.completedBy?.userId === user?.uid),
        [allCompletions, user?.uid]
    )

    const notDoneUsers = useMemo(() => {
        const users: Array<{ userId: string, userName: string, shiftLabel: string, shiftId: string }> = []

        // Group completions by shift-user key for lookup
        const completionsByShiftAndUser = new Set();
        // This is a simplification, but good enough for status list
        allCompletions.forEach(c => {
            if (c.completedBy) completionsByShiftAndUser.add(c.completedBy.userId);
        });

        assignment.responsibleUsersByShift.forEach(({ shiftId, shiftLabel, users: shiftUsers }) => {
            shiftUsers.forEach(u => {
                const matchesRole = !assignment.appliesToRole || assignment.appliesToRole === "Tất cả" || u.assignedRole === assignment.appliesToRole

                if (!completionsByShiftAndUser.has(u.userId) && matchesRole) {
                    users.push({ ...u, shiftLabel, shiftId })
                }
            })
        })
        return users
    }, [assignment.responsibleUsersByShift, allCompletions])

    const stats = useMemo(() => {
        const totalAssigned = assignment.responsibleUsersByShift.reduce((acc, s) => acc + s.users.length, 0)
        const done = allCompletions.filter(c => !!c.completedAt).length
        const remaining = notDoneUsers.length
        return { totalAssigned, done, remaining }
    }, [assignment, allCompletions, notDoneUsers])

    const handleMediaSubmit = async (media: MediaItem[], note?: string) => {
        if (media.length === 0 || !user) return
        setIsSubmitting(true)
        try {
            await onSubmitMedia(assignment, media, note)
            toast.success(`Đã báo cáo hoàn thành: "${assignment.taskName}"`)
            setIsCameraOpen(false)
        } catch (error) {
            console.error("Failed to report task completion:", error)
            toast.error("Không thể báo cáo hoàn thành.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleNoteSubmit = async () => {
        if (!noteContent.trim() || !user) {
            toast.error("Vui lòng nhập nội dung báo cáo.")
            return
        }
        setIsSubmitting(true)
        try {
            await onSubmitNote(assignment, noteContent, !!currentUserCompletion?.completedAt)
            toast.success("Đã gửi báo cáo.")
            setIsNoteDialogOpen(false)
            setNoteContent("")
        } catch (error) {
            console.error("Failed to send note:", error)
            toast.error("Không thể gửi báo cáo.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleOpenLightbox = (media: MediaAttachment[], index: number) => {
        const slides = media.map((att) => {
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
        openLightbox(slides, index)
    }

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange} dialogTag="task-reporting-dialog" parentDialogTag="root">
                <DialogContent className="max-w-[500px] w-[95%] rounded-[32px] p-0 overflow-hidden border-none shadow-2xl bg-slate-50 dark:bg-slate-950">
                    <DialogHeader className="px-6 pt-6 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="w-13 h-13 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner ring-1 ring-indigo-100/50 dark:ring-indigo-900/50 shrink-0">
                                <CheckCircle className="w-6 h-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <DialogTitle className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100 leading-tight">
                                        {assignment.taskName}
                                    </DialogTitle>
                                    {assignment.description && (
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-800 shadow-sm ring-1 ring-indigo-100 dark:ring-indigo-800/50 transition-all active:scale-90"
                                                >
                                                    <Info className="h-3.5 w-3.5 fill-indigo-600/10" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-72 rounded-2xl p-4 shadow-xl border-slate-100 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-[100]">
                                                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    {assignment.description}
                                                </p>
                                            </PopoverContent>
                                        </Popover>
                                    )}
                                </div>
                            </div>
                        </div>
                    </DialogHeader>

                    <ScrollArea className="max-h-[70vh]">
                        <div className="p-5 space-y-6">
                            {/* --- ACTION SECTION (Your Report) --- */}
                            <section className="relative">
                                <div className="bg-white dark:bg-slate-900 rounded-[28px] p-5 border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-primary/40" />
                                    <h5 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <User className="w-3.5 h-3.5 text-primary" />
                                        BÁO CÁO CỦA BẠN
                                    </h5>

                                    <div className="flex flex-col gap-4">
                                        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
                                            {!currentUserCompletion ? (
                                                <Button
                                                    size="lg"
                                                    onClick={() => setIsCameraOpen(true)}
                                                    disabled={isSubmitting}
                                                    className="h-14 w-full sm:w-auto px-4 sm:px-8 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl shadow-xl shadow-emerald-200/50 dark:shadow-none font-bold text-base tracking-wide transition-all active:scale-[0.98] border-none group"
                                                >
                                                    {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                                                        <div className="flex items-center gap-2.5">
                                                            <Camera className="h-6 w-6 group-hover:rotate-12 transition-transform" />
                                                            <span>CHỤP BÁO CÁO</span>
                                                        </div>
                                                    )}
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="lg"
                                                    variant="secondary"
                                                    onClick={() => setIsCameraOpen(true)}
                                                    disabled={isSubmitting}
                                                    className="h-14 w-full sm:w-auto px-4 sm:px-6 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 font-bold text-sm transition-all active:scale-[0.98]"
                                                >
                                                    {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="mr-2 h-5 w-5 text-primary" />}
                                                    BỔ SUNG ẢNH
                                                </Button>
                                            )}

                                            <Button
                                                size="lg"
                                                variant="outline"
                                                onClick={() => {
                                                    setNoteContent(currentUserCompletion?.note || "")
                                                    setIsNoteDialogOpen(true)
                                                }}
                                                disabled={isSubmitting}
                                                className={`h-14 w-full sm:w-auto sm:px-5 rounded-2xl transition-all active:scale-[0.98] border-2 ${currentUserCompletion?.note
                                                        ? "border-amber-500/30 bg-amber-50/50 text-amber-700"
                                                        : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 hover:bg-slate-50"
                                                    }`}
                                            >
                                                <AlertCircle className={`h-5 w-5 mr-2 ${currentUserCompletion?.note ? "text-amber-500" : "text-slate-400"}`} />
                                                <span className="font-bold text-sm">{currentUserCompletion?.note ? "SỬA GHI CHÚ" : "GỬI GHI CHÚ"}</span>
                                            </Button>
                                        </div>

                                        {/* Evidence Section */}
                                        {currentUserCompletion?.media && currentUserCompletion.media.length > 0 && (
                                            <div className="space-y-3">
                                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Bằng chứng đã tải lên</p>
                                                <div className="flex flex-wrap gap-3 items-center max-h-[140px] overflow-y-auto pb-1 scrollbar-none">
                                                    {currentUserCompletion.media.map((att, mIdx) => (
                                                        <button
                                                            key={mIdx}
                                                            onClick={() => handleOpenLightbox(currentUserCompletion.media!, mIdx)}
                                                            className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden ring-2 ring-slate-100 dark:ring-slate-800 group hover:ring-primary/30 transition-all shadow-sm"
                                                        >
                                                            {att.type === "photo" ? (
                                                                <Image src={att.url || "/placeholder.svg"} alt="Evidence" fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                                                            ) : (
                                                                <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
                                                                    <Video className="h-6 w-6 text-white" />
                                                                </div>
                                                            )}
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {currentUserCompletion?.note && (
                                            <div className="bg-amber-50/40 dark:bg-amber-950/20 rounded-[24px] p-4 border border-amber-100 dark:border-amber-900/30">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
                                                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm text-amber-900 dark:text-amber-200 font-bold mb-1">Ghi chú của bạn:</p>
                                                        <p className="text-sm text-amber-800/80 dark:text-amber-300/80 leading-relaxed font-medium italic">"{currentUserCompletion.note}"</p>
                                                        {currentUserCompletion.noteCreatedAt && (
                                                            <div className="flex items-center gap-1.5 mt-2">
                                                                <Clock className="w-3 h-3 text-amber-600/40" />
                                                                <p className="text-[10px] text-amber-600/60 dark:text-amber-400/60 font-bold uppercase">
                                                                    {format(currentUserCompletion.noteCreatedAt.toDate(), "HH:mm, dd/MM")}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>

                            {/* --- STATS SECTION --- */}
                            <section className="grid grid-cols-3 gap-3">
                                <div className="bg-white dark:bg-slate-900 rounded-[28px] p-4 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center gap-1.5 transition-all hover:scale-[1.02]">
                                    <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 mb-0.5">
                                        <CheckCircle className="w-4 h-4" />
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Đã xong</p>
                                    <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{stats.done}</p>
                                </div>

                                <div className="bg-white dark:bg-slate-900 rounded-[28px] p-4 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center gap-1.5 transition-all hover:scale-[1.02]">
                                    <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 mb-0.5">
                                        <XCircle className="w-4 h-4" />
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Chờ làm</p>
                                    <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{stats.remaining}</p>
                                </div>

                                <div className="bg-white dark:bg-slate-900 rounded-[28px] p-4 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center gap-1.5 transition-all hover:scale-[1.02]">
                                    <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 mb-0.5">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Chỉ tiêu</p>
                                    <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{stats.totalAssigned}</p>
                                </div>
                            </section>

                            {/* --- HISTORY SECTION --- */}
                            <section>
                                <div className="flex items-center justify-between mb-3">
                                    <h5 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                        LỊCH SỬ HOÀN THÀNH
                                    </h5>
                                    <Badge variant="outline" className="rounded-full px-2 py-0.5 bg-slate-50 text-slate-500 border-slate-200 font-bold text-[9px]">
                                        {allCompletions.length} báo cáo
                                    </Badge>
                                </div>

                                {allCompletions.length > 0 ? (
                                    <div className="space-y-3">
                                        {allCompletions.map((completion, idx) => (
                                            <div key={idx} className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 p-4 shadow-sm transition-all hover:shadow-md">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                                            {completion.completedBy?.userId === user?.uid ? (
                                                                <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                                                                    <User className="h-6 w-6 text-primary" />
                                                                </div>
                                                            ) : (
                                                                <User className="h-6 w-6 text-slate-300" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="font-bold text-base text-slate-800 dark:text-slate-100 break-words leading-tight">
                                                                    {completion.completedBy?.userName || "Ẩn danh"}
                                                                </span>
                                                                {completion.completedBy?.userId === user?.uid && (
                                                                    <Badge className="bg-primary/10 text-primary border-none text-[9px] font-black h-4 px-1.5">BẠN</Badge>
                                                                )}
                                                                {assignment.responsibleUsersByShift.find(s => s.users.some(u => u.userId === completion.completedBy?.userId))?.shiftLabel && (
                                                                    <Badge variant="outline" className="text-[10px] h-5 font-black uppercase bg-indigo-50/50 border-indigo-100 text-indigo-500 px-2 py-0">
                                                                        Ca {assignment.responsibleUsersByShift.find(s => s.users.some(u => u.userId === completion.completedBy?.userId))?.shiftLabel}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 mt-1">
                                                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                                <span className="text-xs text-slate-400 font-semibold uppercase tracking-tight">
                                                                    {completion.completedAt
                                                                        ? format(completion.completedAt.toDate(), "HH:mm, dd/MM")
                                                                        : completion.noteCreatedAt
                                                                            ? format(completion.noteCreatedAt.toDate(), "HH:mm, dd/MM")
                                                                            : "Chưa có giờ"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {completion.completedAt && (
                                                        <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
                                                            <CheckCircle className="w-5 h-5" />
                                                        </div>
                                                    )}
                                                </div>

                                                {completion.media && completion.media.length > 0 && (
                                                    <div className="flex flex-wrap gap-2.5 mb-3">
                                                        {completion.media.map((att, mIdx) => (
                                                            <button key={mIdx} onClick={() => handleOpenLightbox(completion.media!, mIdx)} className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden ring-1 ring-slate-100 dark:ring-slate-800 shadow-sm group">
                                                                {att.type === "photo" ? <Image src={att.url || "/placeholder.svg"} fill className="object-cover group-hover:scale-110 transition-transform" alt="" /> : <div className="bg-slate-900 w-full h-full flex items-center justify-center"><Video className="w-4 h-4 text-white" /></div>}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                {completion.note && (
                                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-[20px] p-4 border border-slate-100 dark:border-slate-800">
                                                        <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">"{completion.note}"</p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-white dark:bg-slate-900 rounded-[32px] p-10 border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-col items-center text-center gap-3">
                                        <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                                            <Clock className="w-8 h-8 text-slate-200" />
                                        </div>
                                        <p className="text-base font-bold text-slate-400 italic">Chưa có người nào báo cáo</p>
                                    </div>
                                )}
                            </section>

                            {/* --- REMAINING USERS SECTION (compact & scrollable) --- */}
                            <section className="pb-2">
                                <h5 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <XCircle className="w-3.5 h-3.5 text-slate-300" />
                                    DANH SÁCH CHƯA HOÀN THÀNH
                                </h5>

                                {notDoneUsers.length > 0 ? (
                                    <div className="pr-1 space-y-2">
                                        {notDoneUsers.map((u, idx) => (
                                            <div
                                                key={idx}
                                                className="bg-slate-50/50 dark:bg-slate-900/30 rounded-lg p-2.5 border border-slate-100 dark:border-slate-800 flex items-start gap-3 transition-all hover:bg-white dark:hover:bg-slate-900 hover:shadow-sm"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-sm border border-slate-100 dark:border-slate-700">
                                                    <User className="h-4 w-4 text-slate-300" />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm text-slate-700 dark:text-slate-200 break-words leading-tight whitespace-normal">{u.userName}</p>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <Badge variant="secondary" className="text-[9px] font-black bg-indigo-50 text-indigo-500 border-none h-4 px-1.5">CA {u.shiftLabel}</Badge>
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Đang chờ...</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 rounded-[24px] p-4 border-2 border-dashed border-emerald-100 dark:border-emerald-900/50 flex flex-col items-center gap-2 text-center">
                                        <div className="w-12 h-12 rounded-full bg-white dark:bg-emerald-900/50 flex items-center justify-center shadow-md shadow-emerald-200/40 dark:shadow-none">
                                            <CheckCircle className="w-7 h-7 text-emerald-500" />
                                        </div>
                                        <div>
                                            <p className="text-base font-black text-emerald-700 dark:text-emerald-400">Tuyệt vời!</p>
                                            <p className="text-xs font-bold text-emerald-600/80 dark:text-emerald-500/80">Tất cả nhân sự đã hoàn thành công việc.</p>
                                        </div>
                                    </div>
                                )}
                            </section>
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            {/* --- SUB-DIALOGS --- */}
            <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen} dialogTag="task-note-dialog" parentDialogTag="task-reporting-dialog">
                <DialogContent className="max-w-[440px] w-[95%] rounded-[32px] p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-slate-950">
                    <div className="p-8">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 mb-6">
                            <AlertCircle className="h-6 w-6" />
                        </div>

                        <DialogHeader className="p-0 text-left mb-6">
                            <DialogTitle className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100">
                                Ghi chú công việc
                            </DialogTitle>
                            <DialogDescription className="text-slate-500 font-medium text-sm mt-1">
                                Gửi phản hồi, báo cáo sự cố hoặc lý do chậm trễ. Teammates sẽ nhìn thấy ghi chú này.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            <Textarea
                                value={noteContent}
                                onChange={(e) => setNoteContent(e.target.value)}
                                placeholder="Nhập nội dung ghi chú tại đây..."
                                rows={5}
                                className="text-base rounded-2xl border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all resize-none font-medium p-4 leading-relaxed shadow-inner"
                            />

                            <div className="flex gap-3 pt-2">
                                <DialogClose asChild>
                                    <Button variant="ghost" className="flex-1 rounded-2xl h-14 font-bold text-slate-400 hover:text-slate-500 hover:bg-slate-50 transition-all">
                                        HỦY
                                    </Button>
                                </DialogClose>
                                <Button
                                    size="lg"
                                    onClick={handleNoteSubmit}
                                    disabled={isSubmitting || !noteContent.trim()}
                                    className="flex-[2] rounded-2xl h-14 font-black bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "GỬI BÁO CÁO"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <CameraDialog
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onSubmit={handleMediaSubmit}
                captureMode="both"
                parentDialogTag="task-reporting-dialog"
                contextText={assignment.taskName}
                allowCaption={true}
            />
        </>
    )
}
