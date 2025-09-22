'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import type { HandoverReport, ExpenseSlip, RevenueStats, AuthUser } from '@/lib/types';
import { Loader2, Upload, Camera, AlertCircle, RefreshCw, ServerCrash, FileText, CheckCircle, ArrowRight, Wallet, X, ListChecks } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { extractHandoverData } from '@/ai/flows/extract-handover-data-flow';
import type { ExtractHandoverDataOutput } from '@/ai/flows/extract-handover-data-flow';
import CameraDialog from '@/components/camera-dialog';
import { photoStore } from '@/lib/photo-store';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import { parseISO, isToday, format } from 'date-fns';
import { dataStore } from '@/lib/data-store';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRouter } from 'next/navigation';

type HandoverDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: any) => void;
    isProcessing: boolean;
    reporter: AuthUser;
    dailyCashExpense: number;
    dailyCardExpense: number;
    dailyRevenueStats: RevenueStats | null;
    startOfDayCash: number;
};

type Step = 'upload' | 'confirming' | 'mismatch' | 'finalizing' | 'success';

type ComparisonResult = {
  isMatch: boolean;
  mismatches: {
    field: string;
    label: string;
    appValue: number;
    receiptValue: number;
  }[];
};

export default function HandoverDialog({
    open,
    onOpenChange,
    onSave,
    isProcessing,
    reporter,
    dailyCashExpense,
    dailyCardExpense,
    dailyRevenueStats,
    startOfDayCash
}: HandoverDialogProps) {
    const router = useRouter();

    const [step, setStep] = useState<Step>('upload');
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [imageDataUri, setImageDataUri] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [handoverData, setHandoverData] = useState<ExtractHandoverDataOutput | null>(null);
    const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
    
    const [actualCash, setActualCash] = useState<number | null>(null);
    const [discrepancyReason, setDiscrepancyReason] = useState('');
    const [discrepancyPhotoIds, setDiscrepancyPhotoIds] = useState<string[]>([]);
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    const [serverErrorDialog, setServerErrorDialog] = useState<{ open: boolean, imageUri: string | null }>({ open: false, imageUri: null });
    
    const resetState = useCallback(() => {
        setStep('upload');
        setIsOcrLoading(false);
        setImageDataUri(null);
        setHandoverData(null);
        setComparisonResult(null);
        setActualCash(null);
        setDiscrepancyReason('');
        setDiscrepancyPhotoIds([]);
        setServerErrorDialog({ open: false, imageUri: null });
    }, []);

    useEffect(() => {
        if(open) resetState();
    }, [open, resetState]);

    const appData = useMemo(() => {
        const cashRevenue = dailyRevenueStats?.revenueByPaymentMethod?.cash || 0;
        const cardRevenue = (dailyRevenueStats?.netRevenue || 0) - cashRevenue;
        
        return {
            startOfDayCash: startOfDayCash,
            cashRevenue: cashRevenue,
            cashExpense: dailyCashExpense,
            cardRevenue: cardRevenue,
            deliveryPartnerPayout: dailyRevenueStats?.deliveryPartnerPayout || 0,
            expectedCash: cashRevenue - dailyCashExpense + startOfDayCash,
        }
    }, [startOfDayCash, dailyCashExpense, dailyRevenueStats]);

    const processImage = async (uri: string) => {
        setIsOcrLoading(true);
        const toastId = toast.loading('AI đang phân tích phiếu bàn giao...');
        
        try {
            const result = await extractHandoverData({ imageDataUri: uri });
            if (!result.isReceipt) {
                toast.error(result.rejectionReason || 'Ảnh không hợp lệ.');
                setIsOcrLoading(false);
                toast.dismiss(toastId);
                return;
            }

            if (!result.shiftEndTime) {
                toast.error('AI không thể xác định ngày giờ trên phiếu.');
                setIsOcrLoading(false);
                toast.dismiss(toastId);
                return;
            }

            const reportTime = parseISO(result.shiftEndTime);
            if (!isToday(reportTime)) {
                toast.error(`Phiếu này từ ngày ${format(reportTime, 'dd/MM/yyyy')}. Vui lòng sử dụng phiếu của ngày hôm nay.`);
                setIsOcrLoading(false);
                toast.dismiss(toastId);
                return;
            }

            // Compare data
            const mismatches = [];
            const fieldsToCompare: (keyof typeof appData)[] = ['expectedCash', 'startOfDayCash', 'cashExpense', 'cashRevenue', 'cardRevenue', 'deliveryPartnerPayout'];
            const labels: {[key: string]: string} = {
                 expectedCash: 'Tiền mặt dự kiến', startOfDayCash: 'Tiền mặt đầu ca', cashExpense: 'Chi tiền mặt',
                 cashRevenue: 'Doanh thu tiền mặt', cardRevenue: 'Doanh thu thẻ', deliveryPartnerPayout: 'Trả ĐTGH (khác)'
            };

            for (const field of fieldsToCompare) {
                const appValue = Math.round(appData[field]);
                const receiptValue = Math.round(result[field as keyof typeof result] as number || 0);

                if (appValue !== receiptValue) {
                    mismatches.push({ field, label: labels[field], appValue, receiptValue });
                }
            }

            setImageDataUri(uri);
            setHandoverData(result);
            setComparisonResult({ isMatch: mismatches.length === 0, mismatches });
            setStep(mismatches.length === 0 ? 'finalizing' : 'mismatch');
            toast.dismiss(toastId);

        } catch (error: any) {
             if (error.message && (error.message.includes('503 Service Unavailable') || error.message.includes('429 Too Many Requests'))) {
                setServerErrorDialog({ open: true, imageUri: uri });
             } else {
                console.error('OCR Error:', error);
                toast.error('Lỗi AI: Không thể đọc dữ liệu từ ảnh.');
             }
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

    const handleFinalSubmit = () => {
        if (!handoverData || !imageDataUri || actualCash === null) return;
        const discrepancy = actualCash - handoverData.expectedCash;
        if (discrepancy !== 0 && !discrepancyReason.trim()) {
            toast.error('Vui lòng nhập lý do chênh lệch tiền mặt.');
            return;
        }

        const dataToSave: Partial<HandoverReport> = {
            handoverData,
            handoverImageUrl: imageDataUri, // This will be handled for upload by the parent
            actualCash,
            discrepancy,
            discrepancyReason: discrepancyReason.trim() || undefined,
            discrepancyProofPhotos: discrepancyPhotoIds, // IDs for parent to upload
        };
        onSave(dataToSave);
        setStep('success');
    }

    const discrepancy = (actualCash !== null && handoverData?.expectedCash !== null) 
        ? actualCash - (handoverData?.expectedCash as number)
        : 0;

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Bàn giao cuối ca</DialogTitle>
                        <DialogDescription>
                           Tải lên phiếu bàn giao để hệ thống đối chiếu và xác nhận.
                        </DialogDescription>
                    </DialogHeader>

                    {step === 'upload' && (
                        <div className="py-4 space-y-4">
                            <div className="relative aspect-video w-full flex items-center justify-center bg-muted rounded-md border-2 border-dashed">
                                {isOcrLoading ? (
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <span>AI đang phân tích...</span>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Vui lòng tải lên hoặc chụp ảnh phiếu bàn giao</p>
                                )}
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isOcrLoading} className="w-full"><Upload className="mr-2 h-4 w-4"/> Tải ảnh lên</Button>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                                <Button onClick={() => setIsCameraOpen(true)} disabled={isOcrLoading} className="w-full"><Camera className="mr-2 h-4 w-4"/> Chụp ảnh mới</Button>
                            </div>
                        </div>
                    )}
                    
                    {step === 'mismatch' && comparisonResult && (
                        <div className="py-4 space-y-4">
                             <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Phát hiện sai lệch dữ liệu!</AlertTitle>
                                <AlertDescription>
                                    Hệ thống phát hiện có sự khác biệt giữa dữ liệu trên phiếu bàn giao và dữ liệu đã ghi nhận trong ứng dụng. Vui lòng kiểm tra lại.
                                </AlertDescription>
                            </Alert>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Hạng mục</TableHead>
                                        <TableHead className="text-right">Trên ứng dụng</TableHead>
                                        <TableHead className="text-right">Trên phiếu</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {comparisonResult.mismatches.map(m => (
                                        <TableRow key={m.field} className="bg-red-100/50 dark:bg-red-900/30">
                                            <TableCell className="font-semibold">{m.label}</TableCell>
                                            <TableCell className="text-right font-mono">{m.appValue.toLocaleString('vi-VN')}đ</TableCell>
                                            <TableCell className="text-right font-mono">{m.receiptValue.toLocaleString('vi-VN')}đ</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                             <div className="flex flex-col sm:flex-row gap-2">
                                <Button variant="secondary" className="w-full" onClick={() => {router.push('/cashier'); onOpenChange(false); }}>
                                    <ListChecks className="mr-2 h-4 w-4" /> Kiểm tra lại thu/chi
                                </Button>
                                 <Button variant="secondary" className="w-full" onClick={() => {router.push('/reports/cashier'); onOpenChange(false); }}>
                                    <FileText className="mr-2 h-4 w-4" /> Kiểm tra doanh thu
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 'finalizing' && handoverData && (
                        <div className="py-4 space-y-4">
                             <Alert variant="default" className="bg-green-100/50 border-green-200">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <AlertTitle className="text-green-800">Dữ liệu đã khớp!</AlertTitle>
                                <AlertDescription className="text-green-700">
                                    Tất cả số liệu trên phiếu bàn giao đều trùng khớp với dữ liệu trên ứng dụng.
                                </AlertDescription>
                            </Alert>
                             <Card>
                                <CardContent className="p-4 grid grid-cols-2 gap-4">
                                     <div>
                                        <Label htmlFor="expected-cash">Tiền mặt dự kiến</Label>
                                        <Input id="expected-cash" disabled value={handoverData.expectedCash.toLocaleString('vi-VN') + 'đ'} className="font-bold text-lg h-12 text-right bg-muted" />
                                    </div>
                                    <div>
                                        <Label htmlFor="actual-cash">Tiền mặt thực tế</Label>
                                        <Input id="actual-cash" type="number" placeholder="Nhập số tiền..." value={actualCash ?? ''} onChange={e => setActualCash(Number(e.target.value))} className="font-bold text-lg h-12 text-right" autoFocus/>
                                    </div>
                                </CardContent>
                            </Card>

                             {discrepancy !== 0 && (
                                <Card className="border-destructive">
                                    <CardContent className="p-4 space-y-2">
                                        <Label className="text-destructive font-bold">Chênh lệch: {discrepancy.toLocaleString('vi-VN')}đ</Label>
                                        <Textarea
                                            placeholder="Vui lòng nhập lý do chi tiết cho khoản chênh lệch này..."
                                            value={discrepancyReason}
                                            onChange={e => setDiscrepancyReason(e.target.value)}
                                        />
                                        <Button variant="outline" size="sm" onClick={() => setIsCameraOpen(true)}>
                                            <Camera className="mr-2 h-4 w-4"/> Chụp ảnh bằng chứng
                                        </Button>
                                         {discrepancyPhotoIds.length > 0 && <p className="text-xs text-muted-foreground">{discrepancyPhotoIds.length} ảnh đã được chọn.</p>}
                                    </CardContent>
                                </Card>
                            )}

                             <Button onClick={handleFinalSubmit} disabled={isProcessing || actualCash === null} className="w-full">
                                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ArrowRight className="mr-2 h-4 w-4"/>}
                                Gửi Báo cáo Bàn giao
                             </Button>
                        </div>
                    )}
                    
                    {step === 'success' && (
                        <div className="py-8 text-center space-y-4">
                            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                            <h3 className="text-xl font-semibold">Bàn giao thành công!</h3>
                            <p className="text-muted-foreground">Báo cáo của bạn đã được ghi nhận. Cảm ơn và chúc bạn một ngày tốt lành.</p>
                             <Button onClick={() => onOpenChange(false)} className="w-full">Hoàn tất</Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
            <CameraDialog
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onSubmit={step === 'upload' ? handlePhotoCapture : (ids) => setDiscrepancyPhotoIds(prev => [...prev, ...ids])}
                singlePhotoMode={step === 'upload'}
            />
        </>
    );
}
