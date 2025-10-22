'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle, ArrowRight, Camera, Loader2, TrendingDown, TrendingUp, Wallet, X } from 'lucide-react';
import CameraDialog from '@/components/camera-dialog';
import { photoStore } from '@/lib/photo-store';
import Image from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { toast } from 'react-hot-toast';
import type { RevenueStats, ExpenseSlip } from '@/lib/types'; // Import types
import { Separator } from '@/components/ui/separator'; // Import Separator

type CashHandoverDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (finalData: any, id?: string) => void;
  isProcessing: boolean;
  expectedCash: number;
  countToEdit?: any | null;
  linkedRevenueStats?: RevenueStats | null; // New prop
  linkedExpenseSlips?: ExpenseSlip[]; // New prop
};

export default function CashHandoverDialog({
  open,
  onOpenChange,
  onSubmit,
  isProcessing,
  expectedCash,
  countToEdit = null,
  linkedRevenueStats = null, // Default value
  linkedExpenseSlips = [], // Default value
}: CashHandoverDialogProps) {
  const discrepancyReasonRef = useRef<HTMLTextAreaElement>(null);
  const [actualCashCounted, setActualCashCounted] = useState<number | null>(null);
  const [discrepancyReason, setDiscrepancyReason] = useState('');
  const [discrepancyPhotoIds, setDiscrepancyPhotoIds] = useState<string[]>([]);
  const [discrepancyPhotoUrls, setDiscrepancyPhotoUrls] = useState<string[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const formatPaymentMethod = (method: string) => {
    switch (method) {
      case 'cash': return 'Tiền mặt';
      case 'bank_transfer': return 'Chuyển khoản';
      case 'techcombankVietQrPro': return 'VietQR Pro';
      case 'shopeeFood': return 'ShopeeFood';
      case 'grabFood': return 'GrabFood';
      default: return method;
    }
  };

  const revenueOverview = useMemo(() => {
    if (!linkedRevenueStats) return null;
    return Object.entries(linkedRevenueStats.revenueByPaymentMethod)
      .filter(([method, amount]) => method === 'cash' && amount > 0)
      .map(([method, amount]) => ({
        method: formatPaymentMethod(method),
        amount,
      }));
  }, [linkedRevenueStats]);

  const expenseOverview = useMemo(() => {
    if (!linkedExpenseSlips || linkedExpenseSlips.length === 0) return null;
    const overview = linkedExpenseSlips.reduce((acc, slip) => {
      const method = slip.paymentMethod;
      if (method === 'cash' || method === 'bank_transfer') {
        if (!acc[method]) {
          acc[method] = 0;
        }
        acc[method] += slip.totalAmount;
      }
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(overview).map(([method, amount]) => ({
      method: formatPaymentMethod(method),
      amount,
    }));
  }, [linkedExpenseSlips]);

  useEffect(() => {
    if (open) {
      if (countToEdit) {
        setActualCashCounted(countToEdit.actualCashCounted || countToEdit.actualCash); // Support old and new
        setDiscrepancyReason(countToEdit.discrepancyReason || '');
        // Note: Editing photos is not supported in this version to keep it simple.
        // User needs to re-upload if they want to change.!
        setDiscrepancyPhotoIds([]);
        setDiscrepancyPhotoUrls([]);
      } else {
        setActualCashCounted(null);
        setDiscrepancyReason('');
        discrepancyPhotoUrls.forEach(url => URL.revokeObjectURL(url));
        setDiscrepancyPhotoUrls([]);
        setDiscrepancyPhotoIds([]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, countToEdit]);

  // Discrepancy is now calculated on the main page for display, not in the dialog
  const discrepancy = (actualCashCounted !== null && expectedCash !== undefined)
    ? actualCashCounted - expectedCash
    : 0;

  const handleConfirmAndSave = () => {
    // The check for discrepancy reason should still happen if there is a difference
    if (actualCashCounted !== null && actualCashCounted - expectedCash !== 0 && !discrepancyReason.trim()) {
      toast.error('Vui lòng nhập lý do chênh lệch tiền mặt.');
      discrepancyReasonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      discrepancyReasonRef.current?.focus();
      return;
    }
    const finalData = {
      actualCashCounted,
      discrepancyReason: discrepancyReason.trim() || null,
      newPhotoIds: discrepancyPhotoIds, // Renaming for clarity in the new structure
    };
    onSubmit(finalData, countToEdit?.id);
  };

  const handleCapturePhotos = async (media: { id: string; type: 'photo' | 'video' }[]) => {
    const capturedPhotoIds = media.filter(m => m.type === 'photo').map(m => m.id);
    const newUrls: string[] = [];
    for (const id of capturedPhotoIds) {
      const blob = await photoStore.getPhoto(id);
      if (blob) {
        newUrls.push(URL.createObjectURL(blob));
      }
    }
    setDiscrepancyPhotoIds(prev => [...prev, ...capturedPhotoIds]);
    setDiscrepancyPhotoUrls(prev => [...prev, ...newUrls]);
    setIsCameraOpen(false);
  };

  const handleDeletePhoto = async (photoId: string, photoUrl: string) => {
    setDiscrepancyPhotoIds(prev => prev.filter(id => id !== photoId));
    setDiscrepancyPhotoUrls(prev => prev.filter(url => url !== photoUrl));
    URL.revokeObjectURL(photoUrl);
    await photoStore.deletePhoto(photoId);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md h-full md:h-auto md:max-h-[90vh] flex flex-col p-0" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="p-6 pb-4 border-b shrink-0 bg-muted/30">
            <DialogTitle className="text-2xl flex items-center gap-2"><Wallet /> Bàn giao tiền mặt</DialogTitle>
            <DialogDescription>Kiểm đếm và nhập số tiền mặt thực tế trong quầy.</DialogDescription>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto">
            <ScrollArea>
              <div className="space-y-4 p-4">
                {(revenueOverview || expenseOverview) && (
                  <Card className="rounded-xl">
                    <CardHeader>
                      <CardTitle className="text-lg">Tổng quan trong ca</CardTitle>
                      <CardDescription>Dựa trên các phiếu doanh thu và phiếu chi đã ghi nhận.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {revenueOverview && revenueOverview.length > 0 && (
                        <div>
                          <h3 className="font-semibold flex items-center gap-2 text-green-600"><TrendingUp className="h-5 w-5" /> Doanh thu</h3>
                          <div className="mt-2 space-y-1 text-sm">
                            {revenueOverview.map(item => (
                              <div key={item.method} className="flex justify-between">
                                <span className="text-muted-foreground">{item.method}</span>
                                <span className="font-medium">{item.amount.toLocaleString('vi-VN')}đ</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {revenueOverview && expenseOverview && <Separator />}
                      {expenseOverview && expenseOverview.length > 0 && (
                        <div>
                          <h3 className="font-semibold flex items-center gap-2 text-red-600"><TrendingDown className="h-5 w-5" /> Chi phí</h3>
                          <div className="mt-2 space-y-1 text-sm">
                            {expenseOverview.map(item => (
                              <div key={item.method} className="flex justify-between">
                                <span className="text-muted-foreground">{item.method}</span>
                                <span className="font-medium">{item.amount.toLocaleString('vi-VN')}đ</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <Separator />
                       <div className="flex justify-between items-center pt-2">
                          <p className="font-semibold text-base flex items-center gap-2"><Wallet className="h-5 w-5"/>Tiền mặt dự kiến</p>
                          <p className="text-xl font-bold">{expectedCash.toLocaleString('vi-VN')}đ</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="border-primary ring-2 ring-primary/50 rounded-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-base text-primary">Tiền mặt thực tế</CardTitle></CardHeader>
                  <CardContent><Input type="number" placeholder="Nhập số tiền..." value={actualCashCounted ?? ''} onChange={e => setActualCashCounted(Number(e.target.value))} className="font-bold text-2xl h-14 text-right" autoFocus onFocus={e => e.target.select()} /></CardContent>
                </Card>
                {discrepancy !== 0 && (
                  <Card className="border-destructive ring-2 ring-destructive/30 mt-6 rounded-xl">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-destructive flex items-center gap-2 text-lg"><AlertCircle /> Chênh lệch: {discrepancy.toLocaleString('vi-VN')}đ</CardTitle>
                      <CardDescription>Vui lòng nhập lý do chi tiết và chụp ảnh bằng chứng (nếu cần).</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Textarea ref={discrepancyReasonRef} placeholder="Nhập lý do chênh lệch ở đây..." value={discrepancyReason} onChange={e => setDiscrepancyReason(e.target.value)} />
                       <div className="space-y-2">
                        {countToEdit?.discrepancyProofPhotos?.length > 0 && (
                            <p className="text-xs text-muted-foreground italic">Lưu ý: Sửa sẽ xóa các ảnh bằng chứng cũ. Vui lòng chụp lại ảnh mới nếu cần.</p>
                        )}
                        <Button variant="outline" className="w-full h-12" onClick={() => setIsCameraOpen(true)}><Camera className="mr-2 h-5 w-5" /> Chụp ảnh bằng chứng</Button>
                        {discrepancyPhotoUrls.length > 0 && (
                          <div className="flex gap-2 flex-wrap">
                            {discrepancyPhotoUrls.map((url, i) => (
                              <div key={i} className="relative h-16 w-16 group">
                                <button onClick={() => { setLightboxIndex(i); setIsLightboxOpen(true); }} className="w-full h-full rounded-md overflow-hidden"><Image src={url} alt={`proof-${i}`} fill className="object-cover" /></button>
                                <Button variant="destructive" size="icon" className="absolute -top-1 -right-1 h-5 w-5 rounded-full" onClick={() => handleDeletePhoto(discrepancyPhotoIds[i], url)}><X className="h-3 w-3" /></Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter className="p-6 pt-4 border-t shrink-0 bg-muted/30">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
            <Button onClick={handleConfirmAndSave} disabled={isProcessing || typeof actualCashCounted !== 'number'}>
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
              {isProcessing ? 'Đang lưu...' : (countToEdit ? 'Lưu thay đổi' : 'Hoàn tất & Gửi')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CameraDialog isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onSubmit={handleCapturePhotos} captureMode="photo" />
      <Lightbox open={isLightboxOpen} close={() => setIsLightboxOpen(false)} index={lightboxIndex} slides={discrepancyPhotoUrls.map(url => ({ src: url }))} />
    </>
  );
}