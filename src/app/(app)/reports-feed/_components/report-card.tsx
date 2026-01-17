'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, ThumbsDown, MessageSquare, Eye, EyeOff, Loader2, Trash2, User, Pin, PinOff, Edit2, File as FileIcon } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import type { WhistleblowingReport, AuthUser, ManagedUser, ReportComment, Attachment, CommentMedia } from '@/lib/types';
import Image from 'next/image';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogIcon, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import CommentDialog from './comment-dialog';
import { toast } from '@/components/ui/pro-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { useLightbox } from '@/contexts/lightbox-context';

export default function ReportCard({
    report,
    currentUser,
    allUsers,
    onVote,
    onDelete,
    onTogglePin,
    onCommentSubmit,
    onCommentEdit,
    onCommentDelete,
    onEdit,
}: {
    report: WhistleblowingReport;
    currentUser: AuthUser;
    allUsers: ManagedUser[];
    onVote: (reportId: string, voteType: 'up' | 'down') => Promise<void>;
    onDelete: (reportId: string) => void;
    onTogglePin: (reportId: string, currentPinStatus: boolean) => Promise<void>;
    onCommentSubmit: (reportId: string, commentText: string, medias: CommentMedia[], isAnonymous: boolean) => Promise<void>;
    onCommentEdit: (violationId: string, commentId: string, newText: string) => void;
    onCommentDelete: (violationId: string, commentId: string) => void;
    onEdit: (report: WhistleblowingReport) => void;
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
    const { openLightbox } = useLightbox();

    const isMyReport = report.reporterId === currentUser.uid;
    const isOwner = currentUser.role === 'Chủ nhà hàng';

    const handleOpenLightbox = (index: number) => {
        const slides = mediaAttachments.map(att => {
            const type = att.type.startsWith('video') ? 'video' : 'image';

            if (type === 'video') {
                return {
                    type: 'video' as const,
                    sources: [
                        { src: att.url, type: 'video/mp4' },
                        { src: att.url, type: 'video/webm' },
                    ],
                };
            }
            return { src: att.url, type: 'image' as const };
        });
        openLightbox(slides, index);
    };


    const hasVotedUp = report.upvotes?.includes(currentUser.uid);
    const hasVotedDown = report.downvotes?.includes(currentUser.uid);

    const handleVote = async (voteType: 'up' | 'down') => {
        setIsProcessing(true);
        try {
            const currentlyVotedUp = report.upvotes?.includes(currentUser.uid);
            const currentlyVotedDown = report.downvotes?.includes(currentUser.uid);

            await onVote(report.id, voteType);

            if (voteType === 'up') {
                if (!currentlyVotedUp) {
                    toast.success(`Bạn đã đồng tình với bài đăng "${report.title}"`);
                } else {
                    toast.success(`Bạn đã bỏ đồng tình với bài đăng "${report.title}"`);
                }
            } else if (voteType === 'down') {
                if (!currentlyVotedDown) {
                    toast.success(`Bạn đã không đồng tình với bài đăng "${report.title}"`);
                } else {
                    toast.success(`Bạn đã bỏ không đồng tình với bài đăng "${report.title}"`);
                }
            }

        } catch (error) {
            toast.error('Thao tác thất bại.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTogglePin = async () => {
        setIsProcessing(true);
        try {
            await onTogglePin(report.id, !!report.isPinned);
        } finally {
            setIsProcessing(false);
        }
    }

    const handleCommentDialogSubmit = async (reportId: string, commentText: string, medias: CommentMedia[], isAnonymous: boolean) => {
        setIsProcessing(true);
        try {
            await onCommentSubmit(reportId, commentText, medias, isAnonymous);
        } finally {
            setIsProcessing(false);
        }
    }

    const reporterDisplayName = useMemo(() => {
        return report.isAnonymous
            ? 'Ẩn danh'
            : allUsers.find(u => u.uid === report.reporterId)?.displayName || 'Không rõ';
    }, [report, allUsers]);

    const reporterPhotoURL = useMemo(() => {
        if (report.isAnonymous) return null;
        return allUsers.find(u => u.uid === report.reporterId)?.photoURL || null;
    }, [report, allUsers]);

    const reporterAvatarFallback = useMemo(() => {
        if (reporterDisplayName === 'Ẩn danh') return <User className="h-4 w-4" />;
        return getInitials(reporterDisplayName);
    }, [reporterDisplayName]);

    const mediaAttachments = useMemo(() => (report.attachments || []).filter(att => att.type.startsWith('image/') || att.type.startsWith('video/')), [report.attachments]);
    const otherAttachments = useMemo(() => (report.attachments || []).filter(att => !att.type.startsWith('image/') && !att.type.startsWith('video/')), [report.attachments]);

    return (
        <TooltipProvider>
            <Card className={cn(
                "rounded-xl shadow-md border bg-card transition-all duration-300",
                report.isPinned && "border-amber-500/50 ring-2 ring-amber-500/20 bg-amber-100/30 dark:bg-amber-900/10"
            )}>
                <CardHeader className="p-4 sm:p-6 pb-4">
                    {report.isPinned && (
                        <Badge variant="outline" className="mb-2 w-fit bg-amber-100 border-amber-200 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700">
                            <Pin className="mr-1.5 h-3 w-3" />
                            Đã ghim
                        </Badge>
                    )}
                    <CardTitle className="text-xl font-bold leading-tight">{report.title}</CardTitle>
                    <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Avatar className="h-6 w-6">
                                <AvatarImage src={reporterPhotoURL || ''} />
                                <AvatarFallback className="text-xs">{reporterAvatarFallback}</AvatarFallback>
                            </Avatar>
                            <span className="font-semibold text-foreground">{reporterDisplayName}</span>
                            <span>•</span>
                            <span>{new Date(report.createdAt as any).toLocaleString('vi-VN')}</span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 py-2">
                    <div className="space-y-4">
                        <div className={cn("text-base whitespace-pre-wrap leading-relaxed", !isExpanded && "line-clamp-4")}>
                            {report.content}
                        </div>
                        {report.content.length > 300 && (
                            <Button variant="link" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="p-0 h-auto text-muted-foreground">
                                {isExpanded ? 'Thu gọn' : 'Xem thêm'}
                            </Button>
                        )}

                        <div className="space-y-2">
                            {report.accusedUsers && report.accusedUsers.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <Label className="text-xs font-semibold">Đối tượng:</Label>
                                    {report.accusedUsers.map(user => (
                                        <Badge key={user.uid} variant="destructive">{user.displayName}</Badge>
                                    ))}
                                </div>
                            )}
                            {(isMyReport || isOwner) && (
                                <div className="flex items-center gap-2">
                                    <Badge variant={report.visibility === 'private' ? 'secondary' : 'outline'}>
                                        {report.visibility === 'private' ? <EyeOff className="mr-1 h-3 w-3" /> : <Eye className="mr-1 h-3 w-3" />}
                                        {report.visibility === 'private' ? 'Riêng tư' : 'Công khai'}
                                    </Badge>
                                    {isMyReport && <Badge variant="outline" className="border-primary text-primary">Bài của bạn</Badge>}
                                </div>
                            )}
                        </div>

                        {mediaAttachments.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {mediaAttachments.map((att, index) => (
                                    <button key={att.url} onClick={() => handleOpenLightbox(index)} className="relative aspect-square w-full rounded-lg overflow-hidden group">
                                        {att.type.startsWith('image/') ? (
                                            <Image src={att.url} alt={att.name} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
                                        ) : (
                                            <video src={att.url} className="object-cover h-full w-full" muted playsInline />
                                        )}
                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                    </button>
                                ))}
                            </div>
                        )}
                        {otherAttachments.length > 0 && (
                            <div className="space-y-2 pt-2">
                                <Label className="text-xs font-semibold">Tệp đính kèm khác:</Label>
                                <div className="flex flex-col gap-2">
                                    {otherAttachments.map((att, index) => (
                                        <a href={att.url} target="_blank" rel="noopener noreferrer" key={att.url} className="flex items-center gap-2 p-2 rounded-md bg-muted hover:bg-accent transition-colors">
                                            <FileIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
                                            <span className="text-sm font-medium truncate flex-1">{att.name}</span>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="px-4 sm:px-6 py-3 flex justify-between items-center border-t mt-4">
                    <div className="flex items-center gap-1">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleVote('up')}
                                    disabled={isProcessing}
                                    className={cn("flex items-center gap-1.5", hasVotedUp && "text-emerald-600 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/50")}
                                >
                                    <ThumbsUp className="h-4 w-4" />
                                    <span className="font-semibold">{report.upvotes?.length || 0}</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Đồng tình</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleVote('down')}
                                    disabled={isProcessing}
                                    className={cn("flex items-center gap-1.5", hasVotedDown && "text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900/50")}
                                >
                                    <ThumbsDown className="h-4 w-4" />
                                    <span className="font-semibold">{report.downvotes?.length || 0}</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Không đồng tình</p></TooltipContent>
                        </Tooltip>
                    </div>
                    <div className="flex items-center gap-1">
                        {(isMyReport || isOwner) && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={() => onEdit(report)} className="h-8 w-8 text-muted-foreground" disabled={isProcessing}>
                                        <Edit2 className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Chỉnh sửa</p></TooltipContent>
                            </Tooltip>
                        )}
                        {isOwner && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={handleTogglePin} className="h-8 w-8 text-muted-foreground" disabled={isProcessing}>
                                        {report.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{report.isPinned ? 'Bỏ ghim' : 'Ghim bài đăng'}</p></TooltipContent>
                            </Tooltip>
                        )}
                        {(isMyReport || isOwner) && (
                            <AlertDialog dialogTag="alert-dialog" parentDialogTag="root" variant="destructive">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" disabled={isProcessing}><Trash2 className="h-4 w-4" /></Button>
                                        </AlertDialogTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Xóa bài đăng</p></TooltipContent>
                                </Tooltip>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogIcon icon={Trash2} />
                                        <div className="space-y-2 text-center sm:text-left">
                                            <AlertDialogTitle>Xóa bài tố cáo?</AlertDialogTitle>
                                            <AlertDialogDescription>Hành động này sẽ xóa vĩnh viễn bài đăng và tất cả bình luận. Không thể hoàn tác.</AlertDialogDescription>
                                        </div>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onDelete(report.id)}>Xóa</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                        <Separator orientation="vertical" className="h-6 mx-1" />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => setIsCommentDialogOpen(true)} className="flex items-center gap-1.5 text-muted-foreground">
                                    <MessageSquare className="h-4 w-4" />
                                    <span>{report.commentCount || 0}</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Bình luận</p></TooltipContent>
                        </Tooltip>
                    </div>
                </CardFooter>
            </Card>

            <CommentDialog
                isOpen={isCommentDialogOpen}
                onClose={() => setIsCommentDialogOpen(false)}
                report={report}
                currentUser={currentUser}
                allUsers={allUsers}
                onCommentSubmit={handleCommentDialogSubmit}
                onCommentEdit={onCommentEdit}
                onCommentDelete={onCommentDelete}
                onOpenLightbox={openLightbox}
                parentDialogTag="root"
            />
        </TooltipProvider>
    );
}
