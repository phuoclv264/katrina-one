
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth, type AuthUser } from '@/hooks/use-auth';
import { toast } from '@/components/ui/pro-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Camera, Loader2, Upload } from 'lucide-react';
import type { ManagedUser, Violation, ViolationCategory } from '@/lib/types';
import CameraDialog from '@/components/camera-dialog';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/combobox';

import { Input } from '@/components/ui/input';
import { photoStore } from '@/lib/photo-store';
import { v4 as uuidv4 } from 'uuid';

export function ViolationDialog({
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
    if (!content || selectedUsers.length === 0 || !selectedCategoryId) {
      toast.error('Vui lòng điền đầy đủ nội dung, chọn nhân viên và loại vi phạm.');
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
      <Dialog open={open} onOpenChange={onOpenChange} dialogTag="violation-dialog" parentDialogTag="root">
        <DialogContent className="bg-white dark:bg-card">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {isSelfConfession ? 'Mô tả lại sai sót của bạn một cách trung thực.' : 'Ghi nhận lại các vấn đề hoặc sai phạm của nhân viên.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!isSelfConfession ? (
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="user" className="text-right pt-2">
                  Nhân viên
                </Label>
                <Combobox
                  options={users.map(u => ({ value: u.uid, label: u.displayName }))}
                  value={selectedUsers.map(u => u.uid)}
                  onChange={(vals) => {
                    const selectedIds = vals as string[];
                    const selected = users.filter(u => selectedIds.includes(u.uid));
                    setSelectedUsers(selected);
                  }}
                  multiple={true}
                  disabled={isSelfConfession}
                  placeholder="Chọn nhân viên..."
                  searchPlaceholder="Tìm nhân viên..."
                  emptyText="Không tìm thấy nhân viên."
                  className="col-span-3"
                />
              </div>
            ) : (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Nhân viên</Label>
                <div className="col-span-3">
                  <Badge variant="secondary">{reporter.displayName}</Badge>
                </div>
              </div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category" className="text-right">
                Loại vi phạm
              </Label>
              <div className="col-span-3">
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
              </div>
            </div>
            {selectedCategory && selectedCategory.calculationType === 'perUnit' && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="unit-count" className="text-right">Số {selectedCategory.unitLabel || 'đơn vị'}</Label>
                <div className="col-span-3 flex items-center gap-2">
                  <Input
                    id="unit-count"
                    type="number"
                    value={unitCount || ''}
                    onChange={(e) => setUnitCount(Number(e.target.value))}
                    className="w-full"
                    placeholder={`Nhập số ${selectedCategory.unitLabel || 'đơn vị'} ${selectedCategory.name.toLowerCase()}`}
                  />
                  <span className="font-semibold text-muted-foreground">{selectedCategory.unitLabel || 'đơn vị'}</span>
                </div>
              </div>
            )}
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="content" className="text-right mt-2">
                Nội dung
              </Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="col-span-3"
                placeholder="Mô tả chi tiết về vi phạm..."
              />
            </div>

            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right mt-2">Bằng chứng</Label>
              <div className="col-span-3 space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={() => setIsCameraOpen(true)}>
                    <Camera className="mr-2 h-4 w-4" /> Chụp ảnh
                  </Button>
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="mr-2 h-4 w-4" /> Tải ảnh lên
                  </Button>
                </div>
                {photoIds.length > 0 && <p className="text-sm text-muted-foreground mt-2">{photoIds.length} ảnh đã được chọn.</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
            <Button onClick={handleSave} disabled={isProcessing}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu
            </Button>
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
