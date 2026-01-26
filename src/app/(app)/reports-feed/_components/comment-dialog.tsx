'use client';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogBody, DialogAction, DialogCancel } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Wand2, Loader2, Edit, Trash2, X, Send, Upload, Eye, MessageSquareText, Calendar, Clock, User2 } from 'lucide-react';
import { toast } from '@/components/ui/pro-toast';
import { callRefineText } from '@/lib/ai-service';
import type { WhistleblowingReport, AuthUser, ManagedUser, ReportComment, CommentMedia } from '@/lib/types';
import Image from '@/components/ui/image';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogIcon, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { photoStore } from '@/lib/photo-store';
import { v4 as uuidv4 } from 'uuid';
import { Badge } from '@/components/ui/badge';
import { Video } from 'lucide-react';
import { Slide } from 'yet-another-react-lightbox';


type CommentDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    report: WhistleblowingReport;
    currentUser: AuthUser;
    allUsers: ManagedUser[];
    onCommentSubmit: (reportId: string, commentText: string, medias: CommentMedia[], isAnonymous: boolean) => Promise<void>;
    onCommentEdit: (violationId: string, commentId: string, newText: string) => void;
    onCommentDelete: (violationId: string, commentId: string) => void;
    onOpenLightbox: (slides: Slide[], index?: number) => void;
    parentDialogTag: string;
};


export default function CommentDialog({
    isOpen,
    onClose,
    report,
    currentUser,
    allUsers,
    onCommentSubmit,
    onCommentEdit,
    onCommentDelete,
    onOpenLightbox,
    parentDialogTag,
}: CommentDialogProps) {
    const [commentText, setCommentText] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(true);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [commentPhotoIds, setCommentPhotoIds] = useState<string[]>([]);
    const [commentMedia, setCommentMedia] = useState<{ id: string; url: string; type: 'photo' | 'video' }[]>([]);

    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');

    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-resize textarea when text changes (e.g. from AI refine)
    useEffect(() => {
        if (textareaRef.current && commentText) {
            const el = textareaRef.current;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 140) + "px";
        } else if (textareaRef.current && !commentText) {
            textareaRef.current.style.height = "56px";
        }
    }, [commentText]);

    const handleCommentDialogSubmit = async (reportId: string, commentText: string, medias: CommentMedia[], isAnonymous: boolean) => {
        setIsSubmitting(true);
        try {
            await onCommentSubmit(reportId, commentText, medias, isAnonymous);
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleSubmit = async () => {
        if (!commentText.trim() && commentMedia.length === 0) return;

        await handleCommentDialogSubmit(report.id, commentText, commentMedia, isAnonymous);

        setCommentText('');
        setCommentMedia([]);

        setTimeout(() => {
            const el = scrollAreaRef.current;
            if (el) {
                el.scrollTop = el.scrollHeight;
            }
        }, 100);
    };

    const handleRefineComment = async () => {
        if (!commentText.trim()) return;
        setIsAiLoading(true);
        try {
            const { refinedContent } = await callRefineText({ title: '', content: commentText });
            setCommentText(refinedContent);
            toast.success('Đã chuốt lại câu từ!');
        } catch (error) {
            toast.error('Không thể chuốt lại câu từ lúc này.');
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files) return;
        const files = Array.from(event.target.files);
        const newAttachments: { id: string; url: string; type: 'photo' | 'video' }[] = [];

        for (const file of files) {
            const id = uuidv4();
            await photoStore.addPhoto(id, file);
            const url = URL.createObjectURL(file);
            const type = file.type.startsWith('video') ? 'video' : 'photo';
            newAttachments.push({ id, url, type });
        }
        setCommentMedia(prev => [...prev, ...newAttachments]);
    };

    const handleDeletePreviewMedia = async (idToDelete: string) => {
        setCommentMedia(prev => {
            const mediaToDelete = prev.find(m => m.id === idToDelete);
            if (mediaToDelete) {
                URL.revokeObjectURL(mediaToDelete.url);
            }
            return prev.filter(m => m.id !== idToDelete);
        });
        await photoStore.deletePhoto(idToDelete);
    };

    const handleEditClick = (comment: ReportComment) => {
        setEditingCommentId(comment.id);
        setEditingText(comment.content);
    };

    const handleSaveEdit = () => {
        if (editingCommentId) {
            onCommentEdit(report.id, editingCommentId, editingText);
            setEditingCommentId(null);
            setEditingText('');
        }
    };

    const getCommenterDisplayName = (comment: ReportComment, currentReport: WhistleblowingReport): string => {
        if (comment.isAnonymous) {
            return report.anonymousNameMap?.[comment.authorId] || 'Ẩn danh';
        }
        return allUsers.find(u => u.uid === comment.authorId)?.displayName || 'Người dùng không xác định';
    };

    const handleOpenCommentLightbox = (media: { url: string; type: string }[], index: number) => {
        const slides = media.map(item => {
            if (item.type.startsWith('video')) {
                return {
                    type: 'video' as const,
                    sources: [
                        { src: item.url, type: 'video/mp4' },
                        { src: item.url, type: 'video/webm' },
                    ],
                };
            }
            return { src: item.url, type: 'image' as const };
        });
        onOpenLightbox(slides as Slide[], index);
    };

    if (!isOpen) return null;

    return (
        <TooltipProvider>
            <Dialog open={isOpen} onOpenChange={onClose} dialogTag="comment-dialog" parentDialogTag={parentDialogTag}>
                <DialogContent
                    className="max-w-3xl flex flex-col p-0 bg-background overflow-hidden"
                >
                    <div id="comment-lightbox-container"></div>
                    <DialogHeader iconkey="message" className="shrink-0">
                        <DialogTitle className="text-xl sm:text-2xl font-black uppercase tracking-tight">Thảo luận bài đăng</DialogTitle>
                        <DialogDescription className="max-w-[90%] truncate opacity-60 italic font-medium">
                            "{report.title}"
                        </DialogDescription>
                    </DialogHeader>

                    <DialogBody className="bg-muted/5 flex flex-col">
                        <div ref={scrollAreaRef} className="flex-1 flex flex-col gap-6 overflow-auto">
                            {(report.comments || []).length > 0 ? (
                                (report.comments || []).map(comment => {
                                    const isMyComment = comment.authorId === currentUser.uid;
                                    const canDelete = isMyComment || currentUser.role === 'Chủ nhà hàng';
                                    const isEditingThis = editingCommentId === comment.id;
                                    const displayName = getCommenterDisplayName(comment, report);

                                    return (
                                        <div key={comment.id} className={cn("flex flex-col gap-2", isMyComment ? "items-end" : "items-start")}>
                                            <div className={cn(
                                                "group relative flex flex-col gap-2 p-4 sm:p-5 transition-all shadow-sm border",
                                                isMyComment
                                                    ? "bg-primary/[0.03] border-primary/10 rounded-3xl rounded-tr-none ml-8 sm:ml-20"
                                                    : "bg-card border-muted rounded-3xl rounded-tl-none mr-8 sm:mr-20"
                                            )}>
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className={cn(
                                                            "w-7 h-7 rounded-full flex items-center justify-center shrink-0 border shadow-inner",
                                                            isMyComment ? "bg-primary text-primary-foreground border-primary/20" : "bg-muted text-muted-foreground border-muted-foreground/10"
                                                        )}>
                                                            <User2 className="h-3.5 w-3.5" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[11px] font-black uppercase tracking-widest text-foreground/80 leading-none">
                                                                {displayName}
                                                            </span>
                                                            <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-tighter mt-1">
                                                                {new Date(comment.createdAt as any).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {isMyComment && !isEditingThis && (
                                                            <Button aria-label="Chỉnh sửa bình luận" title="Chỉnh sửa" variant="ghost" size="icon" className="h-8 w-8 rounded-full touchable" onClick={() => handleEditClick(comment)}>
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        {canDelete && !isEditingThis && (
                                                            <AlertDialog dialogTag="alert-dialog" parentDialogTag="comment-dialog" variant="destructive">
                                                                <AlertDialogTrigger asChild>
                                                                    <Button aria-label="Xóa bình luận" title="Xóa" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive touchable">
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogIcon icon={Trash2} className='pb-2'/>
                                                                        <AlertDialogTitle>Xóa bình luận?</AlertDialogTitle>
                                                                        <AlertDialogDescription>Hành động này không thể hoàn tác và bình luận của bạn sẽ biến mất vĩnh viễn.</AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Hủy bỏ</AlertDialogCancel>
                                                                        <AlertDialogAction
                                                                            isLoading={isSubmitting}
                                                                            onClick={async () => {
                                                                                setIsSubmitting(true);
                                                                                try {
                                                                                    await Promise.resolve(onCommentDelete(report.id, comment.id));
                                                                                    toast.success('Đã xóa bình luận');
                                                                                } catch (err) {
                                                                                    toast.error('Không thể xóa bình luận lúc này.');
                                                                                } finally {
                                                                                    setIsSubmitting(false);
                                                                                }
                                                                            }}
                                                                        >
                                                                            Xác nhận xóa
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        )}
                                                    </div> 
                                                </div>

                                                {isEditingThis ? (
                                                    <div className="space-y-3 mt-1">
                                                        <Textarea
                                                            value={editingText}
                                                            onChange={(e) => setEditingText(e.target.value)}
                                                            rows={3}
                                                            autoFocus
                                                            className="rounded-2xl border-primary/20 bg-background shadow-inner resize-none text-sm font-medium"
                                                        />
                                                        <div className="flex justify-end gap-2">
                                                            <Button variant="ghost" size="sm" className="rounded-xl h-8 px-4 font-bold" onClick={() => setEditingCommentId(null)}>Hủy</Button>
                                                            <DialogAction variant="pastel-blue" size="sm" className="h-8 px-5 rounded-xl border-none shadow-sm" onClick={handleSaveEdit}>Cập nhật</DialogAction>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="mt-1 space-y-3">
                                                        <p className="text-sm sm:text-base leading-relaxed text-foreground/90 font-medium whitespace-pre-wrap">
                                                            {comment.content}
                                                        </p>
                                                        {comment.media && comment.media.length > 0 && (
                                                            <div className="flex gap-2.5 flex-wrap">
                                                                {comment.media.map((mediaItem, index) => (
                                                                    <button
                                                                        key={index}
                                                                        onClick={() => handleOpenCommentLightbox(comment.media!, index)}
                                                                        className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden hover:scale-105 transition-transform bg-muted shadow-sm border border-black/5"
                                                                    >
                                                                        {mediaItem.type === 'photo' ? (
                                                                            <Image src={mediaItem.url} alt={`Comment media ${index + 1}`} fill className="object-cover" />
                                                                        ) : (
                                                                            <>
                                                                                <video src={`${mediaItem.url}#t=0.1`} preload="metadata" muted playsInline className="w-full h-full object-cover" />
                                                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                                                    <Video className="h-7 w-7 text-white" />
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                                    <div className="p-5 rounded-full bg-muted/30">
                                        <MessageSquareText className="h-10 w-10 text-muted-foreground/40" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-black uppercase tracking-widest text-muted-foreground/60">Chưa có thảo luận</p>
                                        <p className="text-xs text-muted-foreground/40 font-medium">Hãy là người đầu tiên để lại ý kiến của bạn!</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </DialogBody>

                    <DialogFooter variant="muted" className="shrink-0 p-4 sm:p-6 border-t bg-background/95 backdrop-blur-md flex flex-col gap-3">
                        <div className="w-full flex flex-col gap-3">
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-10 w-10 rounded-full border-muted/50 text-muted-foreground hover:text-primary hover:border-primary/30 bg-background shadow-xs transition-all active:scale-95"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isSubmitting}
                                            >
                                                <Upload className="h-5 w-5" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">Đính kèm ảnh/video</TooltipContent>
                                    </Tooltip>

                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        className="hidden"
                                        accept="image/*,video/*"
                                        multiple
                                    />

                                    {commentMedia.length > 0 && (
                                        <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-[180px] sm:max-w-[300px] scrollbar-hide px-1">
                                            {commentMedia.map((media, index) => (
                                                <div key={media.id} className="relative group shrink-0">
                                                    <button onClick={() => handleOpenCommentLightbox(commentMedia, index)} className="relative w-10 h-10 rounded-xl overflow-hidden bg-muted border border-black/5 shadow-sm active:scale-95 transition-all">
                                                        {media.type === 'photo' ? (
                                                            <Image src={media.url} alt={`Preview ${index}`} fill className="object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <Video className="h-4 w-4 text-muted-foreground" />
                                                            </div>
                                                        )}
                                                    </button>
                                                    <Button
                                                        aria-label="Xóa media"
                                                        title="Xóa"
                                                        variant="destructive"
                                                        size="icon"
                                                        className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full shadow-md z-10 transition-transform"
                                                        onClick={() => handleDeletePreviewMedia(media.id)}
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 bg-background/50 border border-muted/60 pl-3 pr-2 py-1.5 rounded-full shadow-xs">
                                    <Label htmlFor="anonymous-comment-switch" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 cursor-pointer select-none">
                                        Ẩn danh
                                    </Label>
                                    <Switch
                                        id="anonymous-comment-switch"
                                        checked={isAnonymous}
                                        onCheckedChange={setIsAnonymous}
                                        className="scale-90 data-[state=checked]:bg-primary"
                                    />
                                </div>
                            </div>

                            <div className="relative flex items-end gap-2">
                                <Textarea
                                    ref={textareaRef}
                                    placeholder="Chia sẻ suy nghĩ của bạn..."
                                    value={commentText}
                                    onChange={(e) => {
                                        setCommentText(e.target.value);
                                        const el = e.target as HTMLTextAreaElement;
                                        el.style.height = "auto";
                                        el.style.height = Math.min(el.scrollHeight, 140) + "px";
                                    }}
                                    disabled={isSubmitting}
                                    className="flex-1 min-h-[56px] pr-24 pl-5 py-4 rounded-[1.75rem] border-muted/60 bg-background focus:ring-primary/10 focus:border-primary/20 transition-all resize-none font-medium text-sm leading-relaxed shadow-xs"
                                    style={{ height: "56px" }}
                                />

                                <div className="absolute right-2 bottom-2 flex items-center gap-1.5 px-0.5 pb-0.5">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-10 w-10 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                                                onClick={handleRefineComment}
                                                disabled={isAiLoading || !commentText.trim()}
                                            >
                                                {isAiLoading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Wand2 className="h-4.5 w-4.5" />}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">Chuốt lại câu từ bằng AI</TooltipContent>
                                    </Tooltip>

                                    <DialogAction
                                        size="icon"
                                        onClick={handleSubmit}
                                        isLoading={isSubmitting}
                                        disabled={isSubmitting || (!commentText.trim() && commentMedia.length === 0)}
                                        className="h-10 w-10 rounded-full shadow-md transition-all active:scale-90 bg-primary hover:bg-primary/90"
                                    >
                                        {!isSubmitting && <Send className="h-4.5 w-4.5" />}
                                    </DialogAction>
                                </div>
                            </div>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    );
}
