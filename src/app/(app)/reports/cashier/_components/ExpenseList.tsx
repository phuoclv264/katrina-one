
'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Loader2, Wallet, LandPlot, Edit2 } from 'lucide-react';
import type { ExpenseSlip, ExpenseItem } from '@/lib/types';
import { format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const getSlipContentName = (item: ExpenseItem): string => {
    if (item.itemId === 'other_cost') {
      if (item.name === 'Khác' && item.description) {
          return item.description;
      }
      return item.name;
    }
    return item.name;
}

const ExpenseList = React.memo(({ expenses, onEdit, onDelete, processingItemId }: { expenses: ExpenseSlip[], onEdit: (slip: ExpenseSlip) => void, onDelete: (id: string) => void, processingItemId: string | null }) => {
  const isMobile = useIsMobile();
  if (expenses.length === 0) return <p className="text-sm text-center text-muted-foreground py-2">Không có phiếu chi nào.</p>;

  return (
    isMobile ? (
        <div className="space-y-3">
            {expenses.map(slip => {
                const isProcessing = processingItemId === slip.id;
                const actualAmount = slip.paymentMethod === 'cash' ? slip.actualPaidAmount ?? slip.totalAmount : slip.totalAmount;
                return (
                    <Card key={slip.id} className="bg-background relative">
                        <CardContent className="p-3">
                            <div className="flex justify-between items-start mb-2">
                                <div className="space-y-1 pr-2">
                                    <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                                      <p>{getSlipContentName(slip.items[0])}{slip.items.length > 1 && ` và ${slip.items.length - 1} mục khác`}</p>
                                       {slip.isAiGenerated && <Badge className="bg-blue-100 text-blue-800">AI</Badge>}
                                       {slip.lastModifiedBy && <Badge variant="outline">Đã sửa</Badge>}
                                       {slip.associatedHandoverReportId && <Badge variant="outline">Tự động</Badge>}
                                    </div>
                                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <span>{slip.createdBy.userName}</span>
                                        <span>•</span>
                                        <span>{slip.lastModified ? format(new Date(slip.lastModified as string), 'HH:mm') : format(new Date(slip.createdAt as string), 'HH:mm')}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-base text-red-600">-{actualAmount.toLocaleString('vi-VN')}đ</p>
                                    <div className="flex items-center justify-end gap-2 text-sm mt-1">
                                        {slip.paymentMethod === 'cash' ? <Wallet className="h-4 w-4"/> : <LandPlot className="h-4 w-4"/>}
                                        <span>{slip.paymentMethod === 'cash' ? 'Tiền mặt' : 'CK'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-2 border-t pt-2">
                                <Button variant="ghost" size="sm" onClick={() => onEdit(slip)} disabled={isProcessing}><Edit className="mr-2 h-4 w-4" />Chi tiết</Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive" disabled={isProcessing}><Trash2 className="mr-2 h-4 w-4" />Xóa</Button></AlertDialogTrigger>
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
                  return (
                   <TableRow key={slip.id} className="relative">
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
                        {isProcessing && (<td className="absolute inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center rounded-lg"><Loader2 className="h-6 w-6 animate-spin text-destructive"/><span className="ml-2 text-sm font-medium text-destructive">Đang xóa...</span></td>)}
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
