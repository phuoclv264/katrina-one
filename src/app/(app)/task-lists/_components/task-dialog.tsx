'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Star, ArrowUp, ArrowDown, Image as ImageIcon, Trash2, Loader2, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task } from '@/lib/types';
import CameraDialog from '@/components/camera-dialog';
import { photoStore } from '@/lib/photo-store';
import { useLightbox } from '@/contexts/lightbox-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/combobox';
import { RichTextEditor } from '@/components/ui/rich-text-editor';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogAction,
  DialogCancel,
} from '@/components/ui/dialog';

interface TaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (taskData: Omit<Task, 'id'>) => void;
  shiftName?: string;
  sectionTitle?: string;
  initialData?: Omit<Task, 'id'> | null;
  parentDialogTag?: string;
}

export function TaskDialog({ isOpen, onClose, onConfirm, shiftName = '', sectionTitle = '', initialData = null, parentDialogTag = 'root' }: TaskDialogProps) {
  const [text, setText] = useState('');
  const [isCritical, setIsCritical] = useState(false);
  const [type, setType] = useState<Task['type']>('photo');
  const [minCompletions, setMinCompletions] = useState(1);

  // instruction fields
  const [instructionText, setInstructionText] = useState('');
  const [instructionImages, setInstructionImages] = useState<{ url: string; caption: string }[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { openLightbox } = useLightbox();

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1000;
          const MAX_HEIGHT = 1000;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject('No ctx');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Track previous open state so we only initialize when dialog actually opens,
  // avoiding mid-dialog resets caused by unrelated re-renders or nested dialogs.
  const wasOpenRef = useRef(false);

  useEffect(() => {
    // Only initialize/reset when dialog transitions from closed -> open
    if (isOpen && !wasOpenRef.current) {
      if (initialData) {
        setText(initialData.text || '');
        setIsCritical(!!initialData.isCritical);
        setType(initialData.type || 'photo');
        setMinCompletions(initialData.minCompletions || 1);
        setInstructionText(initialData.instruction?.text || '');
        setInstructionImages(
          (initialData.instruction?.images || []).map((img: any) => 
            typeof img === 'string' ? { url: img, caption: '' } : { url: img.url, caption: img.caption || '' }
          )
        );
      } else {
        setText('');
        setIsCritical(false);
        setType('photo');
        setMinCompletions(1);
        setInstructionText('');
        setInstructionImages(prev => {
          prev.forEach(img => {
            if (img.url && img.url.startsWith('blob:')) URL.revokeObjectURL(img.url);
          });
          return [];
        });
        if (fileRef.current) fileRef.current.value = '';
      }
    }

    wasOpenRef.current = isOpen;
  }, [isOpen, initialData]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsCompressing(true);
    const arr = Array.from(files);
    
    try {
      const compressedResults = await Promise.all(
        arr.map(file => compressImage(file))
      );
      setInstructionImages(prev => [
        ...prev, 
        ...compressedResults.map(url => ({ url, caption: '' }))
      ]);
    } catch (error) {
      console.error('Error compressing images:', error);
    } finally {
      setIsCompressing(false);
      // clear input to allow re-upload of same file
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setInstructionImages(prev => {
      const img = prev[index];
      if (img.url && img.url.startsWith('blob:')) {
        URL.revokeObjectURL(img.url);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateImageCaption = (index: number, caption: string) => {
    setInstructionImages(prev => prev.map((img, i) => i === index ? { ...img, caption } : img));
  };

  // Camera dialog state: allow taking photos to add as instruction images
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const handleCameraSubmit = async (media: { id: string; type: 'photo' | 'video' }[]) => {
    // media contains local photo IDs stored in photoStore
    if (!media || media.length === 0) {
      setIsCameraOpen(false);
      return;
    }

    try {
      const photoIds = media.filter(m => m.type === 'photo').map(m => m.id);
      const blobs = await Promise.all(photoIds.map(id => photoStore.getPhoto(id)));
      const urls = blobs
        .map((blob) => (blob ? URL.createObjectURL(blob) : null))
        .filter(Boolean) as string[];

      setInstructionImages(prev => [...prev, ...urls.map(url => ({ url, caption: '' }))]);
    } catch (error) {
      console.error('Error processing camera images:', error);
    } finally {
      setIsCameraOpen(false);
    }
  };

  const handleConfirm = () => {
    if (!text.trim()) return;
    
    onConfirm({
      text: text.trim(),
      isCritical,
      type,
      minCompletions,
      instruction: {
        text: instructionText.trim() || undefined,
        images: instructionImages.length ? instructionImages : undefined,
      }
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} dialogTag="task-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-xl">
        <DialogHeader variant="premium" icon={<Plus className="h-6 w-6" />}>
          <DialogTitle>{initialData ? 'Chỉnh sửa công việc' : 'Thêm công việc mới'}</DialogTitle>
          <DialogDescription>
            {initialData ? (
              <>Cập nhật công việc trong mục <span className="font-bold">"{sectionTitle}"</span> của <span className="font-bold">Ca {shiftName}</span>.</>
            ) : (
              <>Tạo nhiệm vụ cho <span className="font-bold">Ca {shiftName}</span> trong mục <span className="font-bold">{sectionTitle}</span>.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6 py-6">
          <div className="space-y-3">
            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground/70 ml-1">Nội dung công việc</Label>
            <RichTextEditor
              content={text}
              onChange={setText}
              placeholder="Ví dụ: Kiểm tra vệ sinh máy pha cà phê, Đổ rác khu vực pha chế..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Loại yêu cầu</Label>
              <Combobox
                value={type}
                onChange={(value) => setType(value as Task['type'])}
                options={[
                  { value: 'photo', label: 'Cần chụp ảnh' },
                  { value: 'boolean', label: 'Đánh dấu' },
                  { value: 'opinion', label: 'Ghi chú' },
                ]}
                className="w-full h-12 rounded-xl bg-muted/20 border-transparent focus:bg-background transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Lặp lại tối thiểu</Label>
              <div className="flex items-center gap-3 bg-muted/20 p-1.5 rounded-2xl border border-primary/10 shadow-sm h-12">
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setMinCompletions(Math.max(1, minCompletions - 1))} type="button"><ArrowDown className="h-4 w-4" /></Button>
                <div className="flex-1 text-center">
                  <span className="font-black text-lg leading-none">{minCompletions}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setMinCompletions(minCompletions + 1)} type="button"><ArrowUp className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cẩm nang chuẩn (Theo dòng)</Label>
            </div>
            
            <RichTextEditor
              content={instructionText}
              onChange={setInstructionText}
              placeholder="Mô tả chi tiết hoặc lưu ý cho người thực hiện..."
              className="bg-indigo-50/10"
            />

            <div className="space-y-2">
              <input ref={fileRef} id="instruction-images" type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />

              {/* Always-visible toolbar to add more images */}
              <div className="flex items-center gap-2.5 mb-4 p-1.5 rounded-[22px] bg-muted/10 border border-primary/5">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-[16px] bg-white shadow-sm border border-zinc-100 hover:bg-indigo-50/50 hover:border-indigo-100 hover:text-indigo-600 transition-all group active:scale-[0.98]"
                  type="button"
                >
                  <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-500 group-hover:bg-indigo-100 transition-colors">
                    <ImageIcon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider">Thư viện</span>
                </button>

                <button
                  onClick={() => setIsCameraOpen(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-[16px] bg-white shadow-sm border border-zinc-100 hover:bg-indigo-50/50 hover:border-indigo-100 hover:text-indigo-600 transition-all group active:scale-[0.98]"
                  type="button"
                >
                  <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-500 group-hover:bg-indigo-100 transition-colors">
                    <Camera className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider">Máy ảnh</span>
                </button>
              </div>

              {instructionImages.length > 0 && (
                <div className="grid grid-cols-1 gap-2.5">
                  {instructionImages.map((img, idx) => (
                    <div key={idx} className="flex flex-col gap-2 p-3 bg-muted/20 rounded-2xl border border-transparent hover:border-indigo-100 transition-all group">
                      <div className="flex items-center gap-3">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => openLightbox(instructionImages.map(i => ({ src: i.url, title: i.caption })), idx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openLightbox(instructionImages.map(i => ({ src: i.url, title: i.caption })), idx);
                            }
                          }}
                          className="relative h-14 w-20 flex-shrink-0 rounded-xl overflow-hidden shadow-sm border border-white/50 bg-white cursor-zoom-in"
                        >
                          <img src={img.url} className="object-cover w-full h-full" alt={`instruction-${idx}`} />
                          <div className="absolute inset-0 bg-black/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <ImageIcon className="h-3 w-3 text-white shadow-sm" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Ảnh minh họa {idx + 1}</div>
                          <div className="text-[9px] text-indigo-500/60 font-bold uppercase tracking-tighter">
                            {img.url.startsWith('data:') || img.url.startsWith('blob:') ? 'Chờ tải lên...' : 'Đã tải lên hệ thống'}
                          </div>
                        </div>
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); removeImage(idx); }} 
                          className="p-2.5 rounded-xl text-muted-foreground/30 hover:text-red-500 hover:bg-red-50 active:scale-90 transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="px-1">
                        <Input 
                          placeholder="Thêm chú thích cho ảnh này..." 
                          value={img.caption} 
                          onChange={(e) => updateImageCaption(idx, e.target.value)}
                          className="h-8 text-[11px] bg-white/50 border-transparent focus:bg-white transition-all rounded-lg"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isCompressing && (
                <div className="w-full py-8 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
                  <span className="text-[10px] font-bold text-indigo-600 animate-pulse uppercase tracking-widest">Đang tối ưu dung lượng ảnh...</span>
                </div>
              )}
            </div>
          </div>

          <div className={cn("flex items-center justify-between p-4 rounded-lg border transition-all duration-300 cursor-pointer", isCritical ? "bg-amber-50/50 border-amber-200" : "bg-muted/10 border-transparent")} onClick={() => setIsCritical(!isCritical)}>
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", isCritical ? "bg-amber-100 text-amber-500" : "bg-muted/30 text-muted-foreground/40")}>
                <Star className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-sm">Công việc quan trọng</div>
                <div className="text-[10px] opacity-60 uppercase tracking-wider">Đánh dấu là nhiệm vụ ưu tiên</div>
              </div>
            </div>
            <Checkbox checked={isCritical} onCheckedChange={(c) => setIsCritical(c as boolean)} className="h-6 w-6" />
          </div>
        </DialogBody>

        <CameraDialog
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
          onSubmit={handleCameraSubmit}
          parentDialogTag={parentDialogTag}
          singlePhotoMode={false}
          captureMode="photo"
          isHD={true}
        />

        <DialogFooter>
          <DialogCancel onClick={onClose}>Hủy</DialogCancel>
          <DialogAction onClick={handleConfirm} disabled={!text.trim()}> 
            {initialData ? 'Lưu thay đổi' : (<><Plus className="mr-2 h-4 w-4"/> Xác nhận</>)}
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
