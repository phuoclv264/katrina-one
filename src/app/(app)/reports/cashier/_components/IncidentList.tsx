
'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Edit, Trash2, Eye, Loader2 } from 'lucide-react';
import type { IncidentReport } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

const IncidentList = React.memo(({ incidents, onEdit, onDelete, onOpenLightbox, processingItemId }: { incidents: IncidentReport[], onEdit: (incident: IncidentReport) => void, onDelete: (id: string) => void, onOpenLightbox: (photos: string[], index: number) => void, processingItemId: string | null }) => {
    if (incidents.length === 0) return <p className="text-sm text-center text-muted-foreground py-2">Không có sự cố nào.</p>;
    return (
        <div className="space-y-3">
            {incidents.map(incident => {
                const isProcessing = processingItemId === incident.id;
                return (
                    <div key={incident.id} className="border-t first:border-t-0 pt-3 first:pt-0 relative">
                        <div className="flex justify-between items-start gap-2">
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold">{incident.content}</p>
                                    <Badge variant="secondary">{incident.category}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">bởi {incident.createdBy.userName} lúc {new Date(incident.createdAt as string).toLocaleString('vi-VN')}</p>
                            </div>
                            <p className="text-xl font-bold text-amber-600">{incident.cost > 0 ? `${incident.cost.toLocaleString('vi-VN')}đ` : ''}</p>
                        </div>
                        <div className="flex justify-end gap-1 mt-1">
                            {incident.photos && incident.photos.length > 0 && <Button variant="secondary" size="sm" onClick={() => onOpenLightbox(incident.photos, 0)} className="h-8">Xem ảnh</Button>}
                            <Button variant="outline" size="sm" onClick={() => onEdit(incident)} className="h-8">Chi tiết</Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive h-8 w-8"><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Xóa sự cố?</AlertDialogTitle></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(incident.id)}>Xóa</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                         {isProcessing && (<div className="absolute inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center rounded-md"><Loader2 className="h-6 w-6 animate-spin text-destructive"/><span className="ml-2 text-sm font-medium text-destructive">Đang xóa...</span></div>)}
                    </div>
                );
            })}
        </div>
    );
});
IncidentList.displayName = 'IncidentList';

export default IncidentList;
