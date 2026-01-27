
'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogIcon, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Edit, Trash2, Eye, Loader2 } from 'lucide-react';
import type { IncidentReport } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

type IncidentListProps = {
    incidents: IncidentReport[];
    onEdit: (incident: IncidentReport) => void;
    onDelete: (id: string) => void;
    onOpenLightbox: (photos: string[], index: number) => void;
    processingItemId: string | null;
    itemRefs: React.MutableRefObject<Map<string, HTMLDivElement | null>>;
};

const IncidentList = React.memo(({ incidents, onEdit, onDelete, onOpenLightbox, processingItemId, itemRefs }: IncidentListProps) => {
    if (incidents.length === 0) return <p className="text-sm text-center text-muted-foreground py-2">Không có sự cố nào.</p>;
    return (
        <div className="space-y-3">
            {incidents.map(incident => {
                const isProcessing = processingItemId === incident.id;
                const highlightKey = `incident-${incident.id}`;
                return (
                    <Card
                        key={incident.id}
                        ref={el => {
                            if (el) itemRefs.current.set(highlightKey, el); else itemRefs.current.delete(highlightKey);
                        }}
                        className="bg-card relative shadow-sm border-slate-200 dark:border-slate-800 overflow-hidden"
                    >
                        <CardContent className="p-3">
                            <div className="flex justify-between items-start gap-3 mb-2">
                                <div className="space-y-1 min-w-0 flex-1">
                                    <div className="font-semibold text-sm leading-tight">
                                        <span className="line-clamp-2">{incident.content}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal border-slate-100">{incident.category}</Badge>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="font-bold text-base text-amber-600">{incident.cost > 0 ? `${incident.cost.toLocaleString('vi-VN')}đ` : ''}</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-dashed border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="font-medium">{incident.createdBy.userName}</span>
                                    <span>•</span>
                                    <span>{format(new Date(incident.createdAt as string), 'HH:mm')}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {incident.photos && incident.photos.length > 0 && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => onOpenLightbox(incident.photos, 0)}><Eye className="h-4 w-4" /></Button>
                                    )}
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => onEdit(incident)}><Edit className="h-4 w-4" /></Button>
                                    <AlertDialog dialogTag="alert-dialog" parentDialogTag="root" variant="destructive">
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10" disabled={isProcessing}><Trash2 className="h-4 w-4" /></Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogIcon icon={Trash2} />
                                                <div className="space-y-2 text-center sm:text-left">
                                                    <AlertDialogTitle>Xóa sự cố?</AlertDialogTitle>
                                                    <AlertDialogDescription>Hành động này sẽ xóa vĩnh viễn sự cố và không thể hoàn tác.</AlertDialogDescription>
                                                </div>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => onDelete(incident.id)}>Xóa</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </div>
                        </CardContent>
                        {isProcessing && (<div className="absolute inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center z-10"><Loader2 className="h-6 w-6 animate-spin text-destructive" /><span className="ml-2 text-sm font-medium text-destructive">Đang xóa...</span></div>)}
                    </Card>
                );
            })}
        </div>
    );
});
IncidentList.displayName = 'IncidentList';

export default IncidentList;
