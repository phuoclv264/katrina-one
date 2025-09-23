
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ArrowRight, CheckCircle, ListChecks, FileText, Loader2, Camera, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import CameraDialog from '@/components/camera-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';

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
  onNavigateToExpenses: () => void;
  onNavigateToRevenue: () => void;
};

export default function HandoverComparisonDialog({
  open,
  onOpenChange,
  onFinalSubmit,
  isProcessing,
  comparisonResult,
  handoverData,
  onNavigateToExpenses,
  onNavigateToRevenue,
}: HandoverComparisonDialogProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
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
        <DialogContent 
            className="max-w-md md:max-w-4xl"
            onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className={cn("flex items-center gap-3 text-2xl font-bold", hasMismatch ? 'text-destructive' : 'text-green-600')}>
              {hasMismatch ? <AlertCircle className="h-7 w-7"/> : <CheckCircle className="h-7 w-7"/>}
              {hasMismatch ? 'Phát hiện sai lệch dữ liệu!' : 'Đối chiếu thành công!'}
            </DialogTitle>
            <DialogDescription className="text-base">
              {hasMismatch
                ? "Vui lòng kiểm tra lại các mục được đánh dấu bên dưới."
                : "Tất cả số liệu đã khớp. Vui lòng xác nhận tiền mặt thực tế để hoàn tất."
              }
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] p-1">
              <div className="p-6 space-y-6">
                {hasMismatch && comparisonResult ? (
                  <div className="space-y-4">
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Dữ liệu không khớp</AlertTitle>
                      <AlertDescription>
                        Điều này có thể do AI đọc sai, hoặc do các báo cáo thu/chi trong ngày chưa được nhập đúng đắn.
                      </AlertDescription>
                    </Alert>
                    
                    {isMobile ? (
                      <div className="space-y-3">
                          {comparisonResult.map(item => (
                              <Card key={item.field} className={cn(!item.isMatch && "border-destructive border-2")}>
                                  <CardHeader className="p-3 pb-2">
                                      <CardTitle className="text-base">{item.label}</CardTitle>
                                  </CardHeader>
                                  <CardContent className="p-3 pt-0 space-y-1 text-sm">
                                      <div className="flex justify-between items-center">
                                          <span className="text-muted-foreground">Trên ứng dụng:</span>
                                          <span className="font-mono font-semibold">{item.appValue.toLocaleString('vi-VN')}đ</span>
                                      </div>
                                      <div className={cn("flex justify-between items-center", !item.isMatch && "font-bold text-destructive")}>
                                          <span className={cn(!item.isMatch && "text-destructive/80")}>Trên phiếu:</span>
                                          <span className="font-mono">{item.receiptValue.toLocaleString('vi-VN')}đ</span>
                                      </div>
                                  </CardContent>
                              </Card>
                          ))}
                      </div>
                    ) : (
                      <div className="border rounded-lg overflow-hidden">
                          <Table>
                              <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm">
                                  <TableRow>
                                      <TableHead className="font-bold">Hạng mục</TableHead>
                                      <TableHead className="text-right font-bold">Trên ứng dụng</TableHead>
                                      <TableHead className="text-right font-bold">Trên phiếu</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                              {comparisonResult.map(item => (
                                  <TableRow key={item.field}>
                                  <TableCell className="font-semibold">{item.label}</TableCell>
                                  <TableCell className="text-right font-mono">{item.appValue.toLocaleString('vi-VN')}đ</TableCell>
                                  <TableCell className={cn("text-right font-mono", !item.isMatch && "font-bold text-destructive")}>
                                      {item.receiptValue.toLocaleString('vi-VN')}đ
                                  </TableCell>
                                  </TableRow>
                              ))}
                              </TableBody>
                          </Table>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <Alert variant="default" className="border-green-500/30 bg-green-500/10">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertTitle className="text-green-800 dark:text-green-300">Dữ liệu đã khớp!</AlertTitle>
                      <AlertDescription className="text-green-700 dark:text-green-400">
                        Tất cả số liệu trên phiếu bàn giao đều trùng khớp với dữ liệu trên ứng dụng.
                      </AlertDescription>
                    </Alert>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                          <CardHeader className="pb-2"><CardTitle className="text-base">Tiền mặt dự kiến</CardTitle></CardHeader>
                          <CardContent><Input disabled value={handoverData.expectedCash?.toLocaleString('vi-VN') + 'đ'} className="font-bold text-xl h-14 text-right bg-muted" /></CardContent>
                      </Card>
                      <Card className="border-primary ring-2 ring-primary/50">
                          <CardHeader className="pb-2"><CardTitle className="text-base">Tiền mặt thực tế</CardTitle></CardHeader>
                          <CardContent><Input type="number" placeholder="Nhập số tiền..." value={actualCash ?? ''} onChange={e => setActualCash(Number(e.target.value))} className="font-bold text-xl h-14 text-right" autoFocus onFocus={e => e.target.select()}/></CardContent>
                      </Card>
                    </div>
                    {discrepancy !== 0 && (
                      <Card className="border-destructive ring-2 ring-destructive/30">
                          <CardHeader className="pb-4">
                              <CardTitle className="text-destructive flex items-center gap-2"><AlertCircle/> Chênh lệch: {discrepancy.toLocaleString('vi-VN')}đ</CardTitle>
                              <CardDescription>Vui lòng nhập lý do chi tiết và chụp ảnh bằng chứng (nếu cần).</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <Textarea
                              placeholder="Nhập lý do chênh lệch ở đây..."
                              value={discrepancyReason}
                              onChange={e => setDiscrepancyReason(e.target.value)}
                            />
                            <div className="flex justify-between items-center">
                              <Button variant="outline" size="sm" onClick={() => setIsCameraOpen(true)}>
                                <Camera className="mr-2 h-4 w-4" /> Chụp ảnh bằng chứng
                              </Button>
                              {discrepancyPhotoIds.length > 0 && <p className="text-xs text-muted-foreground">{discrepancyPhotoIds.length} ảnh đã được chọn.</p>}
                            </div>
                          </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </div>
          </ScrollArea>

          <DialogFooter className="pt-4 flex flex-col sm:flex-row sm:justify-between items-center gap-2">
             {hasMismatch ? (
                <>
                    {/* Mobile layout for mismatch */}
                    <div className="w-full flex-col space-y-2 sm:hidden">
                        <Button variant="secondary" onClick={onNavigateToExpenses} className="w-full h-auto whitespace-normal py-2">
                            <ListChecks className="mr-2 h-4 w-4" /> Kiểm tra lại phiếu thu/chi
                        </Button>
                         <Button variant="secondary" onClick={onNavigateToRevenue} className="w-full h-auto whitespace-normal py-2">
                            <FileText className="mr-2 h-4 w-4" /> Kiểm tra lại phiếu doanh thu
                        </Button>
                         <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full h-auto whitespace-normal py-2">Hủy</Button>
                    </div>
                     {/* Desktop layout for mismatch */}
                    <div className="hidden sm:flex justify-start gap-2">
                        <Button variant="secondary" onClick={onNavigateToExpenses}>
                            <ListChecks className="mr-2 h-4 w-4" /> Kiểm tra lại thu/chi
                        </Button>
                        <Button variant="secondary" onClick={onNavigateToRevenue}>
                            <FileText className="mr-2 h-4 w-4" /> Kiểm tra doanh thu
                        </Button>
                    </div>
                    <div className="hidden sm:flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
                    </div>
                </>
             ) : (
                <>
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Hủy</Button>
                    <Button onClick={handleConfirmAndSave} disabled={isProcessing || actualCash === null} className="w-full sm:w-auto">
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ArrowRight className="mr-2 h-4 w-4"/>}
                        {isProcessing ? 'Đang gửi...' : 'Hoàn tất & Gửi Báo cáo'}
                    </Button>
                </>
             )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CameraDialog isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onSubmit={handleCapturePhotos} />
    </>
  );
}
