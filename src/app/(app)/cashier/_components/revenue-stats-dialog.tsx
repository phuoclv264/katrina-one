

'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { RevenueStats } from '@/lib/types';
import { Loader2, Upload, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { extractRevenueFromImage } from '@/ai/flows/extract-revenue-flow';
import CameraDialog from '@/components/camera-dialog';
import { photoStore } from '@/lib/photo-store';
import Image from 'next/image';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";

type RevenueStatsDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: Omit<RevenueStats, 'id' | 'date' | 'createdAt' | 'createdBy'>) => void;
    isProcessing: boolean;
    existingStats: RevenueStats | null;
};

const initialPaymentMethods = {
    cash: 0,
    techcombankVietQrPro: 0,
    shopeeFood: 0,
    grabFood: 0,
    bankTransfer: 0,
};

const paymentMethodLabels: { [key in keyof typeof initialPaymentMethods]: string } = {
    cash: "Tiền mặt",
    techcombankVietQrPro: "TCB VietQR Pro",
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
    const [netRevenue, setNetRevenue] = useState(0);
    const [orderCount, setOrderCount] = useState(0);
    const [deliveryPartnerPayout, setDeliveryPartnerPayout] = useState(0);
    const [revenueByPaymentMethod, setRevenueByPaymentMethod] = useState(initialPaymentMethods);

    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [imageDataUri, setImageDataUri] = useState<string | null>(null);

    const [isLightboxOpen, setIsLightboxOpen] = useState(false);

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


    useEffect(() => {
        if (open) {
            if (existingStats) {
                setNetRevenue(existingStats.netRevenue);
                setOrderCount(existingStats.orderCount);
                setDeliveryPartnerPayout(existingStats.deliveryPartnerPayout || 0);
                setRevenueByPaymentMethod({ ...initialPaymentMethods, ...existingStats.revenueByPaymentMethod });
                setImageDataUri(existingStats.invoiceImageUrl);
            } else {
                // Reset for new entry
                setNetRevenue(0);
                setOrderCount(0);
                setDeliveryPartnerPayout(0);
                setRevenueByPaymentMethod(initialPaymentMethods);
                setImageDataUri(null);
            }
        }
    }, [open, existingStats]);

    const handlePaymentMethodChange = (key: keyof typeof revenueByPaymentMethod, value: string) => {
        setRevenueByPaymentMethod(prev => ({ ...prev, [key]: Number(value) }));
    };

    const totalPaymentMethods = useMemo(() => {
        return Object.values(revenueByPaymentMethod).reduce((sum, val) => sum + val, 0);
    }, [revenueByPaymentMethod]);

    const isRevenueMismatch = netRevenue > 0 && Math.abs(netRevenue - totalPaymentMethods) > 1; // Allow for rounding errors

    const handleSave = () => {
        if (!imageDataUri) {
            toast({
                title: "Thiếu ảnh hóa đơn",
                description: "Vui lòng tải lên hoặc chụp ảnh hóa đơn thống kê doanh thu trước khi lưu.",
                variant: "destructive"
            });
            return;
        }

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
            orderCount,
            revenueByPaymentMethod,
            deliveryPartnerPayout,
            invoiceImageUrl: imageDataUri, 
        };

        onSave(dataToSave as Omit<RevenueStats, 'id' | 'date' | 'createdAt' | 'createdBy'>);
    };

    const processImage = async (imageUri: string) => {
        setIsOcrLoading(true);
        setImageDataUri(imageUri);
        toast({ title: 'AI đang phân tích hóa đơn...' });

        try {
            const result = await extractRevenueFromImage({ imageDataUri: imageUri });

            setNetRevenue(result.netRevenue || 0);
            setOrderCount(result.orderCount || 0);
            setDeliveryPartnerPayout(result.deliveryPartnerPayout || 0);
            setRevenueByPaymentMethod({
                cash: result.revenueByPaymentMethod.cash || 0,
                techcombankVietQrPro: result.revenueByPaymentMethod.techcombankVietQrPro || 0,
                shopeeFood: result.revenueByPaymentMethod.shopeeFood || 0,
                grabFood: result.revenueByPaymentMethod.grabFood || 0,
                bankTransfer: result.revenueByPaymentMethod.bankTransfer || 0,
            });

            toast({ title: 'Thành công!', description: 'Đã điền dữ liệu từ ảnh hóa đơn.' });
        } catch (error) {
            console.error('OCR Error:', error);
            toast({ variant: 'destructive', title: 'Lỗi OCR', description: 'Không thể đọc dữ liệu từ ảnh. Vui lòng thử lại hoặc nhập thủ công.' });
        } finally {
            setIsOcrLoading(false);
        }
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
             toast({ variant: 'destructive', title: 'Lỗi OCR', description: 'Không thể đọc dữ liệu từ ảnh. Vui lòng thử lại hoặc nhập thủ công.' });
        } finally {
            await photoStore.deletePhoto(photoId); // Clean up temporary photo
        }
    }


    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Nhập Thống kê Doanh thu</DialogTitle>
                        <DialogDescription>
                            Tải hoặc chụp ảnh bill tổng kết từ POS để AI điền tự động. Mỗi lần lưu đều phải có ảnh mới.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isOcrLoading || isProcessing}
                                className="w-full"
                            >
                                {isOcrLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                Tải ảnh hóa đơn
                            </Button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept="image/*"
                            />
                            <Button
                                variant="outline"
                                onClick={() => setIsCameraOpen(true)}
                                disabled={isOcrLoading || isProcessing}
                                className="w-full"
                            >
                                <Camera className="mr-2 h-4 w-4" />
                                Chụp ảnh hóa đơn
                            </Button>
                        </div>
                        {imageDataUri && (
                             <button onClick={() => setIsLightboxOpen(true)} className="relative aspect-square w-24 h-24 mx-auto rounded-md overflow-hidden border-2 border-dashed hover:border-primary transition-all">
                                <Image src={imageDataUri} alt="Hóa đơn đã tải lên" layout="fill" objectFit="cover" />
                             </button>
                        )}
                    </div>


                    <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="netRevenue">Doanh thu Net</Label>
                                <Input id="netRevenue" type="number" value={netRevenue} onChange={e => setNetRevenue(Number(e.target.value))} placeholder="0" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="orderCount">Số lượng đơn</Label>
                                <Input id="orderCount" type="number" value={orderCount} onChange={e => setOrderCount(Number(e.target.value))} placeholder="0" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Doanh thu theo PTTT</Label>
                            <div className="p-4 border rounded-md grid grid-cols-2 gap-4">
                                {Object.entries(revenueByPaymentMethod).map(([key, value]) => (
                                    <div key={key} className="space-y-1">
                                        <Label htmlFor={`pm-${key}`} className="text-xs capitalize">{paymentMethodLabels[key as keyof typeof paymentMethodLabels]}</Label>
                                        <Input id={`pm-${key}`} type="number" value={value} onChange={e => handlePaymentMethodChange(key as any, e.target.value)} placeholder="0" />
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">Tổng PTTT: {totalPaymentMethods.toLocaleString('vi-VN')}đ</p>
                        </div>

                        {isRevenueMismatch && (
                            <Alert variant="destructive">
                                <AlertTitle>Doanh thu không khớp!</AlertTitle>
                                <AlertDescription>
                                    Doanh thu Net ({netRevenue.toLocaleString('vi-VN')}đ) không bằng Tổng PTTT ({totalPaymentMethods.toLocaleString('vi-VN')}đ).
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="deliveryPayout">Tiền trả cho Đối tác Giao hàng</Label>
                            <Input id="deliveryPayout" type="number" value={deliveryPartnerPayout} onChange={e => setDeliveryPartnerPayout(Number(e.target.value))} placeholder="0" />
                            <p className="text-xs text-muted-foreground">
                                Số tiền này sẽ được tự động tạo một phiếu chi.
                            </p>
                        </div>

                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
                        <Button onClick={handleSave} disabled={isProcessing || isOcrLoading}>
                            {(isProcessing || isOcrLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Lưu
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <CameraDialog 
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onSubmit={handlePhotoCapture}
                singlePhotoMode={true}
            />
            {imageDataUri && (
                 <Lightbox
                    open={isLightboxOpen}
                    close={() => setIsLightboxOpen(false)}
                    slides={[{ src: imageDataUri }]}
                    plugins={[Zoom]}
                    carousel={{ finite: true }}
                    zoom={{ maxZoomPixelRatio: 5 }}
                />
            )}
        </>
    );
}
