

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldX, Plus, Edit, Trash2, Camera, Loader2, FilterX, BadgeInfo, CheckCircle, Eye } from 'lucide-react';
import type { ManagedUser, Violation } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Image from 'next/image';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import CameraDialog from '@/components/camera-dialog';
import { Badge } from '@/components/ui/badge';


function ViolationDialog({
  open,
  onOpenChange,
  onSave,
  users,
  isProcessing,
  violationToEdit,
  reporter,
  isSelfConfession = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any, id?: string) => void;
  users: ManagedUser[];
  isProcessing: boolean;
  violationToEdit: Violation | null;
  reporter: ManagedUser;
  isSelfConfession?: boolean;
}) {
  const [content, setContent] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  
  useEffect(() => {
    if (open) {
        if (violationToEdit) {
            setContent(violationToEdit.content);
            setSelectedUserId(violationToEdit.userId);
            setPhotoIds([]);
        } else if (isSelfConfession) {
            setContent('');
            setSelectedUserId(reporter.uid); // Lock to self
            setPhotoIds([]);
        } else {
            // Reset for new violation by manager
            setContent('');
            setSelectedUserId('');
            setPhotoIds([]);
        }
    }
  }, [open, violationToEdit, isSelfConfession, reporter]);

  const handleSave = () => {
    if (!content || !selectedUserId) {
      alert('Vui lòng điền đầy đủ nội dung và chọn nhân viên.');
      return;
    }

    const selectedUser = users.find(u => u.uid === selectedUserId);
    if (!selectedUser) return;
    
    const data = {
        content: content,
        userId: selectedUserId,
        userName: selectedUser.displayName,
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
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="user" className="text-right">
              Nhân viên
            </Label>
             <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={isSelfConfession}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Chọn nhân viên..." />
              </SelectTrigger>
              <SelectContent>
                {users.filter(u => u.role !== 'Chủ nhà hàng').map(u => (
                  <SelectItem key={u.uid} value={u.uid}>{u.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSelfConfessMode, setIsSelfConfessMode] = useState(false);
  const [violationToEdit, setViolationToEdit] = useState<Violation | null>(null);
  
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
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
    const unsubViolations = dataStore.subscribeToViolations((data) => {
        setViolations(data);
        setIsLoading(false);
    });
    const unsubUsers = dataStore.subscribeToUsers((data) => setUsers(data));
    return () => {
        unsubViolations();
        unsubUsers();
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

  const handleDeleteViolation = async (violation: Violation) => {
    setIsProcessing(true);
    try {
        await dataStore.deleteViolation(violation.id, violation.photos);
        toast({ title: 'Đã xóa', description: 'Đã xóa ghi nhận vi phạm.' });
    } catch (error) {
        console.error("Failed to delete violation:", error);
        toast({ title: 'Lỗi', description: 'Không thể xóa vi phạm.', variant: 'destructive' });
    } finally {
        setIsProcessing(false);
    }
  };
  
    const handlePenaltySubmit = async (photoIds: string[]) => {
        if (!activeViolationForPenalty || photoIds.length === 0) {
            setIsPenaltyCameraOpen(false);
            return;
        }
        
        setIsProcessing(true);
        toast({ title: 'Đang xử lý...', description: 'Bằng chứng nộp phạt đang được tải lên.' });

        try {
            await dataStore.submitPenaltyProof(activeViolationForPenalty.id, photoIds[0]);
            toast({ title: 'Thành công', description: 'Đã cập nhật bằng chứng nộp phạt.' });
        } catch (error) {
            console.error("Failed to submit penalty proof:", error);
            toast({ title: 'Lỗi', description: 'Không thể gửi bằng chứng nộp phạt.', variant: 'destructive' });
        } finally {
            setIsProcessing(false);
            setActiveViolationForPenalty(null);
            setIsPenaltyCameraOpen(false);
        }
    };

  const filteredViolations = useMemo(() => {
      if (!filterUserId) return violations;
      return violations.filter(v => v.userId === filterUserId);
  }, [violations, filterUserId]);

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

  const openAddDialog = (isSelfConfession: boolean) => {
    setViolationToEdit(null);
    setIsSelfConfessMode(isSelfConfession);
    setIsDialogOpen(true);
  }

  if (isLoading || authLoading) {
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
            <ShieldX /> Ghi nhận Vi phạm
          </h1>
          <p className="text-muted-foreground mt-2">
            Theo dõi và quản lý các vấn đề liên quan đến nhân viên.
          </p>
        </header>

        <Card>
          <CardHeader className="flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Danh sách Vi phạm</CardTitle>
              <CardDescription>
                Các ghi nhận gần đây nhất sẽ được hiển thị ở đầu.
              </CardDescription>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
                <Select value={filterUserId || 'all'} onValueChange={(val) => setFilterUserId(val === 'all' ? null : val)}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Lọc theo nhân viên..."/>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tất cả nhân viên</SelectItem>
                        {users.map(u => (
                            <SelectItem key={u.uid} value={u.uid}>{u.displayName}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                 <Button variant="secondary" onClick={() => openAddDialog(true)}>
                    <BadgeInfo className="mr-2 h-4 w-4" /> Tự thú
                 </Button>
                {canManage && (
                  <Button onClick={() => openAddDialog(false)}>
                    <Plus className="mr-2 h-4 w-4" /> Thêm mới
                  </Button>
                )}
            </div>
          </CardHeader>
          <CardContent>
            {Object.keys(groupedViolations).length === 0 ? (
                <div className="text-center py-16 text-muted-foreground flex flex-col items-center gap-4">
                    <FilterX className="h-12 w-12"/>
                    <p>Không tìm thấy vi phạm nào.</p>
                </div>
            ) : (
                <Accordion type="multiple" defaultValue={Object.keys(groupedViolations)} className="space-y-4">
                {Object.entries(groupedViolations).map(([month, violationsInMonth]) => (
                    <AccordionItem key={month} value={month}>
                        <AccordionTrigger className="text-lg font-medium">Tháng {month}</AccordionTrigger>
                        <AccordionContent className="space-y-4">
                            {violationsInMonth.map(v => (
                                <div key={v.id} className="border rounded-lg p-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold">{v.userName}</p>
                                            {v.userId === v.reporterId && (
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
                                        Ghi nhận bởi: {v.reporterName} lúc {new Date(v.createdAt as string).toLocaleString('vi-VN')}
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
                                        {v.penaltyPhotoUrl ? (
                                            <div className="flex items-center justify-between">
                                                <div className="text-sm text-green-600 font-semibold flex items-center gap-2">
                                                    <CheckCircle className="h-4 w-4" />
                                                    <span>Đã nộp phạt lúc {new Date(v.penaltySubmittedAt as string).toLocaleString('vi-VN')}</span>
                                                </div>
                                                <Button size="sm" variant="secondary" onClick={() => { setLightboxSlides([{ src: v.penaltyPhotoUrl! }]); setLightboxOpen(true); }}>
                                                    <Eye className="mr-2 h-4 w-4" />
                                                    Xem bằng chứng
                                                </Button>
                                            </div>
                                        ) : (
                                            canManage && (
                                                <Button size="sm" onClick={() => { setActiveViolationForPenalty(v); setIsPenaltyCameraOpen(true); }}>
                                                    Nộp phạt
                                                </Button>
                                            )
                                        )}
                                    </div>
                                </div>
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
            users={users}
            isProcessing={isProcessing}
            violationToEdit={violationToEdit}
            reporter={user}
            isSelfConfession={isSelfConfessMode}
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
