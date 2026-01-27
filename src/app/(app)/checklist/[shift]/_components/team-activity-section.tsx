'use client';

import { useState, useMemo } from 'react';
import { ShiftReport, Task, CompletionRecord } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, ChevronDown, ChevronUp, Clock, CheckCircle, User, Camera, MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, getInitials } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface TeamActivitySectionProps {
  otherStaffReports: ShiftReport[];
  allTasks: Task[];
  className?: string;
  onExpand?: () => void;
  hasNewActivity?: boolean;
}

interface ActivityItem {
  staffName: string;
  userId: string;
  taskId: string;
  taskText: string;
  taskType: 'photo' | 'boolean' | 'opinion';
  completions: CompletionRecord[];
  isCritical?: boolean;
}

export default function TeamActivitySection({ 
  otherStaffReports, 
  allTasks,
  className,
  onExpand,
  hasNewActivity = false
}: TeamActivitySectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = () => {
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);
    if (newExpandedState && onExpand) {
      onExpand();
    }
  };

  // Aggregate all activities from other staff
  const activities = useMemo(() => {
    const activityList: ActivityItem[] = [];

    otherStaffReports.forEach(report => {
      Object.entries(report.completedTasks).forEach(([taskId, completions]) => {
        const task = allTasks.find(t => t.id === taskId);
        if (task && completions.length > 0) {
          activityList.push({
            staffName: report.staffName,
            userId: report.userId,
            taskId,
            taskText: task.text,
            taskType: task.type,
            completions: completions as CompletionRecord[],
            isCritical: task.isCritical,
          });
        }
      });
    });

    // Sort by most recent completion first
    activityList.sort((a, b) => {
      const latestA = a.completions[0]?.timestamp || '00:00';
      const latestB = b.completions[0]?.timestamp || '00:00';
      return latestB.localeCompare(latestA);
    });

    return activityList;
  }, [otherStaffReports, allTasks]);

  const totalStaffWorking = otherStaffReports.length;
  const totalTasksCompleted = activities.length;

  // Calculate coverage statistics
  const taskCoverage = useMemo(() => {
    const taskCompletionMap = new Map<string, number>();
    
    activities.forEach(activity => {
      const current = taskCompletionMap.get(activity.taskId) || 0;
      taskCompletionMap.set(activity.taskId, current + 1);
    });

    const wellCoveredTasks = Array.from(taskCompletionMap.values()).filter(count => count >= 2).length;
    const criticalTasksCovered = activities.filter(a => a.isCritical).reduce((acc, a) => {
      acc.add(a.taskId);
      return acc;
    }, new Set<string>()).size;

    return {
      wellCoveredTasks,
      criticalTasksCovered,
      totalUniqueTasks: taskCompletionMap.size,
    };
  }, [activities]);

  if (totalStaffWorking === 0) {
    return null;
  }

  // Use shared getInitials util

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'photo': return <Camera className="w-3 h-3" />;
      case 'boolean': return <CheckCircle className="w-3 h-3" />;
      case 'opinion': return <MessageSquare className="w-3 h-3" />;
      default: return null;
    }
  };

  return (
    <Card className={cn("border-2 border-blue-200 bg-blue-50/50 overflow-hidden relative", className)}>
      {hasNewActivity && !isExpanded && (
        <div className="absolute top-2 right-2 z-10">
          <div className="relative">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <div className="absolute inset-0 w-3 h-3 bg-red-500 rounded-full animate-ping" />
          </div>
        </div>
      )}
      <CardHeader 
        className="p-4 cursor-pointer hover:bg-blue-100/50 transition-colors"
        onClick={handleToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-blue-900 uppercase tracking-tight">
                Đồng đội đang làm việc
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-[10px] font-bold">
                  {totalStaffWorking} người
                </Badge>
                <Badge variant="secondary" className="text-[10px] font-bold">
                  {taskCoverage.totalUniqueTasks} việc
                </Badge>
                {taskCoverage.criticalTasksCovered > 0 && (
                  <Badge variant="outline" className="text-[9px] font-bold border-amber-500 text-amber-700">
                    ⚠ {taskCoverage.criticalTasksCovered} quan trọng
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            className="rounded-xl"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <CardContent className="p-4 pt-0">
              {/* Staff Summary */}
              <div className="mb-4 flex flex-wrap gap-2">
                {otherStaffReports.map(report => (
                  <div 
                    key={report.userId}
                    className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-blue-200"
                  >
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="text-[10px] font-bold bg-blue-500 text-white">
                        {getInitials(report.staffName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-semibold text-blue-900">
                      {report.staffName}
                    </span>
                    <Badge variant="outline" className="text-[9px] ml-1">
                      {Object.keys(report.completedTasks).length} việc
                    </Badge>
                  </div>
                ))}
              </div>

              {/* Activity Timeline */}
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {activities.map((activity, index) => (
                    <motion.div
                      key={`${activity.userId}-${activity.taskId}-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        "bg-white rounded-xl p-3 border-l-4 shadow-sm",
                        activity.isCritical ? "border-l-amber-500" : "border-l-blue-500"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="w-8 h-8 mt-0.5">
                          <AvatarFallback className="text-[10px] font-bold bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                            {getInitials(activity.staffName)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-blue-900">
                              {activity.staffName}
                            </span>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              {getTaskIcon(activity.taskType)}
                              <Clock className="w-3 h-3" />
                              <span className="font-semibold">
                                {activity.completions[0]?.timestamp}
                              </span>
                            </div>
                          </div>
                          
                          <p className={cn(
                            "text-xs font-medium text-slate-700 leading-relaxed",
                            activity.isCritical && "text-amber-900"
                          )}>
                            {activity.taskText}
                          </p>

                          {/* Show completion details */}
                          {activity.completions.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {activity.taskType === 'boolean' && activity.completions[0].value !== undefined && (
                                <Badge 
                                  variant={activity.completions[0].value ? "default" : "secondary"}
                                  className="text-[9px]"
                                >
                                  {activity.completions[0].value ? '✓ Đã làm' : '✗ Chưa làm'}
                                </Badge>
                              )}
                              {activity.taskType === 'photo' && (
                                <Badge variant="secondary" className="text-[9px]">
                                  <Camera className="w-3 h-3 mr-1" />
                                  {(activity.completions[0].photos?.length || 0) + (activity.completions[0].photoIds?.length || 0)} ảnh
                                </Badge>
                              )}
                              {activity.taskType === 'opinion' && activity.completions[0].opinion && (
                                <div className="bg-slate-50 rounded-lg p-2 mt-2 border border-slate-200">
                                  <p className="text-[11px] text-slate-600 italic">
                                    "{activity.completions[0].opinion}"
                                  </p>
                                </div>
                              )}
                              {/* Show multiple completions if any */}
                              {activity.completions.length > 1 && (
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  +{activity.completions.length - 1} lần làm khác
                                </p>
                              )}
                            </div>
                          )}

                          {activity.isCritical && (
                            <Badge variant="outline" className="text-[9px] mt-2 border-amber-500 text-amber-700">
                              ⚠ Quan trọng
                            </Badge>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
