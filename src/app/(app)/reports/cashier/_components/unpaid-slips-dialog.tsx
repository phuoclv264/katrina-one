
'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { ExpenseSlip, InventoryItem, ExpenseItem } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, Check, Undo, History, X } from 'lucide-react';
import { toast } from '@/components/ui/pro-toast';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow, TableHeader, TableHead } from '@/components/ui/table';

type UnpaidSlipsDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  bankTransferSlips: ExpenseSlip[];
  onMarkAsPaid: (items: { slipId: string, supplier: string }[]) => Promise<void>;
  onUndoPayment: (slipId: string, supplier: string) => Promise<void>;
  inventoryList: InventoryItem[];
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

const getSlipContentName = (item: ExpenseItem): string => {
    if (item.itemId === 'other_cost') {
      if (item.name === 'Khác' && item.description) {
          return `${item.name} (${item.description})`;
      }
      return item.name;
  }
  return item.name;
}

export default function UnpaidSlipsDialog({ isOpen, onClose, bankTransferSlips, onMarkAsPaid, onUndoPayment, inventoryList }: UnpaidSlipsDialogProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedItems(new Set());
    }
  }, [isOpen]);
  
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
                if(!paidOthers.some(s => s.id === slip.id)) paidOthers.push(slip);
            } else {
                if(!unpaidOthers.some(s => s.id === slip.id)) unpaidOthers.push(slip);
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

    const sortedUnpaid = Object.keys(unpaidSupplierData).sort((a,b) => a.localeCompare(b, 'vi'));
    const sortedPaid = Object.keys(paidSupplierData).sort((a,b) => a.localeCompare(b, 'vi'));
    
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
        unpaidOtherCostSlips: unpaidOthers.sort((a,b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()),
        paidOtherCostSlips: paidOthers.sort((a,b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()),
        sortedUnpaidSuppliers: sortedUnpaid,
        sortedPaidSuppliers: sortedPaid,
    };
  }, [bankTransferSlips]);


  const getCompositeKey = (slipId: string, supplier: string) => `${slipId}__${supplier}`;

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

  const handleMarkAsPaid = async () => {
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 bg-white dark:bg-card rounded-xl shadow-lg">
        <DialogHeader className="p-4 sm:p-6 pb-0 sticky top-0 bg-muted/30 dark:bg-card/50 backdrop-blur-sm z-10 rounded-t-xl">
          <DialogTitle>Công nợ Chuyển khoản</DialogTitle>
          <DialogDescription>
            Quản lý các phiếu chi chuyển khoản chưa thanh toán và xem lại lịch sử đã thanh toán.
          </DialogDescription>
          <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogHeader>
        
        <div className="flex-grow flex flex-col overflow-hidden">
          <Tabs defaultValue="unpaid" className="w-full flex-grow flex flex-col overflow-hidden px-4 sm:px-6">
              <TabsList className="grid w-full grid-cols-2 bg-muted dark:bg-background rounded-lg border">
                  <TabsTrigger value="unpaid" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-green-900/50 dark:data-[state=active]:text-green-200">Chưa thanh toán</TabsTrigger>
                  <TabsTrigger value="history" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-blue-900/50 dark:data-[state=active]:text-blue-200">Lịch sử thanh toán</TabsTrigger>
              </TabsList>
              
              <TabsContent value="unpaid" className="flex-grow overflow-hidden pt-4">
                  {sortedUnpaidSuppliers.length === 0 && unpaidOtherCostSlips.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                          <div className="text-center">
                              <Check className="mx-auto h-12 w-12 text-green-500" />
                              <p className="mt-4 text-muted-foreground">Không có công nợ nào chưa thanh toán.</p>
                          </div>
                      </div>
                  ) : (
                    <ScrollArea className="h-full">
                      <Accordion type="multiple" defaultValue={[...sortedUnpaidSuppliers, 'other-costs']} className="space-y-4">
                      {sortedUnpaidSuppliers.map(supplier => {
                          const supplierData = unpaidGroupedBySupplier[supplier];
                          const slipCount = Object.keys(supplierData.slips).length;
                          const allSlipsForSupplier = Object.keys(supplierData.slips).map(slipId => getCompositeKey(slipId, supplier));
                          const areAllSelected = allSlipsForSupplier.every(key => selectedItems.has(key));
                          
                          return (
                          <AccordionItem value={supplier} key={supplier} className="border rounded-lg shadow-sm">
                              <AccordionTrigger className="p-4 text-lg font-semibold hover:no-underline">
                                <div className="flex items-center justify-between w-full pr-4">
                                  <span>{supplier}</span>
                                  <span className="text-red-600 font-bold">{supplierData.total.toLocaleString('vi-VN')}đ</span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="p-4 border-t space-y-3">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    id={`select-all-${supplier}`}
                                    checked={areAllSelected}
                                    onCheckedChange={(checked) => handleSelectAllForSupplier(supplier, !!checked)}
                                  />
                                  <label htmlFor={`select-all-${supplier}`} className="text-sm font-medium">Chọn tất cả ({slipCount} phiếu)</label>
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
                                          <Card key={key} className={cn("bg-muted/50 cursor-pointer hover:bg-muted", selectedItems.has(key) && "ring-2 ring-primary")} onClick={() => handleSelectSlip(key, !selectedItems.has(key))}>
                                              <CardContent className="p-4">
                                                  <div className="flex items-start justify-between mb-2">
                                                      <div className="flex items-center gap-3">
                                                        <Checkbox
                                                          checked={selectedItems.has(key)}
                                                          onCheckedChange={(checked) => {
                                                              const event = window.event as MouseEvent;
                                                              event?.stopPropagation();
                                                              handleSelectSlip(key, !!checked);
                                                          }}
                                                        />
                                                        <div>
                                                            <label htmlFor={key} className="font-semibold text-base cursor-pointer">
                                                              Phiếu chi ngày {format(parseISO(slipData.slipDate), 'dd/MM/yyyy')}
                                                            </label>
                                                            <p className="text-sm text-muted-foreground">Lập bởi: {slipData.slipCreatedBy}</p>
                                                        </div>
                                                      </div>
                                                      <p className="font-bold text-lg text-red-600">{slipData.slipTotal.toLocaleString('vi-VN')}đ</p>
                                                  </div>
                                                  <p className="text-xs text-muted-foreground pl-8">{itemsSummary}</p>
                                              </CardContent>
                                          </Card>
                                      );
                                  })}
                                </div>
                              </AccordionContent>
                          </AccordionItem>
                          );
                      })}
                      {unpaidOtherCostSlips.length > 0 && (
                          <AccordionItem value="other-costs" className="border rounded-lg shadow-sm">
                              <AccordionTrigger className="p-4 text-lg font-semibold hover:no-underline">
                                  Chi phí khác
                              </AccordionTrigger>
                              <AccordionContent className="p-4 border-t space-y-3">
                                  {unpaidOtherCostSlips.map(slip => {
                                      const key = getCompositeKey(slip.id, 'other_cost');
                                      return (
                                          <Card key={slip.id} className={cn("bg-muted/50 cursor-pointer hover:bg-muted", selectedItems.has(key) && "ring-2 ring-primary")} onClick={() => handleSelectSlip(key, !selectedItems.has(key))}>
                                              <CardContent className="p-4 flex items-center justify-between">
                                                  <div className="flex items-center gap-3">
                                                      <Checkbox
                                                          checked={selectedItems.has(key)}
                                                          onCheckedChange={(checked) => {
                                                              const event = window.event as MouseEvent;
                                                              event?.stopPropagation();
                                                              handleSelectSlip(key, !!checked);
                                                          }}
                                                      />
                                                      <div>
                                                          <p className="font-semibold">{getSlipContentName(slip.items[0])}</p>
                                                          <p className="text-sm text-muted-foreground">
                                                              Ngày {format(parseISO(slip.date), 'dd/MM/yyyy')} - Lập bởi {slip.createdBy.userName}
                                                          </p>
                                                      </div>
                                                  </div>
                                                  <p className="font-bold text-red-600">{slip.totalAmount.toLocaleString('vi-VN')}đ</p>
                                              </CardContent>
                                          </Card>
                                      )
                                  })}
                              </AccordionContent>
                          </AccordionItem>
                      )}
                      </Accordion>
                    </ScrollArea>
                  )}
              </TabsContent>
              <TabsContent value="history" className="flex-grow overflow-hidden pt-4">
                   {sortedPaidSuppliers.length === 0 && paidOtherCostSlips.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                          <div className="text-center">
                              <History className="mx-auto h-12 w-12 text-muted-foreground" />
                              <p className="mt-4 text-muted-foreground">Chưa có lịch sử thanh toán nào.</p>
                          </div>
                      </div>
                  ) : (
                    <ScrollArea className="h-full">
                      <Accordion type="multiple" defaultValue={[...sortedPaidSuppliers, 'other-costs-paid']} className="space-y-4">
                      {sortedPaidSuppliers.map(supplier => {
                          const supplierData = paidGroupedBySupplier[supplier];
                          return (
                              <AccordionItem value={supplier} key={`paid-${supplier}`} className="border rounded-lg shadow-sm">
                                  <AccordionTrigger className="p-4 text-lg font-semibold hover:no-underline">
                                      <div className="flex items-center justify-between w-full pr-4">
                                          <span>{supplier}</span>
                                          <span className="text-green-600 font-bold">{supplierData.total.toLocaleString('vi-VN')}đ</span>
                                      </div>
                                  </AccordionTrigger>
                                  <AccordionContent className="p-4 border-t space-y-3">
                                      {Object.entries(supplierData.slips).map(([slipId, slipData]) => (
                                          <Card key={`${slipId}-${supplier}`} className="bg-muted/50">
                                              <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                                  <div>
                                                      <p className="font-semibold text-base">Phiếu chi ngày {format(parseISO(slipData.slipDate), 'dd/MM/yyyy')}</p>
                                                      <p className="text-sm text-muted-foreground">
                                                          Lập bởi: {slipData.slipCreatedBy}
                                                      </p>
                                                  </div>
                                                  <div className="flex items-center gap-2 self-end sm:self-center">
                                                    <span className="text-green-600 font-medium text-lg">{slipData.slipTotal.toLocaleString('vi-VN')}đ</span>
                                                    <Button size="sm" variant="outline" onClick={() => handleUndoPayment(slipId, supplier)} disabled={isProcessing}>
                                                         {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <Undo className="mr-2 h-4 w-4"/>}
                                                        Hoàn tác
                                                    </Button>
                                                  </div>
                                              </CardContent>
                                          </Card>
                                      ))}
                                  </AccordionContent>
                              </AccordionItem>
                          );
                      })}
                       {paidOtherCostSlips.length > 0 && (
                          <AccordionItem value="other-costs-paid" className="border rounded-lg shadow-sm">
                              <AccordionTrigger className="p-4 text-lg font-semibold hover:no-underline">
                                  Chi phí khác đã thanh toán
                              </AccordionTrigger>
                              <AccordionContent className="p-4 border-t space-y-3">
                                   {paidOtherCostSlips.map(slip => (
                                      <Card key={slip.id} className="bg-muted/50">
                                          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                              <div>
                                                  <p className="font-semibold">{getSlipContentName(slip.items[0])}</p>
                                                  <p className="text-sm text-muted-foreground">
                                                      Ngày {format(parseISO(slip.date), 'dd/MM/yyyy')} - {slip.totalAmount.toLocaleString('vi-VN')}đ
                                                  </p>
                                              </div>
                                              <Button size="sm" variant="outline" onClick={() => handleUndoPayment(slip.id, 'other_cost')} disabled={isProcessing}>
                                                   {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <Undo className="mr-2 h-4 w-4"/>}
                                                  Hoàn tác
                                              </Button>
                                          </CardContent>
                                      </Card>
                                   ))}
                              </AccordionContent>
                          </AccordionItem>
                       )}
                      </Accordion>
                    </ScrollArea>
                  )}
              </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="p-4 sm:p-6 shrink-0 bg-white dark:bg-card border-t z-10 rounded-b-xl">
            <Button variant="outline" onClick={onClose} className="h-11 text-base w-full sm:w-auto">Đóng</Button>
            <Button onClick={handleMarkAsPaid} disabled={isProcessing || selectedItems.size === 0} className="h-11 text-base w-full sm:w-auto">
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4"/>}
                Đánh dấu đã TT ({totalSelectedAmount > 0 ? totalSelectedAmount.toLocaleString('vi-VN') + 'đ' : selectedItems.size})
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
