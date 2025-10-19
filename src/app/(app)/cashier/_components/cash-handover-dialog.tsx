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
import { ScrollArea } from '@/components/ui/scroll-area';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { toast } from 'react-hot-toast';

type CashHandoverDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinalSubmit: (finalData: any, id?: string) => void;
  isProcessing: boolean;
  expectedCash: number;
  countToEdit?: any | null;
};

export default function CashHandoverDialog({
  open,
  onOpenChange,
  onFinalSubmit: onParentSubmit,
  isProcessing,
  expectedCash,
  countToEdit = null,
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
      if (countToEdit) {
        setActualCash(countToEdit.actualCash);
        setDiscrepancyReason(countToEdit.discrepancyReason || '');
        // Note: Editing photos is not supported in this version to keep it simple.
        // User needs to re-upload if they want to change.
        setDiscrepancyPhotoIds([]);
        setDiscrepancyPhotoUrls([]);
      } else {
        setActualCash(null);
        setDiscrepancyReason('');
        discrepancyPhotoUrls.forEach(url => URL.revokeObjectURL(url));
        setDiscrepancyPhotoUrls([]);
        setDiscrepancyPhotoIds([]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, countToEdit]);

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
      expectedCash: countToEdit ? countToEdit.expectedCash : expectedCash, // Preserve original expected cash on edit
      discrepancy,
      discrepancyReason: discrepancyReason.trim() || null,
      // On edit, we only handle new photos. Old photos are not editable in this flow.
      discrepancyProofPhotoIds: discrepancyPhotoIds,
    };
    onParentSubmit(finalData, countToEdit?.id);
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
              <div className="space-y-6 p-6">
                <Card className="rounded-xl bg-muted/50 dark:bg-muted/30">
                  <CardHeader className="pb-2"><CardTitle className="text-base text-muted-foreground">Tiền mặt dự kiến (lúc kiểm kê)</CardTitle></CardHeader>
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
            <Button onClick={handleConfirmAndSave} disabled={isProcessing || typeof actualCash !== 'number'}>
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