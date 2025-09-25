

'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { IncidentReport, IncidentCategory, AuthUser } from '@/lib/types';
import { Loader2, Camera, Trash2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { IncidentCategoryCombobox } from '@/components/incident-category-combobox';
import CameraDialog from '@/components/camera-dialog';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';


type IncidentReportDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: Omit<IncidentReport, 'id' | 'createdAt' | 'createdBy' | 'date'> & { photoIds: string[], photosToDelete: string[] }, id?: string) => void;
    isProcessing: boolean;
    categories: IncidentCategory[];
    onCategoriesChange: (newCategories: IncidentCategory[]) => void;
    canManageCategories: boolean;
    reporter: AuthUser;
    violationToEdit: IncidentReport | null; // Changed from 'violationToEdit' to be more specific
    isSelfConfession?: boolean;
};

export default function IncidentReportDialog({
    open,
    onOpenChange,
    onSave,
    isProcessing,
    categories,
    onCategoriesChange,
    canManageCategories,
    reporter,
    violationToEdit, // Changed
    isSelfConfession = false,
}: IncidentReportDialogProps) {
    const [content, setContent] = useState('');
    const [cost, setCost] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    
    // Photo state
    const [newPhotoIds, setNewPhotoIds] = useState<string[]>([]);
    const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
    const [photosToDelete, setPhotosToDelete] = useState<string[]>([]);

    useEffect(() => {
        if (open) {
            if (violationToEdit) {
                setContent(violationToEdit.content);
                setCost(violationToEdit.cost);
                setSelectedCategory(violationToEdit.category);
                setExistingPhotos(violationToEdit.photos || []);
            } else if (isSelfConfession) {
                const self = { uid: reporter.uid, displayName: reporter.displayName };
                setContent('');
                setCost(0);
                setSelectedCategory('');
                setExistingPhotos([]);
            } else {
                setContent('');
                setCost(0);
                setSelectedCategory('');
                setExistingPhotos([]);
            }
             // Always reset local photo state
            setNewPhotoIds([]);
            setPhotosToDelete([]);
        }
    }, [open, violationToEdit, isSelfConfession, reporter]);


    const handleSave = () => {
        if (!content) {
            toast.error('Vui lòng nhập nội dung sự cố.');
            return;
        }
        if (!selectedCategory) {
            toast.error('Vui lòng chọn loại sự cố.');
            return;
        }
        if (newPhotoIds.length === 0 && existingPhotos.length === 0) {
            toast.error('Vui lòng chụp ảnh bằng chứng cho sự cố.');
            return;
        }

        const users = isSelfConfession ? [{ id: reporter.uid, name: reporter.displayName }] : [];

        onSave({ 
            content, 
            cost, 
            category: selectedCategory, 
            photoIds: newPhotoIds,
            photosToDelete: photosToDelete,
            users, // Add users for self-confession case
        }, violationToEdit?.id);
    };
    
    const handleCapturePhotos = (capturedPhotoIds: string[]) => {
        setNewPhotoIds(prev => [...prev, ...capturedPhotoIds]);
        setIsCameraOpen(false);
    };
    
    const handleDeleteExistingPhoto = (url: string) => {
        setExistingPhotos(prev => prev.filter(p => p !== url));
        setPhotosToDelete(prev => [...prev, url]);
    };

    const dialogTitle = violationToEdit ? 'Chỉnh sửa Báo cáo Sự cố' : (isSelfConfession ? 'Tự ghi nhận sai sót' : 'Tạo Báo cáo Sự cố');

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md bg-white dark:bg-card">
                    <DialogHeader>
                        <DialogTitle>{dialogTitle}</DialogTitle>
                        <DialogDescription>
                            {isSelfConfession ? 'Mô tả lại sai sót của bạn một cách trung thực.' : 'Ghi nhận lại các vấn đề hoặc sai sót của nhân viên.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="category">Loại sự cố</Label>
                            <IncidentCategoryCombobox 
                                categories={categories}
                                value={selectedCategory}
                                onChange={setSelectedCategory}
                                onCategoriesChange={onCategoriesChange}
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
                                Nếu có chi phí, một phiếu chi tương ứng sẽ được tạo tự động với nội dung "Chi phí sự cố ([Tên loại sự cố])".
                            </p>
                        </div>
                         <div className="space-y-2">
                            <Label>Ảnh bằng chứng (bắt buộc)</Label>
                             <Button variant="outline" onClick={() => setIsCameraOpen(true)}>
                                <Camera className="mr-2 h-4 w-4"/> Chụp ảnh mới
                            </Button>
                             {(existingPhotos.length > 0 || newPhotoIds.length > 0) && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {existingPhotos.map((url, i) => (
                                         <div key={`existing-${i}`} className="relative h-20 w-20 rounded-md overflow-hidden">
                                             <Image src={url} alt={`Bằng chứng ${i + 1}`} fill className="object-cover" />
                                             <Button variant="destructive" size="icon" className="absolute top-0.5 right-0.5 h-5 w-5" onClick={() => handleDeleteExistingPhoto(url)}>
                                                 <X className="h-3 w-3" />
                                             </Button>
                                         </div>
                                    ))}
                                    {/* We can't show previews for new photos as we only have IDs, the parent component will show them after save */}
                                     {newPhotoIds.length > 0 && <p className="text-sm text-muted-foreground self-center">{newPhotoIds.length} ảnh mới đã được thêm.</p>}
                                </div>
                            )}
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
