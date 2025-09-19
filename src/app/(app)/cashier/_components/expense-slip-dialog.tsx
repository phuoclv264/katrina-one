
'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import type { ExpenseSlip, PaymentMethod, InventoryItem, ExpenseItem, AuthUser, ExtractedInvoiceItem } from '@/lib/types';
import { Loader2, PlusCircle, Trash2, Camera, Upload } from 'lucide-react';
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
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';


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
                            <Input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="col-span-2 h-8" />
                        </div>
                        <div className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor="unitPrice">Đơn giá</Label>
                            <Input id="unitPrice" type="number" value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} className="col-span-2 h-8" />
                        </div>
                    </div>
                    <Button onClick={handleSave}>Lưu</Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

function AiPreviewDialog({ open, onOpenChange, extractedItems, inventoryList, onConfirm }: { open: boolean, onOpenChange: (open: boolean) => void, extractedItems: ExtractedInvoiceItem[], inventoryList: InventoryItem[], onConfirm: (items: ExpenseItem[]) => void }) {
    
    const handleConfirm = () => {
        const confirmedItems: ExpenseItem[] = extractedItems
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

    const matchedItems = extractedItems.filter(item => item.status === 'matched');
    const unmatchedItems = extractedItems.filter(item => item.status === 'unmatched');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Kết quả quét hóa đơn</DialogTitle>
                    <DialogDescription>AI đã phân tích hóa đơn. Vui lòng kiểm tra và xác nhận các mặt hàng được tìm thấy. Các mặt hàng không khớp sẽ được bỏ qua.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto">
                    <div>
                        <h4 className="font-semibold mb-2 text-green-600">Đã khớp ({matchedItems.length})</h4>
                        <ScrollArea className="h-72">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tên</TableHead>
                                        <TableHead>SL</TableHead>
                                        <TableHead>Đơn giá</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {matchedItems.map((item, index) => (
                                        <TableRow key={`matched-${index}`}>
                                            <TableCell>{item.itemName}</TableCell>
                                            <TableCell>{item.quantity}</TableCell>
                                            <TableCell>{item.unitPrice.toLocaleString('vi-VN')}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                     <div>
                        <h4 className="font-semibold mb-2 text-red-600">Không khớp ({unmatchedItems.length})</h4>
                         <ScrollArea className="h-72">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tên từ hóa đơn</TableHead>
                                        <TableHead>SL</TableHead>
                                        <TableHead>Đơn giá</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {unmatchedItems.map((item, index) => (
                                        <TableRow key={`unmatched-${index}`}>
                                            <TableCell>{item.itemName}</TableCell>
                                            <TableCell>{item.quantity}</TableCell>
                                            <TableCell>{item.unitPrice.toLocaleString('vi-VN')}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
                    <Button onClick={handleConfirm} disabled={matchedItems.length === 0}>Xác nhận & Thêm {matchedItems.length} mặt hàng</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
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
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [items, setItems] = useState<ExpenseItem[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [notes, setNotes] = useState('');
    const [invoiceImage, setInvoiceImage] = useState<{id: string, url: string} | null>(null);

    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [extractedItems, setExtractedItems] = useState<ExtractedInvoiceItem[]>([]);
    const [showAiPreview, setShowAiPreview] = useState(false);

    useEffect(() => {
        if (open) {
            if (slipToEdit) {
                setDate(slipToEdit.date);
                setItems(slipToEdit.items);
                setPaymentMethod(slipToEdit.paymentMethod);
                setNotes(slipToEdit.notes || '');
            } else {
                // Reset form for new slip
                setDate(format(new Date(), 'yyyy-MM-dd'));
                setItems([]);
                setPaymentMethod('cash');
                setNotes('');
                setInvoiceImage(null);
            }
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
        if (items.length === 0) {
            alert('Vui lòng chọn ít nhất một mặt hàng.');
            return;
        }

        const data = {
            date,
            items,
            totalAmount,
            paymentMethod,
            notes,
            invoicePhotoId: invoiceImage?.id,
        };
        
        onSave(data, slipToEdit?.id);
    };
    
    const processInvoiceImage = async (imageUri: string, photoId: string) => {
        setIsAiLoading(true);
        const toastId = toast.loading("AI đang phân tích hóa đơn...");
        
        try {
            setInvoiceImage({id: photoId, url: imageUri});

            const result = await extractInvoiceItems({
                imageDataUri: imageUri,
                inventoryItems: inventoryList,
            });

            if (result.items.length === 0) {
                toast.error('AI không nhận diện được mặt hàng nào từ hóa đơn.');
            } else {
                setExtractedItems(result.items);
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
    
    const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const photoId = uuidv4();
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => {
            const imageDataUri = reader.result as string;
            processInvoiceImage(imageDataUri, photoId);
        };
        
        await photoStore.addPhoto(photoId, file);
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
            reader.readAsDataURL(photoBlob);
            reader.onloadend = () => {
                const imageDataUri = reader.result as string;
                processInvoiceImage(imageDataUri, photoId);
            };
        } catch (error) {
            console.error("Failed to process captured photo", error);
            toast.error("Lỗi xử lý ảnh chụp.");
        }
    };
    
    const handleAiConfirm = (confirmedItems: ExpenseItem[]) => {
         const newItemsMap = new Map(items.map(item => [item.itemId, item]));
         confirmedItems.forEach(newItem => {
             newItemsMap.set(newItem.itemId, newItem);
         });
         setItems(Array.from(newItemsMap.values()));
    }


    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{slipToEdit ? 'Chỉnh sửa' : 'Tạo'} Phiếu chi</DialogTitle>
                        <DialogDescription>Nhập thông tin chi tiết cho các khoản chi hàng hóa.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[70vh] -mx-6 px-6 bg-white dark:bg-black">
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
                        
                            <div className="space-y-2">
                                <Label>Chọn mặt hàng</Label>
                                <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                                     <ItemMultiSelect
                                        inventoryItems={inventoryList}
                                        selectedItems={items}
                                        onChange={handleItemsSelected}
                                        className="flex-1 min-w-[200px]"
                                    />
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isAiLoading} className="flex-1">
                                            {isAiLoading ? <Loader2 className="animate-spin" /> : <Upload />}
                                        </Button>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handlePhotoUpload}
                                            className="hidden"
                                            accept="image/*"
                                        />
                                        <Button variant="outline" size="icon" onClick={() => setIsCameraOpen(true)} disabled={isAiLoading} className="flex-1">
                                            {isAiLoading ? <Loader2 className="animate-spin" /> : <Camera />}
                                        </Button>
                                    </div>
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
                                        <div className="md:hidden space-y-3 p-3 rounded-md">
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
                                                                <div>
                                                                    <p className="text-muted-foreground">Số lượng ({item.unit})</p>
                                                                    <p className="font-medium text-base">{item.quantity}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-muted-foreground">Đơn giá</p>
                                                                    <p className="font-medium text-base">{item.unitPrice.toLocaleString('vi-VN')}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-muted-foreground">Thành tiền</p>
                                                                    <p className="font-bold text-base text-primary">{(item.quantity * item.unitPrice).toLocaleString('vi-VN')}</p>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                </EditItemPopover>
                                            ))}
                                        </div>

                                        {/* Desktop view */}
                                        <div className="hidden md:block border rounded-md">
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
                                    <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Thêm ghi chú nếu cần..." />
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
            <CameraDialog isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onSubmit={handlePhotoCapture} singlePhotoMode={true} />
            <AiPreviewDialog 
                open={showAiPreview} 
                onOpenChange={setShowAiPreview}
                extractedItems={extractedItems}
                inventoryList={inventoryList}
                onConfirm={handleAiConfirm}
            />
        </>
    );
}
