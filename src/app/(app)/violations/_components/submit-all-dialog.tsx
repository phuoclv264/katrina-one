import React, { useMemo, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogFooter, DialogHeader, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import CameraDialog from '@/components/camera-dialog';
import { dataStore } from '@/lib/data-store';
import type { Violation, ViolationUser } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SubmitAllDialogProps {
  open: boolean;
  onClose: () => void;
  violations: Violation[]; // candidate violations filtered for current user (unsubmitted)
  user: ViolationUser;
}

export const SubmitAllDialog: React.FC<SubmitAllDialogProps> = ({ open, onClose, violations, user }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const captureMode = 'video';
  const isMobile = useIsMobile();

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const getUserCost = (v: Violation) => {
    const uc = (v as any).userCosts?.find((u: any) => u.userId === user.id);
    if (uc && typeof uc.cost === 'number') return uc.cost;
    const total = typeof v.cost === 'number' ? v.cost : 0;
    const count = (v.users && v.users.length) ? v.users.length : 1;
    return Math.round(total / count);
  };

  const isAlreadySubmitted = (v: Violation) => {
    return !!(v.penaltySubmissions || []).find((s: any) => s.userId === user.id);
  };

  const selectableViolations = useMemo(() => {
    return violations.map(v => ({
      ...v,
      userCost: getUserCost(v),
      alreadySubmitted: isAlreadySubmitted(v)
    }));
  }, [violations, user]);

  const totalSelectedCost = useMemo(() => {
    return selectableViolations
      .filter(v => selectedIds.includes(v.id))
      .reduce((sum, v) => sum + (v.userCost || 0), 0);
  }, [selectableViolations, selectedIds]);

  const handleSubmit = async (media: { id: string; type: 'photo' | 'video' }[]) => {
    setIsProcessing(true);
    setError(null);
    try {
      for (const violationId of selectedIds) {
        await dataStore.submitPenaltyProof(violationId, media, { userId: user.id, userName: user.name });
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Gửi bằng chứng thất bại.');
    } finally {
      setIsProcessing(false);
    }
  };

  const openCamera = () => {
    if (selectedIds.length === 0) {
      setError('Vui lòng chọn ít nhất một vi phạm để nộp.');
      return;
    }
    setError(null);
    setIsCameraOpen(true);
  };

  const renderDesktopView = () => (
    <div className="max-h-80 overflow-y-auto border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead></TableHead>
            <TableHead>Người</TableHead>
            <TableHead>Loại</TableHead>
            <TableHead>Nội dung</TableHead>
            <TableHead className="text-right">Số tiền (VNĐ)</TableHead>
            <TableHead>Trạng thái</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {selectableViolations.map(v => (
            <TableRow key={v.id}>
              <TableCell>
                <Checkbox
                  checked={selectedIds.includes(v.id)}
                  onCheckedChange={() => toggleSelect(v.id)}
                  disabled={isProcessing || v.alreadySubmitted}
                  aria-label={`select-${v.id}`}
                />
              </TableCell>
              <TableCell>{(v.users || []).map((u: any) => u.name).join(', ')}</TableCell>
              <TableCell>{v.categoryName}</TableCell>
              <TableCell className="max-w-xs">{v.content}</TableCell>
              <TableCell className="text-right">{(v.userCost || 0).toLocaleString('vi-VN')}</TableCell>
              <TableCell>
                {v.alreadySubmitted ? <span className="text-green-600">Đã nộp</span> : <span className="text-yellow-700">Chưa nộp</span>}
              </TableCell>
            </TableRow>
          ))}
          {selectableViolations.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-gray-500 py-4">Không có vi phạm để nộp.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  const renderMobileView = () => (
    <ScrollArea className="max-h-80">
      <div className="space-y-3 pr-4">
        {selectableViolations.map(v => (
          <div key={v.id} className="border rounded-lg p-3 flex items-start gap-3">
            <Checkbox
              className="mt-1"
              checked={selectedIds.includes(v.id)}
              onCheckedChange={() => toggleSelect(v.id)}
              disabled={isProcessing || v.alreadySubmitted}
              aria-label={`select-${v.id}`}
            />
            <div className="flex-grow">
              <p className="font-semibold">{v.categoryName}</p>
              <p className="text-sm text-gray-600">{v.content}</p>
              <p className="text-sm mt-1">
                <span className="font-medium">Người vi phạm:</span> {(v.users || []).map((u: any) => u.name).join(', ')}
              </p>
              <div className="flex justify-between items-center mt-2">
                <p className="font-bold text-lg">{(v.userCost || 0).toLocaleString('vi-VN')} VNĐ</p>
                {v.alreadySubmitted ? <span className="text-green-600 text-sm">Đã nộp</span> : <span className="text-yellow-700 text-sm">Chưa nộp</span>}
              </div>
            </div>
          </div>
        ))}
        {selectableViolations.length === 0 && (
          <p className="text-center text-gray-500 py-4">Không có vi phạm để nộp.</p>
        )}
      </div>
    </ScrollArea>
  );

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className={isMobile ? "max-w-sm" : "max-w-3xl"}>
        <DialogHeader>
          <DialogTitle>Nộp bằng chứng cho nhiều vi phạm</DialogTitle>
          <DialogDescription>
            Chọn các vi phạm cần nộp. Bạn sẽ ghi hình video một lần và video này sẽ được gửi cho tất cả các mục đã chọn.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-3 space-y-4">
          <div className="flex items-center gap-2">
            <strong>Danh sách vi phạm</strong>
            <span className="text-sm text-gray-500">({selectableViolations.length} kết quả)</span>
          </div>

          {isMobile ? renderMobileView() : renderDesktopView()}

          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm">
                Đã chọn: <strong>{selectedIds.length}</strong>
              </div>
              <div className="text-base font-medium">
                Tổng cộng: <strong className="text-lg">{totalSelectedCost.toLocaleString('vi-VN')} VNĐ</strong>
              </div>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        <CameraDialog
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
          onSubmit={(media) => {
            setIsCameraOpen(false);
            handleSubmit(media);
          }}
          captureMode={captureMode}
        />

        <DialogFooter className="mt-4 flex-col sm:flex-row gap-2">
          <Button onClick={onClose} variant="outline" disabled={isProcessing} className="w-full sm:w-auto">Hủy</Button>
          <Button onClick={openCamera} disabled={isProcessing || selectedIds.length === 0} className="w-full sm:w-auto">
            {isProcessing ? 'Đang xử lý...' : `Ghi hình & Gửi (${selectedIds.length}) — ${totalSelectedCost.toLocaleString('vi-VN')} VNĐ`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
