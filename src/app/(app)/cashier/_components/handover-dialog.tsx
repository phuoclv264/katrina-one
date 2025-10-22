
'use client';

import * as React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle, 
  DialogDescription,
  DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ExtractHandoverDataOutput, HandoverReport, AuthUser } from '@/lib/types';
import { Loader2, Upload, AlertCircle, RefreshCw, ServerCrash, FileText, ArrowRight, Edit, Clock, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { extractHandoverData } from '@/ai/flows/extract-handover-data-flow';
import { photoStore } from '@/lib/photo-store';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle as AlertDialogTitleComponent, AlertDialogFooter as AlertDialogFooterComponent, AlertDialogDescription as AlertDialogDescriptionComponent } from '@/components/ui/alert-dialog';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import { Separator } from '@/components/ui/separator';
import isEqual from 'lodash.isequal';
import { ScrollArea } from '@/components/ui/scroll-area';
import { v4 as uuidv4 } from 'uuid';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { parseISO, format, isSameDay, isToday } from 'date-fns';


const initialHandoverData = {
    expectedCash: 0,
    startOfDayCash: 0,
    cashExpense: 0,
    cashRevenue: 0,
    deliveryPartnerPayout: 0,
    revenueByCard: {
        techcombankVietQrPro: 0,
        shopeeFood: 0,
        grabFood: 0,
        bankTransfer: 0,
    }
};

const handoverFieldOrder: (keyof Omit<ExtractHandoverDataOutput, 'isReceipt' | 'rejectionReason' | 'shiftEndTime' | 'revenueByCard'>)[] = [
    'startOfDayCash', 'cashRevenue', 'cashExpense', 'deliveryPartnerPayout', 'expectedCash'
];
const cardRevenueFieldOrder: (keyof typeof initialHandoverData.revenueByCard)[] = [
    'techcombankVietQrPro', 'bankTransfer', 'shopeeFood', 'grabFood'
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


const InputField = React.memo(({ id, label, value, onChange, originalValue }: {
    id: string;
    label: string;
    value: number;
    onChange: (val: string) => void;
    originalValue?: number;
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
            <Input id={id} type="number" value={localValue} onChange={e => setLocalValue(e.target.value)} onBlur={handleBlur} onFocus={(e) => e.target.select()} placeholder="0" className="text-right h-9" />
        </div>
    );
});
InputField.displayName = 'InputField';

type HandoverDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: any, id?: string) => void;
    isProcessing: boolean;
    // For Owner/Manager view
    reportToEdit?: HandoverReport | null;
    reporter?: AuthUser;
    dateForNewEntry?: string | null;
    isOwnerView?: boolean;
};


export default function HandoverDialog({
    open,
    onOpenChange,
    onSubmit,
    isProcessing,
    reportToEdit = null,
    reporter,
    dateForNewEntry = null,
    isOwnerView = false,
}: HandoverDialogProps) {
    const dataSectionRef = useRef<HTMLDivElement>(null);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [shiftEndTime, setShiftEndTime] = useState<string | null>(null);
    const [handoverData, setHandoverData] = useState<Omit<ExtractHandoverDataOutput, 'isReceipt' | 'rejectionReason' | 'shiftEndTime'>>(initialHandoverData);
    const [originalData, setOriginalData] = useState<Omit<ExtractHandoverDataOutput, 'isReceipt' | 'rejectionReason' | 'shiftEndTime'> | null>(null);

    const [existingPhotos, setExistingPhotos] = useState<{ id: string, url: string }[]>([]);
    const [localPhotos, setLocalPhotos] = useState<{ id: string, url: string }[]>([]);
    const [photosToDelete, setPhotosToDelete] = useState<string[]>([]);
    
    const [newImageDataUri, setNewImageDataUri] = useState<string | null>(null);
    const displayImageDataUri = newImageDataUri || reportToEdit?.handoverImageUrl;

    const [serverErrorDialog, setServerErrorDialog] = useState<{ open: boolean, imageUri: string | null }>({ open: false, imageUri: null });
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    
    const isCreating = !reportToEdit;

    const resetState = useCallback(() => {
        setIsOcrLoading(false);
        setAiError(null);
        setNewImageDataUri(null);
        setShiftEndTime(null);
        setHandoverData(initialHandoverData);
        setOriginalData(null);
        setServerErrorDialog({ open: false, imageUri: null });

        setLocalPhotos([]);
        setPhotosToDelete([]);

    }, [reportToEdit]);

    useEffect(() => { if (open) resetState(); }, [open, resetState]);
    
    useEffect(() => {
        if (reportToEdit) {
            setHandoverData(reportToEdit.handoverData);
            setOriginalData(reportToEdit.handoverData);
            setShiftEndTime(reportToEdit.shiftEndTime || null);
            setExistingPhotos(reportToEdit.handoverImageUrl ? [{ id: reportToEdit.handoverImageUrl, url: reportToEdit.handoverImageUrl }] : []);
        }
    }, [reportToEdit]);

    useEffect(() => {
        if (originalData && dataSectionRef.current) {
            setTimeout(() => dataSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }
    }, [originalData]);
    
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            if (isLightboxOpen) { event.preventDefault(); setIsLightboxOpen(false); }
        };
        if (isLightboxOpen) {
            window.history.pushState(null, '', window.location.href);
            window.addEventListener('popstate', handlePopState);
        }
        return () => { window.removeEventListener('popstate', handlePopState); };
    }, [isLightboxOpen]);

    const validateReportDate = useCallback((shiftEndTime: string): boolean => {
        try {
            const reportDate = parseISO(shiftEndTime);
            const targetDate = parseISO(dateForNewEntry || reportToEdit?.date || new Date().toISOString());

            if (isOwnerView) {
                if (!isSameDay(reportDate, targetDate)) {
                    setAiError(`Ngày trên phiếu (${format(reportDate, 'dd/MM/yyyy')}) không khớp với ngày bạn đang thao tác (${format(targetDate, 'dd/MM/yyyy')}).`);
                    return false;
                }
            } else { // Cashier view
                if (!isToday(reportDate)) {
                    setAiError(`Phiếu này từ ngày ${format(reportDate, 'dd/MM/yyyy')}. Vui lòng sử dụng phiếu của ngày hôm nay.`);
                    return false;
                }
            }
            return true;
        } catch (error) {
            setAiError('Không thể xác thực ngày giờ trên phiếu.');
            return false;
        }
    }, [dateForNewEntry, reportToEdit, isOwnerView]);

    const allPhotos = useMemo(() => {
        return [...existingPhotos, ...localPhotos];
    }, [existingPhotos, localPhotos]);


    const processImage = async (uri: string) => {
        setIsOcrLoading(true);
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
            
            if (!validateReportDate(result.shiftEndTime)) {
                return;
            }

            const aiData = {
                expectedCash: result.expectedCash ?? 0,
                startOfDayCash: result.startOfDayCash ?? 0,
                cashExpense: result.cashExpense ?? 0,
                cashRevenue: result.cashRevenue ?? 0,
                deliveryPartnerPayout: result.deliveryPartnerPayout ?? 0,
                revenueByCard: { ...initialHandoverData.revenueByCard, ...(result.revenueByCard || {}) }
            };

            setNewImageDataUri(uri);
            setHandoverData(aiData);
            setOriginalData(aiData);
            setShiftEndTime(result.shiftEndTime);

            toast.success("Đã điền dữ liệu từ phiếu. Vui lòng kiểm tra lại.");

        } catch (error: any) {
             if (error.message && (error.message.includes('503 Service Unavailable') || error.message.includes('429 Too Many Requests'))) {
                setServerErrorDialog({ open: true, imageUri: uri });
             } else {
                console.error('OCR Error:', error);
                setAiError('Lỗi AI: Không thể đọc dữ liệu từ ảnh.');
             }
        } finally {
            setIsOcrLoading(false);
            toast.dismiss(toastId);
        }
    };
    
     const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        try {
            const newPhotos = await Promise.all(Array.from(files).map(async (file) => {
                const photoId = uuidv4();
                await photoStore.addPhoto(photoId, file);
                const objectUrl = URL.createObjectURL(file);
                return { id: photoId, url: objectUrl };
            }));
            setLocalPhotos(prev => [...prev, ...newPhotos]);
        } catch (error) {
            toast.error("Lỗi khi thêm ảnh.");
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleManualEntry = () => {
        const imageUri = serverErrorDialog.imageUri;
        if (!imageUri) return;
    
        setNewImageDataUri(imageUri);
        setHandoverData(initialHandoverData);
        setOriginalData(initialHandoverData); // Set original to zeros so any entry is an "edit"
        setShiftEndTime(null);
    
        setServerErrorDialog({ open: false, imageUri: null });
        toast.success("Chuyển sang nhập thủ công. Vui lòng nhập các số liệu từ phiếu.");
    };

    const handleHandoverDataChange = (key: keyof typeof handoverData, value: string) => {
        if (key === 'revenueByCard') return;
        setHandoverData(prev => ({ ...prev, [key]: Number(value) }));
    };

    const handleCardRevenueChange = (key: keyof typeof initialHandoverData.revenueByCard, value: string) => {
        setHandoverData(prev => ({
            ...prev,
            revenueByCard: { ...prev.revenueByCard, [key]: Number(value) }
        }));
    }

    const handleFinalSubmit = () => {
        if (allPhotos.length === 0) {
            setAiError("Vui lòng cung cấp ảnh phiếu bàn giao.");
            return;
        }

        const isEdited = !isEqual(originalData, handoverData);
        
        const dataToSubmit = {
            handoverData,
            newPhotoIds: localPhotos.map(p => p.id),
            shiftEndTime,
            photosToDelete,
            isEdited,
        };
        
        if(isOwnerView) {
            onSubmit(dataToSubmit, reportToEdit?.id);
        } else {
            onSubmit(dataToSubmit);
        }
    }
    
    const handleRescan = async () => {
        if (allPhotos.length === 0) {
            toast.error("Vui lòng tải lên ít nhất một ảnh để quét.");
            return;
        }
        
        setIsOcrLoading(true);
        setAiError(null);
        const toastId = toast.loading('AI đang phân tích các phiếu bàn giao...');

        try {
            const imageUris = await Promise.all(allPhotos.map(async (photo) => {
                if (photo.url.startsWith('blob:')) {
                    const blob = await photoStore.getPhoto(photo.id);
                    if (!blob) return null;
                    return new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                }
                // It's a Firebase URL, proxy it
                const response = await fetch(`/api/image-proxy?url=${encodeURIComponent(photo.url)}`);
                if (!response.ok) return null;
                const { dataUri } = await response.json();
                return dataUri;
            }));

            const validUris = imageUris.filter((uri): uri is string => !!uri);
            if (validUris.length === 0) {
                throw new Error("Không thể xử lý bất kỳ ảnh nào.");
            }

            const results = await Promise.all(validUris.map(uri => extractHandoverData({ imageDataUri: uri })));

            // Validate each result before proceeding
            for (const result of results) {
                if (!result.isReceipt || !result.shiftEndTime) {
                    setAiError("Một trong các ảnh không phải là phiếu bàn giao hợp lệ hoặc không có ngày giờ.");
                    return;
                }
                if (!validateReportDate(result.shiftEndTime)) {
                    // validateReportDate will set the specific error message
                    return;
                }
            }

            if (results.length === 0) {
                setAiError("Không tìm thấy phiếu bàn giao hợp lệ nào trong các ảnh đã tải lên.");
                return;
            }

            const combinedData = results.reduce((acc, result) => {
                handoverFieldOrder.forEach(key => {
                    acc[key] = (acc[key] || 0) + (result[key] || 0);
                });
                cardRevenueFieldOrder.forEach(key => {
                    acc.revenueByCard[key] = (acc.revenueByCard[key] || 0) + (result.revenueByCard?.[key] || 0);
                });
                return acc;
            }, { ...initialHandoverData });

            const latestReport = results.reduce((latest, current) => 
                parseISO(current.shiftEndTime!) > parseISO(latest.shiftEndTime!) ? current : latest
            );

            setHandoverData(combinedData);
            setOriginalData(combinedData);
            setShiftEndTime(latestReport.shiftEndTime!);

            toast.success(`Đã tổng hợp dữ liệu từ ${results.length} phiếu. Vui lòng kiểm tra lại.`);

        } catch (error: any) {
            console.error("OCR Error:", error);
            setAiError(`Lỗi AI: ${error.message || 'Không thể đọc dữ liệu từ ảnh.'}`);
        } finally {
            setIsOcrLoading(false);
            toast.dismiss(toastId);
        }
    };
    
    const handleDeleteExistingPhoto = (url: string) => {
        setExistingPhotos(prev => prev.filter(p => p.url !== url));
        setPhotosToDelete(prev => [...prev, url]);
    };

    const handleDeleteLocalPhoto = (id: string) => {
        setLocalPhotos(prev => {
            const photoToDelete = prev.find(p => p.id === id);
            if (photoToDelete) URL.revokeObjectURL(photoToDelete.url);
            return prev.filter(p => p.id !== id);
        });
        photoStore.deletePhoto(id);
    };

    const dialogTitle = isOwnerView 
        ? (isCreating ? 'Tạo Báo cáo Bàn giao' : 'Chi tiết Báo cáo Bàn giao') 
        : 'Nhập Phiếu Bàn Giao Ca';
        
    const dialogDescription = isOwnerView && !isCreating
        ? `Ngày: ${format(parseISO(reportToEdit!.date), 'dd/MM/yyyy')} | Lập bởi: ${reportToEdit!.createdBy.userName}`
        : 'Tải hoặc chụp ảnh phiếu bàn giao để AI điền tự động.';

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-xl h-[95vh] flex flex-col p-0" onPointerDownOutside={(e) => {if (!isLightboxOpen) e.preventDefault();}}>
                    <div id="handover-lightbox-container"></div>
                    <DialogHeader className="shrink-0 p-6 pb-4 border-b bg-muted/30">
                        <DialogTitle>{dialogTitle}</DialogTitle>
                        <DialogDescription>{dialogDescription}</DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="flex-grow">
                        <div className="space-y-6 p-6">
                            <Card>
                                <CardHeader className="pb-4 flex flex-col gap-y-2 gap-x-4 sm:flex-row sm:items-center sm:justify-between">
                                    <CardTitle className="text-base">Ảnh phiếu bàn giao (bắt buộc)</CardTitle>
                                    {allPhotos.length > 0 && (
                                        <Button variant="secondary" size="sm" onClick={handleRescan} disabled={isOcrLoading} className="w-full sm:w-auto">
                                            {isOcrLoading ? <Loader2 className="mr-2 h-5 w-5 sm:h-4 sm:w-4 animate-spin"/> : <RefreshCw className="mr-2 h-5 w-5 sm:h-4 sm:w-4"/>}
                                            Quét dữ liệu bằng AI
                                        </Button>
                                    )}
                                </CardHeader>
                                <CardContent>
                                     {allPhotos.length > 0 ? (
                                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                            {allPhotos.map((photo, index) => (
                                                <div key={photo.id} className="relative aspect-square rounded-md overflow-hidden group bg-muted">
                                                    <button onClick={() => setIsLightboxOpen(true)} className="w-full h-full">
                                                        <Image src={photo.url} alt={`Bằng chứng ${index + 1}`} fill className="object-cover" />
                                                    </button>
                                                    <Button variant="destructive" size="icon" className="absolute -top-1 -right-1 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100" onClick={() => {
                                                        const isLocal = localPhotos.some(p => p.id === photo.id);
                                                        if (isLocal) handleDeleteLocalPhoto(photo.id); else handleDeleteExistingPhoto(photo.url);
                                                    }}><X className="h-3 w-3" /></Button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="w-full h-24 flex items-center justify-center bg-muted rounded-md border-2 border-dashed">
                                            <p className="text-sm text-muted-foreground">Tải ảnh lên để tiếp tục</p>
                                        </div>
                                    )}
                                    {aiError && (
                                        <Alert variant="destructive" className="mt-4">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertTitle>Lỗi</AlertTitle>
                                            <AlertDescription>{aiError}</AlertDescription>
                                        </Alert>
                                    )}
                                     <div className="flex justify-center mt-4">
                                        <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isOcrLoading || isProcessing} className="w-full max-w-xs"><Upload className="mr-2 h-4 w-4"/> Tải ảnh</Button>
                                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" multiple />
                                    </div>
                                </CardContent>
                            </Card>
                            
                            {(originalData || handoverData) && (
                                <div ref={dataSectionRef} className="space-y-4 rounded-md border bg-muted/30 shadow-inner p-4">
                                    {shiftEndTime && (
                                        <Card><CardContent className="p-3 text-center text-sm font-semibold flex items-center justify-center gap-2"><Clock className="h-4 w-4"/>Thời gian trên phiếu: {format(parseISO(shiftEndTime), 'HH:mm:ss, dd/MM/yyyy')}</CardContent></Card>
                                    )}
                                     <Card>
                                        <CardContent className="p-4 space-y-3">
                                            {handoverFieldOrder.map((key) => (
                                                <InputField
                                                    key={`ho-${key}`} id={`ho-${key}`} label={handoverFieldLabels[key]}
                                                    value={handoverData?.[key] as number ?? 0}
                                                    onChange={(val) => handleHandoverDataChange(key as any, val)}
                                                    originalValue={
                                                        typeof originalData?.[key as keyof typeof originalData] === "number"
                                                            ? (originalData?.[key as keyof typeof originalData] as number)
                                                            : undefined
                                                        }
                                                />
                                            ))}
                                            <Separator />
                                            <h4 className="font-medium text-center">Doanh thu khác</h4>
                                            {cardRevenueFieldOrder.map((cardKey) => (
                                                <InputField
                                                    key={`ho-card-${cardKey}`} id={`ho-card-${cardKey}`} label={handoverFieldLabels[cardKey]}
                                                    value={handoverData?.revenueByCard?.[cardKey as keyof typeof handoverData.revenueByCard] as number ?? 0}
                                                    onChange={(val) => handleCardRevenueChange(cardKey as any, val)}
                                                    originalValue={
                                                        typeof originalData?.revenueByCard?.[cardKey as keyof typeof originalData.revenueByCard] === "number"
                                                            ? (originalData?.revenueByCard?.[cardKey as keyof typeof originalData.revenueByCard] as number)
                                                            : undefined
                                                        }
                                                />
                                            ))}
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    <DialogFooter className="shrink-0 p-6 pt-0 border-t bg-muted/30">
                         <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
                         <Button onClick={handleFinalSubmit} disabled={isProcessing || isOcrLoading || allPhotos.length === 0}>
                            {(isProcessing || isOcrLoading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (isOwnerView ? <FileText className="mr-2 h-4 w-4"/> : <ArrowRight className="mr-2 h-4 w-4"/>)}
                            {isOwnerView ? 'Lưu báo cáo' : 'Tiếp tục'}
                         </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={serverErrorDialog.open}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                         <AlertDialogTitleComponent className="flex items-center gap-2">
                            <ServerCrash className="text-destructive"/> Lỗi phân tích ảnh
                        </AlertDialogTitleComponent>
                        <AlertDialogDescriptionComponent>
                           Mô hình AI đang gặp sự cố hoặc quá tải. Vui lòng chọn một trong các tùy chọn sau.
                        </AlertDialogDescriptionComponent>
                    </AlertDialogHeader>
                    <AlertDialogFooterComponent className="flex-col sm:flex-row gap-2">
                        <Button variant="outline" className="w-full" onClick={() => setServerErrorDialog({ open: false, imageUri: null })}>Hủy</Button>
                        <Button variant="secondary" className="w-full" onClick={() => processImage(serverErrorDialog.imageUri!)}>
                           <RefreshCw className="mr-2 h-4 w-4" /> Thử lại
                        </Button>
                         <Button className="w-full" onClick={handleManualEntry}>
                            <FileText className="mr-2 h-4 w-4" /> Nhập thủ công
                        </Button>
                    </AlertDialogFooterComponent>
                </AlertDialogContent>
            </AlertDialog>
            
            <Lightbox open={isLightboxOpen} close={() => setIsLightboxOpen(false)} slides={allPhotos.map(p => ({ src: p.url }))} plugins={[Zoom]} portal={{ root: document.getElementById("handover-lightbox-container") ?? undefined }} carousel={{ finite: true }} zoom={{ maxZoomPixelRatio: 5 }} />
        </>
    );
}
