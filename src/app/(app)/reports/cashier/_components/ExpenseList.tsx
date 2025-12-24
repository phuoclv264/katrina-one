'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Loader2, Wallet, LandPlot, Edit2 } from 'lucide-react';
import type { ExpenseSlip, ExpenseItem, InventoryItem } from '@/lib/types';
import { format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

type ExpenseListProps = {
    expenses: ExpenseSlip[];
    onEdit: (slip: ExpenseSlip) => void;
    onDelete: (id: string) => void;
    processingItemId: string | null;
    inventoryList: InventoryItem[];
    itemRefs: React.MutableRefObject<Map<string, HTMLDivElement | null>>;
};

const ExpenseList = React.memo(({ expenses, onEdit, onDelete, processingItemId, inventoryList, itemRefs }: ExpenseListProps) => {
  const isMobile = useIsMobile();

  const getSlipContentName = (item: ExpenseItem): string => {
    if (item.itemId === 'other_cost') {
      if (item.name === 'Khác' && item.description) {
          return item.description;
      }
      return item.name;
    }
    const inventoryItem = inventoryList.find(i => i.id === item.itemId);
    return inventoryItem?.shortName || item.name;
  }

  if (expenses.length === 0) return <p className="text-sm text-center text-muted-foreground py-2">Không có phiếu chi nào.</p>;

  return (
    isMobile ? (
        <div className="space-y-3">
            {expenses.map(slip => {
                const isProcessing = processingItemId === slip.id;
                const actualAmount = slip.paymentMethod === 'cash' ? slip.actualPaidAmount ?? slip.totalAmount : slip.totalAmount;
                const highlightKey = `expense-${slip.id}`;
                return (
                    <Card 
                        key={slip.id} 
                        ref={el => {
                            if (el) itemRefs.current.set(highlightKey, el);
                            else itemRefs.current.delete(highlightKey);
                        }}
                        className="bg-background relative shadow-none border-slate-200 dark:border-slate-800"
                    >
                        <CardContent className="p-2.5">
                            <div className="flex justify-between items-start gap-2">
                                <div className="space-y-1 min-w-0 flex-1">
                                    <div className="font-semibold text-sm flex items-center gap-1.5 flex-wrap">
                                      <p className="truncate">{getSlipContentName(slip.items[0])}{slip.items.length > 1 && ` +${slip.items.length - 1}`}</p>
                                       {slip.isAiGenerated && <Badge className="bg-blue-100 text-blue-800 text-[10px] h-4 px-1">AI</Badge>}
                                       {slip.lastModifiedBy && <Badge variant="outline" className="text-[10px] h-4 px-1">Sửa</Badge>}
                                       {slip.associatedHandoverReportId && <Badge variant="outline" className="text-[10px] h-4 px-1">Auto</Badge>}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                        <span className="font-medium">{slip.createdBy.userName}</span>
                                        <span>•</span>
                                        <span>{slip.lastModified ? format(new Date(slip.lastModified as string), 'HH:mm') : format(new Date(slip.createdAt as string), 'HH:mm')}</span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="font-bold text-base text-red-600">-{actualAmount.toLocaleString('vi-VN')}đ</p>
                                    <div className="flex items-center justify-end gap-1 text-[10px] mt-0.5 text-muted-foreground">
                                        {slip.paymentMethod === 'cash' ? <Wallet className="h-3 w-3"/> : <LandPlot className="h-3 w-3"/>}
                                        <span>{slip.paymentMethod === 'cash' ? 'Tiền mặt' : 'CK'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-1 mt-2 pt-2 border-t border-slate-100 dark:border-slate-900">
                                <Button variant="ghost" size="sm" onClick={() => onEdit(slip)} disabled={isProcessing} className="h-7 text-[10px] px-2"><Edit className="mr-1.5 h-3 w-3" />Chi tiết</Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive h-7 text-[10px] px-2" disabled={isProcessing}><Trash2 className="mr-1.5 h-3 w-3" />Xóa</Button></AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader><AlertDialogTitle>Xác nhận xóa?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription></AlertDialogHeader>
                                      <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(slip.id)}>Xóa</AlertDialogAction></AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </CardContent>
                         {isProcessing && (<div className="absolute inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center rounded-lg"><Loader2 className="h-6 w-6 animate-spin text-destructive"/><span className="ml-2 text-sm font-medium text-destructive">Đang xóa...</span></div>)}
                    </Card>
                )
            })}
        </div>
   ) : (
     <div className="border rounded-lg overflow-hidden">
       <Table>
           <TableHeader className="bg-muted/50">
               <TableRow>
                   <TableHead className="text-xs uppercase">Nội dung</TableHead>
                   <TableHead className="text-xs uppercase">Thời gian</TableHead>
                   <TableHead className="text-right text-xs uppercase">Tổng tiền / Thực trả</TableHead>
                   <TableHead className="text-xs uppercase">Hình thức</TableHead>
                   <TableHead className="text-xs uppercase">Người tạo</TableHead>
                   <TableHead className="text-right text-xs uppercase">Hành động</TableHead>
               </TableRow>
           </TableHeader>
           <TableBody>
               {expenses.map(slip => {
                  const isProcessing = processingItemId === slip.id;
                  const highlightKey = `expense-${slip.id}`;
                  return (
                   <TableRow 
                        key={slip.id} 
                        ref={el => {
                            // We need to get the underlying DOM element from the TableRow component
                            if (el) itemRefs.current.set(highlightKey, el);
                            else itemRefs.current.delete(highlightKey);
                        }}
                        className="relative"
                    >
                       <TableCell className="font-medium">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span>{getSlipContentName(slip.items[0])}{slip.items.length > 1 && ` và ${slip.items.length - 1} mục khác`}</span>
                                {slip.isAiGenerated && <Badge className="bg-blue-100 text-blue-800">AI</Badge>}
                                {slip.lastModifiedBy && <Badge variant="outline" className="text-xs">Đã sửa</Badge>}
                                {slip.associatedHandoverReportId && <Badge variant="outline" className="font-normal">Tự động</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground font-normal">{slip.notes || 'Không có ghi chú'}</p>
                       </TableCell>
                       <TableCell className="text-sm text-muted-foreground">
                         {slip.lastModifiedBy && slip.lastModified ? (
                            <div className="flex items-center gap-1">
                                <Edit2 className="h-3 w-3 text-yellow-500" />
                                {format(new Date(slip.lastModified as string), 'HH:mm')}
                            </div>
                         ) : (
                            format(new Date(slip.createdAt as string), 'HH:mm')
                         )}
                        </TableCell>
                       <TableCell className="text-right font-bold text-lg text-red-600">
                            <div className='flex flex-col items-end'>
                                <span>{slip.totalAmount.toLocaleString('vi-VN')}đ</span>
                                {(slip.paymentMethod === 'cash' && typeof slip.actualPaidAmount === 'number' && slip.actualPaidAmount !== slip.totalAmount) && (
                                     <span className='text-xs font-normal text-red-600'>(Thực trả: {(slip.actualPaidAmount).toLocaleString('vi-VN')}đ)</span>
                                )}
                            </div>
                       </TableCell>
                       <TableCell>
                         <Badge variant={slip.paymentMethod === 'cash' ? 'secondary' : 'outline'}>
                            {slip.paymentMethod === 'cash' ? <Wallet className="mr-1 h-3 w-3"/> : <LandPlot className="mr-1 h-3 w-3"/>}
                            {slip.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                        </Badge>
                       </TableCell>
                       <TableCell>{slip.createdBy.userName}</TableCell>
                       <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => onEdit(slip)} disabled={isProcessing}><Edit className="h-4 w-4" /></Button>
                          <AlertDialog>
                              <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive" disabled={isProcessing}><Trash2 className="h-4 w-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>Xác nhận xóa phiếu chi?</AlertDialogTitle><AlertDialogDescription>Hành động này sẽ xóa vĩnh viễn phiếu chi và không thể hoàn tác.</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(slip.id)}>Xóa</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                          </AlertDialog>
                       </TableCell>
                        {isProcessing && (<td colSpan={6} className="absolute inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center rounded-lg"><Loader2 className="h-6 w-6 animate-spin text-destructive"/><span className="ml-2 text-sm font-medium text-destructive">Đang xóa...</span></td>)}
                   </TableRow>
                  )
               })}
           </TableBody>
       </Table>
     </div>
   )
  );
});
ExpenseList.displayName = 'ExpenseList';

export default ExpenseList;
