
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { IncidentReport, IncidentCategory } from '@/lib/types';
import { Loader2, Camera } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ViolationCategoryCombobox } from '@/components/violation-category-combobox'; // Reusing this for category selection
import CameraDialog from '@/components/camera-dialog';
import { v4 as uuidv4 } from 'uuid';


type IncidentReportDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: Omit<IncidentReport, 'id' | 'date' | 'createdAt' | 'createdBy' | 'photos'> & { photoIds: string[] }) => void;
    isProcessing: boolean;
    categories: IncidentCategory[];
    onCategoriesChange: (newCategories: IncidentCategory[]) => void;
    canManageCategories: boolean;
};

export default function IncidentReportDialog({
    open,
    onOpenChange,
    onSave,
    isProcessing,
    categories,
    onCategoriesChange,
    canManageCategories,
}: IncidentReportDialogProps) {
    const [content, setContent] = useState('');
    const [cost, setCost] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [photoIds, setPhotoIds] = useState<string[]>([]);
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    useEffect(() => {
        if (open) {
            setContent('');
            setCost(0);
            setSelectedCategory('');
            setPhotoIds([]);
        }
    }, [open]);

    const handleSave = () => {
        if (!content) {
            toast.error('Vui lòng nhập nội dung sự cố.');
            return;
        }
        if (!selectedCategory) {
            toast.error('Vui lòng chọn loại sự cố.');
            return;
        }
        if (photoIds.length === 0) {
            toast.error('Vui lòng chụp ảnh bằng chứng cho sự cố.');
            return;
        }

        onSave({ content, cost, category: selectedCategory, photoIds });
    };
    
    const handleCapturePhotos = (capturedPhotoIds: string[]) => {
        setPhotoIds(prev => [...prev, ...capturedPhotoIds]);
        setIsCameraOpen(false);
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md bg-white">
                    <DialogHeader>
                        <DialogTitle>Tạo Báo cáo Sự cố</DialogTitle>
                        <DialogDescription>Ghi nhận sự cố phát sinh trong ca làm việc.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="category">Loại sự cố</Label>
                            <ViolationCategoryCombobox 
                                categories={categories.map(c => c.name)}
                                value={selectedCategory}
                                onChange={setSelectedCategory}
                                onCategoriesChange={(newCatNames) => onCategoriesChange(newCatNames.map(name => ({ id: uuidv4(), name })))}
                                canManage={canManageCategories}
                                placeholder="Chọn loại sự cố..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="content">Nội dung sự cố</Label>
                            <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="VD: Làm vỡ ly thuỷ tinh Ocean..." />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cost">Chi phí phát sinh (nếu có)</Label>
                            <Input id="cost" type="number" value={cost} onChange={e => setCost(Number(e.target.value))} placeholder="0" />
                            <p className="text-xs text-muted-foreground">
                                Nếu có chi phí, một phiếu chi tương ứng sẽ được tạo tự động.
                            </p>
                        </div>
                         <div className="space-y-2">
                            <Label>Ảnh bằng chứng (bắt buộc)</Label>
                             <Button variant="outline" onClick={() => setIsCameraOpen(true)}>
                                <Camera className="mr-2 h-4 w-4"/> Chụp ảnh
                            </Button>
                            {photoIds.length > 0 && <p className="text-sm text-muted-foreground mt-2">{photoIds.length} ảnh đã được chọn.</p>}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
                        <Button onClick={handleSave} disabled={isProcessing}>
                            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Lưu Báo cáo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <CameraDialog
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onSubmit={handleCapturePhotos}
            />
        </>
    );
}
