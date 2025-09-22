'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ArrowRight, CheckCircle, ListChecks, FileText, Loader2, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import CameraDialog from '@/components/camera-dialog';

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
  onFinalSubmit: (finalData: any) => void;
  isProcessing: boolean;
  comparisonResult: ComparisonResult | null;
  handoverData: any;
};

export default function HandoverComparisonDialog({
  open,
  onOpenChange,
  onFinalSubmit,
  isProcessing,
  comparisonResult,
  handoverData,
}: HandoverComparisonDialogProps) {
  const router = useRouter();
  const [actualCash, setActualCash] = useState<number | null>(null);
  const [discrepancyReason, setDiscrepancyReason] = useState('');
  const [discrepancyPhotoIds, setDiscrepancyPhotoIds] = useState<string[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setActualCash(null);
      setDiscrepancyReason('');
      setDiscrepancyPhotoIds([]);
    }
  }, [open]);

  const hasMismatch = comparisonResult && comparisonResult.some(item => !item.isMatch);
  
  const discrepancy = (actualCash !== null && handoverData?.expectedCash !== undefined)
    ? actualCash - handoverData.expectedCash
    : 0;

  const handleConfirmAndSave = () => {
    if (discrepancy !== 0 && !discrepancyReason.trim()) {
      alert('Vui lòng nhập lý do chênh lệch tiền mặt.');
      return;
    }
    const finalData = {
      actualCash,
      discrepancy,
      discrepancyReason: discrepancyReason.trim() || undefined,
      discrepancyProofPhotos: discrepancyPhotoIds,
    };
    onFinalSubmit(finalData);
  };
  
  const handleCapturePhotos = (capturedPhotoIds: string[]) => {
      setDiscrepancyPhotoIds(prev => [...prev, ...capturedPhotoIds]);
      setIsCameraOpen(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Đối chiếu & Hoàn tất Bàn giao</DialogTitle>
            <DialogDescription>
              Kiểm tra lại các số liệu và xác nhận số tiền mặt thực tế.
            </DialogDescription>
          </DialogHeader>

          {hasMismatch && comparisonResult ? (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Phát hiện sai lệch dữ liệu!</AlertTitle>
                <AlertDescription>
                  Vui lòng kiểm tra lại các mục được đánh dấu. Điều này có thể do AI đọc sai, hoặc do các báo cáo thu/chi trong ngày chưa được nhập đúng.
                </AlertDescription>
              </Alert>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hạng mục</TableHead>
                    <TableHead className="text-right">Trên ứng dụng</TableHead>
                    <TableHead className="text-right">Trên phiếu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonResult.map(item => (
                    <TableRow key={item.field} className={cn(!item.isMatch && "bg-destructive/10")}>
                      <TableCell className="font-semibold">{item.label}</TableCell>
                      <TableCell className="text-right font-mono">{item.appValue.toLocaleString('vi-VN')}đ</TableCell>
                      <TableCell className={cn("text-right font-mono", !item.isMatch && "font-bold text-destructive")}>
                        {item.receiptValue.toLocaleString('vi-VN')}đ
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <Button variant="secondary" className="w-full" onClick={() => { router.push('/cashier'); onOpenChange(false); }}>
                  <ListChecks className="mr-2 h-4 w-4" /> Kiểm tra lại thu/chi
                </Button>
                <Button variant="secondary" className="w-full" onClick={() => { router.push('/reports/cashier'); onOpenChange(false); }}>
                  <FileText className="mr-2 h-4 w-4" /> Kiểm tra doanh thu
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert variant="default" className="bg-green-100/50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Dữ liệu đã khớp!</AlertTitle>
                <AlertDescription className="text-green-700">
                  Tất cả số liệu trên phiếu bàn giao đều trùng khớp với dữ liệu trên ứng dụng.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="expected-cash">Tiền mặt dự kiến</Label>
                  <Input id="expected-cash" disabled value={handoverData.expectedCash?.toLocaleString('vi-VN') + 'đ'} className="font-bold text-lg h-12 text-right bg-muted" />
                </div>
                <div>
                  <Label htmlFor="actual-cash">Tiền mặt thực tế</Label>
                  <Input id="actual-cash" type="number" placeholder="Nhập số tiền..." value={actualCash ?? ''} onChange={e => setActualCash(Number(e.target.value))} className="font-bold text-lg h-12 text-right" autoFocus />
                </div>
              </div>
              {discrepancy !== 0 && (
                <div className="border-destructive border p-4 rounded-md space-y-2">
                  <Label className="text-destructive font-bold">Chênh lệch: {discrepancy.toLocaleString('vi-VN')}đ</Label>
                  <Textarea
                    placeholder="Vui lòng nhập lý do chi tiết cho khoản chênh lệch này..."
                    value={discrepancyReason}
                    onChange={e => setDiscrepancyReason(e.target.value)}
                  />
                  <div className="flex justify-between items-center">
                    <Button variant="outline" size="sm" onClick={() => setIsCameraOpen(true)}>
                      <Camera className="mr-2 h-4 w-4" /> Chụp ảnh bằng chứng
                    </Button>
                    {discrepancyPhotoIds.length > 0 && <p className="text-xs text-muted-foreground">{discrepancyPhotoIds.length} ảnh đã được chọn.</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
            {!hasMismatch && (
              <Button onClick={handleConfirmAndSave} disabled={isProcessing || actualCash === null}>
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ArrowRight className="mr-2 h-4 w-4"/>}
                Gửi Báo cáo
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CameraDialog isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onSubmit={handleCapturePhotos} />
    </>
  );
}
