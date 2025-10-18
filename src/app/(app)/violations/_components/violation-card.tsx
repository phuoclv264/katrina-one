'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Edit, Trash2, Eye, FilePlus2, Flag, MessageSquare, Loader2, CheckCircle } from 'lucide-react';
import type { Violation, ViolationCategory, ViolationUser, ViolationComment, ViolationCategoryData, PenaltySubmission, ManagedUser, MediaAttachment } from '@/lib/types';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { useAuth, type AuthUser } from '@/hooks/use-auth';
import { getSeverityBadgeClass, getSeverityCardClass, getSeverityBorderClass } from '@/lib/violations-utils';
import { CommentSection } from './comment-section';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Video from "yet-another-react-lightbox/plugins/video";

interface ViolationCardProps {
  violation: Violation;
  currentUser: AuthUser;
  categoryData: ViolationCategoryData;
  userAbbreviations: Map<string, string>;
  processingViolationId: string | null;
  openCommentSectionIds: Set<string>;
  onToggleFlag: (violation: Violation) => void;
  onToggleWaivePenalty: (violation: Violation) => void;
  onEdit: (violation: Violation) => void;
  onDelete: (violation: Violation) => void;
  onPenaltySubmit: (violation: Violation, user: ViolationUser) => void;
  onCommentSubmit: (violationId: string, commentText: string, photoIds: string[]) => void;
  onCommentEdit: (violationId: string, commentId: string, newText: string) => void;
  onCommentDelete: (violationId: string, commentId: string) => void;
  onToggleCommentSection: (violationId: string) => void;
  setActiveViolationForPenalty: (violation: Violation | null) => void;
  setActiveUserForPenalty: (user: ViolationUser | null) => void;
  setIsPenaltyCameraOpen: (isOpen: boolean) => void;
}

export function ViolationCard({ 
    violation: v, 
    currentUser: user, 
    categoryData, 
    userAbbreviations, 
    processingViolationId, 
    openCommentSectionIds, 
    onToggleFlag, 
    onToggleWaivePenalty, 
    onEdit, 
    onDelete, 
    onPenaltySubmit, 
    onCommentSubmit, 
    onCommentEdit, 
    onCommentDelete, 
    onToggleCommentSection,
    setActiveViolationForPenalty,
    setActiveUserForPenalty,
    setIsPenaltyCameraOpen
}: ViolationCardProps) {
    const [lightboxOpen, setLightboxOpen] = React.useState(false);
    const [lightboxSlides, setLightboxSlides] = React.useState<{ src: string; type?: 'image' | 'video'; sources?: { src: string; type: string; }[] }[]>([]);
    const [lightboxIndex, setLightboxIndex] = React.useState(0);

    const openLightbox = (media: (string | MediaAttachment)[], index: number) => {
        const slides = media.map(item => {
            const url = typeof item === 'string' ? item : item.url;
            const type = typeof item === 'string' ? (url.toLowerCase().includes('.webm') || url.toLowerCase().includes('.mp4') ? 'video' : 'photo') : item.type;

            if (type === 'video') {
                return {
                    type: 'video' as const,
                    sources: [
                        {
                            src: url,
                            type: url.toLowerCase().includes('.webm') ? 'video/webm' : 'video/mp4',
                        },
                    ],
                    src: ''
                };
            }
            return { src: url, type: 'image' as const };
        });
        setLightboxSlides(slides);
        setLightboxIndex(index);
        setLightboxOpen(true);
    };

    const isItemProcessing = processingViolationId === v.id;
    const isOwner = user?.role === 'Chủ nhà hàng';
    const showCommentButton = isOwner || (v.comments && v.comments.length > 0);
    const isWaived = v.isPenaltyWaived === true;
    const currentCategory = categoryData.list.find(c => c.id === v.categoryId);
    const categoryDisplayName = currentCategory ? currentCategory.name : v.categoryName;
    
    const userPenaltyDetails = (v.userCosts || v.users.map(u => ({ userId: u.id, cost: (v.cost || 0) / v.users.length })))
        .map(uc => {
            const userAbbr = userAbbreviations.get(uc.userId) || 'N/A';
            return `${userAbbr}: ${(uc.cost || 0).toLocaleString('vi-VN')}đ`;
        }).join(', ');
    
    const cardBorderColor = v.isFlagged ? 'border-red-500/50 ring-2 ring-red-500/20' : (isWaived ? 'border-green-500/50 ring-2 ring-green-500/20' : getSeverityBorderClass(v.severity));
    const cardBgColor = v.isFlagged ? 'bg-red-500/5' : (isWaived ? 'bg-green-500/5' : getSeverityCardClass(v.severity));

    return (
    <Card key={v.id} className={cn("relative shadow-sm", cardBorderColor, cardBgColor)}>
        <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                {/* Left side: Users & Category */}
                <div className="flex-1">
                    <p className="font-semibold">{v.users.map(u => u.name).join(', ')}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                        <Badge className={getSeverityBadgeClass(v.severity)}>{categoryDisplayName || 'Khác'}</Badge>
                        {v.users.length === 1 && v.users[0].id === v.reporterId && (
                            <Badge variant="outline" className="border-green-500 text-green-600">Tự thú</Badge>
                        )}
                    </div>
                </div>
                
                {/* Right side: Actions */}
                 <div className="flex gap-1 self-start sm:self-center mt-2 sm:mt-0 flex-wrap">
                    {isOwner && (
                        <>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onToggleWaivePenalty(v)} disabled={isItemProcessing}>
                                <Flag className={cn("h-4 w-4", isWaived ? "text-green-500 fill-green-500" : "text-green-500")} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onToggleFlag(v)} disabled={isItemProcessing}>
                                <Flag className={cn("h-4 w-4", v.isFlagged ? "text-red-500 fill-red-500" : "text-red-500")} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(v)}>
                                <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Xóa vi phạm?</AlertDialogTitle>
                                        <AlertDialogDescription>Hành động này không thể được hoàn tác.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onDelete(v)}>Xóa</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </>
                    )}
                </div>
            </div>

            <p className="mt-3 text-base whitespace-pre-wrap font-medium">{v.content}</p>
            
            <p className={cn("mt-2 font-bold text-lg", isWaived ? "text-green-600 line-through" : "text-destructive")}>
                Tổng phạt: {(v.cost || 0).toLocaleString('vi-VN')}đ
                {v.users.length > 1 && (
                    <span className="text-xs font-normal text-muted-foreground ml-2">({userPenaltyDetails})</span>
                )}
            </p>
            
            {v.photos && v.photos.length > 0 && (
                <div className="mt-2 flex gap-2 flex-wrap">
                    {v.photos.map((photo, index) => (
                        <button key={index} onClick={() => openLightbox(v.photos, index)} className="relative w-20 h-20 rounded-md overflow-hidden">
                            <Image src={photo} alt={`Evidence ${index + 1}`} fill className="object-cover" />
                        </button>
                    ))}
                </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
                Ghi nhận bởi: {v.reporterName} lúc {new Date(v.createdAt as string).toLocaleString('vi-VN', {hour12: false})}
            </p>
            <div className="mt-4 pt-4 border-t space-y-4">
                {v.users.map((violatedUser) => {
                    const submission = (v.penaltySubmissions || []).find(s => s.userId === violatedUser.id);
                    const isCurrentUserTheViolator = user.uid === violatedUser.id;
                    const shouldShowActions = isCurrentUserTheViolator || isOwner;

                    if (isWaived) {
                        return (
                            <div key={violatedUser.id} className="text-sm text-green-600 font-semibold flex items-center gap-2">
                                <CheckCircle className="h-4 w-4" />
                                <span>{violatedUser.name} đã được miễn phạt.</span>
                            </div>
                        )
                    }

                    if (submission) {
                        const submissionMedia = submission.media || submission.photos || [];
                        return (
                            <div key={violatedUser.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div className="text-sm text-green-600 font-semibold flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4" />
                                    <span>{violatedUser.name} đã nộp phạt lúc {submission.submittedAt ? new Date(submission.submittedAt as string).toLocaleString('vi-VN', {hour12: false}) : 'Không rõ'}</span>
                                </div>
                                {shouldShowActions && (
                                    <div className="flex gap-2 self-start sm:self-center">
                                        {submissionMedia.length > 0 && <Button size="sm" variant="secondary" onClick={() => openLightbox(submissionMedia, 0)}><Eye className="mr-2 h-4 w-4" />Xem ({submissionMedia.length})</Button>}
                                        <Button size="sm" variant="outline" onClick={() => { setActiveViolationForPenalty(v); setActiveUserForPenalty(violatedUser); setIsPenaltyCameraOpen(true); }}><FilePlus2 className="mr-2 h-4 w-4" />Bổ sung</Button>
                                    </div>
                                )}
                            </div>
                        );
                    }
                    
                    if (shouldShowActions) {
                        return (
                            <div key={violatedUser.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                 <p className="font-semibold text-sm">{violatedUser.name}: Chưa nộp phạt.</p>
                                <Button size="sm" onClick={() => { setActiveViolationForPenalty(v); setActiveUserForPenalty(violatedUser); setIsPenaltyCameraOpen(true); }} className="w-full sm:w-auto">
                                    Xác nhận đã nộp phạt
                                </Button>
                            </div>
                        );
                    }
                    return null;
                })}
            </div>
            {showCommentButton && (
                <div className="mt-4 pt-4 border-t">
                    <Button variant="ghost" size="sm" onClick={() => onToggleCommentSection(v.id)}>
                        <MessageSquare className="mr-2 h-4 w-4"/>
                        {openCommentSectionIds.has(v.id) ? 'Đóng' : `Bình luận (${(v.comments || []).length})`}
                    </Button>
                </div>
            )}
            {openCommentSectionIds.has(v.id) && (
                <CommentSection
                    violation={v}
                    currentUser={user}
                    onCommentSubmit={onCommentSubmit}
                    onCommentEdit={onCommentEdit}
                    onCommentDelete={onCommentDelete}
                    onOpenLightbox={openLightbox}
                    isProcessing={isItemProcessing}
                />
            )}
            {isItemProcessing && (
                <div className="absolute inset-0 bg-white/70 dark:bg-black/70 flex items-center justify-center rounded-lg">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            )}
        </CardContent>
        {lightboxOpen && (
            <Lightbox
                open={lightboxOpen}
                close={() => setLightboxOpen(false)}
                slides={lightboxSlides}
                index={lightboxIndex}
                plugins={[Video]}
            />
        )}
    </Card>
    )
}
