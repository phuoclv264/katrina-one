
'use client';

import React, { useState } from 'react';
import { useAuth, type AuthUser } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Edit, Trash2, Camera, Loader2 } from 'lucide-react';
import type { Violation, ViolationComment } from '@/lib/types';
import Image from 'next/image';
import CameraDialog from '@/components/camera-dialog';

export function CommentSection({
  violation,
  currentUser,
  onCommentSubmit,
  onCommentEdit,
  onCommentDelete,
  onOpenLightbox,
  isProcessing,
}: {
  violation: Violation;
  currentUser: AuthUser;
  onCommentSubmit: (violationId: string, commentText: string, photoIds: string[]) => void;
  onCommentEdit: (violationId: string, commentId: string, newText: string) => void;
  onCommentDelete: (violationId: string, commentId: string) => void;
  onOpenLightbox: (photos: string[], index: number) => void;
  isProcessing: boolean;
}) {
  const [commentText, setCommentText] = useState('');
  const [commentPhotoIds, setCommentPhotoIds] = useState<string[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const isOwner = currentUser.role === 'Chủ nhà hàng';

  const handleSubmit = () => {
    if (!commentText.trim() && commentPhotoIds.length === 0) return;
    onCommentSubmit(violation.id, commentText, commentPhotoIds);
    setCommentText('');
    setCommentPhotoIds([]);
  };

  const handleCapturePhotos = (media: { id: string; type: 'photo' | 'video' }[]) => {
    const photoIds = media.filter(m => m.type === 'photo').map(m => m.id);
    setCommentPhotoIds(prev => [...prev, ...photoIds]);
    setIsCameraOpen(false);
  };

  const handleEditClick = (comment: ViolationComment) => {
    setEditingCommentId(comment.id);
    setEditingText(comment.text);
  };

  const handleSaveEdit = () => {
    if (editingCommentId) {
      onCommentEdit(violation.id, editingCommentId, editingText);
      setEditingCommentId(null);
      setEditingText('');
    }
  };

  const handleOpenCommentLightbox = (photos: string[], index: number) => {
    onOpenLightbox(photos, index);
  };

  const handleDeletePreviewPhoto = (photoId: string) => {
    setCommentPhotoIds(prev => prev.filter(id => id !== photoId));
  }

  return (
    <div className="mt-4 pt-4 border-t border-dashed">
      {/* Existing Comments */}
      <div className="space-y-3 mb-4">
        {(violation.comments || []).length === 0 && !isOwner && (
          <p className="text-sm text-muted-foreground text-center py-4">Chưa có bình luận nào.</p>
        )}
        {(violation.comments || []).map(comment => {
          const isEditingThis = editingCommentId === comment.id;
          const canEditOrDelete = currentUser.uid === comment.commenterId;
          return (
            <div key={comment.id} className="bg-muted/50 p-3 rounded-md">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span className="font-bold text-foreground">{comment.commenterName}</span>
                <div className="flex items-center gap-1">
                  <span>{new Date(comment.createdAt as string).toLocaleString('vi-VN')}</span>
                  {canEditOrDelete && !isEditingThis && (
                    <div className="flex">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditClick(comment)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <AlertDialog parentDialogTag="root">
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Xóa bình luận?</AlertDialogTitle>
                            <AlertDialogDescription>Hành động này sẽ xóa vĩnh viễn bình luận này và các hình ảnh đính kèm. Không thể hoàn tác.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onCommentDelete(violation.id, comment.id)}>Xóa</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </div>
              {isEditingThis ? (
                <div className="space-y-2">
                  <Textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} rows={3} />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingCommentId(null)}>Hủy</Button>
                    <Button size="sm" onClick={handleSaveEdit}>Lưu</Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm whitespace-pre-wrap">{comment.text}</p>
                  {comment.photos && comment.photos.length > 0 && (
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {comment.photos.map((photo, index) => (
                        <button key={index} onClick={() => handleOpenCommentLightbox(comment.photos!, index)} className="relative w-16 h-16 rounded-md overflow-hidden">
                          <Image src={photo} alt={`Comment photo ${index + 1}`} fill className="object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* New Comment Form for Owner */}
      {isOwner && (
        <div className="space-y-2">
          <Textarea
            placeholder="Nhập bình luận của bạn..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            disabled={isProcessing}
          />
          {commentPhotoIds.length > 0 && <p className="text-xs text-muted-foreground">{commentPhotoIds.length} ảnh đã được chọn để đính kèm.</p>}
          <div className="flex justify-between items-center">
            <Button variant="outline" size="sm" onClick={() => setIsCameraOpen(true)} disabled={isProcessing}>
              <Camera className="mr-2 h-4 w-4" /> Đính kèm ảnh
            </Button>
            <Button onClick={handleSubmit} disabled={isProcessing || (!commentText.trim() && commentPhotoIds.length === 0)}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gửi
            </Button>
          </div>
        </div>
      )}

      <CameraDialog
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onSubmit={handleCapturePhotos}
        captureMode="photo"
        parentDialogTag="root"
      />
    </div>
  );
}
