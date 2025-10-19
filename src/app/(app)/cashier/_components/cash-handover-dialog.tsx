'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle, ArrowRight, Camera, Loader2, Wallet, X } from 'lucide-react';
import CameraDialog from '@/components/camera-dialog';
import { photoStore } from '@/lib/photo-store';
import Image from 'next/image';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { toast } from 'react-hot-toast';

type CashHandoverDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinalSubmit: (finalData: any) => void;
  isProcessing: boolean;
  expectedCash: number;
};

export default function CashHandoverDialog({
  open,
  onOpenChange,
  onFinalSubmit,
  isProcessing,
  expectedCash,
}: CashHandoverDialogProps) {
  const [actualCash, setActualCash] = useState<number | null>(null);
  const [discrepancyReason, setDiscrepancyReason] = useState('');
  const [discrepancyPhotoIds, setDiscrepancyPhotoIds] = useState<string[]>([]);
  const [discrepancyPhotoUrls, setDiscrepancyPhotoUrls] = useState<string[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setActualCash(null);
      setDiscrepancyReason('');
      discrepancyPhotoUrls.forEach(url => URL.revokeObjectURL(url));
      setDiscrepancyPhotoUrls([]);
      setDiscrepancyPhotoIds([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const discrepancy = (actualCash !== null && expectedCash !== undefined)
    ? actualCash - expectedCash
    : 0;

  const handleConfirmAndSave = () => {
    if (discrepancy !== 0 && !discrepancyReason.trim()) {
      toast.error('Vui lòng nhập lý do chênh lệch tiền mặt.');
      return;
    }
    const finalData = {
      actualCash,
      discrepancy,
      discrepancyReason: discrepancyReason.trim() || null,
      discrepancyProofPhotos: discrepancyPhotoIds,
    };
    onFinalSubmit(finalData);
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
        <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2"><Wallet /> Bàn giao tiền mặt</DialogTitle>
            <DialogDescription>Kiểm đếm và nhập số tiền mặt thực tế trong quầy.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <Card className="rounded-xl bg-muted/50 dark:bg-muted/30">
              <CardHeader className="pb-2"><CardTitle className="text-base text-muted-foreground">Tiền mặt dự kiến</CardTitle></CardHeader>
              <CardContent><Input disabled value={expectedCash.toLocaleString('vi-VN') + 'đ'} className="font-bold text-2xl h-14 text-right bg-muted" /></CardContent>
            </Card>
            <Card className="border-primary ring-2 ring-primary/50 rounded-xl">
              <CardHeader className="pb-2"><CardTitle className="text-base text-primary">Tiền mặt thực tế</CardTitle></CardHeader>
              <CardContent><Input type="number" placeholder="Nhập số tiền..." value={actualCash ?? ''} onChange={e => setActualCash(Number(e.target.value))} className="font-bold text-2xl h-14 text-right" autoFocus onFocus={e => e.target.select()} /></CardContent>
            </Card>
            {discrepancy !== 0 && (
              <Card className="border-destructive ring-2 ring-destructive/30 mt-6 rounded-xl">
                <CardHeader className="pb-4">
                  <CardTitle className="text-destructive flex items-center gap-2 text-lg"><AlertCircle /> Chênh lệch: {discrepancy.toLocaleString('vi-VN')}đ</CardTitle>
                  <CardDescription>Vui lòng nhập lý do chi tiết và chụp ảnh bằng chứng (nếu cần).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea placeholder="Nhập lý do chênh lệch ở đây..." value={discrepancyReason} onChange={e => setDiscrepancyReason(e.target.value)} />
                  <div className="space-y-2">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
            <Button onClick={handleConfirmAndSave} disabled={isProcessing || typeof actualCash !== 'number'}>
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
              {isProcessing ? 'Đang gửi...' : 'Hoàn tất & Gửi Báo cáo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CameraDialog isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onSubmit={handleCapturePhotos} captureMode="photo" />
      <Lightbox open={isLightboxOpen} close={() => setIsLightboxOpen(false)} index={lightboxIndex} slides={discrepancyPhotoUrls.map(url => ({ src: url }))} />
    </>
  );
}