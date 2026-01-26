'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter,
    DialogBody,
    DialogAction,
    DialogCancel 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { IncidentReport, IncidentCategory, AuthUser, ManagedUser, PaymentMethod, AssignedUser, SimpleUser } from '@/lib/types';
import { Loader2, Camera, Trash2, X, AlertTriangle, User, ListFilter, ClipboardEdit, Wallet, ImageIcon, Info, Plus, ChevronRight, Maximize2 } from 'lucide-react';
import { toast } from '@/components/ui/pro-toast';
import { Combobox } from '@/components/combobox';
import CameraDialog from '@/components/camera-dialog';
import { v4 as uuidv4 } from 'uuid';
import Image from '@/components/ui/image';
import { photoStore } from '@/lib/photo-store';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useLightbox } from '@/contexts/lightbox-context';


type IncidentReportDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: Omit<IncidentReport, 'id' | 'createdAt' | 'createdBy' | 'date'> & { photoIds: string[], photosToDelete: string[] }, id?: string) => void | Promise<void>;
    isProcessing: boolean;
    categories: IncidentCategory[];
    canManageCategories: boolean;
    reporter: SimpleUser | null;
    incidentToEdit: IncidentReport | null;
    onCategoriesChange: (newCategories: IncidentCategory[]) => void;
    parentDialogTag: string;
};

export default function IncidentReportDialog({
    open,
    onOpenChange,
    onSave,
    isProcessing,
    categories,
    canManageCategories,
    reporter,
    incidentToEdit,
    onCategoriesChange,
    parentDialogTag
}: IncidentReportDialogProps) {
    const [content, setContent] = useState('');
    const [cost, setCost] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    // Photo state
    const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
    const [localPhotos, setLocalPhotos] = useState<{ id: string, url: string }[]>([]);
    const [photosToDelete, setPhotosToDelete] = useState<string[]>([]);

    const { openLightbox } = useLightbox();

    const reporterName = useMemo(() => {
        if (incidentToEdit) {
            return incidentToEdit.createdBy.userName;
        }
        return reporter?.userName || '...'; // Fallback for new incidents
    }, [reporter, incidentToEdit]);

    const categoryOptions = useMemo(() =>
        (categories || []).map(c => ({ value: c.name, label: c.name })),
        [categories]);

    useEffect(() => {
        if (open) {
            if (incidentToEdit) {
                setContent(incidentToEdit.content);
                setCost(incidentToEdit.cost);
                setSelectedCategory(incidentToEdit.category);
                setExistingPhotos(incidentToEdit.photos || []);
                setPaymentMethod(incidentToEdit.paymentMethod || 'cash');
            } else {
                setContent('');
                setCost(0);
                setSelectedCategory('');
                setExistingPhotos([]);
                setPaymentMethod('cash');
            }
            // Always reset local photo state
            setLocalPhotos([]);
            setPhotosToDelete([]);
        } else {
            // Cleanup local photo object URLs when dialog is fully closed
            localPhotos.forEach(p => URL.revokeObjectURL(p.url));
        }
    }, [open, incidentToEdit, reporter]);


    const handleCreateCategory = (name: string) => {
        if (!canManageCategories) return;
        const newCategory: IncidentCategory = { id: `cat-${Date.now()}`, name: name };
        const newCategories = [...(categories || []), newCategory].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        onCategoriesChange(newCategories);
        setSelectedCategory(name);
    }

    const handleDeleteCategory = (name: string) => {
        if (!canManageCategories) return;
        const categoryToDelete = (categories || []).find(c => c.name === name);
        if (!categoryToDelete) return;
        const newCategories = (categories || []).filter(c => c.name !== name);
        onCategoriesChange(newCategories);
        if (selectedCategory === name) {
            setSelectedCategory('');
        }
    }

    const handleSave = () => {
        if (!reporter) {
            toast.error("Không tìm thấy thông tin người báo cáo.");
            return;
        }
        if (!content) {
            toast.error('Vui lòng nhập nội dung sự cố.');
            return;
        }
        if (!selectedCategory) {
            toast.error('Vui lòng chọn loại sự cố.');
            return;
        }

        const totalPhotos = localPhotos.length + existingPhotos.length - photosToDelete.length;
        if (totalPhotos === 0) {
            toast.error('Vui lòng chụp ảnh bằng chứng cho sự cố.');
            return;
        }

        const data = {
            content,
            cost,
            paymentMethod: cost > 0 ? paymentMethod : undefined,
            category: selectedCategory,
            photos: existingPhotos,
            photoIds: localPhotos.map(p => p.id),
            photosToUpload: localPhotos.map(p => p.id),
            photosToDelete: photosToDelete,
        };

        onSave(data, incidentToEdit?.id);
    };

    const handleCapturePhotos = async (media: { id: string; type: 'photo' | 'video' }[]) => {
        setIsCameraOpen(false);
        const newPhotoObjects: { id: string, url: string }[] = [];
        // Filter for photos only
        const photos = media.filter(m => m.type === 'photo');
        for (const { id: photoId } of photos) {
            const photoBlob = await photoStore.getPhoto(photoId);
            if (photoBlob) {
                newPhotoObjects.push({ id: photoId, url: URL.createObjectURL(photoBlob) });
            }
        }
        setLocalPhotos(prev => [...prev, ...newPhotoObjects]);
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

    const allPhotos = useMemo(() => {
        return [
            ...existingPhotos.map(url => ({ id: url, url })),
            ...localPhotos
        ];
    }, [existingPhotos, localPhotos]);

    const dialogTitle = incidentToEdit ? 'Chỉnh sửa Báo cáo Sự cố' : 'Tạo Báo cáo Sự cố';

    return (
        <>
            <Dialog open={open} onOpenChange={(open) => !open && onOpenChange(false)} dialogTag="incident-report-dialog" parentDialogTag={parentDialogTag}>
                <DialogContent className="max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
                    <DialogHeader variant="destructive" iconkey="alert">
                        <DialogTitle>{dialogTitle}</DialogTitle>
                        <DialogDescription>
                            Ghi nhận lại các sự cố như hư hỏng thiết bị, làm vỡ tài sản...
                        </DialogDescription>
                    </DialogHeader>

                    <DialogBody>
                        <div className="space-y-6">
                            {/* Information Card */}
                            <Card className="rounded-[2rem] border-none shadow-sm bg-muted/20">
                                <CardContent className="p-5 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-background rounded-xl">
                                                <User className="h-4 w-4 text-primary" />
                                            </div>
                                            <span className="text-sm font-bold text-muted-foreground uppercase tracking-tight">Người báo cáo</span>
                                        </div>
                                        <Badge variant="outline" className="bg-background/80 border-primary/20 text-primary font-bold px-3 py-1 rounded-lg">
                                            {reporterName}
                                        </Badge>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="p-2 bg-background rounded-xl">
                                                <ListFilter className="h-4 w-4 text-primary" />
                                            </div>
                                            <Label htmlFor="category" className="text-sm font-bold text-muted-foreground uppercase tracking-tight">
                                                Loat sự cố
                                            </Label>
                                        </div>
                                        <Combobox
                                            options={categoryOptions}
                                            value={selectedCategory}
                                            onChange={setSelectedCategory}
                                            onCreate={canManageCategories ? handleCreateCategory : undefined}
                                            onDelete={canManageCategories ? handleDeleteCategory : undefined}
                                            confirmDelete
                                            deleteMessage="Bạn có chắc chắn muốn xóa loại sự cố này không?"
                                            placeholder="Chọn loại sự cố..."
                                            searchPlaceholder="Tìm loại sự cố..."
                                            emptyText="Không tìm thấy loại sự cố."
                                            className="w-full"
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Content & Cost Card */}
                            <Card className="rounded-[2rem] border-none shadow-sm bg-background">
                                <CardContent className="p-5 space-y-5">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="p-2 bg-primary/5 rounded-xl">
                                                <ClipboardEdit className="h-4 w-4 text-primary" />
                                            </div>
                                            <Label htmlFor="content" className="text-sm font-bold uppercase tracking-tight text-foreground/70">
                                                Nội dung chi tiết
                                            </Label>
                                        </div>
                                        <Textarea 
                                            id="content" 
                                            value={content} 
                                            onChange={(e) => setContent(e.target.value)} 
                                            className="min-h-[100px] rounded-2xl bg-muted/30 border-2 border-transparent focus:border-primary/20 focus:bg-background transition-all resize-none text-sm font-medium" 
                                            placeholder="Mô tả chi tiết sự việc... (VD: Làm vỡ ly thuỷ tinh khi đang dọn bàn số 5)" 
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 bg-emerald-50 rounded-xl">
                                                    <Wallet className="h-4 w-4 text-emerald-600" />
                                                </div>
                                                <Label htmlFor="cost" className="text-sm font-bold uppercase tracking-tight text-foreground/70">Chi phí (VND)</Label>
                                            </div>
                                            <Input
                                                id="cost"
                                                type="number"
                                                value={cost}
                                                onChange={e => setCost(Number(e.target.value))}
                                                placeholder="0"
                                                onFocus={(e) => e.target.select()}
                                                className="w-32 text-right font-bold text-emerald-700 bg-emerald-50 border-emerald-100 rounded-xl focus:ring-emerald-500"
                                            />
                                        </div>
                                        
                                        {cost > 0 && (
                                            <div className="bg-muted/30 rounded-[1.5rem] p-4 space-y-3">
                                                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Hình thức chi trả</span>
                                                <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="flex flex-col gap-2">
                                                    {[
                                                        { id: 'cash', label: 'Tiền mặt', desc: 'Chi từ quỹ tiền mặt tại quầy' },
                                                        { id: 'bank_transfer', label: 'Chuyển khoản', desc: 'Chủ nhà hàng chuyển khoản' },
                                                        { id: 'intangible_cost', label: 'Chi phí vô hình', desc: 'Không phát sinh dòng tiền thực tế' }
                                                    ].map((item) => (
                                                        <div key={item.id} className={cn(
                                                            "flex items-center space-x-3 p-3 rounded-xl border-2 transition-all cursor-pointer",
                                                            paymentMethod === item.id ? "bg-background border-primary shadow-sm" : "bg-transparent border-transparent hover:bg-background/50"
                                                        )} onClick={() => setPaymentMethod(item.id as PaymentMethod)}>
                                                            <RadioGroupItem value={item.id} id={`pm-${item.id}`} />
                                                            <div className="flex flex-col">
                                                                <Label htmlFor={`pm-${item.id}`} className="font-bold cursor-pointer">{item.label}</Label>
                                                                <span className="text-[10px] text-muted-foreground font-medium">{item.desc}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </RadioGroup>
                                                <div className="bg-amber-50 rounded-xl p-2.5 border border-amber-100 flex items-start gap-2">
                                                    <Info className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                                                    <p className="text-[10px] leading-tight font-medium text-amber-800">
                                                        Một phiếu chi tương ứng sẽ được tự động tạo trong báo cáo tài chính của ca này.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Evidence Card */}
                            <Card className="rounded-[2rem] border-none shadow-sm bg-muted/10">
                                <CardHeader className="pb-2 pt-5">
                                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                        <span className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Bằng chứng hình ảnh</span>
                                        <span className="text-[10px] px-2 py-0.5 bg-destructive/10 text-destructive rounded-full">Bắt buộc</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-5 space-y-4">
                                    <Button 
                                        variant="default" 
                                        onClick={() => setIsCameraOpen(true)} 
                                        className="w-full rounded-2xl h-12 font-bold shadow-sm"
                                    >
                                        <Camera className="mr-2 h-5 w-5" /> Chụp ảnh bằng chứng
                                    </Button>

                                    {allPhotos.length > 0 ? (
                                        <div className="grid grid-cols-4 gap-2">
                                            {allPhotos.map((photo, i) => (
                                                <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden group border bg-background">
                                                    <button onClick={() => openLightbox(allPhotos.map(p => ({ src: p.url })), i)} className="w-full h-full">
                                                        <Image src={photo.url} alt={`Bằng chứng ${i + 1}`} fill className="object-cover transition-transform group-hover:scale-110" />
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                            <Maximize2 className="h-4 w-4 text-white" />
                                                        </div>
                                                    </button>
                                                    <button
                                                        className="absolute top-1 right-1 h-6 w-6 rounded-lg bg-destructive/90 text-white flex items-center justify-center p-0 shadow-lg active:scale-95 transition-transform"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const isLocal = localPhotos.some(p => p.id === photo.id);
                                                            if (isLocal) {
                                                                handleDeleteLocalPhoto(photo.id);
                                                            } else {
                                                                handleDeleteExistingPhoto(photo.url);
                                                            }
                                                        }}
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                            <button 
                                                onClick={() => setIsCameraOpen(true)}
                                                className="aspect-square rounded-xl border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center gap-1 hover:bg-muted/50 transition-colors"
                                            >
                                                <Plus className="h-5 w-5 text-muted-foreground/40" />
                                                <span className="text-[8px] font-bold text-muted-foreground/40 uppercase">Thêm</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="py-6 flex flex-col items-center justify-center bg-muted/30 rounded-[1.5rem] border-2 border-dashed border-muted-foreground/10 text-muted-foreground">
                                            <ImageIcon className="h-8 w-8 opacity-20 mb-2" />
                                            <p className="text-xs font-medium opacity-50 uppercase tracking-wider">Chưa có hình ảnh</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </DialogBody>

                    <DialogFooter variant="muted">
                        <DialogCancel>Hủy</DialogCancel>
                        <DialogAction 
                            onClick={handleSave} 
                            isLoading={isProcessing}
                            variant="destructive"
                        >
                            {incidentToEdit ? 'Lưu thay đổi' : 'Gửi báo cáo'}
                        </DialogAction>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <CameraDialog
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onSubmit={handleCapturePhotos}
                captureMode="photo"
                parentDialogTag="incident-report-dialog"
            />
        </>
    );
}
