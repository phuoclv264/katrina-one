

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth, type AuthUser } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldX, Plus, Edit, Trash2, Camera, Loader2, FilterX, BadgeInfo, CheckCircle, Eye, FilePlus2, Flag, MessageSquare, Send } from 'lucide-react';
import type { ManagedUser, Violation, ViolationCategory, ViolationUser, ViolationComment } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Image from 'next/image';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import CameraDialog from '@/components/camera-dialog';
import { Badge } from '@/components/ui/badge';
import { ViolationCategoryCombobox } from '@/components/violation-category-combobox';
import { UserMultiSelect } from '@/components/user-multi-select';
import { collection, doc, getDocs, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';


function ViolationDialog({
  open,
  onOpenChange,
  onSave,
  users,
  isProcessing,
  violationToEdit,
  reporter,
  isSelfConfession = false,
  categories,
  onCategoriesChange,
  canManageCategories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any, id?: string) => void;
  users: ManagedUser[];
  isProcessing: boolean;
  violationToEdit: Violation | null;
  reporter: AuthUser;
  isSelfConfession?: boolean;
  categories: ViolationCategory[];
  onCategoriesChange: (newCategories: ViolationCategory[]) => void;
  canManageCategories: boolean;
}) {
  const [content, setContent] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<ManagedUser[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  
  useEffect(() => {
    if (open) {
        if (violationToEdit) {
            setContent(violationToEdit.content);
            const initialUsers = (violationToEdit.users && Array.isArray(violationToEdit.users)) 
              ? users.filter(u => violationToEdit.users.some(vu => vu.id === u.uid))
              : [];
            setSelectedUsers(initialUsers);
            setSelectedCategory(violationToEdit.category);
            setPhotoIds([]);
        } else if (isSelfConfession) {
            const self = users.find(u => u.uid === reporter.uid);
            setContent('');
            setSelectedUsers(self ? [self] : []);
            setSelectedCategory('');
            setPhotoIds([]);
        } else {
            // Reset for new violation by manager
            setContent('');
            setSelectedUsers([]);
            setSelectedCategory('');
            setPhotoIds([]);
        }
    }
  }, [open, violationToEdit, isSelfConfession, reporter, users]);

  const handleSave = () => {
    if (!content || selectedUsers.length === 0 || !selectedCategory) {
      alert('Vui lòng điền đầy đủ nội dung, chọn nhân viên và loại vi phạm.');
      return;
    }
    
    const data = {
        content: content,
        category: selectedCategory,
        users: selectedUsers.map(u => ({ id: u.uid, name: u.displayName })),
        reporterId: reporter.uid,
        reporterName: reporter.displayName,
        photosToUpload: photoIds,
    };
    
    onSave(data, violationToEdit?.id);
  };
  
  const handleCapturePhotos = (capturedPhotoIds: string[]) => {
      setPhotoIds(prev => [...prev, ...capturedPhotoIds]);
      setIsCameraOpen(false);
  }

  const dialogTitle = violationToEdit ? 'Chỉnh sửa Vi phạm' : (isSelfConfession ? 'Tự ghi nhận sai sót' : 'Thêm Vi phạm mới');

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            {isSelfConfession ? 'Mô tả lại sai sót của bạn một cách trung thực.' : 'Ghi nhận lại các vấn đề hoặc sai phạm của nhân viên.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {!isSelfConfession ? (
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="user" className="text-right pt-2">
                Nhân viên
              </Label>
              <UserMultiSelect
                  users={users}
                  selectedUsers={selectedUsers}
                  onChange={setSelectedUsers}
                  disabled={isSelfConfession}
                  className="col-span-3"
              />
            </div>
          ) : (
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Nhân viên</Label>
                    <div className="col-span-3">
                        <Badge variant="secondary">{reporter.displayName}</Badge>
                    </div>
                </div>
            )}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category" className="text-right">
              Loại vi phạm
            </Label>
            <div className="col-span-3">
              <ViolationCategoryCombobox
                categories={categories}
                value={selectedCategory}
                onChange={setSelectedCategory}
                onCategoriesChange={onCategoriesChange}
                canManage={canManageCategories}
                placeholder="Chọn loại vi phạm..."
              />
            </div>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="content" className="text-right mt-2">
              Nội dung
            </Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="col-span-3"
              placeholder="Mô tả chi tiết về vi phạm..."
            />
          </div>
           <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right mt-2">Bằng chứng</Label>
                 <div className="col-span-3">
                    <Button variant="outline" onClick={() => setIsCameraOpen(true)}>
                        <Camera className="mr-2 h-4 w-4"/> Chụp ảnh
                    </Button>
                    {photoIds.length > 0 && <p className="text-sm text-muted-foreground mt-2">{photoIds.length} ảnh đã được chọn.</p>}
                 </div>
           </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={handleSave} disabled={isProcessing}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <CameraDialog
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onSubmit={handleCapturePhotos}
    />
    </>
  );
}

function CommentSection({
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

  const handleCapturePhotos = (capturedPhotoIds: string[]) => {
    setCommentPhotoIds(prev => [...prev, ...capturedPhotoIds]);
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
                        <AlertDialog>
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
                    {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Gửi
                </Button>
            </div>
        </div>
      )}
      
      <CameraDialog
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onSubmit={handleCapturePhotos}
      />
    </div>
  );
}


export default function ViolationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [violations, setViolations] = useState<Violation[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [categories, setCategories] = useState<ViolationCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingViolationId, setProcessingViolationId] = useState<string | null>(null);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSelfConfessMode, setIsSelfConfessMode] = useState(false);
  const [violationToEdit, setViolationToEdit] = useState<Violation | null>(null);
  
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSlides, setLightboxSlides] = useState<{ src: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [isPenaltyCameraOpen, setIsPenaltyCameraOpen] = useState(false);
  const [activeViolationForPenalty, setActiveViolationForPenalty] = useState<Violation | null>(null);

  const [openCommentSectionId, setOpenCommentSectionId] = useState<string | null>(null);

  // --- Back button handling for Lightbox ---
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (lightboxOpen) {
        event.preventDefault();
        setLightboxOpen(false);
      }
    };

    if (lightboxOpen) {
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [lightboxOpen]);


  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const unsubViolations = dataStore.subscribeToViolations(setViolations);
    const unsubUsers = dataStore.subscribeToUsers(setUsers);
    const unsubCategories = dataStore.subscribeToViolationCategories(setCategories);
    
    Promise.all([
        getDocs(collection(db, 'violations')),
        getDocs(collection(db, 'users')),
        getDoc(doc(db, 'app-data', 'violationCategories')),
    ]).then(() => setIsLoading(false));
        
    return () => {
        unsubViolations();
        unsubUsers();
        unsubCategories();
    };
  }, [user]);

  const handleSaveViolation = async (data: any, id?: string) => {
    setIsProcessing(true);
    try {
        await dataStore.addOrUpdateViolation(data, id);
        toast({ title: 'Thành công', description: 'Đã lưu lại vi phạm.' });
        setIsDialogOpen(false);
        setViolationToEdit(null);
    } catch(error) {
        console.error("Failed to save violation:", error);
        toast({ title: 'Lỗi', description: 'Không thể lưu vi phạm.', variant: 'destructive' });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleCategoriesChange = async (newCategories: ViolationCategory[]) => {
    await dataStore.updateViolationCategories(newCategories);
  };

  const handleDeleteViolation = async (violation: Violation) => {
    setIsProcessing(true);
    try {
        await dataStore.deleteViolation(violation);
        toast({ title: 'Đã xóa', description: 'Đã xóa ghi nhận vi phạm.' });
    } catch (error) {
        console.error("Failed to delete violation:", error);
        toast({ title: 'Lỗi', description: 'Không thể xóa vi phạm.', variant: 'destructive' });
    } finally {
        setIsProcessing(false);
    }
  };

    const handleToggleFlag = async (violation: Violation) => {
        if (user?.role !== 'Chủ nhà hàng') return;
        setProcessingViolationId(violation.id);
        try {
            await dataStore.toggleViolationFlag(violation.id, !!violation.isFlagged);
            toast({
                title: 'Thành công',
                description: violation.isFlagged ? 'Đã bỏ gắn cờ vi phạm.' : 'Đã gắn cờ vi phạm.',
            });
        } catch (error) {
            console.error("Failed to toggle flag:", error);
            toast({ title: 'Lỗi', description: 'Không thể thay đổi trạng thái gắn cờ.', variant: 'destructive' });
        } finally {
            setProcessingViolationId(null);
        }
    };
    
    const handleToggleWaivePenalty = async (violation: Violation) => {
        if (user?.role !== 'Chủ nhà hàng') return;
        setProcessingViolationId(violation.id);
        try {
            await dataStore.toggleViolationPenaltyWaived(violation.id, !!violation.isPenaltyWaived);
            toast({
                title: 'Thành công',
                description: violation.isPenaltyWaived ? 'Đã hủy miễn phạt.' : 'Đã miễn phạt cho vi phạm này.',
            });
        } catch (error) {
            console.error("Failed to waive penalty:", error);
            toast({ title: 'Lỗi', description: 'Không thể thay đổi trạng thái miễn phạt.', variant: 'destructive' });
        } finally {
            setProcessingViolationId(null);
        }
    }

    const handleCommentSubmit = async (violationId: string, commentText: string, photoIds: string[]) => {
      if (!user) return;
      setProcessingViolationId(violationId);
      try {
        const commentData = {
          commenterId: user.uid,
          commenterName: user.displayName,
          text: commentText,
        };
        await dataStore.addCommentToViolation(violationId, commentData, photoIds);
        toast({ title: 'Đã gửi bình luận' });
      } catch (error) {
        console.error("Failed to submit comment:", error);
        toast({ title: 'Lỗi', description: 'Không thể gửi bình luận.', variant: 'destructive' });
      } finally {
        setProcessingViolationId(null);
      }
    };

    const handleCommentEdit = async (violationId: string, commentId: string, newText: string) => {
        setProcessingViolationId(violationId);
        try {
            await dataStore.editCommentInViolation(violationId, commentId, newText);
            toast({ title: 'Đã cập nhật bình luận' });
        } catch (error) {
            console.error("Failed to edit comment:", error);
            toast({ title: 'Lỗi', description: 'Không thể cập nhật bình luận.', variant: 'destructive' });
        } finally {
            setProcessingViolationId(null);
        }
    };

    const handleCommentDelete = async (violationId: string, commentId: string) => {
        setProcessingViolationId(violationId);
        try {
            await dataStore.deleteCommentInViolation(violationId, commentId);
            toast({ title: 'Đã xóa bình luận' });
        } catch (error) {
            console.error("Failed to delete comment:", error);
            toast({ title: 'Lỗi', description: 'Không thể xóa bình luận.', variant: 'destructive' });
        } finally {
            setProcessingViolationId(null);
        }
    };
  
    const handlePenaltySubmit = async (photoIds: string[]) => {
        setIsPenaltyCameraOpen(false);
        if (!activeViolationForPenalty || photoIds.length === 0) {
            return;
        }
        
        setProcessingViolationId(activeViolationForPenalty.id);
        const violationId = activeViolationForPenalty.id;
        toast({ title: 'Đang xử lý...', description: 'Bằng chứng nộp phạt đang được tải lên.' });

        try {
            const newPhotoUrls = await dataStore.submitPenaltyProof(violationId, photoIds);
            
            setViolations(prevViolations => 
                prevViolations.map(v => {
                    if (v.id === violationId) {
                         const existingPhotos = v.penaltyPhotos || [];
                         const updatedPhotos = Array.from(new Set([...existingPhotos, ...newPhotoUrls]));
                        return {
                            ...v, 
                            penaltyPhotos: updatedPhotos,
                            penaltySubmittedAt: new Date().toISOString() 
                        };
                    }
                    return v;
                })
            );

            toast({ title: 'Thành công', description: 'Đã cập nhật bằng chứng nộp phạt.' });
        } catch (error) {
            console.error("Failed to submit penalty proof:", error);
            toast({ title: 'Lỗi', description: 'Không thể gửi bằng chứng nộp phạt.', variant: 'destructive' });
        } finally {
            setProcessingViolationId(null);
            setActiveViolationForPenalty(null);
        }
    };

  const filteredViolations = useMemo(() => {
      let result = violations;
      if (filterUserId) {
        result = result.filter(v => v.users.some(vu => vu.id === filterUserId));
      }
      if(filterCategory) {
          result = result.filter(v => v.category === filterCategory);
      }
      return result;
  }, [violations, filterUserId, filterCategory]);

  const groupedViolations = useMemo(() => {
      return filteredViolations.reduce((acc, violation) => {
          const monthKey = new Date(violation.createdAt as string).toLocaleString('vi-VN', { month: '2-digit', year: 'numeric' });
          if (!acc[monthKey]) {
              acc[monthKey] = [];
          }
          acc[monthKey].push(violation);
          return acc;
      }, {} as {[key: string]: Violation[]});
  }, [filteredViolations]);

  const canManage = user?.role === 'Quản lý' || user?.role === 'Chủ nhà hàng';
  const isOwner = user?.role === 'Chủ nhà hàng';
  const pageTitle = canManage ? 'Ghi nhận Vi phạm' : 'Danh sách Vi phạm';

  const openAddDialog = (isSelfConfession: boolean) => {
    setViolationToEdit(null);
    setIsSelfConfessMode(isSelfConfession);
    setIsDialogOpen(true);
  }
  
  const openLightbox = (photos: string[], index: number) => {
      setLightboxSlides(photos.map(p => ({ src: p })));
      setLightboxIndex(index);
      setLightboxOpen(true);
  };
  
  const toggleCommentSection = (violationId: string) => {
      setOpenCommentSectionId(prevId => prevId === violationId ? null : violationId);
  }

  if (isLoading || authLoading || !user) {
    return (
      <div className="container mx-auto p-4 sm:p-6 md:p-8">
        <Skeleton className="h-10 w-1/2 mb-2" />
        <Skeleton className="h-4 w-1/3 mb-8" />
        <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto p-4 sm:p-6 md:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
            <ShieldX /> {pageTitle}
          </h1>
          <p className="text-muted-foreground mt-2">
            Theo dõi và quản lý các vấn đề liên quan đến nhân viên.
          </p>
        </header>

        <Card>
           <CardHeader>
              <CardTitle>Danh sách Vi phạm</CardTitle>
              <CardDescription>
                Các ghi nhận gần đây nhất sẽ được hiển thị ở đầu.
              </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-4">
                    <Select value={filterUserId || 'all'} onValueChange={(val) => setFilterUserId(val === 'all' ? null : val)}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Lọc theo nhân viên..."/>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tất cả nhân viên</SelectItem>
                            {users.map(u => (
                                <SelectItem key={u.uid} value={u.uid}>{u.displayName}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <ViolationCategoryCombobox
                        categories={categories}
                        value={filterCategory || ''}
                        onChange={(val) => setFilterCategory(val || null)}
                        onCategoriesChange={handleCategoriesChange}
                        canManage={user.role === 'Chủ nhà hàng'}
                        placeholder="Lọc theo loại vi phạm..."
                    />
                    <div className="col-start-1 sm:col-start-4 sm:col-span-1">
                        {!canManage && (
                        <Button variant="secondary" onClick={() => openAddDialog(true)} className="w-full">
                            <BadgeInfo className="mr-2 h-4 w-4" /> Tự thú
                        </Button>
                        )}
                        {canManage && (
                        <Button onClick={() => openAddDialog(false)} className="w-full">
                            <Plus className="mr-2 h-4 w-4" /> Thêm mới
                        </Button>
                        )}
                    </div>
                 </div>
          </CardContent>
          <CardContent>
            {Object.keys(groupedViolations).length === 0 ? (
                <div className="text-center py-16 text-muted-foreground flex flex-col items-center gap-4">
                    <FilterX className="h-12 w-12"/>
                    <p>Không tìm thấy vi phạm nào khớp với bộ lọc.</p>
                </div>
            ) : (
                <Accordion type="multiple" defaultValue={Object.keys(groupedViolations)} className="space-y-4">
                {Object.entries(groupedViolations).map(([month, violationsInMonth]) => (
                    <AccordionItem key={month} value={month}>
                        <AccordionTrigger className="text-lg font-medium">Tháng {month}</AccordionTrigger>
                        <AccordionContent className="space-y-4">
                            {violationsInMonth.map(v => {
                                const canSubmitPenalty = canManage || (v.users && v.users.some(vu => vu.id === user.uid));
                                const userNames = v.users ? v.users.map(u => u.name).join(', ') : '';
                                const isItemProcessing = processingViolationId === v.id;
                                const showCommentButton = isOwner || (v.comments && v.comments.length > 0);
                                const isWaived = v.isPenaltyWaived === true;

                                let borderClass = "border-primary/50";
                                let bgClass = "bg-card";
                                if (v.isFlagged) {
                                    borderClass = "border-red-500/30";
                                    bgClass = "bg-red-500/10";
                                } else if (isWaived) {
                                    borderClass = "border-green-500/30";
                                    bgClass = "bg-green-500/10";
                                }


                                return (
                                <div key={v.id} className={cn("border-2 rounded-lg p-4 relative shadow-sm", borderClass, bgClass)}>
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-semibold">{userNames}</p>
                                            <Badge>{v.category || 'Khác'}</Badge>
                                            {v.users && v.users.length === 1 && v.users[0].id === v.reporterId && (
                                                <Badge variant="outline" className="border-green-500 text-green-600">Tự thú</Badge>
                                            )}
                                        </div>
                                         <div className="flex gap-1 self-end sm:self-start">
                                            {isOwner && (
                                                <>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleWaivePenalty(v)} disabled={isItemProcessing}>
                                                        <Flag className={cn("h-4 w-4", isWaived ? "text-green-500 fill-green-500" : "text-muted-foreground")} />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleFlag(v)} disabled={isItemProcessing}>
                                                        <Flag className={cn("h-4 w-4", v.isFlagged ? "text-red-500 fill-red-500" : "text-muted-foreground")} />
                                                    </Button>
                                                </>
                                            )}
                                            {canManage && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViolationToEdit(v); setIsSelfConfessMode(false); setIsDialogOpen(true); }}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            )}
                                            {isOwner && (
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Xóa vi phạm?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể được hoàn tác.</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteViolation(v)}>Xóa</AlertDialogAction></AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Ghi nhận bởi: {v.reporterName} lúc {new Date(v.createdAt as string).toLocaleString('vi-VN', {hour12: false})}
                                    </p>
                                    <p className="mt-2 text-sm whitespace-pre-wrap">{v.content}</p>
                                    {v.photos && v.photos.length > 0 && (
                                        <div className="mt-2 flex gap-2 flex-wrap">
                                            {v.photos.map((photo, index) => (
                                                <button key={index} onClick={() => openLightbox(v.photos, index)} className="relative w-20 h-20 rounded-md overflow-hidden">
                                                    <Image src={photo} alt={`Evidence ${index + 1}`} fill className="object-cover" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                     <div className="mt-4 pt-4 border-t flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            {isWaived ? (
                                                <div className="text-sm text-green-600 font-semibold flex items-center gap-2">
                                                    <CheckCircle className="h-4 w-4" />
                                                    <span>Đã được miễn phạt.</span>
                                                </div>
                                            ) : v.penaltyPhotos && v.penaltyPhotos.length > 0 ? (
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
                                                    <div className="text-sm text-green-600 font-semibold flex items-center gap-2">
                                                        <CheckCircle className="h-4 w-4" />
                                                        <span>Đã nộp phạt lúc {v.penaltySubmittedAt ? new Date(v.penaltySubmittedAt as string).toLocaleString('vi-VN', {hour12: false}) : 'Không rõ'}</span>
                                                    </div>
                                                    <div className="flex gap-2 flex-wrap">
                                                      <Button size="sm" variant="secondary" onClick={() => openLightbox(v.penaltyPhotos!, 0)}>
                                                          <Eye className="mr-2 h-4 w-4" />
                                                          Xem ({v.penaltyPhotos.length})
                                                      </Button>
                                                      {canSubmitPenalty && (
                                                          <Button size="sm" variant="outline" onClick={() => { setActiveViolationForPenalty(v); setIsPenaltyCameraOpen(true); }}>
                                                              <FilePlus2 className="mr-2 h-4 w-4" />
                                                              Bổ sung
                                                          </Button>
                                                      )}
                                                    </div>
                                                </div>
                                            ) : (
                                                canSubmitPenalty && (
                                                    <Button size="sm" onClick={() => { setActiveViolationForPenalty(v); setIsPenaltyCameraOpen(true); }}>
                                                        Nộp phạt
                                                    </Button>
                                                )
                                            )}
                                        </div>
                                        {showCommentButton && (
                                            <Button variant="ghost" size="sm" onClick={() => toggleCommentSection(v.id)}>
                                                <MessageSquare className="mr-2 h-4 w-4"/>
                                                {openCommentSectionId === v.id ? 'Đóng' : `Bình luận (${(v.comments || []).length})`}
                                            </Button>
                                        )}
                                    </div>
                                    {openCommentSectionId === v.id && (
                                        <CommentSection
                                            violation={v}
                                            currentUser={user}
                                            onCommentSubmit={handleCommentSubmit}
                                            onCommentEdit={handleCommentEdit}
                                            onCommentDelete={handleCommentDelete}
                                            onOpenLightbox={openLightbox}
                                            isProcessing={isItemProcessing}
                                        />
                                    )}

                                    {isItemProcessing && (
                                        <div className="absolute inset-0 bg-white/70 dark:bg-black/70 flex items-center justify-center rounded-lg">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                        </div>
                                    )}
                                </div>
                                )
                            })}
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
            )}
          </CardContent>
        </Card>
      </div>

      {user && (
          <ViolationDialog 
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            onSave={handleSaveViolation}
            users={users}
            isProcessing={isProcessing}
            violationToEdit={violationToEdit}
            reporter={user}
            isSelfConfession={isSelfConfessMode}
            categories={categories}
            onCategoriesChange={handleCategoriesChange}
            canManageCategories={user.role === 'Chủ nhà hàng'}
          />
      )}
      
       <CameraDialog
        isOpen={isPenaltyCameraOpen}
        onClose={() => setIsPenaltyCameraOpen(false)}
        onSubmit={handlePenaltySubmit}
      />

        <Lightbox
            open={lightboxOpen}
            close={() => setLightboxOpen(false)}
            index={lightboxIndex}
            slides={lightboxSlides}
        />
    </>
  );
}
