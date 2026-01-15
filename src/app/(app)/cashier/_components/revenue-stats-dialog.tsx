
'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { RevenueStats, AuthUser, MediaItem } from '@/lib/types';
import { Loader2, Upload, AlertCircle, Clock, Info, Edit, Eye, FileText, ImageIcon, RefreshCw, ServerCrash, Camera } from 'lucide-react';
import { toast } from '@/components/ui/pro-toast';
import { callExtractRevenueFromImage } from '@/lib/ai-service';
import { photoStore } from '@/lib/photo-store';
import Image from 'next/image';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { format, isToday, isBefore, startOfDay, parseISO, isSameDay } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import isEqual from 'lodash.isequal';
import CameraDialog from '@/components/camera-dialog';
import { useLightbox } from '@/contexts/lightbox-context';


type RevenueStatsDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: Omit<RevenueStats, 'id' | 'date' | 'createdAt' | 'createdBy' | 'isEdited'>, isEdited: boolean) => void | Promise<void>;
    isProcessing: boolean;
    existingStats: RevenueStats | null;
    isOwnerView?: boolean;
    reporter?: AuthUser;
    dateForNewEntry?: string | null;
};

const initialPaymentMethods = {
    techcombankVietQrPro: 0,
    cash: 0,
    shopeeFood: 0,
    grabFood: 0,
    bankTransfer: 0,
};

const paymentMethodLabels: { [key in keyof typeof initialPaymentMethods]: string } = {
    techcombankVietQrPro: "TCB VietQR Pro",
    cash: "Tiền mặt",
    shopeeFood: "ShopeeFood",
    grabFood: "Grab Food",
    bankTransfer: "Chuyển Khoản",
};

const paymentMethodOrder = Object.keys(paymentMethodLabels) as (keyof typeof initialPaymentMethods)[];

const InputField = React.memo(({ id, label, value, onChange, originalValue, isImportant, isSubtle, inputClassName, disabled }: {
    id: string;
    label: string;
    value: number;
    onChange: (val: string) => void;
    originalValue?: number;
    isImportant?: boolean;
    isSubtle?: boolean;
    inputClassName?: string;
    disabled?: boolean;
}) => {
    const [localValue, setLocalValue] = useState(String(value));

    useEffect(() => {
        setLocalValue(String(value));
    }, [value]);

    const handleBlur = () => {
        if (String(value) !== localValue) {
            onChange(localValue);
        }
    };

    const isEdited = originalValue !== undefined && value !== originalValue;

    return (
        <div key={id} className="grid grid-cols-2 items-center gap-2">
            <Label htmlFor={id} className={cn(isSubtle ? "text-sm text-muted-foreground" : "text-base", "text-right flex items-center gap-2 justify-end", isImportant && "font-bold")}>
                {isEdited && <Edit className="h-3 w-3 text-yellow-500" />}
                {label}
            </Label>
            <Input
                id={id}
                type="number"
                value={localValue}
                onChange={e => setLocalValue(e.target.value)}
                onBlur={handleBlur}
                onFocus={(e) => e.target.select()}
                placeholder="0"
                className={cn(isImportant ? "h-11" : "h-9", "text-right", inputClassName)}
                disabled={disabled}
            />
        </div>
    );
});
InputField.displayName = 'InputField';


export default function RevenueStatsDialog({
    open,
    onOpenChange,
    onSave,
    isProcessing,
    existingStats,
    isOwnerView = false,
    reporter,
    dateForNewEntry,
}: RevenueStatsDialogProps) {
    const { openLightbox } = useLightbox();
    // Form state
    const [netRevenue, setNetRevenue] = useState(0);
    const [deliveryPartnerPayout, setDeliveryPartnerPayout] = useState(0);
    const [revenueByPaymentMethod, setRevenueByPaymentMethod] = useState(initialPaymentMethods);
    const [reportTimestamp, setReportTimestamp] = useState<string | null>(null);

    // AI Original state for comparison
    const [aiOriginalData, setAiOriginalData] = useState<Partial<RevenueStats> | null>(null);

    // UI & Flow state
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dataSectionRef = useRef<HTMLDivElement>(null);
    const [newImageDataUri, setNewImageDataUri] = useState<string | null>(null);
    const [showMissingImageAlert, setShowMissingImageAlert] = useState(false);
    const [serverErrorDialog, setServerErrorDialog] = useState<{ open: boolean, imageUri: string | null }>({ open: false, imageUri: null });
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    const displayImageDataUri = newImageDataUri || (existingStats?.invoiceImageUrl);

    const canEdit = useMemo(() => {
        if (isOwnerView) return true; // Owner can always edit
        if (existingStats) {
            // Cashier can only edit their own entries
            return reporter?.uid === existingStats.createdBy.userId;
        }
        // Cashier creating new entry is always allowed.
        return true;
    }, [isOwnerView, existingStats, reporter]);


    const resetFormState = useCallback((statsToLoad: RevenueStats | null) => {
        if (statsToLoad) {
            setNetRevenue(statsToLoad.netRevenue || 0);
            setDeliveryPartnerPayout(statsToLoad.deliveryPartnerPayout || 0);
            setRevenueByPaymentMethod(statsToLoad.revenueByPaymentMethod || initialPaymentMethods);
            setReportTimestamp(statsToLoad.reportTimestamp || null);
            setNewImageDataUri(statsToLoad.invoiceImageUrl || null);
            setAiOriginalData(statsToLoad);
        } else {
            setNetRevenue(0);
            setDeliveryPartnerPayout(0);
            setRevenueByPaymentMethod(initialPaymentMethods);
            setReportTimestamp(null);
            setNewImageDataUri(null);
            setAiOriginalData(null);
        }
        setAiError(null);
        setServerErrorDialog({ open: false, imageUri: null });
    }, []);

    useEffect(() => {
        if (open) {
            resetFormState(existingStats);
        }
    }, [open, existingStats, resetFormState]);

    // Auto-scroll to data section when original data is populated
    useEffect(() => {
        if ((aiOriginalData || existingStats) && dataSectionRef.current) {
            setTimeout(() => {
                dataSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }, [aiOriginalData, existingStats]);


    const handlePaymentMethodChange = useCallback((key: keyof typeof revenueByPaymentMethod, value: string) => {
        setRevenueByPaymentMethod(prev => ({ ...prev, [key]: Number(value) }));
    }, []);

    const totalPaymentMethods = useMemo(() => {
        return Object.values(revenueByPaymentMethod).reduce((sum, val) => sum + val, 0);
    }, [revenueByPaymentMethod]);

    const isRevenueMismatch = netRevenue > 0 && Math.abs(netRevenue - totalPaymentMethods) > 1; // Allow for rounding errors

    const wasEditedByCashier = existingStats?.isEdited || false;

    const handleSave = () => {
        if (!displayImageDataUri) {
            setShowMissingImageAlert(true);
            return;
        }

        if (isRevenueMismatch) {
            toast.error("Tổng doanh thu theo phương thức thanh toán phải bằng Doanh thu Net.");
            return;
        }

        let isAiFlag = false;
        const currentDataForComparison = { netRevenue, deliveryPartnerPayout, revenueByPaymentMethod };

        if (aiOriginalData) {
            const aiDataForComparison = {
                netRevenue: aiOriginalData.netRevenue || 0,
                deliveryPartnerPayout: aiOriginalData.deliveryPartnerPayout || 0,
                revenueByPaymentMethod: aiOriginalData.revenueByPaymentMethod || initialPaymentMethods,
            };
            isAiFlag = isEqual(currentDataForComparison, aiDataForComparison);
        } else if (existingStats?.isAiGenerated) {
            const existingDataForComparison = {
                netRevenue: existingStats.netRevenue || 0,
                deliveryPartnerPayout: existingStats.deliveryPartnerPayout || 0,
                revenueByPaymentMethod: existingStats.revenueByPaymentMethod || initialPaymentMethods,
            };
            isAiFlag = isEqual(currentDataForComparison, existingDataForComparison);
        }

        const dataToSave = {
            netRevenue,
            revenueByPaymentMethod,
            deliveryPartnerPayout,
            invoiceImageUrl: newImageDataUri || (isOwnerView ? existingStats?.invoiceImageUrl : null),
            reportTimestamp: reportTimestamp,
            isAiGenerated: isAiFlag,
        };

        let isEditedNow = false;
        if (aiOriginalData) {
            if (netRevenue !== aiOriginalData.netRevenue) isEditedNow = true;
            if (deliveryPartnerPayout !== aiOriginalData.deliveryPartnerPayout) isEditedNow = true;
            if (!isEditedNow) {
                for (const key in revenueByPaymentMethod) {
                    if (revenueByPaymentMethod[key as keyof typeof revenueByPaymentMethod] !== aiOriginalData.revenueByPaymentMethod?.[key as keyof typeof initialPaymentMethods]) {
                        isEditedNow = true;
                        break;
                    }
                }
            }
        } else if (existingStats) {
            const hasBeenEdited = useMemo(() => {
                if (!existingStats) return false;
                if (netRevenue !== existingStats.netRevenue) return true;
                if (deliveryPartnerPayout !== existingStats.deliveryPartnerPayout) return true;
                for (const key in revenueByPaymentMethod) {
                    if (revenueByPaymentMethod[key as keyof typeof revenueByPaymentMethod] !== existingStats.revenueByPaymentMethod?.[key as keyof typeof initialPaymentMethods]) {
                        return true;
                    }
                }
                return false;
            }, [existingStats, netRevenue, deliveryPartnerPayout, revenueByPaymentMethod]);
            isEditedNow = hasBeenEdited;
        }

        onSave(dataToSave as Omit<RevenueStats, 'id' | 'date' | 'createdAt' | 'createdBy' | 'isEdited'>, isEditedNow || wasEditedByCashier);
    }

    const processImage = async (imageUri: string) => {
        setIsOcrLoading(true);
        setAiError(null);
        const toastId = toast.loading('AI đang phân tích phiếu...');
        setServerErrorDialog({ open: false, imageUri: null });
        setNewImageDataUri(imageUri);

        try {
            const result = await callExtractRevenueFromImage({ imageDataUri: imageUri });

            if (!result.isReceipt) {
                setAiError(result.rejectionReason || 'Ảnh không hợp lệ.');
                return;
            }

            if (!result.reportTimestamp) {
                setAiError('AI không thể xác định ngày giờ trên phiếu.');
                return;
            }

            const reportDate = parseISO(result.reportTimestamp);
            const targetDateString = existingStats?.date || dateForNewEntry;
            const targetDate = targetDateString ? parseISO(targetDateString) : startOfDay(new Date());


            if (!isOwnerView && !isToday(reportDate)) {
                setAiError(`Phiếu này từ ngày ${format(reportDate, 'dd/MM/yyyy')}. Vui lòng sử dụng phiếu của ngày hôm nay.`);
                return;
            }
            if (isOwnerView && !isSameDay(reportDate, targetDate)) {
                setAiError(`Ngày trên phiếu (${format(reportDate, 'dd/MM/yyyy')}) không khớp với ngày bạn đang thao tác (${format(targetDate, 'dd/MM/yyyy')}).`);
                return;
            }

            setReportTimestamp(result.reportTimestamp || null);

            const aiData = {
                netRevenue: result.netRevenue || 0,
                deliveryPartnerPayout: result.deliveryPartnerPayout || 0,
                revenueByPaymentMethod: { ...initialPaymentMethods, ...result.revenueByPaymentMethod },
                reportTimestamp: result.reportTimestamp,
            };

            setNetRevenue(aiData.netRevenue);
            setDeliveryPartnerPayout(aiData.deliveryPartnerPayout);
            setRevenueByPaymentMethod(aiData.revenueByPaymentMethod);

            setAiOriginalData(aiData);

            toast.success('Đã điền dữ liệu từ ảnh. Vui lòng kiểm tra lại.');

        } catch (error: any) {
            if (error.message && (error.message.includes('503 Service Unavailable') || error.message.includes('429 Too Many Requests'))) {
                setServerErrorDialog({ open: true, imageUri });
            } else {
                console.error('OCR Error:', error);
                setAiError('Lỗi AI: Không thể đọc dữ liệu từ ảnh.');
            }
        } finally {
            setIsOcrLoading(false);
            toast.dismiss(toastId);
        }
    };

    const handleManualEntry = () => {
        const imageUri = serverErrorDialog.imageUri;
        if (!imageUri) return;

        setNewImageDataUri(imageUri);
        setNetRevenue(0);
        setDeliveryPartnerPayout(0);
        setRevenueByPaymentMethod(initialPaymentMethods);
        setReportTimestamp(null);
        setAiOriginalData({
            netRevenue: 0,
            deliveryPartnerPayout: 0,
            revenueByPaymentMethod: initialPaymentMethods,
            reportTimestamp: undefined,
        });

        setServerErrorDialog({ open: false, imageUri: null });
        toast.success("Chuyển sang nhập thủ công.");
    };


    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const imageUri = reader.result as string;
            processImage(imageUri);
        };
        reader.readAsDataURL(file);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleCapturePhoto = async (media: MediaItem[]) => {
        setIsCameraOpen(false);
        const photo = media.find(m => m.type === 'photo');
        if (!photo) return;

        const photoBlob = await photoStore.getPhoto(photo.id);
        if (photoBlob) {
            const reader = new FileReader();
            reader.onloadend = () => {
                processImage(reader.result as string);
            };
            reader.readAsDataURL(photoBlob);
        }
    };
    const handleRescan = async () => {
        if (!displayImageDataUri) return;

        setIsOcrLoading(true);

        // If it's a firebase URL, we need to proxy it to get a data URI
        if (displayImageDataUri.startsWith('https://')) {
            try {
                const response = await fetch(`/api/image-proxy?url=${encodeURIComponent(displayImageDataUri)}`);
                if (!response.ok) throw new Error('Proxy failed');
                const { dataUri } = await response.json();
                await processImage(dataUri);
            } catch (error) {
                setAiError("Không thể tải lại ảnh để quét. Vui lòng tải lên lại.");
                setIsOcrLoading(false);
            }
        } else {
            // It's already a data URI (from a new upload)
            await processImage(displayImageDataUri);
        }
    }

    const handleManualEntryFromError = () => {
        if (!displayImageDataUri) {
            toast.error("Không có ảnh để nhập thủ công.");
            return;
        }
        setAiError(null);
        setNetRevenue(0);
        setDeliveryPartnerPayout(0);
        setRevenueByPaymentMethod(initialPaymentMethods);
        setAiOriginalData({ netRevenue: 0, deliveryPartnerPayout: 0, revenueByPaymentMethod: initialPaymentMethods, reportTimestamp: reportTimestamp || undefined });
        toast.success("Chuyển sang nhập thủ công. Vui lòng điền các số liệu.");
    };
    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange} dialogTag="revenue-stats-dialog" parentDialogTag="root">
                <DialogContent className="max-w-xl h-full md:h-[95vh] flex flex-col p-0" onPointerDownOutside={(e) => e.preventDefault()}>
                    <div id="revenue-stats-lightbox-container"></div>
                    <DialogHeader className="p-6 pb-4 border-b bg-muted/30">
                        <DialogTitle>{isOwnerView && !existingStats ? 'Tạo Thống kê Doanh thu' : (isOwnerView ? 'Chi tiết Thống kê Doanh thu' : 'Nhập Thống kê Doanh thu')}</DialogTitle>
                        <DialogDescription>
                            {isOwnerView && !existingStats
                                ? `Ngày: ${dateForNewEntry ? format(parseISO(dateForNewEntry), 'dd/MM/yyyy') : 'N/A'} - Lập bởi: ${reporter?.displayName || 'N/A'}`
                                : (isOwnerView
                                    ? `Ngày: ${existingStats ? format(parseISO(existingStats.date), 'dd/MM/yyyy') : 'N/A'} - Lập bởi: ${existingStats?.createdBy.userName || 'N/A'}`
                                    : 'Tải hoặc chụp ảnh phiếu thống kê để AI điền tự động. Cần có ảnh mới cho mỗi lần lưu.'
                                )
                            }
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="flex-grow">
                        <div className="space-y-6 p-6">
                            <Card className="flex-grow flex flex-col">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base flex items-center justify-between">
                                        <span className="flex items-center gap-2"><ImageIcon /> Ảnh phiếu thống kê</span>
                                        {canEdit && isOwnerView && displayImageDataUri &&
                                            <Button variant="secondary" size="sm" onClick={handleRescan} disabled={isOcrLoading || isProcessing}>
                                                {isOcrLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                                Quét lại
                                            </Button>
                                        }
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex-grow flex flex-col justify-center items-center gap-4">
                                    {displayImageDataUri ? (
                                        <div className="relative w-full h-full min-h-48 cursor-pointer" onClick={() => openLightbox([{ src: displayImageDataUri }])}>
                                            <Image src={displayImageDataUri} alt="Ảnh phiếu thống kê" fill className="object-contain rounded-md" />
                                        </div>
                                    ) : (
                                        <div className="w-full h-24 flex items-center justify-center bg-muted rounded-md border-2 border-dashed">
                                            <p className="text-sm text-muted-foreground">Tải ảnh lên để tiếp tục</p>
                                        </div>
                                    )}
                                    {aiError && (
                                        <div className="w-full space-y-2">
                                            <Alert variant="destructive">
                                                <AlertCircle className="h-4 w-4" />
                                                <AlertTitle>Lỗi</AlertTitle>
                                                <AlertDescription>{aiError}</AlertDescription>
                                            </Alert>
                                            <Button variant="secondary" className="w-full" onClick={handleManualEntryFromError}><FileText className="mr-2 h-4 w-4" /> Nhập thủ công</Button>
                                        </div>
                                    )}
                                    {canEdit && (
                                        <div className="flex flex-col sm:flex-row gap-2 w-full max-w-sm">
                                            {isOwnerView ? (
                                                <>
                                                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isOcrLoading || isProcessing} className="w-full">
                                                        {isOcrLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                                        Tải ảnh phiếu
                                                    </Button>
                                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                                                </>
                                            ) : (
                                                <Button variant="outline" onClick={() => setIsCameraOpen(true)} disabled={isOcrLoading || isProcessing} className="w-full">
                                                    {isOcrLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                                                    Chụp ảnh phiếu
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {(aiOriginalData || existingStats) && (
                                <div ref={dataSectionRef} className="space-y-4 rounded-md border bg-muted/30 shadow-inner p-4">
                                    {reportTimestamp && (
                                        <Card>
                                            <CardContent className="p-3 text-center text-sm font-semibold">
                                                Thời gian trên phiếu: {format(parseISO(reportTimestamp), 'HH:mm:ss, dd/MM/yyyy')}
                                            </CardContent>
                                        </Card>
                                    )}

                                    <Card>
                                        <CardContent className="p-4 space-y-4">
                                            <InputField
                                                id="netRevenue"
                                                label="Doanh thu Net"
                                                value={netRevenue}
                                                onChange={(val) => setNetRevenue(Number(val))}
                                                originalValue={aiOriginalData?.netRevenue}
                                                isImportant={true}
                                                inputClassName="text-base"
                                                disabled={!canEdit}
                                            />
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2 pt-4">
                                            <CardTitle className="text-base">Doanh thu theo PTTT</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            {paymentMethodOrder.map((key) =>
                                                <InputField
                                                    key={`pm-${key}`}
                                                    id={`pm-${key}`}
                                                    label={paymentMethodLabels[key]}
                                                    value={revenueByPaymentMethod[key]}
                                                    onChange={(val) => handlePaymentMethodChange(key as any, val)}
                                                    originalValue={aiOriginalData?.revenueByPaymentMethod?.[key]}
                                                    isSubtle={true}
                                                    disabled={!canEdit}
                                                />
                                            )}
                                            <div className={cn("text-right pt-2 mt-2 border-t font-semibold rounded-b-lg p-2 -mx-4 -mb-3", isRevenueMismatch ? "bg-destructive/10 text-destructive" : "bg-muted/50 text-muted-foreground")}>
                                                <p className="text-sm">Tổng PTTT: {totalPaymentMethods.toLocaleString('vi-VN')}đ</p>
                                                {isRevenueMismatch && <p className="text-xs">Không khớp Doanh thu Net!</p>}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardContent className="p-4 space-y-4">
                                            <InputField
                                                id="deliveryPayout"
                                                label="Trả cho ĐTGH"
                                                value={deliveryPartnerPayout}
                                                onChange={(val) => setDeliveryPartnerPayout(Number(val))}
                                                originalValue={aiOriginalData?.deliveryPartnerPayout}
                                                disabled={!canEdit}
                                            />
                                            <p className="text-xs text-muted-foreground flex items-start gap-1.5 pt-1 pl-2">
                                                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                                                <span>Số tiền trả cho ĐTGH sẽ được tự động tạo một phiếu chi tương ứng.</span>
                                            </p>
                                        </CardContent>
                                    </Card>

                                    {wasEditedByCashier && (
                                        <Alert variant="default" className="border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300">
                                            <Edit className="h-4 w-4 !text-yellow-600 dark:!text-yellow-400" />
                                            <AlertTitle>Thu ngân đã chỉnh sửa</AlertTitle>
                                            <AlertDescription>
                                                Số liệu này đã được thu ngân chỉnh sửa thủ công so với kết quả AI đọc được ban đầu.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    <DialogFooter className="p-6 pt-4 border-t bg-muted/30">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
                        <Button onClick={handleSave} disabled={isProcessing || isOcrLoading || !canEdit}>
                            {(isProcessing || isOcrLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Lưu
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <CameraDialog
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onSubmit={handleCapturePhoto}
                captureMode="photo"
                singlePhotoMode={true}
                isHD={true}
                parentDialogTag="revenue-stats-dialog"
            />

            <AlertDialog open={showMissingImageAlert} onOpenChange={setShowMissingImageAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertCircle className="text-destructive" />
                            Yêu cầu ảnh phiếu thống kê mới
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Mỗi lần cập nhật thông tin doanh thu đều cần một ảnh phiếu thống kê mới để đảm bảo tính chính xác. Vui lòng cung cấp ảnh.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex flex-col sm:flex-row gap-2 pt-4">
                        <Button variant="outline" className="w-full" onClick={() => {
                            setShowMissingImageAlert(false);
                            fileInputRef.current?.click();
                        }}>
                            <Upload className="mr-2 h-4 w-4" />
                            Tải ảnh lên
                        </Button>
                    </div>
                    <AlertDialogFooter className='sm:justify-start mt-2'>
                        <AlertDialogCancel>Đóng</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={serverErrorDialog.open}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <ServerCrash className="text-destructive" />
                            Lỗi phân tích ảnh
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Mô hình AI đang gặp sự cố hoặc quá tải. Vui lòng chọn một trong các tùy chọn sau.
                        </AlertDialogDescription>
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
        </>
    );
}
