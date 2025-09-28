

'use client';

import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { ExtractHandoverDataOutput } from '@/lib/types';
import { Loader2, Upload, Camera, AlertCircle, RefreshCw, ServerCrash, FileText, ArrowRight, Edit, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { extractHandoverData } from '@/ai/flows/extract-handover-data-flow';
import CameraDialog from '@/components/camera-dialog';
import { photoStore } from '@/lib/photo-store';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import { parseISO, isToday, format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle as AlertDialogTitleComponent, AlertDialogFooter, AlertDialogDescription as AlertDialogDescriptionComponent } from '@/components/ui/alert-dialog';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import { Separator } from '@/components/ui/separator';
import isEqual from 'lodash.isequal';


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

const handoverFieldLabels: { [key in keyof typeof initialHandoverData]: string } = {
    expectedCash: 'Tiền mặt dự kiến',
    startOfDayCash: 'Tiền mặt đầu ca',
    cashExpense: 'Chi tiền mặt',
    cashRevenue: 'Doanh thu tiền mặt',
    deliveryPartnerPayout: 'Trả ĐTGH (khác)',
    revenueByCard: 'Doanh thu thẻ/CK',
};

const cardRevenueLabels: { [key in keyof typeof initialHandoverData.revenueByCard]: string } = {
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
    onSubmit: (data: any) => void;
    isProcessing: boolean;
};


export default function HandoverDialog({ open, onOpenChange, onSubmit, isProcessing }: HandoverDialogProps) {
    const dataSectionRef = useRef<HTMLDivElement>(null);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    
    const [imageDataUri, setImageDataUri] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    const [shiftEndTime, setShiftEndTime] = useState<string | null>(null);
    const [handoverData, setHandoverData] = useState<Omit<ExtractHandoverDataOutput, 'isReceipt' | 'rejectionReason' | 'shiftEndTime'>>(initialHandoverData);
    const [originalData, setOriginalData] = useState<Omit<ExtractHandoverDataOutput, 'isReceipt' | 'rejectionReason' | 'shiftEndTime'> | null>(null);

    const [serverErrorDialog, setServerErrorDialog] = useState<{ open: boolean, imageUri: string | null }>({ open: false, imageUri: null });
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);


    const resetState = useCallback(() => {
        setIsOcrLoading(false);
        setImageDataUri(null);
        setShiftEndTime(null);
        setHandoverData(initialHandoverData);
        setOriginalData(null);
        setServerErrorDialog({ open: false, imageUri: null });
    }, []);

    useEffect(() => { if (open) resetState(); }, [open, resetState]);
    
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


    const processImage = async (uri: string) => {
        setIsOcrLoading(true);
        const toastId = toast.loading('AI đang phân tích phiếu bàn giao...');
        setServerErrorDialog({ open: false, imageUri: null });

        try {
            const result = await extractHandoverData({ imageDataUri: uri });

            if (!result.isReceipt) {
                toast.error(result.rejectionReason || 'Ảnh không hợp lệ.');
                return;
            }
            if (!result.shiftEndTime) {
                toast.error('AI không thể xác định ngày giờ trên phiếu.');
                return;
            }
            
            // Comment out date check for testing
            /*
            const reportTime = parseISO(result.shiftEndTime);
            if (!isToday(reportTime)) {
                toast.error(`Phiếu này từ ngày ${format(reportTime, 'dd/MM/yyyy')}. Vui lòng sử dụng phiếu của ngày hôm nay.`);
                return;
            }
            */

            const aiData = {
                expectedCash: result.expectedCash ?? 0,
                startOfDayCash: result.startOfDayCash ?? 0,
                cashExpense: result.cashExpense ?? 0,
                cashRevenue: result.cashRevenue ?? 0,
                deliveryPartnerPayout: result.deliveryPartnerPayout ?? 0,
                revenueByCard: {
                    ...initialHandoverData.revenueByCard,
                    ...(result.revenueByCard || {}),
                }
            };

            setImageDataUri(uri);
            setHandoverData(aiData);
            setOriginalData(aiData);
            setShiftEndTime(result.shiftEndTime);

            toast.success("Đã điền dữ liệu từ phiếu. Vui lòng kiểm tra lại.");

        } catch (error: any) {
             if (error.message && (error.message.includes('503 Service Unavailable') || error.message.includes('429 Too Many Requests'))) {
                setServerErrorDialog({ open: true, imageUri: uri });
             } else {
                console.error('OCR Error:', error);
                toast.error('Lỗi AI: Không thể đọc dữ liệu từ ảnh.');
             }
        } finally {
            setIsOcrLoading(false);
            toast.dismiss(toastId);
        }
    };
    
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => processImage(reader.result as string);
        reader.readAsDataURL(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handlePhotoCapture = async (photoIds: string[]) => {
        setIsCameraOpen(false);
        if (photoIds.length === 0) return;
        const photoId = photoIds[0];
        try {
            const photoBlob = await photoStore.getPhoto(photoId);
            if (!photoBlob) throw new Error("Không tìm thấy ảnh.");
            const reader = new FileReader();
            reader.onloadend = () => processImage(reader.result as string);
            reader.readAsDataURL(photoBlob);
        } catch (error) {
            console.error('Error processing captured photo:', error);
            toast.error('Lỗi xử lý ảnh đã chụp.');
        } finally {
            await photoStore.deletePhoto(photoId);
        }
    };

    const handleManualEntry = () => {
        const imageUri = serverErrorDialog.imageUri;
        if (!imageUri) return;
    
        setImageDataUri(imageUri);
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
            revenueByCard: {
                ...prev.revenueByCard,
                [key]: Number(value)
            }
        }));
    }

    const handleFinalSubmit = () => {
        if (!imageDataUri) {
            toast.error("Vui lòng cung cấp ảnh phiếu bàn giao.");
            return;
        }

        const isEdited = !isEqual(originalData, handoverData);

        const dataToSubmit = {
            handoverData,
            imageDataUri,
            shiftEndTime,
            isEdited,
        };
        onSubmit(dataToSubmit);
    }
    
    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-xl h-[95vh] flex flex-col p-0" onInteractOutside={(e) => {if (!isLightboxOpen) {e.preventDefault();}}}>
                    <div id="handover-lightbox-container"></div>
                    <DialogHeader className="shrink-0 p-6 pb-0">
                        <DialogTitle>Nhập Phiếu Bàn Giao Ca</DialogTitle>
                        <DialogDescription>
                           Tải hoặc chụp ảnh phiếu bàn giao để AI điền tự động.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-grow overflow-y-auto px-6">
                        <div className="space-y-6 py-4">
                            <Card>
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-base">Ảnh phiếu bàn giao (bắt buộc)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                     {imageDataUri ? (
                                        <div className="relative w-full h-full min-h-48 cursor-pointer" onClick={() => setIsLightboxOpen(true)}>
                                            <Image src={imageDataUri} alt="Ảnh phiếu bàn giao" fill className="object-contain rounded-md" />
                                        </div>
                                    ) : (
                                        <div className="w-full h-24 flex items-center justify-center bg-muted rounded-md border-2 border-dashed">
                                            <p className="text-sm text-muted-foreground">Tải ảnh lên để tiếp tục</p>
                                        </div>
                                    )}
                                    <div className="flex flex-col sm:flex-row gap-2 w-full max-w-sm mx-auto mt-4">
                                        <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isOcrLoading || isProcessing} className="w-full"><Upload className="mr-2 h-4 w-4"/> Tải ảnh</Button>
                                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                                        <Button variant="secondary" onClick={() => setIsCameraOpen(true)} disabled={isOcrLoading || isProcessing} className="w-full"><Camera className="mr-2 h-4 w-4"/> Chụp ảnh</Button>
                                    </div>
                                </CardContent>
                            </Card>
                            
                            {originalData && (
                                <div ref={dataSectionRef} className="space-y-4 rounded-md border bg-muted/30 shadow-inner p-4">
                                    {shiftEndTime && (
                                        <Card><CardContent className="p-3 text-center text-sm font-semibold flex items-center justify-center gap-2"><Clock className="h-4 w-4"/>Thời gian trên phiếu: {format(parseISO(shiftEndTime), 'HH:mm:ss, dd/MM/yyyy')}</CardContent></Card>
                                    )}
                                     <Card>
                                        <CardContent className="p-4 space-y-3">
                                            {Object.entries(handoverData).map(([key, value]) => {
                                                if (key === 'revenueByCard') return null;
                                                return (
                                                    <InputField
                                                        key={`ho-${key}`}
                                                        id={`ho-${key}`}
                                                        label={handoverFieldLabels[key as keyof typeof handoverFieldLabels]}
                                                        value={value as number}
                                                        onChange={(val) => handleHandoverDataChange(key as any, val)}
                                                        originalValue={originalData?.[key as keyof typeof originalData]}
                                                    />
                                                )
                                            })}
                                            <Separator />
                                            <h4 className="font-medium text-center">Doanh thu khác</h4>
                                            {Object.entries(handoverData.revenueByCard).map(([cardKey, cardValue]) => (
                                                <InputField
                                                    key={`ho-card-${cardKey}`}
                                                    id={`ho-card-${cardKey}`}
                                                    label={cardRevenueLabels[cardKey as keyof typeof cardRevenueLabels]}
                                                    value={cardValue as number}
                                                    onChange={(val) => handleCardRevenueChange(cardKey as any, val)}
                                                    originalValue={originalData?.revenueByCard?.[cardKey as keyof typeof originalData.revenueByCard]}
                                                />
                                            ))}
                                        </CardContent>
                                    </Card>
                                </div>
                            )}

                        </div>
                    </div>

                    <DialogFooter className="shrink-0 p-6 pt-0">
                         <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
                         <Button onClick={handleFinalSubmit} disabled={isProcessing || isOcrLoading || !imageDataUri}>
                            {(isProcessing || isOcrLoading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ArrowRight className="mr-2 h-4 w-4"/>}
                            Tiếp tục
                         </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <CameraDialog isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onSubmit={handlePhotoCapture} singlePhotoMode={true} />

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
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                        <Button variant="outline" className="w-full" onClick={() => setServerErrorDialog({ open: false, imageUri: null })}>Hủy</Button>
                        <Button variant="secondary" className="w-full" onClick={() => processImage(serverErrorDialog.imageUri!)}>
                           <RefreshCw className="mr-2 h-4 w-4" /> Thử lại
                        </Button>
                         <Button className="w-full" onClick={handleManualEntry}>
                            <FileText className="mr-2 h-4 w-4" /> Nhập thủ công
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            {imageDataUri && (
                 <Lightbox
                    open={isLightboxOpen}
                    close={() => setIsLightboxOpen(false)}
                    slides={[{ src: imageDataUri }]}
                    plugins={[Zoom]}
                    portal={{ root: document.getElementById("handover-lightbox-container") ?? undefined }}
                    carousel={{ finite: true }}
                    zoom={{ maxZoomPixelRatio: 5 }}
                />
            )}
        </>
    );
}
