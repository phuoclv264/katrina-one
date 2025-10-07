

// Merged from owner-expense-slip-dialog.tsx and expense-slip-dialog.tsx on 2024-07-30 — refactor only

'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import type { ExpenseSlip, PaymentMethod, InventoryItem, ExpenseItem, AuthUser, ExtractedInvoiceItem, InvoiceExtractionResult, ExpenseType, OtherCostCategory } from '@/lib/types';
import { Loader2, PlusCircle, Trash2, Camera, Upload, CheckCircle, XCircle, AlertCircle, X, Wand2, Eye, Edit2 } from 'lucide-react';
import { ItemMultiSelect } from './item-multi-select';
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
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/plugins/counter.css";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import isEqual from 'lodash.isequal';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


function EditItemPopover({ item, onSave, children, inventoryItem }: { item: ExpenseItem; onSave: (updatedItem: ExpenseItem) => void; children: React.ReactNode, inventoryItem: InventoryItem | undefined }) {
    const [open, setOpen] = useState(false);
    const [quantity, setQuantity] = useState(item.quantity);
    const [unitPrice, setUnitPrice] = useState(item.unitPrice);
    const [selectedUnit, setSelectedUnit] = useState(item.unit);
    
    useEffect(() => {
        if(open) {
            setQuantity(item.quantity);
            setUnitPrice(item.unitPrice);
            setSelectedUnit(item.unit);
        }
    }, [open, item]);

    const handleSave = () => {
        onSave({ ...item, quantity, unitPrice, unit: selectedUnit });
        setOpen(false); // Close popover on save
    };
    
    const availableUnits = inventoryItem?.units?.map(u => u.name) || [item.unit];
    const canSelectUnit = availableUnits.length > 1;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent className="w-80">
                <div className="grid gap-4">
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">{item.name}</h4>
                        <p className="text-sm text-muted-foreground">Nhập số lượng, đơn vị và đơn giá.</p>
                    </div>
                    <div className="grid gap-2">
                         {canSelectUnit && (
                             <div className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor="unit">Đơn vị</Label>
                                <Select value={selectedUnit} onValueChange={(v) => setSelectedUnit(v)}>
                                    <SelectTrigger className="col-span-2 h-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableUnits.map(unitName => (
                                            <SelectItem key={unitName} value={unitName}>{unitName}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                         )}
                        <div className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor="quantity">Số lượng</Label>
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
    onConfirm: (items: ExpenseItem[], totalDiscount: number) => void,
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
                // Find the largest unit by conversion rate
                const largestUnit = inventoryItem.units?.reduce((largest, current) => 
                    (current.conversionRate > largest.conversionRate) ? current : largest, 
                    { name: inventoryItem.baseUnit, conversionRate: 1 }
                );
                const finalUnit = largestUnit?.name || inventoryItem.baseUnit || 'cái';

                return {
                    itemId: inventoryItem.id,
                    name: inventoryItem.name,
                    supplier: inventoryItem.supplier,
                    unit: finalUnit,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                };
            });
        
        const totalDiscount = (extractionResult.results || []).reduce((sum, result) => sum + (result.totalDiscount || 0), 0);

        onConfirm(confirmedItems, totalDiscount);
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
                     <p className="font-semibold text-base">{(item.totalAmount).toLocaleString('vi-VN')}đ</p>
                 </div>
              </div>
              <div className="flex justify-between items-end text-xs text-muted-foreground mt-1">
                <p>SL: <span className="font-medium text-foreground">{item.quantity}</span></p>
                <p>Đơn giá: <span className="font-medium text-foreground">{item.unitPrice.toLocaleString('vi-VN')}đ</span></p>
              </div>
              {item.lineItemDiscount > 0 && (
                  <div className="text-right text-xs mt-1 font-semibold text-red-600 dark:text-red-400">
                      - {item.lineItemDiscount.toLocaleString('vi-VN')}đ
                  </div>
              )}
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
            <DialogContent className="max-w-4xl">
                <div id="ai-preview-lightbox-container"></div>
                <DialogHeader>
                    <DialogTitle>Kết quả quét hóa đơn</DialogTitle>
                    <DialogDescription>AI đã phân tích và nhóm các hóa đơn. Vui lòng kiểm tra và xác nhận các mặt hàng được tìm thấy. Các mặt hàng không khớp sẽ được bỏ qua.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                    <div className="p-1">
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
                                    {result.totalDiscount !== undefined && (
                                        <div className={cn("text-sm font-semibold p-2 rounded-md mb-2", result.totalDiscount > 0 ? "text-red-600 dark:text-red-400 bg-red-100/50 dark:bg-red-900/30" : "text-muted-foreground bg-muted/50")}>
                                            Tổng chiết khấu hóa đơn: {(result.totalDiscount || 0).toLocaleString('vi-VN')}đ
                                        </div>
                                    )}
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
                    </div>
                </ScrollArea>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
                    <Button onClick={handleConfirm} disabled={totalMatchedItems === 0}>Xác nhận</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
         <Lightbox
            open={isLightboxOpen}
            close={() => setIsLightboxOpen(false)}
            slides={lightboxSlides}
            plugins={[Zoom, Counter]}
            carousel={{ finite: true }}
            counter={{ container: { style: { top: "unset", bottom: 0 } } }}
            portal={{ root: document.getElementById("ai-preview-lightbox-container") ?? undefined }}
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
    reporter: AuthUser; // Required for Cashier
    otherCostCategories: OtherCostCategory[];
    isOwnerView?: boolean; // Optional prop to control view
    dateForNewEntry?: string | null;
};

export default function ExpenseSlipDialog({
    open,
    onOpenChange,
    onSave,
    isProcessing,
    slipToEdit,
    inventoryList,
    reporter,
    otherCostCategories,
    isOwnerView = false,
    dateForNewEntry = null,
}: ExpenseSlipDialogProps) {
    const isMobile = useIsMobile();
    const attachmentCardRef = useRef<HTMLDivElement>(null);
    const attachmentFileInputRef = useRef<HTMLInputElement>(null);

    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [items, setItems] = useState<ExpenseItem[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [notes, setNotes] = useState('');
    const [discount, setDiscount] = useState(0);
    const [actualPaidAmount, setActualPaidAmount] = useState(0);

    const [originalSlip, setOriginalSlip] = useState<ExpenseSlip | null>(null);
    
    const [existingPhotos, setExistingPhotos] = useState<{ id: string, url: string }[]>([]);
    const [localPhotos, setLocalPhotos] = useState<{ id: string, file: File, url: string }[]>([]);
    const [photosToDelete, setPhotosToDelete] = useState<string[]>([]);
    const [showMissingAttachmentAlert, setShowMissingAttachmentAlert] = useState(false);
    const [isAttachmentCameraOpen, setIsAttachmentCameraOpen] = useState(false);

    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [extractionResult, setExtractionResult] = useState<InvoiceExtractionResult | null>(null);
    const [showAiPreview, setShowAiPreview] = useState(false);
    
    // State to hold the data as scanned by AI, before any user edits.
    const [aiOriginalData, setAiOriginalData] = useState<{ items: ExpenseItem[], discount: number } | null>(null);
    
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    
    const [expenseType, setExpenseType] = useState<ExpenseType>('goods_import');
    const [otherCostCategoryId, setOtherCostCategoryId] = useState('');
    const [otherCostDescription, setOtherCostDescription] = useState('');
    const [otherCostAmount, setOtherCostAmount] = useState(0);


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
            if (slipToEdit) {
                setOriginalSlip(JSON.parse(JSON.stringify(slipToEdit))); 
                setExpenseType(slipToEdit.expenseType);
                if(slipToEdit.expenseType === 'other_cost' && slipToEdit.items.length > 0) {
                    const otherItem = slipToEdit.items[0];
                    setOtherCostCategoryId(otherItem.otherCostCategoryId || '');
                    setOtherCostDescription(otherItem.description || '');
                    setOtherCostAmount(otherItem.unitPrice);
                    setItems([]);
                } else {
                    setItems(slipToEdit.items);
                    setOtherCostCategoryId('');
                    setOtherCostDescription('');
                    setOtherCostAmount(0);
                }

                setDate(slipToEdit.date);
                setPaymentMethod(slipToEdit.paymentMethod);
                setNotes(slipToEdit.notes || '');
                setDiscount(slipToEdit.discount || 0);
                setActualPaidAmount(slipToEdit.actualPaidAmount ?? slipToEdit.totalAmount);
                setExistingPhotos((slipToEdit.attachmentPhotos || []).map(url => ({ id: url, url })));

            } else {
                setOriginalSlip(null);
                setExpenseType('goods_import');
                setDate(dateForNewEntry || format(new Date(), 'yyyy-MM-dd'));
                setItems([]);
                setPaymentMethod('cash');
                setNotes('');
                setDiscount(0);
                setActualPaidAmount(0);
                setOtherCostCategoryId('');
                setOtherCostDescription('');
                setOtherCostAmount(0);
                setExistingPhotos([]);
            }
            setLocalPhotos([]);
            setPhotosToDelete([]);
            setShowMissingAttachmentAlert(false);
            setAiOriginalData(null); // Reset AI data on dialog open
            setAiError(null);

        }
    }, [open, slipToEdit, dateForNewEntry]);


    const subTotal = useMemo(() => {
        if (expenseType === 'other_cost') {
            return otherCostAmount;
        }
        return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    }, [items, expenseType, otherCostAmount]);

    const totalAmount = useMemo(() => {
        return subTotal - discount;
    }, [subTotal, discount]);

    useEffect(() => {
        if (paymentMethod === 'cash') {
            setActualPaidAmount(totalAmount);
        }
    }, [totalAmount, paymentMethod]);

    const handleItemsSelected = (selectedInventoryItems: InventoryItem[]) => {
        const newExpenseItems: ExpenseItem[] = selectedInventoryItems.map(invItem => {
            const orderUnit = invItem.units.find(u => !u.isBaseUnit) || invItem.units[0];
            return {
                itemId: invItem.id,
                name: invItem.name,
                supplier: invItem.supplier,
                unit: orderUnit.name,
                quantity: 1, // default
                unitPrice: 0 // default
            };
        });
        setItems(prevItems => [...prevItems, ...newExpenseItems]);
    };

    const handleUpdateItem = (index: number, updatedItem: ExpenseItem) => {
        setItems(prevItems => {
            const newItems = [...prevItems];
            newItems[index] = updatedItem;
            return newItems;
        });
    };
    
    const handleRemoveItem = (itemIndex: number) => {
        setItems(prevItems => prevItems.filter((_, index) => index !== itemIndex));
    }

    const handleSave = () => {
        const totalPhotos = existingPhotos.length + localPhotos.length;
        if (totalPhotos === 0) {
            setShowMissingAttachmentAlert(true);
            attachmentCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            toast.error("Vui lòng đính kèm ít nhất một ảnh hóa đơn hoặc bằng chứng.");
            return;
        }

        let finalItems: ExpenseItem[] = [];
        const selectedCategory = otherCostCategories.find(c => c.id === otherCostCategoryId);
        const selectedCategoryName = selectedCategory ? selectedCategory.name : '';

        if (expenseType === 'goods_import') {
            if (items.length === 0) {
                 toast.error('Vui lòng chọn ít nhất một mặt hàng.');
                 return;
            }
            finalItems = items;
        } else { // other_cost
            if (!otherCostCategoryId) {
                 toast.error('Vui lòng chọn loại chi phí.');
                 return;
            }
             if (selectedCategoryName === 'Khác' && !otherCostDescription.trim()) {
                toast.error('Vui lòng nhập mô tả cho chi phí "Khác".');
                return;
            }
            if (otherCostAmount <= 0) {
                toast.error('Vui lòng nhập số tiền chi phí.');
                return;
            }
            finalItems = [{
                itemId: 'other_cost',
                name: selectedCategoryName,
                otherCostCategoryId: otherCostCategoryId,
                description: otherCostDescription.trim(),
                supplier: 'N/A',
                quantity: 1,
                unitPrice: otherCostAmount,
                unit: 'lần',
            }];
        }

        // Logic to determine if the data is AI-generated without edits
        let isAiFlag = false;
        if (aiOriginalData) {
            // Data has been scanned by AI in this session. Check if it's been modified.
            const currentItemsSorted = [...finalItems].sort((a, b) => a.itemId.localeCompare(b.itemId));
            const aiItemsSorted = [...aiOriginalData.items].sort((a, b) => a.itemId.localeCompare(b.itemId));
            const isDataUnchanged = isEqual(currentItemsSorted, aiItemsSorted) && discount === aiOriginalData.discount;
            isAiFlag = isDataUnchanged;
        } else if (slipToEdit?.isAiGenerated) {
            // Editing a previously saved AI slip. Check for modifications against the original slip data.
            const originalItemsSorted = [...(slipToEdit.items || [])].sort((a, b) => a.itemId.localeCompare(b.itemId));
            const currentItemsSorted = [...finalItems].sort((a, b) => a.itemId.localeCompare(b.itemId));
            const isDataUnchanged = isEqual(originalItemsSorted, currentItemsSorted) && discount === (slipToEdit.discount || 0);
            isAiFlag = isDataUnchanged;
        }
        
        const data = {
            expenseType,
            date,
            items: finalItems,
            totalAmount,
            actualPaidAmount: paymentMethod === 'cash' ? actualPaidAmount : undefined,
            discount,
            paymentMethod,
            notes,
            existingPhotos: existingPhotos.map(p => p.url),
            photosToDelete,
            newPhotoIds: localPhotos.map(p => p.id),
            isAiGenerated: isAiFlag,
        };
        
        onSave(data, slipToEdit?.id);
    };
    
    const allAttachmentPhotos = useMemo(() => {
        return [...existingPhotos, ...localPhotos.map(p => ({id: p.id, url: p.url}))];
    }, [existingPhotos, localPhotos]);

    const handleAiScan = async () => {
        setAiError(null);
        setShowMissingAttachmentAlert(false);
        if(allAttachmentPhotos.length === 0) {
            setAiError("Vui lòng tải lên ít nhất 1 ảnh hóa đơn để dùng tính năng này.");
            attachmentCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setShowMissingAttachmentAlert(true);
            return;
        }
        if (expenseType !== 'goods_import') {
            setAiError("Quét hóa đơn chỉ khả dụng cho loại chi 'Nhập hàng'.");
            return;
        }

        setIsAiLoading(true);
        const toastId = toast.loading("AI đang phân tích hóa đơn...");

        try {
            const imagePromises = allAttachmentPhotos.map(async (photo) => {
                let uri: string | null = null;
                // Newly uploaded photos are blob URLs, existing are firebase URLs
                if (photo.url.startsWith('blob:')) {
                    const localPhotoData = localPhotos.find(p => p.id === photo.id);
                    const blob = localPhotoData ? await photoStore.getPhoto(localPhotoData.id) : null;
                    if (blob) {
                        uri = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(blob);
                        });
                    }
                } else if (photo.url.includes('firebasestorage.googleapis.com')) {
                    try {
                        const response = await fetch(`/api/image-proxy?url=${encodeURIComponent(photo.url)}`);
                        if (!response.ok) {
                            console.error(`Proxy request failed for ${photo.url} with status: ${response.status}. Error: ${response.statusText}`);
                            setAiError(`Không thể tải ảnh: ${photo.url.split('/').pop()?.split('?')[0]}.`);
                            return null;
                        }
                        const data = await response.json();
                        uri = data.dataUri;
                    } catch (proxyError) {
                        console.error(`Proxy request failed for ${photo.url}`, proxyError);
                        setAiError(`Lỗi khi tải ảnh qua proxy.`);
                        return null;
                    }
                }
                return uri ? { id: photo.id, uri } : null;
            });

            const processableImages = (await Promise.all(imagePromises))
                .filter((img): img is { id: string; uri: string } => !!img);

            if (processableImages.length === 0) {
                 setAiError("Không thể xử lý bất kỳ ảnh nào. Vui lòng thử lại hoặc kiểm tra console để biết chi tiết.");
                 setIsAiLoading(false);
                 toast.dismiss(toastId);
                 return;
            }

            const result = await extractInvoiceItems({
                images: processableImages,
                inventoryItems: inventoryList,
            });

            if (!result.isInvoiceFound || result.results.length === 0) {
                setAiError(result.rejectionReason || 'AI không nhận diện được mặt hàng nào từ các ảnh hóa đơn đã cung cấp.');
            } else {
                setExtractionResult(result);
                setShowAiPreview(true);
            }
        } catch (error) {
            console.error("AI invoice processing failed:", error);
            setAiError("Lỗi AI: Không thể xử lý hóa đơn.");
        } finally {
            toast.dismiss(toastId);
            setIsAiLoading(false);
        }
    };

    const handleAiConfirm = (confirmedItems: ExpenseItem[], totalDiscount: number) => {
        setItems(confirmedItems);
        setDiscount(totalDiscount);
        // Store the original AI data to track edits
        setAiOriginalData({ items: confirmedItems, discount: totalDiscount });
    };

    const handleAttachmentPhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        setAiError(null);
        setShowMissingAttachmentAlert(false);
        const files = event.target.files;
        if (!files) return;

        const newPhotos = await Promise.all(Array.from(files).map(async (file) => {
            const photoId = uuidv4();
            await photoStore.addPhoto(photoId, file);
            const objectUrl = URL.createObjectURL(file);
            return { id: photoId, file: file, url: objectUrl };
        }));

        setLocalPhotos(prev => [...prev, ...newPhotos]);

        if(attachmentFileInputRef.current) attachmentFileInputRef.current.value = '';
    };
    
    const handleAttachmentPhotoCapture = async (capturedPhotoIds: string[]) => {
        setAiError(null);
        setShowMissingAttachmentAlert(false);
        setIsAttachmentCameraOpen(false);
        for (const photoId of capturedPhotoIds) {
            const photoBlob = await photoStore.getPhoto(photoId);
            if (photoBlob) {
                const objectUrl = URL.createObjectURL(photoBlob);
                setLocalPhotos(prev => [...prev, { id: photoId, file: new File([photoBlob], `${photoId}.jpg`, { type: photoBlob.type }), url: objectUrl }]);
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
    
    const isActuallyAiGenerated = (aiOriginalData && isEqual({items, discount}, aiOriginalData)) || (!aiOriginalData && slipToEdit?.isAiGenerated);


    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent 
                    className="max-w-4xl p-0 h-[90vh] flex flex-col" 
                    onInteractOutside={(e) => e.preventDefault()}
                >
                    <div id="expense-slip-lightbox-container"></div>
                    <DialogHeader className="p-6 pb-4 border-b bg-muted/30">
                        <DialogTitle>{slipToEdit ? (isOwnerView ? 'Chi tiết Phiếu chi' : 'Chỉnh sửa Phiếu chi') : 'Tạo Phiếu chi'}</DialogTitle>
                         <DialogDescription>
                            {isOwnerView && slipToEdit ? (
                                <span className="flex items-center gap-4 flex-wrap">
                                    <span>ID: {slipToEdit.id.slice(0, 8)}</span>
                                    {isActuallyAiGenerated && <Badge className="bg-blue-100 text-blue-800">Tạo bởi AI</Badge>}
                                    {slipToEdit.lastModifiedBy && (
                                        <span className="flex items-center gap-1.5 text-xs italic text-yellow-600 dark:text-yellow-400">
                                            <Edit2 className="h-3 w-3" />
                                            Sửa lần cuối bởi {slipToEdit.lastModifiedBy.userName}
                                        </span>
                                    )}
                                </span>
                            ) : 'Nhập thông tin chi tiết cho các khoản chi.'}
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="flex-grow">
                        <div className="grid gap-6 py-4 px-6">
                             <div className="space-y-2">
                                <Label>Loại chi phí</Label>
                                <RadioGroup value={expenseType} onValueChange={(v) => setExpenseType(v as ExpenseType)} className="flex gap-4">
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="goods_import" id="et1" />
                                        <Label htmlFor="et1">Chi nhập hàng</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="other_cost" id="et2" />
                                        <Label htmlFor="et2">Chi phí khác</Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Ngày chứng từ</Label>
                                    <Input value={date} onChange={e => setDate(e.target.value)} type="date" disabled={!isOwnerView && !!slipToEdit} className={cn((!isOwnerView && !!slipToEdit) && "bg-muted")}/>
                                </div>
                                 <div className="space-y-2">
                                    <Label>Người lập phiếu</Label>
                                    <Input value={slipToEdit?.createdBy.userName || reporter?.displayName || ''} disabled className="bg-muted"/>
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
                                    {aiError && (
                                        <Alert variant="destructive" className="mb-4">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertTitle>Lỗi AI</AlertTitle>
                                            <AlertDescription>{aiError}</AlertDescription>
                                        </Alert>
                                    )}
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
                        
                           {expenseType === 'goods_import' ? (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Button onClick={handleAiScan} disabled={isAiLoading} className="w-full">
                                            {isAiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                            Dùng AI quét hóa đơn
                                        </Button>
                                    </div>
                                    <div className="relative text-center my-4">
                                        <Separator />
                                        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-sm text-muted-foreground">Hoặc</span>
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
                            ) : (
                                <div className="space-y-4">
                                     <div className="space-y-2">
                                        <Label htmlFor="other-cost-category">Loại chi phí</Label>
                                        <Select value={otherCostCategoryId} onValueChange={setOtherCostCategoryId}>
                                            <SelectTrigger id="other-cost-category">
                                                <SelectValue placeholder="Chọn loại chi phí..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {otherCostCategories.map(cat => (
                                                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                     </div>
                                     {otherCostCategories.find(c => c.id === otherCostCategoryId)?.name === 'Khác' && (
                                         <div className="space-y-2">
                                            <Label htmlFor="other-cost-description">Mô tả chi phí</Label>
                                            <Input id="other-cost-description" value={otherCostDescription} onChange={(e) => setOtherCostDescription(e.target.value)} placeholder="Nhập mô tả chi tiết..." onFocus={(e) => e.target.select()} />
                                         </div>
                                     )}
                                      <div className="space-y-2">
                                        <Label htmlFor="other-cost-amount">Tổng số tiền</Label>
                                        <Input id="other-cost-amount" type="number" value={otherCostAmount} onChange={(e) => setOtherCostAmount(Number(e.target.value))} placeholder="0" onFocus={(e) => e.target.select()} />
                                     </div>
                                </div>
                            )}


                            {expenseType === 'goods_import' && items.length > 0 && (
                                <div className="space-y-2">
                                    <Label>Chi tiết các mặt hàng</Label>
                                    <>
                                        {/* Mobile view */}
                                        <div className="md:hidden space-y-3 p-3 rounded-md bg-card">
                                            {items.map((item, index) => {
                                                const inventoryItem = inventoryList.find(i => i.id === item.itemId);
                                                return (
                                                    <EditItemPopover key={`mobile-${item.itemId}-${index}`} item={item} onSave={(updated) => handleUpdateItem(index, updated)} inventoryItem={inventoryItem}>
                                                        <Card className="cursor-pointer bg-muted/50">
                                                            <CardContent className="p-4">
                                                                <div className="flex justify-between items-start">
                                                                    <div>
                                                                        <p className="font-semibold text-sm">{item.name}</p>
                                                                        <p className="text-xs text-muted-foreground">{item.supplier}</p>
                                                                    </div>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2 shrink-0" onClick={(e) => {e.stopPropagation(); handleRemoveItem(index)}}>
                                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                                    </Button>
                                                                </div>
                                                                <div className="mt-2 grid grid-cols-3 gap-2 text-sm border-t pt-2">
                                                                    <p className="text-muted-foreground">Số lượng</p>
                                                                    <p className="text-muted-foreground">Đơn giá</p>
                                                                    <p className="text-muted-foreground">Thành tiền</p>
                                                                    
                                                                    <p className="font-medium text-base">{item.quantity} <span className="text-xs text-muted-foreground">({item.unit})</span></p>
                                                                    <p className="font-medium text-base">{item.unitPrice.toLocaleString('vi-VN')}</p>
                                                                    <p className="font-bold text-base text-primary">{(item.quantity * item.unitPrice).toLocaleString('vi-VN')}</p>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    </EditItemPopover>
                                                )}
                                            )}
                                        </div>

                                        {/* Desktop view */}
                                        <div className="hidden md:block border rounded-md bg-card">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Tên mặt hàng</TableHead>
                                                        <TableHead>Số lượng</TableHead>
                                                        <TableHead>Đơn vị</TableHead>
                                                        <TableHead>Đơn giá</TableHead>
                                                        <TableHead>Thành tiền</TableHead>
                                                        <TableHead className="text-right">Xóa</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {items.map((item, index) => {
                                                         const inventoryItem = inventoryList.find(i => i.id === item.itemId);
                                                        return (
                                                        <EditItemPopover key={`desktop-${item.itemId}-${index}`} item={item} onSave={(updated) => handleUpdateItem(index, updated)} inventoryItem={inventoryItem}>
                                                            <TableRow className="cursor-pointer">
                                                                <TableCell>
                                                                    <p className="font-medium">{item.name}</p>
                                                                    <p className="text-xs text-muted-foreground">{item.supplier}</p>
                                                                </TableCell>
                                                                <TableCell>{item.quantity}</TableCell>
                                                                <TableCell>{item.unit}</TableCell>
                                                                <TableCell>{item.unitPrice.toLocaleString('vi-VN')}</TableCell>
                                                                <TableCell>{(item.quantity * item.unitPrice).toLocaleString('vi-VN')}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <Button variant="ghost" size="icon" onClick={(e) => {e.stopPropagation(); handleRemoveItem(index)}}>
                                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        </EditItemPopover>
                                                        )}
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </>
                                </div>
                            )}
                            
                            <div className="space-y-2">
                                <Label>Chiết khấu (nếu có)</Label>
                                <Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} placeholder="0" className="text-right" onFocus={(e) => e.target.select()} />
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
                                {paymentMethod === 'cash' && (
                                     <div className="space-y-2">
                                        <Label htmlFor="actualPaidAmount">Số tiền thực trả</Label>
                                        <Input id="actualPaidAmount" type="number" value={actualPaidAmount} onChange={(e) => setActualPaidAmount(Number(e.target.value) || 0)} placeholder="0" className="text-right" onFocus={(e) => e.target.select()} />
                                     </div>
                                )}
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="notes">Ghi chú</Label>
                                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Thêm ghi chú nếu cần..." onFocus={(e) => e.target.select()} />
                            </div>
                        </div>
                    </ScrollArea>
                    <DialogFooter className="p-6 pt-4 border-t bg-muted/30">
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
                plugins={[Zoom, Counter]}
                carousel={{ finite: true }}
                counter={{ container: { style: { top: "unset", bottom: 0 } } }}
                portal={{ root: document.getElementById("expense-slip-lightbox-container") ?? undefined }}
            />
        </>
    );
}
