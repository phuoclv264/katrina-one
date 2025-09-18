
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { ExpenseSlip, PaymentMethod, ExpenseType, OtherCostCategory } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { SupplierCombobox } from '@/components/supplier-combobox';

type ExpenseSlipDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: any, id?: string) => void;
    isProcessing: boolean;
    slipToEdit: ExpenseSlip | null;
    suppliers: string[];
    onSuppliersChange: (newSuppliers: string[]) => void;
};

const otherCostCategories: OtherCostCategory[] = ['Lương', 'Điện', 'Nước', 'Dịch vụ', 'Sự cố', 'Khác'];

export default function ExpenseSlipDialog({
    open,
    onOpenChange,
    onSave,
    isProcessing,
    slipToEdit,
    suppliers,
    onSuppliersChange,
}: ExpenseSlipDialogProps) {
    const [type, setType] = useState<ExpenseType>('goods_import');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [amount, setAmount] = useState<number>(0);
    const [notes, setNotes] = useState('');

    // Goods import fields
    const [supplier, setSupplier] = useState('');
    const [itemName, setItemName] = useState('');
    const [quantity, setQuantity] = useState<number | ''>('');
    const [unitPrice, setUnitPrice] = useState<number | ''>('');

    // Other cost fields
    const [otherCostCategory, setOtherCostCategory] = useState<OtherCostCategory>('Khác');

    const totalAmount = useMemo(() => {
        if (type === 'goods_import' && typeof quantity === 'number' && typeof unitPrice === 'number') {
            return quantity * unitPrice;
        }
        return amount;
    }, [type, quantity, unitPrice, amount]);

    useEffect(() => {
        if (open) {
            if (slipToEdit) {
                setType(slipToEdit.type);
                setPaymentMethod(slipToEdit.paymentMethod);
                setAmount(slipToEdit.amount);
                setNotes(slipToEdit.notes || '');
                if (slipToEdit.type === 'goods_import') {
                    setSupplier(slipToEdit.supplier || '');
                    setItemName(slipToEdit.itemName || '');
                    setQuantity(slipToEdit.quantity || '');
                    setUnitPrice(slipToEdit.unitPrice || '');
                } else {
                    setOtherCostCategory(slipToEdit.otherCostCategory || 'Khác');
                }
            } else {
                // Reset form for new slip
                setType('goods_import');
                setPaymentMethod('cash');
                setAmount(0);
                setNotes('');
                setSupplier('');
                setItemName('');
                setQuantity('');
                setUnitPrice('');
                setOtherCostCategory('Khác');
            }
        }
    }, [open, slipToEdit]);
    
     const handleSupplierChange = (newSupplier: string) => {
        setSupplier(newSupplier);
        if (!suppliers.includes(newSupplier)) {
            const newSuppliers = [...suppliers, newSupplier].sort();
            onSuppliersChange(newSuppliers);
        }
    };


    const handleSave = () => {
        const finalAmount = type === 'goods_import' ? totalAmount : amount;
        if (!finalAmount || finalAmount <= 0) {
            alert('Vui lòng nhập số tiền hợp lệ.');
            return;
        }

        const commonData = {
            type,
            paymentMethod,
            amount: finalAmount,
            notes,
        };

        let specificData = {};
        if (type === 'goods_import') {
            specificData = { supplier, itemName, quantity: Number(quantity), unitPrice: Number(unitPrice) };
        } else {
            specificData = { otherCostCategory };
        }
        
        onSave({ ...commonData, ...specificData }, slipToEdit?.id);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>{slipToEdit ? 'Chỉnh sửa' : 'Tạo'} Phiếu chi</DialogTitle>
                    <DialogDescription>Nhập thông tin chi tiết cho khoản chi này.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label>Loại chi</Label>
                        <RadioGroup value={type} onValueChange={(v) => setType(v as ExpenseType)} className="flex gap-4">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="goods_import" id="r1" />
                                <Label htmlFor="r1">Nhập hàng</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="other_cost" id="r2" />
                                <Label htmlFor="r2">Chi phí khác</Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {type === 'goods_import' ? (
                        <div className="space-y-4 p-4 border rounded-md">
                            <div className="space-y-2">
                                <Label htmlFor="supplier">Nhà cung cấp</Label>
                                <SupplierCombobox suppliers={suppliers} value={supplier} onChange={handleSupplierChange} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="itemName">Tên mặt hàng</Label>
                                <Input id="itemName" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="VD: Sữa đặc" />
                            </div>
                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="quantity">Số lượng</Label>
                                    <Input id="quantity" type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} placeholder="0" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="unitPrice">Đơn giá</Label>
                                    <Input id="unitPrice" type="number" value={unitPrice} onChange={e => setUnitPrice(Number(e.target.value))} placeholder="0" />
                                </div>
                            </div>
                             <div className="space-y-2">
                                <Label>Thành tiền</Label>
                                <Input value={totalAmount.toLocaleString('vi-VN') + 'đ'} disabled className="font-bold"/>
                            </div>
                        </div>
                    ) : (
                         <div className="space-y-4 p-4 border rounded-md">
                            <div className="space-y-2">
                                <Label htmlFor="otherCostCategory">Hạng mục chi</Label>
                                <Select value={otherCostCategory} onValueChange={(v) => setOtherCostCategory(v as OtherCostCategory)}>
                                    <SelectTrigger id="otherCostCategory"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {otherCostCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="amount">Số tiền</Label>
                                <Input id="amount" type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} placeholder="0" />
                            </div>
                        </div>
                    )}
                    
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
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
                    <Button onClick={handleSave} disabled={isProcessing}>
                        {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Lưu Phiếu chi
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
