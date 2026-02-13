
'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogAction,
    DialogCancel,
    DialogBody
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { ExpenseSlip, InventoryItem, ExpenseItem, SupplierBankInfo } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, Check, Undo, History, Wallet, AlertCircle, CheckCircle2, Copy, Settings2 } from 'lucide-react';
import { toast } from '@/components/ui/pro-toast';
import { format, parseISO } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Combobox } from '@/components/combobox';
import { Badge } from '@/components/ui/badge';
import { dataStore } from '@/lib/data-store';
import { VIETQR_BANKS } from '@/lib/vietqr-banks';
import SupplierManagementDialog from './supplier-management-dialog';
import { ShareQrButton } from '@/components/share-qr-button';

type UnpaidSlipsDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    bankTransferSlips: ExpenseSlip[];
    onMarkAsPaid: (items: { slipId: string, supplier: string }[]) => Promise<void>;
    onUndoPayment: (slipId: string, supplier: string) => Promise<void>;
    inventoryList: InventoryItem[];
    parentDialogTag: string;
};

type GroupedBySupplier = {
    [supplier: string]: {
        slips: {
            [slipId: string]: {
                slipDate: string;
                slipCreatedBy: string;
                slipTotal: number;
                items: ExpenseItem[];
            };
        };
        total?: number;
    };
};

type SupplierBankAccountOption = {
    id: string;
    bankId: string;
    bankAccountNumber: string;
    accountName: string;
    accountLabel: string;
};

type SupplierBankInfoMap = Record<string, SupplierBankAccountOption[]>;

type SupplierTransferQrPreview = {
    supplier: string;
    amount: number;
    selectedAccountId: string;
    accountOptions: SupplierBankAccountOption[];
    qrUrl: string;
};

const getSlipContentName = (item: ExpenseItem): string => {
    if (item.itemId === 'other_cost') {
        if (item.name === 'Khác' && item.description) {
            return `${item.name} (${item.description})`;
        }
        return item.name;
    }
    return item.name;
}

export default function UnpaidSlipsDialog({ isOpen, onClose, bankTransferSlips, onMarkAsPaid, onUndoPayment, inventoryList, parentDialogTag }: UnpaidSlipsDialogProps) {
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [isProcessing, setIsProcessing] = useState(false);
    const [supplierBankInfoMap, setSupplierBankInfoMap] = useState<SupplierBankInfoMap>({});
    const [suppliers, setSuppliers] = useState<string[]>([]);
    const [isSupplierManagementOpen, setIsSupplierManagementOpen] = useState(false);
    const [isQrPreviewOpen, setIsQrPreviewOpen] = useState(false);
    const [transferQrPreviews, setTransferQrPreviews] = useState<SupplierTransferQrPreview[]>([]);

    useEffect(() => {
        if (isOpen) {
            setSelectedItems(new Set());
        }
    }, [isOpen]);

    useEffect(() => {
        const unsubscribeBank = dataStore.subscribeToSupplierBankInfo((list) => {
            const nextMap = list.reduce<SupplierBankInfoMap>((acc, item, index) => {
                const supplier = item.supplier;
                if (!acc[supplier]) {
                    acc[supplier] = [];
                }
                acc[supplier].push({
                    id: item.id || `${supplier}-${item.bankId || 'bank'}-${item.bankAccountNumber || 'account'}-${index}`,
                    bankId: item.bankId || '',
                    bankAccountNumber: item.bankAccountNumber || '',
                    accountName: item.accountName || supplier,
                    accountLabel: item.accountLabel || `Tài khoản ${acc[supplier].length + 1}`,
                });
                return acc;
            }, {});
            setSupplierBankInfoMap(nextMap);
        });

        const unsubscribeSuppliers = dataStore.subscribeToSuppliers(setSuppliers);

        return () => {
            unsubscribeBank();
            unsubscribeSuppliers();
        };
    }, []);

    const {
        unpaidGroupedBySupplier,
        paidGroupedBySupplier,
        unpaidOtherCostSlips,
        paidOtherCostSlips,
        sortedUnpaidSuppliers,
        sortedPaidSuppliers
    } = useMemo(() => {
        const unpaidSupplierData: GroupedBySupplier = {};
        const paidSupplierData: GroupedBySupplier = {};
        const unpaidOthers: ExpenseSlip[] = [];
        const paidOthers: ExpenseSlip[] = [];

        bankTransferSlips.forEach(slip => {
            const isOtherCostSlip = slip.expenseType === 'other_cost';
            const otherCostItem = isOtherCostSlip ? slip.items[0] : null;

            if (isOtherCostSlip && otherCostItem) {
                if (otherCostItem.isPaid) {
                    if (!paidOthers.some(s => s.id === slip.id)) paidOthers.push(slip);
                } else {
                    if (!unpaidOthers.some(s => s.id === slip.id)) unpaidOthers.push(slip);
                }
            } else {
                const itemsBySupplier: { [supplier: string]: ExpenseItem[] } = {};
                slip.items.forEach(item => {
                    if (!itemsBySupplier[item.supplier || 'Không rõ']) {
                        itemsBySupplier[item.supplier || 'Không rõ'] = [];
                    }
                    itemsBySupplier[item.supplier || 'Không rõ'].push(item);
                });

                for (const supplier in itemsBySupplier) {
                    const supplierItems = itemsBySupplier[supplier];
                    const areAllPaid = supplierItems.every(item => item.isPaid);
                    const targetGroup = areAllPaid ? paidSupplierData : unpaidSupplierData;

                    if (!targetGroup[supplier]) {
                        targetGroup[supplier] = { slips: {} };
                    }
                    if (!targetGroup[supplier].slips[slip.id]) {
                        targetGroup[supplier].slips[slip.id] = {
                            slipDate: slip.date,
                            slipCreatedBy: slip.createdBy.userName,
                            slipTotal: 0,
                            items: [],
                        };
                    }

                    const slipTotalForSupplier = supplierItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
                    targetGroup[supplier].slips[slip.id].slipTotal += slipTotalForSupplier;
                    targetGroup[supplier].slips[slip.id].items.push(...supplierItems);
                }
            }
        });

        const sortedUnpaid = Object.keys(unpaidSupplierData).sort((a, b) => a.localeCompare(b, 'vi'));
        const sortedPaid = Object.keys(paidSupplierData).sort((a, b) => a.localeCompare(b, 'vi'));

        // Add total to each supplier group after all slips are processed.
        Object.keys(unpaidSupplierData).forEach(supplier => {
            unpaidSupplierData[supplier].total = Object.values(unpaidSupplierData[supplier].slips).reduce((sum, slipData) => sum + slipData.slipTotal, 0);
        });
        Object.keys(paidSupplierData).forEach(supplier => {
            paidSupplierData[supplier].total = Object.values(paidSupplierData[supplier].slips).reduce((sum, slipData) => sum + slipData.slipTotal, 0);
        });

        return {
            unpaidGroupedBySupplier: unpaidSupplierData as (GroupedBySupplier & { [key: string]: { total: number } }),
            paidGroupedBySupplier: paidSupplierData as (GroupedBySupplier & { [key: string]: { total: number } }),
            unpaidOtherCostSlips: unpaidOthers.sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()),
            paidOtherCostSlips: paidOthers.sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()),
            sortedUnpaidSuppliers: sortedUnpaid,
            sortedPaidSuppliers: sortedPaid,
        };
    }, [bankTransferSlips]);


    const getCompositeKey = (slipId: string, supplier: string) => `${slipId}__${supplier}`;

    const selectedAmountBySupplier = useMemo(() => {
        const supplierTotals: Record<string, number> = {};
        for (const key of selectedItems) {
            const [slipId, supplier] = key.split('__');
            if (supplier === 'other_cost') continue;
            const supplierData = unpaidGroupedBySupplier[supplier];
            const slipData = supplierData?.slips[slipId];
            if (slipData) {
                supplierTotals[supplier] = (supplierTotals[supplier] || 0) + slipData.slipTotal;
            }
        }
        return supplierTotals;
    }, [selectedItems, unpaidGroupedBySupplier]);

    const selectedSupplierList = useMemo(
        () => Object.keys(selectedAmountBySupplier).filter(supplier => selectedAmountBySupplier[supplier] > 0),
        [selectedAmountBySupplier]
    );

    const managedSuppliers = useMemo(() => {
        const combined = new Set<string>([
            ...suppliers,
            ...sortedUnpaidSuppliers,
            ...sortedPaidSuppliers,
        ]);
        return Array.from(combined).sort((a, b) => a.localeCompare(b, 'vi'));
    }, [suppliers, sortedUnpaidSuppliers, sortedPaidSuppliers]);

    const selectedSuppliersMissingBankInfo = useMemo(() => {
        return selectedSupplierList.filter(supplier => {
            const accountOptions = supplierBankInfoMap[supplier] || [];
            return accountOptions.length === 0;
        });
    }, [selectedSupplierList, supplierBankInfoMap]);

    const getAccountLabel = (account: SupplierBankAccountOption) => {
        const bankShortName = VIETQR_BANKS.find(bank => bank.bin === account.bankId)?.shortName || account.bankId;
        return `${account.accountLabel} • ${bankShortName} • ${account.bankAccountNumber}`;
    };

    const buildQrUrl = (supplier: string, amount: number, account: SupplierBankAccountOption) => {
        const accountName = (account.accountName || supplier).trim();
        const transferNote = `KATRINA COFFEE THANH TOAN`;
        return `https://img.vietqr.io/image/${account.bankId}-${account.bankAccountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(transferNote)}&accountName=${encodeURIComponent(accountName)}`;
    };

    const handleSelectAllForSupplier = (supplier: string, isChecked: boolean) => {
        const slipKeysForSupplier = Object.keys(unpaidGroupedBySupplier[supplier].slips).map(slipId => getCompositeKey(slipId, supplier));

        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (isChecked) {
                slipKeysForSupplier.forEach(key => newSet.add(key));
            } else {
                slipKeysForSupplier.forEach(key => newSet.delete(key));
            }
            return newSet;
        });
    };

    const handleSelectSlip = (key: string, isChecked: boolean) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (isChecked) {
                newSet.add(key);
            } else {
                newSet.delete(key);
            }
            return newSet;
        });
    };

    const totalSelectedAmount = useMemo(() => {
        let total = 0;
        for (const key of selectedItems) {
            const [slipId, supplier] = key.split('__');
            if (supplier === 'other_cost') {
                const slip = unpaidOtherCostSlips.find(s => s.id === slipId);
                if (slip) {
                    total += slip.totalAmount;
                }
            } else {
                const supplierData = unpaidGroupedBySupplier[supplier];
                const slipData = supplierData?.slips[slipId];
                if (slipData) {
                    total += slipData.slipTotal;
                }
            }
        }
        return total;
    }, [selectedItems, unpaidGroupedBySupplier, unpaidOtherCostSlips]);

    const markSelectedAsPaid = async () => {
        if (selectedItems.size === 0) return;
        setIsProcessing(true);
        try {
            const itemsToUpdate = Array.from(selectedItems).map(key => {
                const [slipId, supplier] = key.split('__');
                return { slipId, supplier };
            });
            await onMarkAsPaid(itemsToUpdate);
            toast.success(`Đã đánh dấu ${selectedItems.size} khoản nợ là đã thanh toán.`);
            setSelectedItems(new Set());
        } catch (error) {
            console.error("Failed to mark items as paid:", error);
            toast.error('Lỗi: Không thể cập nhật trạng thái thanh toán.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleMarkAsPaid = async () => {
        if (selectedItems.size === 0) return;

        if (selectedSuppliersMissingBankInfo.length > 0) {
            toast.error(`Thiếu thông tin ngân hàng: ${selectedSuppliersMissingBankInfo.join(', ')}`);
            return;
        }

        if (selectedSupplierList.length === 0) {
            await markSelectedAsPaid();
            return;
        }

        const qrPreviews = selectedSupplierList.map((supplier) => {
            const accountOptions = supplierBankInfoMap[supplier] || [];
            const defaultAccount = accountOptions[0];
            const amount = Math.round(selectedAmountBySupplier[supplier] || 0);

            return {
                supplier,
                amount,
                selectedAccountId: defaultAccount.id,
                accountOptions,
                qrUrl: buildQrUrl(supplier, amount, defaultAccount),
            };
        });

        setTransferQrPreviews(qrPreviews);
        setIsQrPreviewOpen(true);
    };

    const handleConfirmTransferAndMarkPaid = async () => {
        setIsQrPreviewOpen(false);
        await markSelectedAsPaid();
    };

    const handleChangeQrAccount = (supplier: string, accountId: string) => {
        setTransferQrPreviews(prev => prev.map(preview => {
            if (preview.supplier !== supplier) return preview;

            const selectedAccount = preview.accountOptions.find(account => account.id === accountId);
            if (!selectedAccount) return preview;

            return {
                ...preview,
                selectedAccountId: accountId,
                qrUrl: buildQrUrl(preview.supplier, preview.amount, selectedAccount),
            };
        }));
    };

    const handleUndoPayment = async (slipId: string, supplier: string) => {
        setIsProcessing(true);
        try {
            await onUndoPayment(slipId, supplier);
            toast.success('Đã hoàn tác thanh toán.');
        } catch (error) {
            console.error("Failed to undo payment:", error);
            toast.error('Lỗi: Không thể hoàn tác thanh toán.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <>
        <Dialog open={isOpen} onOpenChange={onClose} dialogTag="unpaid-slips-dialog" parentDialogTag={parentDialogTag}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden rounded-[2rem]">
                <DialogHeader iconkey="wallet" variant="info">
                    <DialogTitle>Công nợ Chuyển khoản</DialogTitle>
                    <DialogDescription>
                        Quản lý các phiếu chi chuyển khoản chưa thanh toán và lịch sử đã thanh toán.
                    </DialogDescription>
                </DialogHeader>

                <DialogBody className="p-0 flex flex-col overflow-hidden">
                    <Tabs defaultValue="unpaid" className="w-full h-full flex flex-col overflow-hidden">
                        <div className="px-4 py-3 bg-white dark:bg-card sticky top-0 z-20 border-b">
                            <TabsList className="grid w-full grid-cols-2 p-1 bg-muted/20 rounded-xl">
                                <TabsTrigger 
                                    value="unpaid" 
                                    className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
                                >
                                    Chưa thanh toán
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="history" 
                                    className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
                                >
                                    Lịch sử thanh toán
                                </TabsTrigger>
                            </TabsList>
                            <div className="mt-2 flex justify-end">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-8 rounded-lg"
                                    onClick={() => setIsSupplierManagementOpen(true)}
                                >
                                    <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                                    Quản lý nhà cung cấp
                                </Button>
                            </div>
                        </div>

                        <TabsContent value="unpaid" className="flex-grow overflow-hidden m-0">
                            {sortedUnpaidSuppliers.length === 0 && unpaidOtherCostSlips.length === 0 ? (
                                <div className="h-full flex items-center justify-center p-8">
                                    <div className="text-center space-y-4">
                                        <div className="bg-green-100 dark:bg-green-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                                            <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
                                        </div>
                                        <p className="text-muted-foreground font-medium">Không có công nợ nào chưa thanh toán.</p>
                                    </div>
                                </div>
                            ) : (
                                <ScrollArea className="h-full">
                                    <div className="p-4 space-y-4">
                                        <Accordion type="multiple" defaultValue={[...sortedUnpaidSuppliers, 'other-costs']} className="space-y-4">
                                            {sortedUnpaidSuppliers.map(supplier => {
                                                const supplierData = unpaidGroupedBySupplier[supplier];
                                                const slipCount = Object.keys(supplierData.slips).length;
                                                const allSlipsForSupplier = Object.keys(supplierData.slips).map(slipId => getCompositeKey(slipId, supplier));
                                                const areAllSelected = allSlipsForSupplier.every(key => selectedItems.has(key));
                                                const accountOptions = supplierBankInfoMap[supplier] || [];
                                                const hasBankInfo = accountOptions.length > 0;

                                                return (
                                                    <AccordionItem value={supplier} key={supplier} className="border-none rounded-[1.5rem] bg-muted/5 overflow-hidden">
                                                        <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/10 transition-colors">
                                                            <div className="flex items-center justify-between w-full pr-2">
                                                                <div className="flex flex-col items-start text-left gap-1">
                                                                    <span className="font-bold text-base sm:text-lg text-primary leading-none">{supplier}</span>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">{slipCount} phiếu chi</span>
                                                                        <Badge 
                                                                            variant="outline" 
                                                                            className={cn(
                                                                                'h-5 px-1.5 text-[10px] uppercase tracking-widest font-bold border-none shadow-none',
                                                                                hasBankInfo 
                                                                                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' 
                                                                                    : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20'
                                                                            )}
                                                                        >
                                                                            {hasBankInfo ? (
                                                                                <div className="flex items-center gap-1">
                                                                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                                                                    <span>Đã có bank</span>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex items-center gap-1">
                                                                                    <AlertCircle className="h-2.5 w-2.5" />
                                                                                    <span>Thiếu bank</span>
                                                                                </div>
                                                                            )}
                                                                        </Badge>
                                                                    </div>
                                                                </div>
                                                                <span className="text-red-600 font-black text-lg sm:text-xl shrink-0 tabular-nums">
                                                                    {supplierData.total.toLocaleString('vi-VN')}đ
                                                                </span>
                                                            </div>
                                                        </AccordionTrigger>
                                                        <AccordionContent className="px-5 pb-5 space-y-5">
                                                            <div className="rounded-xl border border-muted/30 bg-muted/10 p-3 flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <Badge variant="outline" className="text-xs whitespace-nowrap">
                                                                        {accountOptions.length} tài khoản
                                                                    </Badge>
                                                                </div>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 rounded-lg shrink-0"
                                                                    onClick={() => setIsSupplierManagementOpen(true)}
                                                                >
                                                                    <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                                                                    Quản lý
                                                                </Button>
                                                            </div>

                                                            <div className="flex items-center gap-3 pt-2">
                                                                <Checkbox
                                                                    id={`select-all-${supplier}`}
                                                                    checked={areAllSelected}
                                                                    onCheckedChange={(checked) => handleSelectAllForSupplier(supplier, !!checked)}
                                                                    className="w-5 h-5 rounded-md"
                                                                />
                                                                <label htmlFor={`select-all-${supplier}`} className="text-sm font-semibold cursor-pointer select-none">
                                                                    Chọn tất cả để thanh toán
                                                                </label>
                                                            </div>
                                                            <div className="space-y-3">
                                                                {Object.entries(supplierData.slips).map(([slipId, slipData]) => {
                                                                    const key = getCompositeKey(slipId, supplier);
                                                                    const itemsSummary = slipData.items
                                                                        .map(item => {
                                                                            const inventoryItem = inventoryList.find(i => i.id === item.itemId);
                                                                            const shortName = inventoryItem?.shortName || item.name;
                                                                            const totalItemPrice = (item.quantity * item.unitPrice).toLocaleString('vi-VN') + 'đ';
                                                                            return `${shortName} x ${item.quantity} (${totalItemPrice})`;
                                                                        }).join(', ');

                                                                    return (
                                                                        <div 
                                                                            key={key} 
                                                                            className={cn(
                                                                                "relative flex items-start gap-4 p-4 rounded-2xl transition-all border select-none cursor-pointer",
                                                                                selectedItems.has(key) 
                                                                                    ? "bg-primary/5 border-primary/20 shadow-sm" 
                                                                                    : "bg-white dark:bg-background border-muted/20 hover:border-primary/30"
                                                                            )}
                                                                            onClick={() => handleSelectSlip(key, !selectedItems.has(key))}
                                                                        >
                                                                            <Checkbox
                                                                                checked={selectedItems.has(key)}
                                                                                className="mt-1 w-5 h-5 rounded-md shrink-0"
                                                                                onCheckedChange={(checked) => {
                                                                                    // Checkbox click handled by parent div
                                                                                }}
                                                                            />
                                                                            <div className="flex-grow min-w-0">
                                                                                <div className="flex justify-between items-start gap-2 mb-1">
                                                                                    <span className="font-bold text-sm sm:text-base">
                                                                                        Ngày {format(parseISO(slipData.slipDate), 'dd/MM/yyyy')}
                                                                                    </span>
                                                                                    <span className="font-bold text-red-600 shrink-0">
                                                                                        {slipData.slipTotal.toLocaleString('vi-VN')}đ
                                                                                    </span>
                                                                                </div>
                                                                                <div className="flex flex-col gap-1">
                                                                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                                                        <span className="bg-muted/50 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider shrink-0">
                                                                                            Lập bởi
                                                                                        </span>
                                                                                        <span className="font-medium">{slipData.slipCreatedBy}</span>
                                                                                    </div>
                                                                                    <p className="text-xs text-muted-foreground/80 leading-relaxed italic line-clamp-2">
                                                                                        {itemsSummary}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                );
                                            })}

                                            {unpaidOtherCostSlips.length > 0 && (
                                                <AccordionItem value="other-costs" className="border-none rounded-[1.5rem] bg-muted/5 overflow-hidden">
                                                    <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/10 transition-colors">
                                                        <div className="flex items-center justify-between w-full pr-2">
                                                            <div className="flex flex-col items-start text-left">
                                                                <span className="font-bold text-base sm:text-lg text-primary">Chi phí khác</span>
                                                                <span className="text-xs text-muted-foreground">{unpaidOtherCostSlips.length} khoản chi</span>
                                                            </div>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent className="px-5 pb-5 space-y-3">
                                                        {unpaidOtherCostSlips.map(slip => {
                                                            const key = getCompositeKey(slip.id, 'other_cost');
                                                            return (
                                                                <div 
                                                                    key={slip.id} 
                                                                    className={cn(
                                                                        "relative flex items-center gap-4 p-4 rounded-2xl transition-all border select-none cursor-pointer",
                                                                        selectedItems.has(key) 
                                                                            ? "bg-primary/5 border-primary/20 shadow-sm" 
                                                                            : "bg-white dark:bg-background border-muted/20 hover:border-primary/30"
                                                                    )}
                                                                    onClick={() => handleSelectSlip(key, !selectedItems.has(key))}
                                                                >
                                                                    <Checkbox
                                                                        checked={selectedItems.has(key)}
                                                                        className="w-5 h-5 rounded-md shrink-0"
                                                                        onCheckedChange={() => {}}
                                                                    />
                                                                    <div className="flex-grow min-w-0">
                                                                        <div className="flex justify-between items-center gap-2">
                                                                            <p className="font-bold text-sm sm:text-base">
                                                                                {getSlipContentName(slip.items[0])}
                                                                            </p>
                                                                            <p className="font-bold text-red-600 shrink-0">
                                                                                {slip.totalAmount.toLocaleString('vi-VN')}đ
                                                                            </p>
                                                                        </div>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            Ngày {format(parseISO(slip.date), 'dd/MM/yyyy')} • Lập bởi {slip.createdBy.userName}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </AccordionContent>
                                                </AccordionItem>
                                            )}
                                        </Accordion>
                                    </div>
                                </ScrollArea>
                            )}
                        </TabsContent>

                        <TabsContent value="history" className="flex-grow overflow-hidden m-0">
                            {sortedPaidSuppliers.length === 0 && paidOtherCostSlips.length === 0 ? (
                                <div className="h-full flex items-center justify-center p-8">
                                    <div className="text-center space-y-4">
                                        <div className="bg-blue-100 dark:bg-blue-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                                            <History className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <p className="text-muted-foreground font-medium">Chưa có lịch sử thanh toán nào.</p>
                                    </div>
                                </div>
                            ) : (
                                <ScrollArea className="h-full">
                                    <div className="p-4 space-y-4">
                                        <Accordion type="multiple" defaultValue={[...sortedPaidSuppliers, 'other-costs-paid']} className="space-y-4">
                                            {sortedPaidSuppliers.map(supplier => {
                                                const supplierData = paidGroupedBySupplier[supplier];
                                                return (
                                                    <AccordionItem value={supplier} key={`paid-${supplier}`} className="border-none rounded-[1.5rem] bg-muted/5 overflow-hidden">
                                                        <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/10 transition-colors">
                                                            <div className="flex items-center justify-between w-full pr-2">
                                                                <span className="font-bold text-base sm:text-lg text-primary">{supplier}</span>
                                                                <span className="text-green-600 font-bold text-base sm:text-lg shrink-0">
                                                                    {supplierData.total.toLocaleString('vi-VN')}đ
                                                                </span>
                                                            </div>
                                                        </AccordionTrigger>
                                                        <AccordionContent className="px-5 pb-5 space-y-3">
                                                            {Object.entries(supplierData.slips).map(([slipId, slipData]) => (
                                                                <div 
                                                                    key={`${slipId}-${supplier}`} 
                                                                    className="bg-white dark:bg-background p-4 rounded-2xl border border-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm"
                                                                >
                                                                    <div className="flex flex-col gap-1 min-w-0">
                                                                        <div className="flex items-baseline gap-2">
                                                                            <p className="font-bold text-sm sm:text-base">
                                                                                Ngày {format(parseISO(slipData.slipDate), 'dd/MM/yyyy')}
                                                                            </p>
                                                                            <p className="text-green-600 font-bold text-sm">
                                                                                {slipData.slipTotal.toLocaleString('vi-VN')}đ
                                                                            </p>
                                                                        </div>
                                                                        <p className="text-xs text-muted-foreground font-medium">
                                                                            Lập bởi: {slipData.slipCreatedBy}
                                                                        </p>
                                                                    </div>
                                                                    <Button 
                                                                        size="sm" 
                                                                        variant="ghost" 
                                                                        className="h-8 rounded-lg text-xs bg-muted/30 hover:bg-muted font-bold text-primary shrink-0 w-full sm:w-auto mt-2 sm:mt-0"
                                                                        onClick={() => handleUndoPayment(slipId, supplier)} 
                                                                        disabled={isProcessing}
                                                                    >
                                                                        {isProcessing ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Undo className="mr-1.5 h-3 w-3" />}
                                                                        Hoàn tác
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                );
                                            })}

                                            {paidOtherCostSlips.length > 0 && (
                                                <AccordionItem value="other-costs-paid" className="border-none rounded-[1.5rem] bg-muted/5 overflow-hidden">
                                                    <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/10 transition-colors">
                                                        <div className="flex items-center justify-between w-full pr-2">
                                                            <span className="font-bold text-base sm:text-lg text-primary">Chi phí khác đã thanh toán</span>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent className="px-5 pb-5 space-y-3">
                                                        {paidOtherCostSlips.map(slip => (
                                                            <div 
                                                                key={slip.id} 
                                                                className="bg-white dark:bg-background p-4 rounded-2xl border border-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm"
                                                            >
                                                                <div className="min-w-0 flex flex-col gap-1">
                                                                    <p className="font-bold text-sm sm:text-base">{getSlipContentName(slip.items[0])}</p>
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="text-xs text-muted-foreground">
                                                                            Ngày {format(parseISO(slip.date), 'dd/MM/yyyy')}
                                                                        </p>
                                                                        <span className="text-green-600 font-bold text-xs">
                                                                            {slip.totalAmount.toLocaleString('vi-VN')}đ
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="ghost" 
                                                                    className="h-8 rounded-lg text-xs bg-muted/30 hover:bg-muted font-bold text-primary shrink-0 w-full sm:w-auto"
                                                                    onClick={() => handleUndoPayment(slip.id, 'other_cost')} 
                                                                    disabled={isProcessing}
                                                                >
                                                                    {isProcessing ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Undo className="mr-1.5 h-3 w-3" />}
                                                                    Hoàn tác
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </AccordionContent>
                                                </AccordionItem>
                                            )}
                                        </Accordion>
                                    </div>
                                </ScrollArea>
                            )}
                        </TabsContent>
                    </Tabs>
                </DialogBody>

                <DialogFooter>
                    <DialogCancel onClick={onClose} disabled={isProcessing}>Đóng</DialogCancel>
                    <DialogAction 
                        onClick={handleMarkAsPaid} 
                        disabled={isProcessing || selectedItems.size === 0}
                        variant="default"
                    >
                        {isProcessing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Wallet className="mr-2 h-4 w-4" />
                        )}
                        {totalSelectedAmount > 0 
                            ? `Tạo QR & Thanh toán (${totalSelectedAmount.toLocaleString('vi-VN')}đ)` 
                            : `Xác nhận TT (${selectedItems.size})`}
                    </DialogAction>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={isQrPreviewOpen} onOpenChange={setIsQrPreviewOpen} dialogTag="supplier-transfer-qr-dialog" parentDialogTag="unpaid-slips-dialog">
            <DialogContent className="max-w-3xl h-[90vh] sm:h-[80vh] flex flex-col p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl">
                <DialogHeader iconkey="wallet" variant="info" >
                    <DialogTitle className="text-2xl font-black tracking-tight">Thanh toán Chuyển khoản VietQR</DialogTitle>
                    <DialogDescription className="text-sm font-medium">
                        Quét mã QR bằng ứng dụng Ngân hàng để thực hiện chuyển khoản cho từng nhà cung cấp.
                    </DialogDescription>
                </DialogHeader>

                <DialogBody className="p-0 overflow-hidden bg-muted/20">
                    <ScrollArea className="h-full px-6 py-6">
                        <div className="space-y-6 max-w-2xl mx-auto pb-6">
                            {transferQrPreviews.map((preview) => {
                                const selectedAccount = preview.accountOptions.find(account => account.id === preview.selectedAccountId) || preview.accountOptions[0];
                                const bankShortName = VIETQR_BANKS.find(bank => bank.bin === selectedAccount.bankId)?.shortName || selectedAccount.bankId;

                                return (
                                <div
                                    key={preview.supplier}
                                    className="relative bg-white dark:bg-card rounded-[2rem] border shadow-sm overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500"
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
                                        <Wallet className="w-32 h-32" />
                                    </div>

                                    <div className="p-6 sm:p-8 flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left z-10">
                                        <div className="relative shrink-0 group">
                                            <div className="absolute -inset-4 bg-primary/10 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="relative p-3 bg-white rounded-3xl border-4 border-zinc-50 shadow-xl overflow-hidden">
                                                <img 
                                                    src={preview.qrUrl} 
                                                    alt={`VietQR ${preview.supplier}`} 
                                                    className="w-48 h-48 sm:w-56 sm:h-56 object-contain mix-blend-multiply" 
                                                />
                                                <div className="absolute top-1 right-1 z-30 flex items-center gap-2">
                                                    <ShareQrButton 
                                                        url={preview.qrUrl} 
                                                        title={`Mã thanh toán ${preview.supplier}`} 
                                                        text={`Thanh toán cho ${preview.supplier}: ${preview.amount.toLocaleString('vi-VN')}đ. STK: ${selectedAccount.bankAccountNumber} (${bankShortName})`}
                                                        className="h-8 w-8 rounded-xl bg-primary shadow-lg shadow-primary/20 hover:bg-primary/90 text-primary-foreground border-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-grow flex flex-col h-full py-2 space-y-4 min-w-0 w-full">
                                            <div className="space-y-1">
                                                <h3 className="text-xl font-black text-primary uppercase tracking-tight">
                                                    {preview.supplier}
                                                </h3>
                                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                                                    <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 font-bold uppercase tracking-widest text-[10px] px-2 h-5">
                                                        {bankShortName}
                                                    </Badge>
                                                </div>
                                                {preview.accountOptions.length > 1 ? (
                                                    <div className="pt-2">
                                                        <Combobox
                                                            options={preview.accountOptions.map(account => ({ value: account.id, label: getAccountLabel(account) }))}
                                                            value={preview.selectedAccountId}
                                                            onChange={(value) => handleChangeQrAccount(preview.supplier, String(value || ''))}
                                                            placeholder="Chọn tài khoản nhận"
                                                            searchPlaceholder="Tìm tài khoản..."
                                                        />
                                                    </div>
                                                ) : null}
                                            </div>

                                            <div className="space-y-2 bg-muted/30 p-4 rounded-2xl border border-muted-foreground/5 shadow-inner">
                                                <div className="flex items-center justify-between gap-2 border-b border-dashed border-muted-foreground/10 pb-2">
                                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Số tài khoản</span>
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <span className="text-sm font-black text-primary font-mono tracking-tighter">{selectedAccount.bankAccountNumber}</span>
                                                        <button 
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(selectedAccount.bankAccountNumber);
                                                                toast.success('Đã sao chép STK');
                                                            }}
                                                            className="p-1.5 hover:bg-white rounded-lg transition-colors text-muted-foreground hover:text-primary active:scale-95"
                                                            title="Sao chép số tài khoản"
                                                        >
                                                            <Copy className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between gap-2 border-b border-dashed border-muted-foreground/10 py-2">
                                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Tên người nhận</span>
                                                    <span className="text-sm font-bold text-zinc-900 uppercase">{selectedAccount.accountName}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2 pt-2">
                                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Số tiền thanh toán</span>
                                                    <div className="flex items-center gap-1 font-black text-red-600">
                                                        <span className="text-lg tabular-nums">
                                                            {preview.amount.toLocaleString('vi-VN')}
                                                        </span>
                                                        <span className="text-xs">đ</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <p className="text-[10px] italic text-muted-foreground text-center md:text-left font-medium leading-relaxed bg-white/50 py-2 px-3 rounded-xl border border-dashed">
                                                Nội dung: <span className="font-bold uppercase text-zinc-800 tracking-tight">KATRINA COFFEE THANH TOAN</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )})}
                        </div>
                    </ScrollArea>
                </DialogBody>
                
                <DialogFooter className="border-t bg-white dark:bg-card px-8 py-6 h-auto">
                    <DialogCancel 
                        onClick={() => setIsQrPreviewOpen(false)} 
                        disabled={isProcessing}
                        className="rounded-2xl h-12 font-bold px-6"
                    >
                        Hủy bỏ
                    </DialogCancel>
                    <DialogAction 
                        onClick={handleConfirmTransferAndMarkPaid} 
                        disabled={isProcessing || transferQrPreviews.length === 0}
                        className="rounded-2xl h-12 font-black px-8 bg-primary hover:bg-primary/90 dark:bg-primary dark:hover:bg-primary/90 transition-all active:scale-95 shadow-xl shadow-zinc-200 dark:shadow-primary/20"
                    >
                        {isProcessing ? (
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        ) : (
                            <CheckCircle2 className="mr-2 h-5 w-5" />
                        )}
                        Tôi đã chuyển khoản xong
                    </DialogAction>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <SupplierManagementDialog
            isOpen={isSupplierManagementOpen}
            onClose={() => setIsSupplierManagementOpen(false)}
            suppliers={managedSuppliers}
            parentDialogTag="unpaid-slips-dialog"
        />
        </>
    );
}
