
'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, ThumbsDown, MessageSquare, Eye, EyeOff, Loader2, Trash2, User, Pin, PinOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WhistleblowingReport, AuthUser, ManagedUser, ReportComment } from '@/lib/types';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Image from 'next/image';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import CommentDialog from './comment-dialog';
import { toast } from 'react-hot-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';


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
}: {
  report: WhistleblowingReport;
  currentUser: AuthUser;
  allUsers: ManagedUser[];
  onVote: (reportId: string, voteType: 'up' | 'down') => Promise<void>;
  onDelete: (reportId: string) => void;
  onTogglePin: (reportId: string, currentPinStatus: boolean) => Promise<void>;
  onCommentSubmit: (reportId: string, commentText: string, photoIds: string[], isAnonymous: boolean) => Promise<void>;
  onCommentEdit: (violationId: string, commentId: string, newText: string) => void;
  onCommentDelete: (violationId: string, commentId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  
  const isMyReport = report.reporterId === currentUser.uid;
  const isOwner = currentUser.role === 'Chủ nhà hàng';

  const openLightbox = (photos: string[], index: number = 0) => {
    setLightboxPhotos(photos);
    setLightboxOpen(true);
    setLightboxIndex(index);
  };
  
  const hasVotedUp = report.upvotes?.includes(currentUser.uid);
  const hasVotedDown = report.downvotes?.includes(currentUser.uid);

  const handleVote = async (voteType: 'up' | 'down') => {
    setIsProcessing(true);
    try {
      await onVote(report.id, voteType);
      const currentlyVotedUp = report.upvotes?.includes(currentUser.uid);
      const currentlyVotedDown = report.downvotes?.includes(currentUser.uid);

      if (voteType === 'up') {
        if (!currentlyVotedUp) { // This check is after the vote, so it's the new state
          toast.success(`Bạn đã đồng tình với bài đăng "${report.title}"`);
        } else {
          toast.success(`Bạn đã bỏ đồng tình với bài đăng "${report.title}"`);
        }
      } else if (voteType === 'down') {
        if (!currentlyVotedDown) { // This check is after the vote, so it's the new state
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

  const handleCommentDialogSubmit = async (reportId: string, commentText: string, photoIds: string[], isAnonymous: boolean) => {
    setIsProcessing(true);
    try {
        await onCommentSubmit(reportId, commentText, photoIds, isAnonymous);
    } finally {
        setIsProcessing(false);
    }
  }

  const reporterDisplayName = useMemo(() => {
    return report.isAnonymous 
      ? 'Ẩn danh'
      : allUsers.find(u => u.uid === report.reporterId)?.displayName || 'Không rõ';
  }, [report, allUsers]);

  const reporterAvatarFallback = useMemo(() => {
    if (reporterDisplayName === 'Ẩn danh') return <User className="h-4 w-4"/>;
    return reporterDisplayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }, [reporterDisplayName]);

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
                          <Badge key={user.id} variant="destructive">{user.name}</Badge>
                      ))}
                  </div>
              )}
               {(isMyReport || currentUser.role === 'Chủ nhà hàng') && (
                <div className="flex items-center gap-2">
                   <Badge variant={report.visibility === 'private' ? 'secondary' : 'outline'}>
                       {report.visibility === 'private' ? <EyeOff className="mr-1 h-3 w-3"/> : <Eye className="mr-1 h-3 w-3"/>}
                       {report.visibility === 'private' ? 'Riêng tư' : 'Công khai'}
                   </Badge>
                   {isMyReport && <Badge variant="outline" className="border-primary text-primary">Bài của bạn</Badge>}
                </div>
             )}
            </div>
            
            {report.attachments && report.attachments.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {report.attachments.map((url, index) => (
                         <button key={url} onClick={() => openLightbox(report.attachments!, index)} className="relative aspect-square w-full rounded-lg overflow-hidden group">
                            <Image src={url} alt={`Attachment ${index + 1}`} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                         </button>
                    ))}
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
                        <ThumbsUp className="h-4 w-4"/>
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
                        <ThumbsDown className="h-4 w-4"/>
                        <span className="font-semibold">{report.downvotes?.length || 0}</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent><p>Không đồng tình</p></TooltipContent>
            </Tooltip>
           </div>
            <div className="flex items-center gap-1">
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
                 {isOwner && (
                    <AlertDialog>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" disabled={isProcessing}><Trash2 className="h-4 w-4"/></Button>
                                </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent><p>Xóa bài đăng</p></TooltipContent>
                        </Tooltip>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Xóa bài tố cáo?</AlertDialogTitle>
                                <AlertDialogDescription>Hành động này sẽ xóa vĩnh viễn bài đăng và tất cả bình luận. Không thể hoàn tác.</AlertDialogDescription>
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
                            <MessageSquare className="h-4 w-4"/>
                            <span>{report.commentCount || 0}</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Bình luận</p></TooltipContent>
                </Tooltip>
            </div>
        </CardFooter>
      </Card>
      {lightboxOpen && (
        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          slides={lightboxPhotos.map(url => ({ src: url }))}
          index={lightboxIndex}
        />
      )}

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
      />
    </TooltipProvider>
  );
}
