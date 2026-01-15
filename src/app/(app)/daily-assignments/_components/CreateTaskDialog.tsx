'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ClipboardList, Camera, ShieldCheck, Edit, X } from 'lucide-react';
import { ManagedUser, MediaItem, DailyTaskTargetMode, UserRole } from '@/lib/types';
import { cn, normalizeSearchString } from '@/lib/utils';

type NewTaskShape = {
  title: string;
  description: string;
  assignedDate: string;
  targetMode: DailyTaskTargetMode;
  targetRoles: UserRole[];
  targetUserIds: string[];
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
};

export default function CreateTaskDialog({ isOpen, onOpenChange, newTask, setNewTask, onCreate, isCreating, setInstructionCameraOpen, allUsers, roles, isEditing }: Props) {
  const [userFilter, setUserFilter] = React.useState('');
  const filteredUsers = React.useMemo(() => {
    const q = normalizeSearchString(userFilter);
    if (!q) return allUsers;
    return allUsers.filter((u) => (
      normalizeSearchString(u.displayName || '').includes(q)
    ));
  }, [allUsers, userFilter]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => onOpenChange(open)} dialogTag="create-task-dialog" parentDialogTag="root">
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-primary px-5 py-4 text-primary-foreground relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 -ml-8 -mb-8 h-24 w-24 rounded-full bg-black/10 blur-2xl" />

          <DialogHeader className="relative z-10">
            <DialogTitle className="text-2xl sm:text-3xl font-black uppercase tracking-tight">{isEditing ? 'Chỉnh sửa nhiệm vụ' : 'Giao việc mới'}</DialogTitle>
            <DialogDescription className="text-primary-foreground/80 font-medium italic sm:not-italic text-xs sm:text-sm">
              {isEditing ? 'Cập nhật tiêu đề, mô tả, ngày hoặc ảnh hướng dẫn.' : 'Xác định nội dung, người nhận và hình ảnh hướng dẫn cho nhiệm vụ hôm nay.'}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="max-h-[58vh] sm:max-h-[64vh] overflow-y-auto px-4 py-4 sm:py-6 space-y-6 custom-scrollbar">
          {/* Section 1: Basic Info */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <div className="h-4 w-1 bg-primary rounded-full" />
              <h3 className="text-xs font-black uppercase tracking-[0.2em]">Thông tin cơ bản</h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Tiêu đề nhiệm vụ</Label>
                <Input
                  value={newTask.title}
                  onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="VD: Nhặt rác bồn cây"
                  className="h-11 bg-muted/30 border-none focus-visible:ring-primary/20 font-medium"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Ngày thực hiện</Label>
                <Input
                  type="date"
                  value={newTask.assignedDate}
                  onChange={(e) => setNewTask((prev) => ({ ...prev, assignedDate: e.target.value }))}
                  className="h-11 bg-muted/30 border-none focus-visible:ring-primary/20 font-bold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Mô tả chi tiết</Label>
              <Textarea
                rows={3}
                value={newTask.description}
                onChange={(e) => setNewTask((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Nêu rõ các bước thực hiện, tiêu chuẩn đánh giá..."
                className="resize-none bg-muted/30 border-none focus-visible:ring-primary/20 min-h-[100px]"
              />
            </div>
          </section>

          {/* Section 2: Targeting & Media */}
          <div className="grid gap-6 sm:grid-cols-2">
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <div className="h-4 w-1 bg-primary rounded-full" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em]">Người nhận việc</h3>
              </div>

              <div className="flex p-1 bg-muted/50 rounded-xl w-fit border border-muted-foreground/5">
                <Button
                  variant={newTask.targetMode === 'roles' ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn("h-8 text-[10px] font-black uppercase tracking-wider px-4 rounded-lg", newTask.targetMode === 'roles' && "shadow-sm")}
                  onClick={() => setNewTask((prev) => ({ ...prev, targetMode: 'roles' }))}
                >
                  Vai trò
                </Button>
                <Button
                  variant={newTask.targetMode === 'users' ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn("h-8 text-[10px] font-black uppercase tracking-wider px-4 rounded-lg", newTask.targetMode === 'users' && "shadow-sm")}
                  onClick={() => setNewTask((prev) => ({ ...prev, targetMode: 'users' }))}
                >
                  Nhân viên
                </Button>
              </div>

              {newTask.targetMode === 'users' && (
                <div className="flex items-center gap-2 mb-2">
                  <Input
                    placeholder="Tìm nhân viên hoặc vai trò..."
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="h-9 bg-muted/20 border-none"
                  />
                  {userFilter && (
                    <Button size="sm" variant="ghost" className="h-9" onClick={() => setUserFilter('')}>
                      Xóa
                    </Button>
                  )}
                </div>
              )}

              <div className="max-h-48 overflow-y-auto rounded-2xl border bg-muted/10 p-2 space-y-1 custom-scrollbar">
                {newTask.targetMode === 'roles' ? (
                  roles.map((role) => (
                    <label key={role} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-background transition-all cursor-pointer group hover:shadow-sm border border-transparent hover:border-muted-foreground/10">
                      <div className="relative flex items-center justify-center">
                        <input
                          type="checkbox"
                          className="peer h-5 w-5 rounded-md border-muted-foreground/30 text-primary transition-all focus:ring-primary checked:bg-primary"
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
                      <span className="font-semibold text-foreground/70 group-hover:text-primary transition-colors">{role}</span>
                    </label>
                  ))
                ) : (
                  (filteredUsers.length === 0 ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">Không tìm thấy nhân viên.</div>
                  ) : (
                    filteredUsers.map((u, i) => (
                      <label key={u.uid || `user-${i}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-background transition-all cursor-pointer group hover:shadow-sm border border-transparent hover:border-muted-foreground/10">
                        <input
                          type="checkbox"
                          className="h-5 w-5 rounded-md border-muted-foreground/30 text-primary transition-all focus:ring-primary"
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
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground/80 group-hover:text-primary transition-colors">{u.displayName}</span>
                          <span className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">{u.role}</span>
                        </div>
                      </label>
                    ))
                  ))
                )}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <div className="h-4 w-1 bg-primary rounded-full" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em]">Ảnh hướng dẫn</h3>
              </div>

              <div
                onClick={() => setInstructionCameraOpen(true)}
                className={cn(
                  "relative flex aspect-square sm:aspect-auto sm:h-full min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all overflow-hidden group",
                  newTask.media.length > 0
                    ? "border-primary/40 bg-primary/5"
                    : "border-muted-foreground/20 bg-muted/10 hover:bg-muted/20 hover:border-primary/30"
                )}
              >
                {newTask.media.length > 0 ? (
                  <div className="space-y-1 text-center animate-in zoom-in-95 duration-300">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
                      <Camera className="h-6 w-6" />
                    </div>
                    <span className="text-3xl font-black text-primary leading-tight">{newTask.media.length}</span>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70">Hình ảnh đính kèm</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-full bg-muted/20 p-4 text-muted-foreground group-hover:scale-110 group-hover:text-primary group-hover:bg-primary/10 transition-all duration-300 mb-2">
                      <Camera className="h-7 w-7" />
                    </div>
                    <p className="text-[11px] font-bold text-muted-foreground/60 text-center px-6 uppercase tracking-wider group-hover:text-primary/70 transition-colors">Chụp ảnh/Video hướng dẫn</p>
                  </>
                )}
              </div>
            </section>
          </div>
        </div>

        <DialogFooter className="bg-muted/30 px-4 py-3 flex-col sm:flex-row gap-2">
          <DialogClose asChild>
            <Button variant="ghost" className="h-11 font-bold text-muted-foreground hover:bg-transparent hover:text-foreground">
              Hủy bỏ
            </Button>
          </DialogClose>
          <Button
            onClick={onCreate}
            disabled={isCreating}
            className="h-11 min-w-[180px] font-black uppercase tracking-wider text-xs shadow-xl shadow-primary/20"
          >
            {isCreating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              isEditing ? <Edit className="mr-2 h-5 w-5" /> : <ShieldCheck className="mr-2 h-5 w-5" />
            )}
            {isEditing ? 'Lưu thay đổi' : 'Xác nhận giao việc'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
