'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
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
import type { ExpenseSlip, InventoryItem } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, Check, ExternalLink } from 'lucide-react';
import { dataStore } from '@/lib/data-store';
import { toast } from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';

type UnpaidSlipsDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  unpaidSlips: ExpenseSlip[];
  inventoryList: InventoryItem[];
};

type GroupedBySupplier = {
  [supplier: string]: {
    total: number;
    slips: {
      slip: ExpenseSlip;
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

export default function UnpaidSlipsDialog({ isOpen, onClose, unpaidSlips, inventoryList }: UnpaidSlipsDialogProps) {
  const [selectedSlips, setSelectedSlips] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedSlips(new Set());
    }
  }, [isOpen]);

  const groupedData = useMemo(() => {
    const data: GroupedBySupplier = {};
    const itemMap = new Map(inventoryList.map(item => [item.id, item]));

    unpaidSlips.forEach(slip => {
      const slipItemsBySupplier: { [supplier: string]: typeof slip.items } = {};

      slip.items.forEach(item => {
        const supplier = itemMap.get(item.itemId)?.supplier || 'Không rõ';
        if (!slipItemsBySupplier[supplier]) {
          slipItemsBySupplier[supplier] = [];
        }
        slipItemsBySupplier[supplier].push(item);
      });

      for (const supplier in slipItemsBySupplier) {
        if (!data[supplier]) {
          data[supplier] = { total: 0, slips: [] };
        }
        
        const itemsForThisSupplier = slipItemsBySupplier[supplier];
        const supplierTotalForThisSlip = itemsForThisSupplier.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
        data[supplier].total += supplierTotalForThisSlip;

        data[supplier].slips.push({
          slip: slip,
          items: itemsForThisSupplier.map(item => ({
            id: item.itemId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unit: item.unit,
          })),
        });
      }
    });
    return data;
  }, [unpaidSlips, inventoryList]);

  const sortedSuppliers = useMemo(() => Object.keys(groupedData).sort(), [groupedData]);

  const handleSelectAllForSupplier = (supplier: string, isChecked: boolean) => {
    const slipIdsForSupplier = groupedData[supplier].slips.map(s => s.slip.id);
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
      onClose();
    } catch (error) {
      console.error("Failed to mark slips as paid:", error);
      toast.error('Lỗi: Không thể cập nhật trạng thái phiếu chi.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Phiếu chi chuyển khoản chưa thanh toán</DialogTitle>
          <DialogDescription>
            Đây là danh sách các phiếu chi cần thanh toán cho nhà cung cấp. Chọn và đánh dấu đã thanh toán.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] -mx-6 px-6">
          {sortedSuppliers.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Không có công nợ nào.</p>
          ) : (
            <Accordion type="multiple" defaultValue={sortedSuppliers} className="space-y-4 py-2">
              {sortedSuppliers.map(supplier => {
                const supplierData = groupedData[supplier];
                const isAllSelected = supplierData.slips.every(s => selectedSlips.has(s.slip.id));
                const isSomeSelected = supplierData.slips.some(s => selectedSlips.has(s.slip.id));

                return (
                  <AccordionItem value={supplier} key={supplier} className="border rounded-lg">
                    <AccordionTrigger className="p-4 text-lg font-semibold hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <span>{supplier}</span>
                        <span className="text-red-600 font-bold">{supplierData.total.toLocaleString('vi-VN')}đ</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 border-t">
                      <div className="flex items-center gap-2 mb-4">
                        <Checkbox
                          id={`select-all-${supplier}`}
                          checked={isAllSelected}
                          onCheckedChange={(checked) => handleSelectAllForSupplier(supplier, !!checked)}
                        />
                        <label htmlFor={`select-all-${supplier}`}>Chọn tất cả cho {supplier}</label>
                      </div>
                      <div className="space-y-3">
                        {supplierData.slips.map(({ slip, items }) => (
                          <Card key={slip.id} className="bg-muted/50">
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    id={slip.id}
                                    checked={selectedSlips.has(slip.id)}
                                    onCheckedChange={(checked) => handleSelectSlip(slip.id, !!checked)}
                                  />
                                  <label htmlFor={slip.id} className="font-semibold text-sm">
                                    Phiếu chi ngày {format(parseISO(slip.date), 'dd/MM/yyyy')}
                                  </label>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Lập bởi: {slip.createdBy.userName}
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
                                      <TableCell className="text-right font-medium">{(item.quantity * item.unitPrice).toLocaleString('vi-VN')}đ</TableCell>
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
            </Accordion>
          )}
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Đóng</Button>
          <Button onClick={handleMarkAsPaid} disabled={isProcessing || selectedSlips.size === 0}>
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4"/>}
            Đánh dấu đã thanh toán ({selectedSlips.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
