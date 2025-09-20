

'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import type { ExpenseSlip, PaymentMethod, InventoryItem, ExpenseItem, AuthUser, ExtractedInvoiceItem, InvoiceExtractionResult } from '@/lib/types';
import { Loader2, PlusCircle, Trash2, Camera, Upload, CheckCircle, XCircle, AlertCircle, X, Wand2, Eye } from 'lucide-react';
import { ItemMultiSelect } from '@/components/item-multi-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { extractInvoiceItems } from '@/ai/flows/extract-invoice-items-flow';
import CameraDialog from '@/components/camera-dialog';
import { photoStore } from '@/lib/photo-store';
import { toast } from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle as AlertDialogTitleComponent, AlertDialogFooter, AlertDialogDescription as AlertDialogDescriptionComponent } from '@/components/ui/alert-dialog';
import Image from 'next/image';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";


function EditItemPopover({ item, onSave, children }: { item: ExpenseItem; onSave: (updatedItem: ExpenseItem) => void; children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [quantity, setQuantity] = useState(item.quantity);
    const [unitPrice, setUnitPrice] = useState(item.unitPrice);
    
    useEffect(() => {
        if(open) {
            setQuantity(item.quantity);
            setUnitPrice(item.unitPrice);
        }
    }, [open, item]);

    const handleSave = () => {
        onSave({ ...item, quantity, unitPrice });
        setOpen(false); // Close popover on save
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent className="w-80">
                <div className="grid gap-4">
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">{item.name}</h4>
                        <p className="text-sm text-muted-foreground">Nhập số lượng và đơn giá.</p>
                    </div>
                    <div className="grid gap-2">
                        <div className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor="quantity">Số lượng ({item.unit})</Label>
                            <Input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="col-span-2 h-8" onFocus={(e) => e.target.select()} />
                        </div>
                        <div className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor="unitPrice">Đơn giá</Label>
                            <Input id="unitPrice" type="number" value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} className="col-span-2 h-8" onFocus={(e) => e.target.select()} />
                        </div>
                    </div>
                    <Button onClick={handleSave}>Lưu</Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

function AiPreviewDialog({ 
    open, 
    onOpenChange, 
    extractionResult, 
    inventoryList, 
    onConfirm,
    allAttachmentPhotos
}: { 
    open: boolean, 
    onOpenChange: (open: boolean) => void, 
    extractionResult: InvoiceExtractionResult, 
    inventoryList: InventoryItem[], 
    onConfirm: (items: ExpenseItem[]) => void,
    allAttachmentPhotos: {id: string, url: string}[] 
}) {
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [lightboxSlides, setLightboxSlides] = useState<{ src: string }[]>([]);

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
    
    const handleConfirm = () => {
        const confirmedItems: ExpenseItem[] = (extractionResult.results || [])
            .flatMap(result => result.items)
            .filter(item => item.status === 'matched' && item.matchedItemId)
            .map(item => {
                const inventoryItem = inventoryList.find(i => i.id === item.matchedItemId)!;
                return {
                    itemId: inventoryItem.id,
                    name: inventoryItem.name,
                    supplier: inventoryItem.supplier,
                    unit: inventoryItem.unit,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                };
            });
        onConfirm(confirmedItems);
        onOpenChange(false);
    };

    const totalMatchedItems = extractionResult.results.reduce((acc, result) => acc + result.items.filter(item => item.status === 'matched').length, 0);

    const ItemCard = ({ item, isMatched }: { item: ExtractedInvoiceItem, isMatched: boolean }) => {
        const inventoryItem = isMatched ? inventoryList.find(i => i.id === item.matchedItemId) : null;
        return (
          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex justify-between items-start gap-3">
                 <div className="flex-1">
                    <p className="font-semibold whitespace-normal">{item.itemName}</p>
                    {inventoryItem && <p className="text-xs text-green-600 dark:text-green-400">→ {inventoryItem.name}</p>}
                 </div>
                 <div className="text-right ml-2 shrink-0">
                     <p className="font-semibold text-base">{(item.quantity * item.unitPrice).toLocaleString('vi-VN')}đ</p>
                 </div>
              </div>
              <div className="flex justify-between items-end text-xs text-muted-foreground mt-1">
                <p>SL: <span className="font-medium text-foreground">{item.quantity}</span></p>
                <p>Đơn giá: <span className="font-medium text-foreground">{item.unitPrice.toLocaleString('vi-VN')}đ</span></p>
              </div>
            </CardContent>
          </Card>
        );
      };
      
    const handleViewImages = (imageIds: string[]) => {
        const slides = imageIds
            .map(id => allAttachmentPhotos.find(p => p.id === id)?.url)
            .filter((url): url is string => !!url)
            .map(url => ({ src: url }));
        
        if(slides.length > 0) {
            setLightboxSlides(slides);
            setIsLightboxOpen(true);
        } else {
            toast.error("Không tìm thấy ảnh cho hóa đơn này.");
        }
    };

    return (
        <>
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl" onInteractOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>Kết quả quét hóa đơn</DialogTitle>
                    <DialogDescription>AI đã phân tích và nhóm các hóa đơn. Vui lòng kiểm tra và xác nhận các mặt hàng được tìm thấy. Các mặt hàng không khớp sẽ được bỏ qua.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                    <Accordion type="multiple" defaultValue={extractionResult.results.map(r => r.invoiceTitle)} className="w-full space-y-4 py-4">
                        {extractionResult.results.map((result, resultIndex) => (
                           <AccordionItem value={result.invoiceTitle} key={resultIndex}>
                             <div className="flex items-center">
                                <AccordionTrigger className="text-lg font-semibold flex-1">
                                    {result.invoiceTitle}
                                </AccordionTrigger>
                                <Button variant="ghost" size="icon" className="ml-2" onClick={() => handleViewImages(result.imageIds)}>
                                    <Eye className="h-5 w-5" />
                                </Button>
                             </div>
                             <AccordionContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 py-2">
                                    {/* Matched Items */}
                                    <div className="flex flex-col">
                                        <h4 className="font-semibold mb-2 text-green-600 dark:text-green-400 flex items-center gap-2">
                                        <CheckCircle className="h-5 w-5" /> Đã khớp ({result.items.filter(i => i.status === 'matched').length})
                                        </h4>
                                        <div className="flex-1 rounded-md space-y-2">
                                            {result.items.filter(i => i.status === 'matched').map((item, index) => <ItemCard key={`matched-${resultIndex}-${index}`} item={item} isMatched={true} />)}
                                        </div>
                                    </div>
                                    {/* Unmatched Items */}
                                    <div className="flex flex-col">
                                        <h4 className="font-semibold mb-2 text-red-600 dark:text-red-400 flex items-center gap-2">
                                        <XCircle className="h-5 w-5" /> Không khớp ({result.items.filter(i => i.status === 'unmatched').length})
                                        </h4>
                                        <div className="flex-1 rounded-md space-y-2">
                                             {result.items.filter(i => i.status === 'unmatched').map((item, index) => <ItemCard key={`unmatched-${resultIndex}-${index}`} item={item} isMatched={false} />)}
                                        </div>
                                    </div>
                                </div>
                             </AccordionContent>
                           </AccordionItem>
                        ))}
                    </Accordion>
                </ScrollArea>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
                    <Button onClick={handleConfirm} disabled={totalMatchedItems === 0}>Xác nhận & Thêm {totalMatchedItems} mặt hàng</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
         <Lightbox
            open={isLightboxOpen}
            close={() => setIsLightboxOpen(false)}
            slides={lightboxSlides}
            plugins={[Zoom]}
        />
        </>
    );
}

type ExpenseSlipDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: any, id?: string) => void;
    isProcessing: boolean;
    slipToEdit: ExpenseSlip | null;
    inventoryList: InventoryItem[];
    reporter: AuthUser;
};

export default function ExpenseSlipDialog({
    open,
    onOpenChange,
    onSave,
    isProcessing,
    slipToEdit,
    inventoryList,
    reporter
}: ExpenseSlipDialogProps) {
    const isMobile = useIsMobile();
    const attachmentCardRef = useRef<HTMLDivElement>(null);
    const attachmentFileInputRef = useRef<HTMLInputElement>(null);

    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [items, setItems] = useState<ExpenseItem[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [notes, setNotes] = useState('');
    
    // --- New state for attachments ---
    const [existingPhotos, setExistingPhotos] = useState<{ id: string, url: string }[]>([]);
    const [localPhotos, setLocalPhotos] = useState<{ id: string, url: string }[]>([]);
    const [photosToDelete, setPhotosToDelete] = useState<string[]>([]);
    const [showMissingAttachmentAlert, setShowMissingAttachmentAlert] = useState(false);
    const [isAttachmentCameraOpen, setIsAttachmentCameraOpen] = useState(false);

    // --- State for AI scanning ---
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [extractionResult, setExtractionResult] = useState<InvoiceExtractionResult | null>(null);
    const [showAiPreview, setShowAiPreview] = useState(false);
    
    // --- Lightbox state ---
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


    // Reset form state when dialog opens
    useEffect(() => {
        if (open) {
            if (slipToEdit) {
                setDate(slipToEdit.date);
                setItems(slipToEdit.items);
                setPaymentMethod(slipToEdit.paymentMethod);
                setNotes(slipToEdit.notes || '');
                setExistingPhotos((slipToEdit.attachmentPhotos || []).map(url => ({ id: url, url })));
            } else {
                // Reset for new slip
                setDate(format(new Date(), 'yyyy-MM-dd'));
                setItems([]);
                setPaymentMethod('cash');
                setNotes('');
                setExistingPhotos([]);
            }
            // Always reset local photo state
            setLocalPhotos([]);
            setPhotosToDelete([]);
            setShowMissingAttachmentAlert(false);

        }
    }, [open, slipToEdit]);
    
    const totalAmount = useMemo(() => {
        return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    }, [items]);

    const handleItemsSelected = (selectedInventoryItems: InventoryItem[]) => {
        const newExpenseItems: ExpenseItem[] = selectedInventoryItems.map(invItem => {
            const existing = items.find(exItem => exItem.itemId === invItem.id);
            return existing || {
                itemId: invItem.id,
                name: invItem.name,
                supplier: invItem.supplier,
                unit: invItem.unit,
                quantity: 1, // default
                unitPrice: 0 // default
            };
        });
        setItems(newExpenseItems);
    };

    const handleUpdateItem = (updatedItem: ExpenseItem) => {
        setItems(prevItems => prevItems.map(item => item.itemId === updatedItem.itemId ? updatedItem : item));
    };
    
    const handleRemoveItem = (itemId: string) => {
        setItems(prevItems => prevItems.filter(item => item.itemId !== itemId));
    }

    const handleSave = () => {
        const totalPhotos = existingPhotos.length + localPhotos.length;
        if (totalPhotos === 0) {
            setShowMissingAttachmentAlert(true);
            attachmentCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            toast.error("Vui lòng đính kèm ít nhất một ảnh hóa đơn hoặc hàng hóa.");
            return;
        }

        if (items.length === 0) {
            toast.error('Vui lòng chọn ít nhất một mặt hàng.');
            return;
        }

        const data = {
            date,
            items,
            totalAmount,
            paymentMethod,
            notes,
            existingPhotos: existingPhotos.map(p => p.url),
            photosToDelete,
            newPhotoIds: localPhotos.map(p => p.id),
        };
        
        onSave(data, slipToEdit?.id);
    };
    
    const allAttachmentPhotos = useMemo(() => {
        return [...existingPhotos, ...localPhotos];
    }, [existingPhotos, localPhotos]);

    // --- AI Scanning Logic ---
    const handleAiScan = async () => {
        setShowMissingAttachmentAlert(false);
        if(allAttachmentPhotos.length === 0) {
            toast.error("Vui lòng tải lên ít nhất 1 ảnh hóa đơn để dùng tính năng này.");
            attachmentCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setShowMissingAttachmentAlert(true);
            return;
        }

        setIsAiLoading(true);
        const toastId = toast.loading("AI đang phân tích hóa đơn...");

        try {
            const imagePromises = allAttachmentPhotos.map(async (photo) => {
                let uri: string;
                // Only process new local photos (which have blob URLs)
                if (photo.url.startsWith('blob:')) {
                    const blob = await photoStore.getPhoto(photo.id);
                    if (!blob) return null;
                    uri = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                     return { id: photo.id, uri };
                }
                return null;
            });
            
            const localImages = (await Promise.all(imagePromises))
                .filter((img): img is { id: string; uri: string } => !!img);


            if (localImages.length === 0) {
                 toast.error("Tính năng AI hiện chỉ xử lý được các ảnh mới tải lên trong phiên này.");
                 setIsAiLoading(false);
                 toast.dismiss(toastId);
                 return;
            }

            console.log("Sending to AI:", {
                images: localImages,
                inventoryItems: inventoryList,
            });

            const result = await extractInvoiceItems({
                images: localImages,
                inventoryItems: inventoryList,
            });

            if (!result.isInvoiceFound || result.results.length === 0) {
                toast.error('AI không nhận diện được mặt hàng nào từ các ảnh hóa đơn đã cung cấp.');
            } else {
                setExtractionResult(result);
                setShowAiPreview(true);
            }
        } catch (error) {
            console.error("AI invoice processing failed:", error);
            toast.error("Lỗi AI: Không thể xử lý hóa đơn.");
        } finally {
            toast.dismiss(toastId);
            setIsAiLoading(false);
        }
    };

    const handleAiConfirm = (confirmedItems: ExpenseItem[]) => {
         const newItemsMap = new Map(items.map(item => [item.itemId, item]));
         confirmedItems.forEach(newItem => {
             newItemsMap.set(newItem.itemId, newItem);
         });
         setItems(Array.from(newItemsMap.values()));
    }

    // --- Attachment Management Logic ---
    const handleAttachmentPhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        setShowMissingAttachmentAlert(false);
        const files = event.target.files;
        if (!files) return;

        for (const file of Array.from(files)) {
            const photoId = uuidv4();
            await photoStore.addPhoto(photoId, file);
            const objectUrl = URL.createObjectURL(file);
            setLocalPhotos(prev => [...prev, { id: photoId, url: objectUrl }]);
        }

        if(attachmentFileInputRef.current) attachmentFileInputRef.current.value = '';
    };
    
    const handleAttachmentPhotoCapture = async (capturedPhotoIds: string[]) => {
        setShowMissingAttachmentAlert(false);
        setIsAttachmentCameraOpen(false);
        for (const photoId of capturedPhotoIds) {
            const photoBlob = await photoStore.getPhoto(photoId);
            if (photoBlob) {
                const objectUrl = URL.createObjectURL(photoBlob);
                setLocalPhotos(prev => [...prev, { id: photoId, url: objectUrl }]);
            }
        }
    };
    
    const handleDeleteExistingPhoto = (url: string) => {
        setExistingPhotos(prev => prev.filter(p => p.url !== url));
        setPhotosToDelete(prev => [...prev, url]);
    };
    
    const handleDeleteLocalPhoto = (id: string) => {
        setLocalPhotos(prev => {
            const photoToDelete = prev.find(p => p.id === id);
            if (photoToDelete) {
                URL.revokeObjectURL(photoToDelete.url);
            }
            return prev.filter(p => p.id !== id);
        });
        photoStore.deletePhoto(id);
    };

    const openLightbox = (clickedUrl: string) => {
        const index = allAttachmentPhotos.findIndex(p => p.url === clickedUrl);
        if (index > -1) {
            setLightboxIndex(index);
            setIsLightboxOpen(true);
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-4xl" onInteractOutside={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>{slipToEdit ? 'Chỉnh sửa' : 'Tạo'} Phiếu chi</DialogTitle>
                        <DialogDescription>Nhập thông tin chi tiết cho các khoản chi hàng hóa.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[70vh] -mx-6 px-6 bg-card">
                        <div className="grid gap-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Ngày chứng từ</Label>
                                    <Input value={date} disabled className="bg-muted"/>
                                </div>
                                 <div className="space-y-2">
                                    <Label>Người lập phiếu</Label>
                                    <Input value={reporter.displayName || ''} disabled className="bg-muted"/>
                                </div>
                            </div>

                            {/* --- Attachment Section --- */}
                            <Card 
                                className={cn('transition-all', showMissingAttachmentAlert && 'border-destructive ring-2 ring-destructive/50 bg-destructive/5')} 
                                ref={attachmentCardRef}
                            >
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-base text-primary">Ảnh đính kèm (bắt buộc)</CardTitle>
                                    <CardDescription>Tải lên hoặc chụp ảnh hóa đơn, hàng hóa làm bằng chứng.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col sm:flex-row gap-2 mb-4">
                                        <Button variant="outline" className="w-full" onClick={() => {setShowMissingAttachmentAlert(false); attachmentFileInputRef.current?.click()}}>
                                            <Upload className="mr-2 h-4 w-4"/> Tải ảnh lên
                                        </Button>
                                        <input type="file" ref={attachmentFileInputRef} onChange={handleAttachmentPhotoUpload} className="hidden" accept="image/*" multiple />
                                        <Button variant="outline" className="w-full" onClick={() => {setShowMissingAttachmentAlert(false); setIsAttachmentCameraOpen(true)}}>
                                            <Camera className="mr-2 h-4 w-4"/> Chụp ảnh mới
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                        {existingPhotos.map(photo => (
                                            <div key={photo.id} className="relative aspect-square rounded-md overflow-hidden group">
                                                <button onClick={() => openLightbox(photo.url)} className="w-full h-full">
                                                    <Image src={photo.url} alt="Bằng chứng đã lưu" fill className="object-cover" />
                                                </button>
                                                <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-5 w-5 rounded-full z-10 opacity-0 group-hover:opacity-100" onClick={() => handleDeleteExistingPhoto(photo.url)}><X className="h-3 w-3" /></Button>
                                            </div>
                                        ))}
                                        {localPhotos.map(photo => (
                                            <div key={photo.id} className="relative aspect-square rounded-md overflow-hidden group">
                                                 <button onClick={() => openLightbox(photo.url)} className="w-full h-full">
                                                    <Image src={photo.url} alt="Bằng chứng mới" fill className="object-cover" />
                                                </button>
                                                <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-5 w-5 rounded-full z-10" onClick={() => handleDeleteLocalPhoto(photo.id)}><X className="h-3 w-3" /></Button>
                                            </div>
                                        ))}
                                    </div>
                                    {(existingPhotos.length + localPhotos.length) === 0 && (
                                        <p className="text-center text-sm text-muted-foreground py-4">Chưa có ảnh nào được đính kèm.</p>
                                    )}
                                </CardContent>
                            </Card>
                        
                            {/* --- Item Selection Section --- */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                     <Button onClick={handleAiScan} disabled={isAiLoading} className="w-full">
                                        {isAiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                        Dùng AI quét hóa đơn
                                    </Button>
                                </div>
                                <div className="relative text-center my-4">
                                    <Separator />
                                    <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-sm text-muted-foreground">Hoặc</span>
                                </div>
                                <div className="space-y-2">
                                    <ItemMultiSelect
                                        inventoryItems={inventoryList}
                                        selectedItems={items}
                                        onChange={handleItemsSelected}
                                        className="w-full mt-1"
                                    />
                                </div>
                            </div>


                            <div className="space-y-2">
                                <Label>Chi tiết các mặt hàng</Label>
                                {items.length === 0 ? (
                                    <div className="text-center text-sm text-muted-foreground p-4 border rounded-md border-dashed">
                                        Chưa có mặt hàng nào được chọn.
                                    </div>
                                ) : (
                                    <>
                                        {/* Mobile view */}
                                        <div className="md:hidden space-y-3 p-3 rounded-md bg-card">
                                            {items.map(item => (
                                                <EditItemPopover key={`mobile-${item.itemId}`} item={item} onSave={handleUpdateItem}>
                                                    <Card className="cursor-pointer bg-muted/50">
                                                        <CardContent className="p-4">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <p className="font-semibold text-sm">{item.name}</p>
                                                                    <p className="text-xs text-muted-foreground">{item.supplier}</p>
                                                                </div>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2 shrink-0" onClick={(e) => {e.stopPropagation(); handleRemoveItem(item.itemId)}}>
                                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                                </Button>
                                                            </div>
                                                            <div className="mt-2 grid grid-cols-3 gap-2 text-sm border-t pt-2">
                                                                <p className="text-muted-foreground">SL ({item.unit})</p>
                                                                <p className="text-muted-foreground">Đơn giá</p>
                                                                <p className="text-muted-foreground">Thành tiền</p>
                                                                
                                                                <p className="font-medium text-base">{item.quantity}</p>
                                                                <p className="font-medium text-base">{item.unitPrice.toLocaleString('vi-VN')}</p>
                                                                <p className="font-bold text-base text-primary">{(item.quantity * item.unitPrice).toLocaleString('vi-VN')}</p>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                </EditItemPopover>
                                            ))}
                                        </div>

                                        {/* Desktop view */}
                                        <div className="hidden md:block border rounded-md bg-card">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Tên mặt hàng</TableHead>
                                                        <TableHead>SL ({items[0]?.unit})</TableHead>
                                                        <TableHead>Đơn giá</TableHead>
                                                        <TableHead>Thành tiền</TableHead>
                                                        <TableHead className="text-right">Xóa</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {items.map(item => (
                                                        <EditItemPopover key={`desktop-${item.itemId}`} item={item} onSave={handleUpdateItem}>
                                                            <TableRow className="cursor-pointer">
                                                                <TableCell>
                                                                    <p className="font-medium">{item.name}</p>
                                                                    <p className="text-xs text-muted-foreground">{item.supplier}</p>
                                                                </TableCell>
                                                                <TableCell>{item.quantity}</TableCell>
                                                                <TableCell>{item.unitPrice.toLocaleString('vi-VN')}</TableCell>
                                                                <TableCell>{(item.quantity * item.unitPrice).toLocaleString('vi-VN')}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <Button variant="ghost" size="icon" onClick={(e) => {e.stopPropagation(); handleRemoveItem(item.itemId)}}>
                                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        </EditItemPopover>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </>
                                )}
                            </div>

                             <div className="space-y-2">
                                <Label>Tổng cộng</Label>
                                <Input value={totalAmount.toLocaleString('vi-VN') + 'đ'} disabled className="font-bold text-lg h-12 text-right bg-muted" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Hình thức thanh toán</Label>
                                    <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="flex gap-4">
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="cash" id="pm1" />
                                            <Label htmlFor="pm1">Tiền mặt</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="bank_transfer" id="pm2" />
                                            <Label htmlFor="pm2">Chuyển khoản</Label>
                                        </div>
                                    </RadioGroup>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="notes">Ghi chú</Label>
                                    <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Thêm ghi chú nếu cần..." onFocus={(e) => e.target.select()} />
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
                        <Button onClick={handleSave} disabled={isProcessing}>
                            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Lưu Phiếu chi
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            {/* Attachment Camera Dialog */}
            <CameraDialog isOpen={isAttachmentCameraOpen} onClose={() => setIsAttachmentCameraOpen(false)} onSubmit={handleAttachmentPhotoCapture} />

            {extractionResult && (
                <AiPreviewDialog 
                    open={showAiPreview} 
                    onOpenChange={setShowAiPreview}
                    extractionResult={extractionResult}
                    inventoryList={inventoryList}
                    onConfirm={handleAiConfirm}
                    allAttachmentPhotos={allAttachmentPhotos}
                />
            )}

            <Lightbox
                open={isLightboxOpen}
                close={() => setIsLightboxOpen(false)}
                index={lightboxIndex}
                slides={allAttachmentPhotos.map(p => ({ src: p.url }))}
                plugins={[Zoom]}
            />
        </>
    );
}

