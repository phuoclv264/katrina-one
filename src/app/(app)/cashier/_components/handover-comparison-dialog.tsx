
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
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { photoStore } from '@/lib/photo-store';

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
  const [discrepancyPhotoUrls, setDiscrepancyPhotoUrls] = useState<string[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setActualCash(null);
      setDiscrepancyReason('');
      setDiscrepancyPhotoIds([]);
      setDiscrepancyPhotoUrls([]);
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
  
  const handleCapturePhotos = async (capturedPhotoIds: string[]) => {
      const newUrls: string[] = [];
      for(const id of capturedPhotoIds) {
        const blob = await photoStore.getPhoto(id);
        if(blob) {
            newUrls.push(URL.createObjectURL(blob));
        }
      }
      setDiscrepancyPhotoIds(prev => [...prev, ...capturedPhotoIds]);
      setDiscrepancyPhotoUrls(prev => [...prev, ...newUrls]);
      setIsCameraOpen(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
            className="max-w-4xl h-full md:h-auto md:max-h-[90vh] flex flex-col p-0"
            onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className={cn(
            "p-4 md:p-6 flex flex-row items-center gap-4 space-y-0 shrink-0",
             hasMismatch ? "bg-destructive/10 text-destructive" : "bg-green-500/10 text-green-600"
          )}>
            {hasMismatch ? <AlertCircle className="h-8 w-8 shrink-0"/> : <CheckCircle className="h-8 w-8 shrink-0"/>}
            <div className="flex-1">
                <DialogTitle className="text-xl md:text-2xl font-bold">
                {hasMismatch ? 'Phát hiện sai lệch dữ liệu' : 'Đối chiếu thành công'}
                </DialogTitle>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-grow">
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
                    
                    {isMobile ? (
                      <div className="space-y-3">
                          {comparisonResult.map(item => (
                              <Card key={item.field} className={cn(!item.isMatch && "border-destructive border-2")}>
                                  <CardHeader className="p-3 pb-2 flex-row justify-between items-center">
                                      <CardTitle className="text-base">{item.label}</CardTitle>
                                      {!item.isMatch && <Badge variant="destructive">Sai lệch</Badge>}
                                  </CardHeader>
                                  <CardContent className="p-3 pt-0 space-y-1 text-sm">
                                      <div className="flex justify-between items-center">
                                          <span className="text-muted-foreground">Trên ứng dụng:</span>
                                          <span className="font-mono font-semibold text-base">{item.appValue.toLocaleString('vi-VN')}đ</span>
                                      </div>
                                      <div className={cn("flex justify-between items-center", !item.isMatch && "font-bold text-destructive")}>
                                          <span className={cn(!item.isMatch && "text-destructive/80")}>Trên phiếu:</span>
                                          <span className="font-mono text-base">{item.receiptValue.toLocaleString('vi-VN')}đ</span>
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
                                  <TableRow key={item.field} className={cn(!item.isMatch && "bg-destructive/10")}>
                                  <TableCell className="font-semibold">{item.label}</TableCell>
                                  <TableCell className="text-right font-mono text-base">{item.appValue.toLocaleString('vi-VN')}đ</TableCell>
                                  <TableCell className={cn("text-right font-mono text-base", !item.isMatch && "font-bold text-destructive")}>
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
                          <CardContent><Input disabled value={handoverData.expectedCash?.toLocaleString('vi-VN') + 'đ'} className="font-bold text-2xl h-14 text-right bg-muted" /></CardContent>
                      </Card>
                      <Card className="border-primary ring-2 ring-primary/50">
                          <CardHeader className="pb-2"><CardTitle className="text-base">Tiền mặt thực tế</CardTitle></CardHeader>
                          <CardContent><Input type="number" placeholder="Nhập số tiền..." value={actualCash ?? ''} onChange={e => setActualCash(Number(e.target.value))} className="font-bold text-2xl h-14 text-right" autoFocus onFocus={e => e.target.select()}/></CardContent>
                      </Card>
                    </div>
                    {discrepancy !== 0 && (
                      <Card className="border-destructive ring-2 ring-destructive/30 mt-6">
                          <CardHeader className="pb-4">
                              <CardTitle className="text-destructive flex items-center gap-2 text-xl"><AlertCircle/> Chênh lệch: {discrepancy.toLocaleString('vi-VN')}đ</CardTitle>
                              <CardDescription>Vui lòng nhập lý do chi tiết và chụp ảnh bằng chứng (nếu cần).</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <Textarea
                              placeholder="Nhập lý do chênh lệch ở đây..."
                              value={discrepancyReason}
                              onChange={e => setDiscrepancyReason(e.target.value)}
                            />
                            <div className="flex flex-col gap-2">
                                <Button variant="outline" className="w-full h-12" onClick={() => setIsCameraOpen(true)}>
                                    <Camera className="mr-2 h-5 w-5" /> Chụp ảnh bằng chứng
                                </Button>
                                {discrepancyPhotoUrls.length > 0 && (
                                    <div className="flex gap-2 flex-wrap">
                                        {discrepancyPhotoUrls.map((url, i) => (
                                            <Image key={i} src={url} alt={`proof-${i}`} width={64} height={64} className="rounded-md object-cover"/>
                                        ))}
                                    </div>
                                )}
                            </div>
                          </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </div>
          </ScrollArea>

          <DialogFooter className="p-4 md:p-6 border-t shrink-0">
             {hasMismatch ? (
                <div className="w-full flex flex-col md:flex-row md:justify-between gap-3">
                    <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                        <Button variant="secondary" onClick={onNavigateToExpenses} className="w-full h-11 md:h-auto">
                            <ListChecks className="mr-2 h-4 w-4" /> Kiểm tra lại thu/chi
                        </Button>
                        <Button variant="secondary" onClick={onNavigateToRevenue} className="w-full h-11 md:h-auto">
                            <FileText className="mr-2 h-4 w-4" /> Kiểm tra doanh thu
                        </Button>
                    </div>
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full md:w-auto h-11 md:h-auto">Hủy</Button>
                </div>
             ) : (
                <div className="w-full flex flex-col md:flex-row md:justify-end gap-3">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full md:w-auto h-11 md:h-auto">Hủy</Button>
                    <Button onClick={handleConfirmAndSave} disabled={isProcessing || actualCash === null} className="w-full md:w-auto h-11 md:h-auto text-base">
                        {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <ArrowRight className="mr-2 h-5 w-5"/>}
                        {isProcessing ? 'Đang gửi...' : 'Hoàn tất & Gửi Báo cáo'}
                    </Button>
                </div>
             )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CameraDialog isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onSubmit={handleCapturePhotos} />
    </>
  );
}
