'use client';
import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { UserMultiSelect } from '@/components/user-multi-select';
import { Loader2, Wand2, Paperclip, Camera, X } from 'lucide-react';
import type { ManagedUser, WhistleblowingReport } from '@/lib/types';
import { refineText } from '@/ai/flows/refine-text-flow';
import { toast } from 'react-hot-toast';
import { photoStore } from '@/lib/photo-store';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import CameraDialog from '@/components/camera-dialog';


type ReportDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any, id?: string) => Promise<void>;
    allUsers: ManagedUser[];
    reportToEdit?: WhistleblowingReport | null;
};

export default function ReportDialog({ isOpen, onClose, onSave, allUsers, reportToEdit }: ReportDialogProps) {
    const isEditMode = !!reportToEdit;

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [accusedUsers, setAccusedUsers] = useState<ManagedUser[]>([]);
    const [isAnonymous, setIsAnonymous] = useState(true);
    const [visibility, setVisibility] = useState<'public' | 'private'>('private');
    
    // Photo state
    const [existingAttachments, setExistingAttachments] = useState<string[]>([]);
    const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
    const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
    
    const [isSaving, setIsSaving] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (isEditMode) {
                setTitle(reportToEdit.title);
                setContent(reportToEdit.content);
                setAccusedUsers(reportToEdit.accusedUsers);
                setIsAnonymous(reportToEdit.isAnonymous);
                setVisibility(reportToEdit.visibility);
                setExistingAttachments(reportToEdit.attachments || []);
            } else {
                setTitle('');
                setContent('');
                setAccusedUsers([]);
                setIsAnonymous(true);
                setVisibility('private');
                setExistingAttachments([]);
            }
             // Always reset local photos
            setAttachmentIds([]);
            attachmentUrls.forEach(URL.revokeObjectURL);
            setAttachmentUrls([]);
        }
    }, [isOpen, reportToEdit, isEditMode]);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files) return;
        const files = Array.from(event.target.files);
        const newAttachments: { id: string, url: string }[] = [];

        for (const file of files) {
            const id = uuidv4();
            await photoStore.addPhoto(id, file);
            const url = URL.createObjectURL(file);
            newAttachments.push({ id, url });
        }
        setAttachmentIds(prev => [...prev, ...newAttachments.map(a => a.id)]);
        setAttachmentUrls(prev => [...prev, ...newAttachments.map(a => a.url)]);
    };
    
    const handleCameraCapture = async (photoIds: string[]) => {
        setIsCameraOpen(false);
        const urls: string[] = [];
        for (const id of photoIds) {
            const blob = await photoStore.getPhoto(id);
            if(blob) {
                urls.push(URL.createObjectURL(blob));
            }
        }
        setAttachmentIds(prev => [...prev, ...photoIds]);
        setAttachmentUrls(prev => [...prev, ...urls]);
    };

    const handleDeleteAttachment = async (urlToDelete: string, isExisting: boolean) => {
        if (isExisting) {
            setExistingAttachments(prev => prev.filter(url => url !== urlToDelete));
        } else {
            const index = attachmentUrls.indexOf(urlToDelete);
            if (index > -1) {
                const idToDelete = attachmentIds[index];
                setAttachmentUrls(prev => prev.filter(url => url !== urlToDelete));
                setAttachmentIds(prev => prev.filter(id => id !== idToDelete));
                URL.revokeObjectURL(urlToDelete);
                await photoStore.deletePhoto(idToDelete);
            }
        }
    };


    const handleRefineContent = async () => {
        if (!title.trim() && !content.trim()) return;
        setIsAiLoading(true);
        try {
            const { refinedTitle, refinedContent } = await refineText({ title, content });
            setTitle(refinedTitle);
            setContent(refinedContent);
            toast.success('Đã chuốt lại câu từ!');
        } catch (error) {
            toast.error('Không thể chuốt lại câu từ lúc này.');
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleSave = async () => {
        if (!title.trim() || !content.trim()) {
            toast.error("Vui lòng nhập tiêu đề và nội dung.");
            return;
        }
        setIsSaving(true);

        const data = {
            title,
            content,
            accusedUsers: accusedUsers,
            isAnonymous,
            visibility,
            attachmentIds,
            existingAttachments, // Pass existing attachments for update logic
        };

        await onSave(data, reportToEdit?.id);
        setIsSaving(false);
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[625px] bg-white dark:bg-card p-0 h-[90vh] flex flex-col">
                <DialogHeader className="p-4 sm:p-6 pb-2 shrink-0">
                    <DialogTitle>{isEditMode ? 'Chỉnh sửa bài đăng' : 'Tạo bài tố cáo mới'}</DialogTitle>
                    <DialogDescription>
                       {isEditMode ? 'Thực hiện các thay đổi cho bài đăng của bạn.' : 'Mọi thông tin sẽ được bảo mật theo lựa chọn của bạn.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-grow overflow-y-auto px-4 py-2">
                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <Label>Người bị tố cáo</Label>
                            <UserMultiSelect users={allUsers} selectedUsers={accusedUsers} onChange={setAccusedUsers} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="title">Tiêu đề</Label>
                            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={isSaving || isAiLoading}/>
                        </div>
                        <div className="space-y-2 relative">
                            <Label htmlFor="content">Nội dung</Label>
                            <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} rows={6} disabled={isSaving || isAiLoading}/>
                        </div>
                        <Button variant="outline" onClick={handleRefineContent} disabled={isAiLoading || (!title.trim() && !content.trim())} className="w-full justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:hover:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800">
                            {isAiLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Wand2 className="h-4 w-4" />}
                            Chuốt lại câu từ bằng AI
                        </Button>
                        <div className="space-y-2">
                            <Label>Đính kèm</Label>
                            <div className="flex flex-col sm:flex-row items-center gap-2">
                                <Button asChild variant="outline" size="sm" className="w-full">
                                    <label htmlFor="file-upload"><Paperclip className="mr-2 h-4 w-4"/>Chọn file</label>
                                </Button>
                                <input id="file-upload" type="file" multiple className="hidden" onChange={handleFileChange} />
                                <Button variant="outline" size="sm" onClick={() => setIsCameraOpen(true)} className="w-full">
                                    <Camera className="mr-2 h-4 w-4"/> Chụp ảnh
                                </Button>
                            </div>
                            {(existingAttachments.length > 0 || attachmentUrls.length > 0) && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {existingAttachments.map((url) => (
                                        <div key={url} className="relative w-20 h-20">
                                            <Image src={url} alt="Existing attachment" fill className="object-cover rounded-md"/>
                                            <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5 rounded-full" onClick={() => handleDeleteAttachment(url, true)}><X className="h-3 w-3"/></Button>
                                        </div>
                                    ))}
                                    {attachmentUrls.map((url) => (
                                        <div key={url} className="relative w-20 h-20">
                                            <Image src={url} alt="Attachment preview" fill className="object-cover rounded-md"/>
                                            <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5 rounded-full" onClick={() => handleDeleteAttachment(url, false)}><X className="h-3 w-3"/></Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                 <DialogFooter className="flex-col sm:flex-row sm:justify-between items-center w-full p-4 border-t shrink-0">
                    <div className="flex flex-col sm:flex-col gap-y-2 gap-x-4 items-start w-full mb-4 sm:mb-0">
                        <div className="flex items-center space-x-2">
                            <Switch id="anonymous-mode" checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                            <Label htmlFor="anonymous-mode" className="whitespace-normal">Gửi ẩn danh</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch id="visibility-mode" checked={visibility === 'private'} onCheckedChange={(checked) => setVisibility(checked ? 'private' : 'public')} />
                            <Label htmlFor="visibility-mode" className="whitespace-normal">Chỉ gửi cho Chủ nhà hàng</Label>
                        </div>
                    </div>
                    <div className="flex gap-2 self-end w-full sm:w-auto">
                        <Button variant="outline" onClick={onClose} disabled={isSaving} className="w-full sm:w-auto">Hủy</Button>
                        <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            {isEditMode ? 'Lưu thay đổi' : 'Gửi'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
         <CameraDialog 
            isOpen={isCameraOpen}
            onClose={() => setIsCameraOpen(false)}
            onSubmit={handleCameraCapture}
        />
        </>
    );
}
