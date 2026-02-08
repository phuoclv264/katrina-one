'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Star, ArrowUp, ArrowDown, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/combobox';
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
  const [instructionImages, setInstructionImages] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const instructionRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setText(initialData.text || '');
        setIsCritical(!!initialData.isCritical);
        setType(initialData.type || 'photo');
        setMinCompletions(initialData.minCompletions || 1);
        setInstructionText(initialData.instruction?.text || '');
        setInstructionImages(initialData.instruction?.images || []);
      } else {
        setText('');
        setIsCritical(false);
        setType('photo');
        setMinCompletions(1);
        setInstructionText('');
        setInstructionImages([]);
        if (fileRef.current) fileRef.current.value = '';
        if (instructionRef.current) instructionRef.current.style.height = '';
      }
    }
  }, [isOpen, initialData]);

  const adjustInstructionHeight = () => {
    const el = instructionRef.current;
    if (!el) return;
    el.style.height = 'auto';
    // add 2px to prevent scrollbar in some browsers
    el.style.height = `${el.scrollHeight + 2}px`;
  };

  // Ensure initial height follows existing content when dialog opens or content is set
  useEffect(() => {
    if (isOpen) {
      // run after render
      requestAnimationFrame(() => adjustInstructionHeight());
    }
  }, [isOpen]);

  // Adjust height whenever instruction text changes
  useEffect(() => {
    requestAnimationFrame(() => adjustInstructionHeight());
  }, [instructionText]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const arr = Array.from(files);
    arr.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setInstructionImages(prev => [...prev, result]);
      };
      reader.readAsDataURL(file);
    });
    // clear input to allow re-upload of same file
    e.currentTarget.value = '';
  };

  const removeImage = (index: number) => {
    setInstructionImages(prev => prev.filter((_, i) => i !== index));
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
            <Textarea
              placeholder="Ví dụ: Kiểm tra vệ sinh máy pha cà phê, Đổ rác khu vực pha chế..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[100px] rounded-2xl bg-muted/20 border-muted-foreground/10 focus:bg-background focus:ring-primary/20 transition-all resize-none text-base p-4"
              autoFocus
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

          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Hướng dẫn (tuỳ chọn)</Label>
            <Textarea
              ref={instructionRef}
              placeholder="Mô tả chi tiết hoặc lưu ý cho người thực hiện."
              value={instructionText}
              onChange={(e) => { setInstructionText(e.target.value); adjustInstructionHeight(); }}
              onInput={() => adjustInstructionHeight()}
              className="min-h-[80px] rounded-xl bg-muted/10 p-3 resize-none overflow-hidden"
            />
            <div className="flex items-center gap-3">
              <input ref={fileRef} id="instruction-images" type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Thêm ảnh hướng dẫn</Button>
              <div className="flex gap-2 flex-wrap">
                {instructionImages.map((img, idx) => (
                  <div key={idx} className="relative rounded-md overflow-hidden w-20 h-20 border">
                    <img src={img} className="object-cover w-full h-full" alt={`instruction-${idx}`} />
                    <button type="button" onClick={() => removeImage(idx)} className="absolute -top-1 -right-1 bg-white rounded-full p-1 text-xs shadow">✕</button>
                  </div>
                ))}
              </div>
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

        <DialogFooter>
          <DialogCancel onClick={onClose}>Hủy</DialogCancel>
          <DialogAction onClick={handleConfirm} disabled={!text.trim()}> {initialData ? 'Lưu thay đổi' : (<><Plus className="mr-2 h-4 w-4"/> Xác nhận</>)} </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
