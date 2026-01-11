 'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Users, Clock, CheckCircle2, Info, MessageSquare, ListFilter, ClipboardCheck } from 'lucide-react';
import { useLightbox } from '@/contexts/lightbox-context';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { AssignedShift, ManagedUser, Schedule, ShiftBusyEvidence, UserRole } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getRoleColor, userMatchesRole, toDate, buildSlides } from './understaffed-evidence-utils';

// Re-export dialog for backward compatibility
export { UnderstaffedEvidenceDialog } from './understaffed-evidence-dialog';

interface UnderstaffedEvidencePanelProps {
  schedule: Schedule | null;
  allUsers: ManagedUser[];
  evidences: ShiftBusyEvidence[];
}

export function UnderstaffedEvidencePanel({ schedule, allUsers, evidences }: UnderstaffedEvidencePanelProps) {
  const { openLightbox } = useLightbox();

  const understaffedShifts = useMemo<AssignedShift[]>(() => {
    if (!schedule) return [];
    return (schedule.shifts || [])
      .filter((shift) => {
        const minUsers = shift.minUsers ?? 0;
        const lackingMin = minUsers > 0 && shift.assignedUsers.length < minUsers;
        const reqs = shift.requiredRoles || [];
        const lackingReq = reqs.some(req => {
          const assignedOfRole = shift.assignedUsers.filter(au => {
            const user = allUsers.find(u => u.uid === au.userId);
            return user?.role === req.role;
          }).length;
          return assignedOfRole < req.count;
        });
        return lackingMin || lackingReq;
      })
      .sort((a, b) => {
        if (a.date === b.date) {
          return a.timeSlot.start.localeCompare(b.timeSlot.start);
        }
        return a.date.localeCompare(b.date);
      });
  }, [schedule]);

  if (understaffedShifts.length === 0) {
    return null;
  }
  const UnderstaffedList = (
    <div className="space-y-4">
      {understaffedShifts.map((shift) => {
        const shiftEvidences = evidences.filter((entry) => entry.shiftId === shift.id);
        const reqs = shift.requiredRoles || [];
        // calculate missing per role
        const missingByRole = reqs.map(req => {
          const assignedOfRole = shift.assignedUsers.filter(au => {
            const user = allUsers.find(u => u.uid === au.userId);
            return user?.role === req.role;
          }).length;
          return { role: req.role, missing: Math.max(0, req.count - assignedOfRole) };
        });
        const totalMissing = missingByRole.reduce((s, r) => s + r.missing, 0) || Math.max(0, (shift.minUsers ?? 0) - shift.assignedUsers.length);
        // eligible users are those whose role is among required roles (or all if none specified)
        const eligibleUsers = reqs.length > 0 ? allUsers.filter(user => reqs.some(r => userMatchesRole(user, r.role))) : allUsers.filter((user) => userMatchesRole(user, shift.role));
        const pendingUsers = eligibleUsers.filter((user) => !shiftEvidences.some((entry) => entry.submittedBy.userId === user.uid));
        const shiftDate = parseISO(shift.date);

        return (
          <div key={shift.id} className="rounded-lg border p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold">{shift.label}</h3>
                  <Badge className={getRoleColor(shift.role)}>{shift.role}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {format(shiftDate, 'eeee, dd/MM', { locale: vi })} · {shift.timeSlot.start} - {shift.timeSlot.end}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="destructive" className="text-xs">
                  Thiếu {totalMissing} người
                </Badge>
                {missingByRole.length > 0 && missingByRole.map(mr => mr.missing > 0 && (
                  <Badge key={mr.role} variant="destructive" className="text-xs">
                    {mr.missing}× {mr.role}
                  </Badge>
                ))}
                <Badge variant="outline" className="text-xs">
                  Đã báo bận: {shiftEvidences.length}/{eligibleUsers.length}
                </Badge>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <p className="text-sm font-medium">Báo bận đã gửi</p>
                {shiftEvidences.length === 0 ? (
                  <p className="text-sm italic text-muted-foreground">Chưa có nhân viên nào báo bận.</p>
                ) : (
                  <div className="mt-2 space-y-3">
                    {shiftEvidences.map((entry) => {
                      const submittedAt = toDate(entry.submittedAt);
                      const mediaSlides = entry.media ? buildSlides(entry.media) : [];
                      return (
                        <div key={entry.id} className="rounded-md border p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span>{entry.submittedBy.userName}</span>
                            </div>
                            {submittedAt && (
                              <span className="text-xs text-muted-foreground">{format(submittedAt, 'HH:mm dd/MM')}</span>
                            )}
                          </div>
                          <p className="mt-2 text-sm leading-relaxed">{entry.message}</p>
                          {entry.media && entry.media.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-3">
                              {entry.media.map((attachment, index) => (
                                <Button
                                  key={attachment.url}
                                  variant="outline"
                                  size="sm"
                                  className="h-24 w-24 overflow-hidden rounded-md border"
                                  onClick={() => openLightbox(mediaSlides, index)}
                                >
                                  {attachment.type === 'photo' ? (
                                    <Image src={attachment.url} alt="Bằng chứng" width={88} height={88} className="h-full w-full object-cover" />
                                  ) : (
                                    <video src={`${attachment.url}#t=0.1`} className="h-full w-full object-cover" muted playsInline />
                                  )}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-medium">Nhân viên chưa báo bận</p>
                {pendingUsers.length === 0 ? (
                  <p className="text-sm italic text-muted-foreground">Tất cả nhân viên liên quan đã phản hồi.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pendingUsers.map((user) => (
                      <Badge key={user.uid} variant="outline" className="text-xs">
                        {user.displayName}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-amber-500" /> Các ca đang thiếu nhân sự
        </CardTitle>
        <CardDescription>Kiểm tra lý do bận của nhân viên và theo dõi ai chưa phản hồi.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{UnderstaffedList}</CardContent>
    </Card>
  );
}

