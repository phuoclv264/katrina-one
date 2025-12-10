import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogTitle, DialogContent, DialogFooter, DialogHeader, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Violation, ViolationUser } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileText, DollarSign, Camera, CalendarDays, Users } from 'lucide-react';

interface SubmitAllDialogProps {
  open: boolean;
  onClose: () => void;
  violations: Violation[]; // candidate violations filtered for current user (unsubmitted)
  user: ViolationUser;
  onSubmit: (violationIds: string[]) => void;
  isProcessing: boolean;
}

export const SubmitAllDialog: React.FC<SubmitAllDialogProps> = ({ open, onClose, violations, user, onSubmit, isProcessing }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Clear selections when dialog is reopened
  React.useEffect(() => {
    if (open) {
      setSelectedIds([]);
      setError(null);
    }
  }, [open]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    const selectableIds = selectableViolations.filter(v => !v.alreadySubmitted).map(v => v.id);
    if (selectedIds.length === selectableIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableIds);
    }
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

  const unsubmittedCount = useMemo(() => {
    return selectableViolations.filter(v => !v.alreadySubmitted).length;
  }, [selectableViolations]);

  const allSelectableSelected = useMemo(() => {
    const selectableIds = selectableViolations.filter(v => !v.alreadySubmitted).map(v => v.id);
    return selectableIds.length > 0 && selectedIds.length === selectableIds.length;
  }, [selectableViolations, selectedIds]);

  const totalSelectedCost = useMemo(() => {
    return selectableViolations
      .filter(v => selectedIds.includes(v.id))
      .reduce((sum, v) => sum + (v.userCost || 0), 0);
  }, [selectableViolations, selectedIds]);

  const handleTriggerSubmit = () => {
    if (selectedIds.length === 0) {
      setError('Vui lòng chọn ít nhất một vi phạm để nộp.');
      return;
    }
    setError(null);
    onSubmit(selectedIds);
  };

  const renderDesktopView = () => (
    <>
      <div className="bg-muted/50 px-4 py-2 border-b sticky top-0 z-20 backdrop-blur-sm bg-background/95">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={isProcessing || unsubmittedCount === 0 ? undefined : toggleSelectAll}
          >
            <Checkbox
              checked={allSelectableSelected}
              disabled={isProcessing || unsubmittedCount === 0}
              aria-label="select-all"
            />
            <span className="font-medium text-sm">Chọn tất cả</span>
          </div>
          <span className="text-sm text-muted-foreground">
            {unsubmittedCount} vi phạm có thể chọn
          </span>
        </div>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-background">
            <TableRow className="bg-muted/30">
              <TableHead className="w-12"></TableHead>
              <TableHead className="w-28">Ngày</TableHead>
              <TableHead className="w-32">Người</TableHead>
              <TableHead className="w-40">Loại</TableHead>
              <TableHead>Nội dung</TableHead>
              <TableHead className="text-right w-32">Số tiền</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
          {selectableViolations.map(v => (
            <TableRow key={v.id} onClick={isProcessing || v.alreadySubmitted ? undefined : () => toggleSelect(v.id)} className={v.alreadySubmitted ? "opacity-60" : "hover:bg-muted/30 cursor-pointer"}>
              <TableCell>
                <Checkbox
                  checked={selectedIds.includes(v.id)}
                  onCheckedChange={() => toggleSelect(v.id)}
                  disabled={isProcessing || v.alreadySubmitted}
                  aria-label={`select-${v.id}`}
                />
              </TableCell>
              <TableCell>
                <span className="text-sm">
                  {v.createdAt && format(new Date(v.createdAt.toString()), 'dd/MM/yyyy HH:mm')}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{(v.users || []).map((u: any) => u.name).join(', ')}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="font-normal">{v.categoryName}</Badge>
              </TableCell>
              <TableCell>
                <p className="text-sm whitespace-normal break-words">{v.content}</p>
              </TableCell>
              <TableCell className="text-right">
                <span className="font-semibold text-base">{(v.userCost || 0).toLocaleString('vi-VN')}</span>
                <span className="text-xs text-muted-foreground ml-1">₫</span>
              </TableCell>
            </TableRow>
          ))}
          {selectableViolations.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-12">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <FileText className="h-12 w-12 opacity-20" />
                  <p>Không có vi phạm để nộp</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
    </>
  );

  const renderMobileView = () => (
    <div className="space-y-3 pr-4">
      {unsubmittedCount > 0 && (
        <div className="bg-muted/50 rounded-lg p-2 border sticky top-0 z-10 backdrop-blur-sm bg-background/95">
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={isProcessing ? undefined : toggleSelectAll}
            >
              <Checkbox
                checked={allSelectableSelected}
                disabled={isProcessing}
                aria-label="select-all"
              />
              <span className="font-medium text-sm">Chọn tất cả</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {unsubmittedCount} vi phạm
            </span>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {selectableViolations.map(v => (
          <div
            key={v.id}
            onClick={isProcessing || v.alreadySubmitted ? undefined : () => toggleSelect(v.id)}
            className={`border rounded-xl overflow-hidden transition-all ${v.alreadySubmitted
              ? 'bg-muted/30 opacity-60'
              : selectedIds.includes(v.id)
                ? 'border-primary shadow-md bg-primary/5'
                : 'bg-card shadow-sm hover:shadow-md cursor-pointer'
              }`}
          >
            <div className="p-4 flex items-start gap-3">
              <Checkbox
                className="mt-1.5"
                checked={selectedIds.includes(v.id)}
                onCheckedChange={() => toggleSelect(v.id)}
                disabled={isProcessing || v.alreadySubmitted}
                aria-label={`select-${v.id}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Badge variant="outline" className="font-medium">{v.categoryName}</Badge>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>{v.createdAt && format(new Date(v.createdAt.toString()), 'dd/MM/yy')}</span>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-3 whitespace-normal break-words">{v.content}</p>

                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                  <Users className="h-3.5 w-3.5" />
                  <span>{(v.users || []).map((u: any) => u.name).join(', ')}</span>
                </div>

                <Separator className="mb-3" />

                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="font-bold text-xl">{(v.userCost || 0).toLocaleString('vi-VN')}</span>
                  <span className="text-sm text-muted-foreground">₫</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {selectableViolations.length === 0 && (
          <div className="text-center py-12">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <FileText className="h-16 w-16 opacity-20" />
              <p className="text-sm">Không có vi phạm để nộp</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className={`${isMobile ? "max-w-md" : "max-w-5xl"} max-h-[90vh] overflow-hidden`}>
        <DialogHeader className="sticky top-0 z-30 border-b">
          <DialogTitle>Nộp bằng chứng cho nhiều vi phạm</DialogTitle>
          <DialogDescription>
            Chọn các vi phạm cần nộp. Bạn sẽ ghi hình video một lần và video này sẽ được gửi cho tất cả các mục đã chọn.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 p-4">
            {isMobile ? renderMobileView() : renderDesktopView()}
            {error && (
              <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg border border-destructive/20 text-sm">
                {error}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="sticky bottom-0 z-30 bg-background/90 backdrop-blur-sm border-t py-4 flex-col sm:flex-row gap-3">
          <Button
            onClick={onClose}
            variant="outline"
            disabled={isProcessing}
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            Hủy
          </Button>
          <Button
            onClick={handleTriggerSubmit}
            disabled={isProcessing || selectedIds.length === 0}
            className="w-full sm:flex-1 order-1 sm:order-2 h-12 text-base font-semibold"
            size="lg"
          >
            {isProcessing ? (
              <>
                <span className="animate-pulse">Đang xử lý...</span>
              </>
            ) : (
              <>
                <Camera className="h-5 w-5 mr-2" />
                Ghi hình & Gửi ({selectedIds.length}) — {totalSelectedCost.toLocaleString('vi-VN')} ₫
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
