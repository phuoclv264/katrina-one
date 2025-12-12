"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Circle, Eye, UsersRound } from "lucide-react";
import type {
  MonthlyTask,
  MonthlyTaskAssignment,
  ManagedUser,
  TaskCompletionRecord,
  MediaAttachment,
} from "@/lib/types";
import { format } from "date-fns";
import { useLightbox } from "@/contexts/lightbox-context";

type TodaysAdminTasksCardProps = {
  monthlyTasks: MonthlyTask[];
  taskAssignments: MonthlyTaskAssignment[];
  staffDirectory: ManagedUser[];
};

type StaffStatus = {
  userId: string;
  userName: string;
  roleLabel?: string;
  shiftLabels: string[];
  status: "completed" | "reported" | "pending";
  completion?: TaskCompletionRecord;
};

type EnrichedTask = {
  task: MonthlyTask;
  staffStatuses: StaffStatus[];
  summary: {
    totalAssigned: number;
    completed: number;
    reported: number;
    pending: number;
  };
  rolesImpacted: string[];
  additionalReports: TaskCompletionRecord[];
};

const statusStyles: Record<StaffStatus["status"], { label: string; className: string; icon: JSX.Element }> = {
  completed: {
    label: "Đã hoàn thành",
    className: "text-emerald-600",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  reported: {
    label: "Đã báo cáo",
    className: "text-amber-600",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  pending: {
    label: "Chưa gửi",
    className: "text-muted-foreground",
    icon: <Circle className="h-4 w-4" />,
  },
};

const formatCompletionTime = (completion?: TaskCompletionRecord) => {
  if (!completion?.completedAt) {
    return null;
  }
  const completionDate = (completion.completedAt as any).toDate
    ? (completion.completedAt as any).toDate()
    : new Date(completion.completedAt as any);
  return format(completionDate, "HH:mm");
};

const buildSlides = (media: MediaAttachment[]) =>
  media.map((attachment) =>
    attachment.type === "video"
      ? {
          type: "video" as const,
          sources: [
            { src: attachment.url, type: "video/mp4" },
            { src: attachment.url, type: "video/webm" },
          ],
        }
      : { src: attachment.url },
  );

export default function TodaysAdminTasksCard({
  monthlyTasks,
  taskAssignments,
  staffDirectory,
}: TodaysAdminTasksCardProps) {
  const { openLightbox } = useLightbox();

  const staffById = useMemo(() => {
    const map = new Map<string, ManagedUser>();
    staffDirectory.forEach((staff) => map.set(staff.uid, staff));
    return map;
  }, [staffDirectory]);

  const assignmentsByTask = useMemo(() => {
    const map = new Map<string, MonthlyTaskAssignment[]>();
    taskAssignments.forEach((assignment) => {
      if (!map.has(assignment.taskId)) {
        map.set(assignment.taskId, []);
      }
      map.get(assignment.taskId)!.push(assignment);
    });
    return map;
  }, [taskAssignments]);

  const tasksForToday: EnrichedTask[] = useMemo(() => {
    if (assignmentsByTask.size === 0) {
      return [];
    }

    const definedTasks = new Map(monthlyTasks.map((task) => [task.id, task]));

    return Array.from(assignmentsByTask.entries()).map(([taskId, assignments]) => {
      const fallbackAssignment = assignments[0];
      const baseTask: MonthlyTask =
        definedTasks.get(taskId) ??
        ({
          id: taskId,
          name: fallbackAssignment?.taskName ?? "Công việc không xác định",
          description: fallbackAssignment?.description ?? "",
          appliesToRole: "Tất cả",
          schedule: { type: "weekly", daysOfWeek: [] },
        } as MonthlyTask);

      const responsibleUserMap = new Map<
        string,
        { userId: string; userName: string; shiftLabels: Set<string>; roleLabel?: string }
      >();
      const completionByUser = new Map<string, TaskCompletionRecord>();
      const additionalReports: TaskCompletionRecord[] = [];
      const rolesImpacted = new Set<string>();

      assignments.forEach((assignment) => {
        assignment.responsibleUsersByShift.forEach(({ shiftLabel, users }) => {
          users.forEach((user) => {
            const staffRole = staffById.get(user.userId)?.role;
            if (staffRole) {
              rolesImpacted.add(staffRole);
            }

            const existing = responsibleUserMap.get(user.userId);
            if (existing) {
              existing.shiftLabels.add(shiftLabel);
            } else {
              responsibleUserMap.set(user.userId, {
                userId: user.userId,
                userName: user.userName,
                shiftLabels: new Set([shiftLabel]),
                roleLabel: staffRole,
              });
            }
          });
        });

        assignment.completions.forEach((completion) => {
          const userId = completion.completedBy?.userId;
          if (userId) {
            completionByUser.set(userId, completion);
          }
        });

        assignment.otherCompletions.forEach((completion) => {
          additionalReports.push(completion);
        });
      });

      const staffStatuses: StaffStatus[] = Array.from(responsibleUserMap.values()).map(
        ({ userId, userName, shiftLabels, roleLabel }) => {
          const completion = completionByUser.get(userId);
          let status: StaffStatus["status"] = "pending";

          if (completion?.completedAt) {
            status = "completed";
          } else if (completion?.note) {
            status = "reported";
          }

          return {
            userId,
            userName,
            roleLabel,
            shiftLabels: Array.from(shiftLabels),
            status,
            completion,
          };
        },
      );

      const summary = {
        totalAssigned: staffStatuses.length,
        completed: staffStatuses.filter((status) => status.status === "completed").length,
        reported: staffStatuses.filter((status) => status.status === "reported").length,
        pending: 0,
      };
      summary.pending = Math.max(summary.totalAssigned - summary.completed - summary.reported, 0);

      const effectiveRoles = rolesImpacted.size > 0 ? Array.from(rolesImpacted) : [baseTask.appliesToRole];

      return {
        task: baseTask,
        staffStatuses,
        summary,
        rolesImpacted: effectiveRoles,
        additionalReports,
      };
    });
  }, [assignmentsByTask, monthlyTasks, staffById]);

  if (tasksForToday.length === 0) {
    return null;
  }

  const handleLightboxOpen = (media: MediaAttachment[] | undefined) => {
    if (!media || media.length === 0) {
      return;
    }
    openLightbox(buildSlides(media), 0);
  };

  const renderStaffList = (label: string, staff: StaffStatus[], status: StaffStatus["status"]) => (
    <div>
      <div className={`flex items-center gap-2 text-xs font-semibold uppercase ${statusStyles[status].className}`}>
        {statusStyles[status].icon}
        <span>{label}</span>
      </div>
      {staff.length === 0 ? (
        <p className="text-xs text-muted-foreground mt-1">Không có ghi nhận.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {staff.map((item) => (
            <div key={item.userId} className="flex items-start justify-between rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
              <div>
                <p className="text-sm font-medium">
                  {item.userName}
                  {item.roleLabel ? (
                    <span className="ml-1 text-xs text-muted-foreground">({item.roleLabel})</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">{item.shiftLabels.join(", ")}</p>
                {item.status === "reported" && item.completion?.note ? (
                  <p className="text-xs text-amber-600 mt-1">“{item.completion.note}”</p>
                ) : null}
              </div>
              <div className="flex flex-col items-end justify-between gap-1">
                {item.status === "completed" && (
                  <span className="text-xs font-semibold text-emerald-600">{formatCompletionTime(item.completion)}</span>
                )}
                {item.completion?.media && item.completion.media.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => handleLightboxOpen(item.completion?.media)}
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Xem bằng chứng
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Công việc định kỳ hôm nay</CardTitle>
        <CardDescription>Theo dõi tiến độ báo cáo của toàn bộ ca làm.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {tasksForToday.map((taskEntry) => {
          const completed = taskEntry.staffStatuses.filter((item) => item.status === "completed");
          const reported = taskEntry.staffStatuses.filter((item) => item.status === "reported");
          const pending = taskEntry.staffStatuses.filter((item) => item.status === "pending");

          return (
            <section key={taskEntry.task.id} className="rounded-2xl border bg-card shadow-sm">
              <div className="border-b px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold">{taskEntry.task.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {taskEntry.task.description || "Không có mô tả."}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <UsersRound className="h-3.5 w-3.5" />
                      {taskEntry.summary.totalAssigned} nhân sự
                    </Badge>
                    {taskEntry.rolesImpacted.map((role) => (
                      <Badge key={`${taskEntry.task.id}-${role}`} variant="outline">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase text-emerald-600">Hoàn thành</p>
                    <p className="text-2xl font-bold text-emerald-700">{taskEntry.summary.completed}</p>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase text-amber-600">Báo cáo</p>
                    <p className="text-2xl font-bold text-amber-700">{taskEntry.summary.reported}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase text-slate-500">Chưa thực hiện</p>
                    <p className="text-2xl font-bold text-slate-600">{taskEntry.summary.pending}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 px-5 py-4 lg:grid-cols-3">
                {renderStaffList("Đã hoàn thành", completed, "completed")}
                {renderStaffList("Đã báo cáo", reported, "reported")}
                {renderStaffList("Chưa gửi", pending, "pending")}
              </div>

              {taskEntry.additionalReports.length > 0 && (
                <div className="border-t bg-muted/30 px-5 py-4">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Báo cáo khác</p>
                  <div className="mt-2 space-y-2">
                    {taskEntry.additionalReports.map((report) => (
                      <div key={report.completionId ?? `${report.taskId}-${report.completedBy?.userId ?? "unknown"}`}
                        className="flex items-start justify-between rounded-lg border border-dashed border-muted px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">{report.completedBy?.userName ?? "Không xác định"}</p>
                          {report.note ? (
                            <p className="text-xs text-amber-600">“{report.note}”</p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          {report.completedAt ? (
                            <span className="text-xs font-semibold text-emerald-600">{formatCompletionTime(report)}</span>
                          ) : null}
                          {report.media && report.media.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleLightboxOpen(report.media)}
                              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Xem
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
