"use client"

import { useState, useMemo } from "react"
import {
    User,
    Clock,
    CheckCircle,
    Video,
    AlertCircle,
    Camera,
    Plus,
    Info,
    ChevronLeft
} from "lucide-react"
import { format } from "date-fns"
import ReactMarkdown from 'react-markdown';
import Image from '@/components/ui/image';
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogBody, DialogFooter, DialogCancel, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "@/components/ui/pro-toast"
import { useAuth } from "@/hooks/use-auth"
import { useLightbox } from "@/contexts/lightbox-context"
import CameraDialog from "@/components/camera-dialog"
import type { MonthlyTaskAssignment, MediaAttachment, MediaItem, SimpleUser } from "@/lib/types"

type TaskReportingViewProps = {
    assignment: MonthlyTaskAssignment
    onBack: () => void
    onClose?: () => void
    onSubmitMedia: (assignment: MonthlyTaskAssignment, media: MediaItem[], note?: string) => Promise<void>
    onSubmitNote: (assignment: MonthlyTaskAssignment, note: string, markCompleted: boolean) => Promise<void>
}

export function TaskReportingView({
    assignment,
    onBack,
    onClose,
    onSubmitMedia,
    onSubmitNote,
}: TaskReportingViewProps) {
    const { user } = useAuth()
    const { openLightbox } = useLightbox()
    const [isCameraOpen, setIsCameraOpen] = useState(false)
    const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false)
    const [noteContent, setNoteContent] = useState("")
    const [isNoteSubmitting, setIsNoteSubmitting] = useState(false)

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
        const completionsByShiftAndUser = new Set();
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
    }, [ assignment.responsibleUsersByShift, allCompletions, assignment.appliesToRole])

    const stats = useMemo(() => {
        const totalAssigned = (() => {
            const ids = new Set<string>()
            assignment.responsibleUsersByShift.forEach(({ users }) =>
                users.forEach(u => { ids.add(u.userId) })
            )
            return ids.size
        })()
        const done = allCompletions.filter(c => !!c.completedAt).length
        const remaining = notDoneUsers.length
        return { totalAssigned, done, remaining }
    }, [assignment, allCompletions, notDoneUsers])

    const handleMediaSubmit = async (media: MediaItem[], note?: string) => {
        if (media.length === 0 || !user) return
        try {
            await onSubmitMedia(assignment, media, note)
            toast.success(`Đã báo cáo hoàn thành: "${assignment.taskName}"`)
        } catch (error) {
            console.error("Failed to report task completion:", error)
            toast.error("Không thể báo cáo hoàn thành.")
        } finally {
            setIsCameraOpen(false)
        }
    }

    const handleNoteSubmit = async () => {
        if (isNoteSubmitting) return
        if (!noteContent.trim() || !user) {
            toast.error("Vui lòng nhập nội dung báo cáo.")
            return
        }
        try {
            setIsNoteSubmitting(true)
            await onSubmitNote(assignment, noteContent, !!currentUserCompletion?.completedAt)
            toast.success("Đã gửi báo cáo.")
            setIsNoteDialogOpen(false)
            setNoteContent("")
        } catch (error) {
            console.error("Failed to send note:", error)
            toast.error("Không thể gửi báo cáo.")
        } finally {
            setIsNoteSubmitting(false)
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
        <div className="flex flex-col h-full overflow-hidden">
            <div className="px-3 pr-16 py-4 border-b flex items-center gap-3 bg-muted/5">
                <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full h-8 w-8 -ml-2">
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="min-w-0 flex-1">
                    <DialogTitle className="font-black text-base leading-none">
                        <ReactMarkdown components={{ p: 'span' }}>{assignment.taskName}</ReactMarkdown>
                    </DialogTitle>
                    <DialogDescription className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1 font-bold">
                        {assignment.appliesToRole ? `Vai trò: ${assignment.appliesToRole}` : "Chi tiết công việc"}
                    </DialogDescription>
                </div>
                {assignment.description && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors shrink-0">
                                <Info className="h-4 w-4" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 rounded-2xl p-4 shadow-xl border-border bg-popover/95 backdrop-blur-sm z-[110]">
                            <div className="text-sm font-medium leading-relaxed prose prose-slate prose-sm max-w-none prose-p:my-0 prose-headings:mb-2 prose-headings:mt-4 first:prose-headings:mt-0">
                                <ReactMarkdown>{assignment.description}</ReactMarkdown>
                            </div>
                        </PopoverContent>
                    </Popover>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-10">
                {/* --- ACTION SECTION --- */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="h-6 w-1 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                        <h4 className="text-sm font-black uppercase tracking-widest text-foreground/70">Báo cáo của bạn</h4>
                    </div>

                    <div className="bg-background p-6 rounded-[2rem] border shadow-sm space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {!currentUserCompletion ? (
                                <Button
                                    variant="secondary"
                                    size="lg"
                                    className="w-full h-14 rounded-xl font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-none"
                                    onClick={() => setIsCameraOpen(true)}
                                >
                                    <Camera className="h-6 w-6 mr-2" />
                                    CHỤP BÁO CÁO
                                </Button>
                            ) : (
                                <Button
                                    variant="secondary"
                                    size="lg"
                                    className="w-full h-14 rounded-xl font-bold"
                                    onClick={() => setIsCameraOpen(true)}
                                >
                                    <Plus className="h-6 w-6 mr-2" />
                                    BỔ SUNG ẢNH
                                </Button>
                            )}

                            <Button
                                variant="outline"
                                size="lg"
                                className="w-full h-14 rounded-xl font-bold border-2"
                                onClick={() => {
                                    setNoteContent(currentUserCompletion?.note || "")
                                    setIsNoteDialogOpen(true)
                                }}
                            >
                                <AlertCircle className="h-6 w-6 mr-2" />
                                {currentUserCompletion?.note ? "SỬA GHI CHÚ" : "GỬI GHI CHÚ"}
                            </Button>
                        </div>

                        {currentUserCompletion?.media && currentUserCompletion.media.length > 0 && (
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Bằng chứng đã tải lên</p>
                                <div className="flex flex-wrap gap-3 pb-1">
                                    {currentUserCompletion.media.map((att, mIdx) => (
                                        <button
                                            key={mIdx}
                                            onClick={() => handleOpenLightbox(currentUserCompletion.media!, mIdx)}
                                            className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-muted group hover:border-primary transition-all shadow-sm"
                                        >
                                            {att.type === "photo" ? (
                                                <Image src={att.url || "/placeholder.svg"} alt="Evidence" fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                                            ) : (
                                                <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
                                                    <Video className="h-6 w-6 text-white" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {currentUserCompletion?.note && (
                            <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl p-4 border border-amber-100/50 dark:border-amber-900/30">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="h-4 w-4 text-amber-600 mt-1 shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest mb-1">Ghi chú của bạn</p>
                                        <p className="text-sm text-amber-900 dark:text-amber-200 font-medium italic leading-relaxed">"{currentUserCompletion.note}"</p>
                                        {currentUserCompletion.noteCreatedAt && (
                                            <p className="text-[9px] text-amber-600/60 dark:text-amber-500/60 font-black mt-2 uppercase tracking-tighter">
                                                {format(currentUserCompletion.noteCreatedAt.toDate(), "HH:mm, dd/MM/yyyy")}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- STATS SECTION --- */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-[2rem] p-4 text-center border border-emerald-100/50 shadow-sm transition-all hover:scale-[1.02]">
                        <p className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest mb-1">Đã xong</p>
                        <p className="text-2xl font-black text-emerald-700">{stats.done}</p>
                    </div>
                    <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-[2rem] p-4 text-center border border-amber-100/50 shadow-sm transition-all hover:scale-[1.02]">
                        <p className="text-[10px] font-black text-amber-600/60 uppercase tracking-widest mb-1">Đang chờ</p>
                        <p className="text-2xl font-black text-amber-700">{stats.remaining}</p>
                    </div>
                    <div className="bg-primary/5 rounded-[2rem] p-4 text-center border border-primary/10 shadow-sm transition-all hover:scale-[1.02]">
                        <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest mb-1">Chỉ tiêu</p>
                        <p className="text-2xl font-black text-primary">{stats.totalAssigned}</p>
                    </div>
                </div>

                {/* --- HISTORY SECTION --- */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-1 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                            <h4 className="text-sm font-black uppercase tracking-widest text-foreground/70">Lịch sử hoàn thành</h4>
                        </div>
                        <Badge variant="outline" className="font-black rounded-lg bg-background">
                            {allCompletions.length} báo cáo
                        </Badge>
                    </div>

                    <div className="bg-background rounded-[2rem] border shadow-sm overflow-hidden divide-y divide-muted/10">
                        {allCompletions.length > 0 ? (
                            <div className="divide-y divide-muted/10">
                                {allCompletions.map((completion, idx) => (
                                    <div key={idx} className="p-5 hover:bg-muted/5 transition-colors group">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center overflow-hidden shrink-0 border border-border/50 group-hover:scale-105 transition-transform">
                                                    <User className="h-6 w-6 text-muted-foreground/40" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-black text-base text-foreground break-words">
                                                            {completion.completedBy?.userName || "Ẩn danh"}
                                                        </span>
                                                        {completion.completedBy?.userId === user?.uid && (
                                                            <Badge className="bg-primary/10 text-primary border-none text-[9px] h-4 px-1.5 font-black shrink-0">BẠN</Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {assignment.responsibleUsersByShift.find(s => s.users.some(u => u.userId === completion.completedBy?.userId))?.shiftLabel && (
                                                            <Badge variant="outline" className="text-[9px] h-4 font-black border-primary/20 bg-primary/5 text-primary px-2 py-0 uppercase shrink-0">
                                                                CA {assignment.responsibleUsersByShift.find(s => s.users.some(u => u.userId === completion.completedBy?.userId))?.shiftLabel}
                                                            </Badge>
                                                        )}
                                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                                                            <Clock className="w-3 h-3" />
                                                            {completion.completedAt
                                                                ? format(completion.completedAt.toDate(), "HH:mm, dd/MM")
                                                                : completion.noteCreatedAt
                                                                    ? format(completion.noteCreatedAt.toDate(), "HH:mm, dd/MM")
                                                                    : "Chưa rõ thời gian"}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {completion.media && completion.media.length > 0 && (
                                            <div className="flex flex-wrap gap-2.5 mb-4 px-1">
                                                {completion.media.map((att, mIdx) => (
                                                    <button key={mIdx} onClick={() => handleOpenLightbox(completion.media!, mIdx)} className="relative w-14 h-14 rounded-2xl overflow-hidden border-2 border-muted shadow-sm group/thumb">
                                                        {att.type === "photo" ? <Image src={att.url || "/placeholder.svg"} fill className="object-cover group-hover/thumb:scale-110 transition-transform" alt="" /> : <div className="bg-slate-900 w-full h-full flex items-center justify-center"><Video className="w-5 h-5 text-white" /></div>}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {completion.note && (
                                            <div className="bg-muted/20 rounded-2xl p-4 border border-border/50">
                                                <p className="text-sm text-foreground font-medium leading-relaxed italic">"{completion.note}"</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-16 flex flex-col items-center text-center gap-4">
                                <div className="w-20 h-20 rounded-full bg-muted/20 flex items-center justify-center">
                                    <Clock className="w-10 h-10 text-muted-foreground/20" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-base font-black text-muted-foreground/60">Chưa có báo cáo</p>
                                    <p className="text-xs font-bold text-muted-foreground/40 uppercase tracking-widest">Hãy là người đầu tiên hoàn thành!</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- REMAINING USERS SECTION --- */}
                <div className="space-y-4 pb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="h-6 w-1 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(var(--amber-500),0.5)]" />
                        <h4 className="text-sm font-black uppercase tracking-widest text-foreground/70">Chưa hoàn thành</h4>
                    </div>

                    {notDoneUsers.length > 0 ? (
                        <div className="bg-background rounded-[2rem] border shadow-sm p-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {notDoneUsers.map((u, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-muted/10 border border-border/50 rounded-2xl p-4 flex items-center gap-4 hover:bg-muted/20 transition-all hover:scale-[1.02]"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center shrink-0 shadow-sm">
                                            <User className="h-5 w-5 text-muted-foreground/30" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-black text-sm text-foreground break-words leading-tight">{u.userName}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge className="text-[9px] font-black bg-amber-500/10 text-amber-600 border-none h-4 px-1.5 uppercase tracking-tighter shrink-0">
                                                    CA {u.shiftLabel}
                                                </Badge>
                                                <span className="text-[10px] text-muted-foreground/60 font-black uppercase whitespace-nowrap">Đang chờ...</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-emerald-500/5 rounded-[2rem] p-8 border-2 border-dashed border-emerald-500/20 flex flex-col items-center gap-4 text-center">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                                <CheckCircle className="w-10 h-10 text-emerald-500" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-lg font-black text-emerald-700">Mục tiêu hoàn thành!</p>
                                <p className="text-xs font-bold text-emerald-600/60 uppercase tracking-widest">Tất cả nhân sự đã gửi báo cáo công việc.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <DialogFooter className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 gap-3">
                <Button
                    variant="ghost"
                    className="flex-1 rounded-[20px] font-black text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors uppercase tracking-widest text-[11px]"
                    onClick={onBack}
                >
                    Quay lại
                </Button>
                {onClose && (
                    <Button
                        variant="ghost"
                        className="flex-1 rounded-[20px] font-black text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors uppercase tracking-widest text-[11px]"
                        onClick={onClose}
                    >
                        Đóng cửa sổ
                    </Button>
                )}
            </DialogFooter>

            {/* --- SUB-DIALOGS --- */}
            <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen} dialogTag="task-note-dialog" parentDialogTag="monthly-list-dialog">
                <DialogContent className="max-w-[440px] p-0 overflow-hidden border-none shadow-2xl bg-card">
                    <DialogHeader iconkey="edit" variant="warning">
                        <DialogTitle>Ghi chú công việc</DialogTitle>
                        <DialogDescription>
                            Gửi phản hồi, báo cáo sự cố hoặc lý do chậm trễ.
                        </DialogDescription>
                    </DialogHeader>

                    <DialogBody className="bg-muted/[0.02] p-6">
                        <div className="bg-background p-6 rounded-[2rem] border shadow-sm space-y-3">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1 mb-1">Chi tiết báo cáo</p>
                            <Textarea
                                value={noteContent}
                                onChange={(e) => setNoteContent(e.target.value)}
                                placeholder="Nhập nội dung ghi chú tại đây..."
                                rows={5}
                                className="text-base rounded-2xl border-muted-foreground/20 bg-muted/5 focus:border-primary/50 transition-all resize-none font-medium p-4 leading-relaxed"
                            />
                        </div>
                    </DialogBody>

                    <DialogFooter className="bg-muted/10 border-t p-6">
                        <DialogCancel className="rounded-xl font-bold flex-1 sm:flex-none">HỦY</DialogCancel>
                        <Button
                            disabled={isNoteSubmitting}
                            onClick={handleNoteSubmit}
                            className="rounded-xl font-black flex-1 sm:flex-none min-w-[160px] bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {isNoteSubmitting ? "ĐANG GỬI..." : "GỬI BÁO CÁO"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <CameraDialog
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onSubmit={handleMediaSubmit}
                captureMode="both"
                parentDialogTag="monthly-list-dialog"
                contextText={assignment.taskName}
                allowCaption={true}
            />
        </div>
    )
}
