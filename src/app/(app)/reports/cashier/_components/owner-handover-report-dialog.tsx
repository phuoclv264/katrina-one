'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { HandoverReport, AuthUser } from '@/lib/types';
import { Loader2, Camera, Trash2, X, Eye, RefreshCw, Edit, Upload } from 'lucide-react';
import CameraDialog from '@/components/camera-dialog';
import { v4 as uuidv4 } from 'uuid';
import { photoStore } from '@/lib/photo-store';
import Image from 'next/image';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { toast } from 'react-hot-toast';
import { extractHandoverData } from '@/ai/flows/extract-handover-data-flow';
import { Separator } from '@/components/ui/separator';
import isEqual from 'lodash.isequal';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ServerCrash } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle as AlertDialogTitleComponent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter as AlertDialogFooterComponent } from '@/components/ui/alert-dialog';


type OwnerHandoverReportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any, id?: string) => void;
  isProcessing: boolean;
  reportToEdit: HandoverReport | null;
  reporter: AuthUser;
  dateForNewEntry?: string;
};


const handoverFieldOrder: (keyof HandoverReport['handoverData'])[] = [
    'expectedCash', 'startOfDayCash', 'cashExpense', 'cashRevenue', 'deliveryPartnerPayout'
];
const cardRevenueFieldOrder: (keyof HandoverReport['handoverData']['revenueByCard'])[] = [
    'techcombankVietQrPro', 'shopeeFood', 'grabFood', 'bankTransfer'
];

const handoverFieldLabels: { [key: string]: string } = {
    expectedCash: 'Tiền mặt dự kiến',
    startOfDayCash: 'Tiền mặt đầu ca',
    cashExpense: 'Chi tiền mặt',
    cashRevenue: 'Doanh thu tiền mặt',
    deliveryPartnerPayout: 'Trả ĐTGH (khác)',
    techcombankVietQrPro: 'TCB VietQR Pro',
    shopeeFood: 'ShopeeFood',
    grabFood: 'Grab Food',
    bankTransfer: 'Chuyển Khoản',
};

const InputField = React.memo(({ id, label, value, onChange, originalValue, disabled }: {
    id: string;
    label: string;
    value: number;
    onChange: (val: string) => void;
    originalValue?: number;
    disabled?: boolean;
}) => {
    const [localValue, setLocalValue] = useState(String(value));
    
    useEffect(() => { setLocalValue(String(value)); }, [value]);

    const handleBlur = () => { if (String(value) !== localValue) { onChange(localValue); } };
    
    const isEdited = originalValue !== undefined && value !== originalValue;

    return (
        <div key={id} className="grid grid-cols-2 items-center gap-2">
            <Label htmlFor={id} className="text-right flex items-center gap-2 justify-end">
                 {isEdited && <Edit className="h-3 w-3 text-yellow-500" />}
                {label}
            </Label>
            <Input id={id} type="number" value={localValue} onChange={e => setLocalValue(e.target.value)} onBlur={handleBlur} onFocus={(e) => e.target.select()} placeholder="0" className="text-right h-9" disabled={disabled}/>
        </div>
    );
});
InputField.displayName = 'InputField';

export default function OwnerHandoverReportDialog({
  open,
  onOpenChange,
  onSave,
  isProcessing,
  reportToEdit,
  reporter,
  dateForNewEntry
}: OwnerHandoverReportDialogProps) {
  const isCreating = !reportToEdit;
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [handoverData, setHandoverData] = useState<any>(null);
  const [aiOriginalData, setAiOriginalData] = useState<any>(null); // For AI rescan comparison
  const [actualCash, setActualCash] = useState(0);
  const [discrepancyReason, setDiscrepancyReason] = useState('');

  // Photo states
  const [newImageDataUri, setNewImageDataUri] = useState<string | null>(null);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [localPhotos, setLocalPhotos] = useState<{ id: string; url: string }[]>([]);
  const [photosToDelete, setPhotosToDelete] = useState<string[]>([]);
  
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxSlides, setLightboxSlides] = useState<{ src: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [serverErrorDialog, setServerErrorDialog] = useState<{ open: boolean, imageUri: string | null }>({ open: false, imageUri: null });
  
  const displayImageDataUri = newImageDataUri || reportToEdit?.handoverImageUrl;

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
        if (isLightboxOpen) {
            event.preventDefault();
            setIsLightboxOpen(false);
        }
    };
    if (isLightboxOpen) {
        window.history.pushState(null, '', window.location.href);
        window.addEventListener('popstate', handlePopState);
    }
    return () => {
        window.removeEventListener('popstate', handlePopState);
    };
  }, [isLightboxOpen]);


  useEffect(() => {
    if (open) {
      if (reportToEdit) {
        setHandoverData(reportToEdit.handoverData);
        setActualCash(reportToEdit.actualCash);
        setDiscrepancyReason(reportToEdit.discrepancyReason || '');
        setExistingPhotos(reportToEdit.discrepancyProofPhotos || []);
      } else {
        // Reset for creating
        setHandoverData(null);
        setActualCash(0);
        setDiscrepancyReason('');
        setExistingPhotos([]);
      }
      setAiOriginalData(null);
      setNewImageDataUri(null);
      setLocalPhotos([]);
      setPhotosToDelete([]);
      setAiError(null);
      setServerErrorDialog({open: false, imageUri: null});
    }
  }, [open, reportToEdit]);

  const handleSave = () => {
    if (isCreating && !newImageDataUri) {
        toast.error('Vui lòng cung cấp ảnh phiếu bàn giao.');
        return;
    }
    if (!reportToEdit && !dateForNewEntry) {
        toast.error('Không có ngày để tạo báo cáo.');
        return;
    }
    
    const discrepancy = actualCash - (handoverData?.expectedCash || 0);

    if (discrepancy !== 0 && !discrepancyReason.trim()) {
      toast.error('Vui lòng nhập lý do chênh lệch.');
      return;
    }
    
    const dataToSave = {
        handoverData: handoverData,
        actualCash,
        discrepancy,
        discrepancyReason: discrepancyReason.trim() || null,
        newDiscrepancyPhotos: localPhotos.map(p => p.id),
        photosToDelete: photosToDelete,
        isEdited: reportToEdit?.isEdited || !isEqual(reportToEdit?.handoverData, handoverData),
        ...(isCreating && { handoverImageUrl: newImageDataUri, date: dateForNewEntry }),
    };

    onSave(dataToSave, reportToEdit?.id);
  };
  
    const handleCapturePhotos = async (capturedPhotoIds: string[]) => {
        setIsCameraOpen(false);
        if (capturedPhotoIds.length === 0) return;
        
        const photoId = capturedPhotoIds[0]; // Assuming one photo at a time
        const photoBlob = await photoStore.getPhoto(photoId);
        if (photoBlob) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const uri = reader.result as string;
                if (activeViolationForPenalty) { // Assuming this state name, if it's for penalty
                     setLocalPhotos(prev => [...prev, { id: photoId, url: uri }]);
                } else {
                     setNewImageDataUri(uri);
                     processImage(uri);
                }
            };
            reader.readAsDataURL(photoBlob);
        }
    };
    
    const [activeViolationForPenalty, setActiveViolationForPenalty] = useState(false); // Helper state

    const handleDeleteExistingPhoto = (url: string) => {
        setExistingPhotos(prev => prev.filter(p => p !== url));
        setPhotosToDelete(prev => [...prev, url]);
    };
    
    const handleDeleteLocalPhoto = async (id: string) => {
        setLocalPhotos(prev => {
            const photoToDelete = prev.find(p => p.id === id);
            if (photoToDelete) URL.revokeObjectURL(photoToDelete.url);
            return prev.filter(p => p.id !== id);
        });
        await photoStore.deletePhoto(id);
    };

    const openLightbox = (photos: string[], index: number = 0) => {
        setLightboxSlides(photos.map(p => ({ src: p })));
        setLightboxIndex(index);
        setIsLightboxOpen(true);
    };
    
    const handleHandoverDataChange = (key: keyof any, value: string) => {
        setHandoverData((prev: any) => ({ ...prev, [key]: Number(value) }));
    };

    const handleCardRevenueChange = (key: keyof any, value: string) => {
        setHandoverData((prev: any) => ({
            ...prev,
            revenueByCard: { ...prev.revenueByCard, [key]: Number(value) }
        }));
    }
    
     const processImage = async (uri: string) => {
        setIsAiLoading(true);
        setAiError(null);
        const toastId = toast.loading('AI đang phân tích phiếu bàn giao...');
        setServerErrorDialog({ open: false, imageUri: null });

        try {
            const result = await extractHandoverData({ imageDataUri: uri });

            if (!result.isReceipt) {
                setAiError(result.rejectionReason || 'Ảnh không hợp lệ.');
                return;
            }
             if (!result.shiftEndTime) {
                setAiError('AI không thể xác định ngày giờ trên phiếu.');
                return;
            }
            
            const aiData = {
                expectedCash: result.expectedCash ?? 0,
                startOfDayCash: result.startOfDayCash ?? 0,
                cashExpense: result.cashExpense ?? 0,
                cashRevenue: result.cashRevenue ?? 0,
                deliveryPartnerPayout: result.deliveryPartnerPayout ?? 0,
                revenueByCard: result.revenueByCard || {},
            };
            
            setHandoverData(aiData);
            setAiOriginalData(aiData);
            toast.success("Đã điền dữ liệu từ phiếu. Vui lòng kiểm tra lại.");

        } catch (error: any) {
             if (error.message && (error.message.includes('503') || error.message.includes('429'))) {
                setServerErrorDialog({ open: true, imageUri: uri });
             } else {
                console.error('OCR Error:', error);
                setAiError('Lỗi AI: Không thể đọc dữ liệu từ ảnh.');
             }
        } finally {
            toast.dismiss(toastId);
            setIsAiLoading(false);
        }
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => processImage(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleRescan = async () => {
        if (!displayImageDataUri) return;
        if (displayImageDataUri.startsWith('https://')) {
            await processImage(displayImageDataUri); // Assuming it can handle proxied URLs now
        } else {
            await processImage(displayImageDataUri);
        }
    };

  const allDiscrepancyPhotos = useMemo(() => [...existingPhotos, ...localPhotos.map(p => p.url)], [existingPhotos, localPhotos]);
  
  if (!reportToEdit && !isCreating) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl" onInteractOutside={(e) => {if (!isLightboxOpen) e.preventDefault();}}>
        <div id="owner-handover-lightbox-container"></div>
        <DialogHeader>
          <DialogTitle>{isCreating ? 'Tạo Báo cáo Bàn giao' : 'Chi tiết Báo cáo Bàn giao'}</DialogTitle>
           <DialogDescription>
             Ngày: {format(parseISO(dateForNewEntry || reportToEdit!.date), 'dd/MM/yyyy')} | Lập bởi: {isCreating ? reporter.displayName : reportToEdit!.createdBy.userName}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] -mx-6 px-6">
            <div className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Ảnh phiếu bàn giao</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                             {displayImageDataUri ? (
                                <button onClick={() => openLightbox([displayImageDataUri!])} className="relative w-full aspect-[3/4] rounded-md overflow-hidden">
                                    <Image src={displayImageDataUri} alt="Handover receipt" fill className="object-contain" />
                                </button>
                            ) : <div className="aspect-[3/4] flex items-center justify-center bg-muted rounded-md text-sm text-muted-foreground">Chưa có ảnh</div>}
                            
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={isAiLoading}><Upload className="mr-2 h-4 w-4"/>Tải ảnh</Button>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*"/>
                                <Button variant="secondary" size="sm" className="w-full" onClick={() => { setActiveViolationForPenalty(false); setIsCameraOpen(true); }} disabled={isAiLoading}><Camera className="mr-2 h-4 w-4"/>Chụp ảnh</Button>
                            </div>
                            {aiError && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Lỗi</AlertTitle>
                                    <AlertDescription>{aiError}</AlertDescription>
                                </Alert>
                            )}
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-base">Dữ liệu từ Phiếu</CardTitle>
                                {displayImageDataUri && (
                                    <Button variant="secondary" size="sm" onClick={handleRescan} disabled={isAiLoading}>
                                        {isAiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
                                        Quét lại
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {handoverData ? (
                                <>
                                    {handoverFieldOrder.map((key) => {
                                        if (!(key in handoverData)) return null;
                                        return (
                                            <InputField
                                                key={`ho-${key}`} id={`ho-${key}`} label={handoverFieldLabels[key]}
                                                value={handoverData[key] as number}
                                                onChange={(val) => handleHandoverDataChange(key as any, val)}
                                                originalValue={aiOriginalData?.[key as keyof typeof aiOriginalData]}
                                            />
                                        )
                                    })}
                                    <Separator />
                                    <h4 className="font-medium text-center text-sm text-muted-foreground">Doanh thu khác</h4>
                                    {cardRevenueFieldOrder.map((cardKey) => {
                                        if (!handoverData.revenueByCard || !(cardKey in handoverData.revenueByCard)) return null;
                                        return (
                                            <InputField
                                                key={`ho-card-${cardKey}`} id={`ho-card-${cardKey}`} label={handoverFieldLabels[cardKey]}
                                                value={handoverData.revenueByCard[cardKey] as number}
                                                onChange={(val) => handleCardRevenueChange(cardKey as any, val)}
                                                originalValue={aiOriginalData?.revenueByCard?.[cardKey as keyof any]}
                                            />
                                        );
                                    })}
                                </>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-8">Chưa có dữ liệu. Vui lòng tải ảnh lên và quét.</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <Card className="border-primary">
                    <CardHeader><CardTitle className="text-base">Thông tin kiểm đếm</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="actualCash">Số tiền mặt thực tế</Label>
                            <Input id="actualCash" type="number" value={actualCash} onChange={e => setActualCash(Number(e.target.value))} />
                        </div>
                        <div className="space-y-2">
                             <Label htmlFor="discrepancyReason">Lý do chênh lệch (nếu có)</Label>
                            <Textarea id="discrepancyReason" value={discrepancyReason} onChange={e => setDiscrepancyReason(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                             <Label>Bằng chứng chênh lệch</Label>
                             <div className="flex flex-col gap-2">
                                <Button variant="outline" onClick={() => { setActiveViolationForPenalty(true); setIsCameraOpen(true); }}><Camera className="mr-2 h-4 w-4"/> Chụp ảnh mới</Button>
                                {allDiscrepancyPhotos.length > 0 ? (
                                    <div className="flex gap-2 flex-wrap">
                                        {existingPhotos.map((url, index) => (
                                            <div key={url} className="relative w-20 h-20 group">
                                                <button onClick={() => openLightbox(existingPhotos, index)} className="w-full h-full rounded-md overflow-hidden">
                                                    <Image src={url} alt="Bằng chứng" fill className="object-cover rounded-md" />
                                                </button>
                                                <Button variant="destructive" size="icon" className="absolute top-0.5 right-0.5 h-5 w-5" onClick={() => handleDeleteExistingPhoto(url)}><X className="h-3 w-3"/></Button>
                                            </div>
                                        ))}
                                         {localPhotos.map((photo, index) => (
                                            <div key={photo.id} className="relative w-20 h-20 group">
                                                 <button onClick={() => openLightbox(localPhotos.map(p => p.url), index)} className="w-full h-full rounded-md overflow-hidden">
                                                    <Image src={photo.url} alt="Bằng chứng mới" fill className="object-cover rounded-md" />
                                                </button>
                                                <Button variant="destructive" size="icon" className="absolute top-0.5 right-0.5 h-5 w-5" onClick={() => handleDeleteLocalPhoto(photo.id)}><X className="h-3 w-3"/></Button>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-xs text-muted-foreground">Chưa có ảnh bằng chứng nào.</p>}
                             </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={handleSave} disabled={isProcessing || isAiLoading}>
            {(isProcessing || isAiLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
     <CameraDialog
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onSubmit={handleCapturePhotos}
        singlePhotoMode={!activeViolationForPenalty}
    />
     <Lightbox
        open={isLightboxOpen}
        close={() => setIsLightboxOpen(false)}
        slides={lightboxSlides}
        index={lightboxIndex}
        portal={{ root: document.getElementById('owner-handover-lightbox-container') ?? undefined }}
    />
    </>
  );
}
