
'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow, TableHeader, TableHead } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import type { ExpenseSlip, InventoryItem, ExpenseItem } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, Check, ExternalLink, Undo, History, AlertCircle } from 'lucide-react';
import { dataStore } from '@/lib/data-store';
import { toast } from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type UnpaidSlipsDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  bankTransferSlips: ExpenseSlip[];
  inventoryList: InventoryItem[];
};

type GroupedBySupplier = {
  [supplier: string]: {
    total: number;
    slips: {
      slipId: string;
      date: string;
      createdBy: string;
      items: {
        id: string; // ItemId
        name: string;
        quantity: number;
        unitPrice: number;
        unit: string;
      }[];
    }[];
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

export default function UnpaidSlipsDialog({ isOpen, onClose, bankTransferSlips, inventoryList }: UnpaidSlipsDialogProps) {
  const [selectedSlips, setSelectedSlips] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedSlips(new Set());
    }
  }, [isOpen]);
  
  const { unpaidGroupedBySupplier, paidGroupedBySupplier, unpaidOtherCostSlips, paidOtherCostSlips } = useMemo(() => {
    const unpaidSupplierData: GroupedBySupplier = {};
    const paidSupplierData: GroupedBySupplier = {};
    const unpaidOthers: ExpenseSlip[] = [];
    const paidOthers: ExpenseSlip[] = [];

    const itemMap = new Map(inventoryList.map(item => [item.id, item]));

    bankTransferSlips.forEach(slip => {
      const isPaid = slip.paymentStatus === 'paid';
      
      if (slip.expenseType === 'other_cost') {
        if (isPaid) {
          paidOthers.push(slip);
        } else {
          unpaidOthers.push(slip);
        }
        return;
      }

      const slipItemsBySupplier: { [supplier: string]: typeof slip.items } = {};

      slip.items.forEach(item => {
        const supplier = itemMap.get(item.itemId)?.supplier || 'Không rõ';
        if (!slipItemsBySupplier[supplier]) {
          slipItemsBySupplier[supplier] = [];
        }
        slipItemsBySupplier[supplier].push(item);
      });

      for (const supplier in slipItemsBySupplier) {
        const targetSupplierData = isPaid ? paidSupplierData : unpaidSupplierData;
        if (!targetSupplierData[supplier]) {
          targetSupplierData[supplier] = { total: 0, slips: [] };
        }
        
        const itemsForThisSupplier = slipItemsBySupplier[supplier];
        const supplierTotalForThisSlip = itemsForThisSupplier.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
        
        targetSupplierData[supplier].total += supplierTotalForThisSlip;

        let slipEntry = targetSupplierData[supplier].slips.find(s => s.slipId === slip.id);
        if (!slipEntry) {
            slipEntry = {
                slipId: slip.id,
                date: slip.date,
                createdBy: slip.createdBy.userName,
                items: []
            };
            targetSupplierData[supplier].slips.push(slipEntry);
        }

        slipEntry.items.push(...itemsForThisSupplier.map(item => ({
            id: item.itemId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unit: item.unit,
        })));
      }
    });

    return { 
        unpaidGroupedBySupplier: unpaidSupplierData, 
        paidGroupedBySupplier: paidSupplierData,
        unpaidOtherCostSlips: unpaidOthers.sort((a,b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()),
        paidOtherCostSlips: paidOthers.sort((a,b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())
    };
  }, [bankTransferSlips, inventoryList]);

  const sortedUnpaidSuppliers = useMemo(() => Object.keys(unpaidGroupedBySupplier).sort(), [unpaidGroupedBySupplier]);
  const sortedPaidSuppliers = useMemo(() => Object.keys(paidGroupedBySupplier).sort(), [paidGroupedBySupplier]);


  const handleSelectAllForSupplier = (supplier: string, isChecked: boolean) => {
    const slipIdsForSupplier = unpaidGroupedBySupplier[supplier].slips.map(s => s.slipId);
    setSelectedSlips(prev => {
      const newSet = new Set(prev);
      if (isChecked) {
        slipIdsForSupplier.forEach(id => newSet.add(id));
      } else {
        slipIdsForSupplier.forEach(id => newSet.delete(id));
      }
      return newSet;
    });
  };

  const handleSelectSlip = (slipId: string, isChecked: boolean) => {
    setSelectedSlips(prev => {
      const newSet = new Set(prev);
      if (isChecked) {
        newSet.add(slipId);
      } else {
        newSet.delete(slipId);
      }
      return newSet;
    });
  };

  const handleMarkAsPaid = async () => {
    if (selectedSlips.size === 0) return;
    setIsProcessing(true);
    try {
      await dataStore.updateMultipleSlipsStatus(Array.from(selectedSlips), 'paid');
      toast.success(`Đã đánh dấu ${selectedSlips.size} phiếu chi là đã thanh toán.`);
      setSelectedSlips(new Set()); // Clear selection after successful operation
    } catch (error) {
      console.error("Failed to mark slips as paid:", error);
      toast.error('Lỗi: Không thể cập nhật trạng thái phiếu chi.');
    } finally {
      setIsProcessing(false);
    }
  };
  
   const handleUndoPayment = async (slipId: string) => {
    setIsProcessing(true);
    try {
        await dataStore.undoExpenseSlipPayment(slipId);
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
        </DialogHeader>
        
        <div className="flex-grow flex flex-col overflow-hidden">
          <Tabs defaultValue="unpaid" className="w-full flex-grow flex flex-col overflow-hidden px-4 sm:px-6">
              <TabsList className="grid w-full grid-cols-2 bg-muted dark:bg-background rounded-lg border">
                  <TabsTrigger value="unpaid" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-green-900/50 dark:data-[state=active]:text-green-200">Chưa thanh toán</TabsTrigger>
                  <TabsTrigger value="history" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-green-900/50 dark:data-[state=active]:text-green-200">Lịch sử thanh toán</TabsTrigger>
              </TabsList>
              
              <TabsContent value="unpaid" className="flex-grow overflow-y-auto -mx-4 px-4 pt-4">
                  {sortedUnpaidSuppliers.length === 0 && unpaidOtherCostSlips.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                          <div className="text-center">
                              <Check className="mx-auto h-12 w-12 text-green-500" />
                              <p className="mt-4 text-muted-foreground">Không có công nợ nào chưa thanh toán.</p>
                          </div>
                      </div>
                  ) : (
                      <Accordion type="multiple" defaultValue={[...sortedUnpaidSuppliers, 'other-costs']} className="space-y-4">
                      {sortedUnpaidSuppliers.map(supplier => {
                          const supplierData = unpaidGroupedBySupplier[supplier];
                          const isAllSelected = supplierData.slips.every(s => selectedSlips.has(s.slipId));
                          
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
                                  checked={isAllSelected}
                                  onCheckedChange={(checked) => handleSelectAllForSupplier(supplier, !!checked)}
                                  />
                                  <label htmlFor={`select-all-${supplier}`}>Chọn tất cả ({supplierData.slips.length} phiếu)</label>
                              </div>
                              <div className="space-y-3">
                                  {supplierData.slips.map(({ slipId, date, createdBy, items }) => (
                                  <Card key={slipId} className="bg-muted/50 cursor-pointer hover:bg-muted" onClick={() => handleSelectSlip(slipId, !selectedSlips.has(slipId))}>
                                      <CardContent className="p-4">
                                      <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center gap-3">
                                          <Checkbox
                                              id={slipId}
                                              checked={selectedSlips.has(slipId)}
                                              onCheckedChange={(checked) => {
                                                  const event = window.event as MouseEvent;
                                                  event?.stopPropagation();
                                                  handleSelectSlip(slipId, !!checked);
                                              }}
                                          />
                                          <label htmlFor={slipId} className="font-semibold text-sm cursor-pointer">
                                              Phiếu chi ngày {format(parseISO(date), 'dd/MM/yyyy')}
                                          </label>
                                          </div>
                                          <div className="text-sm text-muted-foreground">
                                          Lập bởi: {createdBy}
                                          </div>
                                      </div>
                                      <Table>
                                          <TableHeader>
                                          <TableRow><TableHead>Mặt hàng</TableHead><TableHead className="text-right">Thành tiền</TableHead></TableRow>
                                          </TableHeader>
                                          <TableBody>
                                          {items.map(item => (
                                              <TableRow key={item.id}>
                                              <TableCell>{item.name}</TableCell>
                                              <TableCell className="text-right font-medium text-red-600">{(item.quantity * item.unitPrice).toLocaleString('vi-VN')}đ</TableCell>
                                              </TableRow>
                                          ))}
                                          </TableBody>
                                      </Table>
                                      </CardContent>
                                  </Card>
                                  ))}
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
                                  {unpaidOtherCostSlips.map(slip => (
                                      <Card key={slip.id} className="bg-muted/50 cursor-pointer hover:bg-muted" onClick={() => handleSelectSlip(slip.id, !selectedSlips.has(slip.id))}>
                                          <CardContent className="p-4 flex items-center justify-between">
                                              <div className="flex items-center gap-3">
                                                  <Checkbox
                                                      id={slip.id}
                                                      checked={selectedSlips.has(slip.id)}
                                                      onCheckedChange={(checked) => {
                                                          const event = window.event as MouseEvent;
                                                          event?.stopPropagation();
                                                          handleSelectSlip(slip.id, !!checked);
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
                                  ))}
                              </AccordionContent>
                          </AccordionItem>
                      )}
                      </Accordion>
                  )}
              </TabsContent>
              <TabsContent value="history" className="flex-grow overflow-y-auto -mx-4 px-4 pt-4">
                   {sortedPaidSuppliers.length === 0 && paidOtherCostSlips.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                          <div className="text-center">
                              <History className="mx-auto h-12 w-12 text-muted-foreground" />
                              <p className="mt-4 text-muted-foreground">Chưa có lịch sử thanh toán nào trong tháng.</p>
                          </div>
                      </div>
                  ) : (
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
                                      {supplierData.slips.map(({ slipId, date, createdBy, items }) => (
                                          <Card key={slipId} className="bg-muted/50">
                                              <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                                  <div>
                                                      <p className="font-semibold text-sm">Phiếu chi ngày {format(parseISO(date), 'dd/MM/yyyy')}</p>
                                                      <p className="text-xs text-muted-foreground">Lập bởi: {createdBy}</p>
                                                  </div>
                                                  <Button size="sm" variant="outline" onClick={() => handleUndoPayment(slipId)} disabled={isProcessing}>
                                                       {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <Undo className="mr-2 h-4 w-4"/>}
                                                      Hoàn tác
                                                  </Button>
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
                                              <Button size="sm" variant="outline" onClick={() => handleUndoPayment(slip.id)} disabled={isProcessing}>
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
                  )}
              </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="p-4 sm:p-6 shrink-0 bg-white dark:bg-card border-t z-10 rounded-b-xl">
            <Button variant="outline" onClick={onClose} className="h-11 text-base w-full sm:w-auto">Đóng</Button>
            <Button onClick={handleMarkAsPaid} disabled={isProcessing || selectedSlips.size === 0} className="h-11 text-base w-full sm:w-auto">
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4"/>}
                Đánh dấu đã thanh toán ({selectedSlips.size})
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
