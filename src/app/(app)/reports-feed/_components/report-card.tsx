'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, ThumbsDown, MessageSquare, Eye, EyeOff, Loader2, Trash2, User, Pin, PinOff, Edit2, File as FileIcon, Clock, ChevronRight, Share2, MoreVertical } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import type { WhistleblowingReport, AuthUser, ManagedUser, ReportComment, Attachment, CommentMedia } from '@/lib/types';
import Image from '@/components/ui/image';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogIcon, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import CommentDialog from './comment-dialog';
import { toast } from '@/components/ui/pro-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { useLightbox } from '@/contexts/lightbox-context';
import { DialogAction } from '@/components/ui/dialog';
import { Alert } from '@/components/ui/alert';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
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
        } catch (error) {
            toast.error('Thao tác ghim thất bại.');
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
                "rounded-[2.5rem] shadow-soft border border-white/40 bg-white/60 backdrop-blur-xl overflow-hidden transition-all duration-300 relative group",
                report.isPinned && "ring-2 ring-amber-400/30",
                isProcessing && "opacity-80 pointer-events-none"
            )}>
                {/* Status Bar */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-black/5 bg-black/[0.02]">
                    <div className="flex items-center gap-2">
                        {report.isPinned && (
                            <Badge className="bg-amber-400 text-amber-950 hover:bg-amber-400 border-none rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-sm">
                                <Pin className="h-2.5 w-2.5 fill-current" />
                                Đã ghim
                            </Badge>
                        )}
                        <div className="flex items-center gap-1.5 opacity-40">
                            <Clock className="h-3 w-3" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">
                                {new Date(report.createdAt as any).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {(isMyReport || isOwner) && (
                            <Badge variant="outline" className="rounded-full border-black/5 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 bg-white/50 text-muted-foreground/60">
                                {report.visibility === 'private' ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                                {report.visibility === 'private' ? 'Riêng tư' : 'Công khai'}
                            </Badge>
                        )}
                        
                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-black/5">
                                    <MoreVertical className="h-4 w-4 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-2xl min-w-[160px] p-2">
                                <DropdownMenuItem onClick={() => onEdit(report)} className="rounded-xl flex items-center gap-2 py-2.5 font-bold text-xs uppercase tracking-widest">
                                    <Edit2 className="h-3.5 w-3.5" />
                                    Chỉnh sửa
                                </DropdownMenuItem>
                                
                                {isOwner && (
                                    <DropdownMenuItem onClick={handleTogglePin} className="rounded-xl flex items-center gap-2 py-2.5 font-bold text-xs uppercase tracking-widest">
                                        {report.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                                        {report.isPinned ? 'Bỏ ghim' : 'Ghim bài'}
                                    </DropdownMenuItem>
                                )}

                                <DropdownMenuItem className="rounded-xl flex items-center gap-2 py-2.5 font-bold text-xs uppercase tracking-widest">
                                    <Share2 className="h-3.5 w-3.5" />
                                    Chia sẻ
                                </DropdownMenuItem>

                                {(isMyReport || isOwner) && (
                                    <>
                                        <DropdownMenuSeparator className="my-1 opacity-50" />
                                        <DropdownMenuItem 
                                            onSelect={(e) => {
                                                e.preventDefault();
                                                setIsDeleteDialogOpen(true);
                                            }}
                                            className="rounded-xl flex items-center gap-2 py-2.5 font-bold text-xs uppercase tracking-widest text-destructive focus:text-destructive focus:bg-destructive/10"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Xóa bài
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <CardHeader className="p-6 pb-2 space-y-4">
                    <CardTitle className="text-xl sm:text-2xl font-black leading-tight tracking-tight text-foreground/90 group-hover:text-primary transition-colors">
                        {report.title}
                    </CardTitle>

                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-white shadow-soft">
                            <AvatarImage src={reporterPhotoURL || ''} />
                            <AvatarFallback className="bg-muted text-muted-foreground font-black text-xs">
                                {reporterAvatarFallback}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black uppercase tracking-widest text-foreground/80 leading-none">
                                    {reporterDisplayName}
                                </span>
                                {isMyReport && (
                                    <Badge className="rounded-full bg-primary/10 text-primary border-none px-1.5 py-0 h-3.5 text-[7px] font-black uppercase tracking-widest">
                                        YOU
                                    </Badge>
                                )}
                            </div>
                            <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-tighter mt-1">
                                Người gửi tin
                            </span>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-6 pt-2 space-y-6">
                    {/* Content Section */}
                    <div className="relative">
                        <div className={cn(
                            "text-sm sm:text-base leading-relaxed text-foreground/75 font-medium whitespace-pre-wrap bg-primary/[0.015] border border-primary/5 p-5 rounded-[2rem]",
                            !isExpanded && "line-clamp-6"
                        )}>
                            {report.content}
                        </div>
                        {report.content.length > 300 && (
                            <button 
                                onClick={() => setIsExpanded(!isExpanded)} 
                                className="mt-3 text-[10px] font-black uppercase tracking-widest text-primary hover:opacity-80 flex items-center gap-1 px-2 py-1 rounded-full bg-primary/5 transition-all"
                            >
                                {isExpanded ? 'Thu gọn nội dung' : 'Đọc tiếp báo cáo'}
                                <ChevronRight className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")} />
                            </button>
                        )}
                    </div>

                    {/* Meta Info: Accused */}
                    {report.accusedUsers && report.accusedUsers.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 ml-1">
                                <div className="w-1 h-3 bg-destructive rounded-full" />
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                                    Đối tượng liên quan
                                </Label>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {report.accusedUsers.map(user => (
                                    <Badge 
                                        key={user.uid} 
                                        variant="destructive" 
                                        className="rounded-xl px-3 py-1 font-black text-[10px] uppercase tracking-tight shadow-sm opacity-90 hover:opacity-100"
                                    >
                                        @{user.displayName}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Media Gallery */}
                    {mediaAttachments.length > 0 && (
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 ml-2">
                                Minh chứng ({mediaAttachments.length})
                            </Label>
                            <div className={cn(
                                "grid gap-2",
                                mediaAttachments.length === 1 ? "grid-cols-1" : 
                                mediaAttachments.length === 2 ? "grid-cols-2" : 
                                "grid-cols-3"
                            )}>
                                {mediaAttachments.map((att, index) => (
                                    <button 
                                        key={att.url} 
                                        onClick={() => handleOpenLightbox(index)} 
                                        className={cn(
                                            "relative rounded-3xl overflow-hidden group/media bg-muted border border-black/5 shadow-sm active:scale-95 transition-all",
                                            mediaAttachments.length === 1 ? "aspect-video" : "aspect-square"
                                        )}
                                    >
                                        {att.type.startsWith('image/') ? (
                                            <Image 
                                                src={att.url} 
                                                alt={att.name} 
                                                fill
                                                className="object-cover transition-transform duration-700 group-hover/media:scale-110" 
                                            />
                                        ) : (
                                            <>
                                                <video src={`${att.url}#t=0.1`} className="object-cover h-full w-full" muted playsInline />
                                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center transition-opacity group-hover/media:bg-black/40">
                                                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-lg">
                                                        <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent ml-1" />
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                        <div className="absolute top-2 right-2 opacity-0 group-hover/media:opacity-100 transition-opacity">
                                            <div className="bg-black/50 backdrop-blur-md rounded-full p-1.5 border border-white/10">
                                                <Eye className="h-3 w-3 text-white" />
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Documents */}
                    {otherAttachments.length > 0 && (
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 ml-2">
                                Tài liệu
                            </Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {otherAttachments.map((att) => (
                                    <a 
                                        href={att.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        key={att.url} 
                                        className="flex items-center gap-3 p-3 rounded-[1.5rem] bg-black/[0.02] border border-black/5 hover:bg-black/[0.04] transition-all group/file"
                                    >
                                        <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shrink-0 border border-black/5 shadow-sm">
                                            <FileIcon className="h-5 w-5 text-primary opacity-40 group-hover/file:opacity-100 transition-opacity" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-xs font-bold truncate text-foreground/70">{att.name}</span>
                                            <span className="text-[9px] font-black uppercase tracking-widest opacity-30">Download</span>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>

                {/* Interaction Strip */}
                <div className="px-3 py-6 border-t border-black/5 flex items-center justify-between gap-4">
                    <div className="flex items-center bg-black/[0.03] p-1 rounded-[1.75rem] border border-black/5 shadow-inner">
                        <button
                            onClick={() => handleVote('up')}
                            disabled={isProcessing}
                            className={cn(
                                "flex items-center gap-2.5 px-4 h-10 rounded-2xl transition-all active:scale-95 font-black text-[11px] uppercase tracking-widest",
                                hasVotedUp ? "bg-white text-emerald-600 shadow-soft" : "text-muted-foreground/40 hover:text-muted-foreground/70"
                            )}
                        >
                            <ThumbsUp className={cn("h-3.5 w-3.5", hasVotedUp && "fill-current")} />
                            {report.upvotes?.length || 0}
                        </button>

                        <div className="w-px h-4 bg-black/10 mx-0.5" />

                        <button
                            onClick={() => handleVote('down')}
                            disabled={isProcessing}
                            className={cn(
                                "flex items-center gap-2.5 px-2 h-10 rounded-2xl transition-all active:scale-95 font-black text-[11px] uppercase tracking-widest",
                                hasVotedDown ? "bg-white text-rose-600 shadow-soft" : "text-muted-foreground/40 hover:text-muted-foreground/70"
                            )}
                        >
                            <ThumbsDown className={cn("h-3.5 w-3.5", hasVotedDown && "fill-current")} />
                            {report.downvotes?.length || 0}
                        </button>
                    </div>

                    <DialogAction 
                        variant="pastel-mint"
                        onClick={() => setIsCommentDialogOpen(true)} 
                        className="flex-1 h-12 rounded-[1.25rem] border-none shadow-soft flex items-center justify-center gap-3 active:scale-[0.98] transition-all group/comm"
                    >
                        <div className="flex items-center gap-2">
                            <MessageSquare className="h-4.5 w-4.5 opacity-50 group-hover/comm:opacity-100 transition-opacity" />
                            <span className="hidden min-[360px]:inline font-black text-[8px] min-[400px]:text-[9px] sm:text-[10px] uppercase tracking-[0.15em] pt-0.5">Thảo luận</span>
                        </div>
                        {(report.commentCount || 0) > 0 && (
                            <div className="bg-white/40 px-2 py-0.5 rounded-full text-[10px] font-black opacity-80 min-w-[22px] flex items-center justify-center">
                                {report.commentCount}
                            </div>
                        )}
                    </DialogAction>
                </div>
            </Card>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen} dialogTag="delete-alert" parentDialogTag="root" variant="destructive">
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogIcon className="text-destructive" icon={Trash2} />
                        <AlertDialogTitle>Xóa bài tố cáo?</AlertDialogTitle>
                        <AlertDialogDescription>Mọi thông tin về bài đăng này bao gồm các thảo luận sẽ bị gỡ bỏ vĩnh viễn khỏi hệ thống.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(report.id)}>Xác nhận xóa</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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
