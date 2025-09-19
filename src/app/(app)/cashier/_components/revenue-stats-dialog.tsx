
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { RevenueStats } from '@/lib/types';
import { Loader2, Upload, Camera, AlertCircle, Clock, Info, Edit, Trash2, Eye, FileText, ImageIcon, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { extractRevenueFromImage } from '@/ai/flows/extract-revenue-flow';
import CameraDialog from '@/components/camera-dialog';
import { photoStore } from '@/lib/photo-store';
import Image from 'next/image';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


type RevenueStatsDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: Omit<RevenueStats, 'id' | 'date' | 'createdAt' | 'createdBy' | 'isEdited'>, isEdited: boolean) => void;
    isProcessing: boolean;
    existingStats: RevenueStats | null;
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


export default function RevenueStatsDialog({
    open,
    onOpenChange,
    onSave,
    isProcessing,
    existingStats
}: RevenueStatsDialogProps) {
    const { toast } = useToast();
    const isMobile = useIsMobile();
    const [activeTab, setActiveTab] = useState('image');
    
    // Form state
    const [netRevenue, setNetRevenue] = useState(0);
    const [deliveryPartnerPayout, setDeliveryPartnerPayout] = useState(0);
    const [revenueByPaymentMethod, setRevenueByPaymentMethod] = useState(initialPaymentMethods);

    // AI Original state for comparison
    const [originalData, setOriginalData] = useState<Partial<RevenueStats> | null>(null);

    // UI & Flow state
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [newImageDataUri, setNewImageDataUri] = useState<string | null>(null);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [showMissingImageAlert, setShowMissingImageAlert] = useState(false);
    const [oldReceiptInfo, setOldReceiptInfo] = useState<{ reportTime: string; currentTime: string; hoursDiff: number; } | null>(null);
    const [serverErrorDialog, setServerErrorDialog] = useState<{ open: boolean, imageUri: string | null }>({ open: false, imageUri: null });


    // In create mode (existingStats is null), the image comes from newImageDataUri
    // In update mode, we initially show the existing image, but any new image will populate newImageDataUri
    const displayImageDataUri = newImageDataUri || existingStats?.invoiceImageUrl;
    const isCreating = !existingStats;

    // --- Back button handling for Lightbox ---
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


    const resetFormState = () => {
        setNetRevenue(0);
        setDeliveryPartnerPayout(0);
        setRevenueByPaymentMethod(initialPaymentMethods);
        setOriginalData(null); 
    };

    useEffect(() => {
        if (open) {
            // ALWAYS reset when opening the dialog.
            // For creating, it starts fresh.
            // For updating, it also starts fresh, forcing a new image and data entry.
            resetFormState();
            setNewImageDataUri(null); 
            setOldReceiptInfo(null);
            setActiveTab('image'); // Reset to image tab when dialog opens
            setServerErrorDialog({ open: false, imageUri: null });
        }
    }, [open]);

    const handleTabChange = (value: string) => {
        if (isMobile && value === 'data' && !newImageDataUri) {
            toast({
                title: "Vui lòng cung cấp ảnh",
                description: "Bạn cần chụp hoặc tải ảnh phiếu thống kê trước khi nhập số liệu.",
                variant: "default"
            });
            return;
        }
        setActiveTab(value);
    }

    const handlePaymentMethodChange = (key: keyof typeof revenueByPaymentMethod, value: string) => {
        setRevenueByPaymentMethod(prev => ({ ...prev, [key]: Number(value) }));
    };

    const totalPaymentMethods = useMemo(() => {
        return Object.values(revenueByPaymentMethod).reduce((sum, val) => sum + val, 0);
    }, [revenueByPaymentMethod]);

    const isRevenueMismatch = netRevenue > 0 && Math.abs(netRevenue - totalPaymentMethods) > 1; // Allow for rounding errors
    const hasBeenEdited = useMemo(() => {
        if (!originalData) return false;
        if (netRevenue !== originalData.netRevenue) return true;
        if (deliveryPartnerPayout !== originalData.deliveryPartnerPayout) return true;
        for (const key in revenueByPaymentMethod) {
            if (revenueByPaymentMethod[key as keyof typeof revenueByPaymentMethod] !== originalData.revenueByPaymentMethod?.[key as keyof typeof initialPaymentMethods]) {
                return true;
            }
        }
        return false;
    }, [originalData, netRevenue, deliveryPartnerPayout, revenueByPaymentMethod]);


    const executeSave = () => {
        if (isRevenueMismatch) {
            toast({
                title: "Số liệu không khớp",
                description: "Tổng doanh thu theo phương thức thanh toán phải bằng Doanh thu Net.",
                variant: "destructive"
            });
            return;
        }

        const dataToSave = {
            netRevenue,
            revenueByPaymentMethod,
            deliveryPartnerPayout,
            invoiceImageUrl: newImageDataUri, // Always use the new image
        };

        onSave(dataToSave as Omit<RevenueStats, 'id' | 'date' | 'createdAt' | 'createdBy' | 'isEdited' | 'orderCount'>, hasBeenEdited);
    }
    
    const handleSave = () => {
        if (!newImageDataUri) {
            setShowMissingImageAlert(true);
            return;
        }
        executeSave();
    };

    const processImage = async (imageUri: string) => {
        setIsOcrLoading(true);
        toast({ title: 'AI đang phân tích phiếu...' });
        setServerErrorDialog({ open: false, imageUri: null }); // Close previous error dialog

        try {
            const result = await extractRevenueFromImage({ imageDataUri: imageUri });

            if (!result.isReceipt) {
                toast({ variant: 'destructive', title: 'Ảnh không hợp lệ', description: result.rejectionReason || 'Vui lòng thử lại với ảnh khác.' });
                setIsOcrLoading(false);
                return;
            }

            if (result.reportTimestamp) {
                const reportTime = new Date(result.reportTimestamp);
                const now = new Date();
                const oneHour = 60 * 60 * 1000;
                const nowInVietnam = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
                const timeDiff = nowInVietnam.getTime() - reportTime.getTime();

                if (timeDiff > oneHour) {
                    setOldReceiptInfo({
                        reportTime: format(reportTime, 'HH:mm:ss, dd/MM/yyyy'),
                        currentTime: format(nowInVietnam, 'HH:mm:ss, dd/MM/yyyy'),
                        hoursDiff: parseFloat((timeDiff / oneHour).toFixed(1)),
                    });
                    setIsOcrLoading(false);
                    return;
                }
            } else {
                 toast({ variant: 'destructive', title: 'Cảnh báo', description: 'Không tìm thấy ngày giờ trên phiếu. Vui lòng kiểm tra lại ảnh.' });
            }

            setNewImageDataUri(imageUri);

            const aiData = {
                netRevenue: result.netRevenue || 0,
                deliveryPartnerPayout: result.deliveryPartnerPayout || 0,
                revenueByPaymentMethod: {
                    ...initialPaymentMethods,
                    ...result.revenueByPaymentMethod,
                },
            };
            
            // Set form state
            setNetRevenue(aiData.netRevenue);
            setDeliveryPartnerPayout(aiData.deliveryPartnerPayout);
            setRevenueByPaymentMethod(aiData.revenueByPaymentMethod);
            
            // Store original AI data for comparison
            setOriginalData(aiData);

            toast({ title: 'Thành công!', description: 'Đã điền dữ liệu từ ảnh phiếu. Vui lòng kiểm tra lại.' });
            setActiveTab('data'); // Switch to data tab on success

        } catch (error: any) {
             if (error.message && error.message.includes('503 Service Unavailable')) {
                setServerErrorDialog({ open: true, imageUri });
             } else {
                console.error('OCR Error:', error);
                toast({ variant: 'destructive', title: 'Lỗi AI', description: 'Không thể đọc dữ liệu từ ảnh. Vui lòng thử lại hoặc nhập thủ công.' });
             }
        } finally {
            setIsOcrLoading(false);
        }
    };
    
    const handleManualEntry = () => {
        const imageUri = serverErrorDialog.imageUri;
        if (!imageUri) return;
    
        setNewImageDataUri(imageUri);
        // Set form to all zeros, but keep the original data for comparison
        setNetRevenue(0);
        setDeliveryPartnerPayout(0);
        setRevenueByPaymentMethod(initialPaymentMethods);
        setOriginalData({
            netRevenue: 0,
            deliveryPartnerPayout: 0,
            revenueByPaymentMethod: initialPaymentMethods,
        });
    
        setActiveTab('data');
        setServerErrorDialog({ open: false, imageUri: null });
        toast({
            title: "Chuyển sang nhập thủ công",
            description: "Vui lòng nhập các số liệu từ phiếu thống kê."
        });
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
        
        if(fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    
    const handlePhotoCapture = async (photoIds: string[]) => {
        setIsCameraOpen(false);
        if (photoIds.length === 0) return;
        const photoId = photoIds[0];

        try {
            const photoBlob = await photoStore.getPhoto(photoId);
            if (!photoBlob) throw new Error("Không tìm thấy ảnh đã chụp.");

            const reader = new FileReader();
            reader.onloadend = () => {
                 const imageUri = reader.result as string;
                 processImage(imageUri);
            };
            reader.readAsDataURL(photoBlob);
        } catch(error) {
             console.error('OCR Error:', error);
             toast({ variant: 'destructive', title: 'Lỗi AI', description: 'Không thể đọc dữ liệu từ ảnh. Vui lòng thử lại hoặc nhập thủ công.' });
        } finally {
            await photoStore.deletePhoto(photoId);
        }
    }
    
    const renderInputField = (id: string, label: string, value: number, onChange: (val: string) => void, originalValue?: number, isImportant: boolean = false) => {
        const isEdited = originalData !== null && value !== originalValue;
        return (
            <div key={id} className="grid grid-cols-2 items-center gap-2">
                <Label htmlFor={id} className={cn("text-sm text-right flex items-center gap-2 justify-end", isImportant && "font-bold text-base")}>
                     {isEdited && <Edit className="h-3 w-3 text-yellow-500" />}
                    {label}
                </Label>
                <Input id={id} type="number" value={value} onChange={e => onChange(e.target.value)} placeholder="0" className={cn("h-9", isImportant && "font-bold text-base")} />
            </div>
        );
    };

    const ImageSection = () => (
        <Card className="bg-card flex-grow flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Ảnh phiếu thống kê</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-center items-center gap-4">
                 {displayImageDataUri ? (
                    <div className="relative w-full h-full min-h-48 cursor-pointer" onClick={() => setIsLightboxOpen(true)}>
                         <Image src={displayImageDataUri} alt="Ảnh phiếu thống kê" fill className="object-contain rounded-md" />
                    </div>
                ) : (
                    <div className="w-full h-24 flex items-center justify-center bg-muted rounded-md border-2 border-dashed">
                        <p className="text-sm text-muted-foreground">Chưa có ảnh</p>
                    </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2 w-full max-w-sm">
                    <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isOcrLoading || isProcessing}
                        className="w-full"
                    >
                        {isOcrLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Tải ảnh phiếu
                    </Button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept="image/*"
                    />
                    <Button
                        variant="secondary"
                        onClick={() => setIsCameraOpen(true)}
                        disabled={isOcrLoading || isProcessing}
                        className="w-full"
                    >
                        <Camera className="mr-2 h-4 w-4" />
                        Chụp ảnh phiếu
                    </Button>
                </div>
            </CardContent>
        </Card>
    );

    const DataSection = () => (
        <div className="space-y-4">
             {renderInputField("netRevenue", "Doanh thu Net", netRevenue, (val) => setNetRevenue(Number(val)), originalData?.netRevenue, true)}
            <Card>
                <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-base">Doanh thu theo PTTT</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {Object.entries(revenueByPaymentMethod).map(([key, value]) => 
                        renderInputField(
                            `pm-${key}`, 
                            paymentMethodLabels[key as keyof typeof paymentMethodLabels], 
                            value, 
                            (val) => handlePaymentMethodChange(key as any, val), 
                            originalData?.revenueByPaymentMethod?.[key as keyof typeof initialPaymentMethods]
                        )
                    )}
                    <div className="text-right pt-2">
                        <p className="text-xs text-muted-foreground font-semibold">Tổng PTTT: {totalPaymentMethods.toLocaleString('vi-VN')}đ</p>
                        {isRevenueMismatch && (
                            <p className="text-xs text-destructive font-semibold">Không khớp Doanh thu Net!</p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {renderInputField("deliveryPayout", "Trả cho ĐTGH", deliveryPartnerPayout, (val) => setDeliveryPartnerPayout(Number(val)), originalData?.deliveryPartnerPayout)}
            <p className="text-xs text-muted-foreground flex items-start gap-1.5 pt-1 pl-2">
                <Info className="h-3 w-3 mt-0.5 shrink-0"/>
                <span>Số tiền trả cho ĐTGH sẽ được tự động tạo một phiếu chi tương ứng.</span>
            </p>
            
             {hasBeenEdited && (
                <Alert variant="default" className="mt-4 border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300">
                    <Edit className="h-4 w-4 !text-yellow-600 dark:!text-yellow-400" />
                    <AlertTitle>Đã chỉnh sửa thủ công</AlertTitle>
                    <AlertDescription>
                        Số liệu đã được thay đổi so với kết quả AI đọc được.
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                 <DialogContent className={cn("max-w-4xl", isMobile && "max-w-[95vw]")}>
                    <DialogHeader>
                        <DialogTitle>Nhập Thống kê Doanh thu</DialogTitle>
                        <DialogDescription>
                           {isCreating
                            ? "Tải hoặc chụp ảnh phiếu thống kê để AI điền tự động. Cần có ảnh mới cho mỗi lần lưu."
                            : "Vui lòng cung cấp ảnh và số liệu mới để cập nhật doanh thu cho ngày hôm nay."
                           }
                        </DialogDescription>
                    </DialogHeader>
                    
                    {isMobile ? (
                        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="image"><ImageIcon className="mr-2 h-4 w-4" /> Ảnh phiếu</TabsTrigger>
                                <TabsTrigger value="data"><FileText className="mr-2 h-4 w-4" /> Số liệu</TabsTrigger>
                            </TabsList>
                            <TabsContent value="image" className="mt-4">
                                <div className="flex flex-col gap-4">
                                    <ImageSection />
                                </div>
                            </TabsContent>
                            <TabsContent value="data" className="mt-4">
                                <ScrollArea className="h-[55vh] pr-4">
                                    <DataSection />
                                </ScrollArea>
                            </TabsContent>
                        </Tabs>
                    ) : (
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="w-full md:w-1/2 flex flex-col gap-4">
                                <ImageSection />
                            </div>
                            <div className="w-full md:w-1/2">
                                <ScrollArea className="h-full max-h-[55vh] pr-4">
                                    <DataSection />
                                </ScrollArea>
                            </div>
                        </div>
                    )}


                    <DialogFooter className="mt-6">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
                        <Button onClick={handleSave} disabled={isProcessing || isOcrLoading}>
                            {(isProcessing || isOcrLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Lưu
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={showMissingImageAlert} onOpenChange={setShowMissingImageAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertCircle className="text-destructive"/>
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
                         <Button className="w-full" onClick={() => {
                            setShowMissingImageAlert(false);
                            setIsCameraOpen(true);
                         }}>
                             <Camera className="mr-2 h-4 w-4" />
                             Chụp ảnh mới
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
                            <AlertCircle className="text-destructive"/>
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
            
            <AlertDialog open={!!oldReceiptInfo} onOpenChange={(open) => !open && setOldReceiptInfo(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Clock className="text-destructive"/>
                            Cảnh báo: Phiếu thống kê đã cũ
                        </AlertDialogTitle>
                         <AlertDialogDescription>
                            Hệ thống phát hiện phiếu thống kê này có thể đã cũ.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2 mt-2 text-sm">
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Thời gian trên phiếu: <span className="font-semibold">{oldReceiptInfo?.reportTime}</span></li>
                            <li>Thời gian hiện tại: <span className="font-semibold">{oldReceiptInfo?.currentTime}</span></li>
                            <li>Đã qua: <span className="font-semibold">{oldReceiptInfo?.hoursDiff} giờ</span></li>
                        </ul>
                        <div className="pt-2 font-medium">Để đảm bảo số liệu chính xác:</div>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Nếu thời gian trên là đúng, vui lòng <span className="font-bold">in phiếu mới</span> và thử lại.</li>
                            <li>Nếu AI nhận diện sai, vui lòng <span className="font-bold">chụp lại ảnh rõ hơn</span>.</li>
                        </ul>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setOldReceiptInfo(null)}>Đã hiểu</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>


            <CameraDialog 
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onSubmit={handlePhotoCapture}
                singlePhotoMode={true}
            />
            {displayImageDataUri && (
                 <Lightbox
                    open={isLightboxOpen}
                    close={() => setIsLightboxOpen(false)}
                    slides={[{ src: displayImageDataUri }]}
                    plugins={[Zoom]}
                    carousel={{ finite: true }}
                    zoom={{ maxZoomPixelRatio: 5 }}
                />
            )}
        </>
    );
}
