

'use client';

import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, ListChecks, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

type ComparisonResult = {
  field: string;
  label: string;
  appValue: number;
  receiptValue: number;
  isMatch: boolean;
}[];

type HandoverComparisonDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comparisonResult: ComparisonResult | null;
  onNavigateToExpenses: () => void;
  onNavigateToRevenue: () => void;
  onConfirm: () => void;
};

export default function HandoverComparisonDialog({
  open,
  onOpenChange,
  comparisonResult,
  onNavigateToExpenses,
  onNavigateToRevenue,
  onConfirm,
}: HandoverComparisonDialogProps) {
  const hasMismatch = comparisonResult && comparisonResult.some(item => !item.isMatch);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
            className="max-w-md md:max-w-4xl h-full md:h-auto md:max-h-[90vh] flex flex-col p-0 rounded-lg"
            onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className={cn(
            "p-4 md:p-6 flex flex-row items-center gap-4 space-y-0 shrink-0 rounded-t-lg",
             hasMismatch ? "bg-red-50 dark:bg-destructive/20 text-red-700" : "bg-green-50 dark:bg-green-500/10 text-green-600"
          )}>
            {hasMismatch ? <AlertCircle className="h-8 w-8 shrink-0"/> : <CheckCircle className="h-8 w-8 shrink-0"/>}
            <div className="flex-1">
                <DialogTitle className="text-xl md:text-2xl font-bold">
                {hasMismatch ? 'Phát hiện sai lệch dữ liệu' : 'Đối chiếu thành công'}
                </DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex-grow overflow-y-auto bg-white dark:bg-card">
              <div className="p-4 md:p-6 space-y-6">
                {hasMismatch && comparisonResult ? (
                  <div className="space-y-4">
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Dữ liệu không khớp</AlertTitle>
                      <AlertDescription>
                        Điều này có thể do AI đọc sai, hoặc do các báo cáo thu/chi trong ngày chưa được nhập đúng đắn.
                      </AlertDescription>
                    </Alert>
                    
                    {/* Mobile View */}
                    <div className="md:hidden space-y-3">
                        {comparisonResult.map(item => (
                            <Card key={item.field} className={cn("rounded-xl shadow-sm", !item.isMatch && "border-destructive border-2")}>
                                <CardHeader className="p-3 pb-2 flex-row justify-between items-center">
                                    <CardTitle className="text-base">{item.label}</CardTitle>
                                    {!item.isMatch && <Badge variant="destructive">Sai lệch</Badge>}
                                </CardHeader>
                                <CardContent className="p-3 pt-0 space-y-1 text-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Trên ứng dụng:</span>
                                        <span className="font-mono font-semibold text-base">{item.appValue.toLocaleString('vi-VN')}đ</span>
                                    </div>
                                    <div className={cn("flex justify-between items-center", !item.isMatch && "font-bold text-red-700")}>
                                        <span className={cn(!item.isMatch && "text-red-700/80")}>Trên phiếu:</span>
                                        <span className="font-mono text-base">{item.receiptValue.toLocaleString('vi-VN')}đ</span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Desktop View */}
                    <div className="hidden md:block">
                        <ScrollArea className="max-h-[300px] w-full rounded-lg border shadow-sm">
                            <Table>
                                <TableHeader className="sticky top-0 bg-white dark:bg-card z-10">
                                    <TableRow>
                                        <TableHead className="font-bold px-4 py-2">Hạng mục</TableHead>
                                        <TableHead className="text-right font-bold px-4 py-2">Trên ứng dụng</TableHead>
                                        <TableHead className="text-right font-bold px-4 py-2">Trên phiếu</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                {comparisonResult.map(item => (
                                    <TableRow key={item.field}>
                                        <TableCell className="font-semibold px-4 py-2">{item.label}</TableCell>
                                        <TableCell className="text-right font-mono text-base px-4 py-2">{item.appValue.toLocaleString('vi-VN')}đ</TableCell>
                                        <TableCell className={cn("text-right font-mono text-base px-4 py-2", !item.isMatch && "font-bold text-red-700 bg-red-100 dark:bg-red-900/50")}>
                                            {item.receiptValue.toLocaleString('vi-VN')}đ
                                        </TableCell>
                                    </TableRow>
                                ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                  </div>
                ) : (
                  <p>Dữ liệu khớp.</p>
                )}
              </div>
          </div>

          <DialogFooter className="p-4 md:p-6 border-t shrink-0 bg-white dark:bg-card rounded-b-lg">
             {hasMismatch ? (
                <div className="w-full flex flex-col md:flex-row md:justify-between gap-3">
                    <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto order-2 md:order-1">
                        <Button variant="secondary" onClick={onNavigateToExpenses} className="w-full h-11 md:h-10 text-base md:text-sm whitespace-normal">
                            <ListChecks className="mr-2 h-4 w-4" /> Kiểm tra lại thu/chi
                        </Button>
                        <Button variant="secondary" onClick={onNavigateToRevenue} className="w-full h-11 md:h-10 text-base md:text-sm whitespace-normal">
                            <FileText className="mr-2 h-4 w-4" /> Kiểm tra doanh thu
                        </Button>
                    </div>
                     <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full md:w-auto h-11 md:h-10 text-base md:text-sm order-1 md:order-2">Hủy</Button>
                </div>
             ) : (
                <div className="w-full flex justify-end gap-3">
                    <Button onClick={onConfirm} className="h-11 md:h-10 text-base md:text-sm">Xác nhận & Hoàn tất</Button>
                </div>
             )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
