'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
  DialogAction,
  DialogCancel
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Camera, ShieldCheck, Edit, FileText, Users, Image as ImageIcon, Search, Calendar, ChevronRight, X, Video, Upload, Clock } from 'lucide-react';
import { ManagedUser, MediaItem, DailyTaskTargetMode, UserRole, ShiftTemplate } from '@/lib/types';
import { cn, advancedSearch } from '@/lib/utils';
import Image from 'next/image';
import { toast } from '@/components/ui/pro-toast';
import { v4 as uuidv4 } from 'uuid';
import { photoStore } from '@/lib/photo-store';
import { dataStore } from '@/lib/data-store';

export function getFileTypeFromMime(mime: string): 'photo' | 'video' {
  if (mime.startsWith('video/')) return 'video';
  return 'photo';
}

type NewTaskShape = {
  title: string;
  description: string;
  assignedDate: string;
  targetMode: DailyTaskTargetMode;
  targetRoles: UserRole[];
  targetUserIds: string[];
  shiftPreferences: string[];
  media: MediaItem[];
};

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  newTask: NewTaskShape;
  setNewTask: React.Dispatch<React.SetStateAction<NewTaskShape>>;
  onCreate: () => Promise<void> | void;
  isCreating: boolean;
  setInstructionCameraOpen: (open: boolean) => void;
  allUsers: ManagedUser[];
  roles: UserRole[];
  isEditing?: boolean;
  parentDialogTag: string;
};

export default function CreateTaskDialog({
  isOpen,
  onOpenChange,
  newTask,
  setNewTask,
  onCreate,
  isCreating,
  setInstructionCameraOpen,
  allUsers,
  roles,
  isEditing,
  parentDialogTag
}: Props) {
  const [userFilter, setUserFilter] = React.useState('');
  const [shiftLabels, setShiftLabels] = React.useState<string[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Fetch shift templates and extract unique labels
  React.useEffect(() => {
    const unsubscribe = dataStore.subscribeToShiftTemplates((templates: ShiftTemplate[]) => {
      const labels = Array.from(new Set(templates.map((t) => t.label)));
      setShiftLabels(labels);
    });
    return () => unsubscribe();
  }, []);

  const filteredUsers = React.useMemo(() => {
    if (!userFilter) return allUsers;
    return advancedSearch(allUsers, userFilter, ['displayName', 'role']);
  }, [allUsers, userFilter]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const photoFiles = files.filter(f => f.type.startsWith('image/'));
    const videoFiles = files.filter(f => f.type.startsWith('video/'));

    if (videoFiles.length > 0) {
      toast.error(`Không hỗ trợ tải lên ${videoFiles.length} video. Chỉ được chọn ảnh.`);
    }

    if (photoFiles.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      const newMedia: MediaItem[] = await Promise.all(
        photoFiles.map(async (file) => {
          const id = uuidv4();
          const url = URL.createObjectURL(file);
          await photoStore.addPhoto(id, file);

          return {
            id,
            type: 'photo',
            url,
          };
        })
      );

      setNewTask((prev) => ({
        ...prev,
        media: [...prev.media, ...newMedia],
      }));

      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success(`Đã thêm ${photoFiles.length} ảnh.`);
    } catch (error) {
      console.error('Error handling file upload:', error);
      toast.error('Lỗi khi xử lý tệp tin.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange} dialogTag="create-task-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader variant="premium" iconkey={isEditing ? "edit" : "event"}>
           <DialogTitle className="text-2xl font-black uppercase tracking-tight">
             {isEditing ? 'Chỉnh sửa nhiệm vụ' : 'Giao việc mới'}
           </DialogTitle>
           <DialogDescription className="font-medium">
             {isEditing 
               ? 'Cập nhật nội dung, thời gian hoặc người thực hiện nhiệm vụ.' 
               : 'Xác định nội dung, người nhận và hướng dẫn cho nhiệm vụ hôm nay.'}
           </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6 py-6">
           {/* Section 1: Basic Info */}
           <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                 <div className="bg-primary/10 p-1.5 rounded-lg">
                    <FileText className="h-4 w-4 text-primary" />
                 </div>
                 <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Thông tin chung</h3>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Tiêu đề nhiệm vụ</Label>
                  <Input
                    value={newTask.title}
                    onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="VD: Nhặt rác bồn cây"
                    className="h-12 bg-muted/30 border-none focus-visible:ring-primary/20 font-bold rounded-2xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Ngày thực hiện</Label>
                  <div className="relative">
                    <Input
                      type="date"
                      value={newTask.assignedDate}
                      onChange={(e) => setNewTask((prev) => ({ ...prev, assignedDate: e.target.value }))}
                      className="h-12 bg-muted/30 border-none focus-visible:ring-primary/20 font-bold rounded-2xl pl-10"
                    />
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Mô tả chi tiết</Label>
                <Textarea
                  rows={3}
                  value={newTask.description}
                  onChange={(e) => setNewTask((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Nêu rõ các bước thực hiện, tiêu chuẩn đánh giá..."
                  className="resize-none bg-muted/30 border-none focus-visible:ring-primary/20 min-h-[100px] rounded-2xl p-4"
                />
              </div>
           </div>

           {/* Section 2: Targeting, Shift Preference & Media */}
           <div className="grid gap-6 sm:grid-cols-3 pt-2">
             <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                   <div className="bg-primary/10 p-1.5 rounded-lg">
                      <Users className="h-4 w-4 text-primary" />
                   </div>
                   <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Người nhận việc</h3>
                </div>

                <div className="flex p-1 bg-muted/50 rounded-[1.25rem] w-full border border-muted-foreground/5 shadow-inner">
                  <button
                    onClick={() => setNewTask((prev) => ({ ...prev, targetMode: 'roles' }))}
                    className={cn(
                      "flex-1 h-10 text-[10px] font-black uppercase tracking-wider rounded-2xl transition-all",
                      newTask.targetMode === 'roles' ? "bg-white text-primary shadow-sm" : "text-muted-foreground/60 hover:text-muted-foreground"
                    )}
                  >
                    Vai trò
                  </button>
                  <button
                    onClick={() => setNewTask((prev) => ({ ...prev, targetMode: 'users' }))}
                    className={cn(
                      "flex-1 h-10 text-[10px] font-black uppercase tracking-wider rounded-2xl transition-all",
                      newTask.targetMode === 'users' ? "bg-white text-primary shadow-sm" : "text-muted-foreground/60 hover:text-muted-foreground"
                    )}
                  >
                    Nhân viên
                  </button>
                </div>

                {newTask.targetMode === 'users' && (
                  <div className="relative group">
                    <Input
                      placeholder="Tìm nhân viên..."
                      value={userFilter}
                      onChange={(e) => setUserFilter(e.target.value)}
                      className="h-10 bg-muted/20 border-none rounded-xl pl-9"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}

                <div className="h-48 overflow-y-auto rounded-2xl border border-muted/20 bg-muted/5 p-2 space-y-1 custom-scrollbar">
                  {newTask.targetMode === 'roles' ? (
                     roles.map((role) => (
                       <label key={role} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-white transition-all cursor-pointer group hover:shadow-sm border border-transparent hover:border-muted/50">
                         <div className="relative flex items-center justify-center">
                            <input
                              type="checkbox"
                              className="peer h-5 w-5 rounded-lg border-muted/30 text-primary transition-all focus:ring-primary checked:bg-primary"
                              checked={(newTask.targetRoles || []).includes(role)}
                              onChange={(e) => {
                                setNewTask((prev) => {
                                  const current = prev.targetRoles || [];
                                  const next = e.target.checked
                                    ? Array.from(new Set([...current, role]))
                                    : current.filter((r) => r !== role);
                                  return { ...prev, targetRoles: next };
                                });
                              }}
                            />
                         </div>
                         <span className="font-bold text-foreground/70 group-hover:text-primary transition-colors">{role}</span>
                         <ChevronRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-40" />
                       </label>
                     ))
                  ) : (
                    filteredUsers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full py-4 text-center">
                        <Users className="h-8 w-8 text-muted/20 mb-1" />
                        <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Không có nhân viên</p>
                      </div>
                    ) : (
                      filteredUsers.map((u, i) => (
                        <label key={u.uid || `user-${i}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-white transition-all cursor-pointer group hover:shadow-sm border border-transparent hover:border-muted/50">
                          <input
                            type="checkbox"
                            className="h-5 w-5 rounded-lg border-muted/30 text-primary transition-all focus:ring-primary"
                            checked={newTask.targetUserIds.includes(u.uid)}
                            onChange={(e) => {
                              setNewTask((prev) => {
                                const current = prev.targetUserIds;
                                const next = e.target.checked
                                  ? Array.from(new Set([...current, u.uid]))
                                  : current.filter((id) => id !== u.uid);
                                return { ...prev, targetUserIds: next };
                              });
                            }}
                          />
                          <div className="flex flex-col leading-tight">
                            <span className="font-bold text-foreground/80 group-hover:text-primary transition-colors">{u.displayName}</span>
                            <span className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-tighter italic">{u.role}</span>
                          </div>
                        </label>
                      ))
                    )
                  )}
                </div>
             </div>

             <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                   <div className="bg-primary/10 p-1.5 rounded-lg">
                      <Clock className="h-4 w-4 text-primary" />
                   </div>
                   <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Ca hiển thị</h3>
                </div>
                <p className="text-[10px] text-muted-foreground/60 font-medium px-1 -mt-2">Để trống = hiển thị với tất cả ca</p>
                <div className="h-48 overflow-y-auto rounded-2xl border border-muted/20 bg-muted/5 p-2 space-y-1 custom-scrollbar">
                  {shiftLabels.length === 0 ? (
                    <div className="flex items-center justify-center h-full py-4 text-center">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
                    </div>
                  ) : (
                    shiftLabels.map((label) => (
                    <label key={label} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-white transition-all cursor-pointer group hover:shadow-sm border border-transparent hover:border-muted/50">
                      <input
                        type="checkbox"
                        className="h-5 w-5 rounded-lg border-muted/30 text-primary transition-all focus:ring-primary"
                        checked={(newTask.shiftPreferences || []).includes(label)}
                        onChange={(e) => {
                          setNewTask((prev) => {
                            const current = prev.shiftPreferences || [];
                            const next = e.target.checked
                              ? Array.from(new Set([...current, label]))
                              : current.filter((l) => l !== label);
                            return { ...prev, shiftPreferences: next };
                          });
                        }}
                      />
                      <span className="font-bold text-foreground/70 group-hover:text-primary transition-colors">{label}</span>
                    </label>
                    ))
                  )}
                </div>
             </div>

             <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                   <div className="bg-primary/10 p-1.5 rounded-lg">
                      <ImageIcon className="h-4 w-4 text-primary" />
                   </div>
                   <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Ảnh hướng dẫn</h3>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {newTask.media.map((item, idx) => (
                    <div key={item.id || idx} className="relative aspect-square rounded-2xl overflow-hidden group/item border border-muted-foreground/10 bg-muted/20">
                      {item.type === 'video' ? (
                        <div className="w-full h-full flex items-center justify-center bg-slate-900">
                          <Video className="h-8 w-8 text-white/50" />
                        </div>
                      ) : (
                        <Image
                          src={item.url || ''}
                          alt="Instruction"
                          fill
                          className="object-cover transition-transform group-hover/item:scale-105"
                          unoptimized={item.url?.startsWith('blob:')}
                        />
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setNewTask(prev => ({
                            ...prev,
                            media: prev.media.filter((_, i) => i !== idx)
                          }));
                        }}
                        className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md opacity-0 group-hover/item:opacity-100 transition-opacity hover:bg-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}

                  <div className="col-span-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setInstructionCameraOpen(true)}
                      className="flex-1 flex flex-col items-center justify-center gap-2 h-24 rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 transition-all group"
                    >
                      <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-white shadow-sm group-hover:scale-110 transition-transform text-primary">
                        <Camera className="h-5 w-5" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary/70 group-hover:text-primary transition-colors">Chụp ảnh</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 flex flex-col items-center justify-center gap-2 h-24 rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/20 hover:bg-muted/30 hover:border-muted-foreground/30 transition-all group"
                    >
                      <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-white shadow-sm group-hover:scale-110 transition-transform text-muted-foreground">
                        <Upload className="h-5 w-5" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 group-hover:text-muted-foreground transition-colors">Tải ảnh lên</span>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileUpload}
                        accept="image/*"
                        multiple
                      />
                    </button>
                  </div>
                </div>
             </div>
           </div>
        </DialogBody>

        <DialogFooter className="bg-muted/30 border-t border-muted-foreground/10 py-6">
           <DialogCancel className="bg-white border-muted/50">Hủy bỏ</DialogCancel>
           <DialogAction 
             onClick={onCreate} 
             isLoading={isCreating}
             className="min-w-[180px] shadow-lg shadow-primary/20"
           >
             {isEditing ? <Edit className="mr-2 h-5 w-5" /> : <ShieldCheck className="mr-2 h-5 w-5" />}
             {isEditing ? 'Lưu thay đổi' : 'Xác nhận'}
           </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
