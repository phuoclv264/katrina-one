'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Wand2, Loader2, Edit, Trash2, X, Send, Upload, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { callRefineText } from '@/lib/ai-service';
import type { WhistleblowingReport, AuthUser, ManagedUser, ReportComment } from '@/lib/types';
import Image from 'next/image';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { photoStore } from '@/lib/photo-store';
import { v4 as uuidv4 } from 'uuid';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { Badge } from '@/components/ui/badge';


type CommentDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    report: WhistleblowingReport;
    currentUser: AuthUser;
    allUsers: ManagedUser[];
    onCommentSubmit: (reportId: string, commentText: string, photoIds: string[], isAnonymous: boolean) => Promise<void>;
    onCommentEdit: (violationId: string, commentId: string, newText: string) => void;
    onCommentDelete: (violationId: string, commentId: string) => void;
    onOpenLightbox: (photos: string[], index: number) => void;
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
    onOpenLightbox
}: CommentDialogProps) {
    const [commentText, setCommentText] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(true);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [commentPhotoIds, setCommentPhotoIds] = useState<string[]>([]);
    const [commentPhotoUrls, setCommentPhotoUrls] = useState<string[]>([]);
    
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
    
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // --- Back button handling for Lightbox ---
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
        if (isLightboxOpen) {
            event.preventDefault();
            setIsLightboxOpen(false);
        }
        };

        if (isLightboxOpen) {
        window.history.pushState(null, '', window.location.href);
        window.addEventListener('popstate', handlePopState);
        }

        return () => {
        window.removeEventListener('popstate', handlePopState);
        };
    }, [isLightboxOpen]);


    const handleCommentDialogSubmit = async (reportId: string, commentText: string, photoIds: string[], isAnonymous: boolean) => {
        setIsSubmitting(true);
        try {
            await onCommentSubmit(reportId, commentText, photoIds, isAnonymous);
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleSubmit = async () => {
        if (!commentText.trim() && commentPhotoIds.length === 0) return;
        
        await handleCommentDialogSubmit(report.id, commentText, commentPhotoIds, isAnonymous);
        
        setCommentText('');
        setCommentPhotoIds([]);
        setCommentPhotoUrls([]);

        setTimeout(() => {
            const viewport = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]');
            if (viewport) {
                viewport.scrollTop = viewport.scrollHeight;
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
        const newPhotoAttachments: { id: string, url: string }[] = [];

        for (const file of files) {
            const id = uuidv4();
            await photoStore.addPhoto(id, file);
            const url = URL.createObjectURL(file);
            newPhotoAttachments.push({ id, url });
        }
        setCommentPhotoIds(prev => [...prev, ...newPhotoAttachments.map(a => a.id)]);
        setCommentPhotoUrls(prev => [...prev, ...newPhotoAttachments.map(a => a.url)]);
    };

    const handleDeletePreviewPhoto = async (urlToDelete: string) => {
        const index = commentPhotoUrls.indexOf(urlToDelete);
        if (index > -1) {
            const idToDelete = commentPhotoIds[index];
            setCommentPhotoUrls(prev => prev.filter(url => url !== urlToDelete));
            setCommentPhotoIds(prev => prev.filter(id => id !== idToDelete));
            URL.revokeObjectURL(urlToDelete);
            await photoStore.deletePhoto(idToDelete);
        }
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


    if (!isOpen) return null;

    return (
        <TooltipProvider>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent 
                    className="max-w-2xl h-[90vh] flex flex-col p-0 bg-white dark:bg-card rounded-xl shadow-lg"
                     onInteractOutside={(e) => { if (isLightboxOpen) e.preventDefault(); }}
                >
                     <div id="comment-lightbox-container"></div>
                    <DialogHeader className="p-4 sm:p-6 pb-2 border-b shrink-0">
                        <DialogTitle className="text-xl">Thảo luận về bài đăng</DialogTitle>
                        <DialogDescription className="truncate">
                           "{report.title}"
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="flex-grow px-4" ref={scrollAreaRef}>
                        <div className="space-y-4 py-4">
                            {(report.comments || []).map(comment => {
                                const isMyComment = comment.authorId === currentUser.uid;
                                const canDelete = isMyComment || currentUser.role === 'Chủ nhà hàng';
                                const isEditingThis = editingCommentId === comment.id;
                                const displayName = getCommenterDisplayName(comment, report);
                                
                                return (
                                    <div key={comment.id} className="flex items-start gap-3">
                                        <Card className={cn("flex-1 rounded-xl shadow-sm", isMyComment ? "bg-primary/5" : "bg-muted/50")}>
                                            <CardContent className="p-3">
                                                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                                    <span className="font-bold text-sm text-foreground">{displayName}</span>
                                                    <div className="flex items-center gap-0">
                                                        <span>{new Date(comment.createdAt as any).toLocaleString('vi-VN')}</span>
                                                        {isMyComment && !isEditingThis && (
                                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditClick(comment)}><Edit className="h-3 w-3" /></Button>
                                                        )}
                                                        {canDelete && !isEditingThis && (
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Xóa bình luận?</AlertDialogTitle>
                                                                        <AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => onCommentDelete(report.id, comment.id)}>Xóa</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        )}
                                                    </div>
                                                </div>
                                                {isEditingThis ? (
                                                    <div className="space-y-2 mt-1">
                                                        <Textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} rows={2} autoFocus/>
                                                        <div className="flex justify-end gap-2">
                                                            <Button variant="ghost" size="sm" onClick={() => setEditingCommentId(null)}>Hủy</Button>
                                                            <Button size="sm" onClick={handleSaveEdit}>Lưu</Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{comment.content}</p>
                                                        {comment.photos && comment.photos.length > 0 && (
                                                            <div className="mt-2 flex gap-2 flex-wrap">
                                                            {comment.photos.map((photo, index) => (
                                                                <button key={index} onClick={() => onOpenLightbox(comment.photos!, index)} className="relative w-20 h-20 rounded-md overflow-hidden hover:opacity-90 transition-opacity">
                                                                <Image src={photo} alt={`Comment photo ${index + 1}`} fill className="object-cover" />
                                                                </button>
                                                            ))}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </div>
                                );
                            })}
                             {(!report.comments || report.comments.length === 0) && (
                                <p className="text-sm text-center text-muted-foreground py-10">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
                             )}
                        </div>
                    </ScrollArea>
                    
                    <DialogFooter className="border-t bg-muted/30 p-3">
                        <div className="flex flex-col w-full gap-2">

                            {/* Hàng 1: các nút chức năng */}
                            <div className="flex flex-wrap items-center justify-between bg-white dark:bg-card rounded-xl shadow-sm p-2 border border-muted">
                            <div className="flex items-center gap-1 flex-wrap">
                                {/* Nút AI */}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" onClick={handleRefineComment} disabled={isAiLoading || !commentText}>
                                            {isAiLoading ? <Loader2 className="h-5 w-5 animate-spin"/> : <Wand2 className="h-5 w-5" />}
                                        </Button>
                                    </TooltipTrigger>
                                <TooltipContent>Chuốt lại câu từ</TooltipContent>
                                </Tooltip>

                                {/* Nút Upload ảnh */}
                                <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isSubmitting}
                                    >
                                    <Upload className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Tải ảnh lên</TooltipContent>
                                </Tooltip>
                                <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept="image/*"
                                multiple
                                />

                                {/* Nút xem / xóa ảnh nếu có ảnh */}
                                {commentPhotoUrls.length > 0 && (
                                <>
                                    <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setIsLightboxOpen(true)}
                                    className="flex items-center gap-1 h-8"
                                    >
                                    <Eye className="h-4 w-4" />
                                    <Badge className="ml-1">{commentPhotoUrls.length}</Badge>
                                    </Button>

                                    <Button
                                    variant="link"
                                    size="sm"
                                    className="text-destructive h-auto p-1"
                                    onClick={() => {
                                        commentPhotoUrls.forEach((url) => URL.revokeObjectURL(url));
                                        commentPhotoIds.forEach((id) => photoStore.deletePhoto(id));
                                        setCommentPhotoUrls([]);
                                        setCommentPhotoIds([]);
                                    }}
                                    >
                                    Xóa
                                    </Button>
                                </>
                                )}
                            </div>

                            {/* Toggle ẩn danh */}
                            <div className="flex items-center space-x-2">
                                <Switch id="anonymous-comment-switch" checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                                <Label htmlFor="anonymous-comment-switch" className="text-sm font-medium whitespace-nowrap">Ẩn danh</Label>
                            </div>
                            </div>

                            {/* Hàng 2: input + gửi */}
                            <div className="flex items-end gap-2 bg-white dark:bg-card rounded-xl shadow-sm p-2 border border-muted">
                            <Textarea
                                placeholder="Nhập nội dung..."
                                value={commentText}
                                onChange={(e) => {
                                setCommentText(e.target.value);
                                const el = e.target as HTMLTextAreaElement;
                                el.style.height = "auto";
                                el.style.height = Math.min(el.scrollHeight, 72) + "px"; // giãn tối đa 3 dòng
                                }}
                                disabled={isSubmitting}
                                rows={1}
                                className="flex-1 resize-none border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm bg-transparent leading-[1.5] py-[10px] transition-all"
                                style={{
                                height: "auto",
                                minHeight: "24px", // 1 dòng
                                maxHeight: "72px",
                                overflowY: "auto",
                                }}
                            />

                            {/* Nút gửi */}
                            <Button
                                size="icon"
                                onClick={handleSubmit}
                                disabled={
                                isSubmitting || (!commentText.trim() && commentPhotoIds.length === 0)
                                }
                                className="h-9 w-9 rounded-full"
                            >
                                {isSubmitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                <Send className="h-4 w-4" />
                                )}
                            </Button>
                            </div>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

             <Lightbox
                open={isLightboxOpen}
                close={() => setIsLightboxOpen(false)}
                slides={commentPhotoUrls.map(url => ({ src: url }))}
                index={lightboxIndex}
                portal={{ root: document.getElementById("comment-lightbox-container") ?? undefined }}
            />
        </TooltipProvider>
    );
}
