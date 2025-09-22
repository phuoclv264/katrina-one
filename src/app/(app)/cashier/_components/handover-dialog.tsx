
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
import { Loader2, Upload, Camera, AlertCircle, RefreshCw, ServerCrash, FileText, CheckCircle, ArrowRight, Wallet, X, ListChecks, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { extractHandoverData } from '@/ai/flows/extract-handover-data-flow';
import type { ExtractHandoverDataOutput } from '@/ai/flows/extract-handover-data-flow';
import CameraDialog from '@/components/camera-dialog';
import { photoStore } from '@/lib/photo-store';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import { parseISO, isToday, format } from 'date-fns';
import { dataStore } from '@/lib/data-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle as AlertDialogTitleComponent, AlertDialogFooter, AlertDialogDescription as AlertDialogDescriptionComponent } from '@/components/ui/alert-dialog';


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

type ComparisonResult = {
  field: string;
  label: string;
  appValue: number;
  receiptValue: number;
  isMatch: boolean;
}[];

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

    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [imageDataUri, setImageDataUri] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [handoverData, setHandoverData] = useState<ExtractHandoverDataOutput | null>(null);
    const comparisonResult = useRef<ComparisonResult | null>(null);
    
    const [actualCash, setActualCash] = useState<number | null>(null);
    const [discrepancyReason, setDiscrepancyReason] = useState('');
    const [discrepancyPhotoIds, setDiscrepancyPhotoIds] = useState<string[]>([]);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    
    const [isSuccess, setIsSuccess] = useState(false);
    const [serverErrorDialog, setServerErrorDialog] = useState<{ open: boolean, imageUri: string | null }>({ open: false, imageUri: null });
    
    const resetState = useCallback(() => {
        setIsOcrLoading(false);
        setImageDataUri(null);
        setHandoverData(null);
        comparisonResult.current = null;
        setActualCash(null);
        setDiscrepancyReason('');
        setDiscrepancyPhotoIds([]);
        setServerErrorDialog({ open: false, imageUri: null });
        setIsSuccess(false);
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
            
            const comparison: ComparisonResult = [];
            const fieldsToCompare: (keyof typeof appData)[] = ['expectedCash', 'startOfDayCash', 'cashExpense', 'cashRevenue', 'cardRevenue', 'deliveryPartnerPayout'];
            const labels: {[key: string]: string} = {
                 expectedCash: 'Tiền mặt dự kiến', startOfDayCash: 'Tiền mặt đầu ca', cashExpense: 'Chi tiền mặt',
                 cashRevenue: 'Doanh thu tiền mặt', cardRevenue: 'Doanh thu thẻ', deliveryPartnerPayout: 'Trả ĐTGH (khác)'
            };

            for (const field of fieldsToCompare) {
                const appValue = Math.round(appData[field]);
                const receiptValue = Math.round(result[field as keyof typeof result] as number || 0);
                comparison.push({ field, label: labels[field], appValue, receiptValue, isMatch: appValue === receiptValue });
            }

            setImageDataUri(uri);
            setHandoverData(result);
            comparisonResult.current = comparison;
            toast.dismiss(toastId);
            toast.success("Đã phân tích phiếu bàn giao. Vui lòng đối chiếu.");

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
            handoverImageUrl: imageDataUri, 
            actualCash,
            discrepancy,
            discrepancyReason: discrepancyReason.trim() || undefined,
            discrepancyProofPhotos: discrepancyPhotoIds, 
        };
        onSave(dataToSave);
        setIsSuccess(true);
    }
    
    const hasMismatch = comparisonResult.current && comparisonResult.current.some(item => !item.isMatch);
    const discrepancy = (actualCash !== null && handoverData?.expectedCash !== null) 
        ? actualCash - (handoverData?.expectedCash as number)
        : 0;

    if (isSuccess) {
        return (
             <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent>
                    <div className="py-8 text-center space-y-4">
                        <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                        <h3 className="text-xl font-semibold">Bàn giao thành công!</h3>
                        <p className="text-muted-foreground">Báo cáo của bạn đã được ghi nhận. Cảm ơn và chúc bạn một ngày tốt lành.</p>
                         <Button onClick={() => onOpenChange(false)} className="w-full">Hoàn tất</Button>
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Bàn giao cuối ca</DialogTitle>
                        <DialogDescription>
                           Tải lên phiếu bàn giao để hệ thống đối chiếu và xác nhận.
                        </DialogDescription>
                    </DialogHeader>

                     <ScrollArea className="max-h-[70vh] -mx-6 px-6">
                        <div className="space-y-6 py-4">
                            <Card>
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-base">Ảnh phiếu bàn giao</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {imageDataUri ? (
                                        <div className="relative w-full h-full min-h-48">
                                            <Image src={imageDataUri} alt="Ảnh phiếu bàn giao" fill className="object-contain rounded-md" />
                                        </div>
                                    ) : (
                                        <div className="w-full h-24 flex items-center justify-center bg-muted rounded-md border-2 border-dashed">
                                            <p className="text-sm text-muted-foreground">Chưa có ảnh nào được tải lên</p>
                                        </div>
                                    )}
                                    <div className="flex flex-col sm:flex-row gap-2 mt-4">
                                        <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isOcrLoading} className="w-full"><Upload className="mr-2 h-4 w-4"/> Tải ảnh lên</Button>
                                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                                        <Button onClick={() => setIsCameraOpen(true)} disabled={isOcrLoading} className="w-full"><Camera className="mr-2 h-4 w-4"/> Chụp ảnh mới</Button>
                                    </div>
                                </CardContent>
                            </Card>

                             {isOcrLoading && (
                                <div className="flex flex-col items-center gap-2 text-muted-foreground py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <span>AI đang phân tích...</span>
                                </div>
                            )}

                            {comparisonResult.current && handoverData && (
                                <div className="space-y-6">
                                     <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">Đối chiếu dữ liệu</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Hạng mục</TableHead>
                                                        <TableHead className="text-right">Trên ứng dụng</TableHead>
                                                        <TableHead className="text-right">Trên phiếu</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {comparisonResult.current.map(item => (
                                                        <TableRow key={item.field} className={cn(!item.isMatch && "bg-destructive/10")}>
                                                            <TableCell className="font-semibold">{item.label}</TableCell>
                                                            <TableCell className="text-right font-mono">{item.appValue.toLocaleString('vi-VN')}đ</TableCell>
                                                            <TableCell className={cn("text-right font-mono", !item.isMatch && "font-bold text-destructive")}>{item.receiptValue.toLocaleString('vi-VN')}đ</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                             {hasMismatch && (
                                                <div className="mt-4 space-y-2">
                                                    <Alert variant="destructive">
                                                        <AlertCircle className="h-4 w-4" />
                                                        <AlertTitle>Phát hiện sai lệch dữ liệu!</AlertTitle>
                                                        <AlertDescription>
                                                            Vui lòng kiểm tra lại các mục được đánh dấu. Điều này có thể do AI đọc sai hoặc do các báo cáo trong ngày chưa được nhập đúng.
                                                        </AlertDescription>
                                                    </Alert>
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
                                        </CardContent>
                                     </Card>
                                    
                                     {!hasMismatch && (
                                         <div className="space-y-4">
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
                                                        <div className="flex justify-between items-center">
                                                            <Button variant="outline" size="sm" onClick={() => setIsCameraOpen(true)}>
                                                                <Camera className="mr-2 h-4 w-4"/> Chụp ảnh bằng chứng
                                                            </Button>
                                                            {discrepancyPhotoIds.length > 0 && <p className="text-xs text-muted-foreground">{discrepancyPhotoIds.length} ảnh đã được chọn.</p>}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )}
                                        </div>
                                     )}
                                </div>
                            )}
                        </div>
                     </ScrollArea>
                    <DialogFooter>
                         <Button onClick={handleFinalSubmit} disabled={isProcessing || !handoverData || hasMismatch || actualCash === null} className="w-full sm:w-auto">
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ArrowRight className="mr-2 h-4 w-4"/>}
                            Gửi Báo cáo Bàn giao
                         </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <CameraDialog
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onSubmit={imageDataUri ? (ids) => setDiscrepancyPhotoIds(prev => [...prev, ...ids]) : handlePhotoCapture}
                singlePhotoMode={!imageDataUri}
            />
        </>
    );
}
