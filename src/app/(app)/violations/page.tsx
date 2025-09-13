
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
import { ShieldX, Plus, Edit, Trash2, Camera, Loader2, FilterX, BadgeInfo, CheckCircle, Eye, FilePlus2 } from 'lucide-react';
import type { ManagedUser, Violation, ViolationCategory, ViolationUser } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Image from 'next/image';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import CameraDialog from '@/components/camera-dialog';
import { Badge } from '@/components/ui/badge';
import { ViolationCategoryCombobox } from '@/components/violation-category-combobox';
import { UserMultiSelect } from '@/components/user-multi-select';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';


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

export default function ViolationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [violations, setViolations] = useState<Violation[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [categories, setCategories] = useState<ViolationCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSelfConfessMode, setIsSelfConfessMode] = useState(false);
  const [violationToEdit, setViolationToEdit] = useState<Violation | null>(null);
  
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSlides, setLightboxSlides] = useState<{ src: string }[]>([]);

  const [isPenaltyCameraOpen, setIsPenaltyCameraOpen] = useState(false);
  const [activeViolationForPenalty, setActiveViolationForPenalty] = useState<Violation | null>(null);

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
    
    // A simple way to wait for all subscriptions to load initial data
    Promise.all([
        new Promise(resolve => onSnapshot(collection(db, 'violations'), () => resolve(true), { onlyOnce: true })),
        new Promise(resolve => onSnapshot(collection(db, 'users'), () => resolve(true), { onlyOnce: true })),
        new Promise(resolve => onSnapshot(doc(db, 'app-data', 'violationCategories'), () => resolve(true), { onlyOnce: true })),
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
        await dataStore.deleteViolation(violation.id, [...(violation.photos || []), ...(violation.penaltyPhotos || [])] );
        toast({ title: 'Đã xóa', description: 'Đã xóa ghi nhận vi phạm.' });
    } catch (error) {
        console.error("Failed to delete violation:", error);
        toast({ title: 'Lỗi', description: 'Không thể xóa vi phạm.', variant: 'destructive' });
    } finally {
        setIsProcessing(false);
    }
  };
  
    const handlePenaltySubmit = async (photoIds: string[]) => {
        setIsPenaltyCameraOpen(false);
        if (!activeViolationForPenalty || photoIds.length === 0) {
            return;
        }
        
        setIsProcessing(true);
        const violationId = activeViolationForPenalty.id;
        toast({ title: 'Đang xử lý...', description: 'Bằng chứng nộp phạt đang được tải lên.' });

        try {
            const newPhotoUrls = await dataStore.submitPenaltyProof(violationId, photoIds);
            
            // Optimistic UI update
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
            setIsProcessing(false);
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
  const pageTitle = canManage ? 'Ghi nhận Vi phạm' : 'Danh sách Vi phạm';

  const openAddDialog = (isSelfConfession: boolean) => {
    setViolationToEdit(null);
    setIsSelfConfessMode(isSelfConfession);
    setIsDialogOpen(true);
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

                                return (
                                <div key={v.id} className="border rounded-lg p-4 relative">
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-semibold">{userNames}</p>
                                            <Badge>{v.category || 'Khác'}</Badge>
                                            {v.users && v.users.length === 1 && v.users[0].id === v.reporterId && (
                                                <Badge variant="outline" className="border-green-500 text-green-600">Tự thú</Badge>
                                            )}
                                        </div>
                                        {canManage && (
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViolationToEdit(v); setIsSelfConfessMode(false); setIsDialogOpen(true); }}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Xóa vi phạm?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể được hoàn tác.</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteViolation(v)}>Xóa</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Ghi nhận bởi: {v.reporterName} lúc {new Date(v.createdAt as string).toLocaleString('vi-VN', {hour12: false})}
                                    </p>
                                    <p className="mt-2 text-sm">{v.content}</p>
                                    {v.photos && v.photos.length > 0 && (
                                        <div className="mt-2 flex gap-2 flex-wrap">
                                            {v.photos.map((photo, index) => (
                                                <button key={index} onClick={() => { setLightboxSlides(v.photos.map(p => ({ src: p }))); setLightboxOpen(true); }} className="relative w-20 h-20 rounded-md overflow-hidden">
                                                    <Image src={photo} alt={`Evidence ${index + 1}`} fill className="object-cover" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                     <div className="mt-4 pt-4 border-t">
                                        {v.penaltyPhotos && v.penaltyPhotos.length > 0 ? (
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between flex-wrap gap-2">
                                                <div className="text-sm text-green-600 font-semibold flex items-center gap-2">
                                                    <CheckCircle className="h-4 w-4" />
                                                    <span>Đã nộp phạt lúc {v.penaltySubmittedAt ? new Date(v.penaltySubmittedAt as string).toLocaleString('vi-VN', {hour12: false}) : 'Không rõ'}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="secondary" onClick={() => { setLightboxSlides(v.penaltyPhotos!.map(p => ({ src: p }))); setLightboxOpen(true); }}>
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
                                    {isProcessing && activeViolationForPenalty?.id === v.id && (
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
            isSelfConfessMode={isSelfConfessMode}
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
            slides={lightboxSlides}
        />
    </>
  );
}
