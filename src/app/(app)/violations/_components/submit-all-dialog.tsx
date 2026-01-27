import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogDescription,
  DialogBody,
  DialogAction,
  DialogCancel
} from '@/components/ui/dialog';
import type { Violation, ViolationUser } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileText, Camera, CalendarDays, Users, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface SubmitAllDialogProps {
  open: boolean;
  onClose: () => void;
  violations: Violation[]; // candidate violations filtered for current user (unsubmitted)
  user: ViolationUser;
  onSubmit: (violationIds: string[]) => void;
  isProcessing: boolean;
  parentDialogTag: string;
}

export const SubmitAllDialog: React.FC<SubmitAllDialogProps> = ({ open, onClose, violations, user, onSubmit, isProcessing, parentDialogTag }) => {
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
    <div className="space-y-3">
      <div className="bg-muted/30 p-3 rounded-2xl flex items-center justify-between border border-primary/5">
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={isProcessing || unsubmittedCount === 0 ? undefined : toggleSelectAll}
        >
          <Checkbox
            checked={allSelectableSelected}
            disabled={isProcessing || unsubmittedCount === 0}
            className="rounded-md h-5 w-5"
          />
          <div className="flex flex-col">
            <span className="font-bold text-sm group-hover:text-primary transition-colors">Chọn tất cả</span>
            <span className="text-[10px] text-muted-foreground">
              {unsubmittedCount} vi phạm có thể chọn
            </span>
          </div>
        </div>
        
        {selectedIds.length > 0 && (
          <Badge variant="secondary" className="px-3 py-1 rounded-full gap-2 bg-primary/10 text-primary border-none text-[10px]">
            <CheckCircle2 className="h-3 w-3" />
            Đã chọn {selectedIds.length} mục
          </Badge>
        )}
      </div>

      <div className="border border-primary/10 rounded-[1.5rem] overflow-hidden bg-card/50">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-primary/10 bg-muted/20">
              <TableHead className="w-12 pl-6"></TableHead>
              <TableHead className="w-32 font-bold text-foreground/70 py-3">Thời gian</TableHead>
              <TableHead className="w-48 font-bold text-foreground/70 py-3">Đối tượng</TableHead>
              <TableHead className="w-40 font-bold text-foreground/70 py-3">Danh mục</TableHead>
              <TableHead className="font-bold text-foreground/70 py-3">Nội dung vi phạm</TableHead>
              <TableHead className="text-right w-40 pr-8 font-bold text-foreground/70 py-3">Số tiền</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {selectableViolations.map(v => (
              <TableRow 
                key={v.id} 
                onClick={isProcessing || v.alreadySubmitted ? undefined : () => toggleSelect(v.id)} 
                className={cn(
                  "transition-colors border-primary/5",
                  v.alreadySubmitted ? "opacity-40 grayscale-[0.5]" : "hover:bg-primary/5 cursor-pointer",
                  selectedIds.includes(v.id) && "bg-primary/[0.03]"
                )}
              >
                <TableCell className="pl-6 py-2.5">
                  <Checkbox
                    checked={selectedIds.includes(v.id)}
                    onCheckedChange={() => toggleSelect(v.id)}
                    disabled={isProcessing || v.alreadySubmitted}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-md h-5 w-5"
                  />
                </TableCell>
                <TableCell className="py-2.5">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">
                      {v.createdAt && format(new Date(v.createdAt.toString()), 'HH:mm')}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {v.createdAt && format(new Date(v.createdAt.toString()), 'dd/MM/yyyy')}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                      <Users className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium max-w-[150px]">
                      {(v.users || []).map((u: any) => u.name).join(', ')}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="py-2.5">
                  <Badge variant="outline" className="font-medium bg-background border-primary/20 text-[11px] px-2 py-0">
                    {v.categoryName}
                  </Badge>
                </TableCell>
                <TableCell className="py-2.5">
                  <p className="text-sm text-foreground/80 line-clamp-1 leading-relaxed">
                    {v.content}
                  </p>
                </TableCell>
                <TableCell className="text-right pr-8 py-2.5">
                  <div className="flex flex-col items-end">
                    <span className="font-bold text-base text-primary whitespace-nowrap">
                      {(v.userCost || 0).toLocaleString('vi-VN')}
                      <span className="text-[10px] ml-1 font-medium">₫</span>
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {selectableViolations.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16">
                  <div className="flex flex-col items-center gap-4 text-muted-foreground/40">
                    <div className="p-4 rounded-full bg-muted/30">
                      <FileText className="h-10 w-10" />
                    </div>
                    <p className="text-sm font-medium">Không có vi phạm khả dụng để nộp</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const renderMobileView = () => (
    <div className="space-y-3 px-3">
      {unsubmittedCount > 0 && (
        <div className="bg-muted/30 rounded-2xl p-3 border border-primary/5 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={isProcessing ? undefined : toggleSelectAll}
          >
            <Checkbox
              checked={allSelectableSelected}
              disabled={isProcessing}
              className="rounded-md h-5 w-5"
            />
            <span className="font-bold text-sm">Chọn tất cả</span>
          </div>
          <span className="text-[10px] font-bold text-muted-foreground bg-background/50 px-2 py-1 rounded-lg">
            {unsubmittedCount}
          </span>
        </div>
      )}

      <div className="grid gap-2.5">
        {selectableViolations.map(v => (
          <div
            key={v.id}
            onClick={isProcessing || v.alreadySubmitted ? undefined : () => toggleSelect(v.id)}
            className={cn(
              "relative rounded-[1.5rem] border transition-all duration-200 overflow-hidden",
              v.alreadySubmitted 
                ? 'bg-muted/20 opacity-40 grayscale-[0.5] border-transparent' 
                : selectedIds.includes(v.id)
                  ? 'bg-primary/[0.04] border-primary/30 shadow-sm'
                  : 'bg-card border-primary/10 hover:border-primary/20 shadow-none'
            )}
          >
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/50">
                  <CalendarDays className="h-3 w-3" />
                  <span>{v.createdAt && format(new Date(v.createdAt.toString()), 'HH:mm - dd/MM/yyyy')}</span>
                </div>
                
                <Checkbox
                  checked={selectedIds.includes(v.id)}
                  onCheckedChange={() => toggleSelect(v.id)}
                  disabled={isProcessing || v.alreadySubmitted}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-lg h-6 w-6 flex-shrink-0"
                />
              </div>

              <div className="space-y-1.5">
                <Badge variant="outline" className="font-black bg-background border-primary/20 text-[9px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-md w-fit block">
                  {v.categoryName}
                </Badge>
                
                <p className="text-sm font-semibold text-foreground/90 leading-normal break-words">
                  {v.content}
                </p>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-dashed border-primary/10 mt-1">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    <div className="p-1 px-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-background flex items-center gap-1 grayscale-[0.5]">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[9px] font-bold text-muted-foreground">
                        {(v.users || []).length}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground max-w-[100px]">
                    {(v.users || []).map((u: any) => u.name).join(', ')}
                  </span>
                </div>

                <div className="flex items-baseline gap-0.5">
                  <span className="font-black text-xl text-primary whitespace-nowrap">
                    {(v.userCost || 0).toLocaleString('vi-VN')}
                  </span>
                  <span className="text-[10px] font-bold text-primary italic">₫</span>
                </div>
              </div>
            </div>

            {/* Selection indicator bar */}
            {selectedIds.includes(v.id) && !v.alreadySubmitted && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
            )}
            
            {/* Already submitted badge */}
            {v.alreadySubmitted && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm text-foreground/40 font-bold border-none pointer-events-none">
                  Đã nộp
                </Badge>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()} dialogTag="submit-all-violations-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className={`${isMobile ? "max-w-md" : "max-w-5xl"}`}>
        <DialogHeader iconkey="camera" variant="info" className='pb-3'>
          <DialogTitle>Nộp bằng chứng cho nhiều vi phạm</DialogTitle>
        </DialogHeader>

        <DialogBody className="p-0">
          <div className="space-y-4 pt-2 pb-4 px-3 sm:px-6">
            {isMobile ? renderMobileView() : renderDesktopView()}
            
            {error && (
              <div className="mx-3 sm:mx-0 bg-destructive/5 text-destructive p-3 rounded-2xl border border-destructive/10 text-xs flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <p className="font-medium">{error}</p>
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter variant="muted" className="flex-col sm:flex-row gap-3 sm:px-8">
          <DialogCancel 
            onClick={onClose} 
            disabled={isProcessing} 
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            Hủy
          </DialogCancel>
          <DialogAction
            onClick={handleTriggerSubmit}
            isLoading={isProcessing}
            disabled={selectedIds.length === 0}
            variant="default"
            className="w-full sm:flex-1 order-1 sm:order-2 h-14"
          >
            <div className="flex flex-col items-center leading-none">
              <span className="text-sm font-bold">Ghi hình &amp; Gửi ({selectedIds.length})</span>
              <span className="text-[10px] opacity-80 mt-1 font-medium">{totalSelectedCost.toLocaleString('vi-VN')} ₫</span>
            </div>
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
