

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { IncidentReport, IncidentCategory, AuthUser, ManagedUser, PaymentMethod } from '@/lib/types';
import { Loader2, Camera, Trash2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { IncidentCategoryCombobox } from '@/components/incident-category-combobox';
import CameraDialog from '@/components/camera-dialog';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import { photoStore } from '@/lib/photo-store';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';


type IncidentReportDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: Omit<IncidentReport, 'id' | 'createdAt' | 'createdBy' | 'date'> & { photoIds: string[], photosToDelete: string[] }, id?: string) => void;
    isProcessing: boolean;
    categories: IncidentCategory[];
    onCategoriesChange: (newCategories: IncidentCategory[]) => void;
    canManageCategories: boolean;
    reporter: AuthUser;
    violationToEdit: IncidentReport | null;
    isSelfConfession?: boolean;
};

export default function IncidentReportDialog({
    open,
    onOpenChange,
    onSave,
    isProcessing,
    categories,
    onCategoriesChange,
    canManageCategories,
    reporter,
    violationToEdit, // This should be incidentToEdit
    isSelfConfession = false,
}: IncidentReportDialogProps) {
    const [content, setContent] = useState('');
    const [cost, setCost] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    
    // Photo state
    const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
    const [localPhotos, setLocalPhotos] = useState<{ id: string, url: string }[]>([]);
    const [photosToDelete, setPhotosToDelete] = useState<string[]>([]);

    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

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
            if (violationToEdit) {
                setContent(violationToEdit.content);
                setCost(violationToEdit.cost);
                setSelectedCategory(violationToEdit.category);
                setExistingPhotos(violationToEdit.photos || []);
                setPaymentMethod(violationToEdit.paymentMethod || 'cash');
            } else {
                setContent('');
                setCost(0);
                setSelectedCategory('');
                setExistingPhotos([]);
                setPaymentMethod('cash');
            }
             // Always reset local photo state
            setLocalPhotos([]);
            setPhotosToDelete([]);
        } else {
             // Cleanup local photo object URLs when dialog is fully closed
            localPhotos.forEach(p => URL.revokeObjectURL(p.url));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, violationToEdit, reporter]);


    const handleSave = () => {
        if (!content) {
            toast.error('Vui lòng nhập nội dung sự cố.');
            return;
        }
        if (!selectedCategory) {
            toast.error('Vui lòng chọn loại sự cố.');
            return;
        }
        
        const totalPhotos = localPhotos.length + existingPhotos.length;
        if (totalPhotos === 0) {
            toast.error('Vui lòng chụp ảnh bằng chứng cho sự cố.');
            return;
        }

        onSave({ 
            content, 
            cost, 
            paymentMethod: cost > 0 ? paymentMethod : undefined,
            category: selectedCategory, 
            photoIds: localPhotos.map(p => p.id),
            photosToDelete: photosToDelete,
        }, violationToEdit?.id);
    };
    
    const handleCapturePhotos = async (capturedPhotoIds: string[]) => {
        setIsCameraOpen(false);
        const newPhotoObjects: {id: string, url: string}[] = [];
        for (const photoId of capturedPhotoIds) {
            const photoBlob = await photoStore.getPhoto(photoId);
            if(photoBlob) {
                newPhotoObjects.push({ id: photoId, url: URL.createObjectURL(photoBlob) });
            }
        }
        setLocalPhotos(prev => [...prev, ...newPhotoObjects]);
    };
    
    const handleDeleteExistingPhoto = (url: string) => {
        setExistingPhotos(prev => prev.filter(p => p !== url));
        setPhotosToDelete(prev => [...prev, url]);
    };

    const handleDeleteLocalPhoto = async (id: string) => {
        setLocalPhotos(prev => {
            const photoToDelete = prev.find(p => p.id === id);
            if (photoToDelete) {
                URL.revokeObjectURL(photoToDelete.url);
            }
            return prev.filter(p => p.id !== id);
        });
        await photoStore.deletePhoto(id);
    };
    
    const openLightbox = (clickedIndex: number) => {
        setLightboxIndex(clickedIndex);
        setIsLightboxOpen(true);
    };

    const allPhotos = useMemo(() => {
        return [
            ...existingPhotos.map(url => ({ id: url, url })),
            ...localPhotos
        ];
    }, [existingPhotos, localPhotos]);

    const dialogTitle = violationToEdit ? 'Chỉnh sửa Báo cáo Sự cố' : (isSelfConfession ? 'Tự ghi nhận sai sót' : 'Tạo Báo cáo Sự cố');

    return (
        <>
            <Dialog open={open} onOpenChange={(open) => !open && onOpenChange(false)}>
                <DialogContent className="sm:max-w-md bg-white dark:bg-card" onInteractOutside={(e) => e.preventDefault()}>
                    <div id="incident-lightbox-container"></div>
                    <DialogHeader>
                        <DialogTitle>{dialogTitle}</DialogTitle>
                        <DialogDescription>
                            Ghi nhận lại các sự cố như hư hỏng thiết bị, làm vỡ tài sản...
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Người báo cáo</Label>
                            <div className="col-span-3">
                                <Badge variant="secondary">{reporter.displayName}</Badge>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="category" className="text-right">
                            Loại sự cố
                            </Label>
                            <div className="col-span-3">
                            <IncidentCategoryCombobox
                                categories={categories || []}
                                value={selectedCategory}
                                onChange={setSelectedCategory}
                                onCategoriesChange={onCategoriesChange}
                                canManage={canManageCategories}
                                placeholder="Chọn loại sự cố..."
                            />
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-start gap-4">
                            <Label htmlFor="content" className="text-right mt-2">
                            Nội dung
                            </Label>
                            <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} className="col-span-3" placeholder="VD: Làm vỡ ly thuỷ tinh" />
                        </div>
                        <div className="grid grid-cols-4 items-start gap-4">
                            <Label htmlFor="cost" className="text-right mt-2">Chi phí (nếu có)</Label>
                            <div className="col-span-3">
                                <Input 
                                  id="cost" 
                                  type="number" 
                                  value={cost} 
                                  onChange={e => setCost(Number(e.target.value))} 
                                  placeholder="0"
                                  onFocus={(e) => e.target.select()}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Nếu có chi phí, một phiếu chi tương ứng sẽ được tạo tự động.
                                </p>
                            </div>
                        </div>
                         {cost > 0 && (
                             <div className="grid grid-cols-4 items-start gap-4">
                                <Label className="text-right mt-2">Hình thức</Label>
                                <div className="col-span-3">
                                    <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="flex gap-2 sm:gap-4 flex-wrap">
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="cash" id="pm-inc-1" />
                                            <Label htmlFor="pm-inc-1">Tiền mặt</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="bank_transfer" id="pm-inc-2" />
                                            <Label htmlFor="pm-inc-2">Chuyển khoản</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="intangible_cost" id="pm-inc-3" />
                                            <Label htmlFor="pm-inc-3">Chi phí vô hình</Label>
                                        </div>
                                    </RadioGroup>
                                </div>
                             </div>
                        )}
                         <div className="grid grid-cols-4 items-start gap-4">
                            <Label className="text-right mt-2">Bằng chứng (bắt buộc)</Label>
                             <div className="col-span-3 space-y-2">
                                <Button variant="outline" onClick={() => setIsCameraOpen(true)}>
                                    <Camera className="mr-2 h-4 w-4"/> Chụp ảnh
                                </Button>
                                {allPhotos.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {allPhotos.map((photo, i) => (
                                            <div key={photo.id} className="relative h-20 w-20 rounded-md overflow-hidden group">
                                                 <button onClick={() => openLightbox(i)} className="w-full h-full">
                                                    <Image src={photo.url} alt={`Bằng chứng ${i + 1}`} fill className="object-cover" />
                                                 </button>
                                                 <Button 
                                                    variant="destructive" 
                                                    size="icon" 
                                                    className="absolute top-0.5 right-0.5 h-5 w-5" 
                                                    onClick={() => {
                                                        const isLocal = localPhotos.some(p => p.id === photo.id);
                                                        if (isLocal) {
                                                            handleDeleteLocalPhoto(photo.id);
                                                        } else {
                                                            handleDeleteExistingPhoto(photo.url);
                                                        }
                                                    }}
                                                >
                                                     <X className="h-3 w-3" />
                                                 </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                             </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
                        <Button onClick={handleSave} disabled={isProcessing}>
                            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Lưu Báo cáo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <CameraDialog
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onSubmit={handleCapturePhotos}
            />
             <Lightbox
                open={isLightboxOpen}
                close={() => setIsLightboxOpen(false)}
                index={lightboxIndex}
                slides={allPhotos.map(p => ({ src: p.url }))}
                plugins={[Zoom]}
                portal={{ root: document.getElementById("incident-lightbox-container") ?? undefined }}
                carousel={{ finite: true }}
                zoom={{ maxZoomPixelRatio: 5 }}
            />
        </>
    );
}
