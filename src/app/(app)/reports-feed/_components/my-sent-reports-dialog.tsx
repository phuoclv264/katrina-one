'use client';
import { useState, useMemo } from 'react';
import Image from '@/components/ui/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogAction, DialogBody } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { WhistleblowingReport } from '@/lib/types';
import { ThumbsUp, ThumbsDown, MessageSquare, Eye, EyeOff, ExternalLink, Calendar, User, FileText, Paperclip, ChevronLeft, ArrowLeft } from 'lucide-react';

type MySentReportsDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    reports: WhistleblowingReport[];
    userId: string;
    onViewReport: (reportId: string) => void;
    parentDialogTag: string;
};

export default function MySentReportsDialog({ isOpen, onClose, reports, userId, onViewReport, parentDialogTag }: MySentReportsDialogProps) {
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

    const myReports = useMemo(() => {
        return reports.filter(report => report.reporterId === userId);
    }, [reports, userId]);

    const selectedReport = useMemo(() => {
        return myReports.find(r => r.id === selectedReportId) || null;
    }, [myReports, selectedReportId]);

    const handleClose = () => {
        setSelectedReportId(null);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose} dialogTag="my-sent-reports-dialog" parentDialogTag={parentDialogTag}>
            <DialogContent className="max-w-3xl h-[90vh] sm:h-[85vh]">
                <DialogHeader iconkey="file">
                    <div className="flex items-center gap-3">
                        {selectedReportId && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-full bg-muted/50 hover:bg-muted" 
                                onClick={() => setSelectedReportId(null)}
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        )}
                        <DialogTitle>
                            {selectedReportId ? "Chi tiết bài tố cáo" : "Bài tố cáo đã gửi"}
                        </DialogTitle>
                    </div>
                    <DialogDescription>
                        {selectedReportId 
                            ? "Xem toàn bộ nội dung và thông tin chi tiết của bài đăng." 
                            : "Danh sách các bài tố cáo bạn đã tạo trong hệ thống."}
                    </DialogDescription>
                </DialogHeader>

                <DialogBody className="bg-muted/5 py-4 pb-10">
                    {!selectedReportId ? (
                        <div className="space-y-4">
                            {myReports.length > 0 ? (
                                myReports.map(report => (
                                    <div 
                                        key={report.id} 
                                        className="border-none shadow-sm rounded-3xl overflow-hidden bg-background group hover:ring-2 hover:ring-primary/20 transition-all cursor-pointer"
                                        onClick={() => setSelectedReportId(report.id)}
                                    >
                                        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="space-y-1.5 flex-grow">
                                                <button 
                                                    className="text-left text-lg font-black leading-tight tracking-tight uppercase text-foreground/90 group-hover:text-primary transition-colors hover:underline decoration-2 underline-offset-4"
                                                >
                                                    {report.title}
                                                </button>
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                                                    <Calendar className="h-3 w-3" />
                                                    {new Date(report.createdAt as any).toLocaleString('vi-VN')}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex flex-wrap justify-end gap-1.5">
                                                    <Badge variant={report.isAnonymous ? 'secondary' : 'outline'} className="rounded-xl px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest">
                                                        {report.isAnonymous ? 'Ẩn danh' : 'Công khai'}
                                                    </Badge>
                                                    <Badge variant="outline" className="rounded-xl px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 bg-muted/20">
                                                        {report.visibility === 'private' ? 'Riêng tư' : 'Công khai'}
                                                    </Badge>
                                                </div>
                                                <ChevronLeft className="h-5 w-5 text-muted-foreground/30 rotate-180" />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-24 text-center space-y-4 opacity-40">
                                    <FileText className="h-12 w-12 text-muted-foreground/50 stroke-[1]" />
                                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest leading-relaxed">
                                        Bạn chưa gửi bài tố cáo nào.
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : selectedReport && (
                        <div className="space-y-6">
                            <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-background">
                                <CardContent className="p-0">
                                    <div className="p-5 sm:p-6 space-y-6">
                                        {/* Full Info Section */}
                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                            <div className="space-y-1">
                                                <h3 className="text-xl font-black leading-tight tracking-tight uppercase text-foreground/90">
                                                    {selectedReport.title}
                                                </h3>
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                                                    <Calendar className="h-3 w-3" />
                                                    {new Date(selectedReport.createdAt as any).toLocaleString('vi-VN')}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <Badge variant={selectedReport.isAnonymous ? 'secondary' : 'outline'} className="rounded-xl px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                                                    {selectedReport.isAnonymous ? 'Ẩn danh' : 'Công khai tên'}
                                                </Badge>
                                                <Badge variant="outline" className="rounded-xl px-3 py-1 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 bg-muted/20">
                                                    {selectedReport.visibility === 'private' ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                                    {selectedReport.visibility === 'private' ? 'Riêng tư' : 'Công khai'}
                                                </Badge>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                            <span className="font-bold text-muted-foreground/70">Người bị tố cáo:</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedReport.accusedUsers.map(user => (
                                                    <Badge key={user.uid} variant="destructive" className="rounded-lg px-2.5 py-0.5 font-black text-[9px] uppercase tracking-tighter">
                                                        {user.displayName}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-3 pt-2">
                                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                                                <FileText className="h-3 w-3" />
                                                Nội dung bài đăng
                                            </div>
                                            <p className="text-base leading-relaxed whitespace-pre-wrap bg-muted/30 p-5 rounded-3xl border border-muted/50 text-foreground/80 font-medium italic">
                                                "{selectedReport.content}"
                                            </p>
                                        </div>

                                        {selectedReport.attachments && selectedReport.attachments.length > 0 && (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                                                    <Paperclip className="h-3 w-3" />
                                                    Đính kèm ({selectedReport.attachments.length})
                                                </div>
                                                <div className="flex flex-wrap gap-4">
                                                    {selectedReport.attachments.map((attachment, index) => (
                                                        <div key={index} className="relative w-28 h-28 rounded-3xl overflow-hidden shadow-sm border bg-muted/20 group hover:shadow-md transition-all">
                                                            <Image src={attachment.url} alt={`Attachment ${index + 1}`} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="pt-6 border-t border-dashed flex flex-col sm:flex-row items-center justify-between gap-6">
                                            <div className="flex items-center gap-6">
                                                <div className="flex items-center gap-2.5 px-4 py-2 bg-green-50 text-green-600 rounded-2xl border border-green-100 shadow-sm">
                                                    <ThumbsUp className="h-4 w-4" /> 
                                                    <span className="font-black text-sm">{selectedReport.upvotes?.length || 0}</span>
                                                </div>
                                                <div className="flex items-center gap-2.5 px-4 py-2 bg-red-50 text-red-600 rounded-2xl border border-red-100 shadow-sm">
                                                    <ThumbsDown className="h-4 w-4" /> 
                                                    <span className="font-black text-sm">{selectedReport.downvotes?.length || 0}</span>
                                                </div>
                                                <div className="flex items-center gap-2.5 px-4 py-2 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shadow-sm">
                                                    <MessageSquare className="h-4 w-4" /> 
                                                    <span className="font-black text-sm">{selectedReport.commentCount || 0}</span>
                                                </div>
                                            </div>
                                            
                                            <Button 
                                                variant="secondary" 
                                                className="w-full sm:w-auto rounded-2xl font-black text-xs uppercase tracking-widest h-12 px-8 shadow-sm hover:translate-y-[-2px] transition-all" 
                                                onClick={() => {
                                                    onViewReport(selectedReport.id);
                                                    setSelectedReportId(null);
                                                }}
                                            >
                                                <ExternalLink className="mr-2 h-4 w-4" />
                                                Đi tới bài đăng
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </DialogBody>

                <DialogFooter className="bg-background border-t p-6">
                    <DialogAction 
                        onClick={selectedReportId ? () => setSelectedReportId(null) : onClose} 
                        className="w-full h-14 rounded-2xl text-base tracking-tight font-black"
                    >
                        {selectedReportId ? "Quay lại danh sách" : "Hoàn tất xem danh sách"}
                    </DialogAction>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}