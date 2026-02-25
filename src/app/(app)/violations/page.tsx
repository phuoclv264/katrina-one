'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { useAuth } from '@/hooks/use-auth';
import { dataStore } from '@/lib/data-store';
import { toast } from '@/components/ui/pro-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { ShieldX, Plus, FilterX, BadgeInfo, Settings, UserSearch, Camera, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import type { ManagedUser, Violation, ViolationCategory, ViolationUser, ViolationCategoryData, MediaAttachment } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import CameraDialog from '@/components/camera-dialog';
import { Combobox } from '@/components/combobox';
import { collection, doc, getDocs, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import ViolationCategoryManagementDialog from './_components/violation-category-management-dialog';
import ViolationInfoDialog from './_components/violation-info-dialog';
import { ViolationDialog } from './_components/violation-dialog';
import { ViolationCard } from './_components/violation-card';
import { cn } from '@/lib/utils';
import { generateSmartAbbreviations } from '@/lib/violations-utils';

import { useRouter } from 'nextjs-toploader/app';
import { useSearchParams } from 'next/navigation';
import { SubmitAllDialog } from './_components/submit-all-dialog';
import { OwnerBulkPayDialog, UnpaidItem } from './_components/owner-bulk-pay-dialog';
import { getQueryParamWithMobileHashFallback } from '@/lib/url-params';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAppNavigation } from '@/contexts/app-navigation-context';

/**
 * Type guard to check if an item is a MediaAttachment.
 */
function isMediaAttachment(item: any): item is MediaAttachment {
  return typeof item === 'object' && item !== null &&
    typeof item.url === 'string' &&
    (item.type === 'photo' || item.type === 'video');
}
function ViolationsView() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const routerRef = useRef(router);
  const searchParams = useSearchParams();
  const nav = useAppNavigation();

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const handleDataRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const [violations, setViolations] = useState<Violation[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [categoryData, setCategoryData] = useState<ViolationCategoryData>({ list: [], generalRules: [] });
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingViolationId, setProcessingViolationId] = useState<string | null>(null);

  const violationRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [isSelfConfessMode, setIsSelfConfessMode] = useState(false);
  const [violationToEdit, setViolationToEdit] = useState<Violation | null>(null);
  // Submit all dialog state
  const [isSubmitAllOpen, setIsSubmitAllOpen] = useState(false);
  const [isBulkCameraOpen, setIsBulkCameraOpen] = useState(false);
  const [isOwnerBulkPayOpen, setIsOwnerBulkPayOpen] = useState(false);
  const [violationsToSubmit, setViolationsToSubmit] = useState<string[]>([]);

  const [filterUsers, setFilterUsers] = useState<ManagedUser[]>([]);
  const [filterCategoryName, setFilterCategoryName] = useState<string>('');

  const [isPenaltyCameraOpen, setIsPenaltyCameraOpen] = useState(false);
  const [activeViolationForPenalty, setActiveViolationForPenalty] = useState<Violation | null>(null);
  const [activeUserForPenalty, setActiveUserForPenalty] = useState<ViolationUser | null>(null);
  const [penaltyCaptureMode, setPenaltyCaptureMode] = useState<'photo' | 'video' | 'both'>('photo');
  const [bulkPenaltyCaptureMode, setBulkPenaltyCaptureMode] = useState<'photo' | 'video' | 'both'>('video');


  const [openCommentSectionIds, setOpenCommentSectionIds] = useState<Set<string>>(new Set());

  // All hooks MUST be called unconditionally and in the same order every render
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    if (!user) return;
    // Wire up retry logic for pending penalty submissions on app startup
    dataStore.retryPendingPenaltySubmissions();

    // Subscribe to users and categories as before
    const unsubUsers = dataStore.subscribeToUsers(setUsers);
    const unsubCategories = dataStore.subscribeToViolationCategories(setCategoryData);

    // Subscribe to violations for the selected month (see monthly navigation below)
    const unsubMonthly = dataStore.subscribeToViolationsForMonth(currentMonth, setViolations);

    return () => {
      unsubMonthly();
      unsubUsers();
      unsubCategories();
    };
  }, [user, refreshTrigger, currentMonth]);

  useEffect(() => {
    if (isLoading && (violations.length > 0)) {
      setIsLoading(false);
    } else if (isLoading) {
      setTimeout(() => {
        if (isLoading) {
          setIsLoading(false);
        }
      }, 1000);
    }
  }, [violations, isLoading]);

  // Effect to scroll to and highlight a violation from URL param
  useEffect(() => {
    const highlightId = getQueryParamWithMobileHashFallback({
      param: 'highlight',
      searchParams,
      hash: typeof window !== 'undefined' ? window.location.hash : '',
    });
    if (!highlightId || violations.length === 0) return;

    const tryScroll = () => {
      const el = violationRefs.current.get(highlightId);
      if (!el) return false;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-animation');
      setTimeout(() => {
        el.classList.remove('highlight-animation');
      }, 2500);
      nav.replace('/violations', { clearParam: 'highlight' });
      return true;
    };

    if (tryScroll()) return;

    let attempts = 0;
    const maxAttempts = 20;
    const interval = setInterval(() => {
      attempts += 1;
      if (tryScroll() || attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 100);
  }, [searchParams, violations]);

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

  // Call custom hook unconditionally
  useDataRefresher(handleDataRefresh);

  // Memoized values - these are not hooks, so they can come after effects
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
    } catch (error) {
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
    if (!activeViolationForPenalty || !activeUserForPenalty || media.length === 0) {
      setIsPenaltyCameraOpen(false);
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
      setIsPenaltyCameraOpen(false);
    }
  };

  const handleOpenBulkSubmit = (violationIds: string[]) => {
    if (violationIds.length > 0) {
      setViolationsToSubmit(violationIds);
      setBulkPenaltyCaptureMode('video');
      setIsBulkCameraOpen(true); // Open camera
    }
  };

  const handleBulkPenaltySubmit = async (media: { id: string; type: 'photo' | 'video' }[]) => {
    if (!user) return;
    if (violationsToSubmit.length === 0 || media.length === 0) {
      setIsBulkCameraOpen(false);
      return;
    }

    setIsProcessing(true);
    toast.loading(`Đang nộp bằng chứng cho ${violationsToSubmit.length} vi phạm...`);

    try {
      await dataStore.submitBulkPenaltyProof(violationsToSubmit, media, { userId: user.uid, userName: user.displayName });
      toast.dismiss();
      toast.success(`Đã nộp thành công bằng chứng cho ${violationsToSubmit.length} vi phạm.`);
    } catch (error) {
      console.error("Failed to submit bulk penalty proof:", error);
      toast.dismiss();
      toast.error('Có lỗi xảy ra khi nộp bằng chứng.');
    } finally {
      setIsProcessing(false);
      setViolationsToSubmit([]);
      setIsBulkCameraOpen(false);
      setIsSubmitAllOpen(true); // Reopen the dialog
    }
  };

  const filteredViolations = useMemo(() => {
    let result = violations;
    if (filterUsers.length > 0) {
      const filterUserIds = new Set(filterUsers.map(u => u.uid));
      result = result.filter(v => v.users.some(vu => filterUserIds.has(vu.id)));
    }
    if (filterCategoryName) {
      result = result.filter(v => v.categoryName === filterCategoryName);
    }
    return result;
  }, [violations, filterUsers, filterCategoryName]);

  const groupedViolations = useMemo(() => {
    return filteredViolations.reduce((acc, violation) => {
      const monthKey = new Date(violation.createdAt as string).toLocaleString('vi-VN', { month: '2-digit', year: 'numeric' });
      if (!acc[monthKey]) {
        acc[monthKey] = [];
      }
      acc[monthKey].push(violation);
      return acc;
    }, {} as { [key: string]: Violation[] });
  }, [filteredViolations]);

  const userAbbreviations = useMemo(() => generateSmartAbbreviations(users), [users]);

  // Summaries should reflect the currently filtered violations (month + filters)
  const monthSummary = useMemo(() => {
    const totalCount = filteredViolations.length;
    const totalCost = filteredViolations.reduce((sum, v) => sum + (v.cost || 0), 0);
    const severityCounts = { low: 0, medium: 0, high: 0 } as Record<string, number>;
    filteredViolations.forEach(v => {
      const sev = (v.severity as string) || 'low';
      severityCounts[sev] = (severityCounts[sev] || 0) + 1;
    });
    return { totalCount, totalCost, severityCounts };
  }, [filteredViolations]);

  const perUserSummary = useMemo(() => {
    const map = new Map<string, { userId: string; name: string; total: number; unpaid: number }>();
    for (const v of filteredViolations) {
      const submissions = v.penaltySubmissions || [];
      const waived = !!v.isPenaltyWaived;
      const userCosts = v.userCosts || [];
      for (const uc of userCosts) {
        const uid = uc.userId;
        // Prefer display name from users list if available
        const managed = users.find(mu => mu.uid === uid);
        const userNameFromViolation = managed?.displayName ?? (v.users || []).find(u => u.id === uid)?.name;
        const userRecord = map.get(uid) ?? { userId: uid, name: userNameFromViolation || uid, total: 0, unpaid: 0 };
        userRecord.total += uc.cost || 0;
        const paid = waived || submissions.some(s => s.userId === uid);
        if (!paid) userRecord.unpaid += uc.cost || 0;
        map.set(uid, userRecord);
      }
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => b.total - a.total);
    const totalUnpaid = arr.reduce((s, u) => s + (u.unpaid || 0), 0);
    return { list: arr, totalUnpaid };
  }, [filteredViolations, users]);

  const isAtCurrentMonth = useMemo(() => {
    const now = new Date();
    return now.getFullYear() === currentMonth.getFullYear() && now.getMonth() === currentMonth.getMonth();
  }, [currentMonth]);

  // Format current month as MM/YYYY for compact display (e.g., 01/2026)
  const formattedCurrentMonth = useMemo(() => {
    const mm = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const yyyy = String(currentMonth.getFullYear());
    return `${mm}/${yyyy}`;
  }, [currentMonth]);

  const setToCurrentMonth = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  // Button classes for chevrons
  const prevBtnClass = 'bg-white/20 text-white rounded-full p-2 shadow-sm hover:bg-white/30 focus:ring-2 focus:ring-white/40';
  const nextBtnClass = isAtCurrentMonth
    ? 'rounded-full p-2 shadow-sm bg-white/10 text-white/60 cursor-not-allowed'
    : 'bg-white/20 text-white rounded-full p-2 shadow-sm hover:bg-white/30 focus:ring-2 focus:ring-white/40';

  const staffPendingViolations = useMemo(() => {
    if (!user || user.role === 'Chủ nhà hàng') return [];
    return violations.filter(v => v.users.some(u => u.id === user.uid) && !(v.penaltySubmissions || []).some(s => s.userId === user.uid));
  }, [violations, user]);

  const ownerPendingPaymentItems = useMemo(() => {
    if (!user || user.role !== 'Chủ nhà hàng') return [];
    
    // Based on filteredViolations so owner can filter by user/category first
    const items: UnpaidItem[] = [];
    
    filteredViolations.forEach(v => {
      if (v.isPenaltyWaived) return;
      
      const userCosts = v.userCosts || [];
      const submissions = v.penaltySubmissions || [];
      
      userCosts.forEach(uc => {
        // Check if this specific user has paid
        if (!submissions.some(s => s.userId === uc.userId)) {
           // Try to find nice name
           const managedUser = users.find(u => u.uid === uc.userId);
           const userName = managedUser?.displayName || v.users.find(u => u.id === uc.userId)?.name || 'Unknown';
           
           items.push({
             key: `${v.id}_${uc.userId}`,
             violation: v,
             userId: uc.userId,
             userName: userName,
             cost: uc.cost
           });
        }
      });
    });
    
    // Sort items by date desc
    return items.sort((a, b) => {
      const dateA = (a.violation.createdAt as any).toDate ? (a.violation.createdAt as any).toDate() : new Date(a.violation.createdAt as string);
      const dateB = (b.violation.createdAt as any).toDate ? (b.violation.createdAt as any).toDate() : new Date(b.violation.createdAt as string);
      return dateB.getTime() - dateA.getTime();
    });
  }, [filteredViolations, user, users]);

  // Early return check - AFTER all hooks are called
  if (isLoading || authLoading || !user) {
    return <LoadingPage />;
  }

  // Derived values (not hooks)
  const canManage = user?.role === 'Quản lý' || user?.role === 'Chủ nhà hàng';
  const isOwner = user?.role === 'Chủ nhà hàng';
  const pageTitle = canManage ? 'Ghi nhận Vi phạm' : 'Danh sách Vi phạm';

  // Event handlers (not hooks)
  const openAddDialog = (isSelfConfess: boolean) => {
    setViolationToEdit(null);
    setIsSelfConfessMode(isSelfConfess);
    setIsDialogOpen(true);
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

  const handleOwnerBulkPaySubmit = async (items: UnpaidItem[]) => {
    if (items.length === 0) return;
    setIsProcessing(true);
    let successCount = 0;
    let failCount = 0;

    for (const item of items) {
      try {
        await dataStore.markPenaltyAsSubmitted(item.violation.id, { userId: item.userId, userName: item.userName });
        successCount++;
      } catch (error) {
        console.error(`Failed to mark penalty as paid for ${item.userName} in violation ${item.violation.id}:`, error);
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Đã xác nhận thanh toán cho ${successCount} khoản phạt.`);
    }
    if (failCount > 0) {
      toast.error(`Có lỗi khi xử lý ${failCount} khoản phạt.`);
    }

    setIsProcessing(false);
    setIsOwnerBulkPayOpen(false);
  };

  return (
    <>
      <div className="container mx-auto px-4 py-6 sm:py-8 lg:px-8">
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-headline flex items-center gap-3">
              <ShieldX className="text-destructive h-7 w-7 sm:h-8 sm:w-8" /> {pageTitle}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Theo dõi và quản lý các vấn đề liên quan đến nhân viên.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!canManage && (
              <Button variant="secondary" onClick={() => openAddDialog(true)} className="flex-1 sm:flex-none h-11 sm:h-10">
                <BadgeInfo className="mr-2 h-4 w-4" /> Tự thú
              </Button>
            )}
            {canManage && (
              <Button onClick={() => openAddDialog(false)} className="flex-1 min-w-full sm:flex-1 h-11 sm:h-10 shadow-lg shadow-primary/20">
                <Plus className="mr-2 h-4 w-4" /> Thêm mới
              </Button>
            )}
            {isOwner && ownerPendingPaymentItems.length > 0 && (
              <Button 
                variant="default" 
                className="flex-1 sm:flex-none h-11 sm:h-10 bg-gradient-to-br from-indigo-700 to-indigo-800 hover:from-indigo-800 hover:to-indigo-900 shadow-lg shadow-indigo-500/30 active:scale-95 transition-all border-none text-white" 
                onClick={() => setIsOwnerBulkPayOpen(true)}
              >
                <div className="relative mr-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                  </span>
                </div>
                Thanh toán ({ownerPendingPaymentItems.length})
              </Button>
            )}
            {staffPendingViolations.length > 0 && user.role !== 'Chủ nhà hàng' && (
              <Button variant="default" className="flex-1 sm:flex-none h-11 sm:h-10 bg-amber-600 hover:bg-amber-700" onClick={() => setIsSubmitAllOpen(true)}>
                <Camera className="mr-2 h-4 w-4" />
                Nộp phạt ({staffPendingViolations.length})
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsInfoDialogOpen(true)} className="flex-1 sm:flex-none h-11 sm:h-10">
              <BadgeInfo className="mr-2 h-4 w-4" />
              Chính sách
            </Button>
            {isOwner && (
              <Button variant="outline" size="icon" onClick={() => setIsCategoryDialogOpen(true)} className="shrink-0 h-11 w-11 sm:h-10 sm:w-10">
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
        </header>

        {/* Stats Section - Optimized for Mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Month Selector Card */}
          <Card className="bg-gradient-to-br from-indigo-700 to-indigo-800 text-white border-none shadow-lg overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <ChevronRight className="h-16 w-16 -mr-4 -mt-4" />
            </div>
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <span className="text-xs font-medium uppercase tracking-wider opacity-80 mb-3 block">Tháng báo cáo</span>
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all active:scale-90"
                  onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                
                <div className="text-center flex-1">
                  <div className="text-xl font-bold tracking-tight">{formattedCurrentMonth}</div>
                  {!isAtCurrentMonth && (
                    <button 
                      onClick={setToCurrentMonth}
                      className="text-[10px] mt-1 bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-full transition-colors"
                    >
                      Về hiện tại
                    </button>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-9 w-9 text-white rounded-full transition-all active:scale-90",
                    isAtCurrentMonth ? "bg-white/5 opacity-40 cursor-not-allowed" : "bg-white/10 hover:bg-white/20"
                  )}
                  onClick={() => !isAtCurrentMonth && setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  disabled={isAtCurrentMonth}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 lg:col-span-3 gap-4">
            <Card className="bg-card shadow-sm border-s-4 border-s-blue-500">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <div className="text-muted-foreground text-xs font-medium mb-1 flex items-center gap-1.5">
                  <ShieldX className="h-3.5 w-3.5" /> Tổng số
                </div>
                <div className="text-2xl font-bold tracking-tight">{monthSummary.totalCount} <span className="text-sm font-normal text-muted-foreground">vụ</span></div>
              </CardContent>
            </Card>

            <Card className="bg-card shadow-sm border-s-4 border-s-red-500">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <div className="text-muted-foreground text-xs font-medium mb-1 flex items-center gap-1.5">
                  <BadgeInfo className="h-3.5 w-3.5" /> Tiền phạt
                </div>
                <div className="text-xl sm:text-2xl font-bold tracking-tight text-red-600">
                  {monthSummary.totalCost.toLocaleString('vi-VN')}
                  <span className="text-xs font-normal text-muted-foreground ml-1">đ</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card shadow-sm border-s-4 border-s-amber-500 col-span-2 md:col-span-1">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-muted-foreground text-xs font-medium flex items-center gap-1.5">
                    <UserSearch className="h-3.5 w-3.5" /> Chưa nộp
                  </div>
                  <div className="text-amber-600 font-bold text-lg">
                    {perUserSummary.totalUnpaid.toLocaleString('vi-VN')}đ
                  </div>
                </div>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="staff-list" className="border-none">
                    <AccordionTrigger className="hidden">Trigger</AccordionTrigger>
                    <AccordionContent className="pt-2">
                      <div className="space-y-1 max-h-40 overflow-auto pr-1">
                        {perUserSummary.list.filter(u => u.unpaid > 0).map(u => (
                          <div key={u.userId} className="flex items-center justify-between py-1 border-b border-dashed border-muted last:border-0">
                            <span className="text-[11px] font-medium max-w-[80px]">{u.name}</span>
                            <span className="text-[11px] text-amber-700 font-semibold">{u.unpaid.toLocaleString('vi-VN')}đ</span>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                    <div className="flex justify-center -mt-1">
                      <AccordionTrigger className="py-0 text-[10px] text-muted-foreground hover:no-underline">
                        Chi tiết danh sách
                      </AccordionTrigger>
                    </div>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 bg-muted/40 rounded-xl mb-6 items-center">
          <div className="w-full sm:flex-1">
            <Combobox
              options={displayUsers.map(u => ({ value: u.uid, label: u.displayName }))}
              value={filterUsers.map(u => u.uid)}
              onChange={(vals) => {
                const selectedIds = vals as string[];
                const selected = displayUsers.filter(u => selectedIds.includes(u.uid));
                setFilterUsers(selected);
              }}
              multiple={true}
              placeholder="Lọc theo nhân viên..."
              searchPlaceholder="Tìm nhân viên..."
              emptyText="Không tìm thấy nhân viên."
              className="w-full bg-background border-none shadow-sm"
            />
          </div>
          <div className="w-full sm:flex-1">
            <Combobox
              options={categoryData.list.map(c => ({ value: c.name, label: c.name }))}
              value={filterCategoryName}
              onChange={(val) => setFilterCategoryName(val as string)}
              placeholder="Lọc theo loại lỗi..."
              searchPlaceholder="Tìm loại vi phạm..."
              emptyText="Không tìm thấy loại vi phạm."
              className="w-full bg-background border-none shadow-sm"
            />
          </div>
          {(filterUsers.length > 0 || filterCategoryName) && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { setFilterUsers([]); setFilterCategoryName(''); }}
              className="text-muted-foreground text-xs h-11 sm:h-auto w-full sm:w-auto"
            >
              <FilterX className="mr-2 h-4 w-4" /> Xóa lọc
            </Button>
          )}
        </div>

        {/* Violations List */}
        <div className="space-y-4 pb-20">
          <div className="flex items-center justify-between px-1 mb-2">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">
              {filteredViolations.length} Ghi nhận vi phạm
            </h2>
          </div>
          
          {filteredViolations.length === 0 ? (
            <Card className="border-dashed border-2 py-16">
              <CardContent className="text-center text-muted-foreground flex flex-col items-center gap-4">
                <div className="p-4 bg-muted rounded-full">
                  <FilterX className="h-8 w-8" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Không có dữ liệu</p>
                  <p className="text-sm mt-1">Vui lòng thử điều chỉnh bộ lọc hoặc chọn tháng khác.</p>
                </div>
                {(filterUsers.length > 0 || filterCategoryName) && (
                  <Button variant="outline" size="sm" onClick={() => { setFilterUsers([]); setFilterCategoryName(''); }}>
                    Gỡ bỏ tất cả bộ lọc
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredViolations.map(v => (
              <ViolationCard
                ref={(el) => {
                  if (el) violationRefs.current.set(v.id, el);
                  else violationRefs.current.delete(v.id);
                }}
                key={v.id}
                violation={v}
                currentUser={user!}
                categoryData={categoryData}
                userAbbreviations={userAbbreviations}
                processingViolationId={processingViolationId}
                openCommentSectionIds={openCommentSectionIds}
                onToggleFlag={handleToggleFlag}
                onToggleWaivePenalty={handleToggleWaivePenalty}
                onEdit={(violation) => { setViolationToEdit(violation); setIsSelfConfessMode(false); setIsDialogOpen(true); }}
                onDelete={handleDeleteViolation}
                onPenaltySubmit={async (violation, user, mode) => {
                  if (mode === 'manual') {
                    if (confirm(`Xác nhận ${user.name} đã nộp phạt?`)) {
                      setProcessingViolationId(violation.id);
                      try {
                        await dataStore.markPenaltyAsSubmitted(violation.id, { userId: user.id, userName: user.name });
                        toast.success(`Đã xác nhận ${user.name} nộp phạt.`);
                      } catch (error) {
                        console.error("Failed to mark penalty as submitted:", error);
                        toast.error('Không thể xác nhận nộp phạt.');
                      } finally {
                        setProcessingViolationId(null);
                      }
                    }
                  } else {
                    setActiveViolationForPenalty(violation);
                    setActiveUserForPenalty(user);
                    setPenaltyCaptureMode(mode);
                    setIsPenaltyCameraOpen(true);
                  }
                }}
                onCommentSubmit={handleCommentSubmit}
                onCommentEdit={handleCommentEdit}
                onCommentDelete={handleCommentDelete}
                onToggleCommentSection={toggleCommentSection}
                setActiveViolationForPenalty={setActiveViolationForPenalty}
                setActiveUserForPenalty={setActiveUserForPenalty}
                setIsPenaltyCameraOpen={setIsPenaltyCameraOpen}
              />
            ))
          )}
        </div>
      </div>

      {/* SubmitAllDialog for staff bulk penalty evidence */}
      {isSubmitAllOpen && (
        <Suspense fallback={<LoadingPage />}>
          <SubmitAllDialog
            open={isSubmitAllOpen}
            onClose={() => setIsSubmitAllOpen(false)}
            violations={staffPendingViolations}
            user={{ id: user.uid, name: user.displayName }}
            onSubmit={handleOpenBulkSubmit}
            isProcessing={isProcessing}
            parentDialogTag='root'
          />
        </Suspense>
      )}
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
          parentDialogTag="root"
        />
      )}

      {isOwner && (
        <ViolationCategoryManagementDialog
          isOpen={isCategoryDialogOpen}
          onClose={() => setIsCategoryDialogOpen(false)}
          parentDialogTag="root"
        />
      )}

      {isOwner && (
        <OwnerBulkPayDialog
          open={isOwnerBulkPayOpen}
          onClose={() => setIsOwnerBulkPayOpen(false)}
          unpaidItems={ownerPendingPaymentItems}
          allUsers={users}
          onSubmit={handleOwnerBulkPaySubmit}
          isProcessing={isProcessing}
          parentDialogTag="root"
        />
      )}

      <ViolationInfoDialog
        isOpen={isInfoDialogOpen}
        onClose={() => setIsInfoDialogOpen(false)}
        categories={categoryData.list}
        generalRules={categoryData.generalRules}
        parentDialogTag="root"
      />

      <CameraDialog
        isOpen={isPenaltyCameraOpen}
        onClose={() => setIsPenaltyCameraOpen(false)}
        onSubmit={handlePenaltySubmit}
        captureMode={penaltyCaptureMode}
        parentDialogTag="root"
      />

      {/* Camera for bulk submission */}
      <CameraDialog
        isOpen={isBulkCameraOpen}
        onClose={() => setIsBulkCameraOpen(false)}
        onSubmit={handleBulkPenaltySubmit}
        captureMode="video"
        parentDialogTag="submit-all-violations-dialog"
      />

    </>
  );
}

export default function ViolationsPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <ViolationsView />
    </Suspense>
  );
}
