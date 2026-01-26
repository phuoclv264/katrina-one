
'use client';
import React from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
import type { IncidentReport } from '@/lib/types';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import Image from '@/components/ui/image';
import { User, Banknote, AlertCircle, Clock, Image as ImageIcon, CreditCard } from 'lucide-react';
import { DialogClose } from '@radix-ui/react-dialog';

type IncidentDetailsDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  incidents: IncidentReport[];
  onOpenLightbox: (photos: string[], index?: number) => void;
  currentMonth: Date;
};

export default function IncidentDetailsDialog({
  isOpen,
  onClose,
  incidents,
  onOpenLightbox,
  currentMonth,
}: IncidentDetailsDialogProps) {
  const paymentMethodMeta = (m?: string): { label: string; icon: React.ElementType; badgeClass: string; description?: string } => {
    switch (m) {
      case 'cash':
        return { label: 'Tiền mặt', icon: Banknote, badgeClass: 'bg-amber-50 text-amber-600 border-amber-100/50' };
      case 'bank_transfer':
        return { label: 'Chuyển khoản', icon: CreditCard, badgeClass: 'bg-primary/10 text-primary' };
      case 'intangible_cost':
        return { label: 'Vô hình', icon: AlertCircle, badgeClass: 'bg-red-100 text-red-600 border-red-200', description: 'Ghi nhận trực tiếp — không có phiếu chi' };
      default:
        return { label: 'Không rõ', icon: AlertCircle, badgeClass: 'bg-muted/30 text-muted-foreground' };
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} dialogTag="incident-details-dialog" parentDialogTag="root">
      <DialogContent className="max-w-3xl flex flex-col h-[90vh] sm:h-[80vh]">
        <DialogHeader variant='warning' iconkey="alert">
          <DialogTitle>Chi tiết Sự cố Tháng {format(currentMonth, 'MM/yyyy')}</DialogTitle>
          <DialogDescription>
            Danh sách tất cả các sự cố đã được ghi nhận và báo cáo trong hệ thống.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="bg-muted/5 py-6">
          {incidents.length > 0 ? (
            <div className="space-y-6">
              {incidents.map((incident) => (
                <Card 
                  key={incident.id} 
                  className="border-none shadow-sm rounded-3xl overflow-hidden bg-background group hover:shadow-md transition-all duration-300"
                >
                  <CardContent className="p-0">
                    <div className="p-6 space-y-5">
                      {/* Header part with categories and cost */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-wrap">
                           <Badge variant="secondary" className="rounded-xl px-3 py-1 font-black text-[10px] uppercase tracking-widest bg-amber-50 text-amber-600 border-amber-100/50">
                             {incident.category}
                           </Badge>
                           <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-700 bg-muted/30 px-3 py-1 rounded-xl">
                             <Clock className="h-3.5 w-3.5" />
                             {format(new Date(incident.createdAt as any), 'HH:mm - dd/MM/yyyy', { locale: vi })}
                           </div>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-1.5 rounded-2xl bg-red-50 text-red-600 border border-red-100/50 self-start sm:self-center">
                          <Banknote className="h-4 w-4 stroke-[2.5px]" />
                          <span className="text-base font-black tracking-tight">
                            {incident.cost > 0 ? incident.cost.toLocaleString('vi-VN') + 'đ' : 'Không chi phí'}
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="space-y-3">
                        <p className="text-lg font-black leading-tight tracking-tight text-foreground/90 uppercase">{incident.content}</p>
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground/70">
                           <div className="h-6 w-6 rounded-lg bg-muted flex items-center justify-center">
                              <User className="h-3.5 w-3.5" />
                           </div>
                           <span>Báo cáo bởi: <span className="text-foreground/80 font-black">{incident.createdBy.userName}</span></span>
                        </div>

                        {/* Payment method / kind of cost */}
                        {incident.paymentMethod && (
                          <div className="mt-2">
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl text-[12px] font-medium ${paymentMethodMeta(incident.paymentMethod).badgeClass}`} title={paymentMethodMeta(incident.paymentMethod).description || paymentMethodMeta(incident.paymentMethod).label}>
                                {React.createElement(paymentMethodMeta(incident.paymentMethod).icon, { className: 'h-3.5 w-3.5' })}
                                {paymentMethodMeta(incident.paymentMethod).label}
                              </span>
                              {incident.paymentMethod === 'intangible_cost' && (
                                <span className="text-xs text-muted-foreground/70 italic">(Chi phí vô hình — không có phiếu chi)</span>
                              )}
                            </div>

                            {incident.associatedExpenseSlipId && (
                              <div className="mt-2 text-xs text-muted-foreground">Liên kết phiếu: <span className="font-medium text-foreground/80">{incident.associatedExpenseSlipId}</span></div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Photos */}
                      {incident.photos && incident.photos.length > 0 && (
                        <div className="pt-5 border-t border-dashed border-muted/50 mt-2">
                           <div className="flex items-center gap-2 mb-4">
                              <div className="h-4 w-4 rounded-lg bg-primary/10 flex items-center justify-center">
                                <ImageIcon className="h-2.5 w-2.5 text-primary" />
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Hình ảnh minh chứng ({incident.photos.length})</span>
                           </div>
                           <div className="flex gap-4 flex-wrap">
                            {incident.photos.map((photo, index) => (
                              <button
                                key={index}
                                onClick={() => onOpenLightbox(incident.photos, index)}
                                className="relative w-24 h-24 rounded-2xl overflow-hidden shadow-sm hover:scale-[1.05] active:scale-95 transition-all ring-4 ring-transparent hover:ring-primary/10 bg-muted/20"
                              >
                                <Image src={photo} alt={`Evidence ${index + 1}`} fill className="object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
              <div className="relative">
                 <div className="absolute inset-0 bg-muted/20 blur-2xl rounded-full scale-150 animate-pulse" />
                 <div className="relative h-20 w-20 rounded-[2rem] bg-background border-2 border-muted flex items-center justify-center">
                   <AlertCircle className="h-10 w-10 text-muted-foreground/20 stroke-[1.5px]" />
                 </div>
              </div>
              <p className="max-w-[180px] text-sm font-bold text-muted-foreground/30 italic leading-relaxed">
                Không có sự cố nào được ghi nhận trong tháng này.
              </p>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <DialogCancel onClick={onClose} className="rounded-xl font-bold flex-1 sm:flex-none">
            Đóng
          </DialogCancel>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

