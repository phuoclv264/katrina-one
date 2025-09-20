'use client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { InventoryItem, PriceHistoryEntry, StockHistoryEntry } from '@/lib/types';
import { format, parseISO } from 'date-fns';

type ItemHistoryDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem;
};

const formatTimestamp = (timestamp: any) => {
  if (!timestamp) return 'N/A';
  if (typeof timestamp === 'string') {
    return format(parseISO(timestamp), 'dd/MM/yyyy HH:mm');
  }
  // Handle Firestore Timestamp object if needed
  if (timestamp.toDate) {
    return format(timestamp.toDate(), 'dd/MM/yyyy HH:mm');
  }
  return 'Invalid Date';
};

const getSourceLink = (entry: PriceHistoryEntry | StockHistoryEntry) => {
  // In a real app, you would have routes like /cashier/slips/{id}
  // For now, this is a placeholder.
  return `#`;
};

export default function ItemHistoryDialog({ isOpen, onClose, item }: ItemHistoryDialogProps) {
  if (!item) return null;

  const sortedPriceHistory = [...(item.priceHistory || [])].sort((a, b) => new Date(b.date as string).getTime() - new Date(a.date as string).getTime());
  const sortedStockHistory = [...(item.stockHistory || [])].sort((a, b) => new Date(b.date as string).getTime() - new Date(a.date as string).getTime());

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Lịch sử: {item.name}</DialogTitle>
          <DialogDescription>
            Theo dõi sự thay đổi về giá và số lượng tồn kho của mặt hàng này.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Tabs defaultValue="stock">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="stock">Lịch sử Tồn kho</TabsTrigger>
              <TabsTrigger value="price">Lịch sử Giá</TabsTrigger>
            </TabsList>
            
            <TabsContent value="stock" className="mt-4 max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Nguồn</TableHead>
                    <TableHead className="text-right">Thay đổi</TableHead>
                    <TableHead className="text-right">Tồn cuối</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedStockHistory.length > 0 ? sortedStockHistory.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell>{formatTimestamp(entry.date)}</TableCell>
                      <TableCell>
                        <a href={getSourceLink(entry)} className="underline hover:text-primary">
                          {entry.source === 'expense_slip' ? 'Phiếu chi' : 'Kiểm kê'}
                        </a>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${entry.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {entry.change > 0 ? `+${entry.change}` : entry.change} {item.unit}
                      </TableCell>
                      <TableCell className="text-right font-bold">{entry.newStock} {item.unit}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
                            Chưa có lịch sử tồn kho.
                        </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="price" className="mt-4 max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Nguồn</TableHead>
                    <TableHead className="text-right">Đơn giá mới</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                   {sortedPriceHistory.length > 0 ? sortedPriceHistory.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell>{formatTimestamp(entry.date)}</TableCell>
                      <TableCell>
                        <a href={getSourceLink(entry)} className="underline hover:text-primary">
                          Phiếu chi
                        </a>
                      </TableCell>
                      <TableCell className="text-right font-bold">{entry.price.toLocaleString('vi-VN')}đ</TableCell>
                    </TableRow>
                  )) : (
                     <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
                            Chưa có lịch sử giá.
                        </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
