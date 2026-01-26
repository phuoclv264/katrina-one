
'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter,
    DialogBody,
    DialogAction,
    DialogCancel 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { RevenueStats, AuthUser, MediaItem } from '@/lib/types';
import { Loader2, Upload, AlertCircle, Clock, Info, Edit, Eye, FileText, ImageIcon, RefreshCw, ServerCrash, Camera, Calculator, Wallet, CheckCircle2, Maximize2 } from 'lucide-react';
import { toast } from '@/components/ui/pro-toast';
import { callExtractRevenueFromImage } from '@/lib/ai-service';
import { photoStore } from '@/lib/photo-store';
import Image from '@/components/ui/image';
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
    parentDialogTag: string;
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
    shopeeFood: "Shopee Food",
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
    const [localValue, setLocalValue] = useState(value === 0 ? '' : value.toLocaleString('vi-VN'));

    useEffect(() => {
        const formattedValue = value === 0 ? '' : value.toLocaleString('vi-VN');
        // Strip formatting to compare only digits to avoid unnecessary state updates
        if (formattedValue.replace(/\D/g, '') !== localValue.replace(/\D/g, '')) {
            setLocalValue(formattedValue);
        }
    }, [value, localValue]);

    const handleBlur = () => {
        const formattedValue = value === 0 ? '' : value.toLocaleString('vi-VN');
        setLocalValue(formattedValue);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        const numericStr = rawValue.replace(/\D/g, '');
        
        if (numericStr === '') {
            setLocalValue('');
            onChange('0');
            return;
        }

        const numericValue = parseInt(numericStr, 10);
        setLocalValue(numericValue.toLocaleString('vi-VN'));
        onChange(numericStr);
    };

    const isEdited = originalValue !== undefined && value !== originalValue;

    return (
        <div key={id} className="grid grid-cols-[1fr_1.8fr] items-center gap-4 py-1.5">
            <div className="flex flex-col items-end">
                <Label htmlFor={id} className={cn(
                    "flex items-center gap-1.5 transition-colors text-right",
                    isSubtle ? "text-[11px] font-bold text-muted-foreground/70 uppercase tracking-tight" : "text-sm font-bold text-foreground",
                    isEdited && "text-yellow-600"
                )}>
                    {isEdited && <Edit className="h-3 w-3" />}
                    {label}
                </Label>
                {isEdited && originalValue !== undefined && (
                    <span className="text-[10px] font-bold text-yellow-600/80 italic tabular-nums bg-yellow-100/50 px-1.5 rounded-md mt-0.5">
                        Gốc: {originalValue.toLocaleString('vi-VN')}
                    </span>
                )}
            </div>
            <div className="relative group/input">
                <Input
                    id={id}
                    type="text"
                    inputMode="numeric"
                    value={localValue}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    className={cn(
                        "text-right transition-all border-2 border-transparent bg-muted/40 focus:bg-background focus:ring-0 focus:border-primary/20 h-10 px-4 rounded-xl font-bold tabular-nums",
                        isImportant ? "h-12 text-lg text-primary border-primary/10 bg-primary/5" : "h-10 text-sm",
                        inputClassName
                    )}
                    disabled={disabled}
                />
            </div>
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
    parentDialogTag,
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
            <Dialog open={open} onOpenChange={onOpenChange} dialogTag="revenue-stats-dialog" parentDialogTag={parentDialogTag}>
                <DialogContent className="max-w-xl" onPointerDownOutside={(e) => e.preventDefault()}>
                    <div id="revenue-stats-lightbox-container"></div>
                    <DialogHeader variant="info" iconkey="calculator" className='pb-2 pt-4'>
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

                    <DialogBody>
                        <div className="space-y-6">
                            <Card className="overflow-hidden border-none shadow-sm bg-muted/20">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base flex items-center justify-between">
                                        <span className="flex items-center gap-2"><ImageIcon className="h-4 w-4 text-primary" /> Ảnh phiếu thống kê</span>
                                        {canEdit && isOwnerView && displayImageDataUri &&
                                            <Button variant="secondary" size="sm" onClick={handleRescan} disabled={isOcrLoading || isProcessing} className="h-8 rounded-xl font-bold">
                                                {isOcrLoading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
                                                Quét lại
                                            </Button>
                                        }
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-col justify-center items-center gap-4">
                                    {displayImageDataUri ? (
                                        <div className="relative w-full aspect-[4/3] max-h-64 cursor-pointer group" onClick={() => openLightbox([{ src: displayImageDataUri }])}>
                                            <Image src={displayImageDataUri} alt="Ảnh phiếu thống kê" fill className="object-contain rounded-2xl border bg-background transition-transform group-hover:scale-[1.01]" />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                <div className="bg-background/80 backdrop-blur-sm p-2 rounded-full shadow-lg">
                                                    <Maximize2 className="h-5 w-5 text-primary" />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-full h-32 flex items-center justify-center bg-muted/50 rounded-2xl border-2 border-dashed border-muted-foreground/20">
                                            <p className="text-sm text-muted-foreground font-medium">Chưa có ảnh phiếu thống kê</p>
                                        </div>
                                    )}
                                    {aiError && (
                                        <div className="w-full space-y-2">
                                            <Alert variant="destructive" className="rounded-2xl bg-destructive/5 border-destructive/20">
                                                <AlertCircle className="h-4 w-4" />
                                                <AlertTitle className="font-bold">Lỗi đọc phiếu</AlertTitle>
                                                <AlertDescription className="text-xs opacity-90">{aiError}</AlertDescription>
                                            </Alert>
                                            <Button variant="secondary" className="w-full rounded-2xl font-bold h-11" onClick={handleManualEntryFromError}><FileText className="mr-2 h-4 w-4" /> Nhập thủ công</Button>
                                        </div>
                                    )}
                                    {canEdit && (
                                        <div className="flex flex-col sm:flex-row gap-2 w-full">
                                            {isOwnerView ? (
                                                <>
                                                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isOcrLoading || isProcessing} className="w-full rounded-2xl font-bold h-11 border-2">
                                                        {isOcrLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                                        Tải ảnh phiếu
                                                    </Button>
                                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                                                </>
                                            ) : (
                                                <Button variant="default" onClick={() => setIsCameraOpen(true)} disabled={isOcrLoading || isProcessing} className="w-full rounded-2xl font-bold h-12 shadow-sm border border-blue-200/50">
                                                    {isOcrLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                                                    Chụp ảnh phiếu
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {(aiOriginalData || existingStats) && (
                                <div ref={dataSectionRef} className="space-y-4">
                                    {reportTimestamp && (
                                        <div className="bg-primary/5 rounded-2xl p-3 border border-primary/10 flex items-center justify-center gap-2">
                                            <Clock className="h-4 w-4 text-primary" />
                                            <span className="text-xs font-bold text-primary italic uppercase tracking-wider">
                                                Ghi nhận lúc: {format(parseISO(reportTimestamp), 'HH:mm:ss, dd/MM/yyyy')}
                                            </span>
                                        </div>
                                    )}

                                    <Card className="rounded-[2rem] border-none shadow-sm bg-background">
                                        <CardContent className="p-4">
                                            <InputField
                                                id="netRevenue"
                                                label="Doanh thu Net"
                                                value={netRevenue}
                                                onChange={(val) => setNetRevenue(Number(val))}
                                                originalValue={aiOriginalData?.netRevenue}
                                                isImportant={true}
                                                inputClassName="text-base font-bold text-primary min-w-0 w-full tabular-nums"
                                                disabled={!canEdit}
                                            />
                                        </CardContent>
                                    </Card>

                                    <Card className="rounded-[2rem] border-none shadow-sm bg-background overflow-hidden">
                                        <CardHeader className="pb-0 pt-5 px-6">
                                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                                <Wallet className="h-4 w-4" /> Phương thức thanh toán
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 space-y-1">
                                            <div className="space-y-1 bg-muted/30 rounded-2xl p-2 pb-0">
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
                                            </div>
                                            <div className={cn(
                                                "flex items-center justify-between px-4 py-3 rounded-2xl mt-2 transition-colors",
                                                isRevenueMismatch ? "bg-red-50 text-red-700" : "bg-primary/10 text-primary"
                                            )}>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold uppercase tracking-tight opacity-70">Tổng PTTT</span>
                                                    <span className="text-base font-black tabular-nums">{totalPaymentMethods.toLocaleString('vi-VN')}đ</span>
                                                </div>
                                                {isRevenueMismatch ? (
                                                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase">
                                                        <AlertCircle className="h-3 w-3" /> Không khớp!
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase">
                                                        <CheckCircle2 className="h-3 w-3" /> Hợp lệ
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="rounded-[2rem] border-none shadow-sm bg-background">
                                        <CardContent className="p-5 space-y-3">
                                            <InputField
                                                id="deliveryPayout"
                                                label="Trả cho ĐTGH"
                                                value={deliveryPartnerPayout}
                                                onChange={(val) => setDeliveryPartnerPayout(Number(val))}
                                                originalValue={aiOriginalData?.deliveryPartnerPayout}
                                                disabled={!canEdit}
                                            />
                                            <div className="bg-amber-50 rounded-xl p-2.5 border border-amber-100 flex items-start gap-2">
                                                <Info className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                                                <p className="text-[10px] leading-tight font-medium text-amber-800">
                                                    Số tiền trả cho đơn vị giao hàng sẽ được tự động tạo một phiếu chi tương ứng trong báo cáo ca.
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {wasEditedByCashier && (
                                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 flex items-start gap-3">
                                            <div className="p-2 bg-yellow-500/20 rounded-xl shrink-0">
                                                <Edit className="h-4 w-4 text-yellow-700" />
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="text-sm font-bold text-yellow-800">Đã được chỉnh sửa</p>
                                                <p className="text-xs text-yellow-700/80 leading-snug font-medium">
                                                    Số liệu này đã được thu ngân điều chỉnh thủ công so với kết quả AI ban đầu.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </DialogBody>

                    <DialogFooter variant="muted">
                        <DialogCancel>Hủy</DialogCancel>
                        <DialogAction 
                            onClick={handleSave} 
                            isLoading={isProcessing || isOcrLoading} 
                            disabled={!canEdit}
                        >
                            Lưu thống kê
                        </DialogAction>
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

            <AlertDialog open={showMissingImageAlert} onOpenChange={setShowMissingImageAlert} parentDialogTag="revenue-stats-dialog" variant="destructive">
                <AlertDialogContent className="rounded-[2.5rem]">
                    <div className="pt-8 pb-4 flex flex-col items-center text-center px-4">
                        <div className="w-20 h-20 bg-destructive/10 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm border border-destructive/20 ring-8 ring-destructive/5">
                            <Camera className="h-10 w-10 text-destructive" />
                        </div>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-2xl font-black tracking-tight">Thiếu ảnh phiếu</AlertDialogTitle>
                            <AlertDialogDescription className="text-base font-medium leading-relaxed max-w-[280px]">
                                Mỗi lần cập nhật thông tin doanh thu đều cần một ảnh phiếu thống kê mới để đảm bảo tính chính xác.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                    </div>

                    <div className="grid grid-cols-1 gap-3 p-6 pt-0">
                        <Button 
                            variant="default" 
                            className="w-full rounded-2xl h-14 font-black text-lg shadow-lg shadow-primary/20" 
                            onClick={() => {
                                setShowMissingImageAlert(false);
                                fileInputRef.current?.click();
                            }}
                        >
                            <Upload className="mr-2 h-6 w-6" />
                            Tải ảnh lên ngay
                        </Button>
                        <AlertDialogCancel className="h-12 border-none bg-muted/50 hover:bg-muted font-bold rounded-2xl">
                            Để sau
                        </AlertDialogCancel>
                    </div>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={serverErrorDialog.open} parentDialogTag="revenue-stats-dialog" variant="warning">
                <AlertDialogContent className="rounded-[2.5rem]">
                    <div className="pt-8 pb-4 flex flex-col items-center text-center px-4">
                        <div className="w-20 h-20 bg-amber-100 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm border border-amber-200 ring-8 ring-amber-50">
                            <ServerCrash className="h-10 w-10 text-amber-600" />
                        </div>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-2xl font-black tracking-tight">Lỗi phân tích AI</AlertDialogTitle>
                            <AlertDialogDescription className="text-base font-medium leading-relaxed">
                                Mô hình AI đang gặp sự cố hoặc quá tải. Bạn có thể thử lại hoặc tiếp tục bằng cách nhập dữ liệu thủ công.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                    </div>

                    <div className="grid grid-cols-1 gap-3 p-6 pt-0">
                        <Button 
                            variant="default" 
                            className="w-full rounded-2xl h-14 font-black text-lg bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-600/20" 
                            onClick={() => processImage(serverErrorDialog.imageUri!)}
                        >
                            <RefreshCw className="mr-2 h-6 w-6" /> Thử quét lại
                        </Button>
                        <Button 
                            variant="secondary" 
                            className="w-full rounded-2xl h-14 font-black text-lg border-2 border-primary/10" 
                            onClick={handleManualEntry}
                        >
                            <FileText className="mr-2 h-6 w-6 text-primary" /> Nhập thủ công
                        </Button>
                        <AlertDialogCancel 
                            className="h-12 border-none bg-muted/50 hover:bg-muted font-bold rounded-2xl"
                            onClick={() => setServerErrorDialog({ open: false, imageUri: null })}
                        >
                            Hủy bỏ
                        </AlertDialogCancel>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
