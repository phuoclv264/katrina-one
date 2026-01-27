

'use client';

import { useMemo } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter,
  DialogBody,
  DialogAction,
  DialogCancel
} from '@/components/ui/dialog';
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
  parentDialogTag: string;
};

export default function HandoverComparisonDialog({
  open,
  onOpenChange,
  comparisonResult,
  onNavigateToExpenses,
  onNavigateToRevenue,
  onConfirm,
  parentDialogTag,
}: HandoverComparisonDialogProps) {
  const hasMismatch = comparisonResult && comparisonResult.some(item => !item.isMatch);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dialogTag="handover-comparison-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-2xl">
        <DialogHeader 
          variant={hasMismatch ? "destructive" : "success"} 
          iconkey={hasMismatch ? "alert" : "check"}
        >
          <DialogTitle>
            {hasMismatch ? 'Phát hiện sai lệch dữ liệu' : 'Đối chiếu thành công'}
          </DialogTitle>
          <DialogDescription className={hasMismatch ? "text-red-900/60" : "text-emerald-900/60"}>
            {hasMismatch 
              ? "Vui lòng kiểm tra lại các hạng mục bên dưới để đảm bảo tính chính xác." 
              : "Tất cả số liệu trên ứng dụng và thực tế đều khớp nhau."}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="bg-zinc-50/50 p-0">
          <div className="p-4 md:p-6 space-y-6">
            {hasMismatch && comparisonResult ? (
              <div className="space-y-6">
                <Alert className="bg-red-50/50 border-red-100 text-red-900 rounded-2xl p-4">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <AlertTitle className="font-bold mb-1">Dữ liệu không khớp</AlertTitle>
                  <AlertDescription className="text-red-700/80 text-xs leading-relaxed">
                    Điều này có thể do AI nhận diện sai, hoặc do các báo cáo thu/chi trong ca chưa được nhập đủ. 
                    Vui lòng đối soát kỹ trước khi xác nhận.
                  </AlertDescription>
                </Alert>

                {/* Mobile View */}
                <div className="md:hidden space-y-3">
                  {comparisonResult.map(item => (
                    <Card key={item.field} className={cn(
                      "rounded-2xl border-none shadow-sm ring-1 overflow-hidden transition-all",
                      !item.isMatch ? "ring-red-200 bg-red-50/20" : "ring-zinc-200 bg-white"
                    )}>
                      <CardHeader className="p-4 pb-2 flex-row justify-between items-center bg-zinc-50/50">
                        <CardTitle className="text-xs font-black uppercase tracking-wider text-zinc-500">{item.label}</CardTitle>
                        {!item.isMatch && (
                          <Badge className="bg-red-500 text-white border-none text-[9px] font-black uppercase tracking-widest px-2 py-0.5">
                            Sai lệch
                          </Badge>
                        )}
                      </CardHeader>
                      <CardContent className="p-4 pt-3 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">Ứng dụng</span>
                          <span className="font-black text-zinc-900">{item.appValue.toLocaleString('vi-VN')}đ</span>
                        </div>
                        <div className="h-px bg-zinc-100" />
                        <div className={cn("flex justify-between items-center", !item.isMatch && "text-red-600")}>
                          <span className={cn("text-[11px] font-bold uppercase tracking-tight", !item.isMatch ? "text-red-400" : "text-zinc-400")}>Thực tế (Phiếu)</span>
                          <span className="font-black">{item.receiptValue.toLocaleString('vi-VN')}đ</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Desktop View */}
                <div className="hidden md:block rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-zinc-50/80">
                      <TableRow className="hover:bg-transparent border-zinc-200">
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 h-10 px-6">Hạng mục</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-zinc-400 h-10 px-6">Trên ứng dụng</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-zinc-400 h-10 px-6">Thực tế (Phiếu)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparisonResult.map(item => (
                        <TableRow key={item.field} className="hover:bg-zinc-50/30 transition-colors border-zinc-100">
                          <TableCell className="font-bold text-zinc-900 px-6 py-4">{item.label}</TableCell>
                          <TableCell className="text-right font-black text-zinc-600 px-6 py-4">{item.appValue.toLocaleString('vi-VN')}đ</TableCell>
                          <TableCell className={cn(
                            "text-right font-black px-6 py-4", 
                            !item.isMatch ? "text-red-600 bg-red-50/30" : "text-zinc-900"
                          )}>
                            <div className="flex items-center justify-end gap-2">
                              {item.receiptValue.toLocaleString('vi-VN')}đ
                              {!item.isMatch && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="h-10 w-10 text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900 mb-1">Dữ liệu hoàn toàn trùng khớp</h3>
                <p className="text-sm text-zinc-500 max-w-xs">
                  Không phát hiện bất kỳ sai sót nào giữa dữ liệu hệ thống và báo cáo thực tế.
                </p>
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter className="p-4 md:p-6 bg-white border-t border-zinc-100">
          {hasMismatch ? (
            <div className="w-full flex flex-col md:flex-row gap-3">
              <div className="flex flex-col md:flex-row gap-2 flex-1">
                <button 
                  onClick={onNavigateToExpenses} 
                  className="flex-1 h-12 rounded-2xl bg-zinc-100 text-zinc-900 hover:bg-zinc-200 transition-all font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <ListChecks className="h-4 w-4" /> Đối soát thu/chi
                </button>
                <button 
                  onClick={onNavigateToRevenue} 
                  className="flex-1 h-12 rounded-2xl bg-zinc-100 text-zinc-900 hover:bg-zinc-200 transition-all font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <FileText className="h-4 w-4" /> Đối soát doanh thu
                </button>
              </div>
              <DialogCancel onClick={() => onOpenChange(false)} className="md:w-32">Đóng</DialogCancel>
            </div>
          ) : (
            <div className="w-full flex justify-end">
              <DialogAction onClick={onConfirm} className="w-full md:w-auto px-10">
                Xác nhận & Hoàn tất
              </DialogAction>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
