'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldX, Plus, FilterX, BadgeInfo, Settings } from 'lucide-react';
import type { ManagedUser, Violation, ViolationCategory, ViolationUser, ViolationCategoryData, MediaAttachment } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Video from "yet-another-react-lightbox/plugins/video";
import CameraDialog from '@/components/camera-dialog';
import { ViolationCategoryCombobox } from '@/components/violation-category-combobox';
import { collection, doc, getDocs, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import ViolationCategoryManagementDialog from './_components/violation-category-management-dialog';
import ViolationInfoDialog from './_components/violation-info-dialog';
import { ViolationDialog } from './_components/violation-dialog';
import { ViolationCard } from './_components/violation-card';
import { generateSmartAbbreviations } from '@/lib/violations-utils';

/**
 * Type guard to check if an item is a MediaAttachment.
 */
function isMediaAttachment(item: any): item is MediaAttachment {
    return typeof item === 'object' && item !== null && 
           typeof item.url === 'string' && 
           (item.type === 'photo' || item.type === 'video');
}

export default function ViolationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [violations, setViolations] = useState<Violation[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [categoryData, setCategoryData] = useState<ViolationCategoryData>({ list: [], generalRules: []});
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingViolationId, setProcessingViolationId] = useState<string | null>(null);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [isSelfConfessMode, setIsSelfConfessMode] = useState(false);
  const [violationToEdit, setViolationToEdit] = useState<Violation | null>(null);
  
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [filterCategoryName, setFilterCategoryName] = useState<string>('');
  
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSlides, setLightboxSlides] = useState<({ src: string; type?: 'image' } | { type: 'video'; sources: { src: string; type: string; }[] })[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [isPenaltyCameraOpen, setIsPenaltyCameraOpen] = useState(false);
  const [activeViolationForPenalty, setActiveViolationForPenalty] = useState<Violation | null>(null);
  const [activeUserForPenalty, setActiveUserForPenalty] = useState<ViolationUser | null>(null);
  const [penaltyCaptureMode, setPenaltyCaptureMode] = useState<'photo' | 'video' | 'both'>('photo');


  const [openCommentSectionIds, setOpenCommentSectionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (searchParams.get('lightbox') === 'true') {
        setLightboxOpen(true);
    } else {
        setLightboxOpen(false);
    }
  }, [searchParams]);


  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const unsubViolations = dataStore.subscribeToViolations(setViolations);
    const unsubUsers = dataStore.subscribeToUsers(setUsers);
    const unsubCategories = dataStore.subscribeToViolationCategories(setCategoryData);
    
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

  useEffect(() => {
    if (user && user.role !== 'Chủ nhà hàng' && violations.length > 0) {
      const newOpenIds = new Set<string>();
      violations.forEach(v => {
        if (v.comments && v.comments.length > 0) {
          newOpenIds.add(v.id);
        }
      });
      setOpenCommentSectionIds(newOpenIds);
    }
  }, [violations, user]);

  const displayUsers = useMemo(() => {
    if (!user || !users) return [];
    if (user.role === 'Chủ nhà hàng' || user.displayName.includes("Không chọn")) {
      return users;
    }
    // For manager, filter out Owner and "Không chọn"
    return users.filter(u => u.role !== 'Chủ nhà hàng' && !u.displayName.includes("Không chọn"));
  }, [user, users]);

  const handleSaveViolation = async (data: any, id?: string) => {
    setIsProcessing(true);
    try {
        await dataStore.addOrUpdateViolation(data, id);
        toast.success('Đã lưu lại vi phạm.');
        setIsDialogOpen(false);
        setViolationToEdit(null);
    } catch(error) {
        console.error("Failed to save violation:", error);
        toast.error('Không thể lưu vi phạm.');
    } finally {
        setIsProcessing(false);
    }
  };

  const handleCategoriesChange = async (newCategories: ViolationCategory[]) => {
    await dataStore.updateViolationCategories({ list: newCategories });
  };

  const handleDeleteViolation = async (violation: Violation) => {
    setProcessingViolationId(violation.id);
    try {
        await dataStore.deleteViolation(violation);
        toast.success('Đã xóa ghi nhận vi phạm.');
    } catch (error) {
        console.error("Failed to delete violation:", error);
        toast.error('Không thể xóa vi phạm.');
    } finally {
        setProcessingViolationId(null);
    }
  };

    const handleToggleFlag = async (violation: Violation) => {
        if (user?.role !== 'Chủ nhà hàng') return;
        setProcessingViolationId(violation.id);
        try {
            await dataStore.toggleViolationFlag(violation.id, !!violation.isFlagged);
            toast.success(violation.isFlagged ? 'Đã bỏ gắn cờ vi phạm.' : 'Đã gắn cờ vi phạm.');
        } catch (error) {
            console.error("Failed to toggle flag:", error);
            toast.error('Không thể thay đổi trạng thái gắn cờ.');
        } finally {
            setProcessingViolationId(null);
        }
    };
    
    const handleToggleWaivePenalty = async (violation: Violation) => {
        if (user?.role !== 'Chủ nhà hàng') return;
        setProcessingViolationId(violation.id);
        try {
            await dataStore.toggleViolationPenaltyWaived(violation.id, !!violation.isPenaltyWaived);
            toast.success(violation.isPenaltyWaived ? 'Đã hủy miễn phạt.' : 'Đã miễn phạt cho vi phạm này.');
        } catch (error) {
            console.error("Failed to waive penalty:", error);
            toast.error('Không thể thay đổi trạng thái miễn phạt.');
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
        toast.success('Đã gửi bình luận');
      } catch (error) {
        console.error("Failed to submit comment:", error);
        toast.error('Không thể gửi bình luận.');
      } finally {
        setProcessingViolationId(null);
      }
    };

    const handleCommentEdit = async (violationId: string, commentId: string, newText: string) => {
        setProcessingViolationId(violationId);
        try {
            await dataStore.editCommentInViolation(violationId, commentId, newText);
            toast.success('Đã cập nhật bình luận');
        } catch (error) {
            console.error("Failed to edit comment:", error);
            toast.error('Không thể cập nhật bình luận.');
        } finally {
            setProcessingViolationId(null);
        }
    };

    const handleCommentDelete = async (violationId: string, commentId: string) => {
        setProcessingViolationId(violationId);
        try {
            await dataStore.deleteCommentInViolation(violationId, commentId);
            toast.success('Đã xóa bình luận');
        } catch (error) {
            console.error("Failed to delete comment:", error);
            toast.error('Không thể xóa bình luận.');
        } finally {
            setProcessingViolationId(null);
        }
    };
  
  const handlePenaltySubmit = async (media: { id: string; type: 'photo' | 'video' }[]) => {
    setIsPenaltyCameraOpen(false);
    if (!activeViolationForPenalty || !activeUserForPenalty || media.length === 0) {
        return;
    }
    
    setProcessingViolationId(activeViolationForPenalty.id);
    const violationId = activeViolationForPenalty.id;
    toast.loading('Bằng chứng nộp phạt đang được tải lên.');

    // Separate photos and videos for backward compatibility and correct data structure
    const photosToSubmit = media
        .filter(m => m.type === 'photo')
        .map(m => ({ id: m.id, type: m.type as 'photo' | 'video' }));

    const videosToSubmit = media
        .filter(m => m.type === 'video')
        .map(m => ({ id: m.id, type: m.type as 'photo' | 'video' }));

    try {
        await dataStore.submitPenaltyProof(violationId, [...photosToSubmit, ...videosToSubmit], { userId: activeUserForPenalty.id, userName: activeUserForPenalty.name });
        toast.success('Đã cập nhật bằng chứng nộp phạt.');
    } catch (error) {
        console.error("Failed to submit penalty proof:", error);
        toast.error('Không thể gửi bằng chứng nộp phạt.');
    } finally {
        toast.dismiss();
        setProcessingViolationId(null);
        setActiveViolationForPenalty(null);
        setActiveUserForPenalty(null);
    }
};

  const filteredViolations = useMemo(() => {
      let result = violations;
      if (filterUserId) {
        result = result.filter(v => v.users.some(vu => vu.id === filterUserId));
      }
      if(filterCategoryName) {
          result = result.filter(v => v.categoryName === filterCategoryName);
      }
      return result;
  }, [violations, filterUserId, filterCategoryName]);

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

  const userAbbreviations = useMemo(() => generateSmartAbbreviations(users), [users]);

  const openAddDialog = (isSelfConfess: boolean) => {
    setViolationToEdit(null);
    setIsSelfConfessMode(isSelfConfess);
    setIsDialogOpen(true);
  }
  
  const openLightbox = (media: (string | MediaAttachment)[], index: number) => {
    const slides = media.map(item => {
        if (isMediaAttachment(item)) {
            // Handle new MediaAttachment format
            if (item.type === 'video') {
                const typeMatch = item.url.match(/\.([^.]+)$/);
                const videoType = typeMatch ? `video/${typeMatch[1]}` : 'video/webm';
                return { type: 'video' as const, sources: [{ src: item.url, type: videoType }] };
            }
            return { src: item.url, type: 'image' as const };
        } else if (typeof item === 'string') {
            // This branch is for backward compatibility with old string URLs
            return { src: item };
        }
        return null; // Should not happen with correct data
    }).filter(Boolean);
    setLightboxSlides(slides as any);
    setLightboxIndex(index);
    router.push('?lightbox=true');
  };

  const closeLightbox = () => {
    router.back();
  }
  
    const toggleCommentSection = (violationId: string) => {
        setOpenCommentSectionIds(prevIds => {
            const newIds = new Set(prevIds);
            if (newIds.has(violationId)) {
                newIds.delete(violationId);
            } else {
                newIds.add(violationId);
            }
            return newIds;
        });
    };

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
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <CardTitle>Danh sách Vi phạm</CardTitle>
                        <CardDescription className="mt-1">
                            Các ghi nhận gần đây nhất sẽ được hiển thị ở đầu.
                        </CardDescription>
                    </div>
                     <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        {!canManage && (
                          <Button variant="secondary" onClick={() => openAddDialog(true)} className="w-full sm:w-auto">
                              <BadgeInfo className="mr-2 h-4 w-4" /> Tự thú
                          </Button>
                        )}
                        {canManage && (
                            <Button onClick={() => openAddDialog(false)} className="w-full sm:w-auto">
                                <Plus className="mr-2 h-4 w-4" /> Thêm mới
                            </Button>
                        )}
                        <div className="flex gap-2 w-full sm:w-auto">
                           <Button variant="outline" onClick={() => setIsInfoDialogOpen(true)} className="flex-grow">
                              <BadgeInfo className="mr-2 h-4 w-4" />
                              Chính sách phạt
                           </Button>
                           {isOwner && (
                                <Button variant="outline" size="icon" onClick={() => setIsCategoryDialogOpen(true)} className="shrink-0">
                                    <Settings className="h-4 w-4" />
                                </Button>
                           )}
                        </div>
                    </div>
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                    <Select value={filterUserId || 'all'} onValueChange={(val) => setFilterUserId(val === 'all' ? null : val)}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Lọc theo nhân viên..."/>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tất cả nhân viên</SelectItem>
                            {displayUsers.map(u => (
                                <SelectItem key={u.uid} value={u.uid}>{u.displayName}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <ViolationCategoryCombobox
                        categories={categoryData.list}
                        value={filterCategoryName}
                        onChange={setFilterCategoryName}
                        onCategoriesChange={handleCategoriesChange}
                        canManage={false}
                        placeholder="Lọc theo loại vi phạm..."
                    />
                </div>
            </CardHeader>
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
                        <AccordionContent className="space-y-4 pt-2">
                            {violationsInMonth.map(v => (
                                <ViolationCard
                                    key={v.id}
                                    violation={v}
                                    currentUser={user}
                                    categoryData={categoryData}
                                    userAbbreviations={userAbbreviations}
                                    processingViolationId={processingViolationId}
                                    openCommentSectionIds={openCommentSectionIds}
                                    onToggleFlag={handleToggleFlag}
                                    onToggleWaivePenalty={handleToggleWaivePenalty}
                                    onEdit={(violation) => { setViolationToEdit(violation); setIsSelfConfessMode(false); setIsDialogOpen(true); }}
                                    onDelete={handleDeleteViolation}
                                    onPenaltySubmit={(violation, user, mode) => { 
                                        setActiveViolationForPenalty(violation); 
                                        setActiveUserForPenalty(user); 
                                        setPenaltyCaptureMode(mode);
                                        setIsPenaltyCameraOpen(true); 
                                    }}
                                    onCommentSubmit={handleCommentSubmit}
                                    onCommentEdit={handleCommentEdit}
                                    onCommentDelete={handleCommentDelete}
                                    onToggleCommentSection={toggleCommentSection}
                                    setActiveViolationForPenalty={setActiveViolationForPenalty}
                                    setActiveUserForPenalty={setActiveUserForPenalty}
                                    setIsPenaltyCameraOpen={setIsPenaltyCameraOpen}
                                />
                            ))}
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
            users={displayUsers}
            isProcessing={isProcessing}
            violationToEdit={violationToEdit}
            reporter={user}
            isSelfConfession={isSelfConfessMode}
            categories={categoryData.list}
            onCategoriesChange={handleCategoriesChange}
            canManage={isOwner}
          />
      )}
      
      {isOwner && (
        <ViolationCategoryManagementDialog
            isOpen={isCategoryDialogOpen}
            onClose={() => setIsCategoryDialogOpen(false)}
        />
      )}

      <ViolationInfoDialog
        isOpen={isInfoDialogOpen}
        onClose={() => setIsInfoDialogOpen(false)}
        categories={categoryData.list}
        generalRules={categoryData.generalRules}
      />
      
       <CameraDialog
        isOpen={isPenaltyCameraOpen}
        onClose={() => setIsPenaltyCameraOpen(false)}
        onSubmit={handlePenaltySubmit}
        captureMode={penaltyCaptureMode}
      />

        <Lightbox
            open={lightboxOpen}
            close={closeLightbox}
            index={lightboxIndex}
            slides={lightboxSlides}
            plugins={[Video]}
            carousel={{ finite: true }}
        />
    </>
  );
}