
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
    CardFooter,
} from '@/components/ui/card';
import {
    ChevronLeft,
    ChevronRight,
    Send,
    CheckCircle,
    FileSignature,
    Settings,
    History,
    ChevronsDownUp,
    Save,
    MailQuestion,
    UserPlus,
    Loader2,
    FileX2,
    AlertTriangle,
} from 'lucide-react';
import {
    getISOWeek,
    startOfWeek,
    endOfWeek,
    addDays,
    format,
    eachDayOfInterval,
    isSameDay,
    getDay,
    isSameWeek,
    isWithinInterval,
    parseISO,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Schedule, AssignedShift, Availability, ManagedUser, ShiftTemplate, Notification, UserRole, AssignedUser } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { toast } from 'react-hot-toast';
import ShiftAssignmentDialog from './shift-assignment-popover'; // Renaming this import for clarity, but it's the right file
import ShiftTemplatesDialog from './shift-templates-dialog';
import TotalHoursTracker from './total-hours-tracker';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import HistoryAndReportsDialog from './history-reports-dialog';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import isEqual from 'lodash.isequal';
import { Badge } from '@/components/ui/badge';
import PassRequestsDialog from '../../schedule/_components/pass-requests-dialog';
import UserDetailsDialog from './user-details-dialog';
import { isUserAvailable, hasTimeConflict } from '@/lib/schedule-utils';


// Helper function to abbreviate names
const generateSmartAbbreviations = (users: ManagedUser[]): Map<string, string> => {
    const abbreviations = new Map<string, string>();
    const usersByLastName = new Map<string, ManagedUser[]>();

    // Group users by their last name (first name in Vietnamese context)
    users.forEach(user => {
        const nameParts = user.displayName.trim().split(/\s+/);
        if (nameParts.length > 0) {
            const lastName = nameParts[nameParts.length - 1];
            if (!usersByLastName.has(lastName)) {
                usersByLastName.set(lastName, []);
            }
            usersByLastName.get(lastName)!.push(user);
        }
    });

    for (const [lastName, userGroup] of usersByLastName.entries()) {
        if (userGroup.length === 1 && ![...usersByLastName.keys()].some(key => key !== lastName && key.includes(lastName))) {
            // If the last name is unique across all users, just use the last name
            abbreviations.set(userGroup[0].uid, lastName);
        } else {
            // If last names are duplicated, generate abbreviations
            userGroup.forEach(user => {
                const nameParts = user.displayName.trim().split(/\s+/);
                // Start with just the last name
                let currentAbbr = lastName;
                // Iterate backwards from the second to last part of the name
                for (let i = nameParts.length - 2; i >= 0; i--) {
                    const candidateAbbr = `${nameParts[i].charAt(0).toUpperCase()}.${currentAbbr}`;
                    
                    // Check if this new abbreviation already exists for another user in the group
                    const isDuplicate = userGroup.some(otherUser => {
                         if (otherUser.uid === user.uid) return false; // Don't compare with self
                         const otherParts = otherUser.displayName.trim().split(/\s+/);
                         let otherAbbr = otherParts[otherParts.length - 1];
                         for(let j = otherParts.length - 2; j >= i; j--) {
                            otherAbbr = `${otherParts[j].charAt(0).toUpperCase()}.${otherAbbr}`;
                         }
                         return otherAbbr === candidateAbbr;
                    });
                    
                    currentAbbr = candidateAbbr;
                    if (!isDuplicate) {
                        break; // This abbreviation is unique within the group, we can stop
                    }
                }
                 abbreviations.set(user.uid, currentAbbr);
            });
        }
    }

    return abbreviations;
};


const roleOrder: Record<UserRole, number> = {
  'Phục vụ': 1,
  'Pha chế': 2,
  'Thu ngân': 3,
  'Quản lý': 4,
  'Chủ nhà hàng': 5,
};


export default function ScheduleView() {
    const { user } = useAuth();
    const isMobile = useIsMobile();
    
    const getInitialDate = () => {
        const today = new Date();
        const dayOfWeek = getDay(today); // Sunday = 0, Saturday = 6
        if (dayOfWeek === 6 || dayOfWeek === 0) { // If it's Saturday or Sunday
            return addDays(today, 7); // Show next week
        }
        return today; // Otherwise, show this week
    };

    const [currentDate, setCurrentDate] = useState(getInitialDate());
    
    const [serverSchedule, setServerSchedule] = useState<Schedule | null>(null);
    const [localSchedule, setLocalSchedule] = useState<Schedule | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    const [availability, setAvailability] = useState<Availability[]>([]);
    const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
    const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [processingNotificationId, setProcessingNotificationId] = useState<string | null>(null);


    const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
    const [activeShift, setActiveShift] = useState<AssignedShift | null>(null);
    const [activeNotification, setActiveNotification] = useState<Notification | null>(null);


    const [isTemplatesDialogOpen, setIsTemplatesDialogOpen] = useState(false);
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
    const [isPassRequestsDialogOpen, setIsPassRequestsDialogOpen] = useState(false);
    
    const [isUserDetailsDialogOpen, setIsUserDetailsDialogOpen] = useState(false);
    const [selectedUserForDetails, setSelectedUserForDetails] = useState<ManagedUser | null>(null);
    
    const [isHandlingConflict, setIsHandlingConflict] = useState(false);
    const [conflictDialog, setConflictDialog] = useState<{ isOpen: boolean; oldRequest: Notification | null; newRequestFn: () => void }>({ isOpen: false, oldRequest: null, newRequestFn: () => {} });

    const weekInterval = useMemo(() => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = endOfWeek(currentDate, { weekStartsOn: 1 });
        return { start, end };
    }, [currentDate]);

    const daysOfWeek = useMemo(() => eachDayOfInterval(weekInterval), [weekInterval]);

    const [openMobileDays, setOpenMobileDays] = useState<string[]>(
        () => daysOfWeek.map(day => format(day, 'yyyy-MM-dd'))
    );


    const weekId = useMemo(() => `${currentDate.getFullYear()}-W${getISOWeek(currentDate)}`, [currentDate]);

    const canManage = useMemo(() => user?.role === 'Quản lý' || user?.role === 'Chủ nhà hàng', [user]);
    
    const [showPublishConfirm, setShowPublishConfirm] = useState(false);
    const [showRevertConfirm, setShowRevertConfirm] = useState(false);
    const [showAdminActionConfirm, setShowAdminActionConfirm] = useState(false);

    useEffect(() => {
        if (!user || !canManage) return;

        setIsLoading(true);
        const unsubSchedule = dataStore.subscribeToSchedule(weekId, (newSchedule) => {
            setServerSchedule(newSchedule);
            setLocalSchedule(newSchedule);
            setHasUnsavedChanges(false);
            setIsLoading(false);
        });

        const unsubAvailability = dataStore.subscribeToAvailabilityForWeek(weekId, (newAvailability) => {
            setAvailability(newAvailability);
        });


        const unsubUsers = dataStore.subscribeToUsers(setAllUsers);
        const unsubTemplates = dataStore.subscribeToShiftTemplates((templates) => {
            const sortedTemplates = templates.sort((a, b) => a.timeSlot.start.localeCompare(b.timeSlot.start));
            setShiftTemplates(sortedTemplates);
        });

        const unsubNotifications = dataStore.subscribeToAllNotifications(setNotifications);


        return () => {
            unsubSchedule();
            unsubAvailability();
            unsubUsers();
            unsubTemplates();
            unsubNotifications();
        };

    }, [user, weekId, canManage]);
    
    // Check for unsaved changes before leaving the page
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = ''; // Required for legacy browsers
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);


    const handleLocalScheduleUpdate = useCallback((data: Partial<Schedule>) => {
        setLocalSchedule(prev => {
            const baseSchedule = prev ?? {
                weekId,
                status: 'draft',                
                shifts: [],
            };
            const newSchedule = { ...baseSchedule, ...data };
            // Only compare the shifts array for unsaved changes
            setHasUnsavedChanges(!isEqual(newSchedule.shifts, serverSchedule?.shifts || []));
            return newSchedule;
        });
    }, [serverSchedule, weekId]);

    // Auto-populate shifts from templates, refreshing them from the latest templates.
    useEffect(() => {
        if (!shiftTemplates.length || localSchedule?.status === 'published') return;
    
        const baseSchedule = localSchedule ?? { weekId, status: 'draft', shifts: [] };
        
        const daysInWeek = eachDayOfInterval({start: startOfWeek(currentDate, {weekStartsOn: 1}), end: endOfWeek(currentDate, {weekStartsOn: 1})})
        
        const newShiftsFromTemplates: AssignedShift[] = [];
        daysInWeek.forEach(day => {
            const dayOfWeek = getDay(day);
            const dateKey = format(day, 'yyyy-MM-dd');
    
            shiftTemplates.forEach(template => {
                if ((template.applicableDays || []).includes(dayOfWeek)) {
                    // Try to find an existing shift in the current local schedule
                    const existingShift = baseSchedule.shifts.find(s => s.date === dateKey && s.templateId === template.id);
                    
                    newShiftsFromTemplates.push({
                        id: `shift_${dateKey}_${template.id}`,
                        templateId: template.id,
                        date: dateKey,
                        label: template.label,
                        role: template.role,
                        timeSlot: template.timeSlot,
                        minUsers: template.minUsers ?? 0,
                        assignedUsers: existingShift ? existingShift.assignedUsers : [],
                    });
                }
            });
        });
    
        const sortedNewShifts = [...newShiftsFromTemplates].sort((a,b) => a.id.localeCompare(b.id));
        const sortedLocalShifts = [...baseSchedule.shifts].sort((a,b) => a.id.localeCompare(b.id));

        if (!isEqual(sortedNewShifts, sortedLocalShifts)) {
             const newFullSchedule = { ...baseSchedule, shifts: newShiftsFromTemplates };
             // This syncs up both local and "server" state after auto-population, preventing false "unsaved changes" flags.
             setLocalSchedule(newFullSchedule);
             setServerSchedule(newFullSchedule);
             setHasUnsavedChanges(false);
        }
    
    }, [localSchedule, shiftTemplates, weekId, currentDate]);


    const handleDateChange = (direction: 'next' | 'prev') => {
        if (hasUnsavedChanges) {
            if (!window.confirm("Bạn có các thay đổi chưa được lưu. Bạn có chắc muốn chuyển tuần?")) {
                return;
            }
        }
        setCurrentDate(current => addDays(current, direction === 'next' ? 7 : -7));
    };
    
    const handleUpdateShiftAssignment = useCallback(async (shiftId: string, newAssignedUsers: {userId: string, userName: string}[]) => {
        if (!user) return;
        const baseSchedule = localSchedule ?? {
            weekId,
            status: 'draft',
            shifts: [],
        };

        // If this update comes from resolving a pass request
        if (activeNotification && activeNotification.payload.shiftId === shiftId) {
            const userToAssign = newAssignedUsers[0]; // In pass assignment mode, we only assign one user
            if (userToAssign) {
                setProcessingNotificationId(activeNotification.id);
                try {
                    await dataStore.resolvePassRequestByAssignment(activeNotification, userToAssign, user);
                    toast.success(`Đã chỉ định ca cho ${userToAssign.userName}.`);
                } catch (error: any) {
                    toast.error(`Không thể chỉ định ca: ${error.message}`);
                } finally {
                    setProcessingNotificationId(null);
                    setActiveNotification(null);
                }
                return; 
            }
            setActiveNotification(null);
        }
        
        let updatedShifts;
        const shiftExists = baseSchedule.shifts.some(s => s.id === shiftId);

        if (shiftExists) {
            updatedShifts = baseSchedule.shifts.map(shift => 
                shift.id === shiftId ? { ...shift, assignedUsers: newAssignedUsers } : shift
            );
        } else {
             const newShift = createShiftFromId(shiftId);
             if (newShift) {
                newShift.assignedUsers = newAssignedUsers;
                updatedShifts = [...baseSchedule.shifts, newShift];
            } else {
                updatedShifts = [...baseSchedule.shifts];
            }
        }
        handleLocalScheduleUpdate({ ...baseSchedule, shifts: updatedShifts });
    }, [localSchedule, handleLocalScheduleUpdate, activeNotification, weekId, user]);

    const handleSaveChanges = async () => {
        if (!localSchedule || !hasUnsavedChanges) return;
        setIsSubmitting(true);
        try {
            await dataStore.updateSchedule(weekId, localSchedule);
            toast.success("Lịch làm việc đã được cập nhật.");
            setHasUnsavedChanges(false);
            setServerSchedule(localSchedule); // Sync server state with local
        } catch (error) {
            console.error("Failed to save changes:", error);
            toast.error('Không thể lưu thay đổi.');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleCreateDraft = async () => {
        if (!user) return;
        setIsSubmitting(true);
        try {
            const newSchedule: Schedule = {
                weekId,
                status: 'draft',
                shifts: [], // It will be populated by the useEffect for templates
            };
            await dataStore.updateSchedule(weekId, newSchedule);
            // The onSnapshot listener will then pick up this new schedule and update the state.
            toast.success('Đã tạo lịch nháp mới cho tuần.');
        } catch (error) {
            console.error("Failed to create draft schedule:", error);
            toast.error('Không thể tạo lịch nháp.');
        } finally {
            setIsSubmitting(false);
        }
    }

    const createShiftFromId = (shiftId: string): AssignedShift | null => {
        const parts = shiftId.split('_');
        if (parts.length < 3) return null;
        const [_, dateKey, ...templateIdParts] = parts;
        const templateId = templateIdParts.join('_');
        
        const template = shiftTemplates.find(t => t.id === templateId);
        if (!template) return null;

        return {
            id: shiftId,
            templateId: template.id,
            date: dateKey,
            label: template.label,
            role: template.role,
            timeSlot: template.timeSlot,
            assignedUsers: [],
            minUsers: template.minUsers,
        };
    };
    
    const handleOpenAssignmentDialog = (shift: AssignedShift, notification: Notification | null = null) => {
        setActiveShift(shift);
        setActiveNotification(notification);
        setIsAssignmentDialogOpen(true);
    };

    const handleUpdateStatus = async (newStatus: Schedule['status']) => {
        if (!localSchedule || !user) return;
    
        if (newStatus === 'published' && hasUnsavedChanges) {
            if (!window.confirm("Bạn có thay đổi chưa lưu. Công bố sẽ lưu các thay đổi này và phát hành lịch. Bạn có muốn tiếp tục?")) {
                return;
            }
        }
    
        setShowPublishConfirm(false);
        setShowRevertConfirm(false);
        setShowAdminActionConfirm(false);
        setIsSubmitting(true);
    
        try {
            const dataToUpdate = { ...localSchedule, status: newStatus };
            await dataStore.updateSchedule(weekId, dataToUpdate);
            toast.success(`Đã cập nhật trạng thái lịch thành: ${newStatus}`);
            setHasUnsavedChanges(false);
    
            if (newStatus === 'published' && user.role === 'Chủ nhà hàng') {
                const nextWeekDate = addDays(currentDate, 7);
                await dataStore.createDraftScheduleForNextWeek(nextWeekDate, shiftTemplates);
                toast.success('Lịch cho tuần kế tiếp đã được tự động tạo.');
            }
    
        } catch (error) {
            console.error("Failed to update schedule status:", error);
            toast.error('Không thể cập nhật trạng thái lịch.');
        } finally {
            setIsSubmitting(false);
        }
    }
    
    const availabilityByDay = useMemo(() => {
        const grouped: { [key: string]: Availability[] } = {};
         if (availability) {
            for (const avail of availability) {
                if (!grouped[format(new Date(avail.date as string), 'yyyy-MM-dd')]) {
                    grouped[format(new Date(avail.date as string), 'yyyy-MM-dd')] = [];
                }
                grouped[format(new Date(avail.date as string), 'yyyy-MM-dd')].push(avail);
            }
        }
        return grouped;
    }, [availability]);

    const handleToggleAllMobileDays = () => {
        if (openMobileDays.length === daysOfWeek.length) {
            setOpenMobileDays([]);
        } else {
            setOpenMobileDays(daysOfWeek.map(day => format(day, 'yyyy-MM-dd')));
        }
    };
    
    const handleCancelPassRequest = async (notificationId: string) => {
        if (!user) return;
        setProcessingNotificationId(notificationId);
        try {
            await dataStore.updateNotificationStatus(notificationId, 'cancelled', user);
             toast.success('Đã hủy yêu cầu pass ca của bạn.');
        } catch (error: any) {
             toast.error('Không thể hủy yêu cầu.');
        } finally {
            setProcessingNotificationId(null);
        }
    }
    
     const handleRevertRequest = async (notification: Notification) => {
        if (!user) return;
        setProcessingNotificationId(notification.id);
         try {
            await dataStore.revertPassRequest(notification, user);
            toast.success('Đã hoàn tác yêu cầu pass ca thành công.');
        } catch (error) {
            console.error(error);
            toast.error('Không thể hoàn tác yêu cầu.');
        } finally {
            setProcessingNotificationId(null);
        }
    }

    const handleTakeShift = async (notification: Notification) => {
        if (!user || !localSchedule) return;
        
        setProcessingNotificationId(notification.id);
        
        try {
            const acceptingUser: AssignedUser = { userId: user.uid, userName: user.displayName };
            
            await dataStore.acceptPassShift(notification.id, notification.payload, acceptingUser, localSchedule);

            // Optimistic update UI
            setNotifications(prevNotifs => prevNotifs.map(n => {
                if (n.id === notification.id) {
                    return {
                        ...n,
                        status: 'pending_approval',
                        payload: {
                            ...n.payload,
                            takenBy: acceptingUser
                        }
                    };
                }
                return n;
            }));

            toast.success('Yêu cầu nhận ca đã được gửi đi và đang chờ quản lý phê duyệt.');
        } catch (error: any) {
            console.error("Failed to take shift:", error);
            toast.error(error.message);
        } finally {
            setProcessingNotificationId(null);
        }
    }
    
    const handleDeclineShift = async (notification: Notification) => {
        if (!user) return;
        setProcessingNotificationId(notification.id);
        try {
            await dataStore.declinePassShift(notification, { uid: user.uid, displayName: user.displayName });
            toast.success('Đã từ chối. Bạn sẽ không thấy lại yêu cầu này.');
        } catch (error: any) {
            toast.error('Không thể từ chối yêu cầu.');
        } finally {
            setProcessingNotificationId(null);
        }
    }

    const handleApproveRequest = async (notification: Notification) => {
        if (!user || !localSchedule) return;
        setProcessingNotificationId(notification.id);
        try {
            await dataStore.approvePassRequest(notification, user);
            toast.success('Đã phê duyệt yêu cầu đổi ca.');
        } catch (error: any)
{
            console.error(error);
            let errorMessage = 'Không thể phê duyệt yêu cầu.';
            if (error instanceof Error) {
                if (error.message.includes('SHIFT_CONFLICT:')) {
                    errorMessage = error.message.replace('SHIFT_CONFLICT:', '').trim();
                } else if (error.message.includes('ALREADY_RESOLVED:')) {
                    errorMessage = error.message.replace('ALREADY_RESOLVED:', '').trim();
                } else {
                    errorMessage = error.message;
                }
            }
            toast.error(errorMessage);
        } finally {
            setProcessingNotificationId(null);
        }
    }
    
    const handleRejectApproval = async (notificationId: string) => {
        if (!user) return;
        setProcessingNotificationId(notificationId);
        try {
            await dataStore.rejectPassRequestApproval(notificationId, user);
            toast.success('Yêu cầu đổi ca đã được trả lại.');
        } catch (error: any) {
            console.error(error);
            toast.error('Không thể từ chối yêu cầu.');
        } finally {
            setProcessingNotificationId(null);
        }
    }

    const handleAssignShift = (notification: Notification) => {
        const schedule = localSchedule ?? { weekId, status: 'draft', shifts: [] };
        const shiftToAssign = schedule.shifts.find(s => s.id === notification.payload.shiftId);
        if (shiftToAssign) {
            handleOpenAssignmentDialog(shiftToAssign, notification);
        } else {
             toast.error('Không tìm thấy ca làm việc để chỉ định.');
        }
    }

    const pendingRequestCount = useMemo(() => {
        if (!notifications || !user || !canManage) return 0;
        return notifications.filter(n =>
            (n.type === 'pass_request') &&
            (n.status === 'pending' || n.status === 'pending_approval') &&
            isWithinInterval(parseISO(n.payload.shiftDate), weekInterval)
        ).length;
    }, [notifications, weekInterval, user, canManage]);

    const handleUserClick = (user: ManagedUser) => {
        setSelectedUserForDetails(user);
        setIsUserDetailsDialogOpen(true);
    };

    const getRoleColor = (role: UserRole | 'Bất kỳ'): string => {
        switch (role) {
            case 'Phục vụ': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700';
            case 'Pha chế': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700';
            case 'Thu ngân': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700';
            case 'Quản lý': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-700';
            default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600';
        }
    };
    
    const dailyShiftCounts = useMemo(() => {
        if (!localSchedule) return new Map<string, Map<string, number>>();
        const counts = new Map<string, Map<string, number>>();
        daysOfWeek.forEach(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dailyCounts = new Map<string, number>();
            const shiftsOnDay = localSchedule.shifts.filter(s => s.date === dateKey);
            shiftsOnDay.forEach(shift => {
                shift.assignedUsers.forEach(assignedUser => {
                    const userDetails = allUsers.find(u => u.uid === assignedUser.userId);
                    if (userDetails && userDetails.role !== 'Quản lý' && userDetails.role !== 'Chủ nhà hàng') {
                       dailyCounts.set(assignedUser.userId, (dailyCounts.get(assignedUser.userId) || 0) + 1);
                    }
                });
            });
            counts.set(dateKey, dailyCounts);
        });
        return counts;
    }, [localSchedule, daysOfWeek, allUsers]);

    const userAbbreviations = useMemo(() => generateSmartAbbreviations(allUsers), [allUsers]);

    if (isLoading) {
        return (
            <div className="container mx-auto max-w-7xl p-4 sm:p-6 md:p-8">
                <Skeleton className="h-12 w-1/2 mb-4" />
                <Skeleton className="h-[60vh] w-full" />
            </div>
        )
    }
    
    const canEditSchedule = localSchedule?.status === 'draft' || user?.role === 'Chủ nhà hàng';
    const isCurrentWeek = isSameWeek(currentDate, new Date(), { weekStartsOn: 1 });
    const areAllMobileDaysOpen = openMobileDays.length === daysOfWeek.length;

    // Logic for the Floating Action Button
    let fabAction: (() => void) | null = null;
    let fabIcon: React.ReactNode | null = null;
    let fabLabel: string | null = null;
    let isFabVisible = false;
    let isPublishAction = false;

    if (hasUnsavedChanges) {
        fabAction = handleSaveChanges;
        fabIcon = <Save className="h-6 w-6" />;
        fabLabel = 'Lưu thay đổi';
        isFabVisible = true;
    } else if (user?.role === 'Quản lý' && localSchedule?.status === 'draft') {
        fabAction = () => handleUpdateStatus('proposed');
        fabIcon = <Send className="h-6 w-6" />;
        fabLabel = 'Đề xuất lịch';
        isFabVisible = true;
    } else if (user?.role === 'Chủ nhà hàng' && (localSchedule?.status === 'draft' || localSchedule?.status === 'proposed')) {
        fabAction = () => setShowPublishConfirm(true);
        fabIcon = <CheckCircle className="h-6 w-6" />;
        fabLabel = 'Công bố lịch';
        isFabVisible = true;
        isPublishAction = true;
    }

    const renderUserBadge = (assignedUser: AssignedUser, dateKey: string, shiftObject: AssignedShift) => {
        const userDetails = allUsers.find(u => u.uid === assignedUser.userId);
        if (!userDetails) return null;

        if (user?.role !== 'Chủ nhà hàng' && !user?.displayName.includes('Không chọn')) {
            if (userDetails.role === 'Chủ nhà hàng' || userDetails.displayName.includes('Không chọn')) {
                return null;
            }
        }
        
        const userRole = userDetails.role;
        const userAvailability = availabilityByDay[dateKey];
        const isBusy = userAvailability ? !isUserAvailable(assignedUser.userId, shiftObject.timeSlot, userAvailability) : false;
        const shiftCount = dailyShiftCounts.get(dateKey)?.get(assignedUser.userId) || 1;
        const hasMultipleShifts = shiftCount >= 2;
        const nameToShow = userAbbreviations.get(assignedUser.userId) || assignedUser.userName;

        const badgeContent = (
            <Badge className={cn("h-auto py-0.5 text-xs", getRoleColor(userRole))}>
                {isBusy && <AlertTriangle className="h-3 w-3 mr-1 text-destructive-foreground"/>}
                {hasMultipleShifts && (
                    <span className={cn("font-bold mr-1", shiftCount > 2 ? 'text-red-500' : 'text-yellow-500')}>{shiftCount}</span>
                )}
                {nameToShow}
            </Badge>
        );

        const tooltipContent = [
            isBusy && "Nhân viên này không đăng ký rảnh.",
            hasMultipleShifts && `Nhân viên này được xếp ${shiftCount} ca hôm nay.`
        ].filter(Boolean).join(' ');
        
        if (tooltipContent) {
            return (
                <Tooltip delayDuration={100}>
                    <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
                    <TooltipContent><p>{tooltipContent}</p></TooltipContent>
                </Tooltip>
            );
        }

        return badgeContent;
    };

    return (
        <TooltipProvider>
            <div className="flex flex-col xl:flex-row gap-8">
                {/* Main Schedule View */}
                <div className="flex-1">
                    <Card>
                        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                             <div>
                                <CardTitle>Lịch tuần: {format(weekInterval.start, 'dd/MM')} - {format(weekInterval.end, 'dd/MM/yyyy')}</CardTitle>
                                <CardDescription>Trạng thái: <span className="font-semibold">{localSchedule?.status || 'Chưa có lịch'}</span></CardDescription>
                            </div>
                             <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" onClick={() => handleDateChange('prev')}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button variant={isCurrentWeek ? "secondary" : "outline"} size="sm" onClick={() => setCurrentDate(new Date())}>Tuần này</Button>
                                <Button variant="outline" size="icon" onClick={() => handleDateChange('next')}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                             {/* Desktop View */}
                            <div className="overflow-x-auto hidden md:block">
                                <Table className="table-fixed w-full border">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-36 font-bold text-center">Ngày</TableHead>
                                            {shiftTemplates.map(template => (
                                                <TableHead key={template.id} className="text-center font-bold border-l">
                                                    <p>{template.label}</p>
                                                    <p className="text-xs text-muted-foreground font-normal">{template.timeSlot.start} - {template.timeSlot.end}</p>
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {daysOfWeek.map(day => {
                                            const dateKey = format(day, 'yyyy-MM-dd');
                                            return (
                                            <TableRow key={dateKey} className="border-t">
                                                <TableCell className="font-semibold align-top text-center">
                                                    <p>{format(day, 'eee, dd/MM', { locale: vi })}</p>
                                                </TableCell>
                                                {shiftTemplates.map(template => {
                                                    const dayOfWeek = getDay(day);

                                                    if (!(template.applicableDays || []).includes(dayOfWeek)) {
                                                        return <TableCell key={template.id} className="bg-muted/30 border-l" />;
                                                    }
                                                    
                                                    const schedule = localSchedule ?? { weekId, status: 'draft', shifts: [] };
                                                    const shiftForCell = schedule.shifts.find(s => s.date === dateKey && s.templateId === template.id);
                                                    const shiftObject = shiftForCell ?? createShiftFromId(`shift_${dateKey}_${template.id}`);

                                                    if (!shiftObject) return <TableCell key={template.id} className="bg-muted/30 border-l" />;
                                                    
                                                    const minUsers = shiftObject.minUsers ?? 0;
                                                    const isUnderstaffed = minUsers > 0 && shiftObject.assignedUsers.length < minUsers;

                                                    const sortedAssignedUsers = [...shiftObject.assignedUsers].sort((a, b) => {
                                                        const userA = allUsers.find(u => u.uid === a.userId);
                                                        const userB = allUsers.find(u => u.uid === b.userId);
                                                        if (!userA || !userB) return 0;
                                                        return (roleOrder[userA.role] || 99) - (roleOrder[userB.role] || 99);
                                                    });

                                                    return (
                                                        <TableCell key={template.id} className={cn("p-1 align-top h-28 text-center border-l", isUnderstaffed && "bg-destructive/10")}>
                                                            <Button 
                                                                variant="ghost" 
                                                                className="h-full w-full flex flex-col items-center justify-center p-1 group"
                                                                onClick={() => handleOpenAssignmentDialog(shiftObject)}
                                                                disabled={!canEditSchedule}
                                                            >
                                                                 {isUnderstaffed && <AlertTriangle className="w-4 h-4 text-destructive absolute top-1.5 right-1.5" />}
                                                                {shiftObject.assignedUsers.length === 0 ? (
                                                                    <div className="text-muted-foreground group-hover:text-primary">
                                                                        <UserPlus className="h-6 w-6 mx-auto" />
                                                                        <span className="text-xs mt-1">Thêm</span>
                                                                    </div>
                                                                ) : (
                                                                     <div className="flex-grow w-full flex flex-row flex-wrap items-center justify-center content-center gap-1 py-1">
                                                                        {sortedAssignedUsers.map(assignedUser => (
                                                                            <React.Fragment key={assignedUser.userId}>
                                                                                {renderUserBadge(assignedUser, dateKey, shiftObject)}
                                                                            </React.Fragment>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </Button>
                                                        </TableCell>
                                                    )
                                                })}
                                            </TableRow>
                                        )})}
                                    </TableBody>
                                </Table>
                            </div>
                             {/* Mobile View */}
                             <div className="block md:hidden space-y-2">
                                <div className="flex justify-end">
                                    <Button variant="outline" size="sm" onClick={handleToggleAllMobileDays}>
                                        <ChevronsDownUp className="mr-2 h-4 w-4" />
                                        {areAllMobileDaysOpen ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}
                                    </Button>
                                </div>
                                <Accordion type="multiple" value={openMobileDays} onValueChange={setOpenMobileDays}>
                                    {daysOfWeek.map(day => {
                                        const dateKey = format(day, 'yyyy-MM-dd');
                                        const schedule = localSchedule ?? { weekId, status: 'draft', shifts: [] };
                                        const applicableTemplates = shiftTemplates.filter(t => (t.applicableDays || []).includes(getDay(day)));
                                        const shiftsForDay = applicableTemplates.map(template => {
                                            return schedule.shifts.find(s => s.date === dateKey && s.templateId === template.id) ?? createShiftFromId(`shift_${dateKey}_${template.id}`);
                                        }).filter(Boolean) as AssignedShift[];
                                        
                                        return (
                                            <AccordionItem value={dateKey} key={dateKey} className="border-b group">
                                                <div className="p-4 bg-muted/30 rounded-t-md">
                                                    <AccordionTrigger className="font-semibold text-base hover:no-underline p-0">
                                                        <span className="text-lg">{format(day, 'eeee, dd/MM', { locale: vi })}</span>
                                                    </AccordionTrigger>
                                                    <div className="w-full space-y-2 mt-2 group-data-[state=open]:hidden">
                                                        {shiftsForDay.map(shiftObject => {
                                                            if (!shiftObject || shiftObject.assignedUsers.length === 0) return null;
                                                            const sortedAssignedUsers = [...shiftObject.assignedUsers].sort((a, b) => {
                                                                const userA = allUsers.find(u => u.uid === a.userId);
                                                                const userB = allUsers.find(u => u.uid === b.userId);
                                                                if (!userA || !userB) return 0;
                                                                return (roleOrder[userA.role] || 99) - (roleOrder[userB.role] || 99);
                                                            });
                                                            return (
                                                                <div key={shiftObject.id} className="flex items-start gap-2 flex-wrap text-sm font-normal">
                                                                    <span className="font-semibold">{shiftObject.label}:</span>
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {sortedAssignedUsers.map(assignedUser => (
                                                                           <React.Fragment key={assignedUser.userId}>
                                                                            {renderUserBadge(assignedUser, dateKey, shiftObject)}
                                                                          </React.Fragment>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                                <AccordionContent className="pt-2">
                                                    <div className="space-y-3 p-2 border border-t-0 rounded-b-md">
                                                        {applicableTemplates.length > 0 ? applicableTemplates.map(template => {
                                                            const shiftObject = shiftsForDay.find(s => s.templateId === template.id);
                                                            if (!shiftObject) return null;

                                                            const minUsers = shiftObject.minUsers ?? 0;
                                                            const isUnderstaffed = minUsers > 0 && shiftObject.assignedUsers.length < minUsers;
                                                            
                                                             const sortedAssignedUsers = [...shiftObject.assignedUsers].sort((a, b) => {
                                                                const userA = allUsers.find(u => u.uid === a.userId);
                                                                const userB = allUsers.find(u => u.uid === b.userId);
                                                                if (!userA || !userB) return 0;
                                                                return (roleOrder[userA.role] || 99) - (roleOrder[userB.role] || 99);
                                                            });

                                                            return (
                                                                <div key={template.id} className={cn("p-3 border rounded-md bg-card", isUnderstaffed && "border-destructive bg-destructive/10")}>
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <div className="flex-1">
                                                                            <p className="font-semibold">{template.label}</p>
                                                                            <p className="text-sm text-muted-foreground">{template.timeSlot.start} - {template.timeSlot.end}</p>
                                                                            <p className="text-xs text-muted-foreground">({template.role} | Min: {minUsers})</p>
                                                                        </div>
                                                                        <Button 
                                                                            variant="secondary"
                                                                            onClick={() => handleOpenAssignmentDialog(shiftObject)}
                                                                            disabled={!canEditSchedule}
                                                                            className="bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-200 dark:hover:bg-blue-900 shrink-0 sm:size-auto sm:px-3 size-9 px-0"
                                                                        >
                                                                            <UserPlus className="h-4 w-4 sm:mr-2" />
                                                                            <span className="sr-only sm:not-sr-only">Phân công</span>
                                                                        </Button>
                                                                    </div>
                                                                     <div className="flex flex-wrap gap-1 mt-2">
                                                                        {sortedAssignedUsers.map(assignedUser => (
                                                                           <React.Fragment key={assignedUser.userId}>
                                                                            {renderUserBadge(assignedUser, dateKey, shiftObject)}
                                                                          </React.Fragment>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }) : (
                                                            <p className="text-sm text-muted-foreground text-center py-4">Không có ca làm việc.</p>
                                                        )}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        )
                                    })}
                                 </Accordion>
                             </div>
                        </CardContent>
                         <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t">
                            <div className="w-full sm:w-auto flex items-center gap-2">
                                {user?.role === 'Chủ nhà hàng' && (
                                    <Button variant="outline" onClick={() => setIsTemplatesDialogOpen(true)} className="flex-1 sm:flex-none">
                                        <Settings className="mr-2 h-4 w-4"/> Mẫu ca
                                    </Button>
                                )}
                                <Button variant="outline" onClick={() => setIsHistoryDialogOpen(true)} className="flex-1 sm:flex-none">
                                    <History className="mr-2 h-4 w-4"/> Lịch sử
                                </Button>
                            </div>
                             <div className="w-full sm:w-auto relative">
                                <Button variant="secondary" onClick={() => setIsPassRequestsDialogOpen(true)} className="w-full">
                                    <MailQuestion className="mr-2 h-4 w-4"/>
                                    Yêu cầu Pass ca
                                    {pendingRequestCount > 0 && (
                                        <Badge variant="destructive" className="ml-2">
                                            {pendingRequestCount}
                                        </Badge>
                                    )}
                                </Button>
                            </div>
                            <div className="flex-1" />
                             <div className="flex items-center justify-end gap-4 flex-wrap">
                                 {user?.role === 'Chủ nhà hàng' && (!localSchedule || !localSchedule.status || localSchedule.status === 'proposed') && !hasUnsavedChanges && (
                                     <AlertDialog open={showAdminActionConfirm} onOpenChange={setShowAdminActionConfirm}>
                                         <AlertDialogTrigger asChild>
                                             <Button variant="destructive" disabled={isSubmitting}>
                                                 <FileX2 className="mr-2 h-4 w-4"/>
                                                 {localSchedule?.status === 'proposed' ? 'Trả về bản nháp' : 'Tạo bản nháp'}
                                             </Button>
                                         </AlertDialogTrigger>
                                         <AlertDialogContent>
                                             <AlertDialogHeader>
                                                 <AlertDialogTitle>
                                                     {localSchedule?.status === 'proposed' ? 'Từ chối lịch đề xuất?' : 'Tạo lịch nháp mới?'}
                                                 </AlertDialogTitle>
                                                 <AlertDialogDescription>
                                                     {localSchedule?.status === 'proposed' 
                                                         ? "Hành động này sẽ chuyển lịch trở lại trạng thái 'Bản nháp', cho phép Quản lý tiếp tục chỉnh sửa."
                                                         : "Tuần này chưa có lịch. Hành động này sẽ tạo một lịch nháp mới dựa trên các mẫu ca hiện có."
                                                     }
                                                 </AlertDialogDescription>
                                             </AlertDialogHeader>
                                             <AlertDialogFooter>
                                                 <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                 <AlertDialogAction onClick={() => {
                                                     if (localSchedule?.status === 'proposed') {
                                                         handleUpdateStatus('draft');
                                                     } else {
                                                         handleCreateDraft();
                                                     }
                                                 }}>
                                                     Xác nhận
                                                 </AlertDialogAction>
                                             </AlertDialogFooter>
                                         </AlertDialogContent>
                                     </AlertDialog>
                                 )}
                                 {user?.role === 'Chủ nhà hàng' && localSchedule?.status === 'published' && !hasUnsavedChanges && (
                                    <AlertDialog open={showRevertConfirm} onOpenChange={setShowRevertConfirm}>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="secondary" disabled={isSubmitting}>
                                                <FileSignature className="mr-2 h-4 w-4"/> Thu hồi lịch
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Thu hồi lịch đã công bố?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Hành động này sẽ thu hồi lịch, ẩn nó khỏi trang của nhân viên và chuyển về trạng thái 'Bản nháp' để bạn có thể tiếp tục chỉnh sửa.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleUpdateStatus('draft')}>Xác nhận thu hồi</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                )}
                            </div>
                        </CardFooter>
                    </Card>
                </div>
                {/* Side Panel */}
                <div className="w-full xl:w-80 xl:sticky xl:top-4">
                   <TotalHoursTracker 
                        schedule={localSchedule}
                        availability={availability}
                        allUsers={allUsers}
                        onUserClick={handleUserClick}
                        currentUserRole={user?.role || null}
                    />
                </div>
            </div>

             {isFabVisible && (
                <div className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6">
                    <div className="relative">
                        {isPublishAction ? (
                             <AlertDialog open={showPublishConfirm} onOpenChange={setShowPublishConfirm}>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        size="lg"
                                        className="rounded-full shadow-lg h-16 w-auto px-6"
                                        disabled={isSubmitting}
                                        aria-label={fabLabel!}
                                    >
                                        {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : fabIcon}
                                        <span className="ml-2 text-base">{fabLabel}</span>
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Công bố lịch làm việc?</AlertDialogTitle><AlertDialogDescription>Hành động này sẽ công bố lịch cho tất cả nhân viên. Nếu có thay đổi chưa lưu, chúng cũng sẽ được lưu lại.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => handleUpdateStatus('published')}>Xác nhận Công bố</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        ) : (
                            <Button
                                size="lg"
                                className="rounded-full shadow-lg h-16 w-auto px-6"
                                onClick={fabAction!}
                                disabled={isSubmitting}
                                aria-label={fabLabel!}
                            >
                                {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : fabIcon}
                                <span className="ml-2 text-base">{fabLabel}</span>
                            </Button>
                        )}
                        
                        {hasUnsavedChanges && (
                            <div className="absolute -top-1 -right-1 flex h-4 w-4">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-background"></span>
                            </div>
                        )}
                    </div>
                </div>
            )}
           

            {activeShift && user && (
                <ShiftAssignmentDialog
                    isOpen={isAssignmentDialogOpen}
                    onClose={() => {
                        setIsAssignmentDialogOpen(false);
                        setActiveNotification(null);
                        setActiveShift(null);
                    }}
                    shift={activeShift}
                    allUsers={allUsers}
                    currentUserRole={user.role}
                    currentUserName={user.displayName}
                    availability={availability}
                    onSave={handleUpdateShiftAssignment}
                    allShiftsOnDay={localSchedule?.shifts.filter(s => s.date === activeShift.date) || []}
                    passRequestingUser={activeNotification?.payload.requestingUser}
                />
            )}

            <PassRequestsDialog
                isOpen={isPassRequestsDialogOpen}
                onClose={() => setIsPassRequestsDialogOpen(false)}
                notifications={notifications}
                allUsers={allUsers}
                weekInterval={weekInterval}
                onAccept={handleTakeShift} 
                onDecline={handleDeclineShift}
                onCancel={handleCancelPassRequest}
                onRevert={handleRevertRequest}
                onAssign={handleAssignShift}
                onApprove={handleApproveRequest}
                onRejectApproval={handleRejectApproval}
                processingNotificationId={processingNotificationId}
                schedule={localSchedule}
            />
            
            {selectedUserForDetails && (
                <UserDetailsDialog
                    isOpen={isUserDetailsDialogOpen}
                    onClose={() => setSelectedUserForDetails(null)}
                    user={selectedUserForDetails}
                    weekAvailability={availability.filter(a => a.userId === selectedUserForDetails.uid)}
                />
            )}

            {user?.role === 'Chủ nhà hàng' && (
                <>
                    <ShiftTemplatesDialog
                        isOpen={isTemplatesDialogOpen}
                        onClose={() => setIsTemplatesDialogOpen(false)}
                    />
                    <HistoryAndReportsDialog
                        isOpen={isHistoryDialogOpen}
                        onClose={() => setIsHistoryDialogOpen(false)}
                        allUsers={allUsers}
                    />
                </>
            )}
        </TooltipProvider>
    )
}
