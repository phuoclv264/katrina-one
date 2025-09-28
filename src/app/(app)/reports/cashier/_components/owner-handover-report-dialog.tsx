'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { HandoverReport, AuthUser } from '@/lib/types';
import { Loader2, Camera, Trash2, X, Eye } from 'lucide-react';
import CameraDialog from '@/components/camera-dialog';
import { v4 as uuidv4 } from 'uuid';
import { photoStore } from '@/lib/photo-store';
import Image from 'next/image';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { toast } from 'react-hot-toast';


type OwnerHandoverReportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any, id: string) => void;
  isProcessing: boolean;
  reportToEdit: HandoverReport | null;
  reporter: AuthUser;
};

export default function OwnerHandoverReportDialog({
  open,
  onOpenChange,
  onSave,
  isProcessing,
  reportToEdit,
  reporter,
}: OwnerHandoverReportDialogProps) {
  const [actualCash, setActualCash] = useState(0);
  const [discrepancyReason, setDiscrepancyReason] = useState('');

  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [localPhotos, setLocalPhotos] = useState<{ id: string; url: string }[]>([]);
  const [photosToDelete, setPhotosToDelete] = useState<string[]>([]);
  
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxSlides, setLightboxSlides] = useState<{ src: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
        if (isLightboxOpen) {
            event.preventDefault();
            setIsLightboxOpen(false);
        }
    };
    if (isLightboxOpen) {
        window.history.pushState(null, '', window.location.href);
        window.addEventListener('popstate', handlePopState);
    }
    return () => {
        window.removeEventListener('popstate', handlePopState);
    };
  }, [isLightboxOpen]);


  useEffect(() => {
    if (open && reportToEdit) {
      setActualCash(reportToEdit.actualCash);
      setDiscrepancyReason(reportToEdit.discrepancyReason || '');
      setExistingPhotos(reportToEdit.discrepancyProofPhotos || []);
      setLocalPhotos([]);
      setPhotosToDelete([]);
    }
  }, [open, reportToEdit]);

  const handleSave = () => {
    if (!reportToEdit) return;

    const discrepancy = actualCash - reportToEdit.handoverData.expectedCash;

    if (discrepancy !== 0 && !discrepancyReason.trim()) {
      toast.error('Vui lòng nhập lý do chênh lệch.');
      return;
    }
    
    const dataToSave = {
        actualCash,
        discrepancy,
        discrepancyReason: discrepancyReason.trim() || null,
        newDiscrepancyPhotos: localPhotos.map(p => p.id),
        photosToDelete: photosToDelete,
    };

    onSave(dataToSave, reportToEdit.id);
  };
  
    const handleCapturePhotos = async (capturedPhotoIds: string[]) => {
        const newPhotoObjects: {id: string, url: string}[] = [];
        for (const photoId of capturedPhotoIds) {
            const photoBlob = await photoStore.getPhoto(photoId);
            if(photoBlob) {
                newPhotoObjects.push({ id: photoId, url: URL.createObjectURL(photoBlob) });
            }
        }
        setLocalPhotos(prev => [...prev, ...newPhotoObjects]);
        setIsCameraOpen(false);
    };

    const handleDeleteExistingPhoto = (url: string) => {
        setExistingPhotos(prev => prev.filter(p => p !== url));
        setPhotosToDelete(prev => [...prev, url]);
    };
    
    const handleDeleteLocalPhoto = async (id: string) => {
        setLocalPhotos(prev => {
            const photoToDelete = prev.find(p => p.id === id);
            if (photoToDelete) {
                URL.revokeObjectURL(photoToDelete.url);
            }
            return prev.filter(p => p.id !== id);
        });
        await photoStore.deletePhoto(id);
    };

    const openLightbox = (photos: string[], index: number = 0) => {
        setLightboxSlides(photos.map(p => ({ src: p })));
        setLightboxIndex(index);
        setIsLightboxOpen(true);
    };

  const allDiscrepancyPhotos = useMemo(() => [...existingPhotos, ...localPhotos.map(p => p.url)], [existingPhotos, localPhotos]);
  
  if (!reportToEdit) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Chi tiết Báo cáo Bàn giao</DialogTitle>
           <DialogDescription>
            Ngày: {format(parseISO(reportToEdit.date), 'dd/MM/yyyy')} | Lập bởi: {reportToEdit.createdBy.userName}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] -mx-6 px-6">
            <div className="space-y-4 py-4">
                <Card>
                    <CardHeader><CardTitle className="text-base">Tổng quan</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between"><span>Tiền mặt dự kiến:</span><span className="font-semibold">{reportToEdit.handoverData.expectedCash.toLocaleString('vi-VN')}đ</span></div>
                        <div className="flex justify-between"><span>Chênh lệch đã ghi nhận:</span><span className="font-semibold">{reportToEdit.discrepancy.toLocaleString('vi-VN')}đ</span></div>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader><CardTitle className="text-base">Ảnh phiếu bàn giao</CardTitle></CardHeader>
                    <CardContent>
                        {reportToEdit.handoverImageUrl ? (
                             <button onClick={() => openLightbox([reportToEdit.handoverImageUrl!])} className="relative w-full aspect-[3/4] rounded-md overflow-hidden">
                                <Image src={reportToEdit.handoverImageUrl} alt="Handover receipt" fill className="object-contain" />
                            </button>
                        ) : <p className="text-sm text-muted-foreground">Không có ảnh.</p>}
                    </CardContent>
                </Card>

                <Card className="border-primary">
                    <CardHeader><CardTitle className="text-base">Chỉnh sửa thông tin</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="actualCash">Số tiền mặt thực tế</Label>
                            <Input id="actualCash" type="number" value={actualCash} onChange={e => setActualCash(Number(e.target.value))} />
                        </div>
                        <div className="space-y-2">
                             <Label htmlFor="discrepancyReason">Lý do chênh lệch (nếu có)</Label>
                            <Textarea id="discrepancyReason" value={discrepancyReason} onChange={e => setDiscrepancyReason(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                             <Label>Bằng chứng chênh lệch</Label>
                             <div className="flex flex-col gap-2">
                                <Button variant="outline" onClick={() => setIsCameraOpen(true)}>
                                    <Camera className="mr-2 h-4 w-4"/> Chụp ảnh mới
                                </Button>
                                {allDiscrepancyPhotos.length > 0 ? (
                                    <div className="flex gap-2 flex-wrap">
                                        {existingPhotos.map((url, index) => (
                                            <div key={url} className="relative w-20 h-20 group">
                                                <button onClick={() => openLightbox(existingPhotos, index)} className="w-full h-full rounded-md overflow-hidden">
                                                    <Image src={url} alt="Bằng chứng" fill className="object-cover rounded-md" />
                                                </button>
                                                <Button variant="destructive" size="icon" className="absolute top-0.5 right-0.5 h-5 w-5" onClick={() => handleDeleteExistingPhoto(url)}><X className="h-3 w-3"/></Button>
                                            </div>
                                        ))}
                                         {localPhotos.map((photo, index) => (
                                            <div key={photo.id} className="relative w-20 h-20 group">
                                                 <button onClick={() => openLightbox(localPhotos.map(p => p.url), index)} className="w-full h-full rounded-md overflow-hidden">
                                                    <Image src={photo.url} alt="Bằng chứng mới" fill className="object-cover rounded-md" />
                                                </button>
                                                <Button variant="destructive" size="icon" className="absolute top-0.5 right-0.5 h-5 w-5" onClick={() => handleDeleteLocalPhoto(photo.id)}><X className="h-3 w-3"/></Button>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-xs text-muted-foreground">Chưa có ảnh bằng chứng nào.</p>}
                             </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={handleSave} disabled={isProcessing}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
     <CameraDialog
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onSubmit={handleCapturePhotos}
    />
     <Lightbox
        open={isLightboxOpen}
        close={() => setIsLightboxOpen(false)}
        slides={lightboxSlides}
        index={lightboxIndex}
    />
    </>
  );
}
