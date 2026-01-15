
'use client';
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { IncidentReport } from '@/lib/types';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  return (
    <Dialog open={isOpen} onOpenChange={onClose} dialogTag="incident-details-dialog" parentDialogTag="root">
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Chi tiết Sự cố Tháng {format(currentMonth, 'MM/yyyy')}</DialogTitle>
          <DialogDescription>
            Danh sách tất cả các sự cố đã được ghi nhận trong tháng.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] -mx-6 px-6">
          {incidents.length > 0 ? (
            <div className="space-y-4 py-4">
              {incidents.map((incident) => (
                <Card key={incident.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{incident.content}</p>
                        <div className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                          <span>bởi {incident.createdBy.userName}</span>
                          <span>•</span>
                          <span>{new Date(incident.createdAt as string).toLocaleString('vi-VN')}</span>
                          <span>•</span>
                          <Badge variant="secondary">{incident.category}</Badge>
                        </div>
                      </div>
                      <p className="font-bold text-lg text-amber-600">
                        {incident.cost > 0 ? incident.cost.toLocaleString('vi-VN') + 'đ' : 'Không có chi phí'}
                      </p>
                    </div>
                    {incident.photos && incident.photos.length > 0 && (
                      <div className="mt-2 flex gap-2 flex-wrap">
                        {incident.photos.map((photo, index) => (
                          <button
                            key={index}
                            onClick={() => onOpenLightbox(incident.photos, index)}
                            className="relative w-16 h-16 rounded-md overflow-hidden"
                          >
                            <Image src={photo} alt={`Evidence ${index + 1}`} fill className="object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">
              Không có sự cố nào được ghi nhận trong tháng này.
            </p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

