'use client';

import React, { useState } from 'react';
import { CheckCircle, Activity, ListChecks, Sunrise, Sunset } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { CustomAlertDialog } from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { cn, getInitials, generateShortName } from '@/lib/utils';

type TeamStat = { userId: string; name: string; tasksDone: number; photosTaken: number; opinionsGiven: number; isMe: boolean };

type Props = {
  shift: any;
  progressPercentage: number;
  completedTasksCount: number;
  totalTasksCount: number;
  teamStats: TeamStat[];
  isReadonly: boolean;
  isReadonlyChecked: boolean;
  syncBadge: React.ReactNode;
};

export default function ChecklistHeader({ shift, progressPercentage, completedTasksCount, totalTasksCount, teamStats, isReadonly, isReadonlyChecked, syncBadge }: Props) {
  const MAX_VISIBLE = 3;
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const visibleTeam = teamStats.slice(0, Math.min(teamStats.length, MAX_VISIBLE));
  const extraCount = teamStats.length - visibleTeam.length;

  return (
    <div className="bg-white dark:bg-slate-950 border-b">
      <div className="px-4 pt-5 pb-4 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 rotate-3">
                <ListChecks className="w-6 h-6 text-primary -rotate-3" />
              </div>
              {syncBadge && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-white animate-pulse" />
              )}
            </div>
            <div className="space-y-0.5">
              <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase italic">
                {shift.name}
              </h1>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/50 px-2 py-0.5 rounded-md">
                  {format(new Date(), 'EEEE, dd/MM', { locale: vi })}
                </p>
                {isReadonly && isReadonlyChecked && (
                  <span className="text-[9px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100 uppercase tracking-tighter shadow-sm">
                    Chỉ xem
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-baseline justify-end gap-0.5">
              <span className="text-2xl font-black text-primary leading-none">{progressPercentage}</span>
              <span className="text-[10px] font-bold text-primary/60 uppercase">%</span>
            </div>
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-tight">Tiến độ ca</p>
          </div>
        </div>

        <div className="relative px-0.5">
          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner border border-slate-200/50">
            <div
              className="h-full bg-gradient-to-r from-primary via-primary to-primary/80 shadow-[0_0_8px_rgba(var(--primary),0.3)]"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[9px] font-black text-muted-foreground/60 uppercase tracking-tighter">
            <span>BẮT ĐẦU</span>
            <div className="flex items-center gap-1 text-primary">
              <CheckCircle className="w-2.5 h-2.5" />
              <span>{completedTasksCount}/{totalTasksCount} NHIỆM VỤ</span>
            </div>
            <span>HOÀN TẤT</span>
          </div>
        </div>

        {teamStats.length > 0 && (
          <div className="pt-2 border-t border-dashed">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-primary" />
                Hoạt động nhóm
              </h3>
              <span className="text-[8px] font-bold text-primary/60 bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">LIVE</span>
            </div>
            <div className="flex items-center gap-4 max-w-full overflow-x-auto no-scrollbar -mx-4 px-4 pt-2">
              {visibleTeam.map((staff, idx) => (
                <div key={staff.userId} className="flex flex-col items-center gap-2 group">
                  <div className="relative">
                    <div className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center text-[10px] font-black transition-all border-2",
                      idx === 0
                        ? "bg-amber-500 border-amber-200 text-white shadow-lg shadow-amber-500/20 ring-4 ring-amber-500/5"
                        : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 group-hover:border-primary/30 shadow-sm"
                    )}>
                      {getInitials(staff.name)}
                    </div>
                    {idx === 0 && (
                      <div className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md border border-amber-100 animate-bounce">
                        <svg className="w-3 h-3 text-amber-500 fill-amber-500" />
                      </div>
                    )}
                    <div className={cn(
                      "absolute -bottom-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-lg flex items-center justify-center text-[8px] font-black border-2",
                      idx === 0 ? "bg-amber-600 text-white" : "bg-slate-600 text-white"
                    )}>
                      {staff.tasksDone}
                    </div>
                  </div>
                  <span className={cn(
                    "text-[9px] font-bold uppercase tracking-tight",
                    idx === 0 ? "text-amber-800" : "text-slate-500"
                  )}>
                    {staff.isMe ? "BẠN" : generateShortName(staff.name)}
                  </span>
                </div>
              ))}

              {extraCount > 0 && (
                <button type="button" onClick={() => setShowTeamDialog(true)} aria-label={`Xem ${extraCount} thành viên còn lại`} className="flex flex-col items-center gap-2 group">
                  <div className="relative">
                    <div className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center text-[10px] font-black transition-all border-2 bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 group-hover:border-primary/30 shadow-sm"
                    )}>
                      +{extraCount}
                    </div>
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-tight text-slate-500">THÊM</span>
                </button>
              )}
            </div>

            {/* Team dialog */}
            <CustomAlertDialog
              isOpen={showTeamDialog}
              onOpenChange={(open) => setShowTeamDialog(open)}
              title="Thành viên ca"
              description={
                <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-auto pt-2">
                  {teamStats.map((s, i) => (
                    <div key={s.userId} className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-900">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center text-[12px] font-black transition-all border-2",
                          i === 0 ? "bg-amber-500 border-amber-200 text-white shadow-lg" : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                        )}>
                          {getInitials(s.name)}
                        </div>
                        <div className="text-sm font-bold">{s.name}</div>
                      </div>
                      <div className="text-[12px] font-black text-slate-500 uppercase tracking-tight">
                        {s.tasksDone} NHIỆM VỤ
                      </div>
                    </div>
                  ))}
                </div>
              }
              icon={Activity}
              showConfirm={false}
              cancelText="Đóng"
            />
          </div>
        )}
      </div>
    </div>
  );
}
