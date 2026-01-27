'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TaskItem } from '../../../_components/task-item';
import { CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type Props = {
  shift: any;
  report: any;
  otherStaffReports: any[];
  activeTab: string;
  setActiveTab: (v: string) => void;
  expandedTaskIds: Set<string>;
  toggleExpandTask: (id: string) => void;
  handleBooleanTaskAction: (taskId: string, value: boolean) => void;
  handlePhotoTaskAction: (task: any, completionIndex?: number | null) => void;
  handleOpinionTaskAction: (task: any) => void;
  handleNoteTaskAction: (task: any) => void;
  handleDeletePhoto: any;
  handleDeleteCompletion: any;
  onOpenLightbox: any;
  isReadonly: boolean;
  isSubmitting: boolean;
};

export default function ChecklistTabs({ shift, report, otherStaffReports, activeTab, setActiveTab, expandedTaskIds, toggleExpandTask, handleBooleanTaskAction, handlePhotoTaskAction, handleOpinionTaskAction, handleNoteTaskAction, handleDeletePhoto, handleDeleteCompletion, onOpenLightbox, isReadonly, isSubmitting }: Props) {

  const renderCompletionIndicator = (taskId: string, sectionTitle: string) => {
    const task = shift.sections.flatMap((s: any) => s.tasks).find((t: any) => t.id === taskId);
    const min = task?.minCompletions || 1;
    const isCritical = task?.isCritical;
    // count how many OTHER users meet or exceed the min requirement
    const otherUsersCompleted = otherStaffReports.reduce((sum, r) => sum + (((r.completedTasks?.[taskId]?.length || 0) >= min) ? 1 : 0), 0);
    const selfCompleted = ((report.completedTasks?.[taskId]?.length || 0) >= min);

    // If other staff completed the task, show the social indicator (existing behaviour)
    if (otherUsersCompleted > 0) {
      return (
        <>
          {/* Social Status (Top-Right): How many other staff members completed this */}
          {otherUsersCompleted === 1 ? (
            <div className="absolute -top-1.5 -right-1.5 z-20 pointer-events-none">
              <div className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-sky-500 text-white shadow-sm border-2 border-white animate-in zoom-in-50 duration-300">
                <CheckCircle className="w-3.5 h-3.5" />
              </div>
            </div>
          ) : (
            <div className="absolute -top-1.5 -right-1.5 z-20 pointer-events-none">
              <div className="inline-flex items-center justify-center h-5 min-w-[22px] px-1.5 rounded-full bg-sky-500 text-white text-[10px] font-black shadow-sm border-2 border-white animate-in zoom-in-50 duration-300">
                {otherUsersCompleted}
              </div>
            </div>
          )}
        </>
      );
    }

    // NEW: if nobody else completed it and the current user hasn't either, show an "undone" badge (!)
    if (otherUsersCompleted === 0 && !selfCompleted) {
      return (
        <div className="absolute -top-1.5 -right-1.5 z-20 pointer-events-none" role="img" aria-label="Chưa hoàn thành" title="Chưa hoàn thành">
          <div
            className={cn(
              "inline-flex items-center justify-center h-5 w-5 rounded-full text-white shadow-sm border-2 border-white transform-gpu will-change-transform motion-reduce:animate-none",
              isCritical
                ? "bg-amber-600 font-extrabold animate-[zoom-in-out_900ms_ease-in-out_infinite]"
                : "bg-amber-500/95 animate-[zoom-in-out_1200ms_ease-in-out_infinite]"
            )}
          >
            <span className="text-[11px] font-extrabold leading-none">!</span>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
      <TabsList className="sticky top-14 md:top-0 z-30 flex w-full h-12 p-1.5 bg-background/60 backdrop-blur-xl rounded-2xl border shadow-sm gap-1.5">
        {shift.sections.map((section: any) => (
          <TabsTrigger
            key={section.title}
            value={section.title}
            className="flex-1 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all duration-300
                  data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/25
                  data-[state=inactive]:text-muted-foreground/70 data-[state=inactive]:hover:bg-muted/50"
          >
            {section.title}
          </TabsTrigger>
        ))}
      </TabsList>

      {shift.sections.map((section: any) => {
        const sectionTasks = section.tasks.filter((t: any) => t.type !== 'opinion');
        const sectionOpinions = section.tasks.filter((t: any) => t.type === 'opinion');

        return (
          <TabsContent key={section.title} value={section.title} className="mt-0 focus-visible:outline-none">
            <div className="space-y-">
              {sectionTasks.length > 0 && (
                <div className="flex gap-3">
                  <div className="flex-1 flex flex-col gap-3">
                    {sectionTasks.filter((_: any, idx: number) => idx % 2 === 0).map((task: any) => {
                      const minCompletions = task.minCompletions || 1;
                      const isCompleted = (report.completedTasks[task.id]?.length || 0) >= minCompletions;

                      const otherStaffCompletions = otherStaffReports.map(staffReport => ({
                        staffName: staffReport.staffName,
                        userId: staffReport.userId,
                        completions: (staffReport.completedTasks[task.id] || [])
                      }));

                      // determine social/self completion for this task (used to show attention ring only when truly undone)
                      const otherUsersCompletedForTask = otherStaffReports.reduce((sum, r) => sum + (((r.completedTasks?.[task.id]?.length || 0) >= minCompletions) ? 1 : 0), 0);
                      const selfCompletedForTask = (report.completedTasks?.[task.id]?.length || 0) >= minCompletions;

                      return (
                          <div key={task.id} className="relative">
                            {renderCompletionIndicator(task.id, section.title)}
                            <TaskItem
                            task={task}
                            completions={(report.completedTasks[task.id] || [])}
                            onBooleanAction={handleBooleanTaskAction}
                            onPhotoAction={handlePhotoTaskAction}
                            onOpinionAction={handleOpinionTaskAction}
                            onNoteAction={handleNoteTaskAction}
                            onDeletePhoto={handleDeletePhoto}
                            onDeleteCompletion={handleDeleteCompletion}
                            onToggleExpand={toggleExpandTask}
                            isReadonly={isReadonly || isSubmitting}
                            isExpanded={expandedTaskIds.has(task.id)}
                            isSingleCompletion={section.title !== 'Trong ca' ? true : false}
                            onOpenLightbox={onOpenLightbox}
                            otherStaffCompletions={otherStaffCompletions}
                            className={cn(
                              "w-full border-[1.5px] transition-all duration-300 rounded-2xl",
                              isCompleted
                                ? "border-green-500/30 bg-white shadow-[0_4px_12px_rgba(34,197,94,0.08)]"
                                : task.isCritical
                                  ? "border-amber-500/60 bg-amber-50/50 shadow-[0_8px_20px_rgba(245,158,11,0.2)] ring-2 ring-amber-500/10 active:scale-[0.98]"
                                  : `${otherUsersCompletedForTask === 0 && !selfCompletedForTask ? 'border-slate-300 bg-white shadow-[0_8px_20px_rgba(0,0,0,0.05)] ring-amber-500/10 active:scale-[0.98]' : ''}`
                            )}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex-1 flex flex-col gap-3">
                    {sectionTasks.filter((_: any, idx: number) => idx % 2 === 1).map((task: any) => {
                      const minCompletions = task.minCompletions || 1;
                      const isCompleted = (report.completedTasks[task.id]?.length || 0) >= minCompletions;

                      const otherStaffCompletions = otherStaffReports.map(staffReport => ({
                        staffName: staffReport.staffName,
                        userId: staffReport.userId,
                        completions: (staffReport.completedTasks[task.id] || [])
                      }));

                      // determine social/self completion for this task (used to show attention ring only when truly undone)
                      const otherUsersCompletedForTask = otherStaffReports.reduce((sum, r) => sum + (((r.completedTasks?.[task.id]?.length || 0) >= minCompletions) ? 1 : 0), 0);
                      const selfCompletedForTask = (report.completedTasks?.[task.id]?.length || 0) >= minCompletions;

                      return (
                        <div key={task.id} className="relative">
                          {renderCompletionIndicator(task.id, section.title)}
                          <TaskItem
                            task={task}
                            completions={(report.completedTasks[task.id] || [])}
                            onBooleanAction={handleBooleanTaskAction}
                            onPhotoAction={handlePhotoTaskAction}
                            onOpinionAction={handleOpinionTaskAction}
                            onNoteAction={handleNoteTaskAction}
                            onDeletePhoto={handleDeletePhoto}
                            onDeleteCompletion={handleDeleteCompletion}
                            onToggleExpand={toggleExpandTask}
                            isReadonly={isReadonly || isSubmitting}
                            isExpanded={expandedTaskIds.has(task.id)}
                            isSingleCompletion={section.title !== 'Trong ca' ? true : false}
                            onOpenLightbox={onOpenLightbox}
                            otherStaffCompletions={otherStaffCompletions}
                            className={cn(
                              "w-full border-[1.5px] transition-all duration-300 rounded-2xl",
                              isCompleted
                                ? "border-green-500/30 bg-white shadow-[0_4px_12px_rgba(34,197,94,0.08)]"
                                : task.isCritical
                                  ? "border-amber-500/60 bg-amber-50/50 shadow-[0_8px_20px_rgba(245,158,11,0.2)] ring-2 ring-amber-500/10 active:scale-[0.98]"
                                  : `${otherUsersCompletedForTask === 0 && !selfCompletedForTask ? 'border-slate-300 bg-white shadow-[0_8px_20px_rgba(0,0,0,0.05)] ring-amber-500/10 active:scale-[0.98]' : ''}`
                            )}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {sectionOpinions.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 px-1">
                    <h3 className="text-sm font-bold text-amber-700 uppercase tracking-tight">Báo cáo & Sự cố</h3>
                  </div>
                  <div className="space-y-3">
                    {sectionOpinions.map((task: any) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        completions={(report.completedTasks[task.id] || [])}
                        onPhotoAction={handlePhotoTaskAction}
                        onBooleanAction={handleBooleanTaskAction}
                        onOpinionAction={handleOpinionTaskAction}
                        onNoteAction={handleNoteTaskAction}
                        onDeleteCompletion={handleDeleteCompletion}
                        onDeletePhoto={handleDeletePhoto}
                        onToggleExpand={toggleExpandTask}
                        isReadonly={isReadonly || isSubmitting}
                        isExpanded={expandedTaskIds.has(task.id)}
                        isSingleCompletion={false}
                        onOpenLightbox={onOpenLightbox}
                        otherStaffCompletions={otherStaffReports.map(staffReport => ({ staffName: staffReport.staffName, userId: staffReport.userId, completions: (staffReport.completedTasks[task.id] || []) }))}
                        className="bg-white border-amber-200 shadow-[0_4px_12px_rgba(245,158,11,0.08)] rounded-2xl"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
