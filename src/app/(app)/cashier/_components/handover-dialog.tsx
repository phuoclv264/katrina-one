
'use client';

import * as React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogBody,
    DialogAction,
    DialogCancel,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { ExtractHandoverDataOutput, AuthUser, FinalHandoverDetails, MediaItem } from '@/lib/types';
import { Loader2, Upload, AlertCircle, RefreshCw, ServerCrash, FileText, ArrowRight, Edit, Clock, X, Camera, Calculator, ImageIcon, Maximize2, Wallet } from 'lucide-react';
import { toast } from '@/components/ui/pro-toast';
import { callExtractHandoverData } from '@/lib/ai-service';
import { photoStore } from '@/lib/photo-store';
import Image from '@/components/ui/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle as AlertDialogTitleComponent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import isEqual from 'lodash.isequal';
import { ScrollArea } from '@/components/ui/scroll-area';
import { v4 as uuidv4 } from 'uuid';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { parseISO, format, isSameDay, isToday } from 'date-fns';
import { Timestamp } from '@firebase/firestore';
import { useLightbox } from '@/contexts/lightbox-context';
import CameraDialog from '@/components/camera-dialog';
import { get, set, del } from '@/lib/idb-keyval-store';


const initialHandoverData = {
    expectedCash: 0,
    startOfDayCash: 0,
    cashExpense: 0,
    cashRevenue: 0,
    deliveryPartnerPayout: 0,
    cashRefund: 0,
    otherRefund: 0,
    revenueByCard: {
        techcombankVietQrPro: 0,
        shopeeFood: 0,
        grabFood: 0,
        bankTransfer: 0,
    }
};

const handoverFieldOrder: (keyof Omit<ExtractHandoverDataOutput, 'isReceipt' | 'rejectionReason' | 'shiftEndTime' | 'revenueByCard'>)[] = [
    'startOfDayCash', 'cashRevenue', 'cashExpense', 'cashRefund', 'otherRefund', 'expectedCash', 'deliveryPartnerPayout'
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
    cashRefund: 'Tiền hoàn/huỷ (TM)',
    otherRefund: 'Tiền hoàn/huỷ (Khác)',
    techcombankVietQrPro: 'TCB VietQR Pro',
    shopeeFood: 'ShopeeFood',
    grabFood: 'Grab Food',
    bankTransfer: 'Chuyển Khoản',
};


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
                    isSubtle ? "text-[11px] font-bold text-zinc-800 uppercase tracking-tight" : "text-sm font-bold text-foreground",
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

type HandoverDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: any, id?: string) => void;
    isProcessing: boolean;
    id?: string; // ID của report khi chỉnh sửa
    // For Owner/Manager view
    reportToEdit?: FinalHandoverDetails | null;
    reporter?: AuthUser;
    dateForNewEntry?: string | null;
    isOwnerView?: boolean;
    parentDialogTag: string;
};


export default function HandoverDialog({
    open,
    onOpenChange,
    onSubmit,
    isProcessing,
    id,
    reportToEdit = null,
    reporter,
    dateForNewEntry = null,
    isOwnerView = false,
    parentDialogTag
}: HandoverDialogProps) {
    const dataSectionRef = useRef<HTMLDivElement>(null);
    const localReportId = useMemo(() => {
        if (!reporter) return null;
        const dateStr = dateForNewEntry || format(new Date(), 'yyyy-MM-dd');
        return `handover-report-${reporter.uid}-${dateStr}`;
    }, [reporter, dateForNewEntry]);

    const [isRestoring, setIsRestoring] = useState(true);

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

    const [serverErrorDialog, setServerErrorDialog] = useState<{ open: boolean, imageUri: string | null }>({ open: false, imageUri: null });
    const { openLightbox } = useLightbox();
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [shouldRescanAfterPhoto, setShouldRescanAfterPhoto] = useState(false);
    const [isManualEntry, setIsManualEntry] = useState(false);

    const allPhotos = useMemo(() => {
        return [...existingPhotos, ...localPhotos];
    }, [existingPhotos, localPhotos]);

    const saveStateToLocal = useCallback(async () => {
        if (!localReportId || isRestoring) return;

        const stateToSave = {
            handoverData,
            originalData,
            shiftEndTime,
            localPhotoIds: localPhotos.map(p => p.id),
            isManualEntry,
        };
        await set(localReportId, stateToSave);
    }, [localReportId, handoverData, originalData, shiftEndTime, localPhotos, isManualEntry, isRestoring]);

    useEffect(() => {
        saveStateToLocal();
    }, [saveStateToLocal]);


    useEffect(() => {
        const restoreState = async () => {
            setIsRestoring(true);
            // Reset all states first
            setHandoverData(initialHandoverData);
            setOriginalData(null);
            setServerErrorDialog({ open: false, imageUri: null });
            setLocalPhotos([]);
            setPhotosToDelete([]);
            setExistingPhotos([]);
            setIsManualEntry(false);
            setShiftEndTime(null);

            if (reportToEdit) {
                setHandoverData(reportToEdit.receiptData);
                setOriginalData(reportToEdit.receiptData);
                setShiftEndTime(reportToEdit.receiptData.shiftEndTime || null);
                setExistingPhotos(reportToEdit.receiptImageUrl ? [{ id: reportToEdit.receiptImageUrl, url: reportToEdit.receiptImageUrl }] : []);
            } else if (localReportId) {
                const savedState = await get(localReportId);
                if (savedState) {
                    setHandoverData(savedState.handoverData || initialHandoverData);
                    setOriginalData(savedState.originalData || null);
                    setShiftEndTime(savedState.shiftEndTime || null);
                    setIsManualEntry(savedState.isManualEntry || false);
                    if (savedState.localPhotoIds && savedState.localPhotoIds.length > 0) {
                        const urls = await photoStore.getPhotosAsUrls(savedState.localPhotoIds);
                        const restoredPhotos = savedState.localPhotoIds.map((id: string) => ({
                            id,
                            url: urls.get(id)!,
                        })).filter((p: { url: any; }) => p.url);
                        setLocalPhotos(restoredPhotos);
                    }
                    toast.success("Đã khôi phục phiên làm việc trước đó.");
                }
            }
            setIsRestoring(false);
        };

        if (open) {
            restoreState();
        }
    }, [open, reportToEdit, localReportId]);

    const isCreating = !reportToEdit;

    useEffect(() => {
        if ((originalData || isManualEntry) && dataSectionRef.current) {
            setTimeout(() => dataSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }
    }, [originalData]);

    useEffect(() => {
        // This effect runs when `allPhotos` changes and the flag is set.
        if (shouldRescanAfterPhoto && allPhotos.length > 0 && !isRestoring) {
            handleRescan();
            setShouldRescanAfterPhoto(false); // Reset the flag
        }
    }, [allPhotos, shouldRescanAfterPhoto]);

    const validateReportDate = useCallback((shiftEndTime: string): boolean => {
        try {
            const reportDate = parseISO(shiftEndTime);
            const targetDate = parseISO(dateForNewEntry || new Date().toISOString());

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
    }, [dateForNewEntry, isOwnerView]);

    const processImage = async (uri: string) => {
        setIsOcrLoading(true);
        setAiError(null);
        const toastId = toast.loading('AI đang phân tích phiếu bàn giao...');
        setServerErrorDialog({ open: false, imageUri: null });

        try {
            const result = await callExtractHandoverData({ imageDataUri: uri });

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
                cashRefund: result.cashRefund ?? 0,
                otherRefund: result.otherRefund ?? 0,
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

    const handleCapturePhoto = async (media: MediaItem[]) => {
        setIsCameraOpen(false);
        try {
            const newPhotos = (await Promise.all(media.filter(m => m.type === 'photo').map(async (photo) => {
                const photoBlob = await photoStore.getPhoto(photo.id);
                if (!photoBlob) return null;
                const objectUrl = URL.createObjectURL(photoBlob);
                return { id: photo.id, url: objectUrl };
            }))).filter(Boolean) as { id: string, url: string }[];

            // setLocalPhotos(prev => [...prev, ...newPhotos]); // Add new photos to old photos
            setLocalPhotos([...newPhotos]); // Use new photos only
            setShouldRescanAfterPhoto(true); // Set the flag to trigger rescan
        } catch (error) {
            toast.error("Lỗi khi thêm ảnh.");
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

        if (isOwnerView) {
            onSubmit(dataToSubmit, id); // Sử dụng id từ props
            if (localReportId) {
                del(localReportId);
                photoStore.deletePhotos(localPhotos.map(p => p.id));
            }
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
                // It's a Firebase URL, fetch it directly and convert to data URI
                const response = await fetch(photo.url);
                if (!response.ok) return null;
                const blob = await response.blob();
                return new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
            }));

            const validUris = imageUris.filter((uri): uri is string => !!uri);
            if (validUris.length === 0) {
                throw new Error("Không thể xử lý bất kỳ ảnh nào.");
            }

            const results = await Promise.all(validUris.map(uri => callExtractHandoverData({ imageDataUri: uri })));

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

            // Ensure refunds and payouts are always positive sums
            combinedData.cashRefund = Math.abs(combinedData.cashRefund);
            combinedData.otherRefund = Math.abs(combinedData.otherRefund);

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
        ? `Lập bởi: ${reportToEdit!.finalizedBy.userName} lúc ${format((reportToEdit!.finalizedAt as Timestamp).toDate(), 'HH:mm, dd/MM/yyyy')}`
        : 'Tải hoặc chụp ảnh phiếu bàn giao để AI điền tự động.';

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange} dialogTag="handover-dialog" parentDialogTag={parentDialogTag}>
                <DialogContent className="max-w-xl" onPointerDownOutside={(e) => e.preventDefault()}>
                    <DialogHeader variant="info" iconkey="wallet" className="pb-2 pt-4">
                        <DialogTitle>{dialogTitle}</DialogTitle>
                        <DialogDescription>{dialogDescription}</DialogDescription>
                    </DialogHeader>

                    <DialogBody>
                        <div className="space-y-6">
                            <Card className="overflow-hidden border-none shadow-sm bg-muted/20 rounded-[2rem]">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base flex items-center justify-between">
                                        <span className="flex items-center gap-2"><ImageIcon className="h-4 w-4 text-primary" /> Ảnh phiếu bàn giao</span>
                                        {allPhotos.length > 0 && (
                                            <Button variant="secondary" size="sm" onClick={handleRescan} disabled={isOcrLoading} className="h-8 rounded-xl font-bold">
                                                {isOcrLoading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin text-primary" /> : <RefreshCw className="mr-2 h-3.5 w-3.5 text-primary" />}
                                                Quét lại
                                            </Button>
                                        )}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="px-6 pb-6 pt-0">
                                    {allPhotos.length > 0 ? (
                                        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                                            {allPhotos.map((photo, index) => (
                                                <div key={photo.id} className="relative aspect-square rounded-2xl overflow-hidden group bg-background border border-primary/5 shadow-sm ring-4 ring-transparent transition-all hover:ring-primary/20 cursor-pointer">
                                                    <Image src={photo.url} alt={`Bằng chứng ${index + 1}`} fill className="object-cover transition-transform group-hover:scale-110" onClick={() => openLightbox(allPhotos.map(p => ({ src: p.url })), index)} />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100" onClick={() => openLightbox(allPhotos.map(p => ({ src: p.url })), index)}>
                                                        <Maximize2 className="h-4 w-4 text-white drop-shadow-md" />
                                                    </div>
                                                    <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-0 lg:group-hover:opacity-100 transition-opacity shadow-lg z-10" onClick={(e) => {
                                                        e.stopPropagation();
                                                        const isLocal = localPhotos.some(p => p.id === photo.id);
                                                        if (isLocal) handleDeleteLocalPhoto(photo.id); else handleDeleteExistingPhoto(photo.url);
                                                    }}><X className="h-3 w-3" /></Button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="w-full h-32 flex flex-col items-center justify-center bg-background rounded-[1.5rem] border-2 border-dashed border-primary/10 transition-colors hover:bg-primary/5 hover:border-primary/20">
                                            <Camera className="h-8 w-8 text-muted-foreground/30 mb-2" />
                                            <p className="text-xs font-medium text-muted-foreground tracking-tight">Vui lòng tải hoặc chụp ảnh phiếu</p>
                                        </div>
                                    )}
                                    {aiError && (
                                        <div className="mt-4 space-y-2">
                                            <Alert variant="destructive" className="rounded-2xl border-none bg-rose-50 dark:bg-rose-950/30">
                                                <AlertCircle className="h-4 w-4 text-rose-600" />
                                                <AlertTitle className="text-rose-800 dark:text-rose-400 font-bold">Lỗi</AlertTitle>
                                                <AlertDescription className="text-rose-700/80 dark:text-rose-400/80">{aiError}</AlertDescription>
                                            </Alert>
                                            {!originalData && !isManualEntry && (
                                                <Button variant="secondary" className="w-full rounded-2xl font-bold h-11" onClick={() => setIsManualEntry(true)}>
                                                    <FileText className="mr-2 h-4 w-4" />
                                                    Nhập thủ công
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex flex-col sm:flex-row gap-2 mt-6 w-full">
                                        {isOwnerView ? (
                                            <>
                                                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isOcrLoading || isProcessing} className="w-full rounded-2xl font-bold h-11 border-2">
                                                    <Upload className="mr-2 h-4 w-4" /> Tải ảnh lên
                                                </Button>
                                                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" multiple />
                                            </>
                                        ) : (
                                            <Button variant="default" onClick={() => setIsCameraOpen(true)} disabled={isOcrLoading || isProcessing} className="w-full rounded-2xl font-bold h-12 shadow-sm border border-blue-200/50">
                                                <Camera className="mr-2 h-4 w-4" /> Chụp ảnh phiếu
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {(originalData || isManualEntry) && (
                                <div ref={dataSectionRef} className="space-y-4">
                                    {shiftEndTime && (
                                        <div className="bg-primary/5 rounded-2xl p-3 border border-primary/10 flex items-center justify-center gap-2">
                                            <Clock className="h-4 w-4 text-primary" />
                                            <span className="text-xs font-bold text-primary italic uppercase tracking-wider">
                                                Thời gian trên phiếu: {format(parseISO(shiftEndTime), 'HH:mm:ss, dd/MM/yyyy')}
                                            </span>
                                        </div>
                                    )}

                                    <Card className="rounded-[2rem] border-none shadow-sm bg-background overflow-hidden">
                                        <CardHeader className="pb-0 pt-5 px-6 italic">
                                            <CardTitle className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                                                <Calculator className="h-3.5 w-3.5" /> Dữ liệu đối soát
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 space-y-1">
                                            <div className="space-y-1 bg-muted/30 rounded-2xl p-2 pb-0">
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
                                                        isSubtle={true}
                                                    />
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="rounded-[2rem] border-none shadow-sm bg-background overflow-hidden">
                                        <CardHeader className="pb-0 pt-5 px-6 italic">
                                            <CardTitle className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground flex items-center gap-2">
                                                <Wallet className="h-3.5 w-3.5" /> Doanh thu QR & App
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 space-y-1">
                                            <div className="space-y-1 bg-muted/30 rounded-2xl p-2 pb-0">
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
                                                        isSubtle={true}
                                                    />
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </div>
                    </DialogBody>

                    <DialogFooter variant="muted">
                        <DialogCancel onClick={() => onOpenChange(false)}>Hủy</DialogCancel>

                        <DialogAction
                            onClick={handleFinalSubmit}
                            isLoading={isProcessing || isOcrLoading}
                            disabled={allPhotos.length === 0}
                        >
                            {/* show icon only when not loading (DialogAction renders a spinner when isLoading) */}
                            {! (isProcessing || isOcrLoading) && (isOwnerView ? <FileText className="mr-2 h-4 w-4" /> : <ArrowRight className="mr-2 h-4 w-4" />)}
                            {isOwnerView ? 'Lưu báo cáo' : 'Tiếp tục'}
                        </DialogAction>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <CameraDialog
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onSubmit={handleCapturePhoto}
                captureMode="photo"
                isHD={true}
                parentDialogTag="handover-dialog"
            />

            <AlertDialog open={serverErrorDialog.open} variant="warning" parentDialogTag="handover-dialog">
                <AlertDialogContent className="rounded-[2.5rem]">
                    <div className="pt-8 pb-4 flex flex-col items-center text-center px-4">
                        <div className="w-20 h-20 bg-amber-100 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm border border-amber-200 ring-8 ring-amber-50">
                            <ServerCrash className="h-10 w-10 text-amber-600" />
                        </div>
                        <AlertDialogHeader>
                            <AlertDialogTitleComponent className="text-2xl font-black tracking-tight">Lỗi phân tích AI</AlertDialogTitleComponent>
                            <AlertDialogDescriptionComponent className="text-base font-medium leading-relaxed">
                                Mô hình AI đang gặp sự cố hoặc quá tải. Bạn có thể thử lại hoặc tiếp tục bằng cách nhập dữ liệu thủ công.
                            </AlertDialogDescriptionComponent>
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