'use client';
import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { WhistleblowingReport } from '@/lib/types';
import { ThumbsUp, ThumbsDown, MessageSquare, Eye, EyeOff, ExternalLink } from 'lucide-react';

type MySentReportsDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    reports: WhistleblowingReport[];
    userId: string;
    onViewReport: (reportId: string) => void;
    parentDialogTag: string;
};

export default function MySentReportsDialog({ isOpen, onClose, reports, userId, onViewReport, parentDialogTag }: MySentReportsDialogProps) {

    const myReports = useMemo(() => {
        return reports.filter(report => report.reporterId === userId);
    }, [reports, userId]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose} dialogTag="my-sent-reports-dialog" parentDialogTag={parentDialogTag}>
            <DialogContent className="max-w-2xl h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-4 border-b">
                    <DialogTitle>Các bài tố cáo đã gửi</DialogTitle>
                    <DialogDescription>
                        Đây là danh sách tất cả các bài tố cáo bạn đã tạo.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-grow">
                    <div className="p-6 pt-2 space-y-4">
                        {myReports.length > 0 ? (
                            <Accordion type="multiple" className="w-full space-y-3">
                                {myReports.map(report => (
                                    <AccordionItem value={report.id} key={report.id} className="border rounded-lg shadow-sm">
                                        <AccordionTrigger className="p-4 text-base font-semibold hover:no-underline">
                                            <div className="flex flex-col items-start text-left gap-1">
                                                <span>{report.title}</span>
                                                <span className="text-xs text-muted-foreground font-normal">
                                                    Gửi lúc: {new Date(report.createdAt as any).toLocaleString('vi-VN')}
                                                </span>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="p-4 border-t space-y-4">
                                            <div>
                                                <h4 className="font-semibold mb-1">Nội dung:</h4>
                                                <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md">{report.content}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <h4 className="font-semibold mb-1">Người bị tố cáo:</h4>
                                                    <div className="flex flex-wrap gap-1">
                                                        {report.accusedUsers.map(user => (
                                                            <Badge key={user.uid} variant="destructive">{user.displayName}</Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold mb-1">Trạng thái:</h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        <Badge variant={report.isAnonymous ? 'secondary' : 'outline'}>{report.isAnonymous ? 'Ẩn danh' : 'Công khai tên'}</Badge>
                                                        <Badge variant="outline" className="flex items-center gap-1">
                                                            {report.visibility === 'private' ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                                            {report.visibility === 'private' ? 'Riêng tư' : 'Công khai'}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                            {report.attachments && report.attachments.length > 0 && (
                                                <div>
                                                    <h4 className="font-semibold mb-1">Đính kèm:</h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {report.attachments.map((attachment, index) => (
                                                            <div key={index} className="relative w-20 h-20 rounded-md overflow-hidden">
                                                                <Image src={attachment.url} alt={`Attachment ${index + 1}`} fill className="object-cover" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <h4 className="font-semibold mb-1">Tương tác:</h4>
                                                    <div className="flex items-center gap-4 text-sm">
                                                        <span className="flex items-center gap-1"><ThumbsUp className="h-4 w-4 text-green-500" /> {report.upvotes?.length || 0}</span>
                                                        <span className="flex items-center gap-1"><ThumbsDown className="h-4 w-4 text-red-500" /> {report.downvotes?.length || 0}</span>
                                                        <span className="flex items-center gap-1"><MessageSquare className="h-4 w-4 text-blue-500" /> {report.commentCount || 0}</span>
                                                    </div>
                                                </div>
                                                <Button variant="outline" onClick={() => onViewReport(report.id)}>
                                                    <ExternalLink className="mr-2 h-4 w-4" />
                                                    Xem bài đăng
                                                </Button>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        ) : (
                            <p className="text-center text-muted-foreground py-10">Bạn chưa gửi bài tố cáo nào.</p>
                        )}
                    </div>
                </ScrollArea>
                <DialogFooter className="p-6 pt-4 border-t">
                    <Button variant="outline" onClick={onClose}>Đóng</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}