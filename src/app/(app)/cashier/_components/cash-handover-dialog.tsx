'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogAction, DialogCancel } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle, ArrowRight, Camera, Loader2, TrendingDown, TrendingUp, Wallet, X } from 'lucide-react';
import CameraDialog from '@/components/camera-dialog';
import { photoStore } from '@/lib/photo-store';
import Image from '@/components/ui/image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/components/ui/pro-toast';
import type { RevenueStats, ExpenseSlip } from '@/lib/types'; // Import types
import { useLightbox } from '@/contexts/lightbox-context';
import { v4 as uuidv4 } from 'uuid';
import { Separator } from '@/components/ui/separator'; // Import Separator

type CashHandoverDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (finalData: any, id?: string) => void;
  isProcessing: boolean;
  expectedCash: number;
  countToEdit?: any | null;
  isOwnerView?: boolean;
  dateForNewEntry?: string | null; // To specify date for new entries in owner view
  linkedRevenueStats?: RevenueStats | null; // New prop
  linkedExpenseSlips?: ExpenseSlip[]; // New prop
  parentDialogTag: string;
};

export default function CashHandoverDialog({
  open,
  onOpenChange,
  onSubmit,
  isProcessing,
  expectedCash,
  countToEdit = null,
  isOwnerView = false,
  dateForNewEntry = null,
  linkedRevenueStats = null, // Default value
  linkedExpenseSlips = [], // Default value
  parentDialogTag,
}: CashHandoverDialogProps) {
  const discrepancyReasonRef = useRef<HTMLTextAreaElement>(null);
  const [actualCashCounted, setActualCashCounted] = useState<number | null>(null);
  const [formattedActualCash, setFormattedActualCash] = useState('');
  const [discrepancyReason, setDiscrepancyReason] = useState('');
  const [discrepancyPhotoIds, setDiscrepancyPhotoIds] = useState<string[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [existingPhotos, setExistingPhotos] = useState<{ id: string, url: string }[]>([]);
  const [localPhotos, setLocalPhotos] = useState<{ id: string, url: string }[]>([]);
  const [photosToDelete, setPhotosToDelete] = useState<string[]>([]);
  const { openLightbox } = useLightbox();

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
      // if (method === 'cash' || method === 'bank_transfer') {
      if (method === 'cash') {
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

  const allPhotos = useMemo(() => [...existingPhotos, ...localPhotos], [existingPhotos, localPhotos]);

  const resetState = useCallback(() => {
    setActualCashCounted(null);
    setFormattedActualCash('');
    setDiscrepancyReason('');
    setDiscrepancyPhotoIds([]);
    setExistingPhotos([]);
    setLocalPhotos([]);
    setPhotosToDelete([]);

    if (countToEdit) {
      setActualCashCounted(countToEdit.actualCashCounted);
      setFormattedActualCash(countToEdit.actualCashCounted.toLocaleString('vi-VN'));
      setDiscrepancyReason(countToEdit.discrepancyReason || '');
      if (isOwnerView && countToEdit.discrepancyProofPhotos) {
        setExistingPhotos(countToEdit.discrepancyProofPhotos.map((url: string) => ({ id: url, url })));
      }
    }
  }, [countToEdit, isOwnerView]);

  useEffect(() => {
    if (open) {
      resetState();
    } else {
      localPhotos.forEach(p => URL.revokeObjectURL(p.url));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resetState]);

  const handleActualCashChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    // Remove non-digit characters to get the number
    const numericValue = parseInt(rawValue.replace(/[^0-9]/g, ''), 10);

    if (isNaN(numericValue)) {
      setActualCashCounted(null);
      setFormattedActualCash('');
    } else {
      setActualCashCounted(numericValue);
      setFormattedActualCash(numericValue.toLocaleString('vi-VN'));
    }
  };

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
      newPhotoIds: localPhotos.map(p => p.id),
      photosToDelete: photosToDelete,
      date: dateForNewEntry, // Pass the date for new entries
    };
    onSubmit(finalData, countToEdit?.id);
  };

  const handleCapturePhotos = useCallback(async (media: { id: string; type: 'photo' | 'video' }[]) => {
    const newPhotos = await Promise.all(
      media
        .filter(m => m.type === 'photo')
        .map(async ({ id }) => {
          const blob = await photoStore.getPhoto(id);
          if (!blob) return null;
          return { id, url: URL.createObjectURL(blob) };
        })
    );
    setLocalPhotos(prev => [...prev, ...newPhotos.filter(Boolean) as { id: string, url: string }[]]);
    setIsCameraOpen(false);
  }, []);

  const handleDeleteExistingPhoto = (url: string) => {
    setExistingPhotos(prev => prev.filter(p => p.url !== url));
    setPhotosToDelete(prev => [...prev, url]);
  };

  const handleDeleteLocalPhoto = async (photoId: string) => {
    setLocalPhotos(prev => {
      const photoToDelete = prev.find(p => p.id === photoId);
      if (photoToDelete) {
        URL.revokeObjectURL(photoToDelete.url);
      }
      return prev.filter(p => p.id !== photoId);
    });
    await photoStore.deletePhoto(photoId);
  };

  const dialogTitle = isOwnerView && countToEdit ? "Chi tiết Kiểm kê" : "Bàn giao tiền mặt";

  const discrepancy = (actualCashCounted !== null && expectedCash !== undefined)
    ? actualCashCounted - expectedCash
    : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} dialogTag="cash-handover-dialog" parentDialogTag={parentDialogTag}>
        <DialogContent className="max-w-md h-full md:h-auto md:max-h-[90vh] flex flex-col p-0">
          <DialogHeader variant="premium" iconkey="wallet">
            <DialogTitle>{dialogTitle}</DialogTitle>
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
                        <p className="font-semibold text-base flex items-center gap-2"><Wallet className="h-5 w-5" />Tiền mặt dự kiến</p>
                        <p className="text-xl font-bold">{expectedCash.toLocaleString('vi-VN')}đ</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="border-primary/20 bg-primary/5 shadow-sm rounded-[2rem] overflow-hidden border-2 transition-all hover:bg-primary/[0.07]">
                  <CardHeader className="pb-2 text-center">
                    <CardTitle className="text-sm font-bold uppercase tracking-widest text-primary/70">Tiền mặt thực tế</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-6">
                    <div className="relative group">
                      <Input 
                        type="text" 
                        placeholder="0" 
                        value={formattedActualCash ? formattedActualCash : ''} 
                        onChange={handleActualCashChange} 
                        className="font-black text-4xl h-20 text-center bg-transparent border-none focus-visible:ring-0 shadow-none transition-all placeholder:opacity-20" 
                        autoFocus 
                        onFocus={e => e.target.select()} 
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-2xl font-bold text-primary/30 pointer-events-none">đ</div>
                    </div>
                  </CardContent>
                </Card>
                {discrepancy !== 0 && (
                  <Card className="border-destructive/20 bg-destructive/5 shadow-sm rounded-[2rem] overflow-hidden border-2 mt-6">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-destructive flex items-center justify-center gap-2 text-xl font-bold">
                        <AlertCircle className="h-6 w-6" /> 
                        Chênh lệch: {discrepancy > 0 ? '+' : ''}{discrepancy.toLocaleString('vi-VN')}đ
                      </CardTitle>
                      <CardDescription className="text-center text-destructive/70 font-medium">Vui lòng nhập lý do chi tiết và bằng chứng.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Textarea 
                        ref={discrepancyReasonRef} 
                        placeholder="Tại sao lại chênh lệch?..." 
                        value={discrepancyReason} 
                        onChange={e => setDiscrepancyReason(e.target.value)} 
                        disabled={!isOwnerView && !!countToEdit} 
                        className="bg-background/50 border-destructive/10 focus-visible:ring-destructive/20 min-h-[100px] rounded-xl"
                      />
                      <div className="space-y-3">
                        {(!countToEdit || isOwnerView) && (
                          <Button variant="outline" className="w-full h-12 rounded-xl border-destructive/20 hover:bg-destructive/10 text-destructive font-bold group" onClick={() => setIsCameraOpen(true)}>
                            <Camera className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" /> 
                            Chụp ảnh bằng chứng
                          </Button>
                        )}
                        {allPhotos.length > 0 && (
                          <div className="flex gap-3 justify-center flex-wrap pt-2">
                            {allPhotos.map((photo, i) => (
                              <div key={photo.id} className="relative h-20 w-20 group/photo">
                                <button onClick={() => openLightbox(allPhotos.map(p => ({ src: p.url })), i)} className="w-full h-full rounded-2xl overflow-hidden ring-2 ring-destructive/20 shadow-lg group-hover/photo:ring-destructive/40 transition-all">
                                  <Image src={photo.url} alt={`proof-${i}`} fill className="object-cover" />
                                </button>
                                {(!countToEdit || isOwnerView) && (
                                  <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg opacity-0 group-hover/photo:opacity-100 transition-opacity" onClick={() => localPhotos.some(p => p.id === photo.id) ? handleDeleteLocalPhoto(photo.id) : handleDeleteExistingPhoto(photo.url)}>
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                )}
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
          <DialogFooter variant="muted" className="shrink-0 p-6">
            <DialogCancel onClick={() => onOpenChange(false)}>Đóng</DialogCancel>
            {(!countToEdit || isOwnerView) && (
              <DialogAction 
                onClick={handleConfirmAndSave} 
                isLoading={isProcessing}
                disabled={typeof actualCashCounted !== 'number'}
              >
                {!isProcessing && !countToEdit && <ArrowRight className="mr-2 h-4 w-4" />}
                {countToEdit ? 'Lưu thay đổi' : 'Hoàn tất & Gửi'}
              </DialogAction>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CameraDialog isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onSubmit={handleCapturePhotos} captureMode="photo" parentDialogTag="cash-handover-dialog" />
    </>
  );
}