'use client';
import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Schedule, AssignedShift, AssignedUser, ManagedUser } from '@/lib/types';
import { AlertTriangle, CheckCircle, MinusCircle, PlusCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  proposed: Schedule | null;
  current: Schedule | null;
  explanation?: string;
  warnings?: string[];
  allUsers: ManagedUser[];
  canAccept: boolean;
  onAccept: (schedule: Schedule) => void;
};

const getUserName = (uid: string, allUsers: ManagedUser[]) => allUsers.find(u => u.uid === uid)?.displayName || uid;

const userKey = (u: AssignedUser) => u.userId;

export default function AiSchedulePreviewDialog({ isOpen, onClose, proposed, current, explanation, warnings, allUsers, canAccept, onAccept }: Props) {
  const currentById = useMemo(() => new Map((current?.shifts || []).map(s => [s.id, s])), [current]);
  const proposedById = useMemo(() => new Map((proposed?.shifts || []).map(s => [s.id, s])), [proposed]);

  const rows: { label: string; proposedShift: AssignedShift | null; currentShift: AssignedShift | null; added: AssignedUser[]; removed: AssignedUser[]; unchanged: AssignedUser[] }[] = useMemo(() => {
    const ids = new Set<string>();
    (current?.shifts || []).forEach(s => ids.add(s.id));
    (proposed?.shifts || []).forEach(s => ids.add(s.id));
    const out: any[] = [];
    ids.forEach(id => {
      const c = currentById.get(id) || null;
      const p = proposedById.get(id) || null;
      const cUsers = new Map((c?.assignedUsers || []).map(u => [userKey(u), u]));
      const pUsers = new Map((p?.assignedUsers || []).map(u => [userKey(u), u]));
      const added: AssignedUser[] = [];
      const removed: AssignedUser[] = [];
      const unchanged: AssignedUser[] = [];
      pUsers.forEach((u, k) => {
        if (!cUsers.has(k)) added.push(u); else unchanged.push(u);
      });
      cUsers.forEach((u, k) => {
        if (!pUsers.has(k)) removed.push(u);
      });
      const label = p?.label || c?.label || id;
      out.push({ label, proposedShift: p, currentShift: c, added, removed, unchanged });
    });
    return out.sort((a, b) => (a.proposedShift?.id || a.currentShift?.id || a.label).localeCompare(b.proposedShift?.id || b.currentShift?.id || b.label));
  }, [current, proposed, currentById, proposedById]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose} dialogTag="ai-schedule-preview-dialog" parentDialogTag="root">
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Xem trước lịch AI</DialogTitle>
          <DialogDescription>Kiểm tra thay đổi và phê duyệt nếu phù hợp.</DialogDescription>
        </DialogHeader>
        {explanation && (
          <div className="mb-3 p-3 border rounded-md text-sm">{explanation}</div>
        )}
        {warnings && warnings.length > 0 && (
          <div className="mb-4 p-3 border rounded-md bg-destructive/10 text-sm space-y-1">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{w}</div>
            ))}
          </div>
        )}
        <ScrollArea className="max-h-[60vh] overflow-x-auto">
          {rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Không có thay đổi để hiển thị.</div>
          ) : (
            <Table className="table-fixed w-full border">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Ca</TableHead>
                  <TableHead className="w-36">Ngày</TableHead>
                  <TableHead className="w-36">Giờ</TableHead>
                  <TableHead>Thêm</TableHead>
                  <TableHead>Bỏ</TableHead>
                  <TableHead>Giữ nguyên</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, idx) => {
                  const date = r.proposedShift?.date || r.currentShift?.date || '';
                  const time = r.proposedShift?.timeSlot || r.currentShift?.timeSlot || { start: '', end: '' };
                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-semibold">{r.label}</TableCell>
                      <TableCell>{date}</TableCell>
                      <TableCell>{time.start} - {time.end}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {r.added.length === 0 ? <Badge variant="outline" className="text-muted-foreground">Không</Badge> : r.added.map(u => (
                            <Badge key={userKey(u)} className="flex items-center gap-1"><PlusCircle className="h-3 w-3" />{getUserName(u.userId, allUsers)}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {r.removed.length === 0 ? <Badge variant="outline" className="text-muted-foreground">Không</Badge> : r.removed.map(u => (
                            <Badge key={userKey(u)} variant="destructive" className="flex items-center gap-1"><MinusCircle className="h-3 w-3" />{getUserName(u.userId, allUsers)}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {r.unchanged.length === 0 ? <Badge variant="outline" className="text-muted-foreground">Không</Badge> : r.unchanged.map(u => (
                            <Badge key={userKey(u)} variant="secondary" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" />{getUserName(u.userId, allUsers)}</Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Đóng</Button>
          <Button onClick={() => proposed && onAccept(proposed)} disabled={!canAccept || !proposed}>Đồng ý</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

