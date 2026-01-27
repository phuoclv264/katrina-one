
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth, type AuthUser } from '@/hooks/use-auth';
import { toast } from '@/components/ui/pro-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogBody, DialogAction, DialogCancel } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Camera, Loader2, Upload, AlertTriangle, CheckCircle } from 'lucide-react';
import type { ManagedUser, Violation, ViolationCategory } from '@/lib/types';
import CameraDialog from '@/components/camera-dialog';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/combobox';

import { Input } from '@/components/ui/input';
import { photoStore } from '@/lib/photo-store';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';

export function ViolationDialog({
  parentDialogTag,
  open,
  onOpenChange,
  onSave,
  users,
  isProcessing,
  violationToEdit,
  reporter,
  isSelfConfession = false,
  categories,
  onCategoriesChange,
  canManage,
}: {
  parentDialogTag: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any, id?: string) => void;
  users: ManagedUser[];
  isProcessing: boolean;
  violationToEdit: Violation | null;
  reporter: AuthUser;
  isSelfConfession?: boolean;
  categories: ViolationCategory[];
  onCategoriesChange: (newCategories: ViolationCategory[]) => void;
  canManage: boolean;
}) {
  const [content, setContent] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<ManagedUser[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [unitCount, setUnitCount] = useState<number | undefined>(undefined);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const selectedCategory = useMemo(() => {
    return categories.find(c => c.id === selectedCategoryId);
  }, [selectedCategoryId, categories]);

  useEffect(() => {
    if (open) {
      if (violationToEdit) {
        setContent(violationToEdit.content);
        const initialUsers = (violationToEdit.users && Array.isArray(violationToEdit.users))
          ? users.filter(u => violationToEdit.users.some(vu => vu.id === u.uid))
          : [];
        setSelectedUsers(initialUsers);
        setSelectedCategoryId(violationToEdit.categoryId);
        setUnitCount(violationToEdit.unitCount);
        setPhotoIds([]);
      } else if (isSelfConfession && reporter) {
        const self = users.find(u => u.uid === reporter.uid);
        setContent('');
        setSelectedUsers(self ? [self] : []);
        setSelectedCategoryId('');
        setUnitCount(undefined);
        setPhotoIds([]);
      } else {
        // Reset for new violation by manager
        setContent('');
        setSelectedUsers([]);
        setSelectedCategoryId('');
        setUnitCount(undefined);
        setPhotoIds([]);
      }
    }
  }, [open, violationToEdit, isSelfConfession, reporter, users]);

  const handleSave = () => {
    if (!reporter) {
      toast.error("Không tìm thấy thông tin người báo cáo.");
      return;
    }
    // Description is optional now — only require selected users and a category
    if (selectedUsers.length === 0 || !selectedCategoryId) {
      toast.error('Vui lòng chọn nhân viên và loại vi phạm.');
      return;
    }

    // Re-fetch selectedCategory inside the handler to ensure it's the latest
    const finalSelectedCategory = categories.find(c => c.id === selectedCategoryId);

    if (!finalSelectedCategory) {
      toast.error("Loại vi phạm đã chọn không còn tồn tại. Vui lòng chọn một loại khác.");
      return;
    }

    let calculatedCost = 0;
    if (finalSelectedCategory.calculationType === 'perUnit') {
      if (!unitCount || unitCount <= 0) {
        toast.error(`Vui lòng nhập số ${finalSelectedCategory.unitLabel || 'đơn vị'}.`);
        return;
      }
      calculatedCost = (finalSelectedCategory.finePerUnit || 0) * (unitCount || 0);
    } else {
      calculatedCost = finalSelectedCategory.fineAmount || 0;
    }

    const data = {
      content: content,
      users: selectedUsers.map(u => ({ id: u.uid, name: u.displayName })),
      reporterId: reporter.uid,
      reporterName: reporter.displayName,
      photosToUpload: photoIds,

      // Snapshot of category details
      categoryId: finalSelectedCategory.id,
      categoryName: finalSelectedCategory.name,
      severity: finalSelectedCategory.severity,
      cost: calculatedCost,
      unitCount: finalSelectedCategory.calculationType === 'perUnit' ? (unitCount || 0) : 0,
    };

    onSave(data, violationToEdit?.id);
  };

  const handleCapturePhotos = (media: { id: string; type: 'photo' | 'video' }[]) => {
    const photoIds = media.filter(m => m.type === 'photo').map(m => m.id);
    setPhotoIds(prev => [...prev, ...photoIds]);
    setIsCameraOpen(false);
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      const newPhotoIds = await Promise.all(Array.from(files).map(async (file) => {
        const photoId = uuidv4();
        await photoStore.addPhoto(photoId, file);
        return photoId;
      }));
      setPhotoIds(prev => [...prev, ...newPhotoIds]);
    } catch (error) {
      toast.error("Lỗi khi thêm ảnh.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const dialogTitle = violationToEdit ? 'Chỉnh sửa Vi phạm' : (isSelfConfession ? 'Tự ghi nhận sai sót' : 'Thêm Vi phạm mới');

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} dialogTag="violation-dialog" parentDialogTag={parentDialogTag}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader 
            variant="premium" 
            iconkey="alert"
          >
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {isSelfConfession ? 'Khuyến khích trung thực trong công việc' : 'Hệ thống ghi nhận và tự động tính toán mức phạt quy định'}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="p-0">
            <div className="p-6 space-y-6">
              <div className="space-y-5">
                {/* Employee Selection Section */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nhân viên vi phạm</Label>
                  {!isSelfConfession ? (
                    <Combobox
                      options={users.map(u => ({ value: u.uid, label: u.displayName }))}
                      value={selectedUsers.map(u => u.uid)}
                      onChange={(vals) => {
                        const selectedIds = vals as string[];
                        const selected = users.filter(u => selectedIds.includes(u.uid));
                        setSelectedUsers(selected);
                      }}
                      multiple={true}
                      placeholder="Chọn nhân viên..."
                      searchPlaceholder="Tìm nhân viên..."
                      emptyText="Không tìm thấy nhân viên."
                    />
                  ) : (
                    <div className="flex items-center gap-3 bg-primary/5 p-3.5 rounded-2xl border border-primary/10 transition-colors">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-black text-primary border border-primary/20 shrink-0">
                        {reporter.displayName?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-foreground text-sm truncate">{reporter.displayName}</span>
                        <span className="text-[10px] font-bold text-primary/70 uppercase tracking-widest">Tự ghi nhận</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Violation Category Section */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Danh mục sai phạm</Label>
                  <Combobox
                    options={categories.map(c => ({ value: c.name, label: c.name }))}
                    value={selectedCategory?.name || ''}
                    onChange={(val) => {
                      const newCat = categories.find(c => c.name === val);
                      setSelectedCategoryId(newCat ? newCat.id : '');
                    }}
                    placeholder="Chọn loại vi phạm..."
                    searchPlaceholder="Tìm loại vi phạm..."
                    emptyText="Không tìm thấy loại vi phạm."
                    className="rounded-xl bg-muted/20 border-muted-foreground/10"
                    onCreate={canManage ? (val) => {
                      const newCategory: ViolationCategory = {
                        id: `cat-${Date.now()}`, name: val, severity: 'low', fineAmount: 0,
                        calculationType: "fixed",
                        finePerUnit: null,
                        unitLabel: null
                      };
                      const newCategories = [...categories, newCategory].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
                      onCategoriesChange(newCategories);
                      setSelectedCategoryId(newCategory.id);
                    } : undefined}
                    onDelete={canManage ? (val) => {
                      const categoryToDelete = categories.find(c => c.name === val);
                      if (!categoryToDelete) return;
                      const newCategories = categories.filter(c => c.id !== categoryToDelete.id);
                      onCategoriesChange(newCategories);
                      if (selectedCategory?.id === categoryToDelete.id) {
                        setSelectedCategoryId('');
                      }
                    } : undefined}
                    confirmDelete={true}
                    deleteMessage="Bạn có chắc chắn muốn xóa loại vi phạm này không?"
                  />
                  
                  {selectedCategory && (
                    <div className="flex items-center gap-2 px-1 animate-in fade-in slide-in-from-left-2 duration-300">
                      <Badge className={cn(
                        "text-[9px] font-black h-4 px-1.5 rounded border-transparent tracking-wide pointer-events-none whitespace-nowrap",
                        selectedCategory.severity === 'high' ? 'bg-red-500/10 text-red-600' : 
                        selectedCategory.severity === 'medium' ? 'bg-amber-500/10 text-amber-600' : 
                        'bg-emerald-500/10 text-emerald-600'
                      )}>
                        {selectedCategory.severity === 'low' ? 'NHẸ' : selectedCategory.severity === 'medium' ? 'TRUNG BÌNH' : 'NGHIÊM TRỌNG'}
                      </Badge>
                      <span className="text-[10px] font-bold text-muted-foreground/80">
                        Phạt: {selectedCategory.calculationType === 'perUnit' 
                          ? `${(selectedCategory.finePerUnit || 0).toLocaleString('vi-VN')}đ/${selectedCategory.unitLabel || 'đơn vị'}` 
                          : `${(selectedCategory.fineAmount || 0).toLocaleString('vi-VN')}đ`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Dynamic Unit Input */}
                {selectedCategory && selectedCategory.calculationType === 'perUnit' && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                      Thời gian / Số lượng ({selectedCategory.unitLabel || 'đơn vị'})
                    </Label>
                    <div className="relative group">
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={unitCount || ''}
                        onChange={(e) => setUnitCount(Number(e.target.value))}
                        className="h-12 rounded-xl border-muted-foreground/10 bg-muted/10 px-4 font-bold text-lg focus-visible:ring-primary/20 transition-all shadow-inner"
                        placeholder="0"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 group-focus-within:text-primary transition-colors">
                        {selectedCategory.unitLabel || 'ĐƠN VỊ'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Content Section */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                    Chi tiết sự việc
                    <span className="text-[10px] font-medium text-muted-foreground/60 ml-2">(không bắt buộc)</span>
                  </Label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="min-h-[100px] rounded-xl border-muted-foreground/10 bg-muted/10 p-4 text-sm focus-visible:ring-primary/20 transition-all resize-none shadow-inner leading-relaxed"
                    placeholder="Mô tả cụ thể sự việc đã xảy ra..."
                  />
                </div>

                {/* Media Section */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between px-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bằng chứng minh họa</Label>
                    {photoIds.length > 0 && (
                      <Badge variant="outline" className="h-4 text-[8px] font-black border-emerald-500/20 bg-emerald-500/5 text-emerald-600 rounded-full px-2">
                        {photoIds.length} ẢNH
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setIsCameraOpen(true)}
                      className="group/btn h-16 rounded-2xl border border-muted-foreground/10 bg-muted/5 flex flex-col items-center justify-center gap-1.5 transition-all hover:bg-background hover:border-primary/30 active:scale-95 shadow-sm"
                    >
                      <Camera className="h-4 w-4 text-muted-foreground group-hover/btn:text-primary transition-colors" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 group-hover/btn:text-primary/70">Máy ảnh</span>
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="group/btn h-16 rounded-2xl border border-muted-foreground/10 bg-muted/5 flex flex-col items-center justify-center gap-1.5 transition-all hover:bg-background hover:border-primary/30 active:scale-95 shadow-sm"
                    >
                      <Upload className="h-4 w-4 text-muted-foreground group-hover/btn:text-primary transition-colors" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 group-hover/btn:text-primary/70">Thư viện</span>
                    </button>
                  </div>
                  {photoIds.length > 0 && (
                    <div className="flex items-center gap-2 bg-emerald-500/5 text-emerald-600 px-4 py-3 rounded-xl border border-emerald-500/10 shadow-inner mt-2 animate-in zoom-in-95 duration-200">
                      <CheckCircle className="h-4 w-4 shrink-0" />
                      <span className="text-[10px] font-black uppercase tracking-widest leading-none">Tất cả ảnh đã sẵn sàng</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogBody>

          <DialogFooter variant="muted">
            <DialogCancel onClick={() => onOpenChange(false)}>Thoát</DialogCancel>
            <DialogAction
              onClick={handleSave}
              isLoading={isProcessing}
              variant={isSelfConfession ? "pastel-mint" : "default"}
              className="px-8"
            >
              {isSelfConfession ? "Gửi tự thú" : "Lưu báo cáo"}
            </DialogAction>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" multiple />
      <CameraDialog
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onSubmit={handleCapturePhotos}
        parentDialogTag="violation-dialog"
        captureMode="photo"
      />
    </>
  );
}
