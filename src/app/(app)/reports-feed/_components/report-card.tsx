'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, ThumbsDown, MessageSquare, Eye, EyeOff, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WhistleblowingReport, AuthUser, ManagedUser, ReportComment } from '@/lib/types';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Image from 'next/image';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import CommentDialog from './comment-dialog';
import { toast } from 'react-hot-toast';


export default function ReportCard({
  report,
  currentUser,
  allUsers,
  onVote,
  onDelete,
  onCommentSubmit,
  onCommentEdit,
  onCommentDelete,
}: {
  report: WhistleblowingReport;
  currentUser: AuthUser;
  allUsers: ManagedUser[];
  onVote: (reportId: string, voteType: 'up' | 'down') => Promise<void>;
  onDelete: (reportId: string) => void;
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
      // After vote, determine the new state and show toast
      const currentlyVotedUp = report.upvotes?.includes(currentUser.uid);
      const currentlyVotedDown = report.downvotes?.includes(currentUser.uid);

      if (voteType === 'up') {
        if (currentlyVotedUp) {
          toast.success(`Bạn đã bỏ đồng tình với bài đăng "${report.title}"`);
        } else {
          toast.success(`Bạn đã đồng tình với bài đăng "${report.title}"`);
        }
      } else if (voteType === 'down') {
        if (currentlyVotedDown) {
          toast.success(`Bạn đã bỏ không đồng tình với bài đăng "${report.title}"`);
        } else {
          toast.success(`Bạn đã không đồng tình với bài đăng "${report.title}"`);
        }
      }
    } catch (error) {
      toast.error('Thao tác thất bại.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleCommentDialogSubmit = async (reportId: string, commentText: string, photoIds: string[], isAnonymous: boolean) => {
    setIsProcessing(true);
    try {
        await onCommentSubmit(reportId, commentText, photoIds, isAnonymous);
    } finally {
        setIsProcessing(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start gap-4">
            <CardTitle>{report.title}</CardTitle>
            <div className="flex items-center gap-2">
                {report.reporterId === currentUser.uid && (
                    <Badge variant="outline" className="border-primary text-primary">Bài đăng của bạn</Badge>
                )}
                {report.visibility === 'private' ? (
                    <Badge variant="secondary"><EyeOff className="mr-1 h-3 w-3"/> Riêng tư</Badge>
                ) : (
                    <Badge variant="secondary"><Eye className="mr-1 h-3 w-3"/> Công khai</Badge>
                )}
            </div>
          </div>
          <CardDescription>
            Đăng bởi <span className="font-semibold">{report.isAnonymous ? (report.anonymousNameMap?.[report.reporterId] || 'Ẩn danh') : allUsers.find(u => u.uid === report.reporterId)?.displayName || 'Không rõ'}</span> lúc {new Date(report.createdAt as any).toLocaleString('vi-VN')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
             {report.accusedUsers && report.accusedUsers.length > 0 && (
                <div>
                    <Label className="text-xs font-semibold">Người bị tố cáo</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                        {report.accusedUsers.map(user => (
                            <Badge key={user.id} variant="destructive">{user.name}</Badge>
                        ))}
                    </div>
                </div>
             )}

            <div className="space-y-2">
                 <Label className="text-xs font-semibold">Nội dung</Label>
                <div className={cn("text-sm whitespace-pre-wrap", !isExpanded && "line-clamp-3")}>
                    {report.content}
                </div>
                 {report.content.length > 200 && (
                     <Button variant="link" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="p-0 h-auto">
                        {isExpanded ? 'Thu gọn' : 'Xem thêm'}
                    </Button>
                 )}
            </div>
            
            {report.attachments && report.attachments.length > 0 && (
                <div>
                     <Label className="text-xs font-semibold">Đính kèm</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                        {report.attachments.map((url, index) => (
                             <button key={url} onClick={() => openLightbox(report.attachments!, index)} className="relative w-20 h-20 rounded-md overflow-hidden">
                                <Image src={url} alt={`Attachment ${index + 1}`} fill className="object-cover" />
                             </button>
                        ))}
                    </div>
                </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="justify-between">
           <div className="flex gap-2">
             <Button variant={hasVotedUp ? "default" : "outline"} size="sm" onClick={() => handleVote('up')} disabled={isProcessing}>
                <ThumbsUp className="mr-1 h-3 w-3"/>({report.upvotes?.length || 0})
            </Button>
            <Button variant={hasVotedDown ? "destructive" : "outline"} size="sm" onClick={() => handleVote('down')} disabled={isProcessing}>
                <ThumbsDown className="mr-1 h-3 w-3"/>({report.downvotes?.length || 0})
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsCommentDialogOpen(true)}>
                <MessageSquare className="mr-1 h-2 w-3"/>({report.commentCount || 0})
            </Button>
           </div>
            {currentUser.role === 'Chủ nhà hàng' && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-2 w-2"/></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Xóa bài tố cáo?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(report.id)}>Xóa</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
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
    </>
  );
}
